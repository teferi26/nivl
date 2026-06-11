# Notificaciones y la voz del sistema

> Categoría NOT · backlog NIVL · ordenadas por impacto

### NOT-001 · Banco de mensajes del Sistema con anti-habituación
**Qué:** Base de datos local de 300+ copys del Sistema organizados por evento (aparición de quests, completado, racha, fallo, subida de nivel, penalización…) y por intensidad, con selección aleatoria ponderada que garantiza no repetir un mensaje en los últimos 21 días. La habituación es el asesino nº 1 de las notificaciones: si el texto es siempre el mismo, el cerebro lo filtra en dos semanas; la variedad mantiene viva la sensación de que el Sistema está vivo y te observa.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### NOT-002 · Completar misiones desde la propia notificación
**Qué:** Notificaciones con botones de acción nativos: "Completar" (para misiones sin evidencia obligatoria), "Abrir cámara" (salta directo a la captura de evidencia) y "Posponer 1 h". Reducir el coste de marcar un hábito de 4 toques a 1 es la palanca de retención más barata que existe en un habit tracker.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 2

### NOT-003 · Fiabilidad garantizada del canal de notificaciones
**Qué:** Reprogramación completa de todas las notificaciones locales al abrir la app, tras reinicio del dispositivo (boot receiver en Android) y tras actualizar la versión, con ids deterministas para deduplicar y reconciliación contra el estado real (jamás recordar una misión ya completada). Una sola notificación perdida en un día crítico puede romper una racha de 40 días y, con ella, la confianza en el Sistema.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### NOT-004 · Protocolo de racha en peligro
**Qué:** Si a las 21:30 hay misiones pendientes y la racha activa es ≥ 7 días, se activa una secuencia escalada (21:30 → 22:30 → 23:15) con copys cada vez más graves y canal de ALERTA en el último aviso: "ALERTA: tu racha de 23 días muere en 45 minutos". La aversión a la pérdida es mucho más potente que la promesa de ganancia, y la racha es el activo más valioso del cazador.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### NOT-005 · Resumen matinal: "Han aparecido tus quests diarias"
**Qué:** Rediseño del aviso de las 8:00 como notificación expandible con la lista de misiones del día, el XP total en juego y el día de racha que se defiende hoy ("Día 23 — 310 XP en juego"), replicando el momento icónico de Solo Leveling en el que aparecen las quests diarias. Convierte el primer vistazo al móvil en un ritual de inicio de partida, no en un recordatorio genérico.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### NOT-006 · Timing adaptativo por misión
**Qué:** Motor que aprende a qué hora se completa históricamente cada misión (mediana móvil de los últimos 30 registros) y programa su recordatorio ~30 min antes de su hora natural, en lugar de usar horas fijas globales. Avisar de "estudiar" a la hora en la que realmente estudias multiplica la tasa de acción y elimina ruido el resto del día.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 4

### NOT-007 · Cierre 21:30 condicional
**Qué:** El aviso de las 21:30 solo se envía si quedan misiones pendientes y su copy enumera exactamente cuáles; si el día ya está completo, se sustituye por un mensaje de victoria con el XP total ganado. Notificar "revisa tus misiones" a quien ya terminó entrena al cerebro para ignorar al Sistema.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### NOT-008 · Predicción de daño antes de medianoche
**Qué:** Aviso único hacia las 23:00 (integrado como último paso del protocolo de racha cuando aplica) que muestra la consecuencia exacta de fallar: "Si no completas Gym perderás 50 XP, bajarás a nivel 11 y tu multiplicador se reiniciará". Cuantificar la pérdida la hace real: lo vago se ignora, lo concreto duele y moviliza.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### NOT-009 · Escala de severidad del Sistema (INFO → CRÍTICO)
**Qué:** Cuatro niveles tipados para todo mensaje (INFO, AVISO, ALERTA, CRÍTICO) que determinan color del acento, sonido, canal y si puede saltarse el presupuesto diario; CRÍTICO queda reservado a rachas largas en peligro y deadlines de mazmorra. Si todo grita, nada grita: la jerarquía protege el poder dramático del rojo #FF5C6B.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### NOT-010 · Mensajes del Monarca en hitos
**Qué:** En hitos mayores (subida de rango, niveles 10/25/50, rachas de 30/100 días, aniversario del "despertar") la notificación llega firmada por el Monarca con formato propio (acento púrpura #8A76E8, copy solemne) y al abrirla se despliega una ventana cinemática a pantalla completa. Las apariciones raras de una figura superior crean picos emocionales memorables que anclan la motivación a largo plazo.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### NOT-011 · Cooldown anti-culpa tras un fallo
**Qué:** Si ayer hubo penalización, durante 48 h el tono baja automáticamente a neutro-constructivo y se suprimen los copys dramáticos: "El Sistema registra el fallo. La misión de hoy es volver. Nada más". La evidencia en formación de hábitos es clara: la autocompasión predice retomar el hábito; la culpa acumulada predice abandonar la app.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### NOT-012 · Servicio SystemVoice unificado
**Qué:** Módulo único que centraliza la voz del Sistema: las ventanas in-app, los toasts y las push consumen el mismo banco de mensajes con la misma API (evento + contexto → copy + severidad). Garantiza coherencia total de personalidad y permite añadir eventos nuevos escribiendo solo contenido, no código.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### NOT-013 · Plantillas con variables dinámicas
**Qué:** Los copys soportan interpolación ({cazador}, {racha}, {xp_pendiente}, {mision}, {nivel}, {stat}) con reglas de plural y fallbacks, de modo que cada mensaje habla de TU día concreto: "Quedan 2 quests. 150 XP en juego. Día 23 de racha". Un mensaje específico se siente como vigilancia del Sistema; uno genérico se siente como marketing.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### NOT-014 · Guía de estilo de la voz del Sistema
**Qué:** Documento canónico + checklist de revisión que fija la personalidad: frío, imparcial, segunda persona, frases cortas, mayúsculas para términos clave (QUEST, ALERTA, CAZADOR), cero emojis, cero tono de coach motivacional, drama sin humillación. Es el contrato que evita que 300 copys escritos en meses distintos suenen a tres apps diferentes.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### NOT-015 · Deep links exactos en cada notificación
**Qué:** Toda notificación abre exactamente su destino: el recordatorio de una misión abre esa misión con el botón de completar visible, la alerta de racha abre Sistema con las pendientes filtradas, el hito abre su ventana de celebración. Cada toque que aterriza en el lugar equivocado es una microtraición a la promesa de "ultra intuitivo".
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### NOT-016 · Canales Android por tipo + Time Sensitive en iOS
**Qué:** Canales nativos separados (Recordatorios, Alertas de racha, Hitos, Informes) con importancia, sonido y vibración propios, y uso del nivel Time Sensitive de iOS solo para ALERTA/CRÍTICO. Da control fino desde los ajustes del SO y permite que lo crítico atraviese los modos de concentración sin abusar del privilegio.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### NOT-017 · Presupuesto diario de notificaciones
**Qué:** Tope duro configurable (por defecto 5/día): al alcanzarse, los mensajes de menor severidad se agrupan en el siguiente resumen o se descartan, y solo ALERTA/CRÍTICO pueden excederlo. Una app que notifica de más acaba silenciada por el SO o desinstalada; el presupuesto protege el canal.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### NOT-018 · Horas de silencio configurables
**Qué:** Franja de no-molestar propia del Sistema (por defecto 00:00–07:30) durante la cual nada suena; lo generado en ese tramo se difiere y se funde con el resumen matinal. Respeta el sueño —que además es una misión de VIT— y evita que el Sistema sabotee el descanso que él mismo predica.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### NOT-019 · Pantalla de ajustes de notificaciones con previsualización
**Qué:** Sección dedicada con toggles por tipo, horas editables del resumen y el cierre, intensidad del protocolo de racha, y un botón "Probar" que dispara al instante una notificación de ejemplo de cada tipo. Ver y oír lo que vas a recibir elimina la desconfianza y evita el desactivado global por culpa de un único tipo molesto.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### NOT-020 · Ventana horaria por misión + QUEST URGENTE
**Qué:** Cada misión puede definir una ventana de cumplimiento (p. ej. Gym 17:00–22:00) y, al quedar 60 y 15 minutos para su cierre con la misión pendiente, llega una notificación estilo "QUEST URGENTE" con cuenta atrás explícita. Los deadlines concretos disparan la acción mucho mejor que el difuso "antes de medianoche".
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### NOT-021 · Cierre anticipado por día perfecto
**Qué:** Al completar la última misión del día antes de las 21:30, el cierre nocturno programado se cancela y en su lugar llega inmediatamente un mensaje de victoria con el XP del día, la racha actualizada y los bonus aplicados. El refuerzo más eficaz es el inmediato: celebrar en el momento exacto del logro, no a una hora arbitraria.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### NOT-022 · Silencio automático durante eventos del calendario
**Qué:** Con el calendario de fase 2, el Sistema no notifica durante clases, exámenes o eventos marcados como ocupado, y reprograma el aviso para 10 min después de que termine el evento. El mensaje que llega cuando puedes actuar se convierte en acción; el que llega en mitad de clase se desliza y muere.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### NOT-023 · Modo examen
**Qué:** Activable manualmente o desde un evento de tipo examen: silencia todo lo no crítico durante la franja, envía un único copy sobrio antes ("El Sistema guarda silencio. Ve a por ese examen") y al terminar entrega un resumen de lo silenciado. Demuestra que el Sistema juega a favor de la vida real del cazador, no compite contra ella.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### NOT-024 · Notificaciones de mazmorra
**Qué:** Para los proyectos de fase 2: aviso de "Ha aparecido una mazmorra" al activarla, hitos de progreso (50 %, 80 %) y escalado de deadline en T-7, T-3 y T-1 con severidad creciente y copy de raid. Lleva el peso narrativo a lo que de verdad decide el semestre: proyectos y entregas.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### NOT-025 · Cuenta atrás de exámenes
**Qué:** Los exámenes del calendario generan su propia serie de avisos: T-14 (planifica), T-7 (refuerzo de misiones de INT sugeridas), T-3 y T-1 (prioridad máxima de estudio) y un mensaje post-examen de cierre. Para un estudiante de ingeniería los exámenes son los jefes de zona: merecen su propia banda sonora de notificaciones.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### NOT-026 · Telemetría de notificaciones y scoring de copys
**Qué:** Registro en Supabase de cada notificación (tipo, copy, hora, entregada/abierta/acción, misión completada en los 60 min siguientes) y un score por copy y por franja horaria que pondera la selección futura del banco de mensajes. Convierte la voz del Sistema en un sistema que aprende qué funciona contigo, sin necesitar IA conversacional.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### NOT-027 · Re-enganche escalonado tras ausencia
**Qué:** Si la app no se abre: D+1 aviso neutro, D+3 copy narrativo ("El Sistema mantiene tu expediente abierto, cazador"), D+7 mensaje del Monarca con una misión de retorno de dificultad trivial como puerta de entrada; nunca culpabiliza ni enumera todo lo perdido. El mayor reto de un habit tracker no es el día 3: es volver después de la primera semana mala.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### NOT-028 · Informe semanal dominical
**Qué:** Domingo 20:00: notificación expandible con el balance de la semana (misiones, XP, stat más entrenada, estado de racha) y deep link al informe completo de fase 4, con copy de "evaluación del Sistema" y calificación semanal estilo rango (S/A/B…). El repaso semanal consolida la identidad de progreso, que es lo que sostiene la motivación cuando la novedad se apaga.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### NOT-029 · Progreso del día persistente (Live Activity)
**Qué:** Live Activity en iOS y notificación persistente con barra de progreso en Android mostrando "Quests 3/5 · 210 XP · Día 23" en la pantalla de bloqueo, actualizada con cada completado y retirada al cerrar el día. Tener el marcador siempre visible convierte el móvil en el HUD del juego sin abrir la app.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 5

### NOT-030 · Supresión inteligente en primer plano
**Qué:** Si la app está abierta cuando toca una notificación programada, esta se suprime y su contenido se muestra como ventana del Sistema in-app; al volver al fondo, el pipeline normal se reactiva. Que te vibre el bolsillo por lo que ya estás mirando en pantalla rompe la ilusión de un Sistema inteligente.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### NOT-031 · Anticipación de recompensa cercana
**Qué:** Cuando al atardecer faltan ≤ 50 XP para subir de nivel, o completar hoy hace subir mañana el multiplicador de racha, llega un aviso de oportunidad: "A una misión media del nivel 12" / "Mañana tu multiplicador sube a ×1,3 si hoy queda limpio". Efecto gradiente de meta: cuanto más cerca se percibe la recompensa, más esfuerzo invierte el cerebro.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### NOT-032 · Redención matinal
**Qué:** La mañana siguiente a un fallo, el resumen de las 8:00 abre con la misión de penalización en primer lugar y framing de redención: "El Sistema ofrece una vía de recuperación. Caduca a las 23:59". Reencuadrar el castigo como quest recuperable transforma la vergüenza en un objetivo jugable.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### NOT-033 · Hitos de stat
**Qué:** Al cruzar umbrales de una stat (25/50/75/100), notificación específica con copy temático de esa área ("FUE 50. Los registros del gremio se actualizan") y el icono de la stat. Da protagonismo al sistema de stats fuera del perfil y refuerza que cada área de la vida progresa por separado.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### NOT-034 · Badge del icono con misiones pendientes
**Qué:** El badge del icono de NIVL muestra el número de misiones pendientes de hoy y se limpia al completar todo, sincronizado en cada apertura y cada completado. Un recordatorio pasivo de coste cero cada vez que se mira el móvil, sin gastar presupuesto de notificaciones.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### NOT-035 · Agrupación nativa en hilo del Sistema
**Qué:** Todas las notificaciones se agrupan bajo un único hilo "SISTEMA NIVL" (group key en Android, thread-id en iOS) con resumen colapsado tipo "3 avisos del Sistema". Evita la pila de notificaciones sueltas que provoca el gesto reflejo de "borrar todo".
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### NOT-036 · Horario de fin de semana
**Qué:** Sábados y domingos el resumen matinal se desplaza por defecto a las 9:30 y el cierre a las 22:00, con horarios configurables por día de la semana. Despertar al cazador a las 8:00 un domingo es la vía rápida para que desactive las notificaciones para siempre.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### NOT-037 · Resumen alternativo en día libre
**Qué:** Si hoy no hay misiones programadas, el resumen matinal cambia a un copy breve de descanso registrado ("Día sin quests. El Sistema también registra la recuperación") o se omite, según preferencia. Mantiene la coherencia de la voz sin generar ruido vacío.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### NOT-038 · Packs estacionales de copys
**Qué:** Paquetes temáticos que se activan por contexto temporal —temporada de exámenes, Año Nuevo ("nueva temporada de caza"), verano— y que el banco de mensajes mezcla con el set base durante esas fechas. Una voz que reconoce la época del año se siente viva y combate la monotonía a los 6+ meses de uso.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 6

### NOT-039 · Pre-prompt narrativo de permisos
**Qué:** Antes del diálogo nativo de permisos (y al estrenar móvil o reinstalar), una ventana del Sistema explica en personaje qué canal se abre y para qué ("El Sistema necesita una línea directa contigo, cazador"); si el permiso queda denegado, banner persistente con acceso directo a los ajustes del SO. El opt-in de notificaciones es la puerta de entrada de toda esta categoría.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### NOT-040 · Centro de mensajes del Sistema in-app
**Qué:** Bandeja con el historial completo de mensajes del Sistema (incluidos los del Monarca, guardados como destacados automáticos), relegible y filtrable por tipo, con los no leídos marcados. Los mensajes de hito son trofeos narrativos: poder releerlos meses después multiplica su valor emocional.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### NOT-041 · Fusión de avisos próximos
**Qué:** Si en una ventana de 45 min coinciden 2+ notificaciones de severidad INFO/AVISO, se fusionan en una sola ("El Sistema tiene 3 avisos") con deep link al listado. Menos interrupciones con la misma información: el Sistema parece más listo precisamente porque habla menos.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### NOT-042 · Selector de intensidad de la voz
**Qué:** Ajuste global con tres protocolos —Sobrio (mínimo y funcional), Cazador (el actual, dramático) y Estricto (más duro y exigente, sin humillar)— que reescala el tono de todo el banco de mensajes. El mismo copy que te activa un martes puede saturarte en una semana mala: dar el dial al usuario previene la fatiga de personalidad.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### NOT-043 · Mensajes raros del Sistema
**Qué:** Un 1 % de las notificaciones rutinarias se sustituye por copys ultra raros: referencias veladas a Solo Leveling, mensajes "corruptos" del Sistema o datos curiosos sacados del propio historial del cazador, coleccionables en el centro de mensajes. La recompensa variable e inesperada es el mecanismo de enganche más documentado; aquí se aplica al propio canal de avisos.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### NOT-044 · Evidencia en caliente post-gym
**Qué:** Con el módulo de gym de fase 3, al registrar el final del entrenamiento (o al cerrarse su ventana horaria habitual) llega un aviso con botón directo a cámara: "Captura la evidencia ahora y reclama el +25 %". Caza el bonus en el momento de máxima motivación, cuando la foto todavía es posible.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### NOT-045 · Check-in de dieta y sueño con botones
**Qué:** Las misiones de VIT de tipo binario (dieta cumplida, hora de dormir respetada) llegan como notificación con botones "Cumplido / No cumplido" que registran el resultado sin abrir la app, a la hora configurada del check-in. En hábitos de puro seguimiento, la fricción cero es la diferencia entre datos reales y huecos en el registro.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### NOT-046 · Aviso dominical de plan y lista de la compra
**Qué:** Domingo por la mañana, recordatorio de preparar el plan de dieta semanal y, una vez generado, segunda notificación con la lista lista y deep link: "Suministros de la semana calculados. 23 ítems". Ancla el ritual de planificación semanal del que depende toda la fase 3.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### NOT-047 · Respeto del No Molestar del SO + alarma crítica opcional
**Qué:** Auditoría para que ningún aviso INFO/AVISO esquive el No Molestar del sistema operativo, y un opt-in explícito para que solo el CRÍTICO de racha pueda sonar como alarma (canal con bypass en Android, Critical Alert en iOS si se obtiene el entitlement). El poder de atravesar el silencio se conserva usándolo una vez al mes, no tres veces al día.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### NOT-048 · Notificación de logro desbloqueado
**Qué:** Con el sistema de logros de fase 4, cada desbloqueo dispara una notificación con el arte del logro, su rareza y copy propio, agrupando si caen varios a la vez ("3 logros desbloqueados"). Extiende el golpe de dopamina del logro más allá del momento en que se está usando la app.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### NOT-049 · Entrada de diario desde la notificación
**Qué:** El recordatorio nocturno del diario (fase 4) acepta respuesta rápida inline (RemoteInput en Android, campo de texto en iOS): una frase escrita desde la propia notificación cuenta como entrada mínima válida de PER. Una frase capturada vale infinitamente más que la entrada perfecta que nunca se escribe.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### NOT-050 · Sugerencia de hora de oro
**Qué:** Con 4+ semanas de telemetría, el Sistema detecta la franja con mayor tasa de completado de cada misión y propone una sola vez (no impone) mover ahí su recordatorio: "El 86 % de tus sesiones de estudio ocurren entre 16:00 y 18:00. ¿Anclar el aviso a las 15:45?". Optimización respetuosa: datos del propio usuario, decisión del propio usuario.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### NOT-051 · Identidad sonora y háptica del Sistema
**Qué:** Sonidos propios por canal (blip cristalino para recordatorios, campana grave para hitos, pulso doble para ALERTA) y patrones de vibración diferenciados, alineados con el paquete de sonido de fase 5. Reconocer al Sistema por el oído sin mirar la pantalla es marca sensorial pura, como el "level up" de cualquier gran juego.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### NOT-052 · Arte en notificaciones de hito
**Qué:** Las notificaciones de subida de rango/nivel y los mensajes del Monarca incluyen imagen grande (BigPictureStyle en Android, attachments en iOS) con el arte del nuevo rango sobre fondo #060B16. Pasar de rango D a C merece verse, no solo leerse; además es la pieza que más capturas de pantalla y shares generará.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

Total: 52 mejoras.
