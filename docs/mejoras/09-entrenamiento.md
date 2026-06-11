# Gimnasio y entrenamiento físico

> Categoría GYM · backlog NIVL · ordenadas por impacto

### GYM-001 · Registro de sesión en vivo, serie a serie
**Qué:** Pantalla "Incursión activa" que al iniciar el entrenamiento muestra el ejercicio actual con sus series objetivo; cada serie se registra con peso y reps en un check gigante, prellenada con los valores esperados para confirmar en un toque. Al marcar la última serie del último ejercicio, la sesión se cierra sola y dispara el resumen. Es el corazón del módulo: si registrar una serie cuesta más de 2 segundos con las manos sudadas, no se usará.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 3

### GYM-002 · Constructor de rutinas por días
**Qué:** CRUD de rutinas con días de semana asignados (Empuje L-J, Tirón M-V, Pierna X-S…): cada día contiene ejercicios ordenados con series × rango de reps y descanso objetivo. Al guardar, NIVL genera automáticamente las misiones recurrentes de gimnasio en los días correspondientes, reutilizando el motor de misiones existente en vez de duplicarlo.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 3

### GYM-003 · La sesión del día como misión épica del Sistema
**Qué:** El día que toca entrenar, la pantalla Sistema muestra una tarjeta especial "MISIÓN DE ENTRENAMIENTO · Empuje · 6 ejercicios · ~55 min" con borde azul animado; tocar "Entrar" abre la sesión en vivo y completarla marca la misión sola, con la propia sesión registrada como evidencia (sin foto). Una sola fuente de verdad: nunca hay que apuntar el gym dos veces.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 3

### GYM-004 · PRs como eventos épicos del Sistema
**Qué:** Al registrar una serie que supera tu mejor marca histórica, la app lo detecta en el acto y lanza una ventana del Sistema a pantalla completa — "NUEVO RÉCORD · PRESS BANCA 87,5 KG" — con efecto glitch, partículas doradas, números en Orbitron y bonus de XP de FUE fijo por PR. Celebrar el progreso en el instante exacto en que ocurre es el refuerzo más potente que la app puede dar.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 3

### GYM-005 · Sobrecarga progresiva sugerida (doble progresión)
**Qué:** Cada ejercicio define rango de reps (p. ej. 8-12) e incremento mínimo; cuando completas el tope del rango en todas las series, la siguiente sesión llega con el peso ya subido ("El Sistema sugiere: 62,5 kg") y, si fallas dos sesiones seguidas, propone bajar reps o microcargar. Incluye aviso anti-ego: un salto manual >10 % muestra advertencia de riesgo de lesión. Convierte la app de libreta a entrenador: el usuario nunca decide a ciegas cuánto cargar.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 3

### GYM-006 · Temporizador de descanso automático
**Qué:** Al marcar una serie arranca solo la cuenta atrás con la duración configurada por ejercicio (90 s compuestos, 60 s aislamiento por defecto), con anillo de progreso estilo HUD, botones +30 s / saltar y vibración al terminar. Elimina la fricción nº 1 de registrar en el móvil: no hace falta abrir otra app de reloj.
**Impacto:** 5/5 · **Esfuerzo:** S · **Fase:** 3

### GYM-007 · "La última vez": historial inline al registrar
**Qué:** Debajo de cada serie pendiente se muestra en gris lo que hiciste la sesión anterior ("Última: 60 kg × 10 · hace 4 días") y un toque lo copia a la serie actual. Saber exactamente qué número batir convierte cada serie en un microduelo contra tu yo anterior.
**Impacto:** 5/5 · **Esfuerzo:** S · **Fase:** 3

### GYM-008 · Biblioteca de ejercicios precargada
**Qué:** Seed de ~250 ejercicios en Supabase con nombre en español, grupo muscular primario/secundario, equipamiento, patrón de movimiento (empuje, tirón, bisagra…) y diagrama muscular; búsqueda con filtros por músculo/material y favoritos fijables. Es la base de datos que alimenta rutinas, heatmap y progresión: sin ella, todo lo demás son strings sueltos.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 3

### GYM-009 · XP de sesión integrado en FUE con tope anti-farmeo
**Qué:** La sesión otorga XP de FUE = base por dificultad de la misión + bonus por tonelaje relativo a tu media móvil de 4 semanas (cap +50 %) + bonus fijo por cada PR, con tope diario para que no compense hacer 40 series basura. La fórmula se muestra desglosada en el resumen post-sesión, transparente como una hoja de stats de RPG.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 3

### GYM-010 · Jefes de fuerza: metas como combates de jefe
**Qué:** Defines una meta a largo plazo ("Press banca 100 kg") y el Sistema la convierte en un jefe con nombre, arte y barra de HP igual a la distancia entre tu e1RM actual y la meta; cada sesión que sube el e1RM le quita vida, y al llegar a cero se desbloquea cinemática de victoria + título permanente ("Asesino del Caballero de Hierro"). Da un porqué épico a meses de entrenamiento, algo que las rachas por sí solas no consiguen.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 4

### GYM-011 · Racha de gimnasio semanal flexible
**Qué:** La racha de gym se mide por semanas cumplidas (p. ej. 4/4 sesiones) y no por días: los descansos programados no la rompen y mover una sesión dentro de la misma semana tampoco; la penalización dura solo llega si la semana termina incompleta. Alinea la mecánica de racha con cómo funciona el entrenamiento real y evita el efecto "ya la perdí, qué más da" del festivo.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 3

### GYM-012 · Informe de combate post-sesión
**Qué:** Al cerrar la sesión aparece la ventana "INFORME DE COMBATE": duración, tonelaje total, series completadas, PRs logrados, XP ganado con desglose y comparación contra la última vez de esa misma rutina ("+4 % volumen"). Cierra cada entrenamiento con recompensa visual inmediata, el momento exacto donde la ciencia del hábito ancla la dopamina.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### GYM-013 · Cuatro tipos de PR y vitrina de récords
**Qué:** Se rastrean PRs de peso máximo, reps a un peso dado, e1RM y tonelaje de sesión, con una vitrina por ejercicio que lista cada récord con su fecha. Multiplicar los tipos de PR multiplica las celebraciones durante los primeros meses, cuando más refuerzo se necesita.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### GYM-014 · Gráficas de progresión por ejercicio
**Qué:** En la ficha de cada ejercicio, gráfica de e1RM y de tonelaje por sesión (3M/6M/1A) con los PRs marcados como diamantes dorados, renderizada con estética HUD azul sobre fondo oscuro. Ver la pendiente subir es la prueba tangible de que el sistema funciona.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### GYM-015 · e1RM como "nivel de poder" del ejercicio
**Qué:** Cada ejercicio principal muestra su 1RM estimado (fórmula de Epley sobre las mejores series recientes) como "PODER: 112" en Orbitron. Un número único y comparable que sube casi cada semana es mucho más legible y motivador que una tabla de series.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### GYM-016 · Modo gimnasio: UI a prueba de sudor
**Qué:** Durante la sesión: pantalla siempre encendida (expo-keep-awake), tipografía y botones al doble de tamaño, objetivos táctiles ≥56 px y steppers de ±2,5 kg / ±1 rep para no abrir nunca el teclado. Diseñado para usarse con una mano entre series, no sentado en el sofá.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### GYM-017 · Registro offline-first con sincronización
**Qué:** La sesión se escribe primero en almacenamiento local (SQLite/AsyncStorage) y se sincroniza a Supabase al recuperar red, con resolución last-write-wins y badge de estado de sync. Los gimnasios de sótano sin cobertura no pueden costarte un entrenamiento registrado.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 3

### GYM-018 · Plantillas de rutina probadas
**Qué:** Galería de plantillas precargadas — Full Body 3 días, Upper/Lower, Push/Pull/Legs, 5/3/1, GZCLP — descritas con nivel recomendado y días/semana, importables y editables como rutina propia. Arranca el módulo en dos minutos sin diseñar nada y educa de paso sobre programación seria.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### GYM-019 · Edición en vivo: sustituir, saltar o reordenar
**Qué:** Con la máquina ocupada, mantener pulsado un ejercicio permite sustituirlo (la app sugiere alternativas del mismo patrón y músculo desde la biblioteca), saltarlo o arrastrarlo a otra posición; el cambio se guarda solo para hoy o para siempre. Sin esto, el plan rígido muere el primer día de gimnasio lleno.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### GYM-020 · Semana de regeneración (deload) guiada
**Qué:** Cada 6-8 semanas de progresión, o cuando se acumulan señales de fatiga (RPE alto sostenido, fallos repetidos), el Sistema propone una "Semana de Regeneración" con pesos al 60 % y la mitad de volumen, prellenando las sesiones; cuenta como semana de racha completa y se narra como recargar maná, no como aflojar. Enseña que descansar es parte del programa y previene el abandono por agotamiento.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### GYM-021 · Detección de estancamiento con plan de acción
**Qué:** Tres sesiones sin superar un ejercicio disparan una alerta del Sistema con opciones concretas: microcarga, cambiar el rango de reps, sustituir por una variante o deload puntual; eliges una y la app reprograma el ejercicio sola. Convierte la frustración del estancamiento — la principal causa de abandono del nivel intermedio — en una decisión guiada.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### GYM-022 · Duelo contra tu sombra
**Qué:** Al estilo de las sombras de Solo Leveling: durante la sesión, una barra fantasma púrpura muestra en vivo el tonelaje acumulado de tu mejor sesión histórica de esa misma rutina, y al terminar sabes si la has "extraído" (superado). Correr contra tu propio fantasma convierte un miércoles gris en una carrera.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 5

### GYM-023 · Fotos de progreso con comparador antes/después
**Qué:** Misión mensual de foto (frente/perfil/espalda) reutilizando la cámara de evidencias, guardada en bucket privado de Storage; visor con slider antes/después y selector de fechas, y como iteración posterior un timelapse autogenerado. El espejo diario engaña; dos fotos separadas 90 días, no.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### GYM-024 · Medidas corporales con misión quincenal
**Qué:** Registro de peso, cintura, pecho, brazo y muslo (lista configurable) con una misión quincenal de medición que otorga XP de FUE; cada medida con su gráfica y delta desde el punto de partida. Captura el progreso que la báscula sola no ve, clave en recomposición corporal.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### GYM-025 · Mapa de calor muscular semanal
**Qué:** Silueta humanoide estilo holograma azul que colorea cada grupo muscular según las series efectivas de los últimos 7 días, con avisos de desequilibrio ("Pierna: 4 series esta semana, objetivo 12"). Hace visible de un vistazo qué entrenas de más y qué estás abandonando.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### GYM-026 · Calculadora de discos
**Qué:** Tocar el peso objetivo abre un gráfico de la barra con los discos exactos a cargar por lado, según tu configuración de barra (20/15/10 kg) y discos disponibles. Elimina la aritmética mental entre series y los errores de carga.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### GYM-027 · Series de calentamiento autogeneradas
**Qué:** Para el primer ejercicio pesado del día, la app genera la rampa de aproximación (barra×10 → 40 %×8 → 60 %×5 → 80 %×3) a partir del peso de trabajo, como series plegables que no cuentan para el volumen. Estandariza el calentamiento y reduce el riesgo de lesión sin tener que pensar.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### GYM-028 · Prueba de rango: test de 1RM guiado
**Qué:** Evento opcional trimestral tipo "examen de rango de cazador": protocolo guiado de intentos con saltos de carga seguros y descansos largos cronometrados, registro del 1RM real y ceremonia de resultado que actualiza tu nivel de poder. Un hito ritual y seguro para medir fuerza real, con la épica de los exámenes de rango del anime.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### GYM-029 · Logros de hierro
**Qué:** Set de logros específicos de gimnasio dentro del módulo de logros de fase 4: "Club de los 100" (sentadilla 100 kg), "1.000 series", "52 semanas de hierro", "Madrugador" (10 sesiones antes de las 8:00), cada uno con insignia hexagonal coleccionable. Metas intermedias para las épocas en que los PRs escasean.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### GYM-030 · Informe semanal de entrenamiento
**Qué:** Cada domingo, dentro del módulo de informes, una sección de gym en formato "parte de guerra": sesiones cumplidas vs plan, tonelaje total, PRs de la semana, grupo muscular más y menos trabajado y tendencia de 4 semanas. La revisión semanal es el ritual que consolida la identidad de "yo soy alguien que entrena".
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### GYM-031 · Modo recuperación por lesión o enfermedad
**Qué:** Activable con un toque: congela la racha y las misiones de gym sin penalización, ofrece misiones sustitutas suaves (movilidad, rehabilitación, caminar) que mantienen viva la FUE a ritmo reducido y programa una fecha de revisión. La lesión es el asesino nº 1 del hábito de gimnasio; el Sistema debe protegerte, no castigarte por ella.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### GYM-032 · Rutina en el calendario semanal
**Qué:** La vista de calendario de fase 2 pinta los días de entrenamiento con icono y nombre de la rutina (Empuje, Tirón, Pierna…) y permite arrastrar una sesión a otro día de la misma semana sin romper la racha. Planificar el microciclo de un vistazo, junto a exámenes y mazmorras.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### GYM-033 · Notificación pre-entreno con la rutina del día
**Qué:** A la hora configurada de cada día de gym, notificación local: "Incursión a las 18:00 · Pierna · 7 ejercicios · última vez +2,5 kg en sentadilla", con deep link directo a la sesión en vivo. La intención de implementación ("a qué hora y qué haré exactamente") es de lo más respaldado por la ciencia del hábito.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### GYM-034 · Entrenador del Sistema (IA)
**Qué:** Análisis mensual por LLM de tus logs (progresión, adherencia, RPE, desequilibrios del heatmap) que el Sistema entrega como mensaje de mentor con 2-3 ajustes concretos a la rutina, aplicables con un toque. La sensación Solo Leveling definitiva: el Sistema te conoce y te programa el entrenamiento.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 7

### GYM-035 · Supersets y circuitos
**Qué:** En el constructor se pueden agrupar dos o más ejercicios como superserie o circuito; en sesión se alternan automáticamente y el descanso solo corre al cerrar el grupo completo. Necesario para accesorios eficientes y para días con poco tiempo.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### GYM-036 · RPE/RIR opcional por serie
**Qué:** Selector rápido de RIR (0-4+) al marcar cada serie, desactivable en ajustes; alimenta la detección de fatiga del deload y ajusta la sugerencia de descanso (RIR 0 → +30 s). Datos de esfuerzo subjetivo para quien los quiere, cero fricción para quien no.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### GYM-037 · Series por tiempo
**Qué:** Las series pueden medirse en segundos en lugar de reps (plancha, farmer walk, colgarse de la barra), con cronómetro integrado en la propia fila de la serie. Sin esto, medio entrenamiento de core es imposible de registrar.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### GYM-038 · Notas ancladas por ejercicio
**Qué:** Campo de nota persistente que reaparece cada vez que haces ese ejercicio ("asiento en el 4", "agarre ancho", "molestia en hombro: no bajar del todo"). Memoria externa barata que ahorra los dos minutos de recordar ajustes de máquina cada semana.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### GYM-039 · Registro en dos toques
**Qué:** Botón "=" que repite los valores de la serie anterior y acción "Repetir última sesión" que precarga el entrenamiento pasado completo para solo ir confirmando. Optimiza el caso más común: hoy igual que el martes pasado pero con una rep más.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### GYM-040 · Ejercicios personalizados
**Qué:** Alta de ejercicios propios con nombre, músculos, equipamiento y foto opcional, integrados en búsqueda, heatmap y progresión exactamente igual que los de serie. Cubre las máquinas raras de tu gimnasio sin esperar a una biblioteca oficial.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### GYM-041 · Unidades y microcargas configurables
**Qué:** Ajuste de kg/lb y de incremento mínimo por ejercicio o por tipo (2,5 kg barra, 5 kg máquinas, 1 kg mancuernas si hay microdiscos), que todas las sugerencias de progresión respetan. Una sugerencia imposible de montar en tu gimnasio destruye la confianza en el Sistema.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### GYM-042 · Rutina exprés para semanas de exámenes
**Qué:** Cada rutina puede tener una variante de 30 minutos (solo básicos, 2 series) activable con un toque o autosugerida en semanas marcadas como de exámenes; cuenta para la racha con XP reducido. "Algo cuenta": la versión mínima mantiene el hábito vivo cuando la ingeniería aprieta.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### GYM-043 · Perfiles de equipamiento
**Qué:** Perfiles "Gym uni", "Casa" y "Vacaciones" con el material disponible en cada uno; al cambiar de perfil, la app sustituye automáticamente los ejercicios imposibles por alternativas equivalentes de la biblioteca. Agosto en el pueblo deja de ser una excusa.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### GYM-044 · Peso corporal con media de 7 días
**Qué:** Registro diario opcional de peso en 5 segundos desde la pantalla Sistema, con gráfica que destaca la media móvil semanal y la flecha de tendencia en lugar del dato del día. Educa contra el pánico a las fluctuaciones de agua y conecta con el módulo de medidas.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### GYM-045 · Objetivos de medidas corporales
**Qué:** Metas sobre medidas ("brazo 40 cm", "cintura 80 cm") con barra de progreso desde el punto de partida y estimación honesta de ritmo alcanzable; al cumplirse, celebración de evento del Sistema. La estética también merece sus quests, no solo la barra de fuerza.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### GYM-046 · Tarjeta de PR compartible
**Qué:** Tras un PR, botón "Compartir" que renderiza una imagen 9:16 con la estética del Sistema (esquinas cortadas, Orbitron, "NUEVO RÉCORD · 100 KG") sin datos privados, lista para Instagram o WhatsApp. El refuerzo social externo es gratis y hace marketing solo.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### GYM-047 · Temporizador visible fuera de la app
**Qué:** La cuenta atrás de descanso sigue visible con el móvil bloqueado: notificación persistente con progreso en Android, Live Activity en iOS, y pitido más vibración "del sistema" al llegar a cero. Permite guardar el móvil entre series sin perder el aviso.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### GYM-048 · Registro manual de cardio
**Qué:** Tipo de sesión "cardio" (correr, bici, remo, andar) con solo tres campos — duración, distancia y esfuerzo percibido — que otorga XP reducido configurable hacia FUE o VIT. Entrada manual ultrarrápida, sin depender de relojes ni integraciones.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### GYM-049 · Progresión de calistenia y lastre
**Qué:** Para ejercicios de peso corporal, el campo de peso registra lastre añadido (o asistencia negativa de banda/máquina), y la progresión sugiere el salto reps→lastre con e1RM calculado sobre peso corporal + lastre. Dominadas y fondos progresan tan medibles como el press banca.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### GYM-050 · Periodización por bloques
**Qué:** Planificador de mesociclos: bloques de acumulación, intensificación y peaking de N semanas con objetivos de volumen e intensidad distintos, y deloads colocados automáticamente al final de cada bloque. La apuesta avanzada para cuando la doble progresión lineal se agote y el cazador ya sea intermedio.
**Impacto:** 3/5 · **Esfuerzo:** L · **Fase:** 6

### GYM-051 · Registro por voz entre series
**Qué:** Botón de micrófono en sesión: dices "ochenta por ocho" y la serie queda registrada (speech-to-text en el dispositivo + parser de patrones peso×reps, con confirmación visual antes de guardar). Con guantes, magnesio o las manos ocupadas, la voz gana al teclado.
**Impacto:** 3/5 · **Esfuerzo:** L · **Fase:** 6

### GYM-052 · Exportación CSV del historial
**Qué:** Exportar entrenamientos, medidas y PRs a CSV/JSON desde ajustes, compartible por el share sheet del sistema. Para un ingeniero, poder analizar sus propios datos en una hoja de cálculo es confianza y propiedad del dato.
**Impacto:** 2/5 · **Esfuerzo:** S · **Fase:** 6

Total: 52 mejoras.
