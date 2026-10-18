# IRON · Ronda 3: ejercicios que necesitan material sin dueño

Integración de la fase 2, 18/10/2026. La ronda 2 (material de otro equipo) se hizo en la integración, al menos los más usados (ver `docs/iron/F2-INTEGRACION.md`). Lo que sigue NO se puede dibujar todavía: necesita una pieza que ningún equipo tenía en su columna del contrato (`coordinacion-winter-arc/IRON-F2-CONTRATO.md`). Hace falta que el coordinador asigne cada pieza a un equipo.

## Material sin dueño

| Pieza que falta | Ejercicios que la esperan | Pedido por | Propuesta de dueño | Notas para dibujarla |
|---|---|---|---|---|
| Banco predicador (Scott) | curl predicador con barra Z, curl predicador con mancuerna | brazos | brazos (se ofreció) | Escenario fijo: asiento y atril inclinado a 45°; el brazo apoyado en el atril es el ancla (como el curl concentrado sobre el muslo). |
| Rodillo de muñeca | enrollar el rodillo | brazos | brazos | Carga en el agarre: tubo de punta y cuerda con disco que sube; la muñeca ya existe en el motor (`Pose.muneca`). |
| Soporte de landmine (barra anclada al suelo) | remo en T, press landmine (hombro y pecho), sentadilla landmine | espalda, hombro, pecho | espalda | Carga nueva: barra que gira en un pivote del suelo, recalculada en cada cuadro (como la palanca de `material/maquina-espalda.ts`, con el eje en el suelo). |
| Máquina de remo en T con apoyo de pecho | remo en T en máquina | espalda | espalda | Igual que el remo en máquina (`asiento` con apoyo de pecho y `palanca`). |
| Máquina de dominadas asistidas | dominada asistida en máquina | espalda | espalda | Plataforma de rodillas que sube con el cuerpo (palanca por debajo). |
| Máquinas de press (pecho plano, inclinado y de hombro) | press de pecho en máquina, press inclinado en máquina, press de hombro en máquina | pecho, hombro | pecho (pecho) y hombro (hombro) | Asiento con respaldo (ya hay `asiento` en espalda) y una palanca con asas que va de la mano a un eje detrás (la `palanca` de espalda sirve con otro pivote). |
| Multipower (Smith) | press de banca y press inclinado en multipower, encogimientos en Smith, sentadilla en Smith | pecho, hombro | pierna (dueño del rack) | Dos guías verticales y la barra que solo sube y baja: el test es que la barra se mueve en vertical (±0,5). |
| Cinturón de lastre | fondos con lastre, dominadas con lastre | pecho | pecho | Carga en la cadera: cadena y disco que cuelgan entre las piernas (punto `cadera`, no `agarre`). |
| Anillas y TRX | flexiones en anillas, remo en TRX, fondos en anillas | pecho | espalda (dueño de la barra fija; las anillas cuelgan de ella) | Escenario: correas desde un punto alto hasta el agarre, recalculadas como el cable de la polea. |
| Pared (escenario) | flexiones en la pared, flexiones en pino contra la pared, pino | pecho, hombro | core (peso corporal en casa) | Un rectángulo vertical en el fondo; el ancla en la mano o en los pies apoyados. |
| Disco suelto | Svend press, giros rusos con disco | pecho, core | pecho | Carga en el agarre: el disco de canto o de frente según la vista. |
| Anclaje de talones (banco de nórdicos o compañero) | curl nórdico con anclaje dibujado | pierna | pierna | Hoy el curl nórdico existe sin el anclaje dibujado; es un rodillo fijo sobre los tobillos. |
| Máquina de encogimientos | encogimientos en máquina | hombro | espalda (los encogimientos ya son de espalda) | Brazos de palanca a los lados; vale el truco del escorzo de los encogimientos. |

## No es material: lo que necesita el motor

Ninguno de estos depende de una pieza; dependen de una capacidad del motor o de una cámara.

| Qué | Por qué espera | Estado |
|---|---|---|
| Salto al cajón, saltos al cajón de core | El cuerpo sale del suelo | El motor ya lo permite: core añadió `Pose.punto` (el ancla se mueve por pose). Se puede hacer ya con el cajón de pierna; no se hizo en la integración por tiempo. |
| Gato-camello, inchworm, giros torácicos | El tronco es rígido (sin columna articulada) | Pide un tronco en dos segmentos. Es el cambio más grande del motor. |
| Pullover con mancuerna de perfil (pecho), flexiones arquero, sentadilla sumo, zancada lateral | Movimiento fuera del plano | Vista frontal; la técnica de la abducción en máquina (pierna) y del pec deck (pecho) sirve. |
| Escápula (retracción en remos, dominada escapular, encogimientos) | El motor no tiene ángulo de elevación del hombro | Hoy se resuelve con escorzo; un ángulo de escápula en el esqueleto lo arreglaría para todos. |
