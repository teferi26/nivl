-- NIVL · 0144 · La rutina guiada de la TV es IRON: respeta el cobro por modos (0140).
-- Huella (scripts/apply-migrations.mjs): comentario nivl:tv-iron-0144 en tv_datos(text, date).
-- Prueba: scripts/test-tv-modos.mjs. Contrato: tv/CONTRATO.md.
--
-- Depende de la 0128 y de la 0140. No copia tv_datos: la renombra y la envuelve, igual que hizo la 0128.
-- Añade una clave, `iron_abierto`, y vacía `rutina` y `proxima` si la cuenta no tiene IRON.
--
-- LO QUE NO SE NEGOCIA
--   · El derecho lo da ai_modos (0140), en el servidor. La TV solo pinta lo que recibe.
--   · Con `modos_1011` apagado los mundos no existen en la app (LayoutMundo) y nada se cierra aquí tampoco.
--   · No se borra ni se toca ningún dato del modo: solo deja de salir por la TV.
--   · Arena, ludus y semana son la base NIVL: siguen abiertos a todos.
--   · La TV no vende: ni precios ni enlaces de compra. El acceso se gestiona en el iPhone.
begin;

do $$
begin
  if to_regprocedure('public._tv_datos_0128(text,date)') is null then
    alter function public.tv_datos(text, date) rename to _tv_datos_0128;
  end if;
end $$;

revoke all on function public._tv_datos_0128(text, date) from public, anon, authenticated;

create or replace function public.tv_datos(p_token text, p_hoy date default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r jsonb := public._tv_datos_0128(p_token, p_hoy);
  u uuid;
  v_cerrable boolean;
begin
  if r ->> 'estado' is distinct from 'ok' then return r; end if;

  select d.user_id into u from public.tv_dispositivos d where d.token_hash = public._tv_sha(p_token);
  v_cerrable := coalesce((select c.value = 'true'::jsonb from public.app_config c where c.key = 'modos_1011'), false);

  if v_cerrable and not ('iron' = any (public.ai_modos(u))) then
    return r || jsonb_build_object('iron_abierto', false, 'rutina', null, 'proxima', null);
  end if;
  return r || jsonb_build_object('iron_abierto', true);
end $$;

revoke all on function public.tv_datos(text, date) from public, anon, authenticated;
grant execute on function public.tv_datos(text, date) to anon;

comment on function public.tv_datos(text, date) is
  'nivl:tv-datos-0126 nivl:tv-proxima-0128 nivl:tv-iron-0144 · lectura de la TV por token opaco';

notify pgrst, 'reload schema';
commit;
