# Economía: hipótesis reproducidas, correcciones y propuestas

Chat 5 · QA y Winter Arc, 02/10/2026. Rama `winter/chat5-qa`. Base `bf32d28`; correcciones en `d0682a6` y `d3dccae`.

**Tipo de evidencia: AUTOMÁTICA** (Jest), contra un servidor simulado. `src/lib/__tests__/qa/servidor.ts` reproduce la semántica de las RPC desplegadas:

- `apply_day_close_safe` no compara `last_day_processed`.
- `complete_quest` tiene un unique por misión y día.
- `supabase-js` devuelve `{ error }` en vez de lanzar.

Esto no sustituye una prueba contra la base de datos real. El Chat 3 reprodujo H3 en rollback contra el esquema vivo (rama `winter/chat3-seguridad` @ `e41bc62`).

Salida de los tests sobre la base, antes de corregir: `evidencia/hipotesis-base-bf32d28.txt`.

## Resultado por hipótesis

| # | Hipótesis | Base bf32d28 | Tras la corrección | Test |
|---|---|---|---|---|
| H1 | Un fallo entre el cierre y la creación de la recuperación deja XP irrecuperable | **FAIL: confirmada.** El insert de `quests` devolvía `{ error }` y nadie lo miraba. Resultado: XP descontado, sin misión y sin aviso. | PASS (mitigación). Hay reintentos y una recuperación pendiente que se reintenta al reabrir Hoy el mismo día. Además, el evento `penalty` lleva `recuperacion:'fallida'` y se lanza `ErrorVisible`. | `H1 ·` (2 tests) |
| H2 | Un fallo al buscar la misión enlazada acaba pagando dos veces | **FAIL: confirmada** por tres caminos: (a) respuesta perdida de `complete_quest` tras confirmar; (b) lectura fallida y misión marcada luego a mano; (c) otro dispositivo la completa entre la lectura y la marca. En los tres el mismo acto pagaba 100 en vez de 50. | PASS. Se relee lo pagado, se reintenta la lectura y se tiene en cuenta `awarded=false`. | `H2 ·` (4 tests) |
| H3 | `processPendingDays` + `apply_day_close_safe` permiten dos penalizaciones equivalentes | **FAIL: confirmada** en un solo dispositivo: dos cargas de Hoy en vuelo dejan 1000 → 600 en vez de 800, con dos «Misión de penalización». | PASS en un dispositivo: hay un solo cierre en vuelo por usuario. **Con dos dispositivos sigue FAIL**: el test `test.failing` espera la RPC con CAS. | `H3 ·` (3 tests) |
| RET-01 | La recuperación devuelve más de lo descontado | **FAIL: confirmada.** El servidor topa en 0: con 120 XP y 200 de penalización solo se descuentan 120, pero la misión devolvía 200. Tras 30 días fuera en la primera semana, el regalo llega a +4.250 XP. | PASS. `penalty_xp` = lo realmente descontado: primero misiones y luego reglas. | `RET-01 ·` |
| M1 | Hoy cargada antes de medianoche y tocada después | **FAIL** por código: la misión se completaba con la fecha nueva, y la penalización caducada se cobraba fuera de su día (invariante 2). | PASS. `completeQuest` rechaza lo que no toca hoy, con el mismo criterio que `completarMision` en `_shared/tools.ts`. | `medianoche ·` (3 tests, incluido el doble toque) |

Sobre el **cambio de hora** (25/10/2026 y 28/03/2027) y el **cambio de zona** no hay defectos: el día de 25 h y el de 23 h son una sola clave, y un cierre que cruza el 25/10 juzga cada día una vez. Volar hacia el oeste no provoca un doble cierre. Volar hacia el este adelanta el cierre: es un comportamiento aceptado del invariante 5 y queda anotado en la matriz (`qa-calendario.test.ts`, 8 tests).

En esta máquina, el test «horas del 25/10» ejercita el DST real solo si la zona del sistema es la peninsular. En CI con UTC pasa igual, pero sin DST.

## El vídeo (00:44–00:52): dos misiones de penalización de +204

H3 en un dispositivo produce exactamente ese síntoma: dos filas `is_penalty` con el mismo título, el mismo `penalty_date` y el mismo `penalty_xp`. En el vídeo, cada una está completada con +204, así que el neto pudo ser 0: dos descuentos de 204 y dos recuperaciones de 204.

**Sin los datos de la cuenta no se puede afirmar** que fuera esa la causa, ni que hubiera castigo o premio doble. Para confirmarlo hace falta consultar en la cuenta del vídeo:

- `quests` (`is_penalty`, `penalty_date`, `created_at` de las dos filas: si se crearon a milisegundos de distancia, es H3);
- `completions.xp_awarded` de ambas;
- los eventos `penalty` de ese día (si hay dos con el mismo `xp`, hubo doble descuento).

Lo puede hacer el coordinador, que tiene acceso a la base de datos; el Chat 5 no lo tiene.

**Gimnasio y diario.** Con el código de la base no hay doble pago en el camino feliz:

- Diario: aviso de 15 = misión de 10 + resto de 5.
- Gimnasio: la tarjeta muestra `gym_sessions.xp_awarded`, que es el resto del módulo más los récords y excluye la misión.

El Chat 4 ha corregido el desglose en la interfaz (`winter/chat4-experiencia` @ `50e50ca`). Doble pago real solo había en los caminos de fallo de H2, ya corregidos.

## Hallazgos fuera de mis archivos (enviados al dueño)

| Hallazgo | Evidencia | Dueño | Estado |
|---|---|---|---|
| `start_trial` (`trial_started`), `pro_interest` y `creator_referral` fallarían a quien rechazó el consentimiento de salud: el trigger `require_health_write` (0030, L256-263) exige ese consentimiento para tipos de evento fuera de la lista | Lectura de código; **no reproducido** | Chat 3 (reproducir en rollback), Chat 2 (prueba), coordinador (SQL) | Enviado como P0 posible |
| `general_event_payload` descarta `missed` y la nueva `recuperacion` del evento `penalty`, y con ello la auditoría de recuperaciones fallidas | Lectura de código | Coordinador (SQL) | Propuesta |
| `complete_quest` admite `p_xp` hasta 50.000 y una `p_date` cualquiera; `award_xp` admite ±2.000 por llamada sin tope diario | Lectura de código | Chat 3 + coordinador | Cotas acordadas con el Chat 3 (E7) |
| Espejo del coach (`_shared/tools.ts` → `propagarActo`): (a) paga 0 en el módulo si existe una misión enlazada, mientras la app paga el resto (diario con misión trivial: 10 en el coach, 15 en la app); (b) si su consulta falla, `enlazadas=0` y el módulo cobra entero (H2 en el servidor) | Lectura de código | Coordinador (espejo) con revisión del Chat 3 | Propuesta |
| `nutricion.tsx`: si `merece`, el aviso dice +10 y omite lo pagado por la misión enlazada | Lectura de código | Chat 4 | Enviado |
| Gimnasio: el aviso dice «+N XP a FUE» con el total, pero la misión paga a su propia stat | Lectura de código | Chat 4 | Enviado |

## PROPUESTA SQL (para el coordinador, con revisión del Chat 3)

Se apoya en `proposals/c3-economia-cierre.sql` del Chat 3, cuyas cotas he validado contra `game.ts` y `closing.ts`:

- racha ≤ la anterior + los días cerrados;
- piedras ≤ las anteriores + ⌈días/7⌉, con un máximo de 3;
- penalización ≤ 300 × días no congelados;
- normales ≤ 469.

Añadidos:

1. **Cierre con CAS y resultado explícito.** El cierre recibe `p_expected_last_day` (o devuelve `{applied, profile}`). Si `last_day_processed` ya avanzó, no descuenta nada y devuelve `applied=false`. El cliente crea la recuperación y el evento solo si `applied`. Con esto el test `test.failing` de dos dispositivos pasa a PASS.
2. **Recuperación dentro de la misma transacción**, con `penalty_xp = xp_antes − xp_después`, separada en misiones y reglas. Elimina H1 de raíz.
3. **`complete_quest` para `is_penalty`**: ignora `p_xp`, paga `quests.penalty_xp` y exige `p_date = penalty_date`. La cota de 469 no aplica a las penalizaciones, que tras 30 días llegan a 4.500 (9.000 con reglas).
4. **Lista blanca de `events`**: `recuperacion` (texto: `fallida` | `ok`) y `missed` (lista de títulos, o un recuento si se considera dato sensible).

Cuando el coordinador fije la firma, el cliente (`engine.ts`) pasará `p_expected_last_day` y quitará la recuperación del lado del cliente.

## Pendiente

- Confirmar con datos el origen de las dos penalizaciones del vídeo (ver arriba).
- Dos dispositivos: abierto hasta el SQL.
- La recuperación pendiente vive en memoria. Si la app se cierra antes del reintento, queda solo el evento (sin la clave `recuperacion` hasta el SQL) y la pérdida se consolida. Por eso la solución real es el punto 2.
- Reproducción física (QA-FISICA-WINTER: W-casos): NO PROBADO.
