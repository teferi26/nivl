# Síntesis de la auditoría de código · NIVL

> Auditoría multi-agente sobre el código REAL (no el backlog a ciegas). 22 agentes lanzados; **5 completaron** antes de que el servidor de la API aplicara un rate-limit temporal (no cuota del usuario): ENG (motor), SQL (backend), SIS (Sistema), DIA (diario/informe), ORA (oráculo) → **833 mejoras + 37 bugs** anclados a `archivo:línea`. Las 17 áreas restantes están pendientes de reanudar (cacheadas las 5 hechas).

## Estado de los 37 bugs

### ✅ Arreglados y verificados (tsc + 30 tests + export)

**Lógica pura (commit Tier 1):**
- `game.ts` — nivel tope 999 con estado terminal: la barra de XP ya no se desborda (ratio >1) ni muestra cifras absurdas en Sistema/Perfil.
- `game.ts` — `streakMultiplier` con clamp inferior (racha negativa ya no reduce el XP).
- `dates.ts` — `isValidKey` + `parseKey` validan formato; una clave corrupta daba Invalid Date silencioso que dejaba misiones sin programar.
- `closing.ts` — normaliza `freeze_until` a `YYYY-MM-DD` (un timestamp congelaba un día de más).
- `engine.ts` — limpia la congelación vencida aunque no haya días que cerrar.
- `journal.ts` — el parámetro de `promptForDate` ya no ensombrece la función `dateKey`.

**Cliente (commit Tier 2):**
- `index.tsx` — el aviso de cierre (ALERTA DEL SISTEMA) ya no se queda pegado para siempre; un día sin cierre lo borra.
- `index.tsx` — cerrojo síncrono por misión: el doble toque mientras la cámara/Alert están abiertos ya **no duplica XP**.
- `index.tsx` — inserción optimista con id único por misión (antes `id:'local'` fijo).
- `diario.tsx` — cerrojo síncrono en guardar (no duplica entrada ni XP) + `useFocusEffect` (refresca al volver) + fecha recalculada (no escribe el día equivocado a medianoche) + conteo de 14 entradas correcto.
- `informe.tsx` — `useFocusEffect` + fecha recalculada (KPIs y heatmap ya no quedan obsoletos).
- `dungeon/[id].tsx` — `claimLoot` con guard de estado: el botín no se reclama dos veces.
- `data.ts` — `ensureProfile` con `upsert` (evita el duplicate-key 23505 contra el trigger).
- `oracle.ts` — valida la respuesta de la IA contra los enums reales (stat/difficulty/días) antes de insertar: ya no entra basura en la BD.

**Backend (migración `0003_seguridad.sql`, additiva):**
- CHECK de rango en `profiles` (XP/stats ≥0, racha ≥0, piedras 0-3), `completions` (xp_awarded 0-1000), `quests` (days_of_week 1-7), `gym_lifts` (≥0).
- RLS de pertenencia al padre en `dungeon_tasks`, `gym_exercises`, `gym_lifts` (no se pueden colgar filas de la mazmorra/sesión de otro).
- Buckets de Storage con límite de 5 MB y solo imágenes (evita subidas abusivas que pagaría tu cuota).

### ⛔ Falso positivo (verificado contra la skill oficial de la API)
- ORA «`output_config` no es un parámetro válido» → **es válido**: la API de Claude lo soporta y Haiku 4.5 hace structured outputs. El Oráculo funciona; lo que sí faltaba (validación de enums) ya está hecho.

### ⏳ Pendiente (alto valor, lote dedicado)
1. **Economía atómica y anti-trampas (migración 0004)** — el bug `alta` más serio: el XP es read-modify-write en el cliente y `xp_total` es manipulable directamente. El arreglo correcto es mover XP/racha/piedras a RPC `SECURITY DEFINER` con deltas + `REVOKE` de escritura directa, y refactorizar `engine.ts`/`data.ts` para llamarlas. No se incluyó en 0003 porque exige el refactor del cliente en el mismo paso (y rompería la app si se aplica a medias). Riesgo real bajo en una app de un solo usuario, pero es el siguiente hito de "perfecto".
2. **Polish del Oráculo** — timeout/AbortController en el fetch (consulta colgada), enmascarar la API key siempre, `Promise.allSettled` al aceptar (rollback parcial).
3. **Refresco con `useFocusEffect`** en las demás pantallas stack (gym, dieta, compra) — mismo patrón que diario/informe.
4. **`gym_sessions`/`journal_entries`** — pasar de leer-luego-insertar a `upsert on conflict` para cerrar el race del doble guardado.

## Temas transversales detectados
- **Concurrencia sin cerrojos**: el patrón "solo estado `busy`" no bloquea de forma síncrona → varios bugs de doble-acción. Patrón aplicado: `useRef` como cerrojo.
- **Economía sin atomicidad** en el cliente (→ migración 0004).
- **Pantallas stack fuera del patrón de refresco** de las tabs (`useFocusEffect`).
- **Validación de entrada confiada**: respuestas de IA y valores de BD asumidos válidos.
- **Manejo de errores repetido** con `Alert.alert` por todas partes → futuro hook/toast centralizado.
- **Listas con `ScrollView`+`.map`** donde a escala convendría `FlatList` (rendimiento, áreas PERF2/A11 pendientes).

## Hoja de ruta para "perfecto"
1. ✅ Bugs de corrección (lógica + cliente + integridad backend) — hecho.
2. **Economía atómica** (migración 0004 + refactor a RPC).
3. Completar la auditoría (reanudar las 17 áreas restantes) y vaciar su backlog por lotes.
4. Capa de estado/caché de servidor (TanStack Query) + tipos de Supabase generados + Error Boundary.
5. UX por pantalla (date picker en agenda, editar misiones, temporizador de gym, macros en dieta…).
6. Juice + accesibilidad (haptics, partículas, `accessibilityLabel`, contraste, dynamic type).
7. Offline-first + telemetría (Sentry) + notificaciones contextuales.
