# IRON fase 2 · Equipo ESPALDA

Rama `iron-f2/espalda`, sobre `modos-f1/motor` @9451103. Contrato: `coordinacion-winter-arc/IRON-F2-CONTRATO.md`. Estilo v2 sin cambios.

## Ejercicios (24)

En el orden del catálogo (`src/iron/ejercicios/espalda/index.ts`), los más usados primero. Textos en `src/i18n/es/iron-espalda.json` (namespace `iron-espalda`).

| id | Nombre | Material | Principal | Nivel |
|---|---|---|---|---|
| `dominada` | Dominada | barra fija | dorsal | intermedio |
| `dominada-supina` | Dominada supina | barra fija | dorsal, bíceps | intermedio |
| `dominada-neutra` | Dominada con agarre neutro | barra fija | dorsal | intermedio |
| `dominada-negativa` | Dominada negativa | barra fija | dorsal | principiante |
| `dominada-escapular` | Dominada escapular | barra fija | dorsal, espalda alta | principiante |
| `remo-invertido` | Remo invertido (barra baja o mesa firme) | barra fija | dorsal, espalda alta | principiante |
| `jalon-pecho` | Jalón al pecho | polea, máquina | dorsal | principiante |
| `jalon-supino` | Jalón supino | polea, máquina | dorsal | principiante |
| `jalon-neutro` | Jalón con triángulo | polea, máquina | dorsal | principiante |
| `pullover-polea` | Pullover en polea alta | polea | dorsal | principiante |
| `remo-barra` | Remo con barra | barra | dorsal, espalda alta | intermedio |
| `remo-barra-supino` | Remo con barra supino | barra | dorsal | intermedio |
| `remo-mancuernas` | Remo con mancuernas | mancuerna | dorsal | principiante |
| `remo-polea-sentado` | Remo en polea sentado (triángulo) | polea | dorsal, espalda alta | principiante |
| `remo-polea-abierto` | Remo en polea con agarre abierto | polea | espalda alta, dorsal | intermedio |
| `remo-polea-una-mano` | Remo en polea a una mano | polea | dorsal | principiante |
| `remo-maquina` | Remo en máquina (palanca, apoyo de pecho) | máquina | espalda alta, dorsal | principiante |
| `face-pull` | Face pull | polea | espalda alta, deltoides posterior | principiante |
| `peso-muerto` | Peso muerto | barra | lumbares, glúteo, isquios | intermedio |
| `peso-muerto-sumo` | Peso muerto sumo | barra | lumbares, glúteo, aductores | intermedio |
| `peso-muerto-mancuernas` | Peso muerto con mancuernas | mancuerna | lumbares, glúteo, isquios | principiante |
| `hiperextension` | Hiperextensiones (banco a 45°) | máquina | lumbares, glúteo | principiante |
| `superman` | Superman | peso corporal | lumbares | principiante |
| `pullover-mancuerna` | Pullover con mancuerna | mancuerna, banco | dorsal | intermedio |

Sin gimnasio: las cinco dominadas y el remo invertido (barra fija o mesa), remo con mancuernas, peso muerto con mancuernas y superman. Todos llevan sustitutos escritos a mano dentro del grupo (con `remo-mancuerna` del prototipo); «Sustituir» respeta el material (test: sin barra fija la dominada pasa al jalón; con solo mancuernas el peso muerto pasa al de mancuernas).

**Quitados por duplicar a otro equipo** (mismo id en su worktree): `encogimientos-barra` y `encogimientos-mancuerna` (los tiene hombro), `peso-muerto-rumano` y `buenos-dias` (los tiene pierna). Ojo al integrar: los encogimientos tienen el trapecio de principal, así que su `grupo` sale `espalda` aunque vivan en la carpeta de hombro. `face-pull` (polea, mío) no choca con `face-pull-banda` de hombro.

## Material propio (`src/iron/material/`)

| Pieza | Archivo | Cómo funciona |
|---|---|---|
| Polea (torre) | `polea.ts` | Escenario `polea`: poste, pila de placas y rueda; con `brazo`, polea alta colgada de un brazo (jalón). |
| Cable y agarres | `polea.ts` | Carga `polea`: el cable es una recta del vértice del agarre a la rueda, **recalculada en cada cuadro** desde el esqueleto. Agarres: `asa` (D), `cuerda` (cabos y nudo), `barra` (de punta; `eje` la saca en 3/4) y `triangulo`. |
| Barra de dominadas | `barra-dominadas.ts` | Escenario `barra_dominadas`: barra de punta (y tramo en 3/4) con soporte de `pared` o `poste`; sirve también de barra baja para el remo invertido. Material nuevo `barra_fija` («Barra fija»). |
| Asiento de máquina | `maquina-espalda.ts` | Escenario `asiento`: sillín y columna, con rodillo de muslos (jalón), apoyo de pecho (remo en máquina), plataforma de pies (remo en polea) y poste con eje de palanca. |
| Palanca | `maquina-espalda.ts` | Carga `palanca`: brazo de la máquina del eje a la mano, recalculado en cada cuadro; la mano describe un arco (lo mide un test). |
| Banco de hiperextensiones | `maquina-espalda.ts` | Escenario `hiperextension`: almohadilla a 45°, bastidor y rodillo de tobillos. Nadie lo tenía en su columna y es de espalda: lo dibujo yo (material `maquina`). |

Despacho en `material/espalda.ts` (tipos `EscenarioEspalda` y `CargaEspalda`). Trazos propios en `trazo-espalda.ts` para no crear un ciclo con `dibujo.ts`. Todo `'worklet'`. El contrato decía `material/<pieza>.tsx`; son `.ts` porque no llevan JSX (devuelven el `d` de las capas, como el resto del motor).

## Lo que toqué fuera de mis archivos (para el merge)

Todo añadido al final o en una sola línea, sin reordenar:

- `src/iron/tipos.ts`: `ClaveI18n` admite `iron-<grupo>:…`; `Material` + `'barra_fija'`; `Carga` + `| CargaEspalda`; `escenario` de `Ejercicio` acepta `Escenario | EscenarioEspalda`; import de tipos de `material/espalda`.
- `src/iron/dibujo.ts`: import y tres ganchos de una línea (escenario, carga, `centroCarga`); `escenario` y `capasDe` tipan la lista como `Ejercicio['escenario']`.
- `src/iron/ejercicios/index.ts`: `...ESPALDA` al final de `EJERCICIOS`.
- `src/i18n/recursos.ts`: namespace `'iron-espalda'`. `src/i18n/es/iron.json`: `material.barra_fija`.
- Tests compartidos: `esquema.test.ts` (recorre las carpetas de grupo y salta `index.ts` y los `_*.ts`; resuelve textos de cualquier `iron-<grupo>`; los 5 del prototipo van delante; material de polea, palanca y barra fija), `sustituir.test.ts` (el test «no inventa» mira solo los 5 del prototipo), `biomecanica.test.ts` (el banco se lee con un `as Escenario`).

Los demás equipos habrán tocado las mismas líneas: los conflictos son de «añadir al lado».

## Cómo están escritas las poses

Ayudas del grupo en archivos que empiezan por `_` (no son ejercicios): `_pose.ts` (ángulos absolutos a articulación, IK del brazo hasta la barra o el cable, `bisagra` que despeja las piernas para que la barra caiga sobre el medio del pie, `sobreTronco`), `_colgado.ts` (dominadas: el ancla es el puño en la barra), `_sentado.ts` (jalones y remos sentados: ancla en la cadera, piernas en absoluto), `_remo.ts` y `_peso-muerto.ts`. Se calculan una vez al cargar el catálogo; el motor solo recibe números.

## Tests (`src/iron/__tests__/espalda.test.ts`)

Cada 25 ms de todo el ciclo: disco que no tapa cabeza ni torso ni entra en el suelo; cable que no cruza la cabeza; dominadas con las manos fijas, tronco ±20°, barbilla sobre la barra con la cabeza detrás y brazos estirados abajo; remo invertido recto con manos en la barra y talones en el suelo; jalones con el tronco entre 90° y 112° y la barra al pecho delante de la cara; remos con el codo detrás de la espalda arriba, la carga sobre el medio del pie y la mano de la máquina en su arco; pullovers con el codo fijo; pesos muertos con la barra sobre el medio del pie (±3), salida del suelo con la cadera sobre la rodilla y bloqueo de pie; hiperextensión sin pasar de la línea; superman con elevación pequeña. `tsc`, `eslint` y `jest src/iron src/i18n` en verde (656 tests).

## QA visual

GIF, MP4, PNG de la pose clave y ficha de cada uno en `coordinacion-winter-arc/iron-catalogo/espalda/`, con la tabla en `QA.md`. Para grabar hubo que exportar desde una copia fuera de `.claude/` (Expo Router no encuentra `src/app` si la ruta tiene una carpeta con punto: salía «Welcome to Expo»). Detalle en `QA.md`.

## Ronda 2 (necesitan material de otro equipo)

| Ejercicio | Falta | Dueño |
|---|---|---|
| Dominada asistida con banda | banda elástica | hombro |
| Separación de banda (pull apart) y remo con banda en casa | banda elástica | hombro |
| Remo con mancuernas apoyado en banco inclinado | banco inclinado | pecho |
| Rack pull (peso muerto desde soportes) | rack | pierna |
| Remo con kettlebell / remo gorila | kettlebell | pierna |
| Dominada negativa subiendo desde cajón (hoy se dibuja con salto) | cajón | pierna |
| Superman y bird dog sobre esterilla | esterilla | core (bird dog ya es suyo) |
| Remo en T (landmine) y dominada asistida en máquina | sin dueño en el contrato | coordinador |

## Riesgos

- **2D:** los agarres anchos (dominada, jalón al pecho, remo abierto) y el face pull sacan el brazo del plano; van con escorzo y el antebrazo se inclina a medio tirón (hasta 40° en el test). En el face pull el brazo pasa por delante de la cara al final, como en una foto de perfil; la ficha enseña el instante anterior.
- **Escápula:** el motor no la tiene. La dominada escapular baja el hombro acortando el brazo; por eso los encogimientos (de hombro) tendrán el mismo problema.
- **Remo con barra:** con las proporciones del motor, el tronco a 50° y la barra sobre el pie piden unas rodillas bastante dobladas (≈ 49°). El Pendlay (barra al suelo con el tronco paralelo) no cabía sin que el disco tapara el torso: descartado.
- **Proporciones del pie:** en el peso muerto la barra roza la espinilla en 2D (el medio del pie del motor está a 3,75 del tobillo).
- Falta la revisión de técnica de alguien que entrene y medir el rendimiento en un Android de gama baja (polea y palanca añaden poco: van en las capas de carga y escenario que ya existían).

## Horas

Unas 7 h de chat: 2 h de material y ganchos del motor, 3,5 h de poses (26 escritas, 24 se quedan), 1 h de tests y 0,5 h de QA y grabación.
