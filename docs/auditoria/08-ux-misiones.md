# UX/UI Misiones y formulario

> Área MIS · auditoría de código NIVL · anclada al código real
> Archivos: `src/app/(tabs)/misiones.tsx`, `src/components/QuestForm.tsx`, `src/components/QuestItem.tsx`
> (vecinos leídos: `src/lib/data.ts`, `src/lib/game.ts`, `src/lib/types.ts`, `src/lib/engine.ts`, `src/lib/dates.ts`, `src/app/(tabs)/index.tsx`, `src/components/SystemButton.tsx`, `src/components/SystemWindow.tsx`, `src/components/QuestForm.tsx`)

## Bugs y riesgos

### CRIT-MIS-01 · No se puede editar una misión existente — `data.ts:41-59` + `QuestForm.tsx:28,74,146` · severidad alta
**Problema:** No existe ninguna ruta de edición. `data.ts` expone `createQuest`, `setQuestActive` y `deleteQuest`, pero **no hay `updateQuest`**. `misiones.tsx` solo abre `QuestForm` para crear (`onSubmit={onCreate}` → `createQuest`, `misiones.tsx:43-47,117`), y `QuestForm` tiene el título cableado `NUEVA MISIÓN` / botón `Crear misión` (`QuestForm.tsx:74,146`) sin prop `quest`. Para corregir una errata en el título, cambiar la dificultad o ajustar los días, el usuario **debe borrar la misión** — y el propio diálogo de borrado avisa de que se elimina *"y todo su historial"* (`misiones.tsx:55`, cascade de completions) — y recrearla, perdiendo XP histórico, rachas y logros asociados. Para colmo, la pantalla Sistema promete explícitamente esta función inexistente: *"Edítalas en la pestaña Misiones"* (`index.tsx:74`). Es justo la lente de esta auditoría.
**Arreglo:** Añadir `updateQuest(id, patch: Partial<QuestInput>)` en `data.ts` (`supabase.from('quests').update(patch).eq('id', id)`). Hacer que `QuestForm` acepte una prop opcional `initial?: Quest`; si llega, precargar los `useState` desde ella (vía `useEffect` cuando cambie `visible`/`initial`), cambiar el copy a `EDITAR MISIÓN` / `Guardar cambios`, y enrutar `onSubmit` a `updateQuest` vs `createQuest`. En `misiones.tsx`, abrir el formulario en modo edición al pulsar la fila (o un lápiz nuevo en `actions`).

### CRIT-MIS-02 · El toggle activo/inactivo nunca revierte ni avisa si falla la escritura — `misiones.tsx:49-52` · severidad media
**Problema:** `onToggle` aplica el cambio optimista al estado local y luego hace `await setQuestActive(...)` **sin `try/catch`**. Si la escritura a Supabase falla (red caída, RLS, sesión caducada), el `Switch` se queda mostrando el estado contrario al real en BD y el usuario no recibe ningún aviso; la próxima `load()` por foco lo "corrige" sin explicación, o no, si no vuelve a entrar. Contrasta con `load`, que sí captura y muestra `Alert` (`misiones.tsx:32-34`). La promesa rechazada además queda como unhandled rejection.
**Arreglo:** Envolver en `try/catch`; en el `catch`, revertir el optimista (`setQuests(prev => prev.map(q => q.id === quest.id ? { ...q, active: !active } : q))`) y lanzar `Alert.alert('Error del sistema', …)`.

### CRIT-MIS-03 · Crear y borrar misión no capturan errores (rechazos silenciosos) — `misiones.tsx:43-47,60-63` + `QuestForm.tsx:48-64` · severidad media
**Problema:** `onCreate` (`misiones.tsx:43-47`) hace `await createQuest(...)` sin `try/catch`. En `QuestForm.submit` (`QuestForm.tsx:51-63`), el `await onSubmit(...)` está dentro de un `try/finally` que **solo** restaura `saving`; si `createQuest` lanza, `reset()`+`onClose()` no se ejecutan (el formulario queda abierto, bien) pero el error se traga como unhandled rejection y el usuario **no ve nada** salvo el botón saliendo de "loading". Igual en el `onPress` de borrado (`misiones.tsx:60-63`): un `deleteQuest` fallido no informa, y la misión sigue en pantalla hasta el siguiente foco. Riesgo de "creé/borré y no pasó nada".
**Arreglo:** Añadir `catch` con `Alert.alert('Error del sistema', e.message)` en `onCreate` y en el `onPress` de borrado; en `QuestForm.submit`, capturar y mostrar el error antes del `finally` (sin cerrar el modal) para no perder lo escrito.

### CRIT-MIS-04 · `daysSummary` puede renderizar separadores vacíos con días fuera de rango — `misiones.tsx:16-19` · severidad baja
**Problema:** `daysSummary` hace `days.map((d) => DAY_LABELS[d - 1]).join(' · ')`. Si `days_of_week` contiene un valor fuera de 1–7 (0, 8, negativo: dato corrupto o migración futura que no valide los elementos del array — la 0003 añadió rangos escalares pero los arrays como `days_of_week` no suelen tener CHECK por-elemento), `DAY_LABELS[d-1]` es `undefined` y se imprime ` · ` con huecos. Con `days = []` (no ocurre aquí porque `misiones.tsx:31` filtra `!is_penalty` y `submit` bloquea 0 días, pero el helper es público y frágil) devolvería `''`.
**Arreglo:** Filtrar y normalizar: `days.filter(d => d >= 1 && d <= 7).sort((a,b)=>a-b).map(d => DAY_LABELS[d-1]).join(' · ')`, y si queda vacío devolver `'—'` o `'Sin días'`.

## Mejoras

### MIS-001 · Permitir editar misión (núcleo)
**Qué:** Implementar el flujo de edición descrito en CRIT-MIS-01 (prop `initial` en `QuestForm` + `updateQuest`). **Dónde:** `QuestForm.tsx:28`, `data.ts:41` · **Impacto:** 5 · **Esfuerzo:** M

### MIS-002 · Abrir edición al pulsar la fila de la misión
**Qué:** La fila `SystemWindow` de cada misión no es pulsable (`misiones.tsx:85-113`); envolver el cuerpo en `Pressable` que abra el formulario en modo edición. **Dónde:** `misiones.tsx:86` · **Impacto:** 4 · **Esfuerzo:** S

### MIS-003 · Botón de editar explícito (lápiz) en acciones
**Qué:** Añadir un `Ionicons name="create-outline"` junto a la papelera en `actions` para descubribilidad de la edición. **Dónde:** `misiones.tsx:100-110` · **Impacto:** 3 · **Esfuerzo:** S

### MIS-004 · Deshacer borrado (undo) en vez de confirmación destructiva
**Qué:** El borrado es irreversible y elimina historial (`misiones.tsx:54-66`). Ofrecer borrado optimista con toast "Misión eliminada · Deshacer" (ventana de 5 s) antes de llamar a `deleteQuest`. **Dónde:** `misiones.tsx:54` · **Impacto:** 4 · **Esfuerzo:** M

### MIS-005 · Soft-delete / archivar en lugar de borrado físico
**Qué:** Alternativa a perder historial: marcar `active=false` + un flag `archived`, conservando completions. **Dónde:** `data.ts:56`, `types.ts:26` · **Impacto:** 4 · **Esfuerzo:** L

### MIS-006 · Capturar y mostrar error en `onToggle`
**Qué:** Ver CRIT-MIS-02. **Dónde:** `misiones.tsx:49-52` · **Impacto:** 4 · **Esfuerzo:** S

### MIS-007 · Revertir el switch optimista si falla
**Qué:** Restaurar `active` previo en el `catch`. **Dónde:** `misiones.tsx:50` · **Impacto:** 4 · **Esfuerzo:** S

### MIS-008 · Capturar error en `onCreate`
**Qué:** Ver CRIT-MIS-03. **Dónde:** `misiones.tsx:43-47` · **Impacto:** 4 · **Esfuerzo:** S

### MIS-009 · Capturar error en el borrado
**Qué:** `Alert` si `deleteQuest` falla. **Dónde:** `misiones.tsx:60-63` · **Impacto:** 4 · **Esfuerzo:** S

### MIS-010 · Mostrar error en `QuestForm.submit` sin cerrar el modal
**Qué:** `catch` con `Alert` antes del `finally`. **Dónde:** `QuestForm.tsx:51-63` · **Impacto:** 4 · **Esfuerzo:** S

### MIS-011 · Normalizar `daysSummary` ante valores fuera de rango
**Qué:** Ver CRIT-MIS-04. **Dónde:** `misiones.tsx:16-19` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-012 · `toggleDay` debe ordenar numéricamente
**Qué:** `[...prev, d].sort()` usa orden lexical por defecto (`QuestForm.tsx:37`); correcto solo porque los días son 1–7 de un dígito. Usar `.sort((a,b)=>a-b)` para robustez si el dominio cambia. **Dónde:** `QuestForm.tsx:37` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-013 · Límite de longitud del título
**Qué:** El `TextInput` no tiene `maxLength` (`QuestForm.tsx:77-83`); un título de 500 chars rompe el layout de la fila y el de Sistema. Añadir `maxLength={60}`. **Dónde:** `QuestForm.tsx:77` · **Impacto:** 3 · **Esfuerzo:** S

### MIS-014 · Contador de caracteres del título
**Qué:** Mostrar `n/60` bajo el input para feedback. **Dónde:** `QuestForm.tsx:83` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-015 · Trim visual y rechazo de solo-espacios
**Qué:** `submit` valida `title.trim()` (`QuestForm.tsx:49`) pero el input permite teclear solo espacios y el botón sigue deshabilitado sin explicar por qué. Mostrar hint "El título no puede estar vacío". **Dónde:** `QuestForm.tsx:149` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-016 · Mensaje al intentar guardar sin días
**Qué:** Si `days.length === 0` el botón se deshabilita en silencio (`QuestForm.tsx:149`). Añadir hint "Selecciona al menos un día". **Dónde:** `QuestForm.tsx:115-130` · **Impacto:** 3 · **Esfuerzo:** S

### MIS-017 · `autoFocus` en el campo título al abrir
**Qué:** Al abrir el modal el teclado no aparece y el usuario debe tocar el input. `autoFocus` (o focus diferido tras la animación) agiliza la creación. **Dónde:** `QuestForm.tsx:77` · **Impacto:** 3 · **Esfuerzo:** S

### MIS-018 · `returnKeyType="done"` y `onSubmitEditing`
**Qué:** El input no define teclado de retorno ni acción; permitir enviar desde el teclado. **Dónde:** `QuestForm.tsx:77` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-019 · `blurOnSubmit` y cierre de teclado al pulsar fuera
**Qué:** El `ScrollView` usa `keyboardShouldPersistTaps="handled"` (`QuestForm.tsx:73`) pero no hay forma cómoda de cerrar el teclado tras escribir el título antes de tocar chips. **Dónde:** `QuestForm.tsx:73` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-020 · Plantillas rápidas de misión
**Qué:** Botonera de plantillas ("Gimnasio FUE media", "Leer INT fácil"…) que rellenan el formulario; reaprovechar `DEFAULT_QUESTS` de `data.ts:123-129`. **Dónde:** `QuestForm.tsx:74`, `data.ts:123` · **Impacto:** 4 · **Esfuerzo:** M

### MIS-021 · Duplicar misión existente
**Qué:** Acción "Duplicar" que abre el formulario precargado con los datos de una misión (apoya MIS-001). **Dónde:** `misiones.tsx:100` · **Impacto:** 3 · **Esfuerzo:** S

### MIS-022 · Atajo "Todos / Ninguno / Entre semana / Findes" para días
**Qué:** La selección día a día es tediosa (`QuestForm.tsx:115-130`); añadir presets L-V, S-D, Todos, Ninguno. **Dónde:** `QuestForm.tsx:116` · **Impacto:** 4 · **Esfuerzo:** S

### MIS-023 · Vista previa del XP final en el formulario
**Qué:** Hoy solo muestra `XP base` (`QuestForm.tsx:113`); calcular con `questXp` el XP estimado (con/sin racha) para que el usuario entienda el valor real. **Dónde:** `QuestForm.tsx:113`, `game.ts:83` · **Impacto:** 3 · **Esfuerzo:** S

### MIS-024 · Aviso de coste/penalización por evidencia obligatoria
**Qué:** El switch de evidencia (`QuestForm.tsx:132-143`) no explica que sin foto la misión no se podrá completar si no hay cámara. Añadir nota. **Dónde:** `QuestForm.tsx:135` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-025 · Ordenar misiones (activas primero, alfabético, por XP)
**Qué:** El listado respeta solo el orden de `created_at` (`data.ts:24-31`); ofrecer orden activas-arriba y/o por dificultad. **Dónde:** `misiones.tsx:85` · **Impacto:** 3 · **Esfuerzo:** M

### MIS-026 · Agrupar misiones por estadística (FUE/VIT/…)
**Qué:** Con muchas misiones, agrupar por `stat` con cabeceras mejora el escaneo. **Dónde:** `misiones.tsx:85` · **Impacto:** 3 · **Esfuerzo:** M

### MIS-027 · Filtro activas / inactivas
**Qué:** Chips de filtro arriba para ocultar las inactivas. **Dónde:** `misiones.tsx:78` · **Impacto:** 3 · **Esfuerzo:** M

### MIS-028 · Buscador de misiones
**Qué:** `TextInput` de filtro por título cuando la lista crece. **Dónde:** `misiones.tsx:71` · **Impacto:** 2 · **Esfuerzo:** M

### MIS-029 · Contador y resumen en cabecera ("8 activas · 2 en pausa")
**Qué:** La cabecera solo muestra "MISIONES" y el +; añadir recuento. **Dónde:** `misiones.tsx:71-76` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-030 · Swipe para completar en QuestItem
**Qué:** Pedido en la lente. Hoy `QuestItem` solo completa con un `Pressable` (`QuestItem.tsx:20-24`); no hay gesto de swipe (confirmado: cero uso de `Swipeable`/`gesture-handler` en `src`). Añadir swipe-derecha-para-completar con `react-native-gesture-handler`. **Dónde:** `QuestItem.tsx:19` · **Impacto:** 4 · **Esfuerzo:** L

### MIS-031 · Swipe para archivar/borrar en la lista de Misiones
**Qué:** Swipe-izquierda revela acción borrar/archivar en cada fila de `misiones.tsx`. **Dónde:** `misiones.tsx:85` · **Impacto:** 3 · **Esfuerzo:** L

### MIS-032 · `accessibilityRole="button"` en el botón +
**Qué:** El `Pressable` de añadir (`misiones.tsx:73-75`) no expone rol ni etiqueta a TalkBack/VoiceOver (auditoría: 0 props de accesibilidad en todo `src`). **Dónde:** `misiones.tsx:73` · **Impacto:** 4 · **Esfuerzo:** S

### MIS-033 · `accessibilityLabel` en el botón +
**Qué:** Etiqueta "Crear nueva misión" para el icono `add`. **Dónde:** `misiones.tsx:74` · **Impacto:** 4 · **Esfuerzo:** S

### MIS-034 · `accessibilityLabel` en el botón papelera
**Qué:** El `Ionicons trash-outline` no anuncia su función (`misiones.tsx:107-109`). **Dónde:** `misiones.tsx:107` · **Impacto:** 4 · **Esfuerzo:** S

### MIS-035 · `accessibilityState`/label en el `Switch` de activar
**Qué:** El `Switch` (`misiones.tsx:101-106`) no dice a qué misión pertenece ("Activar misión Gimnasio"). **Dónde:** `misiones.tsx:101` · **Impacto:** 4 · **Esfuerzo:** S

### MIS-036 · `accessibilityRole="checkbox"` + `state` en QuestItem
**Qué:** La fila completable de Sistema (`QuestItem.tsx:20`) no expone estado `checked`/`disabled` a lectores. **Dónde:** `QuestItem.tsx:20` · **Impacto:** 4 · **Esfuerzo:** S

### MIS-037 · `accessibilityLabel` compuesto en QuestItem
**Qué:** Anunciar "Gimnasio, Fuerza, 50 XP, pendiente" en una sola etiqueta en vez de leer 3 `Text` sueltos. **Dónde:** `QuestItem.tsx:32-48` · **Impacto:** 3 · **Esfuerzo:** S

### MIS-038 · Roles y labels en los chips del formulario
**Qué:** Los `Pressable` de stat/dificultad/días (`QuestForm.tsx:88,102,121`) carecen de `accessibilityRole`/`accessibilityState={{selected}}`. **Dónde:** `QuestForm.tsx:88` · **Impacto:** 3 · **Esfuerzo:** S

### MIS-039 · `accessibilityLabel` en switch de evidencia
**Qué:** El `Switch` de evidencia (`QuestForm.tsx:137-142`) necesita etiqueta describible. **Dónde:** `QuestForm.tsx:137` · **Impacto:** 3 · **Esfuerzo:** S

### MIS-040 · `hitSlop` insuficiente en chips de día
**Qué:** Los días son 38px de ancho (`QuestForm.tsx:211-217`), por debajo del mínimo táctil recomendado (44px); añadir `hitSlop`. **Dónde:** `QuestForm.tsx:124` · **Impacto:** 3 · **Esfuerzo:** S

### MIS-041 · Área táctil del botón + por debajo de 44px
**Qué:** `addButton` es 34×34 (`misiones.tsx:143-149`); ampliar a 44 o añadir `hitSlop`. **Dónde:** `misiones.tsx:143` · **Impacto:** 3 · **Esfuerzo:** S

### MIS-042 · Contraste de `textFaint` sobre fondo
**Qué:** `questDays`/meta usan `colors.textFaint` (#56698A) sobre `panel` (#0A1322): contraste ~3.3:1, por debajo de AA para texto pequeño. **Dónde:** `misiones.tsx:178-183`, `theme.ts:20` · **Impacto:** 3 · **Esfuerzo:** S

### MIS-043 · Soporte de Dynamic Type / fuentes grandes
**Qué:** Tamaños fijos en `StyleSheet` (p. ej. `fontSize: 16`) sin `allowFontScaling`/`maxFontSizeMultiplier`; con fuente XL el sistema rompe. Revisar `numberOfLines` y wrapping. **Dónde:** `QuestItem.tsx:33`, `misiones.tsx:89` · **Impacto:** 3 · **Esfuerzo:** M

### MIS-044 · Indicador visual de misión inactiva más claro
**Qué:** Una misión inactiva solo cambia color de borde/título (`misiones.tsx:86,89`); añadir etiqueta "EN PAUSA" para no depender solo del color. **Dónde:** `misiones.tsx:86-91` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-045 · Estado vacío más accionable
**Qué:** El empty state (`misiones.tsx:78-83`) es solo texto; añadir un botón "Crear primera misión" y/o sugerir plantillas. **Dónde:** `misiones.tsx:79` · **Impacto:** 3 · **Esfuerzo:** S

### MIS-046 · Confirmación de borrado con nombre destacado y consecuencias
**Qué:** El `Alert` de borrado (`misiones.tsx:55`) menciona el historial pero no cuántas completions se perderán; mostrar recuento real. **Dónde:** `misiones.tsx:55` · **Impacto:** 2 · **Esfuerzo:** M

### MIS-047 · Doble confirmación / texto-a-escribir solo si hay historial
**Qué:** Para misiones con muchas completions, exigir confirmación reforzada; para vacías, borrado directo. **Dónde:** `misiones.tsx:54` · **Impacto:** 2 · **Esfuerzo:** M

### MIS-048 · Pull-to-refresh en la lista de Misiones
**Qué:** `misiones.tsx` recarga solo con `useFocusEffect` (`misiones.tsx:37-41`); Sistema sí tiene `RefreshControl` (`index.tsx:199`). Añadirlo por consistencia. **Dónde:** `misiones.tsx:70` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-049 · Indicador de carga inicial
**Qué:** Mientras `fetchQuests` resuelve, la lista aparece vacía y puede confundirse con el empty state (`misiones.tsx:78`). Mostrar spinner/skeleton. **Dónde:** `misiones.tsx:28-35` · **Impacto:** 3 · **Esfuerzo:** S

### MIS-050 · Distinguir "cargando" de "sin misiones"
**Qué:** Estado `loaded` booleano para no pintar el empty state hasta que la primera carga termine. **Dónde:** `misiones.tsx:25-26` · **Impacto:** 3 · **Esfuerzo:** S

### MIS-051 · Feedback háptico al crear/borrar/activar
**Qué:** Sistema usa `Haptics` al completar (`index.tsx:112`); Misiones no da ninguno. Añadir `Haptics.selectionAsync()` en toggle y `notificationAsync` al crear/borrar. **Dónde:** `misiones.tsx:49,60` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-052 · Háptico al seleccionar chips en el formulario
**Qué:** `Haptics.selectionAsync()` en `setStat`/`setDifficulty`/`toggleDay`. **Dónde:** `QuestForm.tsx:90,104,123` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-053 · Animar entrada/salida de filas (LayoutAnimation)
**Qué:** Al crear/borrar, la lista salta sin transición (`misiones.tsx:85`). Usar `LayoutAnimation` o `Animated`. **Dónde:** `misiones.tsx:85` · **Impacto:** 2 · **Esfuerzo:** M

### MIS-054 · Migrar la lista a `FlatList`
**Qué:** Se renderizan todas las misiones con `.map` dentro de un `ScrollView` (`misiones.tsx:85-114`); con decenas de misiones no recicla vistas. Usar `FlatList` con `keyExtractor`. **Dónde:** `misiones.tsx:70` · **Impacto:** 3 · **Esfuerzo:** M

### MIS-055 · Memoizar la fila de misión
**Qué:** Extraer la fila a un componente `QuestRow` con `React.memo` para evitar re-render de todas al togglear una. **Dónde:** `misiones.tsx:85-113` · **Impacto:** 2 · **Esfuerzo:** M

### MIS-056 · `useCallback` para `onToggle`/`onDelete`
**Qué:** Se recrean en cada render (`misiones.tsx:49,54`); estabilizarlas para el memo de filas. **Dónde:** `misiones.tsx:49,54` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-057 · `daysSummary` fuera del componente ya está bien, pero memoizar el render por fila
**Qué:** `daysSummary` se llama en cada render de cada fila (`misiones.tsx:96`); con `FlatList`+memo se evita. **Dónde:** `misiones.tsx:96` · **Impacto:** 1 · **Esfuerzo:** S

### MIS-058 · `previewXp` recalculado en cada render de QuestItem
**Qué:** `questXp` se invoca en el cuerpo (`QuestItem.tsx:17`); memoizar con `useMemo` sobre `quest`/`streakDays`. **Dónde:** `QuestItem.tsx:17` · **Impacto:** 1 · **Esfuerzo:** S

### MIS-059 · Constante `DAY_LABELS` duplicada
**Qué:** `DAY_LABELS` está definido por separado en `misiones.tsx:14` y `QuestForm.tsx:20`; centralizar en `lib` (junto a `dates.ts`) para evitar divergencia. **Dónde:** `misiones.tsx:14`, `QuestForm.tsx:20` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-060 · Reutilizar mapeo de día↔índice de `dates.ts`
**Qué:** El formulario y el resumen usan `d = i + 1` / `d - 1` a mano; alinear con `isoWeekday`/`weekdayOfKey` de `dates.ts` para una sola fuente de verdad. **Dónde:** `QuestForm.tsx:118`, `misiones.tsx:18`, `dates.ts:31-37` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-061 · Validar `days_of_week` no vacío también en `createQuest`
**Qué:** La capa de datos (`data.ts:41`) confía en que el formulario valide; un futuro llamador podría insertar `[]` para una misión normal y romper la programación. Validar en `createQuest`. **Dónde:** `data.ts:41-49` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-062 · Tipar `days_of_week` como rango 1..7
**Qué:** `number[]` en `types.ts:32` no impide 0/8; un tipo branded o validación runtime documenta la invariante. **Dónde:** `types.ts:32` · **Impacto:** 2 · **Esfuerzo:** M

### MIS-063 · Deshabilitar el botón "Crear" mientras `saving`
**Qué:** `SystemButton` ya usa `loading` (`QuestForm.tsx:148`) pero `disabled` no incluye `saving` (`QuestForm.tsx:149`); el botón Cancelar tampoco se bloquea durante el guardado (`QuestForm.tsx:152`), permitiendo cerrar a mitad de la escritura. **Dónde:** `QuestForm.tsx:149,152` · **Impacto:** 3 · **Esfuerzo:** S

### MIS-064 · Bloquear cierre del modal con gesto/back mientras guarda
**Qué:** `onRequestClose={onClose}` (`QuestForm.tsx:67`) deja cerrar con el botón atrás de Android aunque `saving` esté en curso. **Dónde:** `QuestForm.tsx:67` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-065 · Confirmar descartar cambios al cerrar con datos
**Qué:** Pulsar Cancelar con título escrito descarta sin avisar (`QuestForm.tsx:152` → `onClose`); preguntar "¿Descartar misión?". **Dónde:** `QuestForm.tsx:152` · **Impacto:** 3 · **Esfuerzo:** S

### MIS-066 · `reset()` también al cerrar con Cancelar
**Qué:** `onClose` (Cancelar) no llama a `reset` (`QuestForm.tsx:152`); al reabrir, el formulario conserva el último título/stat. Resetear en `onClose` o vía `useEffect` sobre `visible`. **Dónde:** `QuestForm.tsx:40-46,152` · **Impacto:** 3 · **Esfuerzo:** S

### MIS-067 · Estado del formulario no se reinicia al reabrir
**Qué:** Relacionado con MIS-066: como los `useState` viven mientras el componente está montado (`QuestForm.tsx:29-34`), reabrir muestra el estado previo si no se reseteó. **Dónde:** `QuestForm.tsx:29-34` · **Impacto:** 3 · **Esfuerzo:** S

### MIS-068 · Desmontar el formulario cuando no es visible
**Qué:** El `Modal` mantiene el árbol montado; envolver con `{visible && <QuestForm…/>}` o usar `key` para garantizar estado limpio. **Dónde:** `misiones.tsx:117` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-069 · `KeyboardAvoidingView` sin comportamiento en Android
**Qué:** `behavior` es `undefined` en Android (`QuestForm.tsx:70`); con el teclado abierto, el botón Crear puede quedar tapado en pantallas pequeñas. Probar `'height'` o ajustar `ScrollView` padding. **Dónde:** `QuestForm.tsx:68-71` · **Impacto:** 3 · **Esfuerzo:** S

### MIS-070 · `contentContainerStyle` con padding inferior en el ScrollView del modal
**Qué:** El `ScrollView` (`QuestForm.tsx:73`) no reserva espacio inferior; el botón Cancelar puede pegarse al borde con teclado. **Dónde:** `QuestForm.tsx:73` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-071 · `maxHeight: '88%'` puede recortar en pantallas bajas
**Qué:** El sheet limita a 88% (`QuestForm.tsx:172`); con teclado + fuentes grandes el contenido se recorta. Validar scroll real hasta el botón. **Dónde:** `QuestForm.tsx:172` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-072 · Handle/grabber visual en el bottom sheet
**Qué:** El sheet no tiene barra superior de arrastre; añadir un grabber para affordance de "deslizar para cerrar". **Dónde:** `QuestForm.tsx:72` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-073 · Cerrar tocando el backdrop
**Qué:** El backdrop oscuro (`QuestForm.tsx:161-165`) no es pulsable para cerrar; envolver en `Pressable` con `onPress={onClose}`. **Dónde:** `QuestForm.tsx:68` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-074 · Mostrar el nombre de la estadística seleccionada de forma más visible
**Qué:** El hint `STAT_LABEL[stat]` (`QuestForm.tsx:97`) es pequeño y gris; reforzar al cambiar de chip. **Dónde:** `QuestForm.tsx:97` · **Impacto:** 1 · **Esfuerzo:** S

### MIS-075 · Tooltip/explicación de cada dificultad
**Qué:** Solo se ve "X XP base" (`QuestForm.tsx:113`); explicar qué implica cada nivel (frecuencia recomendada). **Dónde:** `QuestForm.tsx:99-113` · **Impacto:** 2 · **Esfuerzo:** M

### MIS-076 · Orden de stats/dificultades coherente y documentado
**Qué:** El orden viene de `STATS`/`DIFFICULTIES` (`game.ts:11,21`); fijar visualmente el orden ascendente de dificultad ya se cumple, pero conviene comentar que el formulario depende de ese orden. **Dónde:** `QuestForm.tsx:101`, `game.ts:11` · **Impacto:** 1 · **Esfuerzo:** S

### MIS-077 · Iconos por estadística en los chips
**Qué:** Los chips de stat son solo texto (`QuestForm.tsx:93`); añadir iconos (pesa, cerebro…) mejora el reconocimiento. **Dónde:** `QuestForm.tsx:88-95` · **Impacto:** 2 · **Esfuerzo:** M

### MIS-078 · Color por estadística en la fila de misión
**Qué:** `questMeta` usa un único `cyanText` (`misiones.tsx:172-177`); colorear por stat ayuda a escanear. **Dónde:** `misiones.tsx:92-94` · **Impacto:** 2 · **Esfuerzo:** M

### MIS-079 · Mostrar próxima programación ("Próx.: mañana")
**Qué:** La fila lista los días (`misiones.tsx:95-98`) pero no cuándo toca la siguiente; calcular con `weekdayOfKey`/`addDays`. **Dónde:** `misiones.tsx:95` · **Impacto:** 3 · **Esfuerzo:** M

### MIS-080 · Indicar si la misión está programada para hoy
**Qué:** Resaltar misiones cuyo `days_of_week` incluye el weekday actual (`questsScheduledOn` en `engine.ts:8`). **Dónde:** `misiones.tsx:85`, `engine.ts:8` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-081 · Badge "evidencia" más visible en la fila
**Qué:** Hoy se concatena texto "· evidencia obligatoria" (`misiones.tsx:97`); usar el icono de cámara como en `QuestItem` (`QuestItem.tsx:44-46`) para consistencia. **Dónde:** `misiones.tsx:97` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-082 · Unificar presentación de misión entre lista y Sistema
**Qué:** `misiones.tsx` y `QuestItem.tsx` muestran la misma misión con estilos distintos; extraer un componente compartido de "tarjeta de misión". **Dónde:** `misiones.tsx:88-99`, `QuestItem.tsx:32-48` · **Impacto:** 3 · **Esfuerzo:** L

### MIS-083 · Mostrar racha/multiplicador estimado en la fila
**Qué:** La lista no refleja el `streakMultiplier` aplicado; mostrar XP efectivo como en MIS-023. **Dónde:** `misiones.tsx:92-94`, `game.ts:70` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-084 · Reordenar misiones manualmente (drag handle)
**Qué:** No hay forma de fijar un orden propio; añadir `position` y arrastre. **Dónde:** `types.ts:26`, `misiones.tsx:85` · **Impacto:** 3 · **Esfuerzo:** L

### MIS-085 · Persistir el orden elegido
**Qué:** Acompaña a MIS-084: columna `position` + `order('position')` en `fetchQuests` (`data.ts:24-31`). **Dónde:** `data.ts:27` · **Impacto:** 2 · **Esfuerzo:** M

### MIS-086 · Acción masiva: activar/desactivar todas
**Qué:** Con muchas misiones, un control para pausar todas (p. ej. en vacaciones, junto a freeze). **Dónde:** `misiones.tsx:71` · **Impacto:** 2 · **Esfuerzo:** M

### MIS-087 · Categorías/etiquetas de misión
**Qué:** Agrupar por área (salud, estudio…) más allá de la stat. **Dónde:** `types.ts:26` · **Impacto:** 2 · **Esfuerzo:** L

### MIS-088 · Misiones con horario/recordatorio propio
**Qué:** Hoy solo hay días, no hora; integrar con `notifications.ts` para recordar misiones concretas. **Dónde:** `types.ts:26`, `QuestForm.tsx:115` · **Impacto:** 3 · **Esfuerzo:** L

### MIS-089 · Vista de calendario semanal de misiones
**Qué:** Mostrar una rejilla L–D con qué misiones tocan cada día. **Dónde:** `misiones.tsx:70` · **Impacto:** 3 · **Esfuerzo:** L

### MIS-090 · Estadística de cumplimiento por misión
**Qué:** "Completada 12/20 días" usando `completions`; ayuda a decidir editar/borrar. **Dónde:** `misiones.tsx:88`, `data.ts:61` · **Impacto:** 3 · **Esfuerzo:** M

### MIS-091 · Indicador de misión nunca completada
**Qué:** Marcar misiones sin ninguna completion para revisión. **Dónde:** `misiones.tsx:85` · **Impacto:** 2 · **Esfuerzo:** M

### MIS-092 · `testID` en controles clave para pruebas E2E
**Qué:** Ningún elemento tiene `testID` (botón +, switch, papelera, inputs); añadirlos habilita Detox/Maestro. **Dónde:** `misiones.tsx:73,101,107`, `QuestForm.tsx:77` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-093 · Test unitario de `daysSummary`
**Qué:** Cubrir 7 días→"Todos los días", subconjuntos y (tras MIS-011) valores inválidos. **Dónde:** `misiones.tsx:16-19` · **Impacto:** 3 · **Esfuerzo:** S

### MIS-094 · Test de `toggleDay` (añadir/quitar/orden)
**Qué:** Verificar idempotencia y orden numérico tras MIS-012. **Dónde:** `QuestForm.tsx:36-38` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-095 · Test de validación de `submit`
**Qué:** Asegurar que no envía con título vacío, solo espacios o 0 días, ni con `saving` (`QuestForm.tsx:48-49`). **Dónde:** `QuestForm.tsx:48` · **Impacto:** 3 · **Esfuerzo:** S

### MIS-096 · Test de doble-submit del formulario
**Qué:** El guard es `saving` (`QuestForm.tsx:49`); cubrir que dos taps rápidos no creen dos misiones. **Dónde:** `QuestForm.tsx:48-64` · **Impacto:** 3 · **Esfuerzo:** S

### MIS-097 · Test de reversión del toggle (tras CRIT-MIS-02)
**Qué:** Simular `setQuestActive` que rechaza y verificar que el switch vuelve. **Dónde:** `misiones.tsx:49-52` · **Impacto:** 3 · **Esfuerzo:** S

### MIS-098 · Test de `createQuest`/`updateQuest`/`deleteQuest` con mock de supabase
**Qué:** Cubrir el manejo de error (lanza) y el camino feliz. **Dónde:** `data.ts:41-59` · **Impacto:** 2 · **Esfuerzo:** M

### MIS-099 · Snapshot de QuestItem en sus estados
**Qué:** completed / busy / penalty / con evidencia (`QuestItem.tsx:25-51`). **Dónde:** `QuestItem.tsx:16` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-100 · Comentario/JSDoc en `daysSummary` y helpers
**Qué:** Documentar la invariante de índices 1–7. **Dónde:** `misiones.tsx:16` · **Impacto:** 1 · **Esfuerzo:** S

### MIS-101 · Extraer estilos compartidos (chips) a un módulo
**Qué:** `chip`/`chipOn`/`chipText` se repiten conceptualmente entre formulario y otras pantallas; centralizar. **Dónde:** `QuestForm.tsx:205-229` · **Impacto:** 1 · **Esfuerzo:** M

### MIS-102 · Tipar `DAY_LABELS` y el índice
**Qué:** `DAY_LABELS[d - 1]` puede ser `string | undefined` con `noUncheckedIndexedAccess`; tras MIS-011 manejar el `undefined`. **Dónde:** `misiones.tsx:18` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-103 · Evitar índice optimista colisionando con datos reales
**Qué:** Sistema usa `id: local-${quest.id}` para completion optimista (`index.tsx:118`); en Misiones no hay optimismo de id, pero al añadir undo (MIS-004) garantizar ids estables para no chocar con `key={q.id}` (`misiones.tsx:86`). **Dónde:** `misiones.tsx:86` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-104 · Manejar lista muy larga de chips de stat sin desbordar
**Qué:** `chips` usa `flexWrap` (`QuestForm.tsx:200-204`); con 5 stats va bien, pero documentar el wrap por si crecen. **Dónde:** `QuestForm.tsx:86` · **Impacto:** 1 · **Esfuerzo:** S

### MIS-105 · Placeholder del título más representativo / rotatorio
**Qué:** El placeholder fijo "Gimnasio — pierna" (`QuestForm.tsx:81`) podría rotar ejemplos por stat seleccionada. **Dónde:** `QuestForm.tsx:81` · **Impacto:** 1 · **Esfuerzo:** S

### MIS-106 · `autoCapitalize`/`autoCorrect` explícitos en el título
**Qué:** El `TextInput` no fija capitalización; definir `autoCapitalize="sentences"`. **Dónde:** `QuestForm.tsx:77` · **Impacto:** 1 · **Esfuerzo:** S

### MIS-107 · `keyboardAppearance="dark"` acorde al tema
**Qué:** El teclado iOS sale claro sobre UI oscura; fijar apariencia oscura. **Dónde:** `QuestForm.tsx:77` · **Impacto:** 1 · **Esfuerzo:** S

### MIS-108 · Selección de texto/cursor con color del tema
**Qué:** `selectionColor={colors.cyan}` en el input para coherencia visual. **Dónde:** `QuestForm.tsx:77` · **Impacto:** 1 · **Esfuerzo:** S

### MIS-109 · Sombra/contorno de foco en el input
**Qué:** El input no cambia de borde al enfocarse (`QuestForm.tsx:190-199`); resaltar con `cyan` en foco. **Dónde:** `QuestForm.tsx:77` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-110 · Estado deshabilitado visible del botón Crear
**Qué:** `SystemButton` baja opacidad (`SystemButton.tsx:62`), pero el usuario no sabe qué falta; combinar con MIS-015/016. **Dónde:** `QuestForm.tsx:149` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-111 · Confirmación visual tras crear (toast "Misión creada")
**Qué:** Tras crear, el modal se cierra sin feedback (`QuestForm.tsx:59-60`); mostrar toast en Misiones. **Dónde:** `misiones.tsx:43-47` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-112 · Scroll automático a la misión recién creada
**Qué:** Tras crear, hacer scroll/destacar la nueva fila para que el usuario la vea. **Dónde:** `misiones.tsx:85` · **Impacto:** 2 · **Esfuerzo:** M

### MIS-113 · Evitar recarga completa tras crear (insert optimista)
**Qué:** `onCreate` hace `await load()` recargando todo (`misiones.tsx:46`); insertar la misión devuelta por `createQuest` (que retorna `Quest`, `data.ts:48`) en el estado. **Dónde:** `misiones.tsx:43-47` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-114 · Evitar recarga completa tras borrar
**Qué:** `onDelete` recarga todo (`misiones.tsx:62`); filtrar la fila del estado optimistamente. **Dónde:** `misiones.tsx:60-63` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-115 · No volver a traer penalizaciones para descartarlas en cliente
**Qué:** `fetchQuests` trae todo y `misiones.tsx:31` filtra `!is_penalty` en cliente; podría filtrarse en la query (`.eq('is_penalty', false)`) para no transferir penalizaciones. **Dónde:** `misiones.tsx:30-31`, `data.ts:24-31` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-116 · `fetchQuests` específico para la pantalla Misiones
**Qué:** Un `fetchManageableQuests()` que ya excluya penalizaciones evita duplicar el filtro entre Sistema y Misiones. **Dónde:** `data.ts:24` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-117 · Mostrar fecha de creación de la misión
**Qué:** `Quest.created_at` existe (`types.ts:38`) pero no se muestra; útil en edición. **Dónde:** `misiones.tsx:88` · **Impacto:** 1 · **Esfuerzo:** S

### MIS-118 · Evitar parpadeo del empty state al recargar por foco
**Qué:** Cada `useFocusEffect` vacía y rellena (`misiones.tsx:37-41`); mantener la lista previa mientras carga. **Dónde:** `misiones.tsx:28-35` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-119 · Mensaje de error más específico que "Fallo desconocido"
**Qué:** El `catch` genérico (`misiones.tsx:33`) no distingue red de permisos; mapear errores comunes de Supabase. **Dónde:** `misiones.tsx:33` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-120 · Reintento tras error de carga
**Qué:** Si `load` falla, no hay botón de reintentar (solo el `Alert`, `misiones.tsx:32-34`); ofrecer "Reintentar". **Dónde:** `misiones.tsx:28-35` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-121 · Voz del sistema en los textos de Misiones
**Qué:** La pantalla usa copy plano ("Sin misiones todavía", `misiones.tsx:80-82`); alinear con la voz del "sistema" (skill nivl-design-system) como en Sistema (`voice.*`). **Dónde:** `misiones.tsx:80` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-122 · Encabezado del formulario en la voz del sistema
**Qué:** "NUEVA MISIÓN" podría ser "REGISTRO DE MISIÓN" u otra forma coherente con la narrativa. **Dónde:** `QuestForm.tsx:74` · **Impacto:** 1 · **Esfuerzo:** S

### MIS-123 · Confirmar al activar una misión con días pasados/sin sentido
**Qué:** No se valida coherencia (p. ej. evidencia obligatoria sin permiso de cámara); avisar al activar. **Dónde:** `misiones.tsx:49`, `QuestForm.tsx:132` · **Impacto:** 1 · **Esfuerzo:** M

### MIS-124 · Soporte de orientación horizontal / tablets en el sheet
**Qué:** El bottom sheet a 88% (`QuestForm.tsx:172`) y el `flex-end` no se adaptan a landscape; revisar. **Dónde:** `QuestForm.tsx:164,172` · **Impacto:** 1 · **Esfuerzo:** M

### MIS-125 · Reducir movimiento si el usuario lo solicita
**Qué:** `animationType="slide"` (`QuestForm.tsx:67`) ignora `prefers-reduced-motion`/`AccessibilityInfo.isReduceMotionEnabled`. **Dónde:** `QuestForm.tsx:67` · **Impacto:** 1 · **Esfuerzo:** S

### MIS-126 · `numberOfLines`/elipsis en el título de la lista de Misiones
**Qué:** `questTitle` (`misiones.tsx:89-91`) no limita líneas (sí lo hace `QuestItem`, `QuestItem.tsx:33`); un título largo empuja el layout. **Dónde:** `misiones.tsx:89` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-127 · Alinear verticalmente acciones con título largo
**Qué:** `actions` se centra (`misiones.tsx:184-187`); con 3 líneas de meta queda descolocado. **Dónde:** `misiones.tsx:184` · **Impacto:** 1 · **Esfuerzo:** S

### MIS-128 · Separadores/espaciado entre misiones más claros
**Qué:** Cada misión es un `SystemWindow` con `marginBottom: 12` (`SystemWindow.tsx:53`); revisar densidad con muchas filas. **Dónde:** `misiones.tsx:86` · **Impacto:** 1 · **Esfuerzo:** S

### MIS-129 · Distinguir penalización en `QuestItem` también por texto accesible
**Qué:** La penalización se marca con tag rojo (`QuestItem.tsx:37-38`); añadir `accessibilityLabel` que lo verbalice. **Dónde:** `QuestItem.tsx:37` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-130 · Estado "busy" accesible en QuestItem
**Qué:** Mientras completa, solo gira un `ActivityIndicator` (`QuestItem.tsx:26-27`); anunciar "Completando…" con `accessibilityLiveRegion`. **Dónde:** `QuestItem.tsx:26` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-131 · Evitar `numberOfLines={1}` cortando títulos importantes en QuestItem
**Qué:** Títulos largos se truncan sin tooltip (`QuestItem.tsx:33`); permitir 2 líneas o mostrar completo al pulsar. **Dónde:** `QuestItem.tsx:33` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-132 · Mostrar el bonus de evidencia esperado en el XP de QuestItem
**Qué:** `previewXp` se calcula con `evidence: false` (`QuestItem.tsx:17`); indicar "+25% con foto" si la misión lo permite. **Dónde:** `QuestItem.tsx:17,49-51` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-133 · Coherencia del XP mostrado entre lista (Misiones) y Sistema
**Qué:** Misiones muestra `XP_BY_DIFFICULTY` plano (`misiones.tsx:93`) mientras Sistema muestra el XP con racha (`QuestItem.tsx:17`); unificar el criterio para no confundir. **Dónde:** `misiones.tsx:93`, `QuestItem.tsx:17` · **Impacto:** 3 · **Esfuerzo:** S

### MIS-134 · Indicar visualmente que el +XP de Misiones es "base"
**Qué:** Acompaña a MIS-133: rotular "50 XP base" en la fila para evitar expectativa errónea. **Dónde:** `misiones.tsx:92-94` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-135 · Bloquear evidencia obligatoria si no hay cámara disponible
**Qué:** Se puede crear una misión con evidencia obligatoria aunque el permiso de cámara esté denegado (se descubre al completar, `index.tsx:93-96`); avisar en el formulario. **Dónde:** `QuestForm.tsx:132-143` · **Impacto:** 2 · **Esfuerzo:** M

### MIS-136 · Permitir evidencia desde galería, no solo cámara
**Qué:** Decisión de UX que afecta al formulario: el flag "evidencia" obliga a cámara en vivo (`index.tsx:98-105`); ofrecer opción galería cambia el copy del switch. **Dónde:** `QuestForm.tsx:134-135` · **Impacto:** 2 · **Esfuerzo:** M

### MIS-137 · Validar título duplicado
**Qué:** Nada impide dos misiones con el mismo título; avisar (no bloquear) al crear/editar. **Dónde:** `QuestForm.tsx:48`, `misiones.tsx:43` · **Impacto:** 2 · **Esfuerzo:** M

### MIS-138 · Límite máximo de misiones activas
**Qué:** Sin tope, una lista enorme degrada Sistema (todas se pintan en `index.tsx:295-306`); sugerir/limitar. **Dónde:** `misiones.tsx:43` · **Impacto:** 1 · **Esfuerzo:** M

### MIS-139 · Persistir borrador del formulario
**Qué:** Si la app se cierra con el modal abierto, se pierde lo escrito (estado en memoria, `QuestForm.tsx:29-34`); guardar borrador en AsyncStorage. **Dónde:** `QuestForm.tsx:29` · **Impacto:** 1 · **Esfuerzo:** M

### MIS-140 · Reordenar el `onSubmit` para feedback inmediato
**Qué:** `onSubmit` (en `onCreate`) hace red + recarga antes de cerrar (`misiones.tsx:45-46` se espera dentro de `submit`); cerrar tras crear y recargar en segundo plano para sensación de rapidez. **Dónde:** `QuestForm.tsx:52-60`, `misiones.tsx:43-47` · **Impacto:** 2 · **Esfuerzo:** M

### MIS-141 · Deshabilitar interacción de la fila durante su escritura
**Qué:** Mientras `setQuestActive` está en vuelo (`misiones.tsx:51`) se puede tocar de nuevo el switch o la papelera; bloquear la fila. **Dónde:** `misiones.tsx:100-110` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-142 · Guard anti doble-borrado
**Qué:** El `Alert` evita el doble tap, pero si se confirma dos veces rápido (dos alerts encolados) podría llamar `deleteQuest` dos veces; idempotente en BD pero conviene un lock como en `index.tsx:47-52`. **Dónde:** `misiones.tsx:54-66` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-143 · Tipo de retorno explícito de los handlers
**Qué:** `onToggle`/`onDelete`/`onCreate` no anotan retorno; añadir `: Promise<void>`/`: void` por claridad y para el modo estricto. **Dónde:** `misiones.tsx:43,49,54` · **Impacto:** 1 · **Esfuerzo:** S

### MIS-144 · Extraer `DAY_LABELS`/`daysSummary` a util testeable
**Qué:** Mover a `lib/quests.ts` para test y reutilización entre formulario, lista y Sistema. **Dónde:** `misiones.tsx:14-19` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-145 · Constantes de validación centralizadas (maxLength, máx misiones)
**Qué:** Definir `QUEST_TITLE_MAX`, `QUEST_MAX_ACTIVE` en `lib` para usar en formulario y datos. **Dónde:** `QuestForm.tsx:77`, `data.ts:41` · **Impacto:** 1 · **Esfuerzo:** S

### MIS-146 · Documentar el contrato `QuestInput`
**Qué:** `QuestInput` (`data.ts:33-39`) no documenta invariantes (días 1–7, título no vacío); añadir JSDoc. **Dónde:** `data.ts:33` · **Impacto:** 1 · **Esfuerzo:** S

### MIS-147 · Mensaje accesible al deshabilitar el botón Crear
**Qué:** `SystemButton` con `disabled` no expone `accessibilityState={{disabled:true}}` (`SystemButton.tsx:17-27`); añadirlo para lectores. **Dónde:** `SystemButton.tsx:17` · **Impacto:** 2 · **Esfuerzo:** S

### MIS-148 · `accessibilityRole="button"` en SystemButton
**Qué:** El `Pressable` base no declara rol (`SystemButton.tsx:17`), afecta a Crear/Cancelar del formulario. **Dónde:** `SystemButton.tsx:17` · **Impacto:** 3 · **Esfuerzo:** S

### MIS-149 · Foco al primer error tras intentar enviar
**Qué:** Si falta título o días, mover el foco al campo correspondiente al pulsar Crear. **Dónde:** `QuestForm.tsx:48-49` · **Impacto:** 2 · **Esfuerzo:** M

### MIS-150 · Resumen accesible del formulario antes de enviar
**Qué:** Verbalizar "Misión Gimnasio, Fuerza, dificultad media, lunes a viernes, sin evidencia" antes de crear. **Dónde:** `QuestForm.tsx:145` · **Impacto:** 1 · **Esfuerzo:** M

Total: 150 mejoras, 4 bugs.
