---
name: nivl-backlog
description: Use when planning what to build next in NIVL, when the user asks "qué hacemos ahora / siguiente fase / elige mejoras", or before starting any implementation batch — explains the 1000+ improvement backlog in docs/mejoras/, its ID scheme, how to select a coherent batch, and the definition of done.
---

# NIVL backlog — cómo planificar con las 1000+ mejoras

## Dónde vive

`docs/mejoras/` — 21 archivos por categoría, generados por agentes y curados a mano después:

01 GAM economía · 02 PEN rachas/penalizaciones · 03 MIS misiones · 04 EVI evidencias · 05 PRO logros/títulos · 06 MAZ mazmorras · 07 CAL calendario · 08 NUT dieta · 09 GYM entrenamiento · 10 DIA diario · 11 PSI psicología · 12 NOT notificaciones · 13 UIX ui/juice · 14 ONB onboarding · 15 EST estadísticas · 16 INT integraciones · 17 TEC técnica · 18 SOC social · 19 AIA ia · 20 SEG datos/futuro · 21 EXT transversales.

Cada mejora: `### XXX-NNN · Título` + **Qué** + **Impacto** (1-5) / **Esfuerzo** (S/M/L) / **Fase** (2-8). El índice y el plan por fases están en `docs/mejoras/README.md` y `docs/ROADMAP.md`.

## Cómo elegir el siguiente lote

1. Mira `docs/ROADMAP.md` para saber la fase actual.
2. Filtra mejoras de fase ≤ actual+1, no marcadas ✅.
3. Ordena por impacto desc, esfuerzo asc. Elige 5–12 que formen un TEMA coherente (mismo módulo/pantalla) — nunca picotear 8 categorías a la vez.
4. Incluye siempre: ≥1 quick win visible (S) por lote, y ≥1 mejora UIX si el lote toca pantalla.
5. Valida el lote contra las skills nivl-game-design (si toca economía) y nivl-design-system (si toca UI). Para lotes grandes, usa los agentes del proyecto: nivl-planner → plan; tras implementar, nivl-ux-auditor y nivl-game-balancer.

## Definition of done (por lote)

1. `npm run typecheck` limpio.
2. `npx expo export --platform android` compila.
3. Si cambió el esquema: migración SQL nueva en `supabase/migrations/` (numerada, nunca editar las aplicadas) + aviso al usuario para pegarla en el SQL Editor.
4. Probado en el móvil del usuario (Expo Go) — pedirle confirmación de que se siente bien.
5. Marcar las mejoras hechas: añadir ` ✅ hecho AAAA-MM-DD` al final de la línea del título en su archivo de categoría, y actualizar ROADMAP.md.

## Reglas

- El backlog es un menú, no un contrato: si el usuario pide algo que no está, se añade con el siguiente ID libre de su categoría.
- IDs nunca se reutilizan ni renumeran. Mejoras descartadas: tachar con `~~` y motivo en una línea.
- Tras cada lote, sugerir el siguiente lote candidato (3 opciones máx) — el usuario decide.
