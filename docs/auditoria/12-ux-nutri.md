# UX/UI Dieta y compra

> Área NUT · auditoría de código NIVL · anclada al código real
> Archivos: `src/app/dieta.tsx`, `src/app/compra.tsx`, capa de datos `src/lib/body.ts`, esquema `supabase/migrations/0002_fases.sql`.

## Bugs y riesgos

### CRIT-NUT-01 · `meal_slots` sin unicidad → comidas duplicadas invisibles — `supabase/migrations/0002_fases.sql:87-94` + `dieta.tsx:64-75` · severidad alta
**Problema:** La tabla `meal_slots` NO tiene restricción única sobre `(user_id, day_of_week, slot)`. `upsertMealSlot` (body.ts:118-138) solo hace `UPDATE` si recibe `input.id`; en cualquier otro caso hace `INSERT`. `save()` pasa `id: editing.existing?.id`, así que el camino feliz funciona, PERO si dos guardados se solapan (foco que recarga entre `openEditor` y `save`, o un `load()` que aún no llegó), `editing.existing` puede ser `null` y se inserta una segunda fila para el mismo slot/día. A partir de ahí `daySlots.find((s) => s.slot === slotName)` (dieta.tsx:58,129) solo muestra/edita la PRIMERA fila; la duplicada queda huérfana, invisible y contaminando la lista de la compra para siempre. **Arreglo:** en migración 0004 `alter table meal_slots add constraint meal_slots_uniq unique (user_id, day_of_week, slot);` y cambiar `upsertMealSlot` a un `upsert(..., { onConflict: 'user_id,day_of_week,slot' })` que no dependa del `id` del cliente.

### CRIT-NUT-02 · "Generar lista" re-inserta duplicados en cada pulsación — `dieta.tsx:84-104` + `body.ts:156-165` · severidad alta
**Problema:** `generateList` llama a `ingredientsFromPlan(slots)` (que solo deduplica entre sí) y luego `addShoppingItems` hace un `INSERT` directo sin mirar lo que ya hay en `shopping_items`. Pulsar el botón dos veces (o una vez por semana) duplica todos los ingredientes en la lista. No hay clave única en `shopping_items (user_id, name)` ni comprobación previa. El usuario verá "pollo" 3 veces. **Arreglo:** antes de insertar, traer la lista pendiente y filtrar por nombre normalizado (`toLowerCase().trim()`); o `upsert` con `onConflict` sobre una columna única; informar "X nuevos, Y ya estaban".

### CRIT-NUT-03 · Escrituras sin try/catch: el fallo es silencioso o crashea — `dieta.tsx:64-82`, `compra.tsx:32-47` · severidad alta
**Problema:** Solo `load()` envuelve el error en `Alert`. `save`, `removeSlot` (dieta.tsx:64-82) y `add`, `toggle`, `clearDone` (compra.tsx:32-47) hacen `await` directo sobre Supabase sin `try/catch`. Si la red falla o RLS rechaza, la promesa se rechaza sin manejar: en React Native eso es un *unhandled promise rejection* y el usuario no recibe NINGÚN feedback — cree que guardó cuando no lo hizo. En `save` además el modal se cierra (`setEditing(null)` en línea 73) aunque el upsert haya lanzado, perdiendo lo escrito. **Arreglo:** envolver cada escritura en `try { … } catch (e) { Alert.alert('Error del sistema', …) }` y solo cerrar el modal / limpiar input dentro del `try` tras el éxito.

### CRIT-NUT-04 · `generateList` con `try/finally` pero sin `catch` — `dieta.tsx:94-104` · severidad media
**Problema:** El bloque usa `try { await addShoppingItems… } finally { setBusy(false) }`. El `finally` rearma el botón, pero si `addShoppingItems` lanza, no hay `catch`: rejection sin manejar, el `Alert` de "Lista generada" no se muestra y tampoco un error. El usuario ve el botón "des-cargarse" sin explicación. **Arreglo:** añadir `catch (e) { Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo'); }` antes del `finally`.

### CRIT-NUT-05 · Doble pulsación de "Guardar" inserta dos comidas — `dieta.tsx:64-75,182` · severidad media
**Problema:** `save()` no tiene cerrojo (`busy`/`useRef`) ni el `SystemButton` de Guardar pasa `loading`. `upsertMealSlot` es asíncrono; un segundo toque antes de que `setEditing(null)` re-renderice dispara un segundo upsert. Como `editing.existing` aún es `null` para un slot nuevo, se crean DOS filas (agravado por CRIT-NUT-01, sin unicidad). **Arreglo:** cerrojo síncrono con `useRef` igual que en `index.tsx`/`diario.tsx`; deshabilitar el botón mientras se guarda y mostrar `loading`.

### CRIT-NUT-06 · `toggle` optimista sin rollback ni resync — `compra.tsx:39-42` · severidad media
**Problema:** `toggle` muta el estado local y luego `await setShoppingDone`. Si la escritura falla, el ítem queda marcado en la UI pero NO en la base; al recargar revierte sin avisar, y el usuario cree que lo compró. Además, como no hay `useFocusEffect` (ver CRIT-NUT-07), el reordenamiento pendiente/comprado no se refleja hasta salir y entrar. **Arreglo:** `try { await setShoppingDone(...) } catch { revertir el optimista y avisar }`; opcionalmente recargar tras éxito para reordenar.

### CRIT-NUT-07 · Sin `useFocusEffect`: datos obsoletos al volver a la pantalla — `dieta.tsx:51-53`, `compra.tsx:28-30` · severidad media
**Problema:** Ambas pantallas cargan con `useEffect(() => { load() }, [load])`, que solo corre al montar. TODAS las pantallas vecinas (index, misiones, mazmorras, agenda, perfil, diario, informe) ya migraron a `useFocusEffect` (confirmado en informe.tsx:32-36). Flujo roto real: en dieta pulsas "Generar lista" → navegas a `/compra` con `router.push` (dieta.tsx:98) → la pantalla compra ya estaba montada en el stack, su `useEffect` NO vuelve a correr, y los ingredientes recién generados NO aparecen hasta cerrar y reabrir. Lo mismo al editar comidas y volver. **Arreglo:** sustituir `useEffect` por `useFocusEffect(useCallback(() => { load() }, [load]))` en ambas, importando de `expo-router`.

### CRIT-NUT-08 · `qty` se pierde en la columna "EN EL CARRO" — `compra.tsx:97-103` · severidad baja
**Problema:** En la lista PENDIENTE se renderiza `{i.qty ? <Text>{i.qty}</Text> : null}` (línea 87), pero al marcar el ítem y moverlo a "EN EL CARRO" (líneas 97-103) NO se pinta `qty`. La cantidad desaparece justo cuando el usuario está en la tienda decidiendo cuánto coger. **Arreglo:** replicar el `{i.qty ? … : null}` en la fila de comprados; o mejor, factorizar una sola fila reutilizable que reciba `done`.

## Mejoras

### NUT-001 · Migrar dieta a `useFocusEffect`
**Qué:** Recargar slots al enfocar para reflejar cambios hechos en otra pantalla. **Dónde:** `dieta.tsx:51-53` · **Impacto:** 4 · **Esfuerzo:** S

### NUT-002 · Migrar compra a `useFocusEffect`
**Qué:** La lista debe refrescarse al volver tras "Generar lista" o cambiar de pestaña. **Dónde:** `compra.tsx:28-30` · **Impacto:** 4 · **Esfuerzo:** S

### NUT-003 · `try/catch` en `save`
**Qué:** Atrapar errores de upsert y avisar sin cerrar el modal. **Dónde:** `dieta.tsx:64-75` · **Impacto:** 4 · **Esfuerzo:** S

### NUT-004 · `try/catch` en `removeSlot`
**Qué:** Avisar si falla el borrado de comida. **Dónde:** `dieta.tsx:77-82` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-005 · `try/catch` en `add` (compra)
**Qué:** No perder el texto del artículo si el insert falla. **Dónde:** `compra.tsx:32-37` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-006 · `try/catch` + rollback en `toggle`
**Qué:** Revertir el optimista si `setShoppingDone` lanza. **Dónde:** `compra.tsx:39-42` · **Impacto:** 4 · **Esfuerzo:** S

### NUT-007 · `try/catch` en `clearDone`
**Qué:** Avisar si el `DELETE` de comprados falla. **Dónde:** `compra.tsx:44-47` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-008 · `catch` en `generateList`
**Qué:** Completar el `try/finally` con un `catch` que muestre el error. **Dónde:** `dieta.tsx:94-104` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-009 · Cerrojo `useRef` en `save`
**Qué:** Evitar doble inserción por doble toque de Guardar. **Dónde:** `dieta.tsx:64` · **Impacto:** 4 · **Esfuerzo:** S

### NUT-010 · `loading` en el botón Guardar
**Qué:** Pasar `loading` al `SystemButton` durante el upsert para feedback. **Dónde:** `dieta.tsx:182` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-011 · Dedup contra la lista existente al generar
**Qué:** Filtrar ingredientes ya presentes en `shopping_items` antes de insertar. **Dónde:** `dieta.tsx:84-104` · **Impacto:** 5 · **Esfuerzo:** M

### NUT-012 · Restricción única en `meal_slots`
**Qué:** `unique (user_id, day_of_week, slot)` para impedir comidas duplicadas. **Dónde:** `supabase/migrations/0002_fases.sql:87` · **Impacto:** 5 · **Esfuerzo:** S

### NUT-013 · `upsert` real en `upsertMealSlot`
**Qué:** Usar `onConflict` en vez de depender del `id` del cliente. **Dónde:** `body.ts:118-138` · **Impacto:** 4 · **Esfuerzo:** M

### NUT-014 · Mostrar `qty` también en "EN EL CARRO"
**Qué:** Pintar la cantidad en la fila de comprados. **Dónde:** `compra.tsx:97-103` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-015 · Campo de cantidad al añadir artículo
**Qué:** La columna `qty` existe en el esquema y el tipo, pero NO hay UI para introducirla. **Dónde:** `compra.tsx:63-76` · **Impacto:** 4 · **Esfuerzo:** M

### NUT-016 · Macros y calorías por comida
**Qué:** Añadir kcal/proteína/carbos/grasa al `MealSlot` y mostrarlos en la fila. **Dónde:** `dieta.tsx:128-151`, `types.ts:126-133` · **Impacto:** 5 · **Esfuerzo:** L

### NUT-017 · Total de macros del día
**Qué:** Sumatorio de kcal y macros bajo los chips de día. **Dónde:** `dieta.tsx:119-151` · **Impacto:** 4 · **Esfuerzo:** M

### NUT-018 · Objetivo diario de calorías con barra de progreso
**Qué:** Comparar total del día contra una meta configurable. **Dónde:** `dieta.tsx:127-151` · **Impacto:** 4 · **Esfuerzo:** L

### NUT-019 · Agrupar la compra por pasillos
**Qué:** Categoría (fruta, lácteos, congelados…) y secciones plegables. **Dónde:** `compra.tsx:78-91`, `types.ts:135-142` · **Impacto:** 5 · **Esfuerzo:** L

### NUT-020 · Inferir pasillo del ingrediente
**Qué:** Diccionario nombre→categoría al generar desde la dieta. **Dónde:** `body.ts:178-193` · **Impacto:** 3 · **Esfuerzo:** M

### NUT-021 · Copiar un día completo a otro
**Qué:** Botón "copiar día" que clone los slots de un día a otro. **Dónde:** `dieta.tsx:119-151` · **Impacto:** 5 · **Esfuerzo:** M

### NUT-022 · Copiar toda la semana (plantilla)
**Qué:** Guardar/restaurar una semana entera como plantilla. **Dónde:** `dieta.tsx:36`, `body.ts:109-138` · **Impacto:** 4 · **Esfuerzo:** L

### NUT-023 · Recetario reutilizable
**Qué:** Guardar comidas frecuentes y reinsertarlas con un toque. **Dónde:** `dieta.tsx:57-62` · **Impacto:** 5 · **Esfuerzo:** L

### NUT-024 · Autocompletar comida desde recetario
**Qué:** Al abrir el editor, sugerir recetas guardadas que casen. **Dónde:** `dieta.tsx:166-172` · **Impacto:** 3 · **Esfuerzo:** M

### NUT-025 · Marcar comprado con gesto de swipe
**Qué:** Deslizar la fila para marcar/desmarcar en vez de tocar el check. **Dónde:** `compra.tsx:83-104` · **Impacto:** 4 · **Esfuerzo:** M

### NUT-026 · Swipe para borrar un artículo suelto
**Qué:** Deslizar a la izquierda para eliminar un ítem concreto. **Dónde:** `compra.tsx:83-89` · **Impacto:** 3 · **Esfuerzo:** M

### NUT-027 · Borrar artículo individual
**Qué:** Hoy solo existe "Vaciar comprados"; falta eliminar uno pendiente. **Dónde:** `compra.tsx:83-89`, `body.ts:167-175` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-028 · Sección de hidratación
**Qué:** Contador de vasos/litros de agua del día. **Dónde:** `dieta.tsx:127-151` · **Impacto:** 3 · **Esfuerzo:** M

### NUT-029 · Recordatorio de hidratación
**Qué:** Notificación periódica para beber agua (via notifications.ts). **Dónde:** `dieta.tsx` (nueva sección) · **Impacto:** 2 · **Esfuerzo:** M

### NUT-030 · Modo batch cooking
**Qué:** Marcar comidas como "cocinadas en lote" y agrupar su preparación. **Dónde:** `dieta.tsx:128-151`, `types.ts:126-133` · **Impacto:** 3 · **Esfuerzo:** L

### NUT-031 · Lista de preparación (prep list) semanal
**Qué:** Derivar tareas de cocina de toda la semana, no solo ingredientes. **Dónde:** `body.ts:178-193` · **Impacto:** 3 · **Esfuerzo:** L

### NUT-032 · Cantidades agregadas al generar lista
**Qué:** Sumar "2x huevo" cuando el ingrediente aparece en varios días. **Dónde:** `body.ts:178-193` · **Impacto:** 4 · **Esfuerzo:** M

### NUT-033 · Parser de cantidades en ingredientes
**Qué:** Reconocer "200g arroz" y separar cantidad de nombre. **Dónde:** `body.ts:181-191` · **Impacto:** 4 · **Esfuerzo:** M

### NUT-034 · Normalizar ingrediente a singular/minúsculas
**Qué:** "Tomates" y "tomate" hoy se tratan como distintos. **Dónde:** `body.ts:185-188` · **Impacto:** 3 · **Esfuerzo:** M

### NUT-035 · Quitar acentos en el dedup
**Qué:** "brócoli"/"brocoli" deberían colapsar. **Dónde:** `body.ts:185` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-036 · Vista de lista de la compra ordenable
**Qué:** Permitir reordenar manualmente (drag) los pendientes. **Dónde:** `compra.tsx:78-91` · **Impacto:** 2 · **Esfuerzo:** L

### NUT-037 · Buscador/filtro en lista larga
**Qué:** Campo de filtro cuando hay muchos artículos. **Dónde:** `compra.tsx:63-91` · **Impacto:** 2 · **Esfuerzo:** M

### NUT-038 · Contador de progreso de la compra
**Qué:** "12/20 comprados" con barra. **Dónde:** `compra.tsx:49-50,79` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-039 · Empty state de dieta más rico
**Qué:** Cuando el día no tiene comidas, mostrar CTA y plantillas. **Dónde:** `dieta.tsx:143-145` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-040 · Indicador de día con plan completo
**Qué:** Marcar el chip del día si tiene todas las comidas. **Dónde:** `dieta.tsx:119-125` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-041 · Resaltar el día actual en los chips
**Qué:** El día de hoy debería distinguirse del seleccionado. **Dónde:** `dieta.tsx:119-125` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-042 · `accessibilityRole="button"` en chips de día
**Qué:** Los `Pressable` de día no anuncian rol ni estado. **Dónde:** `dieta.tsx:121` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-043 · `accessibilityState={{ selected }}` en chip activo
**Qué:** Lector de pantalla debe saber qué día está seleccionado. **Dónde:** `dieta.tsx:121-123` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-044 · `accessibilityLabel` con día completo
**Qué:** "L" no se entiende por voz; usar "Lunes". **Dónde:** `dieta.tsx:122` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-045 · `accessibilityRole="checkbox"` en filas de compra
**Qué:** Cada artículo es un check; anunciar rol y `checked`. **Dónde:** `compra.tsx:84,98` · **Impacto:** 4 · **Esfuerzo:** S

### NUT-046 · `accessibilityLabel` en botón "+" de añadir
**Qué:** El icono `add` sin etiqueta no se lee. **Dónde:** `compra.tsx:73-75` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-047 · `accessibilityLabel` en botones de cabecera (back/cart)
**Qué:** `chevron-back` y `cart-outline` sin etiqueta. **Dónde:** `dieta.tsx:110-116`, `compra.tsx:56-58` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-048 · `accessibilityRole="header"` en títulos
**Qué:** "DIETA SEMANAL"/"LISTA DE LA COMPRA" deberían ser headers. **Dónde:** `dieta.tsx:113`, `compra.tsx:59` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-049 · Tamaño táctil mínimo en filas de comida
**Qué:** Garantizar 44px de alto en `mealRow`. **Dónde:** `dieta.tsx:215-222` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-050 · `hitSlop` en el check de la lista
**Qué:** El cuadro de 18px es pequeño; ampliar zona táctil. **Dónde:** `compra.tsx:84,158-165` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-051 · Feedback `pressed` en `mealRow`
**Qué:** La fila de comida no cambia de opacidad al tocar. **Dónde:** `dieta.tsx:131` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-052 · Feedback `pressed` en filas de compra
**Qué:** Igual para las filas de artículos. **Dónde:** `compra.tsx:84,98` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-053 · Feedback `pressed` en botón "+"
**Qué:** El `addButton` no reacciona visualmente. **Dónde:** `compra.tsx:73-75,136-141` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-054 · `KeyboardAvoidingView` en el editor de dieta
**Qué:** El bottom sheet puede quedar tapado por el teclado en iOS. **Dónde:** `dieta.tsx:159-189` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-055 · `keyboardShouldPersistTaps` en el sheet
**Qué:** Tocar Guardar con teclado abierto puede requerir doble toque. **Dónde:** `dieta.tsx:159-189` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-056 · Autofocus al campo "Comida" al abrir editor
**Qué:** Enfocar el `TextInput` para escribir directo. **Dónde:** `dieta.tsx:166-172` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-057 · `returnKeyType`/`onSubmitEditing` en campo Comida
**Qué:** Saltar a ingredientes al pulsar siguiente. **Dónde:** `dieta.tsx:166-172` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-058 · `maxLength` en descripción de comida
**Qué:** Evitar textos enormes que rompan el layout. **Dónde:** `dieta.tsx:166-172` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-059 · `maxLength` en artículo de compra
**Qué:** Limitar el nombre del artículo. **Dónde:** `compra.tsx:64-72` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-060 · Trim consistente al añadir artículo
**Qué:** Ya hace `.trim()`, pero colapsar espacios internos. **Dónde:** `compra.tsx:34` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-061 · Evitar artículo duplicado al añadir a mano
**Qué:** Si "pan" ya está pendiente, avisar en vez de duplicar. **Dónde:** `compra.tsx:32-37` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-062 · Confirmar antes de "Vaciar comprados"
**Qué:** `clearDone` borra sin confirmación; añadir `Alert`. **Dónde:** `compra.tsx:44-47,106` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-063 · Confirmar antes de eliminar comida
**Qué:** `removeSlot` borra directo; pedir confirmación. **Dónde:** `dieta.tsx:77-82,184` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-064 · Deshacer (undo) tras vaciar comprados
**Qué:** Snackbar con "deshacer" en vez de borrado inmediato. **Dónde:** `compra.tsx:44-47` · **Impacto:** 3 · **Esfuerzo:** M

### NUT-065 · `qty` editable desde la fila
**Qué:** Toque largo o icono para fijar cantidad de un artículo. **Dónde:** `compra.tsx:83-89` · **Impacto:** 3 · **Esfuerzo:** M

### NUT-066 · Persistir colapso de la sección "EN EL CARRO"
**Qué:** Poder plegar/desplegar y recordar el estado. **Dónde:** `compra.tsx:93-105` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-067 · `ScrollView` → `FlatList` en compra
**Qué:** Listas largas deberían virtualizar. **Dónde:** `compra.tsx:54,83-104` · **Impacto:** 3 · **Esfuerzo:** M

### NUT-068 · Memoizar `pending`/`done`
**Qué:** Calcular con `useMemo` para no filtrar en cada render. **Dónde:** `compra.tsx:49-50` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-069 · Memoizar `daySlots`
**Qué:** `slots.filter` corre en cada render de dieta. **Dónde:** `dieta.tsx:55` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-070 · Índice por slot para evitar `find` repetidos
**Qué:** `daySlots.find` se llama por cada `MEAL_SLOTS` en el render. **Dónde:** `dieta.tsx:128-129` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-071 · Mover `DAY_CHIPS`/labels a constante compartida
**Qué:** `['L','M','X','J','V','S','D']` está duplicado (línea 30 y 163). **Dónde:** `dieta.tsx:30,163` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-072 · Extraer componente `ShoppingRow`
**Qué:** Filas pendiente/comprado comparten estructura; unificar. **Dónde:** `compra.tsx:83-104` · **Impacto:** 2 · **Esfuerzo:** M

### NUT-073 · Extraer componente `MealRow`
**Qué:** Aislar la fila de comida para test y reuso. **Dónde:** `dieta.tsx:128-151` · **Impacto:** 2 · **Esfuerzo:** M

### NUT-074 · Extraer `DayChips` reutilizable
**Qué:** Los chips L-D se usarán también en gym/agenda. **Dónde:** `dieta.tsx:119-125` · **Impacto:** 2 · **Esfuerzo:** M

### NUT-075 · Test unitario de `ingredientsFromPlan`
**Qué:** No hay test del dedup ni del split por `,;\n`. **Dónde:** `body.ts:178-193` · **Impacto:** 4 · **Esfuerzo:** S

### NUT-076 · Test: dedup case-insensitive
**Qué:** Verificar que "Pollo"/"pollo" colapsan. **Dónde:** `body.ts:185-186` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-077 · Test: ingredientes vacíos/espacios
**Qué:** "a,,b" no debe producir un ítem vacío. **Dónde:** `body.ts:183-188` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-078 · Test: `upsertMealSlot` update vs insert
**Qué:** Cubrir ambos caminos según presencia de `id`. **Dónde:** `body.ts:118-138` · **Impacto:** 3 · **Esfuerzo:** M

### NUT-079 · Test del orden de `fetchShoppingItems`
**Qué:** Garantizar pendientes primero, luego por fecha desc. **Dónde:** `body.ts:146-154` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-080 · Spinner de carga inicial en dieta
**Qué:** No hay indicador mientras `fetchMealSlots` resuelve. **Dónde:** `dieta.tsx:43-49,107` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-081 · Spinner de carga inicial en compra
**Qué:** Lista aparece vacía un instante antes de cargar. **Dónde:** `compra.tsx:20-26,52` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-082 · Distinguir "cargando" de "vacío" en compra
**Qué:** El empty state se muestra también durante la carga. **Dónde:** `compra.tsx:80-81` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-083 · Pull-to-refresh en compra
**Qué:** `RefreshControl` para recargar manualmente. **Dónde:** `compra.tsx:54` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-084 · Pull-to-refresh en dieta
**Qué:** Igual para la pantalla de dieta. **Dónde:** `dieta.tsx:108` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-085 · Estado de guardado en el botón "Generar lista"
**Qué:** Ya usa `loading`, pero deshabilitar también si no hay ingredientes. **Dónde:** `dieta.tsx:153` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-086 · Mostrar nº de ingredientes que se generarán
**Qué:** Previsualizar "12 ingredientes" antes de pulsar. **Dónde:** `dieta.tsx:153-156` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-087 · Resumen de comidas planificadas por semana
**Qué:** "5/35 comidas planificadas" en cabecera. **Dónde:** `dieta.tsx:109-117` · **Impacto:** 3 · **Esfuerzo:** M

### NUT-088 · Tag visual cuando una comida tiene ingredientes
**Qué:** Icono/insignia si el slot aportará a la compra. **Dónde:** `dieta.tsx:137-141` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-089 · Vista previa multilínea de ingredientes
**Qué:** Hoy `numberOfLines={1}` corta; permitir expandir. **Dónde:** `dieta.tsx:138` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-090 · Editor: contador de ingredientes detectados
**Qué:** Mostrar en vivo "3 ingredientes" según comas. **Dónde:** `dieta.tsx:173-181` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-091 · Chips de ingredientes en el editor
**Qué:** Convertir la cadena en chips borrables en vez de texto plano. **Dónde:** `dieta.tsx:173-181` · **Impacto:** 4 · **Esfuerzo:** L

### NUT-092 · Sugerir ingredientes ya usados
**Qué:** Autocompletar con ingredientes de otras comidas. **Dónde:** `dieta.tsx:174-180` · **Impacto:** 3 · **Esfuerzo:** M

### NUT-093 · Persistir el día seleccionado entre sesiones
**Qué:** Recordar el último día visto al volver. **Dónde:** `dieta.tsx:37` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-094 · Saltar al día de hoy con un botón
**Qué:** Atajo "Hoy" si el usuario navegó a otro día. **Dónde:** `dieta.tsx:119-125` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-095 · Navegación entre días con swipe horizontal
**Qué:** Deslizar el panel para cambiar de día. **Dónde:** `dieta.tsx:127-151` · **Impacto:** 3 · **Esfuerzo:** M

### NUT-096 · Texto del hint coherente con el comportamiento
**Qué:** El hint dice "elimina duplicados" pero re-genera duplicados en la lista (ver CRIT-NUT-02). **Dónde:** `dieta.tsx:154-156` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-097 · Botón directo "Ir a la compra" más visible
**Qué:** El acceso es solo el icono de carrito en cabecera. **Dónde:** `dieta.tsx:114-116` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-098 · Badge con nº de pendientes en el icono de carrito
**Qué:** Mostrar cuántos artículos hay pendientes desde dieta. **Dónde:** `dieta.tsx:114-116` · **Impacto:** 3 · **Esfuerzo:** M

### NUT-099 · Compartir lista de la compra (share sheet)
**Qué:** Exportar la lista como texto para enviar. **Dónde:** `compra.tsx:78-91` · **Impacto:** 3 · **Esfuerzo:** M

### NUT-100 · Marcar todo como comprado
**Qué:** Acción para vaciar la lista de golpe. **Dónde:** `compra.tsx:78-91` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-101 · Desmarcar todos los comprados
**Qué:** Devolver todo a pendiente sin borrar. **Dónde:** `compra.tsx:93-105` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-102 · Agrupar pendientes por origen (dieta vs manual)
**Qué:** Distinguir lo añadido a mano de lo generado. **Dónde:** `compra.tsx:78-91`, `types.ts:135-142` · **Impacto:** 2 · **Esfuerzo:** M

### NUT-103 · Persistir y mostrar fecha de creación del artículo
**Qué:** `created_at` existe pero no se usa en UI. **Dónde:** `compra.tsx:86`, `types.ts:141` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-104 · Sello de "última actualización" del plan
**Qué:** Mostrar cuándo se editó por última vez la dieta. **Dónde:** `dieta.tsx:109-117` · **Impacto:** 1 · **Esfuerzo:** M

### NUT-105 · XP por planificar la semana completa
**Qué:** Recompensar al rellenar todas las comidas (vía engine). **Dónde:** `dieta.tsx:64-75` · **Impacto:** 3 · **Esfuerzo:** L

### NUT-106 · XP por adherencia a la dieta del día
**Qué:** Marcar "comida cumplida" y otorgar XP de VIT. **Dónde:** `dieta.tsx:128-151`, `types.ts:126-133` · **Impacto:** 4 · **Esfuerzo:** L

### NUT-107 · Marcar comida como "hecha" (no solo planificada)
**Qué:** Estado `done` por slot para seguimiento real. **Dónde:** `types.ts:126-133`, `dieta.tsx:128-151` · **Impacto:** 4 · **Esfuerzo:** L

### NUT-108 · Logro "semana planificada"
**Qué:** Integrar con achievements al completar el plan. **Dónde:** `dieta.tsx:64-75` · **Impacto:** 2 · **Esfuerzo:** M

### NUT-109 · Voz del sistema en avisos de dieta
**Qué:** Los `Alert` usan copy genérico; aplicar tono "el sistema". **Dónde:** `dieta.tsx:88-92,97` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-110 · Mensaje del sistema al generar lista
**Qué:** "El Sistema ha sintetizado N reactivos…" en vez de texto plano. **Dónde:** `dieta.tsx:97-100` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-111 · Color por tipo de comida (slot)
**Qué:** Diferenciar visualmente desayuno/comida/cena. **Dónde:** `dieta.tsx:133,223` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-112 · Iconos por slot de comida
**Qué:** Icono junto al nombre del slot (café, sol, luna…). **Dónde:** `dieta.tsx:133` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-113 · Animación al mover artículo a "EN EL CARRO"
**Qué:** Transición suave (LayoutAnimation) al togglear. **Dónde:** `compra.tsx:39-42` · **Impacto:** 2 · **Esfuerzo:** M

### NUT-114 · Animación de entrada de filas nuevas
**Qué:** Fade-in al añadir artículo. **Dónde:** `compra.tsx:83-89` · **Impacto:** 1 · **Esfuerzo:** M

### NUT-115 · Haptic al marcar comprado
**Qué:** Vibración corta al togglear (expo-haptics). **Dónde:** `compra.tsx:39-42` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-116 · Haptic al generar lista
**Qué:** Feedback táctil de éxito. **Dónde:** `dieta.tsx:94-100` · **Impacto:** 1 · **Esfuerzo:** S

### NUT-117 · Cerrar editor con gesto de arrastre
**Qué:** El sheet solo cierra por botón/back; permitir swipe down. **Dónde:** `dieta.tsx:159-189` · **Impacto:** 2 · **Esfuerzo:** M

### NUT-118 · Tap en backdrop para cerrar editor
**Qué:** Tocar fuera del sheet debería cerrarlo. **Dónde:** `dieta.tsx:160-161` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-119 · `accessibilityViewIsModal` en el sheet
**Qué:** El lector debe atrapar el foco dentro del modal. **Dónde:** `dieta.tsx:159-189` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-120 · Anunciar resultado de "Generar lista" por voz
**Qué:** `AccessibilityInfo.announceForAccessibility` tras generar. **Dónde:** `dieta.tsx:97-100` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-121 · Validar `day` fuera de rango 1-7
**Qué:** `setDay(i+1)` es seguro hoy, pero blindar contra estados raros. **Dónde:** `dieta.tsx:121` · **Impacto:** 1 · **Esfuerzo:** S

### NUT-122 · Guardar deshabilitado correctamente con solo espacios
**Qué:** `description.trim()` ya cubre, pero el sheet permite teclear espacios; reflejar en botón. **Dónde:** `dieta.tsx:182` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-123 · Limpiar estado del editor al cerrar
**Qué:** `description`/`ingredients` no se resetean al cancelar (se reusan al reabrir). **Dónde:** `dieta.tsx:186` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-124 · Evitar `find` doble en `openEditor` y render
**Qué:** El mismo `find` por slot ocurre en openEditor y en el map. **Dónde:** `dieta.tsx:58,129` · **Impacto:** 1 · **Esfuerzo:** S

### NUT-125 · Tipar `addShoppingItems` con objeto rico
**Qué:** Aceptar `{ name, qty, aisle }` cuando se añadan columnas. **Dónde:** `body.ts:156-165` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-126 · Constante compartida para etiquetas de slot
**Qué:** `slotName.toUpperCase()` se repite; mapa de etiquetas legibles. **Dónde:** `dieta.tsx:133,163` · **Impacto:** 1 · **Esfuerzo:** S

### NUT-127 · Internacionalizar/centralizar copys de la pantalla
**Qué:** Strings sueltos dificultan mantener el tono. **Dónde:** `dieta.tsx:113,144,154`, `compra.tsx:59,81` · **Impacto:** 1 · **Esfuerzo:** M

### NUT-128 · Soporte de tema/contraste en `textFaint`
**Qué:** `colors.textFaint` sobre `bg` puede fallar contraste AA. **Dónde:** `dieta.tsx:226-227`, `compra.tsx:169` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-129 · Aumentar contraste del placeholder
**Qué:** Placeholder con `textFaint` apenas legible. **Dónde:** `dieta.tsx:171,179`, `compra.tsx:69` · **Impacto:** 3 · **Esfuerzo:** S

### NUT-130 · Soporte de Dynamic Type / escalado de fuente
**Qué:** Tamaños fijos no escalan con accesibilidad del SO. **Dónde:** `dieta.tsx:203-227`, `compra.tsx:123-169` · **Impacto:** 3 · **Esfuerzo:** M

### NUT-131 · `numberOfLines` en nombre de artículo largo
**Qué:** Un nombre muy largo puede empujar la `qty`. **Dónde:** `compra.tsx:86,167` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-132 · Manejar `description` muy larga en `mealDesc`
**Qué:** Sin `numberOfLines`, descripciones largas crecen sin control. **Dónde:** `dieta.tsx:136,224` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-133 · Reordenar lista tras togglear sin recargar todo
**Qué:** Mover el ítem entre secciones en local en vez de `load()`. **Dónde:** `compra.tsx:39-42` · **Impacto:** 2 · **Esfuerzo:** M

### NUT-134 · Evitar parpadeo de `done.length>0`
**Qué:** La sección comprados aparece/desaparece bruscamente. **Dónde:** `compra.tsx:93` · **Impacto:** 1 · **Esfuerzo:** S

### NUT-135 · Persistencia offline / cola de escritura
**Qué:** Las acciones fallan sin red; encolar y reintentar. **Dónde:** `compra.tsx:32-47`, `dieta.tsx:64-82` · **Impacto:** 3 · **Esfuerzo:** L

### NUT-136 · Cache local de la lista para arranque instantáneo
**Qué:** Mostrar última lista conocida mientras refresca. **Dónde:** `compra.tsx:17,20-26` · **Impacto:** 2 · **Esfuerzo:** M

### NUT-137 · Plantillas de dieta predefinidas (deload, volumen…)
**Qué:** Sembrar planes tipo según objetivo. **Dónde:** `dieta.tsx:36`, `body.ts:109-138` · **Impacto:** 3 · **Esfuerzo:** L

### NUT-138 · Etiqueta de macros objetivo en perfil enlazada a dieta
**Qué:** Que la meta calórica venga del perfil. **Dónde:** `dieta.tsx` (nueva sección) · **Impacto:** 2 · **Esfuerzo:** L

### NUT-139 · Resumen semanal de adherencia en informe
**Qué:** Llevar "comidas cumplidas" al informe semanal. **Dónde:** `dieta.tsx:128-151` · **Impacto:** 2 · **Esfuerzo:** L

### NUT-140 · Limpiar ingredientes huérfanos al borrar comida
**Qué:** Al eliminar un slot, no hay ningún efecto sobre la compra ya generada; documentar/gestionar. **Dónde:** `dieta.tsx:77-82` · **Impacto:** 2 · **Esfuerzo:** M

### NUT-141 · Evitar enviar lista vacía a `addShoppingItems`
**Qué:** Ya hay guard de `items.length===0`, pero también en el path manual. **Dónde:** `compra.tsx:33` · **Impacto:** 1 · **Esfuerzo:** S

### NUT-142 · `testID` en controles clave para e2e
**Qué:** Sin `testID` no hay pruebas de integración. **Dónde:** `dieta.tsx:153,182`, `compra.tsx:73` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-143 · Documentar separadores aceptados en ingredientes
**Qué:** El usuario no sabe que `;` y salto de línea valen. **Dónde:** `dieta.tsx:173`, `body.ts:183` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-144 · Soportar separador por viñetas/guiones en ingredientes
**Qué:** Mucha gente lista con "- ". Ampliar el split. **Dónde:** `body.ts:183` · **Impacto:** 2 · **Esfuerzo:** S

### NUT-145 · Conservar orden de inserción estable de la compra
**Qué:** `created_at desc` mezcla el orden lógico de la dieta. **Dónde:** `body.ts:149-151` · **Impacto:** 2 · **Esfuerzo:** S

Total: 145 mejoras, 8 bugs.
