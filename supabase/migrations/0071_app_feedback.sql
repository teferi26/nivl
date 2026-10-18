-- 0071 · Opinión interna (Modos F1 · equipo analítica). docs/modos/F1-analitica.md
-- Huella: coalesce(obj_description('public.app_feedback'::regclass,'pg_class') like '%nivl:app-feedback-0071%', false)
--
-- «¿Qué te gusta? ¿Qué cambiarías?»: dos respuestas libres que la persona
-- escribe una vez (día 2-3, tras un momento bueno). Es INDEPENDIENTE de la
-- valoración nativa de la tienda: nada de lo que se responda aquí decide si
-- se pide o no la valoración (Apple prohíbe el «review gating»).
--
-- RLS: cada cuenta inserta solo la suya y nadie lee desde la app (tampoco la
-- propia; se ve en la exportación). Las lee el panel admin con
-- `admin_opiniones` (0072). Borrado: FK on delete cascade con Auth.
-- Exportación: entra en `export_my_data` en la 0072 (se despliegan juntas).
begin;

create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  gusta text null check (gusta is null or char_length(gusta) <= 1000),
  cambiaria text null check (cambiaria is null or char_length(cambiaria) <= 1000),
  version text null check (version is null or version ~ '^[0-9A-Za-z.+-]{1,24}$'),
  created_at timestamptz not null default now(),
  constraint app_feedback_algo_escrito check (
    coalesce(btrim(gusta), '') <> '' or coalesce(btrim(cambiaria), '') <> ''
  )
);

create index if not exists app_feedback_created_idx on public.app_feedback (created_at desc);
create index if not exists app_feedback_user_idx on public.app_feedback (user_id, created_at desc);

alter table public.app_feedback enable row level security;
revoke all on public.app_feedback from public, anon, authenticated;
grant insert (user_id, gusta, cambiaria, version) on public.app_feedback to authenticated;

drop policy if exists "insertar la propia opinion" on public.app_feedback;
create policy "insertar la propia opinion" on public.app_feedback
  for insert to authenticated
  with check (user_id = auth.uid());

-- Tope: 3 opiniones por cuenta y día. La app la pide una vez; esto frena un
-- bucle o un script con un token válido.
create or replace function public.app_feedback_tope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select count(*) from public.app_feedback
       where user_id = new.user_id and created_at > now() - interval '1 day') >= 3 then
    raise exception 'Demasiadas opiniones por hoy' using errcode = '54000';
  end if;
  return new;
end
$$;
revoke all on function public.app_feedback_tope() from public, anon, authenticated;

drop trigger if exists app_feedback_tope on public.app_feedback;
create trigger app_feedback_tope
  before insert on public.app_feedback
  for each row execute function public.app_feedback_tope();

-- Flag (apagado): la hoja de opinión no sale hasta encenderlo. La 0067 crea
-- app_config; si aún no existe, no se siembra.
do $$
begin
  if to_regclass('public.app_config') is not null then
    insert into public.app_config (key, value, public)
    values ('opinion_activa', 'false'::jsonb, true)
    on conflict (key) do nothing;
  end if;
end
$$;

comment on table public.app_feedback is 'Opinión interna (gusta / cambiaria). nivl:app-feedback-0071';

commit;
