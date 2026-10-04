-- Test de la 0047 (aplicar antes la 0047 —dos veces, para probar que es idempotente— y esto detrás; todo en una transacción que se revierte). Solo catálogo y filas ficticias.
create temp table r(caso text, ok boolean, detalle text);
grant all on r to authenticated, anon;
insert into auth.users(id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('00000000-0000-4000-8000-0000000c4701','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c4701@example.invalid','{}','{}',now(),now());
insert into public.profiles(id) values ('00000000-0000-4000-8000-0000000c4701') on conflict do nothing;
-- coach_threads es tabla de salud (0030): sin consentimiento no se escribe.
insert into public.health_state(user_id, accepted, version) values ('00000000-0000-4000-8000-0000000c4701', true, public.health_consent_version());

-- 1. Columnas nuevas, nulas y con su tipo; las de caché no se duplican.
insert into r select 'columnas_telemetria', count(*) = 6, string_agg(column_name || ':' || data_type || ':' || is_nullable, ', ')
  from information_schema.columns where table_schema = 'public' and table_name = 'coach_runs'
  and ((column_name, data_type) in (('route','text'),('intent','text'),('tools_offered','smallint'),('tool_calls','smallint'),('iterations','smallint'),('state_chars','integer')))
  and is_nullable = 'YES' and column_default is null;
insert into r select 'cache_sin_duplicar', count(*) = 2, string_agg(column_name, ',')
  from information_schema.columns where table_schema = 'public' and table_name = 'coach_runs' and column_name like '%cache%';
insert into r select 'columnas_hilo', count(*) = 2, string_agg(column_name || ':' || data_type, ', ')
  from information_schema.columns where table_schema = 'public' and table_name = 'coach_threads'
  and ((column_name, data_type) in (('summary','text'),('summary_until','timestamp with time zone'))) and is_nullable = 'YES';

-- 2. El CHECK de kind amplía el vivo y sigue NOT VALID.
insert into r select 'kind_check_ampliado',
  pg_get_constraintdef(oid) like '%''checkin''%' and pg_get_constraintdef(oid) like '%''resumen_hilo''%'
  and pg_get_constraintdef(oid) like '%''titular''%' and pg_get_constraintdef(oid) like '%''oracle''%'
  and pg_get_constraintdef(oid) like '%''clasificar''%' and not convalidated,
  pg_get_constraintdef(oid)
  from pg_constraint where conname = 'coach_runs_kind_check' and conrelid = 'public.coach_runs'::regclass;

-- 3. Un insert como el de 1.0.7 (sin columnas nuevas) sigue funcionando.
do $$ begin
  insert into public.coach_runs(user_id, kind, mode, model, in_tokens, cache_read_tokens, cache_write_tokens, out_tokens, cost_micro_usd)
    values ('00000000-0000-4000-8000-0000000c4701', 'chat', 'estandar', 'claude-sonnet-5', 10, 20, 30, 5, 123);
  insert into r values ('insert_compatible_1_0_7', true, null);
exception when others then insert into r values ('insert_compatible_1_0_7', false, sqlerrm); end $$;

-- 4. Con telemetría y los kinds nuevos.
do $$ begin
  insert into public.coach_runs(user_id, kind, model, cost_micro_usd, route, intent, tools_offered, tool_calls, iterations, state_chars)
    values ('00000000-0000-4000-8000-0000000c4701', 'checkin', 'claude-haiku-4-5', 1, 'mecanica', null, 0, 0, 1, 0),
           ('00000000-0000-4000-8000-0000000c4701', 'resumen_hilo', 'claude-haiku-4-5', 1, 'mecanica', null, 0, 0, 1, null),
           ('00000000-0000-4000-8000-0000000c4701', 'chat', 'claude-sonnet-5', 1, 'completa', 'afirmacion', 25, 2, 3, 120000);
  insert into r values ('insert_con_telemetria_y_kinds_nuevos', true, null);
exception when others then insert into r values ('insert_con_telemetria_y_kinds_nuevos', false, sqlerrm); end $$;

-- 5. Lo que no debe entrar.
do $$ begin
  insert into public.coach_runs(user_id, kind, tools_offered) values ('00000000-0000-4000-8000-0000000c4701', 'chat', -1);
  insert into r values ('negativo_rechazado', false, 'entró tools_offered = -1');
exception when check_violation then insert into r values ('negativo_rechazado', true, sqlerrm); end $$;
do $$ begin
  insert into public.coach_runs(user_id, kind, route) values ('00000000-0000-4000-8000-0000000c4701', 'chat', repeat('x', 41));
  insert into r values ('ruta_larga_rechazada', false, 'entró una ruta de 41');
exception when check_violation then insert into r values ('ruta_larga_rechazada', true, sqlerrm); end $$;
do $$ begin
  insert into public.coach_runs(user_id, kind) values ('00000000-0000-4000-8000-0000000c4701', 'inventado');
  insert into r values ('kind_inventado_rechazado', false, 'entró kind inventado');
exception when check_violation then insert into r values ('kind_inventado_rechazado', true, sqlerrm); end $$;

-- 6. RLS sin cambios: el usuario lee lo suyo y no escribe en el libro de gasto.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000c4701","role":"authenticated"}';
-- coach_threads es de salud: la escribe el propio usuario (auth.uid()), con consentimiento.
do $$ begin
  insert into public.coach_threads(user_id, summary) values ('00000000-0000-4000-8000-0000000c4701', repeat('x', 8001));
  insert into r values ('resumen_largo_rechazado', false, 'entró un resumen de 8001');
exception when check_violation then insert into r values ('resumen_largo_rechazado', true, sqlerrm); end $$;
do $$ begin
  insert into public.coach_threads(user_id, summary, summary_until) values ('00000000-0000-4000-8000-0000000c4701', 'Resumen corto', now());
  insert into r values ('resumen_valido_entra', true, null);
exception when others then insert into r values ('resumen_valido_entra', false, sqlerrm); end $$;
insert into r select 'usuario_lee_su_telemetria', count(*) = 4, null from public.coach_runs where route is not null or kind = 'chat';
do $$ begin
  insert into public.coach_runs(user_id, kind, route) values ('00000000-0000-4000-8000-0000000c4701', 'chat', 'completa');
  insert into r values ('usuario_no_escribe_el_libro', false, 'insertó en coach_runs');
exception when others then insert into r values ('usuario_no_escribe_el_libro', true, sqlerrm); end $$;
reset role;
insert into r select 'anon_sin_lectura', not has_table_privilege('anon', 'public.coach_runs', 'SELECT') or not exists (
  select 1 from pg_policy where polrelid = 'public.coach_runs'::regclass and 'anon'::regrole::oid = any(polroles)), null;

select * from r order by ok, caso;
