-- NIVL · 0135 · La pausa del coach: tres días sin escribirle y deja de gastar IA.
-- Huella para scripts/apply-migrations.mjs:
--   coalesce(obj_description(to_regprocedure('public.reactivar_coach()'), 'pg_proc') like '%nivl:coach-pausa-0135%', false)
--
-- Una sola columna, de la que la pausa se DERIVA (src/lib/coachpausa.ts y su
-- espejo _shared/coachpausa.ts): ni flag ni cron. La escriben, y nadie más:
--   · reactivar_coach(), con el JWT del usuario: la llama la app al
--     comprometerse y la función `coach` en cada turno de chat que él escribe;
--   · el trigger de abajo, al estrenar derecho a la IA.
-- Los encargos del cron y los resultados de herramientas no la tocan. El UPDATE
-- de `profiles` va por columnas desde la 0009 y esta no se concede: el cliente
-- no puede escribirla directamente.
--
-- Va entera en profiles, así que export_my_data() (fila completa) ya la vuelca
-- y el borrado de la cuenta se la lleva.
begin;

alter table public.profiles add column if not exists coach_last_reply_at timestamptz;

-- El último mensaje que escribió de verdad. Sin ninguno, ahora: nadie entra en
-- pausa de golpe por no haber escrito nunca. El patrón es ENCARGO_DEL_CRON de
-- _shared/checkin.ts.
update public.profiles p
set coach_last_reply_at = coalesce(
  (select max(m.created_at)
     from public.coach_messages m
    where m.user_id = p.id
      and m.role = 'user'
      and m.content->0->>'type' = 'text'
      and btrim(coalesce(m.content->0->>'text', ''), E' \t\r\n') <> ''
      and btrim(m.content->0->>'text', E' \t\r\n') !~
        '^(\[ritual: [a-z_]+\]|Cierra el mes\.|Haz la revisión de la semana\.|Lleva cuatro días en silencio\.|Es [0-9]{4}-[0-9]{2}-[0-9]{2}\. (Dicta el brief|Escribe el plan))'),
  now())
where p.coach_last_reply_at is null;

alter table public.profiles alter column coach_last_reply_at set default now();
alter table public.profiles alter column coach_last_reply_at set not null;

-- Reactivar: propia del usuario autenticado. Solo pone el reloj a cero; no da
-- XP, no toca la suscripción y no abre ningún tope de IA. Repetirla es inocuo.
create or replace function public.reactivar_coach()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ahora timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;
  update public.profiles set coach_last_reply_at = v_ahora where id = auth.uid();
  return v_ahora;
end;
$$;

revoke all on function public.reactivar_coach() from public, anon;
grant execute on function public.reactivar_coach() to authenticated, service_role;
comment on function public.reactivar_coach() is
  'nivl:coach-pausa-0135 · Vuelve a poner en marcha el coach del usuario autenticado.';

-- Quien estrena derecho (compra, prueba, vuelta tras caducar) no llega en pausa
-- por los meses que pasó sin coach: el reloj empieza con el derecho.
create or replace function public.coach_reloj_al_estrenar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('active', 'trialing')
     and (tg_op = 'INSERT'
          or old.status not in ('active', 'trialing')
          or (old.current_period_end is not null and old.current_period_end < now() - interval '2 days')) then
    update public.profiles set coach_last_reply_at = now() where id = new.user_id;
  end if;
  return new;
exception when others then
  -- Una compra no puede romperse por esto.
  return new;
end;
$$;

revoke all on function public.coach_reloj_al_estrenar() from public, anon, authenticated;

drop trigger if exists coach_reloj_al_estrenar on public.subscriptions;
create trigger coach_reloj_al_estrenar
  after insert or update of status, current_period_end on public.subscriptions
  for each row execute function public.coach_reloj_al_estrenar();

commit;
