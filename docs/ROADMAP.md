# NIVL · Roadmap por fases

> El backlog completo (1000+ mejoras) vive en `docs/mejoras/`. Este roadmap define QUÉ fase alimenta cada lote. Método de trabajo: skill `nivl-backlog` (lotes de 5-12 mejoras coherentes, typecheck + export + prueba en móvil, marcar ✅).

## Estado

- ✅ **Fase 1 — El sistema** (2026-06-11): perfil con nivel/rango/5 stats, misiones diarias con evidencia (+25%), XP/level-up, penalización dura con misión de recuperación, rachas con multiplicador, notificaciones 8:00/21:30, login Supabase.
- ✅ **Fase 1.5 — Calibración** (2026-06-11): Piedras de Protección (1/semana perfecta, máx 3, absorben el día fallado), tope de daño diario (150 XP), pausa del sistema (exámenes/enfermedad/vacaciones) desde Perfil.
- ✅ **Fase 2 — núcleo** (2026-06-11): mazmorras con rango/jefes/botín (tab + detalle), agenda unificada 14 días (misiones + tareas con fecha + eventos manuales).
- ✅ **Fase 3 — núcleo** (2026-06-11): gym (rutina semanal, sesión en vivo, PRs celebrados, XP FUE), dieta semanal por slots, lista de la compra autogenerada desde ingredientes.
- ✅ **Fase 4 — núcleo** (2026-06-11): diario del cazador (prompt, ánimo/energía, crónica automática desde events), informe semanal narrado con heatmap 13 semanas, 21 logros con títulos equipables.
- ✅ **Fase 5 — núcleo** (2026-06-11): banco de voz del sistema, toast de XP flotante, level-up con ondas hexagonales, notificaciones con copy variado.
- ✅ **Fase 6 — núcleo** (2026-06-11): el Oráculo — misiones generadas por IA desde un objetivo (API Claude con key propia, structured outputs, claude-haiku-4-5).
- ✅ **Fase 7 — núcleo** (2026-06-11): motor de cierre extraído a `closing.ts` puro + 23 tests jest, export completo de datos a JSON, CI (typecheck+tests).
- ✅ **Fase 8 — núcleo** (2026-06-11): compartir perfil como imagen (view-shot), `eas.json` con perfiles development/preview(apk)/production.
- ⏳ **Siguiente**: vivir la app, y profundizar cada fase con lotes del backlog (cada "núcleo" tiene decenas de mejoras pendientes en su categoría).

## Fases

| Fase | Tema | Categorías fuente | Resultado |
|---|---|---|---|
| 2 | **Mazmorras y tiempo** | MAZ (core) · CAL (core) · MIS (tipos nuevos) · PEN (rachas por hábito) | Proyectos como mazmorras con jefes, calendario unificado, misiones cuantitativas/temporizadas |
| 3 | **El cuerpo del cazador** | GYM (core) · NUT (core) · INT (Health Connect básico) | Rutina de gym con registro en vivo y PRs, dieta semanal, lista de la compra autogenerada |
| 4 | **Mente y memoria** | DIA (core) · EST (informes) · PRO (logros/títulos) · EVI (muro de la verdad, timelapse) | Diario del cazador, informe semanal narrado, sistema de logros, galería de evidencias |
| 5 | **Juice y presencia** | UIX (level-up cinematográfico, sonido, partículas) · NOT (banco de copy, acciones) · INT (widgets) | La app se siente juego AAA y vive también fuera de la app |
| 6 | **El sistema piensa** | AIA (coach IA, misiones desde objetivos, dificultad adaptativa) · NOT (timing contextual) | "Quiero correr una 10K en mayo" → el sistema genera el plan |
| 7 | **Blindaje** | TEC (offline-first, tests del motor, CI, EAS) · SEG (export, privacidad, costes) | Fiabilidad de producto: funciona sin red, datos a salvo, builds reproducibles |
| 8 | **El mundo exterior** | SOC (gremios, raids, duelos) · SEG (tiendas, monetización ética) · EXT | Si algún día NIVL deja de ser solo tuya |

Transversales en TODA fase: ONB (cada módulo nuevo necesita su onboarding), PSI (cada mecánica pasa el filtro de psicología del hábito), y el agente `nivl-game-balancer` antes de tocar economía.

## Reglas de oro

1. Cada fase termina con la app **mejor que antes y usable a diario** — nunca a medias.
2. Un lote a la vez; entre lotes, feedback real del usuario usando la app.
3. Impacto 5 + Esfuerzo S se cuelan en cualquier fase (quick wins siempre bienvenidos).
4. Lo que toque economía pasa por `nivl-game-balancer`; lo que toque UI, por `nivl-ux-auditor`.
