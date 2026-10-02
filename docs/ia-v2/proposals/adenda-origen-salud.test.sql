-- Test de la adenda (aplicar antes: SQL del Chat 1 @d2ed99b, 0044 si no está, y la adenda; todo en una transacción que se revierte). 8 casos.
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
insert into r select 'pasos_en_exportacion', position('health_daily_steps' in prosrc)>0, null from pg_proc where proname='export_my_data';
insert into r select 'anon_sin_privilegios_en_pasos', not has_table_privilege('anon','public.health_daily_steps','SELECT'), null;

insert into public.health_state(user_id, accepted, version) values ('00000000-0000-4000-8000-0000000c3b02', true, public.health_consent_version());
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000c3b02","role":"authenticated"}';
insert into public.health_daily_steps(date, source, steps) values (current_date, 'healthkit', 8000);
insert into r select 'pasos_con_consentimiento_ok', count(*)=1, null from public.health_daily_steps;
insert into public.cardio_sessions(user_id, date, kind, duration_min) select auth.uid(), current_date, 'carrera', 30 where false;
insert into r select 'exportacion_v5_incluye_pasos', jsonb_array_length(public.export_my_data()->'health_daily_steps')=1, null;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000c3b01","role":"authenticated"}';
insert into r select 'otro_usuario_no_ve_pasos', count(*)=0, null from public.health_daily_steps;
reset role;
select * from r;
