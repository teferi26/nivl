-- Test de c-01. Dentro de una transacción que se deshace (ayudante rosql).
-- Una cuenta ficticia en prueba gratuita: el gasto del Oráculo y del titular
-- tiene que restar del presupuesto que ve ai_begin_turn.

create temp table res(n serial, k text, v text, ok boolean);

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'sec-c-ficticio@test.invalid', now(), now());
insert into public.subscriptions (user_id, status, plan, provider, current_period_end)
values ('00000000-0000-4000-8000-0000000000c1', 'trialing', 'cortesia', 'manual', now() + interval '7 days');

insert into res(k, v, ok)
select 'antes: remaining', (public.ai_state('00000000-0000-4000-8000-0000000000c1')->>'remaining'), true;

-- ANTES: el kind 'oracle' se rechaza.
do $$ begin
  insert into public.coach_runs (user_id, kind, mode, model, cost_micro_usd)
  values ('00000000-0000-4000-8000-0000000000c1', 'oracle', 'estandar', 'claude-haiku-4-5', 1);
  insert into res(k, v, ok) values ('antes: kind oracle', 'aceptado', null);
exception when check_violation then
  insert into res(k, v, ok) values ('antes: kind oracle', 'rechazado (23514)', null);
end $$;

-- Cuerpo de la propuesta.
alter table public.coach_runs drop constraint if exists coach_runs_kind_check;
alter table public.coach_runs add constraint coach_runs_kind_check check (
  kind = any (array[
    'chat', 'brief', 'plan', 'revision_semanal', 'cierre_mensual', 'import', 'escalada',
    'clasificar', 'resumen_semanal', 'resumen_mensual',
    'oracle', 'titular'
  ])
) not valid;

insert into public.coach_runs (user_id, kind, mode, model, cost_micro_usd)
values ('00000000-0000-4000-8000-0000000000c1', 'oracle', 'estandar', 'claude-haiku-4-5', 13500),
       ('00000000-0000-4000-8000-0000000000c1', 'titular', 'estandar', 'claude-haiku-4-5', 2000);

insert into res(k, v, ok)
select 'después: remaining', s->>'remaining', (s->>'remaining')::bigint = 500000 - 15500
from (select public.ai_state('00000000-0000-4000-8000-0000000000c1') s) x;

-- Un kind inventado sigue rechazándose.
do $$ begin
  insert into public.coach_runs (user_id, kind, mode, model, cost_micro_usd)
  values ('00000000-0000-4000-8000-0000000000c1', 'cualquiera', 'estandar', 'x', 0);
  insert into res(k, v, ok) values ('kind inventado', 'aceptado', false);
exception when check_violation then
  insert into res(k, v, ok) values ('kind inventado', 'rechazado', true);
end $$;

select k, v, ok from res order by n;
