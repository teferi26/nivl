-- 0050 · Fotos de progreso corporales y confirmación 18+ (Chat 3; número asignado por el coordinador 02/10/2026).
-- Huella: to_regclass('public.progress_photos') is not null
-- Test: fotos-progreso.test.sql (se inyecta este archivo SIN sus líneas begin/commit en el marcador
--       «-- @@MIGRACION@@» del test y se ejecuta todo con rosql.mjs en BEGIN…ROLLBACK).
--
-- Requisitos: docs/ia-v2/requisitos-seguridad.md §1 (F1, F3, F4, F5, F10). Dato de SALUD y solo 18+.
-- Aditiva y compatible con la app 1.0.7 (no usa nada de esto). Sin cambios de firma.
--
-- FUERA de esta propuesta, por decisión del coordinador: export_my_data. La exportación consolidada
-- de la fase 2 debe cubrir progress_photos, adult_confirmations y los objetos del bucket 'progress'
-- (lo documenta el paso 7 del test).
--
-- Orden de despliegue: esta migración → Edge Functions account-erasure y health-erasure (que ya
-- vacían 'progress') → app con fotos. Una función antigua ante un objeto de 'progress' responde
-- «pendiente» (503) y no borra nada indebido; con 1.0.7 no puede existir ninguno.
begin;

-- ───────────────────────── 1. Declaración de mayoría de edad (F10) ─────────────────────────
-- Confirmación PROPIA, como age_confirmations (16+), pero aparte: hay usuarios de 16–17.
create table public.adult_confirmations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  confirmed_at timestamptz not null default now()
);
alter table public.adult_confirmations enable row level security;
revoke all on public.adult_confirmations from public, anon, authenticated, service_role;
grant select on public.adult_confirmations to authenticated;
grant select, delete on public.adult_confirmations to service_role;
create policy adult_confirmations_own_read on public.adult_confirmations
  for select to authenticated using (user_id = auth.uid());
-- Mismo bloqueo que el resto de tablas con dueño (0031).
create trigger account_write_guard before insert or update on public.adult_confirmations
  for each row execute function public.require_account_active('user_id');

-- Predicado interno (como health_consent_ok): nadie sondea la mayoría de edad de otra persona.
create function public.adult_ok(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((auth.uid() = p_user or auth.role() = 'service_role')
    and exists(select 1 from public.adult_confirmations a where a.user_id = p_user), false)
$$;
revoke all on function public.adult_ok(uuid) from public, anon;
grant execute on function public.adult_ok(uuid) to authenticated, service_role;

create function public.confirm_adult() returns boolean
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text, 630030));
  if public.account_erasure_pending(u) then raise exception 'borrado_cuenta_pendiente' using errcode = '42501'; end if;
  -- Idempotente: conserva la fecha de la primera declaración.
  insert into public.adult_confirmations(user_id) values (u) on conflict (user_id) do nothing;
  return true;
end $$;

create function public.my_adult_confirmation() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.adult_confirmations where user_id = auth.uid())
$$;
revoke all on function public.confirm_adult(), public.my_adult_confirmation() from public, anon;
grant execute on function public.confirm_adult(), public.my_adult_confirmation() to authenticated;

-- ───────────────────────── 2. Tabla de metadatos (F3) ─────────────────────────
-- Regla de ruta: '{user_id}/{id}.{jpg|jpeg|webp}'. Sin fecha ni pose en la ruta; el significado
-- vive en la tabla. Una fila = un objeto; la ruta no se puede cambiar (sin UPDATE de path).
create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  taken_on date not null,
  pose text not null check (pose in ('frente', 'lado', 'espalda')),
  path text not null unique,
  created_at timestamptz not null default now(),
  constraint progress_photos_path_rule check (path in (
    user_id::text || '/' || id::text || '.jpg',
    user_id::text || '/' || id::text || '.jpeg',
    user_id::text || '/' || id::text || '.webp')),
  constraint progress_photos_taken_on_floor check (taken_on >= date '2000-01-01')
);
create index progress_photos_user_idx on public.progress_photos(user_id, taken_on desc, created_at desc);
alter table public.progress_photos enable row level security;
revoke all on public.progress_photos from public, anon, authenticated, service_role;
-- Sin TRUNCATE para nadie del cliente. Solo se corrigen fecha y pose; id, user_id y path, nunca.
grant select, insert, delete on public.progress_photos to authenticated;
grant update (taken_on, pose) on public.progress_photos to authenticated;
grant select, insert, update, delete on public.progress_photos to service_role;

create policy progress_photos_owner on public.progress_photos for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Igual que las demás tablas de salud (0030): health_row('progress_photos', …) cae en «else true».
create policy health_permission on public.progress_photos as restrictive for all to authenticated
  using (not public.health_row('progress_photos', to_jsonb(progress_photos)) or public.health_consent_ok(auth.uid()))
  with check (not public.health_row('progress_photos', to_jsonb(progress_photos)) or public.health_consent_ok(auth.uid()));
create policy adult_permission on public.progress_photos as restrictive for all to authenticated
  using (public.adult_ok(auth.uid())) with check (public.adult_ok(auth.uid()));

-- Defensa en profundidad para escritores privilegiados (service_role salta la RLS):
-- mayoría de edad, fecha razonable y tope diario de altas (acota también el almacenamiento,
-- porque cada objeto de 'progress' exige su fila).
create function public.progress_photo_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() > 1 and not exists(select 1 from auth.users where id = new.user_id) then return new; end if;
  if not exists(select 1 from public.adult_confirmations where user_id = new.user_id) then
    raise exception 'sin_confirmacion_adulto' using errcode = '42501';
  end if;
  if new.taken_on > (now() at time zone 'utc')::date + 1 then
    raise exception 'Fecha de foto no válida' using errcode = '22023';
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.progress_photos p
      where p.user_id = new.user_id and p.created_at > now() - interval '1 day') >= 12 then
    raise exception 'limite_fotos_progreso' using errcode = '54000';
  end if;
  return new;
end $$;
revoke all on function public.progress_photo_guard() from public, anon, authenticated, service_role;

create trigger account_write_guard before insert or update on public.progress_photos
  for each row execute function public.require_account_active('user_id');
create trigger health_write before insert or update on public.progress_photos
  for each row execute function public.require_health_write();
create trigger progress_photo_guard before insert or update on public.progress_photos
  for each row execute function public.progress_photo_guard();

comment on table public.progress_photos is
  'nivl:fotos-progreso-v1 · fotos corporales (salud, 18+). Ruta {uid}/{id}.{jpg|jpeg|webp} en el bucket privado progress.';

-- ───────────────────────── 3. Bucket privado y políticas (F1, F4) ─────────────────────────
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('progress', 'progress', false, 3145728, array['image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Leer y borrar: solo la carpeta propia. Subir: además, el nombre debe ser exactamente la ruta de
-- una fila propia de progress_photos (nada de archivos sueltos ni de otras extensiones).
create policy "own progress read" on storage.objects for select to authenticated
  using (bucket_id = 'progress' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own progress insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'progress' and (storage.foldername(name))[1] = auth.uid()::text
    and exists(select 1 from public.progress_photos p where p.path = objects.name and p.user_id = auth.uid()));
create policy "own progress delete" on storage.objects for delete to authenticated
  using (bucket_id = 'progress' and (storage.foldername(name))[1] = auth.uid()::text);
-- Restrictivas: salud + 18+ para TODA operación sobre 'progress'; y nunca sobrescribir.
create policy progress_health_adult on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'progress' or (public.health_consent_ok(auth.uid()) and public.adult_ok(auth.uid())))
  with check (bucket_id <> 'progress' or (public.health_consent_ok(auth.uid()) and public.adult_ok(auth.uid())));
create policy progress_no_update on storage.objects as restrictive for update to authenticated
  using (bucket_id <> 'progress') with check (bucket_id <> 'progress');

-- ───────────────────────── 4. Metadatos para la app y el coach ─────────────────────────
-- Nunca devuelve path ni URL: la app firma (≤60 s) por id tras requireHealthConsent().
create function public.my_progress_photos_meta(p_from date default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare u uuid := auth.uid(); result jsonb;
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  if public.account_erasure_pending(u) then raise exception 'borrado_cuenta_pendiente' using errcode = '42501'; end if;
  if not public.health_consent_ok(u) then raise exception 'sin_consentimiento_salud' using errcode = '42501'; end if;
  if not exists(select 1 from public.adult_confirmations where user_id = u) then
    raise exception 'sin_confirmacion_adulto' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'fecha', x.taken_on, 'pose', x.pose, 'peso_kg', x.peso)
           order by x.taken_on desc, x.created_at desc), '[]'::jsonb)
    into result
    from (select p.id, p.taken_on, p.pose, p.created_at,
            (select m.weight_kg from public.body_metrics m
              where m.user_id = u and m.date = p.taken_on and m.weight_kg is not null
              order by m.created_at desc limit 1) as peso
          from public.progress_photos p
          where p.user_id = u and (p_from is null or p.taken_on >= p_from)
          order by p.taken_on desc, p.created_at desc
          limit 200) x;
  return result;
end $$;
revoke all on function public.my_progress_photos_meta(date) from public, anon;
grant execute on function public.my_progress_photos_meta(date) to authenticated;

-- ───────────────────────── 5. Los sitios con la lista de buckets (F5) ─────────────────────────
-- Copias EXACTAS de las definiciones vivas (pg_get_functiondef, 02/10/2026) con 'progress' añadido.

-- 5a. Bloqueo de subida con borrado pendiente (+ para 'progress', salud y 18+ también contra service_role).
create or replace function public.require_account_storage_active()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare subject text; u uuid;
begin
  if new.bucket_id in ('evidence','avatars','progress') then
    subject := (storage.foldername(new.name))[1];
    if subject ~* '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$' then
      u := subject::uuid;
      perform pg_advisory_xact_lock(hashtextextended(u::text,630030));
      -- Deleting Auth does not instantly invalidate existing access tokens.
      -- Do not let an old JWT/signed upload recreate files after job cascades.
      if not exists(select 1 from auth.users where id=u) then raise exception 'Cuenta inexistente' using errcode='42501'; end if;
      if public.account_erasure_pending(u) then raise exception 'borrado_cuenta_pendiente' using errcode='42501'; end if;
      -- Fotos corporales: salud vigente y 18+ también para escritores privilegiados.
      if new.bucket_id='progress' and (not public.health_consent_active(u)
        or not exists(select 1 from public.adult_confirmations where user_id=u)) then
        raise exception 'sin_permiso_fotos_progreso' using errcode='42501';
      end if;
    elsif new.bucket_id='progress' then
      raise exception 'Ruta de foto de progreso no válida' using errcode='42501';
    end if;
  end if;
  if tg_op='UPDATE' and old.bucket_id in ('evidence','avatars','progress') then
    subject := (storage.foldername(old.name))[1];
    if subject ~* '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$' then
      u := subject::uuid;
      perform pg_advisory_xact_lock(hashtextextended(u::text,630030));
      if not exists(select 1 from auth.users where id=u) then raise exception 'Cuenta inexistente' using errcode='42501'; end if;
      if public.account_erasure_pending(u) then raise exception 'borrado_cuenta_pendiente' using errcode='42501'; end if;
    end if;
  end if;
  return new;
end $function$;

-- 5b. Borrado de cuenta: rutas a vaciar.
create or replace function public.account_erasure_paths(p_user uuid, p_job uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare result jsonb;
begin
  if auth.role() is distinct from 'service_role' or not exists(
    select 1 from public.account_erasure_jobs where user_id=p_user and id=p_job
  ) then raise exception 'No autorizado' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'path',name)),'[]'::jsonb)
    into result from (
      select bucket_id,name from storage.objects
      where bucket_id in ('evidence','avatars','progress') and (storage.foldername(name))[1]=p_user::text
      order by bucket_id,name limit 100
    ) owned;
  return result;
end $function$;

-- 5c. Borrado de cuenta: comprobación final antes de borrar Auth.
create or replace function public.account_erasure_ready(p_user uuid, p_job uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.role() is distinct from 'service_role' or not exists(
    select 1 from public.account_erasure_jobs where user_id=p_user and id=p_job
  ) then raise exception 'No autorizado' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,630030));
  return not exists(select 1 from storage.objects
    where bucket_id in ('evidence','avatars','progress') and (storage.foldername(name))[1]=p_user::text);
end $function$;

-- 5d. Retirada de salud: rutas a vaciar. Formato MIXTO y compatible: 'evidence' sigue saliendo como
-- cadena (lo que entiende la función desplegada); 'progress' sale como {bucket,path}, que una función
-- antigua rechaza (503 pendiente, sin borrar nada indebido) y la nueva borra de su bucket.
create or replace function public.health_erasure_paths(p_job uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare u uuid:=auth.uid(); result jsonb;
begin
  if u is null or not exists(select 1 from public.health_erasure_jobs where user_id=u and id=p_job and status='pending') then
    raise exception 'Solicitud de borrado no vigente' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(item order by ord,name),'[]'::jsonb) into result from (
    select ord,name,item from (
      select 0 as ord,name,to_jsonb(name) as item from storage.objects
        where bucket_id='evidence' and (storage.foldername(name))[1]=u::text
      union all
      select 1,name,jsonb_build_object('bucket','progress','path',name) from storage.objects
        where bucket_id='progress' and (storage.foldername(name))[1]=u::text
    ) both_buckets order by ord,name limit 100) own;
  return result;
end $function$;

-- 5e. Retirada de salud: cierre. Exige 'evidence' y 'progress' vacíos y borra progress_photos.
-- adult_confirmations NO es dato de salud y se conserva.
create or replace function public.complete_health_erasure(p_user uuid, p_job uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare t text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'No autorizado' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,630030));
  if not exists(select 1 from public.health_erasure_jobs where user_id=p_user and id=p_job and status='pending') then
    raise exception 'Solicitud de borrado no vigente' using errcode='42501';
  end if;
  if exists(select 1 from storage.objects where bucket_id in ('evidence','progress') and (storage.foldername(name))[1]=p_user::text) then
    raise exception 'Quedan fotos por eliminar';
  end if;
  -- No background sweep: this function runs only for an explicit erasure job.
  -- Delete health-tagged mixed data and structured physical habits only.
  -- General legacy rows are not inferred to be health or deleted wholesale.
  delete from public.events where user_id=p_user and public.health_row('events',to_jsonb(events));
  delete from public.dungeon_tasks where user_id=p_user and public.health_row('dungeon_tasks',to_jsonb(dungeon_tasks));
  delete from public.dungeons where user_id=p_user and public.health_row('dungeons',to_jsonb(dungeons));
  delete from public.calendar_events where user_id=p_user and health_data;
  delete from public.shopping_items where user_id=p_user and health_data;
  delete from public.letters where user_id=p_user and health_data;
  foreach t in array array['gym_lifts','gym_exercises','gym_sessions','gym_days','body_profile','body_metrics',
    'cardio_sessions','nutrition_targets','nutrition_logs','training_prescriptions','meal_slots','journal_photos',
    'quest_photos','progress_photos','journal_entries','coach_messages','coach_threads','coach_facts','coach_dossier','recaps','day_blocks','day_plans'] loop
    execute format('delete from public.%I where user_id=$1',t) using p_user;
  end loop;
  -- Remove referencing photos/day blocks before their ON DELETE SET NULL
  -- parent links, so erasure never needs an unrelated health write exception.
  delete from public.quests where user_id=p_user and public.health_row('quests',to_jsonb(quests));
  delete from public.rules where user_id=p_user and public.health_row('rules',to_jsonb(rules));
  delete from public.goals where user_id=p_user and public.health_row('goals',to_jsonb(goals));
  -- Financial rows/amounts/categories/accounts and legacy unmarked text stay.
  -- Disable marked classifier rules instead of deleting them or matching ''.
  update public.money_plan set rationale=null,health_note=false where user_id=p_user and health_note;
  update public.budgets set rationale=null,health_note=false where user_id=p_user and health_note;
  update public.transactions set description='Descripción retirada',health_note=false where user_id=p_user and health_note;
  update public.category_rules set pattern='__nivl_removed_'||id::text,active=false,health_note=false
    where user_id=p_user and health_note;
  -- Retain the fact/XP of completed habits, remove their photo reference.
  update public.completions set evidence_url=null where user_id=p_user and evidence_url is not null;
  update public.health_erasure_jobs set status='complete',completed_at=clock_timestamp()
    where user_id=p_user and id=p_job;
  return jsonb_build_object('ok',true);
end $function$;

-- CREATE OR REPLACE conserva propietario y privilegios; se reafirman por si acaso (mismos que 0030/0031).
revoke all on function public.require_account_storage_active() from public, anon, authenticated, service_role;
revoke all on function public.account_erasure_paths(uuid, uuid), public.account_erasure_ready(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.account_erasure_paths(uuid, uuid), public.account_erasure_ready(uuid, uuid) to service_role;
revoke all on function public.health_erasure_paths(uuid) from public, anon;
grant execute on function public.health_erasure_paths(uuid) to authenticated;
revoke all on function public.complete_health_erasure(uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_health_erasure(uuid, uuid) to service_role;

commit;
