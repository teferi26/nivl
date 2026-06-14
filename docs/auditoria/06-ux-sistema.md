# UX/UI pantalla Sistema (home)

> Área SIS · auditoría de código NIVL · anclada al código real

Ámbito auditado: `src/app/(tabs)/index.tsx` (pantalla `Sistema`, pestaña home) y sus dependencias directas de render: `QuestItem.tsx`, `SystemWindow.tsx`, `XpToast.tsx`, `LevelUpOverlay.tsx`, `XPBar.tsx`, `Hexagon.tsx`. Lógica leída para contexto: `engine.ts`, `data.ts`, `game.ts`, `closing.ts`, `dates.ts`, `voice.ts`, `theme.ts`, `types.ts`.

La pantalla Sistema es la más usada de la app: muestra el perfil (nivel, XP, racha, piedras), los avisos de cierre/pausa, las misiones del día y una rejilla de 6 módulos. El flujo crítico es "completar una misión" (con o sin evidencia). Esta auditoría se centra en fricción de ese flujo, optimistic UI, estados (vacío/cargando/error), jerarquía visual, accesibilidad y descubribilidad.

## Bugs y riesgos

### CRIT-SIS-01 · El aviso de cierre (`dayResult`) nunca se limpia y queda pegado para siempre — `(tabs)/index.tsx:41,66` · severidad alta
**Problema:** `dayResult` se setea con `if (result) setDayResult(result)` (línea 66) pero jamás se vuelve a `null`. `load()` se ejecuta en CADA foco de la pestaña (`useFocusEffect`, línea 78). El segundo día `processPendingDays` ya devuelve `result === null` (porque `last_day_processed >= yesterday`, engine.ts:33), así que la condición `if (result)` es falsa y NO sobrescribe: el panel "ALERTA DEL SISTEMA / INFORME DEL CIERRE" de ayer (o de hace una semana) sigue visible indefinidamente, restando claridad y alarmando sin motivo. También se acumula visualmente con un cierre nuevo.
**Arreglo:** setear siempre el resultado: `setDayResult(result)` (sin el guard), de modo que un `null` lo borre. Además, hacerlo descartable: envolver el `SystemWindow` del cierre con una `Pressable`/botón "Entendido" que haga `setDayResult(null)`, y/o auto-ocultar tras X segundos. Idealmente persistir un flag "visto" para no re-mostrar el mismo cierre tras un simple cambio de pestaña dentro del mismo día.

### CRIT-SIS-02 · Doble toque durante la captura de evidencia permite completar la misión dos veces — `(tabs)/index.tsx:103,105,151-168` · severidad alta
**Problema:** `busyQuestId` solo se activa DENTRO de `finishQuest` (línea 105), que se llama DESPUÉS de que la cámara devuelva (`captureEvidence().then(...)`, líneas 152-153 y 161-162). Mientras la cámara/permiso está abierto, la `QuestItem` no está `busy` ni `completed`, así que sigue pulsable (`QuestItem.tsx:21` `disabled={completed || busy}`). En la ruta del `Alert` (líneas 157-168) ocurre igual: el ítem queda activo mientras el Alert está abierto. Resultado: con dobles toques o reentradas se pueden disparar dos `completeQuest` → dos filas en `completions` y doble XP (agravado porque las mutaciones de XP son read-modify-write sin transacción). 
**Arreglo:** marcar la misión como ocupada al inicio de `onComplete` (`setBusyQuestId(quest.id)`) antes de abrir cámara/Alert, y limpiarla en todas las salidas (cancelación, error, sin permiso). Alternativa robusta: un `Set<string>` de ids "en curso" o un guard `if (busyQuestId) return;` al entrar en `onComplete`.

### CRIT-SIS-03 · La inserción optimista usa `id: 'local'` fijo y `user_id` incoherente — `(tabs)/index.tsx:111-122` · severidad media
**Problema:** al completar, se inserta en el estado un `Completion` con `id: 'local'` constante (línea 113) y `user_id: profile.id` (línea 115). Si se completan dos misiones, ambas comparten `id:'local'` (claves duplicadas si en algún punto se itera por `id`), y el `date: dateKey()` se recalcula en cada completado (riesgo de descuadre si cruza medianoche entre captura y guardado). Además nunca se reconcilia con la fila real del servidor (el `id`/`completed_at` quedan mock para siempre hasta el próximo `load`).
**Arreglo:** usar la fila real devuelta por el insert (hacer que `completeQuest` retorne el `Completion` insertado con `.select().single()`) y guardarla; o al menos generar un id único (`crypto.randomUUID()`/`local-${quest.id}`) y fijar la fecha una sola vez por sesión de completado.

### CRIT-SIS-04 · Misiones interactivas y nota de penalización incoherentes cuando el sistema está "en pausa" hoy — `(tabs)/index.tsx:179,279-303` · severidad media
**Problema:** `frozen` se calcula con `profile.freeze_until >= today` (línea 179). Cuando la pausa incluye HOY, se muestra el banner "SISTEMA EN PAUSA" (líneas 236-245) pero justo debajo la ventana "MISIONES DE HOY" sigue listando las misiones del día y permite completarlas (líneas 284-294). El usuario recibe el mensaje "sin misiones, sin penalizaciones" (`voice.frozen`) y a la vez ve misiones que puede tocar. La nota de penalización se oculta con `!frozen` (línea 299) pero las misiones no. Mensaje contradictorio.
**Arreglo:** decidir el contrato: si en pausa NO hay misiones, ocultar/atenuar la lista y sustituirla por un estado "en pausa hasta {fecha}"; si se permite completarlas voluntariamente (siguen dando XP vía `completeQuest`, que no comprueba `frozen`), aclararlo en copy ("puedes completar misiones, pero hoy nada penaliza"). Hoy el código permite completar pero el copy dice lo contrario.

### CRIT-SIS-05 · `XpToast` reinicia su animación en cada render por la dependencia `onDone` — `XpToast.tsx:27`, `(tabs)/index.tsx:319` · severidad baja
**Problema:** el `useEffect` de `XpToast` incluye `onDone` en deps (línea 27), y desde la pantalla se pasa `onDone={() => setToast(null)}` (index.tsx:319), una función nueva en cada render. Cualquier re-render del Sistema mientras el toast está visible (p. ej. el toast en sí provoca `setToast`, o llega `setProfile`) recrea `onDone`, vuelve a entrar el efecto y reinicia la secuencia (`translateY/opacity` a valores iniciales), produciendo un parpadeo o reinicio del "+XP".
**Arreglo:** memoizar el callback con `useCallback(() => setToast(null), [])` en la pantalla, y/o quitar `onDone` de las deps usando un `ref` para la última versión del callback dentro de `XpToast`.

## Mejoras

### SIS-001 · Limpiar siempre `dayResult` en cada carga
**Qué:** quitar el guard `if (result)` (línea 66) y llamar `setDayResult(result)` siempre, para que un cierre antiguo desaparezca. **Dónde:** `(tabs)/index.tsx:66`. **Impacto:** 5 · **Esfuerzo:** S

### SIS-002 · Botón "Entendido" para descartar el panel de cierre
**Qué:** envolver la ventana de `dayResult` con una acción que haga `setDayResult(null)`; un aviso de penalización debe poder cerrarse a mano. **Dónde:** `(tabs)/index.tsx:247-270`. **Impacto:** 4 · **Esfuerzo:** S

### SIS-003 · Persistir "cierre ya visto" para no repetirlo al cambiar de pestaña
**Qué:** guardar en AsyncStorage la fecha del último cierre mostrado y no re-renderizar el mismo `dayResult` en focos posteriores del mismo día. **Dónde:** `(tabs)/index.tsx:53,66`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-004 · Marcar `busy` antes de abrir cámara/Alert
**Qué:** mover `setBusyQuestId(quest.id)` al inicio de `onComplete` y limpiarlo en todas las salidas para impedir doble completado. **Dónde:** `(tabs)/index.tsx:146-169`. **Impacto:** 5 · **Esfuerzo:** M

### SIS-005 · Guard de reentrada en `onComplete`
**Qué:** `if (busyQuestId) return;` al inicio de `onComplete` para evitar abrir dos cámaras/Alerts simultáneos. **Dónde:** `(tabs)/index.tsx:146`. **Impacto:** 4 · **Esfuerzo:** S

### SIS-006 · Reconciliar la completion optimista con la fila real
**Qué:** que `completeQuest` devuelva el `Completion` insertado (`.select().single()`) y guardarlo en lugar del mock `id:'local'`. **Dónde:** `(tabs)/index.tsx:111-122`, `engine.ts:129-136`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-007 · Id único en la completion optimista
**Qué:** mientras no se reconcilie, usar `local-${quest.id}` en vez de `'local'` para evitar ids duplicados en estado. **Dónde:** `(tabs)/index.tsx:113`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-008 · Fijar la fecha del completado una sola vez
**Qué:** calcular `const today = dateKey()` una vez en `finishQuest` y reutilizarlo para insert y estado, evitando descuadre si cruza medianoche. **Dónde:** `(tabs)/index.tsx:117`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-009 · Coherencia visual del estado "en pausa"
**Qué:** cuando `frozen` incluye hoy, atenuar u ocultar la lista de misiones y mostrar un estado dedicado "en pausa hasta {fecha}". **Dónde:** `(tabs)/index.tsx:272-304`. **Impacto:** 4 · **Esfuerzo:** M

### SIS-010 · Aclarar copy de pausa vs. misiones completables
**Qué:** si se permite completar en pausa, el copy debe decir "puedes completar; hoy nada penaliza" en vez de "sin misiones". **Dónde:** `(tabs)/index.tsx:241-243`. **Impacto:** 3 · **Esfuerzo:** S

### SIS-011 · Memoizar `onDone` del toast
**Qué:** `const clearToast = useCallback(() => setToast(null), [])` y pasarlo al `XpToast`. **Dónde:** `(tabs)/index.tsx:319`. **Impacto:** 3 · **Esfuerzo:** S

### SIS-012 · Estado de carga inicial (skeleton)
**Qué:** mientras `profile === null` mostrar un esqueleto del SystemWindow del perfil y de misiones, no la pantalla casi vacía. **Dónde:** `(tabs)/index.tsx:197,279`. **Impacto:** 4 · **Esfuerzo:** M

### SIS-013 · Distinguir "cargando" de "sin misiones"
**Qué:** hoy `sorted.length===0` muestra "No hay misiones programadas" incluso durante la primera carga (falso negativo). Añadir un flag `loading` para no mostrar el vacío hasta resolver. **Dónde:** `(tabs)/index.tsx:279-282`. **Impacto:** 4 · **Esfuerzo:** S

### SIS-014 · Estado de error con reintento, no solo Alert
**Qué:** si `load()` falla (línea 73), además del Alert mostrar una tarjeta inline "No se pudo cargar · Reintentar" con botón a `load()`. **Dónde:** `(tabs)/index.tsx:73-75`. **Impacto:** 4 · **Esfuerzo:** M

### SIS-015 · Distinguir error transitorio (offline) de error real
**Qué:** detectar fallo de red para mostrar copy "sin conexión" y reintentar automáticamente al recuperar foco, en vez de "Fallo desconocido". **Dónde:** `(tabs)/index.tsx:74`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-016 · Reemplazar el `Alert` de evidencia por un sheet inmersivo
**Qué:** el `Alert.alert('Completar misión'...)` (líneas 157-168) rompe la estética Solo Leveling; sustituir por un `SystemWindow`-modal con botones "Cámara +25%" / "Sin evidencia" / "Cancelar". **Dónde:** `(tabs)/index.tsx:157-168`. **Impacto:** 5 · **Esfuerzo:** L

### SIS-017 · Recordar la preferencia "no preguntar evidencia"
**Qué:** opción "no volver a preguntar" para misiones sin `requires_evidence`, guardada en AsyncStorage, para quitar un tap por misión. **Dónde:** `(tabs)/index.tsx:157`. **Impacto:** 4 · **Esfuerzo:** M

### SIS-018 · Permitir adjuntar evidencia desde galería, no solo cámara
**Qué:** `captureEvidence` solo lanza `launchCameraAsync` (línea 94); ofrecer también `launchImageLibraryAsync` para evidencias ya tomadas. **Dónde:** `(tabs)/index.tsx:88-101`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-019 · Mensaje claro cuando se deniega el permiso de cámara
**Qué:** si `!perm.granted` (línea 90), ofrecer abrir Ajustes (`Linking.openSettings()`) en vez de solo un Alert informativo. **Dónde:** `(tabs)/index.tsx:90-92`. **Impacto:** 3 · **Esfuerzo:** S

### SIS-020 · Manejar permiso "no preguntar de nuevo"
**Qué:** distinguir `canAskAgain === false` para guiar al usuario a Ajustes en lugar de re-pedir y fallar silenciosamente. **Dónde:** `(tabs)/index.tsx:89-92`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-021 · Feedback háptico al abrir la cámara / denegar
**Qué:** hoy solo hay háptico en éxito (línea 108). Añadir háptico ligero al iniciar captura y `Warning` al denegar permiso. **Dónde:** `(tabs)/index.tsx:88-101`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-022 · Indicador de subida de evidencia
**Qué:** la subida (`uploadEvidence`) ocurre dentro de `completeQuest` y puede tardar; mostrar "Subiendo evidencia…" mientras `busy`, no solo el spinner genérico. **Dónde:** `(tabs)/index.tsx:107`, `QuestItem.tsx:26-30`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-023 · Comprimir/limitar tamaño de evidencia antes de subir
**Qué:** `quality: 0.4` (línea 96) ayuda, pero conviene redimensionar (expo-image-manipulator) para acotar el base64 y la subida en redes lentas. **Dónde:** `(tabs)/index.tsx:94-98`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-024 · No reventar si `result.assets[0]` falta
**Qué:** `result.assets[0]?.base64 ?? null` (línea 100) ya es seguro, pero conviene avisar al usuario si el asset llega sin base64 (foto corrupta) en vez de "completar sin evidencia" en silencio. **Dónde:** `(tabs)/index.tsx:100`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-025 · Confirmar antes de completar una misión de penalización
**Qué:** `onComplete` con `is_penalty` ejecuta `finishQuest` directo (líneas 147-150); una confirmación ("Redimir −X XP") evita toques accidentales en un ítem destacado arriba. **Dónde:** `(tabs)/index.tsx:147-150`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-026 · Animación al desaparecer una misión completada
**Qué:** al completar, el ítem solo cambia de estilo; una transición (tachado animado, fade del XP) reforzaría la recompensa. **Dónde:** `QuestItem.tsx:33-51`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-027 · Mover misiones completadas al fondo de la lista
**Qué:** el `sort` (índex línea 180) solo prioriza penalizaciones; reordenar pendientes arriba y completadas abajo reduce el escaneo visual. **Dónde:** `(tabs)/index.tsx:180`. **Impacto:** 3 · **Esfuerzo:** S

### SIS-028 · Barra de progreso del día de misiones
**Qué:** además del contador `completedCount/sorted.length` (líneas 275-277), una `XPBar` reutilizada mostrando % del día completado refuerza el avance. **Dónde:** `(tabs)/index.tsx:273-278`. **Impacto:** 3 · **Esfuerzo:** S

### SIS-029 · Celebración al completar el último pendiente
**Qué:** cuando `pendingCount` pasa a 0 in-session, animar el `allDone` (líneas 296-298) con un destello/háptico de "día limpio", no solo aparecer texto. **Dónde:** `(tabs)/index.tsx:296-298`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-030 · `numberOfLines={1}` corta títulos largos sin pista
**Qué:** `QuestItem` trunca el título a una línea (línea 33). Para misiones con nombre largo, permitir 2 líneas o tooltip al pulsar largo. **Dónde:** `QuestItem.tsx:33`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-031 · Área de toque del checkbox separada del título
**Qué:** todo el `Pressable` completa la misión; algunos usuarios esperan tocar el cuadro. Mantener toda la fila como acción pero agrandar el `box` (20×20, líneas 68-75) mejora la affordance. **Dónde:** `QuestItem.tsx:68-75`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-032 · Mostrar la dificultad en el ítem de misión
**Qué:** la fila muestra stat y cámara, pero no la dificultad (que determina el XP). Un chip "Media/Difícil" da contexto al "+50 XP". **Dónde:** `QuestItem.tsx:36-47`. **Impacto:** 3 · **Esfuerzo:** S

### SIS-033 · Indicar el bonus de evidencia en el preview de XP
**Qué:** `previewXp` se calcula con `evidence:false` (QuestItem.tsx:17); para misiones con cámara, mostrar "+X (+25% con evidencia)" anticipa la recompensa real. **Dónde:** `QuestItem.tsx:17,49-51`. **Impacto:** 3 · **Esfuerzo:** S

### SIS-034 · Mostrar la racha actual con icono de fuego
**Qué:** "Racha {n} · ×{m}" (líneas 223-224) es texto plano; un icono de llama y color que escala con la racha la hace más motivadora. **Dónde:** `(tabs)/index.tsx:223-224`. **Impacto:** 3 · **Esfuerzo:** S

### SIS-035 · Tooltip/explicación de las piedras de protección
**Qué:** el contador de piedras (líneas 226-229) es opaco para quien no conoce la mecánica; pulsar abre un `SystemWindow` explicando qué hacen. **Dónde:** `(tabs)/index.tsx:226-229`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-036 · Animar la `XPBar` al ganar XP
**Qué:** la barra (`XPBar.tsx`) cambia de ancho instantáneamente; animar `width` con `Animated`/`withTiming` haría sentir el progreso al completar. **Dónde:** `XPBar.tsx:14-16`, `(tabs)/index.tsx:217`. **Impacto:** 4 · **Esfuerzo:** M

### SIS-037 · Animar el número de nivel al subir
**Qué:** `lv.level` (línea 213) salta de golpe; tras `LevelUpOverlay`, animar el LV en la tarjeta refuerza el cambio. **Dónde:** `(tabs)/index.tsx:213`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-038 · Evitar `ratio` NaN/Infinity en la XPBar
**Qué:** `lvl.into / lvl.next` (línea 217); aunque `next = xpCostForLevel(level)` nunca es 0 para level≥1, conviene blindar `XPBar` ante `next===0` (clamp ya cubre NaN→0 vía `Math.max`, pero `Math.round(NaN)` es NaN). **Dónde:** `XPBar.tsx:12`, `(tabs)/index.tsx:217`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-039 · `accessibilityLabel`/`Role` en los módulos
**Qué:** los `Pressable` de módulos (líneas 309-313) no tienen `accessibilityRole="button"` ni label; lectores de pantalla solo leerán el texto. Añadir roles y hints. **Dónde:** `(tabs)/index.tsx:309-313`. **Impacto:** 3 · **Esfuerzo:** S

### SIS-040 · `accessibilityLabel` en cada misión
**Qué:** `QuestItem` carece de label accesible que combine título + stat + XP + estado completado. **Dónde:** `QuestItem.tsx:20-23`. **Impacto:** 3 · **Esfuerzo:** S

### SIS-041 · `accessibilityState={{ disabled, checked }}` en la misión
**Qué:** exponer `checked: completed` y `disabled: busy` para tecnología asistiva. **Dónde:** `QuestItem.tsx:20-24`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-042 · Tamaños de fuente fijos ignoran ajustes de accesibilidad
**Qué:** todos los `fontSize` son numéricos fijos (p. ej. `lvValue` 30, `name` 18); no escalan con la configuración del SO. Revisar `allowFontScaling`/escala relativa. **Dónde:** `(tabs)/index.tsx:325-495`. **Impacto:** 3 · **Esfuerzo:** L

### SIS-043 · Contraste del texto secundario
**Qué:** `textFaint #56698A` sobre `bg #060B16` (p. ej. `date` línea 194, `pendingNote`) puede quedar bajo en contraste AA; verificar ratio y subir si procede. **Dónde:** `theme.ts:20`, `(tabs)/index.tsx:346-350`. **Impacto:** 3 · **Esfuerzo:** S

### SIS-044 · `hitSlop` en controles pequeños
**Qué:** el checkbox de misión (20×20) y los iconos quedan por debajo del objetivo táctil de 44pt; añadir `hitSlop`. **Dónde:** `QuestItem.tsx:68-75`. **Impacto:** 3 · **Esfuerzo:** S

### SIS-045 · Respetar "reduce motion" en overlays
**Qué:** `LevelUpOverlay` y los `Ring` animan en bucle; si el usuario activó "reducir movimiento", deberían simplificarse. **Dónde:** `LevelUpOverlay.tsx:17-33,46-55`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-046 · Anunciar el XP ganado a lectores de pantalla
**Qué:** el `XpToast` es `pointerEvents="none"` y visual; usar `AccessibilityInfo.announceForAccessibility('+X XP')`. **Dónde:** `XpToast.tsx:32`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-047 · Recalcular `sorted`/contadores con `useMemo`
**Qué:** `sorted`, `completedCount`, `pendingCount` (líneas 180-182) se recomputan en cada render (incluido el del toast); memoizar por `[todayQuests, completions]`. **Dónde:** `(tabs)/index.tsx:180-182`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-048 · `MODULES.map` con `router.push` recrea closures
**Qué:** cada render crea nuevas funciones `onPress` (línea 310); con `MODULES` constante, extraer un componente `ModuleButton` memoizado. **Dónde:** `(tabs)/index.tsx:309-313`. **Impacto:** 1 · **Esfuerzo:** S

### SIS-049 · `QuestItem` sin `React.memo`
**Qué:** al re-render del Sistema (toast, profile) se re-renderizan todas las `QuestItem`; envolver en `memo` con comparación por props evita trabajo. **Dónde:** `QuestItem.tsx:16`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-050 · `SystemWindow` mide en cada layout y setea estado
**Qué:** el `onLayout`+`useState` (SystemWindow.tsx:25-32) provoca un render extra por ventana al montar; con varias ventanas en la home es coste repetido. Considerar medir una vez o usar SVG con `viewBox` percentual. **Dónde:** `SystemWindow.tsx:25-37`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-051 · Doble `fetchQuests` en `load`
**Qué:** `load` llama `fetchQuests` (línea 52) y de nuevo si hubo penalización (líneas 55-57); aceptable, pero se puede evitar refetch fusionando la quest de penalización recién insertada en el array local. **Dónde:** `(tabs)/index.tsx:52-57`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-052 · `completionStats()` se llama en cada completado
**Qué:** tras cada misión se hacen 2 COUNT a Supabase (línea 125, data.ts:74-83) solo para evaluar logros; cachear el total y delta localmente reduce latencia y red. **Dónde:** `(tabs)/index.tsx:125`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-053 · Evaluación de logros bloquea el cierre del flujo
**Qué:** `finishQuest` espera `completionStats` + `unlockAchievements` (líneas 125-135) antes de soltar `busy`; mover a "fire-and-forget" tras actualizar UI agiliza la percepción. **Dónde:** `(tabs)/index.tsx:125-138`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-054 · No revertir el optimistic UI si `completeQuest` falla
**Qué:** la inserción optimista en `completions` ocurre tras `await completeQuest` (líneas 109-122), así que un fallo no deja UI inconsistente — pero el `setProfile(res.profile)` y `setToast` también están detrás del await, lo que retrasa el feedback. Plantear optimismo real con rollback en `catch`. **Dónde:** `(tabs)/index.tsx:107-122,139-141`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-055 · Feedback inmediato al tocar (antes del await)
**Qué:** hoy el spinner (`busy`) aparece pero la recompensa (toast/XP) solo tras la red; mostrar el `+XP` optimista al instante y confirmar/ajustar luego. **Dónde:** `(tabs)/index.tsx:105-110`. **Impacto:** 4 · **Esfuerzo:** L

### SIS-056 · Colapsar avisos múltiples (pausa + cierre) con jerarquía
**Qué:** pausa (236), cierre (247) y misiones (272) pueden apilarse empujando las misiones muy abajo; priorizar/condensar para que las misiones queden "above the fold". **Dónde:** `(tabs)/index.tsx:236-304`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-057 · Acceso rápido a "Misiones" desde el vacío
**Qué:** el estado vacío (líneas 280-282) menciona la pestaña Misiones pero no enlaza; añadir botón "Crear misión" → `router.push('/misiones')`. **Dónde:** `(tabs)/index.tsx:280-282`. **Impacto:** 4 · **Esfuerzo:** S

### SIS-058 · CTA en la bienvenida de seed
**Qué:** el `Alert` de bienvenida (líneas 68-71) podría llevar directamente a Misiones para editar las semilla en vez de cerrarse sin más. **Dónde:** `(tabs)/index.tsx:68-71`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-059 · La rejilla de módulos es poco descubrible
**Qué:** los 6 módulos viven al fondo bajo título "MÓDULOS" atenuado (línea 307); destacar los más usados (Gym, Diario) o moverlos arriba mejora el descubrimiento. **Dónde:** `(tabs)/index.tsx:306-316`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-060 · Ancho de módulo `30.5%` frágil con gaps
**Qué:** `width: '30.5%'` + `gap: 10` (líneas 478-482) puede desbordar o dejar huecos según ancho de pantalla; usar `flexBasis` calculado o `flex:1` por columna. **Dónde:** `(tabs)/index.tsx:475-489`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-061 · Badges de novedad en módulos (p. ej. compra pendiente)
**Qué:** mostrar un punto/contador en "Compra" si hay ítems pendientes, "Dieta" si falta registrar, etc., aumenta el valor de la rejilla. **Dónde:** `(tabs)/index.tsx:308-315`. **Impacto:** 3 · **Esfuerzo:** L

### SIS-062 · Háptico al pulsar un módulo
**Qué:** `router.push` sin feedback; un `Haptics.selectionAsync()` al tocar refuerza la interacción premium. **Dónde:** `(tabs)/index.tsx:310`. **Impacto:** 1 · **Esfuerzo:** S

### SIS-063 · Saludo contextual por hora del día
**Qué:** el header solo muestra NIVL + fecha (líneas 192-195); un saludo "Buenas noches, cazador" según hora añade calidez ganada. **Dónde:** `(tabs)/index.tsx:192-195`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-064 · Mostrar cuántas misiones quedan en el header de la ventana
**Qué:** complementar el contador `completedCount/total` con "faltan N" cuando hay pendientes, más explícito que la fracción. **Dónde:** `(tabs)/index.tsx:275-277`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-065 · Hora límite real en la nota de penalización
**Qué:** "a medianoche se aplica" (línea 302) es genérico; mostrar la cuenta atrás o la hora local exacta crea urgencia útil. **Dónde:** `(tabs)/index.tsx:299-303`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-066 · `formatLongDate()` se recalcula sin memo y no incluye año
**Qué:** la fecha (línea 194) podría incluir el año o "Hoy"; menor, pero `formatLongDate` se invoca en cada render. **Dónde:** `(tabs)/index.tsx:194`, `dates.ts:28-31`. **Impacto:** 1 · **Esfuerzo:** S

### SIS-067 · Avatar real en el hexágono si existe `avatar_url`
**Qué:** el hexágono muestra la inicial (líneas 200-202) aunque `Profile.avatar_url` exista; renderizar la imagen si está disponible. **Dónde:** `(tabs)/index.tsx:200-202`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-068 · `profile.name.charAt(0)` revienta si el nombre está vacío
**Qué:** si `name === ''`, `charAt(0).toUpperCase()` da cadena vacía (no crashea) pero deja el hexágono sin letra; mostrar un icono por defecto. **Dónde:** `(tabs)/index.tsx:201`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-069 · Resaltar el título equipado
**Qué:** `equipped_title` se muestra inline con el rango (líneas 206-208); darle estilo propio (color/realce) recompensa al usuario que lo equipó. **Dónde:** `(tabs)/index.tsx:205-209`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-070 · Mostrar XP total acumulado
**Qué:** la tarjeta muestra into/next (líneas 219-221) pero no el `xp_total`; un dato "XP total" satisface al jugador de largo plazo. **Dónde:** `(tabs)/index.tsx:218-221`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-071 · Tocar la tarjeta de perfil lleva a Perfil
**Qué:** la cabecera de perfil (líneas 198-233) no es interactiva; hacerla `Pressable` → pestaña Perfil acorta la navegación. **Dónde:** `(tabs)/index.tsx:198-233`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-072 · Indicar progreso hacia el siguiente rango
**Qué:** se muestra el rango actual (líneas 207-208) pero no cuánto falta para el siguiente; un "Rango D en LV.11" motiva. **Dónde:** `(tabs)/index.tsx:205-209`, `game.ts:58-65`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-073 · `ScrollView` no usa `keyboardShouldPersistTaps`
**Qué:** sin teclado en esta pantalla es menor, pero conviene `keyboardShouldPersistTaps="handled"` por robustez futura. **Dónde:** `(tabs)/index.tsx:186-191`. **Impacto:** 1 · **Esfuerzo:** S

### SIS-074 · `RefreshControl` sin color de fondo del spinner en Android
**Qué:** solo se pasa `tintColor` (iOS, línea 189); añadir `colors`/`progressBackgroundColor` para que el refresh sea visible en Android sobre fondo oscuro. **Dónde:** `(tabs)/index.tsx:188-190`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-075 · Evitar refrescos solapados
**Qué:** `onRefresh` y `useFocusEffect` pueden disparar `load()` a la vez; un guard `if (loadingRef.current) return` evita dobles cargas y parpadeos. **Dónde:** `(tabs)/index.tsx:47-82,171-175`. **Impacto:** 3 · **Esfuerzo:** S

### SIS-076 · Cancelar `load()` en desmontaje
**Qué:** `load` es async y setea estado al volver; si la pantalla se desmonta a mitad puede avisar de "update on unmounted". Usar un flag/`AbortController`. **Dónde:** `(tabs)/index.tsx:47-76`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-077 · `ensureDailyNotifications` sin manejo de error
**Qué:** se llama en `useEffect` (líneas 84-86) sin `try/catch`; si rechaza (permiso, plataforma) podría romper. Aislarlo. **Dónde:** `(tabs)/index.tsx:84-86`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-078 · Re-ejecutar notificaciones al cambiar de día
**Qué:** `ensureDailyNotifications` solo corre al montar (deps `[]`); si la app vive abierta y cambia el día, no se reprograman. **Dónde:** `(tabs)/index.tsx:84-86`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-079 · `seedDefaultQuests` y la bienvenida pueden duplicarse
**Qué:** si `load()` corre dos veces seguidas (doble foco) antes de que el primer seed termine, el `count===0` puede ser cierto en ambas y crear semillas duplicadas. **Dónde:** `(tabs)/index.tsx:51,67-72`, `data.ts:129-137`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-080 · Recalcular `today`/`frozen` al cambiar de día con la app abierta
**Qué:** `today = dateKey()` se calcula en render (línea 177) pero `load` no se redispara solo al cruzar medianoche; un timer o listener de `AppState` refrescaría el estado. **Dónde:** `(tabs)/index.tsx:177-179`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-081 · Refrescar al volver del background
**Qué:** suscribirse a `AppState` 'active' para recargar (procesar cierres pendientes) cuando el usuario reabre la app sin cambiar de pestaña. **Dónde:** `(tabs)/index.tsx:78-86`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-082 · Toast no encola múltiples XP
**Qué:** completar dos misiones rápido sobrescribe `toast` (línea 110); encolar o sumar los "+XP" evita perder feedback. **Dónde:** `(tabs)/index.tsx:110`, `XpToast.tsx`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-083 · Toast y LevelUp pueden competir visualmente
**Qué:** al subir de nivel se muestran toast (línea 110) y `LevelUpOverlay` (línea 123) a la vez; coordinar para que el overlay no tape el toast o secuenciarlos. **Dónde:** `(tabs)/index.tsx:110,123`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-084 · Logro tras subir de nivel se silencia
**Qué:** `if (fresh.length > 0 && !res.leveledUp)` (línea 136) oculta el Alert de logro cuando además subes nivel; el logro se pierde para el usuario. Encolar el logro tras cerrar el overlay. **Dónde:** `(tabs)/index.tsx:136-138`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-085 · Logros mostrados con `Alert` nativo
**Qué:** el desbloqueo de logro usa `Alert.alert('LOGRO DESBLOQUEADO'...)` (línea 137), rompiendo la estética; sustituir por un overlay temático. **Dónde:** `(tabs)/index.tsx:137`. **Impacto:** 4 · **Esfuerzo:** L

### SIS-086 · Varios logros a la vez se listan con `\n`
**Qué:** `fresh.map(a => a.name).join('\n')` (línea 137) en un Alert es pobre; un carrusel/lista temática presenta mejor múltiples logros. **Dónde:** `(tabs)/index.tsx:137`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-087 · Sonido opcional en hitos
**Qué:** subir de nivel/desbloquear logro podría reproducir un sonido corto (con preferencia para silenciar), elevando la sensación premium. **Dónde:** `(tabs)/index.tsx:123,137`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-088 · `LevelUpOverlay` sin `accessibilityViewIsModal`
**Qué:** el `Modal` (LevelUpOverlay.tsx:58) debería marcar el contenido como modal para lectores y enfocar el título al abrir. **Dónde:** `LevelUpOverlay.tsx:58-64`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-089 · Cierre del overlay solo por toque en backdrop
**Qué:** `LevelUpOverlay` cierra al tocar cualquier sitio (línea 59); en Android conviene también el botón atrás (`onRequestClose` ya existe) y un botón visible "Continuar". **Dónde:** `LevelUpOverlay.tsx:59-72`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-090 · `Math.random` en `voice.*` re-elige en cada render
**Qué:** `voice.allDone()`/`frozen()` se llaman en JSX (líneas 242, 256, 267, 297) y eligen frase nueva en cada render; congelar la frase con `useMemo` evita "parpadeo de copy". **Dónde:** `(tabs)/index.tsx:242,256,267,297`. **Impacto:** 3 · **Esfuerzo:** S

### SIS-091 · Texto del cierre cambia entre renders
**Qué:** igual que arriba, `voice.stoneUsed()`/`stoneEarned()`/`penaltyApplied()` (líneas 256-267) pueden cambiar si el componente re-renderiza con el `dayResult` aún visible. Fijarlos al recibir el resultado. **Dónde:** `(tabs)/index.tsx:256-267`. **Impacto:** 3 · **Esfuerzo:** S

### SIS-092 · Color hardcoded en `alertBody`
**Qué:** `color: '#E8C9CD'` (línea 436) no usa `theme.ts`; moverlo a `colors` para coherencia y theming. **Dónde:** `(tabs)/index.tsx:436`. **Impacto:** 1 · **Esfuerzo:** S

### SIS-093 · Estilos inline mezclados con StyleSheet
**Qué:** hay objetos de estilo inline (líneas 216, 222, 252) que rompen la consistencia y crean objetos por render; moverlos a `styles`. **Dónde:** `(tabs)/index.tsx:216,222,252`. **Impacto:** 1 · **Esfuerzo:** S

### SIS-094 · `marginTop: 12` inline en bloque XP
**Qué:** `<View style={{ marginTop: 12 }}>` (línea 216) debería ser un estilo nombrado. **Dónde:** `(tabs)/index.tsx:216`. **Impacto:** 1 · **Esfuerzo:** S

### SIS-095 · Extraer la tarjeta de perfil a un componente
**Qué:** el bloque perfil (líneas 197-234) es grande y reutilizable (Perfil podría usar variante); extraer `ProfileCard`. **Dónde:** `(tabs)/index.tsx:197-234`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-096 · Extraer el panel de cierre a `DayCloseCard`
**Qué:** el `SystemWindow` del cierre (líneas 247-270) tiene lógica de color/copy; aislarlo simplifica la pantalla y facilita tests. **Dónde:** `(tabs)/index.tsx:247-270`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-097 · Extraer la rejilla de módulos a `ModuleGrid`
**Qué:** mover `MODULES` + render (líneas 25-32, 306-316) a su propio componente reutilizable y testeable. **Dónde:** `(tabs)/index.tsx:25-32,306-316`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-098 · Tipar `route` de `MODULES` con el tipo de expo-router
**Qué:** `route: '/gym'` es `as const` string; tipar contra `Href` de expo-router previene rutas inválidas en `router.push`. **Dónde:** `(tabs)/index.tsx:25-32,310`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-099 · Centralizar el manejo de errores de Supabase
**Qué:** el patrón `e instanceof Error ? e.message : 'Fallo desconocido'` se repite (líneas 74, 140); extraer helper `systemError(e)` con copy temático. **Dónde:** `(tabs)/index.tsx:74,140`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-100 · Mensajes de error con la voz del sistema
**Qué:** "Error del sistema" + `e.message` crudo (líneas 74, 140) expone detalles técnicos; envolver en copy de `voice` ("El sistema ha encontrado una anomalía"). **Dónde:** `(tabs)/index.tsx:74,140`, `voice.ts`. **Impacto:** 3 · **Esfuerzo:** S

### SIS-101 · Loguear errores para diagnóstico
**Qué:** los `catch` solo muestran Alert; añadir `console.warn`/telemetría ayuda a depurar fallos del flujo crítico. **Dónde:** `(tabs)/index.tsx:73,139`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-102 · Tests del cálculo de `sorted`/contadores
**Qué:** extraer la lógica de orden y conteo (líneas 180-182) a una función pura y testearla (penalización primero, completadas, vacío). **Dónde:** `(tabs)/index.tsx:180-182`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-103 · Tests del flujo `onComplete` (penalización / evidencia / normal)
**Qué:** cubrir las tres ramas (líneas 146-169) con mocks de cámara para garantizar que cada una llama `finishQuest` correctamente. **Dónde:** `(tabs)/index.tsx:146-169`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-104 · Test del estado vacío vs cargando
**Qué:** verificar que el texto "No hay misiones" no aparece durante la carga inicial (depende de SIS-013). **Dónde:** `(tabs)/index.tsx:279-282`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-105 · Test del bug de `dayResult` pegajoso
**Qué:** test de regresión que monte→cierre con resultado→refoco sin resultado y asegure que el panel desaparece (cubre CRIT-SIS-01). **Dónde:** `(tabs)/index.tsx:66`. **Impacto:** 3 · **Esfuerzo:** S

### SIS-106 · Snapshot/visual test de la home con datos representativos
**Qué:** snapshots para: día limpio, con penalización, en pausa, sin misiones; detecta regresiones de jerarquía. **Dónde:** `(tabs)/index.tsx` (toda la pantalla). **Impacto:** 2 · **Esfuerzo:** M

### SIS-107 · Caso límite: lista enorme de misiones
**Qué:** con muchas misiones diarias el `ScrollView` renderiza todas; valorar `FlatList`/virtualización si el set crece. **Dónde:** `(tabs)/index.tsx:284-294`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-108 · Caso límite: muchos avisos apilados
**Qué:** pausa + cierre con penalización + nota de pendientes empujan los módulos fuera de vista; probar y priorizar (relacionado con SIS-056). **Dónde:** `(tabs)/index.tsx:236-316`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-109 · Caso límite: nivel 999 / XP máximo
**Qué:** `levelFromXp` tope 999 (game.ts:49); comprobar que la tarjeta y la barra no rompen en el techo (into/next con level=999). **Dónde:** `(tabs)/index.tsx:217`, `game.ts:46-54`. **Impacto:** 1 · **Esfuerzo:** S

### SIS-110 · Caso límite: racha muy larga
**Qué:** "Racha {n}" con n grande puede desbordar la fila (líneas 222-229); truncar o formatear (1.2k). **Dónde:** `(tabs)/index.tsx:222-229`. **Impacto:** 1 · **Esfuerzo:** S

### SIS-111 · Caso límite: nombre largo en la tarjeta
**Qué:** `name.toUpperCase()` (línea 204) sin `numberOfLines` puede desbordar junto al LV; limitar a 1-2 líneas con elipsis. **Dónde:** `(tabs)/index.tsx:204`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-112 · Caso límite: muchos módulos futuros
**Qué:** la rejilla a `30.5%` (3 por fila) no se adapta si crecen los módulos; usar layout responsivo por cantidad. **Dónde:** `(tabs)/index.tsx:308-315`. **Impacto:** 1 · **Esfuerzo:** S

### SIS-113 · `pendingNote` con singular/plural correcto
**Qué:** "1 pendiente(s)" (línea 301) es feo; pluralizar ("1 pendiente" / "3 pendientes"). **Dónde:** `(tabs)/index.tsx:301-302`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-114 · `missedTitles` no se muestran en el cierre
**Qué:** `dayResult.missedTitles` existe (engine) pero la home no lista qué misiones se fallaron; mostrarlas da contexto a la penalización. **Dónde:** `(tabs)/index.tsx:247-270`. **Impacto:** 3 · **Esfuerzo:** S

### SIS-115 · Mostrar `levelsLost` siempre que ocurra
**Qué:** solo se muestra dentro de la rama penalty (línea 261); si por cualquier vía se perdieran niveles sin penalty, no se vería. Mostrarlo de forma independiente. **Dónde:** `(tabs)/index.tsx:258-265`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-116 · Indicar piedras ganadas en día limpio
**Qué:** `stonesEarned` se muestra en el cierre (líneas 266-268), pero el `dayResult` es null si solo hubo piedra ganada (engine.ts:92-93). Asegurar que un día que SOLO gana piedra también informe. **Dónde:** `(tabs)/index.tsx:247`, `engine.ts:92-93`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-117 · Diferenciar visualmente penalización pendiente en la lista
**Qué:** la quest de penalización va arriba por el sort, pero su urgencia (recuperar XP hoy) podría destacarse con borde/halo rojo extra en la fila. **Dónde:** `QuestItem.tsx:25,80-82`, `(tabs)/index.tsx:180`. **Impacto:** 3 · **Esfuerzo:** S

### SIS-118 · Mostrar cuánto XP recupera la penalización
**Qué:** la fila penalty muestra `+penalty_xp` (QuestItem vía `questXp`), bien; añadir copy "recupera lo perdido" aclara que no es XP nuevo. **Dónde:** `QuestItem.tsx:37-43`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-119 · Empty state ilustrado
**Qué:** el vacío es solo texto (líneas 280-282); un hexágono/icono atenuado con "Sin misiones hoy" encaja mejor con el diseño. **Dónde:** `(tabs)/index.tsx:279-282`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-120 · Distinguir "día de descanso" de "sin misiones configuradas"
**Qué:** sin misiones hoy puede ser fin de semana (programadas L-V) o falta de configuración; el copy debería diferenciarlo. **Dónde:** `(tabs)/index.tsx:280-282`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-121 · Resumen "siguiente misión" cuando todo está hecho
**Qué:** al completar todo, además de `allDone`, indicar la próxima misión programada (mañana) para mantener el hábito. **Dónde:** `(tabs)/index.tsx:296-298`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-122 · Mini-resumen de stats en la home
**Qué:** la home no muestra FUE/VIT/INT/AGI/PER; un strip compacto (con `statPoints`) daría visión rápida sin ir a Perfil. **Dónde:** `(tabs)/index.tsx:197-234`, `game.ts:71-73`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-123 · Acceso rápido a mazmorras activas
**Qué:** la home no refleja proyectos en curso; una tarjeta "Mazmorras activas: N" enlazando a la pestaña aumenta cohesión. **Dónde:** `(tabs)/index.tsx` (nueva sección). **Impacto:** 3 · **Esfuerzo:** L

### SIS-124 · Cita/mensaje motivacional del sistema diario
**Qué:** un `SystemWindow` con frase del día (estable por fecha) refuerza el tono Solo Leveling sin parpadear. **Dónde:** `(tabs)/index.tsx` (nueva sección), `voice.ts`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-125 · Contador de evidencias del día
**Qué:** mostrar cuántas misiones de hoy se completaron con evidencia (refuerza el hábito del +25%). **Dónde:** `(tabs)/index.tsx:273-278`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-126 · Deshacer un completado reciente
**Qué:** ofrecer "deshacer" durante unos segundos tras completar (revierte completion y XP) para errores de toque. **Dónde:** `(tabs)/index.tsx:103-144`. **Impacto:** 3 · **Esfuerzo:** L

### SIS-127 · Confirmación visual de evidencia adjuntada
**Qué:** tras subir evidencia, marcar la fila con un icono "evidencia ✓" distinto del check normal. **Dónde:** `QuestItem.tsx:44-46`, `(tabs)/index.tsx:120`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-128 · Previsualizar la evidencia capturada antes de confirmar
**Qué:** mostrar la foto tomada con "usar / repetir" antes de subir, evitando subir fotos malas. **Dónde:** `(tabs)/index.tsx:94-100`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-129 · Mantener posición de scroll tras completar
**Qué:** si se reordena la lista al completar (SIS-027), conservar el scroll para no desorientar. **Dónde:** `(tabs)/index.tsx:186,284-294`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-130 · `testID`s para pruebas E2E
**Qué:** añadir `testID` a misiones, botón de completar, módulos y avisos para Detox/Maestro. **Dónde:** `(tabs)/index.tsx` y `QuestItem.tsx`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-131 · Evitar `Number(b.is_penalty)` en el sort
**Qué:** `Number(boolean)` (línea 180) funciona pero es poco legible; usar comparador explícito por `is_penalty`. **Dónde:** `(tabs)/index.tsx:180`. **Impacto:** 1 · **Esfuerzo:** S

### SIS-132 · `frozen` legible como helper
**Qué:** la condición `profile?.freeze_until != null && profile.freeze_until >= today` (línea 179) se repite conceptualmente; extraer `isFrozen(profile, today)`. **Dónde:** `(tabs)/index.tsx:179`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-133 · Reutilizar `today` en lugar de recalcular
**Qué:** `dateKey()` se llama en `load` (línea 58), en render (línea 177) y en cada `finishQuest`; centralizar reduce inconsistencias. **Dónde:** `(tabs)/index.tsx:58,117,177`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-134 · Mostrar la pestaña con badge de pendientes
**Qué:** el icono "Sistema" en la tab bar (_layout.tsx:25) podría llevar `tabBarBadge` con misiones pendientes para verlas sin entrar. **Dónde:** `(tabs)/_layout.tsx:21-27`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-135 · Pull-to-refresh con copy del sistema
**Qué:** el refresh no comunica nada; un texto "Sincronizando con el sistema…" (vía título del RefreshControl en iOS) refuerza el tono. **Dónde:** `(tabs)/index.tsx:188-190`. **Impacto:** 1 · **Esfuerzo:** S

### SIS-136 · Animación de entrada de las ventanas
**Qué:** las `SystemWindow` aparecen sin transición; una entrada escalonada (fade/slide) al cargar refuerza el estilo "HUD que se materializa". **Dónde:** `(tabs)/index.tsx:197-316`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-137 · Efecto de "scanline"/glow sutil en la cabecera
**Qué:** el header (líneas 192-195) es plano; un detalle decorativo coherente con Solo Leveling elevaría la primera impresión. **Dónde:** `(tabs)/index.tsx:192-195`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-138 · Posición del `XpToast` relativa, no fija a `top:110`
**Qué:** `top: 110` (XpToast.tsx:43) es mágico y puede solaparse con notch/contenido en pantallas distintas; anclar a un punto seguro (cerca de la barra de XP). **Dónde:** `XpToast.tsx:42-43`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-139 · `zIndex` del toast vs overlays
**Qué:** `XpToast` `zIndex:10` y `LevelUpOverlay` es `Modal`; verificar que el toast no quede tapado/huérfano cuando coinciden. **Dónde:** `XpToast.tsx:50`, `(tabs)/index.tsx:319-320`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-140 · Texto del toast no escala con bonus largo
**Qué:** "+62 XP · evidencia ×1,25" (XpToast.tsx:34-36) puede ser largo; asegurar que no se corta y centra bien. **Dónde:** `XpToast.tsx:33-37`. **Impacto:** 1 · **Esfuerzo:** S

### SIS-141 · Unificar el formato de número decimal del multiplicador
**Qué:** `streakMultiplier(...).toFixed(1)` (línea 224) usa punto; en español coma — y el toast usa "×1,25". Unificar a coma. **Dónde:** `(tabs)/index.tsx:224`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-142 · Mostrar "×1.0" solo cuando aporta
**Qué:** con racha <7 el multiplicador es ×1,0 y no añade info (línea 224); ocultarlo o sustituir por "sube tu racha" cuando es 1. **Dónde:** `(tabs)/index.tsx:223-224`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-143 · Indicar cuántos días faltan para la próxima piedra
**Qué:** junto al contador de piedras (líneas 226-229), "faltan N días para otra" motiva la racha. **Dónde:** `(tabs)/index.tsx:226-229`, `game.ts:88`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-144 · Distinguir piedras a tope (máx 3)
**Qué:** si `protection_stones === MAX_STONES`, indicarlo ("máximo") para que el usuario sepa que un día perfecto no dará más. **Dónde:** `(tabs)/index.tsx:226-229`, `game.ts:87`. **Impacto:** 1 · **Esfuerzo:** S

### SIS-145 · Color del nivel según rango
**Qué:** el `lvValue` siempre es cyan (línea 391); teñirlo según rango (E→S) crea sensación de progresión visual. **Dónde:** `(tabs)/index.tsx:387-391`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-146 · Estado deshabilitado visible en módulos no disponibles
**Qué:** si en el futuro un módulo requiere setup (p. ej. Oráculo sin API key), reflejarlo como atenuado en la rejilla. **Dónde:** `(tabs)/index.tsx:308-315`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-147 · Orden de módulos configurable / por uso
**Qué:** permitir reordenar la rejilla o auto-ordenar por frecuencia de uso. **Dónde:** `(tabs)/index.tsx:25-32`. **Impacto:** 1 · **Esfuerzo:** L

### SIS-148 · `Pressable` de módulo con feedback `pressed`
**Qué:** los módulos no tienen estilo `pressed` (líneas 310-313), a diferencia de `QuestItem`; añadir opacidad/realce al pulsar. **Dónde:** `(tabs)/index.tsx:310`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-149 · Sombra/relieve coherente en módulos vs ventanas
**Qué:** los módulos usan borde recto mientras las ventanas tienen esquinas cortadas; valorar mini-`SystemWindow` para coherencia del sello visual. **Dónde:** `(tabs)/index.tsx:481-489`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-150 · Quitar `import useEffect` no usado si se mueve notif
**Qué:** menor higiene: revisar imports tras refactors (p. ej. si `ensureDailyNotifications` se mueve a un layout superior, `useEffect` podría sobrar). **Dónde:** `(tabs)/index.tsx:5,84-86`. **Impacto:** 1 · **Esfuerzo:** S

### SIS-151 · Tipar el estado `toast` con un alias
**Qué:** `useState<{ xp: number; bonus: boolean } | null>` (línea 45) inline; extraer `type ToastState` mejora legibilidad y reuso. **Dónde:** `(tabs)/index.tsx:45`. **Impacto:** 1 · **Esfuerzo:** S

### SIS-152 · Evitar recomputar `lvl` cuando no cambia el perfil
**Qué:** `levelFromXp(profile.xp_total)` (línea 178) corre en cada render; memoizar por `profile?.xp_total`. **Dónde:** `(tabs)/index.tsx:178`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-153 · Mostrar fecha como "Hoy · {fecha}"
**Qué:** reforzar que las misiones son de hoy anteponiendo "Hoy" al `formatLongDate` (línea 194). **Dónde:** `(tabs)/index.tsx:194`. **Impacto:** 1 · **Esfuerzo:** S

### SIS-154 · Accesibilidad del contador de progreso
**Qué:** el `counter` "2/5" (líneas 275-277) debería tener `accessibilityLabel` "2 de 5 misiones completadas". **Dónde:** `(tabs)/index.tsx:275-277`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-155 · Throttle del `onRefresh`
**Qué:** evitar que toques repetidos de pull-to-refresh disparen múltiples `load()`; ya hay `refreshing`, pero asegurar que no reentra. **Dónde:** `(tabs)/index.tsx:171-175`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-156 · Mostrar "última sincronización"
**Qué:** un sello discreto "actualizado hace X" ayuda a saber si los datos son frescos tras estar en background. **Dónde:** `(tabs)/index.tsx:192-195`. **Impacto:** 1 · **Esfuerzo:** M

### SIS-157 · Manejar `userId` ausente con estado dedicado
**Qué:** si `!userId`, `load` retorna pronto (línea 48) y la pantalla queda vacía sin explicación; mostrar "Inicia sesión" o spinner de auth. **Dónde:** `(tabs)/index.tsx:48,184`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-158 · Evitar mostrar datos del usuario anterior tras cambio de sesión
**Qué:** el estado (`profile`, `todayQuests`) no se limpia si cambia `userId`; resetear en cambio de sesión evita flashes de datos ajenos. **Dónde:** `(tabs)/index.tsx:35-45,47`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-159 · `SafeAreaView` solo cubre `top`
**Qué:** `edges={['top']}` (línea 185); en dispositivos con gesto inferior, el `paddingBottom:32` del content (línea 332) puede no bastar — verificar con la tab bar. **Dónde:** `(tabs)/index.tsx:185,330-333`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-160 · Soporte de orientación horizontal / tablets
**Qué:** la rejilla y la tarjeta asumen ancho de móvil; en landscape los `width:'30.5%'` y fuentes grandes pueden verse pobres. **Dónde:** `(tabs)/index.tsx:475-495`. **Impacto:** 1 · **Esfuerzo:** L

### SIS-161 · Indicar progreso de subida con porcentaje real
**Qué:** si SIS-022 añade indicador, conectar el progreso real de `uploadEvidence` (si el SDK lo expone) en vez de spinner indeterminado. **Dónde:** `data.ts:93-105`, `(tabs)/index.tsx:107`. **Impacto:** 2 · **Esfuerzo:** L

### SIS-162 · Reintentar subida de evidencia fallida sin perder el completado
**Qué:** si `uploadEvidence` falla, hoy todo el `completeQuest` se aborta (engine.ts:124); ofrecer "completar sin evidencia" o reintentar la foto. **Dónde:** `(tabs)/index.tsx:139-141`, `engine.ts:122-127`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-163 · Mensaje específico si falla solo la red en completar
**Qué:** distinguir error de subida vs de insert de completion para dar feedback accionable. **Dónde:** `(tabs)/index.tsx:139-141`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-164 · Evitar `Haptics.notificationAsync` sin await ni catch
**Qué:** `Haptics.notificationAsync(...)` (línea 108) devuelve promesa ignorada; envolver para no generar rechazos no capturados en dispositivos sin háptico. **Dónde:** `(tabs)/index.tsx:108`. **Impacto:** 1 · **Esfuerzo:** S

### SIS-165 · Comprobar disponibilidad de háptico
**Qué:** en algunos Android el háptico no existe; degradar con elegancia (no-op) ya lo hace expo, pero conviene confirmarlo. **Dónde:** `(tabs)/index.tsx:108`. **Impacto:** 1 · **Esfuerzo:** S

### SIS-166 · Indicador de "procesando cierre" en la primera carga del día
**Qué:** `processPendingDays` (línea 53) puede tardar (varias escrituras); mostrar "El sistema cierra los días pendientes…" mejora la espera. **Dónde:** `(tabs)/index.tsx:53`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-167 · Evitar parpadeo del perfil durante `load`
**Qué:** `setProfile(prof)` ocurre al final de `load` (línea 63); durante la carga el perfil previo sigue, pero en el primer foco es null → salto. Coordinar con skeleton (SIS-012). **Dónde:** `(tabs)/index.tsx:63`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-168 · Coalescer `setState` múltiples de `load`
**Qué:** `load` hace 4 `setState` seguidos (líneas 63-66); en React 18 ya se baten, pero conviene agrupar el estado en un objeto para claridad y menos renders. **Dónde:** `(tabs)/index.tsx:63-66`. **Impacto:** 1 · **Esfuerzo:** M

### SIS-169 · Reducer en lugar de múltiples `useState`
**Qué:** la pantalla tiene 8 `useState` (líneas 38-45); un `useReducer` con un estado de pantalla clarifica transiciones (carga→datos→error). **Dónde:** `(tabs)/index.tsx:38-45`. **Impacto:** 2 · **Esfuerzo:** L

### SIS-170 · Extraer un hook `useSystemHome`
**Qué:** mover `load`, estados y handlers a un hook `useSystemHome(userId)` deja el componente declarativo y testeable. **Dónde:** `(tabs)/index.tsx:34-175`. **Impacto:** 3 · **Esfuerzo:** L

### SIS-171 · Cachear el perfil para arranque instantáneo
**Qué:** persistir el último `profile`/`quests` en AsyncStorage y mostrarlo al instante mientras `load` revalida (stale-while-revalidate). **Dónde:** `(tabs)/index.tsx:47-76`. **Impacto:** 4 · **Esfuerzo:** L

### SIS-172 · Suscripción realtime a `profiles` (opcional)
**Qué:** si otra pantalla cambia XP/racha, la home no se entera hasta refoco; una suscripción mantendría la tarjeta sincronizada. **Dónde:** `(tabs)/index.tsx:47-82`. **Impacto:** 2 · **Esfuerzo:** L

### SIS-173 · Evitar recomputar `voice.frozen` con razón cambiante
**Qué:** `voice.frozen(profile.freeze_reason ?? 'pausa')` (línea 242) re-elige frase por render; fijarla al entrar en pausa. **Dónde:** `(tabs)/index.tsx:242`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-174 · Mostrar la fecha de fin de pausa formateada
**Qué:** "Hasta el {profile.freeze_until}" (línea 242) muestra el ISO crudo (2026-06-20); formatear a fecha legible en español. **Dónde:** `(tabs)/index.tsx:242`. **Impacto:** 3 · **Esfuerzo:** S

### SIS-175 · Acción rápida para terminar la pausa
**Qué:** el banner de pausa (líneas 236-245) es informativo; un botón "Reanudar el sistema" (llamando `setFreeze(profile,null,null)`) ahorra ir a Perfil. **Dónde:** `(tabs)/index.tsx:236-245`, `engine.ts:190-198`. **Impacto:** 3 · **Esfuerzo:** M

### SIS-176 · Formatear `freeze_until` y `penalty_date` con `formatLongDate`
**Qué:** reutilizar el formateador de fechas para todas las fechas mostradas, evitando ISO crudo en la UI. **Dónde:** `(tabs)/index.tsx:242`, `dates.ts:28-31`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-177 · Confirmar antes de descartar el panel de cierre con penalización
**Qué:** si SIS-002 añade cierre manual, asegurarse de que el usuario vio la penalización (no auto-cerrar demasiado rápido un aviso importante). **Dónde:** `(tabs)/index.tsx:247-270`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-178 · Diferenciar "INFORME DEL CIERRE" positivo del negativo con icono
**Qué:** el título cambia de texto y color (líneas 252-254) pero un icono (✓ vs ⚠) ayuda al escaneo. **Dónde:** `(tabs)/index.tsx:252-254`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-179 · Mantener accesible el contraste del panel rojo
**Qué:** `alertBody #E8C9CD` sobre `redPanel #170D14` (líneas 436, 250) — verificar AA para texto pequeño. **Dónde:** `(tabs)/index.tsx:436`, `theme.ts:16`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-180 · Evitar el salto cuando aparece/desaparece un aviso
**Qué:** al limpiarse `dayResult`/`frozen`, las misiones suben de golpe; una transición de altura suaviza el reflow. **Dónde:** `(tabs)/index.tsx:236-270`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-181 · Soporte de tema/contraste alto futuro
**Qué:** todos los colores vienen de `theme.ts`; preparar la home para un eventual modo alto contraste no rompería el resto. **Dónde:** `theme.ts`, `(tabs)/index.tsx`. **Impacto:** 1 · **Esfuerzo:** L

### SIS-182 · Internacionalizar copy hardcodeado de la pantalla
**Qué:** strings como "MISIONES DE HOY", "MÓDULOS", el Alert de evidencia (líneas 157, 274, 307) están inline; centralizarlos facilita ajustes de copy y consistencia. **Dónde:** `(tabs)/index.tsx:157,274,307,280`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-183 · Evitar doble bienvenida tras seed + error
**Qué:** si `seeded` es true pero `load` falla luego, la bienvenida podría no mostrarse o mostrarse a destiempo; ordenar el flujo para que la bienvenida sea fiable. **Dónde:** `(tabs)/index.tsx:67-72`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-184 · `RefreshControl` con `progressViewOffset`
**Qué:** bajo `SafeAreaView` el spinner de refresh puede quedar pegado al borde; un `progressViewOffset` lo separa. **Dónde:** `(tabs)/index.tsx:188-190`. **Impacto:** 1 · **Esfuerzo:** S

### SIS-185 · Evitar `as const` perdiendo el tipo de icono
**Qué:** `MODULES ... as const` (línea 32) hace `icon` un literal; asegurar que tipa como `keyof typeof Ionicons.glyphMap` para evitar iconos inválidos. **Dónde:** `(tabs)/index.tsx:25-32,311`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-186 · Mostrar feedback cuando no hay nada que refrescar
**Qué:** pull-to-refresh siempre re-pega a Supabase; si offline, comunicar "sin conexión, mostrando datos guardados". **Dónde:** `(tabs)/index.tsx:171-175`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-187 · Limitar la frecuencia de `ensureProfile`/`seedDefaultQuests`
**Qué:** cada foco re-ejecuta `ensureProfile` y `seedDefaultQuests` (líneas 50-51); tras la primera vez, cachear que ya existen evita 2 consultas por foco. **Dónde:** `(tabs)/index.tsx:50-51`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-188 · Mostrar el progreso de la racha hacia ×1,5
**Qué:** el multiplicador tope es ×1,5 a 35 días (game.ts:67-69); una mini-barra "racha → bonus máximo" da una meta de largo plazo. **Dónde:** `(tabs)/index.tsx:223-224`, `game.ts:67-69`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-189 · Diferenciar misión recién completada (resaltado temporal)
**Qué:** tras completar, resaltar la fila unos segundos (glow cyan) antes de atenuarla refuerza la acción. **Dónde:** `QuestItem.tsx:25-31`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-190 · Evitar mostrar `+previewXp` cuando la misión está en `busy`
**Qué:** durante `busy` la fila sigue mostrando `+previewXp` (QuestItem.tsx:49-51); podría mostrar "…" o el spinner también en el XP. **Dónde:** `QuestItem.tsx:49-51`. **Impacto:** 1 · **Esfuerzo:** S

### SIS-191 · Coherencia de `previewXp` con la racha tras subir
**Qué:** `previewXp` usa `streakDays` (QuestItem.tsx:17) pasado desde `profile?.streak_days`; tras completar la primera del día la racha aún no cambia (cambia al cierre), así que el preview es correcto — documentarlo para no "corregirlo" por error. **Dónde:** `QuestItem.tsx:17`, `(tabs)/index.tsx:291`. **Impacto:** 1 · **Esfuerzo:** S

### SIS-192 · Mostrar total de XP ganado hoy
**Qué:** sumar los `xp_awarded` de las completions de hoy (líneas 60-61) y mostrar "XP de hoy: N" motiva el día. **Dónde:** `(tabs)/index.tsx:59-61,273-278`. **Impacto:** 3 · **Esfuerzo:** S

### SIS-193 · Anunciar subida de nivel a accesibilidad
**Qué:** además del overlay, `announceForAccessibility('Has subido al nivel N')`. **Dónde:** `(tabs)/index.tsx:123`, `LevelUpOverlay.tsx`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-194 · Cerrar el overlay automáticamente tras unos segundos (opción)
**Qué:** `LevelUpOverlay` solo cierra por toque; una auto-disolución opcional evita bloquear si el usuario deja la app. **Dónde:** `LevelUpOverlay.tsx:42-73`. **Impacto:** 1 · **Esfuerzo:** S

### SIS-195 · Indicar la stat afectada al ganar XP en el toast
**Qué:** el toast solo dice "+XP"; añadir la stat ("+50 XP · INT") conecta la acción con la progresión de stats. **Dónde:** `(tabs)/index.tsx:110`, `XpToast.tsx:33-37`. **Impacto:** 2 · **Esfuerzo:** S

### SIS-196 · Sincronizar `XPBar` ratio con animación tras subir de nivel
**Qué:** al subir nivel, `into` baja de golpe (resta el coste); animar el "vaciado y rellenado" de la barra cuenta mejor la historia. **Dónde:** `(tabs)/index.tsx:217`, `XPBar.tsx`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-197 · Evitar render del bloque perfil con datos parciales
**Qué:** el bloque se muestra solo si `profile && lvl` (línea 197); si `lvl` fuese null por XP corrupto, no se ve nada — un fallback mínimo evita pantalla muda. **Dónde:** `(tabs)/index.tsx:197`. **Impacto:** 1 · **Esfuerzo:** S

### SIS-198 · Documentar el contrato del flujo de completado
**Qué:** añadir un comentario claro del orden (cámara→subida→insert→XP→logros) en `finishQuest`/`onComplete` para futuros cambios seguros. **Dónde:** `(tabs)/index.tsx:88-169`. **Impacto:** 1 · **Esfuerzo:** S

### SIS-199 · Botón flotante "completar siguiente pendiente"
**Qué:** un atajo para completar rápidamente la siguiente misión sin evidencia reduce fricción para usuarios veloces. **Dónde:** `(tabs)/index.tsx:272-304`. **Impacto:** 2 · **Esfuerzo:** M

### SIS-200 · Resumen semanal en la home los domingos
**Qué:** mostrar un mini-resumen (días perfectos, XP de la semana) los domingos enlazando a Informe. **Dónde:** `(tabs)/index.tsx` (nueva sección). **Impacto:** 2 · **Esfuerzo:** L

Total: 200 mejoras, 5 bugs.
