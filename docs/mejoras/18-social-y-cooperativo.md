# Social y cooperativo (futuro multi-usuario)

> Categoría SOC · backlog NIVL · ordenadas por impacto

### SOC-001 · Compañero de caza: pacto de accountability 1:1
**Qué:** Emparejamiento con un amigo mediante un "Pacto de Cazadores" de 2 semanas renovable: cada uno ve las misiones diarias del otro (solo las marcadas como compartibles) y revisa sus evidencias con un tap de aprobar/rechazar. Saber que una persona real verá la foto del gym convierte la evidencia en compromiso social; el accountability con revisor concreto es el multiplicador de adherencia mejor documentado de la ciencia del hábito.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 6

### SOC-002 · Cards de subida de nivel y rango para Instagram
**Qué:** Al subir de nivel o de rango, el Sistema genera una imagen 1080×1920 (Stories) y 1080×1350 (feed) con la ventana de esquinas cortadas, azul cazador sobre #060B16, el nuevo rango, el nivel y la racha, lista para el share sheet nativo. Render 100% local con react-native-view-shot, cero backend: es la primera función social posible y refuerza la identidad por compromiso público ("ya soy rango C y mi gente lo sabe").
**Impacto:** 5/5 · **Esfuerzo:** S · **Fase:** 4

### SOC-003 · Cimientos multi-usuario: código de cazador y perfil público
**Qué:** Cada usuario recibe un código único (#NIVL-7F3K) y QR para añadir amigos sin tocar la agenda de contactos; el perfil público opt-in muestra nivel, rango, hexágono de stats y logros destacados, nunca misiones concretas. Tablas profiles/friendships con RLS estricta en Supabase: es el prerrequisito de toda la categoría y fija la postura de privacidad desde el día uno.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 6

### SOC-004 · Sello "evidencia verificada" con +10% de XP
**Qué:** Cuando tu compañero aprueba tu evidencia, la misión luce el sello VERIFICADO y suma un +10% de XP apilable con el bonus de cámara (+25%). La verificación compensa sin que su ausencia castigue, y revisar al otro se convierte en un ritual diario de 30 segundos que mantiene vivo el pacto.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 6

### SOC-005 · Duelo de rachas 1v1 con XP en depósito
**Qué:** Retas a un amigo y ambos depositáis XP (100-500) en un cofre en custodia; gana quien mantenga su racha diaria más tiempo y se lleva el bote completo. La aversión a perder el depósito ataca los días flojos mejor que cualquier recordatorio, y las notificaciones del Sistema ("Tu rival sigue en pie") echan leña al fuego.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 6

### SOC-006 · Racha de dúo con multiplicador compartido
**Qué:** Racha paralela que solo avanza si tú y tu compañero cerráis el día al 100%; cada 7 días de dúo añade +0,05 al multiplicador de ambos (tope +0,3, apilable con el individual). La interdependencia ("si fallo, le rompo la racha a él") es la presión social positiva más potente que existe, acotada para no volverse tóxica.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 6

### SOC-007 · Gremios de cazadores (4-12 miembros)
**Qué:** Crear o unirse a un gremio con nombre, emblema y lema; la pantalla de gremio muestra el nivel colectivo, quién ha completado hoy y el ranking interno de contribución semanal. Un grupo pequeño y estable crea pertenencia real, el mejor predictor de retención a largo plazo en apps de hábitos sociales.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 7

### SOC-008 · Raids cooperativas: jefe con HP compartido
**Qué:** El líder invoca un jefe ("Igris, 2.000 HP, 7 días") y cada misión completada por cualquier miembro le inflige daño igual a su XP base, con barra de vida en tiempo real y log de golpes. Convierte la suma de hábitos individuales en una batalla común: hoy no entrenas por ti, entrenas porque el gremio va perdiendo.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 7

### SOC-009 · Resurrección: los aliados amortiguan tu penalización
**Qué:** Cuando fallas el día y el Sistema aplica el −50%, tus amigos reciben aviso y uno puede lanzarte "Resurrección" (1/semana por amigo): reduce la penalización un 25% y adjunta un mensaje de ánimo de plantilla. El día siguiente a un fallo es el punto número uno de abandono; esto lo transforma en un momento de conexión en vez de vergüenza.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 6

### SOC-010 · Tabla de Cazadores semanal por adherencia
**Qué:** Ranking entre amigos que puntúa el % de misiones completadas ponderado por dificultad, no el XP bruto, de modo que un rango E constante gana a un rango A vago. Reset cada lunes y podio el domingo: competir por constancia y no por volumen mantiene la comparación sana y resistente al grindeo.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 6

### SOC-011 · Retos comunitarios de temporada
**Qué:** Eventos de 4-6 semanas con tema y lore ("Temporada del Monarca de Hierro": misiones de FUE en enero) donde todos los usuarios suman a una barra de progreso global con hitos que desbloquean cosméticos para los participantes. Sensación de MMO: tu sentadilla de hoy empuja una meta planetaria.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 7

### SOC-012 · Invocación: nudge de un aliado rezagado
**Qué:** Si a las 20:00 un amigo lleva 0 misiones, puedes "invocarlo": le llega una push con estética del Sistema ("Un cazador aliado te invoca al campo de batalla"), limitada a 1 por amigo y día. El recordatorio que viene de una persona real dobla la tasa de respuesta del que envía un bot.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 6

### SOC-013 · Feed de actividad de la red de cazadores
**Qué:** Timeline con eventos automáticos de tus amigos (subidas de nivel y rango, logros, hitos de racha, jefes abatidos), nunca el contenido de misiones privadas. Treinta segundos de scroll producen prueba social diaria: todo el mundo está cazando, tú también deberías.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 6

### SOC-014 · Vínculo mentor-discípulo
**Qué:** Un cazador rango B o superior apadrina a un novato (E/D): ve su adherencia agregada, le recomienda 1 misión por semana y dispone de 3 "consejos del mentor" (plantillas) semanales. Enseñar consolida los hábitos del propio mentor (efecto protégé) y multiplica la supervivencia del novato en sus primeras semanas.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 8

### SOC-015 · Privacidad granular: stats y misiones clasificadas
**Qué:** Control por categoría (compartir FUE/VIT pero nunca PER/diario) y flag "misión clasificada" por misión individual que la oculta de partner, feed y rankings, contando solo como misión completada genérica. Sin esta válvula el usuario no se atreverá a trackear lo personal, que es justo lo más valioso de NIVL.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 6

### SOC-016 · Deep link de invitación en cada card
**Qué:** Toda card compartida incluye QR y enlace corto (nivl.app/h/7F3K) que abre la app o la store y añade al invitador como primer amigo automáticamente. Convierte cada story en un canal de adquisición orgánica con atribución de quién trajo a quién.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 6

### SOC-017 · Recompensa de reclutamiento alineada con retención
**Qué:** Quien entra con tu código recibe el buff "Bendición del veterano" (+10% XP sus primeros 7 días) y tú ganas 300 XP solo cuando alcanza el nivel 5, no antes. Referral sin dinero, diseñado para que el veterano ayude al novato a sobrevivir su primera semana en lugar de spamear códigos.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 6

### SOC-018 · Importar la build de un amigo
**Qué:** Un amigo marca un conjunto de misiones como "build pública" ("PPL 6 días + 2 h de estudio") y tú la importas con un tap, ajustando días y dificultad en un mini-wizard. Copiar el sistema de alguien a quien ya le funciona elimina el folio en blanco, la mayor fricción al crear hábitos.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 7

### SOC-019 · Caza sincronizada (body doubling a distancia)
**Qué:** Propones "cazar juntos a las 18:00"; al confirmar ambos, corre un temporizador compartido con presencia en vivo hasta que los dos marcan la misión, con un pequeño bonus de XP si se completa dentro de la ventana. Entrenar o estudiar a la vez aunque cada uno esté en su ciudad: el body doubling dispara el inicio de tareas aversivas.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 7

### SOC-020 · Duelo semanal de cumplimiento
**Qué:** Duelo a exactamente 7 días: gana quien cierre mayor adherencia ponderada, con marcador diario y golpe animado cada vez que alguien toma la delantera. Más corto y repetible que el duelo de rachas a muerte; el formato ideal para rivalidades recurrentes entre compañeros de clase.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 6

### SOC-021 · Pantalla versus en vivo
**Qué:** Vista de duelo con ambos avatares enfrentados, barras de HP que representan el progreso de cada rival y log de acciones en tiempo real vía Supabase Realtime. Que el duelo se sienta combate de anime y no una tabla aburrida es lo que hará que la gente comparta capturas.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 6

### SOC-022 · Buff de gremio por día perfecto colectivo
**Qué:** Si el 80% o más del gremio completa todas sus misiones hoy, mañana todos amanecen con un aura visible y +5% de XP. Eficacia colectiva pura: tu esfuerzo de hoy regala algo tangible a tus compañeros mañana, y fallar te hace sentir responsable sin castigarte mecánicamente.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 7

### SOC-023 · Misión de gremio semanal
**Qué:** Objetivo cooperativo rotatorio ("100 misiones de INT entre todos antes del domingo") con barra de progreso en la pantalla del gremio y cofre cosmético si se cumple. Da al gremio un ciclo semanal de tensión y recompensa, y un motivo de conversación recurrente.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 7

### SOC-024 · Juramento público con fecha
**Qué:** Publicas ante tus amigos un juramento con deadline ("Aprobaré Cálculo II el 12/07"); el Sistema lo anuncia en el feed, recuerda el progreso a mitad de camino y lo resuelve en público como logro o como "juramento roto". El compromiso público es una de las palancas conductuales más documentadas, aquí con dramatismo de anime.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 6

### SOC-025 · Cristal de protección de racha regalable
**Qué:** Cada usuario puede regalar 1 cristal al mes a un amigo; si el receptor falla un día, el cristal se consume, su racha sobrevive y se le notifica quién se lo regaló. Generosidad mecánica: proteger la racha de otro crea gratitud real y conversaciones fuera de la app.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 6

### SOC-026 · Radar de stats superpuesto
**Qué:** En el perfil de un amigo, botón "Comparar" que superpone tu hexágono de stats al suyo con dos trazos de color y deltas numéricos por stat. Comparación concreta en 5 segundos ("me saca 12 de INT") que siembra duelos y motivación dirigida a un stat concreto.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 6

### SOC-027 · Card de racha semanal con heatmap
**Qué:** Card compartible con el mini-heatmap de los últimos 28 días, la llama de racha, el multiplicador vigente y una frase generada por el Sistema. La racha es el activo emocional número uno del usuario; darle formato presumible la refuerza y, de paso, enseña la mecánica a quien la ve.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 4

### SOC-028 · Modo anónimo al compartir cards
**Qué:** Toggle que sustituye los nombres de misiones sensibles por "MISIÓN CLASIFICADA" manteniendo XP y dificultad, y opcionalmente oculta tu nombre real. Permite presumir de constancia sin revelar que la misión era ir a terapia o pesarse en la dieta.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 4

### SOC-029 · Ligas de divisiones E a S
**Qué:** Cohortes semanales de unos 20 cazadores de nivel similar: los 5 primeros ascienden de división (E, D, C, B, A, S) y los 5 últimos descienden, con recompensa cosmética por división alcanzada. Da contexto competitivo a quien aún no tiene amigos en la app y un motivo de regreso cada lunes.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 7

### SOC-030 · Matchmaking de compañero de caza
**Qué:** Cola de emparejamiento por objetivos (gym, estudio, dieta), huso horario y nivel de exigencia declarado, con periodo de prueba de 7 días y re-roll sin culpa. Resuelve el arranque en frío del accountability: la mayoría de usuarios nuevos no traerá a un amigo de serie.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 7

### SOC-031 · Moderación y seguridad desde el día uno
**Qué:** Bloquear, reportar y silenciar disponibles en toda superficie social; los reportes de evidencia van a una cola de revisión y tres strikes desactivan las funciones sociales del infractor. Imprescindible antes de abrir cualquier interacción entre desconocidos (matchmaking, ligas, jurados).
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 6

### SOC-032 · Enfurecimiento del jefe de raid
**Qué:** Si un miembro falla todas sus misiones un día de raid, el jefe recupera HP equivalente al 50% del daño diario medio del equipo, con el aviso "EL JEFE SE ENFURECE" (autoría anónima por defecto). Añade tensión real a la cooperativa sin señalar públicamente al culpable.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 7

### SOC-033 · Reacciones del Sistema en el feed
**Qué:** Cinco stickers temáticos ("LEVÁNTATE", "Digno de un rango S", espada, llama, corona) para reaccionar a eventos del feed con un tap y contador visible en cada evento. Coste de interacción mínimo y dopamina social máxima; sin comentarios libres no hay moderación que mantener.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 6

### SOC-034 · Resumen nocturno del dúo
**Qué:** La notificación de las 21:30 incorpora el estado del compañero ("Tú 3/5 · Hugo 5/5"); si él ya cerró el día y tú no, el copy aprieta un punto más. Microdosis de presión social exactamente en el momento de la decisión nocturna.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 6

### SOC-035 · Vídeo de level-up exportable a Reels
**Qué:** Captura de 3-4 segundos de la animación de subida de nivel (partículas, ventana del Sistema, sello de rango) exportada como MP4 vertical con marca de agua sutil. El vídeo corto viaja mejor que la imagen estática en Reels y TikTok, donde vive el público objetivo de NIVL.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### SOC-036 · Chat de plantillas del Sistema
**Qué:** Mensajería de partner y gremio restringida a unas 20 frases predefinidas tematizadas más stickers, sin texto libre en la v1. El 80% del valor de un chat con el 0% de su riesgo de moderación; el texto libre puede llegar en una fase posterior si hace falta.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 7

### SOC-037 · Strikes por verificación deshonesta
**Qué:** Si una evidencia aprobada se reporta y se confirma falsa, autor y validador pierden el sello y acumulan un strike; tres strikes suspenden el bonus de verificación durante 30 días. Mantiene honesto el sistema de verificación mutua cuando entren desconocidos por matchmaking.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 7

### SOC-038 · Banco de XP del gremio
**Qué:** Cada misión completada aporta un 5% adicional (no restado al jugador) al banco del gremio, que sube el nivel colectivo y desbloquea mejoras cosméticas del emblema y de la pantalla del gremio. El nivel de gremio es un marcador de estatus colectivo que a nadie le apetece abandonar.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 7

### SOC-039 · Roles y permisos de gremio
**Qué:** Líder, Oficial y Cazador con permisos diferenciados (invitar, expulsar, invocar jefes, editar el tablón) y traspaso de liderazgo con confirmación. Lo mínimo imprescindible para que un grupo de 12 personas se autogestione sin necesitar soporte.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 7

### SOC-040 · Tablón del gremio
**Qué:** Muro con anuncios fijables del líder y posts automáticos del Sistema (hitos de miembros, récords, resultado de la última raid). Punto de encuentro asíncrono que mantiene el gremio vivo entre raid y raid.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 7

### SOC-041 · Golpe de gracia en la raid
**Qué:** La misión que deja el HP del jefe a 0 dispara una animación a pantalla completa para todo el gremio y concede al autor el título rotatorio "Mano del Monarca" hasta la siguiente raid. Microincentivo a rematar raids con un momento de gloria que se reparte de forma aleatoria.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 7

### SOC-042 · Botín cosmético de raid
**Qué:** Cada jefe abatido deja loot exclusivo e irrepetible: marcos de ventana, auras de avatar y colores de acento del Sistema ligados a esa raid concreta. Coleccionismo visible en el perfil que cuenta historias ("ese marco es del Igris de marzo").
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 7

### SOC-043 · Ceremonia de podio dominical
**Qué:** El domingo a las 21:30, animación de podio con los 3 primeros de tu Tabla de Cazadores y card compartible del resultado; el ganador elige el "lema de la semana" visible para todo el grupo. Ritual de cierre que deja la casilla de salida limpia para el lunes.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 7

### SOC-044 · Ranking de rachas vivas
**Qué:** Tabla secundaria que ordena a tus amigos solo por días de racha activa, junto al récord histórico de cada uno. La métrica más justa y menos farmeable para comparar constancia pura entre cazadores de niveles muy distintos.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 6

### SOC-045 · Modo fantasma
**Qué:** Opción de salir de todos los rankings sin perder amigos, partner ni gremio; el Sistema te muestra entonces solo tu comparación contra tu yo de la semana pasada. La comparación social motiva a unos y hunde a otros: ambos perfiles deben poder vivir en NIVL.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 6

### SOC-046 · Rivalidades persistentes head-to-head
**Qué:** Tras cada duelo, botón de revancha y ficha acumulada del enfrentamiento (3-2, racha de victorias, XP histórico en juego). Las rivalidades largas generan más reaperturas de la app que cualquier notificación programada.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 7

### SOC-047 · Títulos de duelo equipables
**Qué:** Las victorias otorgan títulos ("Verdugo de Rachas", "Invicto x5") equipables bajo el nombre en perfil, feed y rankings. Estatus visible que da motivos para seguir aceptando duelos incluso a quienes ya van ganando.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 7

### SOC-048 · Jurado de cazadores para retos de temporada
**Qué:** En los retos comunitarios, las evidencias marcadas como dudosas pasan a votación de 3 participantes aleatorios (la mayoría decide; 10 XP por voto emitido). Escala la verificación a cientos de usuarios sin montar un equipo de moderación.
**Impacto:** 3/5 · **Esfuerzo:** L · **Fase:** 8

### SOC-049 · XP de legado del mentor
**Qué:** Durante las primeras 4 semanas del discípulo, el mentor recibe el 10% del XP que este genere, como XP nuevo (no restado al novato). Alinea el incentivo del mentor con la supervivencia del discípulo justo en el tramo donde más usuarios mueren.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 8

### SOC-050 · Graduación del discípulo
**Qué:** Cuando el discípulo alcanza el rango C hay ceremonia conjunta, card compartible a dos avatares y título permanente "Maestro" con contador de graduados para el mentor. Cierra el arco narrativo y deja al mentor con ganas de apadrinar al siguiente.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 8

### SOC-051 · Recap anual conjunto (Wrapped del gremio)
**Qué:** En diciembre, recap con estadísticas conjuntas del dúo o del gremio (misiones totales, jefes caídos, quién invocó más, días perfectos colectivos) exportable como carrusel de cards. Momento de orgullo compartido y pico anual de viralidad garantizado.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 8

### SOC-052 · Guerra de gremios
**Qué:** Enfrentamiento quincenal entre dos gremios de tamaño y nivel similares: gana el de mayor adherencia media ponderada, con marcador en vivo y botín cosmético para el vencedor. La rivalidad externa es el mejor pegamento interno de un grupo.
**Impacto:** 3/5 · **Esfuerzo:** L · **Fase:** 8

Total: 52 mejoras.
