-- Test de 0060_export_consolidada.sql. Se ejecuta con rosql.mjs (BEGIN…ROLLBACK): nada queda escrito.
-- Montaje: sustituir la línea-marcador MIGRACION (más abajo) por 0060_export_consolidada.sql SIN sus líneas
-- begin;/commit;. Variante con la 0049: poner delante, en el mismo marcador, el SQL de la 0049 (sin su bloque
-- de exportación o con él: la 0060 va detrás y la reemplaza). Solo cuentas ficticias @example.invalid.
-- A invita a B a NIVL, A es dueña de una liga con B dentro, A reta a B, ambas tienen fotos de progreso (18+ y
-- salud aceptada), scorecards, insignias y pasos (si existe la tabla). B además tiene su propia liga y textos
-- marcados que NO deben aparecer en el volcado de A.
create temp table r(step text, result text); grant all on r to public;

-- (5) huellas ANTES
insert into r select '5a huella 0060 antes (false)',
  coalesce(obj_description('public.export_my_data()'::regprocedure,'pg_proc') like '%nivl:export-v5%', false)::text;
insert into r select '5b huella 0044 antes (true)',
  coalesce(obj_description('public.export_my_data()'::regprocedure,'pg_proc') like '%nivl:export-completo%', false)::text;

-- @@MIGRACION@@

-- (5) huellas DESPUÉS
insert into r select '5c huella 0060 despues (true)',
  coalesce(obj_description('public.export_my_data()'::regprocedure,'pg_proc') like '%nivl:export-v5%', false)::text;
insert into r select '5d huella 0044 despues (true)',
  coalesce(obj_description('public.export_my_data()'::regprocedure,'pg_proc') like '%nivl:export-completo%', false)::text;
insert into r select '5e security definer + search_path fijo + sin anon',
  (select format('secdef=%s config=%s anon=%s auth=%s', p.prosecdef, p.proconfig,
     has_function_privilege('anon', p.oid, 'execute'), has_function_privilege('authenticated', p.oid, 'execute'))
   from pg_proc p where p.oid = 'public.export_my_data()'::regprocedure);

-- Cuentas ficticias
insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data) values
 ('e0600a00-0000-4000-8000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','export60-a@example.invalid','',now(),now(),now(),'{}','{}'),
 ('e0600b00-0000-4000-8000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','export60-b@example.invalid','',now(),now(),now(),'{}','{}');
insert into public.profiles(id) values ('e0600a00-0000-4000-8000-00000000000a'), ('e0600b00-0000-4000-8000-00000000000b') on conflict (id) do nothing;
update public.profiles set name = 'NombreDeA' where id = 'e0600a00-0000-4000-8000-00000000000a';
update public.profiles set name = 'NombreSecretoDeB' where id = 'e0600b00-0000-4000-8000-00000000000b';
insert into public.health_state(user_id, accepted, version) values
 ('e0600a00-0000-4000-8000-00000000000a', true, public.health_consent_version()),
 ('e0600b00-0000-4000-8000-00000000000b', true, public.health_consent_version())
on conflict (user_id) do update set accepted = true, version = excluded.version;
insert into public.adult_confirmations(user_id) values ('e0600a00-0000-4000-8000-00000000000a'), ('e0600b00-0000-4000-8000-00000000000b');
-- Amistad (v4) e invitación a NIVL (0045)
insert into public.friendships(requester, addressee, status) values ('e0600a00-0000-4000-8000-00000000000a','e0600b00-0000-4000-8000-00000000000b','accepted');
insert into public.invites(invitee, inviter, status, settled_at) values ('e0600b00-0000-4000-8000-00000000000b','e0600a00-0000-4000-8000-00000000000a','activa', now());
insert into public.invite_rewards(user_id, kind) values ('e0600a00-0000-4000-8000-00000000000a','reclutador');
-- Ligas (0048): la de A con B dentro e invitación pendiente; la de B, ajena a A.
insert into public.private_leagues(id, owner, name) values
 ('1a600000-0000-4000-8000-0000000000a1','e0600a00-0000-4000-8000-00000000000a','Liga de A'),
 ('1a600000-0000-4000-8000-0000000000b1','e0600b00-0000-4000-8000-00000000000b','LigaSecretaDeB');
insert into public.league_members(league_id, user_id) values
 ('1a600000-0000-4000-8000-0000000000a1','e0600a00-0000-4000-8000-00000000000a'),
 ('1a600000-0000-4000-8000-0000000000a1','e0600b00-0000-4000-8000-00000000000b'),
 ('1a600000-0000-4000-8000-0000000000b1','e0600b00-0000-4000-8000-00000000000b');
insert into public.league_invites(league_id, invitee) values ('1a600000-0000-4000-8000-0000000000a1','e0600b00-0000-4000-8000-00000000000b');
-- Duelo A (retador) contra B, ya resuelto: gana A.
insert into public.duels(id, challenger, opponent, week_start, status, result) values
 ('d0600000-0000-4000-8000-000000000001','e0600a00-0000-4000-8000-00000000000a','e0600b00-0000-4000-8000-00000000000b', date '2026-09-21', 'done', '{"retador":"gano"}');
insert into public.daily_scorecards(user_id, day, programadas_xp, cumplidas_xp) values
 ('e0600a00-0000-4000-8000-00000000000a', date '2026-09-30', 200, 150),
 ('e0600b00-0000-4000-8000-00000000000b', date '2026-09-30', 300, 299);
-- Rango (0051) en achievements
insert into public.achievements(user_id, code) values ('e0600a00-0000-4000-8000-00000000000a','rango_S');
-- Fotos de progreso (0050) y sus objetos en el bucket privado 'progress'
-- health_consent_ok() exige auth.uid() = dueño: cada alta de salud se hace con la sesión de su dueña.
select set_config('request.jwt.claims', '{"sub":"e0600a00-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into public.progress_photos(id, user_id, taken_on, pose, path) values
 ('a0600000-0000-4000-8000-0000000000a1','e0600a00-0000-4000-8000-00000000000a', date '2026-09-30','frente','e0600a00-0000-4000-8000-00000000000a/a0600000-0000-4000-8000-0000000000a1.jpg');
select set_config('request.jwt.claims', '{"sub":"e0600b00-0000-4000-8000-00000000000b","role":"authenticated"}', true);
insert into public.progress_photos(id, user_id, taken_on, pose, path) values
 ('b0600000-0000-4000-8000-0000000000b1','e0600b00-0000-4000-8000-00000000000b', date '2026-09-30','lado','e0600b00-0000-4000-8000-00000000000b/b0600000-0000-4000-8000-0000000000b1.webp');
insert into storage.objects(bucket_id, name, owner, owner_id, metadata) values
 ('progress','e0600a00-0000-4000-8000-00000000000a/a0600000-0000-4000-8000-0000000000a1.jpg','e0600a00-0000-4000-8000-00000000000a','e0600a00-0000-4000-8000-00000000000a','{"size":1000,"mimetype":"image/jpeg"}'),
 ('progress','e0600b00-0000-4000-8000-00000000000b/b0600000-0000-4000-8000-0000000000b1.webp','e0600b00-0000-4000-8000-00000000000b','e0600b00-0000-4000-8000-00000000000b','{"size":2000,"mimetype":"image/webp"}');
-- Texto marcado de B en una tabla propia suya
insert into public.journal_entries(user_id, date, text) values ('e0600b00-0000-4000-8000-00000000000b', date '2026-09-30', 'TextoPrivadoDeB');
-- Pasos (0049) solo si la tabla existe
do $$ begin
  if to_regclass('public.health_daily_steps') is not null then
    perform set_config('request.jwt.claims', '{"sub":"e0600a00-0000-4000-8000-00000000000a","role":"authenticated"}', true);
    execute $i$insert into public.health_daily_steps(user_id, date, source, steps) values
      ('e0600a00-0000-4000-8000-00000000000a', date '2026-09-30', 'healthkit', 8123)$i$;
    perform set_config('request.jwt.claims', '{"sub":"e0600b00-0000-4000-8000-00000000000b","role":"authenticated"}', true);
    execute $i$insert into public.health_daily_steps(user_id, date, source, steps) values
      ('e0600b00-0000-4000-8000-00000000000b', date '2026-09-30', 'health_connect', 4321)$i$;
  end if;
end $$;

-- Sin sesión
create function pg_temp.sin_sesion() returns text language plpgsql as $$
begin perform public.export_my_data(); return 'SIN ERROR (mal)'; exception when others then return sqlstate || ' ' || sqlerrm; end $$;
grant execute on function pg_temp.sin_sesion() to public;
set local role authenticated;
select set_config('request.jwt.claims', '', true);
insert into r select '0 sin auth.uid() (42501)', pg_temp.sin_sesion();

-- Volcados de A y de B, como authenticated
select set_config('request.jwt.claims', '{"sub":"e0600a00-0000-4000-8000-00000000000a","role":"authenticated"}', true);
create temp table da as select public.export_my_data() j;
select set_config('request.jwt.claims', '{"sub":"e0600b00-0000-4000-8000-00000000000b","role":"authenticated"}', true);
create temp table db as select public.export_my_data() j;
reset role;

-- (1) versión y claves de v4
insert into r select '1a version (5)', j->>'version' from da;
insert into r select '1b claves v4 ausentes (ninguna)', coalesce((select string_agg(t, ',') from unnest(array['app','version','exported_at',
  'profiles','quests','completions','events','dungeons','dungeon_tasks','calendar_events','gym_days','gym_exercises','gym_sessions','gym_lifts',
  'meal_slots','shopping_items','journal_entries','achievements','rules','rule_breaks','bonus_redemptions','journal_photos','letters','body_metrics',
  'goals','coach_dossier','coach_facts','coach_threads','coach_messages','day_plans','day_blocks','body_profile','cardio_sessions','nutrition_targets',
  'nutrition_logs','training_prescriptions','money_accounts','transactions','category_rules','budgets','money_plan','quest_photos','recaps','rule_checks',
  'ai_consents','health_consents','health_state','health_erasure_jobs','age_confirmations','subscriptions','coach_runs','oracle_usage','push_tokens',
  'social_profile_reviews','social_avatar_paths','elite_group_requests','store_reconciliation','account_erasure_jobs','friend_request_log',
  'recovery_credits','xp_daily_ledger','xp_once','friendships','social_blocks','social_reports','elite_group_members','referrals','ai_reports',
  'store_sales','storage_objects']) t where not (da.j ? t)), 'ninguna') from da;
insert into r select '1c claves nuevas', (select string_agg(t || '=' || jsonb_array_length(j->t), ' ' order by t) from unnest(array['progress_photos',
  'adult_confirmations','daily_scorecards','invite_rewards','invites','private_leagues','league_members','league_invites','duels']) t) from da;
insert into r select '1d achievements con rango_S (true)', (j->'achievements')::text like '%rango_S%' from da;
insert into r select '1e storage_objects progress de A', (select string_agg(o->>'bucket' || ':' || (o->>'bytes'), ',') from jsonb_array_elements(j->'storage_objects') o) from da;

-- (2) cobertura automática: tablas de public con columnas de persona sin clave en el volcado
insert into r select '2 tablas con persona SIN cubrir (ninguna)', coalesce((select string_agg(distinct c.table_name, ',')
  from information_schema.columns c join information_schema.tables x using (table_schema, table_name)
  where c.table_schema = 'public' and x.table_type = 'BASE TABLE'
    and c.column_name in ('user_id','requester','addressee','reporter','subject','blocker','blocked','inviter','invitee',
                          'owner','challenger','opponent','app_user_id','creator_id')
    and not (da.j ? c.table_name)
    and c.table_name not in (
      'ai_turn_locks',   -- cerrojo transitorio de concurrencia del coach (0020): solo user_id+started_at, segundos de vida
      'creators',        -- programa de creadores: relación contractual B2B; mismo criterio que 0040/0044 (canal propio)
      'commissions',     -- comisiones del creador (creator_id → creators): misma exclusión que creators
      'creator_payouts', -- pagos al creador (creator_id → creators): misma exclusión que creators
      'store_events'     -- registro bruto del webhook de RevenueCat (servicio); los hechos van en subscriptions/store_sales
    )), 'ninguna') from da;

-- (3) aislamiento: ningún uuid que no sea A o id de una fila propia de A; nada de B
create temp table own_ids(id text); grant all on own_ids to public;
do $$ declare t record; c record; begin
  insert into own_ids values ('e0600a00-0000-4000-8000-00000000000a');
  for t in select distinct table_name from information_schema.columns where table_schema='public' and column_name='user_id' loop
    for c in select column_name from information_schema.columns where table_schema='public' and table_name=t.table_name and data_type='uuid' loop
      execute format('insert into own_ids select %I::text from public.%I where user_id=$1 and %I is not null', c.column_name, t.table_name, c.column_name)
        using 'e0600a00-0000-4000-8000-00000000000a'::uuid;
    end loop;
  end loop;
end $$;
insert into r select '3a uuids ajenos en el volcado de A (ninguno)', coalesce((select string_agg(distinct m[1], ',')
  from regexp_matches(da.j::text, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', 'g') m
  where m[1] not in (select id from own_ids)), 'ninguno') from da;
insert into r select '3b uuid de B / email de B / textos de B en A (todo false)', format('uuidB=%s emailB=%s nombreB=%s ligaB=%s diarioB=%s fotoB=%s liga_id=%s duelo_id=%s',
  j::text like '%e0600b00%', j::text like '%export60-b%', j::text like '%NombreSecretoDeB%', j::text like '%LigaSecretaDeB%',
  j::text like '%TextoPrivadoDeB%', j::text like '%b0600000%', j::text like '%1a600000%', j::text like '%d0600000%') from da;
insert into r select '3c invites de A', (j->'invites')::text from da;
insert into r select '3d league_members / league_invites de A', (j->'league_members')::text || ' || ' || (j->'league_invites')::text from da;
insert into r select '3e duels de A', (j->'duels')::text from da;
insert into r select '3f private_leagues de A', (j->'private_leagues')::text from da;
insert into r select '3g B: sin uuid ni email de A; ve la liga de A como miembro', format('uuidA=%s emailA=%s nombreA=%s invites=%s duels=%s league_invites=%s',
  j::text like '%e0600a00%', j::text like '%export60-a%', j::text like '%NombreDeA%',
  (j->'invites')::text, (j->'duels'->0->>'rol') || '/' || (j->'duels'->0->>'resultado_para_mi'), (j->'league_invites')::text) from db;

-- (4) pasos importados
insert into r select '4 health_daily_steps (tabla existe=' || (to_regclass('public.health_daily_steps') is not null) || ')',
  case when to_regclass('public.health_daily_steps') is null then 'clave presente=' || (j ? 'health_daily_steps')
       else 'clave presente=' || (j ? 'health_daily_steps') || ' filas=' || jsonb_array_length(j->'health_daily_steps')
            || ' pasos=' || coalesce(j->'health_daily_steps'->0->>'steps', '-') end from da;

select jsonb_agg(jsonb_build_object('s', step, 'r', result) order by step) from r;
