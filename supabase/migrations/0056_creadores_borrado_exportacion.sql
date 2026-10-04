-- NIVL · 0056 — Creadores: retirada al borrar la cuenta y exportación v6 (NIVL - Seguridad, 04/10/2026; número del coordinador).
-- Huella para scripts/apply-migrations.mjs: coalesce(obj_description('public.export_my_data()'::regprocedure,'pg_proc') like '%nivl:export-v6%', false)
--   (el comentario conserva 'nivl:export-completo-v4' y 'nivl:export-v5': las huellas de 0044 y 0060 siguen en true
--    y apply-migrations no intenta reaplicarlas, que devolverían la exportación a v5).
--
-- Programa de creadores frente a borrado y exportación (auditoría 1.0.8 P2-3; petición de NIVL - Compras,
-- docs/payment-audit/OPERAR-CREADORES.md):
--  1. BORRADO: si se borra la cuenta de un creador, creators.user_id pasa a null (FK on delete set null de 0025)
--     pero la ficha seguía ACTIVA: su código se aceptaba y generaba comisiones para alguien que pidió el borrado.
--     Un trigger BEFORE UPDATE en creators, que también salta con la acción referencial de la FK, la desactiva
--     para siempre y anonimiza alias y notas. Se conservan referrals, store_sales, commissions y creator_payouts
--     (contabilidad y clawbacks). Solo cuando user_id pasa de un valor a null: re-vincular a otra cuenta
--     (scripts/creadores.mjs) no lo dispara. Sin comisiones nuevas: record_sale ya exige c.active (0025:219).
--  2. EXPORTACIÓN v6 = v5 (0060) + bloque «creador»: ficha propia, comisiones y liquidaciones propias, sin datos
--     de compradores ni notas internas. Misma firma; solo añade la clave 'creador' (null si no es creador).
-- ADITIVA y re-ejecutable.

create or replace function public.creator_retirar_al_borrar()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.user_id is not null and new.user_id is null then
    new.active := false;
    new.alias := 'Creador retirado';
    new.notes := null;
  end if;
  return new;
end $$;
revoke all on function public.creator_retirar_al_borrar() from public, anon, authenticated;

drop trigger if exists creators_retirar_al_borrar on public.creators;
create trigger creators_retirar_al_borrar
  before update of user_id on public.creators
  for each row execute function public.creator_retirar_al_borrar();

create or replace function public.export_my_data() returns jsonb
language plpgsql security definer set search_path=public, pg_temp as $$
declare u uuid:=auth.uid(); t text; rows jsonb;
  result jsonb:=jsonb_build_object('app','NIVL','version',6,'exported_at',clock_timestamp());
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
  return result;
end $$;
revoke all on function public.export_my_data() from public,anon;
grant execute on function public.export_my_data() to authenticated;
comment on function public.export_my_data() is 'Owner-only rights export v6; nivl:export-completo-v4 nivl:export-v5 nivl:export-v6';

notify pgrst, 'reload schema';
