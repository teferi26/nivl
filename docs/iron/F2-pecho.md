# IRON F2 · Equipo PECHO: catálogo de ejercicios de pecho

Rama `iron-f2/pecho`, base `modos-f1/motor` @9451103. Estilo v2 sin cambios. Contrato: `coordinacion-winter-arc/IRON-F2-CONTRATO.md`.

## Qué hay

**25 ejercicios de pecho**: los 24 nuevos de esta rama más el press de banca del prototipo. Están en `src/iron/ejercicios/pecho/`, uno por archivo, con su `index.ts` (`PECHO`), que `../index.ts` añade detrás de los 5 del prototipo.

| # | Id | Material | Principal | Nivel | Vista |
|---|---|---|---|---|---|
| 1 | `press-inclinado-barra` | barra, banco inclinado | pectoral superior | intermedio | lateral |
| 2 | `press-declinado-barra` | barra, banco declinado | pectoral | intermedio | lateral |
| 3 | `press-banca-cerrado` | barra, banco | pectoral + tríceps | intermedio | lateral |
| 4 | `press-suelo-barra` | barra | pectoral | intermedio | lateral |
| 5 | `press-banca-mancuerna` | mancuerna, banco | pectoral | principiante | lateral |
| 6 | `press-inclinado-mancuerna` | mancuerna, banco inclinado | pectoral superior | principiante | lateral |
| 7 | `press-declinado-mancuerna` | mancuerna, banco declinado | pectoral | intermedio | lateral |
| 8 | `press-suelo-mancuerna` | mancuerna (casa) | pectoral | principiante | lateral |
| 9 | `press-squeeze-mancuerna` | mancuerna, banco | pectoral | intermedio | lateral |
| 10 | `aperturas-mancuerna` | mancuerna, banco | pectoral | intermedio | lateral |
| 11 | `aperturas-inclinado-mancuerna` | mancuerna, banco inclinado | pectoral superior | intermedio | lateral |
| 12 | `aperturas-declinado-mancuerna` | mancuerna, banco declinado | pectoral | intermedio | lateral |
| 13 | `aperturas-suelo-mancuerna` | mancuerna (casa) | pectoral | principiante | lateral |
| 14 | `flexiones` | peso corporal | pectoral | principiante | lateral |
| 15 | `flexiones-rodillas` | peso corporal | pectoral | principiante | lateral |
| 16 | `flexiones-inclinadas` | peso corporal, banco | pectoral | principiante | lateral |
| 17 | `flexiones-declinadas` | peso corporal, banco | pectoral superior | intermedio | lateral |
| 18 | `flexiones-diamante` | peso corporal | pectoral + tríceps | intermedio | lateral |
| 19 | `flexiones-abiertas` | peso corporal | pectoral | intermedio | lateral |
| 20 | `flexiones-pliometricas` | peso corporal | pectoral | avanzado | lateral |
| 21 | `flexion-isometrica` | peso corporal (isométrico) | pectoral | principiante | lateral |
| 22 | `fondos-paralelas` | paralelas | pectoral | intermedio | lateral |
| 23 | `fondos-negativos` | paralelas | pectoral | principiante | lateral |
| 24 | `pec-deck` | máquina | pectoral | principiante | **frontal** |
| | `press-banca` (prototipo) | barra, banco | pectoral | intermedio | lateral |

Progresión de las flexiones: rodillas → inclinadas → normal → declinadas / diamante / abiertas → pliométricas (la isométrica, como apoyo). Fondos: negativos → completos. En casa, sin más que el suelo o unas mancuernas: 8 (las 6 flexiones sin banco, press y aperturas en el suelo).

Cada ejercicio lleva 2 o 3 **sustitutos** del grupo (test), del mejor al peor, cruzando barra ↔ mancuerna ↔ peso corporal ↔ máquina.

## Material y músculo nuevos (míos)

| Pieza | Dónde | Notas |
|---|---|---|
| Banco inclinado | `src/iron/material/banco-inclinado.ts` | bisagra, asiento, respaldo a `angulo`, patas y puntal |
| Banco declinado | `src/iron/material/banco-declinado.ts` | tablero, rodillo de pies y rodillera en una columna |
| Paralelas | `src/iron/material/paralelas.ts` | una barra a lo largo de la vista (la otra queda detrás), postes y base |
| Pec deck | `src/iron/material/pec-deck.ts` | escenario frontal (respaldo, asiento, columnas, travesaño, ejes) y carga móvil (almohadilla en marco + palanca al eje) |
| Pectoral superior | `musculos.ts` (al final, `// pecho`) | porción clavicular, lateral y frontal, dentro de la forma del pectoral |

`src/iron/material/pecho.ts` es el único punto de entrada: `dibujo.ts` gana dos líneas (`escenarioPecho` para todo escenario que no sea el banco plano y `cargaPecDeck`). `trazo-pecho.ts` copia los trazados básicos de `dibujo.ts` (no se pueden importar sin ciclo).

Cambios en archivos comunes (todo añadido al final o con un solo punto de enganche):

- `tipos.ts`: `ClaveI18n` acepta `iron-<grupo>:…`; `Material` + `banco_inclinado`, `banco_declinado`, `paralelas` (el pec deck usa `maquina`); `Escenario` pasa de interfaz a unión `Banco | EscenarioPecho`; `Carga` + `{ tipo: 'pec_deck' }`; `MusculoId` + `pectoral_superior`.
- `dibujo.ts`: el import, `escenarioPecho` en `escenario()`, `cargaPecDeck` en `cargaLado()` y `centroCarga` acepta cargas que no son barra.
- `iron.json`: nombres del músculo y los materiales nuevos al final de `musculo` y `material` (los componentes los piden tipados a `iron:`).
- `ejercicios/index.ts`: `...PECHO` al final. `recursos.ts`: namespace `iron-pecho`.
- Tests comunes: `esquema.test.ts` recorre las carpetas de grupo (los `_*.ts` son ayudas, no ejercicios), resuelve el namespace del grupo, lista los materiales nuevos y comprueba que los 5 del prototipo siguen delante. `sustituir.test.ts` mira el prototipo aparte y que cada ejercicio de pecho tenga sustituto de pecho.

## Cómo están hechas las poses

`_geometria.ts` (ayudas en el espacio) y `_familias.ts` (lo que comparten las variantes) calculan las poses una vez al cargar; cada ejercicio queda como datos puros:

- **Press tumbado**: la mano recorre una J del pecho a encima de los hombros y el antebrazo queda vertical por construcción; el brazo sale del plano lo justo (escorzo calculado). Banco inclinado a 30° y declinado a 20° colocados bajo la espalda (la recta de apoyo, la cabeza apoyada con su cuello calculado). En el suelo, abajo es cuando el codo toca el suelo.
- **Aperturas**: la mano baja en arco de encima del hombro al lado del pecho; el brazo se ve cada vez más corto (sale del plano) y el codo se queda a 9°.
- **Flexiones**: cuerpo recto que pivota sobre las puntas (o las rodillas); la mano fija; abajo el antebrazo vertical y el brazo en escorzo (codos a unos 45°), arriba casi estirado. 15 poses clave para que la mano no resbale.
- **Fondos**: la mano es el ancla en la barra; arriba brazos estirados y tronco a 72°, abajo brazo paralelo al suelo y tronco a 50°, piernas dobladas atrás.
- **Pec deck (frontal)**: brazo horizontal y antebrazo vertical; el giro horizontal se ve como un brazo que se acorta hasta verse de punta y vuelve a crecer hacia dentro (el paso por delante del hombro dura 40 ms con el brazo casi invisible). El antebrazo es vertical exacto todo el ciclo.

## Tests

`src/iron/__tests__/biomecanica-pecho.test.ts`: 138 reglas medidas cada 25 ms sobre el esqueleto dibujado. Entre ellas: antebrazo vertical (±15°) en todos los press; la carga toca el pecho alto en el inclinado (t 0,8 a 0,95), bajo en el declinado (0,55 a 0,75) y el codo el suelo en el press en suelo; cabeza apoyada en el respaldo o el suelo; pies planos o enganchados al rodillo; rodillera bajo la rodilla; disco que no tapa la cabeza; aperturas en arco con el codo fijo y la mancuerna lejos de la cabeza; flexiones con el cuerpo recto (±1), el apoyo y las manos fijos, el pecho a un palmo abajo y la cabeza neutra; manos más atrás en la diamante y brazo más corto en la abierta; vuelo de la pliométrica; fondos con la mano clavada en la barra, tronco entre 45 y 75°, brazo paralelo abajo y pies en el aire; pec deck simétrico, con el codo a la altura del hombro, abierto en cruz y cerrado con los codos juntos.

Verde: `npx tsc --noEmit`, `npx eslint .`, `npx jest` (2.284 tests, 109 suites al cerrar el segundo commit; `src/iron` 616).

## QA visual

GIF, MP4, PNG de la pose clave y ficha de cada ejercicio en `coordinacion-winter-arc/iron-catalogo/pecho/`, con la tabla de revisión en `QA.md`.

**Ojo al grabar (afecta a todos los equipos):** la caché de Metro está en el temporal del sistema y es común a todos los worktrees; la transformación de `expo-router` (`require.context` del `src/app`) se reutiliza entre ellos. Una exportación mía salió con el código de `f2-brazos`, otra con la pantalla «Welcome to Expo». Solución: exportar con `TEMP` y `TMP` apuntando a una carpeta propia (caché propia), a una carpeta de salida propia y con un puerto propio (yo: 8131), y comprobar en el bundle qué worktree se ha empaquetado (`grep -o "worktrees/f2-[a-z]*/src/iron/dibujo"`). Además puse `EXPO_PUBLIC_SITIO=app-pecho` (solo cambia la clave de caché; la app solo reacciona a `creadores`).

## Ronda 2 (necesitan material de otro equipo o una cámara que el motor no tiene)

| Ejercicio | Falta |
|---|---|
| Cruce de poleas (alto, de abajo arriba para el pectoral superior, a una mano) | polea (espalda) |
| Aperturas en polea baja / press en polea de pie | polea (espalda) |
| Press de pecho en máquina y press inclinado en máquina | máquina guiada sin dueño en el contrato |
| Press en multipower (plano e inclinado) | rack / guiada (pierna) |
| Press landmine (barra anclada) | soporte de mina (pierna) |
| Flexiones con banda, aperturas con banda, fondos asistidos con banda | banda elástica (hombro) |
| Press en suelo con kettlebell | kettlebell (pierna) |
| Fondos con lastre | cinturón de lastre (sin dueño) |
| Flexiones en anillas o TRX, flexiones en pared | anillas, TRX, pared (sin dueño) |
| Svend press | disco suelto (sin dueño) |
| Pullover con mancuerna | de perfil el brazo pasa por delante de la cabeza: vista frontal o desde arriba |
| Flexiones arquero | movimiento lateral: vista frontal |

## Riesgos

- **Merges**: todos los equipos tocan `tipos.ts` (uniones de `Material`, `Escenario`, `Carga`, `MusculoId`, y `ClaveI18n`), `dibujo.ts` (enganche del material), `esquema.test.ts` (recorrer carpetas y namespaces: el cambio será casi igual en todos) e `index.ts`. Son conflictos de líneas contiguas, fáciles, pero conviene integrar los cambios de esquema una sola vez.
- **2D**: aperturas y pec deck son movimientos fuera del plano. Las aperturas de perfil se leen como «el brazo se acorta» y la mancuerna va de punta para no girar; el pec deck de frente gira el brazo en un instante en que casi no se ve. En el pec deck, con los muslos hacia la cámara, la figura sentada se parece a una de pie (rodillas algo abiertas para leerlo).
- **Pectoral superior**: es una pieza encima del pectoral. Cuando trabaja el pectoral entero queda tapada; cuando es el principal (inclinados, flexiones declinadas) brilla sobre el pectoral en azul tenue.
- **Técnica**: revisada con reglas medibles y a ojo; falta la revisión de alguien que entrene, sobre todo profundidad de los fondos y de las aperturas.
- **Cruce de materiales**: «flexiones inclinadas» y «flexiones declinadas» usan el banco plano (motor), no el mío.

## Horas

Unas 9 h de chat: 1,5 h leyendo el motor y planteando; 2 h de material (4 piezas y la carga del pec deck); 2,5 h de geometría y las 24 poses; 1,5 h de tests; 1,5 h de QA visual y correcciones (encuadres, aperturas, rodillera, caché de Metro). Por debajo de la estimación del doc del motor (≈ 30 h para 25 ejercicios y 3 materiales) gracias a las familias: una variante cuesta minutos.
