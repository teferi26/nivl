# IRON F2 · Equipo HOMBRO

Rama `iron-f2/hombro` sobre `modos-f1/motor` @9451103. Contrato: `coordinacion-winter-arc/IRON-F2-CONTRATO.md`. Estilo v2 sin cambios.

## Qué entrega

- **25 ejercicios** en `src/iron/ejercicios/hombro/` (uno por archivo; `comun.ts` son posturas y anclas compartidas), con `index.ts` (`EJERCICIOS_HOMBRO`, de más a menos usado) registrado en `src/iron/ejercicios/index.ts`.
- **Material propio: banda elástica** (`src/iron/material/banda.tsx`): una tira con comba del agarre al anclaje, recalculada en cada cuadro. Tres anclajes: un punto fijo (puerta o poste, con su pieza dibujada), `'pies'` (pisada bajo el pie de cada lado) y `'manos'` (de una mano a la otra). `oculta: [x0, x1]` quita el tramo que tapa el cuerpo en la vista por detrás.
- **Músculo propio: `manguito_rotador`** (infraespinoso y redondo menor sobre la escápula), al final de `musculos.ts` con su forma lateral y la de detrás. Nombre en `iron.json → musculo` (lo lee la interfaz con `iron:musculo.<id>`).
- **Vista por detrás:** `Ejercicio.cara?: 'ant' | 'post'`. En la vista frontal, `'post'` pinta las formas de detrás del mapa muscular (deltoides posterior, manguito, trapecio, romboides). Una línea en `dibujar` (`ej.cara`).
- **Textos** en `src/i18n/es/iron-hombro.json` (namespace `iron-hombro`, registrado en `recursos.ts`).
- **Tests:** `src/iron/__tests__/hombro.test.ts` (71 reglas medibles); los de esquema y biomecánica generales ya recorren los 25.
- **QA visual:** GIF, MP4, PNG de la pose clave y ficha de cada ejercicio en `coordinacion-winter-arc/iron-catalogo/hombro/`, con la tabla en `QA.md`.

## Ejercicios

| # | id | Vista | Material | Principal | Nivel |
|---|---|---|---|---|---|
| 1 | press-militar-barra | lateral 3/4 | barra | deltoides anterior | intermedio |
| 2 | press-militar-mancuerna | frontal | mancuerna | deltoides anterior | principiante |
| 3 | elevaciones-laterales | **frontal** | mancuerna | deltoides lateral | principiante |
| 4 | press-mancuerna-sentado | frontal | mancuerna, banco | deltoides anterior | principiante |
| 5 | press-arnold | lateral | mancuerna | deltoides anterior | intermedio |
| 6 | elevaciones-frontales | lateral | mancuerna | deltoides anterior | principiante |
| 7 | pajaro-mancuerna | frontal por detrás | mancuerna | deltoides posterior | intermedio |
| 8 | face-pull-banda | frontal por detrás | banda | deltoides posterior | principiante |
| 9 | encogimientos-barra | frontal | barra | trapecio (grupo espalda) | principiante |
| 10 | encogimientos-mancuerna | frontal por detrás | mancuerna | trapecio (grupo espalda) | principiante |
| 11 | remo-menton-barra | frontal | barra | deltoides lateral | intermedio |
| 12 | push-press | lateral 3/4 | barra | deltoides anterior | avanzado |
| 13 | elevaciones-laterales-sentado | **frontal** | mancuerna, banco | deltoides lateral | principiante |
| 14 | remo-menton-mancuerna | frontal | mancuerna | deltoides lateral | principiante |
| 15 | elevacion-frontal-barra | lateral 3/4 | barra | deltoides anterior | principiante |
| 16 | flexion-pica | lateral | peso corporal (casa) | deltoides anterior | intermedio |
| 17 | tiron-banda | frontal por detrás | banda (casa) | deltoides posterior | principiante |
| 18 | rotacion-externa-banda | frontal por detrás | banda (casa) | manguito rotador | principiante |
| 19 | rotacion-interna-banda | frontal por detrás | banda (casa) | manguito rotador | principiante |
| 20 | rotacion-externa-90-banda | lateral | banda (casa) | manguito rotador | intermedio |
| 21 | press-banda | frontal | banda (casa) | deltoides anterior | principiante |
| 22 | elevacion-lateral-banda | **frontal** | banda (casa) | deltoides lateral | principiante |
| 23 | elevacion-frontal-banda | lateral | banda (casa) | deltoides anterior | principiante |
| 24 | remo-menton-banda | frontal | banda (casa) | deltoides lateral | principiante |
| 25 | flexion-pica-pies-elevados | lateral | peso corporal, banco | deltoides anterior | avanzado |

Casa y sin material: 9 (las 8 de banda y la flexión en pica). Todos llevan sustitutos escritos dentro del grupo (press ↔ press, laterales ↔ laterales, posterior ↔ face pull/tirón, manguito ↔ manguito).

Los encogimientos tienen el trapecio de principal, así que el esquema los pone en el grupo **espalda** (grupo = el del primer principal), aunque vivan en la carpeta de hombro como pedía el encargo. «Sustituir» los ofrecerá con el resto de espalda.

## Ronda 2 (material de otro equipo)

| Ejercicio | Falta | Dueño |
|---|---|---|
| Face pull en polea con cuerda | polea, cuerda | espalda |
| Elevación lateral en polea (y a una mano inclinado) | polea | espalda |
| Pájaro en polea cruzada | polea | espalda |
| Pájaro en máquina (pec deck invertido) | pec deck | pecho |
| Remo al mentón en polea baja | polea, barra de polea | espalda |
| Rotación externa e interna en polea | polea | espalda |
| Press de hombro sentado con respaldo | banco inclinado a 90° | pecho |
| Elevación en Y tumbado en banco inclinado | banco inclinado | pecho |
| Pájaro tumbado en banco inclinado | banco inclinado | pecho |
| Press de hombro y halo con kettlebell | kettlebell | pierna |
| Press de hombro en máquina, encogimientos en máquina o Smith | máquina guiada, rack | pierna (rack) / sin dueño (máquina de hombro) |
| Flexiones en pino contra la pared y pino | pared (escenario) | sin dueño en el contrato |
| Elevación en Y, T y W en el suelo | esterilla | core |
| Landmine press | soporte de landmine | sin dueño en el contrato |

La técnica de cada uno de estos sale de un ejercicio que ya está (mismas poses que su versión con mancuerna o banda); en ronda 2 es cambiar la carga y el escenario.

## Cambios fuera de mis archivos (mínimos, para que el catálogo funcione)

Todos son añadidos o una línea, sin reordenar nada:

- `tipos.ts`: `ClaveI18n` acepta `iron-<grupo>:`; variante `banda` en `Carga`; `MusculoId` + `manguito_rotador`; `Ejercicio.cara?`.
- `dibujo.ts`: import de `banda`, una rama en `cargaLado` y `ej.cara` en `dibujar`.
- `ejercicios/index.ts`: `...EJERCICIOS_HOMBRO` al final de la lista (la lista pasa a una línea por elemento; cada equipo añade su línea).
- `esquema.test.ts`: busca ejercicios también en subcarpetas (sin `index.ts` ni `comun.ts`), resuelve textos de cualquier `iron-<grupo>` y comprueba los 5 del prototipo con `slice(0, 5)`.
- `src/app/kit/iron.tsx`: en la web exportada los parámetros de la URL llegan después del primer render y la galería se quedaba en la sentadilla (el grabador leía su ciclo y grababa la sentadilla). Ahora manda el `ejercicio` de la URL y el grabador solo engancha cuando ya está. Útil para todos los equipos.
- `sustituir.test.ts`: «los 5 del prototipo no tienen sustituto» se mide sobre el catálogo del prototipo (con el catálogo entero ya hay otros del mismo grupo).

Los otros equipos tocarán estas mismas líneas (sobre todo `ClaveI18n`, `MusculoId`, `ejercicios/index.ts` y los dos tests): conflictos de una línea, que se resuelven sumando.

## Técnicas de dibujo nuevas (para reutilizar)

- **Vista frontal de pie:** `ANCLA_PIE_FRONTAL` (cadera a 52,9) y `tobillo = -cadera` para que la planta quede plana (sin eso la punta del pie cercano atraviesa el suelo).
- **Sentado de frente:** muslos hacia la cámara con escorzo 0,45 y banco visto por su extremo (`comun.ts`).
- **Giros en horizontal vistos de frente o por detrás** (rotaciones, tirón, face pull): el escorzo del segmento es el seno del ángulo de giro y el signo del codo da el sentido.
- **Encogimientos sin articulación escapular:** el tronco se alarga (escorzo 0,92 → 1) y el cuello se acorta (cabeza 1 → 0,8) a la vez: hombros, brazos y carga suben 2,4 y la cabeza queda quieta.
- **Bisagra de cadera vista por detrás** (pájaro): tronco en escorzo 0,36 y cabeza 0,5.
- **Ancla en la mano** (flexiones en pica): `punto: 'agarre_c'`, `segmento: 'antebrazo_c'` y el ángulo del antebrazo en cada pose; manos y pies despejados con IK para que no resbalen (test: pies quietos ±0,8).

## Riesgos

- **Proyección 2D:** en vista lateral el brazo cercano pasa por delante de la cara en los press por encima de la cabeza (arriba del todo) y en el Arnold; es lo que se ve de perfil. En el pájaro visto por detrás los brazos colgando se pintan por delante del glúteo (el orden de capas frontal es fijo). En el tirón con banda, la banda se ve sobre los brazos. Detallado en `QA.md`.
- **Mancuerna en el remo al mentón:** se dibuja de punta (hexágono) para que no gire con el antebrazo; en la realidad va horizontal.
- **Movimiento escapular:** el motor no tiene escápula; los encogimientos usan el truco del escorzo. Si más grupos lo necesitan (remos con retracción, dominadas escapulares), conviene un ángulo de elevación del hombro en el esqueleto.
- **Rotaciones vistas por detrás:** en el paso por «antebrazo hacia delante» el antebrazo se ve como un punto y la mano (que no tiene escorzo) baja un instante bajo el codo.
- **Revisión de técnica:** reglas medibles y revisión a ojo; falta la de alguien que entrene.

## Horas

| Tarea | Horas |
|---|---|
| Material banda, músculo, vista por detrás y ajustes de tests comunes | 2 |
| 25 ejercicios (poses con IK, textos y tests) | 6,5 |
| QA visual (vistas previas, grabación, revisión y ajustes) | 1,5 |
| Documento | 0,5 |
| **Total** | **≈ 10,5 h de chat** |

## Cómo se prueba

```bash
npx tsc --noEmit && npx eslint src/iron src/i18n && npx jest src/iron src/i18n
```

Galería: `/kit/iron?ejercicio=<id>` y `/kit/iron?ejercicio=<id>&ficha=1`. Vídeos: exportación web con `--clear` a una carpeta propia, servida en un puerto propio (aquí 8103, para no pisar a los otros equipos), y `node scripts/iron/grabar.mjs --url http://127.0.0.1:8103 --salida ../coordinacion-winter-arc/iron-catalogo/hombro --solo <id>` (uno por id).
