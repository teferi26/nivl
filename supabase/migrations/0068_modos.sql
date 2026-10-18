-- NIVL · 0068 · Modos: etiquetas en misiones, modos del usuario y XP por modo (Modos, fase 1; contrato
-- MODOS-F1-CONTRATO.md, 18/10/2026; spec NIVL_MODOS_PROPUESTA.md §3 «marcar una vez, se ve en todas partes»).
-- Huella para scripts/apply-migrations.mjs:
--   coalesce(obj_description(to_regprocedure('public.export_my_data()'), 'pg_proc') like '%nivl:export-modos-0068%', false)
-- Prueba: scripts/test-modos-f1.mjs (PGlite, todas las migraciones reales: misma XP global con y sin modos,
-- export idéntico para un usuario 1.0.9, RLS) y scripts/probar-f1-servidor.sql (BEGIN…ROLLBACK).
--
-- Una sola fuente de verdad: una misión es UNA fila de quests con etiquetas de modo. Se marca una vez
-- (complete_quest, sin tocar) y cuenta en General y en cada uno de sus modos.
--
--   · quests.modes text[] not null default '{}' ⊆ {iron, focus, work, founder}. General no se guarda: lo es
--     todo. Un trigger «a0_» (como el de la 0061) convierte NULL en '{}': supabase-js manda NULL en las
--     claves que faltan en un insert de varias filas, y eso no puede tumbar el lote de la 1.0.9 ni de la nueva.
--   · public.user_modes(user_id, mode, enabled, created_at): los modos que activa cada usuario
--     (onboarding/ajustes). RLS de dueño: lee y escribe solo lo suyo.
--   · public.mode_xp(user_id, mode, xp bigint, updated_at): XP acumulada por modo. Solo lectura para su
--     dueño; la escribe ÚNICAMENTE el trigger de abajo (ni el cliente ni el coach la tocan a mano).
--
-- XP por modo SIN reescribir complete_quest ni award_xp: un trigger AFTER INSERT en completions. Toda
-- completion pasa por complete_quest desde la 0035 (insert revocado a anon/authenticated), así que el
-- trigger ve exactamente lo que se ha pagado (completions.xp_awarded) y nada más:
--   · modes vacío → no hace nada (usuario 1.0.9: idéntico byte a byte; complete_quest devuelve lo mismo).
--   · misión extra (is_bonus, paga PB, xp_awarded = 0) o de penalización (is_penalty: restaura XP que
--     ningún modo perdió) → no suma. Así el XP por modo nunca supera al que entró en xp_total.
--   · ON CONFLICT DO NOTHING de complete_quest (doble toque) no inserta fila → no hay doble suma.
--   · El XP por modo NUNCA baja (como las stats): el cierre del día resta xp_total, no los modos.
--     Decisión de diseño de la fase 1 (nivl-game-design, invariante 1): el nivel por modo mide lo hecho.
--   · Duplicados en modes ('{iron,iron}') suman una vez.
--
-- Exportación (RGPD arts. 15 y 20; regla de AGENTS.md): export_my_data v8 = la v7 de la 0064 copiada SIN
-- CAMBIOS + user_modes y mode_xp en la lista de tablas propias. Misma firma, mismos permisos, mismas claves:
-- solo AÑADE dos. La columna quests.modes ya viaja en la fila completa de quests.
-- Borrado de cuenta: las dos tablas cuelgan de auth.users ON DELETE CASCADE (account-erasure borra Auth al
-- final) y llevan el guard de escritura de la 0031 (account_write_guard), como cualquier tabla con user_id.
--
-- Compatibilidad con la 1.0.9: ADITIVA. Columna con default constante (sin reescribir la tabla), tablas y
-- funciones nuevas; export_my_data con la misma firma. complete_quest, award_xp y close_day_v2 no se tocan.
--
-- Marcha atrás (el export v7 se restaura re-ejecutando su bloque de la 0064):
--   drop trigger if exists mode_xp_on_completion on public.completions;
--   drop function if exists public._mode_xp_on_completion();
--   drop table if exists public.mode_xp; drop table if exists public.user_modes;
--   drop trigger if exists a0_modes_nulo on public.quests; drop function if exists public._quests_modes_nulo();
--   alter table public.quests drop constraint if exists quests_modes_check; alter table public.quests drop column if exists modes;
-- Re-ejecutable.
begin;

-- ── 1. Etiquetas de modo en la misión ───────────────────────────────
alter table public.quests add column if not exists modes text[] not null default '{}';

alter table public.quests drop constraint if exists quests_modes_check;
alter table public.quests add constraint quests_modes_check check (
  cardinality(modes) <= 4
  and array_position(modes, null) is null
  and modes <@ array['iron', 'focus', 'work', 'founder']::text[]
);

comment on column public.quests.modes is
  'nivl:modos-0068 · Modos en los que cuenta la misión (iron, focus, work, founder). Vacío = solo General, como la 1.0.9.';

create or replace function public._quests_modes_nulo() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.modes is null then
    new.modes := '{}'::text[];
  end if;
  return new;
end $$;
revoke all on function public._quests_modes_nulo() from public, anon, authenticated;
comment on function public._quests_modes_nulo() is 'nivl:0068 quests.modes NULL -> {}';
drop trigger if exists a0_modes_nulo on public.quests;
create trigger a0_modes_nulo before insert or update on public.quests
  for each row execute function public._quests_modes_nulo();

-- ── 2. Modos del usuario ────────────────────────────────────────────
create table if not exists public.user_modes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mode text not null check (mode in ('iron', 'focus', 'work', 'founder')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, mode)
);
alter table public.user_modes enable row level security;
revoke all on public.user_modes from public, anon, authenticated;
grant select, insert, update, delete on public.user_modes to authenticated;
grant all on public.user_modes to service_role;

drop policy if exists "own user_modes" on public.user_modes;
create policy "own user_modes" on public.user_modes
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists account_write_guard on public.user_modes;
create trigger account_write_guard before insert or update on public.user_modes
  for each row execute function public.require_account_active('user_id');

comment on table public.user_modes is
  'nivl:modos-0068 · Modos activados por el usuario. General siempre está y no se guarda.';

-- ── 3. XP por modo ─────────────────────────────────────────────────
create table if not exists public.mode_xp (
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null check (mode in ('iron', 'focus', 'work', 'founder')),
  xp bigint not null default 0 check (xp >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, mode)
);
alter table public.mode_xp enable row level security;
revoke all on public.mode_xp from public, anon, authenticated;
grant select on public.mode_xp to authenticated;
grant all on public.mode_xp to service_role;

drop policy if exists "own mode_xp read" on public.mode_xp;
create policy "own mode_xp read" on public.mode_xp
  for select to authenticated
  using (auth.uid() = user_id);

drop trigger if exists account_write_guard on public.mode_xp;
create trigger account_write_guard before insert or update on public.mode_xp
  for each row execute function public.require_account_active('user_id');

comment on table public.mode_xp is
  'nivl:modos-0068 · XP acumulada por modo. Solo la escribe el trigger mode_xp_on_completion (lo pagado en completions).';

create or replace function public._mode_xp_on_completion() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_modes text[];
  v_penalty boolean;
  v_bonus boolean;
begin
  if coalesce(new.xp_awarded, 0) <= 0 then return null; end if;
  select q.modes, q.is_penalty, q.is_bonus into v_modes, v_penalty, v_bonus
    from public.quests q where q.id = new.quest_id and q.user_id = new.user_id;
  if not found or coalesce(cardinality(v_modes), 0) = 0
     or coalesce(v_penalty, false) or coalesce(v_bonus, false) then
    return null;
  end if;
  insert into public.mode_xp as m (user_id, mode, xp, updated_at)
    select new.user_id, x.mode, new.xp_awarded, now()
    from (select distinct unnest(v_modes) as mode) x
    where x.mode in ('iron', 'focus', 'work', 'founder')
  on conflict (user_id, mode) do update set xp = m.xp + excluded.xp, updated_at = excluded.updated_at;
  return null;
end $$;
revoke all on function public._mode_xp_on_completion() from public, anon, authenticated;
comment on function public._mode_xp_on_completion() is
  'nivl:modos-0068 · Suma completions.xp_awarded a cada modo de la misión. modes vacío, extra o penalización: nada.';

drop trigger if exists mode_xp_on_completion on public.completions;
create trigger mode_xp_on_completion after insert on public.completions
  for each row execute function public._mode_xp_on_completion();

-- ── 4. Exportación v8: la v7 (0064) intacta + user_modes y mode_xp ──
create or replace function public.export_my_data() returns jsonb
language plpgsql security definer set search_path=public, pg_temp as $$
declare u uuid:=auth.uid(); t text; rows jsonb;
  result jsonb:=jsonb_build_object('app','NIVL','version',8,'exported_at',clock_timestamp());
begin
  if u is null then raise exception 'No autenticado' using errcode='42501'; end if;
  -- 1. Igual que 0030 (filas completas) y 2. tablas propias sin terceros (v4 + 0045/0048/0050 + 0068).
  foreach t in array array['profiles','quests','completions','events','dungeons','dungeon_tasks','calendar_events',
    'gym_days','gym_exercises','gym_sessions','gym_lifts','meal_slots','shopping_items','journal_entries','achievements',
    'rules','rule_breaks','bonus_redemptions','journal_photos','letters','body_metrics','goals','coach_dossier',
    'coach_facts','coach_threads','coach_messages','day_plans','day_blocks','body_profile','cardio_sessions',
    'nutrition_targets','nutrition_logs','training_prescriptions','money_accounts','transactions','category_rules',
    'budgets','money_plan','quest_photos','recaps','rule_checks','ai_consents','health_consents','health_state','health_erasure_jobs',
    'age_confirmations','subscriptions','coach_runs','oracle_usage','push_tokens','social_profile_reviews',
    'social_avatar_paths','elite_group_requests','store_reconciliation','account_erasure_jobs','friend_request_log',
    'recovery_credits','xp_daily_ledger','xp_once',
    'progress_photos','adult_confirmations','daily_scorecards','invite_rewards',
    'user_modes','mode_xp'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from public.%I r where %I=$1',
      t,case when t='profiles' then 'id' else 'user_id' end) into rows using u;
    result:=result||jsonb_build_object(t,rows);
  end loop;
  -- Pasos diarios importados (0049): solo si la tabla existe en esta base.
  if to_regclass('public.health_daily_steps') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(r) order by r.date, r.source),''[]''::jsonb) from public.health_daily_steps r where r.user_id=$1'
      into rows using u;
    result:=result||jsonb_build_object('health_daily_steps',rows);
  end if;
  -- 3. Relaciones: solo la parte de la persona (v4, sin cambios).
  result:=result||jsonb_build_object(
    'friendships',(select coalesce(jsonb_agg(jsonb_build_object('rol',case when f.requester=u then 'enviada' else 'recibida' end,
      'status',f.status,'created_at',f.created_at,'accepted_at',f.accepted_at) order by f.created_at),'[]'::jsonb)
      from public.friendships f where u in (f.requester,f.addressee)),
    'social_blocks',(select coalesce(jsonb_agg(jsonb_build_object('created_at',b.created_at) order by b.created_at),'[]'::jsonb)
      from public.social_blocks b where b.blocker=u),
    'social_reports',(select coalesce(jsonb_agg(jsonb_build_object('reason',s.reason,'status',s.status,'created_at',s.created_at,
      'resolved_at',s.resolved_at) order by s.created_at),'[]'::jsonb) from public.social_reports s where s.reporter=u),
    'elite_group_members',(select coalesce(jsonb_agg(jsonb_build_object('joined_at',m.joined_at)),'[]'::jsonb)
      from public.elite_group_members m where m.user_id=u),
    'referrals',(select coalesce(jsonb_agg(jsonb_build_object('creator_code',c.code,'source',r.source,'created_at',r.created_at)),'[]'::jsonb)
      from public.referrals r left join public.creators c on c.id=r.creator_id where r.user_id=u),
    'ai_reports',(select coalesce(jsonb_agg(jsonb_build_object('source',a.source,'message_id',a.message_id,'reason',a.reason,
      'excerpt',a.excerpt,'status',a.status,'created_at',a.created_at,'resolved_at',a.resolved_at) order by a.created_at),'[]'::jsonb)
      from public.ai_reports a where a.reporter=u),
    'store_sales',(select coalesce(jsonb_agg(jsonb_build_object('store',s.store,'product_id',s.product_id,'payment_number',s.payment_number,
      'price_cents',s.price_cents,'currency',s.currency,'purchased_at',s.purchased_at,'refunded_at',s.refunded_at) order by s.purchased_at),'[]'::jsonb)
      from public.store_sales s where s.user_id=u),
    -- Las fotos: la lista de archivos que existen. Los bytes se descargan aparte
    -- con URL firmada (dependencia de UI, ver b-privacidad-borrado.md).
    'storage_objects',(select coalesce(jsonb_agg(jsonb_build_object('bucket',o.bucket_id,'path',o.name,
      'bytes',(o.metadata->>'size')::bigint,'created_at',o.created_at) order by o.bucket_id,o.name),'[]'::jsonb)
      from storage.objects o where o.bucket_id in ('evidence','avatars','progress') and (storage.foldername(o.name))[1]=u::text));
  -- 4. Relaciones nuevas (0045, 0048). Nunca el uuid de la otra parte ni de la fila compartida.
  result:=result||jsonb_build_object(
    -- Invitaciones a NIVL: como invitada (una como mucho) y como quien invita (una por persona invitada).
    'invites',(select coalesce(jsonb_agg(x.o order by x.created_at),'[]'::jsonb) from (
        select i.created_at,jsonb_build_object('rol','recibida','status',i.status,'created_at',i.created_at,'settled_at',i.settled_at) o
          from public.invites i where i.invitee=u
        union all
        select i.created_at,jsonb_build_object('rol','enviada','status',i.status,'created_at',i.created_at,'settled_at',i.settled_at)
          from public.invites i where i.inviter=u) x),
    -- Ligas de las que soy dueña: nombre y fecha; sin ids ni lista de miembros.
    'private_leagues',(select coalesce(jsonb_agg(jsonb_build_object('nombre',l.name,'created_at',l.created_at) order by l.created_at),'[]'::jsonb)
      from public.private_leagues l where l.owner=u),
    -- Mis membresías (incluida la de mis propias ligas).
    'league_members',(select coalesce(jsonb_agg(jsonb_build_object('liga',l.name,'soy_duena',l.owner=u,'joined_at',m.joined_at,
      'liga_created_at',l.created_at) order by m.joined_at),'[]'::jsonb)
      from public.league_members m join public.private_leagues l on l.id=m.league_id where m.user_id=u),
    -- Invitaciones de liga: recibidas por mí, y enviadas desde mis ligas (sin decir a quién).
    'league_invites',(select coalesce(jsonb_agg(x.o order by x.created_at),'[]'::jsonb) from (
        select li.created_at,jsonb_build_object('rol','recibida','liga',l.name,'created_at',li.created_at,'declined_at',li.declined_at,
          'estado',case when li.declined_at is null then 'pendiente' else 'rechazada' end) o
          from public.league_invites li join public.private_leagues l on l.id=li.league_id where li.invitee=u
        union all
        select li.created_at,jsonb_build_object('rol','enviada','liga',l.name,'created_at',li.created_at,
          'estado',case when li.declined_at is null then 'pendiente' else 'rechazada' end)
          from public.league_invites li join public.private_leagues l on l.id=li.league_id where l.owner=u and li.invitee<>u) x),
    -- Duelos: rol, estado, semana y resultado (guardado desde el retador; se añade el de la persona).
    'duels',(select coalesce(jsonb_agg(jsonb_build_object('rol',case when d.challenger=u then 'retador' else 'retado' end,
      'status',d.status,'week_start',d.week_start,'week_end',d.week_start+6,'created_at',d.created_at,'result',d.result,
      'resultado_para_mi',case when d.result is null then null when d.challenger=u then d.result->>'retador'
        else case d.result->>'retador' when 'gano' then 'pierdo' when 'pierdo' then 'gano' else d.result->>'retador' end end)
      order by d.week_start,d.created_at),'[]'::jsonb)
      from public.duels d where u in (d.challenger,d.opponent)));
  -- 5. Programa de creadores (v6): la ficha propia, sus comisiones y sus liquidaciones. Sin el uuid ni
  --    el correo de los compradores, sin sale_id ni payout_id, y sin las notas internas del dueño
  --    (creators.notes, creator_payouts.note), que se dan bajo solicitud de acceso manual.
  result:=result||jsonb_build_object('creador',(
    select jsonb_build_object(
      'code',c.code,'alias',c.alias,'rank',c.rank,'role',c.role,'active',c.active,
      'monthly_fixed_cents',c.monthly_fixed_cents,'created_at',c.created_at,
      'cuentas_atribuidas',(select count(*) from public.referrals r where r.creator_id=c.id),
      'comisiones',(select coalesce(jsonb_agg(jsonb_build_object('kind',k.kind,'rank',k.rank,'pct',k.pct,
          'amount_cents',k.amount_cents,'status',k.status,'available_at',k.available_at,'clawback',k.clawback,
          'clawback_settled_at',k.clawback_settled_at,'voided_reason',k.voided_reason,'created_at',k.created_at,
          'venta_purchased_at',s.purchased_at,'venta_payment_number',s.payment_number,'venta_store',s.store,
          'venta_refunded_at',s.refunded_at) order by k.created_at),'[]'::jsonb)
        from public.commissions k join public.store_sales s on s.id=k.sale_id where k.creator_id=c.id),
      'liquidaciones',(select coalesce(jsonb_agg(jsonb_build_object('kind',p.kind,'amount_cents',p.amount_cents,
          'period',p.period,'paid_at',p.paid_at) order by p.paid_at),'[]'::jsonb)
        from public.creator_payouts p where p.creator_id=c.id),
      'notas_internas','No se incluyen: se facilitan bajo solicitud de acceso a soporte.')
    from public.creators c where c.user_id=u));
  -- Own administrative erasure evidence, without worker lease credentials.
  result := result || jsonb_build_object('store_erasure_cleanup', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'requested_at', q.requested_at, 'retain_until', q.retain_until,
      'next_attempt_at', q.next_attempt_at, 'attempts', q.attempts,
      'last_attempt_at', q.last_attempt_at, 'last_deleted_at', q.last_deleted_at
    )), '[]'::jsonb) from public.store_erasure_cleanup q where q.user_id = u
  ));
  return result;
end $$;
revoke all on function public.export_my_data() from public,anon;
grant execute on function public.export_my_data() to authenticated;
comment on function public.export_my_data() is 'Owner-only rights export v8; nivl:export-completo-v4 nivl:export-v5 nivl:export-v6 nivl:store-cleanup-export-0064 nivl:export-modos-0068';

notify pgrst, 'reload schema';
commit;
