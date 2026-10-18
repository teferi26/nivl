-- NIVL · Modos F1 (servidor): prueba de 0066 a 0069 DENTRO DE UNA TRANSACCIÓN QUE SE REVIERTE.
--
-- Uso: con 0066 a 0069 ya aplicadas en la base que se prueba (local, rama de Supabase o, si el coordinador
-- lo decide, producción), ejecutar el archivo ENTERO de una vez (rosql.mjs, psql -f o el SQL Editor).
-- Empieza con BEGIN y acaba con ROLLBACK: no queda escrito nada (ni las cuentas ficticias *.invalid, ni el
-- interruptor encendido, ni los eventos de tienda). Devuelve una fila por comprobación: (paso, ok, detalle).
-- Todo ok = true. Si una sentencia falla, la transacción aborta y el ROLLBACK final la deshace igual.
-- También lo ejecuta scripts/test-modos-f1.mjs contra PGlite con todas las migraciones reales.
--
-- Comprueba: RLS de app_config, user_modes, mode_xp y profiles.locale; que un usuario sin modos se comporta
-- igual (XP, completions, sin XP por modo, sin prueba, ai_state sin claves nuevas); el XP por modo; y que la
-- prueba automática nace solo encendida, no pisa una suscripción activa, tiene tope diario y cede a una compra.
begin;

create temp table r(paso text primary key, ok boolean not null, detalle text);
grant all on r to public;

-- Cuentas ficticias. handle_new_user crea su perfil; el interruptor de la prueba está apagado.
insert into auth.users(id, email, raw_user_meta_data) values
  ('f1000000-0000-4000-8000-0000000000e1', 'f1-e@example.invalid', '{"full_name":"F1 sin modos"}'),
  ('f1000000-0000-4000-8000-0000000000f2', 'f1-f@example.invalid', '{}'),
  ('f1000000-0000-4000-8000-0000000000c3', 'f1-c@example.invalid', '{}');
insert into public.recovery_credits(user_id, xp) values ('f1000000-0000-4000-8000-0000000000e1', 100)
  on conflict (user_id) do update set xp = 100;

insert into r select '01 interruptor apagado: sin prueba al nacer', count(*) = 0, count(*)::text
  from public.subscriptions where user_id in ('f1000000-0000-4000-8000-0000000000e1','f1000000-0000-4000-8000-0000000000f2','f1000000-0000-4000-8000-0000000000c3');
insert into r select '02 las seis claves del contrato son públicas',
  public.app_flags() ?& array['modos_activos','idiomas_activos','prueba_auto_activa','prueba_auto_dias','prueba_ia_mensajes_dia','valoracion_activa'],
  public.app_flags()::text;

-- ── Usuario sin modos (1.0.9) ─────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true),
       set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-0000000000e1', true),
       set_config('request.jwt.claim.role', 'authenticated', true);
insert into public.quests(id, title, stat, difficulty)
  values ('f1a00000-0000-4000-8000-000000000001', 'Leer 20 minutos', 'INT', 'media');
insert into public.quests(id, title, stat, difficulty, modes)
  values ('f1a00000-0000-4000-8000-000000000002', 'Estudiar tema 4', 'INT', 'media', '{focus,work}');
create temp table c1 as select public.complete_quest('f1a00000-0000-4000-8000-000000000001', (now() at time zone 'Europe/Madrid')::date, 50, 0, true, null) j;
insert into r select '03 sin modos: paga igual (xp_total = 50, completion 50)',
  (j->'profile'->>'xp_total')::int = 50 and (select xp_awarded from public.completions where quest_id = 'f1a00000-0000-4000-8000-000000000001') = 50,
  j->'profile'->>'xp_total' from c1;
insert into r select '04 sin modos: no toca mode_xp', count(*) = 0, count(*)::text from public.mode_xp;
insert into r select '05 quests.modes por defecto {}', modes = '{}'::text[], modes::text
  from public.quests where id = 'f1a00000-0000-4000-8000-000000000001';
create temp table c2 as select public.complete_quest('f1a00000-0000-4000-8000-000000000002', (now() at time zone 'Europe/Madrid')::date, 50, 0, true, null) j;
insert into r select '06 con modos: xp_total suma igual (100)', (j->'profile'->>'xp_total')::int = 100, j->'profile'->>'xp_total' from c2;
insert into r select '07 con modos: focus y work suman 50 cada uno',
  coalesce((select string_agg(mode || '=' || xp, ',' order by mode) from public.mode_xp), '') = 'focus=50,work=50',
  coalesce((select string_agg(mode || '=' || xp, ',' order by mode) from public.mode_xp), '');
create temp table c3 as select public.complete_quest('f1a00000-0000-4000-8000-000000000002', (now() at time zone 'Europe/Madrid')::date, 50, 0, true, null) j;
insert into r select '08 doble toque: ni XP ni modos', (j->>'awarded')::boolean = false
  and (select sum(xp) from public.mode_xp) = 100, j->>'awarded' from c3;
insert into public.user_modes(mode) values ('iron'), ('focus');
update public.profiles set locale = 'en' where id = 'f1000000-0000-4000-8000-0000000000e1';
insert into r select '09 locale editable por su dueño', locale = 'en', locale from public.profiles where id = 'f1000000-0000-4000-8000-0000000000e1';
do $$ begin
  update public.profiles set locale = 'no es un idioma' where id = 'f1000000-0000-4000-8000-0000000000e1';
  insert into r values ('10 locale raro rechazado', false, 'aceptado');
exception when check_violation then insert into r values ('10 locale raro rechazado', true, 'check');
end $$;
do $$ begin
  insert into public.mode_xp(user_id, mode, xp) values ('f1000000-0000-4000-8000-0000000000e1', 'iron', 99999);
  insert into r values ('11 el cliente no escribe mode_xp', false, 'escrito');
exception when insufficient_privilege then insert into r values ('11 el cliente no escribe mode_xp', true, '42501');
end $$;
do $$ begin
  insert into public.quests(title, stat, difficulty, modes) values ('x', 'INT', 'media', '{general}');
  insert into r values ('12 modo desconocido rechazado', false, 'aceptado');
exception when check_violation then insert into r values ('12 modo desconocido rechazado', true, 'check');
end $$;
do $$ begin
  update public.app_config set value = 'true' where key = 'modos_activos';
  insert into r values ('13 authenticated no enciende interruptores', not found, case when found then 'cambiado' else '0 filas' end);
exception when insufficient_privilege then insert into r values ('13 authenticated no enciende interruptores', true, '42501');
end $$;
create temp table e1 as select public.export_my_data() j;
insert into r select '14 exportación v8 o posterior (v9 con la 0072) con user_modes y mode_xp',
  (j->>'version')::int >= 8 and jsonb_array_length(j->'user_modes') = 2 and jsonb_array_length(j->'mode_xp') = 2, j->>'version' from e1;

-- ── Otra cuenta: RLS de dueño ─────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-4000-8000-0000000000f2","role":"authenticated"}', true),
       set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-0000000000f2', true);
insert into r select '15 RLS: no ve modos ni XP por modo ajenos',
  (select count(*) from public.user_modes) = 0 and (select count(*) from public.mode_xp) = 0, null;
do $$ begin
  insert into public.user_modes(user_id, mode) values ('f1000000-0000-4000-8000-0000000000e1', 'work');
  insert into r values ('16 RLS: no escribe modos ajenos', false, 'escrito');
exception when insufficient_privilege then insert into r values ('16 RLS: no escribe modos ajenos', true, '42501');
end $$;
update public.user_modes set enabled = false;
update public.profiles set locale = 'fr' where id = 'f1000000-0000-4000-8000-0000000000e1';
reset role;
insert into r select '17 RLS: no cambia modos ni locale ajenos',
  (select bool_and(enabled) from public.user_modes where user_id = 'f1000000-0000-4000-8000-0000000000e1')
  and (select locale from public.profiles where id = 'f1000000-0000-4000-8000-0000000000e1') = 'en', null;

-- ── anon ──────────────────────────────────────────────────────────────
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true), set_config('request.jwt.claim.sub', '', true),
       set_config('request.jwt.claim.role', 'anon', true);
insert into r select '18 anon lee los interruptores públicos', (select count(*) from jsonb_object_keys(public.app_flags())) >= 6, null;
do $$ begin
  perform 1 from public.user_modes;
  insert into r values ('19 anon no lee user_modes', false, 'leído');
exception when insufficient_privilege then insert into r values ('19 anon no lee user_modes', true, '42501');
end $$;
do $$ begin
  update public.app_config set value = 'true' where key = 'prueba_auto_activa';
  insert into r values ('20 anon no enciende interruptores', not found, case when found then 'cambiado' else '0 filas' end);
exception when insufficient_privilege then insert into r values ('20 anon no enciende interruptores', true, '42501');
end $$;
reset role;

-- ── Prueba automática (servidor) ──────────────────────────────────────
insert into r select '21 sin suscripción: ai_state como siempre (sin tope)',
  (s->>'entitled')::boolean = false and not (s ? 'tope_dia') and (s->>'trial_available')::boolean, s::text
  from (select public.ai_state('f1000000-0000-4000-8000-0000000000e1') s) x;
-- C ya pagó: su compra está antes de que se encienda el interruptor.
insert into public.subscriptions(user_id, status, plan, provider, current_period_end, store_product_id)
  values ('f1000000-0000-4000-8000-0000000000c3', 'active', 'pro_anual', 'apple', now() + interval '300 days', 'nivl_pro_anual');
update public.app_config set value = 'true' where key = 'prueba_auto_activa';
insert into auth.users(id, email) values ('f1000000-0000-4000-8000-0000000000d4', 'f1-t@example.invalid');
insert into r select '22 encendido: nace la prueba de 2 días',
  status = 'trialing' and plan = 'prueba_auto' and provider = 'prueba'
  and current_period_end between now() + interval '47 hours' and now() + interval '49 hours', status || ' ' || plan
  from public.subscriptions where user_id = 'f1000000-0000-4000-8000-0000000000d4';
-- El perfil de C se recrea con el interruptor encendido: la prueba no pisa su compra.
delete from public.profiles where id = 'f1000000-0000-4000-8000-0000000000c3';
insert into public.profiles(id) values ('f1000000-0000-4000-8000-0000000000c3');
insert into r select '23 la prueba no pisa una suscripción activa', status = 'active' and plan = 'pro_anual' and provider = 'apple',
  status || ' ' || plan || ' ' || provider from public.subscriptions where user_id = 'f1000000-0000-4000-8000-0000000000c3';
insert into r select '24 prueba: Élite con Haiku, sin profundo, tope 20',
  (s->>'entitled')::boolean and (s->>'trial')::boolean and s->>'tier' = 'elite' and s->'routes'->>'default' = 'claude-haiku-4-5'
  and not (s->>'deep_allowed')::boolean and (s->>'tope_dia')::int = 20, s::text
  from (select public.ai_state('f1000000-0000-4000-8000-0000000000d4') s) x;
insert into public.coach_runs(user_id, kind, model, cost_micro_usd)
  select 'f1000000-0000-4000-8000-0000000000d4', 'chat', 'claude-haiku-4-5', 1000 from generate_series(1, 20);
insert into r select '25 tope diario de mensajes', s->>'reason' = 'tope_diario' and not (s->>'allowed')::boolean, s->>'reason'
  from (select public.ai_begin_turn('f1000000-0000-4000-8000-0000000000d4', 'estandar') s) x;
select public.apply_store_event(jsonb_build_object(
  'id', 'f1-prueba-evento-sandbox', 'type', 'INITIAL_PURCHASE', 'app_user_id', 'f1000000-0000-4000-8000-0000000000d4',
  'environment', 'SANDBOX', 'store', 'APP_STORE', 'product_id', 'nivl_pro_mensual', 'period_type', 'NORMAL',
  'original_transaction_id', 'f1-orig', 'transaction_id', 'f1-tx',
  'purchased_at_ms', (extract(epoch from now()) * 1000)::bigint,
  'expiration_at_ms', (extract(epoch from now() + interval '30 days') * 1000)::bigint));
insert into r select '26 una compra sustituye a la prueba', plan = 'pro_mensual' and provider = 'apple' and status = 'active',
  status || ' ' || plan || ' ' || provider from public.subscriptions where user_id = 'f1000000-0000-4000-8000-0000000000d4';
insert into r select '27 user_tier de la compra', public.user_tier('f1000000-0000-4000-8000-0000000000d4') = 'pro', null;

select paso, ok, detalle from r order by paso;
rollback;
