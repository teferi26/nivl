-- PROPUESTA (Chat 3 · subagente a «RLS y auth»). NO es una migración aplicada.
-- Para aplicarla: copiar como supabase/migrations/00NN_seguridad_perfiles.sql
-- (siguiente número libre), añadir su huella en HUELLAS de
-- scripts/apply-migrations.mjs y aplicar con node scripts/apply-migrations.mjs.
-- Test: docs/security-audit/proposals/a-01_profiles_privilegios_y_push.test.sql
--
-- Cierra:
--  A-02 (P1) Un usuario podía BORRAR su fila de profiles y volver a insertarla
--       con xp_total, protection_stones, bonus_points y streak_days a su gusto
--       (INSERT concedido en todas las columnas). El borrado arrastra en cascada
--       social_profile_reviews: una cuenta SUSPENDIDA pasaba a 'pending' y
--       volvía a poder pedir amistad, denunciar, etc.
--  A-05 (P2) TRUNCATE concedido a anon/authenticated en 47 tablas (y por
--       defecto en las futuras). Hoy PostgREST no expone TRUNCATE, pero
--       TRUNCATE ignora la RLS: cualquier vía futura de SQL con esos roles
--       vaciaría la tabla de todos.
--  A-04 (P1, parte servidor) El token push de un móvil quedaba a nombre del
--       usuario anterior: el upsert del siguiente lo rechaza la RLS. RPC para
--       que el móvil reclame su token.
--
-- Compatibilidad con clientes existentes:
--  · ensureProfile (src/lib/data.ts) hace upsert({id}) ON CONFLICT DO NOTHING:
--    solo necesita INSERT(id). Sigue funcionando.
--  · Ningún cliente borra profiles (grep 'from(.profiles.)' en src/ y
--    supabase/functions). El borrado de cuenta va por account-erasure con
--    service_role y por la cascada desde auth.users: no le afecta.
--  · claim_push_token es nueva; los binarios actuales siguen con su upsert
--    (que funciona para el primer usuario del móvil). Dependencia: push.ts
--    debe pasar a llamar a la RPC (fuera de los archivos de este subagente).
begin;

-- A-02: profiles solo se crea con su id, nunca se borra desde el cliente.
revoke insert, delete on public.profiles from anon, authenticated;
revoke all on public.profiles from anon;
grant insert (id) on public.profiles to authenticated;

-- A-05: TRUNCATE fuera para los roles de la API, también en lo que se cree.
revoke truncate on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke truncate on tables from anon, authenticated;

-- Higiene: funciones de trigger no tienen por qué ser ejecutables por la API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- A-04: el móvil reclama su token para la cuenta con sesión.
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
