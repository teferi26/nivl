# NIVL · Medición de activación y retención (Winter Arc)

> Chat 5 · subagente (c) activación y retención · base `bf32d28` · 2026-10-02.
> Documento de diseño, sin código. Las consultas son de **solo lectura** sobre tablas que ya existen.

## 0. Reglas de este documento

1. **No hay línea base.** No se fija ningún objetivo numérico (ni de D1 ni de D7 ni de D30 ni de fallos) hasta haber medido **al menos 2 semanas** con la definición de abajo. D30 no tendrá un primer dato hasta unos 44 días después de empezar a medir (30 días de ventana más 14 de cohortes). Este documento no contiene cifras de retención y nadie debe inventarlas.
2. **Todo evento NUEVO** de la sección 6 está **bloqueado** hasta que:
   - el **Chat 3 (privacidad)** revise la finalidad, la base legal, la retención y la carga útil, y
   - el **Chat 1 (tiendas)** lo declare en App Privacy (Apple) y en Data Safety (Google).
   Si falta cualquiera de las dos firmas, el evento no se emite. Las consultas de la sección 2 a la 5 no necesitan eventos nuevos.
3. Las consultas se lanzan con `service_role` desde el editor SQL de Supabase, **solo** para producir agregados. No se exportan filas por persona, no se lee `payload` (salvo los campos numéricos citados) y no se cruzan con Franky.
4. **Nunca se publica una tasa sin su `n`.** Si una cohorte diaria tiene menos de 10 altas, se agrupa por semana. Con menos de 5 en la semana, se informa como «n insuficiente».
5. Las cuentas internas (dueño, revisores de Apple, cuentas de prueba) se excluyen con una tabla temporal que se rellena a mano **en la sesión**. Sus UUID **no entran en el repo**, que es público.

## 1. Inventario: qué hay ya en `events` y quién lo escribe

Tabla `public.events (id, user_id, type, payload jsonb, health_data, created_at timestamptz)`. Desde la 0030, el trigger `require_health_write` hace dos cosas:

- trata como **dato de salud** (exige consentimiento de salud y marca `health_data = true`) cualquier tipo que no esté en la lista general, y
- a los eventos generales les deja solo las claves de `general_event_payload` (`xp`, `pb`, `level`, `count`, `years`, `dias`, `evidence`, `boss`, `stat`, `rank`, `date`, `until`, `open_at`, ids uuid, y cadenas ≤500 en `quest`, `goal`, `rule`, `consequence`, `dungeon`, `task`, `target`, `deadline`, `kind`, `reason`).

| Tipo | Escribe | Origen | ¿Acto propio? | Clase según 0030 |
|---|---|---|---|---|
| `quest_completed` | RPC `complete_quest` (SQL) | completar misión | sí | general (salud si la misión lo es) |
| `bonus_earned` | RPC `complete_quest` | misión extra | sí | general / salud |
| `penalty` | `engine.processPendingDays` | cierre al abrir | **no** (sistema) | general |
| `stone_used`, `stone_earned`, `streak_lost` | `engine.processPendingDays` | cierre al abrir | **no** | general |
| `level_up` | `engine` (completar, awardXp) | derivado | no (consecuencia) | general |
| `freeze_on`, `freeze_off` | `engine.setFreeze` | pausa manual | sí | general (ver aviso 1) |
| `habit_acquired`, `goal_achieved`, `dungeon_task`, `dungeon_cleared`, `rule_broken` | `award_xp` vía `engine.awardXp` / `contract.ts` | actos | sí | general |
| `gym_session`, `gym_pr`, `cardio_session`, `weigh_in`, `nutrition_day`, `journal_entry` | `award_xp` / `gym.tsx` | módulos | sí | **salud** |
| `onboarding_goal` | `onboarding.tsx` paso 3 | onboarding | sí | general (o salud) |
| `commitment_signed` | `onboarding.tsx` paso 5 (`.catch` silencioso) | firma | sí | general |
| `pro_interest` | `ProOffer.tsx` | interés en Pro | sí | **no está en la lista general** (ver aviso 2) |
| `trial_started` | RPC `start_trial` (0024) | prueba de 7 días | sí | **no está en la lista general** (ver aviso 2) |
| `creator_referral` | RPC de creadores (0025) | código de creador | sí | **no está en la lista general** (ver aviso 2) |

Leen `events`: `informe.tsx`, `nutricion.tsx`, `gym.tsx`, `journal.ts`, `_shared/context.ts` (coach) y `_shared/tools.ts`.

**Avisos para pasar al responsable (no son de este documento y no se han reproducido; salen de leer el código):**

1. **Chat 3:** `freeze_on.reason` (por ejemplo «enfermedad») pasa como evento **general** porque `reason` está en la lista de claves permitidas. Un motivo de pausa por enfermedad es un dato de salud.
2. **Chat 3 / Chat 2:** según la 0030, `trial_started`, `creator_referral` y `pro_interest` no están en la lista general. Para una cuenta **sin consentimiento de salud**, `assert_health_write` lanzaría `sin_consentimiento_salud`. Eso tumbaría `start_trial()` y el registro del código de creador, porque el trigger salta también dentro de un SECURITY DEFINER, y haría fallar el botón de interés en Pro. Es una hipótesis por lectura que hay que reproducir con una cuenta sin consentimiento de salud. Si se confirma, es un P1 de compras.
3. **Para cualquier evento nuevo:** si su tipo no se añade a la lista general de la 0030, se clasifica como salud y falla sin ese consentimiento. Si sus claves no están en `general_event_payload`, se pierden. Por eso todo evento nuevo necesita una **migración del coordinador** revisada por el Chat 3.

**Sesgos de las tablas actuales que hay que declarar con cada cifra:**

- Retirar el consentimiento de salud borra los eventos de salud (0030, `delete from public.events … health_row`). Borrar una misión borra en cascada sus `completions`. Borrar la cuenta lo borra todo (0031). Las cohortes «pierden» a quien borró, y eso **infla** la retención.
- No hay evento de apertura. Quien abre la app y no hace nada **no cuenta como vuelta**. Los eventos del cierre (`penalty`, `streak_lost`…) delatan una apertura, pero solo si quedaban días por cerrar.
- `events.created_at` está en UTC. Se convierte a `Europe/Madrid`, lo que es una aproximación para Canarias o para quien viaje. `completions.date` y `rule_checks.date` ya son la **fecha local del dispositivo**, así que mandan sobre `events`.
- El 25/10/2026 cambia la hora. `completions.date` no se ve afectado. Las conversiones `at time zone 'Europe/Madrid'` tratan bien el cambio, pero las cohortes de ese día hay que mirarlas con cuidado.

## 2. Definiciones

| Métrica | Definición |
|---|---|
| **Alta** | Fila en `profiles`; momento = `profiles.created_at`; día de alta = `(created_at at time zone 'Europe/Madrid')::date`. |
| **Onboarding completado** | `profiles.onboarding_done = true`. No guarda hora; el sustituto es el primer `commitment_signed` (paso 5) y, si falta, `onboarding_goal` (paso 3). |
| **Primera misión** | Primera fila de `completions` de una misión **no de penalización** (`quests.is_penalty = false`); momento = `completions.completed_at`. Las misiones extra (`is_bonus`) cuentan: son un acto real. |
| **Activación** | Onboarding completado **y** primera misión **≤ 24 h** después del alta. Variante secundaria, «activación día 1»: primera misión el mismo día local del alta. |
| **Actividad propia en el día L** | Al menos uno de estos: una fila en `completions` con `date = L`, una fila en `rule_checks` con `date = L`, o un evento de la lista `ACTOS` con fecha local L. No cuentan los eventos del sistema (`penalty`, `stone_*`, `streak_lost`, `level_up`). |
| **D1 / D7 / D30** | Sobre la cohorte del día de alta A: proporción con actividad propia **exactamente** en A+1, A+7 o A+30. Variante «sin límite»: actividad en cualquier día ≥ A+N. Solo cuentan las cohortes ya completas (A+N ≤ ayer). |
| **Sesión** | Tiempo en primer plano. Se abre una sesión nueva tras ≥30 min en segundo plano o en un arranque en frío. Hoy **no se puede medir** (sección 5). |
| **Fallo** | (a) crash nativo; (b) error de render capturado por `ErrorBoundary`; (c) error visible: `loadError` en Hoy o la alerta «Error del sistema» tras una acción (`finishQuest`, `compartirDia`…); (d) acción principal sin respuesta en más de 10 s. |
| **Sesión sin fallos** | Sesión sin ningún fallo de los tipos (a) a (d). |
| **Latencia de acciones principales** | Tiempo en el cliente desde el toque hasta el estado final de: carga de Hoy (`load`), completar misión (`completeQuest`, de punta a punta), cierre de días pendientes (`processPendingDays` cuando hay días) y turno del coach. |

`ACTOS` (eventos que ya existen y cuentan como acto propio): `quest_completed`, `bonus_earned`, `habit_acquired`, `goal_achieved`, `dungeon_task`, `dungeon_cleared`, `rule_broken`, `freeze_on`, `freeze_off`, `onboarding_goal`, `commitment_signed`. Los de salud (`gym_session`, `gym_pr`, `cardio_session`, `weigh_in`, `nutrition_day`, `journal_entry`) **solo** entran si el Chat 3 autoriza contar que existen para esta finalidad. Por defecto se excluyen con `health_data = false`. La mayoría de esos actos también completa una misión enlazada, así que excluirlos sesga poco, aunque no es cero.

## 3. Consultas sobre tablas existentes

Preparación, una vez por sesión del editor SQL (no se guarda en el repo):

```sql
create temp table excluidas (id uuid primary key);
-- insert into excluidas values ('…');   -- cuentas internas, a mano, NO al repo
```

### 3.1 Actividad diaria por persona (vista base de todo lo demás)

```sql
create temp view actividad as
select c.user_id, c.date as dia
from public.completions c
union
select r.user_id, r.date
from public.rule_checks r
union
select e.user_id, (e.created_at at time zone 'Europe/Madrid')::date
from public.events e
where e.type in ('quest_completed','bonus_earned','habit_acquired','goal_achieved',
                 'dungeon_task','dungeon_cleared','rule_broken','freeze_on','freeze_off',
                 'onboarding_goal','commitment_signed')
  and e.health_data = false;          -- quitar SOLO si el Chat 3 lo autoriza
```

### 3.2 Embudo de activación por semana de alta

```sql
with altas as (
  select p.id, p.created_at, p.onboarding_done,
         (p.created_at at time zone 'Europe/Madrid')::date as dia_alta
  from public.profiles p
  where p.id not in (select id from excluidas)
),
objetivo as (
  select user_id, min(created_at) as at from public.events
  where type = 'onboarding_goal' group by user_id
),
firma as (
  select user_id, min(created_at) as at from public.events
  where type = 'commitment_signed' group by user_id
),
primera as (
  select c.user_id, min(c.completed_at) as at
  from public.completions c
  join public.quests q on q.id = c.quest_id
  where not q.is_penalty
  group by c.user_id
)
select date_trunc('week', a.dia_alta)::date                         as semana_alta,
       count(*)                                                     as altas,
       count(o.user_id)                                             as con_objetivo,
       count(f.user_id)                                             as con_firma,
       count(*) filter (where a.onboarding_done)                    as onboarding_hecho,
       count(*) filter (where a.onboarding_done
                          and pr.at <= a.created_at + interval '24 hours') as activados_24h,
       count(*) filter (where (pr.at at time zone 'Europe/Madrid')::date = a.dia_alta)
                                                                    as primera_mision_dia1
from altas a
left join objetivo o on o.user_id = a.id
left join firma    f on f.user_id = a.id
left join primera pr on pr.user_id = a.id
group by 1 order by 1;
```

Lo que no se ve: quien borró la misión de su primera completada. `quest_completed` en `events` hace de respaldo si hace falta.

### 3.3 Tiempo hasta la primera misión (mediana y p90)

```sql
with altas as (
  select id, created_at from public.profiles
  where onboarding_done and id not in (select id from excluidas)
), primera as (
  select c.user_id, min(c.completed_at) as at
  from public.completions c join public.quests q on q.id = c.quest_id
  where not q.is_penalty group by c.user_id
)
select count(*) as n,
       percentile_cont(0.5) within group (order by extract(epoch from pr.at - a.created_at)/60) as mediana_min,
       percentile_cont(0.9) within group (order by extract(epoch from pr.at - a.created_at)/60) as p90_min
from altas a join primera pr on pr.user_id = a.id;
```

### 3.4 Cuántas misiones arrancan y quién empieza sin ninguna

```sql
with altas as (
  select id, created_at from public.profiles
  where onboarding_done and id not in (select id from excluidas)
)
select coalesce(n_misiones, 0) as misiones_primer_dia, count(*) as personas
from altas a
left join lateral (
  select count(*) as n_misiones from public.quests q
  where q.user_id = a.id and not q.is_penalty
    and q.created_at <= a.created_at + interval '24 hours'
) m on true
group by 1 order by 1;
```

Sirve para contrastar la hipótesis ONB-008 (sobrecarga el día 1) con datos antes de decidir nada.

### 3.5 D1 / D7 / D30 por semana de alta

```sql
with altas as (
  select id, (created_at at time zone 'Europe/Madrid')::date as dia_alta
  from public.profiles
  where id not in (select id from excluidas)
),
hoy as (select (now() at time zone 'Europe/Madrid')::date as d),
marca as (
  select a.id, a.dia_alta,
    exists(select 1 from actividad x where x.user_id=a.id and x.dia=a.dia_alta+1)  as d1,
    exists(select 1 from actividad x where x.user_id=a.id and x.dia=a.dia_alta+7)  as d7,
    exists(select 1 from actividad x where x.user_id=a.id and x.dia=a.dia_alta+30) as d30
  from altas a
)
select date_trunc('week', m.dia_alta)::date as semana_alta,
       count(*) filter (where m.dia_alta + 1  < h.d) as n_d1,
       count(*) filter (where m.dia_alta + 1  < h.d and d1)  as vuelven_d1,
       count(*) filter (where m.dia_alta + 7  < h.d) as n_d7,
       count(*) filter (where m.dia_alta + 7  < h.d and d7)  as vuelven_d7,
       count(*) filter (where m.dia_alta + 30 < h.d) as n_d30,
       count(*) filter (where m.dia_alta + 30 < h.d and d30) as vuelven_d30
from marca m cross join hoy h
group by 1 order by 1;
```

Las tasas se calculan fuera (`vuelven_dN / n_dN`) y se publican con su `n`. Variante «sin límite»: cambiar `x.dia = a.dia_alta+N` por `x.dia >= a.dia_alta+N`.

### 3.6 Retorno tras ausencia (para medir las propuestas de RETENCION-WINTER-ARC.md)

Ausencia = hueco de ≥4 días sin actividad propia entre dos días activos. Se mide cuántas ausencias de 4 a 13, de 14 a 29 y de 30 o más días terminan en vuelta, y si quien vuelve sigue activo 7 días después.

```sql
with dias as (
  select user_id, dia,
         lag(dia) over (partition by user_id order by dia) as anterior
  from (select distinct user_id, dia from actividad) t
  where user_id not in (select id from excluidas)
),
vueltas as (
  select user_id, dia as dia_vuelta, dia - anterior - 1 as dias_fuera
  from dias where anterior is not null and dia - anterior - 1 >= 4
)
select case when dias_fuera < 14 then '4-13' when dias_fuera < 30 then '14-29' else '30+' end as tramo,
       count(*) as vueltas,
       count(*) filter (where exists (select 1 from actividad x
             where x.user_id = v.user_id and x.dia between v.dia_vuelta+1 and v.dia_vuelta+7)) as siguen_7d
from vueltas v
where v.dia_vuelta + 7 < (now() at time zone 'Europe/Madrid')::date
group by 1 order by 1;
```

Y cuánta penalización se recupera el día de la vuelta. La misión de penalización se completa (`is_penalty`) el mismo día que su `penalty_date`:

```sql
select count(*) as misiones_penalizacion,
       count(c.id) as recuperadas,
       sum(q.penalty_xp) as xp_en_juego,
       sum(c.xp_awarded) as xp_recuperado
from public.quests q
left join public.completions c on c.quest_id = q.id and c.date = q.penalty_date
where q.is_penalty and q.user_id not in (select id from excluidas);
```

## 4. Latencia: qué se puede medir hoy

- **Servidor:** los registros de la API de Supabase (Logs Explorer) traen la duración de las peticiones a PostgREST y RPC (`complete_quest`, `apply_day_close`, `my_completions`) y de las Edge Functions (`coach`). Dependen del plan y de su retención, que no se ha verificado. No requieren nada nuevo, pero solo cubren el tramo del servidor.
- **Cliente** (lo que siente la persona: red móvil, varias llamadas en serie en `load`): **no medible hoy**. Requiere el evento `perf_muestra` (sección 6).

## 5. Sesiones sin fallos: qué se puede medir hoy, sin SDK nuevo

| Fallo | Fuente actual | Estado |
|---|---|---|
| (a) crash nativo | App Store Connect y TestFlight (Crashes; solo de quien comparte análisis con desarrolladores), Google Play Console, Android vitals (tasa de bloqueos y ANR) | **Medible ya**, agregado por la plataforma, sin cambios en la app. Revisar cada semana. |
| (b) `ErrorBoundary` | `console.error` en el dispositivo (`ErrorBoundary.tsx:27`) | No llega a ningún sitio. Requiere evento. |
| (c) error visible (`loadError` en Hoy, «Error del sistema») | ninguna | Requiere evento. |
| (d) acción colgada | ninguna | Requiere evento. |
| Errores 5xx o de RPC | registros de Supabase | Medible en el servidor; no se puede atribuir a sesiones. |

Hasta que existan los eventos de la sección 6, el indicador se informa como **«tasa de crash de plataforma + errores de API del servidor»**, no como «sesiones sin fallos».

## 6. Eventos NUEVOS mínimos (BLOQUEADOS hasta revisión del Chat 3 y declaración del Chat 1)

Reglas comunes:

- Sin texto libre, sin títulos de misión, sin datos de salud, sin identificador del dispositivo, sin versión exacta del sistema operativo y sin IP en la carga útil.
- Van ligados a `user_id`, porque si no las cohortes no existen. Eso es **«vinculado al usuario»** en las tiendas.
- Antes del primer evento, el coordinador escribe una migración que:
  1. añada cada tipo a la lista general del trigger de la 0030 (si no, se trata como salud);
  2. use solo claves ya permitidas (`kind`, `count`, `date`, `dias`) o amplíe `general_event_payload`;
  3. ponga un tope por persona y día (índice único parcial o comprobación en la RPC) para que un cliente manipulado no pueda llenar la tabla;
  4. programe el borrado por antigüedad con `pg_cron`.
- Entran en el export RGPD y se borran con la cuenta, como el resto de `events`.
- **Interruptor de exclusión** («Ayudar a mejorar NIVL») en Perfil: la UI es del Chat 4 y la columna, del coordinador. Si el Chat 3 decide que hace falta consentimiento, va **desactivado** por defecto.

| Evento | Carga útil | Cuándo / tope | Para qué | Retención propuesta | Base legal propuesta (decide el Chat 3) |
|---|---|---|---|---|---|
| `app_open` | `{ date: 'YYYY-MM-DD' local }` | 1 por persona y día local | Vuelta D1/D7/D30 aunque no haga nada; denominador de «abrió pero no actuó» | 180 días; después, solo agregados sin `user_id` | Interés legítimo (art. 6.1.f), medición mínima del servicio, con exclusión |
| `onboarding_completado` | `{ count: nº de misiones iniciales, kind: perfil de uso }` | 1 por cuenta | Hora real de la activación (hoy no existe) | 180 días | 6.1.f |
| `sesion_resumen` | `{ kind: 'limpia' \| 'con_error' \| 'interrumpida', count: nº de errores visibles }` | Al arrancar se emite el de la sesión **anterior**; máx. 30 al día | Sesiones sin fallos. «Interrumpida» = la app murió en primer plano (marca local al pasar a activo, borrada al pasar a segundo plano) | 90 días | 6.1.f (seguridad y continuidad del servicio). **Ojo:** guarda una marca en el dispositivo (AsyncStorage); el Chat 3 debe valorarlo frente al art. 22.2 de la LSSI |
| `error_visible` | `{ kind: 'hoy_carga' \| 'completar' \| 'cierre' \| 'boundary' \| 'otro' }` | Máx. 20 al día | Saber **dónde** falla, sin mensaje ni traza | 90 días | 6.1.f |
| `perf_muestra` | `{ kind: 'hoy_carga' \| 'completar' \| 'cierre' \| 'coach', count: tramo 0–4 (<0,3 s · <1 s · <3 s · <10 s · ≥10 s) }` | Máx. 20 al día; tramos y no milisegundos, para no servir de huella | Latencia percibida de las acciones principales | 90 días | 6.1.f |
| `share_abierto` (opcional, prioridad baja) | `{ kind: 'semana' \| 'perfil' \| 'dia' }` | Máx. 10 al día | Medir que compartir es voluntario y si se usa. **Nunca** se premia con XP | 180 días | 6.1.f |

**Lo que el Chat 1 tendría que declarar si se activan** (a confirmar por el Chat 3; hoy la ficha está en `docs/appstore-review-2026-09-29/PRIVACIDAD-FICHA.md`):

- **Apple App Privacy:** «Usage Data → Product Interaction» (`app_open`, `onboarding_completado`, `share_abierto`) y «Diagnostics → Crash Data / Performance Data / Other Diagnostic Data» (`sesion_resumen`, `error_visible`, `perf_muestra`). Vinculados al usuario: **sí**. Tracking: **no** (no se cruza con datos de terceros ni hay ATT). Finalidad: App Functionality / Analytics.
- **Google Data Safety:** «App activity → App interactions» y «App info and performance → Crash logs, Diagnostics». Se recogen, no se comparten, van cifrados en tránsito y se pueden borrar.
- **Política de privacidad:** finalidad, retención y forma de excluirse.

## 7. Plan de medición

1. **Ya, sin tocar nada:** lanzar las consultas 3.2–3.6 sobre el histórico y apuntar los resultados con su `n` y la fecha en este documento o en `CHAT_5_ESTADO.md`. Es una **línea base histórica** con los sesgos de la sección 1, no un objetivo. Revisar cada semana la tasa de crash en App Store Connect y Play Console.
2. **Si el Chat 3 y el Chat 1 aprueban la sección 6:** el coordinador hace la migración, el Chat 4 pone el interruptor y la emisión, y luego se miden **2 semanas** sin cambiar nada de retención.
3. **Después de las 2 semanas:** se fijan objetivos relativos a la línea base («mejorar D7 frente a la línea base»), no cifras sacadas de otras apps. Cada propuesta de `RETENCION-WINTER-ARC.md` se valora con la consulta que le corresponde (3.2 activación, 3.5 D1/D7/D30, 3.6 vueltas).
4. Las muestras serán pequeñas, así que no se sacan conclusiones de diferencias que caben en el ruido de cohortes de pocas decenas. Se informa del intervalo o, como mínimo, del `n`.
