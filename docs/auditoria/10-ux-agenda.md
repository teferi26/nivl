# UX/UI Agenda

> Área AGE · auditoría de código NIVL · anclada al código real

Alcance leído: `src/app/(tabs)/agenda.tsx` (pantalla completa), con sus dependencias reales
`src/lib/closing.ts` (`questsScheduledOn`), `src/lib/dungeons.ts` (`fetchCalendarEvents`,
`createCalendarEvent`, `deleteCalendarEvent`, `fetchPendingTasksWithDue`), `src/lib/dates.ts`
(`addDays`, `dateKey`, `isValidKey`), `src/lib/types.ts` (`CalendarEvent`, `DungeonTask`, `Quest`),
`src/lib/data.ts` (`fetchQuests`), `src/components/SystemWindow.tsx`, `src/components/SystemButton.tsx`,
`src/lib/theme.ts` y la migración `supabase/migrations/0002_fases.sql` (tabla `calendar_events`) más
`0003_seguridad.sql` (no añade CHECK a `calendar_events`).

Nota: NO se repiten los bugs ya corregidos en la primera pasada (game/dates/closing/engine/journal/
index/diario/informe/dungeon/data/oracle/migración 0003). Lo de abajo es nuevo y específico de Agenda.

---

## Bugs y riesgos

### CRIT-AGE-01 · `addEvent` sin cerrojo: doble toque inserta eventos duplicados — `src/app/(tabs)/agenda.tsx:76-91` · severidad alta
**Problema:** `addEvent` es `async` y dispara `createCalendarEvent` (red), pero el botón "Añadir al
calendario" (`agenda.tsx:208`) solo se deshabilita con `disabled={!title.trim()}`; durante el `await`
sigue habilitado y el título aún no se ha limpiado (el `setTitle('')` ocurre DESPUÉS del await, línea 87).
Un segundo toque mientras la primera inserción está en vuelo crea un segundo `INSERT` → dos filas
idénticas en `calendar_events`. La nota de proyecto indica que `index.tsx` y `diario.tsx` recibieron
cerrojo síncrono anti doble-toque; Agenda quedó fuera de ese arreglo.
**Arreglo:** añadir `const saving = useRef(false)` y al entrar a `addEvent`: `if (saving.current) return; saving.current = true;` con `try/finally { saving.current = false }`. Alternativamente, estado `submitting` que pase a `loading` del `SystemButton` (que ya soporta `loading` y se deshabilita solo, `SystemButton.tsx:13,20`).

### CRIT-AGE-02 · `addEvent` sin `try/catch`: fallo de red/validación = rechazo no capturado — `src/app/(tabs)/agenda.tsx:82-90` · severidad alta
**Problema:** a diferencia de `load`, que envuelve todo en `try/catch` con `Alert` (`agenda.tsx:65-67`),
`addEvent` llama a `createCalendarEvent` y `load` sin capturar errores. Si la inserción falla (sin red,
RLS, o fecha imposible que Postgres rechaza, ver CRIT-AGE-03), la promesa se rechaza sin manejar
(LogBox roja en dev, fallo silencioso en prod) y el formulario queda abierto sin feedback ni limpieza.
**Arreglo:** envolver el cuerpo de `addEvent` en `try { ... } catch (e) { Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido'); }` reutilizando el mismo patrón de `load`.

### CRIT-AGE-03 · Validación de fecha solo por regex: acepta fechas imposibles — `src/app/(tabs)/agenda.tsx:78` · severidad alta
**Problema:** la guarda es `if (!/^\d{4}-\d{2}-\d{2}$/.test(date))`. Pasan `2026-13-45`, `2026-02-31`,
`0000-00-00`: el regex solo cuenta dígitos. Esa cadena se envía a `createCalendarEvent` y la columna
`date date` (migración `0002_fases.sql:42`) rechaza `2026-13-45` con error 22008 — que, por CRIT-AGE-02,
se convierte en rechazo no capturado. Para fechas "válidas para Postgres pero raras" (p. ej. años de 4
dígitos lejanos) el evento se inserta y luego nunca aparece porque queda fuera de la ventana de 14 días.
Existe `isValidKey` en `dates.ts:5-9` (valida mes 1-12 y día 1-31) pero NO se usa aquí.
**Arreglo:** sustituir el regex por `if (!isValidKey(date)) { Alert.alert('Fecha inválida', ...); return; }` importando `isValidKey` desde `@/lib/dates`. Idealmente, eliminar el campo de texto a favor de un date picker (ver AGE-001) y el problema desaparece de raíz.

### CRIT-AGE-04 · `time` es texto libre sin validar: persiste "25:99"/"mañana" y se renderiza tal cual — `src/app/(tabs)/agenda.tsx:85,148` · severidad media
**Problema:** `time: time.trim() || null` se inserta sin ninguna comprobación; la columna es `time text`
(no `time without time zone`) en `0002_fases.sql:43` y `0003_seguridad.sql` no le añade CHECK. Cualquier
cadena ("25:99", "tarde", "5pm-ish") se guarda y se muestra literal en `{e.time ? \`${e.time} · \` : ''}`
(`agenda.tsx:148`). No rompe, pero corrompe el orden visual y la futura ordenación/recordatorios por hora.
**Arreglo:** validar con regex `^([01]\d|2[0-3]):[0-5]\d$` antes de insertar y mostrar error; o usar un time picker. A medio plazo, migrar la columna a `time` real con CHECK en una futura migración.

### CRIT-AGE-05 · Mensaje "Día libre de obligaciones" inalcanzable salvo para HOY (lógica muerta) — `src/app/(tabs)/agenda.tsx:111,173` · severidad media
**Problema:** la línea 111 hace `if (!hasContent && day !== today) return null;` → cualquier día futuro
sin contenido NO renderiza su `SystemWindow`. Dentro del panel, la línea 173 muestra
`{!hasContent ? <Text>Día libre de obligaciones.</Text> : null}`. La única combinación que llega ahí con
`!hasContent` es `day === today`. Resultado: el texto "Día libre de obligaciones" solo puede verse el día
de hoy; para el resto de días libres el panel directamente no existe. Es casi seguro un descuido: o se
quería mostrar días libres futuros, o el texto sobra. Hoy es código contradictorio.
**Arreglo:** decidir el comportamiento. Si se quieren ver días vacíos futuros (recomendado para una vista
de agenda real), quitar el `&& day !== today` de la 111 y dejar el empty-state. Si no, eliminar la línea
173 por inalcanzable. Documentar la decisión.

### CRIT-AGE-06 · `today` se congela al montar: la pantalla no rota de día sin remount — `src/app/(tabs)/agenda.tsx:53,93` · severidad media
**Problema:** `const today = dateKey();` se evalúa en cada render, pero `load` depende de `[today]`
(`agenda.tsx:68`) y `useFocusEffect` de `[load]` (70-74); como el componente de tab permanece montado,
si el usuario deja la app abierta cruzando medianoche y vuelve a la pestaña SIN que el componente se
remonte ni cambie `today` (no hay ningún disparador que lo recalcule fuera de un render provocado por
foco), `days` y la etiqueta "HOY" pueden quedar en la fecha de ayer. `useFocusEffect` ayuda al volver a
enfocar, pero si Agenda ya está enfocada y la medianoche pasa en primer plano, nada lo refresca.
**Arreglo:** recomputar `today` en el callback de foco y además suscribirse a `AppState` 'active' para
volver a cargar; o un timer que detecte cambio de día. Como mínimo, mover `const today = dateKey()` dentro
de `load`/efecto y guardarlo en estado para forzar re-render al cambiar.

### CRIT-AGE-07 · Eliminar evento por `onLongPress` sin descubrimiento ni cerrojo — `src/app/(tabs)/agenda.tsx:131-143` · severidad baja
**Problema:** la única forma de borrar un evento es una pulsación larga invisible (no hay affordance,
ni icono, ni hint). Es un gesto oculto: el usuario no puede saber que existe. Además el `onPress` del
`Alert` "Eliminar" (`agenda.tsx:137-140`) llama a `deleteCalendarEvent` + `load` sin `try/catch` ni guard;
un fallo de red deja un rechazo no capturado y el evento "fantasma" sigue en pantalla hasta el próximo
`load`.
**Arreglo:** añadir un affordance visible (icono de papelera al pulsar, o swipe-to-delete) y envolver el
`onPress` del borrado en `try/catch` con `Alert` de error.

---

## Mejoras

### AGE-001 · Date picker nativo en lugar de campo de texto AAAA-MM-DD
**Qué:** sustituir el `TextInput` de fecha por `@react-native-community/datetimepicker` (o un picker propio estilo sistema). Elimina CRIT-AGE-03 de raíz y es la queja principal del brief. **Dónde:** `agenda.tsx:191-199` · **Impacto:** 5 · **Esfuerzo:** M

### AGE-002 · Time picker para la hora
**Qué:** reemplazar el campo de hora libre por un selector de hora (modo 24h `es-ES`). Elimina CRIT-AGE-04. **Dónde:** `agenda.tsx:200-207` · **Impacto:** 4 · **Esfuerzo:** M

### AGE-003 · Botones rápidos "Hoy / Mañana / +7d" en el formulario
**Qué:** chips encima del campo de fecha que rellenan `date` con `addDays(today, n)`. Atajo sin teclear. **Dónde:** `agenda.tsx:191` (antes del input) · **Impacto:** 4 · **Esfuerzo:** S

### AGE-004 · `keyboardType="number-pad"` y `maxLength={10}` en el campo de fecha
**Qué:** mientras siga siendo texto, forzar teclado numérico y longitud máx 10 reduce errores de tecleo. **Dónde:** `agenda.tsx:192-199` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-005 · Auto-insertar guiones al teclear la fecha (máscara 0000-00-00)
**Qué:** en `onChangeText`, formatear progresivamente `AAAAMMDD` → `AAAA-MM-DD`. **Dónde:** `agenda.tsx:194` (`onChangeText={setDate}`) · **Impacto:** 3 · **Esfuerzo:** M

### AGE-006 · Validar fecha con `isValidKey` en vez de regex
**Qué:** importar y usar `isValidKey` (ya existe en `dates.ts:5`) en la guarda de `addEvent`. **Dónde:** `agenda.tsx:78` · **Impacto:** 4 · **Esfuerzo:** S

### AGE-007 · Validar formato de hora `HH:MM` antes de insertar
**Qué:** regex `^([01]\d|2[0-3]):[0-5]\d$`; si falla, `Alert` y no insertar. **Dónde:** `agenda.tsx:84` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-008 · `try/catch` en `addEvent`
**Qué:** capturar errores de `createCalendarEvent`/`load` igual que hace `load`. **Dónde:** `agenda.tsx:82-90` · **Impacto:** 4 · **Esfuerzo:** S

### AGE-009 · Cerrojo `useRef` anti doble-inserción
**Qué:** guard síncrono en `addEvent` para evitar eventos duplicados por doble toque. **Dónde:** `agenda.tsx:76` · **Impacto:** 4 · **Esfuerzo:** S

### AGE-010 · Estado `loading` en el botón "Añadir al calendario"
**Qué:** pasar `loading` al `SystemButton` (ya lo soporta, `SystemButton.tsx:29`) durante el await para feedback y bloqueo. **Dónde:** `agenda.tsx:208` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-011 · `try/catch` en el borrado de evento
**Qué:** envolver `deleteCalendarEvent`+`load` del `Alert`. **Dónde:** `agenda.tsx:137-140` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-012 · Affordance visible para borrar evento
**Qué:** swipe-to-delete o icono papelera; el `onLongPress` actual es invisible. **Dónde:** `agenda.tsx:129-152` · **Impacto:** 4 · **Esfuerzo:** M

### AGE-013 · Confirmación de borrado con cuenta/contexto
**Qué:** el `Alert` muestra solo el título; añadir fecha/hora para evitar borrar el evento equivocado. **Dónde:** `agenda.tsx:132` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-014 · Editar evento (no solo crear/borrar)
**Qué:** abrir el sheet precargado al pulsar un evento para cambiar título/fecha/hora. **Dónde:** `agenda.tsx:128-152` · **Impacto:** 4 · **Esfuerzo:** M

### AGE-015 · `createCalendarEvent` admite `notes` pero el formulario no lo expone
**Qué:** añadir campo "Notas" (la función y la columna ya existen, `dungeons.ts:113`, `types.ts:83`). **Dónde:** `agenda.tsx:182-207` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-016 · Mostrar `notes` del evento en la fila/detalle
**Qué:** segunda línea o expandible con `e.notes` cuando exista. **Dónde:** `agenda.tsx:147-150` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-017 · Vista mensual (calendario en rejilla)
**Qué:** alternativa a la lista de 14 días: cuadrícula de mes con puntos por día con contenido. Petición directa del brief. **Dónde:** nueva sección en `agenda.tsx` · **Impacto:** 5 · **Esfuerzo:** L

### AGE-018 · Selector de rango / navegación temporal (semanas/meses adelante y atrás)
**Qué:** botones "‹ semana anterior / siguiente ›"; hoy la ventana es fija HOY..+14 sin poder ver el pasado ni más allá. **Dónde:** `agenda.tsx:30,93` (`DAYS_AHEAD`, `days`) · **Impacto:** 5 · **Esfuerzo:** L

### AGE-019 · Ver eventos pasados (histórico)
**Qué:** `fetchCalendarEvents` arranca en `today` (`agenda.tsx:59`); los eventos de ayer desaparecen. Permitir mirar atrás. **Dónde:** `agenda.tsx:59` · **Impacto:** 3 · **Esfuerzo:** M

### AGE-020 · `DAYS_AHEAD` configurable por el usuario (7/14/30)
**Qué:** ajuste en perfil para la longitud de la ventana. **Dónde:** `agenda.tsx:30` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-021 · Sincronización con Google Calendar (importar/exportar)
**Qué:** integración bidireccional con `expo-calendar` o la API de Google. Petición explícita del brief. **Dónde:** nuevo módulo `lib/`, consumido en `agenda.tsx` · **Impacto:** 5 · **Esfuerzo:** L

### AGE-022 · Exportar evento a .ics / "Añadir a calendario del sistema"
**Qué:** acción por evento que genere un `.ics` o use `expo-calendar` para volcarlo al calendario nativo. **Dónde:** `agenda.tsx:128-152` · **Impacto:** 3 · **Esfuerzo:** M

### AGE-023 · Arrastrar para reprogramar (drag-to-reschedule)
**Qué:** arrastrar un evento de un día a otro actualizando `date`. Petición del brief. **Dónde:** `agenda.tsx:128-152` · **Impacto:** 4 · **Esfuerzo:** L

### AGE-024 · Detección de sobrecarga del día
**Qué:** marcar visualmente días con demasiadas obligaciones (p. ej. ≥N entre quests+events+tasks) y avisar. Petición del brief. **Dónde:** `agenda.tsx:110` (`hasContent`/conteos) · **Impacto:** 4 · **Esfuerzo:** M

### AGE-025 · Recordatorios/notificaciones por evento con hora
**Qué:** programar notificación local (hay `lib/notifications.ts` en el proyecto) X minutos antes de `e.time`. **Dónde:** `agenda.tsx:85` (al crear con hora) · **Impacto:** 4 · **Esfuerzo:** M

### AGE-026 · Pull-to-refresh en el `ScrollView`
**Qué:** `RefreshControl` que llame a `load`; hoy solo recarga al re-enfocar. **Dónde:** `agenda.tsx:97` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-027 · Migrar la lista a `FlatList`/`SectionList`
**Qué:** `ScrollView` + `.map` renderiza todos los días siempre; `SectionList` virtualiza y escala si crece la ventana. **Dónde:** `agenda.tsx:97-177` · **Impacto:** 3 · **Esfuerzo:** M

### AGE-028 · Indexar quests/events/tasks por día una sola vez (precómputo)
**Qué:** construir `Map<string, {...}>` con un solo recorrido en lugar de filtrar las 3 colecciones por cada uno de los 14 días en cada render. **Dónde:** `agenda.tsx:105-109` · **Impacto:** 3 · **Esfuerzo:** M

### AGE-029 · `useMemo` para los cómputos por día
**Qué:** memoizar el resultado de `days.map(...)` sobre `[quests, events, dueTasks, today]` para no recalcular al teclear en el modal. **Dónde:** `agenda.tsx:105` · **Impacto:** 4 · **Esfuerzo:** S

### AGE-030 · Sacar el estado del formulario a un componente/sheet aparte
**Qué:** `title/date/time` viven en `Agenda`, así que cada pulsación de tecla re-renderiza toda la lista de 14 días. Aislar el modal evita ese coste. **Dónde:** `agenda.tsx:48-51,179-212` · **Impacto:** 4 · **Esfuerzo:** M

### AGE-031 · `keyExtractor` estable / claves ya correctas pero documentar unicidad
**Qué:** las filas usan `t.id`/`e.id`/`q.id`; si un quest aparece varios días no colisiona porque cada `SystemWindow` tiene su `key={day}`, pero conviene un comentario o prefijo `day|id` por robustez ante futuros refactors a lista plana. **Dónde:** `agenda.tsx:120,130,155,165` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-032 · `questsScheduledOn` se llama y luego se filtra otra vez por penalty
**Qué:** `questsScheduledOn(...).filter((q) => !q.is_penalty || day === today)` hace dos pasadas; unificar el criterio en una sola. **Dónde:** `agenda.tsx:106` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-033 · Reutilizar `dateKey`/`addDays` en vez de partir la cadena a mano en `dayLabel`
**Qué:** `dayLabel` hace `key.split('-').map(Number)` y construye `new Date` manualmente; hay helpers en `dates.ts`. Centralizar parseo evita divergencias. **Dónde:** `agenda.tsx:35-36` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-034 · `dayLabel` no valida la clave
**Qué:** si `key` llegara corrupto, `new Date(y, m-1, d)` daría Invalid Date y `toLocaleDateString` "Invalid Date". Usar `isValidKey` o el parseo de `dates.ts`. **Dónde:** `agenda.tsx:35-37` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-035 · Recalcular `today` dentro de `load` y guardarlo en estado
**Qué:** soluciona CRIT-AGE-06 (cruce de medianoche en primer plano). **Dónde:** `agenda.tsx:53` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-036 · Recargar al volver de background (`AppState`)
**Qué:** suscribirse a `AppState` 'active' para refrescar datos y fecha. **Dónde:** `agenda.tsx:70-74` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-037 · Estado de carga inicial (skeleton)
**Qué:** mientras `load` corre por primera vez, mostrar placeholders en lugar de un lienzo vacío. **Dónde:** `agenda.tsx:55-68,95` · **Impacto:** 3 · **Esfuerzo:** M

### AGE-038 · Estado vacío global "sin nada en 14 días"
**Qué:** si tras cargar no hay ningún día con contenido (solo se ve HOY vacío), mostrar un mensaje guía e invitar a crear evento. **Dónde:** `agenda.tsx:105-176` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-039 · Resolver la contradicción del empty-state (CRIT-AGE-05)
**Qué:** decidir si los días libres futuros se muestran o no, y alinear líneas 111 y 173. **Dónde:** `agenda.tsx:111,173` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-040 · Contador/resumen de carga por día en la cabecera del panel
**Qué:** junto a "HOY" mostrar p. ej. "3 obligaciones · 1 evento". **Dónde:** `agenda.tsx:115-117` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-041 · Separar visualmente secciones dentro del día (vencidas / eventos / mazmorras / hábitos)
**Qué:** pequeñas etiquetas de grupo; hoy se apilan filas heterogéneas sin jerarquía. **Dónde:** `agenda.tsx:119-171` · **Impacto:** 3 · **Esfuerzo:** M

### AGE-042 · Iconografía consistente con leyenda
**Qué:** documentar/mostrar qué significa cada icono (alerta=vencida, calendar=evento, map=mazmorra, ellipse=hábito). **Dónde:** `agenda.tsx:121,146,156,166` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-043 · Permitir ver el texto completo de filas largas
**Qué:** todas las filas usan `numberOfLines={1}`; títulos largos se truncan sin forma de leerlos. Tap para expandir o tooltip. **Dónde:** `agenda.tsx:122,147,157,167` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-044 · Mostrar la dificultad/stat del hábito y de la tarea de mazmorra
**Qué:** las filas de quest/tarea no indican dificultad ni stat; añadir badge. **Dónde:** `agenda.tsx:154-171` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-045 · Distinguir tareas de mazmorra con su mazmorra de origen
**Qué:** `DungeonTask` no trae el título de la mazmorra; enriquecer la consulta o mostrar rango para contexto. **Dónde:** `agenda.tsx:154-162` · **Impacto:** 3 · **Esfuerzo:** M

### AGE-046 · Hacer las tareas de mazmorra accionables desde la agenda
**Qué:** tap en una `dungeon_task` debería navegar a `dungeon/[id]` o permitir marcarla hecha. **Dónde:** `agenda.tsx:154-162` · **Impacto:** 4 · **Esfuerzo:** M

### AGE-047 · Tap en hábito → navegar a Misiones / marcar hoy
**Qué:** las filas de quest son inertes; permitir completar el hábito de hoy desde aquí. **Dónde:** `agenda.tsx:164-171` · **Impacto:** 4 · **Esfuerzo:** M

### AGE-048 · Agrupar todas las vencidas, no solo bajo HOY
**Qué:** `overdue` solo se calcula para `today` (`agenda.tsx:109`); una sección "VENCIDAS" propia arriba sería más clara. **Dónde:** `agenda.tsx:109,119-126` · **Impacto:** 3 · **Esfuerzo:** M

### AGE-049 · Mostrar hace cuántos días venció una tarea
**Qué:** "VENCIDA hace 3 días" usando `t.due_date` vs `today`. **Dónde:** `agenda.tsx:122-124` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-050 · Orden de las vencidas por antigüedad
**Qué:** `fetchPendingTasksWithDue` ordena ascendente por `due_date` (`dungeons.ts:59`); confirmar que las más antiguas salen primero en la lista de vencidas. **Dónde:** `agenda.tsx:109` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-051 · Resaltar eventos próximos en el tiempo (hoy con hora ya pasada)
**Qué:** atenuar o tachar eventos cuya hora ya pasó hoy. **Dónde:** `agenda.tsx:128-150` · **Impacto:** 2 · **Esfuerzo:** M

### AGE-052 · Ordenar eventos del día por hora
**Qué:** `dayEvents` conserva el orden de `date` de la consulta; dentro de un día, ordenar por `time` (nulls al final). **Dónde:** `agenda.tsx:107` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-053 · Intercalar eventos con hora junto a hábitos por orden cronológico
**Qué:** una vista "línea de tiempo" del día combinando horas. **Dónde:** `agenda.tsx:119-171` · **Impacto:** 3 · **Esfuerzo:** L

### AGE-054 · Búsqueda/filtro de eventos por texto
**Qué:** barra para filtrar la agenda por título. **Dónde:** `agenda.tsx:97` · **Impacto:** 2 · **Esfuerzo:** M

### AGE-055 · Filtro por tipo (solo eventos / solo hábitos / solo mazmorras)
**Qué:** chips de filtro en la cabecera. **Dónde:** `agenda.tsx:98-103` · **Impacto:** 2 · **Esfuerzo:** M

### AGE-056 · Eventos recurrentes
**Qué:** soportar "cada lunes" / "mensual" en `calendar_events` (hoy solo fecha única). **Dónde:** modelo `CalendarEvent` + `agenda.tsx:82-86` · **Impacto:** 4 · **Esfuerzo:** L

### AGE-057 · Eventos de varios días / con fecha de fin
**Qué:** rango `date`..`end_date`. **Dónde:** `types.ts:77`, `agenda.tsx` · **Impacto:** 3 · **Esfuerzo:** L

### AGE-058 · Categorías/etiquetas de color para eventos
**Qué:** color por categoría (médico, examen, ocio) para escaneo rápido. **Dónde:** `agenda.tsx:146` · **Impacto:** 3 · **Esfuerzo:** M

### AGE-059 · Validar y recortar longitud del título
**Qué:** `title.trim()` sin `maxLength`; un título enorme rompe `numberOfLines={1}` y la BD. Añadir `maxLength`. **Dónde:** `agenda.tsx:184-190` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-060 · `returnKeyType` y `onSubmitEditing` para enviar con teclado
**Qué:** permitir crear el evento pulsando "intro" desde el último campo. **Dónde:** `agenda.tsx:184-207` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-061 · Enfocar automáticamente el campo Título al abrir el sheet
**Qué:** `autoFocus` o `ref.focus()` en `onShow` del Modal. **Dónde:** `agenda.tsx:179-190` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-062 · `KeyboardAvoidingView` en el sheet
**Qué:** en pantallas pequeñas el teclado tapa los campos inferiores y el botón. **Dónde:** `agenda.tsx:180-211` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-063 · Cerrar el sheet tocando el backdrop
**Qué:** el backdrop (`agenda.tsx:180`) no responde a toque; añadir `Pressable` que cierre. **Dónde:** `agenda.tsx:180` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-064 · Limpiar también `date` al cerrar/abrir el formulario
**Qué:** `addEvent` limpia `title` y `time` pero deja `date` en el último valor; al reabrir conviene resetear a hoy. **Dónde:** `agenda.tsx:87-89` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-065 · Resetear el formulario al cancelar
**Qué:** "Cancelar" (`agenda.tsx:209`) solo cierra; si se reabrió con datos a medias quedan ahí. **Dónde:** `agenda.tsx:209` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-066 · Prefijar la fecha del formulario al día sobre el que se pulsa "+"
**Qué:** un "+" por panel de día que abra el sheet con `date` puesto a ese día. **Dónde:** `agenda.tsx:100,113-117` · **Impacto:** 4 · **Esfuerzo:** M

### AGE-067 · Feedback de éxito al crear ("Evento añadido")
**Qué:** toast/haptic tras insertar. **Dónde:** `agenda.tsx:87-90` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-068 · Haptics al crear/borrar
**Qué:** `expo-haptics` en acciones destructivas y de confirmación. **Dónde:** `agenda.tsx:82,138` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-069 · Inserción optimista del evento
**Qué:** añadir el evento a `events` localmente antes del round-trip y revertir si falla, como hace Sistema con sus ids optimistas. **Dónde:** `agenda.tsx:82-90` · **Impacto:** 3 · **Esfuerzo:** M

### AGE-070 · Borrado optimista del evento
**Qué:** quitarlo de `events` al confirmar y revertir si la red falla. **Dónde:** `agenda.tsx:138-139` · **Impacto:** 3 · **Esfuerzo:** M

### AGE-071 · `accessibilityRole`/`accessibilityLabel` en el botón "+"
**Qué:** el `Pressable` de añadir (`agenda.tsx:100-102`) solo tiene un icono; sin label es invisible para lectores de pantalla. **Dónde:** `agenda.tsx:100` · **Impacto:** 4 · **Esfuerzo:** S

### AGE-072 · `accessibilityHint` en eventos (gesto de borrado oculto)
**Qué:** anunciar "mantén pulsado para eliminar" en cada evento. **Dónde:** `agenda.tsx:129-152` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-073 · Etiquetas accesibles para las filas de obligaciones
**Qué:** componer `accessibilityLabel` que incluya tipo ("Vencida", "Evento", "Hábito") + título + hora. **Dónde:** `agenda.tsx:119-171` · **Impacto:** 3 · **Esfuerzo:** M

### AGE-074 · No depender solo del color para el estado "vencida"
**Qué:** la fila vencida se distingue por color rojo (`agenda.tsx:122`); añadir prefijo/icono (ya hay icono, reforzar texto) para daltónicos. **Dónde:** `agenda.tsx:120-124` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-075 · Área táctil mínima de 44px en filas pulsables
**Qué:** `paddingVertical: 5` en `row` (`agenda.tsx:242`) hace objetivos muy bajos; subir el hit area de eventos. **Dónde:** `agenda.tsx:242` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-076 · Contraste de `textFaint` en cabeceras de día no-hoy
**Qué:** `colors.textFaint` (#56698A) sobre `panel` para `dayHeader` (`agenda.tsx:238`) puede quedar por debajo de AA. Verificar/ajustar. **Dónde:** `agenda.tsx:234-240` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-077 · Soporte de `Dynamic Type` / fuentes grandes
**Qué:** tamaños fijos (12-16) no escalan; respetar `allowFontScaling` y probar con texto grande del sistema. **Dónde:** `agenda.tsx:226,234,243` · **Impacto:** 3 · **Esfuerzo:** M

### AGE-078 · `accessibilityViewIsModal` y foco al abrir el Modal
**Qué:** atrapar el foco del lector dentro del sheet al abrirlo. **Dónde:** `agenda.tsx:179-212` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-079 · Anunciar el placeholder de fecha de forma útil
**Qué:** el placeholder de fecha es la fecha de hoy (`agenda.tsx:196`), confuso con un valor ya presente; usar texto de ejemplo "AAAA-MM-DD". **Dónde:** `agenda.tsx:196` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-080 · Tests unitarios de `dayLabel` (HOY/MAÑANA/fechas)
**Qué:** cubrir las tres ramas y locale `es-ES`. **Dónde:** `agenda.tsx:32-39` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-081 · Test: `dayLabel` con clave de límite de mes/año
**Qué:** `2026-12-31` → `2027-01-01` (MAÑANA) cruzando año. **Dónde:** `agenda.tsx:33-34` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-082 · Tests del filtro de penalizaciones por día
**Qué:** verificar que `!q.is_penalty || day === today` solo muestra penalizaciones hoy. **Dónde:** `agenda.tsx:106` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-083 · Tests de `hasContent`/visibilidad de paneles
**Qué:** día futuro vacío no renderiza; hoy vacío sí. Cubre CRIT-AGE-05. **Dónde:** `agenda.tsx:110-111` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-084 · Test de la ventana de 14 días (`days`)
**Qué:** `days[0] === today` y `days[13] === addDays(today,13)`; ojo con el desfase respecto a `fetchCalendarEvents(today, addDays(today,14))` (consulta 15 días, render 14). **Dónde:** `agenda.tsx:59,93` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-085 · Corregir el desajuste ventana consulta (15) vs render (14)
**Qué:** `fetchCalendarEvents(today, addDays(today, DAYS_AHEAD))` trae hasta `today+14` inclusive, pero `days` solo llega a `today+13`; se descargan eventos del día 15 que nunca se muestran. Alinear a `DAYS_AHEAD - 1` o a `DAYS_AHEAD` en ambos. **Dónde:** `agenda.tsx:59,93` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-086 · Test de validación de fecha de `addEvent`
**Qué:** rechazar `2026-13-01`, `2026-00-10`, vacío; aceptar válida. **Dónde:** `agenda.tsx:78` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-087 · Test de integración del cerrojo anti doble-toque
**Qué:** dos `addEvent` consecutivos → una sola inserción. **Dónde:** `agenda.tsx:76` · **Impacto:** 3 · **Esfuerzo:** M

### AGE-088 · Extraer `dayLabel` a `dates.ts`
**Qué:** es lógica de fecha pura y testeable; sacarla de la pantalla. **Dónde:** `agenda.tsx:32-39` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-089 · Extraer la fila (`Row`) a componente reutilizable
**Qué:** las 4 variantes de fila comparten estructura icono+texto; un `AgendaRow` reduce duplicación. **Dónde:** `agenda.tsx:119-171` · **Impacto:** 3 · **Esfuerzo:** M

### AGE-090 · Extraer el `DayPanel` a componente propio
**Qué:** mover el bloque de `SystemWindow` por día a un componente memoizable. **Dónde:** `agenda.tsx:113-174` · **Impacto:** 3 · **Esfuerzo:** M

### AGE-091 · Extraer el formulario a `EventForm`/`EventSheet`
**Qué:** aislar estado y validación del modal (también ayuda a AGE-030). **Dónde:** `agenda.tsx:179-212` · **Impacto:** 3 · **Esfuerzo:** M

### AGE-092 · Tipar el input de `createCalendarEvent` con un alias reutilizable
**Qué:** definir `CalendarEventInput` en `types.ts` en lugar del literal inline (`dungeons.ts:113`). **Dónde:** `dungeons.ts:111-114` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-093 · Constantes de color por tipo de fila centralizadas
**Qué:** amber/purple/red/cyanDim repartidos en JSX; mapear `type → color` en un objeto. **Dónde:** `agenda.tsx:121,146,156,166` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-094 · Evitar el objeto de estilo inline `{ color: colors.red }`
**Qué:** `style={[styles.rowText, { color: colors.red }]}` (`agenda.tsx:122`) crea objeto en cada render; mover a `StyleSheet`. **Dónde:** `agenda.tsx:122,167` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-095 · Evitar `style={{ marginTop: 18 }}` inline en botones
**Qué:** mover a estilos nombrados (`agenda.tsx:208-209`). **Dónde:** `agenda.tsx:208-209` · **Impacto:** 1 · **Esfuerzo:** S

### AGE-096 · `Promise.all` en `load` falla en bloque: degradar parcialmente
**Qué:** si una de las 3 fetch falla, no se muestra ninguna sección (`agenda.tsx:57-64`); usar `allSettled` y pintar lo que sí cargue. **Dónde:** `agenda.tsx:57` · **Impacto:** 3 · **Esfuerzo:** M

### AGE-097 · Manejar `userId` ausente con feedback
**Qué:** `addEvent` hace `return` silencioso si no hay `userId` (`agenda.tsx:77`); informar o deshabilitar el "+". **Dónde:** `agenda.tsx:77` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-098 · Evitar carrera de cargas solapadas
**Qué:** `load` puede dispararse varias veces (foco + acciones); cancelar/ignorar respuestas obsoletas con un token de petición. **Dónde:** `agenda.tsx:55-68` · **Impacto:** 3 · **Esfuerzo:** M

### AGE-099 · Paginar/limitar `fetchPendingTasksWithDue`
**Qué:** trae TODAS las tareas pendientes con due (`dungeons.ts:53-62`); con muchas mazmorras crece sin tope. Limitar a la ventana visible. **Dónde:** `dungeons.ts:53` · **Impacto:** 3 · **Esfuerzo:** M

### AGE-100 · Acotar `fetchPendingTasksWithDue` por rango de fechas
**Qué:** filtrar en SQL `due_date <= today+DAYS_AHEAD` (más las vencidas) en vez de traerlas todas y filtrar en cliente. **Dónde:** `dungeons.ts:53-62` y uso en `agenda.tsx:108-109` · **Impacto:** 3 · **Esfuerzo:** M

### AGE-101 · Mostrar tareas con due futuro fuera de ventana como "más adelante"
**Qué:** tareas con `due_date > today+14` no aparecen en ningún sitio; una sección "próximamente" evita sorpresas. **Dónde:** `agenda.tsx:108` · **Impacto:** 3 · **Esfuerzo:** M

### AGE-102 · Indicador visual de "hoy" más fuerte (barra lateral/acento)
**Qué:** hoy solo cambia el color del borde y la cabecera; un acento lateral lo haría inconfundible al hacer scroll. **Dónde:** `agenda.tsx:114-115` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-103 · Auto-scroll a "HOY" al abrir
**Qué:** si en el futuro se muestran días pasados, posicionar el scroll en hoy al entrar. **Dónde:** `agenda.tsx:97` · **Impacto:** 2 · **Esfuerzo:** M

### AGE-104 · Cabecera "pegajosa" del día visible
**Qué:** `stickySectionHeadersEnabled` con `SectionList` para saber siempre qué día se mira. **Dónde:** `agenda.tsx:97-177` · **Impacto:** 2 · **Esfuerzo:** M

### AGE-105 · Separadores de semana ("ESTA SEMANA" / "PRÓXIMA SEMANA")
**Qué:** insertar divisores cada 7 días para orientación temporal. **Dónde:** `agenda.tsx:105` · **Impacto:** 2 · **Esfuerzo:** M

### AGE-106 · Mostrar el día de la semana abreviado además del nombre largo
**Qué:** `dayLabel` da nombre completo; un chip "L/M/X" ayuda al escaneo. **Dónde:** `agenda.tsx:37` · **Impacto:** 1 · **Esfuerzo:** S

### AGE-107 · Capitalización correcta del nombre del mes/día en `dayLabel`
**Qué:** se hace `.toUpperCase()` global (`agenda.tsx:38`); revisar tildes (`MIÉRCOLES`) y meses (`SEPT.`) en `es-ES`. **Dónde:** `agenda.tsx:37-38` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-108 · Coherencia "MAÑANA" vs nombre del día
**Qué:** solo +1 día dice "MAÑANA"; +2 muestra el nombre. Considerar "PASADO MAÑANA". **Dónde:** `agenda.tsx:33-34` · **Impacto:** 1 · **Esfuerzo:** S

### AGE-109 · Texto del placeholder de hora con ejemplo válido y formato
**Qué:** "Ej. 17:30" está bien, pero aclarar "24h" para evitar AM/PM. **Dónde:** `agenda.tsx:205` · **Impacto:** 1 · **Esfuerzo:** S

### AGE-110 · Mostrar duración estimada del evento (opcional)
**Qué:** campo opcional de duración para futuros recordatorios/Calendar. **Dónde:** `agenda.tsx:200-207` · **Impacto:** 2 · **Esfuerzo:** M

### AGE-111 · Marcar eventos creados desde mazmorra/gym distinto de los manuales
**Qué:** si en el futuro otras pantallas crean eventos, diferenciarlos por origen. **Dónde:** modelo `CalendarEvent` · **Impacto:** 2 · **Esfuerzo:** M

### AGE-112 · Persistir el estado de scroll/colapso entre focos
**Qué:** al volver de otra pestaña, recuperar la posición de lectura. **Dónde:** `agenda.tsx:70-74,97` · **Impacto:** 2 · **Esfuerzo:** M

### AGE-113 · Colapsar/expandir días por sección
**Qué:** permitir plegar días para ver de un vistazo solo los días con carga. **Dónde:** `agenda.tsx:113-174` · **Impacto:** 2 · **Esfuerzo:** M

### AGE-114 · Modo "solo hoy" (foco del día)
**Qué:** toggle que muestre únicamente el panel de hoy a pantalla. **Dónde:** `agenda.tsx:98-103` · **Impacto:** 2 · **Esfuerzo:** M

### AGE-115 · Contar y mostrar total de eventos próximos en la cabecera "AGENDA"
**Qué:** subtítulo "N eventos · M obligaciones en 14 días". **Dónde:** `agenda.tsx:98-99` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-116 · `testID` en elementos clave para tests E2E
**Qué:** ids en botón "+", inputs y botón añadir para Detox/Maestro. **Dónde:** `agenda.tsx:100,184,208` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-117 · Snapshot test del render con datos mezclados
**Qué:** un día con vencida+evento+tarea+hábito para fijar el layout. **Dónde:** `agenda.tsx:113-174` · **Impacto:** 2 · **Esfuerzo:** M

### AGE-118 · Memoizar `dayLabel` por `(key, today)`
**Qué:** se invoca por cada panel en cada render; `toLocaleDateString` no es gratis. **Dónde:** `agenda.tsx:116` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-119 · Evitar recrear `days` en cada render
**Qué:** `Array.from(...)` (`agenda.tsx:93`) se reconstruye en cada render; `useMemo` sobre `[today]`. **Dónde:** `agenda.tsx:93` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-120 · Reutilizar `weekdayOfKey` para resaltar fines de semana
**Qué:** usar `weekdayOfKey` (`dates.ts:35`) para dar un acento a sábados/domingos. **Dónde:** `agenda.tsx:114` · **Impacto:** 1 · **Esfuerzo:** S

### AGE-121 · Manejar zona horaria del dispositivo de forma explícita
**Qué:** `dateKey`/`new Date(y,m-1,d)` usan hora local; documentar que la agenda es "fecha local" y no UTC para evitar sorpresas al viajar. **Dónde:** `agenda.tsx:35-36`, `dates.ts:11-16` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-122 · Deduplicar eventos idénticos al renderizar (defensa ante CRIT-AGE-01)
**Qué:** mientras no haya cerrojo, agrupar visualmente duplicados (mismo title+date+time) para no confundir. **Dónde:** `agenda.tsx:107,128` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-123 · Restricción única en BD para evitar duplicados de evento
**Qué:** índice único parcial `(user_id, title, date, coalesce(time,''))` como red de seguridad de CRIT-AGE-01 (futura migración 0004). **Dónde:** `0002_fases.sql:38-46` · **Impacto:** 3 · **Esfuerzo:** M

### AGE-124 · CHECK de formato de `time` en la columna (futura migración)
**Qué:** `calendar_events.time` es `text` sin CHECK; añadir patrón `HH:MM` complementa AGE-007. **Dónde:** `0002_fases.sql:43` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-125 · Compartir/exportar la agenda del día
**Qué:** botón que vuelque el día a texto (hay `lib/exporter.ts` en el proyecto). **Dónde:** `agenda.tsx:98-103` · **Impacto:** 2 · **Esfuerzo:** M

### AGE-126 · Widget/resumen del día siguiente en Sistema
**Qué:** mostrar en la pantalla Sistema un avance de la agenda de mañana (cohesión entre pestañas). **Dónde:** consumo de `fetchCalendarEvents` desde Sistema · **Impacto:** 3 · **Esfuerzo:** M

### AGE-127 · Animación de entrada de los paneles (coherente con el sistema)
**Qué:** fade/slide sutil al cargar, alineado con nivl-design-system. **Dónde:** `agenda.tsx:113` · **Impacto:** 2 · **Esfuerzo:** M

### AGE-128 · Animar la eliminación de un evento
**Qué:** `LayoutAnimation`/Reanimated al borrar para que no "salte". **Dónde:** `agenda.tsx:138-139` · **Impacto:** 2 · **Esfuerzo:** M

### AGE-129 · Estado de error inline en el formulario (no solo `Alert`)
**Qué:** marcar en rojo el campo de fecha/hora inválido bajo el input. **Dónde:** `agenda.tsx:78-80,191-207` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-130 · Deshabilitar "Añadir" también si la fecha es inválida
**Qué:** hoy el botón solo mira `title.trim()` (`agenda.tsx:208`); incluir validez de fecha. **Dónde:** `agenda.tsx:208` · **Impacto:** 3 · **Esfuerzo:** S

### AGE-131 · Color del icono de hábito demasiado tenue (`cyanDim`)
**Qué:** `ellipse-outline` en `cyanDim` (`agenda.tsx:166`) con texto `textDim` puede pasar desapercibido; revisar contraste/jerarquía. **Dónde:** `agenda.tsx:166-167` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-132 · Unificar tamaños de icono (13/15) por tipo
**Qué:** mezcla de 13 y 15px (`agenda.tsx:121,146,156,166`); estandarizar para alineación vertical. **Dónde:** `agenda.tsx:121,146,156,166` · **Impacto:** 1 · **Esfuerzo:** S

### AGE-133 · Cohesión del título de pantalla con otras pestañas
**Qué:** verificar que "AGENDA" (`agenda.tsx:99,226`) sigue el mismo patrón de cabecera del resto de tabs. **Dónde:** `agenda.tsx:98-99` · **Impacto:** 1 · **Esfuerzo:** S

### AGE-134 · Probar el comportamiento con 0 hábitos activos
**Qué:** si no hay quests, `questsScheduledOn` devuelve []; asegurarse de que la agenda no queda totalmente vacía sin guía. **Dónde:** `agenda.tsx:106` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-135 · Caso límite: muchas filas en un solo día (scroll dentro del panel)
**Qué:** un día con decenas de obligaciones hace el `SystemWindow` larguísimo; considerar "ver N más". **Dónde:** `agenda.tsx:119-171` · **Impacto:** 2 · **Esfuerzo:** M

### AGE-136 · Caso límite: título de evento con solo espacios
**Qué:** `title.trim()` lo bloquea al crear, pero confirmar que la BD no acepta uno vacío vía otra ruta. **Dónde:** `agenda.tsx:77` · **Impacto:** 1 · **Esfuerzo:** S

### AGE-137 · Caso límite: hora "24:00" o "0:5"
**Qué:** la futura validación debe rechazar "24:00" y normalizar/rechazar "0:5" → "00:05". **Dónde:** `agenda.tsx:84` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-138 · Caso límite: evento exactamente en el día 14
**Qué:** comprobar inclusividad del límite superior entre la consulta y `days` (relacionado con AGE-085). **Dónde:** `agenda.tsx:59,93` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-139 · Mostrar al usuario que las vencidas vienen de mazmorras
**Qué:** "VENCIDA · {título}" no dice que es una tarea de mazmorra; añadir contexto/icono coherente. **Dónde:** `agenda.tsx:122-124` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-140 · Permitir posponer (snooze) una tarea vencida desde la agenda
**Qué:** acción para mover `due_date` a hoy/mañana sin entrar a la mazmorra. **Dónde:** `agenda.tsx:119-126` · **Impacto:** 3 · **Esfuerzo:** M

### AGE-141 · Caché local de la agenda para arranque offline
**Qué:** persistir la última carga (AsyncStorage) y mostrarla mientras llega la red. **Dónde:** `agenda.tsx:55-68` · **Impacto:** 3 · **Esfuerzo:** L

### AGE-142 · Reintento con backoff si `load` falla
**Qué:** ofrecer "Reintentar" en el `Alert` de error de `load`. **Dónde:** `agenda.tsx:65-67` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-143 · Distinguir tarea de mazmorra "JEFE" visualmente más
**Qué:** "JEFE · " es solo texto (`agenda.tsx:158`); un badge púrpura reforzaría la jerarquía. **Dónde:** `agenda.tsx:156-160` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-144 · Mostrar la stat/icono asociado al hábito en la fila
**Qué:** color/letra de la stat (FUE/VIT/…) ayuda a leer el día de un vistazo. **Dónde:** `agenda.tsx:164-171` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-145 · Indicar hábitos ya completados hoy (tachado/check)
**Qué:** la agenda no refleja si un hábito de hoy ya está hecho; cruzar con completions para mostrar estado. **Dónde:** `agenda.tsx:164-171` · **Impacto:** 4 · **Esfuerzo:** M

### AGE-146 · Indicar eventos pasados del día de hoy de forma distinta
**Qué:** si `e.time` ya pasó, atenuar. Relacionado con AGE-051 pero específico de hoy. **Dónde:** `agenda.tsx:128-150` · **Impacto:** 2 · **Esfuerzo:** M

### AGE-147 · `numberOfLines` configurable o 2 líneas en eventos
**Qué:** permitir 2 líneas en eventos (suelen ser más descriptivos que un hábito). **Dónde:** `agenda.tsx:147` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-148 · Documentar el contrato de `questsScheduledOn` respecto a penalizaciones
**Qué:** la pantalla re-filtra penalizaciones (`agenda.tsx:106`) porque `questsScheduledOn` ya las incluye si `penalty_date===date`; comentar por qué el doble filtro. **Dónde:** `agenda.tsx:106`, `closing.ts:8-15` · **Impacto:** 1 · **Esfuerzo:** S

### AGE-149 · Evitar mostrar penalizaciones futuras como obligaciones normales
**Qué:** confirmar que una penalty con `penalty_date` futuro no aparece como hábito en días futuros (hoy se filtra solo `day===today`). **Dónde:** `agenda.tsx:106` · **Impacto:** 2 · **Esfuerzo:** S

### AGE-150 · Test de regresión del flujo crear→listar→borrar evento
**Qué:** prueba de integración del ciclo completo con mock de Supabase. **Dónde:** `agenda.tsx:76-91,131-143` · **Impacto:** 3 · **Esfuerzo:** M

---

Total: 150 mejoras, 7 bugs.
