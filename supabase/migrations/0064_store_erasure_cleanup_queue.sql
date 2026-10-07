-- Durable RevenueCat erasure retries. UUID is the only retained identity.
-- No FK to Auth: deleting the account cannot erase pending provider cleanup.
-- No scheduler is activated by this migration.
begin;
create table if not exists public.store_erasure_cleanup (
  user_id uuid primary key,
  requested_at timestamptz not null default clock_timestamp(),
  retain_until timestamptz not null default (clock_timestamp() + interval '30 days'),
  next_attempt_at timestamptz not null default clock_timestamp(),
  lease_id uuid,
  lease_until timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_attempt_at timestamptz,
  last_deleted_at timestamptz,
  constraint store_cleanup_lease_pair check ((lease_id is null) = (lease_until is null))
);
alter table public.store_erasure_cleanup enable row level security;
revoke all on public.store_erasure_cleanup from public, anon, authenticated, service_role;
create index if not exists store_cleanup_due_idx on public.store_erasure_cleanup(next_attempt_at);

create or replace function public._enqueue_store_erasure_cleanup(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t timestamptz := clock_timestamp();
begin
  if p_user is null then raise exception 'Identidad de limpieza ausente'; end if;
  insert into public.store_erasure_cleanup(user_id, requested_at, retain_until, next_attempt_at)
  values(p_user, t, t + interval '30 days', t)
  on conflict(user_id) do update set
    retain_until = greatest(store_erasure_cleanup.retain_until, excluded.retain_until),
    next_attempt_at = least(store_erasure_cleanup.next_attempt_at, excluded.next_attempt_at);
end $$;
revoke all on function public._enqueue_store_erasure_cleanup(uuid) from public, anon, authenticated, service_role;

create or replace function public.request_store_erasure_cleanup(p_user uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or public.store_account_active(p_user) then
    raise exception 'Cuenta activa o identidad ausente' using errcode = '42501';
  end if;
  perform public._enqueue_store_erasure_cleanup(p_user);
  return true;
end $$;
revoke all on function public.request_store_erasure_cleanup(uuid) from public, anon, authenticated, service_role;
grant execute on function public.request_store_erasure_cleanup(uuid) to service_role;

create or replace function public._store_cleanup_before_erasure() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public._enqueue_store_erasure_cleanup(old.id);
    return old;
  end if;
  perform public._enqueue_store_erasure_cleanup(new.user_id);
  return new;
end $$;
revoke all on function public._store_cleanup_before_erasure() from public, anon, authenticated, service_role;
drop trigger if exists store_cleanup_before_job on public.account_erasure_jobs;
create trigger store_cleanup_before_job before insert on public.account_erasure_jobs
for each row execute function public._store_cleanup_before_erasure();
drop trigger if exists store_cleanup_before_auth_delete on auth.users;
create trigger store_cleanup_before_auth_delete before delete on auth.users
for each row execute function public._store_cleanup_before_erasure();

-- Jobs already pending before the migration also get a durable cleanup entry.
insert into public.store_erasure_cleanup(user_id)
select user_id from public.account_erasure_jobs on conflict(user_id) do nothing;

create or replace function public.claim_store_erasure_cleanup(p_limit integer default 20) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t timestamptz := clock_timestamp(); jobs jsonb;
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Límite de limpieza inválido';
  end if;
  -- Successful tombstones expire only after a DELETE at/after the full horizon.
  -- Failed jobs survive until a DELETE succeeds; active leases never expire here.
  delete from public.store_erasure_cleanup
  where retain_until <= t and last_deleted_at >= retain_until and last_deleted_at >= last_attempt_at
    and (lease_until is null or lease_until <= t);
  with due as (
    select user_id from public.store_erasure_cleanup
    where (next_attempt_at <= t or (retain_until <= t and last_deleted_at < retain_until))
      and (lease_until is null or lease_until <= t)
    order by next_attempt_at, user_id for update skip locked limit p_limit
  ), claimed as (
    update public.store_erasure_cleanup q set
      lease_id = gen_random_uuid(), lease_until = t + interval '5 minutes',
      last_attempt_at = t, attempts = q.attempts + 1
    from due where q.user_id = due.user_id
    returning q.user_id, q.lease_id
  ) select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'lease_id', lease_id)), '[]'::jsonb)
    into jobs from claimed;
  return jobs;
end $$;
revoke all on function public.claim_store_erasure_cleanup(integer) from public, anon, authenticated, service_role;
grant execute on function public.claim_store_erasure_cleanup(integer) to service_role;

create or replace function public.finish_store_erasure_cleanup(p_user uuid, p_lease uuid, p_deleted boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare t timestamptz := clock_timestamp(); changed integer;
begin
  update public.store_erasure_cleanup set
    lease_id = null, lease_until = null,
    last_deleted_at = case when p_deleted is true then t else null end,
    next_attempt_at = t + case when p_deleted is true then interval '15 minutes' else interval '5 minutes' end
  where user_id = p_user and lease_id = p_lease and lease_until > t;
  get diagnostics changed = row_count;
  return changed = 1;
end $$;
revoke all on function public.finish_store_erasure_cleanup(uuid,uuid,boolean) from public, anon, authenticated, service_role;
grant execute on function public.finish_store_erasure_cleanup(uuid,uuid,boolean) to service_role;
comment on function public.claim_store_erasure_cleanup(integer) is 'nivl:durable-store-erasure-0064 nivl:final-horizon-delete-0064';
comment on table public.store_erasure_cleanup is 'Provider erasure retry UUID only. Retain 30 days after request (extended for late reads); failed jobs retained until successful deletion. Service RPC access only.';

-- Extend access/export coverage for the minimal erasure queue.
create or replace function public.export_my_data() returns jsonb
language plpgsql security definer set search_path=public, pg_temp as $$
declare u uuid:=auth.uid(); t text; rows jsonb;
  result jsonb:=jsonb_build_object('app','NIVL','version',7,'exported_at',clock_timestamp());
begin
  if u is null then raise exception 'No autenticado' using errcode='42501'; end if;
  -- 1. Igual que 0030 (filas completas) y 2. tablas propias sin terceros (v4 + 0045/0048/0050).
  foreach t in array array['profiles','quests','completions','events','dungeons','dungeon_tasks','calendar_events',
    'gym_days','gym_exercises','gym_sessions','gym_lifts','meal_slots','shopping_items','journal_entries','achievements',
    'rules','rule_breaks','bonus_redemptions','journal_photos','letters','body_metrics','goals','coach_dossier',
    'coach_facts','coach_threads','coach_messages','day_plans','day_blocks','body_profile','cardio_sessions',
    'nutrition_targets','nutrition_logs','training_prescriptions','money_accounts','transactions','category_rules',
    'budgets','money_plan','quest_photos','recaps','rule_checks','ai_consents','health_consents','health_state','health_erasure_jobs',
    'age_confirmations','subscriptions','coach_runs','oracle_usage','push_tokens','social_profile_reviews',
    'social_avatar_paths','elite_group_requests','store_reconciliation','account_erasure_jobs','friend_request_log',
    'recovery_credits','xp_daily_ledger','xp_once',
    'progress_photos','adult_confirmations','daily_scorecards','invite_rewards'] loop
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
comment on function public.export_my_data() is 'Owner-only rights export v7; nivl:export-completo-v4 nivl:export-v5 nivl:export-v6 nivl:store-cleanup-export-0064';

commit;
