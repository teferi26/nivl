# Evidencias y verificación

> Categoría EVI · backlog NIVL · ordenadas por impacto

### EVI-001 · Muro de la Verdad: galería global de evidencias
**Qué:** Pestaña-galería con todas las fotos/vídeos de evidencia en cuadrícula cronológica, agrupadas por mes y coloreadas por stat. Abrirla es ver tu vida demostrada con pruebas: el "no me lo invento, lo hice" en una sola pantalla, el mayor refuerzo de identidad que puede dar la app.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### EVI-002 · Timelapse automático de progreso físico
**Qué:** Las fotos de físico (misión semanal FUE/VIT) se capturan siempre con la misma plantilla de encuadre y la app genera un timelapse en vídeo al acumular 4+ fotos, con contador de semanas y nivel superpuestos. Ver tu cuerpo cambiar en 10 segundos es la recompensa diferida más potente del fitness, imposible de obtener mirándote al espejo cada día.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 3

### EVI-003 · Validación de evidencias con IA de visión
**Qué:** Al subir la foto, un modelo de visión multimodal comprueba que coincide con el tipo de misión —plato de comida, máquina de gym, apuntes, báscula— y devuelve veredicto en <3 s: "EVIDENCIA ACEPTADA POR EL SISTEMA" o petición de recaptura. Convierte el bonus de evidencia en algo ganado de verdad y elimina la tentación de subir cualquier cosa.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 3

### EVI-004 · Sello del Sistema sobre cada foto
**Qué:** Marca de agua generada en el momento de la captura: fecha y hora, nombre de la misión, nivel y rango del cazador, con estética de ventana del sistema en #37C8F0 y esquinas cortadas. Cada evidencia se convierte en un documento oficial de tu progreso, coleccionable y compartible sin edición externa.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### EVI-005 · Comparativa antes/después con slider
**Qué:** Selector de dos evidencias del mismo tipo (físico, escritorio, plato) con visor de cortina deslizable y etiquetas de fecha/peso/nivel en cada lado. El contraste visual directo es el argumento definitivo contra el "no estoy avanzando" en las semanas de meseta.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 3

### EVI-006 · Entrenos del reloj como evidencia automática
**Qué:** Integración con HealthKit/Health Connect: si hay un entreno registrado (duración, calorías, pulso) en la franja horaria de la misión de gym, la evidencia se valida sola y muestra los datos como "informe de combate". Cero fricción para el hábito más físico de todos y prueba imposible de falsear sin entrenar.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 3

### EVI-007 · Plantillas de captura por tipo de hábito
**Qué:** Cada misión declara su tipo de prueba (báscula, plato, pantalla de app de estudio, espejo de gym, escritorio) y la cámara se abre con un overlay-guía específico: marco para la pantalla de la báscula, encuadre cenital para el plato, silueta para el físico. Capturar bien deja de requerir pensar y las fotos quedan comparables entre días.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### EVI-008 · Guía fantasma para fotos de físico
**Qué:** Al hacer la foto de progreso, la cámara superpone en transparencia (onion skin) la última foto válida para clavar la misma pose, distancia y luz. Sin alineación no hay timelapse creíble; con ella, cada foto nueva encaja como un fotograma más.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### EVI-009 · Sellado con hora del servidor
**Qué:** El timestamp de la evidencia lo emite Postgres (now() de Supabase) en la inserción, nunca el reloj del móvil; si el dispositivo difiere más de 5 minutos, la evidencia queda marcada con aviso. Cierra la trampa más obvia —cambiar la hora del teléfono— con un día de trabajo.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### EVI-010 · Detector de fotos recicladas
**Qué:** Hash perceptual (pHash) de cada evidencia comparado contra las de los últimos 30 días; si la similitud supera el umbral, el Sistema responde "PRUEBA DUPLICADA DETECTADA" y pide otra captura. Evita el patrón clásico de re-fotografiar el mismo plato o el mismo apunte.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### EVI-011 · OCR de báscula
**Qué:** La foto de la báscula pasa por OCR y el peso se registra solo (con confirmación de un toque), alimentando la gráfica de peso del módulo de dieta. Quita el doble trabajo foto+anotación y convierte la báscula en un sensor del Sistema.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 3

### EVI-012 · OCR de pantallas de estudio
**Qué:** Las capturas de Forest, Screen Time o el cronómetro de estudio se procesan con OCR para extraer minutos y app, registrando la sesión INT automáticamente y detectando incoherencias (captura de otro día). La evidencia de estudio pasa de "foto que nadie mira" a dato verificado que mueve XP.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 4

### EVI-013 · Calendario de miniaturas por misión
**Qué:** En el detalle de cada misión, un calendario mensual donde cada día completado muestra la miniatura de su evidencia en lugar de un simple check. Ver 22 fotos de gym seguidas es una racha que duele romper mucho más que un contador numérico.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### EVI-014 · Índice de integridad por evidencia
**Qué:** Cada evidencia recibe un grado visible: ORO (cámara en vivo verificada), PLATA (galería con EXIF coherente), BRONCE (sin prueba, palabra del cazador), y el grado modula el bonus de XP (+25/+10/0%). Hace explícita la jerarquía de confianza y empuja suavemente hacia la prueba en vivo sin prohibir nada.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### EVI-015 · Evidencias offline-first
**Qué:** La foto se guarda y sella localmente al instante y una cola en segundo plano la sube a Supabase Storage con reintentos cuando vuelve la red, con icono de estado (pendiente/sincronizada). En el gym sin cobertura la app debe sentirse igual de instantánea; ningún check puede perderse por un túnel de metro.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### EVI-016 · Informe visual semanal del Sistema
**Qué:** Cada domingo a las 21:30 el Sistema compone un collage-resumen con las mejores evidencias de la semana, XP total y stat dominante, presentado como "INFORME DE CAZA SEMANAL". Revivir la semana en imágenes consolida la identidad ("soy alguien que entrena y estudia") mejor que cualquier estadística numérica.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### EVI-017 · Comparativas hito sugeridas por el Sistema
**Qué:** A los 30/90/180 días de evidencias de un mismo tipo, aparece una ventana del Sistema: "Cazador, han pasado 90 días. ¿Deseas contemplar tu evolución?" y abre la comparativa ya montada. Automatizar el momento épico garantiza que ocurra justo cuando la motivación más lo necesita.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 4

### EVI-018 · Check-in de mazmorra por geolocalización
**Qué:** Geocerca opcional en el gimnasio (y biblioteca): al entrar, la app detecta la "entrada a la mazmorra", pre-valida la misión y solo pide la foto de salida. Reduce la fricción del registro al mínimo y añade el sello "Mazmorra: Gimnasio" a la evidencia.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### EVI-019 · Bóveda privada con biometría
**Qué:** Las fotos de físico viven en una sección cifrada de la galería que exige Face ID/huella para abrirse y quedan excluidas del carrete del sistema operativo. Sin sensación de privacidad total nadie se hace fotos sin camiseta de forma constante; la bóveda elimina ese freno.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### EVI-020 · Verificación EXIF de fotos de galería
**Qué:** Si la misión permite adjuntar desde galería, la app lee el EXIF y rechaza (o degrada a BRONCE) fotos cuya fecha de captura no sea de hoy, mostrando el motivo en lenguaje del Sistema. Cierra la segunda trampa más común: subir la foto de la semana pasada.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### EVI-021 · Ritual semanal de foto de físico
**Qué:** Misión fija autoconfigurada (p. ej. domingo 10:00, tras la ducha) con notificación propia, plantilla de pose y checklist de condiciones (misma luz, mismo espejo). La consistencia del ritual es lo que hace posible el timelapse y las comparativas; sin cita fija, las fotos de progreso mueren en dos semanas.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### EVI-022 · Nota de examen como prueba de jefe derrotado
**Qué:** Las mazmorras de examen aceptan como evidencia final la foto de la calificación publicada; al validarla se dispara la animación de "JEFE DERROTADO" con su XP épico. Ata la recompensa máxima del juego al resultado académico real, no solo a las horas de estudio.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### EVI-023 · Evidencia de sueño automática
**Qué:** Las misiones VIT de sueño se validan leyendo HealthKit/Health Connect (hora de acostarse, duración) sin que el usuario haga nada al despertar. La prueba del sueño es la más absurda de aportar manualmente; automatizarla salva el hábito más importante para un estudiante en exámenes.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 4

### EVI-024 · Juez de dieta con IA
**Qué:** La foto del plato se contrasta con la dieta semanal planificada (módulo de fase 3): la IA estima si la comida corresponde a lo programado y responde con veredicto y nota breve ("Coincide con comida 3: pollo y arroz"). Une evidencia y plan nutricional en un solo gesto de cámara.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 4

### EVI-025 · Multi-foto por evidencia
**Qué:** Hasta 3 capturas por misión (plato + báscula de alimentos; pizarra + apuntes) presentadas como carrusel en el detalle de la evidencia. Algunas pruebas honestas necesitan más de un ángulo; limitar a una foto fuerza elecciones tontas.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### EVI-026 · Vídeo corto como evidencia
**Qué:** Clips de 5-15 s (última serie del press banca, recitar el tema en voz alta) con compresión automática a 720p antes de subir a Storage. Hay hábitos cuya prueba honesta es movimiento, no foto; y revisarlos después en el Muro es oro motivacional.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 2

### EVI-027 · Cámara instantánea desde el check
**Qué:** Precalentar la sesión de cámara al abrir la pantalla Sistema para que del toque en "completar" al obturador pasen menos de 1 segundo, sin pantallas intermedias. Cada segundo de fricción en el momento de la prueba multiplica los "luego la subo" que nunca llegan.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### EVI-028 · Visor inmersivo de evidencia
**Qué:** Tocar cualquier evidencia abre un visor a pantalla completa con pinch-zoom, fondo #060B16 y panel inferior con el sello completo: hora, lugar, misión, grado de integridad y XP otorgado. Las pruebas merecen presentación de trofeo, no un thumbnail mudo.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### EVI-029 · Evidencia tardía con bonus reducido
**Qué:** Ventana de gracia de 2 h para adjuntar la prueba después del check con bonus reducido (+10% en vez de +25%), indicado con claridad en el momento. A veces el gym no es lugar para el móvil; castigar la prueba diferida con cero la desincentiva del todo.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### EVI-030 · Ventana "El Sistema exige prueba"
**Qué:** Al completar sin foto una misión con evidencia obligatoria, modal estilo penalización de Solo Leveling: "EL SISTEMA EXIGE PRUEBA. Aporta evidencia o el check quedará en BRONCE (sin bonus)". La fricción teatral en el momento justo convierte la norma en parte del juego en vez de burocracia.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### EVI-031 · Modo manos libres
**Qué:** Temporizador de 5/10 s con cuenta atrás sonora y captura automática, pensado para las fotos de físico frente al espejo sin sujetar el móvil. Elimina la gimnasia imposible de posar y disparar a la vez.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### EVI-032 · Control de calidad de captura
**Qué:** Detección on-device de fotos borrosas, oscuras o movidas justo tras el disparo, con aviso inmediato "PRUEBA ILEGIBLE — recaptura requerida" y reintento en un toque. Una galería de manchas negras mata el Muro de la Verdad; el control en origen lo protege.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### EVI-033 · Filtros y búsqueda en el Muro
**Qué:** Filtros por stat, misión, rango de fechas, grado de integridad y tipo (foto/vídeo/captura), más salto rápido por mes. Cuando haya 500 evidencias, encontrar "todas las del gym de marzo" debe costar dos toques.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### EVI-034 · Timelapse de mazmorra
**Qué:** Las sesiones de un proyecto (mazmorra) piden una foto del avance (escritorio, código, maqueta) y al cerrar la mazmorra se genera el timelapse del proyecto de principio a fin. Ver nacer un TFG o una app en 15 segundos es el cierre épico que merece una mazmorra larga.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### EVI-035 · Cadena de custodia de evidencias
**Qué:** Hash SHA-256 de cada archivo + timestamp de servidor guardados en una tabla append-only; las evidencias quedan inmutables a las 24 h y muestran un ID corto de verificación (#A3F9) en su sello. El "no puedo reescribir mi pasado" da peso real al Muro de la Verdad.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### EVI-036 · Racha de integridad y título "Cazador Honesto"
**Qué:** Contador de días consecutivos con el 100% de evidencias en grado ORO; a los 30 días desbloquea el título "Cazador Honesto" visible en el perfil, con hitos a 60 y 100. Recompensa jugar limpio en un juego donde la única víctima de la trampa eres tú mismo.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### EVI-037 · Veredicto nocturno del Sistema
**Qué:** A las 22:00 la IA revisa en lote las evidencias del día y emite un "VEREDICTO DEL SISTEMA" con notificación: todas válidas → +5% de XP del día como sello de autenticidad; dudosas → quedan marcadas para revisión. Crea un pequeño juicio diario que da gravedad al sistema de pruebas con un único request barato.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### EVI-038 · Juramento ante el Sistema
**Qué:** Cuando la IA no puede verificar una prueba ambigua, en vez de rechazarla muestra: "El Sistema no puede verificar esta prueba. ¿Juras por tu rango que es verídica?" con botón de juramento que queda registrado en el historial. La psicología del compromiso explícito reduce el autoengaño más que cualquier algoritmo.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### EVI-039 · Informe mensual de integridad
**Qué:** Sección en los informes de fase 4 con % de misiones probadas, desglose ORO/PLATA/BRONCE, mejor racha de integridad y comparativa con el mes anterior. Lo que se mide mejora: ver un 92% de pruebas en vivo invita a defender el número al mes siguiente.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### EVI-040 · Mapa de calor de evidencias
**Qué:** Vista del Muro tipo contribuciones de GitHub: un año de celdas coloreadas por densidad de evidencias y stat dominante, con toque para saltar a las pruebas de ese día. Los huecos en el mapa pican; las zonas densas enorgullecen.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### EVI-041 · Captura directa desde la notificación de las 21:30
**Qué:** La notificación nocturna de misiones pendientes incluye la acción "Aportar prueba" que abre la cámara ya situada en la misión correcta. Atajar dos pantallas a las 21:30 salva los checks del día en el minuto crítico.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### EVI-042 · Tarjeta compartible de evidencia
**Qué:** Generador de tarjeta 1080×1350 para compartir una evidencia o comparativa: foto + sello del Sistema + nivel/rango + branding NIVL, exportada a la hoja de compartir nativa. La rendición de cuentas pública (Instagram, grupo de amigos) es uno de los mayores multiplicadores de adherencia que existen.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### EVI-043 · Exportación de timelapse en MP4
**Qué:** Render del timelapse o la comparativa como vídeo MP4 con transiciones, contador de semanas y outro con el sello NIVL, guardado en el carrete. El momento "mira mi cambio en 6 meses" debe poder salir de la app con dos toques.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### EVI-044 · Validación instantánea on-device
**Qué:** Clasificador ligero embebido (TensorFlow Lite) que valida en el propio móvil las categorías frecuentes (comida, gym, pantalla, báscula) en <300 ms y sin coste de API, reservando la IA en la nube para los casos dudosos. Feedback inmediato y factura de API contenida cuando haya cientos de evidencias al mes.
**Impacto:** 3/5 · **Esfuerzo:** L · **Fase:** 5

### EVI-045 · Detección de pose con feedback en vivo
**Qué:** ML de pose (MediaPipe) durante la foto de físico que guía en tiempo real —"sube el mentón, brazos relajados"— y solo dispara cuando la postura coincide con la de referencia. Lleva la consistencia del timelapse de "aceptable" a nivel estudio profesional.
**Impacto:** 3/5 · **Esfuerzo:** L · **Fase:** 5

### EVI-046 · Comparativa de fuerza en vídeo
**Qué:** Reproductor lado a lado de dos clips del mismo ejercicio (sentadilla de enero vs junio) con peso y fecha rotulados y sincronización manual del inicio del levantamiento. El progreso de fuerza se ve en la velocidad de la barra; verlo duplica la motivación del siguiente PR.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### EVI-047 · Comentario del Sistema sobre tu evolución física
**Qué:** Con 3+ meses de fotos alineadas, la IA describe los cambios visibles en tono del Sistema ("Hombros visiblemente más anchos que en marzo. La caza progresa") junto a la comparativa, siempre con sesgo constructivo y sin estimaciones médicas. Un observador externo que confirma el cambio combate la ceguera al propio progreso.
**Impacto:** 3/5 · **Esfuerzo:** L · **Fase:** 6

### EVI-048 · Onboarding del sistema de pruebas
**Qué:** Tutorial interactivo de 3 pantallas la primera vez que una misión exige evidencia: por qué existe el bonus +25%, qué grados de integridad hay y demo de captura con sello. Quien entiende la economía de la prueba la usa; quien no, la percibe como burocracia.
**Impacto:** 2/5 · **Esfuerzo:** S · **Fase:** 2

### EVI-049 · Papelera de evidencias
**Qué:** Borrado en dos pasos con papelera de 30 días y aviso claro de las consecuencias (el bonus ya otorgado no se revierte, pero la misión queda en BRONCE). Evita pérdidas accidentales sin abrir la puerta a manipular el historial.
**Impacto:** 2/5 · **Esfuerzo:** S · **Fase:** 3

### EVI-050 · Gestión inteligente de almacenamiento
**Qué:** Originales en Supabase Storage durante 90 días y miniaturas + versión 1080p para siempre; pantalla de uso con espacio ocupado por stat y limpieza opcional. Mantiene años de Muro de la Verdad sin que el bucket (ni el plan gratuito) explote.
**Impacto:** 2/5 · **Esfuerzo:** M · **Fase:** 5

### EVI-051 · Testigo externo
**Qué:** Compartir una misión-reto con un "testigo" (un amigo, sin necesidad de cuenta) que recibe un enlace web donde ve la evidencia y pulsa "doy fe"; su validación añade un sello extra y +5% de XP. Introduce rendición de cuentas humana sin construir todo un sistema social.
**Impacto:** 2/5 · **Esfuerzo:** M · **Fase:** 7

### EVI-052 · Exportación completa del archivo de pruebas
**Qué:** Generar un ZIP con todas las evidencias originales, sus sellos y un index.html navegable por fecha y misión, descargable o enviado por email. Tu archivo vital es tuyo: poder llevártelo da confianza para volcar años de fotos en la app.
**Impacto:** 2/5 · **Esfuerzo:** M · **Fase:** 6

Total: 52 mejoras.
