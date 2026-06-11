# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v55.0.0/ before writing any code.
(El proyecto se bajó de SDK 56 a 55 el 2026-06-11 porque el Expo Go de las tiendas aún no soportaba 56. No subir de SDK sin comprobar antes qué soporta el Expo Go del usuario.)

# NIVL — contexto del proyecto

App móvil personal gamificada estilo Solo Leveling (un solo usuario, interfaz en español). Expo SDK 56 · React Native 0.85 · TypeScript estricto · Supabase. El README.md explica el juego; el código manda.

Mapa: pantallas `src/app/` (expo-router) · componentes `src/components/` · motor de juego `src/lib/game.ts` + `src/lib/engine.ts` · datos `src/lib/data.ts` · tema `src/lib/theme.ts` · SQL `supabase/migrations/` (las aplicadas nunca se editan; siempre archivo nuevo numerado, y el usuario las pega a mano en el SQL Editor de Supabase).

Reglas del proyecto (detalle en `.claude/skills/`):

- **nivl-design-system** — OBLIGATORIA antes de tocar cualquier UI o copy: paleta/tipos desde theme.ts, paneles en SystemWindow, voz del "sistema".
- **nivl-game-design** — OBLIGATORIA antes de tocar XP/rachas/penalizaciones o crear mecánicas: invariantes y presupuesto de XP.
- **nivl-backlog** — para planificar: el backlog de 1000+ mejoras vive en `docs/mejoras/`, el plan por fases en `docs/ROADMAP.md`.

Agentes del proyecto (`.claude/agents/`): `nivl-planner` (IDs del backlog → plan por archivos), `nivl-ux-auditor` (audita UI tras implementar), `nivl-game-balancer` (audita mecánicas antes de merge).

Verificación mínima de todo cambio: `npm run typecheck` + `npx expo export --platform android`. Las claves secret/service de Supabase NUNCA entran en este repo (solo la publishable en `.env`).
