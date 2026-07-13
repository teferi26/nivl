# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.
(Historial SDK: 56→55→57→**54** — el proyecto está en **SDK 54** (RN 0.81.5, React 19.1.0). Motivo definitivo: el **Expo Go de la App Store de iOS es la 54.0.2** (verificado vía `itunes.apple.com/lookup?bundleId=host.exp.Exponent`), Apple no ha aprobado versiones más nuevas. En iOS el techo real es lo que hay LIVE en la App Store, NO lo último que Expo publica en su API. Para saberlo: iTunes lookup, no `api.expo.dev/v2/versions`. Nota: `expo-sharing` NO tiene config plugin en SDK 54 — fuera de app.json plugins. `StyleSheet.absoluteFill` no es spreadable en RN 0.81.)

# NIVL — contexto del proyecto

App móvil personal gamificada estilo Solo Leveling (un solo usuario, interfaz en español). Expo SDK 56 · React Native 0.85 · TypeScript estricto · Supabase. El README.md explica el juego; el código manda.

Mapa: pantallas `src/app/` (expo-router) · componentes `src/components/` · motor de juego `src/lib/game.ts` + `src/lib/engine.ts` · datos `src/lib/data.ts` · tema `src/lib/theme.ts` · SQL `supabase/migrations/` (las aplicadas nunca se editan; siempre archivo nuevo numerado, y el usuario las pega a mano en el SQL Editor de Supabase).

Reglas del proyecto (detalle en `.claude/skills/`):

- **nivl-design-system** — OBLIGATORIA antes de tocar cualquier UI o copy: paleta/tipos desde theme.ts, paneles en SystemWindow, voz del "sistema".
- **nivl-game-design** — OBLIGATORIA antes de tocar XP/rachas/penalizaciones o crear mecánicas: invariantes y presupuesto de XP.
- **nivl-backlog** — para planificar: el backlog de 1000+ mejoras vive en `docs/mejoras/`, el plan por fases en `docs/ROADMAP.md`.

Agentes del proyecto (`.claude/agents/`): `nivl-planner` (IDs del backlog → plan por archivos), `nivl-ux-auditor` (audita UI tras implementar), `nivl-game-balancer` (audita mecánicas antes de merge).

Verificación mínima de todo cambio: `npm run typecheck` + `npx expo export --platform android`. Las claves secret/service de Supabase NUNCA entran en este repo (solo la publishable en `.env`).
