# Otorgado de XP, level-up y logros

> Área AWD · auditoría de código NIVL · anclada al código real

Alcance leído: `src/lib/engine.ts` (completeQuest, awardXp, processPendingDays, setFreeze), `src/lib/achievements.ts` (evaluateAchievements, unlockAchievements, fetchUnlocked), y todos los consumidores reales del otorgado: `src/app/(tabs)/index.tsx`, `src/app/dungeon/[id].tsx`, `src/app/gym.tsx`, `src/app/diario.tsx`, `src/app/(tabs)/perfil.tsx`. Cruzado con `src/lib/game.ts`, `closing.ts`, `data.ts`, `dungeons.ts`, `types.ts`, `dates.ts` y las migraciones `0001/0002/0003`.

Excluidos por ya conocidos/arreglados: doble-XP por doble toque (cerrojos en index/diario), claimLoot con guard de status, freeze vencido, nivel tope 999, streakMultiplier con clamp, normalización de freeze_until, ensureProfile upsert. Excluido el race read-modify-write de `xp_total` y la manipulación directa de columnas → diferido a 0004 (salvo ángulos nuevos, que sí incluyo abajo).

---

## Bugs y riesgos

### CRIT-AWD-01 · Los logros de nivel/racha solo se evalúan al completar una misión diaria — `index.tsx:129-139`, `engine.ts:173-194` · severidad alta
**Problema:** El único sitio que evalúa los logros `level_5/10/25/50` y `streak_7/30/100` es `finishQuest` en `index.tsx` (pasa `level` y `streak` al `evaluateAchievements`). `awardXp` (mazmorras `dungeon/[id].tsx:113`, gym `gym.tsx:126`, diario `diario.tsx:121`) NO pasa `level` ni `streak` a su `evaluateAchievements` (solo pasa su métrica local: `dungeonsCleared`, `prCount`, `journalCount`). Y `processPendingDays` —que es donde la racha realmente sube (`closing.ts:63`, `streak += 1`)— no evalúa ningún logro. Consecuencia: si el usuario alcanza el nivel 25 reclamando el botín de una mazmorra, o llega a racha 100 en el cierre de medianoche, el `LevelUpOverlay` se muestra pero el logro (y su **título equipable**, p. ej. "Élite", "Inquebrantable") NO se desbloquea. Solo se concede de rebote la próxima vez que toque una misión en Sistema; si ese día es de descanso sin misiones programadas, el logro queda permanentemente sin conceder.
**Arreglo:** Centralizar la evaluación. Crear `recomputeAchievements(userId, profile)` que reúna TODO el contexto (totalCompletions, evidenceCount, streak, level desde `levelFromXp(profile.xp_total)`, dungeonsCleared, prCount, journalCount) y llamarla tras `awardXp` en mazmorras/gym/diario y al final de `processPendingDays`. Como mínimo, añadir `streak: profile.streak_days` y `level: levelFromXp(profile.xp_total).level` a cada `evaluateAchievements` de los tres consumidores de `awardXp` y evaluar logros en `processPendingDays` antes de devolver.

### CRIT-AWD-02 · Evidencia subida pero `completion` no insertada → fichero huérfano en Storage — `engine.ts:129-143` · severidad alta
**Problema:** En `completeQuest`, la evidencia se sube a Storage (`uploadEvidence`, línea 131) ANTES de insertar la fila en `completions` (línea 136). Si el insert falla (violación de unique por una carrera que burle el cerrojo, RLS, red, o el CHECK `completions_xp_range` de 0003), la función lanza en `if (error) throw error` y el `.jpg` ya subido queda huérfano en el bucket `evidence/` sin ninguna fila que lo referencie. No hay limpieza ni transacción. Fuga de almacenamiento acumulativa.
**Arreglo:** Envolver: si el insert de `completions` falla y se subió evidencia, hacer `supabase.storage.from('evidence').remove([evidencePath])` en el `catch` antes de re-lanzar. Idealmente, insertar primero la completion sin URL y subir después, o mover todo a la RPC atómica de 0004 que reciba la evidencia ya subida y borre en caso de rollback.

### CRIT-AWD-03 · Fallo a mitad: completion insertada pero `updateProfile` falla → XP perdido y estado local desincronizado — `engine.ts:136-150` · severidad alta
**Problema:** Secuencia no atómica: (1) insert en `completions` con `xp_awarded` (línea 136), (2) `updateProfile` con el nuevo `xp_total`/stat (línea 150). Si (2) falla tras (1) commitear, la completion existe pero el `xp_total` no se incrementó: el XP queda perdido para siempre (el cierre futuro `processPendingDays` solo usa la completion para racha/penalización, nunca re-suma su `xp_awarded` al total). Además, en `index.tsx:113` se hace `setProfile(res.profile)` con el total optimista que SÍ incluye el XP — pero la BD no — así que la UI muestra un nivel/XP que no está persistido hasta el próximo `load()`, que lo revierte hacia abajo (parpadeo de "desnivelado").
**Arreglo:** Hacer el otorgado atómico (RPC de 0004 que inserte completion + actualice profile en una transacción). Mitigación inmediata: si `updateProfile` falla, borrar la completion recién insertada (compensación) y lanzar, para que el reintento parta de un estado consistente. Y no llamar a `setProfile(res.profile)` hasta confirmar el update.

### CRIT-AWD-04 · El insert por lotes de logros se cae entero si UN solo código ya existe (carrera contra la constraint unique) — `achievements.ts:94-101` · severidad alta
**Problema:** `unlockAchievements` filtra los códigos por `fetchUnlocked()` (línea 94) y luego inserta el lote `fresh` en una sola sentencia (`.insert(fresh.map(...))`, línea 97-99). La tabla tiene `unique (user_id, code)` (0002:122). Entre el `fetchUnlocked` y el `insert`, otra pantalla (p. ej. terminar gym y reclamar mazmorra casi a la vez, o un reintento) puede insertar uno de esos mismos códigos. Al insertar el lote, **un único código duplicado provoca 23505 y aborta TODA la sentencia**: ningún logro del lote se inserta y `if (error) return []` lo traga en silencio. Resultado: logros legítimamente nuevos del mismo lote se pierden sin aviso. Como `evaluateAchievements` usa `>=`, en una evaluación futura podrían reconcederse, pero solo si vuelve a pasar por un punto de evaluación con ese contexto (ver CRIT-AWD-01, que precisamente no ocurre para nivel/racha fuera de Sistema).
**Arreglo:** Usar `upsert` con `onConflict: 'user_id,code'` e `ignoreDuplicates: true` y `.select()` para que devuelva solo las filas realmente insertadas: `supabase.from('achievements').upsert(rows, { onConflict: 'user_id,code', ignoreDuplicates: true }).select('code')`. Así un duplicado no aborta el resto y `fresh` refleja lo realmente nuevo. Además, no tragar el error: registrarlo.

### CRIT-AWD-05 · Logro desbloqueado pero su `INSERT` falla en silencio → logro perdido sin reintento — `achievements.ts:100` · severidad media
**Problema:** `if (error) return []` descarta cualquier fallo del insert (red caída, RLS, timeout) devolviendo "no hay logros nuevos". El usuario cruzó el umbral (p. ej. misión 500 → "Leyenda del gremio" con título "Leyenda") pero el logro no se persiste ni se reintenta ni se avisa. Como el desbloqueo se dispara puntualmente en el momento del evento, si en esa evaluación falla y el contexto no se vuelve a recalcular, el logro puede no volver a evaluarse (acoplado a CRIT-AWD-01).
**Arreglo:** Distinguir el error de conflicto (esperable, ignorar) del error de red/permiso (propagar o reintentar). Devolver el error al llamador o encolar un reintento idempotente; al menos `console.warn` para no perderlo mudo. Con el `upsert ignoreDuplicates` de CRIT-AWD-04, cualquier `error` restante ya es un fallo real y debe tratarse, no tragarse.

### CRIT-AWD-06 · Doble evento `level_up` y doble overlay por el race de lectura stale entre módulos — `engine.ts:152-161`, `engine.ts:187-192` · severidad media
**Problema:** Ángulo NUEVO del race (no el genérico de `xp_total`, sino el evento de nivel): `completeQuest` y `awardXp` calculan `before`/`after` con su propio snapshot de `profile`. Si dos otorgados concurrentes leen el mismo `profile` stale (p. ej. `gym.tsx` y `dungeon/[id].tsx` cada uno con su `ensureProfile`), ambos pueden computar la misma transición 4→5 y cada uno inserta un evento `'level_up' { level: 5 }` (engine.ts:160 y :191). La crónica del diario (`diario.tsx:43`, `case 'level_up'`) mostraría "SUBIDA DE NIVEL → 5" duplicada y, si ambas pantallas están vivas, dos `LevelUpOverlay`. Inversa: una de las dos lecturas stale calcula `after == before` y se **pierde** el level_up real.
**Arreglo:** Derivar el level_up de un delta atómico en servidor (0004: la RPC devuelve el nivel antes/después calculados sobre el total ya actualizado). Mientras tanto, deduplicar eventos `level_up` por `level` antes de insertar (consultar si ya existe un evento level_up de ese nivel) y no confiar en el snapshot local para decidir el overlay.

### CRIT-AWD-07 · Logros de racha/penalización nunca se evalúan en el instante en que cambian esos valores — `engine.ts:75-97` · severidad media
**Problema:** `processPendingDays` es el único punto donde `streak_days` sube y donde se redime/aplica penalización, pero NO llama a `evaluateAchievements`/`unlockAchievements` en ningún caso. El logro `penalty_redeemed` solo se evalúa al completar la misión de penalización en `index.tsx:137` (`penaltyRedeemed: res.wasPenalty`), lo cual está bien, pero los de racha (`streak_7/30/100`) dependen de que el usuario complete OTRA misión después del cierre que subió la racha. En un día sin misiones programadas (descanso) que aun así incrementa racha vía piedra/cierre, el logro de racha no se concede.
**Arreglo:** Evaluar logros dentro de `processPendingDays` tras calcular el nuevo `profile` (al menos `streak`), o hacer que `index.tsx` evalúe logros también cuando `processPendingDays` devuelve un `profile` con racha cambiada (no solo en `finishQuest`). Ver la solución central de CRIT-AWD-01.

### CRIT-AWD-08 · `xp_total` y la suma de columnas de stat divergen por el ciclo penalización/redención — `engine.ts:59`, `engine.ts:145-149`, `game.ts:83-88` · severidad media
**Problema:** Invariante roto. La penalización resta de `xp_total` (engine.ts:59, `newTotal = xp_total - penaltyXp`) pero NO toca ninguna columna de stat. La misión de penalización al redimirse suma a `xp_total` pero, por ser `is_penalty`, NO suma a ningún stat (engine.ts:146 `if (!quest.is_penalty)`). Además mazmorras/gym/diario suman a la vez a `xp_total` y a un stat, mientras una penalización solo mueve `xp_total`. Resultado: `sum(xp_fue..xp_per)` deja de cuadrar con `xp_total` de forma permanente y creciente. `statPoints` (perfil) y el nivel (que viene de `xp_total`) cuentan historias distintas; el usuario puede ver "nivel 12" pero stats que suman bastante menos, o al revés.
**Arreglo:** Decidir la invariante explícitamente. Opción A: la penalización resta proporcionalmente del stat de cada misión fallada (closing.ts ya conoce `q.stat` de las misiones perdidas) y la redención lo restaura a ese stat. Opción B: documentar que stats y `xp_total` son contadores independientes por diseño y no compararlos. Hoy no hay decisión, solo deriva silenciosa.

---

## Mejoras

### AWD-001 · Centralizar la evaluación de logros en una sola función
**Qué:** Extraer `recomputeAchievements(userId, profile, extras?)` que reúna todas las métricas y se llame desde todos los otorgados. Elimina los 4 `evaluateAchievements` parciales y dispersos. **Dónde:** `achievements.ts` + `index.tsx:130`, `dungeon/[id].tsx:118`, `gym.tsx:138`, `diario.tsx:122` · **Impacto:** 5 · **Esfuerzo:** M

### AWD-002 · Evaluar logros de nivel tras cada `awardXp`
**Qué:** Pasar `level: levelFromXp(profile.xp_total).level` en las llamadas de mazmorra/gym/diario para que un level-up fuera de Sistema conceda su logro/título. **Dónde:** `dungeon/[id].tsx:118`, `gym.tsx:138`, `diario.tsx:122` · **Impacto:** 5 · **Esfuerzo:** S

### AWD-003 · Evaluar logros de racha en `processPendingDays`
**Qué:** Tras computar el cierre, evaluar `streak_7/30/100` con el nuevo `streak` y desbloquear. **Dónde:** `engine.ts:97-111` · **Impacto:** 4 · **Esfuerzo:** S

### AWD-004 · `unlockAchievements` con `upsert ignoreDuplicates` en vez de `insert`
**Qué:** Sustituir el insert por `upsert(rows,{onConflict:'user_id,code',ignoreDuplicates:true}).select('code')` para que un duplicado no aborte el lote. **Dónde:** `achievements.ts:97-101` · **Impacto:** 4 · **Esfuerzo:** S

### AWD-005 · No tragar el error de inserción de logros
**Qué:** Reemplazar `if (error) return []` por log + propagación/retry; solo ignorar el conflicto unique. **Dónde:** `achievements.ts:100` · **Impacto:** 3 · **Esfuerzo:** S

### AWD-006 · Limpiar la evidencia subida si falla el insert de completion
**Qué:** `catch` que llame a `storage.remove([evidencePath])` antes de re-lanzar. **Dónde:** `engine.ts:136-143` · **Impacto:** 4 · **Esfuerzo:** S

### AWD-007 · Compensar la completion si `updateProfile` falla
**Qué:** Borrar la completion recién insertada cuando el update de profile falla, para no perder XP ni desincronizar. **Dónde:** `engine.ts:145-150` · **Impacto:** 4 · **Esfuerzo:** M

### AWD-008 · Otorgado atómico vía RPC (cierra AWD-02/03/06 y el race de 0004)
**Qué:** RPC `SECURITY DEFINER` que inserte completion + actualice profile + emita evento en una transacción; el cliente solo llama y recibe `{xp, leveledUp, newLevel}`. **Dónde:** `engine.ts:122-170` (+ migración 0004) · **Impacto:** 5 · **Esfuerzo:** L

### AWD-009 · Deduplicar eventos `level_up` por nivel
**Qué:** Antes de insertar `level_up`, comprobar que no exista ya un evento de ese `level` (o calcularlo en la RPC). Evita la doble crónica y el doble overlay. **Dónde:** `engine.ts:159-160`, `engine.ts:190-191` · **Impacto:** 3 · **Esfuerzo:** M

### AWD-010 · Idempotencia de `journal_entry` XP ante doble guardado
**Qué:** El `isNew` de `upsertEntry` puede dar true en ambos lados de una carrera real entre montajes; apoyarse en la unique `(user_id,date)` y otorgar XP solo si el insert (no update) realmente creó la fila a nivel SQL. **Dónde:** `diario.tsx:113-122`, `journal.ts` (upsertEntry) · **Impacto:** 3 · **Esfuerzo:** M

### AWD-011 · No mostrar XP optimista hasta confirmar persistencia
**Qué:** En `finishQuest`, aplicar `setProfile(res.profile)` solo si el otorgado confirmó (o revertir si el `catch` se dispara tras el optimismo). **Dónde:** `index.tsx:111-127` · **Impacto:** 3 · **Esfuerzo:** S

### AWD-012 · Tests unitarios de `completeQuest` con mocks de fallo a mitad
**Qué:** Probar: insert ok + update falla; upload ok + insert falla; verificar compensación. **Dónde:** nuevo `engine.test.ts` · **Impacto:** 4 · **Esfuerzo:** M

### AWD-013 · Tests de `evaluateAchievements` (tabla de umbrales)
**Qué:** Casos límite en cada frontera (0,1,9,10,49,50,99,100,499,500; racha 6/7; nivel 4/5...). Función pura, fácil de cubrir. **Dónde:** nuevo `achievements.test.ts` · **Impacto:** 4 · **Esfuerzo:** S

### AWD-014 · Test de `unlockAchievements` con código ya existente en el lote
**Qué:** Mock que devuelva un código ya desbloqueado junto a uno nuevo y verificar que el nuevo SÍ se inserta (regresión de CRIT-AWD-04). **Dónde:** `achievements.test.ts` · **Impacto:** 4 · **Esfuerzo:** S

### AWD-015 · Centralizar el patrón "otorga XP + evalúa logros + level overlay"
**Qué:** Hook `useAward()` que envuelva `awardXp` + recompute + set de overlay, reutilizado por gym/mazmorra/diario (hoy el bloque está copiado 3 veces). **Dónde:** `dungeon/[id].tsx:88-103`, `gym.tsx:124-144`, `diario.tsx:119-129` · **Impacto:** 3 · **Esfuerzo:** M

### AWD-016 · `evaluateAchievements` devuelve duplicados acumulativos innecesarios
**Qué:** Devuelve todos los códigos por debajo del umbral (p. ej. con 500 misiones añade first_quest, quests_10, _50, _100, _500). `unlockAchievements` los filtra, pero se hacen N comprobaciones y un `fetchUnlocked` por evento. Devolver solo el de mayor umbral por familia reduce ruido. **Dónde:** `achievements.ts:50-81` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-017 · `fetchUnlocked` se llama en cada otorgado (una query extra por completar)
**Qué:** `unlockAchievements` hace `fetchUnlocked()` siempre (achievements.ts:94). Cachear el set de logros en memoria/Context e invalidarlo al desbloquear, evitando un round-trip por cada misión. **Dónde:** `achievements.ts:83-86,94` · **Impacto:** 3 · **Esfuerzo:** M

### AWD-018 · `completionStats` hace 2 COUNT por misión completada
**Qué:** `finishQuest` llama a `completionStats` (index.tsx:129) que dispara dos `count exact head` (total y withEvidence) en cada completar. Unificar en una sola query agregada o derivar incrementalmente del estado local. **Dónde:** `data.ts:76-85`, `index.tsx:129` · **Impacto:** 3 · **Esfuerzo:** M

### AWD-019 · `prCount` se deriva de contar eventos `gym_pr` (frágil)
**Qué:** El logro `pr_10` cuenta filas de `events` type `gym_pr` (gym.tsx:134-137). Si un evento se inserta dos veces (reintento) o se borra, el conteo miente. Contar PRs sobre una fuente canónica (tabla de lifts/PR) o un contador en profile. **Dónde:** `gym.tsx:134-138` · **Impacto:** 3 · **Esfuerzo:** M

### AWD-020 · `level_up` debería conducir a la evaluación de logros de nivel en el mismo flujo
**Qué:** Cuando `res.leveledUp`, forzar recompute de logros (hoy en index.tsx el `Alert` de logro se suprime si `leveledUp`, index.tsx:140, pero el logro de nivel ni siquiera se evalúa fuera de Sistema). **Dónde:** `index.tsx:140-142` · **Impacto:** 3 · **Esfuerzo:** S

### AWD-021 · `awardXp` no acepta evidencia/idempotency key
**Qué:** Añadir un identificador de origen (p. ej. `sourceId`) para que un reintento de mazmorra/gym no vuelva a otorgar. Hoy la idempotencia depende de constraints externas (gym_sessions unique) o de guards de UI. **Dónde:** `engine.ts:173-194` · **Impacto:** 3 · **Esfuerzo:** L

### AWD-022 · `setTaskDone(true)` y `awardXp` no son atómicos en mazmorra
**Qué:** En `toggleTask`, se marca la tarea hecha (`setTaskDone`, dungeon:87) y luego se otorga XP (dungeon:90). Si el otorgado falla, la tarea queda `done` sin XP y un reintento no re-otorga (el guard `if (task.done) return`). **Dónde:** `dungeon/[id].tsx:86-97` · **Impacto:** 4 · **Esfuerzo:** M

### AWD-023 · `claimLoot`: status pasa a 'cleared' antes de otorgar el botín
**Qué:** `updateDungeon(status:'cleared')` (dungeon:110) ocurre antes de `awardXp` (dungeon:113). Si el award falla, la mazmorra queda despejada sin botín y el guard de status impide reclamar de nuevo → botín perdido. **Dónde:** `dungeon/[id].tsx:109-116` · **Impacto:** 4 · **Esfuerzo:** M

### AWD-024 · `gym.tsx`: la sesión se crea antes de otorgar XP
**Qué:** `createSession` (gym:117) y `insertLifts` (gym:120) preceden a `awardXp` (gym:126). Si el award falla, queda una sesión registrada (que bloquea por unique date) sin XP y sin posibilidad de reintento ese día. **Dónde:** `gym.tsx:117-126` · **Impacto:** 4 · **Esfuerzo:** M

### AWD-025 · El payload del evento `quest_completed` no guarda `quest_id`
**Qué:** Guarda `quest` (título) pero no el id (engine.ts:154-158). Si el usuario renombra/elimina la misión, la crónica histórica pierde trazabilidad. **Dónde:** `engine.ts:154-158` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-026 · El evento `penalty` y el `level_up` derivado de penalización no se emiten juntos
**Qué:** `processPendingDays` emite `penalty` (engine.ts:87) pero, si la penalización baja de nivel (`levelsLost>0`, engine.ts:105), NO emite un evento de bajada de nivel. La crónica solo registra subidas. Añadir `level_down` para simetría narrativa. **Dónde:** `engine.ts:75-97` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-027 · `insertEvent` ignora errores por completo
**Qué:** `insertEvent` (data.ts:87-93) no comprueba `error`. Un evento `level_up`/`quest_completed`/`penalty` puede no insertarse y la crónica/diario quedará incompleta sin aviso. **Dónde:** `data.ts:87-93` · **Impacto:** 3 · **Esfuerzo:** S

### AWD-028 · El orden de inserción de eventos puede dejar `level_up` antes que `quest_completed`
**Qué:** Da igual el `created_at` por ms, pero la crónica ordena por `created_at` y un `level_up` (engine.ts:160) insertado tras `quest_completed` (engine.ts:154) puede empatar en timestamp; añadir un orden secundario estable. **Dónde:** `engine.ts:154-161`, `journal.ts` (fetchEventsForDate) · **Impacto:** 1 · **Esfuerzo:** S

### AWD-029 · No hay límite de tamaño del payload de evento
**Qué:** `payload.missed` (engine.ts:87) mete todos los títulos de misiones falladas; con muchos días/misiones puede crecer. Acotar o resumir. **Dónde:** `engine.ts:87` · **Impacto:** 1 · **Esfuerzo:** S

### AWD-030 · `processPendingDays` recalcula nivel antes/después solo para `levelsLost`
**Qué:** Calcula `levelBefore`/`levelAfter` (engine.ts:58-60) aunque `penaltyXp` sea 0 (no hay cambio). Mover dentro del `if (penaltyXp>0)`. **Dónde:** `engine.ts:58-60` · **Impacto:** 1 · **Esfuerzo:** S

### AWD-031 · La penalización inserta una `quest` con `days_of_week: []`
**Qué:** Correcto frente al CHECK de 0003 (`<@ array[1..7]` admite vacío), pero conviene un comentario que ate ese acoplamiento para no romperlo en una futura migración que prohíba el vacío. **Dónde:** `engine.ts:76-86` · **Impacto:** 1 · **Esfuerzo:** S

### AWD-032 · El XP de penalización no respeta el tope por nivel mínimo
**Qué:** `newTotal = Math.max(0, xp_total - penaltyXp)` (engine.ts:59) puede llevar a nivel 1 con 0 XP. Coherente, pero no hay suelo configurable (p. ej. "nunca por debajo del nivel alcanzado"). Decisión de diseño a documentar. **Dónde:** `engine.ts:59` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-033 · `awardXp` permite `amount` negativo sin validación
**Qué:** Nada impide pasar un `amount` negativo (bajaría XP sin tope ni clamp). Aunque hoy todos los llamadores pasan positivos, validar `amount >= 0` o documentar. **Dónde:** `engine.ts:173-180` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-034 · `completeQuest` no valida que la misión esté programada hoy
**Qué:** Otorga XP por cualquier `quest` recibida sin comprobar `questsScheduledOn(...today)`. Un bug de UI que muestre una misión fuera de día permitiría XP indebido. **Dónde:** `engine.ts:122-143` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-035 · `completeQuest` no comprueba si la misión ya está completada hoy en estado local
**Qué:** La unique de BD lo bloquea, pero el error 23505 sube como "Error del sistema" genérico. Detectar el caso y mostrar "ya completada" amistoso. **Dónde:** `engine.ts:136-143`, `index.tsx:143-145` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-036 · Mensaje de error de otorgado demasiado genérico
**Qué:** Todos los `catch` muestran `e.message` crudo o "Fallo desconocido". Mapear errores frecuentes (red, RLS, unique) a copy del sistema. **Dónde:** `index.tsx:144`, `dungeon/[id].tsx:99,127`, `gym.tsx:148`, `diario.tsx:133` · **Impacto:** 3 · **Esfuerzo:** M

### AWD-037 · El toast de XP y el overlay de nivel pueden solaparse
**Qué:** Al subir de nivel se muestran a la vez `XpToast` (index:330) y `LevelUpOverlay` (index:331). Secuenciarlos (toast → overlay) mejora la lectura. **Dónde:** `index.tsx:330-331` · **Impacto:** 2 · **Esfuerzo:** M

### AWD-038 · El `Alert` de logro se suprime si hubo level-up, perdiéndose el aviso del logro
**Qué:** `if (fresh.length>0 && !res.leveledUp)` (index.tsx:140) oculta el logro cuando coinciden nivel y logro. El usuario no se entera del logro. Encolar ambos avisos. **Dónde:** `index.tsx:140-142` · **Impacto:** 3 · **Esfuerzo:** M

### AWD-039 · Avisos de logro vía `Alert` nativo rompen la estética del sistema
**Qué:** Los logros se anuncian con `Alert.alert` (index/gym/diario/dungeon) en vez de un `SystemWindow`/overlay temático. Crear un `AchievementOverlay`. **Dónde:** `index.tsx:141`, `gym.tsx:143`, `diario.tsx:125`, `dungeon/[id].tsx:120-123` · **Impacto:** 3 · **Esfuerzo:** L

### AWD-040 · No hay feedback de progreso hacia el siguiente logro
**Qué:** En perfil los logros bloqueados solo muestran candado. Mostrar "47/50 misiones" en los de umbral acerca la recompensa. **Dónde:** `perfil.tsx:282-301`, `achievements.ts` (exponer umbral) · **Impacto:** 3 · **Esfuerzo:** M

### AWD-041 · Los logros carecen de campo de rareza/orden
**Qué:** `AchievementDef` no tiene tier ni orden de display; el grid los pinta en orden de declaración. Añadir `tier` para colorear y ordenar. **Dónde:** `achievements.ts:3-8,11-33` · **Impacto:** 2 · **Esfuerzo:** M

### AWD-042 · `evaluateAchievements` ignora contextos no provistos pero no documenta la semántica de `?? 0`
**Qué:** Cada métrica ausente cuenta como 0 (achievements.ts:52,58,62...). Es correcto para evaluación parcial, pero un llamador que olvide pasar `level` nunca concederá logros de nivel (origen de CRIT-AWD-01). Documentar que evaluar parcialmente NO concede los de las métricas omitidas. **Dónde:** `achievements.ts:50-81` · **Impacto:** 3 · **Esfuerzo:** S

### AWD-043 · `STAT_COLUMN[quest.stat]` se indexa sin validar el stat
**Qué:** Si `quest.stat` viniera corrupto (no en el enum), `STAT_COLUMN[col]` sería undefined y `patch[undefined]` rompería el update. El CHECK de BD lo protege, pero el cliente no. **Dónde:** `engine.ts:147-148` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-044 · `awardXp` duplica la lógica de stat/level de `completeQuest`
**Qué:** El cálculo de `patch` con stat y de `before/after` está repetido (engine.ts:145-161 vs 180-192). Extraer un helper `applyXp(profile, amount, stat)`. **Dónde:** `engine.ts:145-161,180-192` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-045 · El nivel se recalcula desde cero (`levelFromXp`) en cada otorgado
**Qué:** `levelFromXp` itera hasta 999 sumando costes (game.ts:46-57). En el otorgado se llama 2 veces (before/after). Para totales altos es O(nivel). Cachear el nivel en profile o usar fórmula inversa cerrada. **Dónde:** `game.ts:46-57`, `engine.ts:152-153,187-188` · **Impacto:** 2 · **Esfuerzo:** M

### AWD-046 · Falta índice para `events.type` usado por el conteo de PRs
**Qué:** `gym.tsx:134-137` cuenta `events where type='gym_pr'`; el índice es `(user_id, created_at desc)` (0001:55), no cubre el filtro por `type`. Añadir índice parcial o por `(user_id,type)`. **Dónde:** `0001_init.sql:55`, `gym.tsx:134-137` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-047 · `unlockAchievements` no es idempotente frente a reintentos del llamador
**Qué:** Si el llamador reintenta tras un timeout que en realidad SÍ insertó, el segundo intento choca con la unique y (hoy) devuelve []. Con `upsert ignoreDuplicates` (AWD-004) se vuelve idempotente. **Dónde:** `achievements.ts:89-101` · **Impacto:** 3 · **Esfuerzo:** S

### AWD-048 · No hay logros de mazmorra de mayor escala
**Qué:** Solo `first_dungeon` y `dungeons_5`. Añadir `dungeons_25/50` para retención a largo plazo (coherente con el resto de familias). **Dónde:** `achievements.ts:27-28` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-049 · Logro de evidencia se queda en 50
**Qué:** `evidence_50` es el tope; sin `evidence_200` la motivación de fotografiar decae. **Dónde:** `achievements.ts:25` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-050 · Sin logro por subir de rango (E→D→C...)
**Qué:** `rankForLevel` (game.ts:61-68) define rangos pero no hay logro al cruzarlos, una recompensa narrativa natural de Solo Leveling. **Dónde:** `achievements.ts:11-33`, `game.ts:61-68` · **Impacto:** 3 · **Esfuerzo:** S

### AWD-051 · Sin logro por "día perfecto" (todas las misiones del día con evidencia)
**Qué:** Mecánica de enganche diario ausente. Evaluar al cerrar el día o al completar la última misión. **Dónde:** `achievements.ts`, `closing.ts:61-67` · **Impacto:** 3 · **Esfuerzo:** M

### AWD-052 · Sin logro por usar/forjar piedras de protección
**Qué:** `stone_used`/`stone_earned` ya se emiten (engine.ts:90-94) pero no conceden logro. "Primer escudo", "Forjador". **Dónde:** `achievements.ts`, `engine.ts:89-94` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-053 · El title equipable no se notifica al desbloquearse
**Qué:** Al conceder un logro con `title`, el aviso no menciona que hay un nuevo título equipable en perfil. **Dónde:** `index.tsx:141`, `achievements.ts:14,16,18...` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-054 · `evaluateAchievements` no soporta logros compuestos (varias condiciones)
**Qué:** Cada logro es un único umbral. No se pueden expresar "nivel 10 + racha 30". Generalizar a predicados sobre el contexto. **Dónde:** `achievements.ts:50-81` · **Impacto:** 2 · **Esfuerzo:** L

### AWD-055 · No hay test de que cada `code` de `ACHIEVEMENTS` se evalúe en `evaluateAchievements`
**Qué:** Si se añade un logro a la lista pero se olvida la rama en `evaluateAchievements`, nunca se concede. Test que cruce ambas fuentes. **Dónde:** `achievements.test.ts`, `achievements.ts:11-33,50-81` · **Impacto:** 3 · **Esfuerzo:** S

### AWD-056 · `ACHIEVEMENT_BY_CODE` se reconstruye en import pero no se valida unicidad de códigos
**Qué:** Dos defs con el mismo `code` se pisarían en el `Object.fromEntries` (achievements.ts:35-37) sin aviso. Validar en test o en dev. **Dónde:** `achievements.ts:35-37` · **Impacto:** 1 · **Esfuerzo:** S

### AWD-057 · `fetchUnlocked` no filtra por `user_id` (depende solo de RLS)
**Qué:** `select('code')` sin `eq('user_id',...)` (achievements.ts:84). RLS lo protege, pero hacerlo explícito evita sorpresas si RLS cambia y mejora el plan. **Dónde:** `achievements.ts:84` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-058 · `insert` de logros confía en `default auth.uid()` y a la vez pasa `user_id`
**Qué:** Se pasa `user_id` explícito (achievements.ts:99) y la columna tiene `default auth.uid()`. Redundante; si difirieran, RLS rechaza. Unificar criterio. **Dónde:** `achievements.ts:99` · **Impacto:** 1 · **Esfuerzo:** S

### AWD-059 · El otorgado no registra el `streakMultiplier` aplicado en el evento
**Qué:** `quest_completed` guarda el XP final pero no el desglose (base, bonus evidencia, multiplicador). Útil para el informe/depuración. **Dónde:** `engine.ts:154-158`, `game.ts:83-88` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-060 · No hay telemetría/log de level-up para depurar niveles perdidos
**Qué:** Sin un log estructurado del before/after, los bugs de "nivel perdido" (CRIT-AWD-06) son difíciles de reproducir. Loguear en dev. **Dónde:** `engine.ts:152-160,187-191` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-061 · `processPendingDays` muta el parámetro `profile` (reasignación)
**Qué:** Reasigna `profile = {...}` (engine.ts:33,38) sobre el parámetro. Funciona, pero usar una variable nueva (`current`) evita confusiones y facilita el tipado del flujo. **Dónde:** `engine.ts:31-44` · **Impacto:** 1 · **Esfuerzo:** S

### AWD-062 · Doble comprobación de freeze vencido (líneas 31 y 69)
**Qué:** El freeze vencido se limpia en engine.ts:31-34 y otra vez en :69-72 dentro del patch. Tras el primer bloque, `profile.freeze_until` ya es null, así que el segundo `if` nunca se cumple en ese flujo → código muerto/confuso. **Dónde:** `engine.ts:31-34,69-72` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-063 · `fetchCompletionsSince` trae todas las columnas para construir un Set de claves
**Qué:** Solo se usan `date` y `quest_id` (engine.ts:45-46) pero se hace `select('*')` (data.ts:64). Seleccionar solo esas dos columnas reduce payload en cierres largos. **Dónde:** `data.ts:61-67`, `engine.ts:45` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-064 · `processPendingDays` no acota cuántos días puede cerrar de golpe
**Qué:** Si el usuario no abre la app durante meses, el bucle de `computeDayClose` itera todos los días y `fetchCompletionsSince` trae todo el histórico. Acotar a una ventana razonable o paginar. **Dónde:** `engine.ts:44-56`, `closing.ts:51-86` · **Impacto:** 3 · **Esfuerzo:** M

### AWD-065 · El penalti se inserta como `quest` nueva en cada cierre con penalización
**Qué:** Cada cierre con `penaltyXp>0` crea una misión de penalización (engine.ts:76-86). Varios días seguidos fallados generan varias misiones de penalización acumuladas; conviene consolidar o limitar a una activa. **Dónde:** `engine.ts:75-86` · **Impacto:** 3 · **Esfuerzo:** M

### AWD-066 · La misión de penalización no expira si no se redime
**Qué:** No hay limpieza de penalizaciones viejas no redimidas; se acumulan en la pestaña Misiones/Sistema. Caducarlas tras X días. **Dónde:** `engine.ts:76-86`, `closing.ts:8-15` · **Impacto:** 2 · **Esfuerzo:** M

### AWD-067 · `completeQuest` de una penalización suma a `xp_total` pero el evento es `quest_completed` genérico
**Qué:** No se distingue en el evento que fue una redención (`is_penalty`), perdiendo la narrativa "Redención". Emitir `penalty_redeemed` o marcar el payload. **Dónde:** `engine.ts:154-158` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-068 · El logro `penalty_redeemed` se evalúa con `res.wasPenalty` pero podría no persistir si falla el insert
**Qué:** Acoplado a CRIT-AWD-05; además, si el usuario redime la penalización offline, el logro se pierde. **Dónde:** `index.tsx:137`, `achievements.ts:97-101` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-069 · No hay reconciliación periódica de logros
**Qué:** Una rutina (al abrir perfil o Sistema) que recompute todos los logros contra el estado real recuperaría los perdidos por CRIT-AWD-01/04/05. **Dónde:** `perfil.tsx:63-77`, `achievements.ts` · **Impacto:** 4 · **Esfuerzo:** M

### AWD-070 · `unlockAchievements` no devuelve el orden estable de `fresh`
**Qué:** El orden depende del filtrado; para mostrar varios logros a la vez conviene un orden determinista (por tier/umbral). **Dónde:** `achievements.ts:95,101` · **Impacto:** 1 · **Esfuerzo:** S

### AWD-071 · Falta accesibilidad en el grid de logros
**Qué:** Los `Pressable` de logro (perfil.tsx:285-300) no tienen `accessibilityLabel`/`accessibilityState` (bloqueado/desbloqueado) ni rol. **Dónde:** `perfil.tsx:285-300` · **Impacto:** 3 · **Esfuerzo:** S

### AWD-072 · El overlay de nivel no anuncia a lectores de pantalla
**Qué:** `LevelUpOverlay` aparece visualmente; añadir `accessibilityLiveRegion`/`AccessibilityInfo.announceForAccessibility` con "Has subido al nivel N". **Dónde:** `index.tsx:331`, `LevelUpOverlay` · **Impacto:** 3 · **Esfuerzo:** S

### AWD-073 · El toast de XP no es accesible
**Qué:** `XpToast` (index.tsx:330) no anuncia el XP ganado a TalkBack. **Dónde:** `index.tsx:330`, `XpToast` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-074 · Los avisos de logro por `Alert` concatenan nombres con `\n` sin estructura
**Qué:** `fresh.map(a=>a.name).join('\n')` (index.tsx:141, gym:142, etc.) pierde la descripción y el título. Mostrar lista estructurada. **Dónde:** `index.tsx:141`, `gym.tsx:142`, `diario.tsx:127`, `dungeon/[id].tsx:122` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-075 · No hay haptic diferenciado para level-up vs logro vs completar
**Qué:** Todos usan `NotificationFeedbackType.Success`. Un patrón más intenso para level-up reforzaría el hito. **Dónde:** `index.tsx:112`, `dungeon/[id].tsx:95,119`, `gym.tsx:140`, `diario.tsx:124` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-076 · `awardXp` no informa al usuario del XP en mazmorra (solo al despejar)
**Qué:** `toggleTask` otorga XP por tarea pero no muestra toast (dungeon:90-96), solo haptic. Mostrar `+X XP` como en Sistema. **Dónde:** `dungeon/[id].tsx:90-96` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-077 · La crónica del diario no incluye logros desbloqueados
**Qué:** `chronicleLine` (diario.tsx:37-61) cubre quest/level/penalty/dungeon/gym/stone pero no un evento de logro. Emitir `achievement_unlocked` y mostrarlo. **Dónde:** `diario.tsx:37-61`, `achievements.ts:97-101` · **Impacto:** 3 · **Esfuerzo:** M

### AWD-078 · No se emite evento al desbloquear logro
**Qué:** `unlockAchievements` inserta en `achievements` pero no en `events`, así que la crónica/informe no puede mostrarlo cronológicamente. Insertar un evento por logro nuevo. **Dónde:** `achievements.ts:97-101` · **Impacto:** 3 · **Esfuerzo:** S

### AWD-079 · `evaluateAchievements` recibe `level` ya calculado y a la vez `streak` desde el profile en sitios distintos
**Qué:** Inconsistencia de fuente: index.tsx pasa `streak: res.profile.streak_days` y `level: levelFromXp(...).level`. Unificar para que siempre derive ambos del mismo profile dentro de la función central. **Dónde:** `index.tsx:133-137` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-080 · El cálculo de `before`/`after` puede saltarse niveles intermedios sin avisar
**Qué:** Un solo otorgado grande (botín S de 600 XP) puede cruzar 2+ niveles; el overlay muestra solo `after` (engine.ts:165). No se celebran los niveles intermedios. Mostrar el salto "N → M". **Dónde:** `engine.ts:159-166`, `LevelUpOverlay` · **Impacto:** 2 · **Esfuerzo:** M

### AWD-081 · `newLevel` devuelto es el `after` aunque no haya subido
**Qué:** `awardXp` devuelve `newLevel: after` siempre (engine.ts:193); el llamador solo lo usa si `leveledUp`, pero la API es ambigua. Devolver `newLevel` solo con `leveledUp` o renombrar a `currentLevel`. **Dónde:** `engine.ts:193` · **Impacto:** 1 · **Esfuerzo:** S

### AWD-082 · `completeQuest` no soporta deshacer
**Qué:** No hay forma de revertir una misión completada por error (que además otorgó XP y quizá subió nivel/logro). Un "deshacer" con ventana corta requeriría revertir XP/stat/eventos. **Dónde:** `engine.ts:122-170` · **Impacto:** 2 · **Esfuerzo:** L

### AWD-083 · El XP otorgado no se redondea de forma consistente con el penalti
**Qué:** `questXp` usa `Math.round` (game.ts:87) y la penalización también (closing.ts:79), pero al redimir se otorga `penalty_xp` exacto (game.ts:84). Si el penalti se calculó con redondeo, la redención lo restaura exacto: ok, pero conviene un test que verifique penaliza==redime al céntimo. **Dónde:** `game.ts:84-87`, `closing.ts:79` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-084 · `streakMultiplier` se aplica al XP base pero no a mazmorra/gym/diario
**Qué:** Decisión correcta (anti-inflación), pero no documentada en el otorgado de `awardXp`; un futuro cambio podría aplicarlo por error. Comentar la intención en `awardXp`. **Dónde:** `engine.ts:173-194`, `game.ts:83-88` · **Impacto:** 1 · **Esfuerzo:** S

### AWD-085 · No hay límite diario de XP por mazmorras/gym/diario
**Qué:** El penalti tiene `DAILY_PENALTY_CAP` pero el otorgado positivo vía `awardXp` no tiene tope diario; crear muchas tareas triviales de mazmorra permite farmear XP. **Dónde:** `engine.ts:173-194`, `game.ts:109-111` · **Impacto:** 3 · **Esfuerzo:** M

### AWD-086 · `dungeonTaskXp` no aplica tope ni a épicas jefe
**Qué:** Una tarea épica jefe da 250×2=500 XP (game.ts:109-111) sin límite; varias en una mazmorra inflan rápido. Revisar balance/tope. **Dónde:** `game.ts:109-111`, `dungeon/[id].tsx:89` · **Impacto:** 3 · **Esfuerzo:** S

### AWD-087 · El conteo de mazmorras despejadas incluye solo `status='cleared'`
**Qué:** Correcto, pero si una mazmorra se reabre (no hay flujo hoy) el conteo no se ajusta. Documentar la suposición de irreversibilidad. **Dónde:** `dungeons.ts:91-97`, `dungeon/[id].tsx:117` · **Impacto:** 1 · **Esfuerzo:** S

### AWD-088 · `claimLoot` recarga toda la mazmorra tras otorgar (`load()`)
**Qué:** Tras el award hace `await load()` (dungeon:125) que re-fetcha dungeon+tasks; podría actualizar estado local en vez de round-trip completo. **Dónde:** `dungeon/[id].tsx:124-125` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-089 · `finishTraining` consulta el conteo de PRs con otra query tras insertar eventos
**Qué:** Inserta N eventos `gym_pr` (gym:130-132) y luego cuenta todos (gym:134-137): N+1 escrituras + 1 lectura. Calcular el nuevo total como `previo + prs.length`. **Dónde:** `gym.tsx:130-138` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-090 · El cálculo de PRs compara contra `fetchMaxLifts` que puede no estar bloqueado
**Qué:** Entre leer el máximo previo (gym:114) e insertar la sesión, otra sesión podría cambiar el máximo (poco probable con un usuario, pero el patrón es read-then-write). **Dónde:** `gym.tsx:114-120` · **Impacto:** 1 · **Esfuerzo:** M

### AWD-091 · El XP de la sesión de gym se calcula dos veces
**Qué:** `GYM_SESSION_XP + prs.length*PR_XP` aparece en gym:120 (para `createSession`) y otra vez en gym:125 (`totalXp`). Calcularlo una vez. **Dónde:** `gym.tsx:120,125` · **Impacto:** 1 · **Esfuerzo:** S

### AWD-092 · `awardXp` en gym usa stat fija 'FUE' aunque la sesión podría no ser de fuerza
**Qué:** Toda sesión de gym suma a FUE (gym:126). Cardio/movilidad quizá debería ir a VIT/AGI. Decisión de diseño a exponer. **Dónde:** `gym.tsx:126` · **Impacto:** 2 · **Esfuerzo:** M

### AWD-093 · El diario otorga XP solo en la primera entrada del día (`isNew`)
**Qué:** Correcto (anti-farmeo), pero si el usuario borra y recrea la entrada (no hay borrado hoy) volvería a otorgar. Documentar/blindar con la unique date. **Dónde:** `diario.tsx:113-122` · **Impacto:** 1 · **Esfuerzo:** S

### AWD-094 · `countEntries` cuenta todas las entradas para el logro de diario
**Qué:** `journalCount` proviene de contar `journal_entries` (diario:122). Si se permitiera más de una por día en el futuro, el umbral 30 sería ambiguo (entradas vs días). Definir la unidad. **Dónde:** `diario.tsx:122`, `journal.ts` (countEntries) · **Impacto:** 1 · **Esfuerzo:** S

### AWD-095 · No hay manejo de `userId` nulo más allá del early-return
**Qué:** `completeQuest`/`awardXp` reciben `profile.id`, pero las pantallas hacen `if (!userId) return` y siguen usando `profile`. Si `session` expira a mitad, el otorgado falla por RLS con error genérico. Detectar sesión caducada. **Dónde:** `index.tsx:108`, `engine.ts:122-127` · **Impacto:** 2 · **Esfuerzo:** M

### AWD-096 · `processPendingDays` y `finishQuest` pueden solaparse en el primer foco
**Qué:** `load()` (que llama a `processPendingDays`) corre en `useFocusEffect`; si el usuario completa una misión justo mientras `load` reescribe el profile, el `setProfile` del otorgado y el de `load` compiten. Serializar (no permitir completar hasta que `load` termine). **Dónde:** `index.tsx:49-86,107-146` · **Impacto:** 3 · **Esfuerzo:** M

### AWD-097 · `setProfile(res.profile)` tras `awardXp` no ocurre en gym/diario
**Qué:** En gym/diario, tras `awardXp` no se actualiza un estado de profile (no lo tienen), pero el overlay de nivel sí; si el usuario navega a Sistema, el XP aparecerá tras el `load`. Aceptable, pero el `newLevel` y el XP del momento no se reflejan en esa pantalla. Considerar un store global de profile. **Dónde:** `gym.tsx:124-145`, `diario.tsx:119-129` · **Impacto:** 2 · **Esfuerzo:** L

### AWD-098 · No hay store/contexto de profile compartido
**Qué:** Cada pantalla hace su propio `ensureProfile`, generando lecturas redundantes y snapshots divergentes (raíz de varios races). Un `ProfileContext` con el profile vivo unificaría el otorgado. **Dónde:** `index.tsx:52`, `dungeon/[id].tsx:88`, `gym.tsx:124`, `diario.tsx:120`, `perfil.tsx:66` · **Impacto:** 4 · **Esfuerzo:** L

### AWD-099 · El otorgado no expone una API para "previsualizar" XP sin persistir
**Qué:** La UI calcula el XP a mostrar con `questXp` por su cuenta (QuestItem recibe streakDays). Exponer un selector puro compartido evita divergencias de cálculo entre preview y otorgado real. **Dónde:** `game.ts:83-88`, `index.tsx:300-303` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-100 · `levelFromXp` recalcula `xpCostForLevel` dos veces por iteración
**Qué:** En el `while` evalúa `xpCostForLevel(level)` en la condición y otra vez en el cuerpo (game.ts:49-51). Guardarlo en una variable por iteración. **Dónde:** `game.ts:48-52` · **Impacto:** 1 · **Esfuerzo:** S

### AWD-101 · `levelFromXp` con `xpTotal` enorme puede ser lento en el render
**Qué:** Se llama en cada render del header (index.tsx:189, perfil.tsx:183). Para niveles altos itera mucho. Memoizar por `xp_total`. **Dónde:** `index.tsx:189`, `perfil.tsx:183` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-102 · No hay validación de que `penalty_xp` insertado coincida con el daño real
**Qué:** El penalti inserta `penalty_xp: close.penaltyXp` (engine.ts:85) y resta el mismo valor del total (engine.ts:59). Si en el futuro divergieran (refactor), la redención no cuadraría. Un test de ida y vuelta lo blindaría. **Dónde:** `engine.ts:59,85` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-103 · El evento `level_up` no guarda el nivel previo
**Qué:** Guarda solo `{ level: after }` (engine.ts:160). Guardar `from`/`to` permite crónicas más ricas y depurar saltos. **Dónde:** `engine.ts:160,191` · **Impacto:** 1 · **Esfuerzo:** S

### AWD-104 · No hay tope de longitud en `missedTitles`
**Qué:** `missedTitles` (closing.ts:80) y el `dayResult` los muestran (index.tsx); con muchos días/misiones el alert/panel crece sin límite. Acotar a los primeros N. **Dónde:** `closing.ts:77-81`, `index.tsx:269-276` · **Impacto:** 1 · **Esfuerzo:** S

### AWD-105 · El otorgado no diferencia XP "ganado" de XP "restaurado"
**Qué:** Redimir una penalización suma XP igual que ganar una misión; el informe no puede separar progreso real de recuperación. Marcar el origen. **Dónde:** `engine.ts:145,154-158` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-106 · `evaluateAchievements` no es exhaustivo en el tipado (strings sueltos)
**Qué:** Los códigos son strings literales repetidos (achievements.ts:53-79); un typo no lo detecta el compilador. Derivar un union type de los `code` de `ACHIEVEMENTS` y tiparlos. **Dónde:** `achievements.ts:50-81` · **Impacto:** 2 · **Esfuerzo:** M

### AWD-107 · `ACHIEVEMENTS` mezcla logros con y sin título sin agrupar
**Qué:** Estructura plana; agrupar por familia (misiones/racha/nivel/...) facilita UI por secciones y el balance. **Dónde:** `achievements.ts:11-33` · **Impacto:** 1 · **Esfuerzo:** M

### AWD-108 · No hay logro "secreto" ni sorpresa
**Qué:** Todos los logros son visibles con candado. Un par de secretos (revelados al desbloquear) aumentan el factor descubrimiento. **Dónde:** `achievements.ts:11-33`, `perfil.tsx:282-301` · **Impacto:** 2 · **Esfuerzo:** M

### AWD-109 · El otorgado no registra la fecha local del evento (solo `now()` del server)
**Qué:** Los eventos usan `created_at default now()` (0001:50). Para un usuario que cruza husos/medianoche, la crónica "de hoy" (diario.tsx:90-93) usa límites locales pero el evento lleva hora server. Alinear con `dateKey` local. **Dónde:** `data.ts:87-93`, `diario.tsx:90-93` · **Impacto:** 2 · **Esfuerzo:** M

### AWD-110 · No hay reintento con backoff en ninguna escritura del otorgado
**Qué:** Toda escritura (completion, profile, evento, logro) falla a la primera sin reintento ante un error transitorio de red. Un wrapper con 1-2 reintentos mejoraría la robustez offline-ish. **Dónde:** `engine.ts`, `data.ts:19-22,87-93`, `achievements.ts:97-99` · **Impacto:** 3 · **Esfuerzo:** M

### AWD-111 · `completeQuest` no es cancelable
**Qué:** Si el usuario sale de la pantalla a mitad del otorgado (cámara → insert), no hay AbortController; el `setProfile`/`setToast` posterior puede correr sobre un componente desmontado. **Dónde:** `index.tsx:107-127` · **Impacto:** 2 · **Esfuerzo:** M

### AWD-112 · El `XpToast` se sobreescribe si se completan dos misiones rápidamente
**Qué:** `setToast` (index.tsx:114) pisa el toast anterior; el XP de la primera misión no se llega a ver. Encolar toasts. **Dónde:** `index.tsx:114,330` · **Impacto:** 2 · **Esfuerzo:** M

### AWD-113 · El overlay de nivel se pierde si se sube dos veces seguidas
**Qué:** `setLevelUp(res.newLevel)` (index.tsx:127) pisa el nivel anterior; subir 2 niveles en dos misiones consecutivas muestra solo el último. Encolar. **Dónde:** `index.tsx:127,331` · **Impacto:** 2 · **Esfuerzo:** M

### AWD-114 · No hay agregado "XP de hoy" derivado del otorgado
**Qué:** El informe podría mostrar el XP ganado hoy sumando completions+awards del día; hoy no existe esa vista anclada al otorgado. **Dónde:** `informe.tsx` (consumidor), `engine.ts` · **Impacto:** 2 · **Esfuerzo:** M

### AWD-115 · `unlockAchievements` no agrupa la notificación cuando se conceden varios a la vez
**Qué:** Si un solo evento desbloquea 2 logros (raro pero posible), el `Alert` los lista en una línea con `\n`; un overlay encolado sería mejor (ligado a AWD-039/112). **Dónde:** `achievements.ts:101`, `index.tsx:141` · **Impacto:** 1 · **Esfuerzo:** M

### AWD-116 · No hay constante para el número total de logros
**Qué:** `perfil.tsx:279` usa `ACHIEVEMENTS.length`; si se mostrara en otros sitios convendría un selector único. **Dónde:** `perfil.tsx:279`, `achievements.ts` · **Impacto:** 1 · **Esfuerzo:** S

### AWD-117 · `evaluateAchievements` no permite logros decrecientes/perdibles
**Qué:** Solo concede; correcto para logros permanentes. Documentar que los logros nunca se revocan (incluso si la racha cae tras conseguir `streak_100`). **Dónde:** `achievements.ts:50-81` · **Impacto:** 1 · **Esfuerzo:** S

### AWD-118 · El otorgado no emite métricas para el Oráculo
**Qué:** El Oráculo (IA) podría aconsejar mejor con un resumen del otorgado reciente; exponer un selector de "actividad de XP" reutilizable. **Dónde:** `engine.ts`, `oracle.ts` (consumidor) · **Impacto:** 1 · **Esfuerzo:** M

### AWD-119 · Falta documentación JSDoc en `awardXp`/`completeQuest`
**Qué:** `completeQuest` no documenta el contrato (qué persiste, qué devuelve, qué pasa si falla a mitad). Añadir JSDoc con las garantías (o su ausencia). **Dónde:** `engine.ts:122,173` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-120 · El nombre `freeze_until` se compara con `<` y `<=` en sitios distintos
**Qué:** engine.ts:31 usa `< today` y closing.ts:52 usa `<= freezeUntil`. La semántica (día incluido o no) está repartida; centralizar el predicado `isFrozenOn(date)` evita off-by-one en el otorgado/cierre. **Dónde:** `engine.ts:31,69`, `closing.ts:52` · **Impacto:** 3 · **Esfuerzo:** S

### AWD-121 · No hay test de integración del flujo completar→logro→título equipable
**Qué:** El camino "completar misión 50 → desbloquea quests_50 → título 'El Persistente' → equipable en perfil" no tiene cobertura E2E. **Dónde:** `index.tsx`, `achievements.ts`, `perfil.tsx:129-149` · **Impacto:** 3 · **Esfuerzo:** L

### AWD-122 · El otorgado de stat usa el mismo XP que el total (no hay ponderación)
**Qué:** Cada XP de misión va 1:1 al stat (engine.ts:148). Si en el futuro se quiere que el nivel y los stats crezcan a ritmos distintos, hoy están acoplados. Documentar la relación. **Dónde:** `engine.ts:147-148`, `game.ts:77-79` · **Impacto:** 1 · **Esfuerzo:** S

### AWD-123 · `protection_stones` ganadas no disparan logro ni overlay
**Qué:** `stonesEarned` se registra en evento (engine.ts:92-93) y en `dayResult` (index.tsx:277-279) pero sin overlay temático ni logro. Reforzar el hito. **Dónde:** `engine.ts:92-93`, `index.tsx:277-279` · **Impacto:** 2 · **Esfuerzo:** S

### AWD-124 · No hay manejo de concurrencia entre `processPendingDays` y `awardXp` de otra pantalla
**Qué:** Si el cierre de medianoche (Sistema) y un otorgado de mazmorra ocurren casi a la vez, ambos leen y escriben `xp_total` con snapshots distintos. Ligado al refactor 0004, pero conviene un mutex de cliente mientras tanto. **Dónde:** `engine.ts:22-112,173-194` · **Impacto:** 3 · **Esfuerzo:** M

### AWD-125 · El otorgado no valida el rango de XP antes de enviar (defensa en cliente)
**Qué:** El CHECK `completions_xp_range` (0003:14) protege en BD, pero el cliente podría validar `0 <= xp <= 1000` antes para dar un error claro en vez de un 23514 críptico. **Dónde:** `engine.ts:134-143`, `0003_seguridad.sql:13-14` · **Impacto:** 2 · **Esfuerzo:** S

---

Total: 125 mejoras, 8 bugs.
