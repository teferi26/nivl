# Rediseño 1.1: problemas de primer uso

Entrada principal de las propuestas de rediseño desde login y registro, en app y web. Solo diagnostica: no propone diseños.

**De dónde sale.** Tres fuentes, de la que menos a la que más pesa:

1. Los 15 tests de NIVL 1.0.11 del 8 de noviembre de 2026. Son agentes de IA con perfiles distintos que probaron una galería con datos de mentira, no personas. No miden lo que haría el mercado.
2. Cada problema contrastado contra el código, commit e3c0045.
3. Un recorrido en simulador iPhone con la app real y un servidor falso local, de la portada a la firma con un perfil, y el primer día de los cinco perfiles. Más una auditoría de `nivl-ux-auditor` sobre esas capturas.

**No cubierto.** Nadie real ha usado esto. Sin verificar: correo real de confirmación, puerta de edad (salió ya confirmada), medición de uso, oferta Pro, web pública (`nivl-web` no está en este repo), iPad y Android, VoiceOver. En el simulador los campos de texto salieron precargados porque no se podía teclear. El login se saltó tras capturarlo, y la firma no se llegó a completar. Con `modos_1011` encendido; su valor en producción no se ha comprobado.

## Lo esencial

- **Nadie sabe qué es NIVL antes de crear la cuenta.** La primera pantalla es correo y contraseña bajo un lema, y abre en «Entrar» (P01). Luego vienen correo de confirmación, edad y unas reglas que hablan antes de castigos que de beneficios (P02).
- **La entrada es larga y exige lo más antes de dar nada.** Hasta once pantallas hasta Hoy (P03). Pide firmar un compromiso a tres años, con el nombre escrito por tercera vez y manteniendo pulsado, antes de haber visto la app (P04, N9).
- **El primer día puede quedar vacío, y la pantalla empuja a ello.** Un deportista sin permiso de salud ve 0 de 6 misiones y su botón principal es «Empezar sin misiones» (N3). Después: «Nada programado para hoy» (P05).
- **Promete lo que luego no cumple.** Elegir perfil «cambia lo que ves primero», y solo cambian las misiones (N1). Quien elige IRON aterriza en Base (N11). «Nadie más lo va a leer» no es exacto (N8).
- **Interrupciones sin contexto al llegar:** permiso de notificaciones al montar Hoy (N4) y, a quien eligió solo NIVL, una «Novedad» pensada para usuarios antiguos (N2).
- **El juego no es opcional ni se entiende.** Es la queja más repetida (P38, P07, P09, P10, P17).
- **No se sabe dónde está cada cosa.** El coach, lo más valorado, no está en la barra (P12). Avance, Campañas y Arena no dicen qué contienen (P13). La rueda no se descubre (P14) y sin modos no existe (N12).

## Por perfil: primeros cinco minutos

«Qué es / qué hacer / dónde está» responde si esa persona lo entiende, según las capturas y el código.

| Perfil (test) | Qué es | Qué hacer ahora | Dónde está cada cosa | Lo que más le duele |
|---|---|---|---|---|
| Emprendedor (01) | Parcial | Sí, con misiones | No | P10 («Prospección» es Agilidad), N5, P45 (FOUNDER parece un filtro) |
| Profesional (02) | Parcial | Sí, si creó misiones | No | P11 (3 de 6 válidas sin permiso), P45 (WORK abre dinero), P17 (tono de castigo), P38 |
| Deportista (03) | Parcial: promete gimnasio y cae en Base | Solo si acepta el permiso de salud; si no, P05 | Parcial | N3/P11 (0 de 6), N11, P31 |
| Estudiante (04) | Parcial | Sí, pero el primer logro son dos horas | No | N5, P10 («Sin móvil» es Agilidad), P13/N13 |
| General (05) | No: no ve para quién es | No si empieza vacío; sí con misiones | No | P11 (2 de 5, sin agua, caminar ni dormir), N2, P05, N12 |

Dos transversales que no son un perfil:

- **19 años, llega de TikTok (06).** Se va en la cuenta y en las reglas (P01, P02, P35, P36). Le engancha ver Hoy y el coach, justo lo que llega el último.
- **Accesibilidad (07).** El control principal casi no se ve (P22) y hay rótulos por debajo del mínimo (P23, N13).

Lo que los tests valoran y conviene no perder: la identidad visual, «A los 21 días un hábito es tuyo», la lista de misiones con siguiente acción clara, y el coach que marca misiones solo.

## Hallazgos del recorrido real

No salieron en los tests porque la galería no enseña estos pasos.

| ID | Pantalla | Problema | Impacto | Evidencia |
|---|---|---|---|---|
| N1 | Onboarding, para qué | Promete «Cambia lo que ves primero», pero Hoy no usa los módulos del perfil: solo cambian las misiones. | Alto | Código: `general/Arsenal.tsx:121` (`ACCESOS` fijo); capturas hoy-* |
| N2 | Hoy | Quien eligió solo NIVL recibe «Novedad: elige tus modos» nada más terminar el onboarding. Es un fallo: la hoja es para usuarios antiguos. | Alto | Simulador y `modos/novedad.ts:32`; captura novedad-modos-general |
| N3 | Objetivo y misiones | La casilla de salud sale apagada y a un deportista se le pide un objetivo sin datos de salud. Después 0 de 6 marcadas y la acción sólida es «Empezar sin misiones». Tocar una abre la hoja legal. | Alto | Simulador; `onboarding.tsx:296`, `:960`; captura 07-misiones |
| N4 | Hoy | El permiso de notificaciones del sistema salta al entrar, antes de hacer nada y sin explicar para qué. | Alto | Simulador; `hoy/useHoy.ts:354` |
| N5 | Hoy, siguiente acción | Es la primera pendiente de la lista, no la más asequible: «Bloque de foco 90 min» o «Estudiar 2 h» como primer logro. | Alto | Código: `hoy/derivarHoy.ts:329` |
| N6 | Registro | Cuatro campos y casilla; botón y casilla bajo el pliegue, sin pie fijo. | Alto | Captura 01-crear-cuenta; `acceso/LoginVista.tsx:257` |
| N7 | Tras registrarse | No se puede reenviar el correo; si no llega, solo se remite a spam. | Alto | Búsqueda sin resultados en `authFlow.ts` y `components/acceso` |
| N8 | Firma | «Nadie más lo va a leer», pero el objetivo y la firma se guardan y los lee el coach. Afecta a la confianza. | Medio | `onboarding.tsx:343`, `supabase/functions/_shared/context.ts:380` |
| N9 | Registro, nombre, firma | El nombre se pide tres veces. | Medio | Capturas 01, 03, 09; la precarga en el perfil no se ha verificado |
| N10 | Objetivo | Es obligatorio, sin salida. | Medio | `onboarding.tsx:956` |
| N11 | Tras el onboarding | Quien elige IRON aterriza en Base. El onboarding dice NIVL, la rueda BASE. «Sin activar» no explica qué ocurre al tocar. | Medio | Capturas hoy-deportista y rueda-deportista |
| N12 | Barra inferior | General sin modos: sin emblema ni aviso de que los modos existen. | Medio | Simulador: 4 pestañas; `modos/EmblemaMundo.tsx:61` |
| N13 | Campañas | Título encogido muy por debajo de 11 pt. La pestaña dice siempre «Campañas» aunque el título cambie por perfil. | Medio | Captura campanas-vacio; causa sin aislar en `general/piezas.tsx:390` |
| N14 | Onboarding, progreso | «Paso VI de VIII» en romanos; el total omite edad y medición e incluye una oferta que puede saltarse. | Bajo | Capturas 03 a 09 |
| N15 | Misiones, Campañas | Dificultad «Trivial» en la meta. Campañas vacío define campaña dos veces y dice «tareas». | Bajo | Capturas 07 y campanas-vacio |

Parecido en Hoy: «Tu arsenal · Toca para equipar», «Todo desde aquí · Sin cambiar de modo» y «Base · nivel global» aparecen en la primera pantalla sin explicación (ver P21).

## Problemas de los 15 tests

Impacto: **alto** (puede hacer abandonar o dejar sin saber qué hacer), **medio** (confunde, pero se sigue), **bajo** (pulido). «Contraste» significa que se vio al revisar el código y ningún tester lo dijo con esas palabras. En Área, «fuera» indica que no se resuelve solo con diseño.

| ID | Tests | Pantalla | Problema | Impacto | Comprobación | Área |
|---|---|---|---|---|---|---|
| P01 | 06, 14 | Acceso (`/login`) | La primera pantalla pide cuenta y no dice qué es NIVL: solo el lema. Abre en «Entrar», así que quien llega nuevo tiene que cambiar de pestaña. La explicación del producto llega después del correo. | Alto. Se pide el compromiso antes de dar ninguna razón. | Confirmado: `_layout.tsx` manda a `/login` sin sesión; `useLogin.ts:46` arranca en `signin`. | onboarding |
| P02 | 06, 05, 01, 15, 02, 04 | Onboarding, portada | Bloque «Las reglas» con tres párrafos antes de hacer nada. Habla de restar XP, de trampas y de cámara, y no dice qué gana la persona. «El sistema no opina. Registra.» no se entiende. | Alto. Es donde los tests 05 y 06 se irían. | Confirmado: `PortadaArena.tsx`, `onboarding.json` `portada.lore`. | onboarding |
| P03 | 06, 14, 15, 01 | Onboarding completo | Siete pasos, más edad, medición, idioma y modos si están activos, antes de ver la app. Lo menos urgente va antes de la primera misión. | Alto. Son hasta once pantallas hasta Hoy. | Confirmado: `pasos.ts`, `onboarding.tsx`. La duración real no se ha medido. **Matiz:** Con modos activos la barra marca VIII. Además van antes edad y medición, que no cuentan. | onboarding |
| P04 | 06, 14, 01 | Onboarding, firma | Hay que leer un contrato, volver a escribir el nombre y mantener pulsado antes de haber usado nada. No se puede saltar. | Alto. El gesto más exigente va antes del primer valor. Ojo: es el control que Apple rechazó en iPad. | Confirmado: `onboarding.tsx` paso 5, sin salida en el pie. **Matiz:** Añade elegir plazo (se recomiendan 3 años). El control de firmar queda fuera de la vista sin desplazar. | onboarding |
| P05 | 06, 08, 05 | Hoy, sin misiones | «Nada programado para hoy. Crea tus misiones en Hábitos» y un botón a otra pantalla. Quien pulsa «Empezar sin misiones» acaba en un callejón el primer día. | Alto. El primer día decide si hay segundo. | Confirmado en la vista real: `HoyGeneralVista.tsx:133`. **Matiz:** Visto en simulador: captura hoy-general-vacio. | hoy |
| P06 | 06, 15, 01, 05 | Hoy, primera entrada | Tras el onboarding se cae en Hoy sin una frase de qué hacer ni un primer logro guiado. Lo primero que se ve es nivel, XP y piedras. | Alto. No hay momento de «ya he hecho algo». | Confirmado: `finish()` hace `router.replace('/(tabs)')` y no hay nada de primera vez. **Matiz:** Con misiones sí hay acción clara arriba. Falta un primer logro y sobran interrupciones (N2, N4). | hoy |
| P07 | 05, 01, 08 | Hoy, cabecera de nivel | Nivel, rango, XP, racha y piedras sin explicar. El rango y el título («Rango E», «Tiro») no se distinguen. Tocar la tarjeta abre Progresión, pero nada lo indica. | Alto. La pantalla principal parece un panel sin manual. | Confirmado: `CabeceraGeneral.tsx`. | vocabulario |
| P08 | 05, 06 | Toda la app | No hay ayuda ni glosario en ningún sitio: ni «Cómo funciona» ni un significado de cada palabra. | Alto. Quien se pierde no tiene a dónde ir. | Confirmado: búsqueda en `src/i18n/es` sin resultados. **Matiz:** Desde e3c0045 existe el glosario, accesible solo desde Perfil. Pista y Termino no se usan aún en ninguna pantalla real. | vocabulario |
| P09 | 05, 01, 09 | Varias | Palabras sin aclarar la primera vez: piedras, botín, jefe final, contrato, ludus, PB, Oráculo, Recuerdos, Élite. | Alto para quien no busca un juego. Se conservan, pero deben poder entenderse. | Confirmado en `src/i18n/es`. | vocabulario |
| P10 | 05, 02, 09 | Hoy, misiones; onboarding, misiones | Cada misión lleva un atributo de juego de rol («AGI · Agilidad», «INT · Inteligencia»). «Enviar la propuesta a dos clientes» como Agilidad suena a disfraz. Es ruido para quien quiere beber agua. | Alto. Se ve en cada fila. Quitarlo de la fila no toca XP. | Confirmado: `QuestItem.tsx:79`, `HoyGeneralVista.tsx:116`. | hoy |
| P11 | 05, 14, 10 | Onboarding, misiones | El perfil «En general» propone Entrenar, Trabajo, Comidas, Leer y Diario: nada de agua, caminar o dormir. Sin permiso de salud, tres de las cinco salen desmarcadas y al tocarlas se abre una hoja legal. La línea «salud (opcional)» no se explica. | Alto. La persona general solo ve dos propuestas válidas, y puede quedarse sin ninguna. | Confirmado: `kinds.ts:243`, `onboarding.tsx:296` y `:492`. Si se toca `kinds.ts`, también su copia en `_shared`. **Matiz:** No es solo General. Propuestas válidas sin permiso de salud: deportista 0/6, general 2/5, profesional 3/6, emprendedor y estudiante 4/6. | onboarding |
| P12 | contraste; 06, 15 lo señalan como el valor | Barra inferior | El coach, lo que más gusta, no está en la barra: se llega por una tarjeta casi al final de Hoy (bloque 8 de 9). | Alto. No se descubre sin bajar. | Confirmado: `navItems.ts` (`compact: false`), `HoyGeneralVista.tsx:238`. Barra en manos de otro chat: cambio mínimo o subir la tarjeta. | navegacion |
| P13 | 05, 02 | Barra inferior | «Avance», «Campañas» y «Arena» no dicen qué hay dentro. Arena son los amigos y Campañas los proyectos. | Medio. Hay que abrirlas para saberlo. | Confirmado: `comun.json` `destino`. | navegacion |
| P14 | contraste; 01, 02 sobre modos | Rueda de modos | Nada enseña que el emblema abre una rueda ni para qué sirve: la pista solo existe para el lector de pantalla. Usa rótulos de juego sin explicar: BASE, EQUIPADO, ANTERIOR, DE VUELTA A LA BASE. Ningún tester la usó. | Medio, solo con `modos_1011` y algún modo activo. | Confirmado: `EmblemaModo.tsx:219` (`accessibilityHint`), `modos.json` `rueda`. **Matiz:** En primer uso solo se ven BASE, ACTUAL y «Sin activar». EQUIPADO y ANTERIOR no aparecen. | navegacion |
| P15 | 05 | Hoy, camino a Hábitos | Crear un hábito propio no es evidente: «Gestionar hábitos» solo sale si ya hay misiones; si no, queda el botón del vacío o un acceso casi al final. | Medio. La tester 05 no vio cómo añadir uno desde cero. | Confirmado: `HoyGeneralVista.tsx:143` y `:172`. | navegacion |
| P16 | contraste; 05, 02 | Onboarding, Hoy, Hábitos | Misión y hábito se usan como lo mismo sin decirlo: «Crea tus misiones en Hábitos», «Gestionar hábitos» bajo «Misiones de hoy». | Medio. No se sabe si son dos cosas. | Confirmado: `hoy.json`, `general.json`, `onboarding.json`. | vocabulario |
| P17 | 01, 02, 04, 05, 06, 15 | Firma, Contrato, Hábitos | Tono de castigo en el primer contacto: «Aceptaré la penalización», «no negociaré», «confesar», «{{xp}} XP por regla y su consecuencia mañana». | Alto para quien ya abandonó apps por culpa. Solo cambia el texto, nunca las reglas. | Confirmado: `onboarding.json` `compromiso`, `habitos.json`, `contrato.json`. | vocabulario |
| P18 | 01, 02, 04, 05 | Hoy, nota bajo las misiones | Ya el primer día se avisa de penalización: «A medianoche, lo pendiente se penaliza» o «Si no, -X XP», a quien aún no sabe qué es el XP. | Medio. El primer mensaje del juego es una amenaza. | Confirmado: `derivarHoy.ts:428`, `enJuego.ts`. Solo texto; ver P40. **Matiz:** La nota va bajo toda la lista, fuera del primer pantallazo. | hoy |
| P19 | 04, 01; contraste | Hoy, tarjeta del coach | Muestra «En línea», una burbuja y «Pregunta al coach» también a cuentas gratis. Al tocar sale «EL COACH NO ESTÁ EN TU PLAN». | Medio. Promete y luego cierra la puerta. | Confirmado: `HoyGeneralVista.tsx:238`, sin condición de plan. | hoy |
| P20 | 08, 06, 01, 04 | Hoy, cuenta nueva | Debajo de lo importante siguen bloques que el primer día no aportan: «Ninguna campaña abierta. Abre una y gana su botín», el coach y nueve accesos. | Medio. Menos grave que en la vista antigua, pero sigue siendo largo. | Confirmado en parte: la vista real ya pone la siguiente acción arriba. | hoy |
| P21 | contraste; 08 | Hoy, cabecera | «Base · nivel global» y «NIVEL GLOBAL» salen siempre, aunque no haya modos y «global» no signifique nada. | Medio. Es lo primero que se lee bajo el nombre. | Confirmado: `general.json` `cabecera.subtitulo` y `heroe.eyebrow`. | vocabulario |
| P22 | 07 | Hoy, misiones | El aro de la misión pendiente apenas se ve: gris oscuro sobre negro, unos 1,8:1 (hacen falta 3:1). Es el control principal de la app. | Medio. Quien ve poco no sabe dónde tocar. | Confirmado: `QuestItem.tsx:8` y `Check` en `Row.tsx`. | hoy |
| P23 | 05, 07, 08 | Hoy, cabecera y filas | Rótulos de 10 pt en la cabecera real («NIVEL GLOBAL», «racha», «piedras»), por debajo del mínimo de 11 del sistema, y con tope de crecimiento bajo (1,2 a 1,3). | Medio. La tester 05 no los lee. | Confirmado: `CabeceraGeneral.tsx` (`fs(8.5)`, `fs(9)`; `fs` tiene suelo de 10). | hoy |
| P24 | 05, 01 | Hábitos | «En forja», «Forjado», «Darlo por adquirido», «Si no: Mañana sin postre». | Medio. La idea gusta (21 días y es tuyo); las palabras no. | Confirmado: `habitos.json`. | vocabulario |
| P25 | 05 | Campañas | «Una campaña: tareas, un jefe final y botín» hace pensar en una guerra. «D DE RETRASO» se lee como reproche. | Medio. | Confirmado: `campanas.json`, `general.json`. | vocabulario |
| P26 | 05 | Coach | El coach firma «EL SISTEMA» y el campo dice «Habla con el sistema»: no queda claro si es persona, programa o IA. | Medio. | Confirmado: `coach.json` `mensaje.firma`, `vista.placeholder`, `vista.vacioTitulo`. | vocabulario |
| P27 | 01, 02, 05 | Coach, chat vacío | Los atajos son los mismos para todos: «Dojo de ventas» a una estudiante, «¿Qué entreno?» a quien no entrena. El texto de entrada («decide qué puntúa cada cosa») no dice qué pedirle. | Medio. Solo con coach (Pro o prueba). | Confirmado: `CoachVista.tsx:131`, `coach.json` `atajos`. | vocabulario |
| P28 | 06 | Coach, cabecera | Botones de rayo y libros sin nombre visible. | Bajo. Tienen etiqueta para el lector. | Confirmado: `CoachVista.tsx:197`. | navegacion |
| P29 | contraste; 01, 02 | Modos (onboarding, rueda) | «Todo junto, como hasta ahora» a quien acaba de llegar. «Cada modo añade su arena» no explica nada. | Medio, solo con modos activos. | Confirmado: `modos.json` `descripcion.general`, `onboarding.pista`. | vocabulario |
| P30 | 15 | Onboarding, nombre | En el primer paso con datos aparece «¿Quién te trajo?» con un código de creador, que a casi nadie le aplica. | Medio. Un campo más que no se entiende. | Confirmado: `onboarding.tsx:668`. | onboarding |
| P31 | 06, 14 | Onboarding, objetivo | Una pantalla con frase, interruptor «incluye salud o entrenamiento», cifra y fecha. El interruptor no explica por qué se pregunta. | Medio. | Confirmado, por lectura: `onboarding.json` `objetivo`. | onboarding |
| P32 | 06 | Onboarding, portada | El aviso de que no es un servicio médico es un párrafo justo encima del botón. | Medio. Debe seguir visible antes de datos de salud; solo cambia cómo se presenta. | Confirmado: `DESCARGO_SALUD` en `PortadaArena.tsx`. **Matiz:** Son dos líneas, no un bloque; el problema es su tono gris junto al botón. | onboarding |
| P33 | contraste; 06 | Acceso, tras registrarse | El aviso dice «Ábrelo en este móvil y después entra con tu contraseña», pero el enlace ya abre la sesión. | Bajo. Comprobar en móvil real. | Confirmado por código: `authFlow.ts:225` (`exchangeCodeForSession`). No probado en móvil. | onboarding |
| P34 | 14 | Galería, onboarding | Solo enseña portada, contrato y progreso; sin los pasos reales no se pueden revisar los cambios de este frente. | Bajo para el usuario, útil para trabajar. | Confirmado: `components/onboarding/demo.tsx`. | onboarding |
| P35 | 06 | Acceso | Faltan «Continuar con Apple» y con Google. | Alto en conversión. Apple no lo exige. | Confirmado. | fuera: binario y backend; decisión del dueño |
| P36 | 06 | Acceso | Instalar, crear cuenta, ir al correo y volver. | Alto. | Confirmado. | fuera: configuración de Auth; decisión del dueño |
| P37 | 06, 14 | Acceso | No se puede mirar la app sin cuenta. | Medio. | Confirmado: guarda de `_layout.tsx`. | fuera: requiere sesión anónima en backend |
| P38 | 02, 04, 05, 06, 15 | Hoy, Perfil, onboarding | Elegir cuánto juego se quiere: mucho, poco o ninguno. | Alto. Es la queja más repetida. | Confirmado: no existe. | fuera: decisión del dueño, necesita campo nuevo en el perfil y roza la economía |
| P39 | 01, 02, 04, 05, 09, 15 | Contrato, cierre | Penalizaciones opcionales, día libre o modo viaje. | Alto para perfiles con vida irregular. | Confirmado. | fuera: economía; no se toca |
| P40 | contraste; 04, 15 | Cierre del primer día | El día del alta ya se juzga: en la primera carga el último día procesado es ayer, y lo creado ese día cuenta aunque te registres a las 23:50. | Medio. | Confirmado: `engine.ts:186`, `closing.ts:computeDayClose`. No probado con cuenta real. | fuera: economía; anotado, requiere la skill de juego |
| P41 | 06, 15, 01, 13 | Hoy, coach | Que el coach monte el primer día a quien no paga. | Alto. | Confirmado: el coach es de pago. La versión sin IA va en P05. | fuera: coste de IA y decisión del dueño |
| P42 | 14 | Onboarding, medición | Pantalla legal larga justo tras la portada. | Medio. | Confirmado: `onboarding.tsx:930`. | fuera: su sitio lo fija el dictamen LSSI |
| P43 | 10, 14 | Puertas de edad, salud e IA | Varios permisos encadenados para llegar al coach. La hoja de IA parece cortarse. | Medio. | Confirmado el encadenado; lo de la hoja cortada, sin comprobar en móvil. | fuera: legal |
| P44 | 14, 13, 06 | Onboarding, oferta; Hoy, prueba | Oferta de Pro antes de usar la app y, con `prueba_auto_1011`, otra hoja de bienvenida a Élite al entrar. | Medio. | Confirmado por código: `pasoOferta.ts`, `PruebaAuto.tsx`. | fuera: monetización y valor del interruptor |
| P45 | 01, 02, 03 | Modos | No se distinguen: FOUNDER parece un filtro, WORK abre dinero, IRON repite Gimnasio. | Alto en esos perfiles. | Confirmado en lo que respecta a WORK. | fuera: lo llevan los chats de modos |
| P46 | 01, 02, 03, 04 | Modos y Hoy | Color (oro, azul, naranja, verde) frente a la regla de solo blanco y negro. | Bajo en primer uso. | Confirmado: `acentoRueda` en `tokens.ts`, `general/tema.ts`. Decidido a propósito en `docs/modos/GENERAL.md`. | fuera: decisión del dueño |
| P47 | 14 | Onboarding, prueba e2e | `onboarding-109-body.yaml` no contempla la pantalla de medición, y tocar el onboarding la moverá más. La firma sigue sin comprobarse en iPad. | Alto para enviar a Apple. | Confirmado por fechas y código; no ejecutado. | fuera: sin ejecutar en iPad |
| P48 | 05, 12, 14 | Errores | «EL SISTEMA NO RESPONDE» suena dramático. | Bajo. | Confirmado: `comun.json`. | fuera: rótulo fijado en el sistema de diseño; decisión del dueño |

## Comprobados y descartados

Quejas que no hay que resolver, en su mayoría por venir de la galería.

| Tests | Queja | Resultado |
|---|---|---|
| 01, 08 | El nivel gigante ocupa la pantalla y la misión queda debajo | Artefacto: es `HoyVista`. La vista real tiene cabecera compacta y la siguiente acción justo debajo. |
| 07, 08 | «Más · 6» pequeño y poco claro | Artefacto: no existe en la vista real, que usa «Todo desde aquí». |
| 06 | Cuadrado vacío arriba a la izquierda | Artefacto: `HoyVista`. La vista real lleva ahí la placa con el glifo. |
| 08 | Misiones y orden del día duplicados | No aplica a una cuenta gratis nueva: sin plan no se pinta (`derivarHoy.ts`). |
| 06 | Nivel 3 y 37 XP en un perfil nuevo | Artefacto: la demo fija `xp_total: 420`. |
| 02 | Rival cercano por defecto | Ya resuelto: solo sale con algún amigo visible (`dueloDe`). |
| 02, 03, 05, 06 | Pantalla negra o vacía al cargar | Artefacto probable: la app retiene la pantalla de arranque hasta tener las fuentes (`_layout.tsx:236`). Confirmar en móvil. |
| 01, 02, 06, 07 | Conversación y campo del coach de gimnasio | Artefacto: `coach/demo.tsx`. El problema real de los atajos es P27. |
| 05, 06, 08, 13, 15 | «Te quedan 3 turnos profundos» y selector Estándar/Profundo | Fuera de primer uso: solo con un plan que incluye el modo profundo (`useCoach.ts:577`). |
| 01, 08 | «Mínimo 8 caracteres» | Artefacto: solo en la galería de componentes. |
| 02, 08, 14, 15 | Fechas distintas en la galería | Artefacto: datos de demo. |
| 07 | Selectores sin estado en onboarding | Artefacto probable: `onboarding.tsx:709` ya pasa `selected`. Confirmar con VoiceOver. |
| 08 | Perfil habla de «revisión» | Ya resuelto: commit 7563d30. |

## Fuera del primer uso

Precios y niveles (todos), módulos frente a especialistas (temporizador y series en 03, oposiciones y bloque de foco en 04), nutrición, TCA y XP por peso (11), finanzas y proyección (12, 01, 02), economía a largo plazo y rangos (09), moderación y métricas (14), privacidad de datos y memoria (10), consumo de IA (13), crecimiento: enlace diferido, tarjeta para compartir, duelos y rivales iniciales (15, 06), calendario externo (01, 02), iPad a 744 (08).

## Lo que el rediseño no puede romper

- **Legal:** términos y privacidad al crear cuenta, edad mínima de 16, descargo de que no es un servicio médico visible antes de datos de salud, permiso de salud explícito y separado del de IA, consentimiento de medición (su sitio lo fija el dictamen LSSI, P42), borrado completo y exportación de datos.
- **Datos del onboarding:** `profile_kind`, evento `onboarding_goal`, `commitment_signed` y `sealLetter`, código de creador pendiente (`/c/CODIGO`), modos en `user_modes`.
- **Sistema:** sin guion largo en textos, seis idiomas por i18n, la cuenta es de NIVL y sin dependencias nuevas de Franky. La paleta tiene decisión doble: blanco y negro según `docs/design-v2/SISTEMA.md`, color por modo según `docs/modos/GENERAL.md` (P46). El rediseño debe zanjarlo.
- **Decisiones que son del dueño:** Apple y Google (P35), correo de confirmación (P36), mirar sin cuenta (P37), cuánto juego (P38), coach el primer día a quien no paga (P41), oferta antes de usar la app (P44).

## Ya disponible

`src/components/ayuda` (commit e3c0045): `Pista`, `Termino`, `BotonAyuda` y glosario en seis idiomas, con guía en `docs/primer-uso/AYUDA-CONTEXTUAL.md`. Es independiente del diseño que se elija.

## Capturas

`docs/rediseno-1.1/antes/`, iPhone, datos falsos («Ana» es inventada). El permiso de salud se vio pero no se incluye porque contiene datos del responsable.

- Entrada: 01-crear-cuenta, 02-portada, 03-nombre, 04-para-que-deportista, 05-modos, 06-objetivo, 07-misiones, 08-misiones-con-permiso, 09-firma.
- Primer día: hoy-deportista, hoy-emprendedor, hoy-trabajador, hoy-estudiante, hoy-general, hoy-general-vacio, novedad-modos-general.
- Navegación: rueda-deportista, campanas-vacio.
