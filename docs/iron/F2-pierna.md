# IRON fase 2 · Equipo PIERNA: catálogo de pierna y glúteo

Rama `iron-f2/pierna`, sobre `modos-f1/motor` @9451103 (contrato `coordinacion-winter-arc/IRON-F2-CONTRATO.md`). Motor y estilo v2 sin cambios: solo se añade material, músculos y datos.

## Lo entregado

- **26 ejercicios** en `src/iron/ejercicios/pierna/` (uno por archivo) con su `index.ts` (`EJERCICIOS_PIERNA`), enganchado al final de `EJERCICIOS`. La sentadilla con barra del prototipo no se duplica (es su sustituta natural).
- **Textos** en `src/i18n/es/iron-pierna.json` (namespace `iron-pierna`, registrado en `recursos.ts`): nombre, 2 a 4 cues y errores de cada uno, sin «—» ni «–».
- **Material propio** en `src/iron/material/` (worklets puros, el mismo estilo que `dibujo.ts`): rack, cajón, kettlebell, prensa inclinada, extensión de cuádriceps, curl femoral tumbado y máquina de abductores.
- **Músculos propios** al final de `musculos.ts` (forma lateral y frontal): sóleo, glúteo medio (abductores) y psoas. El tibial anterior ya existía y se reutiliza (elevación de tibiales).
- **Tests de biomecánica** en `src/iron/__tests__/pierna.test.ts` (39 tests, medidos cada 25 ms de todo el ciclo) además de los generales de `esquema.test.ts` y `biomecanica.test.ts`, que ya recorren el catálogo nuevo.
- **QA visual**: GIF, MP4, PNG de la pose clave y ficha de cada ejercicio en `coordinacion-winter-arc/iron-catalogo/pierna/`, con la tabla `QA.md`.

## Ejercicios

Los más usados primero; después los de casa y sin material.

| # | id | Nombre | Material | Principal | Lo que comprueba el test |
|---|---|---|---|---|---|
| 1 | `sentadilla-frontal` | Sentadilla frontal | barra, rack | cuádriceps | barra sobre el medio del pie (±2), tronco ≥ 60°, codos altos, seguros bajo la barra |
| 2 | `sentadilla-goblet` | Sentadilla goblet | kettlebell | cuádriceps, glúteo | kettlebell sobre el medio del pie (±3) y pegada al pecho |
| 3 | `prensa` | Prensa de piernas | máquina | cuádriceps, glúteo | espalda quieta, tobillo por el raíl a 45° (±0,6), rodillas de 10 a ~90°, cadera ≤ 130° |
| 4 | `sentadilla-bulgara` | Sentadilla búlgara | mancuerna, banco | cuádriceps, glúteo | dedos de atrás quietos en el banco, rodilla de atrás abajo, brazos verticales |
| 5 | `zancada-atras-mancuerna` | Zancada atrás | mancuerna | cuádriceps, glúteo | pie de delante quieto, punta de atrás quieta con el paso dado, nada atraviesa el suelo |
| 6 | `peso-muerto-rumano` | Peso muerto rumano | barra | isquios, glúteo | barra sobre el medio del pie rozando la pierna, espinillas verticales, cadera atrás |
| 7 | `hip-thrust` | Hip thrust | barra, banco | glúteo | espalda alta quieta en el borde del banco, arriba en línea con espinilla vertical |
| 8 | `extension-cuadriceps` | Extensión de cuádriceps | máquina | cuádriceps | rodilla en el eje (±0,5), de 95° a ≤ 8° |
| 9 | `curl-femoral-tumbado` | Curl femoral tumbado | máquina | isquios | rodilla en el eje, de ≤ 8° a ≥ 110°, cadera en el banco |
| 10 | `gemelos-de-pie` | Gemelos de pie | mancuerna, cajón | gemelos | solo se mueve el tobillo (+15 a -30°), la punta en el borde del cajón |
| 11 | `gemelos-sentado` | Gemelos sentado | mancuerna, banco, cajón | sóleo | punta quieta en el escalón, rodilla 90-105°, mancuerna sobre la rodilla |
| 12 | `step-up-cajon` | Subida al cajón | cajón | cuádriceps, glúteo | pie plano en el cajón, arriba de pie con la rodilla lejana alta, el pie libre no atraviesa el cajón |
| 13 | `swing-kettlebell` | Swing con kettlebell | kettlebell | glúteo, isquios | bisagra (rodillas ≤ 25°), arriba bloqueado con la kettlebell al pecho, atrás tras las rodillas |
| 14 | `peso-muerto-rumano-mancuerna` | Rumano con mancuernas | mancuerna | isquios, glúteo | igual que con barra |
| 15 | `peso-muerto-una-pierna` | Peso muerto a una pierna | mancuerna | glúteo, isquios | pierna libre en la línea del tronco y sin tocar el suelo, brazo vertical |
| 16 | `buenos-dias` | Buenos días | barra, rack | isquios | espalda neutra, rodillas ≤ 25°, barra cerca del medio del pie (±5) |
| 17 | `abduccion-maquina` | Abducción en máquina (vista frontal) | máquina | glúteo medio | cadera quieta, apertura simétrica, espinillas colgando |
| 18 | `sentadilla-peso-corporal` | Sentadilla sin peso | peso corporal | cuádriceps, glúteo | pies planos, hombros sobre el pie, brazos horizontales |
| 19 | `sentadilla-cajon` | Sentadilla al cajón | cajón | glúteo, cuádriceps | los glúteos tocan el cajón sin atravesarlo, tobillo ≤ 32° |
| 20 | `zancada-estatica` | Zancada estática | peso corporal | cuádriceps, glúteo | los dos pies quietos, rodilla de atrás bajo la cadera, tronco ≥ 80° |
| 21 | `puente-gluteo` | Puente de glúteo | peso corporal | glúteo | espalda alta quieta en el suelo, arriba en línea, glúteos y cabeza sin atravesar el suelo |
| 22 | `puente-gluteo-una-pierna` | Puente a una pierna | peso corporal | glúteo | igual, con la pierna libre estirada y paralela |
| 23 | `patada-gluteo` | Patada de glúteo | peso corporal | glúteo | tronco quieto, rodilla a ~90°, extensión de cadera ≤ 30° |
| 24 | `abduccion-tumbado` | Abducción tumbado de lado (vista frontal) | peso corporal | glúteo medio | tronco y pierna de abajo quietos, la de arriba recta a 35-45° |
| 25 | `curl-nordico` | Curl nórdico | peso corporal | isquios | rodillas fijas, cuerpo recto, bajada más del doble de larga que la subida |
| 26 | `elevacion-tibial` | Elevación de tibiales | banco | tibial anterior | talón quieto, espinilla vertical, de 0 a ≥ 25° |

Todos llevan sustitutos dentro del grupo (cruzados: gimnasio ↔ casa, máquina ↔ peso libre).

## Cómo se han hecho las poses

Como en la F1: los ángulos se despejan con un script (IK de dos eslabones de `autor.ts`) a partir de lo que define la técnica y se guardan como números. Las restricciones que más se han usado:

- **Carga sobre el medio del pie** (sentadillas, rumano, buenos días): se busca la posición de la cadera que pone la barra o la kettlebell encima del medio del pie y que la barra roce la pierna.
- **Dos apoyos fijos** (búlgara, zancadas, hip thrust, puentes, prensa, gemelos sentado, tibiales): uno es el ancla y el otro se despeja en cada pose (la punta del pie de atrás, la espalda alta en el borde del banco, el tobillo en el raíl, el talón o la punta en el suelo). Entre poses el motor interpola ángulos, así que el segundo apoyo se mueve un poco; donde se notaba se han añadido poses intermedias (la zancada atrás tiene 12) y el test mide el error en todo el ciclo.
- **Máquinas de palanca**: el eje de la máquina coincide con la rodilla (el muslo no se mueve) y el rodillo va con la espinilla.

## Cambios en archivos compartidos (todos al final y marcados `// pierna`)

Para los merges con los demás equipos:

- `src/iron/tipos.ts`: `ClaveI18n` admite `iron-<grupo>:`; `Material` + `rack`, `cajon`; `Carga` + `CargaPierna` (kettlebell, prensa, palanca, abductora); `Escenario.tipo` + cajón, rack, prensa, extensión, curl femoral y abductora, y `seguro?` (rack); `MusculoId` + `soleo`, `gluteo_medio`, `psoas`.
- `src/iron/musculos.ts`: los tres músculos al final de cada lista.
- `src/iron/dibujo.ts`: tres enganches de una línea (`escenario`, `cargaLado`, `centroCarga`) hacia `src/iron/material/pierna.ts`. Otro equipo con material que se mueve puede seguir el mismo patrón con su archivo.
- `src/i18n/es/iron.json`: nombres de los músculos y materiales nuevos (los componentes y el test los leen en `iron:musculo.*` e `iron:material.*`, así que no pueden ir en `iron-pierna`).
- `src/iron/ejercicios/index.ts`: `...EJERCICIOS_PIERNA` al final.
- `src/i18n/recursos.ts`: `'iron-pierna': ironPierna`.
- Tests: `esquema.test.ts` busca ejercicios en las carpetas de grupo, resuelve textos de `iron-<grupo>` y lista los materiales nuevos; «el prototipo tiene los 5» pasa a «los 5 primeros»; en `sustituir.test.ts`, «no inventa» se mide sobre los 5 del prototipo. Los demás equipos necesitan exactamente estos mismos cambios: conviene que el integrador tome los de esta rama y descarte los duplicados.

## Ronda 2 (material de otros equipos)

| Ejercicio | Falta | Equipo |
|---|---|---|
| Abducción de pie y paseo lateral con banda | banda elástica | hombro |
| Patada de glúteo y pull-through en polea | polea | espalda |
| Puentes, patada y abducción sobre esterilla (hoy en el suelo) | esterilla | core |
| Elevación de rodillas colgado (psoas como principal) | barra de dominadas | espalda (y core) |
| Curl nórdico con anclaje de talones dibujado (banco de nórdicos o compañero) | anclaje | core (peso corporal en casa) |

Pendientes que no son de material:

- **Salto al cajón**: el cuerpo entero sale del suelo y el motor no traslada el ancla en el tiempo. Necesita un cambio pequeño del motor (desplazamiento del ancla por pose).
- **Sentadilla sumo y zancada lateral**: piden vista frontal con los muslos en escorzo, como la abducción en máquina; se pueden hacer igual (≈ 1,5 h cada uno).
- **Peso muerto convencional y sumo desde el suelo**: no estaban en el encargo de pierna; decidir si son de pierna o de espalda.
- Curl femoral sentado, sentadilla hack, gemelos en prensa: variantes de material ya dibujado (≈ 45 min cada una).

## Riesgos

- **Archivos compartidos**: ver arriba; los conflictos son triviales pero son seis equipos tocando las mismas líneas (`tipos.ts`, `musculos.ts`, `iron.json`, `index.ts`, los dos tests).
- **El contrato pide `src/iron/material/<pieza>.tsx`**: aquí son `.ts` porque son worklets puros sin JSX (los llama `dibujo.ts` en el hilo de la interfaz, como el resto del motor).
- **Apoyos interpolados**: los segundos apoyos (punta de atrás, espalda en el banco) se mueven hasta 0,5 a 1,5 unidades entre poses. No se ve en el GIF, pero no es exacto.
- **Gemelos de pie**: el pie gira sobre la articulación «punta» del motor, que está 4 unidades por encima de la planta; la planta se desliza unas 3 unidades a lo largo del ciclo (en el test, ±1,6).
- **Sentadilla búlgara con los dedos apoyados** (no el empeine): con el empeine en el banco el tobillo pasaría del límite anatómico del esquema (-50°). Es una variante válida y habitual.
- **Escorzos fuertes**: los brazos de la sentadilla frontal (antebrazo al 31 %) y los muslos de la abducción en máquina; se leen bien en la captura, pero conviene que lo mire alguien que entrene.
- **Swing**: atrás la kettlebell se pinta delante de la pierna cercana (en 2D no puede pasar «entre» las piernas sin una ranura nueva).
- **Curl nórdico**: el brillo marca la bajada (excéntrica), que es donde está el trabajo; en el resto del catálogo marca la concéntrica.
- **Tumbado en vista frontal** (abducción tumbado): el pie frontal del motor se dibuja siempre «de pie», así que los pies se ven como un bloque al final de la pierna.
- Falta la revisión de técnica de alguien que entrene (como en la F1).

## Horas

| Parte | Horas |
|---|---|
| Lectura del motor y del contrato | 0,5 |
| Material (7 piezas) y músculos | 2 |
| 26 ejercicios (cálculo de poses, archivo y vista previa) | 6 |
| Textos y tests | 1,5 |
| QA visual (grabación, revisión y ajustes) | 1,5 |
| Documento | 0,5 |
| **Total** | **≈ 12 h** |

En línea con la estimación del motor (26 ejercicios con 4 materiales nuevos de máquina, kettlebell, cajón y rack ≈ 30 h de «tiempo de chat» según la tabla de F1-motor.md; las ayudas de cálculo y la vista previa rápida en Node lo han reducido).

## Cómo se prueba

```bash
npx tsc --noEmit && npx eslint . && npx jest src/iron
```

En la web de desarrollo: `/kit/iron?ejercicio=hip-thrust` (o cualquier id de la tabla), `&ficha=1` para la ficha.

Grabación del QA (para no pisarse con otros equipos): exportar con `--clear` a una carpeta propia (`web-pierna`), servirla en un puerto propio (8104) con un servidor que devuelva `index.html` en cualquier ruta, y `node scripts/iron/grabar.mjs --url http://localhost:8104 --salida ../coordinacion-winter-arc/iron-catalogo/pierna --solo <id>` por ejercicio. Comprobar que el PNG es el maniquí y no la pantalla de bienvenida de Expo.
