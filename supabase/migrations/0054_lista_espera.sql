-- NIVL · 0054 — Lista de espera de nivl.app (Chat 3, 03/10/2026).
-- Número asignado por el coordinador. Huella para scripts/apply-migrations.mjs:
--   '0054': `coalesce(obj_description(to_regprocedure('public.waitlist_join(text,text,text,text)'),'pg_proc') like '%nivl:waitlist-0054%', false)`
--
-- Contrato
--   ADITIVA. Una tabla con los correos (sin cuenta asociada: no entra en la
--   exportación 0060 ni en el borrado de cuenta), otra para el freno y una RPC
--   que solo ejecuta service_role (la llama la Edge Function `espera`).
--   · Sin IP en claro: el freno guarda HMAC-SHA256(ip) con una sal aleatoria
--     que se crea aquí y no sale nunca de la base de datos (no es un secreto
--     de entorno: no hay nada que rotar ni que configurar). Las filas del freno
--     se borran solas a las 48 h.
--   · Idempotente y sin enumeración: un correo ya apuntado devuelve lo mismo
--     que uno nuevo, y no se pisa su consentimiento ni su origen.
--   · Sin políticas RLS y sin privilegios para anon/authenticated.
--   · Baja: borrar la fila (a mano, por soporte). Conservación: hasta el
--     lanzamiento y 3 meses más (texto de privacidad); se borra con
--     `delete from public.waitlist` cuando toque.
-- Re-ejecutable: una segunda pasada no cambia nada (la sal no se regenera).

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique
    check (char_length(email) between 6 and 254 and email = lower(btrim(email))
           and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  consent_version text not null check (consent_version ~ '^[a-z0-9.-]{1,32}$'),
  consent_at timestamptz not null default now(),
  source text check (source ~ '^[A-Za-z0-9_.:-]{1,64}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.waitlist_throttle (
  bucket text not null,              -- 'ip:<hmac hex>' | 'em:<hmac hex>'
  at timestamptz not null default now()
);
create index if not exists waitlist_throttle_bucket_at_idx on public.waitlist_throttle (bucket, at);
create index if not exists waitlist_throttle_at_idx on public.waitlist_throttle (at);

create table if not exists public.waitlist_salt (
  id boolean primary key default true check (id),
  salt bytea not null
);
insert into public.waitlist_salt (salt)
select extensions.gen_random_bytes(32)
where not exists (select 1 from public.waitlist_salt);

alter table public.waitlist enable row level security;
alter table public.waitlist_throttle enable row level security;
alter table public.waitlist_salt enable row level security;
revoke all on public.waitlist from anon, authenticated;
revoke all on public.waitlist_throttle from anon, authenticated;
revoke all on public.waitlist_salt from anon, authenticated;

-- ── Apuntarse ───────────────────────────────────────────────────────
-- Devuelve 'ok' (nuevo o ya estaba: indistinguible), 'correo' (no válido)
-- o 'frenado'. Límites: 5 intentos por IP en 10 min y 30 al día; 3 por
-- correo en 1 h. Cuentan los intentos, no las altas: el freno vale igual para
-- un correo existente que para uno nuevo (no revela nada).
create or replace function public.waitlist_join(p_email text, p_consent_version text, p_source text, p_ip text)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_source text := nullif(btrim(coalesce(p_source, '')), '');
  v_salt bytea;
  v_ip text;
  v_em text;
begin
  if char_length(v_email) not between 6 and 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return 'correo';
  end if;
  if coalesce(p_consent_version, '') !~ '^[a-z0-9.-]{1,32}$' then
    raise exception 'waitlist_join: versión de consentimiento no válida';
  end if;
  if v_source is not null and v_source !~ '^[A-Za-z0-9_.:-]{1,64}$' then
    v_source := null;
  end if;

  select salt into v_salt from public.waitlist_salt;
  v_ip := 'ip:' || encode(extensions.hmac(convert_to(coalesce(nullif(btrim(p_ip), ''), 'desconocida'), 'UTF8'), v_salt, 'sha256'), 'hex');
  v_em := 'em:' || encode(extensions.hmac(convert_to(v_email, 'UTF8'), v_salt, 'sha256'), 'hex');

  delete from public.waitlist_throttle where at < now() - interval '48 hours';

  if (select count(*) from public.waitlist_throttle where bucket = v_ip and at > now() - interval '10 minutes') >= 5
     or (select count(*) from public.waitlist_throttle where bucket = v_ip and at > now() - interval '24 hours') >= 30
     or (select count(*) from public.waitlist_throttle where bucket = v_em and at > now() - interval '1 hour') >= 3 then
    return 'frenado';
  end if;
  insert into public.waitlist_throttle (bucket) values (v_ip), (v_em);

  insert into public.waitlist (email, consent_version, source)
  values (v_email, p_consent_version, v_source)
  on conflict (email) do nothing;
  return 'ok';
end;
$$;

comment on function public.waitlist_join(text, text, text, text) is
  'nivl:waitlist-0054 — alta idempotente en la lista de espera con freno por IP y por correo (HMAC, sin IP en claro). Solo service_role.';

revoke all on function public.waitlist_join(text, text, text, text) from public, anon, authenticated;
grant execute on function public.waitlist_join(text, text, text, text) to service_role;

notify pgrst, 'reload schema';
