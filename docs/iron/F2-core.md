# IRON F2 · Equipo CORE Y CARDIO

Rama `iron-f2/core`, base `modos-f1/motor` @9451103. Contrato: `coordinacion-winter-arc/IRON-F2-CONTRATO.md`. Estilo v2 sin cambios.

## Ejercicios (25)

Archivos en `src/iron/ejercicios/core/<id>.ts`, registrados en `core/index.ts` (los más usados primero en cada bloque); textos en `src/i18n/es/iron-core.json` (namespace `iron-core`). La plancha del prototipo no se duplica: es el sustituto de varios.

| # | id | Nombre | Grupo | Vista | Material | Principal | Nivel |
|---|---|---|---|---|---|---|---|
| 1 | `crunch` | Crunch abdominal | core | lateral | esterilla | recto abdominal | principiante |
| 2 | `plancha-lateral` | Plancha lateral | core | **frontal** | esterilla | oblicuos | intermedio |
| 3 | `dead-bug` | Dead bug | core | lateral | esterilla | transverso, recto | principiante |
| 4 | `bird-dog` | Bird dog | core | lateral | esterilla | transverso, lumbares | principiante |
| 5 | `mountain-climbers` | Mountain climbers | core | lateral | esterilla | recto abdominal | intermedio |
| 6 | `elevaciones-piernas` | Elevaciones de piernas | core | lateral | esterilla | recto abdominal | intermedio |
| 7 | `russian-twist` | Russian twist | core | lateral | esterilla | oblicuos | principiante |
| 8 | `plancha-alta` | Plancha alta (isométrico) | core | lateral | esterilla | recto (serrato secundario) | principiante |
| 9 | `hollow-hold` | Hollow hold (isométrico) | core | lateral | esterilla | recto, transverso | intermedio |
| 10 | `crunch-inverso` | Crunch inverso | core | lateral | esterilla | recto abdominal | principiante |
| 11 | `tijeras-abdominales` | Tijeras abdominales | core | lateral | esterilla | recto abdominal | principiante |
| 12 | `toques-hombro` | Toques de hombro en plancha | core | lateral | esterilla | oblicuos, recto | intermedio |
| 13 | `rueda-abdominal` | Rueda abdominal | core | lateral | rueda, esterilla | recto abdominal | avanzado |
| 14 | `burpees` | Burpees | cardio | lateral | peso corporal | cuádriceps, glúteo | intermedio |
| 15 | `saltos-tijera` | Saltos de tijera | cardio | **frontal** | peso corporal | deltoides lateral, gemelos | principiante |
| 16 | `comba` | Saltar a la comba | cardio | lateral | comba | gemelos | principiante |
| 17 | `rodillas-arriba` | Rodillas arriba | cardio | lateral | peso corporal | cuádriceps, gemelos | principiante |
| 18 | `sentadilla-salto` | Sentadilla con salto | cardio | lateral | peso corporal | cuádriceps, glúteo | intermedio |
| 19 | `talones-gluteo` | Talones al glúteo | cardio | lateral | peso corporal | isquios, gemelos | principiante |
| 20 | `oso` | Paso del oso (2 adelante, 2 atrás) | cardio | lateral | peso corporal | cuádriceps, deltoides ant. | intermedio |
| 21 | `perro-boca-abajo` | Perro boca abajo con pedaleo | movilidad | lateral | esterilla | isquios, gemelos | principiante |
| 22 | `bisagra-cadera` | Bisagra de cadera | movilidad | lateral | peso corporal | isquios | principiante |
| 23 | `flexor-cadera` | Estiramiento de flexores de cadera | movilidad | lateral | esterilla | cuádriceps (psoas en ronda 2) | principiante |
| 24 | `movilidad-tobillo` | Movilidad de tobillo | movilidad | lateral | esterilla | gemelos | principiante |
| 25 | `balanceo-pierna` | Balanceo de pierna | movilidad | lateral | peso corporal | isquios, glúteo | principiante |

Cada uno tiene al menos un sustituto de su mismo grupo (cruzados dentro del grupo; lo comprueba `core.test.ts`).

## Lo que añade al motor (para el merge)

Todo es aditivo; nada existente se reordena.

| Pieza | Cambio |
|---|---|
| `tipos.ts` | `Material` + `esterilla`, `comba`, `rueda`; `Carga` + `comba` (`vueltas`) y `rueda` (`radio`); `Escenario.tipo` admite `esterilla`; `MusculoId` + `transverso`, `serrato`, `cuello`; `GrupoMuscular` + `cardio`, `movilidad` (grupos de entrega sin músculo propio); `ClaveI18n` admite `iron-<grupo>:`; **`Pose.punto`**: el ancla puede moverse (saltos). |
| `esqueleto.ts` / `interpolar.ts` | `AngulosPose.punto` opcional; se interpola solo si alguna pose lo da. |
| `dibujo.ts` | `capasDe(..., cara, fase)` (fase del ciclo para la comba); ganchos a `material/`. |
| `material/` | `trazo.ts` (primitivas), `esterilla.ts`, `comba.ts`, `rueda.ts`. Son `.ts` (geometría worklet, sin JSX), no `.tsx`. |
| `musculos.ts` | Los 3 músculos al final, con comentario `// core`; formas lateral y frontal. `GRUPOS` + cardio y movilidad. Los tres van al grupo core (el cuello no tiene grupo propio). |
| `components/iron/texto.ts` | `nombreIron(seccion, id)`: busca el nombre de músculo, grupo o material en `iron` y en cualquier `iron-<grupo>`. `DemoIron` y `FichaIron` lo usan (antes `t('iron:musculo.x')`, que no conoce los nombres nuevos). Los otros equipos pueden poner sus nombres en su namespace. |
| `esquema.test.ts` | Lee las carpetas de grupo, los catálogos `iron*.json`, acepta `iron-<grupo>:` y salta la regla «grupo = el del primer principal» en cardio y movilidad. «El prototipo tiene los 5» pasa a «los 5 primeros». |
| `sustituir.test.ts` | «Con los 5 del prototipo no hay dos del mismo grupo» se mide sobre los 5 (ahora hay más core). |
| `ejercicios/index.ts` | `...EJERCICIOS_CORE` tras los 5 del prototipo. |
| `scripts/iron/grabar.mjs` | `--solo a,b,c` acepta varios ids. |

Choques previsibles con los otros equipos: las mismas líneas de `tipos.ts`, `musculos.ts`, `esquema.test.ts`, `index.ts` y `recursos.ts` (cada uno añade su grupo al final). Son triviales; el único punto de diseño es `nombreIron`, que conviene que adopten todos.

## Tests

`src/iron/__tests__/core.test.ts`, cada 25 ms de todo el ciclo:

- Todos: nada atraviesa el suelo, el brazo de delante no pasa por encima de la cabeza, el ciclo cierra y el principal se dibuja en la pose de la ficha.
- Apoyos que no resbalan (cadera, hombro, manos, rodilla o tobillo según el ancla), pies planos o en punta donde toca, recorridos (crunch 18 a 30°, elevaciones 10 a 80°+, bisagra con tronco 30 a 50° y rodillas ≤ 20°…), contrarios en dead bug, bird dog y oso, línea recta en planchas, rueda siempre en el suelo, comba bajo los pies en el aire, aterrizajes con rodillas dobladas.
- Material: esterilla en la capa de fondo; el lazo de la comba recorre abajo, detrás, arriba y delante.

`npx tsc --noEmit`, `npx eslint .` y `npx jest` en verde (2319 tests).

## QA visual

GIF, MP4, PNG de la pose clave y ficha de cada ejercicio en `coordinacion-winter-arc/iron-catalogo/core/`, tabla en `QA.md`. Grabado con exportación propia (`web-core`, `--clear`) y puerto 8105, comprobado que no es la pantalla de Expo.

## Ronda 2 (material o músculos de otros equipos)

| Qué | Por qué espera | Equipo |
|---|---|---|
| Psoas como principal o secundario en elevaciones de piernas, crunch inverso, rodillas arriba, mountain climbers y flexores de cadera | El músculo es del equipo pierna | pierna |
| Sóleo en comba y movilidad de tobillo; glúteo medio en plancha lateral y saltos de tijera | Músculos de pierna | pierna |
| Crunch en polea, leñador (woodchop) con polea | Polea | espalda |
| Pallof press | Banda o polea | hombro / espalda |
| Elevaciones de piernas colgado, rodillas al pecho colgado | Barra de dominadas | espalda |
| Rodillas al pecho en paralelas | Paralelas | pecho |
| Abdominal en banco declinado, dragon flag | Banco declinado | pecho |
| Saltos al cajón, step-ups | Cajón | pierna |
| Swing con kettlebell | Kettlebell | pierna |
| Gato-camello, inchworm, giros torácicos | Necesitan columna articulada (el tronco es rígido) o muchos cuadros de manos | motor |

## Riesgos

- **Tronco rígido.** El crunch se dibuja como un giro desde la cadera (la zona lumbar se despega algo); no hay arqueo ni redondeo de columna. Gato-camello queda fuera por eso.
- **Giros fuera del plano.** El russian twist de perfil no enseña la rotación: al lado de la cámara los brazos bajan enteros y al otro, en escorzo. Un motor 3D o una vista en 3/4 lo arreglaría.
- **Ocultaciones aceptadas.** Con el muslo flexionado o el brazo junto al tronco, parte del abdomen u oblicuo queda tapado en algunos instantes; la ficha usa siempre un instante con el principal visible (revisado una a una). En hollow hold los brazos van al techo (con los brazos sobre la cabeza el de cerca tapaba la cara), y en bird dog el brazo estirado queda unos 15° bajo la horizontal por lo mismo.
- **Contactos interpolados.** En despegues y aterrizajes el pie gira sobre la punta con varias poses intermedias; la planta puede bajar hasta 0,5 unidades (menos de 1 cm) entre poses. Burpees: la fase en el suelo va cuadro a cuadro (IK) para que las manos no se muevan.
- **Proporciones.** El brazo del maniquí es largo respecto al muslo: a cuatro patas el tronco queda a unos 18° (bird dog) y los codos algo flexionados.
- **Revisión de técnica** por alguien que entrene, pendiente como en F1.

## Horas

≈ 10 h de chat: 1,5 h motor y material (ancla móvil, comba, esterilla, rueda, nombres), 6 h los 25 ejercicios (IK y ajuste visual, los de salto y los burpees los más caros), 1,5 h tests y 1 h grabación y QA.
