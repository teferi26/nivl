---
name: nivl-game-design
description: Use when touching XP, levels, streaks, penalties, stats, rewards or designing ANY new game mechanic in NIVL — encodes the economy tables, curves, invariants and balance rules that keep long-term motivation and prevent XP inflation. Trigger on edits to src/lib/game.ts or src/lib/engine.ts, or when adding mechanics (logros, tienda, eventos, mazmorras).
---

# NIVL game design — economía y equilibrio

El juego existe para sostener motivación REAL a largo plazo. Cada mecánica nueva se juzga por: ¿sigue motivando en la semana 40, o solo en la semana 1?

## Economía actual (fuente de verdad: `src/lib/game.ts`)

- XP base: trivial 10 · fácil 25 · media 50 · difícil 100 · épica 250.
- Bonus evidencia: +25% (solo al completar, decisión irrevocable).
- Racha: multiplicador 1 + 0,1×⌊días/7⌋, cap ×1,5. Se rompe al fallar cualquier día con misiones programadas.
- Nivel: coste del nivel N→N+1 = round(100 × N^1.5). Rangos: E 1-10 · D 11-25 · C 26-45 · B 46-70 · A 71-99 · S 100+.
- Stats: 1 punto por 100 XP de área. FUE gym · VIT dieta/sueño · INT estudio/proyectos · AGI constancia · PER reflexión.
- Penalización (en `engine.ts/processPendingDays`, corre al abrir la app): −50% del XP base por misión fallada; xp_total puede bajar (nivel también); genera UNA misión de penalización agregada hoy con penalty_xp = lo perdido; completarla ese día lo restaura exacto; ignorarla consolida la pérdida. Sin penalizaciones en cadena (fallar la penalización no genera otra).

## Invariantes (NO romper sin decisión explícita del usuario)

1. Las stats por área nunca bajan; solo `xp_total` (nivel global) puede caer por penalización.
2. La penalización siempre es recuperable el mismo día y exactamente al 100% — castigo duro, juego justo.
3. No castigar dos veces el mismo fallo (racha rota + XP es el máximo).
4. Misiones de penalización: sin bonus de evidencia ni multiplicador (restauran, no premian).
5. Día = fecha local del dispositivo; el cierre ocurre al procesar el primer arranque tras medianoche.
6. Todo XP otorgado queda en `completions.xp_awarded` (auditable); los agregados viven en `profiles`.

## Reglas de equilibrio para mecánicas nuevas

- **Presupuesto diario**: un día normal cumplido ≈ 150–300 XP. Toda fuente nueva de XP debe caber: recompensas puntuales ≤50% del día normal; recurrentes ≤15%. Si una mecánica permite >2× el presupuesto diario, es inflación: rebájala o conviértela en cosmético.
- **Variedad > magnitud**: antes que subir números, añade TIPOS de recompensa (títulos, skins, lore, cofres). Los números crecientes se devalúan; los desbloqueos no.
- **Refuerzo variable con suelo**: las recompensas aleatorias (cofres) van SOBRE una base garantizada, nunca en su lugar.
- **Curva de dificultad personal**: lo difícil debe ser relativo al historial del cazador, no absoluto.
- **Las válvulas de escape se ganan, no se regalan** (tokens de descanso por racha, modo examen/enfermedad explícito y registrado). Sin válvulas, la primera semana mala mata la app; regaladas, matan la tensión.
- **Anti-grinding**: completar misión solo cuenta 1 vez/día (unique en BD). Misiones triviales en masa no deben superar a una difícil: si se añaden misiones cuantitativas, capar su XP diario.

## Checklist para una mecánica nueva

1. ¿Qué comportamiento real refuerza y en qué semana deja de funcionar? 2. ¿Cabe en el presupuesto de XP? 3. ¿Respeta los 6 invariantes? 4. ¿Estado en BD auditable (evento en `events`)? 5. ¿Qué pasa si el usuario falla 14 días seguidos — la mecánica le ayuda a volver o le humilla? 6. Simula 30 días en papel: nivel esperado ≈ 8-12 el primer mes.
