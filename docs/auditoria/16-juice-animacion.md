# Animación, juice y feedback

> Área JCE · auditoría de código NIVL · anclada al código real

Alcance leído: `src/components/LevelUpOverlay.tsx`, `src/components/XpToast.tsx`, y vecinos para contexto de consumo: `src/components/Hexagon.tsx`, `src/lib/theme.ts`, `src/lib/voice.ts`, `src/app/(tabs)/index.tsx` (estado `toast`/`levelUp`, `finishQuest`), `src/app/dungeon/[id].tsx` (`claimLoot`), `src/app/gym.tsx`. Stack confirmado en `package.json`: `react-native-reanimated@4.2.1` disponible, `react-native-svg@15.15.3`, `expo-haptics@~55.0.14`; **no hay** `expo-av`/`expo-audio` (cero sonido en el proyecto).

## Bugs y riesgos

### CRIT-JCE-01 · Los anillos del LevelUpOverlay corren en bucle infinito aunque no haya subida de nivel — `LevelUpOverlay.tsx:13-40,58-63` · severidad alta
**Problema:** `Ring` arranca un `Animated.loop` en su `useEffect` (líneas 17-33) y los dos `<Ring>` se montan como hijos del `<Modal>` (líneas 61-62). En React Native el `Modal` **monta sus hijos siempre**, independientemente de `visible`; `visible={level !== null}` solo controla la presentación, no el montaje. El overlay está montado de forma permanente en Sistema (`index.tsx:331`), gym (`gym.tsx:374`) y mazmorra (`dungeon/[id].tsx:281`). Resultado: dos bucles de animación (`scale` 0.7→2.1 + `opacity`, 1600 ms, sin fin) giran continuamente en esas tres pantallas aunque el usuario nunca haya subido de nivel. Drenaje de CPU/batería constante y trabajo del hilo de UI desperdiciado.
**Arreglo:** montar los anillos solo cuando hay nivel. Envolver el contenido para que los `Ring` se rendericen condicionalmente: `{level !== null && (<View style={styles.ringLayer}>…</View>)}`, o pasar `active={level !== null}` a `Ring` y en su efecto `if (!active) return;` antes de `anim.start()`. Así el `Animated.loop` solo existe mientras el overlay es visible (el `return () => anim.stop()` ya está bien para limpiar al desmontar).

### CRIT-JCE-02 · XpToast reinicia su animación en cada re-render del padre por la dep `onDone` — `XpToast.tsx:16-27` y `index.tsx:330` · severidad alta
**Problema:** el `useEffect` (línea 16) lista `onDone` en sus dependencias (línea 27) y el padre lo pasa como flecha inline `onDone={() => setToast(null)}` (`index.tsx:330`), una función nueva en cada render. Cualquier re-render de la pantalla Sistema mientras el toast está visible (hay temporizadores, `useFocusEffect`, cambios de estado de misiones) cambia la identidad de `onDone`, reejecuta el efecto, resetea `translateY`/`opacity` a 0 (líneas 18-19) y relanza la secuencia. El "+XP" salta de golpe a la posición inicial a mitad de subida — animación entrecortada y poco fiable. Es el caso que el foco pedía revisar.
**Arreglo:** dos partes. (1) En el componente, sacar `onDone` de las deps y leerlo por ref: `const onDoneRef = useRef(onDone); useEffect(() => { onDoneRef.current = onDone; });` y en el callback de `.start(() => onDoneRef.current())`; dejar el efecto con deps `[xp]` (translateY/opacity son refs estables). (2) En el padre, memoizar igualmente: `const clearToast = useCallback(() => setToast(null), []);`.

### CRIT-JCE-03 · Toasts encadenados: la animación previa no se cancela y su callback apaga el toast nuevo — `XpToast.tsx:16-27` · severidad alta
**Problema:** el efecto no devuelve función de limpieza ni guarda la animación para detenerla. Si se completan dos misiones seguidas (frecuente: la pantalla Sistema permite tocar varias tarjetas), `setToast({xp})` (`index.tsx:114`) cambia `xp`, el efecto se reejecuta y crea una segunda `Animated.sequence`, pero **la primera sigue viva**: su `.start(() => onDone())` (línea 26) aún se disparará y llamará `setToast(null)`, ocultando el segundo toast a mitad de animación. Además quedan animaciones solapando sobre los mismos `Animated.Value`, con saltos visuales. Fuga + race real.
**Arreglo:** capturar la animación y limpiar: `const anim = Animated.sequence([...]); anim.start(({finished}) => { if (finished) onDoneRef.current(); }); return () => anim.stop();`. El guard `if (finished)` evita que la cancelación dispare `onDone`, y el `return () => anim.stop()` mata la animación anterior antes de arrancar la nueva.

### CRIT-JCE-04 · Ninguna animación respeta "Reducir movimiento" (accesibilidad y vestibular) — `LevelUpOverlay.tsx:13-55`, `XpToast.tsx:16-27` · severidad media
**Problema:** no existe ninguna lectura de `AccessibilityInfo.isReduceMotionEnabled()` ni `useReducedMotion` en todo `src/components` (grep sin coincidencias). El overlay lanza spring + dos bucles de anillos en expansión y el toast desliza/desvanece sin tener en cuenta la preferencia del sistema operativo. Para usuarios con sensibilidad vestibular es un problema de accesibilidad; además el bucle infinito (ver CRIT-JCE-01) ignora la señal de ahorro. Riesgo de corrección de UX/accesibilidad, no de crasheo.
**Arreglo:** crear un hook `useReducedMotion()` que suscriba a `AccessibilityInfo` y, cuando esté activo, sustituir las animaciones por aparición instantánea (`opacity.setValue(1)`, sin `loop`, sin spring) en ambos componentes.

## Mejoras

### JCE-001 · Háptico propio en el level-up dentro del overlay
**Qué:** disparar `Haptics.notificationAsync(Warning)` o `impactAsync(Heavy)` al hacerse visible el overlay, en lugar de depender del `Success` genérico que dispara la pantalla. Un hito de nivel merece un golpe más contundente que completar una misión. **Dónde:** `LevelUpOverlay.tsx:46-55` (en el efecto, cuando `level !== null`) · **Impacto:** 4 · **Esfuerzo:** S

### JCE-002 · Patrón háptico secuenciado para subir de nivel
**Qué:** componer un patrón (p. ej. dos impactos `Heavy` separados ~120 ms) para que el level-up se "sienta" distinto a cualquier otro evento. **Dónde:** `LevelUpOverlay.tsx:46-55` · **Impacto:** 3 · **Esfuerzo:** S

### JCE-003 · Centralizar haptics en `src/lib/haptics.ts`
**Qué:** la llamada `Haptics.notificationAsync(Success)` está copiada en cuatro pantallas (`index.tsx:112`, `gym.tsx:140`, `dungeon/[id].tsx:95`, `:119`, `diario.tsx:124`). Extraer un módulo `haptics.success()/.levelUp()/.pr()/.error()` con manejo de errores y respeto a una preferencia. **Dónde:** nuevo `src/lib/haptics.ts`, consumido por los overlays y pantallas · **Impacto:** 4 · **Esfuerzo:** M

### JCE-004 · `try/catch` alrededor de los haptics
**Qué:** `Haptics.notificationAsync` puede rechazar en dispositivos sin motor o si el permiso/hardware falla; hoy no hay captura y una promesa rechazada queda colgando. El módulo central (JCE-003) debe envolver cada llamada en `.catch(() => {})`. **Dónde:** futuro `haptics.ts` (origen: `index.tsx:112` etc.) · **Impacto:** 3 · **Esfuerzo:** S

### JCE-005 · Capa de sonido (SFX) inexistente
**Qué:** el proyecto no tiene `expo-av`/`expo-audio`; no suena nada. Añadir un `src/lib/sound.ts` con efectos cortos para level-up, completar misión, PR, mazmorra despejada y penalización, con preconga y un único pool reutilizable. **Dónde:** nuevo `src/lib/sound.ts`; disparado desde `LevelUpOverlay.tsx:46`, `XpToast.tsx:16` · **Impacto:** 5 · **Esfuerzo:** L

### JCE-006 · Sonido al subir de nivel
**Qué:** reproducir un SFX de "ascensión" sincronizado con el spring del panel. **Dónde:** `LevelUpOverlay.tsx:50-53` · **Impacto:** 4 · **Esfuerzo:** M

### JCE-007 · Sonido sutil en el XpToast
**Qué:** un "tick"/"chime" muy corto al aparecer el "+XP". **Dónde:** `XpToast.tsx:20-26` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-008 · Preferencia de usuario para sonido y haptics
**Qué:** toggles en Perfil para silenciar SFX/haptics, leídos por los módulos centrales. **Dónde:** consumido por `haptics.ts`/`sound.ts`; UI en `perfil` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-009 · Partículas/chispas en el level-up
**Qué:** además de los dos anillos hexagonales, emitir partículas que asciendan desde el número de nivel para más "juice" de celebración. **Dónde:** `LevelUpOverlay.tsx:60-63` (capa de anillos) · **Impacto:** 4 · **Esfuerzo:** L

### JCE-010 · Glow/pulso en el número de nivel
**Qué:** animar `textShadow`/escala leve del `<Text style={styles.level}>` para que el número "lata" una vez al entrar. **Dónde:** `LevelUpOverlay.tsx:66,105-110` · **Impacto:** 3 · **Esfuerzo:** S

### JCE-011 · Entrada escalonada de los textos del overlay
**Qué:** hacer aparecer notice → nivel → rango → flavor con un pequeño stagger en vez de todo a la vez con el panel. **Dónde:** `LevelUpOverlay.tsx:64-70` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-012 · Animación de salida del overlay
**Qué:** al tocar para cerrar, hoy se llama `onClose` y el `Modal` hace `animationType="fade"` global, pero el panel no encoge. Animar `scale`→0.9 + `opacity`→0 antes de `onClose`. **Dónde:** `LevelUpOverlay.tsx:58-59,64` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-013 · Migrar overlay a Reanimated 4
**Qué:** `react-native-reanimated@4.2.1` está instalado pero el componente usa la API legacy `Animated`. Reanimated corre en el hilo de UI y da mejor rendimiento para bucles. **Dónde:** `LevelUpOverlay.tsx:1-2,13-55` · **Impacto:** 3 · **Esfuerzo:** L

### JCE-014 · Migrar XpToast a Reanimated 4
**Qué:** mismo motivo; `withTiming`/`withSequence` simplifican la limpieza y evitan el race de CRIT-JCE-03. **Dónde:** `XpToast.tsx:1-2,13-27` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-015 · Cola de toasts en vez de uno solo
**Qué:** el estado `toast` es un único objeto (`index.tsx:45`); completar misiones rápido pisa toasts. Implementar una cola que muestre "+XP" en secuencia o los apile verticalmente. **Dónde:** `index.tsx:45,114,330`, `XpToast.tsx` · **Impacto:** 4 · **Esfuerzo:** L

### JCE-016 · Toast/celebración de hito de racha
**Qué:** no hay ninguna celebración cuando la racha cruza un múltiplo (7, 14, 30, 100). La economía premia la racha pero el usuario no recibe feedback visual del hito. **Dónde:** nuevo componente `StreakMilestone`; disparo en `index.tsx:113-127` tras actualizar `res.profile.streak_days` · **Impacto:** 5 · **Esfuerzo:** M

### JCE-017 · Celebración de logro con overlay propio (no `Alert`)
**Qué:** hoy un logro se anuncia con `Alert.alert('LOGRO DESBLOQUEADO', …)` (`index.tsx:141`), rompiendo la estética del sistema. Crear un `AchievementOverlay` al estilo del LevelUpOverlay. **Dónde:** `index.tsx:140-142`; nuevo componente · **Impacto:** 5 · **Esfuerzo:** L

### JCE-018 · Celebración de mazmorra despejada con overlay propio
**Qué:** `claimLoot` usa `Alert.alert('MAZMORRA DESPEJADA', …)` (`dungeon/[id].tsx:120-123`). Un cierre de mazmorra es un clímax; merece un overlay con botín animado en vez de un alert nativo. **Dónde:** `dungeon/[id].tsx:120-124`; nuevo componente · **Impacto:** 4 · **Esfuerzo:** L

### JCE-019 · Celebración de PR de gimnasio
**Qué:** `voice.pr()` existe pero hay que comprobar si se muestra con juice; un récord personal merece un toast/overlay específico con haptic fuerte. **Dónde:** `gym.tsx` (flujo de registro de levantamiento) + `voice.ts:61-65` · **Impacto:** 4 · **Esfuerzo:** M

### JCE-020 · Animación numérica del XP ganado (count-up)
**Qué:** en vez de mostrar "+62 XP" estático, animar de 0 a 62 mientras sube el toast. **Dónde:** `XpToast.tsx:33-35` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-021 · Mostrar el multiplicador de racha en el toast
**Qué:** cuando la racha aplica multiplicador, el toast solo indica "evidencia ×1,25" (`XpToast.tsx:34`); añadir "racha ×1,3" cuando proceda para que el usuario vea por qué ganó más. **Dónde:** `XpToast.tsx:5-9,34`; pasar prop extra desde `index.tsx:114` · **Impacto:** 4 · **Esfuerzo:** M

### JCE-022 · Color del toast según tipo de evento
**Qué:** el toast es siempre cian (`styles.wrap`); usar ámbar para penalización-redimida o púrpura para mazmorra haría el feedback más legible. **Dónde:** `XpToast.tsx:40-51`, `theme.ts:11-17` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-023 · Toast de XP negativo (penalización)
**Qué:** el toast solo modela `xp` positivo; cuando el sistema aplica −XP (penalización) no hay "−XP" flotante equivalente. **Dónde:** `XpToast.tsx:33-35`; flujo de penalización en `index.tsx` · **Impacto:** 4 · **Esfuerzo:** M

### JCE-024 · Variante "bonus" del toast más vistosa
**Qué:** cuando hay evidencia (`bonus`), reforzar visualmente (borde más brillante, icono de cámara) en vez de solo texto. **Dónde:** `XpToast.tsx:12,34` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-025 · Reemplazar `useNativeDriver: true` mezclado con propiedades no soportadas — verificación
**Qué:** todas las animaciones actuales usan `transform`/`opacity` (válidas con native driver), bien. Documentar la invariante para futuros cambios (no animar `width`/`backgroundColor` con native driver). **Dónde:** `LevelUpOverlay.tsx:22-28,50-52`, `XpToast.tsx:22-25` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-026 · Skeleton loader del cuadro de estado (Sistema)
**Qué:** mientras `load()` resuelve no hay placeholder animado; un shimmer del SystemWindow daría sensación de fluidez. **Dónde:** `index.tsx` (estado de carga); nuevo `Skeleton` · **Impacto:** 4 · **Esfuerzo:** M

### JCE-027 · Componente `Skeleton`/`Shimmer` reutilizable
**Qué:** crear un componente de carga con barrido animado para listas (misiones, mazmorras, agenda). **Dónde:** nuevo `src/components/Skeleton.tsx` · **Impacto:** 4 · **Esfuerzo:** M

### JCE-028 · Skeleton de la lista de misiones
**Qué:** filas fantasma mientras cargan las misiones del día. **Dónde:** `misiones` (lista) + `Skeleton` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-029 · Skeleton del detalle de mazmorra
**Qué:** placeholder de tareas/boss mientras `load()` resuelve. **Dónde:** `dungeon/[id].tsx` (estado de carga) · **Impacto:** 3 · **Esfuerzo:** M

### JCE-030 · Transiciones de pantalla coherentes (expo-router)
**Qué:** definir `animation`/`presentation` consistentes en el `Stack` para que gym/dieta/compra/diario/informe entren con un estilo "sistema" unificado. **Dónde:** layout del stack en `src/app/_layout.tsx` · **Impacto:** 4 · **Esfuerzo:** M

### JCE-031 · Animación compartida al abrir una mazmorra
**Qué:** transición de elemento compartido entre la tarjeta de mazmorra y la pantalla `dungeon/[id]`. **Dónde:** `mazmorras` → `dungeon/[id].tsx:281` · **Impacto:** 3 · **Esfuerzo:** L

### JCE-032 · Animación de entrada de las tarjetas de misión
**Qué:** stagger de aparición (fade+translate) al cargar la lista para dar vida al primer pintado. **Dónde:** `misiones` lista; o `index.tsx` resumen · **Impacto:** 3 · **Esfuerzo:** M

### JCE-033 · Animación de "completada" en la tarjeta de misión
**Qué:** al completar, animar la tarjeta (tachado/colapso/checkmark dibujado) antes de actualizar estado, en lugar de un cambio instantáneo. **Dónde:** `index.tsx:113-126` (optimista) · **Impacto:** 4 · **Esfuerzo:** M

### JCE-034 · Checkmark dibujado (stroke animado) con SVG
**Qué:** dibujar el tick progresivamente con `react-native-svg` (ya instalado) al completar una misión/tarea. **Dónde:** nuevo componente; consumido en misiones y `dungeon/[id].tsx` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-035 · Barra de XP/progreso con animación al ganar XP
**Qué:** animar el llenado de la barra de nivel cuando entra XP, en lugar de saltar al nuevo valor. **Dónde:** `index.tsx` (cuadro de estado) · **Impacto:** 4 · **Esfuerzo:** M

### JCE-036 · Efecto de "barra llena" al subir de nivel
**Qué:** cuando la barra de XP se desborda y sube de nivel, un destello/flash en la barra antes de abrir el overlay. **Dónde:** `index.tsx` (barra) + `LevelUpOverlay.tsx:46` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-037 · Pulso de los stats que cambian (FUE/VIT/INT/AGI/PER)
**Qué:** resaltar con un breve pulso el stat que acaba de recibir XP (`awardXp(..., dungeon.stat, …)`). **Dónde:** vista de stats en `index.tsx`/`perfil` · **Impacto:** 4 · **Esfuerzo:** M

### JCE-038 · Hexágono de rango animado al cambiar de rango
**Qué:** el rango (`rankForLevel`, `LevelUpOverlay.tsx:67`) cambia en ciertos niveles; animar/celebrar el ascenso de rango aparte del de nivel. **Dónde:** `LevelUpOverlay.tsx:67`, `game.ts` (rankForLevel) · **Impacto:** 4 · **Esfuerzo:** M

### JCE-039 · `accessibilityRole`/label en el panel del overlay
**Qué:** el overlay no expone rol ni etiqueta accesible; un lector de pantalla no anuncia "Has subido al nivel N". Añadir `accessibilityRole="alert"` y `accessibilityLabel`. **Dónde:** `LevelUpOverlay.tsx:64-69` · **Impacto:** 3 · **Esfuerzo:** S

### JCE-040 · `accessibilityLiveRegion` en el XpToast
**Qué:** el toast es `pointerEvents="none"` y no se anuncia; marcar `accessibilityLiveRegion="polite"` para que el lector lea "+62 XP". **Dónde:** `XpToast.tsx:32` · **Impacto:** 3 · **Esfuerzo:** S

### JCE-041 · El Pressable de cierre debe tener rol de botón
**Qué:** `Pressable` que cierra el overlay (`LevelUpOverlay.tsx:59`) no declara `accessibilityRole="button"` ni hint ("Toca para continuar"). **Dónde:** `LevelUpOverlay.tsx:59` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-042 · Anillos decorativos ocultos a accesibilidad
**Qué:** los `<Ring>`/`Hexagon` deben llevar `accessibilityElementsHidden`/`importantForAccessibility="no"` (ya son `pointerEvents="none"`, pero el árbol de accesibilidad puede recogerlos). **Dónde:** `LevelUpOverlay.tsx:36,60` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-043 · Tiempo de auto-cierre opcional del overlay
**Qué:** además de "toca para continuar", permitir auto-cierre tras N s para que la celebración no bloquee si el usuario no toca. **Dónde:** `LevelUpOverlay.tsx:46-55` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-044 · Cerrar overlay con back de Android sin perder animación
**Qué:** `onRequestClose={onClose}` (línea 58) cierra de golpe; encadenar la animación de salida (JCE-012) también en el back. **Dónde:** `LevelUpOverlay.tsx:58` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-045 · Evitar `rankForLevel(level)` cuando `level` es null
**Qué:** ya hay guardas ternarias (`level !== null ? rankForLevel(level) : ''`, línea 67); consolidar calculando `rank`/`flavor` una sola vez en una variable derivada para no repetir el chequeo y evitar recomputar `voice.levelUp()` en cada render. **Dónde:** `LevelUpOverlay.tsx:67-68` · **Impacto:** 3 · **Esfuerzo:** S

### JCE-046 · `voice.levelUp()` se recomputa en cada render del overlay
**Qué:** `voice.levelUp()` (línea 68) y `rankForLevel` se evalúan en cada render mientras el overlay está visible; al recalcularse, el flavor podría cambiar entre renders. Fijar el mensaje al abrir con `useMemo`/estado dependiente de `level`. **Dónde:** `LevelUpOverlay.tsx:68` · **Impacto:** 3 · **Esfuerzo:** S

### JCE-047 · El flavor del overlay puede "parpadear" al cerrar
**Qué:** al pasar `level` a null, `flavor`/`rank` renderizan `''` (líneas 67-68) durante el fade-out del Modal, dejando ver textos vacíos un instante. Conservar el último `level` no nulo durante la salida. **Dónde:** `LevelUpOverlay.tsx:64-69` · **Impacto:** 2 · **Esfuerzo:** M

### JCE-048 · `Ring` recrea su animación si cambia `delay` — memoización
**Qué:** el efecto de `Ring` depende de `delay` (línea 33); aunque hoy es constante, documentar/asegurar que `delay` es estable evita reinicios. **Dónde:** `LevelUpOverlay.tsx:33` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-049 · Constantes de animación extraídas a un módulo `motion.ts`
**Qué:** duraciones (1600, 250, 900, 180, 350), fricciones (5) y escalas (2.1, 0.7, 0.6) están dispersas como números mágicos. Centralizar en `src/lib/motion.ts` para consistencia de "tempo" del sistema. **Dónde:** `LevelUpOverlay.tsx:22-52`, `XpToast.tsx:22-25` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-050 · Curvas de easing explícitas
**Qué:** los `Animated.timing` no pasan `easing`; el default lineal hace la subida del toast y el desvanecido algo planos. Aplicar `Easing.out(Easing.cubic)`. **Dónde:** `XpToast.tsx:22-25`, `LevelUpOverlay.tsx:24-28` · **Impacto:** 3 · **Esfuerzo:** S

### JCE-051 · Spring del panel con `tension` afinada
**Qué:** `Animated.spring(scale, { friction: 5 })` (línea 51) no define `tension`; ajustar para un rebote más "premium" y consistente. **Dónde:** `LevelUpOverlay.tsx:51` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-052 · Posición del toast adaptable a notch/safe-area
**Qué:** `top: 110` fijo (`XpToast.tsx:42`) puede solaparse con la cabecera en dispositivos con notch alto o quedar bajo en otros. Usar `useSafeAreaInsets`. **Dónde:** `XpToast.tsx:42` · **Impacto:** 3 · **Esfuerzo:** S

### JCE-053 · `zIndex` del toast vs. overlays
**Qué:** `zIndex: 10` (línea 50) podría quedar por debajo de otros elementos elevados; verificar que el toast siempre va por encima del contenido pero por debajo del LevelUpOverlay (Modal). **Dónde:** `XpToast.tsx:50` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-054 · Distancia de ascenso del toast proporcional al XP
**Qué:** `translateY: -26` fijo; un PR de 250 XP podría subir más alto que +10 XP para reforzar la magnitud. **Dónde:** `XpToast.tsx:23` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-055 · Sombra/elevación del panel del overlay
**Qué:** el panel solo tiene borde cian; añadir glow (`shadowColor: colors.cyan`) para profundidad coherente con el estilo Solo Leveling. **Dónde:** `LevelUpOverlay.tsx:91-98` · **Impacto:** 3 · **Esfuerzo:** S

### JCE-056 · Glow del borde del toast pulsante
**Qué:** un leve pulso del borde cian del toast lo haría más "vivo" sin distraer. **Dónde:** `XpToast.tsx:46-49` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-057 · Backdrop con blur en el overlay
**Qué:** sustituir el `rgba(2,6,14,0.92)` plano (línea 79) por un blur (`expo-blur`) para foco cinematográfico en el número de nivel. **Dónde:** `LevelUpOverlay.tsx:79` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-058 · Vignette/gradiente radial detrás del número
**Qué:** un gradiente radial sutil tras el nivel resaltaría el clímax. **Dónde:** `LevelUpOverlay.tsx:64-66` · **Impacto:** 2 · **Esfuerzo:** M

### JCE-059 · Más anillos con desfase para sensación de "onda expansiva"
**Qué:** hoy hay dos `<Ring>` (delays 0 y 550); un tercero reforzaría el efecto de pulso de energía. **Dónde:** `LevelUpOverlay.tsx:61-62` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-060 · Color de los anillos según rango
**Qué:** los anillos son cian fijo (`Hexagon … color={colors.cyan}`, línea 37); teñirlos según el rango alcanzado reforzaría el ascenso. **Dónde:** `LevelUpOverlay.tsx:37,67` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-061 · Reutilizar `Animated.Value` con `useRef` ya correcto — test de no-recreación
**Qué:** los valores usan `useRef(new Animated.Value()).current` (bien). Añadir test que verifique que no se recrean entre renders. **Dónde:** `LevelUpOverlay.tsx:14-15,43-44`, `XpToast.tsx:13-14` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-062 · Test: XpToast llama `onDone` exactamente una vez
**Qué:** con fake timers, montar el toast, avanzar el tiempo y comprobar que `onDone` se llama una sola vez (cubre CRIT-JCE-03). **Dónde:** nuevo `XpToast.test.tsx` · **Impacto:** 4 · **Esfuerzo:** M

### JCE-063 · Test: cambiar `xp` reinicia limpio sin doble `onDone`
**Qué:** simular dos misiones seguidas (cambiar prop `xp`) y verificar que el callback antiguo no apaga el toast nuevo. **Dónde:** `XpToast.test.tsx` · **Impacto:** 4 · **Esfuerzo:** M

### JCE-064 · Test: re-render del padre no reinicia la animación del toast
**Qué:** re-renderizar con un nuevo `onDone` inline y comprobar que la animación no se resetea (cubre CRIT-JCE-02 tras el arreglo). **Dónde:** `XpToast.test.tsx` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-065 · Test: el overlay no arranca bucles cuando `level === null`
**Qué:** montar con `level={null}` y verificar que `Animated.loop().start` no se invoca (cubre CRIT-JCE-01). **Dónde:** nuevo `LevelUpOverlay.test.tsx` · **Impacto:** 4 · **Esfuerzo:** M

### JCE-066 · Test: el overlay detiene los bucles al desmontar
**Qué:** comprobar que `anim.stop()` se llama en cleanup para no fugar animaciones. **Dónde:** `LevelUpOverlay.test.tsx` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-067 · Test: respeto a reduce-motion
**Qué:** mockear `AccessibilityInfo.isReduceMotionEnabled → true` y verificar aparición instantánea sin loops (cubre CRIT-JCE-04). **Dónde:** ambos `.test.tsx` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-068 · Test de snapshot del overlay por rango
**Qué:** snapshot del panel para niveles que cruzan rango, asegurando que `rankForLevel` se refleja en la copia. **Dónde:** `LevelUpOverlay.test.tsx` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-069 · Caso límite: nivel 999 (tope terminal) en el overlay
**Qué:** la economía topa nivel en 999; el `<Text style={styles.level}>` con 3 dígitos cabe, pero verificar que no rompe layout ni el copy de rango. **Dónde:** `LevelUpOverlay.tsx:66,105-110` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-070 · Caso límite: `level = 0`
**Qué:** `level ?? 0` (línea 66) muestra 0 si llegara null por error; asegurar que nunca se abre el overlay con 0 real. **Dónde:** `LevelUpOverlay.tsx:66` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-071 · Caso límite: `xp = 0` en el toast
**Qué:** el guard es `xp === null`; un `xp` de 0 (teóricamente) mostraría "+0 XP". Decidir si se filtra antes de `setToast`. **Dónde:** `XpToast.tsx:17,29` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-072 · Caso límite: `xp` negativo formatea "+-X XP"
**Qué:** `+{xp} XP` (línea 34) con xp negativo imprimiría "+-50". Formatear el signo correctamente (relacionado con JCE-023). **Dónde:** `XpToast.tsx:34` · **Impacto:** 3 · **Esfuerzo:** S

### JCE-073 · Separador de miles en XP grande
**Qué:** botines de mazmorra/loot grandes ("+1250 XP") se leen mejor con separador local. **Dónde:** `XpToast.tsx:34` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-074 · `key` único para forzar remount del toast por evento
**Qué:** dar al `XpToast` una `key` derivada del evento ayudaría a reiniciar limpio cada toast en vez de mutar props. **Dónde:** `index.tsx:330` · **Impacto:** 3 · **Esfuerzo:** S

### JCE-075 · Extraer el toast a un proveedor/portal global
**Qué:** hoy el toast vive solo en Sistema (`index.tsx`); un `ToastProvider` permitiría mostrar "+XP" desde gym, dieta, mazmorra con una sola implementación. **Dónde:** nuevo `src/components/ToastProvider.tsx`; origen `index.tsx:330` · **Impacto:** 4 · **Esfuerzo:** L

### JCE-076 · El level-up de gym no muestra toast de XP
**Qué:** `gym.tsx` monta `LevelUpOverlay` (línea 374) pero no hay `XpToast` allí; un PR/registro no muestra el "+XP" flotante. **Dónde:** `gym.tsx:374` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-077 · El level-up de mazmorra no muestra toast de XP
**Qué:** `dungeon/[id].tsx` monta `LevelUpOverlay` (línea 281) pero el XP por tarea/boss/botín no se ve como toast. **Dónde:** `dungeon/[id].tsx:281` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-078 · Feedback al fallar la captura de evidencia
**Qué:** si `captureEvidence` devuelve null por permiso denegado se hace `Alert` (`index.tsx:95`); un micro-feedback háptico de error reforzaría. **Dónde:** `index.tsx:94-96` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-079 · Háptico de error en `catch` de las pantallas
**Qué:** los `catch` muestran `Alert('Error del sistema')` sin háptico (`index.tsx:144`, `dungeon/[id].tsx:99,127`, `gym.tsx`). Añadir `Haptics.notificationAsync(Error)`. **Dónde:** vía `haptics.error()` (JCE-003) · **Impacto:** 3 · **Esfuerzo:** S

### JCE-080 · Animación de "shake" en error de validación
**Qué:** inputs de gym (peso/reps) y formularios podrían "temblar" al fallar la validación en vez de solo deshabilitar el botón. **Dónde:** `gym.tsx` (formulario de ejercicio) · **Impacto:** 2 · **Esfuerzo:** M

### JCE-081 · Feedback de pulsación (press-in) en módulos del grid
**Qué:** los `Pressable` de MÓDULOS (`index.tsx:321`) no tienen estado de pulsado animado (escala/opacidad). **Dónde:** `index.tsx:320-325` · **Impacto:** 3 · **Esfuerzo:** S

### JCE-082 · Ripple/destello al tocar tarjetas
**Qué:** unificar un feedback de toque (Android ripple + opacidad iOS) en tarjetas interactivas para coherencia táctil. **Dónde:** componentes de tarjeta consumidos por listas · **Impacto:** 3 · **Esfuerzo:** M

### JCE-083 · Pulse del botón "completar" mientras está ocupado
**Qué:** `busyQuestId`/`setBusyQuestId` (`index.tsx:153,156`) controla ocupación pero no hay indicador animado en la tarjeta; un spinner/pulse evita doble toque percibido. **Dónde:** `index.tsx:153` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-084 · Spinner del sistema (loader temático) reutilizable
**Qué:** un loader hexagonal giratorio acorde a la estética sustituiría `ActivityIndicator` genérico durante cargas/acciones. **Dónde:** nuevo `src/components/SystemSpinner.tsx`; usado en `busy` de pantallas · **Impacto:** 3 · **Esfuerzo:** M

### JCE-085 · Transición del backdrop del overlay (fade-in propio)
**Qué:** el `Modal animationType="fade"` (línea 58) anima toda la pantalla; controlar el `opacity` del `backdrop` por separado permite sincronizarlo con el spring del panel. **Dónde:** `LevelUpOverlay.tsx:58,77-82` · **Impacto:** 2 · **Esfuerzo:** M

### JCE-086 · Limpiar `Animated.Value` con `stopAnimation` en cleanup del overlay principal
**Qué:** el efecto principal del overlay (líneas 46-55) no detiene el spring/timing si `level` cambia rápido; añadir cleanup que pare ambas animaciones. **Dónde:** `LevelUpOverlay.tsx:46-55` · **Impacto:** 3 · **Esfuerzo:** S

### JCE-087 · Evitar `setValue` + animación condicionada a mismo frame
**Qué:** en el overlay se hace `scale.setValue(0.6)` y luego `spring` en el mismo efecto (líneas 48-53); asegurar que el reset ocurre antes del primer frame para no ver un salto. **Dónde:** `LevelUpOverlay.tsx:48-53` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-088 · Reanimated `entering`/`exiting` para el panel
**Qué:** con Reanimated 4, usar `entering={ZoomIn}`/`exiting={ZoomOut}` simplifica el ciclo de vida del overlay y elimina el manejo manual de `scale`/`opacity`. **Dónde:** `LevelUpOverlay.tsx:64` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-089 · Reanimated `Layout` para reflujo de listas
**Qué:** al completar y colapsar una misión, una transición de layout suaviza el reacomodo de la lista. **Dónde:** listas de misiones/mazmorra · **Impacto:** 3 · **Esfuerzo:** M

### JCE-090 · Indicador de progreso de cierre del día animado
**Qué:** el "aviso de cierre" del sistema podría animar su aparición/desaparición (entrada deslizante) para no aparecer/desaparecer de golpe. **Dónde:** `index.tsx` (aviso de cierre) · **Impacto:** 3 · **Esfuerzo:** M

### JCE-091 · Confeti/destello al completar TODAS las misiones del día
**Qué:** `voice.allDone()` existe; rematar el "día impecable" con una celebración visual al marcar la última misión. **Dónde:** `index.tsx:113-127` (detectar lista completa) + `voice.ts:9-15` · **Impacto:** 5 · **Esfuerzo:** M

### JCE-092 · Háptico distinto para "día completo"
**Qué:** patrón háptico especial cuando se completa la última misión del día. **Dónde:** `index.tsx` (detección de all-done) · **Impacto:** 3 · **Esfuerzo:** S

### JCE-093 · Animación de la Piedra de Protección consumida
**Qué:** `voice.stoneUsed()` existe pero el evento ("una piedra se hace añicos") no tiene visual; una animación de cristal rompiéndose sería memorable. **Dónde:** flujo de cierre + `voice.ts:29-33` · **Impacto:** 4 · **Esfuerzo:** L

### JCE-094 · Animación de Piedra de Protección ganada
**Qué:** `voice.stoneEarned()` ("semana impecable") merece una celebración de forja. **Dónde:** `voice.ts:34-38` + flujo semanal · **Impacto:** 3 · **Esfuerzo:** M

### JCE-095 · Feedback visual de "sistema en pausa/congelado"
**Qué:** `voice.frozen()` indica pausa; un estado visual atenuado/escarcha del cuadro de estado comunicaría la pausa mejor que solo texto. **Dónde:** `index.tsx` (estado congelado) + `voice.ts:39-43` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-096 · Transición de entrada/salida del estado de penalización
**Qué:** cuando aparece la misión de penalización, animar su entrada en rojo para subrayar la gravedad. **Dónde:** `index.tsx` (misión penalización; `quest.is_penalty` en :159) · **Impacto:** 4 · **Esfuerzo:** M

### JCE-097 · Toast de penalización aplicada
**Qué:** `voice.penaltyApplied(xp)` existe; mostrarlo como toast rojo en lugar de (o además de) cualquier alerta. **Dónde:** `voice.ts:23-28` + flujo de cierre · **Impacto:** 4 · **Esfuerzo:** M

### JCE-098 · Animación del contador de racha al incrementar
**Qué:** cuando `streak_days` sube, animar el número (flip/escala) para dar peso al avance diario. **Dónde:** `index.tsx` (display de racha; `res.profile.streak_days` :136) · **Impacto:** 4 · **Esfuerzo:** M

### JCE-099 · Aviso visual de racha en riesgo
**Qué:** por la tarde, cuando quedan misiones, un pulso de alerta en el contador de racha reforzaría `voice.eveningNotif()`. **Dónde:** `index.tsx` (racha) + `voice.ts:50-55` · **Impacto:** 4 · **Esfuerzo:** M

### JCE-100 · Animación de "nuevo día" al cambiar `dateKey`
**Qué:** al detectar cambio de día (la app recalcula fecha en focus), una breve transición de "el sistema asigna misiones" daría ritual. **Dónde:** `index.tsx` (focus/`load`) · **Impacto:** 3 · **Esfuerzo:** M

### JCE-101 · Pull-to-refresh con animación temática
**Qué:** si las listas usan refresh, dar un indicador hexagonal en vez del spinner por defecto. **Dónde:** listas (misiones/mazmorras/agenda) · **Impacto:** 2 · **Esfuerzo:** M

### JCE-102 · Animación de aparición del Oráculo (respuesta IA)
**Qué:** la respuesta del Oráculo podría aparecer con efecto "máquina de escribir" para reforzar la voz del sistema. **Dónde:** pantalla `oraculo` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-103 · Indicador "el Oráculo está pensando"
**Qué:** mientras la IA responde, un loader animado temático (puntos/pulso) mejora la espera. **Dónde:** `oraculo` (estado de carga) · **Impacto:** 3 · **Esfuerzo:** S

### JCE-104 · Transición de la pantalla de diario al guardar
**Qué:** tras guardar entrada de diario (`diario.tsx:124` ya hace háptico), una confirmación animada cerraría el bucle. **Dónde:** `diario.tsx:124` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-105 · Animación del informe al generarse
**Qué:** la pantalla `informe` podría revelar sus secciones con stagger al cargar datos. **Dónde:** `informe` · **Impacto:** 2 · **Esfuerzo:** M

### JCE-106 · Micro-animación de las pestañas (tab bar)
**Qué:** animar el icono de la pestaña activa (escala/tinte) al cambiar de pestaña para feedback de navegación. **Dónde:** layout de `(tabs)` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-107 · Badge animado de misiones pendientes en la pestaña
**Qué:** si hay misiones pendientes, un badge con leve pulso en la pestaña de misiones recordaría sin ser intrusivo. **Dónde:** layout de `(tabs)` (pestaña misiones) · **Impacto:** 3 · **Esfuerzo:** M

### JCE-108 · Animar el cambio de stat afectado en el overlay de nivel
**Qué:** mostrar qué stat creció con el nivel/acción y animarlo dentro del overlay. **Dónde:** `LevelUpOverlay.tsx:64-70` · **Impacto:** 2 · **Esfuerzo:** M

### JCE-109 · Sincronizar haptic con el frame de impacto de la animación
**Qué:** disparar el háptico exactamente cuando el spring del panel "asienta" (no al inicio) para que el golpe coincida con el clímax visual. **Dónde:** `LevelUpOverlay.tsx:50-53` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-110 · Reducir trabajo del bucle de anillos en gama baja
**Qué:** detectar dispositivos de gama baja y reducir a un solo anillo o desactivar el loop para mantener 60 fps. **Dónde:** `LevelUpOverlay.tsx:60-62` · **Impacto:** 2 · **Esfuerzo:** M

### JCE-111 · `removeClippedSubviews`/optimización del Modal
**Qué:** asegurar que el Modal no fuerza repintados del árbol bajo él mientras los anillos animan. **Dónde:** `LevelUpOverlay.tsx:58-72` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-112 · Memoizar el componente `Ring`
**Qué:** envolver `Ring` en `React.memo` para que un re-render del overlay no fuerce su reconciliación. **Dónde:** `LevelUpOverlay.tsx:13` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-113 · Memoizar `XpToast` con `React.memo`
**Qué:** evitar reconciliaciones innecesarias del toast cuando el padre re-renderiza por otros estados. **Dónde:** `XpToast.tsx:12` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-114 · Memoizar `LevelUpOverlay` con `React.memo`
**Qué:** igual que JCE-113, reduce trabajo cuando el padre cambia estado no relacionado. **Dónde:** `LevelUpOverlay.tsx:42` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-115 · Extraer styles de animación a constantes derivadas del tema
**Qué:** colores cian/borde del overlay/toast referencian `theme.ts`; añadir tokens semánticos (`celebration`, `toastBg`) para no acoplar a `cyan` directamente. **Dónde:** `LevelUpOverlay.tsx:88-128`, `XpToast.tsx:40-57`, `theme.ts` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-116 · Tipos estrictos para el evento de toast
**Qué:** `setToast({ xp, bonus })` usa un objeto inline; definir un tipo `ToastEvent` (con futuro `kind: 'xp'|'penalty'|'pr'`) en `types.ts` para escalar las variantes. **Dónde:** `index.tsx:45,114`, `types.ts` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-117 · Documentar la invariante "una celebración a la vez"
**Qué:** definir el orden cuando coinciden level-up + logro (hoy `index.tsx:140` evita el alert de logro si hubo level-up); formalizar la cola de celebraciones. **Dónde:** `index.tsx:140-142` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-118 · Cola unificada de celebraciones (level-up → logro → racha)
**Qué:** un orquestador que reproduzca celebraciones en secuencia evita solapes y `Alert` perdidos. **Dónde:** nuevo `src/lib/celebrations.ts`; consumido en `index.tsx`, `dungeon/[id].tsx`, `gym.tsx` · **Impacto:** 5 · **Esfuerzo:** L

### JCE-119 · Prefetch/caché de assets de animación
**Qué:** si se añaden SFX/lottie, precargarlos al iniciar para que la primera celebración no tenga latencia. **Dónde:** arranque (`_layout.tsx`) · **Impacto:** 3 · **Esfuerzo:** M

### JCE-120 · Respeto a "ahorro de batería"/data saver en animaciones costosas
**Qué:** además de reduce-motion, considerar desactivar bucles/blur en modo ahorro. **Dónde:** `LevelUpOverlay.tsx:60-62`, JCE-057 · **Impacto:** 2 · **Esfuerzo:** M

### JCE-121 · Storybook/pantalla de depuración de celebraciones
**Qué:** una pantalla oculta para disparar a mano level-up/toast/logro/PR facilita iterar el juice sin reproducir el juego. **Dónde:** nueva pantalla dev; consume los componentes de `components/` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-122 · Test de regresión del tempo (duraciones)
**Qué:** congelar las constantes de `motion.ts` (JCE-049) en un test para detectar cambios accidentales de timing. **Dónde:** `motion.test.ts` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-123 · Guard de `xp` no entero en el toast
**Qué:** asegurar que `xp` siempre es entero antes de renderizar (`Math.round`) por si una fuente futura pasa decimales. **Dónde:** `XpToast.tsx:34` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-124 · Evitar render del toast con `bonus` indefinido mostrando estilo inconsistente
**Qué:** `bonus?` opcional (línea 6) renderiza distinto según undefined/false; normalizar a boolean para consistencia visual. **Dónde:** `XpToast.tsx:6,34` · **Impacto:** 1 · **Esfuerzo:** S

### JCE-125 · Animación de "rango ascendido" con texto destacado
**Qué:** cuando `rankForLevel` cambia de letra, resaltar "RANGO X" con un flash diferenciado del resto del overlay. **Dónde:** `LevelUpOverlay.tsx:67` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-126 · Feedback al tocar "continuar" en el overlay
**Qué:** un háptico ligero (`impactAsync(Light)`) al cerrar el overlay cierra el bucle táctil de la celebración. **Dónde:** `LevelUpOverlay.tsx:59` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-127 · Dim progresivo del hint "Toca para continuar"
**Qué:** el hint (línea 69) podría pulsar suavemente para invitar al toque tras 1-2 s sin acción. **Dónde:** `LevelUpOverlay.tsx:69,123-128` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-128 · Sincronizar entrada del toast con el háptico de la pantalla
**Qué:** el háptico se dispara en `finishQuest` (`index.tsx:112`) antes de `setToast` (línea 114); alinear el inicio de la animación con el golpe háptico para coherencia. **Dónde:** `index.tsx:112-114` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-129 · Evitar overlay y toast simultáneos compitiendo por atención
**Qué:** cuando hay level-up, el toast "+XP" y el overlay aparecen a la vez; decidir si el toast se suprime mientras el overlay está abierto. **Dónde:** `index.tsx:330-331` · **Impacto:** 3 · **Esfuerzo:** S

### JCE-130 · Animación de cierre coordinada cuando level-up sigue a toast
**Qué:** si el toast aún sube y se abre el overlay, encadenar (terminar toast → abrir overlay) en vez de solaparlos. **Dónde:** `index.tsx:114,127` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-131 · Parámetro de intensidad de celebración por magnitud de XP
**Qué:** escalar la celebración (anillos, partículas, duración) según si fue +10 o +250 XP. **Dónde:** `LevelUpOverlay.tsx`/`XpToast.tsx` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-132 · Soporte de tema/contraste alto en celebraciones
**Qué:** verificar contraste del texto cian sobre panel en modo alto contraste del SO; ofrecer variante más legible. **Dónde:** `LevelUpOverlay.tsx:99-116`, `XpToast.tsx:52-57` · **Impacto:** 2 · **Esfuerzo:** M

### JCE-133 · Pausar animaciones cuando la app pasa a background
**Qué:** suscribir a `AppState` para detener bucles (anillos) cuando la app no está en foreground, ahorrando batería. **Dónde:** `LevelUpOverlay.tsx:17-33` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-134 · Limitar concurrencia de toasts en gym (sets rápidos)
**Qué:** registrar varios sets seguidos podría disparar múltiples toasts; aplicar la misma cola (JCE-015) al consumir el toast en gym. **Dónde:** `gym.tsx` (registro de levantamiento) · **Impacto:** 3 · **Esfuerzo:** M

### JCE-135 · Animación de "evidencia adjuntada"
**Qué:** al capturar foto de evidencia (`captureEvidence`, `index.tsx:92-105`), un micro-feedback (flash/clic de cámara) confirmaría la captura. **Dónde:** `index.tsx:98-104` · **Impacto:** 3 · **Esfuerzo:** S

### JCE-136 · Indicador de "+25% por evidencia" más visible en el toast
**Qué:** el sufijo "· evidencia ×1,25" (línea 34) es texto pequeño; convertirlo en un badge/icono resaltado para premiar el comportamiento. **Dónde:** `XpToast.tsx:34` · **Impacto:** 3 · **Esfuerzo:** S

### JCE-137 · Animación de número de nivel con dígitos rodantes
**Qué:** al subir de nivel, hacer "rodar" el dígito del nivel anterior al nuevo dentro del overlay. **Dónde:** `LevelUpOverlay.tsx:66` · **Impacto:** 3 · **Esfuerzo:** L

### JCE-138 · Persistir "última celebración vista" para no repetir
**Qué:** evitar re-disparar la misma celebración si la pantalla se re-monta (focus) con el mismo estado. **Dónde:** `index.tsx` (focus/`load`) · **Impacto:** 3 · **Esfuerzo:** M

### JCE-139 · Animación de progreso hacia el siguiente logro
**Qué:** micro-barras animadas que muestren cercanía a logros (refuerza el bucle). **Dónde:** vista de logros (`achievements`) · **Impacto:** 3 · **Esfuerzo:** M

### JCE-140 · Animación de desbloqueo en la rejilla de logros
**Qué:** cuando un logro pasa de bloqueado a desbloqueado, animar su tarjeta (flip/glow) en la pantalla de logros. **Dónde:** vista de logros · **Impacto:** 3 · **Esfuerzo:** M

### JCE-141 · Sonido/haptic diferenciado por rareza de logro
**Qué:** logros más difíciles con celebración más intensa. **Dónde:** `celebrations.ts` (JCE-118) + datos de logros · **Impacto:** 2 · **Esfuerzo:** M

### JCE-142 · Animación de la barra de stats en el perfil
**Qué:** al entrar en Perfil, animar el llenado de FUE/VIT/INT/AGI/PER desde 0 a su valor. **Dónde:** `perfil` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-143 · Transición de carga del avatar/hexágono de perfil
**Qué:** un skeleton/fade del hexágono de rango mientras carga el perfil. **Dónde:** `perfil` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-144 · Animación de cierre de día (resumen nocturno)
**Qué:** una secuencia breve al ejecutarse el cierre (XP final, penalizaciones, racha) como "informe del sistema". **Dónde:** flujo de cierre (`closing.ts` consumido en pantalla) · **Impacto:** 4 · **Esfuerzo:** L

### JCE-145 · Feedback de éxito al exportar datos
**Qué:** si `exporter` produce un fichero, una confirmación animada cerraría la acción. **Dónde:** pantalla que invoca `exporter` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-146 · Consistencia de duración entre toast y overlay
**Qué:** el toast dura ~1.43 s y el overlay no auto-cierra; definir una jerarquía de tiempos coherente entre micro-feedback y celebración mayor. **Dónde:** `XpToast.tsx:20-26`, `LevelUpOverlay.tsx:46-55` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-147 · Evitar `Math.random` no determinista del flavor en tests
**Qué:** `voice.levelUp()` usa `Math.random` (`voice.ts:5`); inyectar/seed para snapshots estables del overlay. **Dónde:** `LevelUpOverlay.tsx:68`, `voice.ts:4-6` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-148 · Animación de "racha rota" (pérdida)
**Qué:** cuando la racha cae a 0 sin piedra, un feedback sobrio (no castigador) comunicaría la pérdida con dignidad. **Dónde:** flujo de cierre + display de racha · **Impacto:** 3 · **Esfuerzo:** M

### JCE-149 · Vibración/animación de cuenta atrás cerca de medianoche
**Qué:** acercándose el cierre, un sutil indicador animado de "tiempo restante" reforzaría la urgencia. **Dónde:** `index.tsx` (estado del día) · **Impacto:** 3 · **Esfuerzo:** M

### JCE-150 · Animación de transición entre fases del día (mañana/tarde/cierre)
**Qué:** variar sutilmente el tono visual del cuadro de estado según la fase para dar vida temporal a la app. **Dónde:** `index.tsx` (cuadro de estado) · **Impacto:** 2 · **Esfuerzo:** M

### JCE-151 · `InteractionManager` para diferir trabajo tras la celebración
**Qué:** las cargas posteriores a una celebración (`completionStats`, `unlockAchievements` en `index.tsx:129-139`) corren durante la animación; diferirlas con `InteractionManager.runAfterInteractions` mantiene la animación fluida. **Dónde:** `index.tsx:129-139` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-152 · Evitar `await load()` bloqueante antes de la celebración en mazmorra
**Qué:** en `claimLoot`/`finishTask`, `await load()` (`dungeon/[id].tsx:97,125`) ocurre y luego se muestra el overlay; reordenar para que la celebración no espere a la recarga. **Dónde:** `dungeon/[id].tsx:96-97,124-125` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-153 · Hook `useCelebration()` para encapsular estado overlay+toast
**Qué:** repetir `useState` de `levelUp` y `toast` en cada pantalla es propenso a errores; un hook unificaría el patrón. **Dónde:** `index.tsx:42,45`, `gym.tsx`, `dungeon/[id].tsx` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-154 · Tests de accesibilidad (roles/labels) de los componentes de juice
**Qué:** asserts de que overlay y toast exponen los roles/labels correctos (depende de JCE-039/040). **Dónde:** `.test.tsx` de ambos · **Impacto:** 2 · **Esfuerzo:** S

### JCE-155 · Documentar el contrato de `onDone`/`onClose`
**Qué:** dejar claro en JSDoc que `onClose`/`onDone` deben ser estables (memoizados) para no reiniciar animaciones (raíz de CRIT-JCE-02). **Dónde:** `XpToast.tsx:5-9`, `LevelUpOverlay.tsx:8-11` · **Impacto:** 3 · **Esfuerzo:** S

### JCE-156 · Animación de aparición de la lista de agenda
**Qué:** stagger de los eventos de agenda al cargar para coherencia con el resto de listas. **Dónde:** `agenda` · **Impacto:** 2 · **Esfuerzo:** M

### JCE-157 · Feedback al marcar comida/dieta
**Qué:** micro-toast/haptic al registrar una comida, igual que en misiones. **Dónde:** `dieta` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-158 · Feedback al registrar una compra
**Qué:** confirmación animada al añadir un ítem de compra. **Dónde:** `compra` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-159 · Animación de barra de progreso de objetivo de dieta
**Qué:** si hay objetivos diarios, animar su llenado al registrar. **Dónde:** `dieta` · **Impacto:** 2 · **Esfuerzo:** M

### JCE-160 · Unificar `letterSpacing`/tipografía de los textos animados con el sistema
**Qué:** `notice`/`rank` usan letter-spacing distintos (4 y 3) y el toast 1; revisar coherencia tipográfica del juice con `nivl-design-system`. **Dónde:** `LevelUpOverlay.tsx:99-116`, `XpToast.tsx:52-57` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-161 · Soporte de orientación/landscape en el overlay
**Qué:** el panel usa padding fijo; verificar que en landscape el número de nivel y anillos no se salen. **Dónde:** `LevelUpOverlay.tsx:91-98` · **Impacto:** 1 · **Esfuerzo:** S

### JCE-162 · Limitar tamaño máximo del texto del overlay con escalado de fuente del SO
**Qué:** con fuente del sistema XXL, "HAS SUBIDO DE NIVEL" podría desbordar; fijar `allowFontScaling`/maxFontSizeMultiplier coherente. **Dónde:** `LevelUpOverlay.tsx:65,99-104` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-163 · `allowFontScaling` controlado en el toast
**Qué:** el "+XP" podría romper su caja con fuentes grandes; limitar el multiplicador. **Dónde:** `XpToast.tsx:33` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-164 · Animación de "carga inicial de la app" (splash → sistema)
**Qué:** una transición temática del splash al primer pintado del cuadro de estado daría continuidad de marca. **Dónde:** arranque (`_layout.tsx`/splash) · **Impacto:** 3 · **Esfuerzo:** M

### JCE-165 · Reutilizar el componente de anillos para otras celebraciones
**Qué:** extraer `Ring`/`ringLayer` a un componente compartido para usarlo en logro/mazmorra, no solo en level-up. **Dónde:** `LevelUpOverlay.tsx:13-40,60-63` · **Impacto:** 3 · **Esfuerzo:** M

### JCE-166 · Animación de "stat al máximo" o hito de stat
**Qué:** cuando un stat cruza un umbral notable, una pequeña celebración específica del stat. **Dónde:** vista de stats · **Impacto:** 2 · **Esfuerzo:** M

### JCE-167 · Feedback de error de red diferenciado del de validación
**Qué:** los `catch` muestran el mensaje crudo (`e.message`); un háptico/animación distinta para fallo de red vs. lógica mejoraría la lectura. **Dónde:** `index.tsx:144`, `dungeon/[id].tsx:99,127` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-168 · Animación de la insignia de evidencia en la tarjeta completada
**Qué:** mostrar un icono de cámara animado en misiones completadas con evidencia. **Dónde:** `index.tsx:124` (evidencia) + tarjeta de misión · **Impacto:** 2 · **Esfuerzo:** S

### JCE-169 · Transición suave al ocultar el aviso de cierre tras actuar
**Qué:** cuando el usuario completa lo pendiente, el aviso de cierre debería desvanecerse, no desaparecer instantáneo. **Dónde:** `index.tsx` (aviso de cierre) · **Impacto:** 2 · **Esfuerzo:** S

### JCE-170 · Pulido del fade del Modal con `statusBarTranslucent`
**Qué:** asegurar que el overlay cubre la barra de estado en Android (`statusBarTranslucent` en el Modal) para una celebración a pantalla completa. **Dónde:** `LevelUpOverlay.tsx:58` · **Impacto:** 2 · **Esfuerzo:** S

### JCE-171 · Throttle de haptics para evitar saturación
**Qué:** si se disparan muchas acciones seguidas, limitar la frecuencia de haptics para que no se sientan como ruido. **Dónde:** futuro `haptics.ts` (JCE-003) · **Impacto:** 2 · **Esfuerzo:** S

### JCE-172 · Animación de "bonus de racha desbloqueado" al cruzar 7 días
**Qué:** el multiplicador crece cada 7 días; celebrar visualmente cuando sube el multiplicador, no solo la cifra de racha. **Dónde:** display de racha + `game.ts` (streakMultiplier) · **Impacto:** 4 · **Esfuerzo:** M

### JCE-173 · Estado "vacío" animado de listas (misiones del día creadas)
**Qué:** cuando no hay misiones aún, un estado vacío con micro-animación temática ("el sistema prepara tus misiones") en vez de espacio en blanco. **Dónde:** listas (misiones/mazmorras) · **Impacto:** 3 · **Esfuerzo:** M

### JCE-174 · Animación de aparición del "+XP" desde la posición de la tarjeta
**Qué:** en vez de aparecer siempre centrado arriba (`top: 110`), que el toast emerja desde la tarjeta tocada para mejor conexión causa-efecto. **Dónde:** `XpToast.tsx:42`, origen del toque en `index.tsx` · **Impacto:** 3 · **Esfuerzo:** L

### JCE-175 · Reducir el coste del `Hexagon` SVG en los anillos
**Qué:** cada `Ring` monta un `<Svg>` completo; para una animación de escala bastaría un borde/`View` con `borderRadius` o un único SVG cacheado, reduciendo nodos nativos. **Dónde:** `LevelUpOverlay.tsx:37`, `Hexagon.tsx:27-34` · **Impacto:** 2 · **Esfuerzo:** M

Total: 175 mejoras, 4 bugs.
