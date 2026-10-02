# Chat 3 · c — Seguridad del coach y abuso

Rama `winter/chat3-seguridad`, base `bf32d28`, fecha 2026-10-02. Alcance: `supabase/functions/{coach,oracle,ritual}` y los `_shared` del coach. Para las reproducciones se usa un backend simulado (`_shared/sec_coach_fake_test.ts`). Imita Auth, PostgREST, las RPC con los GRANT reales sacados de `pg_proc.proacl` y el SSE del proveedor. No sale nada a la red ni se gasta dinero.

Cada test se ejecutó dos veces: sobre el código de la base (`git show bf32d28`) y sobre el código arreglado. La columna "Antes" es la salida real de la base y "Después" la del código arreglado.

Comprobaciones en remoto (proyecto `dueyufxxkiixdxighpaz`) con el ayudante de solo lectura, siempre dentro de `BEGIN…ROLLBACK` y con cuentas ficticias. Solo se consultó el catálogo.

## P0

| ID | Hallazgo | Dónde (base) | Reproducción | Antes | Después |
|---|---|---|---|---|---|
| P0-1 | **El candado de gasto se salta cuando el turno falla.** Si el turno falla después de haber pagado al proveedor, se apunta en `coach_runs` con coste 0, y `ai_state` solo suma `coach_runs`. El usuario puede provocarlo a voluntad: retira el permiso de salud o el consentimiento de IA mientras el turno está en el aire, y luego vuelve a darlo. También pasa con un fallo del proveedor en la 2.ª vuelta. Sin límite. | `coach/index.ts:784` (`cost_micro_usd: result ? … : 0`) y `:412` (la retirada del consentimiento después de la llamada tira el `usage`) | `sec_coach_ledger_test.ts` (3 casos). En remoto (`q3`): una cuenta ficticia en prueba con una fila de coste 0 conserva `remaining = 500000` | `apuntado: 0` ×3 (FAIL) | ≥ 220.000 µ$ apuntados (PASS) |
| P0-2 | **El Oráculo no tenía candado y su cupo tenía una carrera.** Leía `oracle_usage` y escribía `count = leído + 1` después de llamar al modelo. Una ráfaga entera pasa y el contador sube 1. Quedaba fuera de 0020: no usaba `ai_begin_turn` y no dejaba fila en `coach_runs`. Basta `start_trial()` (cualquier cuenta) para tener `trialing`. | `oracle/index.ts:107-193` | `sec_coach_oracle_test.ts`: 8 peticiones a la vez con el cupo en 99 | `8` llamadas al proveedor (FAIL) | 1 llamada; las demás reciben 429 `turno_en_curso` (PASS) |

**Arreglos.**

- **P0-1.** Nueva clase `Gasto` (`coach/guard.ts`). Suma el uso en cuanto el proveedor cobra, dentro de la operación protegida (`handler.ts:434/437`), y `finish` apunta siempre lo gastado de verdad.
- **P0-1, cortes a mitad de stream.** `LlamadaFallida` (`anthropic.ts` y `openai.ts`) lleva lo consumido aunque el stream se corte.
- **P0-2.** El Oráculo pasa por `ai_begin_turn` / `ai_end_turn`, que hacen de cerrojo por usuario y por eso serializan el cupo. Apunta su coste con `kind 'oracle'` (`oracle/handler.ts:118-138, 240`).
- **Dependencia.** El apunte `oracle`/`titular` necesita **`proposals/0038_coach_runs_kinds.sql`**: hoy el CHECK lo rechaza (23514, comprobado). El cerrojo y el cupo ya funcionan sin la migración.

## P1

| ID | Hallazgo | Dónde (base) | Reproducción | Estado |
|---|---|---|---|---|
| P1-1 | **Llamadas al proveedor sin plazo.** Si la plataforma corta la función (~150 s), no queda fila en `coach_runs` (gasto invisible) y el cerrojo queda tomado 4 min. | `anthropic.ts:174`, `openai.ts:133`, `oracle` fetch | Test `plazo` (abuse): un stream colgado se corta en 80 ms y `LlamadaFallida` lleva 90.000 fichas de entrada y la salida estimada | **Arreglado.** `PLAZO_DURO_MS = 130 s` desde la entrada (`handler.ts:59/620`). La señal corta también la lectura del stream. Por defecto 120 s y 60 s en el Oráculo. El corte real de la plataforma no está probado. |
| P1-2 | **Prompt injection por datos de terceros.** El concepto de los movimientos sin clasificar entra crudo en el system prompt (`finance.ts:378`): lo escribe quien te transfiere o el comercio. No había delimitación entre datos y órdenes. Hay herramientas destructivas sin confirmación (`gestionar_elemento` eliminar borra de verdad citas, tareas y hechos; `desactivar_mision`; `actualizar_dossier` sustituye entero), y los rituales del cron corren sin nadie delante. | `prompt.ts:93`, `finance.ts:378`, `tools.ts:1080-1154` | `sec_coach_abuse_test.ts`: en un brief del cron el modelo pide `eliminar` (antes: el DELETE se ejecuta; después: `is_error`, sin DELETE); 8 `desactivar_mision` en un turno (antes 8 PATCH, después 5); un dato con `</datos_del_gladiador>` no cierra el bloque | **Arreglado en el código.** `REGLA_DATOS` + `<datos_del_gladiador>` + `neutralizarDatos` (`prompt.ts`). En `coach/guard.ts`: ≤30 herramientas por turno, ≤5 destructivas, 0 en brief/plan/escalada, y veto a vaciar más de la mitad del dossier. Propuesta `c-04` (sanear el concepto en `finance.ts`). No está probado contra un modelo real que la regla del prompt funcione: el control duro es la guarda. |
| P1-3 | **Los errores le contaban al usuario el estado de la cuenta del dueño.** Mostraban "Sin saldo en la cuenta de Anthropic. Recarga en console.anthropic.com…" y el código de la API. | `coach/index.ts:802-814` | `errores:` ×2 (JSON y SSE) | **Arreglado.** Antes la respuesta era literalmente ese texto (FAIL). Ahora el mensaje es genérico (`mensajeDeFallo`) y el detalle va al log (`[SIN SALDO EN EL PROVEEDOR]`). |

## P2

| ID | Hallazgo | Reproducción | Estado |
|---|---|---|---|
| P2-1 | Fotos sin tope (número, tipo, tamaño). La 1.ª llamada del turno no la frena el tope de coste. | 10 fotos → antes 200 y se pagaba; después 400 sin llamar al proveedor | **Arreglado** (`validarImagenes`: ≤4, jpeg/png/webp/gif, ≤7 M de base64) |
| P2-2 | Un `thread_id` ajeno o inventado: RLS impedía leer y escribir, pero el turno seguía, se pagaba y no guardaba nada. | antes 200, después 404 | **Arreglado** (`handler.ts:793`) |
| P2-3 | `body.date` libre: el "hoy" con el que el coach marca misiones. | unit `fechaDelTurno` | **Arreglado** (±1 día del servidor) |
| P2-4 | **El resumen no funcionaba nunca.** `recap.ts` comprobaba `ai_consent_ok` con el cliente del usuario, y la RPC es solo de `service_role` (en remoto: `42501 permission denied`). Fallaba cerrado, así que no era una fuga, pero el resumen mensual del ritual tampoco salía. | antes `{"error":"No se pudo construir el resumen."}`, después 200 | **Arreglado** (`construirResumen(…, admin)`) |
| P2-5 | Ritual: el secreto se comparaba con `!==` (fuga por tiempo, la función es pública). Las sesiones abiertas por magic link no se revocaban: una por ritual y usuario, con su refresh token. El titular del push en Haiku no se apuntaba en `coach_runs`. | `sec_coach_ritual_test.ts`: antes `logout` 0 (FAIL), después 1 con `scope=local` | **Arreglado** (`secretoValido`, `signOut(jwt,'local')`, `kind 'titular'` con c-01) |
| P2-6 | `regla_categoria`: el patrón entra sin escapar en `or=(…)` de PostgREST. `zz,category.eq.sin_clasificar,…` recategoriza todo lo pendiente; siempre dentro de su `user_id`. | `sec_coach_tools_test.ts` muestra el filtro inyectado | **Propuesta** `c-03` (`tools.ts` es del coordinador) |
| P2-7 | El ejecutor no pone topes de cantidad, longitud, importe ni fecha. Los CHECK cubren los enums, pero no `transactions.amount`, longitudes, nº de bloques, comidas, ejercicios ni `gym_exercises`. Tampoco hay control por edad: `birth_year ≤ 2020` admite menores y nada impide fijarles calorías. | catálogo de CHECK en remoto | **Propuesta** `c-03`. El bloqueo de `fijar_nutricion` a menores de 18 es **decisión de producto pendiente**. |

## PASS (con la prueba que lo sostiene)

- **El `user_id` siempre sale del JWT verificado** (`admin.auth.getUser`), nunca del cuerpo. Las herramientas corren con el JWT del usuario: en el test, todo lo que no es `coach_runs` va con rol `user` y filtrado por su `user_id`, incluso con ids ajenos; una misión ajena no llega a `complete_quest`.
- **RLS en remoto** comprueba al padre en `day_blocks`, `coach_messages`, `dungeon_tasks` y `gym_exercises`. `rule_checks` con una regla ajena se rechaza ("Referencia ajena", por el trigger `require_health_write`).
- **`ai_begin_turn`, `ai_end_turn`, `ai_state` y `ai_consent_ok`** solo tienen GRANT para `service_role`. En remoto, el cerrojo atómico devuelve `turno_en_curso` en la 3.ª llamada, y el modo profundo en Pro da `profundo_no_incluido`. La cabecera `x-nivl-mode` solo acepta `profundo` exacto.
- **`PRICE_PER_MTOK`** cubre todos los modelos de `ai_plans.routes` en remoto (`deepseek-v4-flash` con su alias `deepseek-flash`, y `claude-sonnet-5`). Un modelo desconocido se cobra como Opus.
- **El consentimiento se comprueba antes de cada envío al proveedor en todos los caminos.** El chat y los rituales lo miran antes del cuerpo y en cada llamada. `clasificar` mira la IA antes del proveedor; la salud la cubre RLS `health_permission`, que oculta los movimientos marcados. El titular y `empujar` miran IA y salud. El Oráculo mira las dos y otra vez al enviar. El resumen ya funciona (P2-4).
- **Líneas rojas.** No existe ninguna herramienta que mueva dinero; `registrar_movimiento` solo anota. Las kcal tienen mínimo de 1.500 en el ejecutor y de 1.200 en el CHECK. El XP sale de las tablas, no del modelo. Que no haya consejo de inversión ni fiscalidad concreta solo está en el texto: no hay herramienta que lo ejecute.
- **El espejo a Notion** solo se activa para `tier === 'owner'`.
- **Límites de entrada y de vueltas:** `max_tokens` por kind, 5 vueltas, mensaje ≤ 8.000 caracteres e historial ≤ 12.
- **CORS:** ninguna función emite cabeceras CORS, así que un navegador de otro origen queda bloqueado (comprobado leyendo el código).

**Sin probar:** `verify_jwt` de las funciones desplegadas (no hay `config.toml`; el código valida el JWT igualmente), el corte real de 150 s de la plataforma y la eficacia de `REGLA_DATOS` con un modelo real.

## Encargo adicional: aviso de moderación (0037)

En `ritual/handler.ts` hay una nueva función, `avisarModeracion(admin)`, que se llama al final de cada pasada:

- Llama a `moderation_digest()` con service_role. Si `nuevos > 0`, envía un push a los `push_tokens` de los `owners` (en tandas de ≤100) con el título «Moderación» y el cuerpo «N denuncias o revisiones nuevas · M abiertas», sin contenido de las denuncias y sin `data`.
- No depende de los consentimientos y no llama a ningún modelo.
- Si la RPC no existe (42883 o PGRST202), o falla cualquier otra cosa, deja un `console.warn` sin datos, devuelve 0 y nunca lanza.

Tests en `sec_coach_moderacion_test.ts` (5, todos en verde): nuevos=0 no envía; nuevos>0 envía solo a los owners aunque los consentimientos estén negados; la carga extra de la RPC no se filtra al push; con la RPC inexistente el ritual devuelve 200 y un solo aviso sin datos; ante un fallo de red o una respuesta rara devuelve 0.

## Archivos

- **Cambiados:**
  - `coach/index.ts`, `oracle/index.ts` y `ritual/index.ts`: ahora son solo el punto de entrada.
  - `_shared/anthropic.ts` y `_shared/openai.ts`: `signal`, corte de la lectura y `LlamadaFallida`.
  - `_shared/prompt.ts`: delimitación de datos.
  - `_shared/recap.ts`: el consentimiento se comprueba con el cliente de servicio.
- **Nuevos:**
  - `coach/handler.ts`, `coach/guard.ts`, `oracle/handler.ts`, `ritual/handler.ts`.
  - Tests `_shared/sec_coach_{fake,ledger,abuse,oracle,tools,ritual,moderacion}_test.ts`.
- **Propuestas:**
  - `0038_coach_runs_kinds.sql` (+ `.test.sql`, pasado en remoto: `remaining 500000 → 484500`, y un kind inventado se sigue rechazando).
  - `c-03_tools_topes_y_filtros.patch` y `c-04_finance_conceptos.patch` (los dos pasan `git apply --check`).

## Dependencias y orden de salida

1. La migración **c-01** antes, o a la vez, que desplegar `coach`, `oracle` y `ritual`. Sin ella el cerrojo funciona igual; solo se pierde el apunte del Oráculo y del titular.
2. **`src/lib/coach.ts`** (otro chat) tiene que tratar tres respuestas nuevas:
   - **404 «Hilo no encontrado.»:** si guarda un `thread_id` caducado, que lo olvide y reintente sin él.
   - **400 de fotos:** la app ya limita a 3.
   - **Textos de error genéricos.**
3. **`src/lib/subscription.ts` (Oráculo)** recibe dos `reason` nuevos: 429 `turno_en_curso` y 402 `presupuesto_agotado`. Además, el Oráculo ahora gasta del presupuesto de IA del plan.
4. **La 0035 del cierre y la economía** cambia `award_xp`: tiene que seguir admitiendo las llamadas del coach (5 de `weigh_in`, 10 de `nutrition_day` y 15 de `journal_entry`, en `tools.ts`).

## Verificación

- `npx deno check` de coach, oracle y ritual: OK.
- `npx deno test -A supabase/functions/`: **79 passed, 0 failed**. Incluye los 44 de esta auditoría, `clasificar_test`, `health_test` y los tests de los otros subagentes.
- `npm run typecheck`: código de salida 0.
- `CI=true npm run lint`: código de salida 0.
