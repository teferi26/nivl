# UX/UI Diario, informe y heatmap

> Área DIA · auditoría de código NIVL · anclada al código real

Archivos auditados:
- `src/app/diario.tsx` (279 líneas)
- `src/app/informe.tsx` (188 líneas)
- `src/components/Heatmap.tsx` (63 líneas)
- Capa de datos vecina leída para contexto: `src/lib/journal.ts`, `src/lib/dates.ts`, `src/lib/data.ts`, `src/lib/types.ts`, `src/lib/theme.ts`.

## Bugs y riesgos

### CRIT-DIA-01 · `upsertEntry` es read-modify-write sin transacción: doble XP y carrera con la crónica — `src/lib/journal.ts:19` + `src/app/diario.tsx:101` · severidad alta
**Problema:** `save()` no deshabilita lógicamente la primera pulsación hasta que el `setBusy(true)` re-renderiza. `save()` guarda contra `busy` (`if (!userId || busy) return;`), pero `busy` es estado de React: dos toques muy rápidos en `SystemButton` entran ambos antes del primer re-render. Cada uno ejecuta `upsertEntry`, que internamente hace `fetchEntryForDate` → `insert` (journal.ts:23-40). Ambos leen "no existe", ambos insertan, ambos devuelven `isNew: true`, y `awardXp(profile, JOURNAL_XP, …)` (diario.tsx:113) se ejecuta dos veces: XP duplicado y dos filas de diario para el mismo día. Como `journal_entries` no tiene (según el insert) restricción única (user_id,date) garantizada en cliente, la integridad depende solo del SQL.
**Arreglo:** usar un `useRef(false)` como cerrojo síncrono además del estado `busy` (`if (lock.current) return; lock.current = true;` al entrar, liberar en `finally`). Y, idealmente, mover el upsert a `supabase.from('journal_entries').upsert({...}, { onConflict: 'user_id,date' })` con índice único en BD, eliminando el patrón leer-luego-insertar.

### CRIT-DIA-02 · La pantalla Diario no se refresca al volver a ella (`useEffect` en vez de `useFocusEffect`) — `src/app/diario.tsx:97` · severidad media
**Problema:** `load()` se invoca solo en `useEffect(() => { load(); }, [load])`, y `load` depende de `today` (diario.tsx:95), que es estable durante la vida del componente. Como `diario` es una pantalla de stack que expo-router mantiene montada, al completar misiones/gym y volver al Diario, la "CRÓNICA AUTOMÁTICA DE HOY" y "ENTRADAS ANTERIORES" muestran datos viejos. Las 5 pestañas sí usan `useFocusEffect` (verificado en `(tabs)/*.tsx`); estas dos pantallas stack quedaron fuera del patrón.
**Arreglo:** sustituir el `useEffect` por `useFocusEffect(useCallback(() => { load(); }, [load]))` de `@react-navigation/native` (o `expo-router`), igual que las tabs.

### CRIT-DIA-03 · El Informe tampoco se refresca al enfocarse: KPIs y heatmap obsoletos — `src/app/informe.tsx:32` · severidad media
**Problema:** mismo patrón que DIA-02. `informe.tsx` carga `completions`/`quests` una sola vez con `useEffect(... [load])`. Al completar una misión y abrir el Informe sin desmontarlo, "ÚLTIMOS 7 DÍAS", "XP POR ESTADÍSTICA" y "MAPA DE ACTIVIDAD" no reflejan la actividad recién hecha. Para una pantalla cuyo único propósito es reflejar el estado actual, mostrar datos caducados es un fallo funcional.
**Arreglo:** `useFocusEffect(useCallback(() => { load(); }, [load]))`.

### CRIT-DIA-04 · `today` se congela al montar: a medianoche el Diario y el Informe operan sobre el día equivocado — `src/app/diario.tsx:66` + `src/app/informe.tsx:17` · severidad media
**Problema:** `const today = dateKey();` se evalúa una vez en el render inicial. Si la app permanece abierta y cruza medianoche (muy plausible en una rutina nocturna de cierre del día), `today` sigue siendo ayer. En Diario, `save()` escribe `date: today` (ayer) y `fetchEntryForDate(today)` lee ayer; en Informe, `weekStart`/`prevWeekStart`/`from` se calculan sobre ayer y el heatmap resalta mal el "hoy". El usuario cree registrar el día actual y registra el anterior.
**Arreglo:** recalcular `today` en cada `load()` (no en el cuerpo del componente), o suscribirse a un tick de fecha. Como mínimo, en `save()` usar `dateKey()` fresco en lugar del `today` capturado.

### CRIT-DIA-05 · El parámetro `dateKey` de `promptForDate` ensombrece la función importada `dateKey` — `src/lib/journal.ts:78` · severidad baja
**Problema:** `export function promptForDate(dateKey: string)` nombra su parámetro igual que la función `dateKey` importada implícitamente en otros módulos. Dentro de `promptForDate` el identificador `dateKey` ya no es la función sino el string; hoy funciona porque no se llama a la función dentro, pero es una trampa latente: cualquier edición futura que intente `dateKey()` dentro de esta función fallará en runtime ("dateKey is not a function") de forma confusa. Riesgo de mantenibilidad real.
**Arreglo:** renombrar el parámetro a `key` (o `dateStr`): `export function promptForDate(key: string)` y actualizar el cuerpo.

### CRIT-DIA-06 · `narrative` y los cálculos de Informe se recomputan en cada render (incluido el O(n²) de `bestDay`) sin memoizar — `src/app/informe.tsx:36` · severidad baja
**Problema:** todo el bloque de derivación (thisWeek, prevWeek, xpByStat, byDay, el bucle anidado de `bestDay` en informe.tsx:63-69 que es O(n²) sobre `thisWeek`, y la IIFE `narrative`) se ejecuta en el cuerpo del componente en cada render. No es crasheo, pero con 91 días de completions y cada cambio de estado, se recalcula entero. El `bestDay` recorre `thisWeek` y por cada elemento vuelve a filtrar `thisWeek` completo.
**Arreglo:** envolver las derivaciones en `useMemo(() => …, [completions, quests, today])`. Para `bestDay`, precomputar `xpByDate` con un único `reduce` y luego tomar el máximo (O(n)).

### CRIT-DIA-07 · `fetchRecentEntries(14)` limita ANTES de filtrar hoy: a veces muestra 13 entradas, no 14 — `src/app/diario.tsx:85` + `src/lib/journal.ts:9` · severidad baja
**Problema:** `fetchRecentEntries(14)` pide a Supabase las 14 filas más recientes ordenadas por fecha desc, y luego el cliente hace `.filter((e) => e.date !== today)` (diario.tsx:85). Si existe entrada de hoy, queda dentro de esas 14 y se descarta, dejando 13 en "ENTRADAS ANTERIORES". El límite debería aplicarse al conjunto ya filtrado.
**Arreglo:** pedir `limit + 1` y recortar tras filtrar, o excluir hoy en la query (`.neq('date', today)`), o pedir 15 y `.slice(0, 14)` tras el filtro.

### CRIT-DIA-08 · La barra de XP por estadística divide por `xpByStat[topStat]` que puede ser 0 → ancho NaN% — `src/app/informe.tsx:144` · severidad baja
**Problema:** el ancho de barra es `Math.round((xpByStat[s] / Math.max(1, xpByStat[topStat])) * 100)`. El `Math.max(1, …)` protege el divisor, así que NaN no se produce; pero cuando NO hay actividad esta semana, `topStat` cae por defecto en `'FUE'` (reduce con seed 'FUE', informe.tsx:55) y la fila FUE se pinta con `colors.cyan` (color de "líder") aunque su valor sea 0, sugiriendo falsamente que FUE domina. UX engañosa en semana vacía.
**Arreglo:** si `xpByStat[topStat] === 0`, no marcar ninguna barra como líder (usar `colors.cyanDim` para todas) y/o mostrar un estado vacío "Sin datos esta semana".

## Mejoras

### DIA-001 · Editar entradas de días pasados desde la lista
**Qué:** hacer cada fila de "ENTRADAS ANTERIORES" pulsable para abrir el editor (ánimo/energía/texto) de ese día concreto, no solo de hoy. Es la petición central del foco "editar entradas pasadas". **Dónde:** `src/app/diario.tsx:198-212`. **Impacto:** 5 · **Esfuerzo:** M

### DIA-002 · Selector de fecha para navegar a cualquier día del diario
**Qué:** añadir un control de fecha (flechas ‹ ayer / mañana › + atajo a calendario) que cambie el día activo del editor, reutilizando `fetchEntryForDate(fecha)` y `upsertEntry(userId,{date})`. **Dónde:** cabecera de `src/app/diario.tsx:134-140`. **Impacto:** 5 · **Esfuerzo:** M

### DIA-003 · Cerrojo síncrono con `useRef` contra el doble guardado
**Qué:** añadir `const lock = useRef(false)` y comprobarlo al inicio de `save()` para impedir XP duplicado por doble toque (ver CRIT-DIA-01). **Dónde:** `src/app/diario.tsx:101-103`. **Impacto:** 4 · **Esfuerzo:** S

### DIA-004 · Migrar `upsertEntry` a `upsert` real con `onConflict`
**Qué:** sustituir el patrón leer-luego-insertar por `supabase.from('journal_entries').upsert(payload,{ onConflict:'user_id,date' })` y derivar `isNew` del resultado, eliminando la carrera de raíz. **Dónde:** `src/lib/journal.ts:19-41`. **Impacto:** 5 · **Esfuerzo:** M

### DIA-005 · `useFocusEffect` en Diario
**Qué:** refrescar crónica/entradas al volver a la pantalla (ver CRIT-DIA-02). **Dónde:** `src/app/diario.tsx:97-99`. **Impacto:** 4 · **Esfuerzo:** S

### DIA-006 · `useFocusEffect` en Informe
**Qué:** recargar completions al enfocar (ver CRIT-DIA-03). **Dónde:** `src/app/informe.tsx:32-34`. **Impacto:** 4 · **Esfuerzo:** S

### DIA-007 · Recalcular `today` en cada carga
**Qué:** mover `dateKey()` dentro de `load()`/`save()` para evitar el bug de medianoche (ver CRIT-DIA-04). **Dónde:** `src/app/diario.tsx:66`, `src/app/informe.tsx:17`. **Impacto:** 3 · **Esfuerzo:** S

### DIA-008 · Memoizar derivaciones del Informe
**Qué:** envolver thisWeek/prevWeek/xpByStat/byDay/narrative en `useMemo`. **Dónde:** `src/app/informe.tsx:36-94`. **Impacto:** 3 · **Esfuerzo:** S

### DIA-009 · Cálculo de `bestDay` en O(n)
**Qué:** reemplazar el doble bucle por un `xpByDate` precomputado (un `reduce`) y tomar el máximo. **Dónde:** `src/app/informe.tsx:61-69`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-010 · Corregir el conteo de "ENTRADAS ANTERIORES" (límite tras filtro)
**Qué:** pedir 15 / usar `.neq('date', today)` para no perder una fila (ver CRIT-DIA-07). **Dónde:** `src/app/diario.tsx:85`, `src/lib/journal.ts:9-17`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-011 · Estado vacío honesto en la barra de XP por estadística
**Qué:** no marcar FUE como líder en semana sin datos (ver CRIT-DIA-08). **Dónde:** `src/app/informe.tsx:136-150`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-012 · Heatmap interactivo: tocar un día abre su detalle
**Qué:** envolver cada `Rect` en un `Pressable`/`onPress` que dispare `onDayPress(date)` con la fecha y el conteo; el contenedor padre muestra un tooltip/hoja con misiones de ese día. Núcleo del foco "heatmap interactivo". **Dónde:** `src/components/Heatmap.tsx:50-52`. **Impacto:** 5 · **Esfuerzo:** M

### DIA-013 · Tooltip de día en el heatmap (fecha + nº misiones + XP)
**Qué:** al tocar una celda, mostrar "14 jun · 3 misiones · +75 XP" en una línea bajo el grid. **Dónde:** `src/components/Heatmap.tsx:47-61` (estado local del componente). **Impacto:** 4 · **Esfuerzo:** M

### DIA-014 · Buscar en entradas del diario por texto
**Qué:** campo de búsqueda que filtre `text` de entradas (full-text en Supabase con `.textSearch` o `ilike`), resaltando coincidencias. Foco "búsqueda". **Dónde:** nueva sección en `src/app/diario.tsx`; nueva función en `src/lib/journal.ts`. **Impacto:** 4 · **Esfuerzo:** M

### DIA-015 · "Hace un año" / "En este día"
**Qué:** bloque que cargue la entrada de la misma fecha de años anteriores (`fetchEntryForDate` con año−1) para releer el yo pasado; el prompt #6 ya alude a "tu yo de hace un año". **Dónde:** nueva sección en `src/app/diario.tsx`; consulta en `src/lib/journal.ts`. **Impacto:** 4 · **Esfuerzo:** M

### DIA-016 · Exportar informe a PDF
**Qué:** botón "Exportar informe" que genere un PDF (vía `expo-print`/`exporter.ts`) con KPIs, barras por stat, heatmap y narrativa de la semana. Foco "exportar informe PDF". **Dónde:** cabecera de `src/app/informe.tsx:99-105`; reutilizar `src/lib/exporter.ts`. **Impacto:** 4 · **Esfuerzo:** L

### DIA-017 · Gráfica de tendencia de XP diario (sparkline/área 13 semanas)
**Qué:** añadir un gráfico de línea/área de XP por día sobre los 91 días ya cargados en `completions`, para ver la curva, no solo el heatmap discreto. Foco "gráficas más ricas" y "tendencias". **Dónde:** nueva `SystemWindow` en `src/app/informe.tsx` tras el heatmap. **Impacto:** 4 · **Esfuerzo:** M

### DIA-018 · Correlación sueño/energía ↔ rendimiento (mood/energy del diario vs XP)
**Qué:** el Informe nunca lee `mood`/`energy` (no se importa `journal`), aunque existen en `JournalEntry`. Cruzar energía/ánimo del diario con XP/misiones del mismo día y mostrar la correlación. Foco "correlaciones (sueño↔gym)". **Dónde:** `src/app/informe.tsx` (añadir `fetchRecentEntries`/consulta de rango); datos en `src/lib/journal.ts`. **Impacto:** 5 · **Esfuerzo:** L

### DIA-019 · Etiqueta de energía bajo la escala (paridad con ánimo)
**Qué:** el ánimo muestra `MOOD_LABELS[mood-1]` (diario.tsx:153) pero la energía no tiene texto descriptivo; añadir `ENERGY_LABELS` y su línea. **Dónde:** `src/app/diario.tsx:155-162`. **Impacto:** 3 · **Esfuerzo:** S

### DIA-020 · Fechas legibles en "ENTRADAS ANTERIORES"
**Qué:** `e.date` se muestra como `2026-06-14` crudo (diario.tsx:200); formatear con `formatLongDate`/un helper a "14 jun · sábado". **Dónde:** `src/app/diario.tsx:200`. **Impacto:** 3 · **Esfuerzo:** S

### DIA-021 · Fecha legible para "mejor día" en la narrativa
**Qué:** la narrativa dice el día de la semana ("el sábado") pero no la fecha; añadir el número de día. **Dónde:** `src/app/informe.tsx:85-89`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-022 · Etiquetas de día de la semana (L M X J V S D) en el heatmap
**Qué:** columna de iniciales de día a la izquierda del grid para orientar la lectura, como GitHub. **Dónde:** `src/components/Heatmap.tsx:47-53`. **Impacto:** 3 · **Esfuerzo:** M

### DIA-023 · Etiquetas de mes sobre el heatmap
**Qué:** fila superior con abreviaturas de mes alineadas a las columnas-semana donde cambia el mes. **Dónde:** `src/components/Heatmap.tsx:35-53`. **Impacto:** 3 · **Esfuerzo:** M

### DIA-024 · `accessibilityLabel`/`accessibilityRole` en las escalas de ánimo y energía
**Qué:** los chips numéricos (diario.tsx:148, 158) no anuncian su significado; añadir rol `radio`, estado seleccionado y label "Ánimo 3 de 5 · Normal". **Dónde:** `src/app/diario.tsx:147-161`. **Impacto:** 3 · **Esfuerzo:** S

### DIA-025 · `accessibilityRole="header"` en títulos de pantalla
**Qué:** "DIARIO DEL CAZADOR" e "INFORME DEL SISTEMA" deberían exponerse como encabezados a lectores de pantalla. **Dónde:** `src/app/diario.tsx:138`, `src/app/informe.tsx:103`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-026 · `accessibilityLabel` en el botón de volver
**Qué:** el `Pressable` con `chevron-back` no tiene etiqueta accesible "Volver". **Dónde:** `src/app/diario.tsx:135`, `src/app/informe.tsx:100`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-027 · Heatmap accesible: `accessibilityLabel` por celda
**Qué:** cada `Rect` SVG es invisible para TalkBack; con el cambio a `Pressable` (DIA-012), añadir label "14 junio, 3 misiones". **Dónde:** `src/components/Heatmap.tsx:50-52`. **Impacto:** 3 · **Esfuerzo:** S

### DIA-028 · Touch targets de los chips de escala a ≥44px
**Qué:** `scaleChip` tiene `paddingVertical:10` y la altura efectiva queda por debajo del mínimo recomendado de 44px; subir padding o `minHeight`. **Dónde:** `src/app/diario.tsx:241-247`. **Impacto:** 3 · **Esfuerzo:** S

### DIA-029 · Contador de caracteres / longitud en el textarea
**Qué:** mostrar nº de palabras o caracteres bajo el campo "Tu registro" para dar sensación de progreso de escritura. **Dónde:** `src/app/diario.tsx:165-172`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-030 · Autosave / borrador del texto del diario
**Qué:** persistir el borrador (AsyncStorage) mientras se escribe, para no perderlo si se cierra la app antes de guardar. **Dónde:** `src/app/diario.tsx:67-73` (estado `text`). **Impacto:** 4 · **Esfuerzo:** M

### DIA-031 · Confirmar descarte si hay cambios sin guardar al salir
**Qué:** al pulsar volver con `text`/`mood`/`energy` modificados y sin guardar, pedir confirmación. **Dónde:** `src/app/diario.tsx:135`. **Impacto:** 3 · **Esfuerzo:** M

### DIA-032 · `KeyboardAvoidingView` para que el teclado no tape el textarea
**Qué:** en pantallas con `TextInput` largo conviene envolver en `KeyboardAvoidingView`; hoy solo hay `keyboardShouldPersistTaps`. **Dónde:** `src/app/diario.tsx:132-133`. **Impacto:** 3 · **Esfuerzo:** S

### DIA-033 · `maxLength` o aviso de límite en el textarea
**Qué:** definir un tope razonable de caracteres y avisar al acercarse, evitando entradas gigantes. **Dónde:** `src/app/diario.tsx:165-172`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-034 · Permitir limpiar ánimo/energía ya marcados
**Qué:** una vez tocado un chip no hay forma de volver a "sin valor"; permitir re-toque para deseleccionar (mood/energy a null). **Dónde:** `src/app/diario.tsx:148`, `158`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-035 · Estado de carga inicial (skeleton) en Diario
**Qué:** mientras `load()` resuelve, mostrar placeholders en lugar del formulario vacío que luego "salta" al rellenarse con la entrada existente. **Dónde:** `src/app/diario.tsx:76-99`. **Impacto:** 2 · **Esfuerzo:** M

### DIA-036 · Estado de carga inicial en Informe
**Qué:** al abrir, los KPIs muestran 0/—/0% antes de que llegue `completions`; mostrar skeleton para no parpadear de "0" a valores reales. **Dónde:** `src/app/informe.tsx:18-19`. **Impacto:** 2 · **Esfuerzo:** M

### DIA-037 · Pull-to-refresh en el Informe
**Qué:** añadir `RefreshControl` al `ScrollView` para recargar manualmente los KPIs/heatmap. **Dónde:** `src/app/informe.tsx:98`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-038 · Pull-to-refresh en el Diario
**Qué:** `RefreshControl` para recargar crónica y entradas. **Dónde:** `src/app/diario.tsx:133`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-039 · Selector de rango temporal en el Informe (7/30/90 días)
**Qué:** segmented control para ver KPIs y stats de 7, 30 o 90 días sobre los datos ya cargados (91). **Dónde:** `src/app/informe.tsx:36-47`. **Impacto:** 4 · **Esfuerzo:** M

### DIA-040 · Tendencia de evidencia (% con evidencia por semana)
**Qué:** graficar la evolución de `evidencePct` semana a semana, no solo el valor de la semana actual. **Dónde:** `src/app/informe.tsx:46-47`. **Impacto:** 3 · **Esfuerzo:** M

### DIA-041 · Racha de días con entrada de diario
**Qué:** calcular y mostrar la racha actual de días consecutivos con entrada, reforzando el hábito de escribir. **Dónde:** `src/app/diario.tsx` (sobre `recent`); helper en `src/lib/journal.ts`. **Impacto:** 4 · **Esfuerzo:** M

### DIA-042 · Indicador "ya registrado hoy" más visible
**Qué:** cuando `savedToday`, mostrar un badge/check claro en la cabecera, no solo el cambio de texto del botón a "Actualizar entrada". **Dónde:** `src/app/diario.tsx:71`, `174-179`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-043 · Distinción visual de las celdas futuras vs vacías en el heatmap
**Qué:** los días futuros se omiten (`if (day > today) continue`), dejando huecos; renderizarlos atenuados/punteados para que el grid no parezca "roto" al final. **Dónde:** `src/components/Heatmap.tsx:38`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-044 · Resaltar la celda de "hoy" en el heatmap
**Qué:** borde/anillo en la celda del día actual para ubicarse rápido. **Dónde:** `src/components/Heatmap.tsx:39-44`. **Impacto:** 3 · **Esfuerzo:** S

### DIA-045 · Esquinas redondeadas (`rx`) en las celdas del heatmap
**Qué:** `Rect` admite `rx`/`ry`; aplicar un radio leve para un look más pulido coherente con el resto de la UI. **Dónde:** `src/components/Heatmap.tsx:51`. **Impacto:** 1 · **Esfuerzo:** S

### DIA-046 · Umbrales del heatmap relativos al máximo del usuario
**Qué:** `cellColor` usa cortes fijos (≤2, ≤4, >4); para un usuario con muchas misiones diarias todo queda saturado. Escalar por percentiles del propio `counts`. **Dónde:** `src/components/Heatmap.tsx:14-19`. **Impacto:** 3 · **Esfuerzo:** M

### DIA-047 · Leyenda del heatmap con valores numéricos
**Qué:** la leyenda "Menos/Más" no dice cuántas misiones representa cada tono; añadir los umbrales (p.ej. 0,1-2,3-4,5+). **Dónde:** `src/components/Heatmap.tsx:54-60`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-048 · El heatmap puede medir XP además de nº de misiones
**Qué:** ofrecer alternar el heatmap entre "nº de misiones" y "XP del día" (los datos de XP ya están en `completions`). **Dónde:** `src/app/informe.tsx:57-60` (construcción de `byDay`). **Impacto:** 3 · **Esfuerzo:** M

### DIA-049 · `key` estable en celdas del heatmap (no índice)
**Qué:** `cells.map((c,i)=><Rect key={i}>)` usa el índice; usar la fecha como key para reconciliación correcta si la lista cambia de tamaño. **Dónde:** `src/components/Heatmap.tsx:50`. **Impacto:** 1 · **Esfuerzo:** S

### DIA-050 · `key` estable en líneas de crónica (no índice)
**Qué:** `chronicle.map((line,i)=>…key={i})` usa índice; preferir el `id` del evento. **Dónde:** `src/app/diario.tsx:187-188`. **Impacto:** 1 · **Esfuerzo:** S

### DIA-051 · Conservar el `id` del evento en la crónica
**Qué:** `setChronicle(events.map(chronicleLine)…)` descarta el id; mapear a `{id, line}` para poder usar key estable (DIA-050) y, en el futuro, navegar al evento. **Dónde:** `src/app/diario.tsx:90-91`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-052 · Crónica con icono por tipo de evento
**Qué:** anteponer un icono (trofeo, rayo, calavera) según `e.type` para escanear la crónica de un vistazo. **Dónde:** `src/app/diario.tsx:37-61` (`chronicleLine`) y render 187-191. **Impacto:** 3 · **Esfuerzo:** M

### DIA-053 · Hora de cada evento en la crónica
**Qué:** la crónica no muestra cuándo ocurrió cada cosa; añadir la hora (`created_at`) a la izquierda de cada línea. **Dónde:** `src/app/diario.tsx:187-191`; usar `SystemEvent.created_at`. **Impacto:** 3 · **Esfuerzo:** S

### DIA-054 · Crónica de cualquier día (no solo hoy)
**Qué:** cuando el editor navegue a una fecha pasada (DIA-002), la crónica debería mostrar los eventos de ESE día, no siempre los de hoy. **Dónde:** `src/app/diario.tsx:86-91`. **Impacto:** 3 · **Esfuerzo:** M

### DIA-055 · Cobertura de tipos de evento en `chronicleLine`
**Qué:** el `switch` cubre 9 tipos y devuelve `null` para el resto, que se filtran y desaparecen sin rastro; registrar/mostrar genéricamente los tipos no contemplados para no "tragar" eventos. **Dónde:** `src/app/diario.tsx:39-60`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-056 · Validación de payloads de evento antes de formatear
**Qué:** `chronicleLine` hace `Number(p.xp ?? 0)`/`String(p.quest ?? '')` sin validar forma; un payload malformado produce "+NaN XP" o texto vacío. Validar/normalizar. **Dónde:** `src/app/diario.tsx:38-57`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-057 · Tests unitarios de `chronicleLine`
**Qué:** no hay tests; cubrir cada `case` y el `default` con payloads representativos y bordes (xp 0, strings vacíos). **Dónde:** nuevo `src/app/__tests__` o junto a la lógica extraída. **Impacto:** 3 · **Esfuerzo:** M

### DIA-058 · Extraer `chronicleLine` a un módulo testable
**Qué:** vive dentro de `diario.tsx`; moverla a `src/lib/chronicle.ts` para poder testarla sin montar el componente. **Dónde:** `src/app/diario.tsx:37-61`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-059 · Tests de `promptForDate` (determinismo y rango)
**Qué:** verificar que el hash es estable por fecha y que el índice siempre cae en rango de `PROMPTS`. **Dónde:** `src/lib/journal.ts:78-84`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-060 · Tests de la construcción de celdas del heatmap
**Qué:** extraer la generación de `cells` a función pura y testar el recorte por `today`, el cálculo de `lastMonday` y el nº de celdas. **Dónde:** `src/components/Heatmap.tsx:34-45`. **Impacto:** 3 · **Esfuerzo:** M

### DIA-061 · Tests de las derivaciones del Informe (KPIs, delta, topStat)
**Qué:** extraer los cálculos (thisWeek/xpByStat/delta/bestDay) a funciones puras y cubrir el caso semana vacía y semana previa = 0. **Dónde:** `src/app/informe.tsx:36-69`. **Impacto:** 3 · **Esfuerzo:** M

### DIA-062 · Extraer la lógica del Informe a `src/lib/report.ts`
**Qué:** separar cómputo de presentación para reutilizar en el PDF (DIA-016) y testar. **Dónde:** `src/app/informe.tsx:36-94`. **Impacto:** 3 · **Esfuerzo:** M

### DIA-063 · Tipar `payload` de `SystemEvent` por tipo de evento
**Qué:** `payload: Record<string, unknown>` obliga a casts en `chronicleLine`; definir uniones discriminadas por `type`. **Dónde:** `src/lib/journal.ts:50-55`. **Impacto:** 2 · **Esfuerzo:** M

### DIA-064 · `fetchEntryForDate` no propaga el error de Supabase
**Qué:** desestructura solo `{ data }` y devuelve null en error, ocultando fallos de red/RLS; capturar y lanzar `error` como las demás funciones. **Dónde:** `src/lib/journal.ts:4-7`. **Impacto:** 3 · **Esfuerzo:** S

### DIA-065 · `countEntries` no propaga error
**Qué:** igual que arriba, ignora `error` y devuelve 0, lo que puede romper la lógica de logros silenciosamente. **Dónde:** `src/lib/journal.ts:43-48`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-066 · `fetchEventsForDate` recibe ISO ya calculado en el cliente
**Qué:** `load()` construye `start`/`end` con `setHours` locales y los pasa como ISO; encapsular el cálculo del rango del día dentro de la función (recibir `dateKey`) para no duplicar lógica de zona horaria. **Dónde:** `src/app/diario.tsx:86-90`, `src/lib/journal.ts:57`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-067 · Filtrar la crónica por usuario (RLS/seguridad defensiva)
**Qué:** `fetchEventsForDate` consulta `events` sin `.eq('user_id', …)`; depende 100% de RLS. Añadir el filtro explícito por usuario como defensa en profundidad. **Dónde:** `src/lib/journal.ts:57-66`. **Impacto:** 3 · **Esfuerzo:** S

### DIA-068 · `fetchRecentEntries`/`fetchEntryForDate` sin filtro de usuario
**Qué:** ninguna de las consultas de diario filtra por `user_id`; mismo riesgo que DIA-067 si la RLS fallara. **Dónde:** `src/lib/journal.ts:4-17`. **Impacto:** 3 · **Esfuerzo:** S

### DIA-069 · Mensaje de error específico al guardar el diario
**Qué:** `save()` muestra "Error del sistema" genérico; distinguir error de red vs validación para guiar al usuario. **Dónde:** `src/app/diario.tsx:124-125`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-070 · Reintento al fallar la carga del Informe
**Qué:** si `load()` falla solo aparece una alerta; añadir botón "Reintentar" y estado de error en pantalla. **Dónde:** `src/app/informe.tsx:27-29`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-071 · Reintento al fallar la carga del Diario
**Qué:** igual que DIA-070 para `diario.tsx`. **Dónde:** `src/app/diario.tsx:92-94`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-072 · No bloquear el guardado por fallo de logros
**Qué:** en `save()`, si `unlockAchievements`/`countEntries` (diario.tsx:114-115) fallan, el `catch` muestra error aunque la entrada ya se guardó; aislar esos pasos para que su fallo no enmascare el éxito. **Dónde:** `src/app/diario.tsx:111-128`. **Impacto:** 3 · **Esfuerzo:** S

### DIA-073 · Conteo de entradas vía `countEntries` cuando ya tienes `recent`
**Qué:** se hace una consulta `count` extra; si solo importa cruzar umbrales de logros, considerar derivar del estado o cachear. **Dónde:** `src/app/diario.tsx:114`. **Impacto:** 1 · **Esfuerzo:** S

### DIA-074 · El prompt cambia cada día pero podría fijarse por entrada
**Qué:** `promptForDate(today)` recalcula por fecha; si el usuario empieza a escribir y vuelve otro día, el prompt difiere. Guardar el prompt usado junto a la entrada para coherencia histórica. **Dónde:** `src/app/diario.tsx:143`, `src/lib/journal.ts:78`. **Impacto:** 2 · **Esfuerzo:** M

### DIA-075 · Mostrar el prompt asociado en "ENTRADAS ANTERIORES"
**Qué:** al releer entradas pasadas, mostrar qué pregunta respondía cada una da contexto. Depende de DIA-074. **Dónde:** `src/app/diario.tsx:198-212`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-076 · Expandir entrada anterior (quitar `numberOfLines={3}`)
**Qué:** el texto se trunca a 3 líneas sin forma de leerlo entero; permitir tap para expandir o navegar a la vista del día. **Dónde:** `src/app/diario.tsx:206-210`. **Impacto:** 3 · **Esfuerzo:** S

### DIA-077 · Paginación / "ver más" en entradas anteriores
**Qué:** solo se cargan 14; añadir "cargar más" para revisar el histórico completo. **Dónde:** `src/app/diario.tsx:85`, `src/lib/journal.ts:9`. **Impacto:** 3 · **Esfuerzo:** M

### DIA-078 · Agrupar entradas anteriores por mes
**Qué:** con muchas entradas, encabezados de mes mejoran la lectura del histórico. **Dónde:** `src/app/diario.tsx:196-213`. **Impacto:** 2 · **Esfuerzo:** M

### DIA-079 · Filtrar entradas por ánimo/energía
**Qué:** permitir ver solo días "Hundido/Bajo" para analizar rachas malas, o "Imparable" para revivir buenas. **Dónde:** `src/app/diario.tsx:195-214`; consulta en `journal.ts`. **Impacto:** 3 · **Esfuerzo:** M

### DIA-080 · Calendario mensual de ánimo (mood calendar)
**Qué:** vista de calendario que colorea cada día según el ánimo registrado, complementando el heatmap de actividad. **Dónde:** nueva sección en `src/app/diario.tsx` o `informe.tsx`. **Impacto:** 4 · **Esfuerzo:** L

### DIA-081 · Gráfica de evolución de ánimo y energía en el Informe
**Qué:** líneas de mood/energy a lo largo del tiempo, base para las correlaciones (DIA-018). **Dónde:** nueva `SystemWindow` en `src/app/informe.tsx`. **Impacto:** 4 · **Esfuerzo:** M

### DIA-082 · Promedio semanal de ánimo/energía como KPI
**Qué:** añadir a "ÚLTIMOS 7 DÍAS" dos KPIs con la media de ánimo y energía de la semana. **Dónde:** `src/app/informe.tsx:113-131`; cargar entradas. **Impacto:** 3 · **Esfuerzo:** M

### DIA-083 · Insight automático sobre energía baja recurrente
**Qué:** si varios días seguidos la energía es ≤2, la narrativa lo señala con un consejo. **Dónde:** `src/app/informe.tsx:71-94` (bloque `narrative`). **Impacto:** 3 · **Esfuerzo:** M

### DIA-084 · Día de la semana más fuerte/débil (patrón semanal)
**Qué:** agregar XP por día de la semana sobre los 91 días para revelar "los lunes flojeas". **Dónde:** `src/app/informe.tsx:57-69`. **Impacto:** 4 · **Esfuerzo:** M

### DIA-085 · Distribución horaria de actividad
**Qué:** usar `completed_at`/`created_at` para mostrar a qué horas sueles completar misiones. **Dónde:** `src/app/informe.tsx` (nueva sección); requiere `completed_at` en `completions` (ya existe en el tipo). **Impacto:** 3 · **Esfuerzo:** L

### DIA-086 · Misiones más completadas / más falladas
**Qué:** ranking de quests por nº de completions en el periodo, cruzando `completions` con `quests`. **Dónde:** `src/app/informe.tsx:49-54`. **Impacto:** 4 · **Esfuerzo:** M

### DIA-087 · Total acumulado y récord histórico de XP en el Informe
**Qué:** mostrar XP total de los 91 días y la mejor semana histórica, no solo la actual vs la previa. **Dónde:** `src/app/informe.tsx:42-44`. **Impacto:** 3 · **Esfuerzo:** M

### DIA-088 · Comparativa de stats vs mes anterior
**Qué:** además de la semana, comparar el reparto por stat con el mes previo para ver evolución del equilibrio. **Dónde:** `src/app/informe.tsx:50-55`. **Impacto:** 3 · **Esfuerzo:** M

### DIA-089 · Gráfico radar de stats
**Qué:** representar FUE/VIT/INT/AGI/PER en un radar (SVG `Polygon`) para una lectura de "build" del personaje. **Dónde:** nueva `SystemWindow` en `src/app/informe.tsx`; reutilizar patrón SVG de `Heatmap`. **Impacto:** 4 · **Esfuerzo:** L

### DIA-090 · Exportar datos del diario (JSON/CSV)
**Qué:** botón para exportar todas las entradas, complementando el PDF del informe. **Dónde:** `src/app/diario.tsx` cabecera; `src/lib/exporter.ts`. **Impacto:** 3 · **Esfuerzo:** M

### DIA-091 · Compartir tarjeta del informe semanal
**Qué:** generar una imagen compartible con los KPIs de la semana (estilo "wrapped"). **Dónde:** nuevo en `src/app/informe.tsx`. **Impacto:** 3 · **Esfuerzo:** L

### DIA-092 · Animación de entrada de las barras por stat
**Qué:** animar el ancho de las barras de `xpByStat` al cargar para dar vida al informe. **Dónde:** `src/app/informe.tsx:139-146`. **Impacto:** 2 · **Esfuerzo:** M

### DIA-093 · Animación de aparición de las celdas del heatmap
**Qué:** fade/scale escalonado de las celdas al montar. **Dónde:** `src/components/Heatmap.tsx:50-52`. **Impacto:** 2 · **Esfuerzo:** M

### DIA-094 · Haptic al seleccionar ánimo/energía
**Qué:** un `Haptics.selectionAsync()` al tocar un chip refuerza la interacción (ya se usa Haptics al guardar). **Dónde:** `src/app/diario.tsx:148`, `158`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-095 · Feedback de éxito sin `Alert` modal bloqueante
**Qué:** al guardar, el `Alert` corta el flujo; usar un toast/inline "ENTRADA REGISTRADA +X XP" más acorde a la estética del sistema. **Dónde:** `src/app/diario.tsx:117-120`. **Impacto:** 3 · **Esfuerzo:** M

### DIA-096 · Animación de "level up" si el diario provoca subida de nivel
**Qué:** `awardXp` puede subir de nivel; el Diario no lo refleja con ninguna celebración. **Dónde:** `src/app/diario.tsx:113`. **Impacto:** 3 · **Esfuerzo:** M

### DIA-097 · Deshabilitar el botón si no hay nada que guardar
**Qué:** permitir guardar una entrada totalmente vacía (sin mood, energy ni texto) crea ruido; deshabilitar o avisar. **Dónde:** `src/app/diario.tsx:101-110`, `174-179`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-098 · Confirmar antes de sobrescribir una entrada existente con campos vacíos
**Qué:** al "Actualizar entrada" con mood/energy/texto borrados se pierden datos sin aviso. **Dónde:** `src/app/diario.tsx:105-110`. **Impacto:** 3 · **Esfuerzo:** S

### DIA-099 · Mostrar fecha/hora de creación de la entrada de hoy
**Qué:** cuando ya está guardada, indicar "registrada a las HH:MM" usando `created_at`. **Dónde:** `src/app/diario.tsx:78-84`. **Impacto:** 1 · **Esfuerzo:** S

### DIA-100 · El `Alert` de logro puede listar varios logros sin formato claro
**Qué:** `fresh.map(a=>a.name).join(', ')` (diario.tsx:119) apelmaza nombres; con varios logros conviene una línea por logro. **Dónde:** `src/app/diario.tsx:117-120`. **Impacto:** 1 · **Esfuerzo:** S

### DIA-101 · Estado vacío con llamada a la acción cuando no hay entradas
**Qué:** si `recent.length === 0` no se muestra nada; añadir un texto motivador para escribir la primera entrada. **Dónde:** `src/app/diario.tsx:195`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-102 · `ScrollView` del Informe sin scroll horizontal para el heatmap ancho
**Qué:** con 13 semanas el `Svg` mide `13*(11+3)=182px`, cabe; pero al ofrecer 26/52 semanas (DIA-103) hará falta scroll horizontal dedicado. **Dónde:** `src/components/Heatmap.tsx:49`, `src/app/informe.tsx:154-156`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-103 · Selector de rango del heatmap (13/26/52 semanas)
**Qué:** permitir ver el último año completo, no solo 13 semanas; `Heatmap` ya acepta prop `weeks`. **Dónde:** `src/app/informe.tsx:155` (pasar `weeks`), `src/components/Heatmap.tsx:22`. **Impacto:** 4 · **Esfuerzo:** M

### DIA-104 · Cargar datos del heatmap acorde al rango elegido
**Qué:** hoy `from = addDays(today,-91)` fija 91 días (informe.tsx:23); si se amplía a 52 semanas el heatmap mostrará huecos por falta de datos. Ajustar la ventana de carga al rango. **Dónde:** `src/app/informe.tsx:23`. **Impacto:** 3 · **Esfuerzo:** S

### DIA-105 · Heatmap responsive al ancho de pantalla
**Qué:** `CELL`/`GAP` son fijos; calcular el tamaño de celda a partir del ancho disponible para aprovechar pantallas grandes/pequeñas. **Dónde:** `src/components/Heatmap.tsx:11-12`, `31-32`. **Impacto:** 3 · **Esfuerzo:** M

### DIA-106 · Total de misiones del periodo bajo el heatmap
**Qué:** mostrar "X misiones en 13 semanas, Y días activos" como resumen del mapa. **Dónde:** `src/app/informe.tsx:153-156`; derivar de `byDay`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-107 · Racha más larga visible en el Informe/heatmap
**Qué:** calcular la racha de días activos consecutivos sobre `byDay` y mostrarla. **Dónde:** `src/app/informe.tsx:57-60`. **Impacto:** 3 · **Esfuerzo:** M

### DIA-108 · Comparar `delta` también en nº de misiones, no solo XP
**Qué:** el KPI "vs semana previa" solo mira XP; añadir variación de misiones completadas. **Dónde:** `src/app/informe.tsx:42-44`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-109 · Proteger `delta` cuando la semana actual es 0 pero la previa no
**Qué:** si `xpWeek=0` y `xpPrev>0`, delta = −100%; el texto "No es una derrota; es información" está bien, pero conviene un caso visual claro de "semana en blanco". **Dónde:** `src/app/informe.tsx:44`, `79-82`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-110 · Narrativa más rica con metas/objetivos
**Qué:** si existe una meta semanal de XP, la narrativa podría decir "te faltan N XP para tu objetivo". **Dónde:** `src/app/informe.tsx:71-94`. **Impacto:** 3 · **Esfuerzo:** M

### DIA-111 · Variar la narrativa para no repetir frases cada semana
**Qué:** las frases son fijas (informe.tsx:73-92); rotar variantes para que el informe no canse. **Dónde:** `src/app/informe.tsx:71-94`. **Impacto:** 2 · **Esfuerzo:** M

### DIA-112 · `STAT_LABEL[topStat]` en la barra de stats, no solo en la narrativa
**Qué:** las filas muestran solo la abreviatura (FUE…); añadir el nombre legible al menos en la fila líder. **Dónde:** `src/app/informe.tsx:136-150`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-113 · Tap en una barra de stat para ver sus misiones
**Qué:** hacer cada `statRow` pulsable y listar qué misiones aportaron ese XP. **Dónde:** `src/app/informe.tsx:137-149`. **Impacto:** 3 · **Esfuerzo:** M

### DIA-114 · Porcentaje junto al XP en cada barra de stat
**Qué:** mostrar el % del total semanal que representa cada stat, no solo el valor absoluto. **Dónde:** `src/app/informe.tsx:148`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-115 · Ordenar las barras de stat por XP descendente (opción)
**Qué:** hoy van en orden fijo `STATS`; ofrecer ordenarlas por valor para ver el ranking de un vistazo. **Dónde:** `src/app/informe.tsx:136`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-116 · Colorear cada barra de stat con su color temático
**Qué:** todas las barras usan cyan; asignar matices por stat para diferenciarlas visualmente. **Dónde:** `src/app/informe.tsx:143`. **Impacto:** 2 · **Esfuerzo:** M

### DIA-117 · Incluir XP de penalizaciones (negativo) en el desglose
**Qué:** `xpByStat` ignora `is_penalty` (informe.tsx:53); ofrecer una vista que muestre XP perdido por penalizaciones para honestidad del balance. **Dónde:** `src/app/informe.tsx:51-54`. **Impacto:** 3 · **Esfuerzo:** M

### DIA-118 · KPI de XP neto (ganado − penalizado) en la semana
**Qué:** sumar penalizaciones para mostrar el neto real, ya que `thisWeek` incluye completions de penalización en `xpWeek`. **Dónde:** `src/app/informe.tsx:42`. **Impacto:** 3 · **Esfuerzo:** S

### DIA-119 · Verificar el signo de XP de penalizaciones en KPIs
**Qué:** `xpWeek = sum(c.xp_awarded)` mezcla completions normales y de penalización; si las penalizaciones guardan XP positivo se infla el total. Confirmar el signo y separar. **Dónde:** `src/app/informe.tsx:42`, `46`. **Impacto:** 3 · **Esfuerzo:** S

### DIA-120 · `withEvidence` también cuenta completions de penalización
**Qué:** `thisWeek` no excluye penalizaciones al calcular `evidencePct` (informe.tsx:46-47), distorsionando el % de evidencia. Filtrar `!q.is_penalty`. **Dónde:** `src/app/informe.tsx:46-47`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-121 · `thisWeek.length` cuenta penalizaciones como "misiones"
**Qué:** el KPI "Misiones" y la narrativa ("has completado N misiones") incluyen filas de penalización. Excluirlas para un conteo veraz. **Dónde:** `src/app/informe.tsx:39`, `76`, `120`. **Impacto:** 3 · **Esfuerzo:** S

### DIA-122 · Manejar quests borradas no presentes en `questById`
**Qué:** si una completion referencia un quest ya eliminado, `questById.get` da undefined y su XP se omite del desglose por stat sin aviso. Contabilizarlo como "Otros". **Dónde:** `src/app/informe.tsx:52-53`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-123 · `fetchQuests` trae todas, también inactivas
**Qué:** el mapa `questById` incluye quests `active:false`; correcto para histórico, pero conviene documentarlo/filtrar según vista. **Dónde:** `src/app/informe.tsx:24`, `src/lib/data.ts:22`. **Impacto:** 1 · **Esfuerzo:** S

### DIA-124 · Cargar 91 días de completions puede crecer sin límite
**Qué:** `fetchCompletionsSince` no pagina; con uso intenso a 91 días el array es grande y todo se procesa en cada render (ver DIA-008). Considerar agregación en servidor (RPC) para KPIs. **Dónde:** `src/lib/data.ts:59-66`, `src/app/informe.tsx:23-24`. **Impacto:** 3 · **Esfuerzo:** L

### DIA-125 · Vista de impresión/PDF separada del layout móvil
**Qué:** para el PDF (DIA-016) conviene un layout A4 propio, no reusar el `ScrollView`. **Dónde:** nuevo template; datos desde `src/lib/report.ts` (DIA-062). **Impacto:** 3 · **Esfuerzo:** L

### DIA-126 · Selección de periodo a exportar en el PDF
**Qué:** permitir exportar semana, mes o trimestre. Depende de DIA-016/DIA-039. **Dónde:** `src/app/informe.tsx`. **Impacto:** 2 · **Esfuerzo:** M

### DIA-127 · Marca/encabezado del sistema en el PDF
**Qué:** que el PDF lleve el estilo "INFORME DEL SISTEMA", fecha de generación y logo, coherente con la identidad. **Dónde:** template PDF. **Impacto:** 2 · **Esfuerzo:** M

### DIA-128 · Snapshot test del SVG del heatmap
**Qué:** test de regresión que serialice el SVG generado para un `counts` fijo. **Dónde:** `src/components/Heatmap.tsx`. **Impacto:** 2 · **Esfuerzo:** M

### DIA-129 · Memo del componente `Heatmap`
**Qué:** envolver en `React.memo` y memoizar `cells` con `useMemo([counts, weeks])` para no recomputar el grid en cada render del Informe. **Dónde:** `src/components/Heatmap.tsx:22-45`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-130 · `promptForDate` con índice fuera de rango imposible documentado
**Qué:** `Math.abs(hash) % PROMPTS.length` con `Math.abs(MIN_INT)` puede ser negativo en teoría (overflow de 32 bits); el `?? PROMPTS[0]` lo cubre, pero conviene un comentario/normalización explícita. **Dónde:** `src/lib/journal.ts:82-83`. **Impacto:** 1 · **Esfuerzo:** S

### DIA-131 · Internacionalización de fechas en el heatmap/informe
**Qué:** los nombres de día (`DAY_NAMES`, informe.tsx:14) están hardcodeados; centralizar con `dates.ts`/locale para coherencia y futura i18n. **Dónde:** `src/app/informe.tsx:14`, `src/lib/dates.ts`. **Impacto:** 1 · **Esfuerzo:** S

### DIA-132 · Unificar el cálculo de día de la semana
**Qué:** informe.tsx:87 reimplementa `wd === 0 ? 6 : wd - 1` en lugar de usar `weekdayOfKey` de `dates.ts`; reutilizar el helper. **Dónde:** `src/app/informe.tsx:86-88`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-133 · Constantes de configuración del Diario (rangos de escala)
**Qué:** los rangos 1-5 están dispersos (`[1,2,3,4,5]`, `MOOD_LABELS.length`); extraer a constantes para evitar desajustes futuros. **Dónde:** `src/app/diario.tsx:35`, `157`. **Impacto:** 1 · **Esfuerzo:** S

### DIA-134 · Reusar `MOOD_LABELS.length` en vez de `[1,2,3,4,5]` para energía
**Qué:** la escala de energía usa un array literal mientras el ánimo mapea labels; unificar el patrón de render. **Dónde:** `src/app/diario.tsx:157`. **Impacto:** 1 · **Esfuerzo:** S

### DIA-135 · Comentario/constante para los días cargados (91)
**Qué:** `-91` es un número mágico ligado a "13 semanas + margen"; nombrarlo `REPORT_WINDOW_DAYS`. **Dónde:** `src/app/informe.tsx:23`. **Impacto:** 1 · **Esfuerzo:** S

### DIA-136 · Alinear la ventana de carga (91) con `weeks*7` del heatmap
**Qué:** el heatmap dibuja `13*7=91` celdas y la carga pide 91 días, pero empieza en `lastMonday-(12*7)`, que puede exceder 91 días naturales hacia atrás según el día de hoy; verificar que no falten datos en la primera columna. **Dónde:** `src/app/informe.tsx:23`, `src/components/Heatmap.tsx:28-29`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-137 · Mostrar el rango de fechas exacto del heatmap
**Qué:** indicar "del X al Y" bajo el título "MAPA DE ACTIVIDAD · 13 SEMANAS" para contexto temporal. **Dónde:** `src/app/informe.tsx:154`. **Impacto:** 1 · **Esfuerzo:** S

### DIA-138 · Tipado estricto de `byDay`/`xpByStat` con `Record` completo
**Qué:** `byDay: Record<string,number>` permite claves arbitrarias; está bien, pero documentar que las claves son `dateKey`. Menor. **Dónde:** `src/app/informe.tsx:57`. **Impacto:** 1 · **Esfuerzo:** S

### DIA-139 · Evitar recomputar `questById` Map en cada render
**Qué:** `new Map(quests.map(...))` (informe.tsx:49) se reconstruye siempre; memoizar con `useMemo([quests])`. **Dónde:** `src/app/informe.tsx:49`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-140 · Sincronizar el editor cuando cambia la entrada cargada
**Qué:** `load()` setea estado solo si `entry` existe; si el usuario navega de un día con entrada a otro sin entrada (DIA-002), los campos no se limpian. Resetear estado en cada carga de día. **Dónde:** `src/app/diario.tsx:78-84`. **Impacto:** 3 · **Esfuerzo:** S

### DIA-141 · Evitar el "salto" del prompt al cambiar de día sin recargar
**Qué:** `promptForDate(today)` se recalcula en cada render; al teclear cambia nada, pero al navegar fechas conviene fijar el prompt del día activo. **Dónde:** `src/app/diario.tsx:143`. **Impacto:** 1 · **Esfuerzo:** S

### DIA-142 · Indicador visual de días con/ sin entrada en la navegación de fechas
**Qué:** al implementar el selector de fecha (DIA-002), marcar qué días ya tienen entrada (punto bajo el número). **Dónde:** `src/app/diario.tsx` (nuevo selector). **Impacto:** 3 · **Esfuerzo:** M

### DIA-143 · Botón flotante "escribir hoy" desde la lista de entradas
**Qué:** cuando se navega a días pasados, un acceso rápido para volver a la entrada de hoy. **Dónde:** `src/app/diario.tsx`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-144 · Resúmenes IA del diario (integración Oráculo)
**Qué:** botón que pida al Oráculo (oracle.ts) un resumen/reflexión de las últimas entradas. **Dónde:** `src/app/diario.tsx`; `src/lib/oracle.ts`. **Impacto:** 4 · **Esfuerzo:** L

### DIA-145 · Detección de palabras clave/emociones en el texto
**Qué:** análisis ligero del texto para sugerir el ánimo o etiquetar temas recurrentes. **Dónde:** `src/app/diario.tsx:165-172`; lógica nueva. **Impacto:** 3 · **Esfuerzo:** L

### DIA-146 · Recordatorio/notificación para escribir el diario
**Qué:** enganchar con `notifications.ts` para recordar el registro nocturno si no se ha hecho. **Dónde:** `src/lib/notifications.ts`; trigger desde Diario. **Impacto:** 3 · **Esfuerzo:** M

### DIA-147 · Entrada de voz para el diario (dictado)
**Qué:** existe `voice.ts`; permitir dictar el texto del registro. **Dónde:** `src/app/diario.tsx:165-172`; `src/lib/voice.ts`. **Impacto:** 3 · **Esfuerzo:** M

### DIA-148 · Bloqueo/privacidad del diario (PIN/biometría)
**Qué:** dado el carácter íntimo del diario, ofrecer protección biométrica para abrir la pantalla. **Dónde:** `src/app/diario.tsx`. **Impacto:** 3 · **Esfuerzo:** L

### DIA-149 · Adjuntar foto a la entrada del diario
**Qué:** permitir una imagen del día (similar a evidencias de misiones), enriqueciendo el recuerdo. **Dónde:** `src/app/diario.tsx`; almacenamiento Supabase. **Impacto:** 3 · **Esfuerzo:** L

### DIA-150 · Etiquetas/tags en las entradas del diario
**Qué:** permitir etiquetar entradas (p.ej. #gym #familia) para filtrar y correlacionar después. **Dónde:** `src/app/diario.tsx`; esquema journal. **Impacto:** 3 · **Esfuerzo:** L

### DIA-151 · Vista de "estadísticas del diario" (días escritos, palabras totales)
**Qué:** panel con métricas de la propia práctica de escribir: total de entradas, racha, palabras acumuladas. **Dónde:** nueva sección en `src/app/informe.tsx`; datos de `journal.ts`. **Impacto:** 3 · **Esfuerzo:** M

### DIA-152 · Empty state ilustrado en el Informe sin actividad
**Qué:** cuando `thisWeek.length===0`, además de la narrativa, mostrar una ilustración/estado de sistema más cuidado. **Dónde:** `src/app/informe.tsx:72-73`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-153 · Accesibilidad: contraste de `textFaint` sobre `bg`
**Qué:** `textFaint #56698A` sobre `bg #060B16` y, sobre todo, los `placeholderTextColor`/`empty` pueden quedar bajo el ratio AA; revisar contraste de textos secundarios. **Dónde:** `src/app/diario.tsx:170,272`, `src/lib/theme.ts:20`. **Impacto:** 3 · **Esfuerzo:** S

### DIA-154 · Respeto a `Reduce Motion` en animaciones del informe/heatmap
**Qué:** al añadir animaciones (DIA-092/093), respetar la preferencia de movimiento reducido del sistema. **Dónde:** nuevas animaciones en `informe.tsx`/`Heatmap.tsx`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-155 · Escalado de fuentes (Dynamic Type) en KPIs y narrativa
**Qué:** los tamaños están fijos en px; verificar que con fuentes grandes del sistema no se recorten los KPIs (`kpiValue` 22px en celdas al 47%). **Dónde:** `src/app/informe.tsx:181-183`. **Impacto:** 2 · **Esfuerzo:** M

### DIA-156 · `numberOfLines`/`adjustsFontSizeToFit` en valores de KPI largos
**Qué:** un `xpWeek` de 5 cifras puede desbordar la celda KPI; limitar/ajustar. **Dónde:** `src/app/informe.tsx:116`, `182`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-157 · Manejo del teclado: botón "Hecho" para cerrar en iOS
**Qué:** el `TextInput` multiline no ofrece forma evidente de cerrar el teclado en iOS; añadir accesorio o tap-fuera. **Dónde:** `src/app/diario.tsx:165-172`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-158 · Persistir y mostrar la última vez que se vio el Informe
**Qué:** marcar "novedades desde tu última visita" para dar sensación de actualización. **Dónde:** `src/app/informe.tsx`. **Impacto:** 2 · **Esfuerzo:** M

### DIA-159 · Acceso directo Informe ↔ Diario
**Qué:** enlaces cruzados (desde el Informe, abrir el Diario del mejor día; desde el Diario, ver el Informe). **Dónde:** `src/app/informe.tsx:85-89`, `src/app/diario.tsx`. **Impacto:** 2 · **Esfuerzo:** S

### DIA-160 · Manejar zona horaria en el rango del día de la crónica
**Qué:** `start`/`end` se calculan con hora local y se comparan contra `created_at` (UTC en Supabase); en husos no-UTC la crónica puede incluir/excluir eventos del borde de medianoche. Normalizar a la zona del usuario de forma explícita. **Dónde:** `src/app/diario.tsx:86-90`. **Impacto:** 3 · **Esfuerzo:** M

Total: 160 mejoras, 8 bugs.
