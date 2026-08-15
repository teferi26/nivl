# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

El proyecto está en **Expo SDK 54** (RN 0.81.5, React 19.1.0). Historial: 56→55→57→**54**. El motivo definitivo es que el Expo Go LIVE en la App Store de iOS es la **54.0.2** (verificado con `itunes.apple.com/lookup?bundleId=host.exp.Exponent`); Apple no ha aprobado versiones más nuevas. **En iOS el techo real es lo que hay LIVE en la App Store, NO lo último que Expo publica** en `api.expo.dev/v2/versions`. Para saberlo: iTunes lookup.

Trampas conocidas del SDK 54: `expo-sharing` no tiene config plugin (fuera de `app.json` plugins, funciona autolinkado). `StyleSheet.absoluteFill` no es spreadable en RN 0.81. Las **rutas tipadas solo se regeneran arrancando Metro** (`npx expo start`), no con `expo export`: si `tsc` falla por una ruta nueva, arranca Metro unos segundos y mátalo.

# NIVL — contexto del proyecto

App móvil personal gamificada estilo Solo Leveling (uso personal, interfaz en español) **con un coach de IA dentro que manda en el día del usuario**. El README explica el juego; el código manda.

## Mapa

- Pantallas `src/app/` (expo-router, 6 pestañas) · componentes `src/components/`
- **Motor de juego**: `src/lib/game.ts` (tablas puras) + `src/lib/closing.ts` (cierre puro) + `src/lib/engine.ts` (efectos)
- **Plan del día**: `src/lib/plan.ts` (puro) + `src/lib/dayplan.ts` (datos)
- **Coach**: `src/lib/coach.ts` (cliente) · `supabase/functions/coach/` (el agente) · `supabase/functions/ritual/` (lo que dispara el cron)
- **Cuerpo**: `src/lib/bodymath.ts` (puro) + `src/lib/bodywork.ts` (datos: cardio, nutrición, prescripciones) · `supabase/functions/_shared/analytics.ts` (el estudio que lee el coach) + `_shared/knowledge.ts` (la doctrina de entreno y dieta)
- **Dinero**: `src/lib/moneymath.ts` (puro) + `src/lib/money.ts` (datos) · `supabase/functions/_shared/finance.ts` (el estudio económico) · importadores en `scripts/import-revolut.mjs` (CSV) y `scripts/setup-banco.mjs` (open banking)
- **Avisos**: `src/lib/notifications.ts` + `src/lib/useNotificationRouting.ts`
- SQL en `supabase/migrations/`

**Patrón de arquitectura**: la lógica pura vive en un módulo sin imports de Supabase, y los efectos en otro. No es estética — importar `supabase` arrastra AsyncStorage y los tests de ese módulo dejan de arrancar.

## Reglas que no se negocian

- **Las migraciones aplicadas nunca se editan**: siempre un archivo nuevo numerado. Se aplican con `node scripts/apply-migrations.mjs` (detecta lo pendiente por huellas). Al añadir una, añade su huella en `HUELLAS` o se intentará aplicar en cada ejecución.
- **La economía solo se mueve por RPC** (`award_xp`, `complete_quest`, `apply_day_close`). El UPDATE directo sobre `xp_total`, `streak_days`, `protection_stones` y `bonus_points` está revocado desde la 0009. Si necesitas tocar puntos, es una RPC nueva, no un update.
- **Ojo con los topes de XP**: una misión de penalización devuelve de golpe lo perdido en toda una ausencia (hasta 150/día). Los límites del esquema son altos a propósito; bajarlos rompe recuperaciones reales.
- Las claves secret/service de Supabase **nunca** entran en el repo. El token de despliegue vive en `supabase-token.txt` (gitignorado).

## Herramientas del coach

Las define `supabase/functions/_shared/tools.ts` (hoy son 16). Dos límites de la API que ya nos han mordido:

1. **Sin `strict: true`**: pasando de doce herramientas el compilador de esquemas responde "Schema is too complex". La validación real la hacen los CHECK de Postgres y el ejecutor.
2. **Nada de tipos unión**: `{ type: ['string','null'] }` junto a un `enum` se rechaza, y hay un tope de 16 parámetros con uniones en todo el conjunto. Lo opcional se expresa con **cadena vacía** como centinela (`opt` / `enumOpt`), no con null.

El coach elige **dificultad**, nunca puntos: el XP sale de `game.ts`.

El modelo es **`claude-sonnet-5`** (`COACH_MODEL` en `_shared/anthropic.ts`), por coste medido: con Opus el turno salía a 0,42 $ en frío. No lo subas a Opus sin una razón medida, y no lo bajes a Haiku: con veinte herramientas y 50.000 tokens de contexto es donde se eligen herramientas equivocadas, y aquí eso son cargas de gimnasio y dinero. Si tocas el modelo, añade su tarifa a `PRICE_PER_MTOK` o el freno de gasto contará mal.

**Regla de reparto: si la tarea es leer y transformar, va con `CHEAP_MODEL` (Haiku); si es decidir, con el coach.** Hoy son de Haiku la clasificación de movimientos (`_shared/clasificar.ts`), el titular del push (`ritual/index.ts`) y el Oráculo. Al añadir una tarea mecánica, sácala **antes** de `buildContext`: lo caro no es la tarifa del modelo, es arrastrar 50.000 fichas de dossier y estudios para responder algo que cabe en una línea. Ese es el patrón del atajo `kind: 'clasificar'` en `coach/index.ts`, que va aparte de `KINDS` justo por eso.

## El coach como entrenador y como contable

La IA no hace aritmética con el historial en bruto: `analytics.ts` y `finance.ts` le entregan estudios ya calculados (e1RM por Epley, tendencia de peso por mínimos cuadrados, ritmo por zona, adherencia; y gasto por categoría, cargos recurrentes, ritmo de gasto, meses de aire) y `knowledge.ts` la doctrina para interpretarlos. Regla de oro: **los números son deterministas y la IA solo decide qué hacer con ellos**. Si añades una métrica, va en el módulo con su test en `src/lib/__tests__/`, no en el prompt.

Las fórmulas están duplicadas a propósito entre el lado Deno (`analytics.ts`, `finance.ts`) y el lado Hermes (`bodymath.ts`, `moneymath.ts`): el empaquetado de la Edge Function no sube nada de fuera de `supabase/`. Si tocas una, toca la otra.

Con el dinero hay tres líneas que el coach no cruza, escritas en `knowledge.ts` y que no se relajan: **no da consejo de inversión, no mueve dinero y no entra en fiscalidad concreta**. Informa, mide y avisa; ejecutar es del usuario.

Convención de signo en todo lo económico: **negativo es gasto, positivo es ingreso**, como en el extracto. Los traspasos entre cuentas propias llevan `is_internal` y no cuentan ni como gasto ni como ingreso. Todo movimiento importado lleva `dedup_hash` con índice único: reimportar el mismo extracto veinte veces no duplica ni un cargo.

## Skills del proyecto (`.claude/skills/`)

- **nivl-design-system** — OBLIGATORIA antes de tocar UI o copy: paleta y tipos desde `theme.ts`, paneles en `SystemWindow`, voz del "sistema".
- **nivl-game-design** — OBLIGATORIA antes de tocar XP/rachas/penalizaciones o crear mecánicas.
- **nivl-backlog** — para planificar: backlog en `docs/mejoras/`, plan por fases en `docs/ROADMAP.md`.

Agentes (`.claude/agents/`): `nivl-planner`, `nivl-ux-auditor`, `nivl-game-balancer`.

## Verificación mínima de todo cambio

`npm run typecheck` · `npm test` · `npm run lint` · `npx expo export --platform ios`

Si tocas Edge Functions: `npx deno check supabase/functions/<nombre>/index.ts` y despliega. Para probar el coach de verdad: `node scripts/smoke-coach.mjs "…"`.
