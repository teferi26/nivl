# Sistema de diseño y componentes base

> Área DSG · auditoría de código NIVL · anclada al código real

Alcance leído: `src/lib/theme.ts`, `src/components/SystemWindow.tsx`, `src/components/Hexagon.tsx`, `src/components/SystemButton.tsx`, `src/components/XPBar.tsx`, `src/components/QuestItem.tsx`, `src/components/QuestForm.tsx`, `src/components/Heatmap.tsx`, `src/components/XpToast.tsx`, `src/components/LevelUpOverlay.tsx`, y los consumidores en `src/app/` (`_layout.tsx`, `(tabs)/_layout.tsx`, `(tabs)/index.tsx`, `(tabs)/mazmorras.tsx`, `(tabs)/perfil.tsx`, `dungeon/[id].tsx`).

Diagnóstico de una frase: el sistema de **color de marca** (paleta cian) y el de **familias tipográficas** (`fonts.*`) sí están tokenizados y se usan de forma disciplinada (170 referencias a `fonts.*` en 20 archivos). Pero **NO existe** escala de espaciado, de tamaño de fuente, de `letterSpacing` ni de radios; toda la sub-paleta morada de mazmorras está hardcodeada fuera de `theme.ts`; y varios componentes base (`SystemWindow`, `SystemButton`, `XPBar`) tienen huecos de robustez y accesibilidad.

---

## Bugs y riesgos

### CRIT-DSG-01 · La variante `outline` de SystemButton no está implementada; funciona solo por coincidencia · `SystemButton.tsx:13-28` · severidad alta
**Problema:** `Props.variant` admite `'solid' | 'outline' | 'danger'` y `outline` se usa en **14 sitios** (login, oraculo, QuestForm, gym ×2, dungeon, compra, dieta, perfil ×5, mazmorras, agenda). Pero el componente solo calcula `solid = variant === 'solid'` y `danger = variant === 'danger'`; **no hay rama para `outline`**. Hoy "funciona" porque el estilo `base` (borde `colors.cyan`, fondo transparente, label cian) coincide casualmente con el aspecto outline deseado. En el momento en que alguien cambie `styles.base` (p. ej. para dar fondo al sólido en `base` en vez de en `styles.solid`), las 14 pantallas con outline se romperán en silencio sin error de tipos. Además `outline` y el `solid`-no (default) son visualmente indistinguibles: no hay forma de pedir "botón neutro con borde tenue".
**Arreglo:** hacer explícita la rama outline:
```ts
const outline = variant === 'outline';
// ...styles
outline && styles.outline,   // p.ej. borderColor: colors.cyanDim
outline && styles.labelOutline, // color: colors.cyanText
```
y dejar `styles.base` sin asumir colores de una variante concreta. Así el contrato de tipos pasa a ser real.

### CRIT-DSG-02 · El spinner de carga ignora la variante `danger` (color cian sobre botón rojo) · `SystemButton.tsx:30` · severidad media
**Problema:** `<ActivityIndicator color={solid ? colors.bg : colors.cyan} />`. Para `variant="danger"` (borde rojo, label rojo) el indicador de carga sale **cian**, rompiendo el código de color justo en la acción destructiva. Cualquier botón peligroso con `loading` parpadea en el color equivocado.
**Arreglo:** `color={solid ? colors.bg : danger ? colors.red : colors.cyan}`.

### CRIT-DSG-03 · XPBar oculta el progreso pequeño y desborda el redondeo · `XPBar.tsx:12-16` · severidad media
**Problema:** `pct = Math.round(ratio * 100)` y la barra de relleno usa `width: \`${pct}%\``. Con un avance real bajo (p. ej. `into/next = 0,004`), `pct` redondea a `0` y la barra se ve **vacía aunque haya progreso** — sensación de "no cuenta lo que hago", grave en una app de XP. Simétricamente, `0.996` redondea a `100%` y aparenta nivel completo sin estarlo. El contenedor tampoco define `borderRadius`, por lo que el relleno tiene cantos vivos que chocan con el resto del lenguaje (paneles con corte diagonal, no rectángulos duros).
**Arreglo:** no redondear el ancho; usar el ratio continuo con un mínimo visible cuando hay algo de progreso:
```ts
const r = Math.min(1, Math.max(0, ratio));
const width = r > 0 && r < 0.02 ? '2%' : `${r * 100}%`;
```
y mantener el texto redondeado aparte si se quiere. Reservar `radius` como token (ver DSG-002).

### CRIT-DSG-04 · SystemWindow no pinta su marco en el primer frame (parpadeo) · `SystemWindow.tsx:25-46` · severidad media
**Problema:** el SVG del polígono solo se renderiza cuando `size` ya está medido (`{size ? (<Svg .../>) : null}`). En el primer paint `size` es `null`, así que el panel aparece **sin borde ni fondo** un fotograma y luego "salta" a tener marco cuando `onLayout` resuelve. En listas con muchos `SystemWindow` (Sistema, Mazmorras, Perfil) se percibe como parpadeo/POP del contorno en cada montaje y en cada cambio de pestaña (estas pantallas usan `useFocusEffect` que re-renderiza). El `<View style={styles.content}>` sí se pinta inmediatamente, agravando el desajuste: primero ves el texto flotando sin caja.
**Arreglo:** dar a `styles.box` un fondo y borde de respaldo (rectángulo) para el primer frame, de modo que el "salto" sea de rectángulo→rectángulo-con-corte y no de nada→algo:
```ts
box: { marginBottom: 12, backgroundColor: fill, borderWidth: 1, borderColor: color },
```
(pasando `fill`/`color` a estilo inline) o medir con `onLayout` en un contenedor padre y pasar tamaño fijo. Alternativa robusta: usar un `Polygon` con `vectorEffect`/`preserveAspectRatio` sobre un `viewBox` relativo (`0 0 100 100`) y `width="100%" height="100%"`, eliminando por completo la dependencia de medir píxeles (ver DSG-010).

### CRIT-DSG-05 · `colors` declarado `as const` rompe la asignación a props `string` con `exactOptionalPropertyTypes` / mutaciones · `theme.ts:1-22` + consumidores · severidad baja
**Problema:** `export const colors = { ... } as const` congela cada valor a su literal (`bg: '#060B16'`). Las props de los componentes tipan `color?: string` (SystemWindow, Hexagon, XPBar) y reciben `colors.cyan` etc., lo cual funciona; pero cualquier helper que intente **derivar** color (mapear stat→color, construir variantes con opacidad, theming claro/oscuro futuro) no puede indexar `colors` con una clave dinámica sin castear, y no hay un tipo `ColorToken` exportado. Es deuda que bloquea el siguiente paso natural (paleta por stat, modo daltónico). No es un crash, es rigidez estructural.
**Arreglo:** exportar tipos utilitarios `export type ColorToken = keyof typeof colors;` y `export type FontToken = keyof typeof fonts;`, y considerar un helper `color(token: ColorToken)` para acceso indexado seguro.

### CRIT-DSG-06 · El corte (`cut=14`) de SystemWindow es absoluto y degenera en ventanas pequeñas o muy bajas · `SystemWindow.tsx:39` · severidad baja
**Problema:** el polígono resta `cut` (14 px fijos) a las esquinas superior-izq e inferior-der. Si un `SystemWindow` se usara con poca altura (`size.h` < 2·cut ≈ 28) los puntos `${size.h - cut}` y `${size.w - cut}` se cruzan y el polígono se autointerseca (corte invertido / artefacto). Hoy no se ve porque todos los paneles son altos, pero es un caso límite latente: cualquier uso futuro como chip/badge con SystemWindow lo dispara.
**Arreglo:** acotar el corte al tamaño real: `const c = Math.max(0, Math.min(cut, size.w / 2, size.h / 2));` y usar `c` en `points`.

---

## Mejoras

> Nivel: bug · refactor · UX/UI · a11y (accesibilidad) · perf · test · límite · feature.
> Impacto 1-5 · Esfuerzo S/M/L.

### Tokens que faltan en theme.ts (la carencia central del área)

### DSG-001 · Crear escala de espaciado tokenizada
**Qué:** No existe `spacing`. Hay decenas de `padding`/`margin`/`gap` mágicos: `padding: 16` (todas las `content`), `padding: 14` (`SystemWindow.content`), `marginBottom: 12/14`, `gap: 8/10/12`, `paddingVertical: 7/9/10/12`. Definir `export const spacing = { xs:4, sm:8, md:12, lg:16, xl:20, xxl:32 } as const` y migrar. **Dónde:** `theme.ts:1` (añadir) · **Impacto:** 5 · **Esfuerzo:** L

### DSG-002 · Crear escala de radios (`radius`) y aplicarla
**Qué:** No hay token de radio; los pocos redondeos son mágicos (`borderRadius: 32`/`29`/`16` en avatares de perfil, `XPBar` sin radio). Definir `radius = { none:0, sm:2, pill:999 }` coherente con el lenguaje anguloso (la marca casi no usa redondeo salvo avatares circulares). **Dónde:** `theme.ts:1`, `XPBar.tsx:14`, `perfil.tsx:404,515` · **Impacto:** 3 · **Esfuerzo:** M

### DSG-003 · Crear escala tipográfica (tamaños + lineHeight + letterSpacing)
**Qué:** `fonts` solo mapea *familias*. Los `fontSize` (10,11,12,13,14,15,16,18,19,20,22,30,32,34,40,84) y `letterSpacing` (1,1.5,2,2.5,3,4,6,8) están repartidos a mano por todo el código sin sistema. Crear `type = { caption:11, body:13, label:12, title:16, h1:18, display:30, hero:84 }` y `tracking = { tight:1, label:2, heading:2.5, brand:4, hero:8 }`. **Dónde:** `theme.ts:24` (añadir) · **Impacto:** 5 · **Esfuerzo:** L

### DSG-004 · Mover la sub-paleta morada de mazmorras a theme.ts
**Qué:** `#191D3D` (relleno/track morado) aparece hardcodeado en `mazmorras.tsx:118,252`, `dungeon/[id].tsx:176,271,332,369`; `#A697F0` en `dungeon/[id].tsx:314`; `#15182E` en `dungeon/[id].tsx:322`. Son tokens de marca de facto (dominio morado = mazmorras) que nunca llegaron a `theme.ts`. Añadir `purpleFaint:'#191D3D'`, `purpleText:'#A697F0'`, `purpleLine:'#15182E'`. **Dónde:** `theme.ts:11-13` · **Impacto:** 4 · **Esfuerzo:** S

### DSG-005 · Tokenizar el color de backdrop de modales
**Qué:** `'rgba(2, 6, 14, 0.85)'` se repite en 7 archivos (`QuestForm.tsx:163`, `gym.tsx:424`, `dieta.tsx:228`, `agenda.tsx:245`, `mazmorras.tsx:222`, `perfil.tsx:474`, `dungeon/[id].tsx:339`) y hay dos variantes sueltas `0.92` (`LevelUpOverlay.tsx:79`) y `0.95` (`perfil.tsx:500`). Definir `colors.scrim` (y quizá `scrimStrong`) una sola vez. **Dónde:** `theme.ts:1` · **Impacto:** 4 · **Esfuerzo:** S

### DSG-006 · Tokenizar el rojo de texto sobre panel de alerta
**Qué:** `alertBody.color: '#E8C9CD'` está hardcodeado en `index.tsx:447` (texto rosado legible sobre `redPanel`). Es un color semántico ("texto sobre fondo de alerta") sin token. Añadir `colors.redText`. **Dónde:** `theme.ts:14-16`, `index.tsx:447` · **Impacto:** 3 · **Esfuerzo:** S

### DSG-007 · Tokenizar grosores de borde y dejar de repetir `1.5`
**Qué:** `strokeWidth={1.5}` (SystemWindow, Hexagon), `borderWidth: 1.5` (SystemButton, sheets, rankBox, shareCard…) y `borderWidth: 1` conviven sin token. Definir `border = { hair:1, thin:1.5, bold:2 }`. **Dónde:** `theme.ts:1`, `SystemWindow.tsx:42`, `Hexagon.tsx:30`, `SystemButton.tsx:48` · **Impacto:** 2 · **Esfuerzo:** M

### DSG-008 · Exportar tipos `ColorToken` / `FontToken`
**Qué:** Sin tipos derivados de `colors`/`fonts` no se puede indexar dinámicamente (stat→color, etc.) sin castear. **Dónde:** `theme.ts:22,30` · **Impacto:** 3 · **Esfuerzo:** S

### DSG-009 · Documentar la semántica de cada color en theme.ts
**Qué:** `theme.ts:1-22` es una lista plana sin comentarios; no se distingue qué es superficie (`bg`,`panel`,`panelDeep`,`tabBar`), qué es línea (`line`), qué es marca (`cyan`/`purple`/`red`/`amber`) ni qué dominio usa qué. Agrupar con comentarios `// superficies`, `// marca cian`, `// marca morada (mazmorras)`, `// texto`. Reduce el hardcodeo futuro por desconocimiento. **Dónde:** `theme.ts:1-22` · **Impacto:** 3 · **Esfuerzo:** S

### SystemWindow

### DSG-010 · Render del polígono con viewBox relativo (elimina medir píxeles)
**Qué:** Sustituir el patrón "medir con onLayout → setState → render SVG" (`SystemWindow.tsx:25-45`) por un `<Svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">` con puntos en porcentaje. Quita el `useState`, el re-render y el parpadeo de CRIT-DSG-04 de raíz. **Dónde:** `SystemWindow.tsx:25-45` · **Impacto:** 4 · **Esfuerzo:** M

### DSG-011 · Variante de color semántica en SystemWindow (`tone`)
**Qué:** Hoy cada pantalla pasa `color={colors.cyanDim} fill={colors.panel}` a mano, y para alerta `color={...redDim} fill={...redPanel}`, para mazmorra `color={purpleDim} fill={panelDeep}`. Añadir prop `tone?: 'default'|'alert'|'dungeon'|'muted'` que resuelva el par color/fill internamente. Elimina decenas de pares repetidos y centraliza el mapa semántico. **Dónde:** `SystemWindow.tsx:17-24`; consumidores `index.tsx:209,248,259,283,317`, `mazmorras.tsx:93,105,129` · **Impacto:** 4 · **Esfuerzo:** M

### DSG-012 · `cut` y grosor del trazo desde tokens, no literales
**Qué:** `cut = 14` y `strokeWidth={1.5}` son magia local. Tomar `cut` de `spacing`/un token `geometry.cut` y el grosor de `border.thin`. **Dónde:** `SystemWindow.tsx:20,42` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-013 · Permitir `contentStyle` con padding tokenizado por defecto
**Qué:** `styles.content` fija `padding: 14`. Varias pantallas ya luchan contra esto pasando `contentStyle`. Documentar el contrato y derivar el default de `spacing.md`. **Dónde:** `SystemWindow.tsx:55-57` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-014 · `pointerEvents="box-none"` para no bloquear toques del contenido
**Qué:** El `<Svg ... pointerEvents="none">` ya no captura toques (bien), pero el `<View style={styles.box}>` envolvente no declara comportamiento; si en el futuro el panel se hace `Pressable` (como ya ocurre envolviéndolo en `mazmorras.tsx:101`), conviene asegurar que el SVG absoluto nunca intercepte. Confirmar/forzar. **Dónde:** `SystemWindow.tsx:35-37` · **Impacto:** 1 · **Esfuerzo:** S

### DSG-015 · Sombra/elevación opcional para jerarquía de paneles
**Qué:** Todos los `SystemWindow` están al mismo plano visual; no hay forma de destacar el panel activo (p. ej. alerta del cierre vs módulos). Añadir prop `elevated?: boolean` con sombra sutil tokenizada. **Dónde:** `SystemWindow.tsx:51-54` · **Impacto:** 2 · **Esfuerzo:** M

### DSG-016 · Test de snapshot del polígono para varios tamaños
**Qué:** No hay test que fije los `points` del corte. Un test que renderice con `size` conocido y compare la cadena `points` evita regresiones al refactor (DSG-010). **Dónde:** nuevo `SystemWindow.test.tsx` · **Impacto:** 2 · **Esfuerzo:** M

### SystemButton

### DSG-017 · Implementar `outline` de forma explícita (cierra CRIT-DSG-01)
**Qué:** Ver bug. Añadir `styles.outline`/`styles.labelOutline` y rama `outline`. **Dónde:** `SystemButton.tsx:14-44` · **Impacto:** 4 · **Esfuerzo:** S

### DSG-018 · `accessibilityRole="button"` + estado disabled/busy accesible
**Qué:** El `Pressable` no expone rol ni estado a lectores de pantalla. Añadir `accessibilityRole="button"`, `accessibilityState={{ disabled: !!(disabled||loading), busy: !!loading }}` y `accessibilityLabel={title}`. **Dónde:** `SystemButton.tsx:17-28` · **Impacto:** 3 · **Esfuerzo:** S

### DSG-019 · Tamaño táctil mínimo (44×44) y `hitSlop`
**Qué:** `paddingVertical: 12` + label de 15 px ronda los 39 px de alto; por debajo del mínimo recomendado de 44. Añadir `minHeight: 44` o `hitSlop`. **Dónde:** `SystemButton.tsx:49-54` · **Impacto:** 3 · **Esfuerzo:** S

### DSG-020 · Soportar icono opcional (left/right)
**Qué:** Hoy SystemButton es solo texto; pantallas que quieren botón con icono usan `Pressable` suelto (p. ej. `addButton` en mazmorras/perfil). Añadir prop `icon?` para unificar. **Dónde:** `SystemButton.tsx:4-11` · **Impacto:** 3 · **Esfuerzo:** M

### DSG-021 · Variante de tamaño (`size?: 'sm'|'md'`)
**Qué:** Varias llamadas hacen `style={{ paddingVertical: 10 }}` para "encoger" el botón (`oraculo.tsx:138`). Formalizar tamaños en vez de overrides ad-hoc. **Dónde:** `SystemButton.tsx:4-11` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-022 · Estado disabled visual también en `danger`
**Qué:** `styles.disabled` solo baja opacidad; con `danger` (transparente) el contraste del label rojo al 45% puede quedar ilegible. Revisar contraste del disabled por variante. **Dónde:** `SystemButton.tsx:62-64` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-023 · Migrar fontSize/letterSpacing del label a tokens
**Qué:** `fontSize: 15, letterSpacing: 2` en `styles.label` son magia; pasar a `type`/`tracking`. **Dónde:** `SystemButton.tsx:68-73` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-024 · Feedback háptico opcional en press
**Qué:** Otras zonas (index) ya usan `expo-haptics`; el botón base podría aceptar `haptic?: boolean` para uniformar la sensación táctil. **Dónde:** `SystemButton.tsx:13-16` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-025 · Test de las tres variantes (estilos resueltos)
**Qué:** Sin test, el bug de `outline` pasó desapercibido. Test que monte solid/outline/danger y verifique color de label y de spinner. **Dónde:** nuevo `SystemButton.test.tsx` · **Impacto:** 3 · **Esfuerzo:** M

### XPBar

### DSG-026 · No redondear el ancho; mínimo visible para progreso pequeño (cierra CRIT-DSG-03)
**Qué:** Ver bug. **Dónde:** `XPBar.tsx:12-16` · **Impacto:** 4 · **Esfuerzo:** S

### DSG-027 · Animar la transición del relleno
**Qué:** El relleno cambia de ancho de golpe al ganar XP. Un `Animated.View` con `LayoutAnimation` o ancho animado daría sensación de "llenado" coherente con `XpToast`/`LevelUpOverlay`. **Dónde:** `XPBar.tsx:13-16` · **Impacto:** 3 · **Esfuerzo:** M

### DSG-028 · Accesibilidad: `accessibilityRole="progressbar"` + value
**Qué:** La barra no se anuncia. Añadir `accessibilityRole="progressbar"` y `accessibilityValue={{ now: pct, min:0, max:100 }}`. **Dónde:** `XPBar.tsx:13-14` · **Impacto:** 3 · **Esfuerzo:** S

### DSG-029 · Radio y altura desde tokens
**Qué:** `height = 6` por defecto y sin `borderRadius`. Tomar de `radius`/un token de tamaño de barra. **Dónde:** `XPBar.tsx:11,14` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-030 · Soporte de segmentos/umbral (opcional)
**Qué:** Para barras de mazmorra (objetivos discretos) un modo "segmentado" comunicaría mejor que un relleno continuo. Prop `segments?: number`. **Dónde:** `XPBar.tsx:4-9` · **Impacto:** 2 · **Esfuerzo:** M

### DSG-031 · Guardar contra `ratio` no finito
**Qué:** Si un consumidor pasa `into/next` con `next=0` se evita arriba, pero `XPBar` debería blindar `Number.isFinite(ratio)` por si llega `NaN`. **Dónde:** `XPBar.tsx:12` · **Impacto:** 2 · **Esfuerzo:** S

### Hexagon

### DSG-032 · Permitir `strokeWidth` configurable y tokenizado
**Qué:** `strokeWidth={1.5}` fijo (`Hexagon.tsx:30`); el `Ring` de LevelUp escala el hexágono ×2.1 y el trazo se ve fino/grueso inconsistente. Exponer prop y tomar default de token. **Dónde:** `Hexagon.tsx:30` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-033 · El SVG puede recortar el trazo en los bordes (sin padding interno)
**Qué:** El polígono llega a `x=0`/`y=0` y a `x=w`/`y=h`; con `strokeWidth` 1.5, medio trazo (0,75 px) queda fuera del `viewBox` y se recorta en los vértices laterales (`Hexagon.tsx:16-23,29`). Encoger los puntos por `strokeWidth/2` o ampliar el `viewBox`. **Dónde:** `Hexagon.tsx:16-30` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-034 · `accessibilityRole="image"` / ocultar a lectores cuando es decorativo
**Qué:** El hexágono que envuelve la inicial del avatar (index `:211`) o el `Ring` decorativo no se marcan; el lector puede leer ruido. Marcar `importantForAccessibility="no-hide-descendants"` cuando proceda. **Dónde:** `Hexagon.tsx:27`, `LevelUpOverlay.tsx:36-38` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-035 · `fill="transparent"` literal → token
**Qué:** `LevelUpOverlay.tsx:37` pasa `fill="transparent"`; usar un token `colors.transparent`/`'transparent'` centralizado para no mezclar literales. Menor. **Dónde:** `LevelUpOverlay.tsx:37` · **Impacto:** 1 · **Esfuerzo:** S

### DSG-036 · Extraer la geometría del hexágono a constante reutilizable
**Qué:** Los seis puntos (`0.5,0 · 0.93,0.25 …`) viven inline en `Hexagon`; si otra pantalla necesita el mismo polígono (insignias de logro, marcador de rango) se duplicará. Exportar `HEX_POINTS(w,h)`. **Dónde:** `Hexagon.tsx:16-25` · **Impacto:** 2 · **Esfuerzo:** S

### QuestItem

### DSG-037 · `accessibilityRole="checkbox"` + estado checked
**Qué:** La fila de misión es un `Pressable` con caja de check pintada a mano (`QuestItem.tsx:20-31`) sin rol ni estado. Añadir `accessibilityRole="checkbox"` y `accessibilityState={{ checked: completed, disabled: completed||busy, busy }}` con `accessibilityLabel` que incluya título + XP. **Dónde:** `QuestItem.tsx:20-24` · **Impacto:** 3 · **Esfuerzo:** S

### DSG-038 · Extraer la "checkbox" a componente base reutilizable
**Qué:** El mismo patrón de caja 20×20 con borde/relleno y check aparece en `QuestItem.tsx:68-82` y casi idéntico en `dungeon/[id].tsx:324-333` (con sub-paleta morada). Crear `<SystemCheckbox tone>` evita la duplicación y la divergencia de color. **Dónde:** `QuestItem.tsx:68-82` + `dungeon/[id].tsx:324-333` · **Impacto:** 3 · **Esfuerzo:** M

### DSG-039 · Tokenizar tamaños mágicos de la fila
**Qué:** `width/height: 20`, `paddingVertical: 9`, `gap: 10`, múltiples `fontSize` 11-15 sin tokens. **Dónde:** `QuestItem.tsx:56-120` · **Impacto:** 2 · **Esfuerzo:** M

### DSG-040 · `numberOfLines` + ancho del XP para títulos largos
**Qué:** El título usa `numberOfLines={1}` (bien) pero el bloque XP a la derecha no tiene ancho mínimo; títulos largos pueden empujar el XP y desalinear filas entre sí. Fijar ancho/min del `styles.xp`. **Dónde:** `QuestItem.tsx:49-51,113-117` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-041 · Contraste del tag de penalización
**Qué:** `penaltyTag` usa `colors.red` (#FF5C6B) sobre fondo de panel; a 11 px con `letterSpacing` puede quedar justo de contraste. Verificar ratio y, si hace falta, usar `redText`. **Dónde:** `QuestItem.tsx:107-112` · **Impacto:** 2 · **Esfuerzo:** S

### QuestForm

### DSG-042 · Extraer los "chips" a componente base `SystemChip`
**Qué:** El patrón chip (borde, `chipOn`, `chipText`/`chipTextOn`) está triplicado casi idéntico en `QuestForm.tsx:205-229`, `mazmorras.tsx:250-254`, `dungeon/[id].tsx:367-371`, `perfil.tsx:493-497`, cada uno con su paleta. Un `<SystemChip selected tone>` unifica selección, accesibilidad y color. **Dónde:** `QuestForm.tsx:86-130` · **Impacto:** 4 · **Esfuerzo:** M

### DSG-043 · Chips sin rol/estado de selección accesible
**Qué:** Los `Pressable` de stat/dificultad/día (`QuestForm.tsx:88-129`) no exponen `accessibilityRole` ni `accessibilityState={{ selected }}`. Un usuario con lector no sabe cuál está activo. **Dónde:** `QuestForm.tsx:88-129` · **Impacto:** 3 · **Esfuerzo:** S

### DSG-044 · Tamaño táctil de los chips de día (38 px) por debajo de 44
**Qué:** `styles.day` mide 38 px de ancho y `paddingVertical: 7` (~31 px alto). Difícil de tocar y bajo el mínimo a11y. **Dónde:** `QuestForm.tsx:211-217` · **Impacto:** 3 · **Esfuerzo:** S

### DSG-045 · Extraer el "sheet" (modal inferior) a componente base
**Qué:** El backdrop + sheet con borde superior se repite en QuestForm, mazmorras, dungeon, perfil, gym, dieta, agenda. Un `<SystemSheet>` con `tone` centraliza scrim (DSG-005), borde y `paddingBottom: 34`. **Dónde:** `QuestForm.tsx:66-157` y 6 pantallas más · **Impacto:** 4 · **Esfuerzo:** L

### DSG-046 · `keyboardVerticalOffset` y comportamiento Android del KeyboardAvoidingView
**Qué:** `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` (`QuestForm.tsx:70`): en Android el teclado puede tapar el botón "Crear misión". Revisar `behavior="height"` o `windowSoftInputMode`. **Dónde:** `QuestForm.tsx:68-71` · **Impacto:** 3 · **Esfuerzo:** M

### DSG-047 · `placeholderTextColor` desde token coherente
**Qué:** Usa `colors.textFaint` (bien), pero el input no marca `selectionColor`; el cursor sale del color por defecto del SO, rompiendo la marca cian. Añadir `selectionColor={colors.cyan}`. **Dónde:** `QuestForm.tsx:77-83` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-048 · Input sin estado de foco visible tokenizado
**Qué:** `styles.input` no cambia de borde al enfocar; en una UI tan basada en bordes, el foco debería resaltar (`onFocus` → borde `cyan`). **Dónde:** `QuestForm.tsx:190-199` · **Impacto:** 2 · **Esfuerzo:** M

### Heatmap

### DSG-049 · `cellColor` duplica la escala de la leyenda (fuente única)
**Qué:** Los umbrales (`<=0 track`, `<=2 cyanFaint`, `<=4 cyanDim`, else cyan) viven en `cellColor` (`Heatmap.tsx:14-19`) y la leyenda repite el array `[track, cyanFaint, cyanDim, cyan]` (`:56`). Si cambian los umbrales, la leyenda miente. Derivar ambos de una constante única `HEAT_SCALE`. **Dónde:** `Heatmap.tsx:14-19,56` · **Impacto:** 3 · **Esfuerzo:** S

### DSG-050 · `key={i}` por índice en las celdas
**Qué:** `Rect key={i}` (`Heatmap.tsx:51`) usa el índice; mejor `key` estable por fecha (`day`) para reconciliación correcta si cambia el rango. **Dónde:** `Heatmap.tsx:50-51` · **Impacto:** 1 · **Esfuerzo:** S

### DSG-051 · Celdas sin etiqueta accesible
**Qué:** El heatmap es puramente visual; un lector no obtiene nada. Añadir `accessibilityLabel` resumen ("13 semanas, X días activos") al contenedor. **Dónde:** `Heatmap.tsx:47-49` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-052 · `CELL`/`GAP` y tamaños de leyenda a tokens
**Qué:** `CELL=11`, `GAP=3`, swatches `10×10`, fuentes 11 px (`Heatmap.tsx:11-12,55-59`) son mágicos. **Dónde:** `Heatmap.tsx:11-12` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-053 · Daltonismo: la escala cian monocroma es difícil de distinguir
**Qué:** Los 4 niveles son tonos de cian muy cercanos (`track→cyanFaint→cyanDim→cyan`); para deuteranopia/baja visión la diferencia entre "poco" y "mucho" se pierde. Considerar variar también luminancia o añadir borde a celdas con actividad. **Dónde:** `Heatmap.tsx:14-19` · **Impacto:** 3 · **Esfuerzo:** M

### XpToast

### DSG-054 · Posición fija `top: 110` no respeta safe-area ni cabeceras variables
**Qué:** `styles.wrap` ancla `top: 110` (`XpToast.tsx:42`). En dispositivos con notch alto o si la cabecera cambia, el toast puede solaparse con el contenido o el status bar. Derivar de `useSafeAreaInsets()` + offset tokenizado. **Dónde:** `XpToast.tsx:41-46` · **Impacto:** 3 · **Esfuerzo:** M

### DSG-055 · El texto del bonus mete copy en el componente base
**Qué:** `'  · evidencia ×1,25'` está hardcodeado en el JSX (`XpToast.tsx:34`). Mezcla presentación y copy del "sistema"; debería venir por prop o de un módulo de textos para mantener la voz centralizada. **Dónde:** `XpToast.tsx:33-35` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-056 · Duraciones de animación a tokens de motion
**Qué:** `180/900/350` ms (`XpToast.tsx:22-25`), `250/1600/1350` (`LevelUpOverlay`), spring `friction:5` están dispersos. Definir `motion = { fast:180, base:250, slow:900 }` para coherencia entre toast/levelup/futuras animaciones. **Dónde:** `XpToast.tsx:22-25`, `LevelUpOverlay.tsx:22-52` · **Impacto:** 3 · **Esfuerzo:** M

### DSG-057 · Respetar "reduce motion"
**Qué:** Ni `XpToast` ni `LevelUpOverlay` ni el `Ring` consultan `AccessibilityInfo.isReduceMotionEnabled`. Usuarios con sensibilidad vestibular reciben animaciones forzadas. Añadir guard que acorte/elimine la animación. **Dónde:** `XpToast.tsx:16-27`, `LevelUpOverlay.tsx:17-55` · **Impacto:** 3 · **Esfuerzo:** M

### DSG-058 · El toast no es anunciado por lectores
**Qué:** `pointerEvents="none"` y sin `accessibilityLiveRegion`; la ganancia de XP no se vocaliza. Añadir `accessibilityLiveRegion="polite"` o `AccessibilityInfo.announceForAccessibility`. **Dónde:** `XpToast.tsx:32` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-059 · Cola de toasts (varias misiones seguidas)
**Qué:** El toast es un único valor; completar dos misiones rápido pisa la animación (resetea en el efecto). Una mini-cola evitaría perder feedback. **Dónde:** `XpToast.tsx:12-27` (y origen `index.tsx:330`) · **Impacto:** 2 · **Esfuerzo:** M

### LevelUpOverlay

### DSG-060 · El backdrop `Pressable` no tiene rol/label de cierre
**Qué:** `Pressable` de cierre (`LevelUpOverlay.tsx:59`) sin `accessibilityRole="button"` ni label "Cerrar". Un lector no sabe que tocar cierra. **Dónde:** `LevelUpOverlay.tsx:59` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-061 · Dos `Ring` en bucle infinito sin limpieza en background
**Qué:** `Animated.loop` corre indefinidamente mientras el modal está abierto (`LevelUpOverlay.tsx:18-32`); se limpia al desmontar (bien), pero no se pausa si la app pasa a background con el overlay abierto, gastando frames. Pausar con `AppState`. **Dónde:** `LevelUpOverlay.tsx:30-33` · **Impacto:** 2 · **Esfuerzo:** M

### DSG-062 · `fontSize: 84` del nivel sin escala / posible overflow a 3 cifras
**Qué:** `styles.level` fija 84 px (`LevelUpOverlay.tsx:105-110`); con nivel de 3 dígitos (el tope es 999 según memoria) y `paddingHorizontal: 44` podría no caber en pantallas estrechas. Verificar con `adjustsFontSizeToFit`. **Dónde:** `LevelUpOverlay.tsx:105-110` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-063 · `voice.levelUp()` se evalúa en cada render del overlay
**Qué:** `{level !== null ? voice.levelUp() : ''}` (`LevelUpOverlay.tsx:68`) se recalcula en cada render mientras el modal está montado; si `voice.levelUp()` es aleatorio, el texto puede cambiar al re-renderizar. Fijarlo en estado al abrir. **Dónde:** `LevelUpOverlay.tsx:68` · **Impacto:** 2 · **Esfuerzo:** S

### Consistencia global / consumidores del sistema

### DSG-064 · Auditar y migrar todos los `fontSize` a la escala (DSG-003)
**Qué:** Tras crear la escala, sustituir los ~16 tamaños distintos repartidos por `index.tsx`, `perfil.tsx`, `mazmorras.tsx`, `dungeon/[id].tsx`, etc. **Dónde:** múltiples (p. ej. `index.tsx:336-506`) · **Impacto:** 4 · **Esfuerzo:** L

### DSG-065 · Auditar y migrar todos los `letterSpacing` a `tracking` (DSG-003)
**Qué:** Valores 1/1.5/2/2.5/3/4/6/8 sin sistema; unificar la jerarquía de "tracking" de la marca. **Dónde:** múltiples (`index.tsx:355,427,460`, `perfil.tsx:514`) · **Impacto:** 3 · **Esfuerzo:** M

### DSG-066 · Patrón "title bar de pantalla" repetido → componente `ScreenHeader`
**Qué:** Cada pantalla reimplementa su cabecera (`styles.header` + título + botón add): `index.tsx:203-206`, `mazmorras.tsx:85-90`, `dungeon/[id].tsx:289-303`, perfil… Un `<ScreenHeader title accent right>` unifica espaciado y tipografía. **Dónde:** `index.tsx:345-361` y otras · **Impacto:** 3 · **Esfuerzo:** M

### DSG-067 · `styles.screen`/`styles.content` idénticos copiados en cada pantalla
**Qué:** `screen:{flex:1,backgroundColor:colors.bg}` y `content:{padding:16,paddingBottom:32}` se repiten verbatim en index, mazmorras, dungeon, perfil, gym, dieta, agenda. Extraer a un `Screen` wrapper o a `commonStyles`. **Dónde:** `index.tsx:337-344`, `mazmorras.tsx:184-185`, `dungeon/[id].tsx:287-288` · **Impacto:** 3 · **Esfuerzo:** M

### DSG-068 · `windowTitle` (cabecera de SystemWindow) duplicado por pantalla
**Qué:** El estilo de título de panel (`fontFamily heading, 12, letterSpacing 2.5, color cyan`) se redefine en index (`:456`), perfil (`:441`), dungeon (`:314`, además con color morado hardcodeado). Exponer `<SystemWindow title="...">` o un `<WindowTitle>`. **Dónde:** `index.tsx:456-461`, `dungeon/[id].tsx:314` · **Impacto:** 3 · **Esfuerzo:** M

### DSG-069 · `addButton` (FAB cuadrado) repetido sin componente
**Qué:** El botón "＋" cuadrado de marca aparece en `mazmorras.tsx:193-199` (34×34, fondo morado), perfil, etc., cada uno con su color. Crear `<SystemIconButton>`. **Dónde:** `mazmorras.tsx:87-89,193-199` · **Impacto:** 3 · **Esfuerzo:** M

### DSG-070 · Anchuras en porcentaje frágiles (`30.5%`, `31%`, `47%`)
**Qué:** Las rejillas usan porcentajes mágicos para 3 columnas (`module width:'30.5%'` en `index.tsx:493`, `ach width:'31%'` en `perfil.tsx:458`, `kpi '47%'`). Son frágiles ante cambios de `gap`. Migrar a un sistema de grid/`flexBasis` tokenizado. **Dónde:** `index.tsx:492-493`, `perfil.tsx:458,471` · **Impacto:** 3 · **Esfuerzo:** M

### DSG-071 · Tarjeta de módulo repetida → `<ModuleTile>`
**Qué:** Las 6 tarjetas de módulo (`index.tsx:319-326`) son un patrón reutilizable (icono + label, borde, fondo `panelDeep`). Extraer. **Dónde:** `index.tsx:486-505` · **Impacto:** 2 · **Esfuerzo:** M

### DSG-072 · `Switch` con `trackColor`/`thumbColor` repetidos
**Qué:** La config de color del `Switch` (`QuestForm.tsx:140-141`, `dungeon/[id].tsx:271`) se repite y uno usa `#191D3D` hardcodeado. Envolver en `<SystemSwitch>`. **Dónde:** `QuestForm.tsx:137-142`, `dungeon/[id].tsx:268-272` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-073 · No hay tema claro / el `StatusBar` está fijo a `light`
**Qué:** `StatusBar style="light"` (`_layout.tsx:35`) asume fondo oscuro permanente; correcto hoy, pero todo el color va hardcodeado a una sola paleta. Si se quisiera un modo alto-contraste, no hay capa de theming (provider/context). Documentar como decisión y dejar el hook listo. **Dónde:** `_layout.tsx:35`, `theme.ts` · **Impacto:** 2 · **Esfuerzo:** L

### DSG-074 · Pantalla de carga de fuentes es un `View` vacío (sin marca)
**Qué:** Mientras cargan las fuentes, `_layout.tsx:30` devuelve un `<View bg>` en negro; junto al splash nativo puede verse un parpadeo de fondo sin logo. Mostrar el logotipo/centrado tokenizado. **Dónde:** `_layout.tsx:29-31` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-075 · `tabBarLabelStyle` con `fontSize: 11` mágico
**Qué:** El layout de tabs fija `fontSize: 11` inline (`(tabs)/_layout.tsx:18`); debería venir de la escala. **Dónde:** `(tabs)/_layout.tsx:18` · **Impacto:** 1 · **Esfuerzo:** S

### DSG-076 · Tamaño de iconos de tab no tokenizado
**Qué:** Los iconos usan el `size` que inyecta el navegador; otros iconos de la app usan 12-22 px a mano (`index.tsx:238,322`, `mazmorras.tsx:88,121`). Definir `iconSize = { sm:13, md:18, lg:22 }`. **Dónde:** `theme.ts`, varios · **Impacto:** 2 · **Esfuerzo:** M

### DSG-077 · Verificar contraste AA de `textFaint` (#56698A) sobre fondos
**Qué:** `textFaint` se usa para texto informativo (hints, metadatos) a 11-12 px sobre `panel`/`bg`. `#56698A` sobre `#0A1322` ronda el límite de contraste AA para texto pequeño. Auditar con herramienta y, si falla, subir luminancia o tamaño. **Dónde:** `theme.ts:20`; usos `QuestItem.tsx:104`, `index.tsx:483` · **Impacto:** 3 · **Esfuerzo:** S

### DSG-078 · Verificar contraste de `textDim` (#7A8CA6) en cuerpos largos
**Qué:** Textos de párrafo (`empty`, `sheetHint`) usan `textDim` a 13 px; comprobar AA sobre `panel`/`panelDeep`. **Dónde:** `theme.ts:19`; usos `mazmorras.tsx:200`, `perfil.tsx:483` · **Impacto:** 3 · **Esfuerzo:** S

### DSG-079 · `cyanText` sobre `cyanFaint` (panel helado) puede quedar justo
**Qué:** En el aviso "SISTEMA EN PAUSA" el panel es `cyanFaint` y el título `cyanText` (`index.tsx:248-251,424-429`); dos cianes próximos. Verificar contraste del texto sobre ese relleno. **Dónde:** `index.tsx:248-251` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-080 · Mezcla de iconsets (Ionicons + MaterialCommunityIcons) sin abstracción
**Qué:** Se usan dos familias de iconos (`(tabs)/_layout.tsx:1-2`, `index.tsx:1`) directamente; nombres de icono dispersos por las pantallas (`MODULES` en `index.tsx:25-32`). Un mapa `icons.ts` centralizaría nombres y familia. **Dónde:** `(tabs)/_layout.tsx:1-2` · **Impacto:** 2 · **Esfuerzo:** M

### DSG-081 · Falta una "story"/pantalla de catálogo de componentes
**Qué:** No hay sitio donde ver SystemWindow/SystemButton/XPBar/Hexagon/Heatmap juntos en sus variantes. Una ruta oculta `/_kitchen-sink` aceleraría la detección visual de regresiones (habría cazado CRIT-DSG-01). **Dónde:** nuevo `src/app/_design.tsx` · **Impacto:** 3 · **Esfuerzo:** M

### DSG-082 · Tests de accesibilidad automatizados de los componentes base
**Qué:** Ningún componente tiene test de a11y (roles/estados). Tras añadir roles (DSG-018/028/037/043), fijarlos con tests para que no se pierdan. **Dónde:** nuevos `*.test.tsx` en `components/` · **Impacto:** 3 · **Esfuerzo:** M

### DSG-083 · Escala mínima de "elevation"/jerarquía de superficies sin definir
**Qué:** Hay 4 superficies (`bg`,`panel`,`panelDeep`,`tabBar`) pero ningún criterio de cuándo usar cada una; en mazmorras los paneles usan `panelDeep`, en sistema `panel`, sin regla escrita. Documentar la jerarquía de superficies en `theme.ts`. **Dónde:** `theme.ts:2-5` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-084 · `letterSpacing` alto en cuerpos puede degradar legibilidad
**Qué:** Algunos textos no-título llevan tracking (p. ej. `name letterSpacing:1` en `index.tsx:379`); en español con tildes el tracking alto reduce legibilidad. Reservar tracking solo a mayúsculas/títulos vía escala. **Dónde:** `index.tsx:376-381` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-085 · `Math.round` de XP en QuestItem vs barra: coherencia de redondeo
**Qué:** QuestItem muestra `previewXp` (entero) y la barra usa otra fórmula; tras DSG-026 conviene una única utilidad de formateo de XP para que el número del item y el de la barra nunca se contradigan. **Dónde:** `QuestItem.tsx:17,49-51` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-086 · Falta token de "disabled opacity"
**Qué:** `opacity: 0.45` (SystemButton disabled) y `0.7`/`0.75` (pressed en varios) están a mano. Definir `opacity = { disabled:0.45, pressed:0.7 }`. **Dónde:** `SystemButton.tsx:63,66`, `QuestItem.tsx:66` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-087 · Estados `pressed` inconsistentes entre componentes
**Qué:** SystemButton usa `opacity:0.75`, QuestItem `0.7`, módulos/chips no tienen feedback de press. Unificar el feedback de pulsación (opacidad o overlay) en todos los `Pressable`. **Dónde:** `index.tsx:321` (sin pressed), `QuestForm.tsx:88-91` (sin pressed) · **Impacto:** 3 · **Esfuerzo:** M

### DSG-088 · Sin `android_ripple` en `Pressable` táctiles
**Qué:** Ningún `Pressable` define `android_ripple`; en Android se pierde el feedback nativo de toque. Añadirlo (tintado en cian) a los controles principales o al componente base. **Dónde:** `SystemButton.tsx:17`, `index.tsx:321` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-089 · No hay límite de escalado de fuente del sistema (`allowFontScaling`)
**Qué:** Con tamaño de fuente del SO al máximo, los `letterSpacing` y anchos fijos (chips 38 px, cajas 20 px) rompen el layout. Decidir política de `maxFontSizeMultiplier` por token tipográfico. **Dónde:** escala de DSG-003; usos en `QuestForm.tsx:211`, `QuestItem.tsx:68` · **Impacto:** 3 · **Esfuerzo:** M

### DSG-090 · Heatmap/SVG sin `accessible={false}` explícito en decorativos
**Qué:** Los `Svg` decorativos (Heatmap, Hexagon de avatar) deberían marcar `accessible={false}` para no fragmentar el foco del lector. **Dónde:** `Heatmap.tsx:49`, `Hexagon.tsx:29` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-091 · `borderRadius: 32/29` de avatares no derivado del tamaño
**Qué:** `avatarImage` 64×64 con `borderRadius:32` y `shareAvatar` 58×58 con `borderRadius:29` (`perfil.tsx:404,515`): el radio se calculó a mano = size/2. Si cambia el size hay que recalcular. Usar `size/2` o un helper `circle(size)`. **Dónde:** `perfil.tsx:404,515` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-092 · Falta componente de "estado vacío" reutilizable
**Qué:** Cada pantalla pinta su vacío como `<Text style={styles.empty}>` dentro de un SystemWindow con copy largo (`mazmorras.tsx:93-98`, `index.tsx:290-293`, `dungeon` …). Un `<EmptyState message>` unificaría tono y espaciado. **Dónde:** `mazmorras.tsx:92-98` · **Impacto:** 2 · **Esfuerzo:** M

### DSG-093 · `XPBar` no expone `style` para márgenes; consumidores envuelven en View
**Qué:** Para separar la barra los consumidores la meten en `<View style={{ marginTop:... }}>` (`index.tsx:227`, `mazmorras.tsx:117`). Aceptar `style` en XPBar evita el wrapper. **Dónde:** `XPBar.tsx:4-9` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-094 · Color de relleno/track de XPBar morada hardcodeado en los call sites
**Qué:** `color={colors.purple} trackColor="#191D3D"` se repite en `mazmorras.tsx:118` y `dungeon/[id].tsx:176`. Tras DSG-004 usar `colors.purpleFaint`; mejor aún, una prop `tone="dungeon"` en XPBar. **Dónde:** `mazmorras.tsx:118`, `dungeon/[id].tsx:176` · **Impacto:** 3 · **Esfuerzo:** S

### DSG-095 · Falta token/escala para sombras de texto y glow de marca
**Qué:** El estilo Solo Leveling pide "glow" cian, pero ningún componente usa `textShadow`/sombra; la marca se ve plana. Definir tokens de glow (color+radio) opcionales para títulos de sistema. **Dónde:** `theme.ts`, `index.tsx:351-356` (brand) · **Impacto:** 3 · **Esfuerzo:** M

### DSG-096 · `numberOfLines`/elipsis ausente en títulos de mazmorra despejada
**Qué:** `clearedRow` (`mazmorras.tsx:132-135,221`) imprime `rank · title` sin `numberOfLines`; títulos largos rompen a varias líneas inconsistentemente. **Dónde:** `mazmorras.tsx:131-135` · **Impacto:** 1 · **Esfuerzo:** S

### DSG-097 · El `Ring` crea dos animaciones idénticas con delay manual
**Qué:** `LevelUpOverlay.tsx:60-62` instancia `<Ring delay={0}/>` y `<Ring delay={550}/>`; el escalonado por props es frágil. Un solo componente con array de delays o `stagger` sería más mantenible. **Dónde:** `LevelUpOverlay.tsx:60-62` · **Impacto:** 1 · **Esfuerzo:** S

### DSG-098 · Sin `testID` en componentes base
**Qué:** Ningún componente expone `testID`, dificultando tests E2E/Detox. Añadir `testID?` pasable en SystemButton/QuestItem/XPBar. **Dónde:** `SystemButton.tsx:4-11`, `QuestItem.tsx:7-14` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-099 · Documentar tokens y componentes en un README del design system
**Qué:** No hay documento que liste paleta, tipos y componentes base con ejemplos; el conocimiento vive solo en el código. Un `docs/design-system.md` o ampliar la skill `nivl-design-system` con la tabla de tokens nuevos. **Dónde:** nuevo doc + `theme.ts` · **Impacto:** 3 · **Esfuerzo:** M

### DSG-100 · Centralizar `'transparent'` y otros literales de color sueltos
**Qué:** Además de `LevelUpOverlay.tsx:37`, `SystemButton danger` usa `backgroundColor: 'transparent'` (`:60`). Exponer `colors.transparent` para no esparcir el literal. **Dónde:** `SystemButton.tsx:60`, `LevelUpOverlay.tsx:37` · **Impacto:** 1 · **Esfuerzo:** S

### DSG-101 · `gap` no soportado en versiones antiguas: confirmar soporte RN 0.83
**Qué:** Todo el layout depende de `gap` (RN ≥0.71). Está bien en RN 0.83, pero al haber bajado de SDK conviene un test visual que confirme que `gap` no degrada en el runtime objetivo. **Dónde:** ubicuo (`index.tsx:366`, etc.) · **Impacto:** 2 · **Esfuerzo:** S

### DSG-102 · Falta variante "ghost"/sin borde para SystemButton
**Qué:** Acciones terciarias (p. ej. "Toca para continuar", enlaces) se hacen con `Text` suelto; una variante `ghost` (solo label, sin borde) cerraría el set de variantes junto a outline/solid/danger. **Dónde:** `SystemButton.tsx:7` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-103 · Estados de error/success de input no tokenizados
**Qué:** Los inputs no tienen estilo de error (borde rojo + mensaje); la validación hoy es solo deshabilitar el botón. Definir tokens/estilo de input inválido para feedback inline. **Dónde:** `QuestForm.tsx:190-199`, `theme.ts` · **Impacto:** 2 · **Esfuerzo:** M

### DSG-104 · `KpiGrid`/`statRow` de perfil: anchos fijos de columna (34/30 px) frágiles
**Qué:** `statAbbr width:34`, `statPoints width:30` (`perfil.tsx:452,454`) cortan abreviaturas o números de 3 cifras. Derivar de la escala tipográfica. **Dónde:** `perfil.tsx:452,454` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-105 · Inconsistencia de `paddingBottom: 34` en sheets
**Qué:** Todos los sheets fijan `paddingBottom: 34` para esquivar el home indicator; valor mágico que debería venir de safe-area-insets, no constante. **Dónde:** `QuestForm.tsx:172`, `mazmorras.tsx:228`, `perfil.tsx:480` · **Impacto:** 3 · **Esfuerzo:** S

### DSG-106 · Inconsistencia `marginBottom` de SystemWindow vs separación manual
**Qué:** `SystemWindow.box` ya aporta `marginBottom: 12`, pero pantallas añaden además separadores/márgenes propios, produciendo huecos desiguales entre paneles. Unificar el espaciado vertical de paneles. **Dónde:** `SystemWindow.tsx:53`; consumidores en `index.tsx` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-107 · Falta token de "max content width" para tablets/pantallas anchas
**Qué:** Todo asume móvil estrecho; en tablet/landscape los paneles se estiran a todo lo ancho y las rejillas `%` quedan enormes. Definir `layout.maxWidth` y centrar. **Dónde:** `index.tsx:341-343` (content), global · **Impacto:** 2 · **Esfuerzo:** M

### DSG-108 · El color `amber` solo se usa hardcodeado para racha/títulos sin semántica
**Qué:** `colors.amber` (#FFB02E) representa "racha/destacado dorado" (`index.tsx:417`, `perfil.tsx:427,469`) pero no está documentado como token semántico (¿warning? ¿highlight?). Aclarar su rol para evitar usos divergentes. **Dónde:** `theme.ts:17` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-109 · Sin componente de "badge/tag" (PENALIZACIÓN, NIVEL MÁXIMO, DESPEJADA)
**Qué:** Etiquetas cortas en mayúsculas con tracking aparecen sueltas (`penaltyTag` en QuestItem, `clearedTag` en dungeon, `equippedTitle`). Un `<SystemTag tone>` unificaría tamaño/tracking/color. **Dónde:** `QuestItem.tsx:107-112`, `dungeon/[id].tsx:306-312` · **Impacto:** 2 · **Esfuerzo:** M

### DSG-110 · `lineHeight` definido solo en algunos textos largos
**Qué:** Unos cuerpos fijan `lineHeight` (19/18/17) y otros no (`empty` en index no, `empty` en mazmorras sí), dando interlineados dispares. Incluir `lineHeight` en la escala tipográfica (DSG-003) y aplicarlo siempre. **Dónde:** `index.tsx:468-473` (sin lineHeight) vs `mazmorras.tsx:200` (con) · **Impacto:** 2 · **Esfuerzo:** M

### DSG-111 · No hay utilidad de "color con opacidad" derivada de un token
**Qué:** Para fondos translúcidos se recurre a `rgba(...)` hardcodeado (scrim, kpi). Un helper `withAlpha(token, a)` permitiría derivar de la paleta sin literales. **Dónde:** `theme.ts`; usos en backdrops · **Impacto:** 3 · **Esfuerzo:** M

### DSG-112 · `SystemButton` no propaga `numberOfLines` al label
**Qué:** Títulos largos como "Pausar sistema (examen · enfermedad · viaje)" (`perfil.tsx:256`) pueden envolver feo dentro del botón centrado. Permitir `numberOfLines`/`adjustsFontSizeToFit` en el label. **Dónde:** `SystemButton.tsx:32-40` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-113 · Falta separador/divider tokenizado
**Qué:** Las separaciones se hacen con `borderTopWidth:1 borderTopColor:colors.line` repetido (`QuestItem.tsx:62-63`, `dungeon/[id].tsx:321-322` con color morado hardcodeado). Un `<Divider tone>` o token de divider unifica. **Dónde:** `QuestItem.tsx:62-63` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-114 · `Hexagon` no permite contenido que desborde (badge de nivel)
**Qué:** `styles.center` recorta al cuadro del hexágono; un número grande dentro (avatar) puede tocar los bordes. Añadir padding interno proporcional. **Dónde:** `Hexagon.tsx:37-46` · **Impacto:** 1 · **Esfuerzo:** S

### DSG-115 · Falta política de iconos decorativos vs informativos
**Qué:** Iconos como la cámara en QuestItem (`:45`) o el escudo en index (`:238`) transmiten información pero no tienen label; otros son decorativos. Definir convención (label obligatorio si informativo). **Dónde:** `QuestItem.tsx:44-46`, `index.tsx:237-239` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-116 · `XpToast` y `LevelUpOverlay` comparten copy de marca sin módulo común
**Qué:** Ambos formatean XP/textos del "sistema" por su cuenta; centralizar en `voice`/textos mantiene la voz uniforme y traducible. **Dónde:** `XpToast.tsx:33-35`, `LevelUpOverlay.tsx:65-69` · **Impacto:** 2 · **Esfuerzo:** M

### DSG-117 · No hay test de contraste/regresión de la paleta
**Qué:** Tras tokenizar, un test que recorra los pares (texto, fondo) usados y compruebe ratio AA evitaría regresiones de contraste al tocar `theme.ts`. **Dónde:** nuevo `theme.test.ts` · **Impacto:** 3 · **Esfuerzo:** M

### DSG-118 · `cut`/geometría no expuesta como token compartido entre SystemWindow y sheets
**Qué:** Los sheets tienen borde recto arriba mientras los paneles cortan esquinas; falta coherencia geométrica (¿los sheets también deberían cortar?). Decidir y tokenizar la geometría de marca. **Dónde:** `SystemWindow.tsx:39`, `QuestForm.tsx:166-173` · **Impacto:** 2 · **Esfuerzo:** M

### DSG-119 · Falta componente `SystemLabel` para los rótulos de formulario
**Qué:** El `label` (heading 12, tracking 1.5, uppercase, textDim) está copiado idéntico en QuestForm (`:181-189`), mazmorras (`:231-239`), dungeon (`:348-356`), perfil (`:484-492`). Extraer. **Dónde:** `QuestForm.tsx:181-189` y 3 más · **Impacto:** 3 · **Esfuerzo:** S

### DSG-120 · No hay manejo de `RefreshControl` tint tokenizado/reutilizado
**Qué:** `RefreshControl tintColor={colors.cyan}` (`index.tsx:200`) se repetirá en cada pantalla con scroll; envolver el `ScrollView` de pantalla en un `Screen` con refresh integrado y tint por defecto. **Dónde:** `index.tsx:199-201` · **Impacto:** 1 · **Esfuerzo:** S

### DSG-121 · Falta variante de SystemWindow para contenido sin padding (listas a sangre)
**Qué:** `styles.content` siempre aplica `padding:14`; algunas listas (heatmap, filas a ancho completo) querrían sangrar al borde. Prop `noPadding`/`contentStyle` documentada. **Dónde:** `SystemWindow.tsx:55-57` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-122 · `letterSpacing` de números (Orbitron) sin definir provoca dígitos pegados
**Qué:** Los números grandes (`lvValue` 30, `level` 84, `kpiValue` 22) usan Orbitron sin tracking; en Orbitron los dígitos pueden quedar apretados. Definir tracking para la escala numérica. **Dónde:** `index.tsx:398-402`, `LevelUpOverlay.tsx:105-110` · **Impacto:** 2 · **Esfuerzo:** S

### DSG-123 · Sin componente de "stat bar" (abbr + barra + valor) reutilizable
**Qué:** El patrón `statRow` (abbr, XPBar, puntos) de perfil (`:451-454`) es candidato a `<StatBar stat value>` reutilizable también en la tarjeta de compartir. **Dónde:** `perfil.tsx:451-455` · **Impacto:** 2 · **Esfuerzo:** M

### DSG-124 · El `disabled` de Pressable de fila no se anuncia (QuestItem completado)
**Qué:** Una misión completada deshabilita el `Pressable` (`QuestItem.tsx:22`) pero sin `accessibilityState.disabled`, el lector sigue invitando a pulsar. (Complementa DSG-037.) **Dónde:** `QuestItem.tsx:20-24` · **Impacto:** 2 · **Esfuerzo:** S

Total: 124 mejoras, 6 bugs.
