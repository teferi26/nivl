# Diario del cazador y reflexión

> Categoría DIA · backlog NIVL · ordenadas por impacto

### DIA-001 · Prompt diario del Sistema
**Qué:** Cada día el diario abre con una pregunta de un mazo de 60+ prompts en español (identidad de cazador, obstáculos, saboreo, planes), presentada como ventana del sistema: "[El Sistema solicita tu informe diario]". Sin repetición en 30 días y con botón "otra pregunta". Elimina el folio en blanco, la causa número uno de abandono de los diarios.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 4

### DIA-002 · Crónica automática del día (log del Sistema)
**Qué:** Un generador local convierte los eventos del día (misiones completadas o falladas, XP, rachas, subidas de nivel, evidencias) en una narrativa cronológica en segunda persona estilo Solo Leveling: "07:42 — El cazador superó 'Entreno de empuje'. +125 XP". Aunque no escribas ni una línea, tu día queda registrado: el diario nunca está vacío y siempre apetece abrirlo.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 4

### DIA-003 · Check-in de ánimo y energía en dos toques
**Qué:** Selector de 5 auras de ánimo (colores del sistema) más slider de energía 0-100 tipo barra de maná, accesible desde la app y desde la notificación de las 21:30. Menos de cinco segundos por registro: el histórico emocional sobrevive incluso a los días sin ganas de escribir. Se lanza como semilla antes del diario completo para acumular histórico desde pronto.
**Impacto:** 5/5 · **Esfuerzo:** S · **Fase:** 3

### DIA-004 · Revisión semanal guiada "Informe de misión"
**Qué:** Wizard dominical de cinco pasos: qué funcionó, qué falló, lección de la semana, intención si-entonces para la próxima y nota global 1-5; termina con resumen narrativo y recompensa de XP de PER. La revisión semanal estructurada es el mecanismo con más evidencia para sostener hábitos durante meses, y aquí se viste de informe al Gremio.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 4

### DIA-005 · Modo entrada rápida de 30 segundos
**Qué:** Botón "registro rápido": una línea de texto, ánimo y guardar, sin plantillas ni secciones. En los días malos la fricción mínima mantiene la cadena viva, que importa más que la calidad literaria de la entrada.
**Impacto:** 5/5 · **Esfuerzo:** S · **Fase:** 4

### DIA-006 · XP de PER por escribir, con anti-farmeo
**Qué:** Cada entrada otorga XP de PER (25 base, +10 si supera 150 palabras, bonus por gratitud completada) con mínimo de 80 caracteres y tope diario para evitar abuso. Integra el diario en la economía del juego y convierte PER en una stat que de verdad se entrena a diario.
**Impacto:** 5/5 · **Esfuerzo:** S · **Fase:** 4

### DIA-007 · Gratitud: "3 botines del día"
**Qué:** Sección fija de tres campos cortos con iconos de botín; al completar el tercero, micro-animación de cofre que se cierra y sella. Tres gratitudes diarias es una de las intervenciones con más evidencia en bienestar percibido y reencuadre positivo del día.
**Impacto:** 5/5 · **Esfuerzo:** S · **Fase:** 4

### DIA-008 · Recuerdos: "Hace un año, hoy"
**Qué:** Si existe entrada del mismo día hace un mes, seis meses o un año, una tarjeta del sistema la rescata al abrir la app (con notificación opcional), mostrando ánimo, foto y primer párrafo. Releer el camino recorrido es combustible motivacional puro y da valor compuesto a cada entrada escrita.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 5

### DIA-009 · Editor precargado con la crónica del día
**Qué:** Al crear la entrada, el editor llega con la crónica automática plegada arriba y la primera línea ya escrita: "Día 142 como cazador. 4/5 misiones superadas. Racha: 12 días." Escribir cuesta mucho menos cuando ya hay algo en la página.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 4

### DIA-010 · Plantillas de entrada por contexto
**Qué:** Seis plantillas iniciales seleccionables al crear entrada: post-gym, post-examen, sesión de mazmorra, día duro, victoria y revisión dominical, cada una con campos propios. Las plantillas convierten el "no sé qué escribir" en rellenar tres huecos concretos.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### DIA-011 · Audio-notas del cazador
**Qué:** Grabación de voz desde la entrada (hasta 5 minutos) con waveform azul cazador, subida a Supabase Storage y reproducción inline. Perfecta para reflexionar en caliente al salir del gym o de un examen, cuando teclear no apetece.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### DIA-012 · Búsqueda full-text del archivo
**Qué:** Buscador sobre título, cuerpo y campos de plantilla con índice tsvector en español de Postgres, y filtros combinables por etiqueta, ánimo, plantilla y rango de fechas. El diario pasa de cajón de recuerdos a base de conocimiento personal consultable.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 5

### DIA-013 · Prompts sensibles al contexto
**Qué:** El prompt del día se elige según los datos: con misiones falladas, pregunta de autocompasión y análisis sin culpa; con día perfecto, pregunta de saboreo; en víspera de examen del calendario, pregunta de preparación mental. La autocompasión predice mejor la recuperación del hábito que la autocrítica, y aquí se aplica de forma automática.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 5

### DIA-014 · Pregunta nocturna respondible desde la notificación
**Qué:** La notificación de las 21:30 incluye el prompt del día y permite respuesta inline en Android o abrir directamente el editor precargado en iOS. Reduce el camino de "me ha sonado el móvil" a "he escrito mi entrada" a un solo gesto.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### DIA-015 · Racha de diario con pase de guardia
**Qué:** Racha propia del diario con un comodín semanal ("guardia nocturna") que protege la cadena si un día no escribes, marcado visualmente distinto del fallo. La flexibilidad programada aumenta la adherencia a largo plazo frente a las rachas rígidas que se abandonan tras el primer tropiezo.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 4

### DIA-016 · Revisión mensual "Informe del Gremio"
**Qué:** Versión profunda de la revisión: relee tres entradas clave del mes preseleccionadas por el sistema (mejor día, peor día, día más escrito), contrasta las intenciones semanales con lo ocurrido, elige el "boss del mes siguiente" y pon título al capítulo. Cierra el mes con sensación de arco narrativo, no de scroll infinito.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 5

### DIA-017 · Bitácora de mazmorra
**Qué:** Cada proyecto-mazmorra tiene su log propio: notas por sesión de trabajo (decisión tomada, bloqueo, siguiente paso) visibles en la pantalla de la mazmorra y enlazadas desde la crónica diaria. Retomar un proyecto tras una semana parado deja de costar veinte minutos de "¿dónde lo dejé?".
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 5

### DIA-018 · Bloqueo biométrico y cifrado del diario
**Qué:** La pestaña diario se abre con huella o FaceID (expo-local-authentication) y el cuerpo de las entradas se cifra en reposo antes de subir a Supabase. La privacidad percibida es condición previa de la honestidad, y sin honestidad el diario pierde todo su valor.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### DIA-019 · Post-mortem de racha rota
**Qué:** Al romperse una racha de 14+ días, el Sistema ofrece una entrada estructurada: qué pasó, factor interno o externo, plan de reenganche en 24 horas; completarla cuenta como la misión de penalización del día. Ataca el efecto "qué más da" que convierte un fallo puntual en abandono total.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 5

### DIA-020 · El Analista del Gremio (resumen IA semanal)
**Qué:** Opt-in: un LLM resume tus entradas de la semana en cinco líneas, señala un patrón detectado y deja una pregunta punzante, todo presentado como el PNJ "Analista del Gremio" en su propia ventana. Devuelve valor a lo escrito sin obligarte a releerlo todo.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 6

### DIA-021 · Onboarding: el Sistema te entrevista
**Qué:** La primera vez que entras al diario, cinco preguntas conversacionales en ventanas secuenciales del sistema (por qué despertaste como cazador, tu rango soñado, tu mayor enemigo actual) generan tu entrada número 1 y enseñan de paso ánimo, gratitud y prompts. Nadie empieza con la página en blanco.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### DIA-022 · Chips de causa del ánimo
**Qué:** Tras marcar el ánimo, chips opcionales de un toque: sueño, examen, gym, social, proyecto, comida, otro. Contexto cualitativo casi gratis que multiplicará el valor del histórico cuando lleguen los análisis futuros.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### DIA-023 · Etiquetas con autocompletado
**Qué:** Escribir # despliega autocompletado con tus etiquetas previas (#examen, #ansiedad, #PR); cada etiqueta tiene su pantalla de archivo con todas las entradas. Estructura emergente sin obligar a categorizar nada.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### DIA-024 · Calendario-archivo por color de ánimo
**Qué:** Vista mensual donde cada día es una celda teñida con el color del aura de ánimo y un punto si hay entrada escrita; tocar abre el día. Es navegación visual del archivo, no estadística: encuentras "aquella semana negra de febrero" en tres segundos.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### DIA-025 · Fotos en la entrada y "foto del día"
**Qué:** Hasta tres fotos por entrada reutilizando el pipeline de evidencias, con sugerencia automática de las evidencias capturadas ese día para elegir una como portada. La memoria visual ancla la escrita.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### DIA-026 · Registros legendarios
**Qué:** Marcar manualmente entradas como "registro legendario" (marco dorado) y colección dedicada para releerlas. Tu propio archivo de pruebas contra el "yo no puedo" de los días bajos.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### DIA-027 · Nota inline desde una misión
**Qué:** Mantener pulsada una misión completada abre "añadir nota al registro": una línea que queda anclada a esa misión dentro de la crónica del día. Captura el contexto en caliente, cuando todavía existe.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### DIA-028 · Carta a tu yo futuro
**Qué:** Escribe una carta que se sella y solo se abre en la fecha elegida o al alcanzar un rango concreto (por ejemplo, rango B), con notificación dramática de desbloqueo: "Un mensaje del pasado ha llegado". Conecta el esfuerzo de hoy con la identidad futura, el núcleo motivacional de toda la app.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### DIA-029 · Lecciones que vuelven el lunes
**Qué:** La lección y la intención si-entonces escritas en la revisión dominical reaparecen como tarjeta del sistema el lunes a las 8:00. La reflexión se convierte en acción de la semana, no en texto muerto enterrado en el archivo.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 5

### DIA-030 · Exportar "Crónicas del cazador"
**Qué:** Exporta un mes o el archivo completo a Markdown y PDF con estética del sistema (portada con nivel y rango, capítulos por mes) más un zip con audios y fotos. Propiedad total de tus datos y un artefacto que da pena dejar de alimentar.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### DIA-031 · Diario offline-first
**Qué:** Escritura y grabación sin conexión con cola local (SQLite) y sincronización diferida a Supabase, resolviendo conflictos por timestamp. Un diario que pierde una entrada por falta de cobertura pierde la confianza para siempre.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### DIA-032 · Autoguardado y papelera de 30 días
**Qué:** El borrador se guarda cada cinco segundos (cerrar la app nunca borra texto) y las entradas eliminadas pasan a una papelera recuperable durante 30 días. Cero pérdidas accidentales, cero miedo a editar.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### DIA-033 · Markdown ligero en entradas
**Qué:** Negrita, cursiva, listas y checkboxes con barra de formato mínima sobre el teclado y render limpio en Rajdhani. Suficiente estructura para entradas largas sin convertir el editor en Word.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### DIA-034 · Modo escritura inmersiva
**Qué:** Pantalla completa sin tabs ni barra de estado, tipografía dos puntos mayor, fondo #060B16 puro y cursor de terminal parpadeante; opcionalmente, ambiente sonoro del sistema cuando llegue el audio de fase 5. Escribir se siente ritual de cazador, no formulario.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 5

### DIA-035 · Gratitud rescatada
**Qué:** Una o dos veces por semana, una tarjeta resurface una gratitud antigua al azar: "Hace 23 días agradeciste: 'el café tras el parcial'". Re-saborear multiplica el efecto de la gratitud escrita y premia haberla registrado.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 5

### DIA-036 · Plantilla post-examen
**Qué:** Campos: asignatura, qué cayó, qué estudié de más y de menos, qué haré distinto, sensación 1-5; enlazable al evento de examen del calendario de fase 2. Convierte cada examen de la carrera en datos accionables para el siguiente.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### DIA-037 · Plantilla post-entreno
**Qué:** Campos: sensación general, esfuerzo percibido, mejor serie del día, molestias; ofrecida automáticamente al completar la misión de gym. Cierra el bucle entre el módulo de gimnasio de fase 3 y la reflexión.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### DIA-038 · Plantilla "día duro" con reencuadre
**Qué:** Tres preguntas de reencuadre cognitivo (qué ha pasado, qué le dirías a un amigo en tu situación, qué micropaso queda hoy) y opción de marcar el día como "superviviente" en lugar de fallido. Reencuadrar el mal día evita que se convierta en mala semana.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 5

### DIA-039 · Salón de victorias
**Qué:** Las entradas con plantilla "victoria" o etiqueta #win se coleccionan automáticamente en un "Salón de trofeos" consultable desde el perfil, pensado para releer antes de exámenes o entrevistas. Antídoto directo contra el síndrome del impostor.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 5

### DIA-040 · Sello de cierre del día
**Qué:** Botón "sellar el día" al final de la entrada: animación de sello del Gremio sobre la ventana, resumen del XP de PER ganado y el día queda archivado en la crónica. Un ritual de cierre psicológico que marca el fin de la jornada, como un shutdown ritual.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 5

### DIA-041 · Check-in matinal de energía
**Qué:** La notificación de las 8:00 añade un registro opcional de un toque de energía al despertar, que luego encabeza la crónica: "El cazador despertó con el 40% de maná". Semilla pre-diario: datos desde fase 3 con coste de desarrollo mínimo.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### DIA-042 · Transcripción automática de audio-notas
**Qué:** Las notas de voz se transcriben (API tipo Whisper o STT del sistema) y el texto queda adjunto, buscable e incluible en las revisiones semanales. El audio deja de ser un agujero negro dentro del archivo.
**Impacto:** 3/5 · **Esfuerzo:** L · **Fase:** 6

### DIA-043 · Títulos de mes y vista "Crónica"
**Qué:** Cada mes cerrado recibe el título elegido en la revisión mensual y una portada (foto del mes); la vista Crónica lista los meses como capítulos de un manhwa. Tu vida como serie con índice: nadie quiere cancelar su propia serie.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 6

### DIA-044 · Comparador "antes vs. ahora"
**Qué:** Al alcanzar hitos (subida de rango, día 100, fin de una mazmorra grande), el Sistema muestra en pantalla dividida tu respuesta antigua y una nueva a la misma pregunta. Evidencia narrativa del progreso que ningún número transmite igual.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 6

### DIA-045 · Pregúntale a tu archivo (búsqueda semántica)
**Qué:** Embeddings con pgvector en Supabase sobre entradas y transcripciones: "¿cuándo fue la última vez que me sentí así antes de un examen?" devuelve entradas por significado, no por palabra exacta. El archivo de años se vuelve una memoria externa real.
**Impacto:** 3/5 · **Esfuerzo:** L · **Fase:** 7

### DIA-046 · Sugerencia local de ánimo desde el texto
**Qué:** Un diccionario es-ES on-device analiza la entrada al guardar y, si no marcaste ánimo, lo sugiere: "Esto suena a un día 2/5, ¿lo confirmo?". Sin nube, sin coste por uso, y el histórico de ánimo queda completo.
**Impacto:** 2/5 · **Esfuerzo:** M · **Fase:** 6

### DIA-047 · Efecto máquina de escribir del Sistema
**Qué:** La primera vez que abres la crónica de la noche, el texto se teclea solo con efecto terminal y sonido sutil (audio de fase 5). Convierte revisar tu día en un pequeño momento de serie, no en leer un log.
**Impacto:** 2/5 · **Esfuerzo:** S · **Fase:** 5

### DIA-048 · Modo paseo para audio-diario
**Qué:** Grabación manos libres con pantalla simplificada de botones gigantes (pausa, marca, fin) y bloqueo táctil, pensada para reflexionar caminando de vuelta del gym o de la facultad. La reflexión en movimiento sale más honesta que frente al teclado.
**Impacto:** 2/5 · **Esfuerzo:** M · **Fase:** 6

### DIA-049 · Recordatorio de escritura adaptativo
**Qué:** Si durante una semana escribes sistemáticamente a una hora distinta de las 21:30, la app propone mover el recordatorio del diario a tu hora real. Los recordatorios alineados con la rutina verdadera se obedecen; los demás se ignoran y desensibilizan.
**Impacto:** 2/5 · **Esfuerzo:** M · **Fase:** 6

### DIA-050 · Widget con el prompt del día
**Qué:** Widget de pantalla de inicio (Android primero) que muestra el prompt del día y la racha de diario, con acceso directo al editor. Un vistazo al desbloquear el móvil basta como disparador del hábito de escribir.
**Impacto:** 2/5 · **Esfuerzo:** M · **Fase:** 6

### DIA-051 · Dictado a texto en el editor
**Qué:** Botón de micrófono en el editor que usa el STT del sistema operativo para dictar directamente texto de la entrada, distinto de las audio-notas grabadas. Entradas largas sin teclear, ideal en la cama con la luz apagada.
**Impacto:** 2/5 · **Esfuerzo:** S · **Fase:** 5

### DIA-052 · Editor de plantillas propio
**Qué:** Crear y editar plantillas personalizadas con bloques (texto largo, campo corto, escala 1-5, checklist) y elegir cuáles aparecen en el selector rápido. El diario se adapta a rituales que todavía no hemos previsto.
**Impacto:** 2/5 · **Esfuerzo:** M · **Fase:** 6

Total: 52 mejoras.
