# Mazmorras: proyectos y tareas

> Categoría MAZ · backlog NIVL · ordenadas por impacto

### MAZ-001 · Mazmorras: proyectos con rango E→S
**Qué:** Nueva entidad "mazmorra" en Supabase (nombre, descripción, rango E–S, stat principal, deadline opcional, estado: explorando / en combate / conquistada / fallida) con CRUD completo y pestaña propia. Cada proyecto real (asignatura, práctica, app, reto) se abre como una puerta del Sistema: convierte "tengo que ponerme con Redes" en "ha aparecido una puerta de rango C". Es el cimiento de toda la fase 2.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 2

### MAZ-002 · Monstruos: tareas con dificultad y golpe final
**Qué:** Cada tarea de la mazmorra es un monstruo con nombre, dificultad (reutiliza trivial→épica y su tabla de XP), deadline opcional y estado. Completarla dispara una animación corta de "golpe final" con XP flotante, usando el mismo pipeline de recompensa que las misiones diarias para que matar tareas se sienta tan bien como cerrar hábitos.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### MAZ-003 · Jefes de hito con barra de vida
**Qué:** Los hitos del proyecto ("entregar práctica 2", "memoria terminada") se modelan como jefes con barra de vida: su HP es la suma del XP de los monstruos vinculados y baja con cada tarea completada. El jefe final cierra la mazmorra y solo cae cuando su barra llega a 0 y lo rematas manualmente. Visualización de progreso mucho más visceral que un porcentaje gris.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### MAZ-004 · Cierre épico con reparto de botín
**Qué:** Al matar al jefe final se lanza la secuencia "MAZMORRA CONQUISTADA" a pantalla completa con esquinas cortadas: recuento animado del botín (XP de cierre, bonus por acabar antes de deadline, monstruos abatidos, días de campaña). Cerrar un proyecto debe ser el momento más dopaminérgico de la app, no un toast.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### MAZ-005 · Pantalla Puertas: lobby de mazmorras
**Qué:** Vista principal del módulo: cada mazmorra activa es un portal con glow del color de su rango (E apagado → S dorado/púrpura), % de avance, días hasta deadline y nº de monstruos vivos, ordenadas por urgencia. Tocar la puerta entra en la mazmorra. Sustituye la típica lista de proyectos por algo que apetece abrir cada día.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### MAZ-006 · Misiones urgentes por deadline con cuenta atrás
**Qué:** Cuando un monstruo o jefe con deadline a ≤48 h sigue vivo, el Sistema genera automáticamente una "MISIÓN URGENTE" en la pantalla Sistema con borde rojo #FF5C6B pulsante y cuenta atrás HH:MM en vivo. Replica las quests urgentes del anime y garantiza que ninguna entrega se escape aunque ese día no abras el módulo de mazmorras.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### MAZ-007 · Objetivo de incursión del día en la pantalla Sistema
**Qué:** Cada mañana el Sistema propone 1–3 monstruos como "incursión de hoy" (priorizando deadlines y mazmorras en riesgo); el usuario confirma o cambia la selección y esas tareas aparecen junto a las misiones diarias con +15% de XP. Une hábitos y proyectos en una única pantalla de "qué toca hoy": es el mayor multiplicador de uso diario del módulo.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### MAZ-008 · Kanban del cazador
**Qué:** Vista kanban dentro de la mazmorra con columnas "Por matar / En combate / Abatidos", drag & drop con haptics y reordenación manual. Las tarjetas usan la estética de ventana del Sistema con su mini barra de vida. Para el usuario es su tablero de proyecto; para el juego, el mapa de la sala.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 2

### MAZ-009 · Plantilla de mazmorra: Examen
**Qué:** Al crear una mazmorra tipo "Examen" introduces asignatura, fecha y lista de temas, y se generan monstruos con repaso espaciado hacia atrás desde la fecha (resumen por tema, ejercicios, simulacro, repaso final), cada uno con su deadline. Aplica spaced repetition real sin que el usuario tenga que saber qué es, y elimina la fricción de planificar un examen desde cero.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### MAZ-010 · Asistente de despiece de jefes
**Qué:** Wizard al crear un jefe que obliga a trocearlo en monstruos de ≤1 día de trabajo, con aviso si uno parece demasiado grande ("este monstruo es de rango superior: divídelo"). La ciencia de la procrastinación es clara: las tareas grandes y difusas no se empiezan; el despiece forzado es la mejor arma contra el TFG infinito.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### MAZ-011 · Monstruos de asedio: recurrentes que dañan al jefe
**Qué:** Un monstruo puede marcarse como "asedio": se convierte en misión recurrente del motor de hábitos existente (p. ej. "escribir memoria · 25 min" cada día) y cada check diario resta HP al jefe vinculado. Conecta hábitos con proyectos: los grandes objetivos se ganan a base de constancia y el usuario lo ve literalmente en la barra de vida del jefe.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 3

### MAZ-012 · Puerta roja: alarma de ritmo insuficiente
**Qué:** Si la velocidad real (monstruos/día) no basta para limpiar la mazmorra antes de su deadline, la puerta se tiñe de rojo y muestra el dato accionable: "necesitas 2,3 tareas/día; llevas 0,8". Convierte la ansiedad difusa de "voy mal" en un número concreto, cuando aún queda margen para reaccionar.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 3

### MAZ-013 · HP global de la mazmorra y burn-down
**Qué:** La mazmorra tiene una barra de vida total (suma del XP de todos sus monstruos) siempre visible en el header, y en su ficha un burn-down disfrazado de "historial de daño" con la línea de ritmo necesario superpuesta. El progreso agregado de semanas se ve de un vistazo y alimenta la puerta roja (MAZ-012).
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### MAZ-014 · Esbirros: subtareas con checklist
**Qué:** Cada monstruo admite subtareas tipo checklist ("esbirros") sin XP propio pero con micro-progreso visual: la barra del monstruo baja proporcionalmente al ir marcándolos. Granularidad real sin inflar la economía de XP ni saturar el tablero.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### MAZ-015 · Captura rápida de monstruos
**Qué:** Botón flotante global que abre un input de una línea: escribes el monstruo, eliges mazmorra con un chip y guardas en menos de 5 segundos. Si apuntar una tarea cuesta más que olvidarla, el sistema pierde: la captura sin fricción es lo que mantiene el tablero fiel a la vida real.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### MAZ-016 · Multiplicadores de XP por rango y bonus de cierre
**Qué:** Tabla concreta: las tareas de una mazmorra rinden ×1,0 (E), ×1,1 (D), ×1,25 (C), ×1,4 (B), ×1,6 (A) y ×2,0 (S); cerrar la mazmorra antes de su deadline paga además un bonus del 30% del XP total generado en ella. Recompensa terminar proyectos, no solo empezarlos: ataca de frente el cementerio de side-projects al 80%.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### MAZ-017 · Rango sugerido automáticamente
**Qué:** Al crear la mazmorra, el Sistema propone su rango E→S a partir del nº de monstruos, la dificultad media y la presión de deadline, editable y con justificación visible ("32 tareas en 20 días → rango B"). Evita el auto-engaño (todo rango S) y la infravaloración, manteniendo la economía sana.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### MAZ-018 · Raid semanal: contrato de cinco monstruos
**Qué:** Cada lunes puedes firmar una "raid": eliges 3–5 monstruos de cualquier mazmorra como objetivos de la semana; abatirlos todos antes del domingo 23:59 abre un cofre de raid con XP extra. Es el sprint semanal de toda la vida con contrato firmado ante el Sistema: el compromiso explícito y acotado multiplica la tasa de finalización.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### MAZ-019 · Raid autopropuesta del domingo
**Qué:** El domingo a las 20:00 el Sistema redacta la raid de la próxima semana combinando deadlines próximos, jefes debilitados y mazmorras dormidas, y la presenta para aceptar o editar en dos toques. Reduce a cero el coste de planificar la semana, el punto exacto donde mueren la mayoría de sistemas de productividad.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### MAZ-020 · Plantilla de mazmorra: TFG
**Qué:** Plantilla de rango S con jefes por fase (propuesta, estado del arte, desarrollo, experimentos, memoria, defensa), monstruos típicos ya despiezados y campos para las fechas oficiales de la universidad. El proyecto más intimidante de la carrera llega con el mapa dibujado de antemano.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### MAZ-021 · Plantilla de mazmorra: side-project
**Qué:** Plantilla para proyectos de código con jefes "Idea validada → MVP → v1 desplegada → Publicado" y monstruos semilla (repo, diseño, features core, deploy, post de lanzamiento). Empuja el patrón sano de shippear pronto en vez de refactorizar eternamente.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### MAZ-022 · Arquitecto del Sistema: generar mazmorra con IA
**Qué:** Pegas el temario de la asignatura, el enunciado de la práctica o la descripción del proyecto y un LLM genera la mazmorra completa (jefes, monstruos despiezados, dificultades y fechas sugeridas) en una pantalla de revisión antes de confirmar. Planificar un examen pasa de 30 minutos a 30 segundos; apuesta grande con dependencia de backend propio.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 7

### MAZ-023 · Push de jefe debilitado
**Qué:** Cuando a un jefe le queda ≤20% de vida, notificación única: "El jefe de [mazmorra] está debilitado. Remátalo." Aprovecha el efecto goal-gradient (aceleramos cerca de la meta): es el empujón más barato y efectivo para cerrar hitos que llevan días clavados al 90%.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### MAZ-024 · Zona de caza: monstruos errantes
**Qué:** Espacio para tareas sueltas sin proyecto (burocracia, recados, emails) presentadas como monstruos errantes; cada 5 abatidos sueltan un mini-cofre de XP. Da un hogar a lo que no encaja en ninguna mazmorra para que no se fugue a otra app de notas, y gamifica justo los recados más aburridos.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### MAZ-025 · Ataque de apertura
**Qué:** Toda mazmorra nueva exige definir su "ataque de apertura": un primer monstruo de ≤15 minutos (crear el repo, abrir el PDF del temario, escribir el índice) que el Sistema ofrece ejecutar nada más crear la puerta. Vencer la energía de activación del primer paso es el predictor nº 1 de que un proyecto arranca de verdad.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### MAZ-026 · Invocar horda: importar monstruos pegando texto
**Qué:** Botón "Invocar horda" en cualquier mazmorra: pegas texto multilínea (lista de Notion, apuntes, enunciado) y cada línea se convierte en un monstruo editable en una pantalla de revisión previa. Migrar un proyecto existente a NIVL cuesta 20 segundos en vez de 20 minutos.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### MAZ-027 · Daño parcial en monstruos grandes
**Qué:** Los monstruos difíciles/épicos permiten registrar daño parcial (25/50/75%) sobre su propia barra de vida, con el XP completo al rematarlos. Elimina el todo-o-nada que castiga las sesiones donde avanzaste de verdad pero no terminaste: una de las mayores fugas de motivación en tareas largas.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### MAZ-028 · Salas encadenadas: dependencias con niebla de guerra
**Qué:** Un monstruo puede bloquear a otros; los bloqueados se muestran en silueta tras una puerta interior con niebla y se revelan con micro-animación al desbloquearse. Modela dependencias reales ("no puedo testear sin la API") y añade la sensación física de irse abriendo paso por la mazmorra.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 3

### MAZ-029 · Reenganche de mazmorra dormida
**Qué:** Si una mazmorra en combate pasa ≥5 días sin actividad, notificación suave ("La puerta de [X] se está cerrando…") que abre directamente su monstruo más pequeño como propuesta de reentrada. Se vuelve por una acción mínima concreta, no por culpa: el Sistema nunca reprocha, siempre ofrece la pieza fácil.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### MAZ-030 · Límite WIP: tres puertas en combate
**Qué:** Máximo 3 mazmorras en estado "en combate"; el resto quedan en "explorando" (visibles, sin presión de ritmo ni misiones urgentes). Activar otra exige pausar una, con un diálogo que muestra el coste con honestidad. El límite WIP de kanban aplicado a la vida: protege el foco del estudiante que lo quiere todo a la vez.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### MAZ-031 · Mazmorra fallida y reapertura
**Qué:** Si la deadline vence con el jefe final vivo, la mazmorra pasa a "fallida": puerta agrietada en el historial y pérdida del bonus de cierre, pero todo el XP de monstruos ya abatidos se conserva. Reabrirla con nueva fecha cuesta una pequeña tasa de XP. Castigo legible pero no devastador: debe doler perder el bonus, no dar miedo crear mazmorras ambiciosas.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### MAZ-032 · Forecast de cierre
**Qué:** Cada mazmorra muestra su fecha estimada de conquista calculada con la velocidad real de las últimas 2 semanas ("a tu ritmo: 12 de julio"), comparada con la deadline. Es la versión informativa y siempre visible de la puerta roja: feedback honesto continuo sin esperar a que salte la alarma.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### MAZ-033 · Contrato del cazador: apuesta de XP
**Qué:** Al iniciar una mazmorra puedes firmar un contrato opcional apostando X XP a que la cierras antes de una fecha: si cumples, recuperas la apuesta +50%; si no, se pierde. Commitment device puro basado en aversión a la pérdida, siempre opt-in para no envenenar la relación con la app.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### MAZ-034 · Drop raro al abatir monstruos
**Qué:** Al completar cualquier tarea de mazmorra hay ~6% de probabilidad de drop extra ("¡Botín raro!": XP adicional o un fragmento de cofre) con animación y sonido propios. El refuerzo intermitente de razón variable es el mecanismo de enganche más potente que existe; aquí se pone al servicio de hacer los deberes.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### MAZ-035 · Modo combate: temporizador de incursión
**Qué:** Desde un monstruo, botón "Entrar en combate": temporizador de 25 o 50 minutos a pantalla completa con la tarjeta del monstruo, tema púrpura y bloqueo suave de distracciones; al sonar, registras el daño hecho (parcial o golpe final). Ritualiza la sesión de trabajo profundo dentro de la ficción, sin tocar el calendario.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### MAZ-036 · Duplicar mazmorra y plantillas propias
**Qué:** Cualquier mazmorra puede duplicarse o guardarse como plantilla personal con sus jefes y monstruos sin fechas. La segunda convocatoria del mismo examen o el siguiente proyecto parecido se planifican en un toque, reutilizando lo aprendido en el anterior.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### MAZ-037 · Cofres con rareza según el rendimiento
**Qué:** El botín de cierre llega en cofre común/raro/épico/legendario según el rango de la mazmorra, el % de monstruos abatidos y el cumplimiento de la deadline; los cofres contienen XP, títulos y cosméticos del sistema de logros. Hace que importe la calidad de la ejecución, no solo el cierre. Depende del inventario de recompensas de fase 4.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### MAZ-038 · Guarida del jefe
**Qué:** Pantalla de detalle del hito con estética de boss room (fondo púrpura #8A76E8, marco propio): barra de vida grande, fecha, monstruos vinculados ordenados y daño histórico. Tocar a un jefe desde cualquier vista lleva aquí; los hitos dejan de ser una fila más de la lista.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 2

### MAZ-039 · Escudo de deadline
**Qué:** Cada mazmorra incluye un único "escudo": aplazar su deadline 48 h, activable solo antes de incumplirla. Reconoce que la vida pasa (exámenes movidos, enfermedad) y corta la espiral de abandono post-fallo, sin que aplazar sea gratis ni infinito.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### MAZ-040 · Affixes de monstruos
**Qué:** Etiquetas con efecto mecánico: "Blindado" (tarea temida, +20% XP), "Veloz" (≤15 min, cuenta doble para el cofre de la zona de caza), "Venenoso" (pospuesto dos veces: bloquea el bonus de incursión del día hasta abatirlo). Añade textura de juego y empuja contra los dos enemigos reales: la tarea temida y la procrastinada.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### MAZ-041 · Evolución por antigüedad
**Qué:** Un monstruo que lleva ≥7 días pospuesto "evoluciona": cambia de aspecto, sube +15% su XP y entra con prioridad en la propuesta de incursión diaria. Convierte la tarea podrida —que normalmente genera ceguera y culpa— en la presa más jugosa del tablero.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### MAZ-042 · Puntos de esfuerzo y calibración
**Qué:** Estimación opcional S/M/L por monstruo; al rematarlo respondes con un toque si costó más o menos de lo previsto, y la mazmorra ajusta su forecast con tu sesgo histórico ("sueles infraestimar ×1,4"). Entrena la habilidad de estimar: oro puro para un futuro ingeniero.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### MAZ-043 · Salón de conquistas
**Qué:** Historial de mazmorras conquistadas y falladas con sus stats de campaña (duración, monstruos, XP, jefes) y archivado automático a los 7 días del cierre para mantener limpio el lobby. Releer victorias pasadas es munición motivacional para los días bajos.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### MAZ-044 · Retro del cazador
**Qué:** Al conquistar o fallar una mazmorra, mini-retro de 3 preguntas con chips rápidos (qué funcionó, qué falló, qué cambiarás) guardada en el Salón de conquistas y recompensada con XP de PER. La reflexión post-proyecto es de lo poco con evidencia sólida para mejorar la siguiente ejecución.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### MAZ-045 · Enlaces y notas en monstruos
**Qué:** Campo de notas y lista de enlaces por monstruo (repo de GitHub, doc de Drive, PDF del campus virtual) que se abren desde la propia tarjeta. La tarea vive donde está el material de trabajo: menos fricción para empezar y más razones para tener NIVL abierta mientras se estudia.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### MAZ-046 · Swipe para matar o posponer
**Qué:** En listas y kanban: swipe a la derecha = golpe final (completar con animación), swipe a la izquierda = posponer a mañana o mover de columna. Gestionar 10 monstruos debe costar 10 gestos: la velocidad de gestión decide si el tablero se mantiene vivo.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### MAZ-047 · Agrupación por asignatura o área
**Qué:** Campo "área" (Redes, IA, Gym, Personal…) con color e icono, filtros en el lobby de Puertas y agrupación opcional. Con 5–6 asignaturas por cuatrimestre más proyectos propios, el lobby necesita un eje de organización que no sea solo la urgencia.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### MAZ-048 · Onboarding del módulo guiado por el Sistema
**Qué:** La primera vez que entras en Mazmorras, el Sistema te guía con sus ventanas de diálogo a abrir tu primera puerta desde una plantilla y a matar tu primer monstruo en menos de 2 minutos. Un módulo con esta carga conceptual (rangos, jefes, raids) necesita un tutorial jugado, no un texto explicativo.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### MAZ-049 · Mazmorra relámpago
**Qué:** Botón "Puerta relámpago": el Sistema improvisa una mini-mazmorra de 24 h con 3 monstruos sacados de la zona de caza y de mazmorras dormidas; limpiarla antes de medianoche da un cofre pequeño. Loop de "día perfecto" para sábados sin plan y para reengancharse tras una mala semana.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 6

### MAZ-050 · Mapa de salas de la mazmorra
**Qué:** Vista alternativa al kanban: las tareas como nodos conectados en un mapa de mazmorra que se ilumina al avanzar, con el jefe al fondo; las dependencias de MAZ-028 dibujan los pasillos. Apuesta visual grande para cuando el módulo esté maduro: el proyecto como un lugar que se conquista.
**Impacto:** 3/5 · **Esfuerzo:** L · **Fase:** 6

### MAZ-051 · Widget de puerta activa
**Qué:** Widget de pantalla de inicio con la mazmorra más urgente: rango, HP del jefe, días de margen y el siguiente monstruo, con deep-link directo a esa tarea. El proyecto te mira desde el móvil aunque no abras NIVL. Depende de la infraestructura de widgets de fase 5.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### MAZ-052 · Combate con sonido y partículas
**Qué:** Capa sensorial del módulo: SFX de impacto al abatir un monstruo, rugido grave cuando el jefe cae del 50% y del 20%, partículas azul cazador #37C8F0 al conquistar la mazmorra; todo desactivable en ajustes. El game feel AAA vive en estos 200 ms de feedback. Se monta sobre el sistema de sonido/partículas de fase 5.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

Total: 52 mejoras.
