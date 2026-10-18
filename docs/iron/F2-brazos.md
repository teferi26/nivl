# IRON fase 2 · Equipo BRAZOS: catálogo de bíceps, tríceps y antebrazo

Rama `iron-f2/brazos` (base `modos-f1/motor` @9451103). Contrato: `coordinacion-winter-arc/IRON-F2-CONTRATO.md`. Estilo v2 sin cambios.

## Qué se ha hecho

| Pieza | Dónde |
|---|---|
| 24 ejercicios (un archivo cada uno) e índice del grupo | `src/iron/ejercicios/brazos/<id>.ts`, `index.ts` |
| Piezas comunes del grupo (de pie, sentado, tumbado, claves de texto) | `src/iron/ejercicios/brazos/comun.ts` (no es un ejercicio) |
| Textos (namespace `iron-brazos`) | `src/i18n/es/iron-brazos.json`, registrado en `src/i18n/recursos.ts` |
| Material nuevo: barra Z | `src/iron/material/barra-z.tsx` (tramo en 3/4 en zigzag) + `forma: 'z'` en la carga |
| Músculos nuevos: braquial y braquiorradial | al final de `src/iron/musculos.ts` (lateral y frontal), nombres en `iron.json` |
| Muñeca opcional en las poses (`Pose.muneca`) | `tipos.ts`, `esqueleto.ts`, `interpolar.ts`; la mancuerna sigue a la mano en `dibujo.ts` |
| Tests de técnica del grupo | `src/iron/__tests__/brazos.test.ts` |
| QA visual (GIF, MP4, PNG y ficha de cada uno) | `coordinacion-winter-arc/iron-catalogo/brazos/` y su `QA.md` |

## Ejercicios (los más usados primero)

| # | id | Principal | Material | Nivel | En casa |
|---|---|---|---|---|---|
| 1 | `curl-barra` | bíceps | barra | principiante | |
| 2 | `curl-barra-z` | bíceps | barra Z | principiante | |
| 3 | `curl-martillo` | braquiorradial, braquial | mancuerna | principiante | sí |
| 4 | `curl-concentrado` | bíceps | mancuerna, banco | principiante | con silla |
| 5 | `curl-sentado-mancuerna` | bíceps | mancuerna, banco | principiante | con silla |
| 6 | `curl-inverso-barra-z` | braquiorradial, braquial | barra Z | intermedio | |
| 7 | `curl-arrastre-barra` | bíceps | barra | intermedio | |
| 8 | `press-frances-barra-z` | tríceps | barra Z, banco | intermedio | |
| 9 | `press-cerrado-barra` | tríceps | barra, banco | intermedio | |
| 10 | `fondos-banco` | tríceps | banco (o silla), peso corporal | principiante | sí |
| 11 | `fondos-banco-pies-elevados` | tríceps | dos bancos, peso corporal | intermedio | con dos sillas |
| 12 | `extension-triceps-cabeza-mancuerna` | tríceps | mancuerna | principiante | sí |
| 13 | `patada-triceps` | tríceps | mancuerna, banco | principiante | |
| 14 | `press-frances-mancuerna` | tríceps | mancuerna, banco | principiante | |
| 15 | `extension-triceps-cabeza-barra-z` | tríceps | barra Z | intermedio | |
| 16 | `press-cerrado-mancuerna` | tríceps | mancuerna, banco | principiante | |
| 17 | `patada-triceps-de-pie` | tríceps | mancuerna (o garrafas) | principiante | sí |
| 18 | `flexiones-diamante` | tríceps | peso corporal | intermedio | sí |
| 19 | `flexiones-diamante-rodillas` | tríceps | peso corporal | principiante | sí |
| 20 | `press-frances-suelo-mancuerna` | tríceps | mancuerna | principiante | sí |
| 21 | `curl-muneca-barra` | antebrazo (flexores) | barra, banco | principiante | |
| 22 | `extension-muneca-mancuerna` | antebrazo (extensores) | mancuerna, banco | principiante | con silla |
| 23 | `curl-muneca-espalda-barra` | antebrazo | barra | intermedio | |
| 24 | `paseo-granjero` | antebrazo (agarre) | mancuerna | principiante | sí |

Sustitutos cruzados dentro del grupo en cada archivo (curl ↔ curl, francés ↔ extensión ↔ cerrado, muñeca ↔ granjero...). El curl de bíceps con mancuernas de pie del prototipo no se duplica (lo comprueba un test); el sentado, el concentrado y el martillo son otros ejercicios.

## Ronda 2 (necesitan material de otro equipo o sin dueño)

| Ejercicio | Falta | Dueño |
|---|---|---|
| Curl inclinado con mancuernas | banco inclinado | pecho |
| Curl araña (spider curl) | banco inclinado | pecho |
| Curl predicador (barra Z o mancuerna) | banco predicador (Scott) | **sin dueño en el contrato**; propongo que lo haga brazos en la ronda 2 |
| Curl en polea, curl bayesiano | polea con asas | espalda |
| Extensión de tríceps en polea con cuerda / con barra | polea, cuerda, barra recta | espalda |
| Extensión de tríceps sobre la cabeza en polea | polea, cuerda | espalda |
| Fondos en paralelas (versión tríceps) | paralelas | pecho |
| Dominadas supinas | barra de dominadas | espalda |
| Curl y extensión con banda elástica | banda | hombro |
| Rodillo de muñeca | rodillo | sin dueño |
| Curl con kettlebell / paseo con kettlebell | kettlebell | pierna |

## Cambios en piezas compartidas (para el merge)

Todos son añadidos al final o ramas nuevas; nada se reordena:

- `tipos.ts`: `ClaveI18n` admite `iron-<grupo>:…`; `Material` + `'barra_z'`; `MusculoId` + `'braquial' | 'braquiorradial'`; `VistaBarra.forma?: 'recta' | 'z'`; `Pose.muneca?`.
- `esqueleto.ts` / `interpolar.ts`: `muneca` opcional (sin ella el agarre sale igual que antes, comprobado en test).
- `dibujo.ts`: la mancuerna se orienta con la mano (muñeca → puño; igual que antes si no hay muñeca) y el tramo de barra usa `tramoBarraZ` si `forma === 'z'`.
- `musculos.ts`: dos entradas al final de `MUSCULOS`, `GRUPO_DE_MUSCULO`, `FORMAS_LATERAL` y `FORMAS_FRONTAL` (`// brazos`).
- `ejercicios/index.ts`: `...BRAZOS` al final de `EJERCICIOS`.
- `iron.json`: `musculo.braquial`, `musculo.braquiorradial`, `material.barra_z` (la ficha y el esquema leen los nombres de ahí).
- `esquema.test.ts`: resuelve textos de cualquier `iron-<grupo>` por `RECURSOS_ES`, recorre las subcarpetas (ignora `index.ts` y `comun.ts`) y «los 5 del prototipo» pasa a ser «los 5 primeros». `sustituir.test.ts`: el caso «no inventa» usa solo los 5 del prototipo. Los otros equipos necesitan los mismos cambios: en el merge, quedarse con una sola versión.
- `scripts/iron/grabar.mjs`: `--solo` admite varios ids separados por comas.

## Cómo se despejaron las poses

Las cadenas cerradas (dos apoyos fijos) se resolvieron con un Gauss-Newton numérico sobre el esqueleto real del motor (script de trabajo, fuera del repo), y los valores van escritos en cada archivo:

- **Fondos en banco:** puño fijo en el borde del banco (ancla `agarre_c`), talón fijo en el suelo o en el otro banco, cadera por delante del borde; la profundidad se para donde la extensión de hombro llega a 60° (límite del esquema y consigna de seguridad).
- **Flexiones diamante:** puntas de los pies (ancla `punta_c`, el pie gira con `angulo`) o rodilla en el suelo, manos fijas bajo el pecho y cuerpo recto.
- **Curl de muñeca:** codo sobre el muslo y antebrazo horizontal con el tronco a 55,4°.
- **Press cerrado:** como el press de banca: antebrazo vertical bajo la barra y escorzo del brazo de 0,95 a 0,7 (codos pegados).

## Biomecánica comprobada (`brazos.test.ts`, cada 25 ms)

Curls: hombro de 0 a 20° y tronco quieto, ≥ 115° de codo, bajada más lenta. Arrastre: barra pegada al torso y codo detrás al final. Concentrado: brazo vertical ±8° y codo fijo sobre el muslo. Muñeca: antebrazo horizontal y quieto, ≥ 90° de mano. Por detrás: la barra no toca los glúteos. Francés: brazo quieto (±1°) a 95-110° y la carga pasa por encima de la cabeza sin tocarla. Cerrado: antebrazo vertical ±15°, toca el pecho bajo (55 a 80 % del tronco), acaba sobre los hombros. Fondos: mano y talón fijos, cadera por delante del banco, brazo como mucho paralelo. Flexiones: manos fijas, cuerpo recto (±1), pecho cerca del suelo, codos atrás. Patadas: brazo quieto y codo sobre la línea de la espalda. Sobre la cabeza: brazo vertical y quieto, carga detrás de la cabeza y cara libre. Granjero: siempre un pie plano y piernas alternas. Todos: la carga no tapa la cabeza, nada atraviesa el suelo, el ciclo cierra.

## Riesgos

- **Muñeca:** es un ángulo para los dos lados y solo mueve el puño (3,5 unidades): el curl de muñeca se lee, pero es un gesto pequeño en pantalla. Si hiciera falta, una mano dibujada más larga.
- **Sobre la cabeza en vista lateral:** el brazo cercano tapa la parte de atrás de la cabeza; se adelanta la cabeza (cuello 34°) para que la cara se vea; en el QA queda marcado como «parcial». Una vista frontal o 3/4 real lo resolvería mejor.
- **Paseo del granjero:** camina en el sitio (la cadera no se desplaza); se lee como marcha.
- **Fondos en banco:** la profundidad está limitada por el tope de hombro del esquema (-60°); es la versión prudente.
- **Merge:** tocan las mismas líneas que los otros equipos (`tipos.ts`, `musculos.ts`, `iron.json`, `index.ts`, `recursos.ts`, `esquema.test.ts`): conflictos de una línea, resolver uniendo.
- Falta la revisión de técnica de alguien que entrene.

## Horas

| Tarea | Horas |
|---|---|
| Lectura del motor y del contrato | 0,5 |
| Motor: músculos, barra Z, muñeca, esquema por grupos | 1,5 |
| 24 ejercicios (poses, despejes, cámara) | 5 |
| Textos y tests de técnica | 1,5 |
| QA visual y documento | 1,5 |
| **Total** | **≈ 10** |
