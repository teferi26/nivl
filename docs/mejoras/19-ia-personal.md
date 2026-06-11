# IA personal: el sistema piensa

> Categoría AIA · backlog NIVL · ordenadas por impacto

### AIA-001 · Generador de misiones desde un objetivo en lenguaje natural
**Qué:** Ventana del Sistema donde escribes "quiero correr una 10K en mayo" o "sacar un 9 en Redes" y Claude devuelve un plan progresivo: misiones semanales con stat, dificultad, días y fecha límite, editables antes de aceptarlas con un "firmar contrato". Usa tool use con esquema JSON validado (Zod) para que cada misión caiga directamente en el CRUD existente sin pantallas intermedias. Convierte la app de tracker pasivo en coach que planifica por ti: tú pones la ambición, el Sistema la traduce a hábitos diarios.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 2

### AIA-002 · Chat con el Sistema
**Qué:** Pantalla de chat con estética de ventana del Sistema (esquinas cortadas, respuesta en streaming con efecto de tipeo) donde hablas con "El Sistema": preguntar por qué bajaste de nivel, pedir consejo o desahogarte tras un mal día, con acceso directo desde cualquier misión vía pulsación larga. Claude recibe como contexto nivel, rango, stats, rachas y los últimos 14 días de actividad, y responde siempre en la persona canónica. Tener a quién rendir cuentas es uno de los predictores más fuertes de adherencia a hábitos.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 3

### AIA-003 · El chat tiene manos: acciones por tool use
**Qué:** El chat ejecuta acciones reales mediante tool use: crear misiones, reprogramarlas, marcar completadas, consultar historial o abrir una mazmorra ("Sistema, muéveme el gym a mañana y crea una misión de repaso de Sistemas Operativos"). Cada acción muestra una tarjeta de confirmación con el cambio exacto antes de aplicarse. La conversación se convierte en el método de entrada más rápido de la app: cero fricción entre intención y misión.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 3

### AIA-004 · Radar de riesgo de abandono
**Qué:** Job diario que calcula un score de riesgo combinando señales: caída de la tasa de cumplimiento, días sin abrir la app, rachas rotas, misiones nuevas abandonadas en menos de 2 semanas (fiebre del novato) y hora de completado cada vez más tardía. Al superar el umbral, Claude elige una intervención dentro de la app: reducir carga sugerida, proponer misión mínima o iniciar una conversación de chequeo. Atacar el abandono cuando empieza, y no cuando ya ocurrió, es la diferencia entre un tracker más y uno que retiene años.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### AIA-005 · Ajuste dinámico de dificultad
**Qué:** Análisis semanal por misión: si fallas más del 40% propone bajar dificultad/XP o trocearla; si llevas 3 semanas al 100% propone subirla de rango ("esta misión ya no te hace crecer"). Cada propuesta llega como tarjeta aceptar/rechazar con el porqué visible y los datos que la justifican. Mantiene cada hábito en la zona de desafío óptimo (flow), que es donde la motivación sobrevive a largo plazo.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### AIA-006 · Protocolo de retorno del cazador
**Qué:** Tras 3 o más días de ausencia total, el Sistema no castiga: genera un plan de reentrada de 3 días con versiones reducidas de tus misiones clave y una breve narrativa de regreso ("el portal se reabre"), congelando penalizaciones mientras dura el protocolo. La culpa tras una recaída es la principal causa de abandono definitivo en habit trackers; esto la convierte en un arco de redención jugable.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### AIA-007 · Planificador de exámenes con repaso espaciado
**Qué:** Introduces fechas de exámenes y temario (texto o foto) y Claude planifica hacia atrás misiones INT con repaso espaciado e intercalado real, ajustando además la carga del resto de stats durante esas semanas. Cada examen se convierte en un jefe de mazmorra con cuenta atrás visible. Para un estudiante de ingeniería, esta es la feature que paga la app entera.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### AIA-008 · Centinela de evidencias con visión
**Qué:** Cada foto de evidencia pasa por Claude Vision con una pregunta cerrada: ¿es coherente con la misión? (foto del gym para "entrenar pierna", plato real para "comer limpio"). Si es coherente valida el bonus del +25% en silencio; si es dudosa la marca como "evidencia cuestionada" sin bloquear, con apelación en un toque. Protege la integridad de la economía: si hacerse trampas es trivial, todo el juego pierde sentido.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### AIA-009 · Informe semanal narrado
**Qué:** El informe de fase 4 deja de ser una tabla: Claude (modelo potente, una llamada por semana) escribe una crónica de 300-400 palabras estilo Solo Leveling con tus datos reales —las misiones conquistadas, la racha defendida, el stat que despertó— y cierra con el reto concreto de la próxima semana. Releer tu semana como epopeya crea el ritual de domingo que ancla la reflexión semanal, el hábito que sostiene a todos los demás.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 4

### AIA-010 · Persona canónica del Sistema
**Qué:** System prompt compartido que define al Sistema de una vez: solemne, preciso, segunda persona, nunca humillante tras un fallo (firme con el dato, neutro con la persona), vocabulario fijo (cazador, misión, mazmorra, rango) y prohibiciones explícitas (sin emojis, sin coleguismo). Versionado en el repo con una suite de casos dorados para detectar regresiones de tono al cambiar prompts o modelo. Una sola voz coherente en todas las features es lo que hace creíble la fantasía.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### AIA-011 · Proxy seguro para la API de Claude
**Qué:** Supabase Edge Function como único punto de salida hacia Anthropic: la API key nunca viaja en el bundle de Expo, cada llamada se registra (tokens, coste, feature) en una tabla de uso y se aplican límites diarios de gasto. Incluye opción de redactar datos sensibles del diario antes de enviarlos. Es el prerrequisito técnico de toda la categoría: sin esto nada puede salir a producción.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### AIA-012 · Misión de rescate mínima viable
**Qué:** Cuando el radar detecta racha en peligro o un día desbordado, el Sistema ofrece la "versión mínima" de la misión clave (10 sentadillas en casa en vez del gym completo) que conserva la racha otorgando XP reducido. Basado en la regla de los 2 minutos de Atomic Habits: en los días malos el objetivo no es rendir, es no romper la cadena de identidad.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### AIA-013 · Autocompletado IA al crear misiones
**Qué:** Al escribir el título de una misión nueva, Haiku precarga stat, dificultad, días sugeridos y si merece evidencia obligatoria; además avisa si solapa con una misión existente y propone fusionarlas. Una llamada barata (menos de un céntimo) que elimina la mitad de los taps del CRUD. La fricción de creación es donde mueren la mayoría de buenas intenciones.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### AIA-014 · Arquitecto de mazmorras
**Qué:** Describes un proyecto ("TFG de visión por computador", "app para un cliente") y Claude lo descompone en salas y pisos: hitos con tareas, estimaciones y orden sugerido, listos para el módulo de mazmorras de fase 2. Al conquistar la mazmorra genera la crónica final con estadísticas (días, salas superadas, XP total). Planificar proyectos es la tarea que más pereza da del mundo; aquí la hace el Sistema en 20 segundos.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### AIA-015 · Análisis nocturno en batch
**Qué:** Cron de Supabase a las 03:00 que ejecuta con la Batch API (50% de coste) los análisis pesados: score de riesgo, propuestas de dificultad, detección de patrones y el material del día siguiente, dejándolo precalculado en tablas. La app amanece "pensada": cero latencia y cero spinners de IA al abrirla por la mañana.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### AIA-016 · Router de modelos y prompt caching
**Qué:** Capa de routing por tarea: Haiku para autocompletados y comentarios, Sonnet para planes y chat, el modelo superior solo para el informe semanal; prompt caching del system prompt y el perfil (90% de ahorro en tokens repetidos) y degradación elegante con cola offline si no hay red. Objetivo medible: coste total de IA por debajo de 5 euros al mes con uso intensivo, lo que hace sostenible tener IA en todas partes.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### AIA-017 · Forja SMART de misiones
**Qué:** Botón "afinar" en cualquier misión vaga: "estudiar" se reescribe como "50 min de pomodoros con los apuntes de Redes, antes de las 19:00", con criterio de éxito verificable. La literatura de formación de hábitos es unánime: las intenciones de implementación concretas (qué, cuándo, dónde) duplican la tasa de cumplimiento frente a metas difusas.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### AIA-018 · Penalizaciones a medida
**Qué:** La misión de penalización deja de ser genérica: Claude genera una proporcional, relacionada con lo fallado y factible a la hora que es (fallaste el gym a las 22:00 → 15 min de movilidad en casa antes de dormir). Una penalización imposible se ignora y enseña a ignorar al Sistema; una factible se cumple y repara la relación con la app.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### AIA-019 · Prioridad del Sistema: la misión estrella
**Qué:** Cada mañana el Sistema marca UNA misión del día como prioritaria —elegida por impacto en tus objetivos activos, riesgo de fallo y contexto (víspera de examen → repaso)— con marco azul brillante y una línea explicando el porqué. Es el antídoto contra el agobio de la lista larga: si hoy solo puedes con una, que sea la que importa.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### AIA-020 · Importación de horario y temario con visión
**Qué:** Foto al horario de clases o al PDF del temario y Claude Vision lo convierte en bloques del calendario de fase 2 y misiones de estudio encajadas en tus huecos reales. Cero transcripción manual al empezar el cuatrimestre, que es el momento exacto donde un estudiante decide si configura la app o la abandona.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### AIA-021 · Re-planificación adaptativa de planes
**Qué:** Los planes generados (10K, exámenes, mazmorras) se auto-supervisan: si te desvías del ritmo previsto, Claude recalcula el plan restante —reparte lo pendiente, recorta lo prescindible o propone mover la fecha objetivo— y te presenta el diff para aprobarlo. Un plan estático muere al primer imprevisto; uno que se replanifica sobrevive a un cuatrimestre real.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### AIA-022 · Cazador de huecos: sugerencia de hábitos
**Qué:** Análisis mensual de patrones que detecta huecos y propone de 1 a 3 hábitos nuevos como "misiones recomendadas", cada una con su porqué basado en datos ("no tienes ningún hábito de sueño y tu VIT está estancada; tus domingos sin estructura preceden a tus peores lunes"). Nunca más de 3: la IA también protege contra la sobreambición, que mata más hábitos que la pereza.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### AIA-023 · Autopsia de fallos
**Qué:** Al fallar un día, el Sistema pregunta en una línea "¿qué ocurrió?" con chips rápidos (sin tiempo, cansancio, se me olvidó, enfermo) o texto libre; las causas se acumulan como dataset y alimentan al resto de motores (enfermo → sin penalización; "se me olvidó" recurrente → propone cambiar la misión de franja). Tratar el fallo como dato y no como vergüenza es lo que permite aprender de él.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### AIA-024 · Negociar con el Sistema
**Qué:** Desde el chat puedes pedir clemencia: "hoy tengo fiebre" → el Sistema concede un "descanso autorizado" (sin penalización, racha congelada, XP 0) hasta 2-3 veces al mes, registrando el motivo; si detecta abuso del recurso lo dice con datos en la mano. Flexibilidad estructurada: la diferencia entre una app dura que se abandona y una exigente que se respeta.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### AIA-025 · Misiones urgentes del Sistema
**Qué:** Una o dos veces por semana, en momento imprevisible, aparece en la pantalla Sistema una "MISIÓN URGENTE" generada según tu contexto: factible hoy, relacionada con tu stat más débil o un objetivo activo, con XP extra y cuenta atrás de horas. La recompensa variable e inesperada es el mecanismo dopaminérgico más potente que existe, aquí puesto al servicio de tus propios objetivos en vez de en tu contra.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### AIA-026 · Memoria del coach
**Qué:** Tabla de "hechos del cazador" que la IA mantiene viva: lesiones, asignaturas, horarios, preferencias ("odio correr con lluvia"), extraídos del chat y las autopsias con confirmación explícita del usuario, e inyectados vía prompt caching en cada llamada. Editable en una pantalla tipo expediente. Que el Sistema recuerde tu lesión de hombro de hace un mes es lo que lo hace sentir vivo y no un chatbot amnésico.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### AIA-027 · Estado de emergencia en exámenes
**Qué:** Detectados los exámenes en el calendario, el Sistema propone activar el "estado de emergencia": re-prioriza temporalmente (más INT, proyectos personales en pausa, gym en modo mantenimiento), ajusta la economía para no penalizar lo pausado y lo revierte solo al terminar el periodo. Reconocer que la vida tiene épocas evita el abandono por incompatibilidad con la realidad.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### AIA-028 · Modo expedición
**Qué:** Antes de un viaje o vacaciones le dices las fechas al Sistema y genera un set temporal de "misiones de expedición" factibles sin rutina (andar 10.000 pasos, una comida limpia al día, 10 min de lectura), congelando las misiones normales sin romper rachas. Las vacaciones son el asesino silencioso número uno de las rachas largas; esto las convierte en contenido del juego.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### AIA-029 · Visión de comidas: macros estimadas
**Qué:** La evidencia de dieta se analiza con visión: estimación de macros y veredicto de adherencia al plan semanal en una línea ("~750 kcal, proteína correcta, falta verdura"), que se agrega al cumplimiento semanal de VIT. Sin pesar comida ni mantener otra app de calorías: una foto y a seguir comiendo.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### AIA-030 · Coach de progresión de cargas
**Qué:** Con el módulo de gym registrando series, Claude sugiere la siguiente sesión (peso y repeticiones por ejercicio) aplicando sobrecarga progresiva, detecta estancamientos de más de 3 semanas proponiendo variantes y recomienda semana de descarga cuando volumen y sueño (VIT) indican fatiga acumulada. Es tener un entrenador de 50 euros al mes viviendo dentro del Sistema.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### AIA-031 · Generador de rutinas de gym
**Qué:** "Hipertrofia, 4 días, 60 minutos, sin máquina de poleas" → rutina completa con ejercicios, series y esquema de progresión, creada como misiones FUE conectadas al módulo de gym y regenerable por feedback ("cámbiame el día de pierna"). El plan deja de ser el obstáculo entre querer entrenar y entrenar.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### AIA-032 · Nutricionista del Sistema
**Qué:** Genera el menú semanal según tus macros objetivo, tus comidas favoritas (memoria del coach) y lo que ya hay en casa, y deriva automáticamente la lista de la compra del módulo de fase 3; un toque para regenerar cualquier día que no convenza. Decidir qué comer es la fricción real de toda dieta: eliminarla vale más que cualquier badge.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### AIA-033 · Protocolo de cuidado
**Qué:** Clasificador discreto sobre chat y diario que detecta lenguaje de crisis real (desesperanza, autolesión) y cambia el comportamiento del Sistema: rompe la persona con suavidad, prioriza a la persona sobre el juego, muestra recursos de ayuda (línea 024 en España) y no penaliza nada ese día. Una app que gamifica toda tu vida tiene la responsabilidad de saber cuándo dejar de ser un juego.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### AIA-034 · Motor de descubrimientos
**Qué:** Análisis estadístico mensual (correlaciones simples calculadas en SQL, Claude para redactarlas e hipotetizar causas) que publica "descubrimientos del Sistema" verificables: "cuando duermes menos de 6 horas fallas un 71% más al día siguiente", "tu mejor franja real de estudio es 16-18h, no la noche". Cada descubrimiento enlaza a los datos que lo sustentan. Autoconocimiento con datos propios: la recompensa más adulta y duradera que puede dar la app.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 4

### AIA-035 · Vigía del ánimo
**Qué:** Las entradas del diario (fase 4) y un check-in opcional de un toque pasan por análisis de sentimiento y energía; la tendencia alimenta al radar de abandono y modula al Sistema (semana de ánimo bajo → tono más sobrio, carga sugerida menor, sin misiones urgentes). Detecta el burnout incipiente —ánimo cayendo con cumplimiento todavía alto—, que es exactamente el patrón que precede a las peores caídas.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### AIA-036 · Crónica de ascenso de rango
**Qué:** Al subir de rango (E→D→C…), Claude genera una crónica épica única citando hechos reales del periodo: misiones totales, la peor semana superada, el examen aprobado, el PR del gym. Queda guardada en el "archivo del cazador" como pieza coleccionable y releíble. Los momentos cumbre merecen algo mejor que un toast genérico: merecen literatura hecha con tus propios datos.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 4

### AIA-037 · Bestiario de enemigos
**Qué:** Los patrones de fallo recurrentes se encarnan en monstruos con nombre y ficha generados por Claude ("Procrastinus, devorador de tardes de domingo": cuándo aparece, sus debilidades, su historial contra ti); se derrotan encadenando X semanas sin ese patrón y quedan montados como trofeos en el bestiario. Externalizar el mal hábito como enemigo —técnica real de terapia narrativa— hace que luches contra "él" y no contra ti mismo.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### AIA-038 · Duelo contra tu sombra
**Qué:** Comparativa narrada entre tu semana actual y "tu sombra": tú mismo hace 3-6 meses con tus datos reales de entonces. El Sistema escenifica el duelo stat a stat y declara vencedor con números. Reencuadra la comparación social —veneno en otras apps— hacia la única comparación justa: tú contra quien eras.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### AIA-039 · Extracción de sombras: graduación de hábitos
**Qué:** Cuando la IA detecta automaticidad en un hábito (~66 días con más del 90% de cumplimiento y hora estable), propone "extraerlo como sombra": sale de la lista diaria activa, se une a tu ejército de sombras sumando un XP pasivo simbólico y libera espacio para un hábito nuevo, con ceremonia de extracción narrada. Resuelve el problema real de las listas diarias que crecen hasta agobiar, con el lore más icónico de Solo Leveling.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### AIA-040 · Retrospectiva semanal guiada
**Qué:** Conversación de domingo de 5 minutos dirigida por el Sistema: 3-4 preguntas generadas desde tus datos de la semana ("fallaste los 3 días de dieta en la cena, ¿qué pasa por las noches?"), que termina proponiendo un ajuste concreto y aplicándolo si aceptas. El bucle reflexión-ajuste semanal es el meta-hábito con más evidencia científica de todos.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### AIA-041 · Pregunta a tu historial (RAG)
**Qué:** Embeddings con pgvector en Supabase de misiones, autopsias y entradas de diario para que el chat responda con recuperación real: "¿cuándo fue mi mejor mes de gym?", "¿qué escribí sobre la asignatura de IA en marzo?". El Sistema pasa de conocer tu presente a recordar tu historia completa y citarla con fechas.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 4

### AIA-042 · Compañero de estudio: quizzes desde apuntes
**Qué:** Subes apuntes (foto o PDF) y Claude genera quizzes y flashcards como contenido de misiones INT: "supera el quiz de Grafos (8/10)" se autovalida dentro de la app y los fallos entran en cola de repaso espaciado. El estudio activo con recuperación es el método con más evidencia que existe; aquí además da XP.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 5

### AIA-043 · Presagio del día
**Qué:** Cada mañana, junto a la lista, una línea de presagio en las misiones en riesgo ("68% de probabilidad de fallar 'estudiar 2h': hoy tienes 5 horas de clase; hazlo a primera hora"), calculada desde tu historial en contextos similares. Predicción accionable, no astrología: siempre acompañada de la jugada para esquivarla.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### AIA-044 · Ventanas de éxito por hábito
**Qué:** Análisis de timestamps que identifica la franja horaria donde cada hábito tiene mayor tasa de éxito real y sugiere fijarla como ancla ("gym a las 17h: 92% de éxito; a las 20h: 41%"). El contexto estable es el andamio número uno de la automaticidad según la ciencia del hábito.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### AIA-045 · Detección de hábitos zombi
**Qué:** Detecta misiones que se completan mecánicamente pero sin vida —siempre en el último minuto, evidencias repetitivas, sin progresión asociada— y propone evolucionarlas, fusionarlas o retirarlas con honores. Un check vacío inflaciona el XP y desgasta la honestidad del juego contigo mismo.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### AIA-046 · Auditoría anti-granjeo de XP
**Qué:** Revisión mensual de tu economía personal: si el grueso del XP viene de acumular misiones triviales, el Sistema lo señala con datos y propone rebalancear ("subes de nivel, pero tus stats reales no se mueven"). Mantiene el nivel como medida honesta de progreso vital y no de farmeo.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### AIA-047 · Comentarios del Sistema en evidencias
**Qué:** Tras validar una evidencia, Haiku deja un comentario de una línea, sobrio y específico a la foto ("Tercer día consecutivo en el rack de sentadillas. Constancia registrada."). Micro-reconocimiento variable en el segundo exacto del esfuerzo: el refuerzo más barato y mejor situado de toda la app.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### AIA-048 · Feedback que afina al Sistema
**Qué:** Botones "me sirve / no me sirve" con motivo opcional en cada sugerencia o plan de la IA; los rechazos recientes se inyectan en prompts futuros vía memoria del coach ("rechazó madrugar: no proponer misiones antes de las 8h"). Personalización real sin reentrenar nada: el Sistema aprende las reglas de tu casa.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### AIA-049 · Experimentos N=1
**Qué:** El Sistema propone experimentos quincenales medibles sobre hipótesis tuyas ("¿entrenar antes de estudiar mejora tus pomodoros?"): define el protocolo, lo despliega como misiones y al terminar publica el veredicto con tus datos en el motor de descubrimientos. Convierte el autoconocimiento en el endgame jugable de la app.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### AIA-050 · Línea temporal del físico
**Qué:** Opt-in estrictamente privado: las fotos periódicas de progreso físico se analizan con visión para comentar cambios objetivos y montar una línea temporal comparable mes a mes, conectada a los datos de gym y dieta para explicar el porqué de cada cambio. El progreso físico es invisible en el espejo diario; verlo medido a 6 meses vista es combustible puro.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### AIA-051 · Hablar con el Sistema por voz
**Qué:** Entrada por voz (speech-to-text del dispositivo) y respuesta hablada opcional con una voz sintética grave del Sistema, pensado para registrar el día volviendo del gym o dictar una autopsia de fallo sin teclear. La barrera de escribir desaparece justo en los momentos de menos energía, que son los que más conviene capturar.
**Impacto:** 3/5 · **Esfuerzo:** L · **Fase:** 6

### AIA-052 · Análisis de técnica en vídeo
**Qué:** Apuesta lejana: grabas un vídeo corto de una sentadilla o peso muerto, la app extrae frames clave y Claude Vision señala 1-2 correcciones de técnica priorizadas, con disclaimer claro de que no sustituye a un profesional. Cierra el círculo del coach de gym: planifica tu rutina, progresa tus cargas y además te mira levantar.
**Impacto:** 3/5 · **Esfuerzo:** L · **Fase:** 8

Total: 52 mejoras.
