-- Test de 0049_origen_salud.sql. Aplicar 0049 (y la 0044 si falta) y este test en UNA transacción que se revierte.
-- 6 casos del Chat 3 (adenda, sin exportación) + 7 del Chat 1 (origen, deduplicación, compatibilidad 1.0.7).
create temp table r(caso text, ok boolean, detalle text);
grant all on r to authenticated, anon;
insert into auth.users(id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('00000000-0000-4000-8000-0000000c3b01','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c3b01@example.invalid','{}','{}',now(),now());
insert into public.profiles(id) values ('00000000-0000-4000-8000-0000000c3b01') on conflict do nothing;
insert into auth.users(id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values ('00000000-0000-4000-8000-0000000c3b02','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c3b02@example.invalid','{}','{}',now(),now());
insert into public.profiles(id) values ('00000000-0000-4000-8000-0000000c3b02') on conflict do nothing;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000c3b01","role":"authenticated"}';
do $$ begin
  begin insert into public.health_daily_steps(date, source, steps) values (current_date, 'healthkit', 8000);
    insert into r values ('pasos_sin_consentimiento_salud_bloqueado', false, 'insertó SIN consentimiento');
  exception when others then insert into r values ('pasos_sin_consentimiento_salud_bloqueado', true, sqlerrm); end;
end $$;
reset role;
insert into r select 'trigger_salud_en_pasos', count(*)>0, string_agg(tgname, ',') from pg_trigger where tgrelid='public.health_daily_steps'::regclass and not tgisinternal;
insert into r select 'pasos_en_borrado_de_salud', position('health_daily_steps' in prosrc)>0, null from pg_proc where proname='complete_health_erasure';
insert into r select 'anon_sin_privilegios_en_pasos', not has_table_privilege('anon','public.health_daily_steps','SELECT'), null;

insert into public.health_state(user_id, accepted, version) values ('00000000-0000-4000-8000-0000000c3b02', true, public.health_consent_version());
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000c3b02","role":"authenticated"}';
insert into public.health_daily_steps(date, source, steps) values (current_date, 'healthkit', 8000);
insert into r select 'pasos_con_consentimiento_ok', count(*)=1, null from public.health_daily_steps;
insert into public.cardio_sessions(user_id, date, kind, duration_min) select auth.uid(), current_date, 'correr', 30 where false;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000c3b01","role":"authenticated"}';
insert into r select 'otro_usuario_no_ve_pasos', count(*)=0, null from public.health_daily_steps;
reset role;
-- ── Chat 1: origen y deduplicación (usuario c3b02, con consentimiento de salud) ──
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000c3b02","role":"authenticated"}';
-- Compatibilidad 1.0.7: una inserción sin las columnas nuevas queda como manual.
insert into public.cardio_sessions(date, kind, duration_min) values (current_date - 1, 'correr', 30);
insert into r select 'compat_107_cardio_manual', bool_and(source = 'manual' and external_id is null), null
  from public.cardio_sessions where date = current_date - 1;
insert into public.body_metrics(date, weight_kg) values (current_date - 1, 80);
insert into r select 'compat_107_peso_manual', bool_and(source = 'manual'), null from public.body_metrics;
-- Importada con external_id: entra.
insert into public.cardio_sessions(date, kind, duration_min, source, external_id) values (current_date - 2, 'bici', 45, 'healthkit', 'hk-1');
insert into r select 'importada_ok', count(*) = 1, null from public.cardio_sessions where source = 'healthkit';
do $$ begin
  -- La misma muestra dos veces: rechazada por el índice único parcial.
  begin insert into public.cardio_sessions(date, kind, duration_min, source, external_id) values (current_date - 3, 'nadar', 20, 'healthkit', 'hk-1');
    insert into r values ('dedup_external_id', false, 'duplicó la muestra');
  exception when unique_violation then insert into r values ('dedup_external_id', true, null); end;
  -- Importada sin external_id: rechazada.
  begin insert into public.cardio_sessions(date, kind, duration_min, source) values (current_date - 4, 'remo', 20, 'healthkit');
    insert into r values ('importada_exige_external_id', false, 'aceptó sin external_id');
  exception when check_violation then insert into r values ('importada_exige_external_id', true, null); end;
  -- Manual con external_id: rechazada.
  begin insert into public.cardio_sessions(date, kind, duration_min, external_id) values (current_date - 5, 'remo', 20, 'x');
    insert into r values ('manual_sin_external_id', false, 'aceptó manual con external_id');
  exception when check_violation then insert into r values ('manual_sin_external_id', true, null); end;
  -- Origen desconocido: rechazado.
  begin insert into public.body_metrics(date, weight_kg, source, external_id) values (current_date - 6, 80, 'strava', 's-1');
    insert into r values ('origen_desconocido_rechazado', false, 'aceptó source=strava');
  exception when check_violation then insert into r values ('origen_desconocido_rechazado', true, null); end;
end $$;
reset role;
select * from r order by ok, caso;
