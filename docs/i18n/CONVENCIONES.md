# NIVL 1.0.10 · Convenciones de idiomas (tandas 2 a 7)

Salen de la tanda 1 (ui, arena, raiz). Valen para todas las tandas que van en paralelo. Si algo no encaja, se pregunta antes de inventar otra forma.

## 1. Dónde va cada texto

- **Un namespace por carpeta:** `src/components/<carpeta>/**` y su pantalla de `src/app` van en `src/i18n/es/<ns>.json` (el mapa está en `namespaceDe`, `scripts/i18n/inventario.mjs`).
- **Cada tanda toca solo sus JSON.** `recursos.ts`, `tipos.d.ts` y `comun.json` no se tocan.
- **Las puertas de la raíz son de la tanda 3, en `puertas`:** `EdadMinima`, `ConsentimientoSalud`, `ConsentimientoIA`, `DenunciarIA` y `denunciaIA.ts`.
- **No se migran aquí:**
  - los textos de `src/lib` de otros equipos (`DIFFICULTY_LABEL`, `STAT_LABEL`, `MODULO_DE_ACTO`, `DESCARGO_SALUD`...): se consumen tal cual y sus dueños los migran en la 1.1.0;
  - pro.tsx, ProOffer.tsx, el kit y los `demo.tsx` (datos ficticios).

## 2. `comun.json` está CONGELADO

Nadie añade, quita ni renombra claves de `comun`. Si hace falta una que no está, va en el namespace propio; la tanda 8 consolida.

| Clave | Texto |
|---|---|
| `cancelar` | Cancelar |
| `reintentar` | Reintentar |
| `guardar` | Guardar |
| `guardarCambios` | Guardar cambios |
| `cerrar` | Cerrar |
| `volver` | Volver |
| `eliminar` | Eliminar |
| `quitar` | Quitar |
| `compartir` | Compartir |
| `ahoraNo` | Ahora no |
| `masTarde` | Más tarde |
| `abrirAjustes` | Abrir ajustes |
| `cerrarSesion` | Cerrar sesión |
| `verNivlPro` | Ver NIVL Pro |
| `nombre` | Nombre |
| `sistemaNoResponde` | El sistema no responde |
| `sinConexion` | Sin conexión |
| `sinCamara` | Sin cámara |
| `sinDato` | sin dato |
| `denunciarRespuesta` | Denunciar respuesta |
| `topeDiarioXp` | Tope diario de XP alcanzado |
| `lema` | UN 1 % MEJOR CADA DÍA |
| `destino.hoy` | Hoy |
| `destino.agenda` | Agenda |
| `destino.coach` | Coach |
| `destino.habitos` | Hábitos |
| `destino.campanas` | Campañas |
| `destino.perfil` | Perfil |
| `mision_one` / `_other` | {{count}} misión / misiones |
| `dia_one` / `_other` | {{count}} día / días |
| `xp_one` / `_other` | {{count, miles}} XP |

Qué entra en `comun` y qué no:
- **Entra:** verbos de botón genéricos, los nombres de las seis pestañas y estados del sistema que dicen lo mismo en cualquier pantalla.
- **No entra:** un texto que solo coincide por casualidad. «Racha» de HeroRango es un rótulo de cifra y va en `arena`; si coach dice «Racha», va en `coach`. Dos claves con el mismo texto en dos namespaces está bien: el verificador lo cuenta así.

## 3. Cómo se llaman las claves

**Forma:** `ns:componente.clave`, con un JSON anidado por componente en camelCase. Ejemplos:
- `raiz:questForm.dificultad`
- `arena:heroRango.cambiarFoto`
- `ui:ceremonia.tocaCerrar`

**Nombres semánticos,** que digan qué es y no cómo se ve ni qué dice:
- bien: `vacioTitulo`, `vacioCuerpo`, `pedirPlan`, `errorTitulo`;
- mal: `texto1`, `sinOrdenesParaHoy`.

**Sufijos fijos:**
- `...A11y`: `accessibilityLabel`, como `dificultadA11y` o `cerrarA11y`;
- `...Pista`, o `pista` a secas: `accessibilityHint`;
- `...Ayuda`: el texto pequeño de debajo de un control;
- `eyebrow`, `titulo` y `cuerpo` cuando la pieza los tiene.

**Variantes por un dato,** en un subárbol con el valor como nombre:
```ts
`raiz:questForm.${s}.nuevo`, donde s es 'mision' | 'habito'
```
La clave queda tipada si `s` es una unión cerrada.

**Accesibilidad:** las etiquetas para el lector de pantalla también se traducen, sin excepción.

## 4. Frases enteras, nunca trozos

**Cada combinación es una frase entera** con `{{var}}`. Antes:
```ts
`${hora} ${titulo}${ahora ? ', ahora' : ''}${hecho ? ', hecho' : ''}`
```
Ahora, tres claves:
```json
"a11y": "{{hora}} {{titulo}}",
"a11yAhora": "{{hora}} {{titulo}}, ahora",
"a11yHecho": "{{hora}} {{titulo}}, hecho"
```
Y se elige la clave:
```ts
t(esActual ? 'raiz:bloque.a11yAhora' : hecho ? 'raiz:bloque.a11yHecho' : 'raiz:bloque.a11y', { hora, titulo })
```

**Un prefijo opcional** se hace con una frase que envuelve a otra:
```json
"a11ySiguiente": "Siguiente: {{etiqueta}}"
```

**Las comillas van dentro del catálogo:**
```json
"eliminarMensaje": "\"{{titulo}}\" y todo su historial..."
```

**Saltos de línea pensados para el diseño:** `\n` dentro del texto (`ui:sidebar.lema`). Así cada idioma lo pone donde le toque.

**El mismo texto en dos componentes de un namespace** usa una sola clave compartida (`raiz:bloque.*` lo usan LineaDeTiempo y OrdenDelDia).

## 5. Plurales: con `count`

```json
"faltaNiveles_one": "Falta {{count}} nivel",
"faltaNiveles_other": "Faltan {{count}} niveles"
```

```ts
t('ui:ceremonia.faltaNiveles', { count: n })
```

- **Siempre `_one` y `_other`,** con las mismas variables. `_one` puede escribir el número a mano, pero mejor con `{{count}}`.
- **Nada de `n === 1 ? 'día' : 'días'`** en el código.
- **Si la frase lleva dos cantidades,** se compone con plurales sueltos dentro de una frase: `"faltanAmbos": "Faltan {{niveles}} y {{dias}}"`, con `niveles` y `dias` salidos de `t('...niveles', { count })` y `t('...diasActivos', { count })`.
- **Cifras con punto de miles:** `{{count, miles}}`, que escribe «1.840» como `formatoMiles` (`arena:heroRango.dias_other`).
- **Si la salida en español cambia, no hay plural.** Ejemplo: «Tendencia de 1 datos» se queda como estaba (`{{n}}`, sin count), porque la 1.0.10 sale idéntica. Se apunta para la 1.1.0.

## 6. Nunca `t()` al cargar el módulo

**`t()` solo se llama dentro de una función o de un componente.** Una tabla de módulo guarda la clave, no el texto, y se traduce al pintar. Por ejemplo, `NAV_ITEMS` guarda `destino: 'hoy'` y `navItemDe`/`nombreDestino()` hace el `t()`. `TEXTOS` de QuestForm pasó a ser `textosDe(sustantivo)`.

**Una constante exportada con texto pasa a ser una función:**
```ts
leidoSinDato()
```
`LEIDO_SIN_DATO` se queda como alias congelado, con `@deprecated`, solo porque `sindato.test.ts` lo fija y no se toca. **Código nuevo: `leidoSinDato()`.**

**Están permitidos:**
- valores por defecto de una prop: `holdingLabel = t('raiz:holdToSign.noSueltes')`, `rotulo = t('comun:sistemaNoResponde')`;
- textos de `throw new Error(t(...))` que acaban en pantalla.

**No se llama `t` a ninguna variable local,** porque taparía la importación. En QuestForm se renombró a `tx` y en Ceremony a `reloj`.

## 7. TextoRico (negritas)

Una frase con una parte en negrita va entera en el catálogo, con `<b></b>`:
```json
"pausa": "Te quedan <b>{{n}} días</b> de pausa."
```
Se pinta así:
```tsx
<TextoRico style={...}>{t('perfil:pausa', { n })}</TextoRico>
```
- Para `accessibilityLabel`, `sinMarcas(texto)`.
- Solo se entiende `<b>`.
- Nunca se parte en tres `<Text>`.

## 8. Lo que NO se traduce: `// i18n-ok`

Solo se marca:
- **la marca:** `NIVL`;
- **las unidades:** `XP`, `PB`, `kg`, `d`;
- **valores técnicos que no se leen:** la meta `noindex, nofollow`.

Cómo se marca:
- **en código,** al final de la línea o en la anterior: `// i18n-ok: unidad`;
- **en JSX,** pegado a la etiqueta de apertura y sin espacio, porque un espacio en la misma línea se pinta:
  ```tsx
  <Text style={styles.marca}>{/* i18n-ok: la marca */}
    NIVL
  </Text>
  ```
- **o en la línea anterior al elemento,** dentro de una lista de hijos:
  ```tsx
  {/* i18n-ok: unidad */}
  <Chip label="XP" .../>
  ```

**Días de la semana, meses, cifras y mayúsculas** no van al catálogo: se usan `nombreDia`, `capital`, `mayus`, `miles`, `decimal` y `fechaCorta` de `@/i18n/formato`. Por ejemplo, las letras L M X de QuestForm son `nombreDia(i, 'letra')`.

## 9. Cómo se verifica una tanda

1. **Inventario de la tanda:**
   ```
   node scripts/i18n/inventario.mjs --tsv | awk -F'\t' '$1=="<ns>"'
   ```
   Tiene que salir vacío para tus namespaces.
2. **Verificación del español:**
   ```
   node scripts/i18n/verificar-es.mjs --detalle
   ```
   0 diferencias. Lo que cambia a propósito se apunta en `docs/i18n/textos-es.aceptados.tsv` (`ns TAB +|- TAB texto`), con una línea `#` encima que diga por qué. Los motivos válidos de la tanda 1:
   - un texto repetido que el catálogo guarda una vez;
   - una frase partida que pasa a frase entera o a plural;
   - un texto que la línea base no veía (plantillas con `${}`);
   - días que salen de `formato`;
   - lo marcado con i18n-ok.
3. **Tests y comprobaciones:**
   - `CI=true npx jest --ci src/i18n` (literales y catálogos);
   - `npx tsc --noEmit`: las claves están tipadas, así que una clave que no existe no compila;
   - `npx eslint src --max-warnings 0`;
   - `CI=true npx jest --ci` COMPLETO. Los tests que fijan textos en español no se tocan: si uno falla, el catálogo dice otra cosa.
4. **Galería antes y después:**
   - export:
     ```
     EXPO_PUBLIC_SUPABASE_URL=https://demo.supabase.co EXPO_PUBLIC_SUPABASE_KEY=demo npx expo export --platform web --dev --output-dir <dir>
     ```
     Sin esas variables, la galería revienta;
   - Chrome sin cabeza contra `/kit/pantallas?pantalla=<id>&estado=<e>&ancho=375&quieto=1&solo=1`;
   - se comparan píxel a píxel.
   
   Ojo: los esqueletos que respiran y el aro del avatar no son deterministas. Si una captura difiere, se repite la de antes: si también difiere consigo misma, no es tu cambio.
5. **Pseudoidioma:** con `&idioma=xx`, todo lo de tus carpetas sale entre ⟦ ⟧. Lo que no sale así es de otra tanda o de `src/lib`.

## 10. Lo que cambió en la infraestructura en la tanda 1

- **`inventario.mjs`:**
  - las cinco puertas de la raíz pasan a `puertas`;
  - los trazados SVG (`d="M0 9.5H10..."`) ya no cuentan como texto.
- **`textos-es.base.tsv`:** se regeneró con `--base` desde 40abdbe con esas dos reglas. Salen 27 trazados y 16 textos pasan de raiz a puertas; el resto es idéntico.
- **APIs nuevas para consumir:**
  - `nombreDestino(destino)` en `@/components/ui/navItems`;
  - `leidoSinDato()` en `@/components/ui`.
- **QuestForm:** `sustantivo` ya no tiene valor por defecto en la firma; sin él, sigue siendo misión.
