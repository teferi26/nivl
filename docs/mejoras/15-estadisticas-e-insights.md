# Estadísticas, informes e insights

> Categoría EST · backlog NIVL · ordenadas por impacto

### EST-001 · Informe semanal narrado por el Sistema
**Qué:** Cada domingo a las 21:00 se abre una ventana del sistema (esquinas cortadas, scanlines) con el resumen de la semana: XP total y delta vs semana anterior, stat estrella, stat descuidada, evolución de la racha y misión más fallada, narrado en 3-4 frases con la voz fría del Sistema generadas por plantillas alimentadas con datos reales ("El Sistema ha registrado un incremento del 18% en INT. Pocos cazadores de rango D mantienen esta disciplina."). La revisión semanal es el ritual con más evidencia en la ciencia del hábito: convierte datos en reflexión sin esfuerzo y crea una cita fija con la app.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 4

### EST-002 · Heatmap anual tipo GitHub
**Qué:** "Mapa de actividad del cazador": rejilla de 365 días con 5 intensidades de azul #37C8F0 según el % de misiones completadas de cada día, filtro por stat y scroll horizontal por años; tap en cualquier celda abre el detalle del día. Ver la cadena completa dispara el efecto "no rompas la cadena" a escala anual. Solo necesita datos que ya existen desde fase 1: quick win de altísimo retorno.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### EST-003 · Dashboard "Centro de mando"
**Qué:** Pestaña de Estadísticas con vista única: anillo de cumplimiento de hoy, XP de la semana con sparkline, racha y multiplicador actuales, heatmap de 30 días comprimido, el insight del día y accesos a los informes. Todo renderiza en <300 ms gracias a los agregados precalculados (EST-024). Es la sala de estado del cazador: un vistazo y sabes cómo va tu vida entera.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 4

### EST-004 · Proyección de rango con fecha concreta
**Qué:** Bajo la barra de nivel del Perfil: "A este ritmo alcanzarás el rango B el 12 de marzo", calculada con la media móvil de XP de 30 días y banda optimista/pesimista (tu mejor y peor semana). Se recalcula a diario y celebra con micro-animación cuando la fecha se adelanta. El gradiente de meta es de los motivadores más potentes: una fecha tangible convierte el "algún día" en cuenta atrás.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 3

### EST-005 · Motor de insights automáticos diarios
**Qué:** Motor de reglas (~30 detectores: mejor día de la semana, stat descuidada, récord a punto de caer, hora de mayor éxito, misión que más falla) que cada mañana publica una tarjeta de insight en la pantalla Sistema con CTA accionable ("Los lunes completas el 92%: programa ahí lo difícil"). Prioriza por severidad y novedad y nunca repite el mismo insight en 7 días. Convierte los datos en consejo sin que el usuario tenga que interpretar gráficos.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 4

### EST-006 · Motor de correlaciones entre hábitos (sueño↔gym)
**Qué:** Cruce estadístico de pares de hábitos y métricas con histórico suficiente (sueño↔asistencia al gym, adherencia a dieta↔XP de INT, gym↔calidad de sueño) que publica tarjetas tipo "Los días que duermes 7h+ completas el gym un 31% más (n=46 días)". Las correlaciones nuevas se anuncian como "descubrimientos del Sistema". Descubrir relaciones reales de tu propia vida es el insight más "wow" posible; va en fase 5 porque necesita los datos de sueño/dieta/gym de fase 3 más semanas de histórico.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 5

### EST-007 · Cazador Sombra: tú contra tu yo pasado
**Qué:** Superposición en cualquier gráfico de tu "sombra": tus propios datos de hace 30/90 días dibujados en púrpura #8A76E8 translúcido, con veredicto diario ("Vas un 22% por delante de tu sombra"). En una app de un solo jugador, tu yo pasado es el único rival justo, y en el lore de Solo Leveling vencer a tu sombra es canon puro.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 4

### EST-008 · Flechas de tendencia en el Perfil
**Qué:** Junto a cada una de las 5 barras de stats del Perfil, una flecha ▲/▼/— con el % de cambio de XP semanal frente a la semana anterior, en azul si sube y rojo #FF5C6B solo si cae. Quick win que convierte el perfil estático en un organismo vivo que reacciona a tu semana.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### EST-009 · Salón de récords personales
**Qué:** Pantalla con tus marcas: mejor racha, día con más XP, mejor semana, más misiones en un día, check más madrugador y mes con más días perfectos, cada una con fecha y valor. Al batir una salta el popup "¡NUEVO RÉCORD PERSONAL!" con el valor anterior tachado. Las marcas propias motivan incluso cuando la racha se rompe: siempre queda un número que batir.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### EST-010 · Tendencias por stat
**Qué:** Gráfico de línea/área por cada stat (FUE, VIT, INT, AGI, PER) con XP semanal, selector de 4/12/26 semanas y flecha de tendencia calculada con regresión simple y % de cambio. De un vistazo ves qué área de tu vida crece y cuál se está enfriando.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### EST-011 · Informe mensual "Evaluación de la Asociación"
**Qué:** El día 1 de cada mes, evaluación oficial con nota E-S por stat (percentil sobre tu propio histórico), resumen de XP, días perfectos, récords del mes y un objetivo sugerido para el siguiente; se abre con animación de sello. Cierra el ciclo mensual con sensación de boletín de notas de cazador.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### EST-012 · Comparativa mes a mes
**Qué:** Carrusel de tarjetas mensuales (XP total, % de cumplimiento, días perfectos, mejor stat) con deltas coloreados frente al mes anterior y ranking de tus mejores meses históricos. Responde a "¿estoy mejor que el mes pasado?" en dos segundos.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### EST-013 · Autopsia de rachas rotas
**Qué:** Al romperse una racha, ventana post-mortem: qué misión falló, qué día y hora, y el patrón común con roturas anteriores ("3 de tus 4 rachas han muerto en domingo"), más un consejo preventivo concreto. Transforma el peor momento emocional de la app en aprendizaje en lugar de frustración y abandono.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### EST-014 · Predicción de riesgo de fallo esta noche
**Qué:** Modelo de frecuencias (día de la semana × misión × hora) que cada tarde calcula el riesgo de las misiones pendientes y, si supera el umbral, avisa a las 19:00: "VIT en riesgo: los viernes fallas la dieta el 60% de las veces". El Sistema pasa de castigar a proteger: el aviso llega cuando todavía puedes salvar el día.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 5

### EST-015 · Desbloqueo progresivo de estadísticas
**Qué:** Las vistas se desbloquean como recompensas con umbral de datos: tendencias a los 14 días, heatmap completo a los 30, correlaciones a los 60; los paneles bloqueados muestran "Recolectando datos: 9/14 días" con barra de progreso. Convierte los estados vacíos —el gran punto débil de toda app de stats— en metas que generan anticipación.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### EST-016 · Calculadora de ritmo objetivo
**Qué:** Eliges una meta ("rango C antes del 1 de julio") y devuelve la cuota diaria necesaria frente a tu media actual ("necesitas 115 XP/día, llevas 80") con semáforo diario de si vas en ritmo. Traducir una meta lejana a cuota de hoy la hace ejecutable hoy.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### EST-017 · Cuánto vale tu racha (aversión a la pérdida)
**Qué:** Tarjeta fija en estadísticas: "Tu multiplicador ×1,3 te ha dado +1.240 XP este mes; si rompes la racha vuelves a ×1,0", calculada restando el XP base del XP realmente cobrado. Aversión a la pérdida bien aplicada: proteger algo que ya es tuyo motiva más que ganar algo nuevo.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### EST-018 · Alerta de stat descuidada
**Qué:** Detector que avisa cuando un stat lleva N días (por defecto 10) sin generar XP: tarjeta "PER lleva 11 días a cero" con CTA para activar o crear una misión de ese stat. Corrige el sesgo natural de volcarse solo en las áreas que ya van bien.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### EST-019 · Ficha estadística por misión
**Qué:** Detalle por hábito: % de éxito histórico y de los últimos 30 días, racha actual y mejor, XP total aportado, mini-heatmap de 90 días y el día de la semana donde más falla, accesible desde el CRUD de misiones. Permite decidir con datos qué hábito ajustar, trocear o eliminar.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### EST-020 · Radar pentagonal de stats con fantasma
**Qué:** Pentágono RPG de los 5 stats con relleno azul translúcido y, superpuesta en línea discontinua, tu silueta de hace 30 días; animación de despliegue al entrar. Es la foto de "qué clase de cazador soy" y evidencia los desequilibrios entre áreas de vida al instante.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### EST-021 · Análisis por día de la semana
**Qué:** Barras de cumplimiento medio de lunes a domingo sobre las últimas 12 semanas, con el peor día resaltado e insight ("Los miércoles caes al 54%: es tu mazmorra real"). Conocer tu día débil permite reforzarlo con menos carga o recordatorios extra.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### EST-022 · Curva de XP acumulado con hitos
**Qué:** Área de XP total desde el día 1 con marcadores en cada subida de nivel y cambio de rango, zoom por pellizco y scrubbing con tooltip al deslizar el dedo. La pendiente de tu vida en un gráfico: ver que nunca baja (solo se frena) es profundamente motivador.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### EST-023 · Detección de hábito en declive
**Qué:** Si un hábito cae en cumplimiento 3 semanas consecutivas (90%→75%→60%), tarjeta de alerta temprana con tres salidas: bajar dificultad, cambiar de horario o pausarlo conscientemente. Los hábitos no mueren de golpe, se apagan; detectarlo a tiempo evita el abandono silencioso.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### EST-024 · Infraestructura de agregados diarios
**Qué:** Tabla daily_stats en Supabase (XP por stat, misiones completadas/falladas, % del día) rellenada por trigger al cierre del día, más caché local para consulta offline; toda la categoría EST lee agregados en lugar de recalcular el histórico completo. Enabler técnico: sin esto cada gráfico será lento, caro y dependiente de red.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### EST-025 · Burndown de mazmorras con proyección
**Qué:** Por cada mazmorra (proyecto) activa, gráfico burndown de tareas restantes frente a la línea ideal hasta la deadline, con proyección honesta: "a este ritmo terminarás el 18 de mayo, 3 días tarde". Ideal para entregas universitarias: la procrastinación se convierte en una curva que se ve venir.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### EST-026 · Informe anual del cazador (Wrapped)
**Qué:** Cada 31 de diciembre, recap cinemático a pantalla completa: XP total del año, mejor mes, racha máxima, días perfectos, evolución de rango y top 3 récords, en tarjetas animadas compartibles estilo Wrapped. Es el pago emocional del año entero y la pieza con más potencial de enseñarse a amigos.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 6

### EST-027 · Tarjeta de progreso compartible
**Qué:** Botón "compartir progreso" que genera una imagen 1080×1920 con estética de ventana del sistema: nivel, rango, racha, radar de stats y heatmap del mes, lista para stories o WhatsApp. Aunque la app sea de un solo usuario, compartir con amigos crea accountability externa gratis.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### EST-028 · Widget de pantalla de inicio con estadísticas
**Qué:** Widget Android/iOS con anillo de cumplimiento de hoy, racha actual y mini-heatmap de 7 días; tap abre la pantalla Sistema. La estadística que ves 50 veces al día sin abrir la app es la que más conducta cambia.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 5

### EST-029 · Detalle de cualquier día histórico
**Qué:** Tap en una celda del heatmap o del calendario abre un modal con las misiones de ese día, su estado, el XP ganado/perdido y miniaturas de las evidencias. Da profundidad de archivo personal: toda tu historia es navegable.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### EST-030 · Contador de días perfectos
**Qué:** Conteo de días al 100% en el mes y el año, marca de borde brillante en el heatmap y récord de días perfectos consecutivos. Añade una capa de exigencia superior a la racha normal para los días en que quieres ir a por todas.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### EST-031 · Granularidad día/semana/mes y media móvil
**Qué:** Toggle global de granularidad en todos los gráficos más línea de media móvil de 7 días para suavizar el ruido diario. Sin suavizado un mal martes parece una crisis; con él se ve la señal real de la tendencia.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### EST-032 · Punch card semanal (día × hora)
**Qué:** Matriz día-de-la-semana × hora con burbujas proporcionales a cuántas misiones completas en cada franja, estilo punch card de GitHub. Revela tu cronotipo real ("cazador nocturno: 68% de checks después de las 20:00") y alimenta el insight de mejor hora para cada hábito.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### EST-033 · Tasa de éxito por dificultad
**Qué:** Barras comparadas de % de éxito por tier (trivial→épica) con insight automático si las épicas caen bajo el umbral ("Fallas el 58% de las épicas: divídelas en misiones medias"). Aplica la ciencia del hábito (reducir fricción) con tus propios números.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### EST-034 · Progreso hacia la automaticidad (66 días)
**Qué:** Barra por hábito hacia los ~66 días que la evidencia (Lally, 2010) marca como media para automatizar una conducta, con badge "Hábito consolidado" al alcanzarlos. Microeducación dentro del juego: entender por qué los dos primeros meses son los duros ayuda a aguantarlos.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### EST-035 · Percentil del día contra tu histórico
**Qué:** Al cerrar el día, etiqueta de percentil sobre tu propia distribución: "Hoy: top 12% de tus 240 días registrados". Compites contra tu historial, no contra la perfección: un día normal-bueno también recibe reconocimiento.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### EST-036 · Estadísticas de penalizaciones y redención
**Qué:** Panel con penalizaciones recibidas por mes, % recuperadas el mismo día vía misión de penalización y XP neto perdido, con insight ("Recuperas el 71%: el sistema de redención funciona"). Hace visible que la penalización es un mecanismo de rebote y no solo un castigo.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### EST-037 · Libro de XP: desglose por fuentes
**Qué:** Barras apiladas semanales que descomponen el XP en sus fuentes: base por dificultad, bonus de evidencia (+25%), multiplicador de racha y penalizaciones en negativo. Transparencia total de la economía: ves qué palancas te dan más XP y cuánto te cuesta fallar.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### EST-038 · Historial de subidas y bajadas de nivel
**Qué:** Timeline vertical con cada subida (y bajada) de nivel, fecha, causa de las caídas (penalización) y días transcurridos entre niveles. Ver lo remontado tras cada caída refuerza la narrativa de resiliencia del cazador.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### EST-039 · Tiempo en cada rango
**Qué:** Desglose "84 días en rango E, 23 en D" con barra proporcional y estimación del tiempo restante en el rango actual según tu ritmo (enlaza con EST-004). Da contexto histórico y épica de larga distancia a la escalada de rangos.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### EST-040 · Velocidad de subida de nivel
**Qué:** Métrica de días-por-nivel comparada con tu media histórica ("Nivel 12 en 9 días: 2 menos que tu media") y mini-gráfico de aceleración. Sentir que aceleras engancha más que el número de nivel absoluto.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### EST-041 · Análisis de carga vs cumplimiento
**Qué:** Cruce entre nº de misiones activas por día y % de cumplimiento ("Con más de 8 misiones diarias caes del 85% al 61%") con recomendación de carga óptima. Anti-burnout con datos propios: el Sistema te frena antes de que te sobrecargues y lo dejes.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### EST-042 · Semanas atípicas excluibles (exámenes, viajes)
**Qué:** Marcar semanas como atípicas —manualmente o sugerido desde el calendario de fase 2 al detectar exámenes— para excluirlas de medias y proyecciones y mostrarlas sombreadas en los gráficos. Evita que una semana de exámenes destroce tus estadísticas y, con ellas, tu moral.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### EST-043 · Anotaciones en los gráficos
**Qué:** Notas ancladas a fechas ("empecé creatina", "cambio de horario de clases") que se dibujan como marcadores verticales en todos los gráficos. Permiten explicar los cambios de tendencia: la diferencia entre ver datos y entenderlos.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 5

### EST-044 · Umbral de honestidad estadística
**Qué:** Regla global: ningún insight, correlación o proyección se muestra con muestra insuficiente; en su lugar aparece "Datos insuficientes: 9/14 días" con progreso. Un solo insight falso destruye la credibilidad del Sistema: la honestidad estadística es una feature, no una limitación.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### EST-045 · Librería de gráficos GPU (Skia)
**Qué:** Adoptar Victory Native XL sobre react-native-skia como base de todos los gráficos: 60 fps, gestos de pan/zoom/scrub y theming centralizado (azul cazador, grid tenue, tooltips con esquinas cortadas). Fundamento técnico para que las estadísticas se sientan de juego AAA y no de webview.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### EST-046 · Estadísticas agregadas de mazmorras
**Qué:** Resumen del módulo de proyectos: mazmorras completadas vs abandonadas, duración media, XP medio por mazmorra y mayor "jefe" derrotado. Cierra el bucle de la fase 2 con métricas de conquista que invitan a entrar en la siguiente.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### EST-047 · Tasa de evidencia en el momento
**Qué:** % de misiones completadas con foto de cámara en el momento y XP extra acumulado gracias al bonus del 25%, con tendencia mensual. Refuerza el hábito de evidenciar mostrando en números cuánto paga hacerlo.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### EST-048 · Exportación de datos crudos (CSV/JSON)
**Qué:** Volcado completo de misiones, checks, XP, rachas y stats diarios a CSV/JSON desde ajustes, compartible por share sheet. Propiedad del dato: el usuario es ingeniero informático y tarde o temprano querrá analizar su vida en Python.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### EST-049 · Informe PDF oficial de la Asociación
**Qué:** Informe mensual maquetado en PDF con estética de documento oficial de la Asociación de Cazadores: sello, gráficos renderizados, tabla de récords y firma del Sistema, generado on-device con expo-print y compartible. Un artefacto que apetece guardar y enseñar.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### EST-050 · Animación de escaneo al abrir estadísticas
**Qué:** Al entrar al dashboard, una línea de escaneo vertical recorre la pantalla y los números cuentan hacia arriba hasta su valor en ~300 ms, como si el Sistema te analizara en vivo. Juice barato que convierte mirar tus stats en un pequeño placer diario.
**Impacto:** 2/5 · **Esfuerzo:** S · **Fase:** 5

### EST-051 · Curva de supervivencia de rachas
**Qué:** Curva con el % de tus rachas históricas que supera cada duración ("el 35% pasa de 14 días") y tu posición actual marcada: "día 12: zona crítica, aguanta 2 más y entras en tu top 35%". Estadística nerd perfecta para un ingeniero: gamifica batir tu propia mediana.
**Impacto:** 2/5 · **Esfuerzo:** M · **Fase:** 6

### EST-052 · "Tal día como hoy" (memorias del cazador)
**Qué:** Tarjeta ocasional de memoria: "Tal día como hoy hace un año subiste a rango D" o "hace 6 meses tu racha era de 3 días; hoy es de 41". Requiere 6-12 meses de histórico; la distancia recorrida es el motivador definitivo a largo plazo.
**Impacto:** 2/5 · **Esfuerzo:** S · **Fase:** 7

Total: 52 mejoras.
