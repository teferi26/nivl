-- PROPUESTA (Chat 3 · b) — NO aplicada. El número final lo asigna quien la integre.
-- Problema (P1): store_events (0027) guarda app_user_id = uuid de la cuenta y el
-- payload COMPLETO de RevenueCat (aliases, original_app_user_id, atributos como
-- creator_code, transferred_from/to), sin FK ni purga. Borrar la cuenta deja
-- esas filas vinculadas para siempre (reproducido: es la única tabla con rastro
-- tras el borrado simulado de una cuenta ficticia).
-- Solución (acordada con el coordinador y el Chat 2): se REDACTA, no se borra.
-- store_events.id es la clave de idempotencia de apply_store_event: si se borrara,
-- un reenvío de RevenueCat reprocesaría un reembolso (record_refund corre antes
-- de buscar al usuario). Se conservan id, type, environment y received_at; el
-- payload pasa a {id, type, redacted:true}; app_user_id a null.
-- Columnas verificadas en remoto (2026-10-02): id, type, app_user_id,
-- environment, payload, note, received_at.
-- Se hace en un trigger AFTER DELETE de public.profiles, que corre DENTRO de la
-- misma transacción que borra auth.users (cascada): atómico con el borrado de
-- Auth, sin cambios en la Edge Function. Un evento que llegue DESPUÉS del
-- borrado para ese uuid se guarda ya redactado (apply_store_event procesa su
-- argumento p_event, no la fila guardada: su lógica, incluido TRANSFER, no cambia).
-- Despliegue: 1) esta migración (+ huella en scripts/apply-migrations.mjs). Sin
-- Edge Function ni OTA. Compatible con el webhook actual.
begin;
create or replace function public.store_events_redact(p_user text) returns integer
language plpgsql security definer set search_path=public as $$
declare n integer;
begin
  update public.store_events
     set payload=jsonb_build_object('id',id,'type',type,'redacted',true),
         app_user_id=null,
         note='redactado por borrado'
   where app_user_id=p_user
      or payload->>'original_app_user_id'=p_user
      or payload->'aliases' ? p_user
      or payload->'transferred_from' ? p_user
      or payload->'transferred_to' ? p_user;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.store_events_redact(text) from public,anon,authenticated;
grant execute on function public.store_events_redact(text) to service_role;

create or replace function public.store_events_forget_account() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  perform public.store_events_redact(old.id::text);
  return old;
end $$;
revoke all on function public.store_events_forget_account() from public,anon,authenticated;
drop trigger if exists store_events_forget_account on public.profiles;
create trigger store_events_forget_account after delete on public.profiles
  for each row execute function public.store_events_forget_account();

-- Eventos tardíos (renovación/cancelación ya en camino) de una cuenta borrada.
create or replace function public.store_events_redact_unknown() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.app_user_id ~* '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
     and not exists(select 1 from auth.users where id=new.app_user_id::uuid) then
    new.payload:=jsonb_build_object('id',new.id,'type',new.type,'redacted',true);
    new.app_user_id:=null;
    new.note:='redactado por borrado';
  end if;
  return new;
end $$;
revoke all on function public.store_events_redact_unknown() from public,anon,authenticated;
drop trigger if exists store_events_redact_unknown on public.store_events;
create trigger store_events_redact_unknown before insert on public.store_events
  for each row execute function public.store_events_redact_unknown();

-- Filas ya huérfanas de cuentas borradas antes de esta migración. Solo uuids:
-- los ids anónimos de RevenueCat ($RCAnonymousID…) no se tocan.
update public.store_events e
   set payload=jsonb_build_object('id',e.id,'type',e.type,'redacted',true),
       app_user_id=null,
       note='redactado por borrado'
 where e.app_user_id ~* '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
   and not exists(select 1 from auth.users u where u.id=e.app_user_id::uuid);
commit;
