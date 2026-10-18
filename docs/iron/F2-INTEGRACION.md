# IRON fase 2 · Integración del catálogo

Rama `iron-f2/integ`, que parte de `integ/modos-f1` @0125629 (fase 1 y el motor v2). Contrato: `coordinacion-winter-arc/IRON-F2-CONTRATO.md`. Informes de cada equipo: `docs/iron/F2-<grupo>.md`.

## Merges

Los seis con `--no-ff`, en este orden: `iron-f2/brazos` (ef28b74), `espalda` (e12a40c), `pierna` (47861ee), `core` (ffffb70), `hombro` (a3c8993) y `pecho` (3eaa172). Después, cuatro commits de integración: duplicados y encogimientos, tests únicos, ronda 2 y la entrega (traducciones, QA y documentos).

## Ejercicios por grupo

**162 ejercicios** en total: los 5 del prototipo y 157 en las carpetas de grupo. 11 de ellos son de la ronda 2, hechos en la integración.

| Grupo (`grupo`) | Ejercicios | Del prototipo | Ronda 2 (integración) |
|---|---|---|---|
| pecho | 24 | press de banca | cruce de poleas |
| espalda | 29 | remo con mancuerna | remo con apoyo de pecho, dominada asistida con banda |
| hombro | 23 | | |
| brazo | 29 | curl de bíceps con mancuernas | curl en polea, extensión de tríceps en polea, curl inclinado, curl araña |
| pierna | 29 | sentadilla con barra | patada de glúteo en polea, abducción con banda |
| core | 16 | plancha | pallof press, elevación de rodillas colgado |
| cardio | 7 | | |
| movilidad | 5 | | |

Por carpeta (sin el prototipo): brazos 28, espalda 28, pierna 28, core 27 (core, cardio y movilidad), hombro 23 y pecho 23. Las carpetas no coinciden siempre con el grupo: los encogimientos viven ya en `espalda/`.

## Conflictos resueltos

Todos los de los archivos compartidos se resolvieron sumando las partes:
- **Archivos:** `tipos.ts`, `musculos.ts`, `dibujo.ts`, `esqueleto.ts`, `interpolar.ts`, `ejercicios/index.ts`, `recursos.ts`, `iron.json`, `esquema.test.ts` y `sustituir.test.ts`.
- **Uniones de `tipos.ts`:** `Material`, `MusculoId`, `Carga`, `Escenario` y `ClaveI18n`.
- **`grabar.mjs`:** entró sin conflicto, con `--solo a,b,c`.

Lo que no era solo sumar:

| Conflicto | Resolución |
|---|---|
| `Carga` de tipo `'palanca'` en espalda (remo en máquina, con `pivote`) y en pierna (extensión y curl femoral, con `eje` y `cara`) | La de pierna pasa a `'palanca_pierna'` (tipos, dos ejercicios y su test). |
| `Escenario`: pierna y core ampliaron `tipo` en la interfaz; pecho la cambió por una unión `Banco \| EscenarioPecho` | `Escenario = Banco \| EscenarioPecho`, y `Banco` es el tablero con `x`, `ancho` y `alto` que comparten banco, esterilla, cajón, rack y bancadas de máquinas. El material de pierna y core y los tests leen `Banco`. |
| `dibujo.ts`: pierna y pecho mandaban a su material «todo lo que no sea barra o banco» | Cada grupo pregunta por lo suyo (`esCargaEspalda`, `esCargaPierna`, `esEscenarioEspalda`, `esEscenarioPierna`, `esEscenarioPecho`), y la barra y el banco plano quedan al final. Antes, la banda de hombro habría acabado en el material de pierna. |
| `material/trazo.ts` creado a la vez por pierna y core, con funciones distintas | El de pierna se queda como `trazo.ts` y el de core pasa a `trazo-core.ts` (comba, esterilla y rueda lo importan). |
| `capasDe`: hombro añadió `cara` y core añadió `fase` | `dibujar` pasa los dos: `ej.cara ?? 'ant'` y la fase del ciclo. |
| `esqueleto` e `interpolar`: `Pose.muneca` (brazos) y `Pose.punto` (core) | Se quedan los dos. |
| Tests de esquema y sustituir (seis versiones casi iguales) | Una sola versión, ver abajo. |
| Búsqueda de nombres | `nombreIron` (core, `src/components/iron/texto.ts`) busca el músculo, grupo o material en `iron` y en cualquier `iron-<grupo>`. Ya lo usan la ficha y la demo. Test nuevo: `src/components/iron/__tests__/texto.test.ts` comprueba los seis idiomas. |
| Duplicado de id `flexiones-diamante` (brazos y pecho) y duplicado de ejercicio `press-cerrado-barra` (brazos) frente a `press-banca-cerrado` (pecho) | Se quedan los de brazos, porque el principal es el tríceps y tienen su progresión (diamante de rodillas, press cerrado con mancuernas). Los de pecho se borran con sus textos. El sustituto de pecho que los usaba (`press-squeeze-mancuerna`) apunta ahora a press de banca con mancuernas, press de banca y flexiones. |
| Encogimientos (`encogimientos-barra`, `encogimientos-mancuerna`): estaban en la carpeta y el namespace de hombro con `grupo: 'espalda'` | Pasan a `ejercicios/espalda/` y a `iron-espalda.json`. Siguen usando las anclas de `hombro/comun.ts`. |
| Peso muerto convencional (pierna preguntaba de quién era) | Se queda en espalda. Su primer principal son los lumbares, y la regla del esquema es «grupo = el del primer principal». Los rumanos y los buenos días siguen en pierna. |

### Tests únicos

- **`esquema.test.ts`:**
  - Recorre las seis carpetas de grupo, sin `index.ts`, `comun.ts` ni las ayudas `_*.ts`.
  - Exige que cada ejercicio use el namespace de su carpeta.
  - Comprueba que cada `iron-<grupo>.json` está registrado en `recursos.ts` y que no guarda textos de un ejercicio que no está en su carpeta.
  - Comprueba que todo lo que se dibuja (cargas y escenarios de cualquier grupo) está en la lista de material.
- **`sustituir.test.ts`:**
  - En el catálogo completo, cada ejercicio tiene sustituto de su grupo y los sustitutos escritos a mano son de su grupo. Core, cardio y movilidad cuentan como una familia, porque core los cruza a propósito.
  - Sin material, el sustituto sigue en su grupo.

## Ronda 2

Revisadas las seis listas de «ronda 2» de los informes. Ya con todo el material integrado, se hicieron los más usados, con el mismo estilo:
- poses despejadas con las ayudas de cada equipo (`espalda/_pose`, `pecho/_geometria`, `hombro/comun`);
- tests de técnica en `src/iron/__tests__/ronda2.test.ts` (42 reglas, cada 25 ms);
- QA visual en `coordinacion-winter-arc/iron-catalogo/ronda2/` con su `QA.md`.

| Ejercicio | Material de otro equipo |
|---|---|
| `cruce-poleas` (pecho) | polea (espalda) |
| `curl-polea` y `extension-triceps-polea` (brazos) | polea, barra de polea y cuerda (espalda) |
| `curl-inclinado-mancuerna` y `curl-arana` (brazos) | banco inclinado (pecho) |
| `remo-apoyo-pecho` (espalda) | banco inclinado (pecho) |
| `pallof-press` (core, vista frontal) | banda (hombro) |
| `elevacion-rodillas-colgado` (core) | barra fija (espalda) |
| `patada-gluteo-polea` (pierna) | polea con tobillera (espalda) |
| `abduccion-banda` (pierna, vista frontal) | banda (hombro) |
| `dominada-asistida-banda` (espalda) | banda (hombro) |

Cambios en el material para la ronda, todos aditivos y con test:
- **Banco inclinado** con `espejo` (pecho): el respaldo sube hacia la cabeza para apoyar el pecho boca abajo.
- **Banda** con `en: 'rodilla' | 'tobillo'` (hombro): con `anclaje: 'manos'` va de un lado al otro (rodilla a rodilla); con un punto fijo, de la barra a la rodilla.
- **Polea** con `en: 'tobillo'` y el agarre `'tobillera'` (espalda).

Con la ronda 2 entran 1015 textos nuevos en español, aceptados en `docs/i18n/textos-es.aceptados.tsv`. `verificar-es` da 0 diferencias.

## Traducciones

Los seis namespaces `iron-<grupo>` y los 14 nombres nuevos de `iron.json` (músculos y materiales) están traducidos al inglés, francés, portugués, alemán e italiano:
- con el registro y el vocabulario ya usados en cada `<lng>/iron.json`;
- sin raya, sin exclamaciones y con las mismas claves.

`scripts/i18n/registrar-traducidos.mjs` ahora entiende los namespaces con guion (`iron-brazos` se importa como `enIronBrazos`) y ha regenerado `src/i18n/traducidos.ts`. `traducidos.test.ts` pasa en verde.

## Verificación

- `npx tsc --noEmit`, `npx eslint .` y `CI=true npx jest --ci`: verde, 129 suites y 5043 tests.
- `node scripts/i18n/verificar-es.mjs`: «El español dice lo mismo que la línea base».
- Base de datos de la fase 1, en PGlite en memoria, sin tocar la base real:
  - `node scripts/test-modos-f1.mjs <pglite>`: PASS, 126 comprobaciones.
  - `node scripts/analitica/probar-migraciones.mjs <pglite>`: PASS, 65 comprobaciones.
- QA visual: exportación web propia (`TEMP` y `TMP` propios, `--clear`, carpeta propia y puerto 8140). En el bundle, `grep "worktrees/f2-integ"` sale en las 26 referencias de `dibujo` y ningún otro worktree.

Sin push, deploy, OTA ni EAS, y sin tocar `supabase/`.

## Lo que queda

- **Ronda 2 por hacer.** Todo esto tiene ya su material; cada uno es una variante de un ejercicio que existe:
  - brazos: curl bayesiano, extensión sobre la cabeza en polea, fondos en paralelas (versión tríceps), curl y extensión con banda, curl con kettlebell;
  - espalda: remo con kettlebell, rack pull, separación de banda (pull apart), negativa desde cajón;
  - pierna y core: superman, bird dog y puentes sobre esterilla, pull-through en polea, paseo lateral con banda, crunch en polea, leñador, rodillas al pecho en paralelas, abdominal en banco declinado, saltos al cajón, swing en core;
  - hombro: face pull en polea con cuerda (ya existe en espalda como `face-pull`), elevación lateral, pájaro, remo al mentón y rotaciones en polea, pájaro en pec deck invertido, press sentado con respaldo, Y y pájaro en banco inclinado, press y halo con kettlebell, Y-T-W en esterilla;
  - pecho: aperturas en polea baja, press de pie en polea, flexiones y aperturas con banda, fondos asistidos con banda, press en el suelo con kettlebell.
- **Ronda 3.** Lo que necesita material sin dueño (predicador, landmine o remo en T, máquinas de press, Smith, lastre, anillas, pared, disco suelto) está en `docs/iron/RONDA3.md`, con una propuesta de dueño por pieza.
- **Revisión de técnica** de alguien que entrene: está pendiente en todos los grupos, como en la F1.
- **Rendimiento** en un Android de gama baja (52 capas por maniquí): sin medir.
- **Riesgos del 2D**, aceptados y anotados en cada `QA.md`:
  - la banda de la dominada asistida cruza el pecho de perfil;
  - en el curl inclinado el brazo se dibuja sobre el respaldo;
  - en el remo con apoyo de pecho las piernas se dibujan sobre el banco.
