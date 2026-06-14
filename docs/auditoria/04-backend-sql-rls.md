# Backend Postgres: esquema, RLS, atomicidad

> Área SQL · auditoría de código NIVL · anclada al código real

Alcance leído: `supabase/migrations/0001_init.sql`, `supabase/migrations/0002_fases.sql`. Contexto cliente verificado: `src/lib/data.ts`, `src/lib/engine.ts`, `src/lib/game.ts`, `src/lib/dungeons.ts`, `src/lib/body.ts`, `src/lib/journal.ts`, `src/lib/achievements.ts`, `src/lib/exporter.ts`, `src/app/dungeon/[id].tsx`, `src/app/informe.tsx`, `src/lib/types.ts`.

El hilo conductor de esta área es uno solo: **toda la economía vive en el cliente** (lee `profiles`, suma en JS, escribe el total con un `UPDATE` sin condiciones) y **el backend acepta sin rechistar cualquier valor** que el cliente le mande. La RLS resuelve "de quién es la fila" pero no "qué valores son legítimos". Eso convierte cada columna de XP, racha, piedras y `xp_awarded` en un campo de confianza total en el cliente. Las propuestas grandes (mover XP a RPC `SECURITY DEFINER` atómicas, columnas con `CHECK`, `GRANT` por columna, vistas para el informe) atacan justo eso.

---

## Bugs y riesgos

### CRIT-SQL-01 · XP/racha/piedras totalmente manipulables y sin atomicidad — `src/lib/data.ts:17-20` + `0001_init.sql:62-65` · severidad alta
**Problema:** `updateProfile` ejecuta `supabase.from('profiles').update(patch).eq('id', userId)` con cualquier `patch` que arme el cliente. La política `"own profile"` (`for all ... using/with check auth.uid()=id`) solo comprueba propiedad de la fila, no qué columnas ni qué valores se escriben. Cualquiera con la `anon key` (que viaja en la app) y su JWT puede hacer `update profiles set xp_total = 999999999, streak_days = 9999, protection_stones = 99` y subir a nivel máximo sin jugar. Además el patrón read-modify-write de `engine.ts` (`completeQuest`/`awardXp`/`processPendingDays` leen `profile.xp_total`, suman en JS y escriben el total) no es atómico: dos completados concurrentes (doble tap, dos dispositivos, reintento de red) leen el mismo `xp_total` y el segundo `UPDATE` pisa al primero → **XP perdido** o, en penalizaciones, restas que se solapan.
**Arreglo:** mover toda mutación de economía a RPC `SECURITY DEFINER` que hagan el delta en el servidor de forma atómica, p.ej. `create function award_quest(p_quest uuid, p_evidence_path text) returns ...` que inserte el completado, recalcule el XP desde `XP_BY_DIFFICULTY` en SQL y haga `update profiles set xp_total = xp_total + v_xp, xp_fue = xp_fue + ...`. Luego **revocar** `update`/`insert` directos sobre las columnas sensibles (ver SQL-001/002) para que el cliente no pueda escribir XP a mano. Mientras tanto, como mínimo, añadir `CHECK (xp_total >= 0)` y triggers de validación (SQL-010).

### CRIT-SQL-02 · `completions.xp_awarded` sin CHECK y escrito por el cliente — `0001_init.sql:34-43` + `src/lib/engine.ts:129-136` · severidad alta
**Problema:** `xp_awarded integer not null` no tiene rango. El cliente lo calcula con `questXp()` y lo inserta directamente; nada impide `insert into completions(... xp_awarded) values (..., 1000000)` ni valores negativos. El informe (`informe.tsx:42` `thisWeek.reduce((a,c)=>a+c.xp_awarded,0)`) y cualquier agregación se basan en este campo, así que un valor inventado contamina estadísticas y, peor, es la "fuente de verdad" del XP supuestamente ganado.
**Arreglo:** `alter table completions add constraint xp_awarded_range check (xp_awarded between 0 and 1000)`. La cifra real máxima por completado es 250×1,25×1,5 ≈ 469 (épica + evidencia + racha máx), así que 1000 es holgado. Y mejor: calcular `xp_awarded` dentro de la RPC `award_quest` (CRIT-SQL-01), no aceptarlo del cliente.

### CRIT-SQL-03 · No hay garantía de que `user_id` de la fila hija coincida con el padre — `0002_fases.sql:25-36,78-85,56-65` · severidad alta
**Problema:** `dungeon_tasks` tiene a la vez `dungeon_id` (FK a `dungeons`) y su propio `user_id`. La RLS solo exige `user_id = auth.uid()`. No existe ninguna restricción de que ese `dungeon_id` pertenezca a una mazmorra cuyo `user_id` sea también el del usuario. Como `createTask` (`dungeons.ts:64-76`) deja que el cliente envíe `dungeon_id`, un usuario podría insertar una tarea con su propio `user_id` apuntando al `dungeon_id` de **otra** persona (si conoce el UUID). Lo mismo en `gym_lifts.session_id` vs `user_id` (`0002_fases.sql:78-85`) y `gym_exercises.gym_day_id` vs `user_id` (`56-65`). Es una fuga de integridad referencial cruzada entre usuarios.
**Arreglo:** endurecer la RLS para validar el padre, p.ej. `with check (auth.uid() = user_id and exists (select 1 from dungeons d where d.id = dungeon_id and d.user_id = auth.uid()))`; o mejor, eliminar la columna `user_id` redundante de las hijas y derivar la propiedad del padre vía la política (`exists` sobre `dungeons`). Para un solo usuario el impacto práctico es bajo, pero es deuda de modelo que invalida el "multiusuario seguro" futuro.

### CRIT-SQL-04 · Buckets de Storage sin límite de tamaño ni de MIME — `0001_init.sql:99-106` · severidad alta
**Problema:** los buckets `evidence` y `avatars` se crean con `public=false` pero sin `file_size_limit` ni `allowed_mime_types`. La política `"own evidence"`/`"own avatars"` solo valida la carpeta (`(storage.foldername(name))[1] = auth.uid()::text`). El cliente sube con `upsert: true` (`data.ts:102,111`) y `contentType: 'image/jpeg'`, pero nada en el servidor lo obliga: un atacante autenticado puede subir ficheros de cualquier tipo y de gigabytes a su carpeta → coste de almacenamiento y posible abuso (alojar binarios arbitrarios). Es la cuota de Supabase del dueño la que paga.
**Arreglo:** `update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'] where id in ('evidence','avatars')`. 5 MB cubre fotos de móvil de sobra.

### CRIT-SQL-05 · `claimLoot` puede reclamar botín varias veces (sin guardia en estado) — `src/app/dungeon/[id].tsx:105-130` + `0002_fases.sql:20` · severidad media
**Problema:** `claimLoot` hace `updateDungeon(... status:'cleared')` y luego `awardXp(... DUNGEON_CLEAR_XP)`. La única guarda es `busy` en memoria; no hay condición en el `UPDATE`. Si la mazmorra ya está `cleared` y por cualquier vía (reentrada, dos pestañas, condición de carrera con `busy`) se vuelve a llamar, se vuelve a otorgar el botín. La columna `status` admite la transición `cleared→cleared` sin coste. El `update` (`dungeons.ts:33`) es incondicional sobre `id`.
**Arreglo:** hacer la transición atómica y condicional en SQL: una RPC `clear_dungeon(p_id)` que haga `update dungeons set status='cleared', cleared_at=now() where id=p_id and user_id=auth.uid() and status='active'` y otorgue el botín **solo si `FOUND`**. Así el segundo intento no afecta filas y no paga. Mientras tanto, en cliente, comprobar `dungeon.status==='active'` antes de `claimLoot` (hoy `toggleTask` sí lo comprueba, `claimLoot` no).

### CRIT-SQL-06 · `gym_sessions` y `journal_entries` con `unique(user_id,date)`: el segundo insert del día revienta sin manejo — `0002_fases.sql:75,114` + `src/lib/body.ts:62-73` · severidad media
**Problema:** `gym_sessions` tiene `unique (user_id, date)` y `createSession` (`body.ts:62-73`) hace un `insert` plano que lanza error si ya hay sesión ese día. `fetchSessionForDate` (`body.ts:57`) existe, pero si la UI llama a `createSession` sin comprobar (o dos veces por doble tap) el insert falla con violación de unicidad y el XP de la sesión queda en un estado ambiguo (la RPC de XP podría haberse ejecutado antes o después). En `journal_entries` el código sí hace upsert manual (`journal.ts:19-41`) leyendo antes, pero esa lectura+escritura tampoco es atómica: dos guardados concurrentes pueden ambos ver "no existe" e intentar dos `insert` → uno falla por `unique(user_id,date)`.
**Arreglo:** usar `insert ... on conflict (user_id, date) do update set ...` en SQL (un único round-trip atómico) tanto para sesiones como para diario, en vez del patrón leer-luego-decidir. Para gym, además, mover el otorgamiento de XP a la misma transacción que crea la sesión.

### CRIT-SQL-07 · `ensureProfile` inserta perfil sin `on conflict`, duplicando el trigger — `src/lib/data.ts:5-15` + `0001_init.sql:90` · severidad media
**Problema:** el trigger `handle_new_user` ya crea el perfil al registrarse con `on conflict (id) do nothing`. Pero `ensureProfile` también hace `insert({id:userId}).select().single()` **sin** `on conflict`. Si el perfil ya existe (lo normal, lo creó el trigger), el `maybeSingle()` previo lo detecta y retorna; pero hay una ventana de carrera entre el `select` y el `insert` (p.ej. primer arranque justo tras el signup, antes de que el trigger termine, o dos pantallas montando a la vez) en la que ambos caminos intentan insertar y el `insert` sin `on conflict` lanza `duplicate key` que `ensureProfile` propaga como throw. Además `ensureProfile` se llama desde `dungeon/[id].tsx:88,116` repetidamente.
**Arreglo:** en cliente, `insert({id:userId}).select().single()` → añadir `.upsert(... { onConflict:'id', ignoreDuplicates:false })` o capturar el código `23505`. A nivel SQL no hace falta cambio, pero conviene documentar que el trigger es la vía canónica y `ensureProfile` solo debe `select`.

### CRIT-SQL-08 · `quests.days_of_week` y `events.type` sin validación de dominio — `0001_init.sql:25,48` · severidad media
**Problema:** `days_of_week integer[] not null default '{1..7}'` no valida que los elementos estén en 1-7 ni que no haya duplicados; `closing.ts`/`questsScheduledOn` asumen ese rango. Un valor como `{0,8,99}` o `{}` (que el cliente sí envía vacío para penalizaciones, `engine.ts:77`) pasa sin control y puede hacer que una misión nunca se programe o se programe raro. `events.type text not null` es texto libre: `insertEvent` (`data.ts:85-91`) y `engine.ts` insertan strings sueltos (`'penalty'`, `'stone_used'`, `'quest_completed'`, `'level_up'`…) sin enum; un typo en el cliente crea un tipo de evento huérfano que el informe nunca contará.
**Arreglo:** `check (days_of_week <@ array[1,2,3,4,5,6,7])` para el rango (acepta vacío para penalizaciones). Para `events.type`, o un `check (type in (...))` con la lista cerrada, o una tabla `event_types` referenciada por FK; como mínimo documentar el enum en SQL para que sea fuente de verdad y no quede solo en `engine.ts`.

### CRIT-SQL-09 · Columnas numéricas de `profiles` sin `CHECK (>= 0)` — `0001_init.sql:8-14` + `0002_fases.sql:6` · severidad media
**Problema:** `xp_total, xp_fue..xp_per, streak_days, protection_stones` son `integer not null default 0` sin cota inferior. `engine.ts` ya hace `Math.max(0, ...)` para `xp_total` (`engine.ts:52`), pero las stats por separado (`completeQuest` patch[col] = profile[col]+xp, `engine.ts:140-142`) no se protegen, y `protection_stones`/`streak_days` se escriben desde `closing.ts` vía el patch sin garantía de no-negativo si la lógica del cliente fallara o se manipulara. El servidor aceptaría un `-5` perfectamente.
**Arreglo:** `alter table profiles add constraint xp_nonneg check (xp_total>=0 and xp_fue>=0 and xp_vit>=0 and xp_int>=0 and xp_agi>=0 and xp_per>=0 and streak_days>=0 and protection_stones>=0 and protection_stones<=3)`. El tope de 3 piedras está en `game.ts:87` (`MAX_STONES`) pero no se refleja en el esquema.

---

## Mejoras

### SQL-001 · RPC atómica `award_quest` (SECURITY DEFINER)
**Qué:** función Postgres que recibe `quest_id` + ruta de evidencia, inserta el completado, calcula el XP en SQL (dificultad×evidencia×racha) y suma a `profiles` en una sola transacción. Sustituye a `completeQuest` cliente. **Dónde:** `src/lib/engine.ts:115-163` → nueva migración. **Impacto:** 5 · **Esfuerzo:** L

### SQL-002 · RPC atómica `award_xp` genérica para mazmorras/gym/diario
**Qué:** equivalente a `awardXp` cliente (`engine.ts:166-187`) pero en servidor, con validación del importe contra una tabla de tarifas, para que el cliente no decida cuánto XP recibe. **Dónde:** `src/lib/engine.ts:166-187`. **Impacto:** 5 · **Esfuerzo:** L

### SQL-003 · RPC `process_pending_days` (cierre del día en servidor)
**Qué:** portar `computeDayClose`/`processPendingDays` a SQL para que penalizaciones, piedras y racha se calculen con la hora del servidor y de forma atómica, no con el reloj del móvil. **Dónde:** `src/lib/engine.ts:22-105`, `src/lib/closing.ts`. **Impacto:** 5 · **Esfuerzo:** L

### SQL-004 · REVOKE de UPDATE en columnas de economía de `profiles`
**Qué:** tras mover XP a RPC, `revoke update (xp_total, xp_fue, xp_vit, xp_int, xp_agi, xp_per, streak_days, protection_stones) on profiles from authenticated`, dejando editable solo `name/avatar_url/equipped_title`. **Dónde:** `0001_init.sql:62-65`. **Impacto:** 5 · **Esfuerzo:** M

### SQL-005 · CHECK de rango en `completions.xp_awarded`
**Qué:** `check (xp_awarded between 0 and 1000)` para cerrar valores inventados/negativos. **Dónde:** `0001_init.sql:39`. **Impacto:** 4 · **Esfuerzo:** S

### SQL-006 · CHECK de no-negatividad y tope de piedras en `profiles`
**Qué:** constraint con `xp_*>=0`, `streak_days>=0`, `protection_stones between 0 and 3`. **Dónde:** `0001_init.sql:8-14`, `0002_fases.sql:6`. **Impacto:** 4 · **Esfuerzo:** S

### SQL-007 · CHECK de dominio en `quests.days_of_week`
**Qué:** `check (days_of_week <@ array[1,2,3,4,5,6,7])`. **Dónde:** `0001_init.sql:25`. **Impacto:** 3 · **Esfuerzo:** S

### SQL-008 · Enum/whitelist para `events.type`
**Qué:** `check (type in ('quest_completed','level_up','penalty','stone_used','stone_earned','streak_lost','freeze_on','freeze_off','dungeon_task','dungeon_cleared','pr','journal',...))` o tabla `event_types`. **Dónde:** `0001_init.sql:48`; tipos usados en `engine.ts:80-89,147-153,182-185`. **Impacto:** 3 · **Esfuerzo:** M

### SQL-009 · Límite de tamaño y MIME en buckets de Storage
**Qué:** `update storage.buckets set file_size_limit=5242880, allowed_mime_types=array['image/jpeg','image/png','image/webp']`. **Dónde:** `0001_init.sql:99-106`. **Impacto:** 4 · **Esfuerzo:** S

### SQL-010 · Trigger de validación de transición de XP en `profiles`
**Qué:** `before update` que rechace saltos de `xp_total` mayores a un umbral por update (p.ej. >2000 de golpe) salvo desde RPC, como red de seguridad anti-trampa mientras exista escritura directa. **Dónde:** `0001_init.sql:62-65`. **Impacto:** 4 · **Esfuerzo:** M

### SQL-011 · RPC `clear_dungeon` con guarda de estado
**Qué:** `update ... where status='active'` + botín solo si `FOUND`, para cerrar CRIT-SQL-05 (doble botín). **Dónde:** `src/app/dungeon/[id].tsx:105-130`, `0002_fases.sql:20`. **Impacto:** 4 · **Esfuerzo:** M

### SQL-012 · `on conflict (user_id,date) do update` en `gym_sessions`
**Qué:** convertir `createSession` en upsert atómico para evitar la violación de unicidad por doble tap. **Dónde:** `src/lib/body.ts:62-73`, `0002_fases.sql:75`. **Impacto:** 3 · **Esfuerzo:** S

### SQL-013 · `on conflict (user_id,date) do update` en `journal_entries`
**Qué:** sustituir el patrón leer-luego-insertar de `upsertEntry` por un upsert SQL atómico. **Dónde:** `src/lib/journal.ts:19-41`, `0002_fases.sql:114`. **Impacto:** 3 · **Esfuerzo:** S

### SQL-014 · `ensureProfile` con upsert idempotente
**Qué:** añadir `on conflict (id) do nothing` (o `.upsert`) al insert de perfil para cerrar la carrera con el trigger. **Dónde:** `src/lib/data.ts:8-14`. **Impacto:** 3 · **Esfuerzo:** S

### SQL-015 · Validar `user_id` de hija contra padre en RLS de `dungeon_tasks`
**Qué:** `with check (... and exists (select 1 from dungeons d where d.id=dungeon_id and d.user_id=auth.uid()))`. **Dónde:** `0002_fases.sql:149-150`. **Impacto:** 3 · **Esfuerzo:** M

### SQL-016 · Validar `user_id` de hija contra padre en RLS de `gym_lifts`
**Qué:** `exists (select 1 from gym_sessions s where s.id=session_id and s.user_id=auth.uid())`. **Dónde:** `0002_fases.sql:159-160`. **Impacto:** 3 · **Esfuerzo:** M

### SQL-017 · Validar `user_id` de hija contra padre en RLS de `gym_exercises`
**Qué:** `exists (select 1 from gym_days g where g.id=gym_day_id and g.user_id=auth.uid())`. **Dónde:** `0002_fases.sql:155-156`. **Impacto:** 2 · **Esfuerzo:** M

### SQL-018 · Índice para `completionStats` (evidencia no nula)
**Qué:** `completionStats` (`data.ts:74-83`) hace `count where evidence_url is not null`; añadir `create index completions_evidence_idx on completions(user_id) where evidence_url is not null`. **Dónde:** `0001_init.sql:54`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-019 · Índice para `fetchMaxLifts`
**Qué:** `fetchMaxLifts` (`body.ts:88-99`) escanea `gym_lifts(exercise_name, weight)` por usuario; `create index gym_lifts_user_exercise_idx on gym_lifts(user_id, exercise_name, weight desc)`. **Dónde:** `0002_fases.sql:130`. **Impacto:** 3 · **Esfuerzo:** S

### SQL-020 · Índice para `fetchShoppingItems`
**Qué:** ordena por `(done, created_at desc)` filtrando por usuario (`body.ts:146-154`); `create index shopping_user_done_idx on shopping_items(user_id, done, created_at desc)`. **Dónde:** `0002_fases.sql:96-103`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-021 · Índice para `fetchDungeons` (orden por status/created)
**Qué:** `fetchDungeons` (`dungeons.ts:4-12`) ordena `status, created_at desc` por usuario; `create index dungeons_user_status_idx on dungeons(user_id, status, created_at desc)`. **Dónde:** `0002_fases.sql:12-23`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-022 · Índice para `countClearedDungeons`
**Qué:** `count where status='cleared'` (`dungeons.ts:91-97`); cubierto por SQL-021 o índice parcial `where status='cleared'`. **Dónde:** `0002_fases.sql:20`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-023 · Índice para `fetchPendingTasksWithDue` global
**Qué:** `dungeon_tasks where done=false and due_date is not null order by due_date` (`dungeons.ts:53-62`); existe `dungeon_tasks_due_idx (user_id,due_date) where not done` (`0002_fases.sql:127`) pero no incluye el filtro `due_date is not null`; refinar a `where not done and due_date is not null`. **Dónde:** `0002_fases.sql:127`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-024 · Índice para `achievements` por usuario
**Qué:** `fetchUnlocked` (`achievements.ts:83-86`) hace `select code` por usuario; solo existe el `unique(user_id,code)` que sirve, pero conviene confirmar que el planner lo usa; documentar. **Dónde:** `0002_fases.sql:117-123`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-025 · Índice `quests(user_id, is_penalty, penalty_date)`
**Qué:** las penalizaciones se insertan como quests (`engine.ts:69-79`) y se filtran por fecha/penalización en el cierre; índice parcial `where is_penalty`. **Dónde:** `0001_init.sql:28-30,53`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-026 · Columna `updated_at` con trigger en tablas mutables
**Qué:** ninguna tabla tiene `updated_at`; añadirlo a `profiles, quests, dungeons, dungeon_tasks, shopping_items, meal_slots, gym_exercises` con trigger `set updated_at = now()` para sincronización/depuración. **Dónde:** todo `0001`/`0002`. **Impacto:** 2 · **Esfuerzo:** M

### SQL-027 · CHECK de coherencia penalización en `quests`
**Qué:** `check (is_penalty = false or (penalty_xp is not null and penalty_xp >= 0 and penalty_date is not null))`: hoy `penalty_xp`/`penalty_date` son nullable libres aunque `questXp` (`game.ts:78`) asume `penalty_xp` presente. **Dónde:** `0001_init.sql:28-30`. **Impacto:** 3 · **Esfuerzo:** S

### SQL-028 · CHECK `mood`/`energy` ya presente — verificar también NOT NULL semántico
**Qué:** `journal_entries` ya valida `mood/energy between 1 and 5` (`0002_fases.sql:111-112`), pero ambos son nullable y `text` también; documentar que una entrada "vacía" (todo null) es legal y decidir si debe rechazarse con `check (mood is not null or energy is not null or text is not null)`. **Dónde:** `0002_fases.sql:106-115`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-029 · CHECK de longitud en campos de texto libres
**Qué:** `title`, `description`, `notes`, `text`, `name` no tienen límite; añadir `check (char_length(title) <= 200)` etc. para evitar payloads enormes vía API directa. **Dónde:** `quests.title 0001:22`, `dungeons.title/description 0002:15-17`, `calendar_events.notes 0002:44`, `journal_entries.text 0002:112`. **Impacto:** 2 · **Esfuerzo:** M

### SQL-030 · Vista materializada `weekly_report_mv` para el informe
**Qué:** `informe.tsx` baja 91 días de completados y agrega en JS (`informe.tsx:21-69`); precalcular XP semanal, por stat, evidencia y mejor día en una MV refrescada al cerrar el día. **Dónde:** `src/app/informe.tsx:21-94`, `src/lib/data.ts:59-66`. **Impacto:** 4 · **Esfuerzo:** L

### SQL-031 · Vista `daily_xp` para el heatmap
**Qué:** el mapa de actividad cuenta completados por día en cliente (`informe.tsx:57-60`); una vista `select user_id, date, count(*) from completions group by 1,2` evita traer todas las filas. **Dónde:** `src/app/informe.tsx:57-60`. **Impacto:** 3 · **Esfuerzo:** M

### SQL-032 · Función `current_level(xp)` en SQL
**Qué:** portar `levelFromXp`/`xpCostForLevel` (`game.ts:42-54`) a una función SQL inmutable, para que niveles y `rankForLevel` se puedan calcular en RPC y vistas sin depender del cliente. **Dónde:** `src/lib/game.ts:42-65`. **Impacto:** 3 · **Esfuerzo:** M

### SQL-033 · Tabla de tarifas `xp_rates` como fuente de verdad
**Qué:** mover `XP_BY_DIFFICULTY`, `DUNGEON_CLEAR_XP`, `GYM_SESSION_XP`, `PR_XP`, `JOURNAL_XP` (`game.ts:3-9,93-100,108-110`) a una tabla de configuración leída por las RPC, para no duplicar constantes entre cliente y servidor. **Dónde:** `src/lib/game.ts`. **Impacto:** 3 · **Esfuerzo:** M

### SQL-034 · `gym_lifts.weight`/`reps` con CHECK no-negativo
**Qué:** `weight numeric not null default 0`, `reps integer not null default 0` (`0002_fases.sql:83-84`) sin cota; `check (weight>=0 and reps>=0)`. **Dónde:** `0002_fases.sql:83-84`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-035 · `gym_exercises.sets`/`reps` con CHECK positivo
**Qué:** `sets integer default 3`, `reps integer default 10` (`0002_fases.sql:61-62`) sin validación; `check (sets>0 and reps>0 and sets<=20 and reps<=100)`. **Dónde:** `0002_fases.sql:61-62`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-036 · `gym_sessions.xp_awarded` con CHECK de rango
**Qué:** `xp_awarded integer default 0` (`0002_fases.sql:72`) escrito por el cliente (`body.ts:65`); `check (xp_awarded between 0 and 500)`. **Dónde:** `0002_fases.sql:72`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-037 · Política de Storage más estricta con `owner`
**Qué:** las políticas de Storage solo comprueban la carpeta; añadir también `owner = auth.uid()` para impedir que otro usuario sobrescriba un objeto en una carpeta cuyo nombre coincida con su uid si la convención cambiara. **Dónde:** `0001_init.sql:109-117`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-038 · Restringir operaciones de Storage por verbo
**Qué:** hoy ambas políticas son `for all`; separar `select/insert/update/delete` para, p.ej., prohibir `delete` de evidencias antiguas (integridad del histórico). **Dónde:** `0001_init.sql:109-117`. **Impacto:** 2 · **Esfuerzo:** M

### SQL-039 · `avatars` privado pero servido por signed URL — documentar TTL
**Qué:** `signedUrl` firma 7 días (`data.ts:117`); con bucket privado el avatar caduca. Decidir: o bucket `avatars` público (es un avatar, no dato sensible) o refresco de la URL. Hoy el esquema lo crea privado (`0001_init.sql:104`). **Dónde:** `0001_init.sql:104`, `src/lib/data.ts:116-119`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-040 · Política RLS por verbo en tablas core (principio de mínimo)
**Qué:** todas las políticas son `for all`. Separar al menos `delete` para tablas de histórico (`completions`, `events`) que no deberían poder borrarse desde el cliente (hoy `data.ts` no borra completions, pero la API lo permite). **Dónde:** `0001_init.sql:67-80`. **Impacto:** 3 · **Esfuerzo:** M

### SQL-041 · Bloquear UPDATE de `completions` desde el cliente
**Qué:** un completado no debería editarse tras crearse (su `xp_awarded` es histórico). Política que permita `insert/select` pero no `update` para `authenticated`. **Dónde:** `0001_init.sql:72-75`. **Impacto:** 3 · **Esfuerzo:** S

### SQL-042 · `events` solo-append (sin update/delete)
**Qué:** el log de eventos (`events`) es un diario inmutable; restringir a `insert/select`. **Dónde:** `0001_init.sql:77-80`. **Impacto:** 3 · **Esfuerzo:** S

### SQL-043 · FK explícita de `completions.quest_id` con `on delete` revisado
**Qué:** `completions.quest_id ... on delete cascade` (`0001_init.sql:37`): al borrar una misión (`deleteQuest`, `data.ts:54-57`) se borran sus completados → **se pierde el histórico de XP** ya ganado y el informe cambia retroactivamente. Considerar `on delete set null` + columna desnormalizada de título, o impedir borrado de misiones con completados (`on delete restrict`) y usar `active=false`. **Dónde:** `0001_init.sql:37`. **Impacto:** 4 · **Esfuerzo:** M

### SQL-044 · `quests` borrado físico vs lógico
**Qué:** `deleteQuest` borra físico (`data.ts:54`) y arrastra completados (SQL-043). Hay ya `active boolean` (`0001_init.sql:27`); preferir desactivar y reservar el borrado para misiones sin histórico. **Dónde:** `src/lib/data.ts:54-57`, `0001_init.sql:27`. **Impacto:** 3 · **Esfuerzo:** S

### SQL-045 · `dungeons` cleared inmutable
**Qué:** una mazmorra `cleared` no debería volver a `active` (eso permitiría re-reclamar botín, ver CRIT-SQL-05). Trigger/CHECK que prohíba la transición `cleared→active`. **Dónde:** `0002_fases.sql:20`, `src/lib/dungeons.ts:33`. **Impacto:** 3 · **Esfuerzo:** M

### SQL-046 · `dungeon_tasks.position` único por mazmorra
**Qué:** `position integer default 0` (`0002_fases.sql:35`) sin unicidad; dos tareas pueden compartir posición y el orden se vuelve indeterminado en `fetchTasks` (`dungeons.ts:43-51`). `unique (dungeon_id, position)` o índice. **Dónde:** `0002_fases.sql:35`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-047 · `gym_exercises.position` único por día
**Qué:** mismo problema que SQL-046 en `gym_exercises(gym_day_id, position)` (`0002_fases.sql:64`); orden inestable en `fetchGymExercises`. **Dónde:** `0002_fases.sql:64`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-048 · `meal_slots` unicidad por (día, slot)
**Qué:** `upsertMealSlot` (`body.ts:118-138`) decide insert/update por `id`, pero el modelo permite dos `desayuno` el mismo día (`0002_fases.sql:87-94`); `unique (user_id, day_of_week, slot)` para garantizar un único plato por franja. **Dónde:** `0002_fases.sql:87-94`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-049 · `gym_days` unicidad por día de la semana
**Qué:** `createGymDay` (`body.ts:14-22`) no impide dos rutinas el mismo `day_of_week`; `unique (user_id, day_of_week)` si el diseño es una rutina por día. **Dónde:** `0002_fases.sql:49-54`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-050 · `calendar_events.time` como `time`/`timestamptz`, no `text`
**Qué:** `time text` (`0002_fases.sql:43`) almacena la hora como texto libre; sin validación de formato, el orden y el filtrado por hora son frágiles. Usar `time` o componer `timestamptz`. **Dónde:** `0002_fases.sql:43`. **Impacto:** 2 · **Esfuerzo:** M

### SQL-051 · `shopping_items.qty` tipado
**Qué:** `qty text` (`0002_fases.sql:99`) libre; aceptable para "2 kg", pero documentar o separar cantidad/unidad si se quiere sumar. **Dónde:** `0002_fases.sql:99`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-052 · Defaults de timestamp consistentes (`now()` vs cliente)
**Qué:** `done_at`/`cleared_at` los pone el cliente con `new Date().toISOString()` (`dungeons.ts:81`, `dungeon/[id].tsx:109`) en vez de `now()` del servidor; reloj del móvil no fiable. Mover a RPC con `now()`. **Dónde:** `src/lib/dungeons.ts:78-84`, `0002_fases.sql:33,22`. **Impacto:** 3 · **Esfuerzo:** M

### SQL-053 · `completions.completed_at` usar `now()` servidor en RPC
**Qué:** hoy `default now()` está bien, pero `date` lo aporta el cliente (`engine.ts:120` `dateKey()`), que es la fecha local del móvil; un usuario en otra zona o con reloj cambiado podría registrar completados en fechas pasadas/futuras y burlar el cierre. Validar `date` contra `now()::date` en la RPC. **Dónde:** `0001_init.sql:38`, `src/lib/engine.ts:120-135`. **Impacto:** 4 · **Esfuerzo:** M

### SQL-054 · Constraint anti-fecha-futura en `completions.date`
**Qué:** `check (date <= current_date)` para impedir completar misiones "del futuro". **Dónde:** `0001_init.sql:38`. **Impacto:** 3 · **Esfuerzo:** S

### SQL-055 · `journal_entries.date`/`gym_sessions.date` no futuras
**Qué:** mismo `check (date <= current_date)` en diario y sesiones. **Dónde:** `0002_fases.sql:109,70`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-056 · Índice en `events(user_id, type, created_at)` para informes por tipo
**Qué:** si se agregan métricas por tipo de evento (level_up, penalty), el índice actual es `(user_id, created_at desc)` (`0001_init.sql:55`); añadir `type` mejora filtros por tipo. **Dónde:** `0001_init.sql:55`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-057 · `profiles.name` con CHECK de longitud/no-vacío
**Qué:** `name text not null default 'Cazador'` (`0001_init.sql:6`) editable por el cliente sin límite; `check (char_length(name) between 1 and 40)`. **Dónde:** `0001_init.sql:6`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-058 · `equipped_title` validado contra logros desbloqueados
**Qué:** `equipped_title text` (`0002_fases.sql:9`) es libre; el cliente puede equipar cualquier título sin tenerlo. Validar en RPC contra `achievements` del usuario (los títulos viven en `achievements.ts:14-32`). **Dónde:** `0002_fases.sql:9`, `src/lib/achievements.ts`. **Impacto:** 3 · **Esfuerzo:** M

### SQL-059 · `freeze_until` no en el pasado al activarse
**Qué:** `setFreeze` (`engine.ts:190-198`) escribe `freeze_until` libre; `check (freeze_until is null or freeze_until >= current_date)` evita congelaciones "ya caducadas". **Dónde:** `0002_fases.sql:7`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-060 · `freeze_reason` solo si `freeze_until` no es null
**Qué:** `check ((freeze_until is null) = (freeze_reason is null))` para coherencia (hoy `engine.ts:62-65` los limpia juntos, pero el esquema no lo obliga). **Dónde:** `0002_fases.sql:7-8`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-061 · RPC `unlock_achievements` atómica
**Qué:** `unlockAchievements` (`achievements.ts:89-102`) hace `fetchUnlocked` + `insert` no atómico; dos evaluaciones concurrentes pueden chocar con `unique(user_id,code)`. Un `insert ... on conflict do nothing returning code` lo resuelve en un round-trip. **Dónde:** `src/lib/achievements.ts:89-102`, `0002_fases.sql:117-123`. **Impacto:** 3 · **Esfuerzo:** S

### SQL-062 · `achievements.code` validado contra whitelist
**Qué:** `code text` (`0002_fases.sql:120`) libre; un cliente podría insertar `code='fake'`. `check (code in (...))` o FK a tabla `achievement_defs` (lista en `achievements.ts:11-33`). **Dónde:** `0002_fases.sql:120`. **Impacto:** 2 · **Esfuerzo:** M

### SQL-063 · Tabla `achievement_defs` como catálogo en servidor
**Qué:** mover los 21 logros (`achievements.ts:11-33`) a una tabla de catálogo para validar `code`/`title` server-side y desacoplar de la app. **Dónde:** `src/lib/achievements.ts:11-33`. **Impacto:** 2 · **Esfuerzo:** M

### SQL-064 · Constraint de unicidad en `completions` ya existe — añadir índice de cobertura
**Qué:** `unique (user_id, quest_id, date)` (`0001_init.sql:42`) ya evita doble completado del mismo día (bien). Añadir índice de cobertura `(user_id, date) include (xp_awarded, quest_id, evidence_url)` para acelerar el informe sin tocar la tabla. **Dónde:** `0001_init.sql:42,54`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-065 · `events.payload` con validación de esquema mínimo
**Qué:** `payload jsonb default '{}'` (`0001_init.sql:49`) sin forma; documentar/validar las claves esperadas por tipo (p.ej. `xp` numérico) con un `check (jsonb_typeof(payload->'xp') in ('number','null'))` donde aplique. **Dónde:** `0001_init.sql:49`. **Impacto:** 1 · **Esfuerzo:** M

### SQL-066 · Migración de bootstrap de RLS: `force row level security`
**Qué:** las tablas tienen `enable row level security` pero no `force`; el dueño de la tabla (rol `postgres`/service) puede saltarse RLS. Para defensa en profundidad en tablas de economía, `alter table profiles force row level security`. **Dónde:** `0001_init.sql:57-60`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-067 · `search_path` fijado en todas las funciones nuevas
**Qué:** `handle_new_user` ya hace `set search_path = public` (`0001_init.sql:87`); replicar en todas las RPC `SECURITY DEFINER` futuras para evitar secuestro de search_path. **Dónde:** patrón a heredar de `0001_init.sql:83-93`. **Impacto:** 3 · **Esfuerzo:** S

### SQL-068 · `revoke execute` por defecto y `grant` explícito en RPC
**Qué:** al crear RPC, `revoke execute on function ... from public` y `grant execute ... to authenticated`, para que solo usuarios logueados las invoquen. **Dónde:** nuevas migraciones de RPC. **Impacto:** 3 · **Esfuerzo:** S

### SQL-069 · Índice en `meal_slots(user_id, day_of_week, slot)`
**Qué:** `fetchMealSlots` ordena por día (`body.ts:109-116`); el índice actual `(user_id, day_of_week)` (`0002_fases.sql:131`) sirve, pero con SQL-048 (`unique` por slot) se cubre mejor. Documentar. **Dónde:** `0002_fases.sql:131`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-070 · `dungeon_tasks` índice para `fetchTasks` por (dungeon_id, position) ya existe — validar
**Qué:** `dungeon_tasks_dungeon_idx (dungeon_id, position)` (`0002_fases.sql:126`) cubre `fetchTasks`; confirmar que `done`/filtros no requieren índice extra. **Dónde:** `0002_fases.sql:126`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-071 · Particionar o limitar `events` (crecimiento sin techo)
**Qué:** `events` crece en cada acción (`insertEvent` se llama por completado, level_up, etc.) sin retención; en uso prolongado el informe y el export (`exporter.ts:32` `select *`) se ralentizan. Política de retención o resumen mensual. **Dónde:** `0001_init.sql:45-51`, `src/lib/exporter.ts:31-35`. **Impacto:** 2 · **Esfuerzo:** L

### SQL-072 · `exportAllData` con RPC paginada server-side
**Qué:** `exportAllData` (`exporter.ts:25-46`) hace `select *` de 15 tablas sin paginar; una RPC que devuelva el dump (o paginación) evita OOM en datasets grandes. **Dónde:** `src/lib/exporter.ts:25-46`. **Impacto:** 2 · **Esfuerzo:** M

### SQL-073 · `gym_sessions.gym_day_id on delete set null` ya correcto — propagar patrón
**Qué:** `gym_sessions.gym_day_id ... on delete set null` (`0002_fases.sql:71`) preserva la sesión si se borra la rutina (bien). Revisar que el resto de FK opcionales usen el mismo criterio. **Dónde:** `0002_fases.sql:71`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-074 · `profiles.last_day_processed` validado (no futuro)
**Qué:** lo escribe el cliente desde `dateKey()` (`engine.ts:31,66`); `check (last_day_processed <= current_date)` impide adelantar el cierre y saltarse penalizaciones. **Dónde:** `0001_init.sql:15`, `src/lib/engine.ts:29-66`. **Impacto:** 4 · **Esfuerzo:** S

### SQL-075 · Trigger que crea misión de penalización en servidor
**Qué:** hoy la penalización se materializa como `quests.insert` desde el cliente (`engine.ts:69-79`) con `penalty_xp` que el cliente decide; debería emitirla la RPC de cierre (SQL-003) con el XP calculado en SQL. **Dónde:** `src/lib/engine.ts:68-81`. **Impacto:** 4 · **Esfuerzo:** M

### SQL-076 · `penalty_xp` acotado por el tope diario en servidor
**Qué:** `DAILY_PENALTY_CAP=150` vive en `game.ts:86`; el `check` o la RPC deben imponer `penalty_xp <= 150` para que el tope no dependa del cliente. **Dónde:** `0001_init.sql:30`, `src/lib/game.ts:86`. **Impacto:** 3 · **Esfuerzo:** S

### SQL-077 · Índice GIN en `quests.days_of_week` si se filtra por día
**Qué:** si el cierre o la UI filtran misiones por día concreto del array, `create index ... using gin (days_of_week)`; hoy se traen todas y se filtra en JS (`closing.ts`). Evaluar según patrón real. **Dónde:** `0001_init.sql:25`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-078 · `completions.evidence_url` coherente con bucket
**Qué:** `evidence_url` guarda la ruta `{userId}/...jpg` (`data.ts:99`); `check (evidence_url is null or evidence_url like auth.uid()::text || '/%')` (en RPC) garantiza que la ruta pertenece al usuario y no apunta a la carpeta de otro. **Dónde:** `0001_init.sql:41`, `src/lib/data.ts:93-105`. **Impacto:** 3 · **Esfuerzo:** M

### SQL-079 · `avatar_url` coherente con bucket (misma idea)
**Qué:** igual que SQL-078 para `profiles.avatar_url` (`data.ts:107-114`). **Dónde:** `0001_init.sql:7`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-080 · Nombrar las constraints (no anónimas) para migraciones futuras
**Qué:** los `check` inline (`stat in (...)`, `difficulty in (...)`) se crean con nombres autogenerados; nombrarlos (`constraint quests_stat_chk`) facilita `alter`/`drop` en migraciones posteriores. **Dónde:** `0001_init.sql:23-24`, `0002_fases.sql` varios. **Impacto:** 1 · **Esfuerzo:** S

### SQL-081 · Consolidar políticas repetidas con función `is_owner()`
**Qué:** 15+ políticas repiten `auth.uid() = user_id`; una función `is_owner(user_id uuid)` o un patrón común reduce duplicación y errores al editar. **Dónde:** `0001_init.sql:62-80`, `0002_fases.sql:147-168`. **Impacto:** 2 · **Esfuerzo:** M

### SQL-082 · Revisar `default auth.uid()` en columnas `user_id`
**Qué:** muchas tablas usan `user_id ... default auth.uid()` (p.ej. `0001_init.sql:21`); está bien, pero el cliente igualmente envía `user_id` explícito en casi todos los inserts (`data.ts:40`, `dungeons.ts:27`…), haciendo el default redundante e inconsistente. Decidir: confiar en el default y dejar de enviar `user_id` desde el cliente (menos superficie de manipulación). **Dónde:** `0001_init.sql:21,36,47`, varios en `0002`. **Impacto:** 2 · **Esfuerzo:** M

### SQL-083 · Bloquear que el cliente fije `user_id` distinto del propio
**Qué:** aunque `with check (auth.uid()=user_id)` lo impide a nivel fila, conviene un test/migración que verifique que ninguna política permite `insert` con `user_id` ajeno; defensa explícita y documentada. **Dónde:** `0001_init.sql:67-80`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-084 · Migración idempotente (guards `if not exists`)
**Qué:** `0001`/`0002` usan `create table`/`create policy` sin `if not exists`; re-ejecutar la migración (algo que el usuario hace a mano en el SQL Editor) falla a mitad. Añadir `create table if not exists`, `drop policy if exists` antes de `create policy`. **Dónde:** todo `0001`/`0002`. **Impacto:** 3 · **Esfuerzo:** M

### SQL-085 · Transaccionar la migración (`begin/commit`)
**Qué:** envolver cada migración en una transacción para que un fallo a mitad no deje el esquema parcialmente aplicado (riesgo real al pegar a mano en el SQL Editor). **Dónde:** `0001_init.sql:1`, `0002_fases.sql:1`. **Impacto:** 3 · **Esfuerzo:** S

### SQL-086 · Tabla `schema_migrations` para versionado
**Qué:** no hay registro de qué migración se aplicó; una tabla de control evita reaplicar o saltarse archivos (el flujo es manual). **Dónde:** `supabase/migrations/`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-087 · `created_at` indexado donde se ordena por él
**Qué:** `fetchQuests` ordena por `created_at` (`data.ts:24-28`) sin índice dedicado; el `quests_user_active_idx` no lo incluye. Si crecen las misiones, índice `(user_id, created_at)`. **Dónde:** `0001_init.sql:53`, `src/lib/data.ts:22-29`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-088 · `journal_entries` índice ya `(user_id, date desc)` — cubre `fetchRecentEntries`
**Qué:** `journal_date_idx (user_id, date desc)` (`0002_fases.sql:132`) cubre `fetchRecentEntries` (`journal.ts:9-17`); confirmar y documentar como correcto. **Dónde:** `0002_fases.sql:132`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-089 · Vista `profile_with_level` para evitar cálculo en cliente
**Qué:** exponer una vista que añada `level`, `rank`, `into`, `next` calculados con la función SQL (SQL-032) sobre `profiles`, para que la UI no recalcule en cada render. **Dónde:** `src/lib/game.ts:46-65`. **Impacto:** 2 · **Esfuerzo:** M

### SQL-090 · `gym_lifts` retención/agregado para PRs
**Qué:** `fetchMaxLifts` (`body.ts:88-99`) trae todos los lifts para sacar máximos; una tabla/vista `exercise_prs(user_id, exercise_name, max_weight)` mantenida por trigger evita el full scan. **Dónde:** `src/lib/body.ts:88-99`, `0002_fases.sql:78-85`. **Impacto:** 3 · **Esfuerzo:** M

### SQL-091 · `calendar_events` rango de fecha indexado ya correcto
**Qué:** `calendar_events_date_idx (user_id, date)` (`0002_fases.sql:128`) cubre `fetchCalendarEvents` (`dungeons.ts:100-109`); documentar como ok. **Dónde:** `0002_fases.sql:128`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-092 · `events` payload tamaño máximo
**Qué:** `payload jsonb` sin tope; `check (pg_column_size(payload) < 4096)` evita payloads inflados desde la API. **Dónde:** `0001_init.sql:49`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-093 · RPC `complete_gym_session` atómica (sesión + lifts + XP)
**Qué:** hoy son 3 llamadas separadas (`createSession`, `insertLifts`, `awardXp`) no atómicas (`body.ts:62-85` + `engine.ts:166`); una RPC única evita estados a medias (sesión sin lifts, XP sin sesión). **Dónde:** `src/lib/body.ts:62-85`. **Impacto:** 3 · **Esfuerzo:** M

### SQL-094 · RPC `claim_dungeon_task` atómica (done + XP + logros)
**Qué:** `toggleTask` (`dungeon/[id].tsx:82-103`) hace `setTaskDone` + `awardXp` por separado; si el segundo falla, la tarea queda marcada sin XP. Unificar en RPC. **Dónde:** `src/app/dungeon/[id].tsx:82-103`. **Impacto:** 3 · **Esfuerzo:** M

### SQL-095 · Idempotencia de XP por tarea de mazmorra
**Qué:** `toggleTask` sólo otorga XP si `!task.done` en cliente; en servidor, la RPC (SQL-094) debe usar `update dungeon_tasks set done=true where id=? and done=false` y otorgar XP solo si `FOUND`, para evitar doble cobro por carrera. **Dónde:** `src/app/dungeon/[id].tsx:82-87`. **Impacto:** 3 · **Esfuerzo:** S

### SQL-096 · `dungeons.deadline`/`calendar_events.date` no obligan futuro pero documentar
**Qué:** `deadline date` libre; aceptable (puedes registrar uno pasado), pero documentar la intención para no añadir `check` erróneo. **Dónde:** `0002_fases.sql:19`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-097 · `meal_slots.description` not null pero sin longitud
**Qué:** `description text not null` (`0002_fases.sql:93`) sin tope; `check (char_length(description) <= 300)`. **Dónde:** `0002_fases.sql:93`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-098 · `shopping_items.name` not null sin longitud
**Qué:** `name text not null` (`0002_fases.sql:99`); `check (char_length(name) between 1 and 120)`. **Dónde:** `0002_fases.sql:99`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-099 · Índice de cobertura para `seedDefaultQuests`/`completionStats` count
**Qué:** los `count(* head:true)` (`data.ts:74-82,130`) hacen conteo exacto; con datos grandes, un índice o `count` aproximado vía `pg_class` reduce coste. **Dónde:** `src/lib/data.ts:74-82,129-131`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-100 · `profiles` fila garantizada (NOT NULL en relación 1:1)
**Qué:** todo el código asume que existe exactamente una fila de `profiles` por usuario (creada por trigger); reforzar con la dependencia trigger + `ensureProfile` idempotente (SQL-014) y test que verifique la invariante. **Dónde:** `0001_init.sql:83-97`, `src/lib/data.ts:5-15`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-101 · Revisar `on delete cascade` desde `auth.users` (borrado de cuenta)
**Qué:** todas las tablas cascadean al borrar el usuario (`on delete cascade` en `user_id`), pero el Storage no: las evidencias/avatares quedan huérfanas al borrar la cuenta. Trigger `after delete on auth.users` que limpie el bucket, o documentar la limpieza manual. **Dónde:** `0001_init.sql:5,21,36,47`, buckets `0001_init.sql:99-106`. **Impacto:** 2 · **Esfuerzo:** M

### SQL-102 · Tests SQL (pgTAP) para RLS y constraints
**Qué:** no hay pruebas de backend; añadir pgTAP que verifiquen que un usuario no puede leer/escribir filas de otro, que los `check` rechazan valores fuera de rango y que las RPC son atómicas. **Dónde:** `supabase/` (nuevo `tests/`). **Impacto:** 3 · **Esfuerzo:** L

### SQL-103 · Seed/fixtures reproducibles para entorno de desarrollo
**Qué:** no hay `seed.sql`; crear datos de ejemplo (un usuario, misiones, completados) para probar el esquema y las vistas del informe sin la app. **Dónde:** `supabase/`. **Impacto:** 1 · **Esfuerzo:** M

### SQL-104 · `gym_lifts.exercise_name` desnormalizado — FK opcional a ejercicio
**Qué:** `exercise_name text` (`0002_fases.sql:82`) se compara por string con `gym_exercises.name` en `fetchMaxLifts`; un cambio de nombre rompe el histórico de PRs. Considerar `exercise_id` opcional. **Dónde:** `0002_fases.sql:82`, `src/lib/body.ts:88-99`. **Impacto:** 2 · **Esfuerzo:** M

### SQL-105 · `completions` retención de evidencias vs `xp_awarded`
**Qué:** si se borra el objeto de evidencia en Storage pero queda `evidence_url`, el informe cuenta evidencia inexistente; trigger o validación al servir. **Dónde:** `0001_init.sql:41`, `src/lib/data.ts:116-119`. **Impacto:** 1 · **Esfuerzo:** M

### SQL-106 · `events` índice parcial por tipos "caros" del informe
**Qué:** si el informe agrega `level_up`/`penalty`, un índice parcial `where type in ('level_up','penalty')` acelera sin inflar. **Dónde:** `0001_init.sql:55`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-107 · Comentarios `comment on` en tablas/columnas clave
**Qué:** documentar en el propio esquema el significado de `xp_*`, `protection_stones`, `freeze_until`, `is_penalty`, etc., con `comment on column ...`, para que el backend sea autoexplicativo. **Dónde:** `0001_init.sql`, `0002_fases.sql`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-108 · `numeric` con precisión definida en `gym_*.weight`
**Qué:** `weight numeric` sin escala (`0002_fases.sql:63,83`); `numeric(6,2)` evita pesos con decimales absurdos y normaliza el almacenamiento. **Dónde:** `0002_fases.sql:63,83`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-109 · Política de Storage de `select` con expiración de listado
**Qué:** revisar que `list` de objetos no exponga metadatos de otros (la política `for all` cubre `select`, pero conviene un test). **Dónde:** `0001_init.sql:109-117`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-110 · `profiles.created_at` inmutable
**Qué:** `created_at` editable vía `update` (la política es `for all`); trigger que ignore cambios en `created_at`. **Dónde:** `0001_init.sql:16`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-111 · Constraint de coherencia `dungeons.cleared_at` vs `status`
**Qué:** `check ((status='cleared') = (cleared_at is not null))` para que no haya despejadas sin fecha ni fechas sin despejar. **Dónde:** `0002_fases.sql:20,22`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-112 · Constraint `dungeon_tasks.done` vs `done_at`
**Qué:** `check ((done=false and done_at is null) or (done=true and done_at is not null))`; hoy `setTaskDone` (`dungeons.ts:78-84`) los sincroniza pero el esquema no lo obliga. **Dónde:** `0002_fases.sql:32-33`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-113 · Índice único parcial para una sola penalización por fecha
**Qué:** el cierre puede generar una misión de penalización por día (`engine.ts:69-79`); `unique index where is_penalty and penalty_date is not null` evita duplicar penalizaciones si el cierre se ejecuta dos veces. **Dónde:** `0001_init.sql:28-30`, `src/lib/engine.ts:68-81`. **Impacto:** 3 · **Esfuerzo:** S

### SQL-114 · Reforzar idempotencia del cierre diario
**Qué:** `processPendingDays` compara `last_day_processed` en cliente (`engine.ts:33`); una RPC con bloqueo (`select ... for update` sobre la fila de perfil) garantiza que dos cierres concurrentes no apliquen la penalización dos veces. **Dónde:** `src/lib/engine.ts:22-66`. **Impacto:** 4 · **Esfuerzo:** M

### SQL-115 · `quests.active` indexado en el patrón real
**Qué:** `quests_user_active_idx (user_id, active)` (`0001_init.sql:53`) existe, pero `fetchQuests` trae todas sin filtrar `active` (`data.ts:22-28`) y filtra en JS; alinear: o filtrar `active=true` en SQL o documentar por qué se traen todas. **Dónde:** `0001_init.sql:53`, `src/lib/data.ts:22-29`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-116 · `calendar_events.title` not null con longitud
**Qué:** `title text not null` (`0002_fases.sql:41`) sin tope; `check (char_length(title) between 1 and 200)`. **Dónde:** `0002_fases.sql:41`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-117 · `dungeons.rank`/`stat` defaults coherentes con UI
**Qué:** defaults `rank 'D'`, `stat 'INT'` (`0002_fases.sql:16,18`); `createDungeon` siempre envía ambos (`dungeons.ts:20-31`), así que los defaults son inalcanzables. Limpiar o confiar en ellos para reducir payload. **Dónde:** `0002_fases.sql:16,18`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-118 · `gym_sessions.notes`/`journal_entries.text` longitud
**Qué:** campos de texto largo sin tope; `check (char_length(...) <= 4000)` para evitar abuso. **Dónde:** `0002_fases.sql:73,112`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-119 · Revisar `head:true` counts bajo RLS (rendimiento)
**Qué:** los `count(* head:true)` (`data.ts:74-82`, `body.ts:101-104`, `journal.ts:43-48`, `dungeons.ts:91-97`) ejecutan bajo RLS con `auth.uid()` por fila; verificar plan y, si hace falta, función `count_*` `STABLE` con índice. **Dónde:** varios `src/lib`. **Impacto:** 2 · **Esfuerzo:** M

### SQL-120 · Auditoría: tabla `xp_ledger` (libro mayor de XP)
**Qué:** hoy el XP total es un único entero mutable sin trazabilidad; un libro mayor inmutable (cada delta con motivo, fecha, fuente) permite recalcular `xp_total` desde cero, detectar inconsistencias y auditar trampas. La RPC de XP escribiría aquí y `xp_total` sería un cache verificable. **Dónde:** modelo nuevo; alimenta `engine.ts` y el informe. **Impacto:** 5 · **Esfuerzo:** L

### SQL-121 · Reconciliación periódica `xp_total` vs ledger/completions
**Qué:** función que recomputa `xp_total` sumando `completions.xp_awarded` + eventos de mazmorra/gym/diario y lo compara con el almacenado, marcando divergencias (señal de manipulación o de bug del read-modify-write). **Dónde:** depende de SQL-120; verifica `engine.ts`. **Impacto:** 4 · **Esfuerzo:** L

### SQL-122 · `protection_stones` ganancia atómica server-side
**Qué:** las piedras se otorgan en el cierre (`closing.ts` → patch) con el tope `MAX_STONES` en cliente (`game.ts:87`); moverlo a la RPC de cierre con `least(protection_stones+earned, 3)` atómico. **Dónde:** `src/lib/engine.ts:56-66`, `src/lib/game.ts:87-88`. **Impacto:** 3 · **Esfuerzo:** M

### SQL-123 · `streak_days` incremento server-side
**Qué:** la racha se recalcula en cliente (`closing.ts`) y se escribe entera; en servidor, derivarla de `completions` evita que se pueda fijar `streak_days=9999` por API. **Dónde:** `src/lib/engine.ts:55-66`. **Impacto:** 4 · **Esfuerzo:** L

### SQL-124 · Rechazar `insert` de `completions` para misión inactiva o ajena
**Qué:** la RPC `award_quest` debe validar `quest.active and quest.user_id=auth.uid()` y que el día esté programado (`days_of_week`); hoy nada impide completar una misión desactivada o que no toca hoy. **Dónde:** `src/lib/engine.ts:115-136`, `0001_init.sql:34-43`. **Impacto:** 3 · **Esfuerzo:** M

### SQL-125 · Bloquear `insert` de completado de misión de penalización dos veces
**Qué:** el `unique(user_id,quest_id,date)` cubre el mismo día, pero una penalización completada otro día podría re-otorgar XP; validar en RPC que la penalización no esté ya redimida. **Dónde:** `0001_init.sql:42`, `src/lib/engine.ts:115-163`. **Impacto:** 2 · **Esfuerzo:** M

### SQL-126 · `events.created_at` indexado por día para `fetchEventsForDate`
**Qué:** `fetchEventsForDate` (`journal.ts:57-66`) filtra `created_at >= dayStart and < dayEnd`; el índice `(user_id, created_at desc)` (`0001_init.sql:55`) sirve, confirmar dirección del orden ascendente del query. **Dónde:** `0001_init.sql:55`, `src/lib/journal.ts:57-66`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-127 · Función `now_local(tz)` para fechas de juego
**Qué:** el "día de juego" depende del huso del usuario; centralizar la conversión de `now()` a la fecha de juego en SQL (con una `timezone` guardada en `profiles`) elimina la dependencia del reloj del móvil en completados y cierre. **Dónde:** `src/lib/dates.ts` (cliente) → servidor; afecta `engine.ts:120`. **Impacto:** 3 · **Esfuerzo:** M

### SQL-128 · Columna `profiles.timezone`
**Qué:** para SQL-053/SQL-127, guardar el huso del usuario y validar `completions.date` contra `now() at time zone profiles.timezone`. **Dónde:** `0001_init.sql:4-17`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-129 · `meal_slots`/`gym_*` borrado en cascada coherente al borrar día
**Qué:** `gym_exercises ... on delete cascade` desde `gym_days` (`0002_fases.sql:58`) está bien; verificar que borrar un `gym_day` no deja `gym_sessions` apuntando a id inexistente (ya `set null`, ok) ni `gym_lifts` huérfanos por nombre. **Dónde:** `0002_fases.sql:58,71`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-130 · Revisar exposición de la `anon` key y políticas por rol `anon`
**Qué:** todas las políticas son `to authenticated`; confirmar que `anon` no tiene `grant` residual sobre estas tablas (Supabase concede `anon` por defecto a `public`). Añadir `revoke all on <tablas> from anon`. **Dónde:** `0001_init.sql:57-80`, `0002_fases.sql:134-168`. **Impacto:** 3 · **Esfuerzo:** S

### SQL-131 · `grant` mínimo explícito a `authenticated`
**Qué:** apoyarse menos en los grants por defecto de Supabase: declarar explícitamente `grant select,insert,update,delete on <tabla> to authenticated` solo donde corresponda (y nada en histórico). **Dónde:** `0001_init.sql`, `0002_fases.sql`. **Impacto:** 2 · **Esfuerzo:** M

### SQL-132 · `dungeon_tasks.due_date` índice ya parcial — alinear con query exacta
**Qué:** `dungeon_tasks_due_idx ... where not done` (`0002_fases.sql:127`) vs query que además exige `due_date is not null` (`dungeons.ts:57`); ajustar el predicado del índice para que sea cubriente (ver SQL-023). **Dónde:** `0002_fases.sql:127`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-133 · `profiles` única por usuario garantizada por PK — documentar 1:1
**Qué:** la PK `id` referencia `auth.users` 1:1 (`0001_init.sql:5`); correcto. Documentar la invariante y cubrir con test (SQL-102). **Dónde:** `0001_init.sql:4-5`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-134 · Migración para `force rls` en histórico (`completions`,`events`)
**Qué:** como en SQL-066 pero específico para tablas inmutables, para que ni siquiera un job con rol elevado las altere por accidente. **Dónde:** `0001_init.sql:57-60`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-135 · `gym_sessions`/`journal_entries` `unique` cubierto por índice — confirmar
**Qué:** los `unique (user_id,date)` (`0002_fases.sql:75,114`) ya crean índice; confirmar que `fetchSessionForDate`/`fetchEntryForDate` (`body.ts:57`, `journal.ts:4`) lo aprovechan. **Dónde:** `0002_fases.sql:75,114`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-136 · Validar `meal_slots.slot` ya tiene CHECK — extender a unicidad (ver SQL-048)
**Qué:** `slot in (...)` ya está (`0002_fases.sql:91`); combinar con `unique(user_id,day_of_week,slot)` cierra el modelo de "un plato por franja". **Dónde:** `0002_fases.sql:91`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-137 · `events.payload` clave `xp` numérica para reconstrucción
**Qué:** la reconciliación (SQL-121) puede apoyarse en `payload->>'xp'`; garantizar que todos los eventos de XP lo incluyen y es numérico (`engine.ts:182` lo añade, pero no hay contrato). **Dónde:** `src/lib/engine.ts:147-153,182-185`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-138 · Índice para export por tabla (orden estable)
**Qué:** `exportAllData` hace `select *` sin orden (`exporter.ts:32`); para dumps reproducibles, ordenar por `id`/`created_at`, apoyado en índices existentes. **Dónde:** `src/lib/exporter.ts:31-35`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-139 · `profiles` trigger anti-edición de columnas de economía (defensa extra)
**Qué:** complementa SQL-004/SQL-010: un `before update` que, si el rol no es la RPC, copie los valores antiguos de `xp_*`, `streak_days`, `protection_stones` (los hace inmutables vía update directo). **Dónde:** `0001_init.sql:62-65`. **Impacto:** 4 · **Esfuerzo:** M

### SQL-140 · `check` de `days_of_week` no vacío para misiones normales
**Qué:** las normales deberían tener al menos un día; `check (is_penalty or array_length(days_of_week,1) >= 1)` (las penalizaciones sí van con `{}`, `engine.ts:77`). **Dónde:** `0001_init.sql:25,28`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-141 · `gym_days.name`/`gym_exercises.name` longitud y no vacío
**Qué:** `name text not null` sin tope (`0002_fases.sql:53,60`); `check (char_length(name) between 1 and 80)`. **Dónde:** `0002_fases.sql:53,60`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-142 · Revisar `on conflict` en `seedDefaultQuests`
**Qué:** `seedDefaultQuests` (`data.ts:129-137`) inserta 5 misiones si `count==0`; entre el `count` y el `insert` hay carrera (dos arranques) que duplicaría las misiones. Un `on conflict`/transacción o un flag `seeded` en `profiles` lo evita. **Dónde:** `src/lib/data.ts:129-137`. **Impacto:** 2 · **Esfuerzo:** S

### SQL-143 · `profiles.seeded_at` para idempotencia de seed
**Qué:** columna que marque que ya se sembraron misiones por defecto, para SQL-142 sin depender del `count`. **Dónde:** `0001_init.sql:4-17`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-144 · Vista `agenda_unificada` (calendar_events + dungeon_tasks due + penalty)
**Qué:** la agenda combina varias fuentes en cliente; una vista que una `calendar_events`, `dungeon_tasks(due_date)` y misiones programadas reduce round-trips. **Dónde:** `src/lib/dungeons.ts:100-109`, `src/lib/dungeons.ts:53-62`. **Impacto:** 2 · **Esfuerzo:** L

### SQL-145 · `completions` incluir índice por `quest_id` para join del informe
**Qué:** `informe.tsx` cruza completados con misiones por `quest_id` (`informe.tsx:49-53`); si se mueve a SQL, un índice `(quest_id)` ayuda al join. **Dónde:** `0001_init.sql:34-43`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-146 · `dungeons.status` índice parcial `active` para listado principal
**Qué:** la pantalla de mazmorras lista activas frecuentemente; índice parcial `where status='active'` además del general (SQL-021). **Dónde:** `0002_fases.sql:20`, `src/app/(tabs)/mazmorras.tsx:44`. **Impacto:** 1 · **Esfuerzo:** S

### SQL-147 · Constraint de unicidad `events` anti-duplicado de level_up
**Qué:** un `level_up` por nivel alcanzado debería emitirse una vez; hoy `awardXp`/`completeQuest` pueden emitir `level_up` repetido si se recalcula (`engine.ts:152,183`). Considerar deduplicar en servidor o unique parcial sobre `payload->>'level'`. **Dónde:** `src/lib/engine.ts:152-154,183-185`. **Impacto:** 2 · **Esfuerzo:** M

### SQL-148 · Revisar tipo de `calendar_events.date` + `time` combinados
**Qué:** separar fecha/hora dificulta ordenar por instante; una columna generada `occurs_at timestamptz` (de `date`+`time`) facilita queries y notificaciones. **Dónde:** `0002_fases.sql:42-43`. **Impacto:** 2 · **Esfuerzo:** M

### SQL-149 · `profiles` `level` cache opcional (denormalizado)
**Qué:** si muchas vistas necesitan el nivel, una columna `level` mantenida por la RPC de XP (junto a SQL-032) evita recalcular; con el riesgo de denormalización controlado por la RPC. **Dónde:** `0001_init.sql:4-17`. **Impacto:** 2 · **Esfuerzo:** M

### SQL-150 · Hardening final: revisar políticas duplicadas/solapadas
**Qué:** auditar que no haya dos políticas permisivas que, combinadas, abran más de lo previsto (Postgres las une con OR); test que enumere `pg_policies` y verifique el conjunto esperado. **Dónde:** `0001_init.sql:62-117`, `0002_fases.sql:147-168`. **Impacto:** 2 · **Esfuerzo:** M

---

Total: 150 mejoras, 9 bugs.
