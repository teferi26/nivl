# NIVL 1.0.10 · Idiomas: informe de cierre (tanda 8)

Rama `winter2/1010-i18n`. Tandas 0 a 8 hechas. El español sale idéntico a la línea base de 40abdbe: `node scripts/i18n/verificar-es.mjs` da 0 diferencias sin explicar en los 32 namespaces.

## Inventario final

`node scripts/i18n/inventario.mjs` da **0 textos sueltos** en todo lo que es de Experiencia:

- `src/app` y `src/components` (salvo lo que queda fuera a propósito: `pro.tsx`, `ProOffer.tsx`, el kit y los demos);
- `src/lib/voice.ts`, `src/lib/notifications.ts` y `src/lib/useNotificationRouting.ts` (este último entra en el inventario en la tanda 8, en `avisos`).

El inventario recorre 237 archivos. La línea base tenía 2.520 textos.

## Claves por namespace

Hojas de texto de cada `src/i18n/es/<ns>.json` (un banco de frases de `voz` cuenta una por frase).

| ns | claves | ns | claves | ns | claves |
|---|---:|---|---:|---|---:|
| acceso | 65 | dieta | 51 | onboarding | 69 |
| agenda | 83 | economia | 102 | oraculo | 38 |
| amigos | 195 | fotos | 94 | perfil | 154 |
| arena | 26 | gym | 90 | puertas | 68 |
| avances | 79 | habitos | 44 | raiz | 108 |
| avisos | 18 | hoy | 75 | resumen | 39 |
| campanas | 95 | informe | 49 | share | 19 |
| cardio | 64 | memoria | 43 | ui | 27 |
| celebracion | 2 | nutricion | 48 | voz | 70 |
| coach | 90 | comun | 34 | | |
| compra | 28 | contrato | 121 | | |
| creador | 63 | diario | 159 | | |

**Total: 2.310 claves** en 33 namespaces.

## Tanda 8

1. **`voice.ts` → `voz.json`.** Cada línea del banco es un array del catálogo; `pick()` elige una al azar sobre `t('voz:<línea>', { returnObjects: true })`, al llamar y nunca al cargar. Firmas públicas iguales (`voice.*`, `deMisiones`, `desgloseXp`, `textoAviso`, `RUTA_AVISO`, `RUTAS_PERMITIDAS`, `rutaSegura`). Son los textos de la voz de la 1.0.9. Las frases de racha y de avisos con cifra pasan a plural con `count`. «Tu duelo»/«Tus duelos» y «de la misión»/«de las misiones» no llevan la cifra, así que son dos frases enteras. `voice.test.ts` pasa sin tocarlo.
2. **`notifications.ts` y `useNotificationRouting.ts` → `avisos.json`:**
   - títulos y cuerpos de los avisos locales;
   - nombres de los canales de Android;
   - botones de las categorías (Hecho, Posponer 10 min, Reportar);
   - frases de error que se enseñan en Perfil;
   - el texto de reserva al posponer.

   El cuerpo fijo del bloque («Es la hora de este bloque. El detalle está en Hoy.», Apple 4.5.4) es el mismo.
   **Reprogramar al cambiar de idioma:**
   - `registrarFuenteAvisos` se suscribe a `alCambiar` mientras Hoy tiene la fuente registrada y llama a `reprogramarAvisosDelPlan`. Es el mismo debounce de 2 s, así que con la llamada que ya hacía Perfil al elegir idioma sale una sola programación.
   - La firma del despertador lleva el idioma de la interfaz.
   - Los bloques, el cierre, los canales y las categorías se rehacen solos, porque al cambiar la interfaz se remonta el árbol y Hoy vuelve a llamar a `inicializarAvisos` y `reconciliarAvisosDelDia`.
3. **Infraestructura:**
   - `completarPlurales` y `pseudoArbol` conservan los arrays;
   - `catalogos.test` acepta una clave que es un banco (`clave.0`);
   - `i18n.test` comprueba los arrays en `es` y en `xx`.
4. **`nombreMes()`** en `@/i18n/formato`: en `es` da los meses largos en minúscula, idénticos a los que tenía `agenda:derivar.meses`, y en el resto de idiomas usa Intl. La agenda lo usa y esas 12 claves dejan el catálogo. Tiene su test en `formato.test.ts`.
5. **Consolidación en `comun`,** solo lo evidente y con el mismo texto:
   - `cardio:fila.eliminar` y `gym:rutina.eliminar` pasan a `comun:eliminar`;
   - `gym:hojaDia.nombre` pasa a `comun:nombre`;
   - `agenda:derivar.misiones_*` pasa a `comun:mision_*`;
   - `fotos:dias_*` y `hoy:enJuego.dias_*` pasan a `comun:dia_*`.

   **Se dejan a propósito:**
   - «Hoy» como fecha (agenda, campañas, fotos, gym) no es la pestaña `comun:destino.hoy`;
   - «Perfil» de memoria es una categoría;
   - «Misiones», «Racha», «Progreso» y «Cuerpo» son rótulos de cada pantalla;
   - `arena:heroRango.dias` usa `{{count, miles}}`.
6. **`literales.test` › «el inventario ve el código de Experiencia»** pedía más de 1.000 textos sueltos, y ahora lo normal es 0. Ahora comprueba tres cosas, y el motivo está en un comentario del test:
   - que el inventario recorre más de 200 archivos de Experiencia y ve los namespaces clave;
   - que la línea base está entera (más de 2.000 textos);
   - que cada namespace de la línea base ya tiene catálogo.

   Para eso `inventario.mjs` tiene `--archivos`.

## Diferencias aceptadas (`textos-es.aceptados.tsv`)

En total hay 1.039 líneas. Cada bloque lleva su `#` con el motivo.

| Motivo | Dónde | Líneas aprox. |
|---|---|---:|
| Frases partidas que pasan a frase entera o a plural con `count`, y plantillas con `${}` que la línea base no veía | todas las tandas (el grueso de 2, 3, 4, 5, 6 y 7) | ~720 |
| Textos repetidos que el catálogo guarda una vez | 1, 2, 3, 4, 5, 6, 7 y 8 | ~150 |
| Días, meses y mayúsculas que salen de `formato` (`nombreDia`, `nombreMes`, `mayus`, `capital`, `decimal`) | 1, 2, 3, 4, 5 y 6 | ~60 |
| Lo marcado con `i18n-ok`: la marca NIVL y unidades como XP, kg, d, h, kcal o g | 1, 2, 3, 4, 5 y 7 | ~45 |
| El selector «Idioma del coach», que es nuevo en la 1.0.10 | 0 | 12 |
| Merge de integración (90d3829) | | 3 |

El número exacto por bloque sale con:

```
awk -F'\t' '/^#/{n++;h[n]=$0;next} NF>=3{c[n]++} END{for(i=1;i<=n;i++)print c[i]"\t"h[i]}' docs/i18n/textos-es.aceptados.tsv
```

## Lo que queda para la 1.1.0

1. **Textos de las librerías de otros equipos:** 943 textos en 51 archivos de `src/lib`. Los que más tienen:

   | Archivo | Textos |
   |---|---:|
   | proplans | 217 |
   | achievements | 88 |
   | kinds | 77 |
   | coach | 47 |
   | creatorprogram | 43 |
   | coachvoz/texto | 37 |
   | oracle | 33 |
   | creatormath | 32 |
   | consentmath | 31 |
   | socialmath | 29 |

   Cada equipo los pasa a su propio namespace. Se consumen tal cual, como `DIFFICULTY_LABEL`, `STAT_LABEL`, `MODULO_DE_ACTO`, `DESCARGO_SALUD` y los nombres de `RANGOS`.
2. **`pro.tsx` (39) y `ProOffer.tsx` (38),** de Compras.
3. **El kit y los demos:** 842 textos en 29 archivos de datos ficticios. Se quedan en español.
4. **`expo-localization`,** con el inglés: hoy el idioma del teléfono se lee sin código nativo (`src/i18n/dispositivo.ts`).
5. **El inglés:**
   - `src/i18n/en/*.json`, y `catalogos.test` ya comprueba las variables;
   - `idiomaInterfaz()` deja de ser siempre `es`;
   - el selector pasa a ser «Idioma».
6. **Pendientes de forma** que en español no cambian y se dejaron para no tocar la salida:
   - «Tendencia de 1 datos» y otros casos apuntados como «si la salida cambia, no hay plural»;
   - el francés necesitará un polyfill de `Intl.PluralRules` en Hermes;
   - el formato «+15 XP: 10 de ... + 5 ...» de `desgloseXp` y el título «07:30 · Bloque» de los avisos de bloque son solo puntuación en el código, sin palabras; si otro idioma necesita otro orden, pasan a una clave.
7. **Regla de ESLint (opcional en el plan):** no se ha hecho. `literales.test` ya cubre lo mismo en CI.
