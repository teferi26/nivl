# Onboarding y retención temprana

> Categoría ONB · backlog NIVL · ordenadas por impacto

### ONB-001 · Misión tutorial inmediata: primer XP en menos de 2 minutos
**Qué:** Nada más terminar la secuencia de arranque, el Sistema asigna una misión trivial completable al instante ("Bebe un vaso de agua y captúralo con la cámara") que enseña el flujo check + evidencia + ganancia de XP en el acto. Time-to-first-value < 3 minutos: el usuario siente el core loop completo antes de tener tiempo de aburrirse o dudar.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### ONB-002 · Secuencia cinematográfica de despertar: "Has sido elegido como Jugador"
**Qué:** Primer arranque sobre pantalla negra: texto que se autoescribe línea a línea con haptics sincronizados ("[Se han cumplido los requisitos] … [Has sido elegido como Jugador]") y ventana del sistema que se materializa con efecto glitch en azul cazador. Primera impresión AAA que ancla la fantasía Solo Leveling desde el segundo uno y diferencia a NIVL de cualquier habit tracker al primer vistazo.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 2

### ONB-003 · Cuestionario "Evaluación del Cazador" que genera tus primeras misiones
**Qué:** Interrogatorio del Sistema de 6-8 preguntas (gym, dieta, estudio, proyectos, sueño, reflexión) cuyas respuestas generan automáticamente 3-5 misiones desde plantillas mapeadas a stat, dificultad y días de semana. El usuario sale del onboarding con un plan real y personalizado sin haber tocado un formulario CRUD: cero fricción entre intención y primera misión.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 2

### ONB-004 · Arco narrativo de los primeros 30 días
**Qué:** Estructurar el primer mes como campaña: días 1-7 "El Despertar", 8-21 "La Prueba", 22-30 "Ascensión", con mensaje del Sistema al entrar en cada arco, objetivo claro por arco y recompensa al cerrarlo. Convierte el período crítico de formación del hábito (3-4 semanas) en una historia con principio y fin en lugar de una llanura infinita de checks.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 3

### ONB-005 · Re-onboarding tras abandono: "El Sistema te ha estado buscando"
**Qué:** Si el usuario no abre la app durante 3 o más días, el siguiente arranque dispara una secuencia dedicada: ventana "El Sistema te ha estado buscando", resumen sin culpa de lo ocurrido en su ausencia y una única misión de reenganche trivial para hoy. El regreso se trata como evento narrativo, no como pantalla de deudas acumuladas, que es lo que provoca la segunda y definitiva fuga.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### ONB-006 · Protección de novato: buff "Bendición del Sistema" (7 días)
**Qué:** Durante la primera semana las penalizaciones por fallo se reducen al 50%, presentado como buff visible con icono y contador de días restantes anunciado en el onboarding. El palo completo solo cuando el hábito de abrir la app ya existe: una penalización dura el día 2 es la receta clásica de desinstalación.
**Impacto:** 5/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-007 · Subida a nivel 2 garantizada en la primera sesión
**Qué:** Calibrar la curva de XP del nivel 1 para que misión tutorial + cuestionario + foto de perfil sumen exactamente el XP del primer level-up, con su animación completa. La sesión 1 termina con el pico de dopamina más potente del juego y la promesa implícita de que subir es alcanzable.
**Impacto:** 5/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-008 · Límite duro de 3 misiones diarias en la semana 1
**Qué:** El Sistema bloquea crear más de 3 misiones por día los primeros 7 días con mensaje en personaje ("Un cazador novato que acepta demasiados encargos muere pronto"), desbloqueando el cupo gradualmente. La sobrecarga autoinfligida del día 1 es la causa número uno de abandono en habit trackers: el entusiasmo inicial firma cheques que la semana 2 no puede pagar.
**Impacto:** 5/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-009 · Permiso de notificaciones dentro de la narrativa
**Qué:** No pedir el permiso del SO al arrancar: tras completar la primera misión, ventana del Sistema "¿Autorizas al Sistema a contactarte cuando estés en peligro?" y solo si acepta se lanza el diálogo nativo. El priming contextual multiplica la tasa de aceptación, y sin push no existe retención temprana que optimizar.
**Impacto:** 5/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-010 · Aha-moment norte definido e instrumentado
**Qué:** Definir el momento que predice retención (propuesta: completar todas las misiones del día 3 días seguidos), instrumentar el embudo completo con eventos en Supabase (arranque → contrato → cuestionario → 1.ª misión → retorno día 2 → aha) y orientar cada decisión de los primeros días a maximizarlo. Sin esta medición, el resto del backlog de onboarding se prioriza por fe.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### ONB-011 · Contrato del Jugador con cuenta atrás
**Qué:** Tras el despertar, ventana "¿Aceptas convertirte en Jugador?" con botón ACEPTAR y cuenta atrás de 10 segundos al estilo Solo Leveling; rechazar muestra "El Sistema esperará. Todo seguirá igual." y vuelve a ofrecerlo. Una elección con peso genera compromiso psicológico inicial (principio de consistencia): lo que se acepta activamente se defiende después.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-012 · Escaneo de cazador: foto de perfil con cámara frontal
**Qué:** Paso del onboarding con overlay hexagonal, línea de escaneo animada y texto "REGISTRANDO IDENTIDAD…" que captura la foto de perfil; el permiso de cámara se pide ahí, con contexto, y queda concedido para las evidencias futuras. Perfil completo desde el minuto uno y un momento memorable que el usuario querrá enseñar.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### ONB-013 · Stats iniciales calibrados por autoevaluación
**Qué:** El cuestionario incluye autoevaluación honesta por área (días de gym actuales, horas de estudio, calidad de sueño…) que fija los 5 stats iniciales en valores bajos pero desiguales y no nulos. Un radar con forma propia desde el día 1 se siente "mi personaje"; un pentágono a cero se siente una plantilla ajena.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### ONB-014 · Quest de onboarding distinta cada día de la semana 1
**Qué:** Día 2: crea tu primera misión propia; día 3: explora tu perfil; día 4: gana el bonus +25% con evidencia de cámara; día 5: revisa tu racha; día 6: ajusta tus horarios; día 7: preséntate a la evaluación — cada una con XP extra. Cada mecánica se aprende haciéndola el día que toca, no leyéndola en un tour de diez pantallas que nadie recuerda.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 2

### ONB-015 · Advertencia previa a la primera penalización
**Qué:** El primer día con misiones en riesgo, a las 21:30, ventana "ADVERTENCIA DEL SISTEMA" que explica exactamente qué XP se perdería y cómo funciona la misión de penalización, antes de aplicar nada. La primera penalización jamás debe pillar por sorpresa: el castigo no anticipado se percibe injusto y rompe la confianza en el Sistema para siempre.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-016 · Hito del día 3 celebrado
**Qué:** Al completar el tercer día, ventana especial: "Has sobrevivido 3 días. La mayoría de los cazadores caen aquí." con XP bonus. El día 3 es el primer acantilado de retención de cualquier app de hábitos; marcarlo convierte la estadística en sentido de pertenencia al grupo que persiste.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-017 · Ceremonia de evaluación del día 7
**Qué:** Al cerrar la primera semana, "Evaluación de Rango" que repasa misiones completadas, XP acumulado y constancia, y consolida el rango E (o concede E+ si la semana fue perfecta) con animación de sello. Da una meta a corto plazo visible desde el día 1 y aprovecha el efecto goal-gradient: el esfuerzo aumenta al acercarse la meta.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### ONB-018 · Notificaciones narrativas exclusivas para los días 1-7
**Qué:** Sustituir las push genéricas de 8:00 y 21:30 por copys únicos por día durante la primera semana ("Día 2: el Sistema observa tu progreso", "Día 5: pocos llegan hasta aquí"). La novedad diaria en la notificación sostiene la curiosidad justo en la semana donde se decide todo.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-019 · Emplazamiento para mañana al cerrar la primera sesión
**Qué:** Al terminar el onboarding, el Sistema cita al usuario con hora concreta ("Tu entrenamiento comienza mañana a las 8:00") y programa esa notificación exacta como recordatorio de la cita. Es una implementation intention: una cita con hora y lugar multiplica la probabilidad de retorno el día 2 frente a un "vuelve pronto" difuso.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-020 · Checklist "Protocolo de Iniciación" con progreso regalado
**Qué:** Tarjeta visible la primera semana con 7 pasos (foto, evaluación, 1.ª misión propia, 1.ª evidencia, 1 día completo, ajustar horarios, evaluación del día 7) y recompensa de XP al completarla; arranca con 2 pasos ya marcados por el propio onboarding. Endowed progress + efecto Zeigarnik: una lista empezada pide ser cerrada.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### ONB-021 · Misiones del día 1 a prueba de fallo
**Qué:** Las misiones generadas para el primer día son siempre 2-3 triviales o fáciles completables esa misma tarde, independientemente de lo ambicioso del cuestionario; el plan completo arranca el día 2 en los días reales configurados. Un día 1 con fallo y penalización es un funeral de retención: debe ser imposible por diseño.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-022 · Pregunta de días imposibles en el cuestionario
**Qué:** "¿Qué días te resultan imposibles para entrenar o estudiar?" y el generador de misiones nunca programa en ellos. Evita que la primera semana contenga fallos estructurales que el usuario no eligió y que el Sistema castigaría injustamente.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-023 · Cronotipo y horarios de notificación personalizados desde el día 1
**Qué:** Pregunta de onboarding (¿madrugador o nocturno?, ¿a qué hora entrenas o estudias mejor?) que sustituye los fijos 8:00/21:30 por horas propuestas a medida y editables. Una push a la hora equivocada entrena al usuario a ignorar todas las siguientes.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-024 · Animación "EVIDENCIA VERIFICADA +25%" en la primera captura
**Qué:** La primera evidencia de cámara dispara una secuencia especial: línea de escaneo sobre la foto, sello "VERIFICADA" y desglose animado del bonus sobre el XP base. El +25% pasa de letra pequeña en una pantalla de ajustes a mecánica visceral entendida para siempre.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-025 · Cutscene del primer multiplicador de racha (día 7)
**Qué:** Al encenderse el ×1,1, mini-secuencia: la llama de racha prende, el contador anima la subida y una proyección muestra "a este ritmo: ×1,5 el día 35". El sistema de racha "hace clic" exactamente en el momento en que paga por primera vez, que es cuando el cerebro está dispuesto a aprenderlo.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### ONB-026 · Primer fallo recuperado convertido en lección del Sistema
**Qué:** Al completar la primera misión de penalización, mensaje único: "Recuperarse de una caída es lo que separa a un cazador de rango E de uno de rango S." y registro destacado en el historial. El abandono real ocurre tras el primer fallo; reencuadrarlo como mecánica dominada en vez de vergüenza lo desactiva.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-027 · Curva de notificaciones de ausencia con silencio programado
**Qué:** Día 2 sin abrir: push suave ("tus misiones esperan"); día 4: narrativa ("anomalía detectada: el cazador no responde"); día 7: última llamada ("el contrato sigue activo"); después, silencio total hasta una única notificación final el día 21. El spam de retención quema para siempre la opción de volver; el silencio repentino, paradójicamente, genera curiosidad.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-028 · Cristal de Retorno: perdón estructurado al volver
**Qué:** Al volver tras 3-7 días de ausencia, el Sistema ofrece un Cristal de Retorno único que anula las penalizaciones acumuladas a cambio de completar hoy una "misión de reintegración" fácil. Rompe la espiral "ya lo he perdido todo, ¿para qué volver?" sin regalar el perdón: hay que ganárselo con una acción inmediata.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### ONB-029 · Protocolo de Reaparición: recalibrado tras ausencia larga
**Qué:** Al volver tras 7 o más días, mini-cuestionario de 3 preguntas ("¿qué te detuvo?": exámenes, lesión, desmotivación…) que propone pausar las misiones que más fallaba y reactivar solo 2-3. Volver al mismo plan que ya te aplastó garantiza una segunda fuga; volver a un plan recortado y honesto, no.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### ONB-030 · Empty state de victoria: todas las misiones del día completadas
**Qué:** Cuando no queda nada por hacer hoy, la pantalla Sistema muestra "TODAS LAS MISIONES COMPLETADAS" con el XP total del día, la hora de cierre y un mensaje del Sistema ("El Sistema está… satisfecho"). Refuerza el cierre del día como recompensa visible en lugar de dejar una lista vacía sin significado.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-031 · Carta a tu futuro yo
**Qué:** En el onboarding el usuario escribe en una "ventana de contrato" por qué empieza (2-3 frases); el Sistema la sella y se la devuelve en el día 30 y en el re-onboarding tras un abandono. Anclar la motivación intrínseca del primer día y poder reproducirla en el momento exacto de mayor riesgo es retención pura con coste mínimo.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-032 · Embudo de onboarding iterable por remote config
**Qué:** Los copys, el orden de pasos y las variantes de la secuencia inicial se leen de una tabla de Supabase con asignación de variante por arranque, registrando qué variante vio cada usuario y dónde abandonó. Permite iterar el onboarding semanalmente sin re-publicar la app en las stores.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### ONB-033 · Selección de clase inicial
**Qué:** Tras el cuestionario, el Sistema "detecta tu aptitud" y ofrece 3 clases (Guerrero/FUE, Erudito/INT, Sombra/AGI…) con +10% de XP en su stat durante 30 días; sugerida por las respuestas pero elegible. Identity-based habits: actuar "como un erudito" sostiene el hábito más que perseguir un número, y la clase da identidad desde el día 1.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### ONB-034 · Informe del Primer Mes (día 30)
**Qué:** Documento del Sistema con gráfico de XP diario, stat más crecido, racha máxima, porcentaje de cumplimiento y un veredicto narrativo personalizado, que cierra el arco de 30 días y desbloquea el siguiente. El primer "informe wow" llega exactamente al completar el período de formación del hábito, transformando datos en orgullo.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### ONB-035 · Desbloqueo progresivo de mecánicas
**Qué:** Calendario explícito de revelación: día 1 solo misiones y XP; día 3 aparece la racha; día 7 el multiplicador; día 10 los KPIs del perfil; día 14 el teaser de mazmorras — lo no desbloqueado ni se muestra. Progressive disclosure: seis mecánicas explicadas el día 1 equivalen a ninguna entendida.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### ONB-036 · Némesis personal
**Qué:** Pregunta del cuestionario "¿Cuál es tu mayor enemigo?" (procrastinación, redes sociales, sueño caótico…); el Sistema lo bautiza como tu Némesis y lo referencia en mensajes y fallos ("La Procrastinación gana terreno"). Externalizar al enemigo convierte cada fallo en una batalla contra algo, no en un defecto personal: cambia culpa por combate.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### ONB-037 · Teaser de la primera llave de mazmorra (día 14)
**Qué:** Al completar el día 14 cae un "fragmento de llave" con la ventana "Se ha detectado una mazmorra cercana… Acceso: próximamente". Curiosity gap que tiende un puente entre el primer mes y el módulo de proyectos, dando una razón concreta para seguir más allá de la semana 2.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-038 · Empty state de Misiones con plantillas tocables
**Qué:** La pantalla Misiones vacía muestra 6 plantillas, una por stat y caso real del usuario ("Entrenar 45' · FUE · media · L-X-V", "Estudiar 2 h · INT · media"…), que al tocarlas abren el formulario pre-relleno. Reduce el coste de la primera creación de minutos de formulario a un toque y un ajuste.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-039 · Empty state del Sistema sin misiones hoy
**Qué:** Mensaje en personaje: "No hay misiones asignadas. Un cazador ocioso es un cazador en retroceso." con dos CTA: crear misión o aceptar una sugerida por el Sistema según tu stat más bajo. Un "hoy" vacío y mudo es la puerta de salida silenciosa de cualquier habit tracker.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-040 · Empty state de descanso legítimo
**Qué:** Si hoy no hay misiones porque los días configurados no tocan, mostrar "Día de regeneración. Recupera maná." en azul, claramente distinto del estado de vacío con CTA. Distinguir descanso planificado de inactividad evita culpa injusta en los días que el propio usuario diseñó para descansar.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-041 · Empty state del perfil sin foto
**Qué:** Silueta hexagonal con efecto glitch y sello "IDENTIDAD NO VERIFICADA" más CTA directa al escaneo de cazador. Convierte un hueco gris en una llamada narrativa a completar el perfil, el paso que más correlaciona con apropiarse del personaje.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-042 · Reanudación exacta del onboarding interrumpido
**Qué:** Si el usuario cierra la app a mitad del primer arranque, al volver retoma en el paso exacto con la pantalla "Reanudando sincronización con el Sistema…" (estado persistido en local). Obligar a repetir pasos ya hechos duplica la fricción justo en el segundo intento, donde el margen de paciencia es mínimo.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-043 · Onboarding offline-first sin spinners
**Qué:** Toda la secuencia inicial funciona sin red: cinemática, cuestionario y generación de misiones se resuelven en local y una cola sincroniza con Supabase en segundo plano. La primera impresión de una app que promete ser un juego AAA no puede incluir un spinner de carga.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### ONB-044 · Modo "ya he jugado": skip para reinstalaciones
**Qué:** Mantener pulsada la pantalla del despertar 2 segundos revela "¿Restaurar cazador existente?" con login directo y salto de toda la secuencia cinematográfica. Respeto al usuario que vuelve: obligar a re-ver la cinemática castiga precisamente a quien reinstala para darle otra oportunidad a la app.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-045 · Capa de audio del despertar
**Qué:** Sonido para la secuencia inicial: drone ambiental de fondo, tick por carácter del texto autoescrito y golpe grave al aceptar el contrato, respetando el modo silencio del SO. El audio es la mitad del AAA-feel en la escena más importante de toda la app.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### ONB-046 · Re-onboarding de cada fase nueva
**Qué:** Al instalarse una versión con módulo nuevo (mazmorras, gym, diario…), mini-secuencia de 2 ventanas "El Sistema ha ampliado tus privilegios" que presenta la mecánica y asigna una misión de prueba. Cada release se vive como un evento del juego y la push de actualización se convierte en gancho legítimo para reactivar a usuarios dormidos.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### ONB-047 · Informe de Evaluación al cerrar el cuestionario
**Qué:** Pantalla resumen estilo dossier del Sistema: "Rango asignado: E · Potencial detectado: ALTO · Misiones asignadas: 4", con la lista de misiones generadas revisable y editable antes de confirmar. Momento de proyección que demuestra que cada respuesta del cuestionario sirvió para algo concreto.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-048 · Banco de copys de retorno sin culpa
**Qué:** Auditoría y banco centralizado de todos los textos de re-onboarding, ausencia y fallo: el Sistema es exigente pero jamás está decepcionado ("el contrato sigue activo", nunca "me has fallado" ni "qué pena"). El tono tras el fallo decide si la app se percibe como un entrenador o como un acreedor, y de eso depende que el usuario vuelva a abrirla.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-049 · Nueva Partida+ tras abandono de 30 días o más
**Qué:** Al volver tras un mes o más, ofrecer reinicio de nivel y rango conservando todo el historial y otorgando el título permanente "Renacido"; las misiones se regeneran con el cuestionario corto de reaparición. Borrón y cuenta nueva sin borrar la historia: el peso de un personaje "arruinado" es la razón número uno para no volver a un RPG.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### ONB-050 · Tooltips del Sistema de un solo uso
**Qué:** Micro-ventanas contextuales con la estética de esquinas cortadas que aparecen solo la primera vez que se ve cada elemento (barra de XP, racha, stats), máximo una por pantalla, se descartan con un toque y no reaparecen jamás. Enseñan en contexto sin secuestrar la pantalla como hace un tour clásico.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 2

### ONB-051 · Gesto fantasma en la misión tutorial
**Qué:** La primera misión muestra una animación fantasma (hexágono y trazo del dedo) que ejecuta el gesto de completar justo antes de que el usuario lo intente. Elimina el microsegundo de duda "¿cómo se marca esto?" sin necesidad de una sola línea de texto.
**Impacto:** 2/5 · **Esfuerzo:** S · **Fase:** 2

### ONB-052 · Empty state de stats sin calibrar
**Qué:** Si el usuario saltó el cuestionario, el radar del perfil muestra "STATS SIN CALIBRAR" parpadeante con CTA "Iniciar evaluación" que retoma el cuestionario donde se dejó. Recupera a quienes esquivaron el paso que más calidad aporta al resto de su experiencia.
**Impacto:** 2/5 · **Esfuerzo:** S · **Fase:** 2

Total: 52 mejoras.
