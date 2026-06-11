# Dieta, nutrición y lista de la compra

> Categoría NUT · backlog NIVL · ordenadas por impacto

### NUT-001 · Planificador semanal de comidas
**Qué:** Pantalla "Plan de raciones" con rejilla de 7 días × franjas (desayuno, comida, merienda, cena, snack) donde se asignan recetas con tap largo o arrastre; cada celda muestra nombre y kcal, y el día suma totales en cabecera. Es el cuartel general de la dieta: ver la semana entera resuelta elimina la decisión diaria, que es exactamente donde mueren las dietas.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 3

### NUT-002 · Recetario con macros por ración
**Qué:** CRUD de recetas con foto, ingredientes (cantidad + unidad), número de raciones y macros calculados automáticamente por ración (kcal, proteína, carbohidratos, grasas). Es la base de datos personal que alimenta plan, lista de la compra y XP: sin ella no existe nada más del módulo.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 3

### NUT-003 · Lista de la compra autogenerada
**Qué:** Botón "Generar compra" que recorre el plan semanal, agrega ingredientes repetidos entre recetas, convierte unidades (g→kg, uds→packs) y produce la lista final lista para el súper. Mata la fricción nº 1 entre planificar y cumplir: si la nevera está llena de lo correcto, la dieta casi se cumple sola.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 3

### NUT-004 · Misión VIT diaria autogenerada "Sigue tu plan"
**Qué:** Si hay plan para hoy, el sistema crea automáticamente la misión VIT "Cumple tu plan de raciones" (dificultad según nº de comidas); se completa sola al marcar todas las comidas y paga XP con la economía existente (racha, evidencia y penalización incluidas). La dieta deja de ser una app aparte: es una misión más del cazador.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 3

### NUT-005 · Check de comida con XP inmediato
**Qué:** Cada comida del día aparece en la pantalla Sistema como sub-tarea con check de un tap; al marcarla suena el "ping" del sistema y caen +5–15 XP VIT al instante con número flotante. Refuerzo inmediato 4-5 veces al día en lugar de una única recompensa nocturna: así es como se cablea un hábito.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 3

### NUT-006 · Asistente de objetivos: TDEE y macros
**Qué:** Wizard de 5 pasos (edad, altura, peso, actividad, objetivo: definición/mantenimiento/volumen) que calcula el TDEE con Mifflin-St Jeor y propone kcal y gramos diarios de proteína/carbos/grasas, todo editable. Presentado como "Calibración del cazador": da un porqué numérico a cada comida del plan.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 3

### NUT-007 · HUD de macros restantes
**Qué:** Cabecera del día con barras estilo videojuego (kcal como barra de vida, proteína como maná) que se vacían al registrar comidas: "Te quedan 612 kcal y 48 g de proteína". Convierte el día nutricional en una partida en curso que apetece cerrar bien.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 3

### NUT-008 · Registro rápido fuera de plan
**Qué:** Botón "+" que abre búsqueda de recetas/alimentos recientes o entrada manual exprés (nombre + kcal aprox + proteína) en menos de 10 segundos. Principio clave: un dato imperfecto registrado vale más que el abandono por fricción; lo no planificado también debe contar.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 3

### NUT-009 · Pack de misiones VIT de nutrición listas para usar
**Qué:** Diez plantillas instalables sobre el sistema de misiones actual: pieza de fruta diaria, verdura en comida y cena, 2 L de agua, cero azúcar añadido, cocinar en casa, proteína en cada comida, última comida 2 h antes de dormir… con stat, dificultad y días preconfigurados. Valor de dieta inmediato en fase 2 sin esperar al módulo completo.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### NUT-010 · Hidratación: la poción de vitalidad
**Qué:** Contador de agua con botones +250/+500 ml que llena un frasco animado en azul cazador; objetivo diario configurable y XP VIT al completarlo. No depende del planificador, así que entra como quick win temprano del stat VIT.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### NUT-011 · Lista agrupada por pasillos
**Qué:** La lista se organiza en secciones (frutería, carnicería, pescadería, lácteos, despensa, congelados, bebidas, higiene) cuyo orden se personaliza arrastrando una sola vez para clavar el recorrido de tu súper habitual. Comprar en 15 minutos sin zigzaguear por la tienda.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### NUT-012 · Racha de adherencia nutricional
**Qué:** Racha específica de dieta (el día cuenta si cumples ≥80% de las comidas del plan) con llama propia en el panel VIT y aportación al multiplicador global existente (+0,1 cada 7 días). Hace visible la constancia nutricional separada del resto de misiones.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### NUT-013 · Pase de Gala: comida libre ganada
**Qué:** Cada 6 días con adherencia ≥90% se forja un "Pase de Gala" (máximo 2 acumulados); canjearlo convierte cualquier comida en libre sin romper racha ni estropear el informe. La flexibilidad ganada es la mejor defensa contra el atracón rebote: el día trampa pasa de pecado a botín.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### NUT-014 · Comida libre planificada
**Qué:** Al montar la semana puedes marcar una franja como "libre" (p. ej. cena del sábado) y cuenta como adherencia plena porque estaba prevista. La ciencia del hábito es clara: la indulgencia planificada protege el plan; la improvisada lo derrumba.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### NUT-015 · Mazmorra de batch cooking
**Qué:** El domingo aparece una "mazmorra de cocina" púrpura: checklist con las recetas del batch (raciones ×4), cronómetro de sesión y recompensa épica de XP al cerrarla con foto del botín de tápers. Dos horas de cocina dejan la semana entera en modo automático.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### NUT-016 · Plantillas de semana A/B
**Qué:** Guardar cualquier semana planificada como plantilla con nombre y aplicarla en 2 taps; rotación A/B/C para alternar menús sin pensar. Planificar pasa de 30 minutos a 30 segundos a partir de la segunda semana.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### NUT-017 · Modo súper: la incursión de compra
**Qué:** Al abrir la lista en la tienda: tipografía grande, tachado de un tap que manda el ítem al fondo, contador "14/27", pantalla siempre encendida y mini-XP AGI al completar el 100%. La compra semanal se convierte en una misión de recolección satisfactoria.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### NUT-018 · Despensa: "esto ya lo tengo"
**Qué:** Antes de confirmar la lista, pantalla de revisión para marcar lo que ya hay en casa; los básicos (aceite, sal, especias) recuerdan su estado entre semanas y solo reaparecen pasado un intervalo. Evita comprar el tercer bote de orégano.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### NUT-019 · Foto del plato como evidencia
**Qué:** El check de comida acepta la evidencia de cámara ya construida: foto del plato en el momento = +25% de XP de esa comida, igual que en cualquier misión. Reutiliza el pipeline actual (cámara + Storage) y añade honestidad al registro.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### NUT-020 · Hotbar de comidas frecuentes
**Qué:** Rejilla de 8 huecos estilo barra de objetos de videojuego donde fijas tus comidas de siempre (avena con whey, pollo con arroz…); registrarlas cuesta 2 taps. La mayoría repetimos el 80% de nuestras comidas: explotarlo es la mayor reducción de fricción posible del registro.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### NUT-021 · Recordatorios por franja de comida
**Qué:** Notificación local opcional por comida a su hora ("14:00 — Misión activa: pollo teriyaki, 620 kcal") con deep link directo al check, configurable y silenciable por franja. Se apoya en el sistema de notificaciones 8:00/21:30 ya construido.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### NUT-022 · Resumen nocturno 21:30 enriquecido
**Qué:** La notificación nocturna existente incorpora el estado nutricional: "Te falta la cena y 500 ml de agua para cerrar un día perfecto". Es la última ventana de rescate antes de que actúe la penalización dura del día.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### NUT-023 · Escalado de raciones ×1/×2/×4
**Qué:** Selector de raciones en la receta y en la celda del plan que recalcula ingredientes (y por tanto la lista de la compra) y macros por táper automáticamente; pensado para batch cooking y para cocinar para dos días.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### NUT-024 · Snacks de emergencia pre-aprobados
**Qué:** Lista corta de snacks "legales" (yogur proteico, fruta, 30 g de frutos secos) registrables en 1 tap; suman macros pero jamás rompen la racha. Anula el efecto "qué más da, ya he fallado" dando una salida digna al hambre imprevista.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### NUT-025 · Plan B por comida
**Qué:** Cada comida planificada admite una alternativa "sin tiempo" (<10 min y macros similares); un toggle las intercambia sin penalización ni culpa. Los días caóticos de entregas y exámenes dejan de tumbar la dieta.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### NUT-026 · Pesaje semanal con tendencia
**Qué:** Misión VIT recurrente "Pésate" un día fijo en ayunas; la gráfica muestra la media móvil de 7 días en lugar del dato bruto para no reaccionar al ruido hídrico diario. Es el feedback objetivo de que el plan de comidas funciona.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### NUT-027 · Informe semanal de nutrición
**Qué:** Sección dentro de los informes de fase 4: % de adherencia, kcal y proteína medias, litros de agua, comidas caseras vs fuera, y veredicto con rango ("Evaluación nutricional: B+"). Ver el progreso agregado sostiene la motivación cuando la báscula se atasca.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### NUT-028 · Logros de nutrición
**Qué:** Set propio dentro del sistema de logros: "Semana de Hierro" (7/7 días), "Chef de Mazmorra" (10 batch cookings), "Hidratación S" (14 días de agua perfecta), "100 comidas registradas", "Mes Impecable". Coleccionables que premian la constancia más allá del XP diario.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 4

### NUT-029 · Jefe mensual de nutrición
**Qué:** Cada mes aparece un jefe (p. ej. "Gula, el Devorador") con barra de vida que baja con cada día ≥85% de adherencia; 24 días buenos en el mes lo derrotan y sueltan recompensa épica (XP + título + marco de perfil). Convierte la consistencia mensual en una boss fight medible.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### NUT-030 · Ajuste adaptativo de calorías
**Qué:** Cada 21 días compara la tendencia real de peso con el objetivo declarado y propone ajustar ±100–150 kcal, con explicación y botón aceptar/rechazar. Un mini-nutricionista de bolsillo que evita los estancamientos que matan las dietas al segundo mes.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 6

### NUT-031 · "Ayer comí igual"
**Qué:** Botón que clona al día de hoy las comidas de ayer (o del mismo día de la semana pasada), editable después. Quick win brutal para semanas repetitivas de estudiante.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### NUT-032 · Penalización temática de cocina
**Qué:** Cuando fallas el día de dieta, la misión de penalización generada es nutricional y redentora: "Prepara mañana un desayuno alto en proteína y fotografíalo", recuperando el XP perdido con la mecánica ya existente. La redención enseña el hábito en lugar de solo castigar.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### NUT-033 · Comidas en el calendario
**Qué:** El plan semanal y la sesión de batch cooking se pintan en el calendario de fase 2 junto a misiones y mazmorras, con los colores del sistema. Un único lugar donde vive toda la semana del cazador.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### NUT-034 · Búsqueda y filtros del recetario
**Qué:** Buscador con chips de filtro: macro dominante (alta proteína), kcal por ración, tiempo de preparación e ingrediente incluido/excluido. Encontrar "cena de menos de 500 kcal en menos de 15 minutos" cuesta 2 taps.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### NUT-035 · Tiempo y dificultad en recetas
**Qué:** Campos de tiempo de preparación y dificultad usando la escala del juego (trivial→épica) visibles en la ficha; permite montar semanas realistas según la carga de estudio prevista.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### NUT-036 · Compartir lista de la compra
**Qué:** Exportar la lista como texto plano agrupado por pasillos al share sheet del sistema (WhatsApp, notas), por si compra otra persona o prefieres llevarla en papel.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### NUT-037 · Recordatorio del día de compra
**Qué:** Eliges tu día y hora de compra y llega la notificación: "Incursión al supermercado: 27 objetos por recolectar"; si aún no hay lista generada, ofrece generarla al momento.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### NUT-038 · Básicos recurrentes auto-añadidos
**Qué:** Marcar productos como recurrentes (leche, huevos, café) para que entren solos en cada lista generada con su cantidad por defecto, sin depender de que aparezcan en recetas.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### NUT-039 · Autorrelleno de huecos del plan
**Qué:** Las celdas vacías de la semana muestran "Sugerir": propone recetas favoritas que encajan en los macros restantes del día, con opción de rellenar toda la semana de un tirón.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### NUT-040 · Diario visual de platos
**Qué:** Galería cronológica con todas las fotos de evidencia de comidas, integrada en el diario de fase 4. Un mes de platos reales bien resueltos es prueba visual de identidad: "soy alguien que come bien".
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### NUT-041 · Modo restaurante: porciones de mano
**Qué:** Registro estimado al comer fuera con el método de la mano (palma = proteína, puño = carbohidrato, pulgar = grasa) en una pantalla visual de 3 taps; otorga XP parcial y el día no queda en blanco en las estadísticas.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### NUT-042 · Modo semana de exámenes
**Qué:** Toggle (o detección por calendario) que sustituye el plan por recetas de <15 min y planes B, rebaja la exigencia de racha al 70% y prioriza tápers del congelador. La dieta se adapta al estudiante en crisis, no al revés.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### NUT-043 · Inventario de tápers
**Qué:** Al cerrar el batch cooking se registran los tápers resultantes (receta, raciones, nevera o congelador); registrar una comida de táper lo descuenta. Siempre sabes qué hay listo para comer hoy sin abrir la nevera.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### NUT-044 · Recordatorios de agua inteligentes
**Qué:** Avisos espaciados según el agua restante y la hora del día (silencio si vas bien, más frecuentes si vas tarde), con pausa nocturna y apagado automático al cumplir el objetivo. Notificar con cabeza para que no acaben desactivados.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### NUT-045 · Oro ahorrado cocinando
**Qué:** Cada comida casera suma a un contador de "oro" la diferencia frente al coste estimado de pedir fuera (configurable, p. ej. 9 €); el perfil muestra el tesoro acumulado del mes. Motivador tangible y muy de juego: cocinar es lootear monedas.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### NUT-046 · Presupuesto y coste de la compra
**Qué:** Precio aproximado editable por ingrediente, total estimado de la lista y barra de presupuesto semanal con aviso al superarlo. Control de gasto de estudiante sin salir de NIVL.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### NUT-047 · Escáner de código de barras
**Qué:** Escanear envases con la cámara y autocompletar macros vía Open Food Facts (gran cobertura de productos españoles); dar de alta un alimento envasado cuesta 5 segundos.
**Impacto:** 3/5 · **Esfuerzo:** L · **Fase:** 5

### NUT-048 · Base de alimentos genéricos
**Qué:** Integrar una base de alimentos comunes (BEDCA / Open Food Facts) con macros por 100 g para registrar alimentos sueltos (plátano, arroz cocido) sin necesidad de crear una receta.
**Impacto:** 3/5 · **Esfuerzo:** L · **Fase:** 5

### NUT-049 · Modo cocina manos libres
**Qué:** Pasos de la receta a pantalla completa con avance tocando cualquier zona, temporizadores integrados por paso y pantalla siempre encendida. Cocinar con las manos en la masa sin pelearte con el móvil.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### NUT-050 · Widget "siguiente comida + agua"
**Qué:** Widget de pantalla de inicio (la infraestructura de widgets llega en fase 5) con la próxima comida, kcal y proteína restantes y anillo de hidratación con botón +250 ml. La dieta visible sin abrir la app.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### NUT-051 · Sustituciones equivalentes
**Qué:** Tabla de equivalencias por grupos (pollo↔pavo↔merluza, arroz↔patata↔cuscús) para sustituir un ingrediente en receta o plan ajustando macros y lista de la compra automáticamente. Flexibilidad sin romper los números.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### NUT-052 · "Cocina con lo que tienes"
**Qué:** Sugeridor que ordena el recetario por porcentaje de ingredientes ya disponibles en despensa y tápers, mostrando qué falta para completar cada receta. Apuesta grande que cierra el círculo despensa→receta→plan→compra.
**Impacto:** 2/5 · **Esfuerzo:** L · **Fase:** 6

Total: 52 mejoras.
