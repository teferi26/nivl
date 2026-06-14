# Accesibilidad (transversal)

> Área A11 · auditoría de código NIVL · anclada al código real

Lente: `accessibilityLabel/Role/State` en pulsables e iconos, tamaños de toque 44 px,
contraste REAL de la paleta sobre `#060B16`, tamaño de fuente dinámico, lectores de
pantalla, foco y reduce-motion.

**Hecho transversal de partida (medido, no inventado):** un `grep` de
`accessib|accessibilityLabel|accessibilityRole|accessibilityState|allowFontScaling|maxFontSizeMultiplier|AccessibilityInfo|reduceMotion|importantForAccessibility|accessibilityLiveRegion`
sobre todo `nivl/src/` da **cero coincidencias**. No existe una sola prop de accesibilidad
en la app. Todo lo que sigue parte de ahí. Por eso casi todos los hallazgos son "añadir",
no "corregir".

**Contraste real (calculado WCAG 2.1 sobre los hex de `src/lib/theme.ts`):**

| Texto | Color | Sobre `bg #060B16` | Sobre `panel #0A1322` | Sobre `cyanFaint #11304A` |
|---|---|---|---|---|
| `text` | `#EAF5FF` | 17.8 | 16.8 | 12.3 |
| `cyanText` | `#8FD9F2` | 12.5 | 11.9 | 8.7 |
| `amber` | `#FFB02E` | 10.8 | 10.2 | 7.4 |
| `cyan` | `#37C8F0` | 10.0 | 9.5 | 6.9 |
| `textDim` | `#7A8CA6` | 5.7 | 5.4 | **3.97** |
| `textFaint` | `#56698A` | **3.55** | **3.35** | **2.45** |
| `purpleDim` | `#5A48B8` | **2.86** | **2.70** | **1.98** |
| `redDim` | `#A8333F` | **3.01** | **2.84** | 2.08 |

`textFaint` (omnipresente como color de metadatos, pistas y placeholders) **no llega a
4.5:1 contra ningún fondo de la app**, y cae a 2.45 sobre `cyanFaint` (el fondo de los
logros desbloqueados y las KPI). Esto es la raíz de la mayoría de los hallazgos de contraste.

---

## Bugs y riesgos

### CRIT-A11-01 · Botones de icono sin nombre accesible: invisibles para TalkBack — `src/app/(tabs)/index.tsx:321`, `gym.tsx:181,185,255,258`, `dungeon/[id].tsx:159,165,187`, `agenda.tsx:100,129`, `mazmorras.tsx:87,101`, `diario.tsx:144`, `informe.tsx:102`, `oraculo.tsx:119` · severidad alta
**Problema:** todos los `Pressable` cuyo único hijo es un `<Ionicons>` (volver, añadir,
papelera, módulos del Sistema, tarjetas de mazmorra) no llevan `accessibilityRole="button"`
ni `accessibilityLabel`. Un lector de pantalla los anuncia como "botón" sin texto, o como
el nombre del glifo de la fuente de iconos, o no los anuncia. La app es literalmente
inoperable con TalkBack/VoiceOver: no se puede volver atrás, ni crear, ni abrir un módulo,
ni borrar. Es el riesgo de accesibilidad número uno de NIVL.
**Arreglo:** a cada uno, `accessibilityRole="button"` + `accessibilityLabel` descriptivo
("Volver", "Añadir día de rutina", "Eliminar día", "Abrir módulo Gym", "Abrir mazmorra <título>").
Para iconos que NO son interactivos y solo decoran (p. ej. el `snow-outline` del título de
pausa) marcar el `Text`/icono con `accessibilityElementsHidden`/`importantForAccessibility="no"`.

### CRIT-A11-02 · `QuestItem` no expone estado completado/ocupado al lector — `src/components/QuestItem.tsx:20-31` · severidad alta
**Problema:** la fila de misión es el control central de la app. El `Pressable` no tiene
`accessibilityRole="checkbox"` ni `accessibilityState={{ checked: completed, disabled: completed||busy, busy }}`.
El "tachado" (`textDecorationLine: 'line-through'`, línea 94) y el check (línea 29) son
señales **solo visuales**: un usuario ciego no puede saber si una misión ya está hecha, ni
distinguir una misión de penalización (que solo se marca por color de borde rojo, líneas 80-82,
y un tag `PENALIZACIÓN` que sí es texto). Además el icono de cámara (línea 45) que indica
"requiere evidencia" no tiene etiqueta.
**Arreglo:** envolver con `accessibilityRole="checkbox"`,
`accessibilityState={{ checked: completed }}`, y construir un `accessibilityLabel` que
incluya título + stat + XP + "requiere foto" + "penalización" si aplica; `accessibilityHint`
"Doble toque para completar". Mientras `busy`, exponer `accessibilityState={{ busy: true }}`.

### CRIT-A11-03 · Acciones destructivas y de equipar ocultas en `onLongPress` sin alternativa accesible — `src/app/gym.tsx:281`, `dungeon/[id].tsx:201`, `agenda.tsx:131`, `src/app/(tabs)/perfil.tsx:285-287` · severidad alta
**Problema:** borrar un ejercicio (gym), borrar un objetivo de mazmorra, borrar un evento de
agenda solo se puede hacer con **pulsación larga**, un gesto que TalkBack/VoiceOver
intercepta y que no se descubre por lectura. No hay botón visible equivalente. El usuario de
lector de pantalla no tiene forma de borrar esas entidades. En `perfil.tsx` el tap del logro
(`onAchievementTap`) es la única vía para equipar título y tampoco se anuncia como accionable.
**Arreglo:** exponer las acciones largas como `accessibilityActions={[{name:'delete',label:'Eliminar'}]}`
con `onAccessibilityAction`, o añadir un botón/icono de papelera visible (que de paso resuelve
el descubrimiento para todos los usuarios). Marcar los logros desbloqueados con
`accessibilityRole="button"` y un hint "Doble toque para ver/equipar título".

### CRIT-A11-04 · Toasts y overlays de feedback no se anuncian (XP, subida de nivel) — `src/components/XpToast.tsx:31-37`, `src/components/LevelUpOverlay.tsx:64-71` · severidad alta
**Problema:** al completar una misión, la única confirmación visible de "+62 XP" es el
`XpToast`, que tiene `pointerEvents="none"` y ningún `accessibilityLiveRegion`/`accessibilityRole="alert"`,
así que el lector no lo lee nunca. El `LevelUpOverlay` (un `Modal`) tampoco mueve el foco al
abrirse ni anuncia "Has subido de nivel": el usuario ciego recibe la háptica pero no sabe qué
ha pasado ni que hay un overlay que tiene que cerrar tocando ("Toca para continuar", línea 69,
es solo visual). Queda atrapado.
**Arreglo:** en `XpToast`, añadir `accessibilityLiveRegion="polite"` y un texto accesible aun
con `pointerEvents="none"`. En `LevelUpOverlay`, al abrir mover foco al panel
(`AccessibilityInfo.setAccessibilityFocus` sobre un ref), darle `accessibilityViewIsModal`,
`accessibilityRole`/label con el nivel, y exponer el cierre como botón etiquetado.

### CRIT-A11-05 · `secureTextEntry` ligado a `keySaved` revela la API key al reabrir el Oráculo — `src/app/oraculo.tsx:136` · severidad media
**Problema:** `secureTextEntry={keySaved}` significa que el campo solo se enmascara si la key
ya estaba guardada al montar. Mientras el usuario la **escribe por primera vez** (`keySaved=false`)
la `sk-ant-…` se muestra en claro, visible para quien mire la pantalla y, lo más grave para
accesibilidad, **leída en voz alta carácter a carácter** por un lector de pantalla en un
entorno público. Una credencial secreta no debería depender del estado de guardado para
ocultarse.
**Arreglo:** mantener `secureTextEntry` siempre activo y ofrecer un botón "mostrar/ocultar"
explícito (con `accessibilityRole="button"` y label que cambie de estado), en lugar de
acoplar la máscara a `keySaved`.

### CRIT-A11-06 · Selectores de chips no exponen estado seleccionado: el lector no sabe qué hay elegido — `src/components/QuestForm.tsx:88-95,102-111,121-129`, `perfil.tsx:342,350`, `gym.tsx:312`, `mazmorras.tsx:155,163`, `dungeon/[id].tsx:255`, `diario.tsx:157,167` · severidad media
**Problema:** todos los grupos de "chips" (stat, dificultad, días de la semana, motivo de
pausa, duración, ánimo, energía, rango) marcan la selección **solo con color de fondo/borde**
(`chipOn`). Ningún chip lleva `accessibilityRole` ni `accessibilityState={{ selected }}`. Un
usuario de lector de pantalla no puede saber qué stat o qué días tiene seleccionados, ni que
los chips forman un grupo de opción única/múltiple. Es un fallo de operabilidad en todos los
formularios de creación.
**Arreglo:** dar a cada chip `accessibilityRole="radio"` (selección única: stat, dificultad,
rango, motivo, duración) o `"checkbox"`/`togglebutton` (días de semana), con
`accessibilityState={{ selected }}`, y un `accessibilityLabel` con el valor completo (los días
solo dicen "L/M/X…", ininteligible al oído → label "Lunes", "Martes"). Envolver cada grupo en
`accessibilityRole="radiogroup"` con label del campo.

### CRIT-A11-07 · Cero respeto a "Reducir movimiento": anillos y partículas en bucle infinito — `src/components/LevelUpOverlay.tsx:17-33,60-63`, `src/components/XpToast.tsx:16-27` · severidad media
**Problema:** `LevelUpOverlay` lanza dos `Ring` con `Animated.loop` infinito (escala 0.7→2.1
en bucle) y el `XpToast` anima opacidad+traslación en cada misión completada. No se consulta
`AccessibilityInfo.isReduceMotionEnabled()`. Para usuarios con trastorno vestibular o
fotosensibilidad, una animación en bucle a pantalla completa cada vez que suben de nivel es
exactamente lo que la preferencia del SO pide suprimir. Es una barrera real, no cosmética.
**Arreglo:** leer `isReduceMotionEnabled` (y suscribirse al evento `reduceMotionChanged`); si
está activo, saltar el bucle de anillos y mostrar el panel/toast estáticos (fade corto o sin
animación). Centralizar en un hook `useReduceMotion()` reutilizable.

---

## Mejoras

### A11-001 · Hook `useReduceMotion()` central
**Qué:** hook que devuelve el estado de `AccessibilityInfo.isReduceMotionEnabled()` y se
suscribe a cambios, para que overlays y toasts lo consuman. **Dónde:** nuevo
`src/lib/a11y.ts` consumido por `LevelUpOverlay.tsx` y `XpToast.tsx` · **Impacto:** 4 · **Esfuerzo:** S

### A11-002 · Helper `a11yButton(label, hint?)` reutilizable
**Qué:** función que devuelve `{ accessibilityRole:'button', accessibilityLabel, accessibilityHint }`
para no repetir props en decenas de `Pressable`. **Dónde:** `src/lib/a11y.ts`, usado en todas
las pantallas · **Impacto:** 4 · **Esfuerzo:** S

### A11-003 · Etiqueta accesible en botón "volver"
**Qué:** `accessibilityRole="button"` + label "Volver". **Dónde:** `gym.tsx:181`,
`dungeon/[id].tsx:159`, `diario.tsx:144`, `informe.tsx:102`, `oraculo.tsx:119` · **Impacto:** 5 · **Esfuerzo:** S

### A11-004 · Etiqueta en botón "+" de cabecera (Sistema/Agenda/Mazmorras/Gym)
**Qué:** label contextual "Añadir evento", "Abrir mazmorra", "Nuevo día de rutina".
**Dónde:** `agenda.tsx:100`, `mazmorras.tsx:87`, `gym.tsx:185` · **Impacto:** 5 · **Esfuerzo:** S

### A11-005 · Etiqueta en papelera de cabecera de mazmorra
**Qué:** label "Abandonar mazmorra". **Dónde:** `dungeon/[id].tsx:165` · **Impacto:** 4 · **Esfuerzo:** S

### A11-006 · Módulos del Sistema como botones con nombre
**Qué:** cada tile de `MODULES` (`Pressable` con icono+label) debe tener
`accessibilityRole="button"` y `accessibilityLabel={m.label}` (hoy el `Text` se lee, pero el
rol no se anuncia y el icono confunde). **Dónde:** `src/app/(tabs)/index.tsx:321` · **Impacto:** 4 · **Esfuerzo:** S

### A11-007 · Tarjeta de mazmorra accesible
**Qué:** `accessibilityRole="button"`, label "<título>, <doneCount> de <total> objetivos,
rango <rank>". **Dónde:** `mazmorras.tsx:101` · **Impacto:** 4 · **Esfuerzo:** S

### A11-008 · `QuestItem` como checkbox accesible
**Qué:** rol checkbox + `accessibilityState.checked`. **Dónde:** `QuestItem.tsx:20` · **Impacto:** 5 · **Esfuerzo:** M

### A11-009 · `accessibilityLabel` compuesto de la misión
**Qué:** construir "<título>, <stat label>, +<xp> XP<, requiere foto><, penalización>".
**Dónde:** `QuestItem.tsx:33-51` · **Impacto:** 5 · **Esfuerzo:** M

### A11-010 · Icono de cámara de `QuestItem` con label o oculto
**Qué:** si se incluye en el label de la fila, marcar el icono
`importantForAccessibility="no"`; si no, darle label "requiere evidencia". **Dónde:** `QuestItem.tsx:45` · **Impacto:** 3 · **Esfuerzo:** S

### A11-011 · Estado `busy` de `QuestItem` anunciado
**Qué:** `accessibilityState={{ busy }}` mientras corre la cámara/alert. **Dónde:** `QuestItem.tsx:25-30` · **Impacto:** 3 · **Esfuerzo:** S

### A11-012 · Tareas de mazmorra como checkbox
**Qué:** rol checkbox + `checked={t.done}`, label con título+dificultad+jefe+XP. **Dónde:**
`dungeon/[id].tsx:198-231` · **Impacto:** 4 · **Esfuerzo:** M

### A11-013 · Propuestas del Oráculo como checkbox
**Qué:** el `Pressable` de cada propuesta (selección de misión) necesita rol checkbox +
`selected`. **Dónde:** `oraculo.tsx:175` · **Impacto:** 4 · **Esfuerzo:** S

### A11-014 · Logros como botones con estado bloqueado/desbloqueado
**Qué:** rol button, label "<nombre>, <desbloqueado|bloqueado>", hint de equipar si tiene
título. **Dónde:** `perfil.tsx:285-299` · **Impacto:** 4 · **Esfuerzo:** M

### A11-015 · Chips de stat con rol radio + label largo
**Qué:** "FUE" al oído no significa nada → label `STAT_LABEL[s]`. **Dónde:** `QuestForm.tsx:88`,
`mazmorras.tsx:163`, `dungeon` no aplica · **Impacto:** 4 · **Esfuerzo:** S

### A11-016 · Chips de día de semana con label legible
**Qué:** label "Lunes"…"Domingo" en vez de "L/M/X". **Dónde:** `QuestForm.tsx:121-129`,
`gym.tsx:312-320`, `oraculo` (meta, solo lectura) · **Impacto:** 4 · **Esfuerzo:** S

### A11-017 · Chips de dificultad con rol radio
**Qué:** `selected` + label `DIFFICULTY_LABEL`. **Dónde:** `QuestForm.tsx:102`,
`dungeon/[id].tsx:255` · **Impacto:** 3 · **Esfuerzo:** S

### A11-018 · Chips de rango de mazmorra accesibles
**Qué:** rol radio + label "Rango D". **Dónde:** `mazmorras.tsx:155` · **Impacto:** 3 · **Esfuerzo:** S

### A11-019 · Escalas de ánimo/energía como radiogroup
**Qué:** los chips 1-5 marcan selección solo por color; añadir `radiogroup` + `selected` +
label "Ánimo 3 de 5: Normal". **Dónde:** `diario.tsx:155-171` · **Impacto:** 4 · **Esfuerzo:** M

### A11-020 · Chips de motivo/duración de pausa accesibles
**Qué:** rol radio + selected. **Dónde:** `perfil.tsx:340-356` · **Impacto:** 3 · **Esfuerzo:** S

### A11-021 · `SystemButton` expone `disabled` al lector
**Qué:** añadir `accessibilityRole="button"` y `accessibilityState={{ disabled: disabled||loading, busy: loading }}`.
**Dónde:** `SystemButton.tsx:17-27` · **Impacto:** 5 · **Esfuerzo:** S

### A11-022 · `SystemButton` en estado `loading` anuncia "cargando"
**Qué:** cuando `loading`, label/hint "procesando" para que el `ActivityIndicator` (línea 30)
no sea un botón mudo. **Dónde:** `SystemButton.tsx:29-30` · **Impacto:** 3 · **Esfuerzo:** S

### A11-023 · Subir de nivel: mover foco al overlay
**Qué:** `AccessibilityInfo.setAccessibilityFocus` al panel al abrir. **Dónde:**
`LevelUpOverlay.tsx:46-55` · **Impacto:** 4 · **Esfuerzo:** M

### A11-024 · `accessibilityViewIsModal` en overlay de nivel
**Qué:** evitar que el lector se escape al contenido de detrás. **Dónde:** `LevelUpOverlay.tsx:64` · **Impacto:** 3 · **Esfuerzo:** S

### A11-025 · Anillos del overlay ocultos al lector
**Qué:** los `Ring` decorativos deben llevar `importantForAccessibility="no-hide-descendants"`.
**Dónde:** `LevelUpOverlay.tsx:60-63` · **Impacto:** 2 · **Esfuerzo:** S

### A11-026 · `XpToast` como live region
**Qué:** `accessibilityLiveRegion="polite"` + texto accesible pese a `pointerEvents="none"`.
**Dónde:** `XpToast.tsx:32` · **Impacto:** 4 · **Esfuerzo:** S

### A11-027 · Alertas del cierre como live region
**Qué:** la `SystemWindow` de "ALERTA/INFORME DEL CIERRE" aparece tras procesar el día; debe
anunciarse (`accessibilityLiveRegion`) y no quedar como texto silencioso. **Dónde:**
`src/app/(tabs)/index.tsx:258-281` · **Impacto:** 3 · **Esfuerzo:** S

### A11-028 · Aviso de "SISTEMA EN PAUSA" anunciado
**Qué:** live region en el panel `frozen`. **Dónde:** `src/app/(tabs)/index.tsx:247-256` · **Impacto:** 2 · **Esfuerzo:** S

### A11-029 · Banner de error/aviso de login como live region
**Qué:** `error`/`notice` cambian sin foco; envolver con `accessibilityLiveRegion="assertive"`
(error) / `"polite"` (notice). **Dónde:** `login.tsx:85-86` · **Impacto:** 4 · **Esfuerzo:** S

### A11-030 · `error`/`notice` de login con rol alert
**Qué:** `accessibilityRole="alert"` para que se lean al aparecer. **Dónde:** `login.tsx:157-168` · **Impacto:** 3 · **Esfuerzo:** S

### A11-031 · Tamaño de toque del check de misión < 44 px
**Qué:** la caja es 20×20 (`box`) y la fila tiene `paddingVertical: 9` → alto ~38 px. Añadir
`hitSlop` o subir el padding a 44 px de alto mínimo. **Dónde:** `QuestItem.tsx:57-75` · **Impacto:** 4 · **Esfuerzo:** S

### A11-032 · "+" de cabecera Agenda/Mazmorras es 34×34
**Qué:** `addButton` mide 34×34 px, por debajo del mínimo 44. Subir a 44 o añadir `hitSlop`.
**Dónde:** `agenda.tsx:227-233`, `mazmorras.tsx:193-199` · **Impacto:** 4 · **Esfuerzo:** S

### A11-033 · Iconos de cabecera dependen de `hitSlop=10` con glifo de 24
**Qué:** volver/añadir/papelera son glifos de 18-24 px con `hitSlop={8..10}` → área efectiva
~40-44, justo en el límite y a veces por debajo (papelera 18 + 8·2 = 34). Normalizar
`hitSlop` a un valor que garantice 44. **Dónde:** `gym.tsx:181,185,255,258,272`, `dungeon/[id].tsx:159,165,187` · **Impacto:** 3 · **Esfuerzo:** S

### A11-034 · Iconos de papelera de gym (18 px) demasiado pequeños como diana
**Qué:** `trash-outline size={18}` con `hitSlop={8}`. Subir hitSlop a ≥13 para alcanzar 44.
**Dónde:** `gym.tsx:274` · **Impacto:** 3 · **Esfuerzo:** S

### A11-035 · Chips de día de semana (38 px de ancho) bajo el mínimo
**Qué:** `day` mide 38 px de ancho × ~31 de alto. Subir a 44×44. **Dónde:** `QuestForm.tsx:211-217` · **Impacto:** 3 · **Esfuerzo:** S

### A11-036 · `liftInput` (64×~32) y celdas numéricas pequeñas
**Qué:** los inputs de kg/reps tienen `paddingVertical: 7` → alto ~32; difíciles de enfocar
con dedo o switch control. Subir padding. **Dónde:** `gym.tsx:410-421` · **Impacto:** 2 · **Esfuerzo:** S

### A11-037 · Filas de agenda/diario táctiles muy estrechas
**Qué:** `row` con `paddingVertical: 5` (agenda) y filas de objetivos son la zona de
long-press; altura ~30 px. Ampliar para facilitar el gesto. **Dónde:** `agenda.tsx:242`,
`dungeon/[id].tsx:316-323` · **Impacto:** 2 · **Esfuerzo:** S

### A11-038 · Contraste: `textFaint` como texto normal falla AA (3.55:1)
**Qué:** `#56698A` sobre `bg` da 3.55, por debajo de 4.5 exigido para texto < 18 pt. Subir el
tono de `textFaint` (p. ej. hacia `#6E82A8`, ~4.6) o reservarlo solo para texto ≥ 18 pt
negrita. **Dónde:** `theme.ts:20`; usado en `QuestItem.tsx:104` (`metaText`), `index.tsx:483` (`pendingNote`), `diario.tsx:285`, `oraculo.tsx:257` y decenas más · **Impacto:** 5 · **Esfuerzo:** M

### A11-039 · Contraste crítico: logros desbloqueados ilegibles (2.45:1)
**Qué:** `achName` desbloqueado usa `text` (ok), pero la variante **bloqueada** y el tag
`achTitleTag` (`amber` 7.4 ok) conviven con `textFaint` sobre `cyanFaint` = 2.45. Y el
`achName` por defecto (`textFaint`) sobre el fondo `cyanFaint` de `.achOn` queda en 2.45.
Revisar el par texto/fondo de la rejilla de logros. **Dónde:** `perfil.tsx:466-468` · **Impacto:** 4 · **Esfuerzo:** S

### A11-040 · Contraste: etiquetas de KPI sobre `cyanFaint`
**Qué:** `kpiLabel` usa `textDim` (#7A8CA6) sobre `cyanFaint` = 3.97, por debajo de 4.5.
**Dónde:** `perfil.tsx:471-473`, `informe.tsx:183-185` · **Impacto:** 3 · **Esfuerzo:** S

### A11-041 · Contraste: placeholders de inputs (textFaint, 3.55) ilegibles
**Qué:** todos los `placeholderTextColor={colors.textFaint}` quedan en 3.35-3.55. Un
placeholder que comunica formato (p. ej. "AAAA-MM-DD") debe ser legible. **Dónde:**
`agenda.tsx:189,197,206`, `gym.tsx:328,345,364`, `diario.tsx:179`, `oraculo.tsx:134,151`,
`login.tsx:73,82`, `QuestForm.tsx:82`, `mazmorras.tsx:150`, `dungeon/[id].tsx:250` · **Impacto:** 4 · **Esfuerzo:** S

### A11-042 · Contraste: texto de quest en agenda (`textDim` sobre panel `cyanDim`-borde)
**Qué:** `dayQuests` usa `textDim` 5.4 (ok), pero el icono `ellipse-outline` en `cyanDim`
(3.3) marca pendiente solo por color tenue. Reforzar. **Dónde:** `agenda.tsx:164-170` · **Impacto:** 2 · **Esfuerzo:** S

### A11-043 · `purpleDim` como texto/UI no alcanza 3:1
**Qué:** `#5A48B8` da 2.70-2.86; se usa como borde de chips y cajas en mazmorras/dungeon.
Para bordes de control interactivo WCAG pide ≥3:1. Subir el tono. **Dónde:** `theme.ts:12`,
usado en `mazmorras.tsx:251`, `dungeon/[id].tsx:368` · **Impacto:** 3 · **Esfuerzo:** M

### A11-044 · `redDim` como borde de botón peligro < 3:1
**Qué:** borde `redDim` (2.84 sobre panel) del `SystemButton danger`; el contorno que delimita
el botón "Cerrar sesión" apenas se distingue. Subir tono o engrosar. **Dónde:** `SystemButton.tsx:59`,
`theme.ts:14` · **Impacto:** 3 · **Esfuerzo:** S

### A11-045 · Borde de foco visible inexistente
**Qué:** ningún control define estilo de foco (solo `pressed`). Con teclado externo / switch
control no hay indicador de foco. Añadir variación visible en `:focus` (RN: `onFocus`/estado).
**Dónde:** `SystemButton.tsx:20-27`, `QuestItem.tsx:23` · **Impacto:** 3 · **Esfuerzo:** M

### A11-046 · `allowFontScaling`/`maxFontSizeMultiplier` nunca configurado
**Qué:** la app usa tamaños fijos (11-15 pt) con fuentes Rajdhani/Orbitron sin tope de
escalado. Con fuente del sistema al 200% muchos textos de una línea (`numberOfLines={1}`)
se truncan en vez de crecer. Definir `maxFontSizeMultiplier` coherente por estilo y revisar
los `numberOfLines`. **Dónde:** transversal; ejemplos `QuestItem.tsx:33`, `index.tsx:215`,
`mazmorras.tsx:111`, `dungeon/[id].tsx:162,220` · **Impacto:** 4 · **Esfuerzo:** L

### A11-047 · `numberOfLines={1}` trunca títulos al ampliar fuente
**Qué:** títulos de misión, mazmorra, evento y tarea cortan a una línea; al escalar tipografía
el usuario pierde información. Permitir 2 líneas o `adjustsFontSizeToFit` con mínimo. **Dónde:**
`QuestItem.tsx:33`, `mazmorras.tsx:111`, `agenda.tsx:122,147,157,168`, `dungeon/[id].tsx:220` · **Impacto:** 3 · **Esfuerzo:** M

### A11-048 · Nombre del cazador en cabecera del Sistema puede truncar
**Qué:** `name` + `rank` en `profileInfo` (flex con minWidth 0) sin `numberOfLines` ni tope de
escala; nombres largos o fuente grande rompen el layout del hexágono. **Dónde:** `index.tsx:214-221` · **Impacto:** 2 · **Esfuerzo:** S

### A11-049 · Avatar (letra inicial) sin descripción
**Qué:** el `Hexagon` con la inicial no tiene `accessibilityLabel="Avatar de <nombre>"`; el
lector lee solo la letra suelta. **Dónde:** `index.tsx:211-213`, `perfil.tsx:195-201` · **Impacto:** 2 · **Esfuerzo:** S

### A11-050 · Cambiar foto: pulsable sin rol/etiqueta
**Qué:** el `Pressable` del avatar en perfil (que abre la galería) no se anuncia como botón;
"Cambiar foto" es un `Text` debajo, no el nombre accesible del control. **Dónde:** `perfil.tsx:194-203` · **Impacto:** 3 · **Esfuerzo:** S

### A11-051 · `XPBar` sin rol de barra de progreso
**Qué:** la barra de XP no expone `accessibilityRole="progressbar"` ni
`accessibilityValue={{ min,max,now }}`; el progreso es invisible al lector. **Dónde:**
`XPBar.tsx:11-17`, usado en `index.tsx:228`, `perfil.tsx:225,268` · **Impacto:** 3 · **Esfuerzo:** S

### A11-052 · Texto de XP ("12 / 50 XP") y barra duplican/omiten info al lector
**Qué:** si `XPBar` se vuelve `progressbar`, el `xpText` adyacente debe agruparse
(`accessibilityRole` o `accessible` en el contenedor) para no leerse dos veces ni dejar la
barra muda. **Dónde:** `index.tsx:227-243` · **Impacto:** 2 · **Esfuerzo:** S

### A11-053 · Filas de estadística (FUE/VIT…) no agrupadas
**Qué:** abreviatura + barra + puntos se leen como tres elementos sueltos; agrupar con
`accessible` y label "Fuerza: 4 puntos". **Dónde:** `perfil.tsx:262-273` · **Impacto:** 3 · **Esfuerzo:** S

### A11-054 · Heatmap totalmente invisible para el lector
**Qué:** el SVG de actividad (`<Rect>` por día) no tiene texto alternativo ni resumen; un
usuario ciego no obtiene nada del "mapa de 13 semanas". Añadir un resumen textual accesible
(p. ej. "X días activos en 13 semanas, máximo Y") y `accessibilityElementsHidden` al SVG.
**Dónde:** `Heatmap.tsx:47-62`, `informe.tsx:155-158` · **Impacto:** 3 · **Esfuerzo:** M

### A11-055 · Leyenda del heatmap solo por color
**Qué:** "Menos … Más" con cuadros de color no transmite escala a daltónicos/ciegos. Añadir
valores numéricos por nivel. **Dónde:** `Heatmap.tsx:54-60` · **Impacto:** 2 · **Esfuerzo:** S

### A11-056 · Barras "XP por estadística" del informe sin rol/valor
**Qué:** la barra manual (`View` con `width %`) no expone progreso ni valor; la abreviatura
sola es ininteligible. **Dónde:** `informe.tsx:138-152` · **Impacto:** 2 · **Esfuerzo:** S

### A11-057 · Color como único indicador del día actual
**Qué:** en agenda, gym y mazmorras "hoy" se marca solo cambiando el color de borde/título
(`cyanDim` vs `line`). Añadir texto/icono ("HOY") accesible o `accessibilityState`. **Dónde:**
`agenda.tsx:114-117`, `gym.tsx:249`, `dungeon` n/a · **Impacto:** 2 · **Esfuerzo:** S

### A11-058 · Penalización marcada solo por color de borde rojo
**Qué:** `boxPenalty` (QuestItem) y `boxBoss`/`boxPenalty` usan color de borde como única
diferencia; reforzar con icono o texto en el label accesible. **Dónde:** `QuestItem.tsx:80-82`,
`dungeon/[id].tsx:333` · **Impacto:** 3 · **Esfuerzo:** S

### A11-059 · "VENCIDA" en agenda depende del color rojo
**Qué:** la tarea vencida se distingue por `color: colors.red` + icono `alert-circle`; el
texto "VENCIDA ·" ya ayuda, pero el icono no tiene label. Confirmar que el label accesible
incluye "vencida". **Dónde:** `agenda.tsx:119-126` · **Impacto:** 2 · **Esfuerzo:** S

### A11-060 · Inputs sin `accessibilityLabel` propio (dependen de `<Text>` hermano)
**Qué:** los `<Text>` "Título/Fecha/Hora/Series/Reps/Kg" no están asociados al `TextInput` por
`accessibilityLabel`/`accessibilityLabelledBy`; el lector puede no relacionarlos. **Dónde:**
`agenda.tsx:183-207`, `gym.tsx:347-366`, `QuestForm.tsx:76-83` · **Impacto:** 3 · **Esfuerzo:** M

### A11-061 · Input de nombre en perfil sin label accesible
**Qué:** el `TextInput` del nombre (borde inferior) no tiene label; se percibe como texto, no
como campo editable. **Dónde:** `perfil.tsx:205-213` · **Impacto:** 3 · **Esfuerzo:** S

### A11-062 · Campos kg/reps de gym sin etiqueta individual
**Qué:** dos inputs por fila con placeholder "kg"/"reps" pero sin `accessibilityLabel` que
incluya el ejercicio → el lector dice "kg" sin saber de cuál. **Dónde:** `gym.tsx:219-234` · **Impacto:** 3 · **Esfuerzo:** S

### A11-063 · Switch "Evidencia obligatoria" sin label asociado
**Qué:** `<Switch>` sin `accessibilityLabel`; el `Text` hermano no se asocia. **Dónde:**
`QuestForm.tsx:137-142`, `dungeon/[id].tsx:268-273` · **Impacto:** 3 · **Esfuerzo:** S

### A11-064 · Switch: valores de color por defecto sin estado textual
**Qué:** además del label, conviene `accessibilityRole="switch"` explícito (RN lo infiere pero
conviene forzar el value). **Dónde:** `QuestForm.tsx:137`, `dungeon/[id].tsx:268` · **Impacto:** 2 · **Esfuerzo:** S

### A11-065 · Modales no fijan `accessibilityViewIsModal`
**Qué:** los `Modal` de hoja inferior (crear día, ejercicio, evento, mazmorra, misión, pausa,
compartir) no marcan el contenido como modal; el lector puede navegar al fondo. **Dónde:**
`gym.tsx:306,336`, `mazmorras.tsx:140`, `agenda.tsx:179`, `QuestForm.tsx:67`, `perfil.tsx:332,363`,
`dungeon/[id].tsx:241` · **Impacto:** 3 · **Esfuerzo:** M

### A11-066 · Foco no entra en el modal al abrir
**Qué:** al abrir una hoja, el foco del lector no salta a su título; el usuario no sabe que se
abrió. Mover foco al `sheetTitle`. **Dónde:** mismos modales que A11-065 · **Impacto:** 3 · **Esfuerzo:** M

### A11-067 · Backdrop de modal no cierra al tocar (inconsistencia y trampa de foco)
**Qué:** las hojas inferiores usan `<View style={backdrop}>` sin `Pressable` de cierre (solo
botón "Cancelar"); el overlay de nivel sí cierra al tocar. Un usuario que no encuentra
"Cancelar" queda atrapado. Unificar comportamiento. **Dónde:** `agenda.tsx:180`, `mazmorras.tsx:141`,
`gym.tsx:307,337`, `perfil.tsx:333` · **Impacto:** 2 · **Esfuerzo:** S

### A11-068 · Cabecera de pantalla no marcada como `header`
**Qué:** los títulos "ENTRENAMIENTO", "AGENDA", "EL ORÁCULO"… no llevan
`accessibilityRole="header"`, perdiendo la navegación por encabezados del lector. **Dónde:**
`gym.tsx:184`, `agenda.tsx:99`, `mazmorras.tsx:86`, `oraculo.tsx:122`, `diario.tsx:147`,
`informe.tsx:105`, `dungeon/[id].tsx:162` · **Impacto:** 3 · **Esfuerzo:** S

### A11-069 · Títulos de `SystemWindow` no son encabezados
**Qué:** "MISIONES DE HOY", "ESTADÍSTICAS", "LOGROS", etc. son `Text` sin
`accessibilityRole="header"`; sin ellos no hay estructura navegable. **Dónde:** `index.tsx:285,318`,
`perfil.tsx:235,261,278,306`, `informe.tsx:110,115,137,156` · **Impacto:** 3 · **Esfuerzo:** S

### A11-070 · Marca "NIVL" decorativa leída como contenido
**Qué:** el wordmark "NIVL" en cabecera/login es decorativo pero se lee letra a letra;
marcar `accessibilityElementsHidden` o darle label "NIVL". **Dónde:** `index.tsx:204`,
`login.tsx:61`, `perfil.tsx:366` · **Impacto:** 2 · **Esfuerzo:** S

### A11-071 · Texto en mayúsculas se deletrea en algunos lectores
**Qué:** títulos con `textTransform:'uppercase'` y `letterSpacing` alto (p. ej. "M I S I O N
E S") pueden leerse como siglas. Conviene `accessibilityLabel` con capitalización normal.
**Dónde:** estilos `windowTitle`/`title`/`label` en todas las pantallas · **Impacto:** 3 · **Esfuerzo:** M

### A11-072 · `RefreshControl` sin etiqueta
**Qué:** el pull-to-refresh del Sistema no anuncia "actualizando". Añadir `accessibilityLabel`.
**Dónde:** `index.tsx:199-201` · **Impacto:** 1 · **Esfuerzo:** S

### A11-073 · `Alert.alert` de confirmación accesibles por defecto, pero textos crípticos
**Qué:** los `Alert` de borrar usan solo el título de la entidad como cuerpo; para el lector
conviene cuerpo explícito ("¿Eliminar el ejercicio Press banca?"). **Dónde:** `gym.tsx:282`,
`dungeon/[id].tsx:202`, `agenda.tsx:132` · **Impacto:** 2 · **Esfuerzo:** S

### A11-074 · Mensaje de bienvenida (seed) puede solaparse con otros Alert
**Qué:** el `Alert` "El sistema te da la bienvenida" se dispara dentro de `load`; si coincide
con otro Alert, el lector pierde contexto. Secuenciar/priorizar. **Dónde:** `index.tsx:71-76` · **Impacto:** 1 · **Esfuerzo:** S

### A11-075 · Iconos informativos de stones/snow sin label
**Qué:** `shield-half-outline` (piedras) y `snow-outline` (pausa) en líneas de estado se leen
como nada; el número adyacente queda sin contexto. Añadir label "Piedras de protección: N".
**Dónde:** `index.tsx:237-240,250`, `perfil.tsx:237,248` · **Impacto:** 3 · **Esfuerzo:** S

### A11-076 · Tag "título" de logro sin contexto
**Qué:** `achTitleTag` ("título") es un `Text` suelto; en el label del logro debe integrarse
("otorga un título"). **Dónde:** `perfil.tsx:298` · **Impacto:** 2 · **Esfuerzo:** S

### A11-077 · Contador "completadas/total" sin etiqueta semántica
**Qué:** "3/5" (counter de misiones) se lee como "3 barra 5"; añadir label "3 de 5 misiones
completadas". **Dónde:** `index.tsx:286-288` · **Impacto:** 2 · **Esfuerzo:** S

### A11-078 · "Racha N · ×1.2" agrupado de forma confusa
**Qué:** racha + multiplicador en un `Text` con icono adyacente; el lector mezcla números.
Componer label claro. **Dónde:** `index.tsx:233-241` · **Impacto:** 2 · **Esfuerzo:** S

### A11-079 · Nivel grande "LV. 12" leído desordenado
**Qué:** `lvLabel` "LV." y `lvValue` "12" en cajas separadas; sin agrupar el lector puede
leerlos sueltos o en orden raro. Agrupar con `accessible` + label "Nivel 12". **Dónde:**
`index.tsx:222-225`, `perfil.tsx:218-221` · **Impacto:** 2 · **Esfuerzo:** S

### A11-080 · Estado de carga inicial sin anuncio (pantalla vacía)
**Qué:** `perfil.tsx:179-181` y `dungeon/[id].tsx:148-150` devuelven un `SafeAreaView` vacío
mientras carga; el lector encuentra una pantalla muda. Añadir texto "Cargando" accesible.
**Dónde:** `perfil.tsx:179`, `dungeon/[id].tsx:148` · **Impacto:** 2 · **Esfuerzo:** S

### A11-081 · Tarjeta para compartir captura texto pequeño no escalable
**Qué:** el `shareCard` (captura PNG) fija tamaños; no es un problema de lector pero sí de
legibilidad del resultado. Verificar tamaños mínimos. **Dónde:** `perfil.tsx:505-524` · **Impacto:** 1 · **Esfuerzo:** S

### A11-082 · Pistas de formulario (`hint`) con contraste insuficiente y sin asociar
**Qué:** los `hint` (textFaint 3.55) explican reglas ("+25% XP", "1 punto por 100 XP") pero
ni contrastan ni se asocian al control. **Dónde:** `QuestForm.tsx:230-235`, `perfil.tsx:455`,
`diario.tsx` n/a · **Impacto:** 3 · **Esfuerzo:** S

### A11-083 · `pendingNote` "a medianoche se aplica penalización" poco legible
**Qué:** aviso importante en `textFaint` 12 pt; subir contraste/jerarquía. **Dónde:**
`index.tsx:310-314,480-485` · **Impacto:** 3 · **Esfuerzo:** S

### A11-084 · Lista de módulos no agrupada como navegación
**Qué:** el grid de módulos no se marca como lista/navegación; el lector no sabe que son 6
destinos relacionados. **Dónde:** `index.tsx:319-326` · **Impacto:** 2 · **Esfuerzo:** S

### A11-085 · "Toca para continuar" del overlay solo visual
**Qué:** el hint de cierre del nivel no es accesible; el botón de cierre real es el backdrop.
Exponerlo como acción etiquetada. **Dónde:** `LevelUpOverlay.tsx:59,69` · **Impacto:** 3 · **Esfuerzo:** S

### A11-086 · `keyboardType` correcto pero sin `textContentType`/`autoComplete`
**Qué:** login email/password no declaran `textContentType`/`autoComplete`, perjudicando
autorrelleno y lectores. **Dónde:** `login.tsx:66-83` · **Impacto:** 2 · **Esfuerzo:** S

### A11-087 · `returnKeyType`/orden de foco no definido en formularios largos
**Qué:** en QuestForm/gym/agenda no se define `returnKeyType="next"` ni se encadena el foco
entre campos; navegación por teclado tediosa. **Dónde:** `QuestForm.tsx`, `gym.tsx:340-365`,
`agenda.tsx:184-207` · **Impacto:** 2 · **Esfuerzo:** M

### A11-088 · Campo de fecha libre "AAAA-MM-DD" hostil para lector/motricidad
**Qué:** introducir la fecha como texto con validación regex (`agenda.tsx:78`) es difícil con
lector; un date picker accesible sería mejor. **Dónde:** `agenda.tsx:191-199` · **Impacto:** 3 · **Esfuerzo:** L

### A11-089 · Hora libre "17:30" sin máscara ni teclado numérico
**Qué:** el input de hora no fija `keyboardType` ni formato; difícil de teclear y de validar.
**Dónde:** `agenda.tsx:200-207` · **Impacto:** 2 · **Esfuerzo:** S

### A11-090 · Multilínea del Oráculo/diario sin altura mínima táctil clara
**Qué:** `goalInput`/`textarea` multiline ok, pero sin label accesible ("describe tu
objetivo"). **Dónde:** `oraculo.tsx:146-153`, `diario.tsx:174-181` · **Impacto:** 2 · **Esfuerzo:** S

### A11-091 · Botón "Guardar" de la key sin contexto
**Qué:** botón "Guardar" junto al input de API key; su label no dice qué guarda. **Dónde:**
`oraculo.tsx:138` · **Impacto:** 2 · **Esfuerzo:** S

### A11-092 · Proposición del Oráculo: razonamiento en textFaint
**Qué:** `proposalReason` (textFaint 3.55) contiene la justificación; baja legibilidad.
**Dónde:** `oraculo.tsx:257` · **Impacto:** 2 · **Esfuerzo:** S

### A11-093 · `clearedRow`/`clearedHeader` (mazmorras despejadas) en textDim/textFaint
**Qué:** historial de mazmorras despejadas con bajo contraste. **Dónde:** `mazmorras.tsx:214-221` · **Impacto:** 1 · **Esfuerzo:** S

### A11-094 · `entryMeta`/`entryText` del diario en textFaint/textDim
**Qué:** metadatos de entradas anteriores ("ánimo 3/5") en textFaint; subir contraste.
**Dónde:** `diario.tsx:285-286` · **Impacto:** 2 · **Esfuerzo:** S

### A11-095 · `chronicleLine` (crónica del día) en textDim sobre line-panel
**Qué:** legible (5.4) pero el prefijo "·" sin contexto se lee "punto"; integrar en label.
**Dónde:** `diario.tsx:196-200,282` · **Impacto:** 1 · **Esfuerzo:** S

### A11-096 · `exLine` (ejercicios de rutina) en textDim 13 pt sin asociar al día
**Qué:** cada línea de ejercicio se lee suelta; agrupar bajo el día. **Dónde:** `gym.tsx:295-298,407` · **Impacto:** 1 · **Esfuerzo:** S

### A11-097 · `doneText`/`empty` de gym informativos sin live region
**Qué:** "Sesión registrada (+X XP)" aparece tras entrenar; conviene anunciarlo. **Dónde:**
`gym.tsx:192-195` · **Impacto:** 2 · **Esfuerzo:** S

### A11-098 · `planName` "serie top por ejercicio" críptico para lector
**Qué:** texto de ayuda concatenado al nombre del plan; separar y etiquetar. **Dónde:**
`gym.tsx:213` · **Impacto:** 1 · **Esfuerzo:** S

### A11-099 · `tagline` de login decorativa con letter-spacing alto
**Qué:** "EL SISTEMA TE ESTÁ ESPERANDO" con tracking 4 puede deletrearse; dar label normal.
**Dónde:** `login.tsx:62,126-134` · **Impacto:** 1 · **Esfuerzo:** S

### A11-100 · Sin `accessibilityLanguage="es"`
**Qué:** no se declara idioma; en dispositivos con voz en otro idioma el español se pronuncia
mal. Fijar `accessibilityLanguage` en textos clave o a nivel app. **Dónde:** transversal
(p. ej. `_layout.tsx`) · **Impacto:** 2 · **Esfuerzo:** S

### A11-101 · Pestañas inferiores: labels ok pero iconos sin redundancia semántica
**Qué:** `Tabs.Screen` aporta `title` (bien), pero conviene verificar que el icono no se
anuncia aparte y que el tab activo expone `selected`. **Dónde:** `(tabs)/_layout.tsx:21-61` · **Impacto:** 2 · **Esfuerzo:** S

### A11-102 · `tabBarLabelStyle` 11 pt sin tope de escala
**Qué:** etiquetas de pestaña a 11 pt; con fuente grande se truncan. Definir
`maxFontSizeMultiplier`/`tabBarAllowFontScaling`. **Dónde:** `(tabs)/_layout.tsx:18` · **Impacto:** 2 · **Esfuerzo:** S

### A11-103 · `meta` de mazmorra (textDim) concatena mucho dato
**Qué:** "x/y objetivos · stat · botín N XP" en una sola tirada; segmentar para el lector.
**Dónde:** `mazmorras.tsx:114-116`, `dungeon/[id].tsx:172-174` · **Impacto:** 1 · **Esfuerzo:** S

### A11-104 · `rankBox`/`rankLetter` sin contexto ("D" suelto)
**Qué:** la letra de rango se lee "D" sin decir "rango D". Integrar en label de la tarjeta.
**Dónde:** `mazmorras.tsx:107-109`, `dungeon/[id].tsx` (header ya dice "RANGO") · **Impacto:** 2 · **Esfuerzo:** S

### A11-105 · `clearedTag` "DESPEJADA" solo visual de estado
**Qué:** estado de mazmorra despejada debe ir en `accessibilityState`/label de la cabecera,
no solo como tag de color. **Dónde:** `dungeon/[id].tsx:178-180` · **Impacto:** 2 · **Esfuerzo:** S

### A11-106 · Botón "Reclamar botín" aparece sin anunciarse
**Qué:** al completar todas las tareas surge el botón; conviene anunciar "Botín disponible".
**Dónde:** `dungeon/[id].tsx:236-238` · **Impacto:** 2 · **Esfuerzo:** S

### A11-107 · `scaleLabel` del diario (texto de ánimo) aparece sin foco
**Qué:** al elegir ánimo, "Normal" aparece pero no se anuncia el cambio. Live region o incluir
en el estado del chip. **Dónde:** `diario.tsx:162` · **Impacto:** 2 · **Esfuerzo:** S

### A11-108 · `prompt` del diario (pregunta del día) sin rol de encabezado
**Qué:** la pregunta guía es el contexto principal; marcarla como header/`accessibilityLabel`
claro. **Dónde:** `diario.tsx:152,239` · **Impacto:** 1 · **Esfuerzo:** S

### A11-109 · `narrative` del informe es bloque largo sin estructura
**Qué:** párrafo generado se lee de golpe; aceptable, pero conviene marcar como región y dar
título de encabezado. **Dónde:** `informe.tsx:110-111` · **Impacto:** 1 · **Esfuerzo:** S

### A11-110 · KPI con valor y label como dos nodos
**Qué:** "1234" y "XP ganado" separados; agrupar a "1234 XP ganado". **Dónde:** `informe.tsx:117-132`,
`perfil.tsx:308-323` · **Impacto:** 2 · **Esfuerzo:** S

### A11-111 · `statPoints`/`statXp` numéricos sin unidad para lector
**Qué:** la columna de puntos lee "4" sin "puntos"; añadir en label agrupado. **Dónde:**
`perfil.tsx:270`, `informe.tsx:150` · **Impacto:** 1 · **Esfuerzo:** S

### A11-112 · `valveText`/`valveHint` (piedras) sin asociación icono-texto
**Qué:** icono de escudo + texto en filas separadas; agrupar. **Dónde:** `perfil.tsx:236-244` · **Impacto:** 1 · **Esfuerzo:** S

### A11-113 · `equippedTitle` "« TÍTULO »" con comillas leídas
**Qué:** los chevrons «» se leen literalmente; usar label sin adornos. **Dónde:** `perfil.tsx:214-216,374-377`,
`index.tsx:217-219` · **Impacto:** 1 · **Esfuerzo:** S

### A11-114 · Botón "Exportar mis datos" no informa de resultado al lector
**Qué:** `exportAllData` abre la hoja de compartir del SO (accesible), pero el estado `busy`
no se anuncia; en error solo hay Alert. Añadir feedback. **Dónde:** `perfil.tsx:162-172,328` · **Impacto:** 1 · **Esfuerzo:** S

### A11-115 · `numberOfLines` ausente donde sí conviene (proposalTitle puede crecer)
**Qué:** título de propuesta del Oráculo sin límite ni escala controlada; coherencia con el
resto. **Dónde:** `oraculo.tsx:180,255` · **Impacto:** 1 · **Esfuerzo:** S

### A11-116 · Contraste de `cyanDim` como texto (3.3) en cualquier uso textual
**Qué:** `cyanDim` solo debería usarse como borde; verificar que no se emplee como color de
texto en ningún sitio (queda por debajo de AA). **Dónde:** `theme.ts:8`; revisión transversal · **Impacto:** 2 · **Esfuerzo:** S

### A11-117 · `track`/barras de fondo sin borde para baja visión
**Qué:** las barras vacías (track #13233B) sobre panel se distinguen poco; un borde sutil
ayudaría a percibir el contenedor. **Dónde:** `XPBar.tsx:14`, `informe.tsx:188` · **Impacto:** 1 · **Esfuerzo:** S

### A11-118 · `Switch` thumb/track de bajo contraste para daltónicos
**Qué:** el estado on/off del switch se basa en cian vs gris; con `accessibilityRole="switch"`
y value el lector lo cubre, pero conviene reforzar visualmente. **Dónde:** `QuestForm.tsx:140-141`,
`dungeon/[id].tsx:271-272` · **Impacto:** 1 · **Esfuerzo:** S

### A11-119 · Sin test de "todos los pulsables tienen label"
**Qué:** añadir un test (RNTL/jest-axe-like) que recorra el árbol y falle si un `Pressable`
queda sin `accessibilityLabel`/Role. **Dónde:** nuevo `src/components/__tests__/a11y.test.tsx` · **Impacto:** 4 · **Esfuerzo:** M

### A11-120 · Test de contraste de la paleta
**Qué:** test unitario sobre `theme.ts` que verifique ratios mínimos de cada par texto/fondo
usado, para que futuros cambios de color no regresen. **Dónde:** `src/lib/__tests__/contrast.test.ts` · **Impacto:** 4 · **Esfuerzo:** M

### A11-121 · Documentar convención de accesibilidad en el design system
**Qué:** añadir a la skill `nivl-design-system` reglas obligatorias (label en todo pulsable,
44 px, reduce-motion, contraste) para que se apliquen al construir, no a posteriori. **Dónde:**
`.claude/skills/nivl-design-system` + `docs/` · **Impacto:** 3 · **Esfuerzo:** S

### A11-122 · Componente `IconButton` accesible reutilizable
**Qué:** crear un `IconButton` que obligue a `label` por tipos y aplique `hitSlop`/44 px y rol
button, y migrar las cabeceras a él. Elimina de raíz CRIT-A11-01. **Dónde:** nuevo
`src/components/IconButton.tsx`, usado en todas las cabeceras · **Impacto:** 5 · **Esfuerzo:** M

### A11-123 · Componente `Chip` accesible reutilizable
**Qué:** encapsular el patrón de chip (radio/checkbox) con `selected` y label, y migrar
QuestForm/gym/mazmorras/dungeon/diario/perfil. Resuelve CRIT-A11-06 de una vez. **Dónde:**
nuevo `src/components/Chip.tsx` · **Impacto:** 4 · **Esfuerzo:** M

### A11-124 · `Heatmap` accesible con resumen y celdas etiquetables
**Qué:** refactor para exponer un resumen textual y, opcionalmente, foco por semana. **Dónde:**
`Heatmap.tsx` · **Impacto:** 2 · **Esfuerzo:** M

### A11-125 · Revisar `letterSpacing` extremos que rompen lectura
**Qué:** valores 4-14 de tracking (brand/tagline) afectan tanto a OCR como a algunos motores
TTS; limitar o compensar con label. **Dónde:** `login.tsx:123,130`, `index.tsx:355` · **Impacto:** 1 · **Esfuerzo:** S

### A11-126 · Anunciar cambios de pantalla (router) al lector
**Qué:** tras `router.push/replace` no se notifica al lector el nuevo título; usar
`AccessibilityInfo.announceForAccessibility` o foco al header. **Dónde:** navegación en
`index.tsx`, `mazmorras.tsx`, `oraculo.tsx` · **Impacto:** 2 · **Esfuerzo:** M

### A11-127 · Verificar zona segura inferior en pantallas con scroll largo
**Qué:** `SafeAreaView edges={['top']}` no protege abajo; con barra de gestos el último botón
puede quedar pegado al borde, problemático para motricidad. **Dónde:** todas las pantallas
(`edges={['top']}`) · **Impacto:** 2 · **Esfuerzo:** S

### A11-128 · `accessibilityIgnoresInvertColors` en imágenes de avatar
**Qué:** al usar inversión inteligente de colores (iOS) la foto de avatar se invierte; marcar
para ignorarla. **Dónde:** `perfil.tsx:197,369`, `index.tsx` (sin foto) · **Impacto:** 1 · **Esfuerzo:** S

### A11-129 · Confirmar que `Hexagon` SVG no bloquea el toque del avatar
**Qué:** el SVG absoluto del hexágono podría capturar/estorbar; verificar `pointerEvents` para
que el `Pressable` de cambiar foto reciba el toque en toda el área. **Dónde:** `Hexagon.tsx:28-34`,
`perfil.tsx:194-201` · **Impacto:** 2 · **Esfuerzo:** S

### A11-130 · Estados de error globales (Alert genérico "Error del sistema") poco informativos
**Qué:** el mismo título para todo error da poca pista al usuario (vidente o no); incluir la
acción que falló. Transversal a la accesibilidad cognitiva. **Dónde:** todos los `catch` con
`Alert.alert('Error del sistema', …)` · **Impacto:** 2 · **Esfuerzo:** M

Total: 130 mejoras, 7 bugs.
