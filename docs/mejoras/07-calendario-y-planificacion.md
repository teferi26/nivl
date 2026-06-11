# Calendario y planificación temporal

> Categoría CAL · backlog NIVL · ordenadas por impacto

### CAL-001 · Calendario mensual unificado del cazador
**Qué:** Nueva pestaña Calendario con rejilla mensual que fusiona misiones diarias, tareas con fecha, plazos de mazmorra y eventos (exámenes, entregas) en una sola vista; cada celda muestra micro-puntos por tipo con los colores del Sistema (azul misiones, púrpura mazmorras) y la celda seleccionada usa el marco de esquinas cortadas. Es el mapa de campaña: un vistazo y sabes cómo viene el mes.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 2

### CAL-002 · Agenda del día («Orden del día»)
**Qué:** Vista vertical cronológica del día (desde la hora de despertar hasta la hora de cierre) con bloques horarios, sección "Sin hora" arriba para misiones no programadas y autoscroll a la hora actual al abrir. Sustituye la lista plana de hoy por un plan de batalla con tiempos reales.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### CAL-003 · Ritual de planificación del domingo
**Qué:** Flujo guiado de 4 pasos en ventana del Sistema: revisar la semana pasada, elegir misiones y cuotas, repartirlas por días viendo la carga de cada uno, y sellar el plan con animación de decreto. Convierte planificar en un ritual con principio y fin —el meta-hábito que sostiene a todos los demás—, con día y hora configurables (domingo por defecto).
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 2

### CAL-004 · Time-blocking: misiones con franja horaria
**Qué:** Cualquier misión o tarea puede arrastrarse sobre la agenda para asignarle hora de inicio y duración; el bloque hereda el color de su stat y muestra su XP en la esquina. Pasar de "hoy toca gym" a "gym 18:00–19:30" multiplica la probabilidad de ejecución (intención de implementación).
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 2

### CAL-005 · Arrastrar y soltar para reprogramar entre días
**Qué:** Mantener pulsada una misión o tarea en la vista semanal o mensual y soltarla en otro día, con elevación de la tarjeta, snap a la celda y háptica al soltar. Reorganizar la semana cuesta segundos en lugar de entrar a editar cada misión.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### CAL-006 · Duración estimada por misión y tarea
**Qué:** Campo de duración con presets (15/30/45/60/90/120 min) en el CRUD de misiones y tareas, editable después desde el calendario. Es el cimiento de todo el sistema de capacidad, time-blocking y detección de sobrecarga.
**Impacto:** 5/5 · **Esfuerzo:** S · **Fase:** 2

### CAL-007 · Medidor de capacidad diaria
**Qué:** Cada día calcula su carga (suma de duraciones estimadas) contra las horas disponibles y la pinta como barra tipo "maná" en la agenda y en las celdas de semana y mes (azul <80%, ámbar 80–100%, rojo >100%). Ver la sobrecarga antes de vivirla es lo que separa un plan motivador de uno frustrante.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### CAL-008 · Retirada táctica: reprogramar sin castigo (limitado)
**Qué:** 2 fichas semanales de "retirada táctica" para mover una misión de hoy a otro día de la misma semana sin penalización de XP ni romper la racha, siempre antes de que cierre el día. Da una válvula de escape legítima que corta la espiral "fallo → castigo → abandono" sin abrir la puerta a procrastinar infinito.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### CAL-009 · Hora de cierre del día personalizada
**Qué:** El "día del cazador" termina a la hora que elijas (p. ej. 03:00): agenda, rachas y penalizaciones usan esa frontera en lugar de medianoche, con manejo correcto de cambios de hora. Para un estudiante nocturno, completar a las 00:30 debe contar como hoy, no como fallo.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### CAL-010 · Importación de Google Calendar
**Qué:** OAuth con Google y lectura de eventos, que aparecen en agenda y semana como bloques fijos tipo "muro" (gris azulado con candado) que no se pueden arrastrar. El plan NIVL deja de vivir en una realidad paralela: clases, citas y entregas reales delimitan el terreno de juego.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 3

### CAL-011 · Cuotas semanales flexibles ubicadas por el calendario
**Qué:** Misiones tipo "3 veces por semana" (gym, correr) sin días fijos; en el ritual el calendario propone qué días reservarlas según carga y huecos, y durante la semana recoloca las pendientes en los días restantes. Refleja cómo funcionan los hábitos reales y elimina el fallo artificial de "hoy tocaba y no fui" cuando aún quedan días para cumplir la cuota.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 3

### CAL-012 · Alerta de sobrecarga al añadir o mover
**Qué:** Al soltar o crear algo en un día que supera el 100% de capacidad, ventana de alerta del Sistema ("CAPACIDAD EXCEDIDA: 5,5 h / 4 h") con el día alternativo más despejado sugerido a un tap. Hace imposible sobrecargarse "sin darse cuenta".
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 3

### CAL-013 · Horario de clases como bloques fijos
**Qué:** Editor de horario semanal de clases (asignatura, aula, franja) que se pinta como bloques inamovibles cada semana lectiva y resta horas a la capacidad del día. El esqueleto real de la semana de un estudiante queda dentro de NIVL desde el primer día, sin depender aún de Google.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### CAL-014 · Vista semanal de 7 columnas
**Qué:** Semana completa con bloques en miniatura, barra de carga al pie de cada columna y exámenes/plazos en la cabecera. Es la vista natural tras el ritual: el plan entero de un vistazo y el lienzo principal para arrastrar entre días.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### CAL-015 · Hoja de detalle del día
**Qué:** Tocar cualquier día abre un bottom sheet con sus misiones, eventos, carga, XP en juego o ganado y acciones rápidas (añadir aquí, reprogramar, marcar descanso). Permite navegar el calendario sin perder el contexto del mes.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### CAL-016 · Excepciones de serie en misiones recurrentes
**Qué:** Al mover o saltar una misión recurrente, el Sistema pregunta "¿solo esta vez o toda la serie?" y crea excepciones sin tocar la definición semanal. Imprescindible para que reprogramar no destroce la configuración de los hábitos.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### CAL-017 · Misión principal del día
**Qué:** Marcar una misión diaria como "principal": corona en la agenda, posición fija arriba y +10% de XP al completarla. Ciencia del MIT (Most Important Task): un foco claro al día sostiene la sensación de victoria aunque el resto flojee.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### CAL-018 · «XP en juego» del día
**Qué:** La cabecera de la agenda muestra el XP total disponible hoy ("EN JUEGO: 320 XP") y va descontando al completar cada misión. Convierte el plan del día en un botín visible que apetece reclamar.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### CAL-019 · Eventos «jefe»: exámenes y entregas
**Qué:** Tipo de evento examen/entrega con icono de jefe, aura púrpura que se intensifica al acercarse y cuenta atrás en días en la celda y en la cabecera del calendario ("JEFE EN 5 DÍAS"). Los exámenes dejan de ser fechas grises: son combates que se preparan.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### CAL-020 · Recompensa y racha de planificación
**Qué:** Sellar el plan del ritual otorga +50 XP de AGI y alimenta una racha de semanas planificadas; con 4 domingos seguidos, +5% de XP durante toda la semana. Recompensar el meta-hábito de planificar es lo que lo consolida.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### CAL-021 · Heatmap mensual de cumplimiento
**Qué:** En la vista mensual, cada día pasado se tiñe de azul cazador con intensidad proporcional a su % de cumplimiento. Un mes encadenado de celdas brillantes es la versión NIVL del "no rompas la cadena": los huecos grises duelen y los meses azules enganchan.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### CAL-022 · Vista previa de carga al crear una misión
**Qué:** Al elegir los días de la semana en el CRUD, un minigráfico muestra la carga actual de cada día para escoger los flojos. Las decisiones de capacidad se toman en el momento de crear, no cuando ya es tarde.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### CAL-023 · Plan vs. realidad en el ritual
**Qué:** El primer paso del ritual muestra la semana pasada planificado vs. completado por día, con un % de "fiabilidad del cazador" y los 3 puntos donde se cayó el plan. Cerrar el ciclo de feedback semanal es lo que hace que la planificación mejore en vez de repetirse.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### CAL-024 · Compuerta anti-sobrecompromiso en el ritual
**Qué:** Si el plan supera el ~110% de la capacidad semanal, el Sistema bloquea el sello con "RIESGO DE SOBRECARGA", sugiere qué misiones aplazar y exige confirmar "Aceptar riesgo" para continuar. Fricción deliberada contra el optimismo del domingo que se paga el miércoles.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### CAL-025 · Horas disponibles automáticas
**Qué:** La capacidad de cada día se calcula sola: horas activas (entre despertar y hora de cierre) menos clases, eventos de Google y un margen configurable; un chip en Sistema y agenda muestra "te quedan 2,5 h de margen". El medidor de carga pasa de estimación manual a verdad operativa.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### CAL-026 · Días de descanso planificados
**Qué:** En el ritual o desde el detalle del día se marcan días de descanso: protegen la racha, anulan penalizaciones y la celda luce una luna púrpura. Descansar pasa a ser una decisión del plan y no un fallo del cazador; clave anti-burnout para sostener la motivación durante meses.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### CAL-027 · Sello de rango diario con crónica
**Qué:** Cada día cerrado recibe un sello E–S según su % de cumplimiento, estampado en su celda; tocarlo abre la crónica del día (completadas, falladas, XP, evidencias). Coleccionar días de rango S convierte el calendario pasado en una vitrina de trofeos.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### CAL-028 · Bandeja «Sin programar»
**Qué:** Bandeja colapsable bajo el calendario con tareas de mazmorra y misiones sin fecha, listas para arrastrar a un día o franja. Vaciarla se siente como dejar el campamento ordenado: nada queda flotando fuera del plan.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### CAL-029 · Buscador de huecos («¿Dónde cabe?»)
**Qué:** Acción en cualquier misión o tarea que lista los huecos libres de los próximos 7 días compatibles con su duración y la capacidad del día; un tap la programa. Elimina el trabajo mental de escanear la semana buscando sitio.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### CAL-030 · Mini-ritual nocturno «Planifica mañana»
**Qué:** Flujo de 3 toques accesible desde Sistema por la noche: confirmar las misiones de mañana, elegir la principal y ver la carga prevista. Planificar la noche antes reduce la fricción de arranque matinal y aumenta la intención de ejecución del día siguiente.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### CAL-031 · Radar de 72 horas
**Qué:** Módulo en la pantalla Sistema con exámenes, entregas y bloques clave de las próximas 72 h, ordenados por urgencia y con cuenta atrás. El cazador nunca es emboscado por un plazo que "no vio venir".
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### CAL-032 · Sincronización bidireccional con Google Calendar
**Qué:** NIVL escribe sus bloques en un calendario "NIVL" de Google (visible en cualquier dispositivo) y los cambios hechos allí —mover o borrar— se reflejan en la app en la siguiente sincronización. El plan vive donde ya vive tu vida, sin doble mantenimiento.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 4

### CAL-033 · Modo exámenes
**Qué:** Se define un rango de fechas de exámenes: la capacidad objetivo baja, las misiones no críticas se proponen para pausa, los bloques de estudio ganan prioridad y el calendario se tiñe con una trama de alerta. El Sistema entiende tus finales en lugar de castigarte por ellos.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### CAL-034 · Sugerencia de carga basada en histórico
**Qué:** Durante el ritual, el Sistema propone el volumen de misiones según tu % de cumplimiento real de las últimas 4 semanas ("completaste el 70%: te sugiero 18 misiones, no 26"). Corrige la falacia de planificación con tus propios datos.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### CAL-035 · Factor de estimación personal
**Qué:** Compara la duración estimada con el tiempo real de los bloques completados y calcula tu multiplicador personal (p. ej. ×1,3), aplicándolo automáticamente a nuevas estimaciones con opción de ajuste manual. Con el tiempo, tus planes dejan de ser optimistas para ser exactos.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 5

### CAL-036 · Capacidad aprendida por día de la semana
**Qué:** El Sistema aprende tu tasa real de cumplimiento por día (los miércoles rindes el 60%, los sábados el 90%) y ajusta la capacidad sugerida y las alertas de sobrecarga para cada día concreto. La planificación se adapta a tu semana real, no a una ideal.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 5

### CAL-037 · Autoplanificación del día («Planifícame»)
**Qué:** Botón que distribuye las misiones pendientes de hoy en los huecos libres respetando duraciones, capacidad y la misión principal, con previsualización editable antes de aplicar. Rescata los días caóticos con un plan decente en 5 segundos.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 5

### CAL-038 · Línea de «ahora» y bloque activo
**Qué:** Línea azul de hora actual en agenda y semana, autoscroll al abrir y el bloque en curso resaltado con borde animado y progreso transcurrido. Sitúa al cazador en el tiempo de un vistazo.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### CAL-039 · Deshacer reprogramaciones
**Qué:** Toast "Deshacer" de 5 segundos tras mover, saltar o reprogramar cualquier cosa, restaurando fecha y franja originales. Quita el miedo a arrastrar y hace el calendario manipulable sin ansiedad.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### CAL-040 · Lunes primero y formato es-ES
**Qué:** Semana empezando en lunes y fechas y horas en formato español de 24 h ("lun 15 jun, 18:00") en todas las vistas. Detalle pequeño que evita fricción diaria en un calendario que se mira decenas de veces al día.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### CAL-041 · Mini-tira semanal en Sistema
**Qué:** Selector horizontal de 7 días sobre la lista de misiones de hoy, con punto de carga por día, para saltar a mañana o al jueves sin cambiar de pestaña. Navegación temporal instantánea desde la pantalla más usada.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### CAL-042 · Redimensionar bloques con snap de 15 min
**Qué:** Asas superior e inferior en los bloques de la agenda para alargar o acortar con snap a 15 minutos y háptica en cada paso; la duración estimada se actualiza al soltar. Ajustar el plan a la realidad del día cuesta un gesto.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### CAL-043 · Conflictos entre bloques y eventos
**Qué:** Si un bloque NIVL se solapa con un evento de Google o con otro bloque, ambos se marcan con borde rojo y aparece la acción "mover al siguiente hueco". Los choques se ven y se resuelven en el momento, no a las 18:00 cuando ya es tarde.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### CAL-044 · Jefe de la semana
**Qué:** En el ritual se elige un objetivo principal de la semana; un banner fijo en la cabecera del calendario muestra su nombre y progreso hasta el domingo. Mantiene la batalla importante a la vista cuando el día a día dispersa.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### CAL-045 · Días con la racha en riesgo
**Qué:** Los días futuros sin ninguna misión programada se marcan con una grieta sutil en la celda: si llegan vacíos, la racha morirá ahí. Permite defender el multiplicador con días de antelación en lugar de descubrirlo esa misma noche.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### CAL-046 · Importación .ics de la universidad
**Qué:** Importar archivos .ics (calendarios de exámenes y horarios que publica la universidad) creando automáticamente eventos jefe y bloques de clase. El semestre entero entra en NIVL en un minuto.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### CAL-047 · Caché offline de Google Calendar
**Qué:** Los eventos importados se guardan en la base local con marca de "última sincronización hace 2 h" y refresco automático al recuperar conexión. El calendario abre instantáneo y funciona en el metro o en la biblioteca sin cobertura.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### CAL-048 · Nudge de intención de implementación
**Qué:** Al crear una misión sin hora, el Sistema sugiere en línea "¿cuándo y dónde la harás?" con un atajo para fijar franja en ese momento. Basado en Gollwitzer: las intenciones de implementación aumentan de forma demostrada el cumplimiento.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### CAL-049 · Plantillas de semana
**Qué:** Guardar el plan sellado como plantilla ("semana normal", "semana de exámenes", "semana de recuperación") y aplicarla en el ritual con un tap, ajustando después. Los domingos buenos se reutilizan en lugar de reconstruirse desde cero.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### CAL-050 · Cronología de mazmorras (gantt ligero)
**Qué:** Vista horizontal con barras de cada mazmorra/proyecto sobre las semanas, hitos como diamantes y la entrega como jefe al final de la barra. Da perspectiva de campaña: cómo se solapan los proyectos con los exámenes del semestre.
**Impacto:** 3/5 · **Esfuerzo:** L · **Fase:** 4

### CAL-051 · Widget de agenda del día
**Qué:** Widget de pantalla de inicio con las próximas misiones y bloques de hoy, su XP y la barra de carga, con la estética de ventana del Sistema. El plan está visible antes de abrir la app, justo donde se decide la procrastinación.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### CAL-052 · Añadir con lenguaje natural
**Qué:** Campo rápido que interpreta "gym mañana 18:00 90min" o "entrega ALG viernes" y crea la misión o el evento ya programado, con vista previa antes de confirmar. Capturar planes al vuelo cuesta menos que apuntarlos en notas.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 6

Total: 52 mejoras.
