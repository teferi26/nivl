# Técnica: offline, sync y fiabilidad

> Categoría TEC · backlog NIVL · ordenadas por impacto

### TEC-001 · Núcleo offline-first con SQLite local como fuente de verdad
**Qué:** Migrar lectura y escritura principal a una base local (expo-sqlite + Drizzle ORM) que funciona al 100% sin red; Supabase pasa a ser réplica remota, no dependencia. Completar misiones, ver el perfil y subir de nivel se siente idéntico en el metro sin cobertura que con wifi. Un fallo de red nunca puede costarte una racha: eso es sagrado para la motivación.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 3

### TEC-002 · Cola de sincronización persistente (patrón outbox)
**Qué:** Cada mutación (completar, crear, editar, borrar) se escribe primero en una tabla outbox local con orden garantizado, reintentos exponenciales con jitter y vaciado automático al volver la red. La cola sobrevive a cierres forzados y crashes: nada de lo que hiciste se pierde jamás.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 3

### TEC-003 · Cierre de día idempotente al primer arranque tras medianoche
**Qué:** Motor "day-close" que al abrir la app detecta todos los días no procesados desde el último cierre y aplica penalizaciones, rachas y misiones de penalización exactamente una vez por día (clave única día+job en BD), aunque abras la app cinco veces seguidas o tras una semana sin tocarla. Una economía punitiva solo es justa si es matemáticamente exacta; un −50% duplicado por bug destruye la confianza en el Sistema.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### TEC-004 · Optimistic UI instantáneo al completar misiones
**Qué:** Al marcar el check, el XP, la barra de progreso y la animación disparan al instante desde el estado local; la escritura remota va por detrás y, si falla, no se revierte nada: queda en cola. Latencia cero entre acción y recompensa es la diferencia entre sensación de juego AAA y formulario web.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### TEC-005 · Motor de juego como paquete puro 100% testeado
**Qué:** Extraer XP, niveles, rangos, rachas, bonus de evidencia y penalizaciones a un módulo TypeScript puro sin IO ni fechas implícitas (recibe "ahora" como parámetro inyectado), con cobertura completa. Toda pantalla, job o RPC consume el mismo módulo: imposible que dos sitios calculen XP distinto.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### TEC-006 · "Día de juego" como fecha local explícita
**Qué:** Todo el motor trabaja con fecha-calendario local (YYYY-MM-DD) calculada con la zona horaria del dispositivo y persistida junto a cada evento, nunca con UTC truncado. Adiós a misiones que caducan a la 01:00 o a las 02:00 según el horario de verano español, y a rachas rotas por un cambio de hora.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### TEC-007 · Ledger inmutable de eventos XP (event sourcing)
**Qué:** Tabla append-only `xp_events` (ganancia, bonus, multiplicador, penalización, recuperación, ajuste) de la que nivel, rango y stats se derivan por reducción. Permite auditar cada punto, reparar bugs retroactivamente y enseñar un "historial del Sistema" al usuario: la transparencia total genera confianza en el juego.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 3

### TEC-008 · Sentry con sourcemaps y releases etiquetadas
**Qué:** Integrar @sentry/react-native con subida automática de sourcemaps en cada build EAS, tagging de release y canal, y captura de crashes nativos y JS. Te enteras del error antes de que te cueste una racha, con stack trace legible en vez de código minificado.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### TEC-009 · CI en GitHub Actions: typecheck + lint + tests + expo-doctor
**Qué:** Workflow en cada push: `tsc --noEmit`, ESLint, suite del motor de juego y expo-doctor; rojo = no se integra. Cinco minutos de máquina que evitan descubrir el error de tipos ya instalado en el móvil.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### TEC-010 · Re-verificación de notificaciones programadas en cada arranque
**Qué:** Al abrir la app, comprobar que las locales de 8:00 y 21:30 siguen registradas (Android las purga tras reinicios y optimización de batería de los OEM) y reprogramarlas si faltan, avisando si el sistema tiene battery saver agresivo. La alerta de las 21:30 es la red de seguridad de tu racha: no puede fallar en silencio.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### TEC-011 · Transacción atómica de completado vía RPC única
**Qué:** Completar una misión llama a una sola función Postgres que inserta la completion, registra el evento XP y actualiza la racha en una transacción. Nunca más estados a medias: XP sumado sin completion o completion sin XP.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### TEC-012 · Restricción única "una completion por misión y día" en BD
**Qué:** `UNIQUE (mission_id, game_day)` más CHECKs de dominio (XP > 0, dificultad en enum, stat válida) como última línea de defensa en Postgres. Ningún bug de UI ni reintento de red puede duplicar XP o corromper el histórico.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### TEC-013 · EAS Update (OTA) con canales production y preview
**Qué:** Arreglos de JS al instante sin pasar por build nativa: canal preview para probar la rama en tu móvil y production con rollback en un clic. Un bug en el cierre de día se parchea en minutos, no en horas de compilación.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### TEC-014 · Migraciones de Supabase versionadas con CLI
**Qué:** Toda alteración de esquema vive en `supabase/migrations/*.sql` con timestamp y se aplica con `supabase db push`; prohibido tocar el dashboard a mano. El esquema completo es reproducible desde cero en cualquier máquina o proyecto nuevo.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### TEC-015 · Tests de propiedades de la economía con fast-check
**Qué:** Property-based testing del motor con invariantes como "el XP total nunca es negativo", "el multiplicador jamás supera ×1,5" o "una penalización recuperada el mismo día deja balance neto cero", generando miles de historiales aleatorios de días. Encuentra los casos límite que ningún test manual imagina.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### TEC-016 · Máquina del tiempo de desarrollo
**Qué:** En builds dev, panel para viajar a cualquier fecha/hora falsa que el motor consume vía clock inyectado. Probar "qué pasa el lunes a las 00:01 tras fallar dos misiones con racha de 14 días" sin esperar al lunes ni tocar el reloj del sistema.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### TEC-017 · Claves de idempotencia en toda mutación remota
**Qué:** Cada operación de la cola lleva un UUID generado en cliente y el servidor hace upsert por esa clave: un reintento tras timeout jamás duplica completions ni XP. Requisito imprescindible para que la cola de sync sea segura con red inestable.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### TEC-018 · Subida de evidencias en segundo plano con cola propia
**Qué:** La foto se guarda local al momento y la misión queda completada ya, con su bonus +25%; un worker la sube a Supabase Storage con reintentos y un chip "evidencia pendiente de subir" en la tarjeta. Hacer la foto en el gym sin cobertura cuenta exactamente igual que con 5G.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### TEC-019 · Detección de manipulación del reloj del dispositivo
**Qué:** Comparar la hora local contra la hora de servidor (header Date de Supabase) y contra un ancla monotónica local; ante un salto sospechoso, marcar los eventos como "hora dudosa", proteger la racha y no regalar XP retroactivo. Si puedes hacer trampas cambiando la fecha, tu rango S deja de significar algo: esto protege el valor de tu propio progreso.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### TEC-020 · Simulación de 365 días de jugador
**Qué:** Test que simula un año completo de uso (días perfectos, fallos, rachas rotas, semanas de exámenes, vacaciones) y compara la curva de nivel resultante contra un golden file versionado. Detecta desequilibrios de la economía antes de que te desmotiven en el mes tres.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### TEC-021 · Arranque en frío < 2 s con hidratación local
**Qué:** Presupuesto de cold start medido en cada release: la pantalla Sistema se hidrata desde SQLite sin esperar a la red, las fuentes Orbitron/Rajdhani se precargan bajo el splash y las pantallas secundarias cargan lazy. La app debe abrir como un juego, no como una web de banco.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### TEC-022 · Migraciones versionadas del estado persistido del cliente
**Qué:** El store local lleva `schemaVersion` con migraciones forward-only testeadas; si una migración falla, se conserva copia íntegra del estado anterior y se reporta a Sentry. Actualizar la app jamás puede dejarte el perfil en blanco.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### TEC-023 · Sesión offline resiliente
**Qué:** Si el refresh token de Supabase no puede renovarse por falta de red, la app sigue plenamente operativa en local y renueva en silencio al volver la conexión. Jamás un logout forzado ni una pantalla de login por estar en el gimnasio del sótano.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### TEC-024 · Backup de servidor: PITR o pg_dump nocturno
**Qué:** Activar Point-in-Time Recovery en Supabase o, mientras dure el plan free, un workflow nocturno de GitHub Actions que hace `pg_dump` a un bucket privado con rotación de 30 días. Borrar datos por error deja de ser irreversible.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### TEC-025 · Export completo de datos en ZIP (JSON + fotos)
**Qué:** Un toque en Perfil genera un ZIP con todas las tablas en NDJSON, todas las evidencias originales y un manifest con versión de esquema y checksums, compartible vía share sheet. Tus años de progreso son tuyos, no rehenes de la app.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### TEC-026 · Importación y restauración desde un export
**Qué:** Flujo que valida el manifest, ejecuta un dry-run con resumen ("se restaurarán 1.240 completions, 38 misiones, 412 fotos") y restaura en transacción con rollback ante cualquier fallo. Cambiar de móvil o recuperarte de un desastre sin perder ni un punto de XP.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 4

### TEC-027 · Backup automático local semanal con rotación
**Qué:** Job semanal que genera el export completo y lo guarda en el directorio de documentos del dispositivo (rotación de 4 copias) con subida opcional a Storage, y un aviso del Sistema si llevas más de 30 días sin copia. La tranquilidad de que el grind nunca se pierde.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### TEC-028 · Splash "INICIANDO SISTEMA" sincronizado con la hidratación
**Qué:** expo-splash-screen se mantiene visible hasta que el estado local está hidratado y el primer frame real pintado, con fundido al Sistema; cero flash blanco y cero layout shift. La inmersión empieza en el milisegundo uno.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### TEC-029 · Error boundary temático con envío de informe
**Qué:** Pantalla de crash estilo ventana del Sistema ("ANOMALÍA DETECTADA — el Sistema se ha recuperado") con botones "enviar informe" (Sentry user feedback) y "reiniciar", en lugar del red screen de React Native. Hasta el error refuerza la fantasía en vez de romperla.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### TEC-030 · Breadcrumbs de acciones de juego en Sentry
**Qué:** Cada acción relevante (check, foto, cierre de día, penalización, edición de misión) deja un breadcrumb estructurado; cualquier crash llega con la secuencia exacta de los últimos 50 pasos. Depurar un bug de XP pasa de adivinanza a lectura.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### TEC-031 · Borrado suave de misiones
**Qué:** `deleted_at` en lugar de DELETE físico: el histórico de completions y el ledger permanecen íntegros y las estadísticas de por vida no mienten, con papelera y restauración durante 30 días. Borrar una misión vieja nunca reescribe tu pasado.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### TEC-032 · Tipos TypeScript generados desde el esquema en CI
**Qué:** `supabase gen types typescript` en CI con diff check: si el esquema cambia y los tipos del repo no, la build falla. El cliente no puede compilar contra columnas que ya no existen.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### TEC-033 · Perfiles EAS Build: development, preview y production
**Qué:** `eas.json` con dev client para iterar, APK preview interno para probar en el móvil real y AAB de producción firmado, todos con `autoIncrement` de versión. Generar cualquier build es un solo comando reproducible.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### TEC-034 · Banner "CONEXIÓN CON EL SISTEMA PERDIDA" con estado de cola
**Qué:** Indicador de red tematizado (expo-network) que muestra además el estado del outbox: "3 acciones pendientes de sincronizar" con icono pulsante azul cazador. Convierte el miedo a "¿se habrá guardado?" en información clara y diegética.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### TEC-035 · UUIDv7 generados en cliente para toda entidad
**Qué:** Misiones, completions y eventos nacen con id UUIDv7 creado en el dispositivo: creación offline sin esperar al servidor, sin colisiones y con orden temporal natural en los índices de Postgres.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### TEC-036 · Resolución de conflictos LWW por campo con auditoría
**Qué:** Sincronización last-write-wins a nivel de columna usando `updated_at` del cliente; cada conflicto resuelto queda registrado en una tabla de auditoría consultable. Suficiente y silencioso para un único usuario con posible segundo dispositivo (tablet de estudio).
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### TEC-037 · Delta sync con cursor de updated_at por tabla
**Qué:** Bajar solo los cambios desde el último sync usando cursores por tabla en lugar de refetch completo. El sync de apertura pasa de cientos de filas a un puñado y se vuelve imperceptible.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### TEC-038 · Comando "recalcular perfil desde el ledger"
**Qué:** Función que reduce todos los `xp_events` y reconstruye nivel, rango y stats, comparando contra el snapshot actual y reportando cualquier drift a Sentry. Tras cualquier bug de economía, un botón repara tu perfil con justicia exacta en vez de a ojo.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### TEC-039 · Compresión y límites de evidencias fotográficas
**Qué:** Redimensionar a 1600 px de lado mayor y comprimir (calidad ~0,7) antes de guardar y subir, con limpieza de temporales y tope de tamaño por foto. Años de evidencias diarias sin comerse ni el móvil ni el bucket.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### TEC-040 · Validación Zod en todas las fronteras de IO
**Qué:** Parse estricto de todo lo que entra (respuestas de Supabase, estado persistido, exports importados, payloads de notificaciones) con esquemas Zod compartidos; el dato corrupto se rechaza con error claro en vez de propagar un NaN hasta la barra de XP.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### TEC-041 · Entorno staging: proyecto Supabase espejo
**Qué:** Segundo proyecto Supabase con las mismas migraciones y datos sintéticos generados por seed script, al que apuntan los preview builds vía variable de entorno EAS. Probar el nuevo cierre de día sin jugarte tu base de datos real.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### TEC-042 · Política de migraciones expand-and-contract
**Qué:** Regla documentada y aplicada: añadir columna nueva → doble escritura → backfill → retirar la vieja en una release posterior; nunca renombrar ni borrar en un solo paso. La versión vieja de la app instalada en tu móvil nunca rompe contra el esquema nuevo.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### TEC-043 · Panel de diagnóstico oculto
**Qué:** Siete toques en el número de versión abren un panel dev: items de la cola de sync con su estado, último cierre de día ejecutado, zona horaria activa, log local en buffer circular y botones de forzar sync y recomputar perfil. Soporte técnico de ti para ti en 30 segundos.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### TEC-044 · Política explícita de viaje y cambio de zona horaria
**Qué:** Regla testeada: el día de juego se ancla a la zona horaria del dispositivo al inicio del día; si la TZ cambia más de 2 horas, el día en curso se alarga (nunca se acorta) y es imposible recibir doble penalización. Volar a una hackathon en Londres no puede costarte la racha.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### TEC-045 · E2E smoke nocturno con Maestro
**Qué:** Flujos críticos automatizados sobre la build preview en CI nocturno: abrir app, completar misión, ver el XP subir, crear misión nueva, simular cierre de día. Si el happy path se rompe, lo sabes esa misma noche y no el lunes a las 8:00.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### TEC-046 · Chaos testing del motor de sincronización
**Qué:** Suite que inyecta fallos aleatorios (red caída a mitad de vaciado de cola, app matada justo tras la escritura local, 500 intermitentes de Supabase, doble lanzamiento del day-close) y verifica que el estado siempre converge sin duplicar ni perder eventos. La fiabilidad se demuestra rompiendo las cosas a propósito.
**Impacto:** 3/5 · **Esfuerzo:** L · **Fase:** 5

### TEC-047 · Pre-commit con typecheck y tests rápidos
**Qué:** Husky + lint-staged: ESLint sobre los archivos staged, `tsc` incremental y la suite del motor (<10 s) antes de cada commit. El error barato se caza en el commit, no en CI ni en el móvil.
**Impacto:** 2/5 · **Esfuerzo:** S · **Fase:** 2

### TEC-048 · Trazas de rendimiento de arranque y sync
**Qué:** Sentry Performance con transacciones para cold start, hidratación local, vaciado del outbox y RPC de completado, con alerta si el p95 se degrada entre releases. Las regresiones de velocidad se ven en un dashboard, no en la sensación de "va lento".
**Impacto:** 2/5 · **Esfuerzo:** S · **Fase:** 4

### TEC-049 · Renovate y checklist de upgrade de Expo SDK
**Qué:** Renovate agrupando actualizaciones menores con la CI verde como gate, más una checklist documentada para el salto anual de SDK (expo upgrade, expo-doctor, smoke E2E en device real). Las dependencias no se pudren hasta volverse un upgrade imposible.
**Impacto:** 2/5 · **Esfuerzo:** S · **Fase:** 4

### TEC-050 · Export CSV por tabla
**Qué:** Además del ZIP completo, export rápido de completions y xp_events en CSV para abrir en Excel o Google Sheets. Eres ingeniero: tus propios análisis de progreso con pivot tables son parte de la diversión.
**Impacto:** 2/5 · **Esfuerzo:** S · **Fase:** 4

### TEC-051 · Presupuesto de tamaño de app en CI
**Qué:** Medir el tamaño del AAB en cada build de CI y fallar si crece más de un 10% sin justificación, con subsetting de las fuentes Orbitron/Rajdhani y tree-shaking de iconos. App ligera = instalación y arranque rápidos para siempre.
**Impacto:** 2/5 · **Esfuerzo:** S · **Fase:** 5

### TEC-052 · Tarjeta "salud del Sistema" en Perfil
**Qué:** Ventana del Sistema con último sync, items en cola, fecha del último backup, último cierre de día, versión y canal OTA, todo en verde/ámbar/rojo con la estética de esquinas cortadas. La fiabilidad deja de ser invisible: ver el Sistema "operativo al 100%" también motiva.
**Impacto:** 2/5 · **Esfuerzo:** M · **Fase:** 5

Total: 52 mejoras.
