# Capa de datos y queries

> Área DAT · auditoría de código NIVL · anclada al código real

Alcance leído (código real): `src/lib/data.ts`, `src/lib/dungeons.ts`, `src/lib/body.ts`, `src/lib/journal.ts`. Contexto verificado de consumidores y esquema: `src/lib/engine.ts`, `src/lib/achievements.ts`, `src/lib/exporter.ts`, `src/lib/types.ts`, `src/lib/dates.ts`, `src/lib/supabase.ts`, `src/app/(tabs)/index.tsx`, `src/app/(tabs)/mazmorras.tsx`, `src/app/(tabs)/agenda.tsx`, `src/app/(tabs)/perfil.tsx`, `src/app/gym.tsx`, `src/app/dieta.tsx`, `src/app/diario.tsx`, `src/app/dungeon/[id].tsx`, `src/app/informe.tsx`, `supabase/migrations/0001..0003`.

El hilo de esta área es el **manejo de errores asimétrico** dentro de la propia capa de datos: las funciones que devuelven listas (`fetch*`) sí desestructuran `error` y hacen `throw`, pero **todas las funciones de conteo y las de lectura puntual con `maybeSingle`/`createSignedUrl` se tragan el error** (`const { count } = ...`, `const { data } = ...`) y devuelven `0` / `null` como si fuera un resultado legítimo. Esos ceros alimentan directamente `evaluateAchievements`, los contadores del perfil y la lógica de detección de PRs. Sumado a esto: varias lecturas son **escaneos de tabla completa sin límite** que crecen con el historial, un "upsert" de dieta que **no se apoya en ninguna restricción única** (porque `meal_slots` no la tiene), y subidas a Storage que **nunca borran el fichero anterior**. Lo que sigue distingue cuidadosamente lo nuevo de lo ya cubierto por el área SQL (04) —que atacó RLS/CHECK/atomicidad en el servidor— y de los bugs ya arreglados.

---

## Bugs y riesgos

### CRIT-DAT-01 · `completionStats` ignora el error de la query y devuelve 0, regresando logros — `data.ts:76-85` · severidad alta
**Problema:** la función desestructura solo `count` en ambas queries (`const { count: total } = await supabase...`, `const { count: withEvidence } = ...`) y nunca mira `error`. Si una de las dos consultas falla (red intermitente, token caducado a mitad de sesión, RLS), devuelve `{ total: 0, withEvidence: 0 }` **sin distinguirlo de un usuario sin actividad**. Ese resultado se pasa tal cual a `evaluateAchievements({ totalCompletions: stats.total, evidenceCount: stats.withEvidence })` en `index.tsx:129-139` y a las KPIs del perfil (`perfil.tsx:69`). Consecuencias reales: el contador "Misiones completadas / Con evidencia" del perfil parpadea a 0 ante un fallo transitorio, y —peor— en la pantalla Sistema un `total:0` espurio hace que `evaluateAchievements` no devuelva los logros de hito ya alcanzados; aunque `unlockAchievements` no los "des-otorga" en BD, la evaluación de ese ciclo queda muda y un primer arranque con fallo puede no desbloquear `first_quest` aunque la inserción del completado sí ocurriera.
**Arreglo:** desestructurar y propagar el error igual que el resto de `fetch*`:
```ts
const { count: total, error: e1 } = await supabase.from('completions').select('*', { count:'exact', head:true });
if (e1) throw e1;
const { count: withEvidence, error: e2 } = await supabase.from('completions').select('*', { count:'exact', head:true }).not('evidence_url','is',null);
if (e2) throw e2;
```
Así el `catch` de la pantalla muestra "Error del sistema" en vez de degradar a 0 silenciosamente.

### CRIT-DAT-02 · `insertEvent` traga cualquier error → crónica y contadores de logros desincronizados — `data.ts:87-93` · severidad alta
**Problema:** `insertEvent` hace `await supabase.from('events').insert(...)` **sin capturar `error` ni `throw`**. Los eventos no son decorativos: son la fuente de verdad de la "crónica automática" (`diario.tsx:93` lee `events` del día) y, sobre todo, del conteo de PRs para logros. En `gym.tsx:130-138` se insertan los eventos `gym_pr` y *acto seguido* se cuenta `events where type='gym_pr'` para evaluar el logro `pr_10`. Si el `insert` de `insertEvent` falla en silencio, el `count` posterior no incluye esos PRs y el logro nunca se desbloquea, sin ningún error visible. Lo mismo afecta a `level_up`, `penalty`, `stone_used/earned` que `engine.ts` emite vía `insertEvent`: un fallo deja la crónica incompleta y el informe sin rastro del cierre.
**Arreglo:** devolver/propagar el error: `const { error } = await supabase.from('events').insert({...}); if (error) throw error;`. Si se prefiere que los eventos sean "best-effort" y nunca tumben el flujo de XP, entonces hay que hacerlo **explícito** (try/catch local que registre el fallo) en lugar de un descarte mudo, y nunca contar PRs inmediatamente después asumiendo que el insert cuajó.

### CRIT-DAT-03 · `upsertMealSlot` es leer-luego-insertar sobre una tabla SIN unique → duplica comidas — `body.ts:118-138` + `0002_fases.sql:87-94` · severidad media
**Problema:** la función se llama "upsert" pero no lo es: si `input.id` viene, hace `UPDATE`; si no, hace `INSERT` pelado. La decisión depende 100% de que el cliente haya encontrado el `existing` antes (`dieta.tsx:57-62` `daySlots.find(s => s.slot === slotName)`). El esquema de `meal_slots` **no tiene `unique(user_id, day_of_week, slot)`** —solo el índice no único `meal_slots_day_idx` (`0002_fases.sql:131`)—. Por tanto nada en BD impide dos filas para el mismo (día, slot): basta un doble toque en "Guardar" cuando aún no existía la fila, o editar el mismo slot desde dos montajes/dispositivos antes de que `load()` refresque. Resultado: filas duplicadas que luego `daySlots.find` **oculta** (devuelve solo la primera), de modo que el usuario ve una comida pero hay dos en BD, y `ingredientsFromPlan` (`body.ts:178-193`) las cuenta dos veces al generar la compra. Nótese el contraste con `gym_sessions`/`journal_entries`, que **sí** tienen `unique(user_id,date)` (por eso el área SQL los trató): aquí el problema es la **ausencia** de la restricción, no su manejo.
**Arreglo:** (1) añadir en migración 0004 `alter table meal_slots add constraint meal_slots_uq unique (user_id, day_of_week, slot);` y (2) convertir la función en un upsert real de un solo round-trip: `supabase.from('meal_slots').upsert({ user_id, day_of_week, slot, description, ingredients }, { onConflict: 'user_id,day_of_week,slot' })`, eliminando la rama `if (input.id)`. Mientras no haya unique, como mínimo no presentar la operación como idempotente.

### CRIT-DAT-04 · `fetchMaxLifts` descarga TODO el histórico de `gym_lifts` en cada fin de sesión — `body.ts:88-99` + `gym.tsx:114` · severidad media
**Problema:** para detectar PRs, `fetchMaxLifts` ejecuta `supabase.from('gym_lifts').select('exercise_name, weight')` **sin filtro, sin límite y sin agregación**, y calcula el máximo por ejercicio en JS. Se invoca en `finishTraining` (`gym.tsx:114`) *cada vez* que se cierra una sesión. El número de filas en `gym_lifts` crece de forma monótona con cada entrenamiento (una fila por serie top y ejercicio), así que el coste de cada cierre de sesión aumenta indefinidamente: a los meses son cientos/miles de filas transferidas al móvil solo para sacar un `MAX`. Es un N+1 invertido (un escaneo total recurrente) y una transferencia de datos evitable.
**Arreglo:** mover el cálculo al servidor con una vista o RPC que agregue: `select exercise_name, max(weight) as max_w from gym_lifts where user_id = auth.uid() group by exercise_name`, expuesta como vista `gym_lift_maxes` o RPC. El cliente recibe una fila por ejercicio en vez de toda la historia. Si se quiere algo intermedio sin tocar SQL, al menos limitar a los ejercicios de la sesión actual con `.in('exercise_name', valid.map(l=>l.exercise_name))`.

### CRIT-DAT-05 · `uploadAvatar`/`uploadEvidence` con `upsert:true` inútil y sin borrar el fichero anterior → fuga en Storage — `data.ts:95-116` · severidad media
**Problema:** ambas rutas incluyen `Date.now()` en el nombre (`${userId}/avatar_${Date.now()}.jpg`, `${userId}/${date}_${questId}_${Date.now()}.jpg`), por lo que **cada subida genera una ruta nueva** y `upsert:true` (`data.ts:104,113`) no sobrescribe nada (nunca colisiona). El avatar antiguo queda huérfano en el bucket: `pickAvatar` (`perfil.tsx:98-101`) sube uno nuevo y hace `updateProfile({ avatar_url: path })`, pero el objeto anterior **no se borra jamás**. Con cada cambio de foto se acumula basura en `avatars/`; con cada re-subida de evidencia (re-completar tras error) se acumula en `evidence/`. Es la cuota de Supabase del dueño la que paga, y el `upsert:true` da una falsa sensación de "reemplazo".
**Arreglo:** o bien usar una ruta **estable** y dejar que `upsert:true` haga su trabajo (`${userId}/avatar.jpg`), evitando huérfanos sin código extra; o bien, si se quiere historial por timestamp, borrar el anterior tras éxito: tras `updateProfile`, `supabase.storage.from('avatars').remove([oldPath])`. Para evidencias, optar por ruta determinista por `(date,questId)` también elimina duplicados al re-subir.

### CRIT-DAT-06 · Lecturas puntuales (`maybeSingle`/`signedUrl`) tragan el error y lo confunden con "no existe" — `data.ts:5-7,118-121` · `body.ts:57-59` · `journal.ts:4-7` · severidad media
**Problema:** varias lecturas descartan `error` y devuelven `null`, haciendo indistinguible "no hay fila" de "la query falló":
- `ensureProfile` (`data.ts:6`): el primer `select(...).maybeSingle()` solo coge `data`; si esa lectura falla por red, `data` es `undefined` y la función cae al camino de `upsert`/insert innecesariamente (o enmascara el fallo real con un error de escritura posterior).
- `signedUrl` (`data.ts:118-121`): `const { data } = await ...createSignedUrl(...)`; ante error devuelve `null` y el avatar simplemente "desaparece" en `perfil.tsx:197` sin pista de por qué.
- `fetchSessionForDate` (`body.ts:57-59`) y `fetchEntryForDate` (`journal.ts:4-7`): un error de lectura se presenta como "hoy no hay sesión / entrada", lo que en `diario.tsx`/`gym.tsx` lleva al usuario a re-crear algo que quizá ya existe (y entonces sí choca contra el `unique(user_id,date)`).
**Arreglo:** desestructurar `error` y, al menos, propagarlo en `fetchSessionForDate`/`fetchEntryForDate`/`ensureProfile` (no en `signedUrl`, donde `null` puede ser válido, pero ahí conviene loguear el error). Estas tres lecturas son la antesala de inserts con restricción única, así que tragarse su error convierte un fallo de red en un `duplicate key`.

### CRIT-DAT-07 · `unlockAchievements` enmascara el fallo de inserción devolviendo `[]` (logro perdido y silencioso) — `achievements.ts:97-101` · severidad media
**Problema:** tras filtrar los códigos frescos, `unlockAchievements` hace `insert(...)` y, si hay `error`, **retorna `[]`** (`if (error) return []`). El llamador (`index.tsx:130`, `gym.tsx:138`, `diario.tsx:123`, `dungeon/[id].tsx:118`) interpreta `[]` como "no había logros nuevos" y **no muestra nada**. Si el insert falló de verdad (no por duplicado, sino por red/RLS), el logro nunca se otorga y el usuario nunca se entera; además, como `fetchUnlocked` (`achievements.ts:83-86`) también traga su error y devuelve un `Set` vacío, en un fallo de lectura **todos** los códigos parecen "frescos" y se intenta re-insertar, apoyándose solo en el `unique(user_id,code)` para no duplicar —pero ese choque vuelve a caer en `return []`. Aunque está en `achievements.ts` (vecino), es 100% capa de datos y afecta a los cuatro flujos que auditamos.
**Arreglo:** distinguir el duplicado (código `23505`, benigno) del resto. Tratar solo el conflicto único como "ya estaba" y propagar/loguear los demás errores; idealmente usar `insert(...).onConflict('user_id,code').ignoreDuplicates()` y dejar que un fallo real haga `throw`.

### CRIT-DAT-08 · Regenerar la lista de la compra acumula duplicados contra lo ya existente — `body.ts:156-165,178-193` + `dieta.tsx:84-104` · severidad media
**Problema:** `ingredientsFromPlan` deduplica ingredientes **dentro del plan** (por nombre en minúsculas), pero `addShoppingItems` (`body.ts:156-165`) hace un `insert` plano de todos ellos **sin comparar con los `shopping_items` que ya hay en BD**. `generateList` (`dieta.tsx:84-104`) se puede pulsar tantas veces como se quiera, y cada pulsación vuelve a insertar "pollo, arroz, brócoli…" aunque ya estén en la lista. `shopping_items` no tiene unique (`0002_fases.sql:96-103`), así que crecen sin tope y `fetchShoppingItems` (`body.ts:146-154`) los lista todos repetidos. No hay invalidación ni "merge".
**Arreglo:** antes de insertar, leer los nombres ya presentes y filtrar (`const existing = new Set(items.map normalizado)`), o añadir `unique(user_id, lower(name))` y usar `upsert ... ignoreDuplicates`. Como mínimo, en `generateList`, avisar de cuántos eran nuevos vs ya en lista.

### CRIT-DAT-09 · `fetchCompletionsSince` sin cota superior ni límite: escaneo grande tras inactividad — `data.ts:61-68` + `engine.ts:45` · severidad baja
**Problema:** `fetchCompletionsSince(fromDate)` filtra solo `gte('date', fromDate)`, **sin `lte` ni `.limit()`**. `informe.tsx:23` lo acota a 91 días, pero `processPendingDays` (`engine.ts:44-45`) lo llama con `fromDate = addDays(last_day_processed, 1)`: si la app lleva meses sin abrirse, `last_day_processed` queda muy atrás y se descargan **todas** las completions del periodo para reconstruir el cierre, en el camino crítico del arranque (`index.tsx:55`). No es crítico para un solo usuario, pero es una query no acotada en el arranque que escala con el tiempo sin abrir.
**Arreglo:** el cierre solo necesita las completions del rango `[fromDate, ayer]`; añadir `.lte('date', yesterday)` reduce el conjunto, y para el informe basta el rango exacto que pinta. Considerar un tope defensivo de días procesables por arranque.

---

## Mejoras

### DAT-001 · Generar tipos de Supabase y tipar el cliente
**Qué:** ejecutar `supabase gen types typescript` y crear `createClient<Database>()`, eliminando los `as Profile`/`as Quest[]` manuales. **Dónde:** `supabase.ts:17` y todos los `return data as X` de los cuatro ficheros. **Impacto:** 5 · **Esfuerzo:** M

### DAT-002 · Eliminar todos los casts `as T` una vez tipado el cliente
**Qué:** con el cliente tipado, los `as Profile`, `as Quest[]`, `as DungeonTask[]`, etc. sobran y ocultan drift de esquema. **Dónde:** `data.ts:7,16,30,48`, `dungeons.ts:11,17,30,50,61,75,108,121`, `body.ts:11,21,35,49,59,72`, `journal.ts:6,16,32,40`. **Impacto:** 4 · **Esfuerzo:** M

### DAT-003 · Propagar error en `completionStats`
**Qué:** desestructurar `error` en ambas queries y `throw`. **Dónde:** `data.ts:76-85`. **Impacto:** 4 · **Esfuerzo:** S

### DAT-004 · Propagar/loguear error en `insertEvent`
**Qué:** capturar `error`; decidir explícitamente entre `throw` o best-effort logueado. **Dónde:** `data.ts:87-93`. **Impacto:** 4 · **Esfuerzo:** S

### DAT-005 · Propagar error en `countSessions`
**Qué:** `const { count, error }`; `if (error) throw error`. **Dónde:** `body.ts:101-104`. **Impacto:** 3 · **Esfuerzo:** S

### DAT-006 · Propagar error en `countClearedDungeons`
**Qué:** ídem; hoy un fallo cuenta como 0 mazmorras despejadas y bloquea logros. **Dónde:** `dungeons.ts:91-97`. **Impacto:** 3 · **Esfuerzo:** S

### DAT-007 · Propagar error en `countEntries`
**Qué:** ídem; alimenta `journal_30`. **Dónde:** `journal.ts:43-48`. **Impacto:** 3 · **Esfuerzo:** S

### DAT-008 · Propagar error en `fetchSessionForDate`
**Qué:** distinguir "no hay sesión" de "fallo de lectura" antes de un insert con unique. **Dónde:** `body.ts:57-59`. **Impacto:** 4 · **Esfuerzo:** S

### DAT-009 · Propagar error en `fetchEntryForDate`
**Qué:** ídem; es la base del "upsert" manual del diario. **Dónde:** `journal.ts:4-7`. **Impacto:** 4 · **Esfuerzo:** S

### DAT-010 · Loguear error en `signedUrl`
**Qué:** capturar `error` de `createSignedUrl`; `null` válido pero el fallo debe verse. **Dónde:** `data.ts:118-121`. **Impacto:** 2 · **Esfuerzo:** S

### DAT-011 · Capturar error de lectura en `ensureProfile`
**Qué:** el primer `select(...).maybeSingle()` ignora `error`; un fallo cae al insert sin necesidad. **Dónde:** `data.ts:6`. **Impacto:** 3 · **Esfuerzo:** S

### DAT-012 · Convertir `upsertMealSlot` en upsert real con `onConflict`
**Qué:** un único round-trip atómico, sin rama `if (input.id)`. **Dónde:** `body.ts:118-138`. **Impacto:** 4 · **Esfuerzo:** M

### DAT-013 · Añadir `unique(user_id, day_of_week, slot)` a `meal_slots` (migración 0004)
**Qué:** restricción que respalde el upsert y prohíba duplicados de comida. **Dónde:** `0002_fases.sql:87-94` (vía 0004). **Impacto:** 4 · **Esfuerzo:** S

### DAT-014 · Agregar el máximo de lifts en servidor (vista/RPC)
**Qué:** sustituir el escaneo total de `fetchMaxLifts` por `max(weight) group by exercise_name`. **Dónde:** `body.ts:88-99`. **Impacto:** 4 · **Esfuerzo:** M

### DAT-015 · Acotar `fetchMaxLifts` a los ejercicios de la sesión (mientras no haya RPC)
**Qué:** `.in('exercise_name', nombresDeLaSesión)` reduce filas transferidas. **Dónde:** `body.ts:89` + `gym.tsx:114`. **Impacto:** 3 · **Esfuerzo:** S

### DAT-016 · Usar ruta estable en `uploadAvatar` para evitar huérfanos
**Qué:** `${userId}/avatar.jpg` + `upsert:true` reemplaza en sitio. **Dónde:** `data.ts:109-116`. **Impacto:** 3 · **Esfuerzo:** S

### DAT-017 · Borrar el avatar anterior si se mantiene ruta con timestamp
**Qué:** tras `updateProfile`, `storage.remove([oldPath])`. **Dónde:** `data.ts:109-116` + `perfil.tsx:98-101`. **Impacto:** 3 · **Esfuerzo:** M

### DAT-018 · Ruta determinista para evidencias por `(date, questId)`
**Qué:** evita acumular evidencias huérfanas al re-completar tras error. **Dónde:** `data.ts:95-107`. **Impacto:** 2 · **Esfuerzo:** S

### DAT-019 · Quitar `upsert:true` donde no aplica
**Qué:** con ruta única por `Date.now()`, `upsert:true` es engañoso; eliminarlo o documentarlo. **Dónde:** `data.ts:104,113`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-020 · Deduplicar la compra contra lo ya existente
**Qué:** filtrar nombres ya presentes antes de `addShoppingItems`. **Dónde:** `body.ts:156-165` + `dieta.tsx:84-104`. **Impacto:** 3 · **Esfuerzo:** M

### DAT-021 · `unique(user_id, lower(name))` en `shopping_items`
**Qué:** respaldo a nivel BD para la dedup de la compra. **Dónde:** `0002_fases.sql:96-103` (vía 0004). **Impacto:** 2 · **Esfuerzo:** S

### DAT-022 · Acotar `fetchCompletionsSince` con `lte`
**Qué:** añadir cota superior al rango (`ayer` para cierre, rango exacto para informe). **Dónde:** `data.ts:61-68`. **Impacto:** 2 · **Esfuerzo:** S

### DAT-023 · Distinguir `23505` de otros errores en `unlockAchievements`
**Qué:** tratar solo el duplicado como benigno; propagar el resto. **Dónde:** `achievements.ts:97-101`. **Impacto:** 3 · **Esfuerzo:** S

### DAT-024 · Propagar error de lectura en `fetchUnlocked`
**Qué:** un fallo no debe devolver `Set` vacío (haría parecer todo "fresco"). **Dónde:** `achievements.ts:83-86`. **Impacto:** 3 · **Esfuerzo:** S

### DAT-025 · `fetchTasks` con `select` de columnas, no `*`
**Qué:** la UI usa pocos campos; pedir solo los necesarios. **Dónde:** `dungeons.ts:43-51`. **Impacto:** 2 · **Esfuerzo:** S

### DAT-026 · Evitar el N+1 latente de tareas por mazmorra
**Qué:** documentar/forzar que la lista use un único `select dungeon_id,done` (como hoy `mazmorras.tsx:44`) y no `fetchTasks` por tarjeta. **Dónde:** `dungeons.ts:43-51` + `mazmorras.tsx:41-56`. **Impacto:** 3 · **Esfuerzo:** S

### DAT-027 · Exponer agregado de progreso de mazmorras en servidor
**Qué:** vista `dungeon_progress (dungeon_id, total, done)` para que la lista no traiga todas las tareas. **Dónde:** `mazmorras.tsx:44` + `dungeons.ts`. **Impacto:** 3 · **Esfuerzo:** M

### DAT-028 · Paginar `fetchShoppingItems`
**Qué:** sin `.limit()`, una lista acumulada (ver DAT-020) crece sin tope. **Dónde:** `body.ts:146-154`. **Impacto:** 2 · **Esfuerzo:** S

### DAT-029 · Paginar/limitar `fetchGymExercises`
**Qué:** trae **todos** los ejercicios de todos los días y filtra en cliente (`gym.tsx:88`); aceptable hoy, pero conviene límite. **Dónde:** `body.ts:29-36`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-030 · Filtrar `meal_slots` por día en servidor cuando se edita un día
**Qué:** `fetchMealSlots` trae la semana entera; la dieta filtra por `day` en cliente. Ofrecer `fetchMealSlotsForDay`. **Dónde:** `body.ts:109-116` + `dieta.tsx:55`. **Impacto:** 2 · **Esfuerzo:** S

### DAT-031 · `exportAllData`: paginar tabla a tabla
**Qué:** `select('*')` de 15 tablas sin límite puede topar el límite de filas de PostgREST (1000 por defecto). **Dónde:** `exporter.ts:31-35`. **Impacto:** 3 · **Esfuerzo:** M

### DAT-032 · `exportAllData`: continuar ante error de una tabla
**Qué:** hoy un fallo en una tabla aborta todo el export; registrar y seguir. **Dónde:** `exporter.ts:32-33`. **Impacto:** 2 · **Esfuerzo:** S

### DAT-033 · Capa de caché para `fetchQuests`
**Qué:** se llama en Sistema, Agenda e Informe; sin caché se re-descarga en cada foco. **Dónde:** `data.ts:24-31` + `index.tsx:54`, `agenda.tsx:57`, `informe.tsx:24`. **Impacto:** 3 · **Esfuerzo:** L

### DAT-034 · Invalidación de caché tras mutaciones de quests
**Qué:** `createQuest`/`setQuestActive`/`deleteQuest` deben invalidar la caché de DAT-033. **Dónde:** `data.ts:41-59`. **Impacto:** 3 · **Esfuerzo:** M

### DAT-035 · Centralizar el patrón de error de Supabase en un helper
**Qué:** un wrapper `unwrap({data,error})` que haga `throw` uniformiza las 40+ desestructuraciones y elimina las omisiones de `error`. **Dónde:** todos los `fetch*`/`count*` de los cuatro ficheros. **Impacto:** 4 · **Esfuerzo:** M

### DAT-036 · Mensajes de error con contexto de operación
**Qué:** los `throw error` propagan el mensaje crudo de PostgREST; envolver con "No se pudo cargar misiones", etc. **Dónde:** `data.ts`, `dungeons.ts`, `body.ts`, `journal.ts` (todos los throw). **Impacto:** 3 · **Esfuerzo:** M

### DAT-037 · Reintento con backoff para lecturas idempotentes
**Qué:** las `fetch*` son idempotentes; un reintento corto absorbe fallos de red móvil. **Dónde:** helper de DAT-035. **Impacto:** 3 · **Esfuerzo:** M

### DAT-038 · Tipar `payload` de eventos en vez de `Record<string, unknown>`
**Qué:** uniones discriminadas por `type` evitarían los `String(p.quest ?? '')` defensivos en `diario.tsx`. **Dónde:** `data.ts:87-93`, `journal.ts:50-66`. **Impacto:** 2 · **Esfuerzo:** M

### DAT-039 · Tipar el retorno de `fetchMaxLifts`
**Qué:** el row se castea a `{exercise_name,weight}` a mano; derivarlo del tipo generado. **Dónde:** `body.ts:88-99`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-040 · `fetchRecentEntries`: ordenar por `(date desc, created_at desc)`
**Qué:** desempate estable; hoy solo `date desc`. **Dónde:** `journal.ts:9-17`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-041 · `fetchEventsForDate`: incluir `id` desc como desempate del orden
**Qué:** dos eventos en el mismo `created_at` pueden barajarse en la crónica. **Dónde:** `journal.ts:57-66`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-042 · Validar `fromDate`/rangos con `isValidKey` antes de la query
**Qué:** `fetchCompletionsSince`/`fetchCalendarEvents` confían en strings de fecha; validar con `dates.isValidKey`. **Dónde:** `data.ts:61`, `dungeons.ts:100-109`. **Impacto:** 2 · **Esfuerzo:** S

### DAT-043 · `fetchCalendarEvents`: límite defensivo de filas
**Qué:** rango acotado por `from/to`, pero sin `.limit()`; un rango amplio podría traer mucho. **Dónde:** `dungeons.ts:100-109`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-044 · `createSession`: convertir a `upsert` por `(user_id,date)`
**Qué:** el `unique(user_id,date)` existe; un upsert evita el choque en doble registro del mismo día. **Dónde:** `body.ts:62-73` + `gym.tsx:117`. **Impacto:** 3 · **Esfuerzo:** M

### DAT-045 · `upsertEntry`: usar `on conflict (user_id,date)` real en BD
**Qué:** sustituir el leer-luego-decidir (no atómico) por un upsert SQL; el cliente ya no hace dos round-trips. **Dónde:** `journal.ts:19-41`. **Impacto:** 3 · **Esfuerzo:** M

### DAT-046 · Devolver `isNew` desde el upsert con `xmax`/RPC en vez de pre-lectura
**Qué:** para no perder el "isNew" al pasar a upsert (DAT-045), derivarlo en servidor. **Dónde:** `journal.ts:19-41`. **Impacto:** 2 · **Esfuerzo:** M

### DAT-047 · `insertLifts`: validar longitud y truncar nombres
**Qué:** `exercise_name` sin tope de longitud; añadir guardas antes del insert masivo. **Dónde:** `body.ts:75-85`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-048 · `addShoppingItems`/`insertLifts`: trocear inserts grandes
**Qué:** inserts masivos sin batching pueden topar límites; trocear en lotes. **Dónde:** `body.ts:75-85,156-165`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-049 · `seedDefaultQuests`: condición de carrera en el conteo previo
**Qué:** `count===0 ? insert` no es atómico; dos arranques simultáneos podrían sembrar dos veces. **Dónde:** `data.ts:131-139`. **Impacto:** 2 · **Esfuerzo:** M

### DAT-050 · `seedDefaultQuests`: marcar "seeded" en el perfil
**Qué:** una bandera evita el `count` en cada arranque y la carrera de DAT-049. **Dónde:** `data.ts:131-139` + `index.tsx:53`. **Impacto:** 2 · **Esfuerzo:** M

### DAT-051 · `createQuest`/`createDungeon`/`createTask`: validar enums en cliente
**Qué:** confían en que `stat`/`difficulty`/`rank` son válidos; validar contra `STATS`/`DIFFICULTIES` antes de enviar. **Dónde:** `data.ts:41-49`, `dungeons.ts:20-31,64-76`. **Impacto:** 2 · **Esfuerzo:** S

### DAT-052 · `fetchDungeon` con `single()` lanza si no existe: usar `maybeSingle`
**Qué:** un id borrado/ajeno hace `single()` lanzar; `dungeon/[id].tsx:57` lo mete en `catch` genérico. Devolver `null` y mostrar "no existe". **Dónde:** `dungeons.ts:14-18`. **Impacto:** 2 · **Esfuerzo:** S

### DAT-053 · `updateDungeon`/`updateProfile`: comprobar filas afectadas
**Qué:** un `update` que no afecta filas (id ajeno, RLS) hoy pasa como éxito. Pedir `{ count }` y avisar si 0. **Dónde:** `dungeons.ts:33-36`, `data.ts:19-22`. **Impacto:** 2 · **Esfuerzo:** M

### DAT-054 · `deleteQuest`/`deleteDungeon`/etc.: confirmar borrado efectivo
**Qué:** mismas funciones de borrado no verifican que algo se borró. **Dónde:** `data.ts:56-59`, `dungeons.ts:38-41,86-89,124-127`, `body.ts:24-27,52-55,140-143`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-055 · Soft-delete para quests con historial de completions
**Qué:** `deleteQuest` borra en cascada las completions (`on delete cascade`), destruyendo XP histórico del informe. Considerar `active=false` en vez de delete. **Dónde:** `data.ts:56-59` + `0001_init.sql:37`. **Impacto:** 3 · **Esfuerzo:** M

### DAT-056 · `setQuestActive`: invalidar la agenda/sistema al desactivar
**Qué:** desactivar una quest no refresca otras pantallas en foco; ligado a DAT-034. **Dónde:** `data.ts:51-54`. **Impacto:** 2 · **Esfuerzo:** M

### DAT-057 · Centralizar `fetchPendingTasksWithDue` con índice parcial
**Qué:** ya existe `dungeon_tasks_due_idx ... where not done`; confirmar que la query lo usa (orden por `due_date`). **Dónde:** `dungeons.ts:53-62` + `0002_fases.sql:127`. **Impacto:** 2 · **Esfuerzo:** S

### DAT-058 · `fetchDungeons`: ordenar por `status` es por texto (active<cleared<abandoned alfabético)
**Qué:** `order('status')` ordena alfabéticamente, no por prioridad de negocio; explicitar el orden deseado. **Dónde:** `dungeons.ts:4-12`. **Impacto:** 2 · **Esfuerzo:** S

### DAT-059 · Selección de columnas en `fetchDungeons`/`fetchQuests`
**Qué:** `select('*')` trae `description`, `notes`, etc. que la lista no usa. **Dónde:** `dungeons.ts:5`, `data.ts:26`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-060 · `completionStats`: una sola query con filtro condicional
**Qué:** dos round-trips para total y con-evidencia; agregable en uno (`count(*) filter (where evidence_url is not null)`) vía RPC/vista. **Dónde:** `data.ts:76-85`. **Impacto:** 2 · **Esfuerzo:** M

### DAT-061 · Cachear `signedUrl` del avatar
**Qué:** se regenera en cada foco de Sistema/Perfil con TTL de 7 días; cachear hasta caducidad. **Dónde:** `data.ts:118-121` + `perfil.tsx:71-73`. **Impacto:** 2 · **Esfuerzo:** M

### DAT-062 · Evitar `ensureProfile` redundante en bucles de XP
**Qué:** `dungeon/[id].tsx:88,116` y `gym.tsx:124`, `diario.tsx:120` releen el perfil con `ensureProfile` por acción; pasar el perfil ya cargado. **Dónde:** `data.ts:5-17` (consumidores). **Impacto:** 3 · **Esfuerzo:** M

### DAT-063 · `insertEvent` por PR en bucle → un solo insert masivo
**Qué:** `gym.tsx:130-132` inserta un evento por PR en serie; `insertEvent` debería aceptar lote. **Dónde:** `data.ts:87-93` + `gym.tsx:130-132`. **Impacto:** 2 · **Esfuerzo:** S

### DAT-064 · `fetchCompletionsForDate`: seleccionar solo `quest_id,xp_awarded,evidence_url`
**Qué:** `index.tsx:61-63` solo usa esos campos para el mapa. **Dónde:** `data.ts:70-74`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-065 · Unificar `fetchCompletionsForDate` en `fetchCompletionsSince`
**Qué:** un día es un caso de rango; evitar dos funciones casi iguales. **Dónde:** `data.ts:61-74`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-066 · Documentar invariante: `events` es best-effort vs fuente-de-verdad
**Qué:** hoy es ambiguo (la crónica y el conteo de PR dependen de él); decidir y documentar. **Dónde:** `data.ts:87-93`, `journal.ts:50-66`. **Impacto:** 2 · **Esfuerzo:** S

### DAT-067 · Tests de `ingredientsFromPlan` (dedup, separadores, espacios)
**Qué:** función pura sin tests; cubrir `,;\n`, vacíos, mayúsculas. **Dónde:** `body.ts:178-193`. **Impacto:** 2 · **Esfuerzo:** S

### DAT-068 · Tests de `fetchMaxLifts` (reducción a máximos)
**Qué:** la lógica de `max` por ejercicio es pura sobre `data`; extraer y testear. **Dónde:** `body.ts:88-99`. **Impacto:** 2 · **Esfuerzo:** S

### DAT-069 · Tests del mapeo `chronicleLine` por tipo de evento
**Qué:** cubrir cada `case` y el `default → null`. **Dónde:** `diario.tsx:37-61` (lógica de datos). **Impacto:** 2 · **Esfuerzo:** S

### DAT-070 · Mock de Supabase para tests de la capa de datos
**Qué:** sin un doble de `supabase`, los `fetch*` no son testeables; introducir inyección. **Dónde:** `supabase.ts:17` + los cuatro ficheros. **Impacto:** 3 · **Esfuerzo:** L

### DAT-071 · `MEAL_SLOTS` y orden de slots como única fuente
**Qué:** `MEAL_SLOTS` (`body.ts:107`) y el enum SQL del slot pueden divergir; derivar de un sitio. **Dónde:** `body.ts:107` + `0002_fases.sql:91`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-072 · `fetchGymDays`/`fetchMealSlots` ordenan solo por `day_of_week`
**Qué:** dos filas del mismo día no tienen orden estable; añadir desempate. **Dónde:** `body.ts:5-12,109-116`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-073 · `createGymExercise`/`createTask`: calcular `position` en servidor
**Qué:** `position` lo decide el cliente (`exercisesFor(...).length`, `tasks.length`); dos inserts concurrentes colisionan en la misma posición. **Dónde:** `body.ts:38-50`, `dungeons.ts:64-76`. **Impacto:** 2 · **Esfuerzo:** M

### DAT-074 · Reordenación de ejercicios/tareas (falta API)
**Qué:** no hay función para reordenar `position`; necesaria para UX de arrastrar. **Dónde:** `body.ts`, `dungeons.ts`. **Impacto:** 2 · **Esfuerzo:** L

### DAT-075 · `setTaskDone(false)` no decrementa XP (asimetría documentada)
**Qué:** marcar hecho otorga XP (`dungeon/[id].tsx:90`), pero la función `setTaskDone` permite `done=false` sin revertir; documentar o impedir desmarcar tras otorgar. **Dónde:** `dungeons.ts:78-84`. **Impacto:** 2 · **Esfuerzo:** M

### DAT-076 · `createCalendarEvent`: validar/normalizar `time`
**Qué:** `time` es texto libre (`agenda.tsx`); validar formato HH:MM antes de persistir. **Dónde:** `dungeons.ts:111-122`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-077 · `createCalendarEvent`: validar `date` con `isValidKey`
**Qué:** la validación está en la UI (`agenda.tsx:78`); duplicarla en la capa de datos. **Dónde:** `dungeons.ts:111-122`. **Impacto:** 2 · **Esfuerzo:** S

### DAT-078 · Recortar strings en inserts (`title`, `name`, `description`)
**Qué:** el trim vive en las pantallas; centralizarlo evita filas con espacios. **Dónde:** `data.ts:41-49`, `dungeons.ts:20-31,64-76`, `body.ts:14-22,38-50`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-079 · Límite de longitud en campos de texto
**Qué:** ninguna inserción topa longitudes; un `title` enorme degrada UI y BD. **Dónde:** todos los `create*`/`insert`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-080 · `updateProfile`: lista blanca de columnas
**Qué:** acepta `Partial<Profile>` arbitrario; restringir a columnas mutables (no `id`, `created_at`, `xp_*`). **Dónde:** `data.ts:19-22`. **Impacto:** 3 · **Esfuerzo:** M

### DAT-081 · Separar lectura de escritura de XP en tipos
**Qué:** `Profile` mezcla columnas de solo-lectura económica con mutables; tipos distintos para `updateProfile`. **Dónde:** `types.ts:7-24` + `data.ts:19-22`. **Impacto:** 2 · **Esfuerzo:** M

### DAT-082 · Helper `dateRange(from,to)` reutilizable para queries
**Qué:** `gte/lte('date',...)` se repite; un helper evita errores de límites. **Dónde:** `data.ts:61-68`, `dungeons.ts:100-109`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-083 · Constante para el TTL de `createSignedUrl`
**Qué:** `60*60*24*7` mágico; extraer a constante nombrada. **Dónde:** `data.ts:119`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-084 · Constante para los buckets ('evidence'|'avatars')
**Qué:** literales repartidos por `data.ts`/`exporter.ts`; centralizar. **Dónde:** `data.ts:95-121`, `exporter.ts:5-21`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-085 · Lista `TABLES` del exporter derivada de un único origen
**Qué:** `exporter.ts:5-21` repite los nombres de tabla; riesgo de olvidar una tabla nueva. **Dónde:** `exporter.ts:5-21`. **Impacto:** 2 · **Esfuerzo:** S

### DAT-086 · `exportAllData`: incluir versión de esquema y migraciones aplicadas
**Qué:** el dump pone `version:1` fijo; reflejar el esquema real para re-importación futura. **Dónde:** `exporter.ts:26-30`. **Impacto:** 2 · **Esfuerzo:** S

### DAT-087 · `exportAllData`: excluir/ofuscar PII si se comparte
**Qué:** el export incluye todo (diario, nombres); avisar antes de compartir. **Dónde:** `exporter.ts` + `perfil.tsx:162-172`. **Impacto:** 2 · **Esfuerzo:** S

### DAT-088 · Borrar el fichero temporal del export tras compartir
**Qué:** `nivl-export-*.json` queda en cache sin limpieza. **Dónde:** `exporter.ts:37-45`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-089 · Función de importación (contrapartida del export)
**Qué:** existe export pero no import; sin él, el JSON es de exhibición. **Dónde:** `exporter.ts`. **Impacto:** 2 · **Esfuerzo:** L

### DAT-090 · Abstraer una interfaz `Repository` por dominio
**Qué:** las cuatro libs son colecciones de funciones sueltas; agruparlas (questsRepo, gymRepo…) facilita test y caché. **Dónde:** los cuatro ficheros. **Impacto:** 2 · **Esfuerzo:** L

### DAT-091 · Tipos de entrada (`*Input`) coherentes y exportados
**Qué:** `QuestInput` está en `data.ts` pero otros inputs son objetos inline; unificar y exportar. **Dónde:** `data.ts:33-39`, `dungeons.ts:22,67,113`, `body.ts:41,64`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-092 · Reutilizar `SystemEvent` desde `types.ts`
**Qué:** `SystemEvent` se define en `journal.ts:50-55` pese a haber `types.ts`; moverlo. **Dónde:** `journal.ts:50-55`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-093 · `promptForDate`: documentar que es determinista por día
**Qué:** el hash da el mismo prompt para la misma fecha; explicitarlo para no confundir con aleatorio. **Dónde:** `journal.ts:78-85`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-094 · `promptForDate`: ampliar el pool y evitar sesgo del módulo
**Qué:** 7 prompts y `% length` sesgan repetición semanal; pool mayor o rotación. **Dónde:** `journal.ts:68-85`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-095 · Telemetría de errores de la capa de datos
**Qué:** ningún `fetch*` reporta a un canal (Sentry/log); los fallos solo viven en el `Alert`. **Dónde:** helper de DAT-035. **Impacto:** 3 · **Esfuerzo:** M

### DAT-096 · Métrica de latencia por query
**Qué:** sin instrumentación no se sabe qué query es lenta (p.ej. `fetchMaxLifts`). **Dónde:** helper de DAT-035. **Impacto:** 1 · **Esfuerzo:** M

### DAT-097 · `AbortController`/cancelación en cambios de foco
**Qué:** `useFocusEffect` dispara `load()`; cambiar de pestaña rápido deja queries en vuelo cuyo `setState` puede caer en pantalla desmontada. **Dónde:** consumidores de `data.ts`/`dungeons.ts`. **Impacto:** 2 · **Esfuerzo:** M

### DAT-098 · Estado de carga explícito en las libs de datos
**Qué:** no hay distinción cargando/vacío; las pantallas asumen vacío hasta que llega. **Dónde:** los cuatro ficheros (vía hook). **Impacto:** 2 · **Esfuerzo:** M

### DAT-099 · Deduplicar consultas en vuelo (request coalescing)
**Qué:** `fetchQuests` puede dispararse desde varias pantallas a la vez; coalescer. **Dónde:** `data.ts:24-31`. **Impacto:** 2 · **Esfuerzo:** M

### DAT-100 · `fetchUnlocked` se llama en cada completado: cachear el set
**Qué:** `index.tsx` la invoca tras cada quest; el set cambia poco. **Dónde:** `achievements.ts:83-86` + `index.tsx:130`. **Impacto:** 2 · **Esfuerzo:** M

### DAT-101 · Índice sugerido para `gym_lifts(user_id, exercise_name)`
**Qué:** mientras `fetchMaxLifts` siga en cliente, un índice acelera el filtro de DAT-015. **Dónde:** `0002_fases.sql:78-85` (vía 0004). **Impacto:** 2 · **Esfuerzo:** S

### DAT-102 · Índice para `shopping_items(user_id, done)`
**Qué:** `fetchShoppingItems` ordena por `done`; sin índice escanea. **Dónde:** `0002_fases.sql:96-103` (vía 0004). **Impacto:** 1 · **Esfuerzo:** S

### DAT-103 · Índice para `dungeons(user_id, status, created_at)`
**Qué:** `fetchDungeons` ordena por status+created_at sin índice compuesto. **Dónde:** `0002_fases.sql:12-23` (vía 0004). **Impacto:** 1 · **Esfuerzo:** S

### DAT-104 · `fetchRecentEntries`: validar `limit` (no negativo, tope)
**Qué:** el parámetro `limit` llega sin saneo; un valor absurdo va directo a `.limit()`. **Dónde:** `journal.ts:9-17`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-105 · Normalizar `weight`/`reps` numéricos en la capa, no en la UI
**Qué:** `parseFloat(l.weight.replace(',','.'))` vive en `gym.tsx:109`; debería ser parte del input tipado de `insertLifts`. **Dónde:** `body.ts:75-85` + `gym.tsx:106-112`. **Impacto:** 2 · **Esfuerzo:** S

### DAT-106 · Rechazar lifts con peso/reps no finitos antes del insert
**Qué:** un `parseFloat` fallido da `0` silencioso; distinguir vacío de inválido. **Dónde:** `body.ts:75-85`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-107 · `addShoppingItems`: aceptar `qty` y trocear nombre+cantidad
**Qué:** `ingredientsFromPlan` no separa cantidad; `qty` siempre null al generar. **Dónde:** `body.ts:156-165,178-193`. **Impacto:** 1 · **Esfuerzo:** M

### DAT-108 · `clearDoneShopping`: devolver número de filas borradas
**Qué:** para feedback "N tachados eliminados". **Dónde:** `body.ts:172-175`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-109 · Tipar `Stat`/`Difficulty`/`DungeonRank` como `as const` arrays con guard
**Qué:** los `.includes(q.stat)` de `oracle.ts` necesitan narrowing; exponer guards `isStat`. **Dónde:** `types.ts:1-5` + `oracle.ts:115-124`. **Impacto:** 2 · **Esfuerzo:** S

### DAT-110 · Consolidar `fetchEventsForDate` y `insertEvent` en un módulo `events`
**Qué:** los eventos se reparten entre `data.ts` (insert) y `journal.ts` (fetch); cohesionar. **Dónde:** `data.ts:87-93`, `journal.ts:57-66`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-111 · `fetchPendingTasksWithDue`: acotar a un horizonte (no todo el futuro)
**Qué:** la agenda solo mira 14 días (`agenda.tsx:30`), pero la query trae todas las tareas con `due_date`. **Dónde:** `dungeons.ts:53-62`. **Impacto:** 2 · **Esfuerzo:** S

### DAT-112 · Evitar recomputar agregados de tareas en cada render de la lista
**Qué:** `mazmorras.tsx:49-50` filtra `rows` por cada mazmorra (O(n·m)); precomputar un mapa `dungeon_id→{total,done}`. **Dónde:** `mazmorras.tsx:46-52` (consume `dungeons.ts`). **Impacto:** 2 · **Esfuerzo:** S

### DAT-113 · `signedUrl`: permitir longitud de validez configurable
**Qué:** 7 días fijo; para evidencias quizá menos. **Dónde:** `data.ts:118-121`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-114 · Cache local (AsyncStorage) de últimas listas para arranque offline
**Qué:** sin caché persistente, sin red la app arranca vacía. **Dónde:** capa sobre los cuatro ficheros. **Impacto:** 3 · **Esfuerzo:** L

### DAT-115 · Cola de mutaciones offline (outbox)
**Qué:** completar misión sin red lanza error; encolar y reintentar. **Dónde:** `engine.ts` + capa de datos. **Impacto:** 3 · **Esfuerzo:** L

### DAT-116 · `createSession`: registrar `gym_day_id` nulo de forma explícita
**Qué:** `todayPlan?.id ?? null` permite sesión "libre"; documentar y testear ese caso. **Dónde:** `body.ts:62-73` + `gym.tsx:120`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-117 · `fetchTasks` ordena por `position` sin desempate
**Qué:** posiciones repetidas (ver DAT-073) dan orden inestable. **Dónde:** `dungeons.ts:43-51`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-118 · Documentar el contrato de fechas (todo `YYYY-MM-DD` local)
**Qué:** las columnas `date` se comparan como string; documentar que dependen de `dates.dateKey` (local). **Dónde:** `data.ts`, `dungeons.ts`, `body.ts`, `journal.ts`. **Impacto:** 2 · **Esfuerzo:** S

### DAT-119 · Evitar `select('*')` en `completionStats`/conteos head
**Qué:** con `head:true` el `select('*')` es inofensivo pero confuso; usar `select('id', {count})`. **Dónde:** `data.ts:77-83,132`, `body.ts:102`, `dungeons.ts:92`, `journal.ts:44`. **Impacto:** 1 · **Esfuerzo:** S

### DAT-120 · README de la capa de datos (convenciones de error, caché, tipos)
**Qué:** no hay doc que fije el estándar; tras DAT-035 documentarlo evita reincidencia. **Dónde:** `src/lib/` (nuevo doc). **Impacto:** 2 · **Esfuerzo:** S

---

Total: 120 mejoras, 9 bugs.
