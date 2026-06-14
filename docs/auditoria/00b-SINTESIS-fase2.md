# Síntesis fase 2 de la auditoría · NIVL

> Las 17 áreas restantes auditaron el código real en 2 tandas (sin rate-limit): **2.340 mejoras + 108 bugs** anclados a `archivo:línea`. Catálogo completo de la auditoría: **22/22 áreas** (los 22 archivos `NN-*.md` de esta carpeta). Combinado con la fase 1 y el backlog inicial supera las **4.250 mejoras**.

## ✅ Bugs nuevos arreglados y verificados (tsc + 30 tests + export)

**Lógica / datos:**
- `achievements.ts` — `unlockAchievements` ahora hace `upsert` idempotente: un duplicado por carrera (gym + mazmorra a la vez) ya no aborta el lote ni pierde logros; los fallos reales dejan de tragarse.
- `data.ts` — `completionStats` e `insertEvent` propagan el error en vez de degradar a 0 / tragárselo (antes enmudecían logros y conteo de PRs).
- `dungeons.ts` — `fetchTasks` con desempate estable por `id` (las tareas con misma `position` ya no saltan entre recargas).

**Concurrencia (cerrojo síncrono `useRef`, replicando el patrón ya aplicado en Sistema/Diario):**
- `gym.tsx` — doble toque en "Terminar sesión" ya no choca con `unique(user_id,date)`; además pasa a `useFocusEffect` (era la única pantalla con `useEffect`, no refrescaba al volver).
- `dungeon/[id].tsx` — doble toque en una tarea ya no duplica XP; y `position` se calcula como `max+1` (antes `length` colisionaba tras borrar una tarea del medio).
- `agenda.tsx` — "Añadir al calendario" con cerrojo + `try/catch` + validación de fecha real (`isValidKey`): antes aceptaba `2026-13-45` y Postgres lo rechazaba con un error no capturado.

**Arranque / sesión / privacidad:**
- `auth.tsx` — `getSession().catch`: si la lectura de sesión fallaba, la app quedaba colgada en "cargando" para siempre.
- `_layout.tsx` — `useFonts` maneja el error (antes una fuente fallida = pantalla negra permanente) y `SplashScreen` con `.catch`.
- `perfil.tsx` — cerrar sesión borra la API key de Anthropic del dispositivo (en un móvil compartido el siguiente usuario heredaba la key de pago).

**UI / juice:**
- `LevelUpOverlay.tsx` — los anillos animados solo se montan al subir de nivel; antes corrían en **bucle infinito permanentemente** en Sistema/gym/mazmorra (drenaje de batería).
- `XpToast.tsx` — la animación ya no se reinicia en cada render del padre ni se solapan toasts encadenados (callback por ref + cancelación).
- `SystemButton.tsx` — el spinner de carga respeta la variante `danger` (era cian sobre botón rojo).
- `misiones.tsx` — el switch activo/inactivo revierte y avisa si la escritura falla (antes mentía respecto a la BD).

## ⏳ Pendiente de alto valor (lotes dedicados)

1. **Migración 0004 — economía atómica** (sigue siendo lo nº1): XP/racha/piedras vía RPC `SECURITY DEFINER` + `REVOKE`. Cierra el race read-modify-write, el doble level_up entre módulos, la pérdida de XP si `updateProfile` falla tras insertar la completion, y la manipulación directa. Varios bugs `alta` de AWD/ARC/GYM convergen aquí.
2. **Editar misiones** (MIS-1, `alta`): no existe `updateQuest`; la app dice "edítalas" pero hay que borrarlas (perdiendo historial). Añadir `updateQuest` + modo edición en `QuestForm`.
3. **Guard de auth en deep links** (SEC-2, NAV-1/2, `alta`): las pantallas stack se montan sin sesión vía `nivl://...`, y la expiración de sesión en caliente no redirige. Mover a un grupo `(app)` con guard, o `SessionGuard` en el layout raíz.
4. **Centralizar evaluación de logros** (AWD-1): hoy solo se evalúan al completar misión en Sistema; alcanzar nivel/racha en gym/mazmorra/diario o en el cierre no desbloquea el logro. Un `recomputeAchievements(profile)` tras cada `awardXp` y en `processPendingDays`.
5. **Fugas de Storage**: evidencias/avatares con `Date.now()` nunca se sobrescriben ni borran (basura acumulada que paga tu cuota). Ruta estable o borrado del anterior. Y limpiar evidencia huérfana si la completion falla.
6. **Notificaciones** (NOT): cuerpo congelado (mismo texto cada día), sin `channelId`, sin sonido en el aviso de cierre; `ensureDailyNotifications` borra todo en cada montaje.
7. **Accesibilidad** (A11, transversal): casi ningún pulsable tiene `accessibilityLabel/Role/State`; la app es inoperable con lector de pantalla. Y soporte de "reducir movimiento".
8. **Rendimiento** (PRF2): `fetchMaxLifts` baja todo el histórico en cada sesión; `bestDay` O(n²) sin memo; `SystemWindow` doble render + parpadeo; avatar sin caché.
9. **`upsert` real** en `meal_slots`/`gym_sessions`/`journal_entries`/`shopping_items` (faltan `unique` y se duplican filas) — encaja en 0004.

Detalle de cada uno en los archivos `NN-*.md` de esta carpeta.
