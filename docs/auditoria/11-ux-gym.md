# UX/UI Gimnasio

> Área GYM · auditoría de código NIVL · anclada al código real
> Archivo auditado: `src/app/gym.tsx` (458 líneas) · vecinos leídos: `src/lib/body.ts`, `src/lib/engine.ts`, `src/lib/types.ts`, `src/lib/game.ts`, `src/lib/dates.ts`, `src/lib/voice.ts`, `src/components/SystemButton.tsx`, `supabase/migrations/0002_fases.sql`, `0003_seguridad.sql`.

## Bugs y riesgos

### CRIT-GYM-01 · Sin cerrojo síncrono en `finishTraining`: doble toque cruza la UNIQUE de sesión y deja XP a medias — `gym.tsx:102-152` · severidad alta
**Problema:** El guard es solo `if (!userId || busy) return;` con `busy` de estado (`setBusy(true)` es asíncrono). Dos toques rápidos en "Terminar sesión" disparan dos `finishTraining` antes del re-render. `gym_sessions` tiene `unique (user_id, date)` (`0002_fases.sql:75`), así que el segundo `createSession` lanza 23505 → "Error del sistema". Pero el orden es `createSession` → `insertLifts` → `awardXp` → `insertEvent('gym_pr')`: en una doble ejecución entrelazada puedes registrar lifts/PR/eventos duplicados o dejar XP otorgado sin alert de éxito, y el usuario ve un error pese a que la sesión sí entró. El patrón correcto ya existe en el resto de la app (`diario.tsx:107-109` usa `saving.current`).
**Arreglo:** Añadir un `const saving = useRef(false)` y al inicio `if (!userId || busy || saving.current) return; saving.current = true;`, liberándolo en `finally` (`saving.current = false`). Replica exacta del cerrojo de `diario.tsx`.

### CRIT-GYM-02 · `useEffect`/`[load]` en vez de `useFocusEffect`: la sesión de hoy no se refresca al volver a la pantalla — `gym.tsx:83-85` · severidad alta
**Problema:** Gym es la **única** pantalla del proyecto que carga datos con `useEffect(() => { load(); }, [load])`. Todas las demás (`index.tsx:82`, `misiones.tsx:37`, `mazmorras.tsx:58`, `agenda.tsx:70`, `perfil.tsx:79`, `diario.tsx:100`, `informe.tsx:32`) usan `useFocusEffect`. Como `gym.tsx` es una pantalla de **stack** (se navega desde Sistema y se vuelve con `router.back()`), al cruzar la medianoche o entrenar y volver, `today = dateKey()` queda congelado al primer render y `todaySession` no se revalida: la tarjeta puede seguir diciendo "Hoy no hay rutina" o mostrar la sesión de ayer como la de hoy. Además, si la pantalla permanece montada y el reloj pasa de las 23:59 a las 00:00, `today` y `todayWd` (`gym.tsx:70-71`) no se recalculan nunca.
**Arreglo:** Importar `useFocusEffect` de `expo-router` y envolver: `useFocusEffect(useCallback(() => { load(); }, [load]))`. Mover además `today`/`todayWd` dentro de `load` o recalcularlos en cada foco para que la fecha no se congele.

### CRIT-GYM-03 · Botín de XP se otorga aunque `insertLifts` falle: sesión sin series pero con XP — `gym.tsx:117-129` · severidad media
**Problema:** El orden es `createSession` (línea 117) → `insertLifts` (122) → `awardXp` (126). No hay transacción. Si `insertLifts` lanza (p. ej. violación de `gym_lifts_nonneg` de `0003_seguridad.sql:21`, o corte de red), el `catch` muestra "Error del sistema", pero **la sesión ya está creada** con `xp_awarded` y, si el fallo es posterior, el XP ya pudo aplicarse. Al reintentar, `createSession` chocará con la UNIQUE y el usuario queda bloqueado con una sesión "fantasma" sin lifts y sin XP coherente.
**Arreglo:** Validar antes de escribir (rechazar lifts con `weight < 0`), e idealmente mover el conjunto a una RPC `SECURITY DEFINER` atómica (alineado con el plan 0004). Como mínimo: insertar lifts antes que `awardXp` y, si algo falla tras crear la sesión, borrar la sesión recién creada en el `catch` para permitir reintento limpio.

### CRIT-GYM-04 · Dos rutinas en el mismo día de la semana: solo se entrena la primera, sin aviso — `gym.tsx:87,154-160` · severidad media
**Problema:** `createGymDay` (`body.ts:14`) no tiene `unique (user_id, day_of_week)` (ver tabla en `0002_fases.sql:49-54`, sin esa restricción). El formulario permite crear "Lunes — Empuje" y "Lunes — Pierna". Pero `todayPlan = days.find((d) => d.day_of_week === todayWd)` (`gym.tsx:87`) coge **solo la primera** por orden de `day_of_week`, y `startTraining` carga únicamente sus ejercicios. La segunda rutina del día queda muerta: visible en "RUTINA SEMANAL" pero nunca entrenable.
**Arreglo:** O bien impedir duplicados (deshabilitar el chip del día ya usado en el modal, o `unique` en BD con manejo de 23505), o bien soportar varias rutinas por día (selector cuando hay más de una). Como mínimo, avisar al crear un día ya ocupado.

### CRIT-GYM-05 · `previousMax` se consulta antes de crear la sesión, pero incluye lifts del propio día: PR no detectado en re-entreno — `gym.tsx:114-115` · severidad baja
**Problema:** `fetchMaxLifts()` (`body.ts:88`) lee **todos** los `gym_lifts` del usuario sin filtrar por fecha. Como la UNIQUE impide dos sesiones el mismo día, no hay doble-conteo intradía; pero el cálculo de PR usa `l.weight > (previousMax[...] ?? 0)` con `>` estricto: igualar tu récord (mismo peso, más reps) **no** cuenta como progreso y no da `PR_XP`. Para un registro de "serie top" esto desincentiva mejorar repeticiones al mismo peso, que es progresión real.
**Arreglo:** Decidir la regla de PR (peso estricto vs. peso≥ y reps>) y documentarla. Si se quiere premiar reps al mismo peso, comparar `(weight, reps)` lexicográficamente contra el máximo histórico por ejercicio, no solo el peso.

## Mejoras

### GYM-001 · Migrar a `useFocusEffect` (consistencia con toda la app)
**Qué:** Reemplazar `useEffect(() => { load() }, [load])` por `useFocusEffect`. **Dónde:** `gym.tsx:83-85` · **Impacto:** 5 · **Esfuerzo:** S

### GYM-002 · Cerrojo `useRef` anti doble-envío al terminar sesión
**Qué:** `saving.current` síncrono replicando `diario.tsx`. **Dónde:** `gym.tsx:102-104` · **Impacto:** 5 · **Esfuerzo:** S

### GYM-003 · Recalcular `today`/`todayWd` en cada foco
**Qué:** Hoy se fijan en el primer render (`const today = dateKey()`), se quedan obsoletos al cruzar medianoche. **Dónde:** `gym.tsx:70-71` · **Impacto:** 4 · **Esfuerzo:** S

### GYM-004 · Borrar la sesión huérfana si falla `insertLifts`/`awardXp`
**Qué:** Rollback manual en el `catch` para no bloquear reintentos por la UNIQUE. **Dónde:** `gym.tsx:117-148` · **Impacto:** 4 · **Esfuerzo:** M

### GYM-005 · Temporizador de descanso entre series
**Qué:** No existe ningún temporizador (`grep timer|descanso|setInterval` → 0 resultados). Añadir cuenta atrás configurable (60/90/120/180 s) con haptic/sonido al acabar durante el modo `training`. **Dónde:** bloque `training` `gym.tsx:211-239` · **Impacto:** 5 · **Esfuerzo:** L

### GYM-006 · Registro serie a serie, no solo la "serie top"
**Qué:** El modo entreno solo captura una fila peso/reps por ejercicio ("serie top por ejercicio", `gym.tsx:213`). Permitir N series por ejercicio (cada `set` con su peso/reps). **Dónde:** `LiftInput` `gym.tsx:44-48` + render `214-236` · **Impacto:** 5 · **Esfuerzo:** L

### GYM-007 · Historial y progresión por ejercicio
**Qué:** No hay pantalla de historial; `gym_lifts` se escribe pero nunca se lee salvo para `fetchMaxLifts`. Añadir vista "evolución de Press banca" con últimas sesiones. **Dónde:** nueva pantalla + `body.ts` (nuevo `fetchLiftHistory`) · **Impacto:** 5 · **Esfuerzo:** L

### GYM-008 · Gráfica de PRs / 1RM estimado
**Qué:** Mostrar curva de récords por ejercicio (Epley 1RM con peso×reps). **Dónde:** consume `gym_lifts`; nueva sección · **Impacto:** 4 · **Esfuerzo:** L

### GYM-009 · Superseries (agrupar ejercicios)
**Qué:** No hay concepto de superserie. Añadir agrupación A1/A2 con el mismo descanso. **Dónde:** `GymExercise` (`types.ts:94`) + UI `gym.tsx:278-300` · **Impacto:** 3 · **Esfuerzo:** L

### GYM-010 · Reordenar ejercicios (drag o flechas)
**Qué:** `position` existe (`types.ts:103`, `createGymExercise` lo setea) pero no hay forma de cambiarlo en la UI. **Dónde:** lista de ejercicios `gym.tsx:278-300` · **Impacto:** 4 · **Esfuerzo:** M

### GYM-011 · Editar ejercicio existente
**Qué:** Solo se puede crear (long-press = borrar). No hay edición de nombre/series/reps/peso. **Dónde:** `onLongPress` `gym.tsx:281-293` · **Impacto:** 4 · **Esfuerzo:** M

### GYM-012 · Editar nombre/día de una rutina
**Qué:** `GymDay` no es editable; para corregir un nombre hay que borrar y recrear (perdiendo ejercicios por cascade). **Dónde:** `dayHeader` `gym.tsx:250-277` · **Impacto:** 3 · **Esfuerzo:** M

### GYM-013 · Plantillas de rutina (PPL, Upper/Lower, Full body)
**Qué:** Crear desde cero es tedioso. Ofrecer plantillas que generan días+ejercicios. **Dónde:** `addDay` `gym.tsx:154-160` · **Impacto:** 4 · **Esfuerzo:** L

### GYM-014 · Modo deload (semana de descarga)
**Qué:** No hay deload. Marcar una semana como descarga (−40 % volumen sugerido) sin penalización. **Dónde:** nuevo estado + bloque sesión · **Impacto:** 2 · **Esfuerzo:** L

### GYM-015 · Notas por sesión
**Qué:** `gym_sessions.notes` y `createSession({notes})` existen (`body.ts:64`) pero la UI nunca los rellena. Añadir campo de notas al terminar. **Dónde:** `finishTraining` `gym.tsx:117-121` · **Impacto:** 3 · **Esfuerzo:** S

### GYM-016 · Entreno libre sin rutina asignada
**Qué:** Si `!todayPlan`, solo se muestra "Hoy no hay rutina" (`gym.tsx:196-199`); no se puede registrar un entreno improvisado. Permitir "Entrenar libre" añadiendo ejercicios sobre la marcha. **Dónde:** rama `!todayPlan` `gym.tsx:196` · **Impacto:** 4 · **Esfuerzo:** M

### GYM-017 · Editar una sesión ya registrada de hoy
**Qué:** Tras registrar, la tarjeta queda en "Sesión registrada" sin posibilidad de corregir un peso mal tecleado. **Dónde:** rama `todaySession` `gym.tsx:192-195` · **Impacto:** 3 · **Esfuerzo:** M

### GYM-018 · `KeyboardAvoidingView` en el modo entreno
**Qué:** Los inputs de peso/reps quedan tapados por el teclado en ejercicios bajos de la lista; el `ScrollView` no compensa el teclado. **Dónde:** `ScrollView` `gym.tsx:179` · **Impacto:** 4 · **Esfuerzo:** S

### GYM-019 · `keyboardShouldPersistTaps="handled"` en el ScrollView
**Qué:** Al teclear en un input y tocar otro/botón, el primer tap se consume cerrando teclado. **Dónde:** `ScrollView` `gym.tsx:179` · **Impacto:** 3 · **Esfuerzo:** S

### GYM-020 · Botón "Cancelar entreno" / salir del modo training
**Qué:** Una vez en `training` no hay forma de abortar salvo registrar; `setTraining(false)` no se expone. **Dónde:** rama training `gym.tsx:211-239` · **Impacto:** 4 · **Esfuerzo:** S

### GYM-021 · Confirmar antes de salir con entreno a medias
**Qué:** `router.back()` (`gym.tsx:181`) descarta los lifts tecleados sin avisar. **Dónde:** header back `gym.tsx:181` · **Impacto:** 3 · **Esfuerzo:** M

### GYM-022 · `accessibilityLabel` en los iconos de cabecera
**Qué:** `chevron-back` y `add` (`gym.tsx:182,186`) son `Pressable` con solo icono, sin etiqueta para lectores de pantalla. **Dónde:** `gym.tsx:181-187` · **Impacto:** 3 · **Esfuerzo:** S

### GYM-023 · `accessibilityLabel` en add/trash de cada día
**Qué:** Iconos `add`/`trash-outline` (`gym.tsx:255-275`) sin rol ni etiqueta. **Dónde:** `gym.tsx:254-276` · **Impacto:** 3 · **Esfuerzo:** S

### GYM-024 · Etiquetar inputs peso/reps con `accessibilityLabel`
**Qué:** Los `TextInput` de la fila de lift (`gym.tsx:219-234`) solo tienen placeholder "kg"/"reps", que desaparece al escribir; sin label accesible no se sabe qué campo es. **Dónde:** `gym.tsx:219-234` · **Impacto:** 3 · **Esfuerzo:** S

### GYM-025 · `hitSlop` mayor en el icono de papelera (18 px)
**Qué:** `trash-outline` size 18 con `hitSlop={8}` queda por debajo del objetivo táctil de 44 px. **Dónde:** `gym.tsx:272-274` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-026 · Long-press para borrar ejercicio no es descubrible
**Qué:** Borrar un ejercicio requiere `onLongPress` (`gym.tsx:281`) sin ninguna pista visual. Añadir icono o swipe. **Dónde:** `gym.tsx:279-294` · **Impacto:** 4 · **Esfuerzo:** M

### GYM-027 · Estado vacío de ejercicios dentro de un día
**Qué:** Un `GymDay` sin ejercicios no muestra nada bajo la cabecera; parece roto. Añadir "Sin ejercicios — pulsa +". **Dónde:** `exercisesFor(d.id).map` `gym.tsx:278` · **Impacto:** 3 · **Esfuerzo:** S

### GYM-028 · Validar `day_of_week` duplicado en el chip selector
**Qué:** Marcar/atenuar en el modal los días que ya tienen rutina. **Dónde:** chips `gym.tsx:310-322` · **Impacto:** 3 · **Esfuerzo:** S

### GYM-029 · Indicador de carga inicial (skeleton/spinner)
**Qué:** Mientras `load()` resuelve, `days`/`exercises` están vacíos y se pinta "Sin rutina aún" momentáneamente (flash de estado vacío). **Dónde:** `gym.tsx:243` · **Impacto:** 3 · **Esfuerzo:** M

### GYM-030 · Pull-to-refresh en el ScrollView
**Qué:** No hay forma de forzar recarga manual. Añadir `RefreshControl`. **Dónde:** `ScrollView` `gym.tsx:179` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-031 · Resumen de PRs de hoy en la tarjeta registrada
**Qué:** Tras registrar, la tarjeta solo dice "+X XP" (`gym.tsx:193-195`); el desglose de PR del Alert se pierde. Persistir y mostrar los PR del día. **Dónde:** rama `todaySession` `gym.tsx:192-195` · **Impacto:** 3 · **Esfuerzo:** M

### GYM-032 · Mostrar el récord actual junto a cada input de peso
**Qué:** Durante el entreno no se ve el máximo histórico, así que no sabes si vas a por PR. Precargar `fetchMaxLifts` y mostrar "PR: 80 kg". **Dónde:** fila de lift `gym.tsx:214-236` · **Impacto:** 4 · **Esfuerzo:** M

### GYM-033 · Precargar `previousMax` al iniciar, no al terminar
**Qué:** `fetchMaxLifts()` se llama dentro de `finishTraining` (`gym.tsx:114`) bloqueando el guardado; cargarlo en `startTraining` para feedback en vivo y guardado más rápido. **Dónde:** `gym.tsx:90-100,114` · **Impacto:** 3 · **Esfuerzo:** M

### GYM-034 · Unidad kg/lb configurable
**Qué:** "kg" está hardcodeado por todas partes (`gym.tsx:206,297` y placeholder). Añadir preferencia de unidad. **Dónde:** render de peso `gym.tsx:206,297` · **Impacto:** 2 · **Esfuerzo:** L

### GYM-035 · Soportar decimales con coma de forma consistente en UI
**Qué:** `finishTraining` y `addExercise` ya hacen `.replace(',', '.')` (`gym.tsx:109,168`), pero el `keyboardType="decimal-pad"` en es-ES ofrece coma; conviene normalizar y mostrar siempre con coma al re-render. **Dónde:** `gym.tsx:109,168,221` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-036 · Rechazar pesos/reps negativos antes de enviar
**Qué:** `parseFloat`/`parseInt` aceptan "-5"; aunque la BD tiene `gym_lifts_nonneg` (`0003:21`), el error llega como "Error del sistema" en vez de validación local. **Dónde:** `gym.tsx:106-112` · **Impacto:** 3 · **Esfuerzo:** S

### GYM-037 · Tope de cordura en peso/reps
**Qué:** Sin límite superior; un "9999" por error infla PR y 1RM. Validar rango razonable. **Dónde:** `gym.tsx:106-112,162-170` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-038 · `maxLength` en los inputs numéricos
**Qué:** Los `TextInput` de peso/reps (ancho 64 px, `gym.tsx:410`) admiten texto arbitrariamente largo que desborda. **Dónde:** `gym.tsx:219-234` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-039 · `returnKeyType`/foco encadenado entre inputs
**Qué:** Tras teclear peso, "siguiente" debería saltar a reps; ahora hay que tocar a mano. **Dónde:** fila de lift `gym.tsx:219-234` · **Impacto:** 2 · **Esfuerzo:** M

### GYM-040 · Diferenciar visualmente la fila de lift con PR potencial
**Qué:** Resaltar en cian/amber cuando el peso introducido supera el récord. **Dónde:** `liftRow` `gym.tsx:214-236` · **Impacto:** 3 · **Esfuerzo:** M

### GYM-041 · Mostrar volumen total de la sesión (Σ peso×reps)
**Qué:** Métrica clave ausente. Calcular y mostrar al terminar / en la tarjeta. **Dónde:** `finishTraining` `gym.tsx:106-122` · **Impacto:** 3 · **Esfuerzo:** S

### GYM-042 · Duración de la sesión (cronómetro)
**Qué:** No se mide el tiempo de entreno. Marcar inicio en `startTraining` y guardar minutos. **Dónde:** `gym.tsx:90-100` + `notes`/columna · **Impacto:** 2 · **Esfuerzo:** M

### GYM-043 · Contador de sesiones de la semana / racha de gym
**Qué:** `countSessions()` existe en `body.ts:101` pero no se usa en la UI. Mostrar "3 sesiones esta semana". **Dónde:** cabecera `gym.tsx:184` · **Impacto:** 3 · **Esfuerzo:** M

### GYM-044 · Calendario/heatmap de asistencia al gym
**Qué:** Visualizar días entrenados del mes. **Dónde:** nueva sección, consume `gym_sessions` · **Impacto:** 3 · **Esfuerzo:** L

### GYM-045 · Logro de PR refleja peso pero no ejercicio en el contador
**Qué:** `prCount` cuenta eventos `gym_pr` globales (`gym.tsx:134-137`); un logro "10 PR" no distingue ejercicios. Considerar logros por ejercicio. **Dónde:** `gym.tsx:134-138` · **Impacto:** 2 · **Esfuerzo:** M

### GYM-046 · Feedback de PR más rico (no solo `voice.pr` en Alert)
**Qué:** Los PR se anuncian en un `Alert.alert` con saltos de línea (`gym.tsx:141-143`); en un sistema "Solo Leveling" merecen un overlay tipo `LevelUpOverlay`. **Dónde:** `gym.tsx:140-143` · **Impacto:** 3 · **Esfuerzo:** M

### GYM-047 · El `Alert` concatena XP+PR+logro en un solo mensaje denso
**Qué:** `+50 XP a FUE\n<PR>\n<Logro>` (`gym.tsx:141-143`) es difícil de leer. Separar en secciones o ventana del sistema. **Dónde:** `gym.tsx:141-143` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-048 · `voice` ya importado pero solo se usa para PR
**Qué:** Las copys "SESIÓN REGISTRADA", "Sin rutina aún" están hardcodeadas en vez de pasar por `voice` (consistencia de la voz del sistema, ver design-system). **Dónde:** `gym.tsx:143,191-198,245` · **Impacto:** 2 · **Esfuerzo:** M

### GYM-049 · Extraer la lógica de `finishTraining` a `lib/body.ts`
**Qué:** La pantalla orquesta sesión+lifts+PR+XP+logros+conteo (`gym.tsx:102-152`); debería vivir en una función de datos testeable (`recordGymSession`). **Dónde:** `gym.tsx:102-152` · **Impacto:** 3 · **Esfuerzo:** M

### GYM-050 · Tests de detección de PR (peso estricto vs. empate)
**Qué:** No hay tests del filtro `prs` (`gym.tsx:115`). Cubrir empate, primer registro (`?? 0`), peso 0. **Dónde:** nuevo test junto a `body.ts` · **Impacto:** 3 · **Esfuerzo:** M

### GYM-051 · Test de la economía XP de gym (`GYM_SESSION_XP + prs*PR_XP`)
**Qué:** El cálculo `totalXp` se duplica en `createSession` y `awardXp` (`gym.tsx:120,125`); un test evita que diverjan. **Dónde:** `gym.tsx:117-126` · **Impacto:** 3 · **Esfuerzo:** S

### GYM-052 · `totalXp` calculado dos veces — extraer a una constante
**Qué:** `GYM_SESSION_XP + prs.length * PR_XP` aparece en línea 120 y 125 idéntico; si una cambia, descuadre silencioso entre `xp_awarded` guardado y XP otorgado. **Dónde:** `gym.tsx:120,125` · **Impacto:** 3 · **Esfuerzo:** S

### GYM-053 · `key={l.exercise}` en la lista de lifts asume nombres únicos
**Qué:** El `key` del `liftRow` es el nombre del ejercicio (`gym.tsx:215`); dos ejercicios homónimos en un día rompen el reconciliador de React. Usar el `id` del ejercicio. **Dónde:** `gym.tsx:215` · **Impacto:** 3 · **Esfuerzo:** S

### GYM-054 · `lifts` se indexa por posición pero se compara por `exercise`
**Qué:** `onChangeText` mapea por índice `j === i` (`gym.tsx:222,230`) mientras el `key` es el nombre; mezclar criterios es frágil ante reordenado. Unificar en `id`. **Dónde:** `gym.tsx:214-234` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-055 · Memoizar `exercisesFor` (filtra en cada render)
**Qué:** `exercises.filter` se ejecuta por cada día en cada render (`gym.tsx:88`, llamado en 203, 278). Precomputar un mapa `dayId → exercises[]` con `useMemo`. **Dónde:** `gym.tsx:88` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-056 · `load()` hace 3 fetch secuenciales con `await` en serie
**Qué:** `fetchGymDays` → `fetchGymExercises` → `fetchSessionForDate` (`gym.tsx:75-77`) son independientes; `Promise.all` reduce el tiempo de carga a un tercio. **Dónde:** `gym.tsx:73-81` · **Impacto:** 3 · **Esfuerzo:** S

### GYM-057 · `fetchMaxLifts` descarga TODO el histórico de lifts al cliente
**Qué:** `select('exercise_name, weight')` sin límite (`body.ts:89`) y se reduce en JS; con años de datos escala mal. Mover a una vista/RPC `max(weight) group by exercise_name`. **Dónde:** `body.ts:88-99` · **Impacto:** 3 · **Esfuerzo:** M

### GYM-058 · Conteo de PR global con `head:true` en cada sesión
**Qué:** `count exact head` sobre `events` filtrando `type='gym_pr'` (`gym.tsx:134-137`) sin `user_id` explícito (depende de RLS) y se ejecuta siempre, aun sin PR. Saltarlo cuando `prs.length === 0`. **Dónde:** `gym.tsx:134-138` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-059 · Evaluar logros solo cuando hay PR nuevo
**Qué:** `evaluateAchievements({prCount})` corre en toda sesión (`gym.tsx:138`); si no hubo PR, el `prCount` no cambió. Cortocircuitar. **Dónde:** `gym.tsx:138` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-060 · El `ScrollView` re-renderiza toda la lista en cada tecla
**Qué:** Teclear un peso actualiza `lifts` y re-renderiza todo el árbol (días incluidos). Aislar el formulario de entreno en su propio componente memoizado. **Dónde:** `gym.tsx:177-304` · **Impacto:** 3 · **Esfuerzo:** M

### GYM-061 · Extraer la fila de lift a `<LiftRow>` memoizada
**Qué:** Componente con `React.memo` para que solo se repinte la fila editada. **Dónde:** `gym.tsx:214-236` · **Impacto:** 2 · **Esfuerzo:** M

### GYM-062 · Mover los modales a componentes separados
**Qué:** Los dos `Modal` (día y ejercicio, `gym.tsx:306-372`) inflan el render principal; extraerlos a `<DayFormSheet>`/`<ExerciseFormSheet>`. **Dónde:** `gym.tsx:306-372` · **Impacto:** 2 · **Esfuerzo:** M

### GYM-063 · Resetear estado del modal de ejercicio entre días
**Qué:** `exSets`/`exReps` no se reinician a 3/10 al reabrir; quedan los del ejercicio anterior. `exName`/`exWeight` sí (`gym.tsx:171-172`), pero sets/reps no. **Dónde:** `addExercise` `gym.tsx:171-174` · **Impacto:** 3 · **Esfuerzo:** S

### GYM-064 · `newDayOfWeek` no se reinicia al cerrar el modal de día
**Qué:** Queda el último día elegido; abrir el form de nuevo arrastra el estado. **Dónde:** `addDay`/`setDayFormOpen` `gym.tsx:154-159` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-065 · `Modal` sin manejo de back en Android para el form de ejercicio
**Qué:** `onRequestClose={() => setExFormDay(null)}` existe (`gym.tsx:336`), bien; pero el de día (`gym.tsx:306`) y el de ejercicio no limpian campos al cerrar con back. **Dónde:** `gym.tsx:306,336` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-066 · Reutilizar `DAY_NAMES` en lugar de re-slice para chips
**Qué:** `name.slice(0,3)` (`gym.tsx:318`) recorta "Mié" sin acentos consistentes; definir abreviaturas explícitas (Lun/Mar/Mié...). **Dónde:** `gym.tsx:318` · **Impacto:** 1 · **Esfuerzo:** S

### GYM-067 · `DAY_NAMES[todayWd - 1]?.toUpperCase()` repetido 4 veces
**Qué:** El patrón aparece en 191, 198, 252; extraer helper `dayLabel(wd)`. **Dónde:** `gym.tsx:191,198,252` · **Impacto:** 1 · **Esfuerzo:** S

### GYM-068 · `todaySession` no distingue sesión propia vs. heredada de gym_day borrado
**Qué:** Si borras el `gym_day`, `gym_sessions.gym_day_id` queda `null` (`on delete set null`, `0002:71`); la tarjeta de hoy sigue ok pero el historial pierde el nombre. Guardar `day_name` denormalizado o en `notes`. **Dónde:** `createSession` `gym.tsx:117-121` · **Impacto:** 2 · **Esfuerzo:** M

### GYM-069 · Confirmación de borrado de día menciona ejercicios pero no sesiones
**Qué:** El Alert dice "¿Eliminar X y sus ejercicios?" (`gym.tsx:260`); borrar el día también desvincula sesiones históricas (set null). Aclararlo. **Dónde:** `gym.tsx:260` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-070 · Deshacer borrado (snackbar undo)
**Qué:** `deleteGymDay`/`deleteGymExercise` son inmediatos e irreversibles (`gym.tsx:266,288`); un día con 8 ejercicios se pierde de un toque. **Dónde:** `gym.tsx:266,288` · **Impacto:** 3 · **Esfuerzo:** M

### GYM-071 · Indicador de guardado tras borrar (la lista parpadea por `load()`)
**Qué:** `deleteGymDay` → `await load()` recarga todo (`gym.tsx:266-267`); actualización optimista local evitaría el parpadeo. **Dónde:** `gym.tsx:265-268,287-290` · **Impacto:** 2 · **Esfuerzo:** M

### GYM-072 · Optimistic UI al añadir día/ejercicio
**Qué:** `addDay`/`addExercise` cierran el modal y esperan `load()` (`gym.tsx:159,174`); insertar localmente da sensación instantánea. **Dónde:** `gym.tsx:154-175` · **Impacto:** 2 · **Esfuerzo:** M

### GYM-073 · `busy` no bloquea los botones de añadir/borrar día durante el guardado
**Qué:** `busy` solo cubre `finishTraining`; durante un guardado de sesión, el usuario puede tocar trash/add y disparar `load()` concurrentes. **Dónde:** `gym.tsx:255-275` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-074 · `Haptics.notificationAsync` sin `await` ni try/catch
**Qué:** `gym.tsx:140` lanza un haptic flotante; en dispositivos sin soporte puede rechazar una promesa no capturada. **Dónde:** `gym.tsx:140` · **Impacto:** 1 · **Esfuerzo:** S

### GYM-075 · Haptic al iniciar entreno y al añadir ejercicio
**Qué:** Solo hay haptic al terminar; añadir feedback ligero en `startTraining`/`addExercise` para coherencia del sistema. **Dónde:** `gym.tsx:90,162` · **Impacto:** 1 · **Esfuerzo:** S

### GYM-076 · Placeholder de peso "—" frente a "kg" inconsistente
**Qué:** En el form de ejercicio el placeholder de Kg es "—" (`gym.tsx:363`) pero en la fila de lift es "kg" (`gym.tsx:224`). Unificar. **Dónde:** `gym.tsx:224,363` · **Impacto:** 1 · **Esfuerzo:** S

### GYM-077 · `numberOfLines={1}` en `liftName` puede truncar ejercicios largos
**Qué:** "Press inclinado con mancuernas" se corta (`gym.tsx:216`); permitir 2 líneas o tooltip. **Dónde:** `gym.tsx:216` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-078 · Contraste de `textFaint` en placeholders
**Qué:** `colors.textFaint` (#56698A) sobre `colors.bg` (#060B16) ronda el mínimo AA para texto pequeño; revisar placeholders (`gym.tsx:225,233,328`). **Dónde:** `gym.tsx:225,233,345,364` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-079 · Tamaño de fuente fijo ignora ajustes de accesibilidad del SO
**Qué:** Todos los `fontSize` son números crudos (estilos `gym.tsx:388-456`); no escalan con Dynamic Type. Considerar `allowFontScaling`/escala. **Dónde:** `styles` `gym.tsx:379-457` · **Impacto:** 2 · **Esfuerzo:** L

### GYM-080 · `accessibilityRole="button"` en los `Pressable` de ejercicio
**Qué:** El `Pressable` con `onLongPress` (`gym.tsx:279`) no expone rol ni hint de "mantén pulsado para eliminar". **Dónde:** `gym.tsx:279-294` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-081 · Foco/anuncio al abrir los modales (lectores de pantalla)
**Qué:** Al abrir el sheet no se mueve el foco al título; VoiceOver/TalkBack se quedan detrás. **Dónde:** `gym.tsx:306-372` · **Impacto:** 2 · **Esfuerzo:** M

### GYM-082 · Cerrar modal tocando el backdrop
**Qué:** El `backdrop` (`gym.tsx:307,337`) no es pulsable; solo el botón Cancelar cierra. Añadir `Pressable` en el backdrop. **Dónde:** `gym.tsx:307,337` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-083 · `chips` del selector de día sin scroll horizontal en pantallas estrechas
**Qué:** 7 chips con `flexWrap` (`gym.tsx:452`) saltan a 2 filas en móviles pequeños; un `ScrollView` horizontal sería más limpio. **Dónde:** `gym.tsx:310-322` · **Impacto:** 1 · **Esfuerzo:** S

### GYM-084 · Estado seleccionado del chip sin indicación accesible
**Qué:** `chipOn` solo cambia color (`gym.tsx:454`); añadir `accessibilityState={{selected}}`. **Dónde:** `gym.tsx:312-320` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-085 · Filtro de lifts descarta filas sin reps pero con peso, y viceversa de forma confusa
**Qué:** `filter((l) => l.reps > 0 || l.weight > 0)` (`gym.tsx:112`) guarda una fila con peso pero 0 reps (peso sin serie real) y descarta filas vacías sin avisar de cuáles se omitieron. **Dónde:** `gym.tsx:106-112` · **Impacto:** 3 · **Esfuerzo:** S

### GYM-086 · Avisar si no se registró ninguna serie
**Qué:** Si `valid` queda vacío (todo a 0), igualmente se crea sesión y se otorga `GYM_SESSION_XP` sin un solo lift. Confirmar "¿Registrar sesión sin series?". **Dónde:** `gym.tsx:106-122` · **Impacto:** 3 · **Esfuerzo:** S

### GYM-087 · `parseFloat(... ) || 0` enmascara entradas no numéricas
**Qué:** "abc" → 0 silencioso (`gym.tsx:109`); mejor validar y avisar. **Dónde:** `gym.tsx:109-110,168` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-088 · Peso por defecto del ejercicio no se propaga si es 0 válido
**Qué:** `e.weight !== null ? String(e.weight) : ''` (`gym.tsx:95`) trata 0 como peso válido y lo precarga "0"; para ejercicios de peso corporal mostrar vacío o "BW". **Dónde:** `gym.tsx:94-97` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-089 · Soporte explícito para ejercicios a peso corporal
**Qué:** No hay forma de marcar "dominadas, peso corporal"; `weight null` se renderiza sin kg pero no cuenta para PR. Añadir flag `bodyweight`. **Dónde:** `GymExercise` `types.ts:94` + UI `gym.tsx` · **Impacto:** 3 · **Esfuerzo:** L

### GYM-090 · RIR/RPE por serie
**Qué:** No se captura esfuerzo percibido; campo opcional RIR mejoraría la progresión. **Dónde:** `LiftInput` `gym.tsx:44-48` · **Impacto:** 2 · **Esfuerzo:** M

### GYM-091 · Tempo objetivo por ejercicio
**Qué:** Sin campo de tempo (3-1-1); opcional para entrenos guiados. **Dónde:** `GymExercise` · **Impacto:** 1 · **Esfuerzo:** M

### GYM-092 · Notas por ejercicio (cue técnico)
**Qué:** No se puede anotar "codos pegados" en un ejercicio. **Dónde:** `createGymExercise` `body.ts:38` · **Impacto:** 2 · **Esfuerzo:** M

### GYM-093 · Duplicar un día de rutina como base de otro
**Qué:** Crear "Jueves — Empuje 2" copiando "Lunes — Empuje" ahorra tiempo. **Dónde:** `dayHeader` acciones `gym.tsx:254-276` · **Impacto:** 2 · **Esfuerzo:** M

### GYM-094 · Reordenar días de la semana en la lista
**Qué:** Se ordenan por `day_of_week` (`body.ts:9`); no es configurable empezar la semana en domingo. **Dónde:** `fetchGymDays` orden `body.ts:5-12` · **Impacto:** 1 · **Esfuerzo:** M

### GYM-095 · Vista "próximo entreno" cuando hoy no toca
**Qué:** Si `!todayPlan`, además de "no hay rutina" mostrar "Próximo: mañana — Pierna". **Dónde:** rama `!todayPlan` `gym.tsx:196-199` · **Impacto:** 3 · **Esfuerzo:** M

### GYM-096 · Resaltar el día de hoy también en la lista semanal (ya lo hace por color, reforzar)
**Qué:** Hoy se distingue solo por `color={cyanDim}` del borde (`gym.tsx:249`); añadir etiqueta "HOY". **Dónde:** `gym.tsx:249-253` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-097 · Contador de ejercicios por día en la cabecera
**Qué:** "LUNES · Empuje (5 ejercicios)" da contexto sin desplegar. **Dónde:** `dayTitle` `gym.tsx:251-253` · **Impacto:** 1 · **Esfuerzo:** S

### GYM-098 · Volumen semanal por grupo muscular
**Qué:** Sin categorización muscular no se puede avisar de desequilibrios. Añadir `muscle_group` opcional. **Dónde:** `GymExercise` · **Impacto:** 3 · **Esfuerzo:** L

### GYM-099 · Sugerir incremento de peso (progresión lineal)
**Qué:** Tras una sesión completada, sugerir +2,5 kg la próxima. Consume historial. **Dónde:** post `finishTraining` · **Impacto:** 3 · **Esfuerzo:** L

### GYM-100 · Recordatorio/notificación el día de entreno
**Qué:** `notifications` existe en el proyecto; programar aviso los días con rutina. **Dónde:** integra `lib/notifications` con `days` · **Impacto:** 3 · **Esfuerzo:** M

### GYM-101 · Exportar historial de gym (CSV)
**Qué:** `exporter` existe en el proyecto pero no cubre lifts. Añadir export de `gym_lifts`. **Dónde:** integra `lib/exporter` · **Impacto:** 2 · **Esfuerzo:** M

### GYM-102 · Animación de transición al entrar en modo training
**Qué:** El cambio `!training`→`training` es instantáneo sin fade; un `LayoutAnimation` daría empaque. **Dónde:** `gym.tsx:200-239` · **Impacto:** 1 · **Esfuerzo:** S

### GYM-103 · `SystemWindow` de sesión cambia de color pero no de estado visual al completar
**Qué:** Tras registrar pasa a `doneText` cian (`gym.tsx:404`) pero el borde sigue `cyanDim`; un check/ticked reforzaría "hecho". **Dónde:** `gym.tsx:190-195` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-104 · Mensaje de error genérico "Fallo desconocido" poco accionable
**Qué:** Tres `catch` usan el mismo texto (`gym.tsx:79,148`); diferenciar (red, permisos, validación) ayuda al usuario. **Dónde:** `gym.tsx:78-80,147-149` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-105 · `addDay`/`addExercise` no capturan errores
**Qué:** A diferencia de `load`/`finishTraining`, `addDay` (`gym.tsx:154`) y `addExercise` (`gym.tsx:162`) no tienen try/catch; un fallo de red deja el modal cerrado y nada creado, sin aviso. **Dónde:** `gym.tsx:154-175` · **Impacto:** 3 · **Esfuerzo:** S

### GYM-106 · Borrados sin try/catch dentro de los Alert
**Qué:** `deleteGymDay`/`deleteGymExercise` en los `onPress` del Alert (`gym.tsx:265-267,287-289`) no capturan errores; un fallo deja la fila visible y el usuario cree que se borró. **Dónde:** `gym.tsx:265-267,287-289` · **Impacto:** 3 · **Esfuerzo:** S

### GYM-107 · Estado `busy` no da feedback visual fuera del botón
**Qué:** Durante el guardado solo el `SystemButton` muestra spinner (`gym.tsx:237`); deshabilitar inputs de la fila evitaría ediciones a medio guardar. **Dónde:** `gym.tsx:214-237` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-108 · Bloquear scroll/teclas durante el guardado de sesión
**Qué:** Mientras `finishTraining` corre se puede seguir tecleando pesos que no se guardarán. **Dónde:** `gym.tsx:102-152` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-109 · `today` como dependencia de `load` recrea la callback en cada cambio de día
**Qué:** `useCallback(..., [today])` (`gym.tsx:81`) es correcto, pero combinado con `useEffect([load])` solo dispara al montar; con `useFocusEffect` (GYM-001) la dependencia `today` queda obsoleta dentro del closure. Revisar al migrar. **Dónde:** `gym.tsx:73-85` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-110 · Separar "peso objetivo" (plantilla) de "peso realizado" (sesión)
**Qué:** `e.weight` se usa como objetivo y precarga del input real (`gym.tsx:95`); conviene distinguir target vs. logged para progresión. **Dónde:** `gym.tsx:90-100` · **Impacto:** 3 · **Esfuerzo:** M

### GYM-111 · Mostrar diferencia vs. sesión anterior por ejercicio
**Qué:** "Press banca 80 kg (+2,5 vs. semana pasada)" motiva. Consume historial. **Dónde:** fila de lift `gym.tsx:214-236` · **Impacto:** 3 · **Esfuerzo:** M

### GYM-112 · Marcar series completadas con checkbox durante el entreno
**Qué:** En modo training no hay forma de "tachar" una serie hecha; útil para descansos. **Dónde:** `liftRow` `gym.tsx:214-236` · **Impacto:** 3 · **Esfuerzo:** M

### GYM-113 · `position` no se reindexa al borrar un ejercicio intermedio
**Qué:** Borrar el ejercicio en posición 2 deja huecos (0,1,3,...); el nuevo ejercicio usa `length` (`gym.tsx:169`) y puede colisionar de posición. Reindexar tras borrar. **Dónde:** `gym.tsx:169,287-289` · **Impacto:** 2 · **Esfuerzo:** M

### GYM-114 · `parseInt(exSets,10) || 3` vacío silencioso
**Qué:** Borrar el campo Series y añadir mete 3 sin avisar (`gym.tsx:166`); validar mínimo 1. **Dónde:** `gym.tsx:166-167` · **Impacto:** 1 · **Esfuerzo:** S

### GYM-115 · No se valida `sets`/`reps` máximos en el form de ejercicio
**Qué:** "999 series" se acepta (`gym.tsx:350,354`); poner `maxLength`/rango. **Dónde:** `gym.tsx:350,354` · **Impacto:** 1 · **Esfuerzo:** S

### GYM-116 · Foco automático al primer input del modal
**Qué:** Al abrir "Nuevo día"/"Ejercicio" el teclado no aparece; `autoFocus` en el campo nombre agiliza. **Dónde:** `gym.tsx:323,340` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-117 · `testID` en elementos clave para pruebas E2E
**Qué:** Botones "Entrenar"/"Terminar"/inputs sin `testID` (`gym.tsx:209,237`); dificulta tests de UI. **Dónde:** `gym.tsx:209,237,219-234` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-118 · Internacionalizar/centralizar copys en un módulo
**Qué:** Cadenas en español incrustadas por todo el archivo; aunque la app es monolingüe, centralizarlas facilita el tono del sistema. **Dónde:** todo `gym.tsx` · **Impacto:** 1 · **Esfuerzo:** M

### GYM-119 · `DAY_NAMES` duplicado con `dates.ts`/otras pantallas
**Qué:** El array `DAY_NAMES` (`gym.tsx:42`) probablemente se repite en agenda/dieta; extraer a `lib/dates.ts` o `lib/constants`. **Dónde:** `gym.tsx:42` · **Impacto:** 2 · **Esfuerzo:** S

### GYM-120 · `LiftInput.exercise` debería llevar el `id` del ejercicio
**Qué:** El estado de lift solo guarda el nombre (`gym.tsx:44-48`); sin `id` no se puede vincular el lift al `gym_exercise` para historial/edición. **Dónde:** `gym.tsx:44-48,92-98` · **Impacto:** 3 · **Esfuerzo:** S

### GYM-121 · Permitir registrar sesión de un día que no es hoy (retroactivo)
**Qué:** Solo se puede registrar la sesión de hoy; olvidar apuntar ayer es irrecuperable por la UNIQUE de fecha. **Dónde:** `today` fijo `gym.tsx:70,117-119` · **Impacto:** 3 · **Esfuerzo:** L

### GYM-122 · Mostrar XP potencial incluyendo PRs estimados antes de terminar
**Qué:** El botón dice "+50 XP" (`gym.tsx:209`) sin contar PRs posibles; actualizar el rótulo en vivo según pesos superando récord. **Dónde:** `gym.tsx:209` · **Impacto:** 2 · **Esfuerzo:** M

### GYM-123 · Persistir el borrador de entreno si la app se cierra a mitad
**Qué:** Si se mata la app durante `training`, los pesos tecleados se pierden (estado en memoria). Guardar borrador en AsyncStorage. **Dónde:** `lifts`/`training` `gym.tsx:57-58` · **Impacto:** 2 · **Esfuerzo:** M

### GYM-124 · Evitar `String(e.weight)` con decimales largos
**Qué:** Un `weight` 82.5 numeric se precarga "82.5" pero un 82.50 de BD podría llegar "82.5"/"82.50" inconsistente; normalizar formato al precargar (`gym.tsx:95`). **Dónde:** `gym.tsx:95` · **Impacto:** 1 · **Esfuerzo:** S

### GYM-125 · Mensajería del sistema al subir de nivel desde el gym
**Qué:** `setLevelUp(res.newLevel)` (`gym.tsx:144`) muestra el overlay genérico; un copy específico "FUE +N por entreno" reforzaría la temática. **Dónde:** `gym.tsx:144` · **Impacto:** 1 · **Esfuerzo:** S

### GYM-126 · Bloquear `add` del header mientras un modal está abierto
**Qué:** Con el sheet de día abierto, el `+` del header (`gym.tsx:185`) sigue activo y puede reabrirlo. **Dónde:** `gym.tsx:185-187` · **Impacto:** 1 · **Esfuerzo:** S

Total: 126 mejoras, 5 bugs.
