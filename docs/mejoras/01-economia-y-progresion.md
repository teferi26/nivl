# Economía del juego y progresión global

> Categoría GAM · backlog NIVL · ordenadas por impacto

### GAM-001 · Curva de niveles exponencial con arranque rápido
**Qué:** Sustituir la progresión actual por una curva explícita XP(n) = 80 × n^1,55 (redondeada a múltiplos de 5): los niveles 1-10 caen en días y los 40+ cuestan semanas. Incluye script de migración que recalcula el nivel desde el XP total histórico y garantiza que el día 1 (o tras un renacimiento) siempre se sube al nivel 2. Los level-ups inmediatos del inicio enganchan; la curva creciente protege el prestigio de los niveles altos.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### GAM-002 · Sub-rangos dentro de cada rango (E-V → E-I)
**Qué:** Dividir cada rango en 5 sub-rangos (p. ej. D-V a D-I) con umbrales de XP propios y mini-ceremonia de ascenso (ventana del sistema + resumen de lo logrado en ese tramo). Convierte el salto de rango, que tarda meses, en hitos alcanzables cada 1-3 semanas: la motivación necesita metas próximas, no solo épicas.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### GAM-003 · Exámenes de ascenso de rango
**Qué:** El salto de rango completo (E→D, D→C…) no llega solo por XP: al llenar la barra, el Sistema convoca un "Examen de ascenso" de 3-7 días con requisitos explícitos (p. ej. 2 días al 100%, 1 misión difícil de cada stat, 1 incursión). Si se falla, se conserva el XP y se repite a la semana siguiente. Convierte cada rango en un rito de paso memorable en vez de acumulación pasiva.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 3

### GAM-004 · Cristales de maná: moneda secundaria gastable
**Qué:** Segunda moneda ganada solo jugando (días completados, cofres, contratos, fisuras): el XP nunca se gasta, los cristales sí. Tabla `wallet` + ledger de movimientos en Supabase (origen, cantidad, timestamp) para poder auditar la economía. Separar progresión (intocable) de poder de compra evita que gastar se sienta como retroceder.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 2

### GAM-005 · Tienda del Sistema con recompensas de vida real
**Qué:** Tienda con estética de ventana del sistema donde el usuario cataloga sus propios caprichos (capítulo de anime, cheat meal, compra de Steam, tarde libre) con precio en cristales; comprar genera un "permiso" canjeable con registro de fecha, y hay un objeto destacado rotativo semanal. Reward bundling: los placeres dejan de ser culpa y pasan a ser botín ganado.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 3

### GAM-006 · Cofres de botín con rarezas
**Qué:** Cofres común/raro/épico/legendario con tabla de botín visible (cristales, consumibles, llaves): caen al cerrar el día con todo completado y existe un 5% de drop sorpresa al completar cualquier misión. Apertura en dos tiempos (haz de luz del color de la rareza → contenido). El refuerzo de razón variable es el programa de recompensa más potente que existe; la tabla pública lo mantiene justo.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 3

### GAM-007 · Dungeon breaks: fisuras sorpresa
**Qué:** 1-3 veces por semana, en momento aleatorio dentro de una ventana válida, irrumpe una "fisura" con notificación urgente: micro-reto de 20-90 min sacado de un pool definido por el usuario (cardio extra, 15 flashcards, ordenar el escritorio) con cuenta atrás y botín alto si se cierra a tiempo; ignorarla no penaliza nada. La imprevisibilidad con urgencia opcional rompe la monotonía del checklist, que es lo que mata a los habit trackers al tercer mes.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 4

### GAM-008 · Temporadas de 6-8 semanas
**Qué:** Arcos con nombre y tema ("Temporada del Monarca de Hielo"), XP de temporada paralelo al global, modificadores propios y pantalla de cierre con resumen y reparto de botín. Nivel global y stats nunca se resetean; solo el marcador de temporada. Cada arranque de temporada es un "nuevo comienzo" psicológico (fresh start effect) sin perder progreso.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 5

### GAM-009 · Pase de temporada gratuito de 30 niveles
**Qué:** Pista de 30 niveles que se llena con XP de temporada; cada nivel suelta cristales, consumibles o llaves (las recompensas cosméticas las define PRO), con 3 hitos gordos en los niveles 10/20/30 y el siguiente premio siempre visible. Estructura de metas a medio plazo: el "me falta poco para el siguiente nivel del pase" sostiene las semanas flojas.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 5

### GAM-010 · Despertar: sistema de prestigio
**Qué:** Al alcanzar rango S con nivel máximo, opción voluntaria de "Despertar": el nivel vuelve a 1 con +5% de XP permanente por cada despertar acumulado y contador de despertares visible en Perfil; historial y stats vitalicios se conservan. Da final y rejugabilidad a la vez: el muro de "ya llegué al máximo" es donde mueren los trackers gamificados.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 6

### GAM-011 · XP dinámico según automatización del hábito
**Qué:** Si una misión se completa >90% durante 4 semanas, su XP base decae gradualmente (hasta −40%) con aviso narrativo ("Esto ya no es un desafío para ti, cazador"); si la tasa baja, el XP se recupera. La ciencia del hábito dice que lo ya automatizado no necesita recompensa extrínseca: el decaimiento empuja a buscar retos nuevos y frena la inflación de XP.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 3

### GAM-012 · Contratos del gremio semanales
**Qué:** Cada lunes el Sistema publica 3 contratos generados desde tus datos ("4 sesiones de gym", "300 XP de INT", "2 días con las 5 stats activas") con pago en cristales el viernes y bonus si cumples los tres. Los objetivos a 7 días tienden un puente entre la misión diaria y el rango lejano, y dirigen el esfuerzo hacia lo descuidado.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 3

### GAM-013 · Cofre semanal por tier de rendimiento
**Qué:** El domingo a las 21:30 se evalúa el % de misiones completadas de la semana y cae un cofre por tramo: bronce <60%, plata 60-79%, oro 80-94%, legendario ≥95%. Cierre de semana con veredicto tangible que premia la consistencia global, no la perfección diaria.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### GAM-014 · Misión diaria del Sistema dirigida a la stat débil
**Qué:** Cada mañana el Sistema propone 1 misión extra opcional apuntando a la stat más floja de los últimos 7 días ("Debilidad detectada en VIT: duerme antes de las 23:30") con +50% de XP y rechazo sin coste. Variedad diaria sin esfuerzo de configuración y autocorrección del desequilibrio entre stats.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### GAM-015 · Requisitos multi-stat para ascender de rango
**Qué:** Subir de rango global exige un mínimo en las 5 stats (p. ej. rango C requiere todas a nivel ≥15), mostrado como pentágono con los requisitos pendientes señalados. Bloquea el min-maxing (solo gym o solo estudio) y codifica la vida equilibrada dentro de la propia progresión.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### GAM-016 · Duelo contra tu Sombra
**Qué:** Invocar una "sombra" alimentada con tus propios datos de hace 30 días y competir contra ella una semana (barra cara a cara de XP diario); vencerla suelta cofre raro y cristales. La única comparación sana en una app de un solo usuario es contra tu yo pasado, y además es puro Solo Leveling.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### GAM-017 · Pantalla "Camino al ascenso"
**Qué:** Vista que desglosa exactamente qué falta para el siguiente sub-rango y rango: XP restante, mínimos de stats, examen pendiente, con barras parciales y fecha estimada. Los objetivos concretos y visibles aprovechan el efecto goal-gradient: se acelera cuando la meta se ve cerca.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### GAM-018 · Registro de botín con desglose
**Qué:** Feed cronológico de cada ganancia con su fórmula visible (base 50 + 25% evidencia + 12% racha + evento = 93 XP) y filtros por stat y fuente, estilo log de combate de RPG. Hace legible toda la economía, enseña las mecánicas sin tutorial y da una segunda dosis de recompensa al releerlo.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### GAM-019 · Economía de mazmorras: núcleo y jefes intermedios
**Qué:** Definir la recompensa de los proyectos-mazmorra de fase 2: cada hito intermedio es un "jefe" con cofre propio y el "núcleo" final paga XP masivo escalado por tamaño, con +50% si se cierra dentro del plazo. Los proyectos largos se abandonan sin recompensa intermedia; el bonus por deadline ataca la procrastinación del estudiante.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### GAM-020 · Soft cap diario con conversión a cristales
**Qué:** A partir de ~1,8× tu media móvil de XP diario el XP extra rinde al 50%, y por encima de 2,5× se convierte automáticamente en cristales (nada se pierde), con un indicador sutil de "saturación de maná" en la pantalla Sistema. Premia la consistencia frente al atracón —que es lo que construye hábitos— y protege la curva de niveles de la inflación.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### GAM-021 · Luna de miel de hábitos nuevos
**Qué:** Toda misión recién creada da +20% de XP durante sus primeros 7 días, con etiqueta "NUEVA" brillante en la lista. La fase de adquisición de un hábito es la que más refuerzo necesita: el Sistema paga más justo cuando más cuesta.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### GAM-022 · Bonus de apertura del día (+50% a la primera misión)
**Qué:** La primera misión completada de cada día otorga +50% de XP, anunciado en la notificación de las 8:00 ("La primera puerta del día rinde doble, cazador"). Arrancar es la fricción máxima del día: pagar más por la primera acción ataca exactamente ese punto.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### GAM-023 · Constantes de economía remotas (game_constants)
**Qué:** Mover todos los números del juego (XP por dificultad, multiplicadores, precios, probabilidades de cofre) a una tabla `game_constants` en Supabase con caché local y valores por defecto embebidos. Permite rebalancear la economía en caliente sin esperar una build de Expo: imprescindible antes de añadir más sistemas.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### GAM-024 · Simulador de economía a 365 días
**Qué:** Script TypeScript que simula un año de tres perfiles de cumplimiento (60/80/95%) y traza nivel, rango, cristales acumulados y días hasta cada hito; se ejecuta antes de tocar cualquier constante. Detecta inflación o muros de grind en minutos en vez de descubrirlos viviendo un mes con la curva rota.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 2

### GAM-025 · Pity timer en cofres
**Qué:** Contador oculto que garantiza un cofre épico como máximo cada 10 aperturas sin épico y un legendario cada 30, reseteándose al caer esa rareza. Conserva la emoción del azar eliminando su peor caso (semanas sin nada bueno), que es lo que destruye la confianza en la recompensa variable.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### GAM-026 · Consumibles potenciadores
**Qué:** Objetos de un solo uso comprables o dropeables: Elixir de XP (+50% durante 2 h, máx. 1/día), Llave dorada (cofre raro garantizado), Radar de fisuras (avisa de la próxima con 24 h), Piedra de afinidad (siguiente misión de la stat elegida ×2). Decidir cuándo gastar un buff es diversión táctica barata y un sumidero constante de cristales.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### GAM-027 · Dificultad "Incursión" (500 XP)
**Qué:** Categoría por encima de épica: 500 XP, máximo 1 activa por semana, exige evidencia de cámara y duración mínima declarada; pensada para entregas finales, exámenes o días-bestia. Los picos reales del cuatrimestre merecen recompensa a la altura sin desequilibrar el día a día.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### GAM-028 · Eventos ligados al calendario real
**Qué:** Al marcar periodos en el calendario (exámenes, vacaciones, verano) se activan eventos con modificadores: "Semana de guerra" (XP de INT ×1,5 y fisuras solo de estudio), "Operación estío" (FUE/VIT +25%). El juego se adapta a la vida real del estudiante en vez de competir con ella: los trackers mueren cuando ignoran los exámenes.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### GAM-029 · Proyección de fecha de ascenso
**Qué:** Bajo la barra de XP, una línea calculada con la media móvil de 14 días: "A este ritmo: rango C el 12 de agosto", actualizada a diario y con celebración cuando la fecha se adelanta. Convertir el futuro en una fecha concreta crea anticipación medible y hace visible el efecto de cada buen día.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### GAM-030 · Rango independiente por stat
**Qué:** Cada stat tiene su propio nivel y rango (puedes ser B en FUE y D en INT) con curva propia, y el rango global se deriva de la combinación. Refleja la realidad —nadie progresa uniforme— y multiplica por cinco los hitos disponibles sin crear contenido nuevo.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### GAM-031 · Techos de stat por rango
**Qué:** El rango global limita el nivel máximo de cada stat (rango E: stats hasta 20; D: hasta 35…), con candado visible en la barra al acercarse al tope. El ascenso de rango pasa a importar el doble porque desbloquea crecimiento, y acompasa toda la progresión.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 3

### GAM-032 · Reliquias del Despertar y Almas de Monarca
**Qué:** Al renacer se elige 1 reliquia permanente entre 3 ofrecidas (+10% XP de una stat, +1 ranura de consumible, fisuras +20% de botín, contrato semanal extra), pagadas con "Almas de Monarca" que solo caen en despertares y fisuras de rango S. Cada ciclo de prestigio construye una build distinta: coleccionar reliquias es la meta infinita.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 6

### GAM-033 · Curva adaptativa de flow
**Qué:** Cada 4 semanas el sistema ajusta ±10% el XP requerido por nivel para mantener un ritmo de ~1 nivel cada 10-14 días según tu tasa real de cumplimiento, mostrando el ajuste con transparencia total. Dificultad adaptativa = canal de flow: ni subir cada 2 días (trivial) ni cada 2 meses (desmoralizante).
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 5

### GAM-034 · Guarida del cazador
**Qué:** Base mejorable con cristales en 6 ramas (dormitorio, biblioteca, sala de entrenamiento…) de 5 niveles cada una; cada mejora otorga un bonus pasivo pequeño y permanente (+2% XP de la stat asociada, +1% de drop de cofres). Todo funcional, nada cosmético (eso lo cubre PRO). Sumidero de muy largo plazo con sensación de construir algo permanente entre temporadas.
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 7

### GAM-035 · Bóveda del gremio: inversión con riesgo
**Qué:** Depósito voluntario de cristales el lunes: si completas ≥80% de la semana recuperas el 115%; si no, pierdes el 25% de lo depositado (solo cristales apostados; nunca XP, nivel, rachas ni nada del sistema de penalizaciones de PEN). Límite de apuesta del 30% de la cartera. Commitment device clásico: la aversión a la pérdida trabajando a favor, de forma opt-in y acotada.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### GAM-036 · Paquete anti-farmeo
**Qué:** Tres reglas de integridad: las misiones creadas hoy rinden 50% solo durante su primer día; a partir de la 4ª misión de la misma stat en el día el XP cae −25% acumulativo; las triviales dejan de dar XP a partir de la 6ª diaria (aunque siguen contando para el día completo). Cierra los exploits obvios (crear basura para farmear) sin tocar el uso legítimo.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### GAM-037 · Rangos de fisura E→S y fisura roja mensual
**Qué:** Las fisuras sortean su rango E→S sesgado por tu rango actual (las S, rarísimas, sueltan botín legendario y Almas de Monarca); una "fisura roja" mensual actúa de jefe con reto doble, evidencia de cámara obligatoria y cuenta atrás de 24 h. Escala la mecánica estrella con tu progreso y crea un pico de adrenalina mensual.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### GAM-038 · Pool de fisuras configurable por contexto
**Qué:** Editor donde defines micro-retos aceptables etiquetados por contexto (casa/uni/gym) y franjas horarias válidas; las fisuras solo eligen retos posibles en tu franja y contexto actuales. Una fisura imposible ("haz cardio" en mitad de clase) entrena a ignorar el Sistema: la contextualización protege su credibilidad.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### GAM-039 · Fin de semana de potenciación rotativa
**Qué:** Cada viernes a las 18:00 se anuncia la stat potenciada del fin de semana (+50% XP), eligiendo automáticamente la más floja del mes. Evento recurrente baratísimo que redirige el esfuerzo hacia el punto débil justo cuando hay tiempo libre.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### GAM-040 · Factor de duración en el XP
**Qué:** Campo opcional de duración estimada en la misión; XP final = base de dificultad × factor de duración (×0,8 si <15 min, ×1,3 si >90 min), con tope superior para evitar abusos. Corrige la injusticia de que 2 horas de estudio paguen igual que 10 minutos de orden, sin complicar el alta rápida de misiones.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### GAM-041 · Gradiente de bonus por evidencia
**Qué:** Escalar el bonus único actual: nota de texto +10%, foto de galería +15%, cámara en el momento +25% (el existente) y cámara dentro de la primera hora de la franja +30%. Cada peldaño extra de fricción probatoria paga un poco más: refuerza la honestidad sin volverla binaria.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### GAM-042 · Recompensas de hito de nivel
**Qué:** Cada nivel múltiplo de 5 suelta un cofre garantizado (rareza creciente con el tramo) y cada sub-rango nuevo paga una cantidad fija de cristales. Ningún level-up debe quedarse en "el número cambió": siempre cae algo tangible.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### GAM-043 · Cofre del examen: recompensa por resultados reales
**Qué:** Al registrar la nota real de un examen o entrega cae un cofre escalado al resultado (aprobado: raro; notable: épico; sobresaliente: legendario), una vez por asignatura y convocatoria. Una dosis controlada de recompensa por resultados —no solo por proceso— conecta el juego con lo que de verdad importa del cuatrimestre.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### GAM-044 · Telemetría de economía (economy_snapshots)
**Qué:** Job semanal que vuelca a una tabla `economy_snapshots` el XP/día medio, cristales emitidos vs. quemados, ratio fuentes/sumideros y distribución por stat, con una vista de depuración oculta en Perfil. No se puede equilibrar lo que no se mide: es la base de todos los ajustes anti-inflación posteriores.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### GAM-045 · Revisión de dificultad asistida
**Qué:** Si una misión marcada "difícil" lleva 3 semanas con >95% de cumplimiento, el Sistema propone reclasificarla a "media" con tono narrativo ("Esta puerta ya no supone desafío") y botones de aceptar/rechazar. Mantiene honesta la equivalencia esfuerzo↔XP sin auditorías manuales y empuja a subir el listón real.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### GAM-046 · Nivel Sombra: XP vitalicio imborrable
**Qué:** Contador de XP total histórico que nunca baja ni se resetea (ni con penalizaciones ni con despertares), visible en Perfil como "Poder total del alma". Red de seguridad psicológica: cualquier pérdida o reset duele menos si existe un número que solo sabe crecer.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### GAM-047 · Precios dinámicos y tope de cartera
**Qué:** Índice de precios personal: los consumibles encarecen hasta +30% si tu ingreso semanal de cristales crece de forma sostenida, y a partir de 5.000 cristales la cartera avisa de "bóveda llena" sugiriendo ofertas de la tienda. Mantiene la escasez percibida cuando la economía madura y combate el acaparamiento que mata las tiendas internas.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### GAM-048 · Torre de ascenso: mapa visual de progresión
**Qué:** Visualización vertical de toda la progresión como una torre: cada planta un nivel, cada tramo un sub-rango, con tu posición actual, los exámenes de ascenso como puertas y los hitos superados iluminados. Ver el camino completo —recorrido y restante— en una sola imagen motiva más que cualquier número suelto.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### GAM-049 · Onboarding "Cómo funciona el Sistema"
**Qué:** Pantalla accesible desde Perfil con la fórmula de XP completa y ejemplos interactivos (mueves dificultad/evidencia y ves el resultado), la curva de niveles y la tabla de rangos. La percepción de justicia exige transparencia total, y entender la economía multiplica su efecto motivador.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### GAM-050 · Principios de economía y tests de invariantes
**Qué:** Documento breve de reglas inviolables (nada compra XP directamente, todo sumidero es opcional, ninguna pérdida toca el Nivel Sombra…) más tests automáticos que las verifican contra las constantes remotas en cada cambio. A medida que crezcan sistemas y eventos, los invariantes evitan romper la economía con un ajuste inocente.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 2

### GAM-051 · Informe mensual del cazador (PIB personal)
**Qué:** Informe el día 1 de cada mes: XP por stat y por fuente (misiones, cofres, fisuras, contratos), cristales ganados vs. gastados y comparativa con los 3 meses previos, en gráficos con estética de terminal del Sistema. La vista macro convierte los datos en narrativa de progreso y revela qué fuentes están sobre o infraexplotadas.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### GAM-052 · Cristales por mantenimiento del sistema
**Qué:** Micro-pagos en cristales por meta-hábitos: revisar y ajustar misiones el domingo (50 cristales), archivar misiones muertas y responder la retro semanal de 3 preguntas, con tope semanal para que no sea farmeable. Recompensar el acto de planificar mantiene el sistema vivo: los trackers se abandonan cuando la lista se pudre, no cuando falla un día.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

Total: 52 mejoras.
