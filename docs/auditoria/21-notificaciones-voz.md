# Notificaciones y voz del sistema

> Área NOT · auditoría de código NIVL · anclada al código real

Archivos auditados: `src/lib/notifications.ts`, `src/lib/voice.ts`. Vecinos leídos para anclar hallazgos: `src/app/(tabs)/index.tsx` (único llamador de `ensureDailyNotifications`), `src/app/gym.tsx`, `src/components/LevelUpOverlay.tsx`, `src/app/dungeon/[id].tsx`, `app.json`, `src/lib/types.ts`, `src/lib/dates.ts`, `src/lib/theme.ts`, `README.md`.

Estado actual en una frase: dos `scheduleNotificationAsync` DAILY fijos (8:00 y 21:30) con cuerpo elegido por `Math.random()` en el momento de programar; un solo canal Android creado con id `'default'`; sin `channelId` en los disparadores; sin listener de respuesta; sin acciones; sin recordatorios por misión; sin resumen semanal; sin aviso de racha en riesgo; permisos pedidos sin comprobación previa; rescheduling completo en cada montaje de la pestaña Sistema.

## Bugs y riesgos

### CRIT-NOT-01 · El cuerpo de la notificación se congela al programar y se repite a diario — `notifications.ts:31,42` · severidad alta
**Problema:** `voice.morningNotif()` y `voice.eveningNotif()` se evalúan **una sola vez**, en el instante en que se programa el DAILY trigger. `expo-notifications` guarda ese string y lo reutiliza cada día hasta que se reprograme. El usuario verá literalmente el MISMO texto a las 8:00 todos los días (y el mismo a las 21:30) durante días o semanas, a pesar de que `voice.ts` tiene 3 variantes por cada uno. El `pick()` aleatorio no aporta variedad temporal: solo decide qué frase queda fija. Es el efecto contrario al objetivo de "banco de copy más rico" y refuerza la sensación de bot.
**Arreglo:** No confiar en un cuerpo estático para algo recurrente. Opciones: (a) programar N notificaciones DAILY no a diario sino como cola de fechas concretas (`type: DATE`) precomputando 14-30 días con un `pick()` distinto por día, y refrescar la cola en cada arranque; o (b) mantener DAILY pero reprogramar el cuerpo en cada `useFocusEffect`/arranque con una frase nueva (mitiga, no elimina, porque entre aperturas se repite). La opción (a) es la correcta para variedad real.

### CRIT-NOT-02 · Las notificaciones programadas no usan el canal creado (Android) — `notifications.ts:19-23,28-49` · severidad alta
**Problema:** se crea el canal con id `'default'` y nombre `'El sistema'` (línea 19), pero ninguna de las dos llamadas a `scheduleNotificationAsync` pasa `content.channelId` (ni `trigger.channelId` según versión). En Android, si no se especifica canal, expo-notifications publica en el canal "Default" autogenerado por el plugin, **no** en el que acabas de configurar. Resultado: la importancia/personalización del canal `'El sistema'` se ignora, y queda un canal "El sistema" huérfano y vacío en los ajustes del sistema, confuso para el usuario. Además `AndroidImportance.DEFAULT` no hace heads-up ni sonido, con lo que el aviso de cierre de las 21:30 (crítico, hay penalización) pasa fácilmente desapercibido.
**Arreglo:** pasar `channelId: 'default'` en el `content` de cada `scheduleNotificationAsync`. Mejor aún: separar en dos canales (`mañana` importancia DEFAULT, `cierre` importancia HIGH con sonido/vibración) y asignar cada notificación al suyo.

### CRIT-NOT-03 · El handler global silencia incluso el aviso de cierre, que es accionable y urgente — `notifications.ts:5-12` · severidad media
**Problema:** `setNotificationHandler` fija `shouldPlaySound: false` y `shouldSetBadge: false` para TODAS las notificaciones, sin discriminar. El aviso de las 21:30 advierte de una penalización inminente de XP (irreversible a medianoche); entregarlo en silencio y sin badge reduce drásticamente su utilidad. No hay forma de que una notificación concreta pida sonido porque la decisión está centralizada y hardcodeada.
**Arreglo:** decidir en `handleNotification` según `notification.request.content.data` (p. ej. `data.kind === 'closing'` → `shouldPlaySound: true`). Pasar ese `data` al programar. Mantener silencio para la de la mañana si se prefiere.

### CRIT-NOT-04 · `ensureDailyNotifications` cancela y reprograma TODO en cada montaje de la pestaña Sistema — `index.tsx:88-90` + `notifications.ts:27` · severidad media
**Problema:** el `useEffect(() => { ensureDailyNotifications(); }, [])` se ejecuta cada vez que la pantalla Sistema se monta (no solo al arrancar la app: expo-router puede montar/desmontar pestañas). Dentro, `cancelAllScheduledNotificationsAsync()` borra **todas** las notificaciones programadas y vuelve a crear las dos diarias. Esto (a) destruiría cualquier recordatorio por misión o resumen semanal que se añada en el futuro, (b) es trabajo redundante de E/S nativa repetido, y (c) si dos montajes se solapan (navegación rápida) hay una carrera entre cancelar y reprogramar que puede dejar 0, 2 o 4 notificaciones según el entrelazado. La promesa además no se `await`ea ni se captura: un rechazo es un unhandled promise rejection.
**Arreglo:** ejecutar una sola vez por sesión de app (mover a `_layout` raíz o a un flag de módulo `let bootstrapped = false`). No usar `cancelAll`: usar `getAllScheduledNotificationsAsync()` y reprogramar solo si faltan/cambian, o cancelar por identificador propio. Capturar el rechazo.

### CRIT-NOT-05 · `requestPermissionsAsync` se llama sin comprobar el estado previo; en denegación permanente no hay recuperación — `notifications.ts:24-25` · severidad media
**Problema:** se llama directamente a `requestPermissionsAsync()` en cada arranque. Tras la primera denegación, en iOS el SO ya no muestra el diálogo (devuelve `denied` sin preguntar) y en Android 13+ igual pasados los intentos; el código simplemente hace `return` silencioso (línea 25) y el usuario queda sin notificaciones para siempre, sin enterarse ni poder reactivarlas desde la app. Tampoco se distingue `granted` de `provisional` (iOS) ni se ofrece abrir ajustes.
**Arreglo:** primero `getPermissionsAsync()`; si `status === 'undetermined'` pedir; si `denied` y `canAskAgain === false`, exponer en Perfil un aviso "Notificaciones desactivadas" con botón a `Linking.openSettings()`. No tragarse el `return` en silencio.

## Mejoras

### NOT-001 · Pasar `channelId` explícito a cada notificación programada
**Qué:** añadir `channelId: 'default'` (o el canal específico) en el `content` de ambos `scheduleNotificationAsync`. **Dónde:** `notifications.ts:28-38,39-49` · **Impacto:** 4 · **Esfuerzo:** S

### NOT-002 · Separar canales Android por tipo (mañana vs cierre)
**Qué:** crear `nivl-morning` (DEFAULT) y `nivl-closing` (HIGH, con sonido y vibración) en vez de un único `'default'`. **Dónde:** `notifications.ts:18-23` · **Impacto:** 4 · **Esfuerzo:** M

### NOT-003 · Nombrar el canal con la voz del sistema y descripción
**Qué:** añadir `description` al canal ("Avisos del sistema: misiones y cierre del día") y un nombre coherente con el copy. **Dónde:** `notifications.ts:19-22` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-004 · Definir `lightColor`/`vibrationPattern` del canal con la paleta NIVL
**Qué:** usar `colors.cyan` como `lightColor` y un patrón de vibración corto para el cierre. **Dónde:** `notifications.ts:19-22` + `theme.ts:7` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-005 · Decidir sonido/badge por notificación en el handler
**Qué:** leer `notification.request.content.data.kind` y devolver `shouldPlaySound`/`shouldSetBadge` en consecuencia. **Dónde:** `notifications.ts:5-12` · **Impacto:** 3 · **Esfuerzo:** S

### NOT-006 · Adjuntar `data` con `kind` a cada notificación
**Qué:** `content.data = { kind: 'morning' | 'closing' }` para que handler y listener sepan qué es. **Dónde:** `notifications.ts:29-32,40-43` · **Impacto:** 3 · **Esfuerzo:** S

### NOT-007 · Comprobar permiso con `getPermissionsAsync` antes de pedirlo
**Qué:** no spamear el diálogo; pedir solo si `undetermined`. **Dónde:** `notifications.ts:24` · **Impacto:** 3 · **Esfuerzo:** S

### NOT-008 · Gestionar denegación permanente con enlace a ajustes
**Qué:** si `denied && !canAskAgain`, persistir flag y mostrar CTA a `Linking.openSettings()` en Perfil. **Dónde:** `notifications.ts:25` · **Impacto:** 4 · **Esfuerzo:** M

### NOT-009 · No tragarse el `return` de permiso denegado en silencio
**Qué:** devolver/loguear un estado (`'denied'`) para que la UI pueda reaccionar. **Dónde:** `notifications.ts:25` · **Impacto:** 3 · **Esfuerzo:** S

### NOT-010 · Capturar el rechazo de `ensureDailyNotifications` en el llamador
**Qué:** `ensureDailyNotifications().catch(() => {})` o `void`; hoy es promesa colgante. **Dónde:** `index.tsx:88-90` · **Impacto:** 3 · **Esfuerzo:** S

### NOT-011 · Bootstrapping una sola vez por sesión, no por montaje de pestaña
**Qué:** mover la inicialización al `_layout` raíz o guard con flag de módulo. **Dónde:** `index.tsx:88-90` · **Impacto:** 4 · **Esfuerzo:** M

### NOT-012 · Sustituir `cancelAllScheduledNotificationsAsync` por reprogramación selectiva
**Qué:** cancelar por identificador propio o leer `getAllScheduledNotificationsAsync` y solo reponer lo que falte. **Dónde:** `notifications.ts:27` · **Impacto:** 4 · **Esfuerzo:** M

### NOT-013 · Asignar identificadores estables a las notificaciones programadas
**Qué:** `identifier: 'daily-morning'` / `'daily-closing'` para poder gestionarlas individualmente. **Dónde:** `notifications.ts:28,39` · **Impacto:** 3 · **Esfuerzo:** S

### NOT-014 · Refrescar el cuerpo con un `pick()` nuevo en cada arranque
**Qué:** dado que el cuerpo se congela (CRIT-NOT-01), reprogramar con frase nueva al abrir la app mitiga la repetición. **Dónde:** `notifications.ts:31,42` · **Impacto:** 4 · **Esfuerzo:** S

### NOT-015 · Cola de fechas concretas para variedad real de copy
**Qué:** precomputar 14-30 disparos `type: DATE` con frase distinta por día en lugar de un único DAILY. **Dónde:** `notifications.ts:33-37,44-48` · **Impacto:** 4 · **Esfuerzo:** L

### NOT-016 · Listener `addNotificationResponseReceivedListener` para enrutar al tocar
**Qué:** al tocar la de la mañana → navegar a Misiones; la de la tarde → a Sistema. Hoy no existe ningún listener. **Dónde:** nuevo en `notifications.ts` / `_layout` · **Impacto:** 4 · **Esfuerzo:** M

### NOT-017 · Deep-link de la notificación de cierre a la pestaña Sistema
**Qué:** `data.route = '/'` y `router.replace(route)` en el listener. **Dónde:** `notifications.ts:39-49` + listener · **Impacto:** 3 · **Esfuerzo:** M

### NOT-018 · Categoría con acción "Completar" desde la notificación
**Qué:** `setNotificationCategoryAsync` con botón que abra el flujo de completar misión sin entrar a navegar. **Dónde:** nuevo en `notifications.ts` · **Impacto:** 4 · **Esfuerzo:** L

### NOT-019 · Categoría con acción "Posponer 1 h" en el aviso de cierre
**Qué:** acción que reprograme un recordatorio puntual a +1 h. **Dónde:** nuevo en `notifications.ts` · **Impacto:** 3 · **Esfuerzo:** M

### NOT-020 · `categoryIdentifier` en el `content` para enlazar acciones
**Qué:** asociar cada notificación a su categoría de acciones. **Dónde:** `notifications.ts:29-32,40-43` · **Impacto:** 3 · **Esfuerzo:** S

### NOT-021 · Aviso de racha en riesgo al anochecer
**Qué:** si quedan misiones obligatorias sin completar y la racha > 0, notificación "Tu racha de N días está en peligro". Requiere leer estado del día. **Dónde:** nuevo en `notifications.ts` + `voice.ts` · **Impacto:** 5 · **Esfuerzo:** L

### NOT-022 · Función `voice.streakAtRisk(days)` en el banco de copy
**Qué:** añadir variantes ("Tu racha de ${days} días arde. Apágalo o piérdela."). Hoy `voice.ts` no tiene nada de racha. **Dónde:** `voice.ts:7-72` · **Impacto:** 4 · **Esfuerzo:** S

### NOT-023 · Resumen semanal (domingo noche) con balance de XP y rachas
**Qué:** notificación semanal `type: WEEKLY` con cierre de la semana. **Dónde:** nuevo en `notifications.ts` · **Impacto:** 4 · **Esfuerzo:** L

### NOT-024 · Función `voice.weeklySummary(xp, completed)` en el banco
**Qué:** copy del resumen semanal con la voz del sistema. **Dónde:** `voice.ts:7-72` · **Impacto:** 3 · **Esfuerzo:** S

### NOT-025 · Recordatorios por misión usando su día de la semana
**Qué:** `Quest.days_of_week` ya existe; programar avisos solo los días que toca. **Dónde:** nuevo en `notifications.ts` + `types.ts:32` · **Impacto:** 4 · **Esfuerzo:** L

### NOT-026 · Hora configurable por misión para el recordatorio
**Qué:** `Quest` no tiene hora; `CalendarEvent.time` sí. Añadir hora opcional a misión o reutilizar agenda para programar a esa hora. **Dónde:** `types.ts:26-39` + `notifications.ts` · **Impacto:** 3 · **Esfuerzo:** L

### NOT-027 · Recordatorios de eventos de agenda con `CalendarEvent.time`
**Qué:** programar una notificación a la hora del evento del calendario. **Dónde:** `types.ts:77-85` + nuevo en `notifications.ts` · **Impacto:** 4 · **Esfuerzo:** L

### NOT-028 · Recordatorio de deadline de mazmorra
**Qué:** `Dungeon.deadline` existe; avisar el día anterior / mismo día. **Dónde:** `types.ts:58` + `notifications.ts` · **Impacto:** 3 · **Esfuerzo:** M

### NOT-029 · No programar avisos diarios mientras el sistema está en pausa
**Qué:** si `profile.freeze_until` cubre hoy, suprimir morning/closing (coherente con "sin juicio"). **Dónde:** `notifications.ts` + `types.ts:20-21` · **Impacto:** 4 · **Esfuerzo:** M

### NOT-030 · Reanudar avisos automáticamente al expirar la congelación
**Qué:** reprogramar al detectar `freeze_until` vencido. **Dónde:** `notifications.ts` · **Impacto:** 3 · **Esfuerzo:** M

### NOT-031 · No avisar de "nuevas misiones" si no hay misiones para hoy
**Qué:** si ninguna misión activa toca hoy, omitir la de las 8:00. **Dónde:** `notifications.ts:28-38` · **Impacto:** 3 · **Esfuerzo:** M

### NOT-032 · Timing contextual del aviso de cierre según hora local real
**Qué:** 21:30 es fijo; permitir adelantar/atrasar o derivar de hábitos. **Dónde:** `notifications.ts:46-48` · **Impacto:** 3 · **Esfuerzo:** M

### NOT-033 · Hora de la mañana configurable por el usuario
**Qué:** exponer en Perfil la hora del aviso de misiones (8:00 hardcoded). **Dónde:** `notifications.ts:35-36` · **Impacto:** 3 · **Esfuerzo:** M

### NOT-034 · Interruptor maestro de notificaciones en Perfil
**Qué:** permitir desactivar todas sin tocar ajustes del SO. **Dónde:** nuevo en `notifications.ts` + Perfil · **Impacto:** 3 · **Esfuerzo:** M

### NOT-035 · Persistir preferencias de notificación (AsyncStorage)
**Qué:** guardar horas/toggles elegidos por el usuario. **Dónde:** nuevo módulo + `notifications.ts` · **Impacto:** 3 · **Esfuerzo:** M

### NOT-036 · Suprimir aviso de cierre si el día ya está cerrado/completado
**Qué:** si todas las misiones del día están hechas, cancelar el de 21:30 de hoy. **Dónde:** `notifications.ts` · **Impacto:** 4 · **Esfuerzo:** M

### NOT-037 · Notificación inmediata de subida de nivel (opcional, fuera de app)
**Qué:** `voice.levelUp()` solo se ve en overlay; ofrecer también notificación si el level-up ocurre en background. **Dónde:** `voice.ts:16` + `notifications.ts` · **Impacto:** 2 · **Esfuerzo:** M

### NOT-038 · Ampliar banco `morningNotif` (hoy solo 3 frases)
**Qué:** subir a 8-12 variantes para reducir repetición percibida. **Dónde:** `voice.ts:44-49` · **Impacto:** 3 · **Esfuerzo:** S

### NOT-039 · Ampliar banco `eveningNotif` (hoy solo 3 frases)
**Qué:** subir a 8-12 variantes. **Dónde:** `voice.ts:50-55` · **Impacto:** 3 · **Esfuerzo:** S

### NOT-040 · Variantes de copy según contexto (con/sin misiones pendientes)
**Qué:** dos bancos de cierre: "te queda X pendiente" vs "vas bien". **Dónde:** `voice.ts:50-55` · **Impacto:** 3 · **Esfuerzo:** M

### NOT-041 · Variantes de copy según la hora real de entrega
**Qué:** mañana temprano vs media mañana → tono distinto. **Dónde:** `voice.ts:44-49` · **Impacto:** 2 · **Esfuerzo:** M

### NOT-042 · `pick()` sin repetición inmediata (evitar misma frase dos veces seguidas)
**Qué:** recordar el último índice elegido por categoría y excluirlo. **Dónde:** `voice.ts:4-6` · **Impacto:** 3 · **Esfuerzo:** S

### NOT-043 · `pick()` con semilla por fecha para variedad determinista diaria
**Qué:** índice = hash(dateKey) % n, así cada día sale una frase distinta y estable. **Dónde:** `voice.ts:4-6` + `dates.ts:11` · **Impacto:** 3 · **Esfuerzo:** M

### NOT-044 · `pick()` defensivo ante array vacío sin doble fallback redundante
**Qué:** `lines[idx] ?? lines[0] ?? ''` ya cubre, pero con array vacío `Math.floor(random*0)=0` y `lines[0]` es undefined → cae a `''`; documentar/simplificar el invariante. **Dónde:** `voice.ts:4-6` · **Impacto:** 1 · **Esfuerzo:** S

### NOT-045 · Tipar las claves de `voice` para autocompletado y refactor seguro
**Qué:** exponer `type VoiceKey = keyof typeof voice` para usos genéricos. **Dónde:** `voice.ts:8-72` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-046 · Centralizar el copy de notificaciones en `voice` (títulos incluidos)
**Qué:** los títulos "Nuevas misiones diarias" y "El cierre del día se acerca" están hardcodeados en `notifications.ts`, fuera del banco de voz. Moverlos a `voice.ts`. **Dónde:** `notifications.ts:30,41` · **Impacto:** 3 · **Esfuerzo:** S

### NOT-047 · Variantes para los títulos de notificación
**Qué:** una vez en `voice`, dar 3-4 variantes de título por tipo. **Dónde:** `notifications.ts:30,41` → `voice.ts` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-048 · Subtítulo (iOS) con la voz del sistema
**Qué:** `content.subtitle` para jerarquía visual en iOS. **Dónde:** `notifications.ts:29-32,40-43` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-049 · `interruptionLevel` en iOS para el aviso de cierre
**Qué:** `interruptionLevel: 'time-sensitive'` para que rompa el modo concentración cuando hay penalización inminente. **Dónde:** `notifications.ts:40-43` · **Impacto:** 3 · **Esfuerzo:** S

### NOT-050 · Sonido propio del sistema (asset corto) para el cierre
**Qué:** sonido temático en lugar del default silenciado. **Dónde:** `notifications.ts:5-12` + asset · **Impacto:** 2 · **Esfuerzo:** M

### NOT-051 · Badge con número de misiones pendientes
**Qué:** `shouldSetBadge` + `setBadgeCountAsync(pendientes)`. **Dónde:** `notifications.ts:10` · **Impacto:** 3 · **Esfuerzo:** M

### NOT-052 · Limpiar el badge al abrir la app
**Qué:** `setBadgeCountAsync(0)` en el arranque/focus de Sistema. **Dónde:** `index.tsx` + `notifications.ts` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-053 · `dismissAllNotificationsAsync` al abrir la app
**Qué:** retirar de la bandeja avisos ya atendidos al entrar. **Dónde:** nuevo en `notifications.ts` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-054 · Manejar el caso de apertura en frío desde notificación
**Qué:** `getLastNotificationResponseAsync()` al arrancar para enrutar si la app se abrió tocando una notificación. **Dónde:** nuevo en `_layout` / `notifications.ts` · **Impacto:** 3 · **Esfuerzo:** M

### NOT-055 · Quitar el listener de respuesta al desmontar
**Qué:** cuando se añada (NOT-016), guardar la suscripción y `remove()` en cleanup para no fugar. **Dónde:** listener nuevo · **Impacto:** 3 · **Esfuerzo:** S

### NOT-056 · Tipar el payload `data` de las notificaciones
**Qué:** `type NotifData = { kind: 'morning'|'closing'|'quest'|'weekly'; route?: string }`. **Dónde:** `notifications.ts` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-057 · Extraer constantes de hora/minuto (8/0, 21/30) a config
**Qué:** evitar números mágicos repartidos; centralizar en un objeto `SCHEDULE`. **Dónde:** `notifications.ts:36-37,47-48` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-058 · Devolver un resultado tipado de `ensureDailyNotifications`
**Qué:** que retorne `{ scheduled: boolean; permission: PermissionStatus }` en vez de `void`. **Dónde:** `notifications.ts:16` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-059 · No tragar TODOS los errores en el `catch` vacío
**Qué:** el `catch {}` (línea 50) oculta también errores reales (no solo "Expo Go"). Loguear en `__DEV__`. **Dónde:** `notifications.ts:50-52` · **Impacto:** 3 · **Esfuerzo:** S

### NOT-060 · Distinguir "Expo Go no soporta" de "fallo real" en el catch
**Qué:** comprobar `Constants.appOwnership === 'expo'` para decidir si ignorar. **Dónde:** `notifications.ts:50-52` · **Impacto:** 2 · **Esfuerzo:** M

### NOT-061 · Avisar una vez al usuario de que en Expo Go no hay notificaciones
**Qué:** mostrar un hint discreto (no en cada arranque) cuando se detecta Expo Go. **Dónde:** `notifications.ts:50-52` + Perfil · **Impacto:** 2 · **Esfuerzo:** M

### NOT-062 · Función de prueba "Enviar notificación de ejemplo" en Perfil
**Qué:** `scheduleNotificationAsync` con trigger nulo para que el usuario verifique permisos/canal. **Dónde:** nuevo en `notifications.ts` + Perfil · **Impacto:** 2 · **Esfuerzo:** S

### NOT-063 · Reprogramar al cambiar de zona horaria / horario de verano
**Qué:** los DAILY pueden desfasar con DST; reevaluar al volver a foco. **Dónde:** `notifications.ts` · **Impacto:** 2 · **Esfuerzo:** M

### NOT-064 · Reprogramar al cambiar la fecha del dispositivo
**Qué:** suscribirse a cambios de día/medianoche para refrescar la cola. **Dónde:** `notifications.ts` · **Impacto:** 2 · **Esfuerzo:** M

### NOT-065 · Coalescer reprogramaciones (debounce) ante focos rápidos
**Qué:** si se llama varias veces seguidas, ejecutar solo una. **Dónde:** `notifications.ts:16` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-066 · Evitar `requestPermissionsAsync` en cada arranque por rendimiento
**Qué:** cachear el `status` en memoria/AsyncStorage tras concederlo. **Dónde:** `notifications.ts:24` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-067 · Opciones de permiso iOS explícitas (alert/badge/sound)
**Qué:** `requestPermissionsAsync({ ios: { allowAlert, allowBadge, allowSound } })`. **Dónde:** `notifications.ts:24` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-068 · Soportar permiso provisional (iOS) sin pedir intrusivamente
**Qué:** `allowProvisional: true` para entregar en bandeja silenciosa sin diálogo. **Dónde:** `notifications.ts:24` · **Impacto:** 2 · **Esfuerzo:** M

### NOT-069 · Mensaje de contexto antes de pedir permiso (pre-prompt)
**Qué:** pantalla breve explicando el porqué antes del diálogo del SO, para subir tasa de aceptación. **Dónde:** nuevo + `notifications.ts:24` · **Impacto:** 4 · **Esfuerzo:** M

### NOT-070 · No pedir permiso en el primer arranque/onboarding bruto
**Qué:** diferir la petición hasta que el usuario haya creado misiones (momento con valor). **Dónde:** `index.tsx:88-90` · **Impacto:** 3 · **Esfuerzo:** M

### NOT-071 · Estado de notificaciones visible en Perfil
**Qué:** mostrar "Notificaciones: activas / desactivadas / sin soporte". **Dónde:** Perfil + `notifications.ts:58` · **Impacto:** 3 · **Esfuerzo:** M

### NOT-072 · Listar notificaciones programadas para depurar (dev)
**Qué:** pantalla de debug que vuelque `getAllScheduledNotificationsAsync`. **Dónde:** nuevo · **Impacto:** 1 · **Esfuerzo:** S

### NOT-073 · Test unitario de `pick()` (rango de índice, array vacío)
**Qué:** asegurar que nunca devuelve `undefined` y respeta límites. **Dónde:** `voice.ts:4-6` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-074 · Test de que cada función de `voice` devuelve string no vacío
**Qué:** recorrer todas las claves y validar salida. **Dónde:** `voice.ts:8-72` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-075 · Test de interpolación de `penaltyApplied`/`pr`/`dungeonCleared`/`frozen`
**Qué:** verificar que el parámetro aparece en la frase devuelta. **Dónde:** `voice.ts:23,39,56,61` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-076 · Inyectar el RNG en `pick()` para tests deterministas
**Qué:** `pick(lines, rng = Math.random)` para fijar la salida en tests. **Dónde:** `voice.ts:4` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-077 · Test de `ensureDailyNotifications` con expo-notifications mockeado
**Qué:** verificar que programa 2, pide permiso y respeta denegación. **Dónde:** `notifications.ts:16` · **Impacto:** 3 · **Esfuerzo:** M

### NOT-078 · Test de que `channelId` se pasa en cada schedule (regresión CRIT-NOT-02)
**Qué:** fijar el bug con un test. **Dónde:** `notifications.ts:28-49` · **Impacto:** 3 · **Esfuerzo:** S

### NOT-079 · Test de idempotencia (llamar dos veces no duplica notificaciones)
**Qué:** asegurar que tras dos llamadas hay exactamente 2 programadas. **Dónde:** `notifications.ts:16` · **Impacto:** 3 · **Esfuerzo:** M

### NOT-080 · Test del handler (sonido/badge según `data.kind`)
**Qué:** cuando se implemente NOT-005, fijar el comportamiento. **Dónde:** `notifications.ts:5-12` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-081 · Extraer la lógica de programación a función pura testeable
**Qué:** separar "qué programar" (datos) de "programarlo" (efecto nativo), como hace `closing.ts`. **Dónde:** `notifications.ts:16-53` · **Impacto:** 3 · **Esfuerzo:** M

### NOT-082 · Documentar con JSDoc el contrato de `ensureDailyNotifications`
**Qué:** efectos, idempotencia, requisitos de permiso. **Dónde:** `notifications.ts:16` · **Impacto:** 1 · **Esfuerzo:** S

### NOT-083 · Comentario sobre por qué el cuerpo se fija al programar (CRIT-NOT-01)
**Qué:** dejar constancia para que nadie asuma que `pick()` varía a diario. **Dónde:** `notifications.ts:31` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-084 · Mover `setNotificationHandler` fuera del top-level del módulo
**Qué:** hoy se ejecuta como efecto secundario al importar; mejor en bootstrap explícito para controlar el orden. **Dónde:** `notifications.ts:5-12` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-085 · Evitar `import './voice'` con efectos; `voice` es puro (ok) pero documentarlo
**Qué:** confirmar que importar `voice` no dispara side-effects (no los tiene). **Dónde:** `notifications.ts:3` · **Impacto:** 1 · **Esfuerzo:** S

### NOT-086 · Internacionalización futura del banco de voz
**Qué:** estructurar `voice` para soportar otra lengua sin reescribir llamadas. **Dónde:** `voice.ts:8-72` · **Impacto:** 1 · **Esfuerzo:** L

### NOT-087 · Constante de probabilidad/`weights` por frase (algunas más raras)
**Qué:** permitir frases "raras" con menor peso para sorpresa ocasional. **Dónde:** `voice.ts:4-6` · **Impacto:** 1 · **Esfuerzo:** M

### NOT-088 · Frases de hito (racha de 7/30/100) en notificación
**Qué:** copy especial cuando la racha cruza umbrales. **Dónde:** `voice.ts` + `notifications.ts` · **Impacto:** 3 · **Esfuerzo:** M

### NOT-089 · Notificación de "Piedra de Protección consumida" en background
**Qué:** si el cierre gasta una piedra mientras la app está cerrada, avisar. **Dónde:** `voice.ts:29-33` + `notifications.ts` · **Impacto:** 3 · **Esfuerzo:** M

### NOT-090 · Notificación de "Piedra forjada" tras semana impecable
**Qué:** entregar `voice.stoneEarned()` como notificación, no solo en pantalla. **Dónde:** `voice.ts:34-38` + `notifications.ts` · **Impacto:** 2 · **Esfuerzo:** M

### NOT-091 · Notificación de penalización aplicada en el cierre automático
**Qué:** `voice.penaltyApplied(xp)` también como aviso si el cierre ocurre sin la app abierta. **Dónde:** `voice.ts:23-28` + `notifications.ts` · **Impacto:** 3 · **Esfuerzo:** M

### NOT-092 · Notificación de mazmorra despejada (refuerzo)
**Qué:** `voice.dungeonCleared(title)` como notificación opcional. **Dónde:** `voice.ts:56-60` + `notifications.ts` · **Impacto:** 2 · **Esfuerzo:** M

### NOT-093 · Notificación de logro desbloqueado
**Qué:** `voice.achievement()` fuera de la app cuando se desbloquea en background. **Dónde:** `voice.ts:66-71` + `notifications.ts` · **Impacto:** 2 · **Esfuerzo:** M

### NOT-094 · Agrupar notificaciones relacionadas (Android `groupKey`)
**Qué:** agrupar avisos del mismo tipo para no saturar la bandeja. **Dónde:** `notifications.ts` · **Impacto:** 2 · **Esfuerzo:** M

### NOT-095 · `threadIdentifier` (iOS) para agrupar por tema
**Qué:** equivalente iOS del grupo. **Dónde:** `notifications.ts:29-32,40-43` · **Impacto:** 1 · **Esfuerzo:** S

### NOT-096 · Estilo expandible (BigText) en Android para cuerpos largos
**Qué:** que el copy completo se lea al expandir. **Dónde:** `notifications.ts:31,42` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-097 · Imagen/icono temático en la notificación (large icon)
**Qué:** reforzar identidad visual del "sistema". **Dónde:** `notifications.ts` + assets · **Impacto:** 1 · **Esfuerzo:** M

### NOT-098 · Color de acento de la notificación (Android `color`)
**Qué:** usar `colors.cyan` como color de la notificación. **Dónde:** `notifications.ts` + `theme.ts:7` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-099 · Respetar "No molestar" / horas de silencio del usuario
**Qué:** no programar avisos en una franja nocturna configurable. **Dónde:** `notifications.ts` · **Impacto:** 2 · **Esfuerzo:** M

### NOT-100 · Límite máximo de notificaciones por día (anti-fatiga)
**Qué:** cuando se sumen recordatorios por misión, capar el total diario. **Dónde:** `notifications.ts` · **Impacto:** 3 · **Esfuerzo:** M

### NOT-101 · Coalescer recordatorios de misión cercanos en uno solo
**Qué:** si 3 misiones tienen hora parecida, un único aviso "tienes 3 misiones". **Dónde:** `notifications.ts` · **Impacto:** 3 · **Esfuerzo:** L

### NOT-102 · Snooze persistente del aviso de cierre por usuario
**Qué:** recordar la preferencia de posponer entre días. **Dónde:** `notifications.ts` + AsyncStorage · **Impacto:** 2 · **Esfuerzo:** M

### NOT-103 · Telemetría local de entregas/aperturas para afinar el timing
**Qué:** contar cuántos avisos se abren para sugerir mejor hora. **Dónde:** nuevo · **Impacto:** 2 · **Esfuerzo:** L

### NOT-104 · Accesibilidad: cuerpos compatibles con lectores de pantalla (sin símbolos crípticos)
**Qué:** el `−` (U+2212) en `penaltyApplied` puede leerse raro; usar texto. **Dónde:** `voice.ts:25-27` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-105 · Accesibilidad: evitar depender solo del sonido para el aviso urgente
**Qué:** garantizar heads-up visual además del sonido en el cierre. **Dónde:** `notifications.ts:5-12` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-106 · Longitud del cuerpo controlada para no truncar en la bandeja
**Qué:** algunas frases de `eveningNotif` son largas; verificar truncado. **Dónde:** `voice.ts:50-55` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-107 · Revisar el uso de comillas tipográficas en `dungeonCleared` para TTS
**Qué:** las comillas `"` alrededor del título pueden afectar lectura. **Dónde:** `voice.ts:57-59` · **Impacto:** 1 · **Esfuerzo:** S

### NOT-108 · Sanitizar títulos interpolados (mazmorra/ejercicio) en el cuerpo
**Qué:** un título con saltos de línea o muy largo deforma la notificación. **Dónde:** `voice.ts:56-65` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-109 · `voice.frozen` recibe `reason` sin normalizar (mayúsculas/espacios)
**Qué:** `Modo ${reason} activo` puede quedar "Modo  activo" si reason es vacío/espacios. **Dónde:** `voice.ts:39-43` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-110 · Fallback de `reason` por defecto en `voice.frozen`
**Qué:** `frozen(reason = 'pausa')` evita interpolar undefined si algún llamador lo omite. **Dónde:** `voice.ts:39` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-111 · `voice.pr`/`voice.dungeonCleared` con default si el nombre llega vacío
**Qué:** proteger interpolaciones de string vacío. **Dónde:** `voice.ts:56,61` · **Impacto:** 1 · **Esfuerzo:** S

### NOT-112 · Agrupar funciones de `voice` por categoría (overlay vs notif vs alert)
**Qué:** organizar el objeto en sub-objetos `voice.notif.*`, `voice.alert.*` para claridad. **Dónde:** `voice.ts:8-72` · **Impacto:** 2 · **Esfuerzo:** M

### NOT-113 · Congelar (`as const` / `Object.freeze`) el banco de voz
**Qué:** evitar mutaciones accidentales del objeto exportado. **Dónde:** `voice.ts:8` · **Impacto:** 1 · **Esfuerzo:** S

### NOT-114 · Memoizar arrays de frases fuera de cada llamada
**Qué:** los literales se recrean en cada invocación; extraer a constantes de módulo. **Dónde:** `voice.ts:9-71` · **Impacto:** 1 · **Esfuerzo:** S

### NOT-115 · Evitar reprogramar si el contenido no cambió (diff de payload)
**Qué:** comparar lo programado con lo deseado y saltar si igual. **Dónde:** `notifications.ts:27-49` · **Impacto:** 3 · **Esfuerzo:** M

### NOT-116 · Mover la creación del canal a bootstrap único (no por llamada)
**Qué:** `setNotificationChannelAsync` se reinvoca cada vez; basta una. **Dónde:** `notifications.ts:18-23` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-117 · Cachear `Platform.OS === 'android'` en constante de módulo
**Qué:** micro-claridad; evitar recomputar. **Dónde:** `notifications.ts:18` · **Impacto:** 1 · **Esfuerzo:** S

### NOT-118 · Tipar el retorno de permiso con el enum de expo, no string libre
**Qué:** usar `Notifications.PermissionStatus`. **Dónde:** `notifications.ts:24` · **Impacto:** 1 · **Esfuerzo:** S

### NOT-119 · Verificar `Device.isDevice` antes de programar (emulador sin push)
**Qué:** las locales sí funcionan en emulador, pero documentar/avisar de límites. **Dónde:** `notifications.ts:16` · **Impacto:** 1 · **Esfuerzo:** S

### NOT-120 · Manejar el rechazo de `setNotificationChannelAsync` por separado
**Qué:** si falla el canal, no impedir programar (hoy todo cae al mismo catch). **Dónde:** `notifications.ts:19-23` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-121 · Documentar que `app.json` ya incluye el plugin `expo-notifications`
**Qué:** dejar nota de que el plugin (app.json:34) es requisito del dev build. **Dónde:** `notifications.ts:1` + `app.json:34` · **Impacto:** 1 · **Esfuerzo:** S

### NOT-122 · Configurar icono/color de notificación vía plugin en `app.json`
**Qué:** `["expo-notifications", { icon, color }]` para identidad consistente. **Dónde:** `app.json:34` · **Impacto:** 2 · **Esfuerzo:** S

### NOT-123 · Aviso semanal de mazmorras activas próximas a vencer
**Qué:** resumen de deadlines de la semana. **Dónde:** `types.ts:58` + `notifications.ts` · **Impacto:** 2 · **Esfuerzo:** L

### NOT-124 · Recordatorio de diario si no se ha escrito hoy
**Qué:** aviso suave nocturno si falta la entrada del diario. **Dónde:** `notifications.ts` + `types.ts:144` · **Impacto:** 2 · **Esfuerzo:** M

### NOT-125 · Función `voice.journalReminder()` en el banco
**Qué:** copy para el recordatorio de diario. **Dónde:** `voice.ts:7-72` · **Impacto:** 1 · **Esfuerzo:** S

### NOT-126 · Recordatorio de gym según `GymDay.day_of_week`
**Qué:** avisar los días con entrenamiento programado. **Dónde:** `types.ts:87-92` + `notifications.ts` · **Impacto:** 3 · **Esfuerzo:** L

### NOT-127 · Función `voice.gymReminder(dayName)` en el banco
**Qué:** copy para el recordatorio de entrenamiento. **Dónde:** `voice.ts:7-72` · **Impacto:** 1 · **Esfuerzo:** S

### NOT-128 · Recordatorio de comida según `MealSlot` (opcional)
**Qué:** avisos de planificación de comidas si el usuario lo activa. **Dónde:** `types.ts:124-133` + `notifications.ts` · **Impacto:** 1 · **Esfuerzo:** L

### NOT-129 · Reprogramar la cola tras editar misiones/agenda
**Qué:** cuando cambian datos relevantes, refrescar notificaciones afectadas. **Dónde:** `notifications.ts` + pantallas de edición · **Impacto:** 3 · **Esfuerzo:** M

### NOT-130 · Cancelar recordatorio de una misión al completarla
**Qué:** evitar avisar de algo ya hecho hoy. **Dónde:** `index.tsx` finishQuest + `notifications.ts` · **Impacto:** 3 · **Esfuerzo:** M

Total: 130 mejoras, 5 bugs.
