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
- ✅ **Fase 9 — EL COACH** (2026-08-14): el salto de registro de hábitos a sistema operativo del día.
  - **Memoria persistente**: `coach_dossier` + `coach_facts` + conversación. Trasplantada la memoria del coach anterior (dossier de 2.881 tokens + 14 entradas de log fechadas).
  - **Agente con manos**: Edge Function `coach` sobre `claude-opus-5` con 13 herramientas que escriben misiones, plan del día, agenda, horarios, mazmorras, reglas y metas. Ejecutadas con el JWT del usuario: RLS sigue aplicando.
  - **Economía atómica** (0009): RPC `award_xp` / `complete_quest` / `apply_day_close` y UPDATE revocado sobre las columnas de puntos. Cierra la deuda nº1 de las dos auditorías y hace imposible el doble-XP por doble toque.
  - **El día bajo control**: pantalla ORDEN DEL DÍA, `notifications.ts` reescrito (canales, sonido, acciones HECHO/POSPONER, deep links, despertador, reconciliación en vez de borrado masivo).
  - **Rituales automáticos**: `pg_cron` cada hora → Edge Function `ritual` → brief, revisión semanal, cierre mensual y escalada, con push a Expo.
  - **Higiene**: export RGPD completo (de 15 a 28 tablas), fugas de Storage cerradas, `penaltiesXp` real en el informe, unicidad (0011), Error Boundary, accesibilidad, lint limpio.
  - **Espejo a Notion**: tras cada ritual el coach escribe la entrada de log en la página CEREBRO. El coach de escritorio y el del móvil comparten un solo cerebro en vez de divergir.
- ✅ **Fase 9.5 — EL ENTRENADOR** (2026-08-15): el coach deja de dar consejos genéricos y pasa a programar con tus números.
  - **Capa del cuerpo** (0012): `cardio_sessions`, `nutrition_targets`, `nutrition_logs`, `training_prescriptions`, y **RPE por serie** en `gym_lifts` — el dato que decide la carga siguiente.
  - **El estudio** (`_shared/analytics.ts`): e1RM por Epley con su variación a 28 días, tendencia de peso por mínimos cuadrados (no el último pesaje), ritmo comparado solo dentro de la misma zona, adherencia a la dieta y al programa. Determinista y con tests; la IA interpreta, no calcula.
  - **La doctrina** (`_shared/knowledge.ts`): progresión por RPE, disparadores de descarga, regla del 10 % semanal, proteína por kilo, déficit sostenible — y los límites duros: no es médico, y para dolor articular o señales de trastorno alimentario manda parar.
  - **Tres herramientas nuevas**: `prescribir_entreno` (la prescripción se ve en Gym antes de entrenar), `fijar_nutricion` (objetivo de kcal y macros con su motivo) y `planificar_comidas` (reescribe el día entero de `meal_slots` con kcal y proteína por franja, y de ahí sale la lista de la compra).
  - **Dos pantallas**: Cardio (distancia, tiempo, zona, pulso, RPE) y Nutrición (objetivo vigente con su motivo, parte diario y adherencia a 28 días).
  - **Bucle cerrado**: verificado de punta a punta — registradas tres series con RPE 6,5-7 y una carrera Z2, el coach subió sentadilla 60 → 65 kg y prensa 120 → 130 kg citando el e1RM, y dejó la sesión escrita en la base de datos.
- ✅ **Fase 9.6 — EL DINERO** (2026-08-15): el coach empuja hacia un objetivo económico, así que deja de ser ciego a los números que lo deciden.
  - **Capa económica** (0013): `transactions` con huella única antiduplicados, `money_accounts`, `category_rules` que aprenden, `budgets` y `money_plan`.
  - **El estudio** (`_shared/finance.ts`): gasto por categoría contra su propia media, **cargos recurrentes con coste anual** (agrupando por cobrador normalizado, que es lo que junta los `AMZN Mktp ES*XXXX`), ritmo de gasto a mitad de mes, meses de aire, tasa de ahorro y bulto sin clasificar.
  - **Doctrina y límites**: primero los cargos recurrentes, luego las categorías desviadas, el gasto del día al final; ingresos antes que recortes. Y tres cosas que no hace: consejo de inversión, mover dinero, fiscalidad concreta.
  - **Cuatro herramientas**: `fijar_plan_economico`, `fijar_presupuesto`, `regla_categoria` (aprende y reclasifica hacia atrás) y `registrar_movimiento`.
  - **Dos entradas de datos**: `import-revolut.mjs` para el CSV del extracto (idempotente, con 108 reglas de categorización sembradas) y `setup-banco.mjs` para conexión automática por PSD2.
  - **Pantalla Economía**: mes en curso con proyección y ritmo, meses de aire, en qué se va, cargos recurrentes con lo que cuestan al año, y clasificación de un toque que además enseña la regla.
  - **Verificado**: con un extracto de tres meses el coach detectó los cargos recurrentes, ató el pico de gasto a la semana en la que el sistema se rompió, priorizó facturar sobre recortar y preguntó por los tres movimientos sin clasificar en vez de inventarlos.
- ⏳ **Siguiente**: vivirla desde TestFlight y afinar con datos reales. El backlog de `docs/mejoras/` sigue siendo la fuente para profundizar cada fase.

> **Nota de método (2026-08-14):** este roadmap llevaba desde junio sin reflejar el trabajo real (faltaban El Contrato, seguridad, pagos, avances y la agenda nueva). Si un lote no se anota aquí al cerrarlo, la siguiente sesión planifica a ciegas.

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
