# Navegación y routing

> Área NAV · auditoría de código NIVL · anclada al código real

Alcance leído: `src/app/_layout.tsx`, `src/app/(tabs)/_layout.tsx`, `src/app/index.tsx`, `src/app/login.tsx`, `src/app/(tabs)/index.tsx` (Sistema, grid de módulos), `src/app/dungeon/[id].tsx` (ruta dinámica), `src/app/(tabs)/perfil.tsx`, `src/app/(tabs)/mazmorras.tsx`, `src/app/(tabs)/agenda.tsx`, `src/app/(tabs)/misiones.tsx`, `src/app/gym.tsx`, `src/app/dieta.tsx`, `src/app/compra.tsx`, `src/app/diario.tsx`, `src/app/informe.tsx`, `src/app/oraculo.tsx`, `src/lib/auth.tsx`, `src/lib/notifications.ts`, `src/lib/theme.ts`, `app.json`.

Resumen del modelo de navegación real:
- Stack raíz en `_layout.tsx` con `headerShown: false` global; sin `<Stack.Screen>` declarados, sin `ErrorBoundary`, sin `unstable_settings`/`initialRouteName`, sin config de `linking`.
- `index.tsx` es una **puerta** (`Redirect`) que decide `/(tabs)` o `/login` según `session`. Es el ÚNICO punto con lógica de autenticación de ruta.
- Grupo `(tabs)` con 5 pestañas (index/misiones/mazmorras/agenda/perfil) y 7 pantallas stack "escondidas" (gym, dieta, compra, diario, informe, oraculo, dungeon/[id]).
- Descubribilidad de los 7 módulos: grid `MODULES` en `(tabs)/index.tsx:25-32` con `router.push(m.route)`.
- `scheme: "nivl"` y `experiments.typedRoutes: true` en `app.json`; `expo-linking` instalado. No hay manejo de respuesta a notificaciones (deep link al tocar la notificación).

---

## Bugs y riesgos

### CRIT-NAV-01 · Deep link entra directo a pantallas protegidas saltándose la puerta de auth — `app.json:8` + `(tabs)/_layout.tsx:6-20` · severidad alta
**Problema:** Con `scheme: "nivl"` y `typedRoutes`, expo-router registra rutas profundas para TODAS las pantallas. La única comprobación de sesión vive en `index.tsx` (la ruta `/`). Un deep link como `nivl://gym`, `nivl://oraculo`, `nivl://(tabs)/perfil` o `nivl://dungeon/abc` abre esa pantalla **sin pasar por `index.tsx`**, por lo que se renderiza sin sesión. `userId` queda `undefined`, los `load()` hacen early-return y el usuario ve una pantalla en blanco o a medias (p. ej. `gym.tsx:148` `if (!dungeon) return <SafeAreaView/>` queda vacío para siempre). En frío (app cerrada) el deep link gana la carrera al `AuthProvider`. **Arreglo:** añadir un guard de grupo. Crear `src/app/(tabs)/_layout.tsx` con redirección: leer `useAuth()` y `if (!loading && !session) return <Redirect href="/login" />` antes de `<Tabs>`; e idealmente envolver también las pantallas stack (mover gym/dieta/… a un grupo `(app)` con su propio `_layout` que comparta el guard), o exponer un `<Redirect>` por pantalla. Alternativa robusta: un hook `useProtectedRoute(session, segments)` en `_layout.tsx` raíz que haga `router.replace('/login')` cuando no hay sesión y el segmento no es público.

### CRIT-NAV-02 · La expiración de sesión en caliente no redirige; quedas atrapado en una pantalla muerta — `auth.tsx:21-24` + `(tabs)/index.tsx:50-51` · severidad alta
**Problema:** `onAuthStateChange` (auth.tsx:21) sólo hace `setSession(next)`; **nada reacciona a `SIGNED_OUT`** ni a un refresh-token fallido a nivel de navegación. Si el token caduca o Supabase invalida la sesión mientras el usuario está en cualquier pestaña/módulo, `session` pasa a `null` pero la pantalla actual NO se desmonta ni redirige (sólo `index.tsx` reacciona, y ya no está montado). Resultado: `userId` se vuelve `undefined`, cada `load()` hace `if (!userId) return` (p. ej. `(tabs)/index.tsx:50`, `perfil.tsx:64`) y el usuario ve datos congelados sin poder operar ni entender por qué. **Arreglo:** centralizar la reacción a la sesión. En `_layout.tsx` (dentro de `AuthProvider`) o en `(tabs)/_layout.tsx`, un `useEffect`/guard que, cuando `!loading && !session`, ejecute `router.replace('/login')`. Esto cubre logout desde otro dispositivo, expiración y revocación, no sólo el botón "Cerrar sesión".

### CRIT-NAV-03 · Sin pantalla `+not-found`: un deep link inválido rompe el tema y atrapa al usuario — falta `src/app/+not-found.tsx` · severidad media
**Problema:** No existe `+not-found.tsx`. Con `scheme` público, cualquier URL desconocida (`nivl://foo`, un enlace viejo, una notificación con ruta renombrada) cae en la pantalla 404 por defecto de expo-router: fondo claro, tipografía del sistema, y un enlace "Go to home screen" en inglés. Rompe por completo la identidad oscura "Solo Leveling" (`colors.bg = #060B16`) y desorienta. **Arreglo:** crear `src/app/+not-found.tsx` con `SafeAreaView` de tema, copy del sistema en español (voz de "el sistema": p. ej. "RUTA NO ENCONTRADA · El sistema no reconoce este destino") y un `SystemButton` que haga `router.replace('/')`.

### CRIT-NAV-04 · Carga de fuentes sin manejo de error: fallo => pantalla negra permanente — `_layout.tsx:15-31` · severidad media
**Problema:** `useFonts({...})` devuelve `[loaded, error]` pero sólo se desestructura `loaded` (línea 15). Si la carga de alguna fuente falla (`error` no-nulo), `loaded` permanece `false` indefinidamente y el componente devuelve para siempre `<View style={{ backgroundColor: colors.bg }} />` (línea 30) — pantalla negra sin contenido ni feedback, con el splash ya escondido o bloqueado. No hay timeout ni fallback a fuentes del sistema. **Arreglo:** desestructurar `const [loaded, error] = useFonts(...)` y, en el `useEffect`, ocultar splash y renderizar la app también cuando `error` existe: `if (loaded || error) SplashScreen.hideAsync()`. La condición de bloqueo debe ser `if (!loaded && !error)`. Opcional: registrar `error` para diagnóstico.

### CRIT-NAV-05 · `SplashScreen.preventAutoHideAsync()` / `hideAsync()` sin `.catch` => posible unhandled rejection — `_layout.tsx:12,25` · severidad baja
**Problema:** Ambas llamadas a la API de splash devuelven promesas y se invocan sin `.catch`. En ciertos arranques (carrera con el auto-hide nativo, o si el módulo aún no está listo) rechazan; al no capturarse generan un "Possible unhandled promise rejection" y, en peor caso, ruido en producción o un warning que enmascara fallos reales de arranque. **Arreglo:** `SplashScreen.preventAutoHideAsync().catch(() => {})` (línea 12) y envolver `hideAsync()` (línea 25) en try/catch o `.catch(() => {})`.

### CRIT-NAV-06 · `router.replace('/')` tras login rebota por el gate; ventana de spinner/redirect doble — `login.tsx:34,48` · severidad baja
**Problema:** Tras `signInWithPassword`, `signIn` hace `router.replace('/')` (línea 34). `/` es la puerta `index.tsx`, que en ese instante puede tener `loading` ya `false` pero `session` aún no propagada por el `onAuthStateChange` (es asíncrono), mostrando momentáneamente el `ActivityIndicator` y, si la propagación tarda, un `Redirect` de vuelta a `/login`. Funciona en la práctica, pero es un rebote `/login → / → (spinner) → /(tabs)` frágil que depende del timing del provider. **Arreglo:** navegar directo al destino real: `router.replace('/(tabs)')` tras un login exitoso, dejando `/` sólo para el arranque en frío. Así el gate no tiene que re-evaluar la sesión recién creada.

### CRIT-NAV-07 · `dungeon/[id]` no distingue "cargando" de "id inválido": id corrupto => pantalla en blanco sin salida — `dungeon/[id].tsx:54-62,148-150` · severidad media
**Problema:** Si `fetchDungeon(id)` no encuentra la mazmorra (id de un deep link viejo, registro borrado en otro dispositivo, id malformado), `dungeon` queda `null` y el render devuelve `<SafeAreaView style={styles.screen} edges={['top']} />` (línea 149): pantalla vacía, **sin cabecera, sin botón atrás, sin mensaje**. El mismo estado se usa para "aún cargando", así que el usuario no sabe si esperar o que no existe; y como no hay chevron, sólo puede salir con el gesto/sistema. Además `load` (línea 56) hace `if (!id) return` sin avisar. **Arreglo:** estado triple: `loading | notFound | ready`. Mientras carga, mostrar un spinner; si `fetchDungeon` devuelve null o lanza, mostrar un `SystemWindow` "Mazmorra no encontrada" con un `Pressable` de volver (`router.back()` o `router.replace('/(tabs)/mazmorras')`). Nunca renderizar una pantalla sin affordance de salida.

---

## Mejoras

### NAV-001 · Guard de autenticación a nivel de grupo `(tabs)`
**Qué:** centralizar la protección de rutas en `(tabs)/_layout.tsx` en vez de depender sólo de `index.tsx`. **Dónde:** `(tabs)/_layout.tsx:6-20` · **Impacto:** 5 · **Esfuerzo:** M

### NAV-002 · Agrupar las 7 pantallas stack bajo un grupo protegido `(app)`
**Qué:** mover gym/dieta/compra/diario/informe/oraculo/dungeon a `src/app/(app)/` con su `_layout` que comparta el guard de sesión, evitando deep links sin auth a módulos. **Dónde:** `src/app/gym.tsx`…`src/app/dungeon/[id].tsx` (estructura de carpetas) · **Impacto:** 5 · **Esfuerzo:** L

### NAV-003 · Reaccionar globalmente a `SIGNED_OUT`
**Qué:** un único `useEffect` que, ante `!session`, redirija a `/login`, cubriendo expiración y revocación remota. **Dónde:** `auth.tsx:21-24` + `_layout.tsx:33-43` · **Impacto:** 5 · **Esfuerzo:** M

### NAV-004 · Crear `+not-found.tsx` temático
**Qué:** pantalla 404 con tema oscuro, copy del sistema y botón de retorno. **Dónde:** nuevo `src/app/+not-found.tsx` · **Impacto:** 4 · **Esfuerzo:** S

### NAV-005 · Manejar `error` de `useFonts`
**Qué:** desbloquear el arranque si las fuentes fallan, con fallback. **Dónde:** `_layout.tsx:15,23-31` · **Impacto:** 4 · **Esfuerzo:** S

### NAV-006 · `.catch` en las llamadas de SplashScreen
**Qué:** evitar unhandled rejections en arranque. **Dónde:** `_layout.tsx:12,25` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-007 · Login navega directo a `/(tabs)`
**Qué:** eliminar el rebote por el gate `/`. **Dónde:** `login.tsx:34,48` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-008 · Estado triple en `dungeon/[id]` (loading/notFound/ready)
**Qué:** distinguir carga de id inexistente y siempre ofrecer salida. **Dónde:** `dungeon/[id].tsx:54-62,148-150` · **Impacto:** 4 · **Esfuerzo:** M

### NAV-009 · Spinner de carga inicial en `dungeon/[id]`
**Qué:** `ActivityIndicator` con `colors.purple` mientras `dungeon === null` y aún no se sabe si existe. **Dónde:** `dungeon/[id].tsx:148-150` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-010 · `ErrorBoundary` exportada en `_layout.tsx`
**Qué:** expo-router soporta exportar `ErrorBoundary`; capturar crashes de render y mostrar pantalla de tema con "reintentar". **Dónde:** `_layout.tsx` (export nuevo) · **Impacto:** 4 · **Esfuerzo:** M

### NAV-011 · Declarar pantallas con `<Stack.Screen>` y títulos/animaciones
**Qué:** en vez de Stack vacío, declarar cada ruta con opciones (animación, gesto, presentación) coherentes. **Dónde:** `_layout.tsx:36-41` · **Impacto:** 3 · **Esfuerzo:** M

### NAV-012 · `dungeon/[id]` como `presentation: 'card'` con animación explícita
**Qué:** fijar animación de push coherente Solo-Leveling en lugar de la default. **Dónde:** `_layout.tsx` + `dungeon/[id].tsx` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-013 · Tipar la ruta dinámica con `Href`/params tipados
**Qué:** `router.push({ pathname: '/dungeon/[id]', params: { id } })` ya se usa en mazmorras; replicar el patrón tipado en cualquier navegación futura y evitar strings sueltos. **Dónde:** `mazmorras.tsx:71,103` (referencia) · **Impacto:** 2 · **Esfuerzo:** S

### NAV-014 · `MODULES.route` como `Href` en vez de string `as const`
**Qué:** tipar el array con `satisfies readonly { route: Href }[]` para que `router.push(m.route)` valide contra typedRoutes en compilación. **Dónde:** `(tabs)/index.tsx:25-32,321` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-015 · `useLocalSearchParams` tipado y validado en `dungeon/[id]`
**Qué:** además del genérico `<{ id: string }>`, validar que `id` es un UUID/no vacío antes de `fetchDungeon`. **Dónde:** `dungeon/[id].tsx:41,56` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-016 · Manejo de respuesta a notificaciones (deep link al tocar)
**Qué:** `Notifications.addNotificationResponseReceivedListener` para que tocar "Nuevas misiones" abra `/(tabs)` y "El cierre se acerca" abra Sistema; hoy no hay handler de respuesta. **Dónde:** `notifications.ts:5-12` + `_layout.tsx` · **Impacto:** 4 · **Esfuerzo:** M

### NAV-017 · `data` payload en notificaciones para enrutar
**Qué:** añadir `content.data = { route: '/(tabs)' }` a cada `scheduleNotificationAsync` para que el listener sepa a dónde ir. **Dónde:** `notifications.ts:28-49` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-018 · Cabecera reutilizable `ScreenHeader` (chevron + título + acción)
**Qué:** las 7 pantallas stack repiten el mismo patrón manual de header (`Pressable` chevron + `Text` + slot derecho). Extraer a `components/ScreenHeader.tsx`. **Dónde:** `gym.tsx:180-188`, `dieta.tsx:109-117`, `compra.tsx:55-60`, `diario.tsx:143-149`, `informe.tsx:101-107`, `oraculo.tsx:118-124`, `dungeon/[id].tsx:158-168` · **Impacto:** 4 · **Esfuerzo:** M

### NAV-019 · `router.back()` con fallback cuando no hay historial
**Qué:** si una pantalla se abre por deep link directo, `router.back()` no tiene a dónde volver. Usar `router.canGoBack() ? router.back() : router.replace('/(tabs)')`. **Dónde:** `gym.tsx:181`, `dieta.tsx:110`, `compra.tsx:56`, `diario.tsx:144`, `informe.tsx:102`, `oraculo.tsx:119`, `dungeon/[id].tsx:159` · **Impacto:** 4 · **Esfuerzo:** M

### NAV-020 · Centralizar el fallback de back en un helper `goBack()`
**Qué:** un util en `lib/` (`navBack()`) con la lógica `canGoBack`, usado por `ScreenHeader`. **Dónde:** nuevo `lib/nav.ts` + consumidores de NAV-019 · **Impacto:** 3 · **Esfuerzo:** S

### NAV-021 · Accesibilidad: `accessibilityRole="button"` y label en chevrons de back
**Qué:** los `Pressable` de back sólo tienen icono; sin label un lector de pantalla dice "botón" sin contexto. Añadir `accessibilityLabel="Volver"`. **Dónde:** `gym.tsx:181`, `dieta.tsx:110`, `compra.tsx:56`, `diario.tsx:144`, `informe.tsx:102`, `oraculo.tsx:119`, `dungeon/[id].tsx:159` · **Impacto:** 4 · **Esfuerzo:** S

### NAV-022 · Accesibilidad: labels en iconos-acción de cabecera
**Qué:** el `+` de gym (`gym.tsx:185`), el carrito de dieta (`dieta.tsx:114`), la papelera de dungeon (`dungeon/[id].tsx:165`) y el `+` de mazmorras (`mazmorras.tsx:87`) son `Pressable` sin `accessibilityLabel`. **Dónde:** citadas · **Impacto:** 4 · **Esfuerzo:** S

### NAV-023 · Accesibilidad: tab bar con labels claros
**Qué:** verificar que cada `Tabs.Screen` expone `tabBarAccessibilityLabel` (p. ej. "Sistema, pestaña 1 de 5"). **Dónde:** `(tabs)/_layout.tsx:21-61` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-024 · Tab "Sistema" con icono semántico
**Qué:** la pestaña principal usa `grid-outline` (genérico). Un icono más identitario (rombo/sistema) mejora reconocimiento. **Dónde:** `(tabs)/_layout.tsx:25` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-025 · Estado activo del tab más visible
**Qué:** además de `tabBarActiveTintColor`, añadir indicador superior/inferior (línea cian) para reforzar la pestaña activa. **Dónde:** `(tabs)/_layout.tsx:9-19` · **Impacto:** 2 · **Esfuerzo:** M

### NAV-026 · Haptics al cambiar de pestaña
**Qué:** `tabPress` con `Haptics.selectionAsync()` para feedback táctil coherente con el resto de la app. **Dónde:** `(tabs)/_layout.tsx:8` (listeners) · **Impacto:** 2 · **Esfuerzo:** S

### NAV-027 · Badge en la pestaña Sistema con misiones pendientes
**Qué:** `tabBarBadge` con el nº de misiones pendientes de hoy para empujar a completar. **Dónde:** `(tabs)/_layout.tsx:21-27` + fuente de datos de `(tabs)/index.tsx:193` · **Impacto:** 4 · **Esfuerzo:** L

### NAV-028 · Badge en Mazmorras con mazmorras "all done" sin reclamar
**Qué:** indicar cuántas mazmorras tienen el botín listo para reclamar. **Dónde:** `(tabs)/_layout.tsx:37-43` + `mazmorras.tsx:79` · **Impacto:** 3 · **Esfuerzo:** L

### NAV-029 · Grid de módulos: marcar destino con chevron/affordance
**Qué:** los tiles de `MODULES` no indican que navegan; añadir un mini chevron o cambiar a estilo "tarjeta pulsable". **Dónde:** `(tabs)/index.tsx:319-326` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-030 · Accesibilidad de los tiles de módulo
**Qué:** cada `Pressable` de módulo (`(tabs)/index.tsx:321`) necesita `accessibilityRole="button"` y `accessibilityLabel={m.label}`. **Dónde:** `(tabs)/index.tsx:321-324` · **Impacto:** 4 · **Esfuerzo:** S

### NAV-031 · `hitSlop` y tamaño mínimo táctil en tiles
**Qué:** los tiles tienen `width: '30.5%'` y poco padding vertical; garantizar 44pt de altura mínima para accesibilidad táctil. **Dónde:** `(tabs)/index.tsx:492-500` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-032 · Descubribilidad: subtítulo/hint en la sección MÓDULOS
**Qué:** añadir microcopy ("Herramientas del cazador") bajo el título MÓDULOS para que el usuario nuevo entienda que son destinos. **Dónde:** `(tabs)/index.tsx:317-318` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-033 · Orden/priorización de módulos por uso
**Qué:** permitir reordenar o destacar los módulos más usados (gym/diario) primero. **Dónde:** `(tabs)/index.tsx:25-32` · **Impacto:** 2 · **Esfuerzo:** M

### NAV-034 · Animación de entrada del grid de módulos
**Qué:** stagger sutil al aparecer para reforzar la sensación de "ventana del sistema". **Dónde:** `(tabs)/index.tsx:319-327` · **Impacto:** 2 · **Esfuerzo:** M

### NAV-035 · Deep links explícitos por módulo documentados
**Qué:** documentar y testear `nivl://gym`, `nivl://diario`, etc., para accesos rápidos/atajos. **Dónde:** `app.json:8` + módulos · **Impacto:** 2 · **Esfuerzo:** S

### NAV-036 · Atajos de app (App Shortcuts / Quick Actions)
**Qué:** quick actions Android/iOS ("Registrar día", "Entrenar") que abran por deep link el módulo correspondiente. **Dónde:** `app.json:32-52` (plugins) + handler en `_layout.tsx` · **Impacto:** 3 · **Esfuerzo:** L

### NAV-037 · Volver desde Oráculo tras asignar usa `replace` a misiones — revisar pila
**Qué:** `router.replace('/(tabs)/misiones')` (oraculo.tsx:101) sustituye Oráculo por la tab; el usuario pierde Oráculo del historial. Evaluar si debería ser `push` o cierre+navegación a tab. **Dónde:** `oraculo.tsx:101` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-038 · Navegación cruzada dieta→compra consistente
**Qué:** dieta usa `router.push('/compra')` (dieta.tsx:98,114); al volver desde compra se vuelve a dieta (correcto), pero si se entró a compra desde el grid, el back va a Sistema. Unificar expectativa con `canGoBack`. **Dónde:** `dieta.tsx:98,114` + `compra.tsx:56` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-039 · Cierre de sesión limpia el stack por completo
**Qué:** `signOut` hace `router.replace('/login')` (perfil.tsx:176) pero pantallas stack abiertas detrás podrían persistir; usar `router.dismissAll()` antes del replace para garantizar pila limpia. **Dónde:** `perfil.tsx:174-177` · **Impacto:** 4 · **Esfuerzo:** S

### NAV-040 · Confirmar antes de cerrar sesión
**Qué:** `Alert` de confirmación antes de `signOut` para evitar salidas accidentales. **Dónde:** `perfil.tsx:174-177,329` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-041 · Feedback de error en `signOut`
**Qué:** `supabase.auth.signOut()` puede fallar (sin red); hoy se ignora el resultado y se navega igual. Capturar y avisar. **Dónde:** `perfil.tsx:174-177` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-042 · Indicador de carga durante `signOut`
**Qué:** deshabilitar el botón y mostrar spinner mientras se cierra sesión. **Dónde:** `perfil.tsx:329` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-043 · Splash de Android con `imageWidth` muy pequeño (76)
**Qué:** `expo-splash-screen` con `imageWidth: 76` (app.json:48) puede verse diminuto en pantallas grandes; revisar tamaño/escala. **Dónde:** `app.json:42-50` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-044 · Splash con animación de salida (fade)
**Qué:** usar `SplashScreen.setOptions({ fade: true, duration })` antes de `hideAsync` para una transición pulida al primer frame. **Dónde:** `_layout.tsx:23-27` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-045 · Pantalla de arranque coherente con el splash
**Qué:** el `View` de espera (`_layout.tsx:30`) es un fondo plano; mostrar el logotipo NIVL atenuado para continuidad con el splash. **Dónde:** `_layout.tsx:29-31` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-046 · Spinner de la puerta `index.tsx` con identidad
**Qué:** el `ActivityIndicator` solo (index.tsx:11-13) podría acompañarse del wordmark "NIVL" o texto "Conectando con el sistema…". **Dónde:** `index.tsx:9-15` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-047 · Timeout/guard en la carga de sesión
**Qué:** si `supabase.auth.getSession()` cuelga, `loading` nunca pasa a false y la puerta queda en spinner infinito. Añadir timeout con estado de error y reintento. **Dónde:** `auth.tsx:16-20` + `index.tsx:9` · **Impacto:** 4 · **Esfuerzo:** M

### NAV-048 · Manejo de error en `getSession`
**Qué:** `getSession().then(...)` (auth.tsx:17) no tiene `.catch`; un fallo deja `loading: true` para siempre. Capturar y poner `loading:false` con sesión null. **Dónde:** `auth.tsx:16-20` · **Impacto:** 4 · **Esfuerzo:** S

### NAV-049 · `predictiveBackGestureEnabled: false` documentado y revisado
**Qué:** está desactivado (app.json:26). Con back personalizado en contenido y modales, conviene documentar por qué y verificar que el gesto del sistema sigue cerrando modales y haciendo pop. **Dónde:** `app.json:26` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-050 · Back de hardware en modales: verificación
**Qué:** los `Modal` usan `onRequestClose` (gym.tsx:306,336; mazmorras.tsx:140; dungeon/[id].tsx:241; perfil.tsx:332,363) que captura el back de Android para cerrar — correcto; añadir test de regresión que lo cubra. **Dónde:** citadas · **Impacto:** 3 · **Esfuerzo:** M

### NAV-051 · Doble modal abierto: prevención
**Qué:** en pantallas con dos modales (gym: día/ejercicio; perfil: freeze/share) asegurar que no pueden abrirse ambos a la vez y que el back cierra el correcto. **Dónde:** `gym.tsx:306,336`, `perfil.tsx:332,363` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-052 · Cerrar modal antes de navegar (mazmorras→dungeon)
**Qué:** `onCreate` hace `setFormOpen(false)` y luego `router.push` (mazmorras.tsx:69-71); verificar orden para que el modal no quede montado durante la transición de pantalla. **Dónde:** `mazmorras.tsx:64-77` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-053 · `dungeon` recién creada: refresco al volver
**Qué:** `dungeon/[id]` usa `useEffect`+`load` (líneas 64-66), no `useFocusEffect`; al volver a la mazmorra desde otra pantalla los datos no se refrescan. Cambiar a `useFocusEffect` como en las tabs. **Dónde:** `dungeon/[id].tsx:64-66` · **Impacto:** 4 · **Esfuerzo:** S

### NAV-054 · `gym.tsx` usa `useEffect` en vez de `useFocusEffect`
**Qué:** misma inconsistencia: gym carga una vez al montar; si se navega a compra y se vuelve, no refresca. **Dónde:** `gym.tsx:83-85` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-055 · `dieta.tsx` usa `useEffect` en vez de `useFocusEffect`
**Qué:** ídem; tras volver de compra el plan podría estar desactualizado. **Dónde:** `dieta.tsx:51-53` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-056 · `compra.tsx` usa `useEffect` en vez de `useFocusEffect`
**Qué:** ídem; ítems añadidos desde dieta podrían no verse al volver. **Dónde:** `compra.tsx:28-30` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-057 · Unificar política de refresco (focus vs mount)
**Qué:** decidir un estándar (focus para listas que cambian entre pantallas) y aplicarlo a todos los módulos; hoy `index/misiones/mazmorras/agenda/perfil/diario/informe` usan focus y `gym/dieta/compra/oraculo/dungeon` usan mount. **Dónde:** comparación global · **Impacto:** 3 · **Esfuerzo:** M

### NAV-058 · `oraculo.tsx` carga la key con `useEffect` (mount) — OK, documentar
**Qué:** la key sólo necesita cargarse al montar; correcto, pero documentar la excepción para no "arreglarla" por error. **Dónde:** `oraculo.tsx:37-44` · **Impacto:** 1 · **Esfuerzo:** S

### NAV-059 · Prevención de doble navegación rápida (mazmorras)
**Qué:** doble toque en una tarjeta de mazmorra puede apilar dos pantallas `dungeon/[id]`. Añadir guard o `unique` por id. **Dónde:** `mazmorras.tsx:103` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-060 · Prevención de doble navegación en grid de módulos
**Qué:** doble toque rápido en un tile podría apilar dos veces la pantalla. Debounce/guard. **Dónde:** `(tabs)/index.tsx:321` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-061 · `onCreate` mazmorra: navegar sólo si éxito
**Qué:** ya hay try/catch; confirmar que `router.push` (mazmorras.tsx:71) está dentro del try y no se ejecuta si `createDungeon` lanza. **Dónde:** `mazmorras.tsx:64-77` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-062 · Indicador de carga al abrir `dungeon/[id]` desde creación
**Qué:** tras crear, se hace push y la pantalla nueva muestra blanco hasta `fetchDungeon`; mostrar spinner (ver NAV-009). **Dónde:** `mazmorras.tsx:71` + `dungeon/[id].tsx:148` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-063 · Título de cabecera dinámico en dungeon
**Qué:** la cabecera muestra "MAZMORRA · RANGO X" (dungeon/[id].tsx:162-164); incluir el nombre o truncado para orientación. **Dónde:** `dungeon/[id].tsx:162-164` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-064 · `numberOfLines` en títulos de cabecera de módulos
**Qué:** títulos largos podrían desbordar; aplicar `numberOfLines={1}` consistente (dungeon ya lo hace, otros no). **Dónde:** `gym.tsx:184`, `dieta.tsx:113`, `diario.tsx:147` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-065 · Slot derecho vacío como `View` de 24px: extraer constante
**Qué:** varias cabeceras usan `<View style={{ width: 24 }} />` para centrar (compra.tsx:60, diario.tsx:148, oraculo.tsx:123); centralizar en `ScreenHeader`. **Dónde:** citadas · **Impacto:** 2 · **Esfuerzo:** S

### NAV-066 · Gesto de retroceso (swipe) habilitado y coherente
**Qué:** verificar `gestureEnabled` en las pantallas stack para swipe-back iOS; declararlo explícito en opciones. **Dónde:** `_layout.tsx:36-41` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-067 · `fullScreenGestureEnabled` en iOS para módulos largos
**Qué:** permitir swipe-back desde cualquier punto en pantallas con scroll largo (gym, perfil). **Dónde:** `_layout.tsx` opciones · **Impacto:** 2 · **Esfuerzo:** S

### NAV-068 · Restaurar posición de scroll al volver
**Qué:** al volver de compra a dieta, el scroll se reinicia; preservar con estado. **Dónde:** `dieta.tsx:108` (ScrollView) · **Impacto:** 2 · **Esfuerzo:** M

### NAV-069 · `StatusBar` por pantalla si cambia el fondo
**Qué:** `StatusBar style="light"` es global (_layout.tsx:35); correcto para tema oscuro, pero documentar que ninguna pantalla lo invierte. **Dónde:** `_layout.tsx:35` · **Impacto:** 1 · **Esfuerzo:** S

### NAV-070 · `contentStyle` de fondo aplicado también a tabs
**Qué:** el Stack raíz fija `contentStyle.backgroundColor` (_layout.tsx:39); confirmar que el grupo `(tabs)` hereda y no hay flashes blancos entre transiciones. **Dónde:** `_layout.tsx:36-41` + `(tabs)/_layout.tsx` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-071 · Flash de fondo entre splash y primer render
**Qué:** `backgroundColor: "#060B16"` en app.json:10 e icon-bg coinciden; verificar que no hay frame blanco al ocultar splash con la pantalla de fuentes. **Dónde:** `app.json:10,44` + `_layout.tsx:29-31` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-072 · `safeAreaInsets` consistentes (edges)
**Qué:** todas las pantallas usan `SafeAreaView edges={['top']}`; confirmar que el bottom queda cubierto por la tab bar y que en módulos stack no se solapa con gestos del sistema. **Dónde:** todas las pantallas (`edges={['top']}`) · **Impacto:** 3 · **Esfuerzo:** S

### NAV-073 · Padding inferior para no chocar con gesto/nav bar de Android
**Qué:** en pantallas stack sin tab bar, el contenido inferior (`paddingBottom: 32`) puede quedar bajo la barra de navegación gestual; usar `useSafeAreaInsets().bottom`. **Dónde:** `gym.tsx:381`, `dungeon/[id].tsx:288`, etc. · **Impacto:** 3 · **Esfuerzo:** S

### NAV-074 · `KeyboardAvoidingView` ausente en pantallas con inputs largos
**Qué:** login y oraculo lo usan; diario (textarea, diario.tsx:174) y los modales con TextInput no, lo que puede tapar el campo con el teclado. **Dónde:** `diario.tsx:142`, modales de gym/mazmorras · **Impacto:** 3 · **Esfuerzo:** M

### NAV-075 · `keyboardShouldPersistTaps` consistente
**Qué:** login/compra/dieta-no/diario lo aplican de forma desigual; unificar para que tocar un botón con teclado abierto funcione siempre. **Dónde:** `login.tsx:60`, `compra.tsx:54`, `diario.tsx:142`, `dieta.tsx:108` (falta) · **Impacto:** 2 · **Esfuerzo:** S

### NAV-076 · Cerrar teclado al navegar
**Qué:** `Keyboard.dismiss()` antes de `router.push/back` en pantallas con inputs para evitar saltos visuales. **Dónde:** `oraculo.tsx:119`, `diario.tsx:144` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-077 · Transición de tab sin recarga completa
**Qué:** cada tab hace `load()` en focus; con `useFocusEffect` se recarga siempre. Considerar caché/stale-while-revalidate para que el cambio de pestaña sea instantáneo. **Dónde:** `(tabs)/index.tsx:82-86`, `mazmorras.tsx:58-62`, etc. · **Impacto:** 4 · **Esfuerzo:** L

### NAV-078 · Skeletons al cargar datos por primera vez
**Qué:** pantallas muestran vacío hasta que `load` resuelve; añadir skeletons temáticos en lugar de nada. **Dónde:** `(tabs)/index.tsx:208`, `mazmorras.tsx:92`, `perfil.tsx:179-181` · **Impacto:** 3 · **Esfuerzo:** M

### NAV-079 · `perfil.tsx` pantalla vacía mientras `!profile`
**Qué:** `if (!profile) return <SafeAreaView/>` (perfil.tsx:179-181) muestra blanco sin spinner; añadir indicador. **Dónde:** `perfil.tsx:179-181` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-080 · `(tabs)/index.tsx` sin estado de carga del perfil
**Qué:** mientras `profile === null` no se muestra el bloque (línea 208 condicional) pero tampoco un placeholder; el usuario ve sólo cabecera. **Dónde:** `(tabs)/index.tsx:208-245` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-081 · Pull-to-refresh sólo en Sistema
**Qué:** `RefreshControl` está en `(tabs)/index.tsx:199-201`; replicar en mazmorras/agenda/perfil para refresco manual consistente. **Dónde:** `mazmorras.tsx:84`, `agenda.tsx`, `perfil.tsx:191` · **Impacto:** 3 · **Esfuerzo:** M

### NAV-082 · Deep link a tab específica vía `/(tabs)/misiones`
**Qué:** ya se usa en oraculo.tsx:101; exponer y testear deep links a cada tab (`nivl://(tabs)/agenda`). **Dónde:** `oraculo.tsx:101` (referencia) · **Impacto:** 2 · **Esfuerzo:** S

### NAV-083 · Estado inicial de tab configurable
**Qué:** permitir que la app abra en una tab distinta (p. ej. "Misiones") según preferencia o notificación. **Dónde:** `(tabs)/_layout.tsx:21` + `index.tsx:17` · **Impacto:** 2 · **Esfuerzo:** M

### NAV-084 · `Redirect` con `href` tipado
**Qué:** `index.tsx:17` usa strings `'/(tabs)'` y `'/login'`; con typedRoutes están bien, pero envolver en constantes evita typos. **Dónde:** `index.tsx:17` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-085 · Constantes de ruta centralizadas
**Qué:** un `lib/routes.ts` con todas las rutas (`ROUTES.tabs`, `ROUTES.dungeon(id)`) para evitar strings repetidos y facilitar refactors. **Dónde:** consumidores en todos los `router.*` · **Impacto:** 3 · **Esfuerzo:** M

### NAV-086 · Test: la puerta `index.tsx` redirige según sesión
**Qué:** test unitario que verifique `<Redirect>` a `/(tabs)` con sesión y `/login` sin ella, y spinner en loading. **Dónde:** `index.tsx:6-18` · **Impacto:** 3 · **Esfuerzo:** M

### NAV-087 · Test: deep link a pantalla protegida sin sesión redirige
**Qué:** test de integración del guard (NAV-001) con `nivl://gym`. **Dónde:** `(tabs)/_layout.tsx` (futuro guard) · **Impacto:** 4 · **Esfuerzo:** M

### NAV-088 · Test: `dungeon/[id]` con id inexistente muestra "no encontrada"
**Qué:** cubrir NAV-008. **Dónde:** `dungeon/[id].tsx:54-62,148-150` · **Impacto:** 3 · **Esfuerzo:** M

### NAV-089 · Test: back con pila vacía no crashea
**Qué:** cubrir NAV-019 con una pantalla abierta por deep link directo. **Dónde:** helper `navBack` · **Impacto:** 3 · **Esfuerzo:** M

### NAV-090 · Test: cambio de pestaña dispara recarga (focus)
**Qué:** verificar `useFocusEffect` en cada tab. **Dónde:** `(tabs)/*.tsx` · **Impacto:** 2 · **Esfuerzo:** M

### NAV-091 · Test: logout limpia stack y redirige a login
**Qué:** cubrir NAV-039. **Dónde:** `perfil.tsx:174-177` · **Impacto:** 3 · **Esfuerzo:** M

### NAV-092 · Test: arranque con fuentes fallidas no bloquea
**Qué:** cubrir NAV-005. **Dónde:** `_layout.tsx:15-31` · **Impacto:** 3 · **Esfuerzo:** M

### NAV-093 · Rendimiento: `MODULES` fuera del render
**Qué:** ya está como constante a nivel módulo (correcto); confirmar que no se recrea. **Dónde:** `(tabs)/index.tsx:25-32` · **Impacto:** 1 · **Esfuerzo:** S

### NAV-094 · Rendimiento: memoizar handlers de navegación
**Qué:** `onPress={() => router.push(...)}` crea funciones nuevas por render en listas (mazmorras.tsx:103, índice de módulos); con React Compiler activo (`app.json:55`) puede ser innecesario, pero confirmar. **Dónde:** `mazmorras.tsx:103`, `(tabs)/index.tsx:321` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-095 · Rendimiento: evitar recarga total al volver de un módulo
**Qué:** volver del grid a Sistema dispara `load()` completo (varias queries); cachear lo invariante. **Dónde:** `(tabs)/index.tsx:49-80` · **Impacto:** 3 · **Esfuerzo:** L

### NAV-096 · Lazy de pantallas pesadas (oraculo con IA)
**Qué:** Oráculo importa lógica de IA; confirmar que no penaliza el arranque del grupo (expo-router ya hace code-split por archivo). **Dónde:** `oraculo.tsx:21` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-097 · Prefetch de la mazmorra al pulsar (optimista)
**Qué:** iniciar `fetchDungeon` en el `onPress` antes de montar la pantalla para reducir el blanco inicial. **Dónde:** `mazmorras.tsx:103` → `dungeon/[id].tsx:56` · **Impacto:** 3 · **Esfuerzo:** M

### NAV-098 · Animación de transición uniforme entre módulos
**Qué:** fijar la misma `animation` (p. ej. `slide_from_right`) para todas las pantallas stack y coherencia con la estética. **Dónde:** `_layout.tsx:36-41` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-099 · Modales como rutas (`presentation: 'modal'`) opcional
**Qué:** evaluar convertir formularios (nueva mazmorra, nuevo objetivo) en rutas modales de expo-router en vez de `Modal` RN, para back nativo y deep-linkability. **Dónde:** `mazmorras.tsx:140`, `dungeon/[id].tsx:241`, `gym.tsx:306,336` · **Impacto:** 3 · **Esfuerzo:** L

### NAV-100 · `agenda.tsx` sin navegación a detalle de tarea/mazmorra
**Qué:** la agenda lista tareas con due (agenda.tsx:24-26) pero, al tocarlas, no navega a su mazmorra. Añadir `router.push('/dungeon/[id]')`. **Dónde:** `agenda.tsx` (filas de `dueTasks`) · **Impacto:** 4 · **Esfuerzo:** M

### NAV-101 · `agenda.tsx` sin acceso rápido a "hoy" / scroll a fecha
**Qué:** con 14 días por delante, un botón "hoy" o ancla mejora navegación temporal. **Dónde:** `agenda.tsx:30` (DAYS_AHEAD) · **Impacto:** 2 · **Esfuerzo:** M

### NAV-102 · `informe.tsx` sin navegación desde el heatmap
**Qué:** tocar un día del heatmap podría llevar al diario/registro de ese día. **Dónde:** `informe.tsx:6` (Heatmap) · **Impacto:** 3 · **Esfuerzo:** M

### NAV-103 · `perfil.tsx` logros: enlazar a su origen
**Qué:** un logro de mazmorras podría enlazar a Mazmorras; hoy sólo muestra Alert (perfil.tsx:129-149). **Dónde:** `perfil.tsx:129-149` · **Impacto:** 2 · **Esfuerzo:** M

### NAV-104 · Breadcrumb/título de sección en tabs
**Qué:** cada tab dibuja su propio título (mazmorras.tsx:86, etc.); estandarizar un encabezado de tab reutilizable. **Dónde:** `mazmorras.tsx:85-90`, `(tabs)/index.tsx:203-206` · **Impacto:** 2 · **Esfuerzo:** M

### NAV-105 · Indicador de red/offline en navegación
**Qué:** muchas navegaciones disparan fetch; mostrar banner offline para explicar pantallas vacías. **Dónde:** `_layout.tsx` (global) · **Impacto:** 3 · **Esfuerzo:** L

### NAV-106 · Reintento de carga inline por pantalla
**Qué:** cuando `load()` falla (Alert genérico en todas), ofrecer botón "Reintentar" en la propia pantalla además del Alert. **Dónde:** `(tabs)/index.tsx:77-79`, `mazmorras.tsx:53-55`, etc. · **Impacto:** 4 · **Esfuerzo:** M

### NAV-107 · Centralizar el `Alert('Error del sistema')`
**Qué:** se repite en ~12 sitios; extraer a `lib` un `systemError(e)` para consistencia de copy y futura telemetría. **Dónde:** `gym.tsx:79`, `dieta.tsx:47`, `compra.tsx:24`, `diario.tsx:96`, `informe.tsx:28`, `mazmorras.tsx:54`, `(tabs)/index.tsx:78`, `dungeon/[id].tsx:60`, `perfil.tsx:75`, `oraculo.tsx:106` · **Impacto:** 3 · **Esfuerzo:** M

### NAV-108 · Deep link de recuperación de contraseña / magic link
**Qué:** si en el futuro se usan magic links de Supabase, el `scheme` debe manejar el callback de auth; previsión de ruta `/(auth)/callback`. **Dónde:** `app.json:8` + `login.tsx` · **Impacto:** 3 · **Esfuerzo:** L

### NAV-109 · `login.tsx` no limpia password al cambiar a registro
**Qué:** flujo de entrada/registro comparte campos; tras error, considerar foco y limpieza coherentes para no confundir navegación de formulario. **Dónde:** `login.tsx:24-52` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-110 · `login.tsx` sin recuperación de contraseña
**Qué:** falta enlace "¿Olvidaste tu contraseña?"; aunque sea un único usuario, evita bloqueo total. **Dónde:** `login.tsx:88-101` · **Impacto:** 3 · **Esfuerzo:** M

### NAV-111 · `returnKeyType`/`onSubmitEditing` para navegar entre campos de login
**Qué:** pasar de Correo a Contraseña con "next" y enviar con "go" mejora el flujo. **Dónde:** `login.tsx:66-83` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-112 · Bloqueo de orientación verificado
**Qué:** `orientation: "portrait"` (app.json:6) está bien; confirmar que ningún `Modal`/pantalla fuerza otra cosa. **Dónde:** `app.json:6` · **Impacto:** 1 · **Esfuerzo:** S

### NAV-113 · `userInterfaceStyle: "dark"` y tema del sistema
**Qué:** fijado a dark (app.json:9); documentar que la app no soporta claro para evitar incoherencias con componentes nativos (pickers, alerts). **Dónde:** `app.json:9` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-114 · Alerts nativos en tema oscuro
**Qué:** los muchos `Alert.alert` heredan estilo del SO; en algunos Android claros se ven fuera de tema. Evaluar un componente de diálogo propio del sistema. **Dónde:** uso global de `Alert` · **Impacto:** 3 · **Esfuerzo:** L

### NAV-115 · Confirmaciones destructivas coherentes
**Qué:** borrar mazmorra (dungeon/[id].tsx:133-146), día/ejercicio (gym), objetivo usan Alert; unificar patrón y copy de "el sistema". **Dónde:** `dungeon/[id].tsx:133-146,201-213`, `gym.tsx:258-276,281-293` · **Impacto:** 2 · **Esfuerzo:** M

### NAV-116 · Tras borrar mazmorra, navegación de retorno robusta
**Qué:** `removeDungeon` hace `router.back()` (dungeon/[id].tsx:142); si se llegó por deep link directo, usar fallback a `/(tabs)/mazmorras`. **Dónde:** `dungeon/[id].tsx:140-143` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-117 · Evitar volver a una mazmorra borrada en el historial
**Qué:** si otra pantalla en la pila apunta a la mazmorra borrada, al navegar atrás fallará la carga; invalidar/usar `dismissTo`. **Dónde:** `dungeon/[id].tsx:140-143` · **Impacto:** 3 · **Esfuerzo:** M

### NAV-118 · Manejo de `params` extra/no usados
**Qué:** `useLocalSearchParams<{ id: string }>` ignora cualquier otro param; documentar contrato de la ruta dinámica. **Dónde:** `dungeon/[id].tsx:41` · **Impacto:** 1 · **Esfuerzo:** S

### NAV-119 · `router.push` con objeto vs string: unificar estilo
**Qué:** conviven `router.push('/compra')` (string) y `router.push({ pathname, params })` (objeto); estandarizar para legibilidad. **Dónde:** `dieta.tsx:98,114` vs `mazmorras.tsx:71,103` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-120 · Telemetría de navegación
**Qué:** registrar transiciones de pantalla (pantalla origen/destino) para entender uso del grid escondido. **Dónde:** `_layout.tsx` (listener de estado de navegación) · **Impacto:** 3 · **Esfuerzo:** M

### NAV-121 · `screens`/`linking` config explícita para deep links
**Qué:** definir el mapa de `linking` (paths→rutas) para controlar exactamente qué URLs son válidas y cuáles caen en not-found. **Dónde:** `_layout.tsx` / config de router · **Impacto:** 3 · **Esfuerzo:** M

### NAV-122 · Validar `scheme` único y registrado en stores
**Qué:** confirmar que `nivl` no colisiona y documentar el universal link/app link si se quiere abrir desde web. **Dónde:** `app.json:8` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-123 · Android App Links (https) además del scheme custom
**Qué:** si se comparte el perfil (perfil.tsx:151-160), un App Link `https://nivl.app/...` daría apertura directa; hoy sólo hay scheme. **Dónde:** `app.json:18-27` + `perfil.tsx:151-160` · **Impacto:** 2 · **Esfuerzo:** L

### NAV-124 · iOS Associated Domains para deep links web
**Qué:** equivalente iOS de NAV-123. **Dónde:** `app.json:11-17` · **Impacto:** 2 · **Esfuerzo:** L

### NAV-125 · `getInitialURL` manejado en arranque en frío
**Qué:** asegurar que un deep link de arranque en frío espera al `AuthProvider` antes de resolver el destino (evita CRIT-NAV-01 en frío). **Dónde:** `_layout.tsx` + `auth.tsx` · **Impacto:** 4 · **Esfuerzo:** M

### NAV-126 · Cola de navegación post-login
**Qué:** si un deep link llega sin sesión, guardar el destino y, tras login, redirigir allí en lugar de a `/(tabs)`. **Dónde:** `auth.tsx` + `login.tsx:34` · **Impacto:** 3 · **Esfuerzo:** L

### NAV-127 · Indicador de "transición en curso"
**Qué:** deshabilitar toques durante una transición de pantalla para evitar dobles pushes (complementa NAV-059/060). **Dónde:** `_layout.tsx` (estado global) · **Impacto:** 2 · **Esfuerzo:** M

### NAV-128 · `headerShown:false` global: documentar que TODO header es manual
**Qué:** dejar claro que no hay headers nativos (_layout.tsx:38, (tabs)/_layout.tsx:10) y que cualquier título/back es responsabilidad de la pantalla. **Dónde:** `_layout.tsx:37-40`, `(tabs)/_layout.tsx:9-10` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-129 · Soporte de "volver al inicio" tocando la tab activa
**Qué:** tocar de nuevo la tab activa debería hacer scroll-to-top o pop-to-root del stack de esa tab. **Dónde:** `(tabs)/_layout.tsx:8` (listener `tabPress`) · **Impacto:** 3 · **Esfuerzo:** M

### NAV-130 · Animación/feedback al completar y volver
**Qué:** tras reclamar botín (dungeon/[id].tsx:120-123) se queda en la pantalla; ofrecer "volver a Mazmorras" en el Alert. **Dónde:** `dungeon/[id].tsx:120-123` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-131 · Manejo de `notification` recibida en foreground sin romper navegación
**Qué:** el handler muestra banner (notifications.ts:5-12); confirmar que no interfiere con modales/transiciones activas. **Dónde:** `notifications.ts:5-12` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-132 · Permisos de notificación: ruta a ajustes si se deniegan
**Qué:** si se deniega (notifications.ts:25 `return`), ofrecer `Linking.openSettings()` para reactivar y no perder el recordatorio diario. **Dónde:** `notifications.ts:24-25` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-133 · Estado de la app (AppState) y refresco al volver de background
**Qué:** además del focus de pantalla, refrescar la tab activa cuando la app vuelve de background (cambio de día a medianoche). **Dónde:** `(tabs)/index.tsx:82-86` + AppState · **Impacto:** 4 · **Esfuerzo:** M

### NAV-134 · Recalcular fecha al volver de background
**Qué:** `dateKey()` se fija al renderizar; si la app estuvo abierta cruzando medianoche, la navegación a Sistema debe recalcular "hoy". (Hay `useFocusEffect`, pero background→foreground sin cambiar de pantalla no lo dispara.) **Dónde:** `(tabs)/index.tsx:188` · **Impacto:** 4 · **Esfuerzo:** M

### NAV-135 · Deep link a "completar misión X"
**Qué:** notificación de la tarde podría enlazar directamente a la misión pendiente. **Dónde:** `notifications.ts:39-49` + `(tabs)/index.tsx` · **Impacto:** 3 · **Esfuerzo:** L

### NAV-136 · `Tabs` con `lazy` para no montar todas las pestañas a la vez
**Qué:** confirmar/forzar montaje perezoso de tabs para arranque más rápido. **Dónde:** `(tabs)/_layout.tsx:8` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-137 · `freezeOnBlur` en tabs para liberar recursos
**Qué:** evitar trabajo en tabs no visibles. **Dónde:** `(tabs)/_layout.tsx:9` (screenOptions) · **Impacto:** 2 · **Esfuerzo:** S

### NAV-138 · `sceneContainerStyle` de tabs con fondo de tema
**Qué:** fijar el fondo del contenedor de escenas de Tabs para evitar flashes. **Dónde:** `(tabs)/_layout.tsx:9-19` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-139 · Accesibilidad: tamaño de fuente del tab label fijo
**Qué:** `fontSize: 11` (tabs/_layout.tsx:18) no escala con ajustes de accesibilidad; permitir `allowFontScaling` o tamaño relativo. **Dónde:** `(tabs)/_layout.tsx:18` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-140 · Contraste del tab inactivo
**Qué:** `tabBarInactiveTintColor: colors.textFaint` (#56698A) sobre `tabBar` (#080E1B) puede quedar bajo en contraste; verificar AA. **Dónde:** `(tabs)/_layout.tsx:17` + `theme.ts:5,20` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-141 · Iconos de tab con relleno al activarse
**Qué:** usar variante sólida (sin `-outline`) en la tab activa para reforzar selección. **Dónde:** `(tabs)/_layout.tsx:25,41,49,57` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-142 · `dungeon/[id]` botón papelera con confirmación clara de alcance
**Qué:** el icono papelera (dungeon/[id].tsx:165) borra mazmorra entera; el `accessibilityLabel` y el copy deben dejar claro que no es "borrar tarea". **Dónde:** `dungeon/[id].tsx:165-167,133-146` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-143 · Salir de "modo entrenamiento" con back
**Qué:** en gym, `training=true` (gym.tsx:99) cambia la UI sin cambiar de ruta; el back de hardware sale de la pantalla en vez de cancelar el modo. Interceptar para cancelar primero. **Dónde:** `gym.tsx:90-100,143-145` · **Impacto:** 3 · **Esfuerzo:** M

### NAV-144 · Salir de "editar entrada" del diario con back
**Qué:** similar: estados internos (text/mood) sin ruta; back podría descartar cambios sin avisar. **Dónde:** `diario.tsx:106-138` · **Impacto:** 3 · **Esfuerzo:** M

### NAV-145 · Aviso de cambios sin guardar al navegar
**Qué:** en perfil (nombre), diario (texto), gym (lifts) el back puede perder datos no guardados; usar `beforeRemove`/confirmación. **Dónde:** `perfil.tsx:107-113`, `diario.tsx:106-138`, `gym.tsx:102-152` · **Impacto:** 3 · **Esfuerzo:** L

### NAV-146 · `oraculo.tsx` perder propuestas al volver
**Qué:** propuestas generadas (oraculo.tsx:31) se pierden si se navega atrás sin aceptar; avisar o persistir temporalmente. **Dónde:** `oraculo.tsx:31,103-104` · **Impacto:** 2 · **Esfuerzo:** M

### NAV-147 · Foco accesible al abrir pantalla
**Qué:** al entrar a un módulo, mover el foco del lector al título de cabecera para orientación. **Dónde:** `ScreenHeader` (NAV-018) · **Impacto:** 3 · **Esfuerzo:** M

### NAV-148 · Anunciar cambios de pantalla a lectores
**Qué:** `AccessibilityInfo.announceForAccessibility` al navegar a destinos clave. **Dónde:** `lib/nav.ts` (NAV-020) · **Impacto:** 2 · **Esfuerzo:** M

### NAV-149 · Orden de lectura del header (back→título→acción)
**Qué:** garantizar `accessibilityViewIsModal`/orden lógico en cabeceras con 3 elementos. **Dónde:** cabeceras de módulos (NAV-018) · **Impacto:** 2 · **Esfuerzo:** S

### NAV-150 · Test E2E del flujo completo de navegación
**Qué:** login → tabs → cada tab → cada módulo del grid → dungeon → back, en un solo recorrido automatizado. **Dónde:** suite e2e (Maestro/Detox) · **Impacto:** 4 · **Esfuerzo:** L

### NAV-151 · Test: notificación tocada abre la ruta correcta
**Qué:** cubrir NAV-016/017. **Dónde:** `notifications.ts` + handler · **Impacto:** 3 · **Esfuerzo:** M

### NAV-152 · Test: arranque en frío con deep link respeta auth
**Qué:** cubrir NAV-125. **Dónde:** `_layout.tsx` + `auth.tsx` · **Impacto:** 4 · **Esfuerzo:** L

### NAV-153 · Documentar el árbol de rutas en `docs/`
**Qué:** un diagrama del file-based routing (grupos, stack, dinámicas) para onboarding y para localizar el grid escondido. **Dónde:** `src/app/**` → `docs/` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-154 · Convención de nombres de ruta y archivos
**Qué:** estandarizar (todo minúsculas, español) y documentar; hoy es coherente, fijarlo evita drift. **Dónde:** `src/app/**` · **Impacto:** 1 · **Esfuerzo:** S

### NAV-155 · `index.tsx` (puerta) y `(tabs)/index.tsx` (Sistema) son confusos por nombre
**Qué:** dos `index.tsx` con propósitos distintos; añadir comentario de cabecera en cada uno aclarando rol (gate vs pantalla). **Dónde:** `index.tsx:1`, `(tabs)/index.tsx:34` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-156 · Evitar `router` importado donde se prefiere `useRouter()`
**Qué:** se usa el singleton `router` en módulos; en componentes, `useRouter()` es más testeable. Evaluar para pantallas con tests. **Dónde:** imports en todas las pantallas (`import { router } from 'expo-router'`) · **Impacto:** 2 · **Esfuerzo:** M

### NAV-157 · `Stack`/`Tabs` con `id` explícito para anidamiento futuro
**Qué:** al crecer el árbol, dar `id` a navegadores facilita `navigation.getParent()`. **Dónde:** `_layout.tsx:36`, `(tabs)/_layout.tsx:8` · **Impacto:** 1 · **Esfuerzo:** S

### NAV-158 · Manejar back en login (no debe salir de la app silenciosamente)
**Qué:** en login, el back de Android cierra la app; coherente, pero podría confirmarse o documentarse. **Dónde:** `login.tsx` · **Impacto:** 1 · **Esfuerzo:** S

### NAV-159 · `Redirect` evita parpadeo usando `Slot` mientras carga
**Qué:** considerar `Slot` + guard en `_layout.tsx` raíz en vez de la puerta `index.tsx`, para un arranque sin redirect visible. **Dónde:** `_layout.tsx:36-41` + `index.tsx` · **Impacto:** 3 · **Esfuerzo:** M

### NAV-160 · Persistir última pestaña visitada
**Qué:** al reabrir, volver a la última tab usada (si la sesión sigue) en vez de siempre Sistema. **Dónde:** `(tabs)/_layout.tsx` + almacenamiento · **Impacto:** 2 · **Esfuerzo:** M

### NAV-161 · Gesto de back accidental en pantallas con scroll horizontal
**Qué:** los chips/heatmap horizontales podrían entrar en conflicto con swipe-back; revisar `gestureResponseDistance`. **Dónde:** `informe.tsx` (Heatmap), `dieta.tsx:119` (dayChips) · **Impacto:** 2 · **Esfuerzo:** S

### NAV-162 · `compra.tsx` y `dieta.tsx`: navegación bidireccional sin duplicar pantallas
**Qué:** ir dieta→compra→(botón carrito no existe en compra para volver a dieta) puede dejar pila inconsistente; revisar. **Dónde:** `compra.tsx:55-60`, `dieta.tsx:114` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-163 · Indicar visualmente la pantalla "stack" vs "tab"
**Qué:** las pantallas de módulo (stack) tienen back; las tabs no. Un patrón visual consistente (color de cabecera) ayuda a ubicarse. **Dónde:** cabeceras de módulos vs tabs · **Impacto:** 2 · **Esfuerzo:** M

### NAV-164 · `dungeon/[id]` color de back distinto (purple) — coherencia
**Qué:** el back de dungeon usa `colors.purple` (dungeon/[id].tsx:160) y el resto `colors.cyan`; intencional por el tema mazmorra, pero documentarlo en `ScreenHeader` como variante. **Dónde:** `dungeon/[id].tsx:160` vs `gym.tsx:182` · **Impacto:** 1 · **Esfuerzo:** S

### NAV-165 · Evitar montar `LevelUpOverlay`/`XpToast` en cada pantalla
**Qué:** overlays de feedback (index, gym, dungeon, diario) se montan por pantalla; un overlay global evitaría perderlos al navegar a media animación. **Dónde:** `(tabs)/index.tsx:330-331`, `gym.tsx:374`, `dungeon/[id].tsx:281` · **Impacto:** 3 · **Esfuerzo:** L

### NAV-166 · Garantizar que el overlay de subida de nivel no bloquea el back
**Qué:** `LevelUpOverlay` (varias pantallas) debe cerrarse o no interceptar el gesto de retroceso. **Dónde:** `(tabs)/index.tsx:331`, `dungeon/[id].tsx:281` · **Impacto:** 3 · **Esfuerzo:** M

### NAV-167 · Manejo de enlaces externos (console.anthropic.com en Oráculo)
**Qué:** el copy menciona crear la key en consola (oraculo.tsx:58); añadir apertura con `Linking.openURL` en vez de pedir copiar a mano (navegación a externo). **Dónde:** `oraculo.tsx:56-60` · **Impacto:** 3 · **Esfuerzo:** S

### NAV-168 · `web.output: "single"` y rutas SPA
**Qué:** si se exporta a web (app.json:28-31), confirmar que el routing SPA maneja refresh en rutas profundas y el not-found. **Dónde:** `app.json:28-31` · **Impacto:** 2 · **Esfuerzo:** M

### NAV-169 · Comportamiento de back en web (history API)
**Qué:** en web, el back del navegador debe mapear a `router.back`; verificar con las pantallas stack. **Dónde:** `app.json:28-31` + módulos · **Impacto:** 2 · **Esfuerzo:** M

### NAV-170 · `informe.tsx` rango fijo de 91 días: navegación a periodos
**Qué:** `addDays(dateKey(), -91)` (informe.tsx:23) es fijo; permitir navegar entre meses/periodos. **Dónde:** `informe.tsx:23` · **Impacto:** 2 · **Esfuerzo:** M

### NAV-171 · Guardas de `userId` repetidas: helper `requireUser`
**Qué:** patrón `const userId = session?.user.id; if (!userId) return;` se repite en todas las pantallas; un hook `useUserId()` que garantice no-null bajo el guard de auth reduciría ruido y el riesgo de pantallas muertas. **Dónde:** `(tabs)/index.tsx:35-36`, `gym.tsx:51-52`, `perfil.tsx:46-47`, etc. · **Impacto:** 3 · **Esfuerzo:** M

### NAV-172 · Tipar `session` no-nula tras el guard
**Qué:** con un guard de grupo (NAV-001), las pantallas internas pueden asumir `session` no nula; exponer un `useSession()` que lo refleje en tipos y elimine los `?.`. **Dónde:** consumidores de `useAuth()` · **Impacto:** 3 · **Esfuerzo:** M

### NAV-173 · Evitar navegación mientras `busy`/guardando
**Qué:** en pantallas con `busy` (gym, diario, dungeon) deshabilitar back/cambio de tab durante operaciones críticas de XP para no dejar estado a medias. **Dónde:** `gym.tsx:103`, `diario.tsx:108`, `dungeon/[id].tsx:85,107` · **Impacto:** 3 · **Esfuerzo:** M

### NAV-174 · Animación de cabecera al hacer scroll (collapsing)
**Qué:** cabeceras grandes (perfil, Sistema) podrían colapsar al scrollear para ganar espacio. **Dónde:** `perfil.tsx:191`, `(tabs)/index.tsx:197` · **Impacto:** 2 · **Esfuerzo:** L

### NAV-175 · Indicador de pestaña con datos pendientes (agenda hoy)
**Qué:** badge/asterisco en Agenda si hay eventos/tareas vencen hoy. **Dónde:** `(tabs)/_layout.tsx:44-52` + `agenda.tsx` · **Impacto:** 3 · **Esfuerzo:** M

### NAV-176 · Manejo de rutas legadas/renombradas
**Qué:** si un módulo se renombra, viejos deep links/notificaciones deben redirigir; tabla de alias en `linking`. **Dónde:** config de `linking` (NAV-121) · **Impacto:** 2 · **Esfuerzo:** M

### NAV-177 · Limitar profundidad de pila (evitar push infinito)
**Qué:** dieta→compra→(si compra tuviera enlace a dieta)→… podría crecer; preferir `navigate` que reusa instancia existente. **Dónde:** `dieta.tsx:98,114` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-178 · `router.navigate` vs `push` para módulos del grid
**Qué:** usar `navigate` para que reabrir un módulo ya en pila no lo duplique. **Dónde:** `(tabs)/index.tsx:321` · **Impacto:** 2 · **Esfuerzo:** S

### NAV-179 · Pre-cargar fuentes críticas para acelerar primer render
**Qué:** las 5 fuentes bloquean el arranque (_layout.tsx:15-21); evaluar cargar primero las imprescindibles (brand/heading) y diferir el resto. **Dónde:** `_layout.tsx:15-21` · **Impacto:** 3 · **Esfuerzo:** M

### NAV-180 · Medir tiempo de arranque hasta primer frame interactivo
**Qué:** instrumentar el intervalo splash→tabs para detectar regresiones de arranque. **Dónde:** `_layout.tsx:23-31` + telemetría · **Impacto:** 2 · **Esfuerzo:** M

Total: 180 mejoras, 7 bugs.
