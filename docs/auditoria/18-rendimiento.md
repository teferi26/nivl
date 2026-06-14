# Rendimiento (transversal)

> Área PRF2 · auditoría de código NIVL · anclada al código real

Alcance leído: `src/app/(tabs)/index.tsx`, `src/app/(tabs)/agenda.tsx`, `src/app/(tabs)/misiones.tsx`, `src/app/gym.tsx`, `src/app/(tabs)/perfil.tsx`, `src/app/informe.tsx`, `src/app/diario.tsx`, `src/app/dieta.tsx`, `src/app/dungeon/[id].tsx`, `src/components/SystemWindow.tsx`, `src/components/QuestItem.tsx`, `src/components/Heatmap.tsx`, `src/components/XPBar.tsx`, y la capa de datos `src/lib/data.ts`, `src/lib/body.ts`, `src/lib/dungeons.ts`, `src/lib/engine.ts`.

Diagnóstico de una frase: **no hay ni un solo `React.memo`, `useMemo`, `FlatList`/`FlashList` ni caché de imagen en todo `src/`** (verificado por grep; lo único memoizado es la función `load` con `useCallback`). Todas las listas son `ScrollView` + `.map`, todo derivado se recalcula en cada render, cada `useFocusEffect` hace un refetch completo, y `SystemWindow` fuerza un doble render por panel. A la escala de un usuario personal nada de esto "rompe", pero es deuda de rendimiento real y barata de saldar; varios puntos sí degradan de forma perceptible cuando el historial crece (informe, heatmap, agenda, fetchMaxLifts).

## Bugs y riesgos

### CRIT-PRF2-01 · `bestDay` es O(n²) y además duplica un cálculo ya hecho — `informe.tsx:59-71` · severidad media
**Problema:** el bloque calcula `byDay` recorriendo `completions` una vez (`59-62`) para el heatmap, pero acto seguido (`63-71`) ignora ese mapa y, para hallar el mejor día de la semana, hace un bucle sobre `thisWeek` y **dentro de cada iteración vuelve a filtrar y reducir `thisWeek` entero** (`thisWeek.filter((x) => x.date === c.date).reduce(...)`). Eso es O(n²) sobre el número de completaciones de la semana, y se reejecuta en **cada render** (no está memoizado) y en **cada `useFocusEffect`**. Con una semana intensa (varias decenas de completaciones) es trabajo inútil en el hilo JS justo durante la animación de entrada de la pantalla.
**Arreglo:** agrupar una sola vez por día y quedarse con el máximo en O(n):
```ts
const xpByDay: Record<string, number> = {};
for (const c of thisWeek) xpByDay[c.date] = (xpByDay[c.date] ?? 0) + c.xp_awarded;
let bestDay: string | null = null, bestDayXp = 0;
for (const [day, xp] of Object.entries(xpByDay)) if (xp > bestDayXp) { bestDayXp = xp; bestDay = day; }
```
Envolver todo el bloque derivado (`thisWeek`, `prevWeek`, `xpByStat`, `narrative`, `byDay`, `bestDay`) en un único `useMemo(() => …, [completions, quests, today])`.

### CRIT-PRF2-02 · `fetchMaxLifts` descarga TODO el historial de series al cliente para sacar un máximo — `body.ts:88-99` (consumido en `gym.tsx:114`) · severidad media
**Problema:** `fetchMaxLifts` hace `select('exercise_name, weight')` **sin filtro ni límite** sobre `gym_lifts` y calcula el máximo por ejercicio en JS. La tabla `gym_lifts` crece una fila por serie y por sesión indefinidamente; tras meses de uso son miles de filas que viajan por red y se reducen en el hilo JS en mitad del flujo de "Terminar sesión" (`finishTraining`, que ya es una cadena de 6+ awaits serie). El coste crece sin techo con el uso.
**Arreglo:** mover el máximo al servidor. Vista o RPC `SECURITY DEFINER` que devuelva `select exercise_name, max(weight) group by exercise_name` para el usuario; o, mínimo, materializar el PR por ejercicio en una columna de `gym_exercises` y actualizarla al insertar. Mientras tanto, al menos acotar (`.limit`) o filtrar por los ejercicios de la sesión actual con `.in('exercise_name', valid.map(v => v.exercise_name))`.

### CRIT-PRF2-03 · `SystemWindow` provoca un doble render por panel en cada montaje/foco — `SystemWindow.tsx:25-46` · severidad baja
**Problema:** el panel mide su tamaño con `onLayout` y lo guarda en `useState`; en el primer render `size` es `null` y **no se dibuja el SVG del borde** (`36`), luego `setSize` dispara un segundo render que ya pinta el polígono. Es el sello visual omnipresente: Sistema renderiza ~5 paneles, perfil ~6, informe 4… así que **cada entrada a pantalla son 2× renders de todo el árbol de paneles** y un primer frame sin bordes (parpadeo). Como cada `useFocusEffect` refetcha y resetea estado, esto se repite en cada cambio de pestaña.
**Arreglo:** dibujar el borde con un `View` de bordes/`borderRadius` + clip en vez de un SVG dependiente de medición, o usar un SVG con `viewBox` + `preserveAspectRatio` a `width/height: '100%'` (el polígono se puede expresar en coordenadas relativas 0–100 y escalar solo con CSS, sin necesitar `size` en estado). Si se mantiene el SVG, al menos `React.memo` del componente y comparar `children` por referencia para no remedir cuando el padre re-renderiza por otros motivos.

### CRIT-PRF2-04 · La imagen de avatar nunca se cachea: URL firmada nueva en cada foco — `perfil.tsx:71-72,101` + `data.ts:118-121` · severidad baja
**Problema:** `expo-image` (`<Image>` en `perfil.tsx:197`) es capaz de cachear en disco, pero el `source.uri` cambia en **cada `useFocusEffect`** porque `signedUrl('avatars', …)` (`data.ts:118`) genera una *signed URL* nueva (token distinto) cada vez. Con URI cambiante, `expo-image` no acierta en su caché y **re-descarga el avatar de Storage al volver a la pestaña Perfil** una y otra vez. Además no se pasa `cachePolicy` ni `recyclingKey`.
**Arreglo:** pasar `cachePolicy="memory-disk"` y un `recyclingKey={profile.avatar_url ?? undefined}` (la ruta del objeto es estable aunque el token cambie) para que `expo-image` reutilice el bitmap cacheado pese al query-string distinto; y/o cachear la signed URL hasta su expiración (se piden 7 días en `data.ts:119`) en estado/AsyncStorage en vez de re-firmar en cada `load`.

Sin más bugs críticos nuevos: el resto son mejoras de rendimiento sin riesgo de corrección.

## Mejoras

### PRF2-001 · Memoizar el bloque derivado de Sistema
**Qué:** `sorted`, `completedCount`, `pendingCount`, `frozen`, `lvl` se recalculan en cada render. **Dónde:** `index.tsx:188-193` · **Impacto:** 2 · **Esfuerzo:** S

### PRF2-002 · `sorted` clona y ordena el array en cada render
**Qué:** `[...todayQuests].sort(...)` crea copia + ordena en cada render aunque `todayQuests` no cambie; envolver en `useMemo([todayQuests])`. **Dónde:** `index.tsx:191` · **Impacto:** 2 · **Esfuerzo:** S

### PRF2-003 · `QuestItem` no está memoizado
**Qué:** envolver `QuestItem` en `React.memo`; hoy cualquier render del padre (toast, nivel, refresh) re-renderiza las N filas. **Dónde:** `QuestItem.tsx:16` · **Impacto:** 3 · **Esfuerzo:** S

### PRF2-004 · `onComplete` se recrea en cada render y rompe la memo de QuestItem
**Qué:** `onComplete` es una función nueva por render; envolver en `useCallback` para que `React.memo(QuestItem)` funcione. **Dónde:** `index.tsx:148` · **Impacto:** 3 · **Esfuerzo:** S

### PRF2-005 · La lista de misiones debería ser `FlatList`
**Qué:** `sorted.map(...)` dentro de `ScrollView`; con muchas misiones monta todas a la vez. `FlatList` con `keyExtractor`/virtualización. **Dónde:** `index.tsx:295-305` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-006 · `finishQuest` encadena `completionStats` (2 count queries) en serie tras cada completar
**Qué:** tras `completeQuest` se hace `completionStats()` que son **2** queries `count` (`data.ts:77-84`) en serie solo para evaluar logros; cachear el total en estado y `+1` localmente, o derivarlo de un único `count`. **Dónde:** `index.tsx:129` · **Impacto:** 3 · **Esfuerzo:** M

### PRF2-007 · `load()` de Sistema es una cascada serial larga en cada foco
**Qué:** `ensureProfile → seedDefaultQuests → fetchQuests → processPendingDays → fetchCompletionsForDate` corren en serie en cada `useFocusEffect`; varios son independientes y paralelizables (p. ej. `fetchCompletionsForDate(today)` no depende de `processPendingDays`). **Dónde:** `index.tsx:52-61` · **Impacto:** 4 · **Esfuerzo:** M

### PRF2-008 · `seedDefaultQuests` hace un `count` en cada foco para nada
**Qué:** `seedDefaultQuests` ejecuta un `count` sobre `quests` (`data.ts:132`) **en cada `load`**, pero solo importa la primera vez de la vida de la cuenta; saltarlo si ya hay quests en estado o usar un flag en AsyncStorage. **Dónde:** `index.tsx:53` + `data.ts:131-133` · **Impacto:** 2 · **Esfuerzo:** S

### PRF2-009 · `fetchQuests` se llama dos veces cuando hay penalización
**Qué:** si `processPendingDays` aplicó penalización se vuelve a `fetchQuests()` (`index.tsx:58`); se puede devolver la quest de penalización desde `processPendingDays` y hacer append local en vez de refetch completo. **Dónde:** `index.tsx:55-59` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-010 · Refetch completo en `onRefresh` duplica el trabajo de foco
**Qué:** `onRefresh` llama a `load()` entero (incluida la cascada de cierre de días); para pull-to-refresh basta refrescar quests+completaciones del día. **Dónde:** `index.tsx:182-186` · **Impacto:** 2 · **Esfuerzo:** S

### PRF2-011 · `gym.tsx` `load()` es serial pudiendo ir en paralelo
**Qué:** `setDays(await fetchGymDays()); setExercises(await fetchGymExercises()); setTodaySession(await fetchSessionForDate())` son 3 awaits independientes en serie; usar `Promise.all` (como ya hace `agenda.tsx:57` e `informe.tsx:24`). **Dónde:** `gym.tsx:75-77` · **Impacto:** 3 · **Esfuerzo:** S

### PRF2-012 · 3 `setState` consecutivos en `gym.tsx` load → renders extra
**Qué:** además de ser serial, son 3 `setState` separados que pueden disparar renders intermedios; agrupar en un solo objeto de estado o setear tras el `Promise.all`. **Dónde:** `gym.tsx:75-77` · **Impacto:** 2 · **Esfuerzo:** S

### PRF2-013 · `exercisesFor(dayId)` filtra el array completo por cada día renderizado
**Qué:** dentro de `days.map`, `exercisesFor(d.id)` (`gym.tsx:278`) recorre **todos** los `exercises` por cada día → O(días × ejercicios) en cada render. Precalcular `Map<gym_day_id, GymExercise[]>` con `useMemo`. **Dónde:** `gym.tsx:88,203,278` · **Impacto:** 3 · **Esfuerzo:** M

### PRF2-014 · `todayPlan = days.find(...)` recomputado en cada render
**Qué:** `days.find((d) => d.day_of_week === todayWd)` corre en cada render; memoizar con `[days, todayWd]`. **Dónde:** `gym.tsx:87` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-015 · `finishTraining` es una cadena de 6+ awaits serie
**Qué:** `fetchMaxLifts → createSession → insertLifts → ensureProfile → awardXp → (insertEvent×PRs) → count(events) → unlockAchievements` corren en serie; varios son paralelizables (p. ej. `fetchMaxLifts` y `ensureProfile` no dependen entre sí) y los `insertEvent` por PR pueden ir en un solo insert batch. **Dónde:** `gym.tsx:114-138` · **Impacto:** 3 · **Esfuerzo:** M

### PRF2-016 · `insertEvent` por cada PR en bucle (N round-trips)
**Qué:** `for (const pr of prs) await insertEvent(...)` (`gym.tsx:130-132`) hace una inserción por PR; agrupar en un único `insert([...])`. **Dónde:** `gym.tsx:130-132` · **Impacto:** 2 · **Esfuerzo:** S

### PRF2-017 · `count(events where type=gym_pr)` solo para logros
**Qué:** query `count` extra (`gym.tsx:134-137`) en el camino crítico de terminar sesión; mantener un contador de PRs en `profiles`/AsyncStorage o derivarlo del resultado ya conocido. **Dónde:** `gym.tsx:134-137` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-018 · Lista de días de rutina como `FlatList`
**Qué:** `days.map` → `SystemWindow` por día con su sublista; con rutina semanal completa + ejercicios, virtualizar. **Dónde:** `gym.tsx:248-302` · **Impacto:** 1 · **Esfuerzo:** M

### PRF2-019 · `gym.tsx` usa `useEffect` y no refresca al volver a foco
**Qué:** carga con `useEffect(load)` (`gym.tsx:83`), no `useFocusEffect`; al navegar a dieta/compra y volver no refresca. Es una inconsistencia con las pestañas; decidir foco vs efecto a propósito (afecta a cuántos fetch se hacen). **Dónde:** `gym.tsx:83-85` · **Impacto:** 2 · **Esfuerzo:** S

### PRF2-020 · `agenda.tsx` recalcula 14 días × 4 filtros en cada render
**Qué:** dentro de `days.map`, por cada uno de los 14 días se hace `questsScheduledOn(quests, day)` + 3 `.filter` sobre events/dueTasks (`agenda.tsx:106-110`); todo en cada render. Precalcular agrupaciones por fecha (`Map<date, …>`) con `useMemo`. **Dónde:** `agenda.tsx:105-110` · **Impacto:** 3 · **Esfuerzo:** M

### PRF2-021 · `questsScheduledOn` se ejecuta 14 veces por render en agenda
**Qué:** se invoca una vez por día del bucle; si recorre todas las quests cada vez es O(14 × quests). Calcular una vez el conjunto de quests por día. **Dónde:** `agenda.tsx:106` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-022 · `days = Array.from({length:14})` recreado en cada render
**Qué:** el array de 14 fechas se reconstruye en cada render; memoizar con `[today]`. **Dónde:** `agenda.tsx:93` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-023 · `events.filter` / `dueTasks.filter` por día sin índice
**Qué:** filtrar `events` y `dueTasks` linealmente por cada día; con muchos eventos crece. Agrupar por `date`/`due_date` una vez. **Dónde:** `agenda.tsx:107-109` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-024 · Agenda como `SectionList`
**Qué:** la estructura "día → filas" encaja en `SectionList` virtualizado en vez de `ScrollView` + 14 paneles siempre montados. **Dónde:** `agenda.tsx:97-177` · **Impacto:** 2 · **Esfuerzo:** L

### PRF2-025 · `informe.tsx` no memoiza ningún derivado
**Qué:** `thisWeek`, `prevWeek`, `xpWeek`, `xpPrev`, `delta`, `withEvidence`, `evidencePct`, `questById`, `xpByStat`, `topStat`, `byDay`, `bestDay`, `narrative` se recalculan en cada render. Un `useMemo([completions, quests, today])` cubre todo. **Dónde:** `informe.tsx:38-96` · **Impacto:** 3 · **Esfuerzo:** S

### PRF2-026 · `questById` Map se reconstruye en cada render
**Qué:** `new Map(quests.map(...))` (`informe.tsx:51`) en cada render; memoizar con `[quests]`. **Dónde:** `informe.tsx:51` · **Impacto:** 2 · **Esfuerzo:** S

### PRF2-027 · `informe` descarga 91 días de completaciones siempre
**Qué:** `fetchCompletionsSince(today-91)` (`informe.tsx:23`) trae 3 meses de filas en cada foco para alimentar KPIs de 7 días + heatmap; el cálculo de 7 días no necesita 91 días. Separar: una query agregada por día para el heatmap (count por fecha en servidor) y otra acotada a 7–14 días para los KPIs. **Dónde:** `informe.tsx:23` · **Impacto:** 3 · **Esfuerzo:** M

### PRF2-028 · KPIs semanales calculables en servidor
**Qué:** `xpWeek`, `xpByStat`, `evidencePct` se reducen en cliente sobre el array completo; un par de queries agregadas (sum, count filtrado) lo harían sin traer filas. **Dónde:** `informe.tsx:44-56` · **Impacto:** 2 · **Esfuerzo:** L

### PRF2-029 · `byDay` recorre 91 días aunque el heatmap muestre 13 semanas
**Qué:** `byDay` agrupa **todas** las completaciones (`informe.tsx:59-62`) pero el heatmap recorta a 13 semanas; alineado con la query acotada de PRF2-027. **Dónde:** `informe.tsx:59-62` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-030 · `Heatmap` construye ~91 celdas y las mapea sin memo
**Qué:** `cells` (≈ semanas×7) se reconstruye y se renderiza un `<Rect>` por celda en cada render del padre; envolver `Heatmap` en `React.memo` y memoizar `cells` con `[counts, weeks]`. **Dónde:** `Heatmap.tsx:34-52` · **Impacto:** 2 · **Esfuerzo:** S

### PRF2-031 · `Heatmap` usa `key={i}` por índice
**Qué:** las celdas usan el índice como `key` (`Heatmap.tsx:51`); con conjunto estable de fechas, usar la fecha como key evita reconciliaciones raras si cambia el rango. **Dónde:** `Heatmap.tsx:51` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-032 · `perfil.tsx` no memoiza derivados (incluye `Math.max(...statXp)`)
**Qué:** `lvl`, `rank`, `maxStatXp`, `evidencePct`, `frozen` se recalculan en cada render; `maxStatXp` hace un spread+`Math.max` sobre las 5 stats. Memoizar con `[profile, stats, today]`. **Dónde:** `perfil.tsx:183-187` · **Impacto:** 2 · **Esfuerzo:** S

### PRF2-033 · La cuadrícula de logros mapea 21 `Pressable` con handler inline
**Qué:** `ACHIEVEMENTS.map` (`perfil.tsx:282-301`) crea un `Pressable` con `onPress` inline por logro en cada render; extraer item memoizado y `useCallback` del handler con `code`. **Dónde:** `perfil.tsx:281-302` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-034 · `onAchievementTap` se recrea cada render
**Qué:** función nueva por render pasada a 21 hijos; `useCallback([userId, profile, unlocked])`. **Dónde:** `perfil.tsx:129` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-035 · `STATS.map` para barras y para la share-card sin memo
**Qué:** dos `STATS.map` (`perfil.tsx:262`, `381`) recomputan `statPoints(...)` por stat en cada render; trivial pero acumulativo con el resto. **Dónde:** `perfil.tsx:262-273,381-386` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-036 · `completionStats` (2 counts) en cada foco de Perfil
**Qué:** `load()` de perfil llama `completionStats()` = 2 queries count (`perfil.tsx:69`) en cada `useFocusEffect`; cachear o unificar en un solo count + count filtrado vía RPC. **Dónde:** `perfil.tsx:69` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-037 · `load()` de Perfil parcialmente serializado
**Qué:** `ensureProfile`, `completionStats`, `fetchUnlocked`, `signedUrl` corren en serie (`perfil.tsx:66-72`); `completionStats` y `fetchUnlocked` no dependen de `ensureProfile` y pueden ir en `Promise.all`. **Dónde:** `perfil.tsx:66-72` · **Impacto:** 3 · **Esfuerzo:** S

### PRF2-038 · `signedUrl` re-firmado en cada foco invalida caché de imagen
**Qué:** ver CRIT-PRF2-04; cachear la URL firmada (TTL 7 días) en vez de regenerarla en cada `load`. **Dónde:** `perfil.tsx:71-72` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-039 · `<Image>` de avatar sin `cachePolicy` ni `recyclingKey`
**Qué:** añadir `cachePolicy="memory-disk"` y `recyclingKey={profile.avatar_url}` en los dos `<Image>` (perfil y share-card). **Dónde:** `perfil.tsx:197,369` · **Impacto:** 2 · **Esfuerzo:** S

### PRF2-040 · `captureRef` a `quality:1` puede generar PNG enorme
**Qué:** `captureRef(shareRef, { format:'png', quality:1 })` (`perfil.tsx:153`) captura a resolución/calidad máxima; en pantallas grandes el PNG resultante puede ser pesado para compartir. Considerar `quality` menor o `result: 'tmpfile'` explícito. **Dónde:** `perfil.tsx:153` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-041 · `diario.tsx` recalcula `chronicle`/`recent` solo en load (bien) pero mapea sin memo
**Qué:** las listas `chronicle.map` y `recent.map` (`diario.tsx:196,207`) re-renderizan al teclear (`text`/`mood` cambian de estado en el mismo componente). Extraer las dos `SystemWindow` de historial a subcomponentes `React.memo` para que escribir no las re-renderice. **Dónde:** `diario.tsx:191-223` · **Impacto:** 3 · **Esfuerzo:** M

### PRF2-042 · Escribir en el textarea re-renderiza todo el árbol del diario
**Qué:** `text` vive en el componente raíz; cada pulsación re-renderiza prompt, escalas, crónica y entradas anteriores. Aislar el editor (estado local en subcomponente) o memoizar el resto. **Dónde:** `diario.tsx:70,174-181` · **Impacto:** 3 · **Esfuerzo:** M

### PRF2-043 · `chronicle`/`recent` usan `key={i}` por índice
**Qué:** `chronicle.map((line, i) => <Text key={i}>)` (`diario.tsx:196`) usa índice; aceptable por ser estático, pero preferible una key estable. **Dónde:** `diario.tsx:196` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-044 · `save()` del diario encadena `countEntries` + logros en serie
**Qué:** tras `upsertEntry` se hace `ensureProfile → awardXp → countEntries → unlockAchievements` en serie (`diario.tsx:120-123`); `countEntries` es otra query solo para logros. **Dónde:** `diario.tsx:120-123` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-045 · `dieta.tsx` filtra `slots` por día y por slot en bucle
**Qué:** `daySlots = slots.filter(day)` en cada render + dentro de `MEAL_SLOTS.map` un `daySlots.find(slot)` por slot (`dieta.tsx:55,129`); memoizar `daySlots` y construir `Map<slot, MealSlot>`. **Dónde:** `dieta.tsx:55,128-129` · **Impacto:** 2 · **Esfuerzo:** S

### PRF2-046 · `dieta.tsx` usa `useEffect` y no refresca al volver de compra
**Qué:** `useEffect(load)` (`dieta.tsx:51`); al ir a `/compra` y volver no recarga slots. Inconsistencia de patrón de carga. **Dónde:** `dieta.tsx:51-53` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-047 · `dungeon/[id].tsx` carga dungeon y tareas en serie
**Qué:** `setDungeon(await fetchDungeon(id)); setTasks(await fetchTasks(id))` (`[id].tsx:57-58`) son dos awaits independientes en serie; `Promise.all`. **Dónde:** `dungeon/[id].tsx:57-58` · **Impacto:** 2 · **Esfuerzo:** S

### PRF2-048 · `dungeon/[id]` recalcula `done`/`allDone` y `dungeonTaskXp` por tarea en cada render
**Qué:** `done = tasks.filter(t.done)` (`[id].tsx:152`) en cada render y `dungeonTaskXp(...)` se llama por tarea en el `.map` (`[id].tsx:229`); memoizar derivados y precalcular XP por tarea. **Dónde:** `dungeon/[id].tsx:152-153,229` · **Impacto:** 2 · **Esfuerzo:** S

### PRF2-049 · `toggleTask`/`claimLoot` recargan TODO con `load()` tras XP
**Qué:** tras marcar una tarea se hace `await load()` completo (refetch dungeon + tasks) cuando bastaría actualizar la tarea localmente. **Dónde:** `dungeon/[id].tsx:97,125` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-050 · Lista de objetivos de mazmorra como `FlatList`
**Qué:** `tasks.map` dentro de `ScrollView`; virtualizar para mazmorras con muchos objetivos. **Dónde:** `dungeon/[id].tsx:197-233` · **Impacto:** 1 · **Esfuerzo:** M

### PRF2-051 · `misiones.tsx` mapea N paneles `SystemWindow` sin virtualizar
**Qué:** `quests.map → SystemWindow` (`misiones.tsx:85-113`); cada panel paga el doble render de CRIT-PRF2-03. `FlatList` + item memoizado. **Dónde:** `misiones.tsx:85-113` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-052 · `onToggle`/`onDelete` inline recreados en misiones
**Qué:** handlers nuevos por render pasados a cada fila; `useCallback`. **Dónde:** `misiones.tsx:49-66` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-053 · Extraer fila de misión a componente memoizado
**Qué:** el contenido de cada `SystemWindow` de misión es candidato a `React.memo(MissionRow)` para que un toggle no re-renderice las demás. **Dónde:** `misiones.tsx:86-112` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-054 · `MODULES.map` reconstruye 6 `Pressable` con `router.push` inline
**Qué:** `MODULES` es constante pero el `onPress={() => router.push(m.route)}` crea closures por render (`index.tsx:321`); menor, pero memoizable. **Dónde:** `index.tsx:320-325` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-055 · `XPBar` no memoizado
**Qué:** componente puro re-renderizado con cada render del padre; `React.memo`. Aparece varias veces por pantalla (Sistema, perfil ×7 stats, dungeon, informe). **Dónde:** `XPBar.tsx:11` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-056 · `Hexagon` no memoizado
**Qué:** avatar hexagonal SVG re-renderizado en cada render de Sistema/Perfil; `React.memo`. **Dónde:** `index.tsx:211`, `perfil.tsx:195,367` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-057 · `formatLongDate()` recalculado en cada render de Sistema
**Qué:** `formatLongDate()` (`index.tsx:205`) corre en cada render; el día no cambia mientras la pantalla está abierta, memoizar. **Dónde:** `index.tsx:205` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-058 · `streakMultiplier(...).toFixed(1)` recomputado en varios sitios
**Qué:** se recalcula en Sistema (`index.tsx:235`) y perfil (`perfil.tsx:321`) por render; barato pero incluible en el `useMemo` del perfil/sistema. **Dónde:** `index.tsx:235`, `perfil.tsx:321` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-059 · Imágenes de evidencia sin caché (cuando se muestren)
**Qué:** `signedUrl('evidence', …)` seguirá el mismo patrón de URL firmada cambiante; al integrar visualización de evidencias, aplicar la misma estrategia de `recyclingKey`/cache que el avatar para no re-descargar. **Dónde:** `data.ts:118-121` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-060 · `processPendingDays` inserta eventos en serie
**Qué:** dentro del cierre se hacen hasta 4 `insertEvent` secuenciales (`engine.ts:87-97`) más el update; agrupar en un único `insert` batch de eventos. **Dónde:** `engine.ts:87-97` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-061 · `completeQuest` encadena upload→insert→update→2×insertEvent en serie
**Qué:** la ruta de completar misión hace subida de evidencia, insert de completion, update de profile y 1–2 `insertEvent` en serie (`engine.ts:131-161`); los `insertEvent` pueden agruparse y la subida de evidencia puede ir en paralelo al cómputo de XP. **Dónde:** `engine.ts:131-161` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-062 · `awardXp` separa update y 2 insertEvent en serie
**Qué:** `updateProfile` + `insertEvent(eventType)` + posible `insertEvent(level_up)` en serie (`engine.ts:185-191`); batch de eventos. **Dónde:** `engine.ts:185-191` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-063 · `fetchQuests` sin filtro `active`/`is_penalty` en servidor
**Qué:** `fetchQuests` trae todas las quests (incluidas penalizaciones y desactivadas) y se filtran en cliente en cada pantalla (`misiones.tsx:31`, agenda, sistema); permitir filtros en servidor para no traer filas inútiles. **Dónde:** `data.ts:24-31` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-064 · `fetchCompletionsSince` sin proyección de columnas
**Qué:** `select('*')` trae todas las columnas de completions cuando informe solo usa `date`, `xp_awarded`, `evidence_url`, `quest_id`; proyectar columnas reduce payload en la query de 91 días. **Dónde:** `data.ts:61-68` · **Impacto:** 2 · **Esfuerzo:** S

### PRF2-065 · `fetchGymExercises` trae todos los ejercicios sin agrupar por día
**Qué:** se descargan todos los ejercicios y se filtran por día en cliente (PRF2-013); si crece mucho, traer por `gym_day_id` o agrupar en servidor. **Dónde:** `body.ts:29-36` · **Impacto:** 1 · **Esfuerzo:** M

### PRF2-066 · `completionStats` son 2 round-trips count siempre
**Qué:** `total` y `withEvidence` son dos queries `count` separadas (`data.ts:77-84`); una sola RPC podría devolver ambos. Se invoca en Sistema (por completar) y Perfil (por foco). **Dónde:** `data.ts:76-85` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-067 · `select('*', {count})` para contar
**Qué:** varios `count` usan `select('*', { count:'exact', head:true })` (`data.ts:78,132`, `body.ts:102`, `dungeons.ts:92`, `gym.tsx:135`); con `head:true` no traen filas, pero conviene confirmar que no se materializa proyección. Menor. **Dónde:** múltiples · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-068 · No hay caché entre pestañas: cada foco refetcha desde cero
**Qué:** `quests` se vuelve a pedir en Sistema, Misiones, Agenda e Informe por separado en cada foco; una capa de caché (react-query/SWR o un store) evitaría 4 fetch del mismo recurso al navegar entre pestañas. **Dónde:** `index.tsx:54`, `misiones.tsx:30`, `agenda.tsx:58`, `informe.tsx:24` · **Impacto:** 4 · **Esfuerzo:** L

### PRF2-069 · `useFocusEffect` sin guard de "ya cargado" repite trabajo al volver atrás
**Qué:** cada vez que la pantalla recupera el foco (incluido volver de un push) se hace `load()` completo; añadir staleness/"si cargado hace < X s, no recargar" evita refetch en navegaciones rápidas. **Dónde:** `index.tsx:82-86` y todas las `useFocusEffect` · **Impacto:** 3 · **Esfuerzo:** M

### PRF2-070 · Mover la economía de XP a RPC reduce round-trips (ángulo de rendimiento)
**Qué:** además del ángulo de seguridad ya conocido (diferido a 0004), consolidar `update profile + insert completion + insert events` en **una** RPC reduciría de 4–6 round-trips a 1 por acción de XP, que es el principal coste percibido en completar misión/tarea/sesión. **Dónde:** `engine.ts:122-194` · **Impacto:** 3 · **Esfuerzo:** L

### PRF2-071 · `RefreshControl` sin `colors`/spinner Android afinado
**Qué:** `RefreshControl` solo define `tintColor` (iOS); en Android conviene `colors={[...]}` para evitar spinner por defecto y reflujo visual. Menor de pulido perceptual. **Dónde:** `index.tsx:200` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-072 · `ScrollView` sin `removeClippedSubviews`
**Qué:** las pantallas largas (perfil, informe, agenda) podrían beneficiarse de `removeClippedSubviews` o, mejor, migrar a listas virtualizadas (ver entradas FlatList). **Dónde:** `perfil.tsx:191`, `informe.tsx:100`, `agenda.tsx:97` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-073 · Estilos inline recreados en JSX en vez de en `StyleSheet`
**Qué:** muchos `style={{ marginTop: 12 }}`, `style={{ flexDirection:'row', gap:10 }}` inline (p. ej. `index.tsx:227,233`, `perfil.tsx:224`); crean objetos nuevos por render e impiden que RN cachee el estilo. Mover a `StyleSheet`. **Dónde:** `index.tsx:227,233,237` y dispersos · **Impacto:** 1 · **Esfuerzo:** M

### PRF2-074 · `SystemWindow` mide aunque su tamaño no cambie
**Qué:** `onLayout` setea estado en el primer layout; en paneles de tamaño fijo conocido se podría pasar `width`/`height` por prop y saltarse la medición (y el doble render) por completo. **Dónde:** `SystemWindow.tsx:27-32` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-075 · `SystemWindow` re-renderiza por `children` aunque no cambie
**Qué:** al no estar memoizado, cualquier render del padre re-renderiza el panel y su SVG; `React.memo` con comparación de props. **Dónde:** `SystemWindow.tsx:17` · **Impacto:** 2 · **Esfuerzo:** S

### PRF2-076 · `LevelUpOverlay`/`XpToast` montados siempre aunque inactivos
**Qué:** ambos se renderizan incondicionalmente (`index.tsx:330-331`) con prop `null`; confirmar que con `null` no montan animaciones/listeners. Si lo hacen, renderizar condicionalmente. **Dónde:** `index.tsx:330-331` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-077 · `evaluateAchievements`/`unlockAchievements` en cada acción de XP
**Qué:** tras cada completar/sesión/tarea/entrada se evalúan y potencialmente upsertean logros; si `unlockAchievements` escribe siempre (aunque no haya nuevos), es un round-trip evitable. Cortocircuitar cuando el set evaluado ya está desbloqueado. **Dónde:** `index.tsx:130`, `gym.tsx:138`, `dungeon/[id].tsx:118`, `diario.tsx:123` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-078 · `dateKey()` llamado múltiples veces por render
**Qué:** `dateKey()` se invoca en cuerpos de componente y dentro de callbacks repetidamente (`index.tsx:188`, etc.); barato pero centralizable en una constante por render. **Dónde:** múltiples · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-079 · Falta `keyExtractor` estable preparado para futuras FlatList
**Qué:** al migrar a FlatList, usar `item.id` como `keyExtractor` (ya disponible en todos los tipos) en vez de índice; documentar el patrón. **Dónde:** transversal · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-080 · `processPendingDays` puede recorrer muchos días en un solo foco
**Qué:** si el usuario no abre la app varios días, `computeDayClose` procesa todo el rango `fromDate→today` y `fetchCompletionsSince(fromDate)` trae todas esas completaciones de golpe en el `load` de Sistema; acotar/segmentar si el hueco es grande. **Dónde:** `engine.ts:44-56` (consumido en `index.tsx:55`) · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-081 · `fetchMaxLifts` se ejecuta aunque no haya pesos que comparar
**Qué:** se llama siempre al terminar (`gym.tsx:114`) incluso si ningún `valid` tiene `weight>0`; saltarla si no hay levantamientos con peso evita la descarga completa. **Dónde:** `gym.tsx:114-115` · **Impacto:** 2 · **Esfuerzo:** S

### PRF2-082 · `parseFloat`/`parseInt` por fila en `finishTraining` sin coste, pero `.map().filter()` crea 2 arrays
**Qué:** `lifts.map(...).filter(...)` (`gym.tsx:106-112`) crea dos arrays intermedios; un solo `reduce` evita la copia. Menor. **Dónde:** `gym.tsx:106-112` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-083 · Inputs de levantamiento actualizan todo `lifts` en cada tecla
**Qué:** `onChangeText` hace `setLifts(prev => prev.map(...))` (`gym.tsx:222,230`) recreando el array completo y re-renderizando todas las filas por cada pulsación; aislar cada fila en subcomponente con estado local. **Dónde:** `gym.tsx:214-235` · **Impacto:** 3 · **Esfuerzo:** M

### PRF2-084 · `lifts.map` usa `key={l.exercise}` (colisión si nombres repetidos)
**Qué:** la key es el nombre del ejercicio (`gym.tsx:215`); si dos ejercicios comparten nombre, key duplicada → reconciliación incorrecta y posible pérdida de foco al teclear. Usar id estable. **Dónde:** `gym.tsx:215` · **Impacto:** 2 · **Esfuerzo:** S

### PRF2-085 · Modales montados con el árbol aunque estén cerrados
**Qué:** los `<Modal>` (`agenda.tsx:179`, `gym.tsx:306,336`, `perfil.tsx:332,363`, `dieta.tsx:159`, `dungeon/[id].tsx:241`) se evalúan en cada render aunque `visible=false`; con `visible` falso RN no los presenta, pero su contenido (chips, inputs) sí se reconcilia. Renderizar el contenido solo cuando `visible`. **Dónde:** múltiples · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-086 · `FREEZE_*`/`DAY_*`/`MEAL_SLOTS` mapeados a chips sin memo
**Qué:** arrays constantes mapeados a `Pressable` con handler inline (`perfil.tsx:341,349`, `gym.tsx:311`, `dieta.tsx:120`); memoizar la lista de chips o el componente. **Dónde:** múltiples · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-087 · `STATS`/`STAT_COLUMN` accedidos por índice en cada barra
**Qué:** `profile[STAT_COLUMN[s]]` por stat en cada render (perfil, informe, share-card); precalcular un objeto `{stat: puntos}` una vez por render con `useMemo`. **Dónde:** `perfil.tsx:263,384`, `informe.tsx:53-56` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-088 · `new Date().toISOString()` y `Date` parsing en bucles de render
**Qué:** `agenda.tsx:36` y `informe.tsx:88` parsean fechas con `new Date(...)` dentro de `.map`/derivados; cachear el `toLocaleDateString` por fecha. **Dónde:** `agenda.tsx:32-38`, `informe.tsx:88-90` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-089 · `dayLabel` hace `toLocaleDateString` por día (14×) en agenda
**Qué:** `dayLabel` (`agenda.tsx:32-38`) formatea con Intl por cada uno de los 14 días en cada render; Intl es relativamente caro. Memoizar etiquetas por fecha. **Dónde:** `agenda.tsx:32-38,116` · **Impacto:** 2 · **Esfuerzo:** S

### PRF2-090 · Sin `InteractionManager` para diferir trabajo pesado tras animación
**Qué:** los `load()` se disparan en el `useFocusEffect` sin esperar a que termine la transición de pantalla; diferir el fetch/pareo pesado con `InteractionManager.runAfterInteractions` suaviza la animación de entrada. **Dónde:** `index.tsx:82-86` y demás · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-091 · `ensureDailyNotifications` en `useEffect([])` sin diferir
**Qué:** se ejecuta al montar Sistema (`index.tsx:88-90`); si toca el módulo de notificaciones de forma síncrona pesada, diferirlo tras interacciones. **Dónde:** `index.tsx:88-90` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-092 · `evaluateAchievements` recibe `completionStats` que ya se pidió en foco
**Qué:** en Sistema, `finishQuest` vuelve a pedir `completionStats` (`index.tsx:129`) aunque el foco ya lo cargó indirectamente; reutilizar un contador en estado evita la doble query. **Dónde:** `index.tsx:129` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-093 · `completions` como objeto reconstruido en cada completar
**Qué:** `setCompletions(prev => ({...prev, [id]: …}))` (`index.tsx:115`) clona el mapa completo; para muchos ítems es O(n) por completar, aceptable pero a tener en cuenta. **Dónde:** `index.tsx:115-126` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-094 · `questsScheduledOn` se importa y ejecuta en varias pantallas sin caché
**Qué:** Sistema y Agenda llaman `questsScheduledOn` (índice `index.tsx:66`, agenda `agenda.tsx:106`) recomputando programación por render/día; memoizar resultado por `(quests, fecha)`. **Dónde:** `index.tsx:66`, `agenda.tsx:106` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-095 · `topStat` con `reduce` recomputado y reutilizable
**Qué:** `topStat` (`informe.tsx:57`) se recalcula y luego se vuelve a usar `xpByStat[topStat]` en el render de barras (`informe.tsx:146`); incluirlo en el `useMemo`. **Dónde:** `informe.tsx:57,146` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-096 · Barras de stat con `width` calculado por stat en JSX
**Qué:** el `width: `${Math.min(100, Math.round(...))}%`` (`informe.tsx:146`) recalcula por stat en cada render dentro del `.map`; precalcular el array de anchos. **Dónde:** `informe.tsx:142-148` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-097 · Sin "skeleton"/estado de carga: render vacío hasta que llega la red
**Qué:** Perfil y Dungeon devuelven `SafeAreaView` vacío hasta tener datos (`perfil.tsx:179-181`, `dungeon/[id].tsx:148-150`); un esqueleto evita el "flash en blanco" percibido como lentitud. Pulido de rendimiento percibido. **Dónde:** `perfil.tsx:179-181`, `dungeon/[id].tsx:148-150` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-098 · No se cancela el fetch en curso al perder foco
**Qué:** los `load()` no usan `AbortController`/flag de montaje; si el usuario navega mientras carga, el `setState` posterior cae en componente desmontado (warning) y el trabajo de red se desperdicia. **Dónde:** todas las `load` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-099 · `fetchRecentEntries(15)` siempre 15 aunque se muestren 14
**Qué:** se piden 15 y se recorta a 14 (`diario.tsx:88`); correcto funcionalmente, pero confirmar que el `select` proyecta solo columnas usadas (`date`, `mood`, `energy`, `text`, `id`) para reducir payload. **Dónde:** `diario.tsx:88` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-100 · Test de rendimiento ausente para el cierre de días masivo
**Qué:** no hay test que mida `processPendingDays`/`computeDayClose` con un hueco grande (p. ej. 60 días sin abrir); añadir un test de tamaño que garantice que el cierre no degrada de forma cuadrática. **Dónde:** `closing.ts`/`engine.ts` (tests) · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-101 · Benchmark/regresión de render para listas largas
**Qué:** añadir un test/perf-check que monte Sistema/Agenda/Informe con cientos de filas y verifique tiempos de render razonables (detectaría regresiones de las FlatList propuestas). **Dónde:** transversal (tests) · **Impacto:** 2 · **Esfuerzo:** L

### PRF2-102 · Medir el doble render de `SystemWindow` con un contador en test
**Qué:** test que verifique que un panel se renderiza una sola vez tras el arreglo de CRIT-PRF2-03. **Dónde:** `SystemWindow.tsx` (tests) · **Impacto:** 1 · **Esfuerzo:** M

### PRF2-103 · Caso límite: heatmap con 0 actividad recorre 91 celdas igual
**Qué:** `Heatmap` construye todas las celdas aunque `counts` esté vacío; trivial pero evitable si se memoiza por `counts`. **Dónde:** `Heatmap.tsx:34-45` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-104 · Caso límite: usuario con cientos de misiones activas en Agenda
**Qué:** con muchas quests, los 14 días × `questsScheduledOn` se vuelven lentos; cubierto por PRF2-020/021 pero merece prueba específica de carga. **Dónde:** `agenda.tsx:105-110` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-105 · Caso límite: mazmorra con muchos objetivos recalcula XP por render
**Qué:** `dungeonTaskXp` por tarea sin memo (PRF2-048) escala con el número de objetivos; precalcular. **Dónde:** `dungeon/[id].tsx:229` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-106 · Caso límite: historial de gym de varios años en `fetchMaxLifts`
**Qué:** sin agregación servidor (CRIT-PRF2-02), el peor caso es traer años de series; prioridad alta de cara al uso a largo plazo. **Dónde:** `body.ts:88-99` · **Impacto:** 3 · **Esfuerzo:** M

### PRF2-107 · Reutilizar `levelFromXp` ya calculado en vez de recalcular antes/después
**Qué:** `completeQuest`/`awardXp` calculan `levelFromXp(profile.xp_total)` y `levelFromXp(profile.xp_total + xp)` (`engine.ts:152-153,187-188`); barato, pero el de "antes" suele coincidir con el `lvl` ya conocido en pantalla y podría pasarse para ahorrar una llamada. **Dónde:** `engine.ts:152-153,187-188` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-108 · `Promise.all` también para `unlockAchievements` + acción siguiente
**Qué:** donde `unlockAchievements` no bloquea la UI (solo alerta posterior), podría lanzarse sin `await` en paralelo a refrescar el estado, en vez de en serie antes del `load()`. **Dónde:** `dungeon/[id].tsx:118`, `gym.tsx:138` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-109 · `setShoppingDone`/toggles optimistas ya existen en misiones; replicar en compra/dieta
**Qué:** Misiones hace toggle optimista (`misiones.tsx:50`) pero dieta/compra/dungeon recargan con `load()` completo tras cada cambio; replicar el patrón optimista reduce refetch. **Dónde:** `dieta.tsx:75,82`, `dungeon/[id].tsx:97` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-110 · `fetchUnlocked` (Set) reconstruido en cada foco de perfil
**Qué:** `setUnlocked(await fetchUnlocked())` en cada `load` (`perfil.tsx:70`); cachear entre focos salvo invalidación tras desbloqueo. **Dónde:** `perfil.tsx:70` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-111 · `Image` de share-card y de perfil comparten URI pero re-descargan
**Qué:** ambos `<Image>` usan `avatarUri` (`perfil.tsx:197,369`); con `recyclingKey` por ruta compartirían bitmap. Sin él, el modal de compartir vuelve a decodificar. **Dónde:** `perfil.tsx:197,369` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-112 · `contentContainerStyle` recreado vs referenciado
**Qué:** verificar que todos los `contentContainerStyle={styles.content}` referencian el `StyleSheet` (lo hacen) y no objetos inline; mantener el patrón al añadir paddings dinámicos. **Dónde:** transversal · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-113 · `busy`/`refreshing` provocan render global; aislar spinners
**Qué:** `busy` (gym, perfil, dungeon, diario) y `refreshing` (sistema) viven en el componente raíz y re-renderizan toda la pantalla al alternar; mover el indicador a un subcomponente suscrito. **Dónde:** `gym.tsx:68`, `perfil.tsx:59`, `dungeon/[id].tsx:52`, `diario.tsx:74`, `index.tsx:44` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-114 · `setBusyQuestId` provoca render de toda la lista al marcar 1 misión
**Qué:** `busyQuestId` en el raíz (`index.tsx:43`) cambia → re-render de todas las `QuestItem`; con `React.memo` + comparación, solo la fila afectada debería actualizarse. **Dónde:** `index.tsx:43,153,302` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-115 · `toast`/`levelUp` en raíz re-renderizan la pantalla completa
**Qué:** mostrar el toast de XP (`index.tsx:45`) re-renderiza Sistema entero incluyendo la lista; aislar la capa de overlays. **Dónde:** `index.tsx:45,114,330` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-116 · Falta de proyección de columnas en `fetchQuests` para Agenda/Sistema
**Qué:** Agenda y Sistema solo necesitan subset de columnas de Quest (`title`, `days_of_week`, `is_penalty`, `stat`); `select('*')` (`data.ts:25`) trae todo. Menor por ser tabla pequeña. **Dónde:** `data.ts:24-31` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-117 · `fetchPendingTasksWithDue` trae todas las tareas con due para 14 días de agenda
**Qué:** `fetchPendingTasksWithDue` (`dungeons.ts:53-62`) trae todas las pendientes con `due_date`; la agenda solo usa hasta `today+14` (y `overdue`). Acotar por rango de fecha en servidor reduce filas. **Dónde:** `dungeons.ts:53-62` (consumido `agenda.tsx:60`) · **Impacto:** 2 · **Esfuerzo:** S

### PRF2-118 · `events.filter((e) => e.date === day)` con eventos de 14 días
**Qué:** `fetchCalendarEvents` ya acota a 14 días (bien), pero el filtrado por día en cliente es O(14×eventos); agrupar por fecha. **Dónde:** `agenda.tsx:107` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-119 · `dueTasks.filter` para `overdue` recorre todo cada render
**Qué:** `overdue = dueTasks.filter(t.due_date < today)` se evalúa dentro del `days.map` solo para `day===today` pero recorre todo `dueTasks`; calcular una vez fuera del bucle. **Dónde:** `agenda.tsx:109` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-120 · Sin `getItemLayout` previsto para listas de altura fija
**Qué:** las filas de QuestItem / tareas / entradas tienen altura aproximadamente fija; al migrar a FlatList, `getItemLayout` evita medición y mejora el scroll. Documentar alturas. **Dónde:** transversal · **Impacto:** 1 · **Esfuerzo:** M

### PRF2-121 · `String(...)`/`toUpperCase()` repetidos en render
**Qué:** `profile.name.charAt(0).toUpperCase()`, `.toUpperCase()` de rangos/títulos se recomputan por render en Sistema/Perfil; menor, incluible en memos. **Dónde:** `index.tsx:212,215`, `perfil.tsx:199,217` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-122 · `Array.from({length: DAYS_AHEAD})` y `MODULES`/`DAY_NAMES` fuera del componente (bien) — auditar el resto
**Qué:** confirmar que toda constante mapeable vive a nivel de módulo (varias ya lo están: `MODULES`, `DAY_NAMES`, `MEAL_SLOTS`); detectar y subir las que se declaran dentro del componente. **Dónde:** transversal · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-123 · Considerar `react-native-svg` memoización en Hexagon/Heatmap/SystemWindow/XPBar
**Qué:** los 4 componentes SVG se re-renderizan con el padre; `React.memo` colectivo en la capa de primitivas visuales reduciría el coste de re-paint en cada cambio de estado de pantalla. **Dónde:** `Hexagon.tsx`, `Heatmap.tsx`, `SystemWindow.tsx`, `XPBar.tsx` · **Impacto:** 2 · **Esfuerzo:** M

### PRF2-124 · `xpByStat` inicializado y rellenado en cada render del informe
**Qué:** el objeto `xpByStat` (`informe.tsx:52-56`) se crea y rellena por render; parte del `useMemo` global (PRF2-025). **Dónde:** `informe.tsx:52-56` · **Impacto:** 1 · **Esfuerzo:** S

### PRF2-125 · Falta debounce en `saveName`/inputs que disparan red
**Qué:** `saveName` se dispara en `onBlur` y `onSubmitEditing` (`perfil.tsx:209-210`); si en el futuro se autoguarda al teclear, añadir debounce para no saturar de updates. Preventivo. **Dónde:** `perfil.tsx:209-210` · **Impacto:** 1 · **Esfuerzo:** S

Total: 125 mejoras, 4 bugs.
