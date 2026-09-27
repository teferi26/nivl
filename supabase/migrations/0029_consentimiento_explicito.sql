-- NIVL · 0029 — Solo los actos explícitos de la persona autorizan IA y edad.
-- La 0028 ya está aplicada: conservamos sus filas para auditoría, pero una
-- aceptación sembrada por migración no equivale a una aceptación en la app.
begin;

create or replace function public.ai_consent_ok(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select c.action = 'accept'
      and c.source = 'app'
      and c.version = public.ai_consent_version()
    from public.ai_consents c
    where c.user_id = p_user
    order by c.created_at desc, c.id desc
    limit 1
  ), false)
$$;

revoke all on function public.ai_consent_ok(uuid) from public, anon, authenticated;
grant execute on function public.ai_consent_ok(uuid) to service_role;

-- El origen no lo elige el cliente: queda fijado por la RPC autenticada.
create or replace function public.accept_ai_consent(p_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if p_version is distinct from public.ai_consent_version() then
    return jsonb_build_object('ok', false, 'reason', 'version_obsoleta', 'current_version', public.ai_consent_version());
  end if;
  insert into public.ai_consents (user_id, action, version, source)
    values (v_uid, 'accept', p_version, 'app');
  return jsonb_build_object('ok', true, 'version', p_version);
end;
$$;

revoke all on function public.accept_ai_consent(text) from public, anon;
grant execute on function public.accept_ai_consent(text) to authenticated;

create or replace function public.withdraw_ai_consent()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  insert into public.ai_consents (user_id, action, version, source)
    values (v_uid, 'withdraw', public.ai_consent_version(), 'app');
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.withdraw_ai_consent() from public, anon;
grant execute on function public.withdraw_ai_consent() to authenticated;

-- Las filas antiguas no distinguen un acto en la app de una siembra. No se
-- inventa esa evidencia ni se eliminan: todas vuelven a confirmar una vez.
alter table public.age_confirmations
  add column if not exists app_confirmed_at timestamptz;

comment on column public.age_confirmations.app_confirmed_at is
  'Evidencia de confirmación explícita mediante confirm_minimum_age. NULL no acredita un acto de la persona.';

create or replace function public.my_age_confirmation()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.age_confirmations
    where user_id = auth.uid()
      and min_age = 16
      and app_confirmed_at is not null
  )
$$;

revoke all on function public.my_age_confirmation() from public, anon;
grant execute on function public.my_age_confirmation() to authenticated;

create or replace function public.confirm_minimum_age(p_min_age integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if p_min_age is distinct from 16 then return false; end if;
  insert into public.age_confirmations (user_id, min_age, app_confirmed_at)
    values (v_uid, 16, now())
    on conflict (user_id) do update
      set app_confirmed_at = coalesce(public.age_confirmations.app_confirmed_at, excluded.app_confirmed_at);
  return true;
end;
$$;

revoke all on function public.confirm_minimum_age(integer) from public, anon;
grant execute on function public.confirm_minimum_age(integer) to authenticated;

commit;
