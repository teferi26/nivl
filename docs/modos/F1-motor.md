# Modos F1 · Equipo MOTOR: motor propio de ejercicios de IRON

Rama `modos-f1/motor`. Prototipo para que Teferi lo vea y lo apruebe: 5 ejercicios dibujados y animados por un motor 100 % propio (sin bases de datos ni atlas con licencia, sin dependencias nuevas). Nada de esto se ve en la app publicada: solo en la galería de desarrollo `/kit/iron` (redirige a la raíz con `__DEV__` false).

## Qué se ha hecho

| Pieza | Dónde |
|---|---|
| Esquema de datos estricto | `src/iron/tipos.ts` |
| Esqueleto 2D (cinemática directa desde un ancla) | `src/iron/esqueleto.ts` |
| Interpolación entre poses clave | `src/iron/interpolar.ts` |
| Mapa muscular propio (18 músculos, 6 grupos) | `src/iron/musculos.ts` |
| Del esqueleto al SVG (capas fijas) | `src/iron/dibujo.ts` |
| Los 5 ejercicios (un archivo cada uno) | `src/iron/ejercicios/<id>.ts` + `index.ts` |
| «Sustituir» | `src/iron/sustituir.ts` |
| Ayudas para escribir poses (IK) | `src/iron/autor.ts` |
| Maniquí animado (Reanimated) y mapa de cuerpo entero | `src/components/iron/` |
| Demostración | `src/app/kit/iron.tsx` (enlace desde `/kit`) |
| Textos (es) | `src/i18n/es/iron.json`, namespace `iron` |
| Grabador de vídeos | `scripts/iron/grabar.mjs` |
| Tests | `src/iron/__tests__/` (esquema, biomecánica, sustituir, autor) |

Vídeos para el dueño (MP4 de 3 vueltas, GIF de 1 vuelta y PNG de la pose más exigente): `coordinacion-winter-arc/iron-prototipo/`.

## Arquitectura

```
ejercicios/<id>.ts ──► interpolar.angulosEn(ej, ms) ──► esqueleto.construirEsqueleto(...) ──► dibujo.capasDe(...) ──► <Path d> × 40
   (datos)               (ángulos del instante)          (posición de cada articulación)        (silueta + músculos + carga)
```

1. **Datos.** Un ejercicio es un objeto `Ejercicio`: id, nombre (clave i18n), grupo, nivel, tipo (dinámico o isométrico), material, músculos principales y secundarios, sustitutos, vista, **ancla**, **poses clave** (ángulos por articulación y su instante en ms), ciclo, carga (barra o mancuerna), escenario (banco), encuadre, cues y errores comunes (claves i18n).
2. **Ancla.** El punto del cuerpo que no se mueve y el ángulo de un segmento. Sentadilla y curl: el tobillo en el suelo y el pie plano. Press de banca y remo: la cadera y el tronco. Plancha: el codo y el brazo vertical. Desde el segmento del ancla se recorre el árbol de articulaciones hacia fuera (también «hacia arriba»: del pie a la cadera), así los apoyos nunca resbalan.
3. **Ángulos.** Seis por lado (`cadera`, `rodilla`, `tobillo`, `hombro`, `codo`) más `cuello`, en grados y con signo anatómico (positivo = flexión). Lado `cerca` (el que ve la cámara) y `lejos` (si no se da, igual). Medidas antropométricas clásicas (Drillis y Contini, Winter) en unidades de cuerpo: 100 ≈ altura de pie.
4. **Escorzo.** El motor es 2D. Cuando un segmento sale del plano (codos abiertos en el banco, agarre ancho en la sentadilla), la pose dice cuánto se ve de él (0 a 1) y el ángulo es el del dibujo. Los límites anatómicos solo se comprueban en los segmentos que están en el plano.
5. **Interpolación.** Cada ángulo va por su cuenta con una cúbica monótona de Hermite (tangentes de Fritsch y Carlson) en bucle: pasa por las poses intermedias sin frenar, frena suave donde el movimiento cambia de sentido, nunca se pasa de una pose y dos poses iguales seguidas son una pausa.
6. **Dibujo.** Una lista FIJA de 40 ranuras en orden de pintado (lado lejano, banco, tronco, cabeza, lado cercano, carga); cada segmento tiene silueta, músculos principales y secundarios. Silueta con perfil de grosor delante/detrás (pecho, glúteo, gemelo); cada músculo es un vientre en forma de huso pegado a la cara anterior, posterior o al medio de su segmento: se mueve con el hueso. Vista lateral y frontal (la frontal la usa el mapa de cuerpo entero; el motor ya la admite para ejercicios).
7. **Animación.** `Maniqui` monta los 40 `<Path>` una vez; un reloj de Reanimated avanza en línea recta y un `useDerivedValue` calcula `dibujar(ej, reloj % ciclo)` en el hilo de la interfaz (todo el motor lleva `'worklet'`). Solo cambia el `d` de cada capa. Con «reducir movimiento», quieto en la pose central. En los isométricos el cuerpo no se mueve y late el músculo principal.
8. **Color.** Base monocroma del brand book (cuerpo `ink8`, lado lejano `ink4`, banco `ink2`, carga `ink9`); el único color es el acento de IRON `#3D7BFF`: principal al 100 %, secundarios al 45 % (más bajos en el lado lejano).

Regla del plugin de worklets: captura lo que usa una función al definirla, así que en `dibujo.ts` cada función va después de las que llama (si no, «x is not a function» en Jest y en el móvil).

## Biomecánica comprobada en tests

`src/iron/__tests__/biomecanica.test.ts` mide el esqueleto cada 25 ms de todo el ciclo:

- **Sentadilla con barra (barra alta):** barra sobre el medio del pie (±2), pies planos, cadera por debajo de la rodilla abajo, arriba de pie con tronco casi vertical, cabeza con el tronco, manos en la barra.
- **Press de banca:** antebrazo vertical (±15°) todo el recorrido, la barra toca el pecho bajo (60 a 85 % del tronco) y acaba sobre los hombros, trayectoria en J, pies planos y cabeza en el banco.
- **Remo con mancuerna:** antebrazo vertical (±15°), tronco quieto a 20°, el codo pasa la línea de la espalda arriba, rodilla y mano en el banco, pie plano.
- **Curl de bíceps:** hombro entre 0 y 15° (sin balanceo), tronco quieto, recorrido de 8 a 140°, bajada más lenta que la subida.
- **Plancha:** codo bajo el hombro, hombro, cadera y tobillo en línea (±1), apoyo en antebrazo y puntas.
- **Todos:** nada atraviesa el suelo y el ciclo cierra sin salto.

`esquema.test.ts` comprueba el archivo contra el catálogo (id = archivo, registrado), textos en `es/iron.json` sin raya ni guion medio, cues de 2 a 4 y ≤ 90 caracteres, músculos y material válidos, grupo = el del primer principal, sustitutos existentes, poses ordenadas, ángulos dentro de límites, isométrico coherente y un dibujo sin `NaN`. El tipo `Ejercicio` es estricto: tsc rechaza un material o una clave de texto fuera del esquema.

## Cómo se prueba

```bash
npx tsc --noEmit && npx eslint . && npx jest src/iron
```

En la web de desarrollo: `/kit` → «IRON · Ejercicios», o directamente `/kit/iron?ejercicio=press-banca`. `&t=2700` lo deja quieto en ese instante; `&solo=1&ancho=720` deja solo el escenario.

Vídeos:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://demo.supabase.co EXPO_PUBLIC_SUPABASE_KEY=demo \
  npx expo export --platform web --dev --output-dir <dir>
# servir <dir> con un servidor estático que devuelva index.html en cualquier ruta (puerto 8099)
PLAYWRIGHT_MODULE=<ruta a node_modules/playwright> \
  node scripts/iron/grabar.mjs --url http://localhost:8099 --salida ../coordinacion-winter-arc/iron-prototipo
```

## Cómo se añade un ejercicio

1. **Estudio** (de fuentes de entrenamiento, con nuestras palabras): posición inicial y final, trayectoria de la carga, ángulos de referencia, músculos, errores típicos, material y sustitutos razonables.
2. **Archivo** `src/iron/ejercicios/<id>.ts` copiando el más parecido. Elige vista (lateral casi siempre), ancla (lo que no se mueve) y encuadre.
3. **Poses clave.** Dos como mínimo (inicio y fin) y una intermedia si una trayectoria tiene que quedar recta (la barra sobre el medio del pie, el antebrazo vertical). Para los ángulos, `src/iron/autor.ts`: `ikDosEslabones` pone la mano o el pie donde tiene que ir y `articulacion.*` convierte los ángulos absolutos en ángulos de articulación. Un script con `sucrase-node` sirve para probar valores (así se hicieron estos 5).
4. **Registro**: una línea en `src/iron/ejercicios/index.ts`.
5. **Textos** en `src/i18n/es/iron.json` → `ejercicios.<id>` (nombre, cues, errores). Cues de una línea, en imperativo, con la seguridad delante; sin «—» ni «–».
6. **Tests:** el de esquema ya cubre el archivo nuevo. Añade en `biomecanica.test.ts` las 2 o 3 reglas que definen la técnica de ese ejercicio.
7. **QA visual:** `/kit/iron?ejercicio=<id>` y `node scripts/iron/grabar.mjs --solo <id>`. Mirar postura, rango completo, que ninguna articulación haga algo imposible y que el músculo iluminado sea el correcto. Si es posible, revisión de alguien que entrene.

## Estimación para el catálogo completo

Medido con estos 5 (motor aparte):

| Tipo de ejercicio | Tiempo por ejercicio |
|---|---|
| Variante de uno que ya existe (mancuerna ↔ barra, inclinado, agarre) | 30 a 45 min |
| Nuevo con material ya dibujado (barra, mancuerna, banco, peso corporal) | 1 a 1,5 h |
| Nuevo con escorzo o con dos lados distintos (remo a una mano, zancada) | 1,5 a 2,5 h |
| Primera vez de un material nuevo (polea con cable, máquina guiada, kettlebell, banda, barra de dominadas, paralelas) | +3 a 4 h una vez por material |
| Vista frontal (elevaciones laterales, jalón al pecho visto de frente) | +1 h la primera, luego como el resto |

Para un catálogo base de **unos 150 ejercicios** (≈ 60 variantes, 70 nuevos, 20 con escorzo o lados distintos) y 6 materiales nuevos: ≈ 40 + 90 + 40 + 20 ≈ **190 h de trabajo de chat**, más QA por grupo (≈ 1 h por grupo y ronda). Por grupos, en el orden de la propuesta: pecho, espalda, pierna, hombro, brazo, core y cardio/peso corporal; cada grupo pasa QA antes de seguir.

## Fase 2: grupos musculares y material

**Músculos ya en el mapa** (capas lateral y frontal): pectoral; deltoides anterior, lateral y posterior; bíceps, tríceps, antebrazo; dorsal ancho, trapecio, romboides y trapecio medio, lumbares; recto abdominal, oblicuos; glúteo, cuádriceps, isquiotibiales, aductores, gemelos.

**Músculos que faltan para el catálogo completo:** pectoral superior (porción clavicular) separado del resto, serrato anterior, manguito rotador (para facepull y rotaciones), braquial y braquiorradial separados del antebrazo, flexores de cadera (psoas), abductores (glúteo medio), sóleo y tibial anterior, transverso del abdomen, cuello (esternocleidomastoideo). Cada uno es una forma lateral y otra frontal en `musculos.ts`.

**Grupos** (`GrupoMuscular`): pecho, espalda, hombro, brazo, pierna, core. Para la fase 2 se añade **cardio / peso corporal** (saltos, burpees, comba) como grupo de entrega aunque no tenga músculo propio.

**Material** (`Material`):

| Material | Estado |
|---|---|
| Barra | Dibujada (disco de perfil; barra de frente en la vista frontal) |
| Mancuerna | Dibujada (de punta y de lado) |
| Banco plano | Dibujado |
| Peso corporal | Sin dibujo |
| Banco inclinado y declinado | Falta (el plano con respaldo girado) |
| Polea (cable, asas, cuerda, barra) | Falta: el cable es una recta del agarre a la polea que se recalcula en cada cuadro |
| Máquina guiada (prensa, extensión, curl femoral, pec deck, jalón) | Falta: una pieza por máquina, con su eje |
| Kettlebell | Falta |
| Banda elástica | Falta (una curva entre el anclaje y el agarre) |
| Barra de dominadas y paralelas | Falta (escenario fijo) |
| Rack y soportes | Falta (escenario fijo) |
| Esterilla, cajón, comba | Falta |

## Riesgos

- **Proyección 2D.** Los movimientos con mucha rotación fuera del plano (aperturas, elevaciones laterales, giros) se ven peor de perfil; para ellos, vista frontal. Un motor 3D (esqueleto con dos ángulos por articulación y proyección ortográfica) es la evolución natural si hiciera falta; el formato de datos cambiaría poco.
- **Rendimiento.** 40 capas animadas por maniquí. Fluido en la web; falta medirlo en un Android de gama baja. Si hiciera falta, se agrupan las capas de un mismo color en una sola.
- **Biomecánica.** Revisada con reglas medibles y a ojo; falta la revisión de alguien que entrene.

## Lo que necesito de otros equipos

- **Cliente:** `modoAcento` en `src/design/tokens.ts`. Hasta entonces el azul de IRON vive en `src/components/iron/estilo.ts` (`ACENTO_IRON`); al integrar se cambia por `modoAcento.iron` en esa línea.
- **Idiomas:** el namespace nuevo `iron` está registrado en `src/i18n/recursos.ts` y su JSON en `src/i18n/es/iron.json` (la estructura actual del repo; el encargo hablaba de `src/i18n/locales/es`). Si Idiomas mueve los catálogos a `locales/`, `iron.json` se mueve con ellos.
- **Coordinador:** decidir si `/kit/iron` entra en la integración (solo desarrollo) y quién hace la revisión de técnica.
