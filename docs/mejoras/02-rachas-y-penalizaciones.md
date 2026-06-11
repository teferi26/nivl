# Rachas, penalizaciones y válvulas de escape

> Categoría PEN · backlog NIVL · ordenadas por impacto

### PEN-001 · Rachas independientes por hábito
**Qué:** Cada misión mantiene su propia cadena de días, visible como contador en su tarjeta, además de la racha global. Fallar el gym ya no rompe la racha de estudio: cada hábito vive y muere solo, y la pantalla Sistema muestra las cadenas activas como "líneas de maná" por misión. Elimina el efecto dominó desmotivador de perderlo todo por un único fallo.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 2

### PEN-002 · Día válido al 80 %: racha global por umbral
**Qué:** La racha global deja de ser todo-o-nada: un día cuenta si completas ≥80 % de las misiones programadas (umbral configurable 60-100 %). Los días al 100 % alimentan un contador paralelo de "días perfectos" con hitos propios. El perfeccionismo absoluto es el mayor asesino de rachas a largo plazo.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### PEN-003 · Piedras de Protección (seguro de racha)
**Qué:** Objeto que se consume automáticamente al fallar un día y congela todas las rachas y penalizaciones de esa fecha. Se ganan jugando (1 por semana perfecta), nunca se compran, y se almacenan hasta un máximo de 2; en el inventario se ven como cristales azules estilo Solo Leveling. Es la red de seguridad estándar que convierte un mal día en un susto en vez de en una catástrofe.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### PEN-004 · Tope de daño diario (anti-espiral)
**Qué:** La suma de penalizaciones de una jornada nunca supera el 60 % del XP medio diario del usuario (media móvil de 14 días), aunque fallen seis misiones a la vez. Un mal día debe doler, no aniquilar: hoy un día desastroso puede borrar semanas y dispara el abandono por "ya da igual".
**Impacto:** 5/5 · **Esfuerzo:** S · **Fase:** 2

### PEN-005 · Deuda de XP en lugar de bajar de nivel
**Qué:** El XP perdido por penalización ya no puede quitarte un nivel conquistado: se convierte en una barra de "deuda" roja que se descuenta de las próximas ganancias hasta saldarse. Conserva el castigo (progresas más lento) sin el golpe devastador de ver el nivel retroceder en el perfil.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### PEN-006 · Modo Examen
**Qué:** Activable con fecha de inicio y fin: congela rachas y penalizaciones de las misiones no esenciales, mantiene solo las marcadas como núcleo (estudio + sueño) y al terminar muestra el resumen "Periodo de gala superado". Diseñado para que NIVL sea aliada en parciales y finales, no otra fuente de estrés para un estudiante de ingeniería.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### PEN-007 · Protocolo de Despertar (recaída larga)
**Qué:** Si el Sistema detecta 7+ días sin actividad, al volver no hay penalizaciones acumuladas: se lanza un arco de reintegración de 5 días con carga creciente (1 misión el día 1, 2 el día 2…) y narrativa de "el cazador despierta". Completarlo restaura el 50 % del multiplicador previo. La vuelta tras una recaída es el momento de mayor abandono de cualquier habit tracker y merece su mejor contenido.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 2

### PEN-008 · Modo Vacaciones programable
**Qué:** Congelación total con fechas elegidas por adelantado: no se generan misiones, las rachas y el multiplicador se conservan intactos y el calendario pinta esos días en gris azulado. Descansar de forma planificada no debe costar nada de lo construido.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### PEN-009 · Modo Enfermedad de activación instantánea
**Qué:** Un botón "Estado: debilitado" en la pantalla Sistema congela el día actual y los siguientes mientras siga activo, sin programación previa, porque nadie planifica una gripe. Sustituye las misiones por 2 micro-misiones opcionales de VIT (hidratarse, dormir 8 h) que mantienen viva la sensación de avance.
**Impacto:** 5/5 · **Esfuerzo:** S · **Fase:** 2

### PEN-010 · Versión sombra de cada misión (mínimo viable)
**Qué:** Cada misión puede definir su "versión sombra": una variante mínima (10 flexiones en vez de gym completo, 1 página en vez de sesión de estudio) que al marcarse mantiene la racha del hábito con XP simbólico y sin bonus. Salva la cadena en los días horribles, que es exactamente cuando más importa no romperla.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### PEN-011 · Aterrizaje suave del multiplicador
**Qué:** Al romper la racha, el multiplicador baja un escalón (−0,1) por día fallado en lugar de resetear de ×1,5 a ×1,0 de golpe. Sigue habiendo presión por no fallar, pero la recuperación es alcanzable y el multiplicador deja de ser una fuente de ansiedad.
**Impacto:** 5/5 · **Esfuerzo:** S · **Fase:** 2

### PEN-012 · La racha solo cuenta días programados
**Qué:** Garantizar (con tests) que rachas y multiplicador ignoran los días en los que un hábito no está programado: si el gym es L-X-V, el martes ni rompe ni suma. Sin esta regla, cualquier hábito de frecuencia parcial está condenado a rupturas injustas que minan la confianza en el sistema.
**Impacto:** 5/5 · **Esfuerzo:** S · **Fase:** 2

### PEN-013 · Protocolo de Emergencia tras 2 días fallidos
**Qué:** A la segunda jornada fallida consecutiva, el Sistema reduce automáticamente el día siguiente a las 3 misiones más importantes y suspende penalizaciones durante 24 h, con la ventana "Protocolo de emergencia activado". Corta la espiral fallo→castigo→fallo antes de que se convierta en desinstalación.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### PEN-014 · Días de descanso ganados
**Qué:** Cada 12 días válidos acumulados se gana 1 "permiso del Sistema": un día libre canjeable que se programa con antelación, no genera misiones y mantiene racha y multiplicador. A diferencia de las Piedras (reactivas), convierte el descanso en una recompensa planificada y sin culpa.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### PEN-015 · Protección de rango
**Qué:** Los rangos E-D-C-B-A-S son conquistas permanentes: las penalizaciones pueden frenar el nivel dentro del rango o generar deuda, pero nunca degradar un rango ya alcanzado. Perder el rango equivaldría a borrar la identidad de cazador construida, el castigo más desmotivador posible.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### PEN-016 · Pausar un hábito individual
**Qué:** Desde el CRUD de misiones, pausar una misión entre 1 y 30 días con motivo opcional: no se programa, su racha queda congelada y muestra la etiqueta "EN PAUSA". Resuelve casos reales (gym cerrado en agosto) sin obligar a borrar la misión y perder su historial.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### PEN-017 · Ventana de redención de 48 h sin acumulación
**Qué:** La misión de penalización pasa de "solo ese día" a un plazo de 48 h: recupera el 100 % si se completa el mismo día y el 60 % al siguiente. Además, fallar una misión de penalización nunca genera otra penalización encima: el agujero tiene fondo.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### PEN-018 · Indulto del Sistema (perdón mensual automático)
**Qué:** Si el cumplimiento de los últimos 30 días es ≥90 %, el primer fallo del mes se anula automáticamente con la ventana "El Sistema reconoce tu historial — fallo absuelto". Premia la fiabilidad acumulada con tolerancia, como lo haría un buen mentor.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### PEN-019 · El día termina a las 03:00
**Qué:** El corte de jornada se mueve de medianoche a las 03:00 (configurable entre 00:00 y 05:00): completar una misión a la 1:30 cuenta para "hoy". Para un estudiante que vive de noche, medianoche es un corte artificial que fabrica fallos falsos y rupturas injustas.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### PEN-020 · Check retroactivo limitado
**Qué:** Permitir marcar como completada una misión de ayer hasta las 12:00 del día siguiente, máximo 3 veces al mes y con nota obligatoria; el XP llega sin bonus de evidencia. Cubre el caso "lo hice pero olvidé marcarlo", que de otro modo rompe rachas legítimas.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### PEN-021 · Hitos de racha que fabrican Piedras
**Qué:** Al alcanzar 7, 30 y 100 días de racha global se otorgan 1, 2 y 3 Piedras de Protección con animación de botín de mazmorra. Cuanto más larga es la racha más duele perderla: el sistema entrega el seguro justo cuando el miedo a la pérdida es máximo.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### PEN-022 · Panel del multiplicador transparente
**Qué:** Tocar el multiplicador abre una ventana del Sistema con el valor actual, los días exactos hasta el siguiente +0,1, qué pasaría hoy si fallas y las Piedras disponibles. Las reglas opacas generan desconfianza; las visibles generan estrategia y apego.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### PEN-023 · Informe de daño a las 21:30
**Qué:** La notificación nocturna se convierte en "informe de daño": lista las misiones pendientes, el XP exacto que se perderá y las rachas que se romperán si no actúas, con deep-link directo a completarlas. Una decisión informada de último minuto salva más rachas que una alarma genérica.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### PEN-024 · Misiones críticas vs. flexibles
**Qué:** Cada misión se etiqueta como "crítica" o "flexible": solo las críticas pueden romper la racha global y disparar la penalización dura; las flexibles solo pierden su XP y su racha propia. Permite ser ambicioso añadiendo misiones extra sin convertir cada una en una bomba para la racha.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### PEN-025 · Biblioteca de misiones de redención por stat
**Qué:** Catálogo de 25-30 misiones de penalización temáticas emparejadas con el stat fallado: fallas FUE → "50 flexiones antes de las 22:00"; fallas INT → "25 min de pomodoro extra". La redención repara el área dañada, lo que la hace sentirse justa y narrativa en vez de arbitraria.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### PEN-026 · Mazmorra de Redención semanal
**Qué:** Si acumulas deuda de XP, el domingo aparece una mazmorra púrpura especial de 3 misiones encadenadas; completarla salda toda la deuda de la semana y suelta una Piedra como botín. Transforma el castigo pendiente en un evento jugable que apetece atacar.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 2

### PEN-027 · Alerta "racha en peligro" específica
**Qué:** Notificación que solo se dispara cuando una racha ≥7 días está a una misión de romperse, nombrando el hábito y los días en juego: "Tu cadena de 23 días de estudio se rompe en 2 h". La urgencia concreta y personal salva rachas; los recordatorios genéricos se ignoran.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### PEN-028 · Intercambio por misión equivalente
**Qué:** Antes del cierre del día, una misión imposible puede canjearse por una alternativa del mismo stat predefinida por el usuario (no pude ir al gym → rutina de 20 min en casa), conservando la racha y el XP base sin bonus. Premia la adaptabilidad en lugar de castigar las circunstancias.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### PEN-029 · Rachas por cuota semanal
**Qué:** Nuevo tipo de programación "X veces por semana, cualquier día": su racha se mide en semanas consecutivas cumpliendo la cuota, con indicador de progreso 2/3 visible en la tarjeta. Hábitos como gym o cardio encajan mejor en cuotas flexibles que en días fijos, y su racha debe reflejarlo.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### PEN-030 · Modo Lesión para FUE
**Qué:** Al activarlo, las misiones de gym se congelan sin romper racha y se ofrecen sustitutas de rehabilitación y movilidad que mantienen viva la cadena de FUE a intensidad reducida. Una lesión real no debe destruir tres meses de constancia en el gimnasio.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### PEN-031 · Gracia de 7 días para hábitos nuevos
**Qué:** Las misiones recién creadas llevan la etiqueta "EN FORMACIÓN" durante su primera semana: fallarlas no genera penalización ni rompe la racha global, aunque sí reinicia su racha propia. Instaurar un hábito requiere intentos fallidos; castigarlos desde el día 1 mata la experimentación.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### PEN-032 · Doble Turno (reparación en 24 h)
**Qué:** Tras romper la racha de un hábito, durante 24 h aparece la oferta "Doble Turno": completar dos sesiones de ese hábito al día siguiente restaura la racha rota. Cosido al lore (el cazador entrena el doble para compensar), da una vía de reparación que exige esfuerzo real, no perdón gratis.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### PEN-033 · Detección de exámenes desde el calendario
**Qué:** Cuando el calendario contiene eventos marcados como examen, 7 días antes el Sistema sugiere activar el Modo Examen con un toque, preconfigurado con esas fechas. Reduce a cero la fricción de usar la válvula de escape justo cuando el usuario está más saturado.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### PEN-034 · Récords de racha y celebración al batirlos
**Qué:** Guardar la mejor racha histórica por hábito y global; al superarla salta la ventana dorada "NUEVO RÉCORD DE CAZADOR" con el valor anterior tachado. Tras una caída, el objetivo mental deja de ser "lo que perdí" y pasa a ser "mi récord a batir".
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 4

### PEN-035 · Mapa de calor de rachas
**Qué:** Calendario tipo heatmap en informes: intensidad de azul según % completado, iconos para días salvados por Piedra, congelados por modos y rachas rotas. Ver la constancia como territorio conquistado es una de las visualizaciones más motivadoras que existen.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### PEN-036 · Juramento del Cazador (contrato de racha)
**Qué:** Compromiso voluntario sobre un hábito concreto ("7 días seguidos de dieta") firmado en una ventana solemne del Sistema: cumplirlo da la recompensa pactada y fallarlo aplica la penalización aceptada al firmar, sin sorpresas. El compromiso explícito y autoimpuesto multiplica la adherencia.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### PEN-037 · Modo Mantenimiento anti-burnout
**Qué:** Modo de larga duración (2-4 semanas) que reduce la carga al 50 % manteniendo rachas y multiplicador; el Sistema lo sugiere proactivamente si detecta una caída sostenida del cumplimiento. Mejor mantener poco que abandonarlo todo.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### PEN-038 · Gestión y límites de Piedras
**Qué:** Ajustes finos del seguro de racha: auto-uso por defecto con el aviso "Una Piedra de Protección se ha consumido", opción de uso manual, máximo 2 almacenadas y nunca 2 días consecutivos. Mantiene la red de seguridad útil sin que se convierta en permiso para desaparecer.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### PEN-039 · Última llamada a las 23:00
**Qué:** Notificación extra a las 23:00 que solo se dispara si tras la de las 21:30 sigue habiendo una racha ≥7 días en riesgo, con tono de cuenta atrás ("Quedan 4 h"). Escalada selectiva: insistir solo cuando hay algo grande en juego evita la fatiga de notificaciones.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### PEN-040 · Cupo anual de vacaciones
**Qué:** El Modo Vacaciones tiene un saldo de 21 días por año visible en el perfil, se programa con al menos un día de antelación y los días no usados no se acumulan. Pone barandillas a la válvula de escape más potente para que congele descansos reales, no fugas.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### PEN-041 · Motivo de fallo en 1 toque
**Qué:** Al romperse una racha, aparece un chip rápido opcional con motivos (cansancio, falta de tiempo, olvido, imprevisto, desmotivación) que se guarda junto al evento. Coste de captura mínimo hoy; oro puro para los informes de la fase 4, que podrán detectar patrones de fallo.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### PEN-042 · Pantalla de fallo orientada a recuperación
**Qué:** Rediseñar la ventana de penalización: arriba el daño con números claros y abajo siempre un botón de acción inmediata ("Iniciar misión de redención", "Usar Piedra", "Ver qué salvar mañana"). Ningún fallo debe terminar en una pantalla sin salida jugable.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### PEN-043 · Rampa de regreso tras congelación
**Qué:** El primer día tras Vacaciones o Enfermedad genera solo el 50 % de las misiones (las críticas primero), el segundo el 75 % y el tercero ya el 100 %. Evita el muro del primer día de vuelta, donde mueren la mitad de los regresos.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### PEN-044 · Falta justificada con nota
**Qué:** Hasta 2 veces al mes se puede marcar un fallo como "justificado" escribiendo una nota breve obligatoria: no hay penalización y la racha global se conserva, mientras que la del hábito se congela ese día. Sistema de honor explícito y limitado: tú decides, el cupo evita el autoengaño.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### PEN-045 · Auditoría de racha consultable
**Qué:** Historial inmutable de cada cambio de racha y penalización (fecha, causa, XP, Piedras usadas) accesible desde el perfil. Cuando el usuario dude de un número, podrá verificarlo en segundos; esa transparencia sostiene la confianza en todo el sistema de castigos.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### PEN-046 · Rachas a prueba de zona horaria
**Qué:** Calcular el corte de día con fecha local persistida y manejar viajes y cambios de hora (DST) sin marcar fallos falsos ni duplicar días, con suite de tests específica para bordes de medianoche. Una racha de 60 días rota por un bug de huso horario es una desinstalación segura.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### PEN-047 · Tolerancia a días sin sincronizar
**Qué:** Si no hubo conexión con Supabase, no se aplican penalizaciones ni rupturas hasta que el dispositivo sincroniza y confirma el estado real del día, con cola local de checks pendientes. Nunca castigar por un problema técnico.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### PEN-048 · Modo Viaje
**Qué:** Modo intermedio entre normal y vacaciones: solo se programan las misiones etiquetadas como "portátiles" (estudiar en el portátil, andar 8.000 pasos) y el resto se congela sin romper rachas. Para fines de semana fuera en los que apetece mantener algo, pero no todo.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### PEN-049 · Títulos de prestigio por racha
**Qué:** A los 30/60/100/180 días de racha se desbloquean títulos cosméticos permanentes ("Inquebrantable", "Monarca de la Constancia") que se conservan aunque la racha caiga después. Trofeos imperdibles para la constancia: lo ya ganado reduce el terror a romper la cadena.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### PEN-050 · Widget de racha en peligro
**Qué:** Widget de pantalla de inicio con la cadena de racha global, contador de días y estado por color (azul: a salvo, ámbar: misiones pendientes, rojo: en peligro). La racha visible fuera de la app es un disparador de apertura diaria sin coste de atención.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### PEN-051 · Nueva Temporada (reset voluntario)
**Qué:** Tras una recaída muy larga o al cerrar una etapa vital, opción de iniciar una "temporada": archiva rachas y récords en un salón de temporadas pasadas y arranca contadores limpios sin borrar el historial. A veces la mejor recuperación es un comienzo limpio, sin culpa ni números en rojo.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 6

### PEN-052 · Modo Tirano opt-in
**Qué:** Interruptor voluntario y temporal que endurece las reglas (sin Piedras, penalización al 75 %, sin versiones sombra) durante 1-4 semanas elegidas, con un título exclusivo como recompensa si se sobrevive. Para picos de motivación alta; el modo justo sigue siendo siempre el predeterminado.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 6

Total: 52 mejoras.
