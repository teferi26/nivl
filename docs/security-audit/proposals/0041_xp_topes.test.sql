-- Test de c3-xp-topes.sql (aplicar sin begin/commit, en rollback). Usuario ficticio.
-- El diario es dato de salud (0030): la cuenta ficticia tiene consentimiento de salud vigente.
create temp table r(caso text, ok boolean, detalle text);
grant all on r to authenticated;
insert into auth.users(id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('00000000-0000-4000-8000-0000000c3a41','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c3a41@example.invalid','{}','{}',now(),now());
insert into public.profiles(id) values ('00000000-0000-4000-8000-0000000c3a41') on conflict do nothing;
insert into public.health_state(user_id, accepted, version) values ('00000000-0000-4000-8000-0000000c3a41', true, public.health_consent_version());
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000c3a41","role":"authenticated"}';
create temp table x(n text, xp int, stat int);
grant all on x to authenticated;
create function pg_temp.xp() returns int language sql as $$ select xp_total from public.profiles where id = auth.uid() $$;

-- Hábitos: cuatro misiones distintas el mismo día (tope 300). El cuarto no
-- cobra hoy, pero su marca NO se gasta (bloqueante 1 del balancer).
insert into public.quests(user_id,title,stat,difficulty,days_of_week) select auth.uid(), 'Leer '||g, 'INT', 'media', '{1,2,3,4,5,6,7}' from generate_series(1,4) g;
select public.award_xp(100, 'INT', 'habit_acquired', jsonb_build_object('quest', 'Leer 1'));
select public.award_xp(100, 'INT', 'habit_acquired', jsonb_build_object('quest', 'Leer 2'));
select public.award_xp(100, 'INT', 'habit_acquired', jsonb_build_object('quest', 'Leer 3'));
select public.award_xp(100, 'INT', 'habit_acquired', jsonb_build_object('quest', 'Leer 4'));
insert into r select 'habitos_tope_300', pg_temp.xp() = 300, pg_temp.xp()::text;
reset role;
insert into r select 'cuarto_habito_conserva_su_marca', not exists(select 1 from public.xp_once o join public.quests q on q.id::text=o.key where q.title='Leer 4'), null;
set local role authenticated;
select public.award_xp(100, 'INT', 'habit_acquired', jsonb_build_object('quest', 'Leer 1'));
insert into r select 'habito_una_vez', pg_temp.xp() = 300, pg_temp.xp()::text;
select public.award_xp(100, 'INT', 'habit_acquired', jsonb_build_object('quest', 'No existe'));
insert into r select 'habito_sin_fila_paga_0', pg_temp.xp() = 300, null;

-- Metas: la misma meta otra vez no paga; una meta NUEVA con el mismo título sí (bloqueante 2).
insert into public.goals(id,user_id,title,metric_type,start_value,target_value,current_value,unit) values ('00000000-0000-4000-8000-00000000c3e1', auth.uid(), 'Libros 2026', 'libre', 0, 10, 0, 'libros');
select public.award_xp(100, 'AGI', 'goal_achieved', '{"goal":"Libros 2026"}');
select public.award_xp(100, 'AGI', 'goal_achieved', '{"goal":"Libros 2026"}');
insert into r select 'meta_una_vez', pg_temp.xp() = 400, pg_temp.xp()::text;
insert into public.goals(user_id,title,metric_type,start_value,target_value,current_value,unit,created_at) values (auth.uid(), 'Libros 2026', 'libre', 0, 10, 0, 'libros', now() + interval '1 second');
select public.award_xp(100, 'AGI', 'goal_achieved', '{"goal":"Libros 2026"}');
insert into r select 'meta_repetida_nueva_fila_paga', pg_temp.xp() = 500, pg_temp.xp()::text;

-- Campañas: tareas hasta 500/día; botín por rango guardado y con ≥3 tareas hechas.
select public.award_xp(500, 'INT', 'dungeon_task', '{"dungeon":"C","task":"t1"}');
select public.award_xp(500, 'INT', 'dungeon_task', '{"dungeon":"C","task":"t2"}');
insert into r select 'dungeon_task_tope_500', pg_temp.xp() = 1000, pg_temp.xp()::text;
insert into public.dungeons(id,user_id,title,rank,stat) values ('00000000-0000-4000-8000-00000000c3f1', auth.uid(), 'Torre', 'C', 'INT');
insert into public.dungeon_tasks(dungeon_id,user_id,title,done) values ('00000000-0000-4000-8000-00000000c3f1', auth.uid(), 'a', true), ('00000000-0000-4000-8000-00000000c3f1', auth.uid(), 'b', true);
select public.award_xp(600, 'INT', 'dungeon_cleared', '{"dungeon":"Torre","rank":"S"}');
insert into r select 'botin_sin_3_tareas_paga_0', pg_temp.xp() = 1000, pg_temp.xp()::text;
insert into public.dungeon_tasks(dungeon_id,user_id,title,done) values ('00000000-0000-4000-8000-00000000c3f1', auth.uid(), 'c', true);
select public.award_xp(600, 'INT', 'dungeon_cleared', '{"dungeon":"Torre","rank":"S"}');
insert into r select 'botin_rango_guardado_C_150', pg_temp.xp() = 1150, pg_temp.xp()::text;
select public.award_xp(600, 'INT', 'dungeon_cleared', '{"dungeon":"Torre","rank":"S"}');
insert into r select 'botin_una_vez', pg_temp.xp() = 1150, null;

-- Diario de ayer y de hoy: cada uno en su día (bloqueante 3).
select public.award_xp(15, 'PER', 'journal_entry', jsonb_build_object('date', ((now() at time zone 'Europe/Madrid')::date - 1)::text));
select public.award_xp(15, 'PER', 'journal_entry', jsonb_build_object('date', ((now() at time zone 'Europe/Madrid')::date)::text));
insert into r select 'diario_ayer_y_hoy_pagan', pg_temp.xp() = 1180, pg_temp.xp()::text;
select public.award_xp(15, 'PER', 'journal_entry', jsonb_build_object('date', ((now() at time zone 'Europe/Madrid')::date)::text));
insert into r select 'diario_hoy_otra_vez_0', pg_temp.xp() = 1180, null;
select public.award_xp(15, 'PER', 'journal_entry', '{"date":"2020-01-01"}');
insert into r select 'diario_fecha_vieja_cuenta_hoy_tope', pg_temp.xp() = 1180, null;

-- Generales
select public.award_xp(2000, 'FUE', null, '{}');
insert into r select 'sin_evento_paga_0', pg_temp.xp() = 1180, null;
insert into x select 'antes_neg', xp_total, xp_int from public.profiles where id = auth.uid();
select public.award_xp(-2000, 'INT', 'dungeon_task', '{}');
insert into r select 'negativo_no_regla_paga_0', pg_temp.xp() = 1180, null;
select public.award_xp(-500, 'INT', 'rule_broken', '{"rule":"x"}');
insert into r select 'regla_rota_max_25_y_stat_no_baja', pg_temp.xp() = 1155
  and (select xp_int from public.profiles where id = auth.uid()) = (select stat from x where n='antes_neg'), null;
insert into r select 'evento_registra_lo_pagado',
  (select array_agg((payload->>'xp')::int order by (payload->>'xp')::int desc)::text from public.events where user_id=auth.uid() and type='dungeon_task' and payload ? 'task') = '{500,0}', null;
do $$ begin
  begin perform 1 from public.xp_daily_ledger; insert into r values ('ledger_cerrado', false, 'leyó');
  exception when insufficient_privilege then insert into r values ('ledger_cerrado', true, sqlerrm); end;
  begin delete from public.xp_once; insert into r values ('once_cerrado', false, 'borró');
  exception when insufficient_privilege then insert into r values ('once_cerrado', true, sqlerrm); end;
end $$;
reset role;
insert into r select 'credito_recuperacion_25', xp=25, xp::text from public.recovery_credits where user_id='00000000-0000-4000-8000-0000000c3a41';
select * from r;
