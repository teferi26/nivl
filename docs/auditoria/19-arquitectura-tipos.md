# Arquitectura y tipado

> Área ARC · auditoría de código NIVL · anclada al código real

Alcance leído: `src/lib/types.ts`, `data.ts`, `engine.ts`, `closing.ts`, `game.ts`,
`dates.ts`, `supabase.ts`, `auth.tsx`, `theme.ts`, `dungeons.ts`, `body.ts`,
`journal.ts`, `achievements.ts`, `oracle.ts`, `voice.ts`, `notifications.ts`,
`exporter.ts`; `src/app/_layout.tsx`, `index.tsx`, `(tabs)/_layout.tsx`,
`(tabs)/index.tsx`, `(tabs)/perfil.tsx`, `(tabs)/misiones.tsx`, `(tabs)/mazmorras.tsx`,
`gym.tsx`, `dungeon/[id].tsx`; `src/components/SystemWindow.tsx`, `SystemButton.tsx`,
`QuestItem.tsx`; `tsconfig.json`, `package.json`.

Foco del área: no hay Error Boundary; manejo de errores duplicado (43 `Alert.alert`
en 12 archivos → hook/toast centralizado); no hay capa de estado/caché de servidor;
cliente de Supabase sin tipar (`createClient` sin genérico `Database` ⇒ 24 `as Tipo`
solo en `src/lib`); constantes mágicas; separación lógica/UI; organización de carpetas;
barrels.

---

## Bugs y riesgos

### CRIT-ARC-01 · El cliente Supabase no está tipado: cualquier columna mal escrita pasa el typecheck — `supabase.ts:17` · severidad media
**Problema:** `createClient(url, key, …)` se crea sin el genérico `Database`, así que
`supabase.from('quests')` devuelve filas `any`. Toda la capa de datos compensa con
casts ciegos (`return data as Quest`, `as Profile`, `as Dungeon[]`… 24 ocurrencias en
`data.ts`, `dungeons.ts`, `body.ts`, `journal.ts`, `oracle.ts`). El riesgo real no es
estético: en `engine.ts:76-86` el `insert` de la misión de penalización y en `data.ts:42`
el `insert` de quests son objetos literales `any`; si un nombre de columna se renombra en
SQL (p. ej. `penalty_xp` → `penalty_points`) o se teclea mal, **TypeScript no lo detecta**
y el fallo aparece en runtime como error de Postgrest. Lo mismo con los `update(patch)`
de `updateProfile` (`data.ts:20`). **Arreglo:** generar tipos con
`supabase gen types typescript` a `src/lib/database.types.ts` y declarar
`createClient<Database>(…)`. A partir de ahí, `Profile`/`Quest`/… derivan de
`Database['public']['Tables']['…']['Row']` y los `insert`/`update` se validan en compilación;
se eliminan casi todos los `as`.

### CRIT-ARC-02 · No existe Error Boundary: cualquier excepción de render desmonta la app a pantalla negra — `app/_layout.tsx:33-43` · severidad media
**Problema:** `grep` de `ErrorBoundary|componentDidCatch|getDerivedStateFromError` en
todo `nivl/` no devuelve nada. El árbol cuelga de `<AuthProvider><Stack/></AuthProvider>`
sin ninguna frontera. Los `try/catch` solo cubren operaciones `async` dentro de handlers;
un error **síncrono de render** (p. ej. `profile.name.charAt(0)` en `(tabs)/index.tsx:212`
si `name` llegara `null` por datos corruptos, o un `lvl.into / lvl.next`) tumba toda la
aplicación a fondo `colors.bg` sin recuperación ni mensaje. **Arreglo:** expo-router
soporta exportar `ErrorBoundary` desde un layout. Crear `src/components/AppErrorBoundary.tsx`
(o exportar `export function ErrorBoundary(props: ErrorBoundaryProps)` en `_layout.tsx`)
que pinte una `SystemWindow` con la voz del sistema y un botón "Reiniciar"; envolver el
`Stack`.

### CRIT-ARC-03 · `completions` sin clave única `(user_id, quest_id, date)`: el guard anti-doble-XP es solo de cliente — `engine.ts:136-143` · severidad media
**Problema:** `completeQuest` inserta en `completions` sin upsert ni `onConflict`. El
cerrojo `completing` de `(tabs)/index.tsx:151` y `busyQuestId` son **estado de una sola
instancia de pantalla**: cubren el doble toque, pero no dos orígenes (p. ej. completar la
misma misión desde Sistema y que un reintento de red reenvíe el insert, o dos sesiones).
Si no hay índice único en la tabla, se crean dos `completions` del mismo `(quest, date)` y
se otorga XP dos veces — exactamente el fallo que el cerrojo de UI intenta evitar, pero por
una vía que la UI no controla. **Arreglo:** añadir en una migración nueva
`CREATE UNIQUE INDEX ON completions (user_id, quest_id, date)` y cambiar el insert a
`upsert({…}, { onConflict: 'user_id,quest_id,date', ignoreDuplicates: true })`,
comprobando si insertó antes de sumar XP. (Es defensa en profundidad del mismo invariante
que el cerrojo de UI; complementa, no duplica, el plan RPC ya diferido.)

### CRIT-ARC-04 · `processPendingDays` fija `last_day_processed = yesterday` aunque el cierre no llegue a procesar todos los días — `engine.ts:36-39,63` · severidad baja
**Problema:** en la rama de primer arranque (`!profile.last_day_processed`) se escribe
`last_day_processed: yesterday` y se retorna sin cerrar nada; y en la rama normal el `patch`
fija `last_day_processed: yesterday` (línea 63) **independientemente** de hasta dónde llegó
`computeDayClose`. `computeDayClose` recorre `day < today` (`closing.ts:51`), luego cubre
exactamente hasta `yesterday`, así que hoy coinciden. El riesgo es de acoplamiento frágil:
el "hasta dónde cerré" vive implícito en dos sitios (el `while` puro y el literal `yesterday`).
Si alguien cambia el límite del bucle a `<= today` o introduce zonas horarias, el avance del
puntero y los días realmente penalizados se desincronizan en silencio (días saltados sin
penalización, o doble penalización). **Arreglo:** que `computeDayClose` devuelva el último
día procesado (`lastProcessed`) y que `engine.ts` escriba ese valor en `last_day_processed`
en lugar de recomputar `yesterday` por su cuenta. Elimina la duplicación del invariante de
fecha.

### CRIT-ARC-05 · `fetchCompletionsSince` puede escanear todo el historial al cerrar muchos días — `engine.ts:44-45` · severidad baja
**Problema:** `fromDate = addDays(last_day_processed, 1)` y luego
`fetchCompletionsSince(fromDate)` trae **todas** las completions desde esa fecha. En el caso
normal (1 día) es trivial, pero si el usuario no abre la app en semanas/meses (caso real en
una app de hábitos), se descarga un rango enorme para construir `completedKeys`, y el set se
mantiene en memoria. No hay tope ni paginación. **Arreglo:** acotar la consulta también por
arriba (`.lte('date', yesterday)`) y, si el hueco supera N días, cerrar por lotes; o mejor,
mover el cierre a una RPC servidor (coherente con el plan diferido) que no traiga filas al
cliente.

---

## Mejoras

### Tipado y modelo de datos

### ARC-001 · Generar y usar los tipos de Supabase (`Database`)
**Qué:** raíz del problema de CRIT-ARC-01; tipar `createClient<Database>` y derivar todas
las entidades. **Dónde:** `supabase.ts:17`, `types.ts` · **Impacto:** 5 · **Esfuerzo:** M

### ARC-002 · Derivar `Profile`/`Quest`/`Completion`… de `Database[...]['Row']`
**Qué:** sustituir las interfaces manuales de `types.ts` por alias a las filas generadas, de
modo que columna SQL y tipo TS no puedan divergir. **Dónde:** `types.ts:7-159` · **Impacto:** 4 · **Esfuerzo:** M

### ARC-003 · Eliminar los `as Tipo` de la capa de datos tras tipar el cliente
**Qué:** los 24 casts (`data.ts`, `dungeons.ts`, `body.ts`, `journal.ts`, `oracle.ts`) dejan
de ser necesarios y dejan de ocultar desajustes. **Dónde:** `data.ts:7,16,30,…` · **Impacto:** 3 · **Esfuerzo:** S

### ARC-004 · Tipar `insertEvent` con una unión discriminada de eventos
**Qué:** `insertEvent(userId, type: string, payload: Record<string, unknown>)` acepta
cualquier cosa; los `type` ('penalty', 'stone_used', 'level_up', 'gym_pr', 'dungeon_task'…)
y sus payloads están dispersos por engine/gym/dungeon. Definir `type SystemEventInput =
{ type:'penalty'; payload:{xp:number; missed:string[]} } | …`. **Dónde:** `data.ts:87-93`,
`journal.ts:50-55` · **Impacto:** 4 · **Esfuerzo:** M

### ARC-005 · Unificar el tipo de evento (`SystemEvent` vive en `journal.ts`)
**Qué:** `SystemEvent` está declarado en `journal.ts:50` pero los eventos los emite
`data.ts`/`engine.ts`; el tipo de lectura y el de escritura no comparten fuente. Mover a un
`events.ts` o a `types.ts`. **Dónde:** `journal.ts:50-66` · **Impacto:** 3 · **Esfuerzo:** S

### ARC-006 · `StatXpColumn` y `STAT_COLUMN` deberían derivarse, no duplicarse
**Qué:** `StatXpColumn` (`types.ts:161`) enumera `'xp_fue'…` a mano y `STAT_COLUMN`
(`game.ts:31`) los re-mapea; un sexto stat obliga a tocar tres sitios. Derivar
`xp_${Lowercase<Stat>}` con tipos plantilla. **Dónde:** `types.ts:161`, `game.ts:31-37` · **Impacto:** 3 · **Esfuerzo:** S

### ARC-007 · Tipar `route` de `MODULES` con los tipos de ruta de expo-router
**Qué:** `MODULES` usa `route: '/gym'` con `as const` pero `router.push(m.route)` no se valida
contra el árbol de rutas tipado que genera expo-router. **Dónde:** `(tabs)/index.tsx:25-32,321` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-008 · `Record<string, unknown>` en payloads de `awardXp` pierde forma
**Qué:** `awardXp(profile, amount, stat, eventType, payload: Record<string, unknown>)` impide
autocompletado y validación del payload por tipo de evento. Ligar al discriminado de ARC-004.
**Dónde:** `engine.ts:173-179` · **Impacto:** 3 · **Esfuerzo:** S

### ARC-009 · `stat: keyof typeof STAT_COLUMN | null` debería ser `Stat | null`
**Qué:** `awardXp` declara el parámetro como `keyof typeof STAT_COLUMN`; es exactamente `Stat`
pero por una vía indirecta. Usar `Stat | null` directo. **Dónde:** `engine.ts:176` · **Impacto:** 1 · **Esfuerzo:** S

### ARC-010 · `fetchMaxLifts` reconstruye el máximo en cliente con filas `any`
**Qué:** `select('exercise_name, weight')` devuelve `any[]` y se castea a un literal local;
además calcula el máximo en JS trayendo todas las filas. Tipar la fila y, a futuro, mover a
una vista/RPC `max(weight) group by exercise_name`. **Dónde:** `body.ts:88-99` · **Impacto:** 3 · **Esfuerzo:** M

### ARC-011 · `OracleResponse` se castea desde `JSON.parse` sin validar forma completa
**Qué:** `JSON.parse(text) as OracleResponse` (`oracle.ts:109`) confía en la forma; aunque
luego se filtran quests, `plan_summary` y la estructura raíz no se validan con un esquema.
Introducir un validador (zod/valibot) o type guard explícito. **Dónde:** `oracle.ts:109` · **Impacto:** 3 · **Esfuerzo:** M

### ARC-012 · `exporter.ts` vuelca `data ?? []` como `unknown` sin tipar por tabla
**Qué:** el dump indexa `dump[table]` con filas `any`; un cambio de esquema no rompe nada en
compilación. Tras ARC-001, tipar el dump por tabla. **Dónde:** `exporter.ts:31-35` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-013 · `signedUrl` acota el bucket pero no el resto de la API de storage
**Qué:** `signedUrl(bucket: 'evidence' | 'avatars', …)` está bien tipado, pero
`uploadEvidence`/`uploadAvatar` repiten la cadena del bucket en literal. Centralizar los
nombres de bucket como constantes tipadas. **Dónde:** `data.ts:95-121` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-014 · `Profile` mezcla columnas de identidad, economía y estado de juego
**Qué:** una sola interfaz de 18 campos une `name/avatar`, `xp_*`, `streak/stones/freeze`.
Para la lógica de cierre conviene un subtipo `GameState` (xp, streak, stones, freeze) y otro
`ProfileIdentity`. Mejora el tipado de `computeDayClose`/`awardXp`. **Dónde:** `types.ts:7-24` · **Impacto:** 3 · **Esfuerzo:** M

### ARC-015 · Falta tipo para "fila optimista local" de Completion
**Qué:** `(tabs)/index.tsx:117-126` fabrica una `Completion` con `id: 'local-…'` y
`evidence_url: 'local'`; es una `Completion` mentida. Definir `OptimisticCompletion` o un
flag `pending` para no confundir id real con id local. **Dónde:** `(tabs)/index.tsx:115-126` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-016 · `MealSlotName`/`Difficulty`/`Stat`/`DungeonRank` sin objeto de metadatos único
**Qué:** los enums viven en `types.ts` y sus etiquetas/orden en `game.ts` (`DIFFICULTY_LABEL`,
`STAT_LABEL`, `DUNGEON_RANKS`). Un registro único `{ value,label,xp }` por enum evita listas
paralelas que se desincronizan. **Dónde:** `types.ts:3-5,124`, `game.ts:11-37,107` · **Impacto:** 3 · **Esfuerzo:** M

### Capa de estado / caché de servidor

### ARC-017 · Introducir TanStack Query como capa de datos de servidor
**Qué:** hoy cada pantalla tiene su `load()` + `useState` + `useFocusEffect` y vuelve a pedir
todo a cada foco (`(tabs)/index.tsx:49-86`, `perfil.tsx:63-83`, `misiones.tsx:28-41`,
`mazmorras.tsx:41-62`, `gym.tsx:73-85`, `dungeon/[id].tsx:54-66`). No está en `package.json`.
Una `QueryClientProvider` con `useQuery`/`useMutation` da caché, dedupe, reintentos y estados
`isLoading/isError` uniformes. **Dónde:** `_layout.tsx:33`, todas las pantallas · **Impacto:** 5 · **Esfuerzo:** L

### ARC-018 · Extraer hooks de datos (`useProfile`, `useTodayQuests`, `useDungeon`)
**Qué:** la lógica de carga está incrustada en componentes; moverla a `src/hooks/` desacopla
fetching de UI y permite reutilizar entre Sistema y Perfil (ambos llaman `ensureProfile`+
`completionStats`). **Dónde:** `(tabs)/index.tsx:49`, `perfil.tsx:63` · **Impacto:** 4 · **Esfuerzo:** M

### ARC-019 · Invalidar caché tras mutación en vez de `await load()` manual
**Qué:** cada acción hace su mutación y luego `await load()` (refetch total): `misiones.tsx:46`,
`gym.tsx:159,174`, `dungeon/[id].tsx:79,97`. Con Query sería `invalidateQueries(['quests'])`.
**Dónde:** `misiones.tsx:43-66`, `gym.tsx:154-175` · **Impacto:** 4 · **Esfuerzo:** M

### ARC-020 · Compartir `profile` entre pestañas en lugar de recargarlo por pantalla
**Qué:** Sistema y Perfil mantienen su propia copia de `profile` y la recargan; tras completar
una misión en Sistema, Perfil no se entera hasta su `useFocusEffect`. Un store/Query
compartido evita estados divergentes. **Dónde:** `(tabs)/index.tsx:38`, `perfil.tsx:50` · **Impacto:** 4 · **Esfuerzo:** M

### ARC-021 · Paralelizar las cargas independientes de cada `load()`
**Qué:** los `load()` encadenan `await` secuenciales que no dependen entre sí:
`perfil.tsx:66-73` (`completionStats` → `fetchUnlocked` → `signedUrl`),
`gym.tsx:75-77` (`fetchGymDays` → `fetchGymExercises` → `fetchSessionForDate`),
`dungeon/[id].tsx:57-58`. Usar `Promise.all` reduce latencia. **Dónde:** `perfil.tsx:66-73`,
`gym.tsx:75-77` · **Impacto:** 3 · **Esfuerzo:** S

### ARC-022 · Estado de carga real (`isLoading`) en vez de "pantalla vacía"
**Qué:** mientras no hay datos, varias pantallas devuelven un `SafeAreaView` vacío
(`perfil.tsx:179-181`, `dungeon/[id].tsx:148-150`) o no muestran spinner. Un estado de carga
explícito (skeleton/`ActivityIndicator`) mejora la percepción. **Dónde:** `perfil.tsx:179`,
`dungeon/[id].tsx:148` · **Impacto:** 3 · **Esfuerzo:** S

### ARC-023 · Estado de error de pantalla (no solo `Alert`)
**Qué:** si `load()` falla, se lanza un `Alert` y la pantalla queda vacía sin reintento. Un
estado `error` con botón "Reintentar" (alimentado por Query) es más robusto. **Dónde:**
`(tabs)/index.tsx:77-79`, `mazmorras.tsx:53-55` · **Impacto:** 3 · **Esfuerzo:** M

### ARC-024 · Cancelar/ignorar cargas obsoletas al perder el foco
**Qué:** `useFocusEffect(load)` no aborta la petición en curso si el usuario navega; un
`setProfile` tardío puede pisar estado de la pantalla siguiente. Query lo gestiona; manual,
usar un flag `cancelled`. **Dónde:** `perfil.tsx:79-83`, `(tabs)/index.tsx:82-86` · **Impacto:** 2 · **Esfuerzo:** S

### Manejo de errores centralizado

### ARC-025 · Hook `useSystemError()` / toast del sistema para sustituir los 43 `Alert.alert`
**Qué:** el patrón `catch (e) { Alert.alert('Error del sistema', e instanceof Error ? e.message
: 'Fallo desconocido') }` está copiado 43 veces en 12 archivos. Un hook centralizado (o un
`<SystemToast>` con la voz del sistema) elimina la duplicación y unifica el copy. **Dónde:**
`(tabs)/index.tsx:78,144`, `perfil.tsx:75,103,158,168`, `gym.tsx:79,148`,
`dungeon/[id].tsx:60,99,127` y 6 archivos más · **Impacto:** 4 · **Esfuerzo:** M

### ARC-026 · Helper `getErrorMessage(e)` para el ternario repetido
**Qué:** `e instanceof Error ? e.message : 'Fallo desconocido'` aparece en cada catch; extraer
a `src/lib/errors.ts`. **Dónde:** mismas 12 ubicaciones de ARC-025 · **Impacto:** 3 · **Esfuerzo:** S

### ARC-027 · Diferenciar errores de red, de permiso y de validación
**Qué:** todos los fallos se muestran igual ("Error del sistema"). `oracle.ts:94-100` ya
distingue 401/429/529; aplicar la misma idea (mensajes según `error.code`/`status`) a la capa
Supabase. **Dónde:** `data.ts` (todos los `throw error`), `oracle.ts:94-100` · **Impacto:** 3 · **Esfuerzo:** M

### ARC-028 · Acciones de mutación sin `try/catch` lanzan sin recogerse
**Qué:** varias mutaciones no envuelven la llamada: `misiones.tsx:43-47` (`onCreate`),
`misiones.tsx:49-52` (`onToggle`), `perfil.tsx:107-113` (`saveName`),
`perfil.tsx:115-121` (`activateFreeze`), `perfil.tsx:123-127` (`deactivateFreeze`),
`mazmorras.tsx:64-…` (`onCreate` sí lo tiene). Un fallo de red deja la UI en estado optimista
inconsistente y la promesa rechazada sin manejar. **Dónde:** `misiones.tsx:49-52`,
`perfil.tsx:107-127` · **Impacto:** 4 · **Esfuerzo:** S

### ARC-029 · Rollback del estado optimista al fallar la mutación
**Qué:** `misiones.tsx:50` pone `active` en el estado **antes** de `await setQuestActive`; si
la red falla (sin catch, ARC-028) el toggle queda mentido respecto a la BD. Revertir en el
catch. **Dónde:** `misiones.tsx:49-52` · **Impacto:** 3 · **Esfuerzo:** S

### ARC-030 · `insertEvent` traga errores en silencio
**Qué:** `await supabase.from('events').insert(...)` en `data.ts:92` no comprueba `error`; si
falla, se pierde el evento sin aviso (afecta a Informe y a logros derivados de eventos, p. ej.
`gym_pr`). Decidir explícitamente: loguear o propagar. **Dónde:** `data.ts:87-93` · **Impacto:** 3 · **Esfuerzo:** S

### ARC-031 · `unlockAchievements` devuelve `[]` al fallar el insert, ocultando el error
**Qué:** `achievements.ts:100` hace `if (error) return []`: un fallo de inserción de logro es
indistinguible de "ningún logro nuevo". Loguear al menos. **Dónde:** `achievements.ts:97-101` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-032 · Notificaciones: `catch {}` totalmente vacío
**Qué:** `notifications.ts:50-52` ignora cualquier error sin distinguir "Expo Go sin soporte"
de un fallo real de permisos/scheduling. Loguear en `__DEV__`. **Dónde:** `notifications.ts:50-52` · **Impacto:** 2 · **Esfuerzo:** S

### Separación lógica / UI

### ARC-033 · Mover la orquestación de "completar misión" fuera del componente
**Qué:** `finishQuest` (`(tabs)/index.tsx:107-146`) mezcla red (`completeQuest`,
`completionStats`, `unlockAchievements`), efectos (haptics, toast, overlay) y estado. Extraer
un `useCompleteQuest()` que devuelva `{ complete, busy }` y deje el componente declarativo.
**Dónde:** `(tabs)/index.tsx:107-180` · **Impacto:** 4 · **Esfuerzo:** M

### ARC-034 · Encapsular el flujo "reclamar botín" y "completar tarea" de mazmorra
**Qué:** `claimLoot` y `toggleTask` (`dungeon/[id].tsx:82-131`) repiten el patrón
`ensureProfile → awardXp → countX → unlockAchievements → load`. Extraer a un hook/servicio de
mazmorras reutilizable. **Dónde:** `dungeon/[id].tsx:82-131` · **Impacto:** 4 · **Esfuerzo:** M

### ARC-035 · Centralizar la evaluación de logros tras ganar XP
**Qué:** `evaluateAchievements`+`unlockAchievements` se llama desde Sistema, Gym y Dungeon con
contextos parciales distintos (`(tabs)/index.tsx:130`, `gym.tsx:138`, `dungeon/[id].tsx:118`).
Un único `checkAchievements(userId)` que reúna todos los contadores evita olvidos (p. ej. el
nivel solo se evalúa al completar misión, no al ganar XP de gym). **Dónde:** `(tabs)/index.tsx:130`,
`gym.tsx:138`, `dungeon/[id].tsx:118` · **Impacto:** 4 · **Esfuerzo:** M

### ARC-036 · `ensureProfile` se llama dentro de handlers de mutación para releer XP
**Qué:** `gym.tsx:124`, `dungeon/[id].tsx:88,111` llaman `ensureProfile(userId)` solo para
obtener el `profile` fresco antes de `awardXp`. Es la capa de datos supliendo la falta de
estado compartido (ARC-020). Con `useProfile()` se elimina. **Dónde:** `gym.tsx:124`,
`dungeon/[id].tsx:88,111` · **Impacto:** 3 · **Esfuerzo:** M

### ARC-037 · Consulta cruda de Supabase dentro de la pantalla de mazmorras
**Qué:** `mazmorras.tsx:44` hace `supabase.from('dungeon_tasks').select('dungeon_id, done')`
directamente en el componente, saltándose `dungeons.ts`. Debería ser
`fetchDungeonTaskProgress()` en la capa de datos. **Dónde:** `mazmorras.tsx:44-52` · **Impacto:** 3 · **Esfuerzo:** S

### ARC-038 · Consulta cruda de `events` para contar PRs en la pantalla de gym
**Qué:** `gym.tsx:134-137` cuenta `events` con `type='gym_pr'` en línea; mover a
`body.ts` (`countPRs()`). Mantiene la frontera lógica/datos. **Dónde:** `gym.tsx:134-137` · **Impacto:** 3 · **Esfuerzo:** S

### ARC-039 · `supabase.auth.signOut()` directo en Perfil
**Qué:** `perfil.tsx:175` y la lectura de sesión están repartidas; un `useSession()`/
`signOut()` en `auth.tsx` concentra la API de auth. **Dónde:** `perfil.tsx:174-177` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-040 · Cálculos de presentación derivados en el cuerpo del render
**Qué:** `(tabs)/index.tsx:188-193` y `perfil.tsx:183-187` calculan `sorted`,
`completedCount`, `maxStatXp`, `evidencePct`, `frozen` en cada render sin `useMemo`. Extraer a
selectores/`useMemo` separa la vista del cómputo. **Dónde:** `(tabs)/index.tsx:188-193`,
`perfil.tsx:183-187` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-041 · La voz del sistema mezcla copy con lógica de presentación en pantallas
**Qué:** `(tabs)/index.tsx:269-279` decide qué frase de `voice` mostrar con condicionales sobre
`dayResult`; podría exponerse como un selector `describeDayClose(result): Line[]` en `voice`/
`engine`. **Dónde:** `(tabs)/index.tsx:258-281` · **Impacto:** 2 · **Esfuerzo:** M

### Constantes mágicas

### ARC-042 · TTL de URL firmada como número mágico
**Qué:** `signedUrl` usa `60 * 60 * 24 * 7` inline (`data.ts:119`). Extraer
`SIGNED_URL_TTL_SECONDS`. **Dónde:** `data.ts:119` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-043 · Horas de notificación (8:00 / 21:30) embebidas
**Qué:** `notifications.ts:35-36,46-47` fijan `hour/minute` literales. Extraer
`MORNING_NOTIF_HOUR`, `EVENING_NOTIF` a una constante (y a futuro, configurables). **Dónde:**
`notifications.ts:33-48` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-044 · Niveles tope (999) y `1.5`/`0.1` de racha como literales
**Qué:** `game.ts:49,55` repiten `999`; `streakMultiplier` usa `1.5`, `0.1`, `7`
(`game.ts:73-74`). Nombrar `MAX_LEVEL`, `STREAK_STEP`, `STREAK_CAP`, `DAYS_PER_STREAK_STEP`.
**Dónde:** `game.ts:49,55,70-75` · **Impacto:** 3 · **Esfuerzo:** S

### ARC-045 · `xpCostForLevel` con `100` y `1.5` mágicos
**Qué:** `Math.round(100 * Math.pow(level, 1.5))` (`game.ts:43`) esconde la curva de progresión.
Extraer `LEVEL_BASE_COST` y `LEVEL_EXPONENT`. **Dónde:** `game.ts:42-44` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-046 · Umbrales de rango (10/25/45/70/99) duplicados entre `Rank` y `DungeonRank`
**Qué:** `rankForLevel` (`game.ts:61-68`) codifica cortes a mano; conviven `Rank` (game.ts:59)
y `DungeonRank` (types.ts:5) con las mismas letras. Tabla de umbrales tipada y un único tipo
`Rank`. **Dónde:** `game.ts:59-68`, `types.ts:5` · **Impacto:** 3 · **Esfuerzo:** S

### ARC-047 · `DAY_NAMES`/`DAY_LABELS` duplicados en varias pantallas
**Qué:** `gym.tsx:42` define `DAY_NAMES` completo y `misiones.tsx:14` define `DAY_LABELS`
('L','M','X'…); ambos describen los días 1-7. Centralizar en `dates.ts`. **Dónde:** `gym.tsx:42`,
`misiones.tsx:14` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-048 · Listas de días `[1,2,3,4,5]`/`[1..7]` repetidas en `DEFAULT_QUESTS`
**Qué:** `data.ts:124-128` repite arrays de días; nombrar `WEEKDAYS`, `EVERY_DAY`. **Dónde:**
`data.ts:123-129` · **Impacto:** 1 · **Esfuerzo:** S

### ARC-049 · Colores de opacidad/backdrop como cadenas `rgba(...)` sueltas
**Qué:** `'rgba(2, 6, 14, 0.85)'`, `0.95` se repiten en backdrops de modales
(`perfil.tsx:474,500`, `gym.tsx:424`, `dungeon/[id].tsx:339`). Añadir `colors.backdrop` /
`colors.backdropStrong` a `theme.ts`. **Dónde:** `theme.ts:1-22`, `perfil.tsx:474` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-050 · Colores hex crudos fuera de la paleta del tema
**Qué:** `dungeon/[id].tsx` usa `'#191D3D'`, `'#15182E'`, `'#A697F0'` (líneas 176,271,314,322,
332,369) y `(tabs)/index.tsx:447` usa `'#E8C9CD'`, saltándose `theme.ts`. Mover a la paleta.
**Dónde:** `dungeon/[id].tsx:176,314`, `(tabs)/index.tsx:447` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-051 · `max_tokens` y modelo del Oráculo hardcodeados
**Qué:** `oracle.ts:9,87` fijan `MODEL` y `max_tokens: 2000`. Extraer a constantes/config (ya
hay comentario que invita a cambiarlo). **Dónde:** `oracle.ts:9,87` · **Impacto:** 1 · **Esfuerzo:** S

### ARC-052 · Calidad de imagen (`0.4`/`0.5`) y aspecto repetidos
**Qué:** `(tabs)/index.tsx:100` usa `quality: 0.4`, `perfil.tsx:90` `quality: 0.5`; valores
mágicos de captura. Nombrar `EVIDENCE_IMG_QUALITY`, `AVATAR_IMG_QUALITY`. **Dónde:**
`(tabs)/index.tsx:98-102`, `perfil.tsx:87-93` · **Impacto:** 1 · **Esfuerzo:** S

### ARC-053 · `version: 1` del export como literal
**Qué:** `exporter.ts:29` codifica la versión del formato; centralizar como
`EXPORT_FORMAT_VERSION` para poder migrar importadores. **Dónde:** `exporter.ts:25-30` · **Impacto:** 1 · **Esfuerzo:** S

### Organización de carpetas y barrels

### ARC-054 · `src/lib` mezcla capa de datos, lógica de juego, IA y utilidades
**Qué:** 17 ficheros planos en `lib/` (datos: `data/dungeons/body/journal`; juego:
`game/closing/engine`; infra: `supabase/auth/notifications`; IA: `oracle`; util: `dates/voice/
theme/exporter`). Subcarpetas `lib/data/`, `lib/game/`, `lib/system/` aclararían fronteras.
**Dónde:** `src/lib/*` · **Impacto:** 3 · **Esfuerzo:** M

### ARC-055 · No hay barrels (`index.ts`) en `lib` ni en `components`
**Qué:** cada import nombra el archivo (`@/lib/game`, `@/components/SystemWindow`); barrels
por dominio (`@/lib/game`, `@/components`) simplifican imports y reexponen API pública
controlada. **Dónde:** `src/lib/`, `src/components/` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-056 · No existe carpeta `src/hooks`
**Qué:** toda la lógica con estado vive en componentes; crear `src/hooks/` es prerequisito de
ARC-018/033/034. **Dónde:** estructura de `src/` · **Impacto:** 3 · **Esfuerzo:** S

### ARC-057 · No existe carpeta `src/features` para módulos grandes
**Qué:** `gym`, `dungeon`, `oraculo` agrupan pantalla + datos + tipos; una organización por
feature (`features/gym/{screen,api,types}`) escala mejor que `app/` + `lib/` plano. **Dónde:**
`src/app/*`, `src/lib/body.ts` · **Impacto:** 3 · **Esfuerzo:** L

### ARC-058 · Tipos locales declarados dentro de pantallas
**Qué:** `LiftInput` (`gym.tsx:44`), `DungeonWithProgress` (`mazmorras.tsx:25`),
`SystemEvent` (`journal.ts:50`), `QuestInput` (`data.ts:33`) viven dispersos. Consolidar los
de dominio en `types.ts` y dejar solo los puramente de UI locales. **Dónde:** `gym.tsx:44`,
`mazmorras.tsx:25` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-059 · `__tests__` solo cubre `lib` puro; no hay carpeta de tests de hooks/datos
**Qué:** existen `closing.test.ts`, `game.test.ts`, `dates.test.ts` (lógica pura) pero nada para
la capa de datos ni hooks. Al extraer hooks (ARC-018), añadir su carpeta de test. **Dónde:**
`src/lib/__tests__/` · **Impacto:** 2 · **Esfuerzo:** M

### ARC-060 · `docs/auditoria` y `docs/mejoras` conviven sin índice
**Qué:** organización de documentación; un `docs/README.md` que enlace auditoría/roadmap/
backlog ayuda a navegar. **Dónde:** `docs/` · **Impacto:** 1 · **Esfuerzo:** S

### Robustez, casos límite y races (no críticos)

### ARC-061 · `useFocusEffect` + `useEffect(ensureDailyNotifications)` pueden solaparse en el primer foco
**Qué:** en Sistema, `load()` (focus) y `ensureDailyNotifications()` (mount) corren a la vez;
no hay conflicto hoy, pero ambos piden permisos/red en paralelo en el arranque más caro.
Considerar diferir notificaciones tras el primer render con datos. **Dónde:** `(tabs)/index.tsx:82-90` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-062 · `processPendingDays` y `completeQuest` comparten el mismo `profile` snapshot
**Qué:** `load()` ejecuta `processPendingDays` y guarda `prof`; si entre el `ensureProfile`
inicial y la escritura del cierre el usuario completa una misión (poco probable por el orden
del código, pero el `profile` se pasa por valor), la suma de XP parte de bases distintas.
Centralizar el `profile` (ARC-020) cierra la ventana. **Dónde:** `(tabs)/index.tsx:52-65`,
`engine.ts:58-73` · **Impacto:** 3 · **Esfuerzo:** M

### ARC-063 · `awardXp` recomputa nivel desde `profile.xp_total` del snapshot recibido
**Qué:** `engine.ts:187-188` calcula `before/after` con `profile.xp_total`; como `awardXp` se
llama tras un `ensureProfile` fresco en gym/dungeon, hoy es correcto, pero el contrato "pásame
el profile actual o el cálculo de level-up miente" es frágil. Releer dentro o exigir tipo
`FreshProfile`. **Dónde:** `engine.ts:180-193` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-064 · `seedDefaultQuests` cuenta todas las quests, no solo las del usuario
**Qué:** `data.ts:132` hace `count` sin filtrar `user_id`; depende de que RLS lo acote. Es
correcto bajo RLS pero acopla la corrección de cliente a la política de servidor; un
`.eq('user_id', userId)` explícito lo hace evidente y robusto. **Dónde:** `data.ts:131-133` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-065 · `completionStats`/`countEntries`/`countSessions` dependen de RLS para acotar al usuario
**Qué:** mismas consultas `count` sin `user_id` explícito en `data.ts:76-85`, `journal.ts:43-48`,
`body.ts:101-104`. Añadir el filtro explícito por claridad y defensa. **Dónde:** `data.ts:76-85`,
`journal.ts:43-48` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-066 · `addDays` lanza si la clave es inválida y nadie lo captura en cliente
**Qué:** `dates.ts:24-28` → `parseKey` lanza con clave corrupta; en `engine.ts:44`
(`addDays(last_day_processed,1)`) un `last_day_processed` corrupto en BD reventaría `load()`.
Hay validación de formato, pero el throw sube hasta el `Alert`. Decidir fallback (resetear el
puntero) en vez de bloquear el cierre. **Dónde:** `engine.ts:44`, `dates.ts:18-22` · **Impacto:** 3 · **Esfuerzo:** S

### ARC-067 · `levelFromXp` itera hasta 999 en cada render
**Qué:** `game.ts:46-57` recalcula el nivel con un bucle por cada llamada; se invoca en render
(`(tabs)/index.tsx:189,228,231`, `perfil.tsx:183,225,228`). Para XP altos puede iterar cientos
de veces por frame. Memoizar o precomputar acumulados. **Dónde:** `game.ts:46-57` · **Impacto:** 3 · **Esfuerzo:** M

### ARC-068 · `ingredientsFromPlan` parte por regex sin tope de longitud
**Qué:** `body.ts:178-193` recorre todos los slots y divide cadenas sin límite; un campo
`ingredients` enorme degrada. Caso límite menor; acotar tamaño de entrada. **Dónde:**
`body.ts:178-193` · **Impacto:** 1 · **Esfuerzo:** S

### ARC-069 · `fetchRecentEntries(limit=14)` y conteos sin índice declarado en el tipo
**Qué:** el límite por defecto (14) vive en la firma; documentar la relación con la UI (Diario
muestra 14). No es bug, pero el acoplamiento número↔pantalla debería ser una constante
compartida. **Dónde:** `journal.ts:9` · **Impacto:** 1 · **Esfuerzo:** S

### ARC-070 · `AuthProvider` no expone errores de `getSession`
**Qué:** `auth.tsx:17-20` hace `.then` sin `.catch`; si `getSession` rechaza, `loading` se
queda... en realidad nunca pasa a `false` y la app queda en el spinner de `index.tsx`. Añadir
`.catch(() => setLoading(false))`. **Dónde:** `auth.tsx:16-25` · **Impacto:** 3 · **Esfuerzo:** S

### ARC-071 · `onAuthStateChange` no actualiza `loading`
**Qué:** tras un `signOut`/refresh fallido, `auth.tsx:21-24` actualiza `session` pero no
`loading`; combinado con ARC-070 puede dejar estados raros. Revisar el ciclo completo. **Dónde:**
`auth.tsx:21-24` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-072 · `signOut` navega con `router.replace('/login')` además del `Redirect`
**Qué:** `perfil.tsx:176` fuerza navegación, pero `index.tsx` ya redirige según sesión; doble
fuente de verdad de routing de auth. Dejar que el guard de sesión decida. **Dónde:**
`perfil.tsx:174-177`, `index.tsx:17` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-073 · `EXPO_PUBLIC_*` ausentes lanzan en import-time y matan el bundle
**Qué:** `supabase.ts:9-11` hace `throw` en la carga del módulo; sin Error Boundary
(CRIT-ARC-02) el arranque sin `.env` da pantalla negra sin pista. Mostrar un estado de
configuración explícito. **Dónde:** `supabase.ts:9-11` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-074 · `isServer` decide auth storage por `typeof window` sin tipo
**Qué:** `supabase.ts:15` rama SSR; correcto, pero conviene un util `isServerRuntime()` tipado
y testeable en vez de la comprobación inline. **Dónde:** `supabase.ts:13-24` · **Impacto:** 1 · **Esfuerzo:** S

### ARC-075 · `parseFloat`/`parseInt` con coma en gym sin validación de NaN explícita
**Qué:** `gym.tsx:109-110,168` usan `|| 0`/`|| 3` para NaN; entradas como `"abc"` se vuelven 0
silenciosamente. Aceptable, pero un parser tipado (`parseNumber(value): number | null`) en
`lib` centraliza y avisa. **Dónde:** `gym.tsx:106-111,162-170` · **Impacto:** 2 · **Esfuerzo:** S

### Rendimiento

### ARC-076 · Listas largas con `.map` en `ScrollView` en vez de `FlatList`
**Qué:** misiones, mazmorras, logros, días de gym se pintan con `.map` dentro de `ScrollView`
(`misiones.tsx:85`, `mazmorras` lista, `perfil.tsx:282`, `gym.tsx:248`). Con muchos elementos
no hay virtualización. Migrar a `FlatList`/`FlashList` cuando crezca el dataset. **Dónde:**
`perfil.tsx:281-302`, `misiones.tsx:85` · **Impacto:** 2 · **Esfuerzo:** M

### ARC-077 · `exercisesFor(dayId)` filtra todo el array por cada día en render
**Qué:** `gym.tsx:88` se llama dentro de `days.map` (`gym.tsx:278`), es O(días×ejercicios) por
render. Precomputar un `Map<dayId, GymExercise[]>` con `useMemo`. **Dónde:** `gym.tsx:88,203,278` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-078 · `mazmorras` recalcula `total/doneCount` filtrando tasks por mazmorra
**Qué:** `mazmorras.tsx:48-51` hace `rows.filter` dos veces por cada mazmorra (O(n×m)).
Agrupar una vez con un `Map`. **Dónde:** `mazmorras.tsx:46-52` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-079 · Falta `useMemo` en derivados de listas (`sorted`, `completedCount`)
**Qué:** `(tabs)/index.tsx:191-193` reordena y cuenta en cada render aunque `todayQuests`/
`completions` no cambien. **Dónde:** `(tabs)/index.tsx:191-193` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-080 · Componentes de lista sin `React.memo`
**Qué:** `QuestItem` se renderiza por cada misión y no está memoizado; al re-renderizar
Sistema (toast, refresh) se recalcula todo. Envolver en `memo` con props estables. **Dónde:**
`QuestItem.tsx:16`, `(tabs)/index.tsx:295-305` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-081 · `SystemWindow` mide con `onLayout` y re-renderiza al primer frame
**Qué:** `SystemWindow.tsx:25-32` arranca con `size=null` y pinta el SVG tras medir, causando
un frame vacío por panel en cada montaje. Con muchos paneles (Perfil tiene 5+) parpadea.
Considerar medir una vez o usar `aspectRatio`/porcentajes. **Dónde:** `SystemWindow.tsx:25-46` · **Impacto:** 2 · **Esfuerzo:** M

### ARC-082 · `voice.*` y `promptForDate` recalculan en cada render
**Qué:** `(tabs)/index.tsx:267-278` invoca `voice.stoneUsed()` etc. en render: cada
re-render cambia la frase aleatoria (parpadeo del texto) y reejecuta `Math.random`. Fijar la
frase en estado/`useMemo` al producirse el evento. **Dónde:** `(tabs)/index.tsx:266-279`,
`voice.ts:4-6` · **Impacto:** 3 · **Esfuerzo:** S

### ARC-083 · Refetch total a cada foco recarga datos que no cambiaron
**Qué:** sin caché (ARC-017), volver a una pestaña reejecuta todas las consultas; en datos
estables (logros, rutina) es trabajo desperdiciado y parpadeo. **Dónde:** todos los `load()` · **Impacto:** 3 · **Esfuerzo:** M

### Accesibilidad (de componentes compartidos / arquitectura de UI)

### ARC-084 · `SystemButton` sin `accessibilityRole`/`accessibilityState`
**Qué:** `SystemButton.tsx:13-43` es un `Pressable` con texto; sin `accessibilityRole="button"`
ni `accessibilityState={{ disabled, busy: loading }}` el lector de pantalla no lo anuncia bien.
Como es el botón base de toda la app, el arreglo escala. **Dónde:** `SystemButton.tsx:17-28` · **Impacto:** 3 · **Esfuerzo:** S

### ARC-085 · `QuestItem` Pressable sin etiqueta accesible ni estado completado
**Qué:** `QuestItem.tsx:20-23` no expone `accessibilityLabel` ("Completar {título}, +{xp} XP")
ni `accessibilityState={{ checked: completed }}`. **Dónde:** `QuestItem.tsx:19-31` · **Impacto:** 3 · **Esfuerzo:** S

### ARC-086 · Iconos `Pressable` (back, add, trash) sin `accessibilityLabel`
**Qué:** patrón repetido en headers (`gym.tsx:181-187`, `dungeon/[id].tsx:159-167`,
`mazmorras`/`misiones` add) — botones de solo icono sin etiqueta. Crear un `IconButton`
accesible reutilizable. **Dónde:** `dungeon/[id].tsx:159-167`, `gym.tsx:181-187` · **Impacto:** 3 · **Esfuerzo:** M

### ARC-087 · `SystemWindow` decorativo sin marcar el SVG como no accesible
**Qué:** el `Svg`/`Polygon` (`SystemWindow.tsx:37-44`) es decorativo; aunque tiene
`pointerEvents="none"`, conviene `accessibilityElementsHidden`/`importantForAccessibility="no"`
para no ensuciar el árbol. **Dónde:** `SystemWindow.tsx:37` · **Impacto:** 1 · **Esfuerzo:** S

### ARC-088 · Sin soporte de `Dynamic Type` / tamaños de fuente fijos
**Qué:** todas las `fontSize` son números fijos en `StyleSheet`; no escalan con el ajuste de
accesibilidad del sistema. Arquitectónicamente, un helper de escalado tipográfico centralizado.
**Dónde:** `theme.ts:24-30` (fuentes), estilos de pantallas · **Impacto:** 2 · **Esfuerzo:** L

### ARC-089 · Contraste de `textFaint`/`textDim` sin verificar como tokens
**Qué:** `theme.ts:19-20` define grises sobre fondo oscuro usados para texto informativo
(p. ej. `pendingNote`); conviene auditar contraste y, si falla, separar tokens "decor" de
"texto legible". **Dónde:** `theme.ts:18-21` · **Impacto:** 2 · **Esfuerzo:** S

### Tests

### ARC-090 · Test de `engine.processPendingDays` con mocks de la capa de datos
**Qué:** la orquestación (cierre + inserción de penalización + eventos) no tiene test; solo
`closing.ts` puro lo tiene. Inyectar dependencias (ARC-098) y testear el flujo. **Dónde:**
`engine.ts:22-112`, `src/lib/__tests__/` · **Impacto:** 3 · **Esfuerzo:** M

### ARC-091 · Test de `questXp`/`awardXp` para el contrato de level-up
**Qué:** cubrir `before/after` y `leveledUp` en límites (cruce de nivel, nivel 999). **Dónde:**
`engine.ts:152-161,187-193` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-092 · Test de `evaluateAchievements` (umbrales exactos)
**Qué:** función pura sin test; verificar cada corte (10/50/100/500, 7/30/100…). **Dónde:**
`achievements.ts:50-81` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-093 · Test de `ingredientsFromPlan` (dedupe, separadores)
**Qué:** lógica pura sin test; cubrir comas/`;`/saltos y mayúsculas. **Dónde:** `body.ts:178-193` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-094 · Test de `promptForDate` (determinismo por fecha)
**Qué:** verificar que la misma clave da el mismo prompt y que el hash no desborda. **Dónde:**
`journal.ts:78-85` · **Impacto:** 1 · **Esfuerzo:** S

### ARC-095 · Test de validación del Oráculo contra enums
**Qué:** `generateQuests` filtra propuestas inválidas (`oracle.ts:115-124`); testear con
payloads basura (stat 'STR', día 8, título vacío). **Dónde:** `oracle.ts:115-124` · **Impacto:** 3 · **Esfuerzo:** M

### ARC-096 · Test de `levelFromXp`/`xpCostForLevel` en el tope 999
**Qué:** confirmar `next=0`, `into=0` y que no diverge. **Dónde:** `game.ts:46-57` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-097 · Sin `@testing-library/react-native` para componentes/hooks
**Qué:** `package.json` solo trae `jest`/`jest-expo`; añadir testing-library habilita probar
`SystemButton`, hooks de datos y estados de error. **Dónde:** `package.json:42-49` · **Impacto:** 2 · **Esfuerzo:** M

### Inyección de dependencias y testabilidad

### ARC-098 · `engine`/`closing` consumen `supabase` por import directo
**Qué:** `engine.ts:5` importa `supabase` y lo usa en `processPendingDays`/`completeQuest`
(`engine.ts:76,136`); imposible testear sin red real. Inyectar la capa de datos (puerto) o
pasar funciones, como ya hace `closing.ts` (puro). **Dónde:** `engine.ts:5,76,136` · **Impacto:** 4 · **Esfuerzo:** M

### ARC-099 · `oracle.generateQuests` usa `fetch` global sin abstracción
**Qué:** `oracle.ts:78` llama `fetch` directo; un cliente inyectable permitiría mockear la
respuesta de la IA en test (ARC-095) y reusar manejo de errores HTTP. **Dónde:** `oracle.ts:77-92` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-100 · `Date.now()`/`new Date()` esparcidos impiden tests deterministas
**Qué:** `dates.ts:11` usa `new Date()` por defecto (bien), pero `data.ts:101,110`,
`dungeons.ts:81`, `engine.ts:110,122` usan `Date.now()`/`toISOString()` inline. Un `clock`
inyectable (o pasar `now`) hace el cierre testeable en el tiempo. **Dónde:** `engine.ts:110,122`,
`data.ts:101` · **Impacto:** 3 · **Esfuerzo:** M

### Documentación de tipos y API interna

### ARC-101 · `DayCloseResult` vs `CloseOutput` describen lo mismo con campos distintos
**Qué:** `engine.ts:10-17` (`DayCloseResult`: añade `levelsLost`) y `closing.ts:27-36`
(`CloseOutput`: añade `frozenDays`) divergen; el mapeo manual (`engine.ts:99-109`) puede
olvidar campos. Documentar la relación o derivar uno de otro. **Dónde:** `engine.ts:10-17`,
`closing.ts:27-36` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-102 · `frozenDays` de `CloseOutput` se calcula pero no se usa
**Qué:** `closing.ts:88` devuelve `frozenDays`, pero `engine.ts` nunca lo lee. O se expone en la
UI (informe de pausa) o se elimina del tipo. **Dónde:** `closing.ts:44,88`, `engine.ts:48-56` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-103 · `CompleteResult.wasPenalty` solo lo usa logros; documentar contrato
**Qué:** `engine.ts:119,168` exponen `wasPenalty`; su único consumidor es `(tabs)/index.tsx:137`.
Anotar para no romperlo al refactor. **Dónde:** `engine.ts:114-120` · **Impacto:** 1 · **Esfuerzo:** S

### ARC-104 · `QuestInput` no incluye los campos de penalización pero se inserta en la misma tabla
**Qué:** `data.ts:33-39` define `QuestInput` (creación de usuario) mientras `engine.ts:76-86`
inserta una quest de penalización con campos extra (`is_penalty`, `penalty_*`) sin pasar por
ese tipo. Documentar/tipar las dos vías de inserción de `quests`. **Dónde:** `data.ts:33-49`,
`engine.ts:76-86` · **Impacto:** 2 · **Esfuerzo:** S

### Features de arquitectura (habilitadores)

### ARC-105 · Capa de "repositorio" por entidad con interfaz estable
**Qué:** unificar `data.ts`/`dungeons.ts`/`body.ts`/`journal.ts` bajo repos tipados
(`QuestRepo`, `DungeonRepo`…) con firma homogénea (`list/get/create/update/remove`) en vez de
funciones sueltas con nombres dispares (`fetchQuests` vs `fetchDungeons` vs `fetchGymDays`).
**Dónde:** `data.ts`, `dungeons.ts`, `body.ts` · **Impacto:** 3 · **Esfuerzo:** L

### ARC-106 · Cliente HTTP/Anthropic reutilizable para el Oráculo
**Qué:** extraer un `anthropicClient` (headers, versión, manejo de status) de `oracle.ts:78-100`
para futuros usos de IA (informe narrado, etc.). **Dónde:** `oracle.ts:77-101` · **Impacto:** 2 · **Esfuerzo:** M

### ARC-107 · Logger central (`log.warn/error`) con gate `__DEV__`
**Qué:** hoy los errores o se muestran en `Alert` o se tragan (`achievements.ts:100`,
`notifications.ts:50`); un logger único permitiría observabilidad sin ensuciar UI. **Dónde:**
`achievements.ts:100`, `notifications.ts:50` · **Impacto:** 3 · **Esfuerzo:** S

### ARC-108 · Esquema de validación compartido (zod) entre Oráculo, import y formularios
**Qué:** un único origen de esquemas para `Quest`/`ProposedQuest` daría validación en runtime
(Oráculo, futura importación de export) y tipos a la vez. **Dónde:** `oracle.ts:37-66`,
`exporter.ts` · **Impacto:** 3 · **Esfuerzo:** L

### ARC-109 · `constants.ts` de dominio (notificaciones, TTL, calidad imagen, límites)
**Qué:** consolidar las constantes de ARC-042..053 en un módulo `lib/constants.ts` (o por
dominio) en lugar de literales repartidos. **Dónde:** nuevo `src/lib/constants.ts` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-110 · `theme.ts` como sistema de tokens (no solo `colors`/`fonts`)
**Qué:** ampliar `theme.ts` con `spacing`, `radii`, `fontSize`, `backdrop` para eliminar
números mágicos de layout repartidos por las pantallas. **Dónde:** `theme.ts:1-31` · **Impacto:** 3 · **Esfuerzo:** M

### ARC-111 · Tipar `router.push`/`replace` con rutas conocidas (`AppRoute`)
**Qué:** definir un union `AppRoute = '/gym' | '/dieta' | …` y un wrapper `navigate(route)` para
evitar strings sueltas en `(tabs)/index.tsx:321`, `perfil.tsx:176`, headers de back. **Dónde:**
`(tabs)/index.tsx:321`, `perfil.tsx:176` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-112 · Aislar `AsyncStorage` (Oráculo) tras un módulo `secureStore`
**Qué:** la API key se guarda en `AsyncStorage` (`oracle.ts:25-35`); un módulo dedicado
(`lib/keyStore.ts`) facilita migrar a `expo-secure-store` y centraliza la clave de storage.
**Dónde:** `oracle.ts:25-35` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-113 · `Stat`/`Difficulty` con helpers de iteración tipados
**Qué:** `STATS`/`DIFFICULTIES` (`game.ts:11,21`) son arrays manuales; garantizar
exhaustividad con un patrón `satisfies readonly Stat[]` y un `assertNever` para `switch`
sobre enums. **Dónde:** `game.ts:11,21` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-114 · Normalizar `freeze_until` en un único punto (no en closing y engine)
**Qué:** `closing.ts:49` recorta `freeze_until` a 10 chars y `engine.ts:31,69` compara con
`today`; la normalización de fecha de freeze vive en dos sitios. Centralizar un `asDateKey()`.
**Dónde:** `closing.ts:49`, `engine.ts:31,69` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-115 · `isoWeekday`/`weekdayOfKey` y la convención 1-7 sin tipo nominal
**Qué:** los días de semana son `number` por todo el código (`days_of_week: number[]`,
`day_of_week`); un tipo `Weekday = 1|2|3|4|5|6|7` evitaría meter 0 u 8. **Dónde:** `types.ts:32,90,129`,
`dates.ts:31-37` · **Impacto:** 3 · **Esfuerzo:** S

### ARC-116 · `MealSlotName`/`MEAL_SLOTS` duplican el orden de slots
**Qué:** `MealSlotName` en `types.ts:124` y `MEAL_SLOTS` en `body.ts:107` listan los mismos
valores; derivar el array del tipo o viceversa. **Dónde:** `types.ts:124`, `body.ts:107` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-117 · Tipar `payload` de `events` al leer en Informe
**Qué:** `SystemEvent.payload` es `Record<string, unknown>` (`journal.ts:53`); el Informe que lo
consume debe castear por `type`. Un mapa `type → payload` (ARC-004) tipa la lectura. **Dónde:**
`journal.ts:50-66` · **Impacto:** 2 · **Esfuerzo:** M

### ARC-118 · Estructura `app/` plana mezcla stack y tabs sin agrupación por dominio
**Qué:** `gym/dieta/compra/diario/informe/oraculo` cuelgan sueltos de `app/` junto a `(tabs)`;
no hay grupos `(modules)`/`(stack)` que reflejen que son sub-pantallas de Sistema. **Dónde:**
`src/app/*` · **Impacto:** 2 · **Esfuerzo:** M

### ARC-119 · Falta `app.config`/tipos de entorno para `EXPO_PUBLIC_*`
**Qué:** las env vars se leen como `process.env.EXPO_PUBLIC_*` sin un `env.d.ts` que las tipe;
una declaración global evita typos y documenta las requeridas. **Dónde:** `supabase.ts:6-7` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-120 · `Profile` de retorno de `awardXp`/`completeQuest` es un merge parcial
**Qué:** `{ ...profile, ...patch }` (`engine.ts:167,193`) reconstruye un `Profile` a partir de
un `Partial`; si `patch` omitiera un campo requerido el tipo seguiría compilando por el spread.
Documentar que el caller recibe un profile derivado, no recargado. **Dónde:** `engine.ts:167,193` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-121 · Sin `eslint`/regla que prohíba `Alert.alert` directo
**Qué:** para hacer cumplir ARC-025 a futuro, una regla (`no-restricted-imports`/custom) que
empuje al hook centralizado evita reintroducir el patrón. **Dónde:** config de lint, 12
archivos con `Alert` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-122 · Tipar el resultado de `ImagePicker` (base64 puede ser `undefined`)
**Qué:** `(tabs)/index.tsx:104` y `perfil.tsx:95` acceden `assets[0]?.base64` y siguen; el flujo
asume string. Un helper `getPickedBase64(result): string | null` tipado centraliza el guard.
**Dónde:** `(tabs)/index.tsx:98-104`, `perfil.tsx:87-96` · **Impacto:** 2 · **Esfuerzo:** S

### ARC-123 · `DungeonWithProgress` debería vivir junto a `Dungeon`
**Qué:** el tipo de vista (`mazmorras.tsx:25`) extiende `Dungeon` con `total/doneCount`; al
crear un repo de mazmorras (ARC-105) ese tipo enriquecido debería ser parte de su API. **Dónde:**
`mazmorras.tsx:25-28` · **Impacto:** 1 · **Esfuerzo:** S

### ARC-124 · `XPBar`/`Hexagon`/overlays sin barrel ni props documentadas
**Qué:** componentes compartidos se importan uno a uno; un `@/components` barrel con props
exportadas mejora el descubrimiento y el tree-shaking controlado. **Dónde:** `src/components/*` · **Impacto:** 1 · **Esfuerzo:** S

### ARC-125 · Falta un tipo `LoadState<T>` reutilizable (idle/loading/error/data)
**Qué:** cada pantalla modela carga con varios `useState` sueltos; un `LoadState<T>` (o el de
Query) homogeneiza y evita estados imposibles (datos + error a la vez). **Dónde:** `(tabs)/index.tsx:38-45`,
`gym.tsx:54-68` · **Impacto:** 3 · **Esfuerzo:** M

Total: 125 mejoras, 5 bugs.
