# UI/UX, animaciones y juice

> Categoría UIX · backlog NIVL · ordenadas por impacto

### UIX-001 · Completar misión: burst de partículas y XP que vuela a la barra
**Qué:** Al marcar el check, la tarjeta dispara un burst de chispas hexagonales azul cazador (#37C8F0) y una etiqueta "+XX XP" en Orbitron vuela en arco hasta la barra de XP, que la absorbe con un pulso de glow y un micro-rebote. Es la interacción más repetida de la app (varias veces al día): si ese medio segundo se siente glorioso, todo el loop engancha. Reanimated en UI thread + Skia para las partículas.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### UIX-002 · Level-up cinematográfico a pantalla completa
**Qué:** Secuencia tipo anime al subir de nivel: fundido a oscuro, "ping" del sistema, ventana con scanlines y glitch que escribe "HAS SUBIDO DE NIVEL", número nuevo con count-up gigante, rayos verticales de luz y onda de partículas. Dura menos de 4 s y se salta con un tap. El nivel es la recompensa suprema de NIVL y debe dar escalofríos las primeras cincuenta veces, como en Solo Leveling.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 2

### UIX-003 · Swipe derecha para completar misiones
**Qué:** Deslizar la tarjeta a la derecha revela un fondo azul con icono de check y completa al soltar (si exige evidencia, abre la cámara directamente); a la izquierda expone posponer/editar. Resistencia física, haptic al cruzar el umbral y snap con spring vía react-native-gesture-handler. Convierte la acción diaria en un gesto de 300 ms con sensación táctil de "cerrar trato".
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### UIX-004 · Vocabulario háptico NIVL
**Qué:** Lenguaje táctil único centralizado en un módulo `haptics.ts` sobre expo-haptics: tick ligero en taps, impacto medio al completar, notificación de éxito al cerrar el día, doble pulso grave en penalización y secuencia ascendente en level-up. El cuerpo reconoce la recompensa antes que los ojos y cada evento del sistema se vuelve físicamente distinguible.
**Impacto:** 5/5 · **Esfuerzo:** S · **Fase:** 2

### UIX-005 · Optimistic UI en el core loop
**Qué:** Completar una misión actualiza al instante check, XP, barra y stats en local y sincroniza con Supabase en segundo plano, con rollback y toast si falla. Cero spinners entre el tap y la recompensa: la dopamina no espera a la red.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### UIX-006 · Barra de XP viva
**Qué:** La barra de XP se llena con spring físico, emite glow pulsante cuando supera el 85% del nivel ("estás cerca") y al desbordar arrastra el excedente visiblemente a la barra del nivel siguiente. Ver el progreso moverse con peso convierte cada punto de XP en algo tangible y explota el efecto goal-gradient para cerrar el día.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### UIX-007 · Cierre del día: celebración y Sistema en reposo
**Qué:** Al completar la última misión del día, pantalla de resumen celebratoria (XP total con count-up, racha, stats subidas, hora de cierre) con lluvia de partículas; después, la pantalla Sistema queda en estado "victoria": aura azul tenue y mensaje "Todas las misiones completadas, cazador". Sella el día con sensación de logro e invita a soltar el móvil con la cabeza tranquila.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### UIX-008 · Ceremonia de cambio de rango
**Qué:** Subir de rango (E→D…→S) dispara una secuencia más épica que el level-up: el sello del rango antiguo se agrieta, el nuevo se estampa con onda expansiva, partículas y haptic largo, y queda grabado en el Perfil con marco nuevo. Ocurre pocas veces en la vida del cazador: cada una debe ser memorable y digna de captura de pantalla.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 2

### UIX-009 · Kit de partículas del sistema (Skia)
**Qué:** Componente reutilizable de emisores de partículas (chispas hexagonales, motas, ondas, trazos de luz) con presets azul/púrpura/rojo y API declarativa (burst, fountain, ambient). Garantiza coherencia visual entre completar, level-up, rango y mazmorras, y evita reimplementar partículas en cada feature. Es la base técnica de casi todo el juice del backlog.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### UIX-010 · Desglose de XP transparente al completar
**Qué:** La etiqueta de XP muestra el desglose "50 × 1,3 racha × 1,25 evidencia" que colapsa al total con animación. Hacer visibles los multiplicadores enseña la economía sin leer documentación y motiva activamente a mantener la racha y aportar evidencia de cámara.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### UIX-011 · Aura de racha con power-up de multiplicador
**Qué:** El contador de racha lleva una llama/aura azul cuya intensidad crece con el multiplicador; al cumplir cada bloque de 7 días, animación de power-up con anillo expansivo y mensaje "MULTIPLICADOR ×1,2 ACTIVADO". La racha pasa de ser un número a una posesión visible que da miedo perder: aversión a la pérdida bien canalizada.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### UIX-012 · Penalización con glitch rojo y XP que se desvanece
**Qué:** Al aplicarse la penalización diaria, la ventana del sistema tiembla y glitchea en rojo #FF5C6B y el XP perdido aparece como número rojo que cae y se disuelve, con doble pulso háptico grave. El castigo se siente sin ser cruel y mantiene la regla "rojo solo para alertas" con su momento más justificado.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### UIX-013 · Materialización de la ventana de misiones diarias
**Qué:** La primera apertura del día materializa la lista de hoy como invocación del sistema: marco que se dibuja, scanline vertical y título "MISIONES DIARIAS" con ping. Convierte abrir la app por la mañana en un pequeño ritual, no en una lista que simplemente está ahí.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### UIX-014 · Skeletons estilo sistema
**Qué:** Sustituir todo spinner por placeholders con la silueta real del contenido (tarjetas con esquinas cortadas en diagonal) y shimmer azul tenue mientras responde Supabase. La app se percibe más rápida, nunca muestra pantallazos vacíos y no rompe la estética ni medio segundo.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### UIX-015 · Sonido UI del sistema
**Qué:** Set de 8-10 sonidos cortos de interfaz estilo "sistema" (blip al completar, ping de ventana, chime ascendente de level-up, golpe seco de penalización, whoosh de transición) mezclados a volumen bajo, con toggle en ajustes y respeto del modo silencio del SO (expo-audio). El audio es la mitad del juice de un juego AAA y hoy la app es muda.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 5

### UIX-016 · Entrada en cascada de la lista de misiones
**Qué:** Las tarjetas de hoy entran escalonadas (60 ms entre sí) con fade + slide desde abajo al abrir Sistema, usando entering animations de Reanimated. Quick win que hace que la pantalla principal respire vida en cada apertura.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### UIX-017 · Count-up universal en números Orbitron
**Qué:** Todo número que cambie (XP, nivel, KPIs, stats) anima con count-up y easing mediante un componente compartido `<AnimatedNumber>`, en vez de saltar de golpe. Los números que ruedan se perciben como recompensa; los que saltan, como hoja de cálculo.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### UIX-018 · Subida de stats escalonada con iconos vivos
**Qué:** Cuando una misión sube stats, la barra correspondiente crece con spring, el número hace count-up y el icono del stat ejecuta una micro-animación propia (flexión en FUE, latido en VIT, chispa en INT, zancada en AGI, ojo en PER); si suben varias, secuencia escalonada. Refuerza la fantasía RPG de "mi personaje mejora de verdad".
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### UIX-019 · Hexágono del perfil como anillo de XP
**Qué:** El marco hexagonal de la foto de perfil se convierte en la propia barra de progreso al siguiente nivel: un trazo azul recorre el perímetro (path de Skia) y su glow se intensifica al acercarse al 100%. El elemento más identitario del Perfil pasa a comunicar progreso de un solo vistazo.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### UIX-020 · Misión de penalización que se purifica
**Qué:** La misión de penalización se muestra como tarjeta de borde rojo pulsante con cuenta atrás del día; al completarla, transición de "purificación": el rojo se disuelve en partículas azules y el XP recuperado vuela a la barra. Convierte la redención en un momento satisfactorio que empuja a no dejarla escapar ese mismo día.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### UIX-021 · Bajada de nivel: cristal agrietado
**Qué:** Si la penalización baja de nivel, secuencia inversa y sombría: el número se agrieta como cristal, cae un fragmento y no hay partículas de celebración, solo un único golpe háptico seco. El contraste con el level-up hace el coste memorable sin humillar al jugador.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### UIX-022 · Transiciones con elementos compartidos
**Qué:** La tarjeta de misión se expande hasta su pantalla de detalle (container transform) y la foto hexagonal viaja entre vistas, con shared element transitions de Reanimated sobre native-stack. Elimina los cortes secos entre pantallas y da la continuidad espacial de una app premium.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### UIX-023 · Toasts "ventana del sistema" apilables
**Qué:** Sistema único de avisos in-app: ventanitas con esquinas cortadas que entran desde arriba con glow según tipo (azul info/éxito, rojo alerta), se apilan, se descartan con swipe y auto-expiran. Sustituye los Alert.alert nativos, que rompen por completo la fantasía del sistema.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### UIX-024 · Reduce motion y selector de intensidad de juice
**Qué:** Respetar "reducir movimiento" del SO degradando cada animación a fades cortos, y añadir en ajustes un selector global de juice (Completo / Sutil / Mínimo) que escala duraciones, partículas y sonido. La estimulación alta motiva las primeras semanas pero puede saturar a largo plazo: dar control evita el abandono por fatiga sensorial.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### UIX-025 · Tema púrpura inmersivo en mazmorras
**Qué:** Al entrar a una mazmorra (proyecto), toda la UI vira al púrpura #8A76E8 —acentos, glow, partículas, barra de progreso— y vuelve al azul con crossfade al salir. El cambio cromático crea sensación de "lugar" distinto y marca mentalmente el modo de trabajo profundo en proyectos.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### UIX-026 · Portal de entrada a mazmorra
**Qué:** Abrir el detalle de un proyecto atraviesa un portal: anillo púrpura que se expande con distorsión radial (shader de Skia) y revela la pantalla interior, en 600 ms y saltable. Entrar a trabajar en un proyecto debe sentirse como cruzar una gate de Solo Leveling, no como navegar a un detalle.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 2

### UIX-027 · Captura de evidencia con sello +25%
**Qué:** Al tomar la foto de evidencia, flash azul breve, la miniatura vuela y encaja en la tarjeta con click háptico, y se acuña encima un sello giratorio "+25%". Hace tangible el bonus de evidencia en el momento y convierte el paso obligatorio en una pequeña recompensa en sí mismo.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### UIX-028 · Tab bar custom del sistema
**Qué:** Reemplazar la tab bar nativa por una con estética NIVL: esquinas cortadas, iconos con glow azul en activo, indicador que se desliza con spring entre tabs y tick háptico al cambiar. Es el elemento visible en el 100% de las sesiones y hoy es lo menos "del sistema" de toda la app.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### UIX-029 · Modo una mano
**Qué:** Auditar y reubicar las acciones primarias (completar, añadir misión, abrir cámara) en el tercio inferior de la pantalla, con bottom sheets en lugar de modales centrados y FAB alcanzable. Objetivo medible: completar una misión con el pulgar sin recolocar la mano, por ejemplo en el metro o entre series en el gym.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### UIX-030 · Música ambiental adaptativa
**Qué:** Loop ambient oscuro opcional (off por defecto) tipo OST de mazmorra a volumen muy bajo, con crossfade a una capa más tensa dentro de mazmorras y pausa automática en segundo plano o con audio externo activo. Para sesiones largas de planificación o revisión, fija la atmósfera del mundo NIVL.
**Impacto:** 3/5 · **Esfuerzo:** L · **Fase:** 5

### UIX-031 · Widget de pantalla de inicio
**Qué:** Widget nativo iOS/Android con estética de ventana del sistema: misiones de hoy con checks, racha con llama y barra de XP, en tamaños pequeño y mediano. Saca el loop a la home del móvil: ver "2/5" sin abrir la app es un trigger de hábito gratuito varias veces al día.
**Impacto:** 3/5 · **Esfuerzo:** L · **Fase:** 5

### UIX-032 · Live Activity con el progreso del día
**Qué:** Live Activity en iOS (con Dynamic Island) y notificación persistente en Android mostrando "3/5 misiones · racha 12 · 4 h restantes", activable a partir de la tarde. El progreso queda visible en la pantalla de bloqueo justo en la franja donde más rachas mueren.
**Impacto:** 3/5 · **Esfuerzo:** L · **Fase:** 6

### UIX-033 · Hold-to-confirm en misiones épicas
**Qué:** Las misiones épicas (250 XP) no se completan con un tap: hay que mantener pulsado ~700 ms mientras un anillo de progreso se cierra con haptic creciente y termina en un burst mayor. La fricción deliberada hace que las recompensas grandes se sientan ganadas, no clicadas por accidente.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### UIX-034 · Mensajes del sistema con efecto typewriter
**Qué:** Los textos "hablados" por el sistema (avisos, celebraciones, penalizaciones) se escriben carácter a carácter con cursor parpadeante y blips sutiles, a ~30 caracteres/s y saltables con tap. Es el tic audiovisual más reconocible del anime y le da voz propia a la app.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### UIX-035 · Estados vacíos con lore
**Qué:** Cada lista vacía recibe una ilustración vectorial del sistema y microcopy en personaje ("No hay misiones asignadas, cazador. El sistema aguarda tus órdenes.") más un CTA directo a crear. Los estados vacíos actuales son momentos muertos que pueden vender la fantasía.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### UIX-036 · Sistema unificado de botones
**Qué:** Componente único de botón con cuatro estados animados: pressed (scale 0,97 + glow), loading (spinner inline sin cambiar de tamaño), success (el texto hace morph a un check) y disabled (50% de opacidad sin glow). Elimina inconsistencias entre pantallas y hace cada tap físicamente respondón.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### UIX-037 · VoiceOver y TalkBack completos en español
**Qué:** Etiquetas y roles de accesibilidad en todos los controles, anuncios de valores ("FUE, 45 de 100", "Misión completada, más 65 XP"), orden de foco lógico en las tres pantallas y anuncio de eventos grandes (level-up) vía accessibilityAnnouncement. La app debería poder jugarse con los ojos cerrados.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### UIX-038 · Heatmap del calendario con encendido escalonado
**Qué:** En el calendario de fase 2, los días completados se encienden en cascada radial desde hoy, con intensidad de azul proporcional al porcentaje de misiones logradas. Ver la cadena iluminarse al abrir la vista activa el "don't break the chain" de forma visceral.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### UIX-039 · Selector de dificultad con juice creciente
**Qué:** En el formulario de misión, los chips trivial→épica escalan en glow, tamaño y fuerza háptica según el nivel; épica vibra y emite chispas al seleccionarse, mostrando su XP con count-up. Hace sentir el peso de la recompensa ya en el momento de planificar.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### UIX-040 · Bottom sheets para crear y editar misiones
**Qué:** Sustituir las pantallas/modales del CRUD por bottom sheets con snap points (gorhom/bottom-sheet), fondo atenuado y la lista aún visible detrás. Editar sin perder el contexto reduce la fricción de mantener el sistema de misiones al día.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### UIX-041 · Countdown visual del día tras las 21:30
**Qué:** Si quedan misiones pendientes después del recordatorio de las 21:30, aparece en Sistema una barra fina del tiempo restante hasta medianoche con pulso rojo suave y la llama de racha "temblando" ligeramente. Urgencia honesta y proporcionada, usando el rojo solo donde está permitido: en una alerta real.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### UIX-042 · Listas a 60/120 fps
**Qué:** Migrar las listas a FlashList con ítems memoizados, mover toda animación a worklets de Reanimated y auditar jank con el perf monitor en un Android de gama media. Presupuesto explícito: cero frames perdidos haciendo scroll con 50 misiones. El juice solo funciona si jamás tartamudea.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### UIX-043 · Arranque sin saltos
**Qué:** Precargar Orbitron/Rajdhani con expo-font manteniendo el splash visible (expo-splash-screen) y fundirlo directamente sobre la pantalla Sistema ya renderizada, sin flash blanco ni reflow de fuentes. Los dos primeros segundos de cada sesión definen la percepción de calidad de todo lo demás.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### UIX-044 · Undo en lugar de modales de confirmación
**Qué:** Borrar o desmarcar una misión actúa al instante y ofrece "Deshacer" en un toast del sistema durante 5 s, en vez del modal "¿Estás seguro?". Menos fricción en el 95% de los casos y red de seguridad en el 5% restante.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### UIX-045 · Pipeline visual de evidencias
**Qué:** Miniaturas de evidencia con placeholder blurhash que aparecen sin saltos de layout, y anillo de progreso alrededor de la miniatura durante la subida a Storage, con reintento visible si falla. Las fotos son el contenido más pesado de la app y hoy concentran toda la sensación de espera.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### UIX-046 · Tipografía dinámica y targets de 44 pt
**Qué:** Soportar el font scaling del SO con maxFontSizeMultiplier calibrado para que las ventanas del sistema no se rompan, y garantizar áreas táctiles mínimas de 44×44 pt (hitSlop en checks e iconos pequeños). Pulido invisible que evita taps fallidos en movimiento, por ejemplo andando hacia clase.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### UIX-047 · Auditoría de contraste AA
**Qué:** Verificar todos los pares texto/fondo contra WCAG AA (los grises secundarios sobre #060B16 son los principales sospechosos), ajustar los tokens y documentar la paleta accesible resultante. El azul neón deslumbra de noche pero no siempre se lee bien con sol en exteriores.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### UIX-048 · Radar pentagonal de stats
**Qué:** Vista alternativa del Perfil con los 5 stats como radar pentagonal que se dibuja animado al entrar (trazo Skia + relleno translúcido) y compara con el snapshot de hace 30 días en línea punteada. Es LA visualización canónica de personaje RPG y muestra el crecimiento equilibrado (o no) de un vistazo.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### UIX-049 · Icono de app que evoluciona con el rango
**Qué:** El icono de la app cambia automáticamente al subir de rango (E apagado → … → S radiante) usando alternate icons en iOS y adaptive icons en Android. El progreso se exhibe hasta en el cajón de aplicaciones: micro-flex diario y recordatorio permanente del camino al rango S.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### UIX-050 · Cola de celebraciones
**Qué:** Gestor central que encola level-up, logro, cambio de rango y cierre de día y los reproduce en secuencia con prioridades, evitando que animaciones y sonidos se pisen cuando varios eventos disparan a la vez (última misión + level-up + logro). Cada celebración conserva su impacto en vez de convertirse en ruido.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### UIX-051 · Boot sequence en arranque en frío
**Qué:** Solo en cold start, 800 ms de líneas tipo terminal sobre el splash ("INICIALIZANDO SISTEMA… CAZADOR RECONOCIDO. BIENVENIDO.") con cursor y blip, saltable con tap y desactivable en ajustes. Pequeño ritual de inmersión que separa a NIVL de cualquier to-do list desde el primer frame.
**Impacto:** 2/5 · **Esfuerzo:** S · **Fase:** 5

### UIX-052 · Partículas ambientales de fondo
**Qué:** Capa Skia de motas azules flotando lentísimo sobre el fondo #060B16 de las pantallas principales, con densidad baja, pausa automática fuera de foco y desactivación con reduce motion o batería baja. El mundo del sistema se siente vivo incluso en reposo, sin robar atención ni batería.
**Impacto:** 2/5 · **Esfuerzo:** M · **Fase:** 5

Total: 52 mejoras.
