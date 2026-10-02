-- Test de c3-xp-topes.sql (aplicar sin begin/commit, en rollback). Usuario ficticio.
create temp table r(caso text, ok boolean, detalle text);
grant all on r to authenticated;
insert into auth.users(id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('00000000-0000-4000-8000-0000000c3a41','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c3a41@example.invalid','{}','{}',now(),now());
insert into public.profiles(id) values ('00000000-0000-4000-8000-0000000c3a41') on conflict do nothing;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000c3a41","role":"authenticated"}';
create temp table x(n text, xp int, stat int);
grant all on x to authenticated;
-- Generales (no salud): cada fuente con su tope
insert into x select 'habit1', xp_total, xp_int from public.award_xp(100, 'INT', 'habit_acquired', '{"quest":"Leer"}');
insert into x select 'habit1_otra_vez', xp_total, xp_int from public.award_xp(100, 'INT', 'habit_acquired', '{"quest":"Leer"}');
insert into r select 'habit_una_vez', (select xp from x where n='habit1')=100 and (select xp from x where n='habit1_otra_vez')=100, null;
insert into x select 'goal', xp_total, 0 from public.award_xp(100, 'AGI', 'goal_achieved', '{"goal":"Libro"}');
insert into x select 'goal2', xp_total, 0 from public.award_xp(100, 'AGI', 'goal_achieved', '{"goal":"Libro"}');
insert into r select 'goal_una_vez', (select xp from x where n='goal2')=200, null;
insert into x select 'dt1', xp_total, 0 from public.award_xp(500, 'INT', 'dungeon_task', '{"dungeon":"C","task":"t1"}');
insert into x select 'dt2', xp_total, 0 from public.award_xp(500, 'INT', 'dungeon_task', '{"dungeon":"C","task":"t2"}');
insert into x select 'dt3', xp_total, 0 from public.award_xp(500, 'INT', 'dungeon_task', '{"dungeon":"C","task":"t3"}');
insert into r select 'dungeon_task_tope_750', (select xp from x where n='dt3')=200+750, (select xp::text from x where n='dt3');
insert into x select 'dc', xp_total, 0 from public.award_xp(600, 'INT', 'dungeon_cleared', '{"dungeon":"C","rank":"S"}');
insert into x select 'dc2', xp_total, 0 from public.award_xp(600, 'INT', 'dungeon_cleared', '{"dungeon":"C","rank":"S"}');
insert into r select 'dungeon_cleared_una_vez', (select xp from x where n='dc2')=950+600, null;
insert into x select 'sin_evento', xp_total, 0 from public.award_xp(2000, 'FUE', null, '{}');
insert into r select 'evento_desconocido_paga_0', (select xp from x where n='sin_evento')=1550, null;
insert into x select 'neg', xp_total, xp_int from public.award_xp(-2000, 'INT', 'dungeon_task', '{}');
insert into r select 'negativo_no_regla_paga_0', (select xp from x where n='neg')=1550, null;
insert into x select 'regla', xp_total, xp_int from public.award_xp(-500, 'INT', 'rule_broken', '{"rule":"x"}');
insert into r select 'regla_rota_max_25_y_stat_no_baja', (select xp from x where n='regla')=1525 and (select stat from x where n='regla')=(select stat from x where n='neg'), null;
insert into r select 'credito_recuperacion_25', (select count(*)=0 from x where false) , null;
-- Eventos con payload: xp registrado = lo pagado
insert into r select 'evento_registra_lo_pagado', (select array_agg((payload->>'xp')::int order by created_at, id)::text = '{500,250,0}' or array_agg((payload->>'xp')::int order by (payload->>'xp')::int desc)::text='{500,250,0}' from public.events where user_id=auth.uid() and type='dungeon_task' and payload ? 'task'), null;
-- Libros cerrados al cliente
do $$ begin
  begin perform 1 from public.xp_daily_ledger; insert into r values ('ledger_cerrado', false, 'leyó');
  exception when insufficient_privilege then insert into r values ('ledger_cerrado', true, sqlerrm); end;
  begin delete from public.xp_once; insert into r values ('once_cerrado', false, 'borró');
  exception when insufficient_privilege then insert into r values ('once_cerrado', true, sqlerrm); end;
end $$;
delete from r where caso='credito_recuperacion_25';
reset role;
insert into r select 'credito_recuperacion_25', xp=25, xp::text from public.recovery_credits where user_id='00000000-0000-4000-8000-0000000c3a41';
select * from r;
