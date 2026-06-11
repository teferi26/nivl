# Widgets, integraciones y salud

> Categoría INT · backlog NIVL · ordenadas por impacto

### INT-001 · Widget interactivo "Misiones de hoy"
**Qué:** Widget de pantalla de inicio (Glance en Android, WidgetKit interactivo en iOS 17+) con las misiones pendientes del día y check directo desde el propio widget; si la misión exige evidencia, el botón abre la cámara vía deep link. Completar sin abrir la app es la mayor palanca de retención de un habit tracker: el escritorio del móvil se convierte en el panel del cazador. Solo depende del módulo de misiones (fase 1), así que merece adelantarse respecto al roadmap.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 3

### INT-002 · Acciones rápidas en notificaciones
**Qué:** Botones "Completar" y "Posponer 1 h" en las notificaciones de las 8:00 y 21:30 usando categorías de notificación de Expo; con evidencia obligatoria, el botón lleva directo a la cámara de esa misión. Reduce a un toque el ciclo recordatorio-acción justo cuando la motivación es más frágil, sin esperar a tener widgets.
**Impacto:** 5/5 · **Esfuerzo:** S · **Fase:** 2

### INT-003 · Pasos automáticos con Health Connect/HealthKit
**Qué:** Nuevo tipo de misión "pasos" con objetivo configurable (p. ej. 8.000) que se verifica sola leyendo Health Connect (Android) o HealthKit (iOS), con barra de progreso en vivo en la pantalla Sistema ("6.230/8.000 — el Sistema observa"). XP de VIT/AGI sin fricción de registro y sin posibilidad de trampa.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 3

### INT-004 · Sueño automático como misión de VIT
**Qué:** Leer las sesiones de sueño del móvil o reloj y validar por la mañana la misión "dormir 7 h o más", con bonus si la hora de acostarse se mantiene dentro de una ventana de ±30 minutos. El sueño es el hábito con más efecto dominó sobre gym, dieta y estudio, y aquí se mide sin que el usuario haga nada.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 3

### INT-005 · Exámenes y entregas desde Google Calendar
**Qué:** Conexión OAuth con Google Calendar que detecta eventos con palabras clave (examen, parcial, entrega) y genera para cada uno una cuenta atrás en el Sistema más misiones INT de repaso escalonadas (7, 3 y 1 días antes). El calendario académico real se convierte en contenido del juego: las raids llegan solas.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 2

### INT-006 · Widget de bloqueo "racha en peligro"
**Qué:** Widget de pantalla de bloqueo (circular e inline en iOS 16+, superficie de bloqueo/AOD en Android) con misiones pendientes y multiplicador de racha; desde las 21:00 con tareas sin cerrar pasa a rojo #FF5C6B mostrando las horas que quedan. Aversión a la pérdida aplicada en la superficie que se mira más de cien veces al día.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 5

### INT-007 · Esquema completo de deep links nivl://
**Qué:** Rutas nivl://hoy, nivl://mision/{id}, nivl://mision/{id}/completar, nivl://camara/{id}, nivl://perfil y nivl://mazmorra/{id} sobre Expo Router, documentadas. Es el cimiento de widgets, notificaciones accionables, atajos, NFC y reloj, y de paso permite a un usuario técnico automatizar con Tasker/MacroDroid desde el primer día.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### INT-008 · Exportar misiones con hora a Google Calendar
**Qué:** Las misiones con franja horaria se publican como eventos "[NIVL]" con color según stat y recordatorio 10 minutos antes; al completarlas, el evento se renombra como hecho. Ver los hábitos dentro de la agenda real refuerza la implementación de intenciones ("a las 18:00, gym"), la técnica con más evidencia científica para consolidar hábitos.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### INT-009 · Evidencia de tipo "sensor" con bonus íntegro
**Qué:** Nueva política de evidencia: en misiones de salud, el dato del sensor (pasos, sueño, workout, peso) sustituye a la foto y conserva el bonus del +25 % si el dato cae dentro de la franja de la misión. Mantiene el espíritu anti-trampas del Sistema eliminando la fricción absurda de fotografiar una báscula o la cama.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### INT-010 · Autodetección de entrenamiento de gym
**Qué:** Si HealthKit/Health Connect registra un workout de fuerza de más de 30 minutos, la misión de gym del día ofrece autocompletarse adjuntando duración, calorías y FC media como evidencia. El reloj ya lo está registrando: NIVL solo tiene que escucharlo y entregar el XP de FUE al salir del gimnasio.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### INT-011 · Verificación de commits con GitHub
**Qué:** Conectar GitHub con un token de solo lectura para verificar misiones tipo "programar hoy" contra las contribuciones del día en los repos elegidos, mostrando la racha de commits junto a la de NIVL. Para un estudiante de informática con proyectos es el puente perfecto entre vida real y stat INT.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### INT-012 · Peso automático y tendencia
**Qué:** Leer el peso desde Health (báscula inteligente o apunte manual en Salud) para autocompletar la misión semanal de pesaje y pintar en Perfil la tendencia con media móvil de 7 días. Alimenta el módulo de dieta de fase 3 sin doble registro.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### INT-013 · Detección de conflictos de agenda
**Qué:** Cada mañana se cruzan las misiones con hora contra los eventos de Calendar; si una clase pisa la franja del gym, el Sistema avisa y propone un hueco libre ("hoy tienes laboratorio de 17 a 19, ¿mazmorra de hierro a las 20:00?"). Evita fallos de racha por causas previsibles, la principal fuente de frustración injusta con la penalización dura actual.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### INT-014 · Misión inversa de tiempo de pantalla
**Qué:** En Android, leer UsageStats (Bienestar digital) para verificar misiones tipo "menos de 60 min de redes hoy", con consumo en vivo en la pantalla Sistema y XP concedido a las 23:59 si no se superó el límite. Gamifica reducir el mal hábito número uno de un estudiante, no solo crear hábitos nuevos.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 4

### INT-015 · Carga diaria adaptada al sueño
**Qué:** Con menos de 6 h dormidas según Health, ese día el Sistema reduce a la mitad la penalización por fallo y sugiere qué misión posponer ("has dormido 5 h 12 min: hoy el Sistema protege tu racha"). Un juego que castiga al agotado quema; uno que se adapta fideliza a años vista.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### INT-016 · App de reloj con check (Wear OS y watchOS)
**Qué:** App mínima de reloj con las misiones de hoy y check desde la muñeca con háptica de "QUEST COMPLETE"; las que exigen foto muestran "requiere móvil". Marcar el hábito en el instante en que ocurre (al cerrar el libro, al salir del gym) refuerza el bucle señal-acción-recompensa.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 5

### INT-017 · Widget de nivel, rango y XP
**Qué:** Widget mediano con estética de ventana del sistema (esquinas cortadas, Orbitron): nivel, rango E-S, barra de XP y multiplicador de racha, refrescado al instante tras cada misión completada. Una barra a medio llenar siempre visible es un gancho Zeigarnik permanente hacia "una misión más".
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 5

### INT-018 · Atajos de Siri y Asistente de Google
**Qué:** App Intents (iOS) y App Actions (Android) para "completa mi misión de lectura" o "¿qué me queda hoy?" con respuesta en voz del Sistema, reutilizables en la app Atajos para automatizaciones personales (conectar al wifi del gym abre la misión de gym). Manos libres y automatización de serie.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 5

### INT-019 · Web companion: panel del cazador
**Qué:** Dashboard web de solo lectura sobre la misma base de Supabase: perfil, stats, misiones de hoy, racha y heatmap, pensado para vivir en una pestaña anclada mientras estudia. Recordatorio pasivo en la pantalla donde pasa seis horas al día.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 6

### INT-020 · Web companion: planificación completa
**Qué:** Ampliar el companion con CRUD de misiones y mazmorras, edición en lote y arrastre de misiones a un calendario semanal con teclado y ratón. La sesión de planificación dominical es mucho más cómoda en pantalla grande, y planificar mejor se traduce directamente en cumplir más.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 6

### INT-021 · Briefing matinal relativo al despertar
**Qué:** Usar la hora de fin de sueño de Health para disparar el briefing 30 minutos después de despertar (con tope a las 10:00) en lugar de a las 8:00 fijas. Un briefing que llega dormido se descarta; uno que llega con el café se lee y ordena el día.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### INT-022 · Importador de Loop Habit Tracker
**Qué:** Leer el backup (.db/CSV) de Loop y mapear hábitos a misiones (frecuencia a días de semana, puntuación a dificultad sugerida), con opción de heredar la racha vigente como racha inicial. Migrar sin perder años de historial elimina la barrera de entrada desde la referencia open source.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 2

### INT-023 · Importador de Habitica
**Qué:** Conexión con la API de Habitica (user ID + token) para importar dailies y hábitos con su histórico reciente; un asistente propone stat y dificultad por tarea y deja elegir cuáles traer. Cambiarse desde el competidor gamificado directo debe costar dos minutos.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 2

### INT-024 · App shortcuts al mantener pulsado el icono
**Qué:** Atajos de launcher: "Completar siguiente misión" (dinámico, con el nombre real de la misión), "Cámara de evidencia", "Nueva misión" y "Perfil". Quick win de un día que ahorra dos toques en el flujo más repetido de la app.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### INT-025 · Quick Settings Tile en Android
**Qué:** Tile de ajustes rápidos "NIVL · 3" con el número de misiones pendientes que abre la pantalla Sistema y se atenúa cuando el día está completo. El panel de ajustes rápidos se despliega decenas de veces al día: recordatorio gratuito que no gasta notificaciones.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### INT-026 · Mazmorras con cuenta atrás en Calendar
**Qué:** El deadline de cada mazmorra crea un evento de día completo en Google Calendar ("Mazmorra: TFG — quedan N días") con recordatorios a 7, 3 y 1 días. Los plazos de proyectos viven también donde ya mira a diario.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### INT-027 · Suscripción al ICS de la universidad
**Qué:** Añadir por URL el calendario ICS de Moodle o de la facultad, importado como solo lectura, alimentando las mismas cuentas atrás y sugerencias de repaso que Google Calendar. Cubre el caso real de horarios académicos que solo existen como feed ICS, sin OAuth.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### INT-028 · Onboarding de widgets con colocación en un toque
**Qué:** Al tercer día de uso, una ventana del sistema "Instala el panel del cazador" lanza requestPinAppWidget en Android (se coloca con un toque) y un tutorial visual paso a paso en iOS. Los widgets solo retienen si están puestos: empujar su adopción es parte del feature.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### INT-029 · Time-blocking automático en Calendar
**Qué:** Botón "planificar mi día": el Sistema propone huecos para las misiones sin hora esquivando los eventos existentes y, al confirmar, crea los bloques en Google Calendar. Pasar de lista de deseos a plan con horas multiplica la probabilidad de ejecución.
**Impacto:** 3/5 · **Esfuerzo:** L · **Fase:** 4

### INT-030 · Live Activity y Dynamic Island
**Qué:** Durante una sesión de gym o un pomodoro de estudio, Live Activity en iOS (notificación persistente equivalente en Android) con cronómetro, misión activa y XP en juego; al terminar, pantalla de recompensa. La sesión en curso se siente como una mazmorra abierta que pide cerrarse.
**Impacto:** 3/5 · **Esfuerzo:** L · **Fase:** 5

### INT-031 · Complicaciones y tiles de reloj
**Qué:** Complicación de esfera en watchOS y tile en Wear OS con racha, multiplicador y misiones restantes del día, en azul cazador #37C8F0. Mirar la hora pasa a ser comprobar el estado del día.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### INT-032 · Cronómetro de gym en el reloj con autoevidencia
**Qué:** Iniciar y terminar el entrenamiento desde el reloj; al cerrar, la sesión (duración, FC) se adjunta como evidencia y el XP de FUE llega con háptica de subida. El móvil se queda en la mochila: cero fricción dentro del gimnasio.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### INT-033 · Widget heatmap de constancia
**Qué:** Widget grande con el mosaico de cumplimiento de las últimas 10 semanas al estilo GitHub, en la escala de azules del sistema y con los días fallados en rojo apagado. "No romper la cadena", visible sin abrir la app.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### INT-034 · Widget de mazmorra activa
**Qué:** Widget con la mazmorra en curso: porcentaje completado, submisiones restantes y días hasta el deadline, con borde púrpura #8A76E8. Mantiene el proyecto grande presente entre sesiones, que es exactamente donde los proyectos mueren.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### INT-035 · Widget de cuenta atrás de examen
**Qué:** Widget pequeño con el próximo examen o entrega importado del calendario: nombre, días restantes y misiones de repaso completadas frente a planificadas. La presión justa, siempre a la vista en época de exámenes.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 5

### INT-036 · Micromisiones antisedentarismo
**Qué:** Si Health detecta más de 2 h sin apenas pasos en horario diurno, notificación accionable con misión secundaria exprés ("250 pasos o 5 min de estiramientos · +10 XP AGI"), con tope de tres al día. Pequeñas victorias en los días largos de biblioteca, sin saturar.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### INT-037 · Objetivo de pasos adaptativo
**Qué:** El objetivo de la misión de pasos se recalcula cada lunes como media móvil de 14 días +5 %, con suelo y techo configurables, anunciado como "el Sistema ajusta tu entrenamiento". Dificultad progresiva de juego bien diseñado: nunca trivial, nunca imposible.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### INT-038 · Escritura bidireccional en Health
**Qué:** Los entrenamientos registrados en NIVL se escriben como workouts en HealthKit/Health Connect, igual que el peso apuntado en el módulo de dieta. NIVL deja de ser un silo y los datos del cazador completan su ecosistema de salud.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### INT-039 · Webhooks salientes para domótica
**Qué:** POST configurable (URL + plantilla JSON) al completar misión, subir de nivel o entrar en peligro de racha, pensado para Home Assistant o scripts propios. Que la habitación se ilumine de azul cazador al subir de nivel es motivación de juego AAA en el mundo físico, y a un ingeniero le cuesta cero adoptarlo.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 6

### INT-040 · Verificación de repaso con AnkiDroid
**Qué:** Misión "repasar flashcards" verificada contra la API de AnkiDroid comparando las tarjetas repasadas hoy con el objetivo, con check manual como fallback en iOS. El repaso espaciado es el hábito de estudio con más evidencia científica, y aquí se valida solo.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### INT-041 · Horas de código con WakaTime
**Qué:** Conectar la API gratuita de WakaTime para verificar misiones tipo "2 h de programación" con el tiempo real medido en el editor y desglose por proyecto, enlazable a una mazmorra. El progreso de las mazmorras de desarrollo se mide solo mientras programa.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### INT-042 · Modo viaje detectado por calendario
**Qué:** Los eventos de día completo tipo "viaje" o "vacaciones" en Calendar ofrecen activar el modo descanso: las misiones imposibles fuera de casa se pausan sin romper la racha, con cupo anual para evitar abusos. Unas vacaciones no deberían destruir tres meses de constancia.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### INT-043 · Etiquetas NFC en lugares de hábito
**Qué:** Vincular tags NFC físicos (gym, escritorio, cocina) a misiones concretas: acercar el móvil abre la misión con la cámara lista y el escaneo cuenta como prueba de presencia. El gesto físico de fichar ancla el hábito al lugar, como las zonas de misión de un RPG.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### INT-044 · Geovalla del gimnasio
**Qué:** Geofence opcional en el gym: al entrar, notificación "Mazmorra de hierro detectada, ¿comenzar la incursión?" que arranca el cronómetro de sesión; salir antes de 20 minutos pregunta si hubo imprevisto. El recordatorio llega en el momento y el lugar exactos de la acción.
**Impacto:** 3/5 · **Esfuerzo:** L · **Fase:** 6

### INT-045 · Extensión de navegador: nueva pestaña del Sistema
**Qué:** Extensión para Chrome/Firefox que convierte la página de nueva pestaña en una ventana del sistema con misiones pendientes, racha y orden del día. Cada pestaña abierta para procrastinar devuelve la mirada del Sistema.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 6

### INT-046 · Extensión "modo mazmorra" con bloqueo de webs
**Qué:** Mientras hay una misión de estudio activa en el móvil (sincronía vía Supabase Realtime), la extensión bloquea una lista configurable de webs distractoras y muestra la ventana del sistema con el tiempo restante. El compromiso se firma en el móvil y se cumple también en el PC.
**Impacto:** 3/5 · **Esfuerzo:** L · **Fase:** 8

### INT-047 · Bot de Telegram del Sistema
**Qué:** Bot personal que replica el briefing matinal y el aviso de las 21:30 y acepta /hoy, /completar y fotos como evidencia desde el escritorio. Canal de respaldo en una app donde un informático vive de todas formas, sin sacar el móvil.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 7

### INT-048 · FC en reposo y HRV en el informe semanal
**Qué:** Leer frecuencia cardíaca en reposo y HRV de Health y cruzarlas en el informe semanal de fase 4 con sueño, gym y dieta: "las semanas que duermes más de 7 h, tu FC en reposo baja 4 ppm". Evidencia personal de que los hábitos funcionan: la motivación más duradera que existe.
**Impacto:** 2/5 · **Esfuerzo:** M · **Fase:** 4

### INT-049 · Importador CSV genérico (Streaks y otros)
**Qué:** Plantilla CSV documentada (nombre, stat, dificultad, días, racha inicial) con vista previa y validación antes de importar; cubre Streaks, HabitNow, Notion o cualquier export tabular. Una única puerta de entrada para el resto del mercado.
**Impacto:** 2/5 · **Esfuerzo:** S · **Fase:** 2

### INT-050 · Exportación completa de datos
**Qué:** Desde Ajustes, generar un ZIP con CSV/JSON de misiones, completados, XP, niveles y rachas, con las fotos de evidencia opcionales. La garantía de que años de datos son suyos da la confianza necesaria para invertir en la app a largo plazo.
**Impacto:** 2/5 · **Esfuerzo:** S · **Fase:** 2

### INT-051 · Vista StandBy nocturna (iOS)
**Qué:** Soporte del modo StandBy del iPhone cargando en horizontal: resumen del día cerrado (XP ganado, racha) por la noche y briefing al amanecer, compatible con el modo rojo tenue. El Sistema monta guardia en la mesilla: presencia de mundo de juego sin coste de atención.
**Impacto:** 2/5 · **Esfuerzo:** S · **Fase:** 5

### INT-052 · Relevancia inteligente en Smart Stack
**Qué:** Etiquetar las entradas de timeline del widget de iOS con relevancia (por la mañana, briefing; de 21:00 a 23:59 con pendientes, urgencia) para que el Smart Stack suba NIVL justo en los dos momentos críticos del día. Máxima visibilidad sin que el usuario configure nada.
**Impacto:** 2/5 · **Esfuerzo:** S · **Fase:** 5

Total: 52 mejoras.
