-- Idempotent sealing for response loss and overlapping retries.
-- Legacy letters keep a NULL key and remain untouched.
begin;
alter table public.letters add column if not exists seal_key text;
create unique index if not exists letters_user_seal_key on public.letters(user_id,seal_key)
where seal_key is not null;

create or replace function public.seal_letter(
  p_user uuid, p_body text, p_open_at date, p_health_data boolean default false
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); fingerprint text; sealed public.letters%rowtype;
begin
  if uid is null or p_user is distinct from uid then
    raise exception 'No autorizado' using errcode='42501';
  end if;
  -- JSON encoding is unambiguous and date text is independent of timezone.
  fingerprint := encode(sha256(convert_to(jsonb_build_array(uid,p_body,to_char(p_open_at,'YYYY-MM-DD'))::text,'UTF8')),'hex');
  -- Existing ownership RLS, health/account triggers and CHECKs still govern
  -- the INSERT, including a retry when consent has since been withdrawn.
  insert into public.letters(user_id,body,open_at,health_data,seal_key)
  values(uid,p_body,p_open_at,p_health_data,fingerprint)
  on conflict(user_id,seal_key) where seal_key is not null do nothing;
  select * into sealed from public.letters where user_id=uid and seal_key=fingerprint;
  if not found then raise exception 'No se ha podido leer la carta sellada' using errcode='42501'; end if;
  if sealed.body is distinct from p_body or sealed.open_at is distinct from p_open_at
     or sealed.health_data is distinct from p_health_data then
    raise exception 'El contenido de la firma ha cambiado' using errcode='22023';
  end if;
  return to_jsonb(sealed);
end $$;
revoke all on function public.seal_letter(uuid,text,date,boolean) from public,anon,authenticated,service_role;
grant execute on function public.seal_letter(uuid,text,date,boolean) to authenticated;
comment on function public.seal_letter(uuid,text,date,boolean) is 'nivl:idempotent-letter-seal-0065; security invoker keeps owner, health and erasure protections';
-- export_my_data already exports full own letters rows, so seal_key is covered.
notify pgrst, 'reload schema';
commit;
