# Fiabilidad, offline y pulido

> Área REL · auditoría de código NIVL · anclada al código real
> Lente: offline-first y cola de sincronización · optimistic UI consistente · estados loading/empty/error en todas las pantallas · zonas horarias y cambio de día robusto · consistencia de copy · telemetría (Sentry) · reintentos · pérdida de red.
> Stack real verificado: Expo SDK 55 · React Native 0.83.6 · TypeScript estricto · Supabase JS 2.108. Sin `@react-native-community/netinfo`, sin `@sentry/react-native`, sin `expo-localization` en `package.json` (verificado línea a línea).

Esta área es transversal: el hilo conductor es que **toda la app asume red disponible y servidor sano**. No hay detección de conectividad, ni cola offline, ni telemetría, ni un solo reintento, ni timeout en ninguna llamada. El `fetch` del Oráculo y todas las llamadas a Supabase pueden colgarse indefinidamente. Las actualizaciones optimistas (toggles de misión, compra) no tienen rollback. Y varias pantallas mezclan `useEffect` con `useFocusEffect`, por lo que unas se refrescan al volver y otras no.

---

## Bugs y riesgos

### CRIT-REL-01 · `XpToast` se reinicia en cada render porque `onDone` es una flecha nueva — `(tabs)/index.tsx:330` + `XpToast.tsx:16-27` · severidad media
**Problema:** en `index.tsx:330` el toast se monta con `onDone={() => setToast(null)}`, una función recreada en cada render. El `useEffect` de `XpToast.tsx:27` declara `onDone` en su array de dependencias. Cuando se completa una misión, `finishQuest` hace varios `setState` (`setProfile`, `setToast`, `setCompletions`, y tras el `await` de `completionStats`/`unlockAchievements` más renders), y cada render entrega un `onDone` nuevo → el efecto se vuelve a ejecutar → `translateY.setValue(0); opacity.setValue(0)` reinicia la animación a mitad de vuelo. El "+XP" parpadea o salta en lugar de ascender suave, y en el peor caso la secuencia nunca termina de completarse hasta que cesan los renders. **Arreglo:** envolver el callback en `useCallback(() => setToast(null), [])` en `index.tsx`, o (mejor) sacar `onDone` de las dependencias del efecto en `XpToast.tsx` guardándolo en un `useRef` que se actualiza en cada render y se invoca dentro del `.start(() => onDoneRef.current())`.

### CRIT-REL-02 · Las actualizaciones optimistas de toggles no revierten si la escritura falla — `(tabs)/misiones.tsx:49-52`, `compra.tsx:39-42` · severidad media
**Problema:** `onToggle` (misiones) y `toggle` (compra) actualizan el estado local **antes** de `await setQuestActive(...)` / `await setShoppingDone(...)` y no envuelven la llamada en `try/catch`. Si la escritura falla (red caída, RLS, 500), la promesa se rechaza sin manejarse: en `misiones.tsx` el switch queda visualmente en el nuevo valor pero la BD conserva el viejo (estado mentido que persiste hasta el próximo `load`), y la `UnhandledPromiseRejection` puede disparar el overlay rojo de LogBox en dev. En `compra.tsx` el ítem aparece tachado/destachado sin haberse guardado. **Arreglo:** capturar el error y revertir el estado al valor previo, avisando con `Alert`. Patrón: guardar `const prev = item.done; setItems(optimista); try { await setShoppingDone(...) } catch (e) { setItems(revertir a prev); Alert.alert('Error del sistema', ...) }`.

### CRIT-REL-03 · `fetch` del Oráculo sin timeout ni `AbortController` puede colgar la UI para siempre — `oracle.ts:78-92` · severidad media
**Problema:** `generateQuests` hace `await fetch('https://api.anthropic.com/...')` sin `signal` ni timeout. En una red móvil que entra en un agujero (datos a 0 pero socket abierto), el `fetch` no resuelve ni rechaza: el botón "Consultar al oráculo" se queda en `loading` indefinidamente (`busy` nunca vuelve a `false` porque el `finally` no se ejecuta hasta que la promesa termina) y el usuario no puede reintentar sin matar la app. **Arreglo:** crear `const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 30000);` pasar `signal: ctrl.signal` al `fetch`, hacer `clearTimeout(t)` en un `finally`, y traducir `AbortError` a un mensaje de la voz del sistema ("El oráculo tardó demasiado en responder. Reintenta."). Aplicable también como patrón a todas las llamadas Supabase (ver REL-004).

### CRIT-REL-04 · El cambio de día solo se detecta al hacer focus/refresh: la app abierta a medianoche no cierra el día ni rota misiones — `(tabs)/index.tsx:82-86`, `dates.ts:11-16` · severidad media
**Problema:** `dateKey()` se calcula con `new Date()` en cada `load`, y `load` solo se dispara en `useFocusEffect` (al enfocar la pestaña) y en pull-to-refresh. Si el usuario deja NIVL abierta en la pantalla Sistema cruzando la medianoche (caso real: revisa misiones a las 23:58 y vuelve a las 00:05 sin cambiar de pestaña), `today` sigue siendo el día anterior, `processPendingDays` no se ejecuta, las "misiones de hoy" siguen siendo las de ayer y la penalización del cierre no se procesa hasta el siguiente focus. **Arreglo:** suscribirse a `AppState` "active" (ya hay un listener para auth refresh en `supabase.ts:27`) y/o a un temporizador que, al detectar que `dateKey()` cambió respecto al último render, fuerce `load()`. Mínimo: re-disparar `load` en `AppState change → active`.

### CRIT-REL-05 · El cómputo del cierre usa la lista de misiones de HOY para reconstruir días pasados — `engine.ts:45-56`, `closing.ts:58-60` · severidad media
**Problema:** `processPendingDays` pasa a `computeDayClose` el array `quests` actual (el que ve la pantalla hoy). `computeDayClose` (closing.ts:58) llama `questsScheduledOn(input.quests, day)` para cada día pasado sin cerrar. Si el usuario editó una misión entre ayer y hoy —cambió `days_of_week`, la desactivó (`active=false`), o la borró— el cierre de los días pendientes se calcula con la configuración nueva, no con la que regía ese día. Ejemplos: desactivar una misión hoy hace que un día de ayer en que estaba activa y se falló **no** compute penalización (porque `questsScheduledOn` filtra `!q.active`); borrar una misión elimina retroactivamente su penalización pendiente. Esto premia/castiga incorrectamente y es explotable sin querer. **Arreglo:** es un riesgo de diseño difícil de cerrar solo en cliente; mitigación realista a corto plazo: al cerrar días, marcar como "perdón" cualquier día cuyo estado de misiones sea ambiguo, y documentar la limitación. A medio plazo, mover el cierre a una RPC/cron del servidor que lea el estado histórico (encaja con la migración 0004 ya prevista, pero el ángulo "el cierre usa el horario actual, no el de la fecha" es NUEVO).

### CRIT-REL-06 · `_layout.tsx` raíz no espera a `auth.loading`: parpadeo y posibles llamadas con sesión a medio resolver — `app/_layout.tsx:33-43`, `auth.tsx:16-25` · severidad baja
**Problema:** el layout raíz renderiza el `Stack` en cuanto cargan las fuentes, sin mirar `useAuth().loading`. `index.tsx` (el redirector) sí gestiona `loading`, pero cualquier deep-link directo a una pantalla del grupo `(tabs)` monta esa pantalla mientras `session` todavía es `null` (estado inicial de `auth.tsx:13`). Las pantallas hacen `const userId = session?.user.id;` y sus `load()` arrancan con `if (!userId) return;`, pero al resolverse la sesión no siempre se re-dispara `load` (las que usan `useEffect(() => load, [load])` con `load` dependiente de `userId` sí; las que no dependen de `userId` en su `useCallback`, como `misiones.tsx:28-35` —cuyo `load` no lista `userId`— no reaccionan al cambio de sesión). Resultado: pantallas que arrancan vacías y no se rellenan tras login en frío vía deep-link. **Arreglo:** en `_layout.tsx`, mientras `loading` sea true mostrar el mismo placeholder que `index.tsx`; y revisar que cada `load` que usa `userId` lo incluya en las dependencias de su `useCallback`.

### CRIT-REL-07 · `seedDefaultQuests` puede sembrar misiones duplicadas en arranques concurrentes — `data.ts:131-139`, `(tabs)/index.tsx:53` · severidad baja
**Problema:** `seedDefaultQuests` hace un `count` y, si es 0, inserta las 5 misiones por defecto. No es atómico: en `index.tsx:53` se llama dentro de `load`, y `load` se dispara en cada focus. Dos `load` casi simultáneos (p. ej. focus + pull-to-refresh, o el primer login que monta la pantalla y refresca) pueden ambos leer `count=0` antes de que cualquiera inserte → se siembran 10 misiones (dos juegos). No hay restricción única que lo impida. **Arreglo:** guardar un flag local (`AsyncStorage`/`useRef`) "seed intentado" para esta sesión, o mover el seed a un único punto de arranque tras login en vez de en `load`. A medio plazo, un `INSERT ... ON CONFLICT` o una RPC idempotente.

### CRIT-REL-08 · `addDays` con clave en formato válido pero fecha inexistente produce un día desplazado silenciosamente — `dates.ts:18-28` · severidad baja
**Problema:** `isValidKey` (dates.ts:8) acepta `d >= 1 && d <= 31` y `m >= 1 && m <= 12` sin validar que el día exista en ese mes. Una clave como `'2026-02-30'` o `'2026-04-31'` pasa la validación; `parseKey` hace `new Date(2026, 1, 30)`, que JS normaliza a **2 de marzo**. Las claves "de verdad" siempre vienen de `dateKey(new Date())`, así que hoy no se da en la práctica; pero cualquier dato corrupto/importado (el exportador escribe fechas a JSON y un reimport futuro las leería) o un `freeze_until` manipulado entraría en este camino y desplazaría comparaciones de cierre sin error visible. **Arreglo:** tras construir el `Date` en `parseKey`, verificar el round-trip: `if (dateKey(date) !== key) throw new Error('Fecha inexistente: ' + key)`. Barato y cierra la clase entera de fechas imposibles.

### CRIT-REL-09 · Lectura de PR y de la sesión del gym no son atómicas: doble sesión y PR fantasma posibles — `gym.tsx:102-152` · severidad baja
**Problema:** `finishTraining` tiene cerrojo `busy`, pero la secuencia es: `fetchMaxLifts` → `createSession` → `insertLifts` → `ensureProfile` → `awardXp` → varios `insertEvent('gym_pr')` → `count events`. No hay garantía de unicidad de sesión por día en cliente (sí existe `fetchSessionForDate`, pero solo se usa para pintar, no para bloquear el insert), así que si `busy` se libera por un error parcial y el usuario reintenta, puede crearse una segunda `gym_sessions` del mismo día con su XP. Además los `gym_pr` se insertan **después** de `awardXp`: si la app muere entre medias, el XP del PR ya se otorgó pero el evento PR no existe → el logro de PRs (`prCount`) y la crónica quedan descuadrados. **Arreglo:** comprobar `fetchSessionForDate(today)` y abortar si ya hay sesión hoy; e idealmente envolver sesión+lifts+eventos en una RPC transaccional (encaja con 0004). El ángulo "PR insertado tras otorgar su XP" es NUEVO respecto a lo ya arreglado.

---

## Mejoras

### Conectividad y offline-first

### REL-001 · Detectar pérdida de red con NetInfo y mostrar banner global "Sistema sin conexión"
**Qué:** añadir `@react-native-community/netinfo`, un provider que exponga `isConnected`, y un banner persistente estilo sistema cuando no hay red. **Dónde:** nuevo `src/lib/network.tsx` + montaje en `app/_layout.tsx:33` · **Impacto:** 5 · **Esfuerzo:** M

### REL-002 · Cola de sincronización para escrituras offline (completar misión, toggles, diario)
**Qué:** persistir en AsyncStorage las mutaciones que fallan por red y reintentarlas al recuperar conexión, en vez de perderlas. **Dónde:** nuevo `src/lib/syncQueue.ts`, consumido por `engine.ts:122` (`completeQuest`) y `data.ts` · **Impacto:** 5 · **Esfuerzo:** L

### REL-003 · Deshabilitar acciones que escriben cuando `isConnected===false`
**Qué:** atenuar/bloquear botones de completar, guardar y reclamar botín sin red, con copy explicativo, en lugar de dejar que fallen. **Dónde:** `QuestItem.tsx:20`, `SystemButton.tsx:13` (prop `requiresNetwork`) · **Impacto:** 4 · **Esfuerzo:** M

### REL-004 · Helper `withTimeout`/`withRetry` para todas las llamadas Supabase
**Qué:** envolver las queries en un wrapper con timeout (p. ej. 15 s) y reintento exponencial para errores transitorios (red, 503). **Dónde:** nuevo `src/lib/db.ts` que envuelve `supabase.ts:17` · **Impacto:** 5 · **Esfuerzo:** M

### REL-005 · `AbortController` + timeout en el `fetch` del Oráculo
**Qué:** cancelar la consulta a Anthropic tras N segundos y traducir `AbortError` a la voz del sistema (ver CRIT-REL-03). **Dónde:** `oracle.ts:78` · **Impacto:** 4 · **Esfuerzo:** S

### REL-006 · Caché local de lectura para arrancar sin red
**Qué:** cachear en AsyncStorage el último `profile`, `quests` y completions de hoy para pintar algo inmediato y offline mientras refresca. **Dónde:** `data.ts:5` (`ensureProfile`), `data.ts:24` (`fetchQuests`) · **Impacto:** 4 · **Esfuerzo:** L

### REL-007 · Reintento manual visible cuando un `load` falla
**Qué:** en vez de solo un `Alert`, dejar un estado de error en pantalla con botón "Reintentar". **Dónde:** todos los `catch` de `load` (p. ej. `(tabs)/index.tsx:77`, `mazmorras.tsx:53`) · **Impacto:** 4 · **Esfuerzo:** M

### REL-008 · Distinguir error de red de error de servidor en los mensajes
**Qué:** mapear `TypeError: Network request failed` a "Sin conexión" y el resto a "Fallo del sistema", para que el usuario sepa si reintentar o esperar. **Dónde:** helper de errores usado por todos los `catch` · **Impacto:** 3 · **Esfuerzo:** S

### REL-009 · Indicador de "sincronizando" durante escrituras largas (subida de evidencia)
**Qué:** `uploadEvidence` (data.ts:95) puede tardar en 3G; mostrar progreso/estado en vez de un botón congelado. **Dónde:** `engine.ts:131`, `QuestItem.tsx:26` · **Impacto:** 3 · **Esfuerzo:** M

### REL-010 · Degradar la subida de avatar/evidencia si falla pero permitir continuar
**Qué:** si la imagen no sube, registrar la completación/avatar sin evidencia y avisar, en lugar de abortar toda la operación. **Dónde:** `engine.ts:129-132`, `perfil.tsx:97-104` · **Impacto:** 3 · **Esfuerzo:** M

### REL-011 · Comprobar `isConnected` antes de exportar datos
**Qué:** `exportAllData` hace 15 selects; sin red falla a mitad. Avisar antes. **Dónde:** `exporter.ts:31` · **Impacto:** 2 · **Esfuerzo:** S

### REL-012 · Marcar completaciones optimistas como "pendientes de confirmar"
**Qué:** el id `local-${quest.id}` (index.tsx:118) no se distingue visualmente; añadir un sutil estado "sin sincronizar" hasta que el `load` lo confirme. **Dónde:** `(tabs)/index.tsx:115-126`, `QuestItem.tsx` · **Impacto:** 3 · **Esfuerzo:** M

### REL-013 · Persistir el `EXPO_PUBLIC_SUPABASE_*` faltante como pantalla de error amable
**Qué:** `supabase.ts:9` lanza un throw crudo que mata Metro/app sin UI; en producción debería ser una pantalla "config incompleta". **Dónde:** `supabase.ts:9` · **Impacto:** 2 · **Esfuerzo:** S

### REL-014 · Detectar sesión expirada y redirigir a login con aviso
**Qué:** si un refresh de token falla offline mucho tiempo, las queries devuelven 401; capturarlo globalmente y mandar a `/login`. **Dónde:** `auth.tsx:21` (`onAuthStateChange`), wrapper de `db.ts` · **Impacto:** 4 · **Esfuerzo:** M

### Optimistic UI y consistencia de estado

### REL-015 · Rollback en `misiones.onToggle` (ver CRIT-REL-02)
**Qué:** revertir el switch y avisar si `setQuestActive` falla. **Dónde:** `(tabs)/misiones.tsx:49-52` · **Impacto:** 4 · **Esfuerzo:** S

### REL-016 · Rollback en `compra.toggle` (ver CRIT-REL-02)
**Qué:** revertir el tachado si `setShoppingDone` falla. **Dónde:** `compra.tsx:39-42` · **Impacto:** 3 · **Esfuerzo:** S

### REL-017 · Confirmar borrados optimistas con re-load tras fallo
**Qué:** `deleteQuest`/`deleteTask`/`deleteCalendarEvent` se llaman sin try/catch dentro de `onPress` de Alert; si fallan, la fila desaparece tras el `load` pero el error no se ve. **Dónde:** `misiones.tsx:62`, `agenda.tsx:138`, `dungeon/[id].tsx:208` · **Impacto:** 3 · **Esfuerzo:** S

### REL-018 · Unificar el patrón "cerrojo síncrono + estado busy" en un hook `useOnce`
**Qué:** el patrón `useRef(Set)` / `saving.current` / `busy` está copiado en index, diario, gym, dungeon con variaciones; extraerlo evita divergencias. **Dónde:** `index.tsx:47`, `diario.tsx:75`, `gym.tsx:68`, `dungeon/[id].tsx:52` · **Impacto:** 3 · **Esfuerzo:** M

### REL-019 · `completeQuest` debería refrescar logros sin segundo viaje optimista inconsistente
**Qué:** tras completar, `index.tsx:129` llama `completionStats` y `unlockAchievements` con datos ya cambiados; si esa parte falla, el XP ya se otorgó pero los logros no — estados parciales. Agrupar o tolerar el fallo del paso de logros sin romper el toast. **Dónde:** `(tabs)/index.tsx:129-142` · **Impacto:** 3 · **Esfuerzo:** M

### REL-020 · Evitar doble `fetchQuests` en `load` cuando hay penalización
**Qué:** `index.tsx:54` y `:58` hacen dos `fetchQuests` seguidos cuando `penaltyXp>0`; reusar el resultado o refetch solo la penalización. **Dónde:** `(tabs)/index.tsx:54-59` · **Impacto:** 2 · **Esfuerzo:** S

### REL-021 · Reconciliar el `profile` optimista con el servidor tras `awardXp`
**Qué:** `awardXp` (engine.ts:173) devuelve un profile calculado en cliente (`{...profile, ...patch}`); si la escritura real difiere (race con otra pantalla), el cliente cree un XP que no es. Releer tras escribir, o confiar en el próximo `load`. **Dónde:** `engine.ts:185-193` · **Impacto:** 3 · **Esfuerzo:** M

### REL-022 · Bloquear doble apertura de `claimLoot` también con `busy` antes del await de status
**Qué:** el guard `dungeon.status !== 'active'` se evalúa con el estado local (puede estar caché); añadir además el cerrojo `busy` ya presente cubre el doble toque, pero un segundo montaje de la pantalla no lo comparte. Documentar/centralizar. **Dónde:** `dungeon/[id].tsx:105-107` · **Impacto:** 2 · **Esfuerzo:** S

### REL-023 · `setProfile` tras `saveName` no normaliza el nombre vacío del servidor
**Qué:** `saveName` (perfil.tsx:107) ignora nombre vacío localmente, bien; pero si el server recorta distinto (trigger), el estado local y el real divergen hasta el próximo focus. **Dónde:** `perfil.tsx:107-113` · **Impacto:** 1 · **Esfuerzo:** S

### REL-024 · Optimistic add en compra/agenda en vez de esperar al `load` completo
**Qué:** añadir un ítem hace `add()` + `await load()` (refetch total); insertar optimista mejora la percepción de velocidad. **Dónde:** `compra.tsx:32-37`, `agenda.tsx:76-91` · **Impacto:** 2 · **Esfuerzo:** M

### REL-025 · Evitar parpadeo del aviso de cierre al refrescar
**Qué:** `dayResult` se setea en cada `load` (index.tsx:70); en pull-to-refresh el panel desaparece y reaparece. Conservar el último resultado salvo cambio real. **Dónde:** `(tabs)/index.tsx:70` · **Impacto:** 2 · **Esfuerzo:** S

### Estados loading / empty / error

### REL-026 · Falta estado de carga inicial en la pantalla Sistema
**Qué:** mientras `profile===null` no se muestra nada bajo la cabecera (el bloque condicional de index.tsx:208 simplemente no pinta); añadir un esqueleto/spinner. **Dónde:** `(tabs)/index.tsx:208` · **Impacto:** 4 · **Esfuerzo:** S

### REL-027 · `perfil.tsx` devuelve un `SafeAreaView` vacío mientras carga
**Qué:** `if (!profile) return <SafeAreaView/>` (perfil.tsx:179) deja pantalla en negro sin feedback. Añadir `ActivityIndicator`. **Dónde:** `perfil.tsx:179-181` · **Impacto:** 3 · **Esfuerzo:** S

### REL-028 · `dungeon/[id].tsx` devuelve `SafeAreaView` vacío mientras carga
**Qué:** igual que perfil; pantalla vacía hasta que llega la mazmorra. **Dónde:** `dungeon/[id].tsx:148-150` · **Impacto:** 3 · **Esfuerzo:** S

### REL-029 · Ningún `load` distingue "cargando" de "vacío"
**Qué:** todas las pantallas inicializan listas a `[]` y pintan el empty-state de inmediato; durante el primer fetch el usuario ve "Sin misiones todavía" aunque sí las haya. Añadir un flag `loading` y un esqueleto. **Dónde:** `misiones.tsx:25`, `mazmorras.tsx:34`, `agenda.tsx:45-47`, `gym.tsx:54-56`, `compra.tsx:17`, `dieta.tsx:36` · **Impacto:** 4 · **Esfuerzo:** M

### REL-030 · Empty-state real en el informe cuando no hay datos
**Qué:** `informe.tsx` pinta KPIs en 0 y un heatmap vacío sin explicar; el narrative cubre solo el primer bloque. Añadir empty-state en KPIs/heatmap. **Dónde:** `informe.tsx:114-158` · **Impacto:** 3 · **Esfuerzo:** S

### REL-031 · Estado de error dedicado por pantalla, no solo `Alert`
**Qué:** un `Alert` se descarta y deja la pantalla vacía sin pista de qué pasó; añadir un panel de error con reintento (ver REL-007). **Dónde:** todos los `catch` de `load` · **Impacto:** 4 · **Esfuerzo:** M

### REL-032 · Spinner en el primer fetch del Oráculo (key)
**Qué:** `getApiKey()` (oraculo.tsx:38) corre en `useEffect` sin estado de carga; el campo aparece vacío un instante aunque haya key guardada. **Dónde:** `oraculo.tsx:37-44` · **Impacto:** 2 · **Esfuerzo:** S

### REL-033 · Empty-state de "crónica de hoy" diferenciado de error
**Qué:** `diario.tsx:193` muestra "aún no ha registrado actividad" tanto si está vacío como si el fetch de eventos falló. **Dónde:** `diario.tsx:90-97,193` · **Impacto:** 2 · **Esfuerzo:** S

### REL-034 · Skeleton para el avatar mientras se firma la URL
**Qué:** `signedUrl` (perfil.tsx:71) tarda; el hexágono salta de letra a imagen. Placeholder estable. **Dónde:** `perfil.tsx:71-73,196-201` · **Impacto:** 2 · **Esfuerzo:** S

### REL-035 · Estado "guardando" en formularios de creación (misión/evento/mazmorra)
**Qué:** `createQuest`/`createCalendarEvent` no bloquean el botón mientras escriben (solo mazmorra y gym lo hacen); doble submit posible. **Dónde:** `misiones.tsx:43-47`, `agenda.tsx:76-91` (botón "Añadir al calendario" sin `loading`) · **Impacto:** 3 · **Esfuerzo:** S

### REL-036 · Loading en `generateList` de dieta ya existe pero sin bloquear duplicados de ítems
**Qué:** `generateList` (dieta.tsx:84) tiene `busy` pero `addShoppingItems` puede duplicar si se reabre la pantalla; revisar idempotencia. **Dónde:** `dieta.tsx:84-104` · **Impacto:** 2 · **Esfuerzo:** S

### REL-037 · Indicar "sin más entradas" al final de listas paginadas
**Qué:** diario limita a 14 entradas (diario.tsx:88) sin decir que hay más; añadir nota o "ver todas". **Dónde:** `diario.tsx:204-223` · **Impacto:** 2 · **Esfuerzo:** S

### Zonas horarias y cambio de día

### REL-038 · Re-disparar el cierre al volver de background (ver CRIT-REL-04)
**Qué:** `AppState` → active debe forzar `load()` para procesar la medianoche cruzada. **Dónde:** `(tabs)/index.tsx:88`, `supabase.ts:27` · **Impacto:** 5 · **Esfuerzo:** M

### REL-039 · Temporizador a medianoche para refrescar la pantalla Sistema
**Qué:** programar un `setTimeout` hasta la próxima medianoche local que invalide `today` y recargue, para la app abierta sin tocar. **Dónde:** `(tabs)/index.tsx:82` · **Impacto:** 4 · **Esfuerzo:** M

### REL-040 · Centralizar la hora del dispositivo y avisar de saltos hacia atrás
**Qué:** `processPendingDays` no contempla `last_day_processed > yesterday` (reloj movido hacia atrás o viaje de zona): cae en el `>= yesterday → return null` y nunca avanza, pero tampoco corrige. Detectar y registrar. **Dónde:** `engine.ts:40-42` · **Impacto:** 3 · **Esfuerzo:** S

### REL-041 · Documentar y centralizar que todo el cómputo es en hora LOCAL del dispositivo
**Qué:** `dateKey` usa `getFullYear/Month/Date` locales; los eventos se filtran por `created_at` ISO (UTC) en `diario.tsx:90-93`. Mezclar local (claves de día) y UTC (timestamps) puede descuadrar la "crónica de hoy" cerca de medianoche según zona. **Dónde:** `diario.tsx:90-93`, `journal.ts:57` · **Impacto:** 4 · **Esfuerzo:** M

### REL-042 · La "crónica de hoy" calcula los límites del día en local pero compara contra `created_at` UTC
**Qué:** `start`/`end` (diario.tsx:90-92) son medianoche local convertidas a ISO; correcto si el server guarda UTC, pero frágil: un evento creado a las 23:30 local en UTC+2 cae en el día siguiente UTC y podría escaparse. Verificar con tests. **Dónde:** `diario.tsx:90-93` · **Impacto:** 3 · **Esfuerzo:** M

### REL-043 · Validar día real del mes en `isValidKey`/`parseKey` (ver CRIT-REL-08)
**Qué:** round-trip check para rechazar 30-feb. **Dónde:** `dates.ts:18-22` · **Impacto:** 2 · **Esfuerzo:** S

### REL-044 · `dayLabel` recomputa `addDays(today,1)` en cada render de cada día
**Qué:** en `agenda.tsx:34` se llama `addDays(today, 1)` dentro de `dayLabel`, ejecutada en el `.map` de 14 días en cada render. Precalcular `tomorrow` una vez. **Dónde:** `agenda.tsx:32-39,105` · **Impacto:** 2 · **Esfuerzo:** S

### REL-045 · `formatLongDate()` en la cabecera no se actualiza al cambiar el día
**Qué:** `index.tsx:205` pinta `formatLongDate()` calculado en render; sin re-render a medianoche, muestra la fecha de ayer. Atado a REL-039. **Dónde:** `(tabs)/index.tsx:205` · **Impacto:** 2 · **Esfuerzo:** S

### REL-046 · Tests de zona horaria para el cierre (DST y cruce de año)
**Qué:** `closing.test.ts` cubre lógica pura pero no el comportamiento de `addDays` en cambios de hora (DST) ni 31-dic→1-ene. Añadir casos. **Dónde:** `src/lib/__tests__/dates.test.ts` · **Impacto:** 3 · **Esfuerzo:** S

### REL-047 · Congelación: clarificar inclusividad del último día
**Qué:** `activateFreeze` usa `addDays(today, freezeDays-1)` (perfil.tsx:117) y el cierre congela `day <= freezeUntil` (closing.ts:52); la semántica "3 días incluye hoy" es correcta pero no está testeada en frontera. **Dónde:** `perfil.tsx:117`, `closing.ts:52` · **Impacto:** 2 · **Esfuerzo:** S

### Telemetría y observabilidad

### REL-048 · Integrar Sentry (crash + errores) — no existe ninguna telemetría
**Qué:** añadir `@sentry/react-native` para capturar crashes y excepciones no manejadas; hoy un fallo en producción es invisible. **Dónde:** nuevo init en `app/_layout.tsx:12` · **Impacto:** 5 · **Esfuerzo:** M

### REL-049 · Enviar a Sentry los errores que hoy solo van a `Alert`
**Qué:** cada `catch (e) { Alert.alert(...) }` debería además `Sentry.captureException(e)` con contexto (pantalla, userId). **Dónde:** todos los `catch` de las pantallas · **Impacto:** 4 · **Esfuerzo:** M

### REL-050 · Capturar `UnhandledPromiseRejection` global
**Qué:** los toggles sin try/catch (REL-015/016) y otros awaits sueltos generan rejections que nadie ve; un handler global los registra. **Dónde:** `app/_layout.tsx:23` · **Impacto:** 4 · **Esfuerzo:** S

### REL-051 · Breadcrumbs de navegación y acciones clave
**Qué:** registrar "completó misión", "cerró día", "abrió oráculo" como breadcrumbs para reconstruir el camino a un crash. **Dónde:** `engine.ts`, `oracle.ts` · **Impacto:** 3 · **Esfuerzo:** M

### REL-052 · Métrica de fallos de subida de evidencia/avatar
**Qué:** contar/loguear cuántas subidas fallan (storage) para dimensionar el problema offline. **Dónde:** `data.ts:95,109` · **Impacto:** 2 · **Esfuerzo:** S

### REL-053 · Loguear latencia de las consultas Supabase lentas
**Qué:** medir tiempos en el wrapper de `db.ts` (REL-004) y reportar las que pasen de un umbral. **Dónde:** `src/lib/db.ts` (nuevo) · **Impacto:** 2 · **Esfuerzo:** M

### REL-054 · Filtrar PII y la API key del Oráculo antes de enviar a telemetría
**Qué:** asegurar que la key de Anthropic y el contenido del diario nunca lleguen a Sentry (scrubbing). **Dónde:** init de Sentry, `oracle.ts:25` · **Impacto:** 4 · **Esfuerzo:** S

### REL-055 · Opt-in de telemetría en Perfil (privacidad de app personal)
**Qué:** un único usuario, pero conviene un toggle "enviar diagnósticos" desactivable. **Dónde:** `perfil.tsx` (nueva válvula) · **Impacto:** 2 · **Esfuerzo:** S

### REL-056 · Registrar el `stop_reason` y respuestas malformadas del Oráculo
**Qué:** `oracle.ts:102` ignora `stop_reason`; loguear cuando es `max_tokens` o cuando `valid.length===0` para ajustar el prompt. **Dónde:** `oracle.ts:102-128` · **Impacto:** 3 · **Esfuerzo:** S

### Reintentos y resiliencia

### REL-057 · Reintento con backoff para errores 5xx y de red en Supabase
**Qué:** distinguir errores reintentables (red, 502/503/504) de los definitivos (RLS, 400) y reintentar solo los primeros. **Dónde:** `src/lib/db.ts` (nuevo), envuelve todo `data.ts`/`dungeons.ts`/`body.ts` · **Impacto:** 4 · **Esfuerzo:** M

### REL-058 · Reintento del Oráculo en 429/529 con espera sugerida
**Qué:** `oracle.ts:96-97` ya da mensaje para 429/529; añadir reintento automático con un par de intentos espaciados. **Dónde:** `oracle.ts:94-100` · **Impacto:** 3 · **Esfuerzo:** S

### REL-059 · Reintentar la firma de URL de avatar/evidencia
**Qué:** `signedUrl` (data.ts:118) devuelve `null` silencioso si falla; reintentar una vez antes de rendirse. **Dónde:** `data.ts:118-121`, `perfil.tsx:71` · **Impacto:** 2 · **Esfuerzo:** S

### REL-060 · Idempotencia de `ensureDailyNotifications`
**Qué:** se llama en cada montaje de Sistema (index.tsx:88-90) y hace `cancelAll` + reprograma cada vez; debería ser idempotente o ejecutarse una vez al día. **Dónde:** `notifications.ts:16-49`, `(tabs)/index.tsx:88` · **Impacto:** 3 · **Esfuerzo:** S

### REL-061 · No tragar silenciosamente todos los errores de notificaciones
**Qué:** `notifications.ts:50` hace `catch {}` vacío; al menos en dev debería loguear por qué no se programaron. **Dónde:** `notifications.ts:50-52` · **Impacto:** 2 · **Esfuerzo:** S

### REL-062 · Reintento de `exportAllData` parcial
**Qué:** si falla la tabla 12 de 15, se pierde todo el export; acumular por tabla y permitir reintentar las que faltan. **Dónde:** `exporter.ts:31-35` · **Impacto:** 2 · **Esfuerzo:** M

### REL-063 · Circuit breaker para el Oráculo tras fallos repetidos
**Qué:** si la API falla N veces seguidas, desactivar temporalmente el botón con un mensaje, evitando reintentos inútiles. **Dónde:** `oraculo.tsx:52-74` · **Impacto:** 2 · **Esfuerzo:** M

### REL-064 · Tolerar `completionStats`/`countEntries` caídos sin romper la acción principal
**Qué:** tras completar misión o guardar diario, si el `count` de logros falla, la acción ya hecha no debe parecer fallida. **Dónde:** `(tabs)/index.tsx:129`, `diario.tsx:122-123` · **Impacto:** 3 · **Esfuerzo:** S

### REL-065 · Reintentar `processPendingDays` si la escritura del cierre falla a medias
**Qué:** `engine.ts:73` escribe el patch del profile y luego inserta penalización/eventos; si el segundo paso falla, `last_day_processed` ya avanzó y el día queda "cerrado" sin penalización. Hacer el orden seguro o transaccional. **Dónde:** `engine.ts:73-97` · **Impacto:** 4 · **Esfuerzo:** M

### Rendimiento

### REL-066 · `mazmorras.tsx` hace N×M filtros para contar tareas por mazmorra
**Qué:** dentro del `.map` de mazmorras (mazmorras.tsx:47-52) se filtra `rows` dos veces por cada mazmorra; con muchas mazmorras/tareas es O(n·m). Agrupar en un `Map` una sola vez. **Dónde:** `mazmorras.tsx:46-52` · **Impacto:** 3 · **Esfuerzo:** S

### REL-067 · `informe.tsx` recalcula `bestDay` con un filtro anidado por completación
**Qué:** `for (const c of thisWeek) { thisWeek.filter(...) }` (informe.tsx:65-70) es O(n²). Precalcular XP por día en un `Map`. **Dónde:** `informe.tsx:63-71` · **Impacto:** 3 · **Esfuerzo:** S

### REL-068 · Memoizar los derivados pesados del informe
**Qué:** todo el bloque de cálculo (informe.tsx:38-96) corre en cada render; envolver en `useMemo` dependiente de `completions`/`quests`. **Dónde:** `informe.tsx:38-96` · **Impacto:** 3 · **Esfuerzo:** S

### REL-069 · `fetchMaxLifts` trae TODOS los lifts para calcular máximos en cliente
**Qué:** `body.ts:88` selecciona toda la tabla `gym_lifts` y agrega en JS; con historial largo crece sin techo. Mover a una vista/agg SQL `max(weight) group by exercise_name`. **Dónde:** `body.ts:88-99` · **Impacto:** 3 · **Esfuerzo:** M

### REL-070 · `completionStats` hace dos count completos en cada completación
**Qué:** tras cada misión (index.tsx:129) se cuentan total y con-evidencia con dos round-trips; cachear o calcular incremental. **Dónde:** `data.ts:76-85`, `(tabs)/index.tsx:129` · **Impacto:** 3 · **Esfuerzo:** M

### REL-071 · Listas largas sin `FlatList` (todo en `ScrollView` + `.map`)
**Qué:** misiones, entradas de diario, logros, agenda renderizan todo de golpe; con datos abundantes conviene virtualizar. **Dónde:** `misiones.tsx:85`, `diario.tsx:207`, `perfil.tsx:282` · **Impacto:** 2 · **Esfuerzo:** L

### REL-072 · `sorted = [...todayQuests].sort(...)` recrea y reordena en cada render
**Qué:** index.tsx:191 clona y ordena en cada render; memoizar con `useMemo` sobre `todayQuests`. **Dónde:** `(tabs)/index.tsx:191-193` · **Impacto:** 2 · **Esfuerzo:** S

### REL-073 · `questById`/`questsScheduledOn` recomputados por render en agenda e informe
**Qué:** `new Map(quests.map(...))` (informe.tsx:51) y `questsScheduledOn` por día (agenda.tsx:106) sin memo. **Dónde:** `informe.tsx:51`, `agenda.tsx:105-110` · **Impacto:** 2 · **Esfuerzo:** S

### REL-074 · `QuestItem` no está memoizado y recibe `onComplete` nuevo por render
**Qué:** la lista de misiones re-renderiza todos los ítems al tocar uno; `React.memo` + `useCallback` reduce trabajo. **Dónde:** `QuestItem.tsx:16`, `(tabs)/index.tsx:295-305` · **Impacto:** 2 · **Esfuerzo:** S

### REL-075 · Subir evidencia en base64 infla memoria; preferir blob/stream
**Qué:** `captureEvidence` pide `base64:true` (index.tsx:101) y se decodifica entero en memoria; imágenes grandes pueden petar en gama baja. Evaluar subir por URI. **Dónde:** `(tabs)/index.tsx:98-104`, `data.ts:95-107` · **Impacto:** 3 · **Esfuerzo:** M

### REL-076 · `signedUrl` con 7 días de validez se refirma en cada focus de Perfil
**Qué:** cada entrada a Perfil vuelve a firmar la URL del avatar (perfil.tsx:71); cachear hasta caducidad. **Dónde:** `perfil.tsx:63-77` · **Impacto:** 2 · **Esfuerzo:** S

### REL-077 · `fetchCompletionsSince(-91d)` en informe trae todo para pintar 13 semanas
**Qué:** correcto para el heatmap, pero se recarga entero en cada focus; cachear o limitar columnas. **Dónde:** `informe.tsx:23`, `data.ts:61-68` · **Impacto:** 2 · **Esfuerzo:** S

### Accesibilidad

### REL-078 · Faltan `accessibilityLabel`/`accessibilityRole` en los `Pressable` de acción
**Qué:** botones de icono (añadir, borrar, back) no anuncian nada a lectores de pantalla. **Dónde:** `misiones.tsx:73`, `mazmorras.tsx:87`, `gym.tsx:181-187`, `dungeon/[id].tsx:159-167` · **Impacto:** 3 · **Esfuerzo:** M

### REL-079 · `QuestItem` no expone estado "completada/ocupada" a accesibilidad
**Qué:** el checkbox visual no tiene `accessibilityState={{ checked, busy, disabled }}`. **Dónde:** `QuestItem.tsx:20-31` · **Impacto:** 3 · **Esfuerzo:** S

### REL-080 · Switches sin etiqueta accesible
**Qué:** los `Switch` de misiones (activar) y jefe no tienen label asociado para VoiceOver/TalkBack. **Dónde:** `misiones.tsx:101-106`, `dungeon/[id].tsx:268-273` · **Impacto:** 3 · **Esfuerzo:** S

### REL-081 · Contraste de texto tenue por debajo de WCAG AA
**Qué:** `textFaint #56698A` y `textDim #7A8CA6` sobre `bg #060B16` rozan o no llegan a 4.5:1 en tamaños pequeños (12 px). Verificar y subir donde haga falta. **Dónde:** `theme.ts:19-20`, uso masivo en metas/hints · **Impacto:** 3 · **Esfuerzo:** M

### REL-082 · Áreas táctiles por debajo de 44×44 en varios iconos
**Qué:** algunos `Pressable` de icono usan `hitSlop={8}` sobre iconos de 18-20 px, quedando bajo el mínimo recomendado. **Dónde:** `dungeon/[id].tsx:187`, `gym.tsx:255-275` · **Impacto:** 2 · **Esfuerzo:** S

### REL-083 · No se respeta `prefers-reduced-motion` en animaciones
**Qué:** `XpToast` y `LevelUpOverlay` animan sin comprobar la preferencia de reducir movimiento (`AccessibilityInfo.isReduceMotionEnabled`). **Dónde:** `XpToast.tsx:16`, `components/LevelUpOverlay.tsx` · **Impacto:** 2 · **Esfuerzo:** S

### REL-084 · Tamaño de fuente fijo ignora el ajuste del sistema
**Qué:** todos los `fontSize` son numéricos sin `allowFontScaling`/escala; usuarios con texto grande no se benefician. **Dónde:** `theme.ts`, estilos de todas las pantallas · **Impacto:** 2 · **Esfuerzo:** L

### REL-085 · Anunciar cambios de estado dinámicos (XP ganado, nivel)
**Qué:** el toast de XP y el overlay de nivel no usan `AccessibilityInfo.announceForAccessibility`. **Dónde:** `XpToast.tsx`, `(tabs)/index.tsx:127` · **Impacto:** 2 · **Esfuerzo:** S

### REL-086 · Inputs de fecha/hora manuales sin teclado ni hints accesibles
**Qué:** la fecha del evento se teclea como texto libre (agenda.tsx:192) sin `accessibilityHint` ni selector; difícil con lector. **Dónde:** `agenda.tsx:191-199` · **Impacto:** 2 · **Esfuerzo:** M

### Consistencia de copy y voz del sistema

### REL-087 · "Error del sistema / Fallo desconocido" repetido literal en ~12 sitios
**Qué:** el mismo string está duplicado en cada `catch`; centralizar en `voice.ts` para una sola voz y evitar divergencias. **Dónde:** `voice.ts`, todos los `catch` (p. ej. `index.tsx:78`, `misiones.tsx:33`) · **Impacto:** 3 · **Esfuerzo:** S

### REL-088 · Mensajes de error crudos del backend se muestran al usuario
**Qué:** `e.message` de Supabase/Postgres (en inglés, técnico) llega tal cual al `Alert`; envolver en copy de la voz del sistema. **Dónde:** todos los `catch` que hacen `e instanceof Error ? e.message : ...` · **Impacto:** 3 · **Esfuerzo:** M

### REL-089 · "Generala" sin tilde en el empty-state de compra
**Qué:** `compra.tsx:81` dice "Generala desde la dieta" (debería ser "Génerala" o reformular). **Dónde:** `compra.tsx:81` · **Impacto:** 1 · **Esfuerzo:** S

### REL-090 · Inconsistencia "AAAA-MM-DD" vs "YYYY-MM-DD" en el copy
**Qué:** la UI pide "AAAA-MM-DD" (agenda.tsx:191) pero los comentarios/código usan YYYY; unificar el formato mostrado al usuario español. **Dónde:** `agenda.tsx:78,191` · **Impacto:** 1 · **Esfuerzo:** S

### REL-091 · Mezcla de mayúsculas: títulos a veces `toUpperCase()` en runtime, a veces en el string
**Qué:** algunos títulos se ponen en mayúsculas con CSS/JS y otros vienen ya en mayúsculas, dificultando cambios de copy. Unificar criterio. **Dónde:** `index.tsx:215`, `perfil.tsx:215`, varios · **Impacto:** 1 · **Esfuerzo:** S

### REL-092 · Voz del sistema ausente en mensajes de éxito de varias acciones
**Qué:** "Lista generada", "Guardada", "MISIONES ASIGNADAS" no pasan por `voice.ts`; el tono varía. Llevar los éxitos también a la voz. **Dónde:** `dieta.tsx:97`, `oraculo.tsx:49,100` · **Impacto:** 2 · **Esfuerzo:** S

### REL-093 · El plural "(s)" / "misión(es)" se resuelve a mano en varios sitios
**Qué:** `pendiente(s)`, `nivel(es)`, `misión(es)`, `día/días` se construyen ad-hoc; un helper de pluralización española evita inconsistencias. **Dónde:** `index.tsx:312`, `oraculo.tsx:100,192`, `perfil.tsx:352` · **Impacto:** 2 · **Esfuerzo:** M

### REL-094 · Copy de "+25% XP" vs "×1,25" inconsistente
**Qué:** el Alert dice "+25% XP" (index.tsx:169) y el toast "evidencia ×1,25" (XpToast.tsx:35); unificar la forma de expresar el bonus. **Dónde:** `(tabs)/index.tsx:169`, `XpToast.tsx:35` · **Impacto:** 1 · **Esfuerzo:** S

### REL-095 · Términos "objetivos" vs "tareas/monstruos" mezclados en mazmorras
**Qué:** la UI alterna entre "objetivos", "tareas" y "monstruos/jefes" para lo mismo; fijar vocabulario. **Dónde:** `mazmorras.tsx:115`, `dungeon/[id].tsx:173,185,193` · **Impacto:** 1 · **Esfuerzo:** S

### REL-096 · Mensaje del seed inicial no usa `voice.ts`
**Qué:** "El sistema te da la bienvenida" (index.tsx:72) está hardcodeado fuera de la voz centralizada. **Dónde:** `(tabs)/index.tsx:72-75` · **Impacto:** 1 · **Esfuerzo:** S

### Edge cases

### REL-097 · `result.assets[0]?.base64` puede ser `undefined` y romper la evidencia silenciosamente
**Qué:** si la cámara devuelve un asset sin base64 (raro pero posible), `captureEvidence` retorna `null` y la misión se completa sin evidencia sin avisar al usuario que pidió foto. **Dónde:** `(tabs)/index.tsx:104` · **Impacto:** 2 · **Esfuerzo:** S

### REL-098 · `freeze_until` exactamente igual a `today` — semántica de frontera
**Qué:** `frozen = freeze_until >= today` (index.tsx:190) incluye hoy; el cierre congela `day <= freezeUntil`. Verificar que reanudar el mismo día del fin no deje un hueco. **Dónde:** `(tabs)/index.tsx:190`, `closing.ts:52` · **Impacto:** 2 · **Esfuerzo:** S

### REL-099 · Día sin misiones programadas no rompe racha pero tampoco la avanza
**Qué:** `closing.ts:61` solo toca la racha si `scheduled.length>0`; un usuario que solo programa L-V mantiene racha el finde sin actividad. Es diseño, pero conviene un test que lo fije. **Dónde:** `closing.ts:61-84` · **Impacto:** 2 · **Esfuerzo:** S

### REL-100 · Penalización con misión `is_penalty` fallida se ignora (correcto) pero sin cobertura
**Qué:** `closing.ts:78` salta `q.is_penalty` al sumar penalización; falta test que garantice que fallar la propia misión de penalización no genera otra. **Dónde:** `closing.ts:77-81` · **Impacto:** 2 · **Esfuerzo:** S

### REL-101 · Nombre de perfil con solo espacios pasa a avatar vacío
**Qué:** `profile.name.charAt(0).toUpperCase()` (index.tsx:212) sobre nombre " " da un espacio; `saveName` recorta pero el estado inicial del server podría tenerlo. **Dónde:** `(tabs)/index.tsx:212`, `perfil.tsx:199` · **Impacto:** 1 · **Esfuerzo:** S

### REL-102 · `days_of_week` vacío en una misión normal la deja invisible para siempre
**Qué:** `questsScheduledOn` (closing.ts:13) requiere `days_of_week.includes(wd)`; si por edición queda `[]`, la misión nunca aparece ni se puede completar, pero sigue "activa". Avisar al crear/editar. **Dónde:** `closing.ts:11-14`, `misiones.tsx` (form) · **Impacto:** 3 · **Esfuerzo:** S

### REL-103 · Hora del evento como texto libre admite "99:99"
**Qué:** `time` (agenda.tsx:201) no se valida; cualquier string se guarda y se muestra. Validar formato HH:MM. **Dónde:** `agenda.tsx:82-86,201-207` · **Impacto:** 2 · **Esfuerzo:** S

### REL-104 · `parseFloat`/`parseInt` de pesos/reps aceptan negativos y NaN→0 silencioso
**Qué:** `gym.tsx:108-111` convierte entradas a número con fallback 0; un "-5" o "abc" se vuelve 0 o negativo sin avisar, falseando PRs. **Dónde:** `gym.tsx:106-112` · **Impacto:** 2 · **Esfuerzo:** S

### REL-105 · Ingredientes con separadores mixtos pueden generar entradas vacías
**Qué:** `ingredientsFromPlan` (body.ts:183) parte por `[,;\n]` y filtra vacíos; bien, pero "a,,b" o espacios dobles conviene normalizar más. **Dónde:** `body.ts:178-193` · **Impacto:** 1 · **Esfuerzo:** S

### REL-106 · Mazmorra sin tareas no puede reclamar botín (correcto) pero el empty-state no lo dice
**Qué:** `allDone` exige `tasks.length>0` (dungeon/[id].tsx:153); una mazmorra vacía nunca muestra el botón ni explica que hay que añadir objetivos. **Dónde:** `dungeon/[id].tsx:152-153,236` · **Impacto:** 2 · **Esfuerzo:** S

### REL-107 · `xpByStat[topStat]` puede ser 0 → barra del informe divide por `max(1,...)` (bien) pero topStat arbitrario
**Qué:** con semana vacía, `topStat` cae en 'FUE' por el reduce inicial (informe.tsx:57) aunque todo sea 0; el copy "tu área dominante" miente. Manejar el caso "sin datos". **Dónde:** `informe.tsx:57,86` · **Impacto:** 2 · **Esfuerzo:** S

### REL-108 · `signedUrl` null deja `avatarUri` colgado del valor anterior
**Qué:** si la firma falla, `setAvatarUri(null)` no se llama (perfil.tsx:72 solo setea si hay url); un avatar borrado podría seguir mostrándose. **Dónde:** `perfil.tsx:71-73` · **Impacto:** 1 · **Esfuerzo:** S

### REL-109 · Reapertura rápida del modal de freeze conserva selección anterior
**Qué:** `freezeReason`/`freezeDays` no se resetean al cerrar; reabrir muestra la última elección, lo que puede confundir. **Dónde:** `perfil.tsx:55-57,332` · **Impacto:** 1 · **Esfuerzo:** S

### REL-110 · El Oráculo descarta misiones inválidas sin avisar cuántas
**Qué:** `oracle.ts:115` filtra propuestas inválidas; si de 6 quedan 3, el usuario no sabe que se cayeron 3. Informar discretamente. **Dónde:** `oracle.ts:115-128`, `oraculo.tsx:65-67` · **Impacto:** 2 · **Esfuerzo:** S

### Refactor y mantenibilidad

### REL-111 · Patrón `useFocusEffect` vs `useEffect` inconsistente entre pantallas
**Qué:** index/misiones/mazmorras/agenda/perfil usan `useFocusEffect`; gym/dieta/compra/dungeon usan `useEffect`. Las segundas no se refrescan al volver tras editar en otra pantalla (p. ej. crear un día de gym y volver no refleja cambios sin remount). Unificar a `useFocusEffect`. **Dónde:** `gym.tsx:83`, `dieta.tsx:51`, `compra.tsx:28`, `dungeon/[id].tsx:64` · **Impacto:** 4 · **Esfuerzo:** S

### REL-112 · Extraer un hook `useScreenData(load)` con loading/error/refresh estándar
**Qué:** cada pantalla reimplementa load+catch+refresh; un hook común reduce el copy y unifica estados (apoya REL-029/031). **Dónde:** nuevo `src/lib/useScreenData.ts`; consumidores: todas las pantallas · **Impacto:** 4 · **Esfuerzo:** M

### REL-113 · Centralizar el manejo de errores en un `reportError(e, ctx)`
**Qué:** un único punto que decide: traducir copy + `Sentry.captureException` + `Alert`. Hoy está disperso y divergente. **Dónde:** nuevo `src/lib/errors.ts`; consumidores: todos los `catch` · **Impacto:** 4 · **Esfuerzo:** M

### REL-114 · Tipar las filas de Supabase en vez de `as Tipo`
**Qué:** todo `data.ts`/`dungeons.ts`/`body.ts` hace casts `as Quest`/`as Profile`; generar tipos del esquema (supabase gen types) evita drift silencioso entre BD y `types.ts`. **Dónde:** `data.ts` passim, `types.ts` · **Impacto:** 3 · **Esfuerzo:** L

### REL-115 · `insertEvent` ignora su error de escritura
**Qué:** `data.ts:87-93` no comprueba `error`; los eventos (crónica, logros de PR) pueden no guardarse en silencio. Al menos loguear. **Dónde:** `data.ts:87-93` · **Impacto:** 3 · **Esfuerzo:** S

### REL-116 · `DAY_NAMES`/`DAY_LABELS`/`DAY_CHIPS` duplicados en 5 archivos
**Qué:** las etiquetas de días de la semana están redefinidas en agenda, misiones, dieta, gym, oraculo; centralizar en `dates.ts`/`theme.ts`. **Dónde:** `agenda.tsx`, `misiones.tsx:14`, `dieta.tsx:30`, `gym.tsx:42`, `oraculo.tsx:112` · **Impacto:** 2 · **Esfuerzo:** S

### REL-117 · `MODULES`/rutas mágicas como strings sin tipo central
**Qué:** las rutas (`/gym`, `/dieta`...) viven sueltas en index.tsx:26 y en cada `router.push`; un mapa tipado evita rutas rotas. **Dónde:** `(tabs)/index.tsx:25-32` · **Impacto:** 2 · **Esfuerzo:** S

### REL-118 · Lógica de "frozen" duplicada en index y perfil
**Qué:** `freeze_until != null && freeze_until >= today` se repite (index.tsx:190, perfil.tsx:187); extraer `isFrozen(profile, today)`. **Dónde:** `(tabs)/index.tsx:190`, `perfil.tsx:187` · **Impacto:** 2 · **Esfuerzo:** S

### REL-119 · El bloque redundante de limpieza de freeze en `processPendingDays`
**Qué:** se limpia el freeze vencido en engine.ts:31-34 y otra vez en :69-72 dentro del patch; el segundo es inalcanzable en la práctica (ya se limpió y `profile.freeze_until` se anuló). Simplificar. **Dónde:** `engine.ts:31-34,69-72` · **Impacto:** 2 · **Esfuerzo:** S

### REL-120 · `formatLongDate`/`dayLabel` con `toLocaleDateString` dependen del locale del dispositivo
**Qué:** se asume `es-ES`; en un dispositivo con otro locale por defecto el `Intl` podría variar capitalización/abreviatura. Fijar locale explícito ya se hace, pero conviene un único formateador central. **Dónde:** `dates.ts:39-42`, `agenda.tsx:37` · **Impacto:** 2 · **Esfuerzo:** S

### REL-121 · Constantes de animación (duraciones) repartidas sin tokens
**Qué:** 180/900/350 ms en XpToast y otros valores sueltos; centralizar en `theme.ts` para coherencia de motion. **Dónde:** `XpToast.tsx:22-25` · **Impacto:** 1 · **Esfuerzo:** S

### REL-122 · `console`/sin logger: no hay capa de logging propia
**Qué:** no existe `log.debug/info/error`; un logger fino (no-op en prod salvo Sentry) ayudaría a diagnosticar offline. **Dónde:** nuevo `src/lib/log.ts` · **Impacto:** 2 · **Esfuerzo:** S

### REL-123 · `isServer` guard repetible: exponer helper de entorno
**Qué:** `typeof window === 'undefined'` (supabase.ts:15) podría centralizarse junto a otras detecciones de plataforma. **Dónde:** `supabase.ts:15` · **Impacto:** 1 · **Esfuerzo:** S

### Tests

### REL-124 · Tests de `processPendingDays` (engine) con red mockeada
**Qué:** el cierre real (escrituras, orden de defensas, freeze) no tiene tests; solo la parte pura. Cubrir engine con Supabase mockeado. **Dónde:** nuevo `src/lib/__tests__/engine.test.ts` · **Impacto:** 4 · **Esfuerzo:** M

### REL-125 · Test de regresión del reinicio del `XpToast` (CRIT-REL-01)
**Qué:** asegurar que cambiar `onDone` no reinicia la animación. **Dónde:** nuevo `src/components/__tests__/XpToast.test.tsx` · **Impacto:** 3 · **Esfuerzo:** S

### REL-126 · Tests del rollback optimista de toggles (CRIT-REL-02)
**Qué:** simular fallo de `setShoppingDone`/`setQuestActive` y verificar que el estado revierte. **Dónde:** nuevos tests de `compra`/`misiones` · **Impacto:** 3 · **Esfuerzo:** M

### REL-127 · Tests de zona horaria/medianoche (REL-038/041/042)
**Qué:** fijar el comportamiento del cambio de día y de la "crónica de hoy" cerca de medianoche en distintas zonas. **Dónde:** `src/lib/__tests__/dates.test.ts`, nuevo para diario · **Impacto:** 3 · **Esfuerzo:** M

### REL-128 · Test de `isValidKey` rechazando 30-feb (CRIT-REL-08)
**Qué:** caso explícito de fecha imposible una vez añadido el round-trip. **Dónde:** `src/lib/__tests__/dates.test.ts` · **Impacto:** 2 · **Esfuerzo:** S

### REL-129 · Tests del wrapper `withRetry/withTimeout` (REL-004/057)
**Qué:** verificar reintentos solo en errores transitorios y corte por timeout. **Dónde:** nuevo `src/lib/__tests__/db.test.ts` · **Impacto:** 3 · **Esfuerzo:** M

### REL-130 · Test de validación del Oráculo (enums + descarte)
**Qué:** `oracle.ts:115` ya valida; añadir test con respuestas malformadas (stat 'STR', días fuera de rango) para garantizar el filtrado. **Dónde:** nuevo `src/lib/__tests__/oracle.test.ts` · **Impacto:** 3 · **Esfuerzo:** S

### REL-131 · Test de idempotencia de `seedDefaultQuests` (CRIT-REL-07)
**Qué:** dos llamadas concurrentes no deben sembrar el doble. **Dónde:** nuevo test de `data.ts` · **Impacto:** 2 · **Esfuerzo:** S

### REL-132 · Test de `ingredientsFromPlan` (dedup, separadores, vacíos)
**Qué:** lógica pura sin cobertura; fácil de fijar. **Dónde:** `src/lib/__tests__/body.test.ts` (nuevo) · **Impacto:** 2 · **Esfuerzo:** S

### REL-133 · Test de `streakMultiplier`/`levelFromXp` en fronteras ya existe parcialmente: ampliar a XP negativo/0/tope
**Qué:** robustecer `game.test.ts` con entradas corruptas (xp negativo, nivel 999). **Dónde:** `src/lib/__tests__/game.test.ts` · **Impacto:** 2 · **Esfuerzo:** S

### REL-134 · Smoke test de render de cada pantalla con datos vacíos
**Qué:** asegurar que ninguna pantalla crashea con `[]`/`null` inicial (cubre los empty-states de REL-029). **Dónde:** nuevos tests de render por pantalla · **Impacto:** 3 · **Esfuerzo:** L

### UX / UI de fiabilidad

### REL-135 · Toast/feedback cuando una acción se encola por estar offline
**Qué:** al guardar sin red (con cola, REL-002), mostrar "Guardado. Se sincronizará al recuperar conexión". **Dónde:** consumidores de `syncQueue` · **Impacto:** 4 · **Esfuerzo:** M

### REL-136 · Indicador global de "sincronizando N cambios pendientes"
**Qué:** un pequeño badge con el número de mutaciones en cola y su estado. **Dónde:** `app/_layout.tsx`, `syncQueue` · **Impacto:** 3 · **Esfuerzo:** M

### REL-137 · Confirmación visual de éxito uniforme (haptic + microcopy)
**Qué:** unos flujos dan haptic (`index`, `diario`, `gym`) y otros no (`compra`, `misiones`); unificar el feedback de éxito. **Dónde:** `compra.tsx:32`, `misiones.tsx:43` · **Impacto:** 2 · **Esfuerzo:** S

### REL-138 · Estado deshabilitado claro mientras una fila está "ocupada"
**Qué:** `QuestItem` muestra spinner en el box, pero otras filas (tareas de mazmorra, ítems de compra) no indican que están escribiendo. **Dónde:** `dungeon/[id].tsx:197-231`, `compra.tsx:83-89` · **Impacto:** 2 · **Esfuerzo:** S

### REL-139 · Pull-to-refresh en todas las pantallas, no solo en Sistema
**Qué:** solo `index.tsx` tiene `RefreshControl`; añadirlo a misiones, mazmorras, agenda, informe da una forma manual de recuperar tras un fallo. **Dónde:** `misiones.tsx:70`, `mazmorras.tsx:84`, `agenda.tsx:97`, `informe.tsx:100` · **Impacto:** 3 · **Esfuerzo:** M

### REL-140 · Mensaje específico de "sin cámara/permiso" con acción a Ajustes
**Qué:** `captureEvidence` (index.tsx:94) solo avisa; ofrecer abrir Ajustes del sistema para conceder permiso. **Dónde:** `(tabs)/index.tsx:92-97` · **Impacto:** 2 · **Esfuerzo:** S

### REL-141 · Evitar que el `Alert` de bienvenida (seed) tape el primer render
**Qué:** el Alert de seed (index.tsx:71) salta durante el primer `load`; mostrarlo tras pintar para no interrumpir. **Dónde:** `(tabs)/index.tsx:71-76` · **Impacto:** 1 · **Esfuerzo:** S

### REL-142 · Feedback al copiar/compartir export y perfil
**Qué:** `exportAllData` y `shareProfile` no confirman éxito si el share se cancela; un mensaje neutral ayuda. **Dónde:** `exporter.ts:40`, `perfil.tsx:151-160` · **Impacto:** 1 · **Esfuerzo:** S

### REL-143 · Estado vacío con CTA en agenda cuando todo el rango está libre
**Qué:** si los 14 días están vacíos, solo se ve "HOY · Día libre"; añadir un CTA para crear evento o misión. **Dónde:** `agenda.tsx:105-176` · **Impacto:** 2 · **Esfuerzo:** S

### REL-144 · Diferenciar visualmente completación sincronizada vs optimista (apoya REL-012)
**Qué:** un punto/opacidad sutil mientras el id es `local-...`. **Dónde:** `QuestItem.tsx`, `(tabs)/index.tsx:118` · **Impacto:** 2 · **Esfuerzo:** S

### Seguridad y privacidad (ángulo de fiabilidad)

### REL-145 · La API key del Oráculo en AsyncStorage sin cifrar
**Qué:** `oracle.ts:33` guarda la key en claro; en un dispositivo comprometido es legible. Evaluar `expo-secure-store`. **Dónde:** `oracle.ts:29-35` · **Impacto:** 3 · **Esfuerzo:** S

### REL-146 · Evitar registrar el objetivo del usuario o la key en logs/telemetría
**Qué:** al añadir logging (REL-122) y Sentry, excluir explícitamente `goal`, `text` del diario y la key. **Dónde:** `oracle.ts:77`, `diario.tsx:113` · **Impacto:** 3 · **Esfuerzo:** S

### REL-147 · El export incluye todo en claro y se comparte por intent del sistema
**Qué:** `exportAllData` (exporter.ts:25) vuelca diario/eventos a un JSON sin cifrar que va al share sheet; advertir al usuario del contenido sensible. **Dónde:** `exporter.ts:25-46` · **Impacto:** 2 · **Esfuerzo:** S

### REL-148 · Limpiar ficheros de export del caché tras compartir
**Qué:** `new File(Paths.cache, ...)` (exporter.ts:37) deja el JSON en caché indefinidamente; borrarlo tras el share. **Dónde:** `exporter.ts:37-45` · **Impacto:** 2 · **Esfuerzo:** S

### REL-149 · Confirmar que `detectSessionInUrl:false` no rompe deep-links de auth
**Qué:** `supabase.ts:22` desactiva la detección; correcto para móvil, pero documentar para no reintroducir flujos web. **Dónde:** `supabase.ts:17-24` · **Impacto:** 1 · **Esfuerzo:** S

### Notificaciones y ciclo de vida

### REL-150 · Reprogramar notificaciones tras cambio de zona horaria
**Qué:** las notificaciones diarias (notifications.ts:28) se fijan a hora local al programarse; un viaje de zona las deja a la hora vieja hasta el próximo `ensureDailyNotifications`. **Dónde:** `notifications.ts:28-49` · **Impacto:** 2 · **Esfuerzo:** S

### REL-151 · No reprogramar (cancelAll) en cada montaje de Sistema
**Qué:** ver REL-060: `cancelAllScheduledNotificationsAsync` (notifications.ts:27) borra y recrea en cada focus de la home; si falla a mitad, queda sin notificaciones. Hacerlo idempotente. **Dónde:** `notifications.ts:27`, `(tabs)/index.tsx:88` · **Impacto:** 3 · **Esfuerzo:** S

### REL-152 · Acción al pulsar la notificación (deep-link a Sistema)
**Qué:** las notificaciones no definen navegación al abrirlas; encauzar a la pantalla Sistema. **Dónde:** `notifications.ts:28-49` · **Impacto:** 2 · **Esfuerzo:** M

### REL-153 · Cancelar el auto-refresh de token al desmontar (limpieza de listener)
**Qué:** `supabase.ts:27` añade un listener de `AppState` que nunca se remueve (vive toda la app, aceptable), pero documentar/centralizar para evitar duplicados si se reusa. **Dónde:** `supabase.ts:26-34` · **Impacto:** 1 · **Esfuerzo:** S

### REL-154 · Manejar el caso "permiso de notificaciones denegado" con copy
**Qué:** `notifications.ts:25` retorna en silencio si no hay permiso; el usuario nunca sabe por qué no le avisan. Un aviso opcional en Perfil. **Dónde:** `notifications.ts:24-25`, `perfil.tsx` · **Impacto:** 2 · **Esfuerzo:** S

### REL-155 · Verificar comportamiento de notificaciones en Expo Go vs dev build
**Qué:** el comentario (notifications.ts:14) avisa de la limitación; añadir un check en runtime que informe al usuario en Expo Go. **Dónde:** `notifications.ts:14-16` · **Impacto:** 1 · **Esfuerzo:** S

### Pulido final

### REL-156 · `keyboardShouldPersistTaps` inconsistente entre formularios
**Qué:** login/diario/compra/oraculo lo ponen; misiones/agenda/gym (con inputs en modales) no, lo que puede tragar el primer tap. Revisar. **Dónde:** `agenda.tsx:179`, `gym.tsx:306` (modales) · **Impacto:** 2 · **Esfuerzo:** S

### REL-157 · `KeyboardAvoidingView` solo en login y oraculo
**Qué:** diario (textarea), agenda y dieta (modales con inputs) no envuelven en `KeyboardAvoidingView`; el teclado puede tapar el botón guardar. **Dónde:** `diario.tsx:142`, `agenda.tsx:179`, `dieta.tsx:159` · **Impacto:** 3 · **Esfuerzo:** S

### REL-158 · Modales sin scroll interno pueden recortar contenido en pantallas pequeñas
**Qué:** los `sheet` de mazmorras/gym/dieta no son scrolleables; con teclado abierto en móviles bajos se pierden botones. **Dónde:** `mazmorras.tsx:142`, `gym.tsx:307`, `dieta.tsx:160` · **Impacto:** 2 · **Esfuerzo:** M

### REL-159 · `maxLength` ausente en la mayoría de inputs de texto
**Qué:** solo el nombre de perfil limita longitud (perfil.tsx:212); títulos de misión/mazmorra/evento sin tope pueden romper layouts y la BD. **Dónde:** `misiones.tsx` (form), `mazmorras.tsx:145`, `agenda.tsx:184` · **Impacto:** 2 · **Esfuerzo:** S

### REL-160 · `numberOfLines` en títulos largos no aplicado uniformemente
**Qué:** algunos títulos usan `numberOfLines={1}` y otros no; un título muy largo descuadra filas. **Dónde:** `misiones.tsx:89`, `diario.tsx` (entradas) · **Impacto:** 1 · **Esfuerzo:** S

### REL-161 · Evitar `Date.now()` como sufijo de path de Storage sin colisión real
**Qué:** `uploadEvidence`/`uploadAvatar` usan `Date.now()` (data.ts:101,110); dos subidas en el mismo ms (raro) colisionan. UUID es más seguro. **Dónde:** `data.ts:101,110` · **Impacto:** 1 · **Esfuerzo:** S

### REL-162 · Limpiar avatares antiguos al subir uno nuevo
**Qué:** cada avatar nuevo crea un fichero con timestamp distinto (data.ts:110) y el viejo queda huérfano en Storage. Borrar el anterior. **Dónde:** `data.ts:109-116`, `perfil.tsx:97-101` · **Impacto:** 2 · **Esfuerzo:** S

### REL-163 · `RefreshControl` sin color de fondo coherente en modo del sistema
**Qué:** solo se fija `tintColor` (index.tsx:200); en Android conviene `colors`/`progressBackgroundColor` para contraste. **Dónde:** `(tabs)/index.tsx:199-201` · **Impacto:** 1 · **Esfuerzo:** S

### REL-164 · Garantizar `pointerEvents` correcto durante overlays (level up)
**Qué:** mientras `LevelUpOverlay` está visible, el `ScrollView` de fondo sigue interactivo; bloquear toques de fondo durante el overlay. **Dónde:** `(tabs)/index.tsx:331`, `components/LevelUpOverlay.tsx` · **Impacto:** 2 · **Esfuerzo:** S

### REL-165 · Evitar doble navegación al "Ver misiones" del Oráculo
**Qué:** `accept` hace `router.replace('/(tabs)/misiones')` dentro del Alert (oraculo.tsx:101); si se pulsa dos veces o ya se navegó, encadena. Guardar. **Dónde:** `oraculo.tsx:100-102` · **Impacto:** 1 · **Esfuerzo:** S

### REL-166 · Resetear `proposals`/`goal` del Oráculo al desenfocar
**Qué:** al volver al Oráculo, propuestas viejas siguen en pantalla (no usa `useFocusEffect`); limpiar o avisar que son de una consulta previa. **Dónde:** `oraculo.tsx:30-35` · **Impacto:** 1 · **Esfuerzo:** S

### REL-167 · `accept` del Oráculo inserta misiones en bucle sin transacción
**Qué:** `oraculo.tsx:89-98` hace un `createQuest` por propuesta; si falla a mitad, quedan unas sí y otras no, sin reporte de cuántas. Insertar en lote o reportar el parcial. **Dónde:** `oraculo.tsx:88-99` · **Impacto:** 3 · **Esfuerzo:** M

### REL-168 · Confirmar antes de descartar cambios no guardados en formularios
**Qué:** cerrar un modal (misión/evento/comida) con texto a medias lo pierde sin aviso. **Dónde:** `mazmorras.tsx:175`, `agenda.tsx:209`, `dieta.tsx:186` · **Impacto:** 2 · **Esfuerzo:** S

### REL-169 · Persistir borrador del diario localmente
**Qué:** si la app muere mientras se escribe el diario, el texto se pierde; guardar borrador en AsyncStorage por fecha. **Dónde:** `diario.tsx:70,174-181` · **Impacto:** 3 · **Esfuerzo:** M

### REL-170 · Persistir borrador del objetivo del Oráculo
**Qué:** igual que el diario, el `goal` escrito se pierde al salir; conservarlo. **Dónde:** `oraculo.tsx:30` · **Impacto:** 1 · **Esfuerzo:** S

---

Total: 170 mejoras, 9 bugs.
