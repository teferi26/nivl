# Cierre del día y economía: integridad (Chat 3 · Seguridad)

Base auditada: `fix/appstore-review-20260929@bf32d28` y el esquema **vivo** del proyecto NIVL (`dueyufxxkiixdxighpaz`), consultado el 02/10/2026 solo en lectura: cada prueba corre dentro de `BEGIN … ROLLBACK` con usuarios ficticios `@example.invalid` (nada queda escrito; comprobado con una tabla temporal que desaparece tras la consulta). No se leyó ningún dato de usuarios reales.

Migración: `proposals/0035-integridad-cierre-economia.sql` (número asignado por el coordinador el 02/10; conjunta con Chat 5). Test: `proposals/0035-integridad-cierre-economia.test.sql` — **33/33 PASS** contra el esquema vivo en rollback (02/10).

## Hallazgos

| ID | Sev. | Dónde | Reproducción (resultado real, en rollback) | Impacto |
|---|---|---|---|---|
| E1 | P1 | grants de `public.profiles` (INSERT de todas las columnas + DELETE para `authenticated`; política `own profile` FOR ALL) | `delete from profiles where id=auth.uid(); insert into profiles(id,xp_total,streak_days,bonus_points) values (auth.uid(),999999,5000,999)` → perfil queda `999999/5000/999` | Anula la revocación de la 0009: cualquier usuario fija su XP, racha y Puntos Bonus. Visible a terceros en `friends_board` / `elite_group_board` y logros. |
| E2 | P1 | grants de `public.completions` (INSERT/UPDATE/DELETE para `authenticated`) | `complete_quest(q,hoy,50…)`, `delete from completions`, `complete_quest(q,hoy,50000…)` → XP 1.050.049 | El candado `on conflict do nothing` de `complete_quest` se salta borrando la fila. |
| E3 | P1 | `apply_day_close_safe` (0017, renombrada en 0030) — sin comparación de `last_day_processed`; `src/lib/engine.ts:88-145` crea la recuperación en otra operación | Dos llamadas con el mismo estado obsoleto (`p_penalty_xp=150`): XP 1000 → 850 → **700** | Riesgo descrito en `VIDEO-REVISION.md` **reproducido**: dos cierres en carrera (dos pestañas/arranques, reintento) descuentan dos veces y crean dos misiones de recuperación. No demuestra que las dos filas del vídeo vengan de aquí. |
| E4 | P1 | mismo RPC: solo comprueba rangos absolutos | `apply_day_close_safe(hoy+3650, 100000, 3, 0, false, 100000)` → racha 100000, `last_day` 2036 (ninguna penalización futura); `('2000-01-01')` retrocede el día | Racha/piedras inventadas; inmunidad a penalizaciones; retroceso que habilita una "ausencia" falsa. |
| E5 | P1 | `quests.is_penalty/penalty_xp/penalty_date` con INSERT/UPDATE para el cliente; `complete_quest` acepta `p_xp` hasta 50000 para cualquier misión | Insertar `is_penalty=true, penalty_xp=50000` y completarla; o completar una misión normal con `p_xp=50000` | XP arbitrario por misión. |
| E6 | P2 | `engine.ts:130-143` / `contract.ts:68-80` | Consecuencia de E3: dos inserts de recuperación con el mismo título y día | Duplicados visibles en Hoy (posible origen de la pareja del vídeo, sin atribución). |
| E7 | P1 (residual, no cerrado por la propuesta) | `award_xp` acepta ±2000 por llamada sin tope diario ni lista de eventos | `award_xp(2000,'FUE','gym_session','{}')` repetible | La economía sigue siendo autoritativa del cliente para módulos (gym, cardio, diario, campañas). Requiere fase 2 con Chat 5: eventos permitidos y topes diarios por fuente en SQL, coherentes con `game.ts`. |

Ninguno da acceso a datos de otra cuenta (comprobado: `quests_ajenas_invisibles` = 0 filas). No hay dinero real ligado al XP; el daño es de integridad del juego y de los rankings sociales. Por eso P1 y no P0.

## Corrección propuesta (compatible con clientes 1.0.6/1.0.7, sin cambiar firmas)

1. `profiles`: el cliente solo inserta `id` (lo único que hace `ensureProfile`, `src/lib/data.ts:7`); sin DELETE. El borrado de cuenta ya va por service role.
2. `completions`: sin INSERT/UPDATE/DELETE de cliente (no hay ninguna escritura directa en `src/` ni en las funciones; todo pasa por `complete_quest`).
3. `apply_day_close_safe` (misma firma): bloqueo de fila; un cierre que no avanza `last_day_processed` es **no-op** y devuelve el perfil (reintentos y carreras idempotentes); día futuro (> hoy en UTC+14 − 1) rechazado; racha/racha perfecta ≤ anterior + días cerrados; piedras ≤ anterior + ⌈días/7⌉ y ≤ 3; penalización ≤ 300 × días.
4. Libro `recovery_credits` (sin acceso de cliente): el cierre y `award_xp(<0,'rule_broken')` acreditan lo **realmente** perdido; un trigger en `quests` deja crear una misión de penalización solo contra ese crédito, descarta en silencio el duplicado (mismo título y día) y prohíbe editar `is_penalty/penalty_xp/penalty_date`.
5. `complete_quest` (misma firma): penalización paga exactamente `penalty_xp`; el resto se recorta a 469 (épica 250 × evidencia 1,25 × racha 1,5); fecha limitada a hoy ±2 días por zonas horarias. Se recorta en vez de fallar para no romper redondeos de clientes.

### Pruebas (PASS = ejecutado contra el esquema vivo en rollback, 02/10/2026)

19/19 PASS: perfil nace con id · E1 insert con XP bloqueado · E1 delete bloqueado · cierre inicial · E5 pago recortado a 469 · E2 delete de completion bloqueado · completar con fecha de hace 30 días rechazado · **E3 doble cierre descuenta una vez** · **E6 una sola recuperación** · E5 penalización forjada descartada · E5 edición de penalización bloqueada · recuperación devuelve exactamente 150 · E4 futuro rechazado · E4 racha inflada sin efecto · E4 retroceso sin efecto · regla rota legítima crea consecuencia de 25 · crédito cerrado a clientes · misiones ajenas invisibles · anon no cierra.

NO PROBADO: concurrencia real con dos conexiones simultáneas (el test es secuencial; la serialización la dan `pg_advisory_xact_lock` + `FOR UPDATE`); cliente real en dispositivo tras desplegar.

## Orden de despliegue

1. Coordinador asigna número y huella (`to_regclass('public.recovery_credits') is not null`) y aplica la migración. No necesita OTA ni binario.
2. Chat 5 (opcional, mejora): en `engine.ts`, crear la recuperación y los eventos solo si el cierre avanzó de verdad (comparar `updated.last_day_processed` con el anterior y el XP), para no duplicar el evento `penalty` en `informe.tsx`. Ideal a medio plazo: RPC única que cierre y cree la recuperación en la misma transacción.
3. Fase 2 (E7): tabla de eventos permitidos y topes diarios de `award_xp`, diseñada con Chat 5 y `nivl-game-balancer`.

Riesgo de la propuesta: un cliente que hoy dependa de escribir `completions` o `profiles` directamente fallaría; se buscó en `src/` y `supabase/functions/` y no existe tal escritura.

## Añadidos en 0035 (02/10, tras la revisión cruzada con Chat 5)

- **EV-1 (P1, reproducido)**: sin consentimiento de salud, `start_trial()` y el evento `pro_interest` fallan con `42501 sin_consentimiento_salud` (también `creator_referral`), porque `require_health_write` (0030) trata todo tipo de evento desconocido como salud. Bloquea la prueba de 7 días y «avísame de Pro» a quien rechace la salud, un camino que Apple puede recorrer. Fix: esos tres tipos pasan a la lista de eventos generales, y `general_event_payload` admite `ends`, `source`/`tier`/`plan` (≤40 caracteres) y `recuperacion` ∈ {fallida, ok}. Un evento con claves de salud (p. ej. `weight`) sigue bloqueado, igual que cualquier tipo desconocido.
- **`close_day_v2(p_expected_last_day, p_last_day, …, p_recoveries jsonb)`** → `{applied, recoveries, profile}`. Compara contra el `last_day_processed` que vio el cliente y crea las recuperaciones en la misma transacción, limitadas a lo realmente descontado. Cubre la petición del Chat 5: CAS, H1 y RET-01.
- `complete_quest`: una penalización ignora `p_xp`, paga su `penalty_xp` y solo vale en su `penalty_date`.
- Casos nuevos PASS: penalización en otro día rechazada · v2 aplica una vez · v2 descuenta lo real (100, no 300) · v2 recuperación = lo perdido · start_trial sin salud · pro_interest sin salud · weigh_in sigue bloqueado · tipo desconocido sigue bloqueado · pro_interest con dato de salud bloqueado · payloads conservados/filtrados. **Total 33/33.**
