-- PROPUESTA (Chat 3 · b) — NO aplicada. El número final lo asigna quien la integre.
-- Derecho de acceso (RGPD art. 15) y portabilidad (art. 20): export_my_data
-- (0030) omite 17 tablas con datos de la persona y no dice qué fotos existen.
-- Esta versión 3 conserva la MISMA firma y el mismo modelo de seguridad (solo
-- auth.uid(), lista cerrada, sin parámetros) y TODAS las claves que exige el
-- cliente actual (src/lib/exporter.ts TABLES): solo AÑADE claves, así que los
-- binarios ya instalados siguen funcionando.
-- Datos de terceros: de amistades, bloqueos e informes se exporta el hecho
-- (rol, fechas, estado, motivo propio), nunca el identificador de la otra persona.
-- Despliegue: 1) esta migración (+ su huella en scripts/apply-migrations.mjs).
-- Nada más: ni Edge Function ni OTA son necesarias.
begin;
create or replace function public.export_my_data() returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); t text; rows jsonb;
  result jsonb:=jsonb_build_object('app','NIVL','version',3,'exported_at',clock_timestamp());
begin
  if u is null then raise exception 'No autenticado' using errcode='42501'; end if;
  -- 1. Igual que 0030 (filas completas) y 2. nuevas tablas propias sin terceros.
  foreach t in array array['profiles','quests','completions','events','dungeons','dungeon_tasks','calendar_events',
    'gym_days','gym_exercises','gym_sessions','gym_lifts','meal_slots','shopping_items','journal_entries','achievements',
    'rules','rule_breaks','bonus_redemptions','journal_photos','letters','body_metrics','goals','coach_dossier',
    'coach_facts','coach_threads','coach_messages','day_plans','day_blocks','body_profile','cardio_sessions',
    'nutrition_targets','nutrition_logs','training_prescriptions','money_accounts','transactions','category_rules',
    'budgets','money_plan','quest_photos','recaps','rule_checks','ai_consents','health_consents','health_state','health_erasure_jobs',
    'age_confirmations','subscriptions','coach_runs','oracle_usage','push_tokens','social_profile_reviews',
    'social_avatar_paths','elite_group_requests','store_reconciliation','account_erasure_jobs','friend_request_log'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from public.%I r where %I=$1',
      t,case when t='profiles' then 'id' else 'user_id' end) into rows using u;
    result:=result||jsonb_build_object(t,rows);
  end loop;
  -- 3. Relaciones: solo la parte de la persona.
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
    'store_sales',(select coalesce(jsonb_agg(jsonb_build_object('store',s.store,'product_id',s.product_id,'payment_number',s.payment_number,
      'price_cents',s.price_cents,'currency',s.currency,'purchased_at',s.purchased_at,'refunded_at',s.refunded_at) order by s.purchased_at),'[]'::jsonb)
      from public.store_sales s where s.user_id=u),
    -- Las fotos: la lista de archivos que existen. Los bytes se descargan aparte
    -- con URL firmada (dependencia de UI, ver b-privacidad-borrado.md).
    'storage_objects',(select coalesce(jsonb_agg(jsonb_build_object('bucket',o.bucket_id,'path',o.name,
      'bytes',(o.metadata->>'size')::bigint,'created_at',o.created_at) order by o.bucket_id,o.name),'[]'::jsonb)
      from storage.objects o where o.bucket_id in ('evidence','avatars') and (storage.foldername(o.name))[1]=u::text));
  return result;
end $$;
revoke all on function public.export_my_data() from public,anon;
grant execute on function public.export_my_data() to authenticated;
comment on function public.export_my_data() is 'Owner-only rights export v3; nivl:export-completo';
commit;
