# UX/UI Mazmorras y detalle

> Área MAZ · auditoría de código NIVL · anclada al código real
> Archivos auditados: `src/app/(tabs)/mazmorras.tsx`, `src/app/dungeon/[id].tsx`
> Vecinos leídos para anclar: `src/lib/dungeons.ts`, `src/lib/types.ts`, `src/lib/game.ts`, `src/lib/engine.ts`, `src/app/(tabs)/agenda.tsx`, `src/components/{XPBar,SystemWindow,SystemButton}.tsx`, `supabase/migrations/0002_fases.sql`, `0003_seguridad.sql`.

---

## Bugs y riesgos

### CRIT-MAZ-01 · Colisión de `position` al crear tarea tras borrar otra — `dungeon/[id].tsx:74` · severidad alta
**Problema:** `addTask` inserta con `position: tasks.length`. `fetchTasks` ordena SOLO por `position` (`dungeons.ts:48`, sin desempate por `id`/`created_at`). Si hay tareas en posiciones 0,1,2 y borras la del medio (quedan 0 y 2; `tasks.length` pasa a 2), la siguiente tarea se inserta con `position: 2`, **colisionando** con la que ya tenía 2. Con dos filas en la misma posición el orden de empate es indefinido (lo decide Postgres), así que las tareas saltan/se intercambian visualmente entre recargas. Cada borrar+añadir agrava el desbarajuste.
**Arreglo:** calcular la posición como `Math.max(-1, ...tasks.map(t => t.position)) + 1` en lugar de `tasks.length`; o mejor, mover el cálculo al servidor (RPC) o reordenar (`UPDATE ... position = position`) tras cada borrado. Añadir desempate estable en `fetchTasks`: `.order('position').order('id')`.

### CRIT-MAZ-02 · Doble-XP por doble toque en una tarea: el cerrojo es estado, no `useRef` — `dungeon/[id].tsx:82-103` · severidad alta
**Problema:** `toggleTask` se protege solo con el estado `busy` (`if (... || busy ...) return;` línea 83) y `setBusy(true)` (línea 85). `setBusy` es asíncrono: React no actualiza el estado de forma síncrona, así que dos toques muy rápidos sobre la misma tarea (o sobre dos tareas distintas) pueden **pasar ambos el guard antes del re-render**, llamando dos veces a `setTaskDone` + `awardXp` → XP duplicado. El propio repo ya resolvió exactamente este patrón con un cerrojo síncrono `useRef` en `index.tsx:47` (`completing = useRef<Set<string>>`) y `diario.tsx:75` (`saving = useRef(false)`); aquí no se aplicó.
**Arreglo:** añadir `const lock = useRef(false)` (o un `Set<string>` por `task.id` como en index.tsx). Al entrar: `if (lock.current) return; lock.current = true;` y liberar en `finally`. Mantener `busy` solo para el estado visual.

### CRIT-MAZ-03 · La fila de la tarea NO se deshabilita mientras se procesa XP — `dungeon/[id].tsx:198-231` · severidad media
**Problema:** durante `toggleTask` (subida de XP, `ensureProfile`, `awardXp`, `load`, varios await) el `Pressable` de cada tarea sigue totalmente activo y sin indicación visual. El usuario puede tocar OTRA tarea; el guard `busy` la rechaza en silencio (sin feedback) y, combinado con CRIT-MAZ-02, abre la ventana de carrera. Tampoco hay spinner por fila.
**Arreglo:** mientras `busy`, deshabilitar las filas (`disabled={busy}` en el Pressable) y/o mostrar un `ActivityIndicator` en la fila tocada (guardar `pendingId` en estado). Da feedback y cierra la carrera.

### CRIT-MAZ-04 · Borrado de mazmorra/tarea sin protección contra error ni feedback — `dungeon/[id].tsx:140-144`, `206-211` · severidad media
**Problema:** los `onPress` destructivos (`deleteDungeon`, `deleteTask`) son `async` sin `try/catch`. Si la llamada a Supabase falla (red caída, RLS), la promesa se rechaza sin capturar: en `removeDungeon` se hace `router.back()` en la línea siguiente **aunque el borrado haya fallado**, dejando la mazmorra viva pero al usuario convencido de que la borró. En `deleteTask` el fallo se traga sin avisar.
**Arreglo:** envolver ambos en `try/catch` con `Alert.alert('Error del sistema', ...)`; en `removeDungeon`, solo `router.back()` tras un borrado confirmado correcto.

### CRIT-MAZ-05 · `mazmorras.tsx`: conteo N+1 en cliente con doble `filter` por mazmorra — `mazmorras.tsx:44-52` · severidad media
**Problema:** `load` trae TODAS las filas de `dungeon_tasks` y luego, dentro de `all.map`, ejecuta `rows.filter(...)` **dos veces por cada mazmorra** (total y hechas). Es O(D×T): con muchas mazmorras y tareas el coste crece cuadráticamente y se recorre la tabla entera de tareas en cada `useFocusEffect`. Además depende exclusivamente de RLS para acotar al usuario (no filtra `user_id` ni `done` en servidor).
**Arreglo:** agregar en servidor. Opción simple: una sola pasada construyendo un `Map<dungeon_id, {total, done}>` antes del `map` (O(T)). Opción robusta: vista/RPC que devuelva `dungeon_id, total, done_count` agregados, o `head:true count` por estado. Reduce payload y CPU.

### CRIT-MAZ-06 · Una tarea completada es irreversible (mistap permanente) — `dungeon/[id].tsx:84` · severidad media
**Problema:** `toggleTask` corta con `if (task.done) return;`. El nombre promete alternar, pero es de un solo sentido: si marcas una tarea por error, **no hay forma de desmarcarla** desde la UI (solo borrarla y recrearla, perdiendo su posición e historial). El long-press solo ofrece "Eliminar". Para una app de un solo usuario sin deshacer, un mistap deja XP otorgado y la tarea bloqueada como hecha.
**Arreglo:** permitir desmarcar con confirmación (`setTaskDone(id, false)` ya existe en `dungeons.ts:78`) restando el XP correspondiente vía un `awardXp` negativo o RPC; o como mínimo añadir "Desmarcar" al menú del long-press. Decidir con nivl-game-design si se revierte XP (coherencia económica).

---

## Mejoras

> Impacto 1-5 (5 = más valor para el usuario). Esfuerzo S/M/L.

### Deadlines, jefes y progreso (el foco del área)

### MAZ-001 · Permitir fijar `due_date` al crear/editar una tarea
**Qué:** la columna `dungeon_tasks.due_date` existe (`0002_fases.sql:34`), la agenda YA la consume y pinta "VENCIDA" (`agenda.tsx:108-126,154-162`), pero el formulario de tarea no tiene campo de fecha: el dato es inalcanzable desde la UI. **Dónde:** `dungeon/[id].tsx:244-265` (modal) y `createTask` ya acepta `due_date` (`dungeons.ts:67`). **Impacto:** 5 · **Esfuerzo:** M

### MAZ-002 · Permitir fijar `deadline` y `description` de la mazmorra
**Qué:** `dungeons.deadline` y `dungeons.description` existen (`0002_fases.sql:17,19`) y `createDungeon`/`updateDungeon` ya los aceptan (`dungeons.ts:22,33`), pero ni el alta (`mazmorras.tsx:143-176`) ni el detalle los exponen. **Dónde:** modal de `mazmorras.tsx`, cabecera de `dungeon/[id].tsx:170-181`. **Impacto:** 4 · **Esfuerzo:** M

### MAZ-003 · Mostrar el deadline de la mazmorra y cuenta atrás en la tarjeta
**Qué:** en `mazmorras.tsx:114-116` la meta solo muestra objetivos/stat/botín; añadir "vence en N días" / "VENCIDA" cuando `deadline` esté fijado, en rojo si pasó. **Dónde:** `mazmorras.tsx:114`, `dungeon/[id].tsx:172`. **Impacto:** 4 · **Esfuerzo:** S

### MAZ-004 · Barra de progreso específica de jefes (hitos)
**Qué:** hoy la barra cuenta TODAS las tareas por igual (`dungeon/[id].tsx:176`), un jefe pesa lo mismo que un monstruo trivial. El usuario no ve cuántos hitos quedan. Añadir un contador/barra "JEFES x/y" separada usando `tasks.filter(t => t.is_boss)`. **Dónde:** `dungeon/[id].tsx:152-181`. **Impacto:** 4 · **Esfuerzo:** S

### MAZ-005 · Ponderar el progreso por XP en vez de por nº de tareas
**Qué:** `done/tasks.length` (`dungeon/[id].tsx:176`, `mazmorras.tsx:118`) trata todas las tareas igual; una barra ponderada por `dungeonTaskXp` reflejaría mejor el esfuerzo restante (un jefe épico pendiente debería mover poco la barra al completar un trivial). **Dónde:** `mazmorras.tsx:50,118`, `dungeon/[id].tsx:152,176`. **Impacto:** 3 · **Esfuerzo:** M

### MAZ-006 · Resaltar visualmente las tareas vencidas dentro del detalle
**Qué:** la agenda marca "VENCIDA" pero el detalle de la mazmorra no: una tarea con `due_date < hoy` se ve igual que las demás (`dungeon/[id].tsx:223-226`). Añadir un badge rojo y/o el `due_date` en `taskMeta`. **Dónde:** `dungeon/[id].tsx:223`. **Impacto:** 4 · **Esfuerzo:** S

### MAZ-007 · Mostrar el `due_date` en la meta de cada tarea
**Qué:** `taskMeta` (`dungeon/[id].tsx:223-226`) solo muestra "JEFE · dificultad". Añadir la fecha límite cuando exista. **Dónde:** `dungeon/[id].tsx:223`. **Impacto:** 3 · **Esfuerzo:** S

### MAZ-008 · Selector de fecha real (DatePicker) en lugar de texto AAAA-MM-DD
**Qué:** si se añade `due_date`/`deadline` por texto se repetiría la fragilidad de la agenda (regex `^\d{4}-\d{2}-\d{2}$`, `agenda.tsx:78`). Usar `@react-native-community/datetimepicker` para evitar fechas inválidas. **Dónde:** modales de `mazmorras.tsx` y `dungeon/[id].tsx`. **Impacto:** 3 · **Esfuerzo:** M

### MAZ-009 · Avisar de tareas vencidas en la tarjeta de la lista
**Qué:** en `mazmorras.tsx` la tarjeta no refleja si la mazmorra tiene tareas vencidas; añadir un punto/insignia rojo si alguna `due_date < hoy`. Requiere traer `due_date` en el `select` del conteo (`mazmorras.tsx:44`). **Dónde:** `mazmorras.tsx:44,114`. **Impacto:** 3 · **Esfuerzo:** M

### Reordenar tareas

### MAZ-010 · Reordenar tareas con arrastre (drag & drop)
**Qué:** la columna `position` existe y se ordena por ella (`dungeons.ts:48`) pero NO hay forma de reordenar: el orden queda fijado por el de creación. Integrar `react-native-draggable-flatlist` (o flechas, ver MAZ-011) y persistir con `updateTask`. **Dónde:** `dungeon/[id].tsx:197-233`. **Impacto:** 4 · **Esfuerzo:** L

### MAZ-011 · Reordenar con flechas arriba/abajo (alternativa ligera)
**Qué:** si el drag es demasiado, ofrecer botones ↑/↓ en cada fila que intercambien `position` con la vecina. No requiere dependencias nuevas. **Dónde:** `dungeon/[id].tsx:214-231`. **Impacto:** 3 · **Esfuerzo:** M

### MAZ-012 · Añadir `updateTask` a la capa de datos
**Qué:** `dungeons.ts` tiene `createTask/setTaskDone/deleteTask` pero NO un `updateTask` genérico; reordenar, editar título/dificultad/jefe/fecha lo necesitan. **Dónde:** `dungeons.ts:64-89`. **Impacto:** 4 · **Esfuerzo:** S

### MAZ-013 · Resecuenciar posiciones tras borrar
**Qué:** al borrar una tarea (`dungeon/[id].tsx:208`) las posiciones quedan con huecos (0,2,3…), lo que alimenta CRIT-MAZ-01. Tras borrar, normalizar `position` a 0..n-1. **Dónde:** `dungeon/[id].tsx:206-211`, `dungeons.ts`. **Impacto:** 3 · **Esfuerzo:** M

### MAZ-014 · Optimistic update al reordenar
**Qué:** cuando exista reordenado, aplicar el cambio en el estado local antes del round-trip y revertir si falla, para que el arrastre no "salte" mientras llega la respuesta. **Dónde:** `dungeon/[id].tsx`. **Impacto:** 3 · **Esfuerzo:** M

### Editar tarea / mazmorra

### MAZ-015 · Editar el título de la mazmorra
**Qué:** una vez creada, no hay forma de renombrarla (solo borrar). `updateDungeon` ya existe (`dungeons.ts:33`). Botón "editar" en la cabecera (`dungeon/[id].tsx:158-168`). **Impacto:** 4 · **Esfuerzo:** M

### MAZ-016 · Editar rango y stat de la mazmorra
**Qué:** rango y stat se eligen solo al crear (`mazmorras.tsx:152-167`); si te equivocas, quedan fijos. Permitir editarlos (afecta al botín `DUNGEON_CLEAR_XP[rank]`). **Dónde:** `dungeon/[id].tsx`. **Impacto:** 3 · **Esfuerzo:** M

### MAZ-017 · Editar una tarea (título, dificultad, jefe, fecha)
**Qué:** una tarea no se puede editar; un error en la dificultad obliga a borrarla y rehacerla, perdiendo posición. Reutilizar el modal "NUEVO OBJETIVO" en modo edición. **Dónde:** `dungeon/[id].tsx:241-279`. **Impacto:** 4 · **Esfuerzo:** M

### MAZ-018 · Menú de acciones de tarea en vez de solo long-press→Eliminar
**Qué:** el long-press solo ofrece Eliminar (`dungeon/[id].tsx:201-213`); convertirlo en un menú (Editar / Desmarcar / Cambiar fecha / Eliminar). **Dónde:** `dungeon/[id].tsx:201`. **Impacto:** 3 · **Esfuerzo:** M

### MAZ-019 · Descubribilidad del long-press para borrar
**Qué:** que el borrado esté oculto tras un long-press sin ninguna pista (`dungeon/[id].tsx:201`) es poco descubrible; añadir un icono de papelera por fila o un hint la primera vez. **Dónde:** `dungeon/[id].tsx:214`. **Impacto:** 3 · **Esfuerzo:** S

### MAZ-020 · Reactivar / reabrir una mazmorra despejada
**Qué:** tras despejar (`status='cleared'`) la mazmorra es de solo lectura para siempre (`dungeon/[id].tsx:186`); no hay forma de reabrirla si se reclamó por error. Permitir volver a `active` (decidir con game-design si se retira el botín). **Dónde:** `dungeon/[id].tsx`. **Impacto:** 2 · **Esfuerzo:** M

### MAZ-021 · Soporte real para el estado `abandoned`
**Qué:** el tipo y el CHECK contemplan `'abandoned'` (`types.ts:59`, `0002_fases.sql:20`) pero la UI nunca lo usa: borrar elimina la fila (`deleteDungeon`). Ofrecer "Abandonar" (marca `abandoned`, conserva historial) frente a "Eliminar" (borra). **Dónde:** `dungeon/[id].tsx:133-146`. **Impacto:** 3 · **Esfuerzo:** M

### Subtareas y plantillas

### MAZ-022 · Subtareas (jerarquía de monstruos)
**Qué:** el foco del área pide subtareas; hoy `dungeon_tasks` es plano. Añadir `parent_task_id` (migración 0004) y anidar en la UI. Permite desglosar un jefe en pasos. **Dónde:** `dungeon/[id].tsx` + nueva migración. **Impacto:** 4 · **Esfuerzo:** L

### MAZ-023 · Plantillas de proyecto/mazmorra
**Qué:** crear una mazmorra desde una plantilla (p. ej. "TFG", "Asignatura", "Mudanza") con tareas y jefes predefinidos. Acelera el alta y refuerza la metáfora. **Dónde:** nuevo flujo desde `mazmorras.tsx:87` / modal. **Impacto:** 4 · **Esfuerzo:** L

### MAZ-024 · Duplicar una mazmorra existente como plantilla
**Qué:** "Duplicar" copia título+tareas (sin estado de hecho) para objetivos recurrentes. Reutiliza `createDungeon`+`createTask` en bucle. **Dónde:** `dungeon/[id].tsx` (acción), `dungeons.ts`. **Impacto:** 3 · **Esfuerzo:** M

### MAZ-025 · Añadir varias tareas de golpe (multilínea)
**Qué:** crear tareas de una en una es lento al desglosar. Un campo multilínea "una tarea por línea" que cree N tareas con posiciones consecutivas. **Dónde:** modal de `dungeon/[id].tsx:244-265`. **Impacto:** 3 · **Esfuerzo:** M

### Estados vacío / cargando / error

### MAZ-026 · Estado de carga real en la lista de mazmorras
**Qué:** `dungeons` arranca en `[]` (`mazmorras.tsx:34`); mientras carga se ve el estado vacío "No hay mazmorras abiertas" aunque sí las haya, generando un parpadeo confuso. Distinguir `loading` de "vacío de verdad". **Dónde:** `mazmorras.tsx:34,92`. **Impacto:** 4 · **Esfuerzo:** S

### MAZ-027 · Pantalla de carga en el detalle (no en blanco)
**Qué:** mientras `dungeon` es `null` se devuelve un `SafeAreaView` vacío sin nada (`dungeon/[id].tsx:148-150`): el usuario ve una pantalla negra sin spinner ni botón de volver. Mostrar un skeleton o al menos la flecha de retroceso + spinner. **Dónde:** `dungeon/[id].tsx:148-150`. **Impacto:** 4 · **Esfuerzo:** S

### MAZ-027b · El back es inalcanzable si la carga falla o el id no existe
**Qué:** si `fetchDungeon` falla o el `id` no existe, `dungeon` se queda `null` y la rama de la línea 148 pinta una pantalla vacía SIN cabecera ni botón "atrás"; el usuario queda atrapado (debe usar el gesto del SO). **Dónde:** `dungeon/[id].tsx:148-150,54-62`. **Impacto:** 4 · **Esfuerzo:** S

### MAZ-028 · Estado de error con reintento
**Qué:** los fallos de carga solo lanzan un `Alert` efímero (`mazmorras.tsx:54`, `dungeon/[id].tsx:60`); tras cerrarlo no hay nada en pantalla ni botón "Reintentar". Añadir un estado de error persistente con acción de recarga. **Dónde:** ambos `load`. **Impacto:** 4 · **Esfuerzo:** M

### MAZ-029 · Estado vacío del detalle más accionable
**Qué:** "Sin objetivos todavía…" (`dungeon/[id].tsx:192-195`) es solo texto; añadir un botón "Añadir primer objetivo" que abra el modal directamente. **Dónde:** `dungeon/[id].tsx:192`. **Impacto:** 3 · **Esfuerzo:** S

### MAZ-030 · CTA en el estado vacío de la lista
**Qué:** el estado vacío de mazmorras (`mazmorras.tsx:92-98`) explica el concepto pero el único modo de crear es el "+" arriba a la derecha; añadir un botón "Abrir primera mazmorra" dentro de la ventana. **Dónde:** `mazmorras.tsx:92`. **Impacto:** 3 · **Esfuerzo:** S

### MAZ-031 · Pull-to-refresh en ambas listas
**Qué:** solo se recarga al enfocar (`useFocusEffect`); si los datos cambian sin perder foco no hay forma manual de refrescar. Añadir `RefreshControl` al `ScrollView`. **Dónde:** `mazmorras.tsx:84`, `dungeon/[id].tsx:157`. **Impacto:** 3 · **Esfuerzo:** S

### MAZ-032 · Confirmación/feedback al añadir tarea
**Qué:** `addTask` cierra el modal sin feedback (`dungeon/[id].tsx:77-79`); un toast/haptic ligero confirmaría el alta como en otras pantallas. **Dónde:** `dungeon/[id].tsx:68-80`. **Impacto:** 2 · **Esfuerzo:** S

### Teclado / formularios

### MAZ-033 · `KeyboardAvoidingView` en el modal de nueva mazmorra
**Qué:** el bottom-sheet de `mazmorras.tsx:140-178` no envuelve el contenido en `KeyboardAvoidingView`, patrón ya usado en `QuestForm.tsx:68`, `oraculo.tsx:116` y `login.tsx:56`. Al abrir el teclado, los chips y botones inferiores pueden quedar tapados. **Dónde:** `mazmorras.tsx:140`. **Impacto:** 4 · **Esfuerzo:** S

### MAZ-034 · `KeyboardAvoidingView` en el modal de nuevo objetivo
**Qué:** mismo problema en `dungeon/[id].tsx:241-279`: el `TextInput` del título y los botones "Añadir/Cancelar" quedan bajo el teclado. **Dónde:** `dungeon/[id].tsx:241`. **Impacto:** 4 · **Esfuerzo:** S

### MAZ-035 · `returnKeyType`/`onSubmitEditing` para enviar desde el teclado
**Qué:** los `TextInput` (`mazmorras.tsx:145`, `dungeon/[id].tsx:245`) no definen acción de retorno; permitir crear con la tecla "Hecho". **Dónde:** ambos TextInput. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-036 · `autoFocus` al abrir el modal
**Qué:** al abrir el bottom-sheet el campo no recibe foco; el usuario debe tocar el input. `autoFocus` (o foco diferido) acelera el alta. **Dónde:** `mazmorras.tsx:145`, `dungeon/[id].tsx:245`. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-037 · `maxLength` en los títulos
**Qué:** título de mazmorra y de tarea no limitan longitud; un título enorme rompe el `numberOfLines={1}` y el layout de la tarjeta. Limitar (p. ej. 80) y/o mostrar contador. **Dónde:** `mazmorras.tsx:145`, `dungeon/[id].tsx:245`. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-038 · Recortar/normalizar el título (espacios) antes de validar
**Qué:** `disabled={!title.trim()}` valida pero `onChangeText={setTitle}` guarda con espacios; un título de solo espacios sí se recorta al enviar (`createDungeon` usa `title.trim()`), pero conviene normalizar también internamente para el contador y el placeholder. **Dónde:** `mazmorras.tsx:147-148`. **Impacto:** 1 · **Esfuerzo:** S

### MAZ-039 · Resetear el estado del formulario al cerrar/cancelar
**Qué:** al cancelar el modal de nueva mazmorra, `rank` y `stat` conservan la última selección (no se resetean en `setFormOpen(false)`, `mazmorras.tsx:175`); en el de tarea, `difficulty` tampoco. Resetear para una experiencia predecible (o conservar a propósito, pero decidirlo). **Dónde:** `mazmorras.tsx:69-70,175`, `dungeon/[id].tsx:77-78,276`. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-040 · Cerrar el teclado al tocar fuera del input
**Qué:** en los bottom-sheets no hay `keyboardShouldPersistTaps`/dismiss al tocar el backdrop; tocar fuera no oculta el teclado. **Dónde:** `mazmorras.tsx:141`, `dungeon/[id].tsx:242`. **Impacto:** 2 · **Esfuerzo:** S

### Accesibilidad

### MAZ-041 · `accessibilityLabel` en el botón "+" de crear mazmorra
**Qué:** el `Pressable` con el icono `add` (`mazmorras.tsx:87-89`) no tiene etiqueta accesible; un lector de pantalla solo anuncia "botón". **Dónde:** `mazmorras.tsx:87`. **Impacto:** 3 · **Esfuerzo:** S

### MAZ-042 · `accessibilityRole="checkbox"` + `accessibilityState` en la casilla de tarea
**Qué:** la fila de tarea es un `Pressable` que actúa como checkbox (`dungeon/[id].tsx:198-216`) pero no expone rol ni estado marcado/desmarcado a accesibilidad. **Dónde:** `dungeon/[id].tsx:198,216`. **Impacto:** 3 · **Esfuerzo:** S

### MAZ-043 · Etiquetas accesibles en back / papelera / add del detalle
**Qué:** los iconos de la cabecera y del header de objetivos (`dungeon/[id].tsx:159,165,187`) no tienen `accessibilityLabel` ("Volver", "Eliminar mazmorra", "Añadir objetivo"). **Dónde:** `dungeon/[id].tsx:159,165,187`. **Impacto:** 3 · **Esfuerzo:** S

### MAZ-044 · Estado seleccionado de los chips accesible
**Qué:** los chips de rango/stat/dificultad (`mazmorras.tsx:155,163`, `dungeon/[id].tsx:255`) comunican la selección solo por color; añadir `accessibilityState={{ selected }}` y `accessibilityRole="button"`. **Dónde:** esos Pressable. **Impacto:** 3 · **Esfuerzo:** S

### MAZ-045 · Contraste del texto atenuado de los chips no seleccionados
**Qué:** `chipText` usa `colors.textDim` (#7A8CA6) sobre `colors.bg`/`panelDeep` muy oscuro; el contraste de los chips no marcados puede quedar por debajo de WCAG AA. Verificar y subir a `colors.text` si hace falta. **Dónde:** `mazmorras.tsx:253`, `dungeon/[id].tsx:370`. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-046 · Área táctil de la casilla de la tarea
**Qué:** la casilla mide 20×20 (`dungeon/[id].tsx:324-326`), por debajo del mínimo recomendado de 44×44; aunque toda la fila es pulsable, conviene asegurar el `hitSlop` o ampliar el target. **Dónde:** `dungeon/[id].tsx:316-326`. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-047 · Anunciar el progreso de la barra a accesibilidad
**Qué:** la `XPBar` es puramente visual; el detalle/tarjeta deberían exponer "X de Y objetivos" como `accessibilityLabel` en el contenedor del progreso. **Dónde:** `mazmorras.tsx:117`, `dungeon/[id].tsx:175`. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-048 · `accessibilityViewIsModal` y foco en los bottom-sheets
**Qué:** los `Modal` no marcan el contenido como modal para lectores ni gestionan el foco inicial; el lector puede seguir leyendo detrás del sheet. **Dónde:** `mazmorras.tsx:140`, `dungeon/[id].tsx:241`. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-049 · Respetar tamaño de fuente del sistema sin romper `numberOfLines`
**Qué:** con `numberOfLines={1}` en títulos (`mazmorras.tsx:111`, `dungeon/[id].tsx:220`) y fuentes a tamaño fijo, usuarios con texto grande pierden información. Permitir 2 líneas o `adjustsFontSizeToFit`. **Dónde:** esos `Text`. **Impacto:** 2 · **Esfuerzo:** S

### Rendimiento

### MAZ-050 · Usar `FlatList` en lugar de `map` dentro de `ScrollView`
**Qué:** tanto la lista de mazmorras (`mazmorras.tsx:100-126`) como la de tareas (`dungeon/[id].tsx:197-233`) renderizan con `.map` dentro de un `ScrollView`, sin reciclado; con muchas filas todo se monta de golpe. Migrar a `FlatList`/`SectionList`. **Dónde:** ambos. **Impacto:** 3 · **Esfuerzo:** M

### MAZ-051 · Memoizar el cálculo de `active`/`cleared`
**Qué:** `active`/`cleared` se filtran en cada render (`mazmorras.tsx:79-80`); envolver en `useMemo` dependiente de `dungeons`. **Dónde:** `mazmorras.tsx:79`. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-052 · Memoizar `done`/`allDone` en el detalle
**Qué:** `done` y `allDone` se recalculan cada render filtrando `tasks` (`dungeon/[id].tsx:152-153`); `useMemo` sobre `tasks`. **Dónde:** `dungeon/[id].tsx:152`. **Impacto:** 1 · **Esfuerzo:** S

### MAZ-053 · Extraer y memoizar la fila de tarea (`React.memo`)
**Qué:** cada item de tarea es un `Pressable` con varios estilos; extraerlo a un componente `TaskRow` memoizado reduce re-renders al cambiar una sola tarea. **Dónde:** `dungeon/[id].tsx:197-233`. **Impacto:** 2 · **Esfuerzo:** M

### MAZ-054 · Evitar refrescar TODO tras togglear una tarea
**Qué:** `toggleTask` hace `await load()` (re-fetch de mazmorra + todas las tareas) por un solo cambio (`dungeon/[id].tsx:97`); aplicar update optimista local y refrescar solo el perfil/XP. **Dónde:** `dungeon/[id].tsx:82-97`. **Impacto:** 3 · **Esfuerzo:** M

### MAZ-055 · `select` mínimo en el conteo de tareas
**Qué:** `select('dungeon_id, done')` (`mazmorras.tsx:44`) ya es estrecho, pero combinado con MAZ-005/MAZ-009 conviene fijar exactamente las columnas necesarias y un `.eq('user_id', userId)` explícito como defensa en profundidad. **Dónde:** `mazmorras.tsx:44`. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-056 · Cancelar/ignorar cargas obsoletas (race de navegación)
**Qué:** `load` en el detalle depende de `id`; si se navega rápido entre mazmorras una respuesta tardía puede pisar el estado de otra. Añadir un flag de "montado"/AbortController o comparar el `id` al resolver. **Dónde:** `dungeon/[id].tsx:54-66`. **Impacto:** 2 · **Esfuerzo:** M

### MAZ-057 · Recordar/precargar el conteo para evitar barra a 0 inicial
**Qué:** al entrar al detalle, antes de que `fetchTasks` resuelva, la cabecera muestra `0/0` y barra vacía (`dungeon/[id].tsx:173,176`); precargar con el `doneCount/total` que ya trae la lista (pasarlo por params) evita el salto. **Dónde:** `mazmorras.tsx:103`, `dungeon/[id].tsx:173`. **Impacto:** 2 · **Esfuerzo:** M

### UX / UI visual

### MAZ-058 · Mostrar XP total acumulado de la mazmorra
**Qué:** la meta solo muestra el botín al despejar (`dungeon/[id].tsx:172-174`), no la suma de XP ya ganado por tareas; mostrar "ganado X / restante Y XP" motiva. **Dónde:** `dungeon/[id].tsx:172`. **Impacto:** 3 · **Esfuerzo:** S

### MAZ-059 · Animar la barra de progreso
**Qué:** `XPBar` cambia de ancho sin animación (`XPBar.tsx:14-16`); animar la transición al completar una tarea refuerza el feedback. **Dónde:** `XPBar.tsx`, usado en `dungeon/[id].tsx:176`. **Impacto:** 2 · **Esfuerzo:** M

### MAZ-060 · Tachado/atenuado coherente en tareas hechas
**Qué:** ya hay `taskDone` con line-through (`dungeon/[id].tsx:335`), pero la fila entera no se atenúa; bajar opacidad de toda la fila completada mejora la jerarquía. **Dónde:** `dungeon/[id].tsx:214-231,335`. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-061 · Iconografía distinta para jefe vs monstruo
**Qué:** un jefe solo se distingue por el borde más grueso de la casilla (`boxBoss`, `dungeon/[id].tsx:333`) y el prefijo "JEFE ·"; un icono de calavera/corona lo haría inmediato. **Dónde:** `dungeon/[id].tsx:216,224`. **Impacto:** 3 · **Esfuerzo:** S

### MAZ-062 · Diferenciar visualmente el rango por color/insignia
**Qué:** el `rankBox` usa siempre `colors.purple` (`mazmorras.tsx:202-210`); colorear según rango (E→S) ayuda a escanear la lista y refuerza la progresión. **Dónde:** `mazmorras.tsx:107-109,202`. **Impacto:** 3 · **Esfuerzo:** M

### MAZ-063 · Ordenar/agrupar tareas: pendientes arriba, hechas abajo
**Qué:** las tareas se muestran en orden de `position` mezclando hechas y pendientes (`dungeon/[id].tsx:197`); ofrecer una vista que agrupe pendientes primero (sin perder el orden manual). **Dónde:** `dungeon/[id].tsx:197`. **Impacto:** 3 · **Esfuerzo:** M

### MAZ-064 · Sección "Despejadas" colapsable y navegable
**Qué:** las despejadas se listan como texto plano no pulsable (`mazmorras.tsx:131-135`): no puedes abrir una mazmorra ya despejada para revisarla. Hacerlas pulsables y colapsables. **Dónde:** `mazmorras.tsx:128-137`. **Impacto:** 3 · **Esfuerzo:** S

### MAZ-065 · Mostrar fecha de despeje en las despejadas
**Qué:** `cleared_at` se guarda (`dungeon/[id].tsx:110`) pero nunca se muestra; añadir "despejada el …" en la lista de despejadas. **Dónde:** `mazmorras.tsx:131-135`. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-066 · Contador de mazmorras activas en la cabecera
**Qué:** el header dice solo "MAZMORRAS" (`mazmorras.tsx:86`); añadir "· N abiertas" da contexto rápido. **Dónde:** `mazmorras.tsx:85-90`. **Impacto:** 1 · **Esfuerzo:** S

### MAZ-067 · Celebración al despejar (overlay, no solo Alert)
**Qué:** despejar muestra un `Alert` de sistema (`dungeon/[id].tsx:120-123`); un overlay tipo `LevelUpOverlay` con la voz del sistema sería más acorde a la estética NIVL. **Dónde:** `dungeon/[id].tsx:120`. **Impacto:** 3 · **Esfuerzo:** M

### MAZ-068 · Haptic al completar tarea coherente con su peso
**Qué:** todas las tareas disparan el mismo `Success` haptic (`dungeon/[id].tsx:95`); un jefe podría disparar un patrón más fuerte para subrayar el hito. **Dónde:** `dungeon/[id].tsx:95`. **Impacto:** 1 · **Esfuerzo:** S

### MAZ-069 · Mostrar el multiplicador ×2 del jefe en el formulario y la fila
**Qué:** el switch dice "XP ×2" (`dungeon/[id].tsx:267`) pero la fila de la tarea no recuerda que el +XP ya incluye el ×2; aclarar en `taskMeta` o en el desglose del XP. **Dónde:** `dungeon/[id].tsx:224-230,267`. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-070 · Previsualizar el XP del botín según rango en el alta
**Qué:** al elegir rango en `mazmorras.tsx:152-159` no se ve el botín asociado (`DUNGEON_CLEAR_XP`); mostrar "botín: +N XP" bajo los chips de rango ayuda a decidir. **Dónde:** `mazmorras.tsx:152`. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-071 · Mostrar el nombre de la stat completo, no solo la sigla
**Qué:** se muestra la sigla (`d.stat`, p. ej. "INT") en meta y chips (`mazmorras.tsx:115,163`); `STAT_LABEL` existe en `game.ts:23` para mostrar "Inteligencia". Usarlo (al menos en un tooltip/secundario). **Dónde:** `mazmorras.tsx:115,162-166`, `dungeon/[id].tsx:173`. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-072 · Placeholder de chip de stat sin etiqueta legible
**Qué:** los chips de stat muestran solo la sigla (`mazmorras.tsx:165`); para alguien nuevo "PER" o "AGI" no es obvio. Mostrar etiqueta o leyenda. **Dónde:** `mazmorras.tsx:161-167`. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-073 · Indicador visual de "scroll hay más" en listas largas
**Qué:** en listas largas no hay degradado/sombra que sugiera contenido por debajo; añadir fade en el borde del `ScrollView`. **Dónde:** `mazmorras.tsx:84`, `dungeon/[id].tsx:157`. **Impacto:** 1 · **Esfuerzo:** S

### MAZ-074 · Estado "pressed" visible en las tarjetas de mazmorra
**Qué:** el `Pressable` de la tarjeta (`mazmorras.tsx:101-104`) no cambia de apariencia al pulsar; añadir feedback `pressed` como en `SystemButton`. **Dónde:** `mazmorras.tsx:101`. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-075 · Botón de reclamar botín fijo/sticky
**Qué:** "Reclamar botín" aparece al final del scroll (`dungeon/[id].tsx:236-238`); con muchas tareas hay que bajar del todo. Considerar fijarlo abajo cuando `allDone`. **Dónde:** `dungeon/[id].tsx:236`. **Impacto:** 2 · **Esfuerzo:** M

### MAZ-076 · Mensaje de "casi lo tienes" cuando falta 1 tarea
**Qué:** cuando queda 1 objetivo, un microcopy del sistema ("Un último monstruo y la mazmorra cae") motivaría; hoy no hay nada hasta completar todo. **Dónde:** `dungeon/[id].tsx:152-181`. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-077 · Resumen de dificultades/jefes en la tarjeta
**Qué:** la tarjeta no indica cuántos jefes/tareas épicas contiene; un mini-desglose ayudaría a calibrar el esfuerzo. **Dónde:** `mazmorras.tsx:110-119`. **Impacto:** 1 · **Esfuerzo:** M

### MAZ-078 · Distinguir track de la barra entre lista y detalle
**Qué:** el `trackColor="#191D3D"` está hardcodeado en dos sitios (`mazmorras.tsx:118`, `dungeon/[id].tsx:176`) en vez de un token de `theme.ts`; centralizar evita divergencias. **Dónde:** ambos + `theme.ts`. **Impacto:** 1 · **Esfuerzo:** S

### Robustez / casos límite

### MAZ-079 · Guardar contra `DUNGEON_CLEAR_XP[rank]` indefinido
**Qué:** varios accesos `DUNGEON_CLEAR_XP[d.rank]` (`mazmorras.tsx:115`, `dungeon/[id].tsx:173,237`) asumen que `rank` es válido; si una fila llega con un rango fuera de enum (datos corruptos), devuelve `undefined` y se pinta "undefined XP". Hacer fallback seguro. **Dónde:** esos accesos. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-080 · Validar `id` de ruta antes de cargar
**Qué:** `id` viene de `useLocalSearchParams` (`dungeon/[id].tsx:41`) sin validar; un id no-UUID dispararía un error de Supabase capturado solo por el `Alert`. Validar formato y mostrar un estado "mazmorra no encontrada". **Dónde:** `dungeon/[id].tsx:41,54-62`. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-081 · Manejar mazmorra borrada en otra pantalla
**Qué:** si la mazmorra se borra/abandona y se vuelve al detalle (cacheado), `fetchDungeon().single()` lanza; conviene detectar "no rows" y `router.back()` con aviso en vez de un Alert genérico. **Dónde:** `dungeon/[id].tsx:54-62`, `dungeons.ts:14-18`. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-082 · `allDone` no debería permitir reclamar si no hay tareas
**Qué:** `allDone` exige `tasks.length > 0` (`dungeon/[id].tsx:153`), correcto; pero documentar/forzar que una mazmorra sin tareas no pueda despejarse evita botín gratis si en el futuro alguien cambia la condición. Añadir test. **Dónde:** `dungeon/[id].tsx:153,236`. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-083 · Evitar reclamar botín si quedan tareas tras refrescar
**Qué:** entre que `allDone` se evalúa y se pulsa "Reclamar", otra pestaña podría haber añadido una tarea; revalidar `allDone` dentro de `claimLoot` antes de marcar `cleared`. **Dónde:** `dungeon/[id].tsx:105-131`. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-084 · Mensaje claro cuando se intenta togglear en mazmorra despejada
**Qué:** en estado `cleared`, `toggleTask` y `claimLoot` salen en silencio por el guard (`dungeon/[id].tsx:83,107`); como las filas siguen visibles, un toque no hace nada sin explicación. Deshabilitar visualmente las filas si `status !== 'active'`. **Dónde:** `dungeon/[id].tsx:198,83`. **Impacto:** 3 · **Esfuerzo:** S

### MAZ-085 · Confirmar antes de marcar una tarea épica/jefe
**Qué:** una tarea épica vale 250 XP (×2 si jefe = 500) y al marcarla no hay vuelta atrás (CRIT-MAZ-06); para tareas de alto valor, pedir confirmación reduce mistaps costosos. **Dónde:** `dungeon/[id].tsx:82-103`. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-086 · Doble-borrado de tarea por long-press repetido
**Qué:** `deleteTask` no tiene guard de reentrada (`dungeon/[id].tsx:206-211`); dos long-press rápidos sobre la misma fila podrían disparar dos borrados (el segundo falla en BD, pero genera un Alert confuso). Deshabilitar/guardar mientras borra. **Dónde:** `dungeon/[id].tsx:206`. **Impacto:** 1 · **Esfuerzo:** S

### MAZ-087 · `removeDungeon` no usa `busy` (doble confirmación posible)
**Qué:** el flujo de borrar mazmorra (`dungeon/[id].tsx:133-146`) no participa del lock `busy`; tocar la papelera mientras se otorga XP por una tarea podría solapar operaciones. Encadenarlo al mismo lock. **Dónde:** `dungeon/[id].tsx:133,165`. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-088 · Comportamiento ante título duplicado de mazmorra
**Qué:** nada impide dos mazmorras con el mismo título; no es un bug pero genera confusión en lista y agenda. Avisar suavemente o permitirlo a propósito. **Dónde:** `mazmorras.tsx:64-77`. **Impacto:** 1 · **Esfuerzo:** S

### MAZ-089 · Manejar `position` nula/negativa de datos heredados
**Qué:** aunque el default es 0, si llegan filas con `position` inconsistente el orden se rompe; normalizar al cargar (`fetchTasks`) o mostrar por `created_at` como respaldo. **Dónde:** `dungeons.ts:43-51`. **Impacto:** 1 · **Esfuerzo:** S

### MAZ-090 · Evitar parpadeo del estado vacío en el detalle al recargar
**Qué:** tras `toggleTask`→`load`, durante el re-fetch `tasks` no se vacía (bien), pero si `load` falla a medias podría quedar inconsistente; envolver el set de estado para que tareas y dungeon se actualicen juntos. **Dónde:** `dungeon/[id].tsx:54-62,97`. **Impacto:** 1 · **Esfuerzo:** S

### Consistencia con el resto de la app

### MAZ-091 · Reutilizar un componente de bottom-sheet común
**Qué:** el modal/sheet se duplica casi idéntico en `mazmorras.tsx:140-178`, `dungeon/[id].tsx:241-279` y `agenda.tsx:179-212` (mismos estilos `backdrop/sheet`). Extraer un `BottomSheet` reutilizable reduce divergencias (incluido el fix de teclado). **Dónde:** los tres. **Impacto:** 3 · **Esfuerzo:** M

### MAZ-092 · Reutilizar un `ChipGroup` para rango/stat/dificultad
**Qué:** los grupos de chips se repiten en `mazmorras.tsx:153-167` y `dungeon/[id].tsx:253-265` con estilos calcados; un componente común unificaría estilo y accesibilidad. **Dónde:** ambos. **Impacto:** 2 · **Esfuerzo:** M

### MAZ-093 · Centralizar estilos de formulario/sheet en el design system
**Qué:** `label`, `input`, `chip`, `sheetTitle` están duplicados literalmente en mazmorras, detalle y agenda; moverlos a estilos compartidos. **Dónde:** bloques `StyleSheet` de los tres. **Impacto:** 2 · **Esfuerzo:** M

### MAZ-094 · Tipar el `select` del conteo en vez de cast manual
**Qué:** `as { dungeon_id: string; done: boolean }[]` (`mazmorras.tsx:45`) es un cast a mano; usar un tipo derivado o el row de `DungeonTask` reduce el riesgo de drift con el esquema. **Dónde:** `mazmorras.tsx:44-45`. **Impacto:** 1 · **Esfuerzo:** S

### MAZ-095 · Mover el conteo de tareas a `dungeons.ts`
**Qué:** la query de conteo vive inline en la pantalla (`mazmorras.tsx:44`) saltándose la capa de datos (todas las demás llamadas pasan por `dungeons.ts`); extraer `fetchDungeonsWithProgress()`. **Dónde:** `mazmorras.tsx:41-56` → `dungeons.ts`. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-096 · Unificar el patrón de carga (`useFocusEffect` vs `useEffect`)
**Qué:** la lista usa `useFocusEffect` (`mazmorras.tsx:58`) pero el detalle usa `useEffect` (`dungeon/[id].tsx:64`); al volver de un segundo plano el detalle puede quedar desactualizado. Unificar a `useFocusEffect`. **Dónde:** `dungeon/[id].tsx:64-66`. **Impacto:** 3 · **Esfuerzo:** S

### MAZ-097 · Coherencia de copy "objetivos" vs "tareas/monstruos/jefes"
**Qué:** la UI mezcla "objetivos" (`dungeon/[id].tsx:185`), "monstruos (tareas) y jefes (hitos)" (`mazmorras.tsx:95-96`) y "OBJETIVO" en el modal (`dungeon/[id].tsx:244`); fijar un vocabulario consistente con la metáfora Solo Leveling. **Dónde:** copys de ambos. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-098 · Voz del sistema en los estados vacíos
**Qué:** los textos vacíos son descriptivos pero neutros (`mazmorras.tsx:94-97`, `dungeon/[id].tsx:193-194`); pasarlos por la "voz del sistema" (`voice.ts`) los haría coherentes con el tono del resto. **Dónde:** ambos estados vacíos. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-099 · Aviso de error con la voz del sistema en vez de "Fallo desconocido"
**Qué:** todos los catch muestran "Fallo desconocido" (`mazmorras.tsx:54`, `dungeon/[id].tsx:60,99,127`); un copy de sistema ("El sistema ha perdido el enlace…") sería más inmersivo. **Dónde:** esos catch. **Impacto:** 1 · **Esfuerzo:** S

### MAZ-100 · Usar `colors`/`fonts` tokens en lugar de literales hex
**Qué:** colores literales repartidos: `#191D3D` (`mazmorras.tsx:118,252`; `dungeon/[id].tsx:176,332,369`), `#15182E` (`dungeon/[id].tsx:322`), `#A697F0` (`dungeon/[id].tsx:314`). Promoverlos a `theme.ts`. **Dónde:** esos estilos. **Impacto:** 2 · **Esfuerzo:** S

### Tests

### MAZ-101 · Test del cálculo de `position` al crear tras borrar
**Qué:** cubrir el escenario de CRIT-MAZ-01 (borrar del medio + añadir) para garantizar posiciones únicas y orden estable. **Dónde:** lógica extraída de `dungeon/[id].tsx:68-80`. **Impacto:** 3 · **Esfuerzo:** M

### MAZ-102 · Test del ratio de progreso (0 tareas, todas hechas, mixto)
**Qué:** verificar que `done/tasks.length` y los guards `tasks.length>0` (`dungeon/[id].tsx:153,176`; `mazmorras.tsx:118`) no producen `NaN` ni >1. **Dónde:** helper de progreso. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-103 · Test del guard de doble-XP en `toggleTask`
**Qué:** simular doble invocación concurrente y comprobar que solo se otorga XP una vez (tras aplicar CRIT-MAZ-02). **Dónde:** `dungeon/[id].tsx:82-103`. **Impacto:** 3 · **Esfuerzo:** M

### MAZ-104 · Test del guard de status en `claimLoot`
**Qué:** asegurar que reclamar dos veces (o sobre `cleared`) no duplica botín (`dungeon/[id].tsx:107`); ya hay guard, falta el test que lo fije. **Dónde:** `dungeon/[id].tsx:105-131`. **Impacto:** 3 · **Esfuerzo:** M

### MAZ-105 · Test de `dungeonTaskXp` con jefe (×2) por dificultad
**Qué:** parametrizar `dungeonTaskXp` (`game.ts:109-111`) para todas las dificultades con/sin jefe; protege la economía mostrada en `dungeon/[id].tsx:229,237`. **Dónde:** `game.ts:109`. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-106 · Test del agregado de conteo (sustituto del doble filter)
**Qué:** al implementar el agregado (CRIT-MAZ-05), test de que `total`/`doneCount` por mazmorra coinciden con las filas. **Dónde:** nuevo helper en `dungeons.ts`. **Impacto:** 2 · **Esfuerzo:** S

### MAZ-107 · Test de filtrado activo/despejado
**Qué:** verificar `active`/`cleared` (`mazmorras.tsx:79-80`) y que `abandoned` (cuando se implemente MAZ-021) no aparezca en ninguna de las dos. **Dónde:** `mazmorras.tsx:79`. **Impacto:** 1 · **Esfuerzo:** S

### Features mayores

### MAZ-108 · Dependencias entre tareas (desbloqueo secuencial)
**Qué:** marcar tareas como "bloqueadas hasta completar X"; refuerza la planificación de un proyecto. Requiere columna y UI. **Dónde:** `dungeon/[id].tsx` + migración. **Impacto:** 3 · **Esfuerzo:** L

### MAZ-109 · Progreso por fases/capítulos dentro de la mazmorra
**Qué:** agrupar tareas en secciones (p. ej. "Capítulo 1") con su propia barra; útil para mazmorras grandes (TFG). **Dónde:** `dungeon/[id].tsx` + esquema. **Impacto:** 3 · **Esfuerzo:** L

### MAZ-110 · Notas/descripción por tarea
**Qué:** las tareas solo tienen título; un campo de notas permitiría guardar contexto. Requiere columna nueva. **Dónde:** `dungeon_tasks` + `dungeon/[id].tsx`. **Impacto:** 2 · **Esfuerzo:** M

### MAZ-111 · Adjuntar evidencia al completar una tarea de mazmorra
**Qué:** las misiones admiten evidencia (bucket `evidence`); las tareas de mazmorra no. Permitir foto opcional reforzaría hitos importantes. **Dónde:** `dungeon/[id].tsx:82-103`, reutilizando `uploadEvidence`. **Impacto:** 2 · **Esfuerzo:** L

### MAZ-112 · Búsqueda/filtro de mazmorras
**Qué:** con muchas mazmorras no hay forma de buscar; añadir filtro por texto/rango/stat. **Dónde:** `mazmorras.tsx:84-126`. **Impacto:** 2 · **Esfuerzo:** M

### MAZ-113 · Ordenar la lista de mazmorras (por deadline, rango, progreso)
**Qué:** el orden viene fijo del servidor (status + created_at, `dungeons.ts:8-9`); ofrecer al usuario ordenar por proximidad de deadline o progreso. **Dónde:** `mazmorras.tsx:79`, `dungeons.ts:4-12`. **Impacto:** 2 · **Esfuerzo:** M

### MAZ-114 · Vista de "siguiente acción" por mazmorra
**Qué:** mostrar en la tarjeta la próxima tarea pendiente (la de menor `position` sin hacer) para reducir fricción de entrada. **Dónde:** `mazmorras.tsx:110-119`. **Impacto:** 3 · **Esfuerzo:** M

### MAZ-115 · Archivar despejadas antiguas
**Qué:** la lista de despejadas crece sin límite (`mazmorras.tsx:128-137`); permitir archivar/ocultar las antiguas. **Dónde:** `mazmorras.tsx:128`. **Impacto:** 1 · **Esfuerzo:** M

### MAZ-116 · Recordatorios/notificaciones por deadline de tarea
**Qué:** con `due_date` (MAZ-001) y el módulo `notifications.ts`, programar avisos antes del vencimiento. **Dónde:** integración `dungeon/[id].tsx` + `notifications.ts`. **Impacto:** 3 · **Esfuerzo:** L

### MAZ-117 · Mostrar racha/tiempo dedicado a la mazmorra
**Qué:** indicar desde cuándo está abierta (`created_at`) y cuánto lleva sin progreso, para detectar mazmorras estancadas. **Dónde:** `dungeon/[id].tsx:170-181`. **Impacto:** 2 · **Esfuerzo:** M

### MAZ-118 · Marcar "en progreso" una tarea (estado intermedio)
**Qué:** hoy una tarea es hecho/no hecho; un estado "en curso" ayudaría a señalar en qué se está trabajando. Requiere columna o flag. **Dónde:** `dungeon_tasks` + `dungeon/[id].tsx`. **Impacto:** 2 · **Esfuerzo:** M

### MAZ-119 · Compartir la mazmorra despejada (tarjeta)
**Qué:** `perfil.tsx` ya genera tarjetas compartibles (`shareRef`); al despejar una mazmorra ofrecer una tarjeta "Mazmorra rango X despejada". **Dónde:** `dungeon/[id].tsx:120` + patrón de `perfil.tsx`. **Impacto:** 2 · **Esfuerzo:** L

### MAZ-120 · Estimación de fecha de despeje según ritmo
**Qué:** con tareas hechas/fecha, proyectar cuándo se despejaría al ritmo actual; refuerza la planificación. **Dónde:** `dungeon/[id].tsx`. **Impacto:** 1 · **Esfuerzo:** L

---

Total: 120 mejoras, 6 bugs.
