-- PROPUESTA (Chat 3 · subagente a «RLS y auth»). NO es una migración aplicada.
-- Para aplicarla: copiar como supabase/migrations/00NN_claim_push_token.sql
-- (siguiente número libre), añadir su huella en HUELLAS de
-- scripts/apply-migrations.mjs y aplicar con node scripts/apply-migrations.mjs.
-- Test: docs/security-audit/proposals/a-01_push_token.test.sql
--
-- A-04 (P1, parte servidor): el token push de un móvil quedaba a nombre del
-- usuario anterior; el upsert del siguiente usuario lo rechaza la RLS de
-- push_tokens (reproducido). RPC para que el móvil reclame su token para la
-- cuenta con sesión. authFlow.cerrarSesion ya borra el token al salir; esto
-- cubre el logout sucio (app matada, sesión caducada, reinstalación).
--
-- Compatibilidad: función nueva; los binarios actuales siguen con su upsert.
-- DEPENDENCIA: src/lib/push.ts (registrarDispositivo) debe llamar a
-- supabase.rpc('claim_push_token', { p_token, p_platform }) en lugar del upsert.
-- La revocación de INSERT/DELETE en profiles NO va aquí: está en la 0035.
begin;

create or replace function public.claim_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  if p_token is null or length(p_token) not between 10 and 200 or p_token !~ '^(Expo(nent)?PushToken\[[A-Za-z0-9_-]+\])$' then
    raise exception 'Token no válido';
  end if;
  if p_platform not in ('ios', 'android') then raise exception 'Plataforma no válida'; end if;
  insert into public.push_tokens(token, user_id, platform, updated_at)
  values (p_token, v_uid, p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = excluded.updated_at;
end;
$$;
revoke all on function public.claim_push_token(text, text) from public, anon, authenticated;
grant execute on function public.claim_push_token(text, text) to authenticated;

notify pgrst, 'reload schema';
commit;
