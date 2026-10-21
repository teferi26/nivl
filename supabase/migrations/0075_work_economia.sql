-- NIVL · 0075 · WORK: el control de la economía (cuentas, fijos, transferencias,
-- categorías propias y el brief de fin de mes).
-- Huella: coalesce(obj_description(to_regclass('public.money_recurring'),'pg_class') like '%nivl:work-economia-0075%', false)
--   and coalesce(obj_description(to_regprocedure('public.export_my_data()'),'pg_proc') like '%nivl:export-work-0075%', false)
--
-- Exige la 0072 (copia su exportación v9 entera y le añade las tablas nuevas:
-- v10). Si otra migración posterior a la 0072 cambia export_my_data antes de
-- integrar esta, hay que volver a copiarla aquí.
--
-- Lo que añade, sin tocar nada que ya funcione:
--   1. money_accounts: SALDO INICIAL (opening_balance + opening_date) y orden.
--      El saldo de una cuenta en la app = saldo inicial + movimientos con
--      fecha >= opening_date (src/lib/moneywork.ts → saldoCuenta, con test).
--      La columna `balance` de la 0013 (lo que reporta el banco) sigue ahí
--      para el importador de open banking y el coach.
--   2. money_categories: las categorías del usuario. Cada una cuelga de una
--      categoría base del CHECK de la 0013, así el estudio económico
--      (finance.ts), los presupuestos y el coach siguen funcionando igual.
--   3. money_recurring: el ingreso mensual (sueldo) y los gastos fijos, con su
--      cuenta, su importe y el día de cobro (1 a 31; un 31 en febrero cae el
--      último día del mes).
--   4. transactions: `transfer_id` (las dos patas de una transferencia entre
--      cuentas propias, ambas is_internal), `recurring_id` (el fijo que la
--      generó) y `user_category_id`. `source` admite 'recurrente' y 'extracto'.
--   5. money_briefs: el brief de fin de mes (uno por usuario y mes). Los
--      números los calcula el código (finance.ts); la IA solo redacta.
--   6. coach_runs: kind 'economia_brief' en el libro de gasto de IA.
--   7. export_my_data v10 = v9 de la 0072 + money_categories, money_recurring
--      y money_briefs.
--
-- GENERACIÓN DE LOS FIJOS (decisión, ver src/lib/moneywork.ts):
--   La hace la APP al abrir WORK, no un cron. Cada ocurrencia lleva la huella
--   `rec|<id del fijo>|<YYYY-MM>` y el índice único (user_id, dedup_hash) de
--   la 0013 hace que generar dos veces, o desde dos móviles a la vez, no
--   duplique nunca un mes. Sin abrir la app nadie ve el saldo, así que no hace
--   falta escribirlo antes; si se pasa meses sin abrir, al volver se generan
--   los atrasados con su fecha real (tope 24 meses). Un cron en servidor
--   (ritual) podría llamar a la misma lógica más adelante sin cambiar nada de
--   esto, porque la huella es la misma.
--
-- SEGURIDAD: RLS estricta por usuario en las tres tablas nuevas (solo
-- `authenticated`, solo filas propias; `anon` sin permisos). Las referencias
-- (cuenta, fijo, categoría) se comprueban con un trigger: RLS en la fila hija
-- no impide apuntar al uuid de la cuenta de otra persona.
--
-- El archivo de un extracto importado NO se guarda en ninguna tabla ni en
-- Storage: la función `economia` lo lee en memoria y devuelve una propuesta.
begin;

-- ── 1. Cuentas: saldo inicial ────────────────────────────────────────
alter table public.money_accounts
  add column if not exists opening_balance numeric not null default 0,
  add column if not exists opening_date date not null default current_date,
  add column if not exists sort_order integer not null default 0;

alter table public.money_accounts drop constraint if exists money_accounts_opening_balance_check;
alter table public.money_accounts add constraint money_accounts_opening_balance_check
  check (opening_balance > -1000000000 and opening_balance < 1000000000);
alter table public.money_accounts drop constraint if exists money_accounts_name_len_check;
alter table public.money_accounts add constraint money_accounts_name_len_check
  check (char_length(btrim(name)) between 1 and 40) not valid;

-- ── 2. Categorías del usuario ────────────────────────────────────────
create table if not exists public.money_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 32),
  kind text not null default 'gasto' check (kind in ('gasto', 'ingreso')),
  base_category text not null default 'otros' check (base_category in (
    'ingreso_negocio', 'ingreso_nomina', 'ingreso_otro',
    'vivienda', 'suministros', 'super', 'restaurante', 'transporte',
    'salud', 'gimnasio', 'suscripciones', 'ocio', 'ropa', 'formacion',
    'negocio', 'impuestos', 'comisiones', 'ahorro', 'otros'
  )),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists money_categories_nombre_idx
  on public.money_categories (user_id, lower(btrim(name)));

-- ── 3. Ingreso mensual y gastos fijos ────────────────────────────────
create table if not exists public.money_recurring (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null references public.money_accounts (id) on delete cascade,
  kind text not null check (kind in ('ingreso', 'gasto')),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- Siempre en positivo: el signo lo pone `kind` al generar el movimiento.
  amount numeric not null check (amount > 0 and amount < 1000000000),
  day_of_month smallint not null check (day_of_month between 1 and 31),
  category text not null default 'otros' check (category in (
    'ingreso_negocio', 'ingreso_nomina', 'ingreso_otro',
    'vivienda', 'suministros', 'super', 'restaurante', 'transporte',
    'salud', 'gimnasio', 'suscripciones', 'ocio', 'ropa', 'formacion',
    'negocio', 'impuestos', 'comisiones', 'ahorro', 'otros'
  )),
  user_category_id uuid references public.money_categories (id) on delete set null,
  -- La primera ocurrencia posible: nada anterior a la fecha de alta.
  start_date date not null default current_date,
  end_date date,
  -- Último mes ya generado: borrar a mano una ocurrencia ("ese mes no se
  -- cobró") no hace que vuelva a aparecer.
  generated_through text check (generated_through is null or generated_through ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index if not exists money_recurring_user_idx on public.money_recurring (user_id, active);

-- ── 4. Movimientos: transferencias, fijos y categoría propia ─────────
alter table public.transactions
  add column if not exists transfer_id uuid,
  add column if not exists recurring_id uuid references public.money_recurring (id) on delete set null,
  add column if not exists user_category_id uuid references public.money_categories (id) on delete set null;
create index if not exists transactions_account_idx on public.transactions (user_id, account_id, date);
create index if not exists transactions_transfer_idx on public.transactions (transfer_id) where transfer_id is not null;

alter table public.transactions drop constraint if exists transactions_source_check;
alter table public.transactions add constraint transactions_source_check
  check (source in ('openbanking', 'csv', 'manual', 'coach', 'recurrente', 'extracto'));

-- Una transferencia es SIEMPRE interna: si una pata contara como gasto,
-- mover 500 € al bolsillo de ahorro aparecería como 500 € gastados.
alter table public.transactions drop constraint if exists transactions_transfer_internal_check;
alter table public.transactions add constraint transactions_transfer_internal_check
  check (transfer_id is null or is_internal) not valid;

-- ── 5. El brief de fin de mes ────────────────────────────────────────
create table if not exists public.money_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  -- Las cifras deterministas con las que se redactó (finance.ts).
  numbers jsonb not null default '{}'::jsonb,
  text text not null check (char_length(text) between 1 and 4000),
  model text,
  created_at timestamptz not null default now(),
  unique (user_id, month)
);

-- ── RLS: cada fila, de su dueño; nadie más ───────────────────────────
alter table public.money_categories enable row level security;
alter table public.money_recurring enable row level security;
alter table public.money_briefs enable row level security;
revoke all on public.money_categories, public.money_recurring, public.money_briefs from public, anon;
grant select, insert, update, delete on public.money_categories, public.money_recurring, public.money_briefs to authenticated;

drop policy if exists "own money_categories" on public.money_categories;
create policy "own money_categories" on public.money_categories for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own money_recurring" on public.money_recurring;
create policy "own money_recurring" on public.money_recurring for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own money_briefs" on public.money_briefs;
create policy "own money_briefs" on public.money_briefs for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Referencias propias ──────────────────────────────────────────────
-- RLS en la fila hija no comprueba de quién es la fila a la que apunta: sin
-- esto, un movimiento propio podría colgar de la cuenta de otra persona (y
-- sumar a su saldo en una consulta mal filtrada).
create or replace function public.money_refs_own() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  j jsonb := to_jsonb(new);
  u uuid := new.user_id;
begin
  if j->>'account_id' is not null and not exists (
    select 1 from public.money_accounts a where a.id = (j->>'account_id')::uuid and a.user_id = u) then
    raise exception 'Referencia ajena' using errcode = '42501';
  end if;
  if j->>'user_category_id' is not null and not exists (
    select 1 from public.money_categories c where c.id = (j->>'user_category_id')::uuid and c.user_id = u) then
    raise exception 'Referencia ajena' using errcode = '42501';
  end if;
  if j->>'recurring_id' is not null and not exists (
    select 1 from public.money_recurring r where r.id = (j->>'recurring_id')::uuid and r.user_id = u) then
    raise exception 'Referencia ajena' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.money_refs_own() from public, anon, authenticated;

drop trigger if exists money_refs_own on public.transactions;
create trigger money_refs_own before insert or update of account_id, user_category_id, recurring_id, user_id
  on public.transactions for each row execute function public.money_refs_own();
drop trigger if exists money_refs_own on public.money_recurring;
create trigger money_refs_own before insert or update of account_id, user_category_id, user_id
  on public.money_recurring for each row execute function public.money_refs_own();

-- Topes por persona: sin ellos, un cliente roto podría llenar la tabla.
create or replace function public.money_tope_filas() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer; tope integer;
begin
  tope := case tg_table_name when 'money_categories' then 60 when 'money_recurring' then 100 else 1000 end;
  execute format('select count(*) from public.%I where user_id = $1', tg_table_name) into n using new.user_id;
  if n >= tope then raise exception 'Has llegado al máximo' using errcode = '54000'; end if;
  return new;
end $$;
revoke all on function public.money_tope_filas() from public, anon, authenticated;
drop trigger if exists money_tope_filas on public.money_categories;
create trigger money_tope_filas before insert on public.money_categories
  for each row execute function public.money_tope_filas();
drop trigger if exists money_tope_filas on public.money_recurring;
create trigger money_tope_filas before insert on public.money_recurring
  for each row execute function public.money_tope_filas();

-- ── 6. Libro de gasto de IA: el brief de economía ────────────────────
-- El CHECK vivo (0047) + 'economia_brief'. La lectura de un PDF entra como
-- 'import', que ya existía. NOT VALID como las anteriores.
alter table public.coach_runs drop constraint if exists coach_runs_kind_check;
alter table public.coach_runs add constraint coach_runs_kind_check check (
  kind = any (array[
    'chat', 'brief', 'plan', 'revision_semanal', 'cierre_mensual', 'import', 'escalada',
    'clasificar', 'resumen_semanal', 'resumen_mensual',
    'oracle', 'titular',
    'checkin', 'resumen_hilo',
    'economia_brief'
  ])
) not valid;

comment on table public.money_recurring is
  'Ingreso mensual y gastos fijos de WORK; la app genera cada mes con huella rec|id|YYYY-MM. nivl:work-economia-0075';
comment on table public.money_categories is 'Categorías propias de WORK (cuelgan de una base de la 0013). nivl:work-economia-0075';
comment on table public.money_briefs is 'Brief de fin de mes: cifras de finance.ts + texto de la IA. nivl:work-economia-0075';

-- ── 7. Exportación v10 = la v9 de la 0072 copiada SIN cambios + las tres
-- tablas de WORK. Un cliente viejo recibe lo mismo más tres listas.
create or replace function public.export_my_data() returns jsonb
language plpgsql security definer set search_path=public, pg_temp as $$
declare u uuid:=auth.uid(); t text; rows jsonb;
  result jsonb:=jsonb_build_object('app','NIVL','version',10,'exported_at',clock_timestamp());
begin
  if u is null then raise exception 'No autenticado' using errcode='42501'; end if;
  -- 1. Igual que 0030 (filas completas) y 2. tablas propias sin terceros (v4 + 0045/0048/0050 + 0068 + 0075).
  foreach t in array array['profiles','quests','completions','events','dungeons','dungeon_tasks','calendar_events',
    'gym_days','gym_exercises','gym_sessions','gym_lifts','meal_slots','shopping_items','journal_entries','achievements',
    'rules','rule_breaks','bonus_redemptions','journal_photos','letters','body_metrics','goals','coach_dossier',
    'coach_facts','coach_threads','coach_messages','day_plans','day_blocks','body_profile','cardio_sessions',
    'nutrition_targets','nutrition_logs','training_prescriptions','money_accounts','transactions','category_rules',
    'budgets','money_plan','quest_photos','recaps','rule_checks','ai_consents','health_consents','health_state','health_erasure_jobs',
    'age_confirmations','subscriptions','coach_runs','oracle_usage','push_tokens','social_profile_reviews',
    'social_avatar_paths','elite_group_requests','store_reconciliation','account_erasure_jobs','friend_request_log',
    'recovery_credits','xp_daily_ledger','xp_once',
    'progress_photos','adult_confirmations','daily_scorecards','invite_rewards',
    'user_modes','mode_xp',
    'money_categories','money_recurring','money_briefs'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from public.%I r where %I=$1',
      t,case when t='profiles' then 'id' else 'user_id' end) into rows using u;
    result:=result||jsonb_build_object(t,rows);
  end loop;
  -- Pasos diarios importados (0049): solo si la tabla existe en esta base.
  if to_regclass('public.health_daily_steps') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(r) order by r.date, r.source),''[]''::jsonb) from public.health_daily_steps r where r.user_id=$1'
      into rows using u;
    result:=result||jsonb_build_object('health_daily_steps',rows);
  end if;
  -- 3. Relaciones: solo la parte de la persona (v4, sin cambios).
  result:=result||jsonb_build_object(
    'friendships',(select coalesce(jsonb_agg(jsonb_build_object('rol',case when f.requester=u then 'enviada' else 'recibida' end,
      'status',f.status,'created_at',f.created_at,'accepted_at',f.accepted_at) order by f.created_at),'[]'::jsonb)
      from public.friendships f where u in (f.requester,f.addressee)),
    'social_blocks',(select coalesce(jsonb_agg(jsonb_build_object('created_at',b.created_at) order by b.created_at),'[]'::jsonb)
      from public.social_blocks b where b.blocker=u),
    'social_reports',(select coalesce(jsonb_agg(jsonb_build_object('reason',s.reason,'status',s.status,'created_at',s.created_at,
      'resolved_at',s.resolved_at) order by s.created_at),'[]'::jsonb) from public.social_reports s where s.reporter=u),
    'elite_group_members',(select coalesce(jsonb_agg(jsonb_build_object('joined_at',m.joined_at)),'[]'::jsonb)
      from public.elite_group_members m where m.user_id=u),
    'referrals',(select coalesce(jsonb_agg(jsonb_build_object('creator_code',c.code,'source',r.source,'created_at',r.created_at)),'[]'::jsonb)
      from public.referrals r left join public.creators c on c.id=r.creator_id where r.user_id=u),
    'ai_reports',(select coalesce(jsonb_agg(jsonb_build_object('source',a.source,'message_id',a.message_id,'reason',a.reason,
      'excerpt',a.excerpt,'status',a.status,'created_at',a.created_at,'resolved_at',a.resolved_at) order by a.created_at),'[]'::jsonb)
      from public.ai_reports a where a.reporter=u),
    'store_sales',(select coalesce(jsonb_agg(jsonb_build_object('store',s.store,'product_id',s.product_id,'payment_number',s.payment_number,
      'price_cents',s.price_cents,'currency',s.currency,'purchased_at',s.purchased_at,'refunded_at',s.refunded_at) order by s.purchased_at),'[]'::jsonb)
      from public.store_sales s where s.user_id=u),
    -- Las fotos: la lista de archivos que existen. Los bytes se descargan aparte
    -- con URL firmada (dependencia de UI, ver b-privacidad-borrado.md).
    'storage_objects',(select coalesce(jsonb_agg(jsonb_build_object('bucket',o.bucket_id,'path',o.name,
      'bytes',(o.metadata->>'size')::bigint,'created_at',o.created_at) order by o.bucket_id,o.name),'[]'::jsonb)
      from storage.objects o where o.bucket_id in ('evidence','avatars','progress') and (storage.foldername(o.name))[1]=u::text));
  -- 4. Relaciones nuevas (0045, 0048). Nunca el uuid de la otra parte ni de la fila compartida.
  result:=result||jsonb_build_object(
    -- Invitaciones a NIVL: como invitada (una como mucho) y como quien invita (una por persona invitada).
    'invites',(select coalesce(jsonb_agg(x.o order by x.created_at),'[]'::jsonb) from (
        select i.created_at,jsonb_build_object('rol','recibida','status',i.status,'created_at',i.created_at,'settled_at',i.settled_at) o
          from public.invites i where i.invitee=u
        union all
        select i.created_at,jsonb_build_object('rol','enviada','status',i.status,'created_at',i.created_at,'settled_at',i.settled_at)
          from public.invites i where i.inviter=u) x),
    -- Ligas de las que soy dueña: nombre y fecha; sin ids ni lista de miembros.
    'private_leagues',(select coalesce(jsonb_agg(jsonb_build_object('nombre',l.name,'created_at',l.created_at) order by l.created_at),'[]'::jsonb)
      from public.private_leagues l where l.owner=u),
    -- Mis membresías (incluida la de mis propias ligas).
    'league_members',(select coalesce(jsonb_agg(jsonb_build_object('liga',l.name,'soy_duena',l.owner=u,'joined_at',m.joined_at,
      'liga_created_at',l.created_at) order by m.joined_at),'[]'::jsonb)
      from public.league_members m join public.private_leagues l on l.id=m.league_id where m.user_id=u),
    -- Invitaciones de liga: recibidas por mí, y enviadas desde mis ligas (sin decir a quién).
    'league_invites',(select coalesce(jsonb_agg(x.o order by x.created_at),'[]'::jsonb) from (
        select li.created_at,jsonb_build_object('rol','recibida','liga',l.name,'created_at',li.created_at,'declined_at',li.declined_at,
          'estado',case when li.declined_at is null then 'pendiente' else 'rechazada' end) o
          from public.league_invites li join public.private_leagues l on l.id=li.league_id where li.invitee=u
        union all
        select li.created_at,jsonb_build_object('rol','enviada','liga',l.name,'created_at',li.created_at,
          'estado',case when li.declined_at is null then 'pendiente' else 'rechazada' end)
          from public.league_invites li join public.private_leagues l on l.id=li.league_id where l.owner=u and li.invitee<>u) x),
    -- Duelos: rol, estado, semana y resultado (guardado desde el retador; se añade el de la persona).
    'duels',(select coalesce(jsonb_agg(jsonb_build_object('rol',case when d.challenger=u then 'retador' else 'retado' end,
      'status',d.status,'week_start',d.week_start,'week_end',d.week_start+6,'created_at',d.created_at,'result',d.result,
      'resultado_para_mi',case when d.result is null then null when d.challenger=u then d.result->>'retador'
        else case d.result->>'retador' when 'gano' then 'pierdo' when 'pierdo' then 'gano' else d.result->>'retador' end end)
      order by d.week_start,d.created_at),'[]'::jsonb)
      from public.duels d where u in (d.challenger,d.opponent)));
  -- 5. Programa de creadores (v6): la ficha propia, sus comisiones y sus liquidaciones. Sin el uuid ni
  --    el correo de los compradores, sin sale_id ni payout_id, y sin las notas internas del dueño
  --    (creators.notes, creator_payouts.note), que se dan bajo solicitud de acceso manual.
  result:=result||jsonb_build_object('creador',(
    select jsonb_build_object(
      'code',c.code,'alias',c.alias,'rank',c.rank,'role',c.role,'active',c.active,
      'monthly_fixed_cents',c.monthly_fixed_cents,'created_at',c.created_at,
      'cuentas_atribuidas',(select count(*) from public.referrals r where r.creator_id=c.id),
      'comisiones',(select coalesce(jsonb_agg(jsonb_build_object('kind',k.kind,'rank',k.rank,'pct',k.pct,
          'amount_cents',k.amount_cents,'status',k.status,'available_at',k.available_at,'clawback',k.clawback,
          'clawback_settled_at',k.clawback_settled_at,'voided_reason',k.voided_reason,'created_at',k.created_at,
          'venta_purchased_at',s.purchased_at,'venta_payment_number',s.payment_number,'venta_store',s.store,
          'venta_refunded_at',s.refunded_at) order by k.created_at),'[]'::jsonb)
        from public.commissions k join public.store_sales s on s.id=k.sale_id where k.creator_id=c.id),
      'liquidaciones',(select coalesce(jsonb_agg(jsonb_build_object('kind',p.kind,'amount_cents',p.amount_cents,
          'period',p.period,'paid_at',p.paid_at) order by p.paid_at),'[]'::jsonb)
        from public.creator_payouts p where p.creator_id=c.id),
      'notas_internas','No se incluyen: se facilitan bajo solicitud de acceso a soporte.')
    from public.creators c where c.user_id=u));
  -- Own administrative erasure evidence, without worker lease credentials.
  result := result || jsonb_build_object('store_erasure_cleanup', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'requested_at', q.requested_at, 'retain_until', q.retain_until,
      'next_attempt_at', q.next_attempt_at, 'attempts', q.attempts,
      'last_attempt_at', q.last_attempt_at, 'last_deleted_at', q.last_deleted_at
    )), '[]'::jsonb) from public.store_erasure_cleanup q where q.user_id = u
  ));
  -- v9 (0072, analítica): embudo anónimo, opinión interna y rol admin propios.
  result := result || jsonb_build_object(
    'funnel_events', (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at), '[]'::jsonb)
                        from public.funnel_events r where r.user_id = u),
    'app_feedback', (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at), '[]'::jsonb)
                       from public.app_feedback r where r.user_id = u),
    'admins', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
                 from public.admins r where r.user_id = u));
  return result;
end $$;
revoke all on function public.export_my_data() from public,anon;
grant execute on function public.export_my_data() to authenticated;
comment on function public.export_my_data() is 'Owner-only rights export v10; nivl:export-completo-v4 nivl:export-v5 nivl:export-v6 nivl:store-cleanup-export-0064 nivl:export-modos-0068 nivl:export-analitica-0072 nivl:export-work-0075';

commit;
),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index if not exists money_recurring_user_idx on public.money_recurring (user_id, active);

-- ── 4. Movimientos: transferencias, fijos y categoría propia ─────────
alter table public.transactions
  add column if not exists transfer_id uuid,
  add column if not exists recurring_id uuid references public.money_recurring (id) on delete set null,
  add column if not exists user_category_id uuid references public.money_categories (id) on delete set null;
create index if not exists transactions_account_idx on public.transactions (user_id, account_id, date);
create index if not exists transactions_transfer_idx on public.transactions (transfer_id) where transfer_id is not null;

alter table public.transactions drop constraint if exists transactions_source_check;
alter table public.transactions add constraint transactions_source_check
  check (source in ('openbanking', 'csv', 'manual', 'coach', 'recurrente', 'extracto'));

-- Una transferencia es SIEMPRE interna: si una pata contara como gasto,
-- mover 500 € al bolsillo de ahorro aparecería como 500 € gastados.
alter table public.transactions drop constraint if exists transactions_transfer_internal_check;
alter table public.transactions add constraint transactions_transfer_internal_check
  check (transfer_id is null or is_internal) not valid;

-- ── 5. El brief de fin de mes ────────────────────────────────────────
create table if not exists public.money_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  -- Las cifras deterministas con las que se redactó (finance.ts).
  numbers jsonb not null default '{}'::jsonb,
  text text not null check (char_length(text) between 1 and 4000),
  model text,
  created_at timestamptz not null default now(),
  unique (user_id, month)
);

-- ── RLS: cada fila, de su dueño; nadie más ───────────────────────────
alter table public.money_categories enable row level security;
alter table public.money_recurring enable row level security;
alter table public.money_briefs enable row level security;
revoke all on public.money_categories, public.money_recurring, public.money_briefs from public, anon;
grant select, insert, update, delete on public.money_categories, public.money_recurring, public.money_briefs to authenticated;

drop policy if exists "own money_categories" on public.money_categories;
create policy "own money_categories" on public.money_categories for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own money_recurring" on public.money_recurring;
create policy "own money_recurring" on public.money_recurring for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own money_briefs" on public.money_briefs;
create policy "own money_briefs" on public.money_briefs for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Referencias propias ──────────────────────────────────────────────
-- RLS en la fila hija no comprueba de quién es la fila a la que apunta: sin
-- esto, un movimiento propio podría colgar de la cuenta de otra persona (y
-- sumar a su saldo en una consulta mal filtrada).
create or replace function public.money_refs_own() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  j jsonb := to_jsonb(new);
  u uuid := new.user_id;
begin
  if j->>'account_id' is not null and not exists (
    select 1 from public.money_accounts a where a.id = (j->>'account_id')::uuid and a.user_id = u) then
    raise exception 'Referencia ajena' using errcode = '42501';
  end if;
  if j->>'user_category_id' is not null and not exists (
    select 1 from public.money_categories c where c.id = (j->>'user_category_id')::uuid and c.user_id = u) then
    raise exception 'Referencia ajena' using errcode = '42501';
  end if;
  if j->>'recurring_id' is not null and not exists (
    select 1 from public.money_recurring r where r.id = (j->>'recurring_id')::uuid and r.user_id = u) then
    raise exception 'Referencia ajena' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.money_refs_own() from public, anon, authenticated;

drop trigger if exists money_refs_own on public.transactions;
create trigger money_refs_own before insert or update of account_id, user_category_id, recurring_id, user_id
  on public.transactions for each row execute function public.money_refs_own();
drop trigger if exists money_refs_own on public.money_recurring;
create trigger money_refs_own before insert or update of account_id, user_category_id, user_id
  on public.money_recurring for each row execute function public.money_refs_own();

-- Topes por persona: sin ellos, un cliente roto podría llenar la tabla.
create or replace function public.money_tope_filas() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer; tope integer;
begin
  tope := case tg_table_name when 'money_categories' then 60 when 'money_recurring' then 100 else 1000 end;
  execute format('select count(*) from public.%I where user_id = $1', tg_table_name) into n using new.user_id;
  if n >= tope then raise exception 'Has llegado al máximo' using errcode = '54000'; end if;
  return new;
end $$;
revoke all on function public.money_tope_filas() from public, anon, authenticated;
drop trigger if exists money_tope_filas on public.money_categories;
create trigger money_tope_filas before insert on public.money_categories
  for each row execute function public.money_tope_filas();
drop trigger if exists money_tope_filas on public.money_recurring;
create trigger money_tope_filas before insert on public.money_recurring
  for each row execute function public.money_tope_filas();

-- ── 6. Libro de gasto de IA: el brief de economía ────────────────────
-- El CHECK vivo (0047) + 'economia_brief'. La lectura de un PDF entra como
-- 'import', que ya existía. NOT VALID como las anteriores.
alter table public.coach_runs drop constraint if exists coach_runs_kind_check;
alter table public.coach_runs add constraint coach_runs_kind_check check (
  kind = any (array[
    'chat', 'brief', 'plan', 'revision_semanal', 'cierre_mensual', 'import', 'escalada',
    'clasificar', 'resumen_semanal', 'resumen_mensual',
    'oracle', 'titular',
    'checkin', 'resumen_hilo',
    'economia_brief'
  ])
) not valid;

comment on table public.money_recurring is
  'Ingreso mensual y gastos fijos de WORK; la app genera cada mes con huella rec|id|YYYY-MM. nivl:work-economia-0075';
comment on table public.money_categories is 'Categorías propias de WORK (cuelgan de una base de la 0013). nivl:work-economia-0075';
comment on table public.money_briefs is 'Brief de fin de mes: cifras de finance.ts + texto de la IA. nivl:work-economia-0075';

-- ── 7. Exportación v10 = la v9 de la 0072 copiada SIN cambios + las tres
-- tablas de WORK. Un cliente viejo recibe lo mismo más tres listas.
create or replace function public.export_my_data() returns jsonb
language plpgsql security definer set search_path=public, pg_temp as $$
declare u uuid:=auth.uid(); t text; rows jsonb;
  result jsonb:=jsonb_build_object('app','NIVL','version',10,'exported_at',clock_timestamp());
begin
  if u is null then raise exception 'No autenticado' using errcode='42501'; end if;
  -- 1. Igual que 0030 (filas completas) y 2. tablas propias sin terceros (v4 + 0045/0048/0050 + 0068 + 0075).
  foreach t in array array['profiles','quests','completions','events','dungeons','dungeon_tasks','calendar_events',
    'gym_days','gym_exercises','gym_sessions','gym_lifts','meal_slots','shopping_items','journal_entries','achievements',
    'rules','rule_breaks','bonus_redemptions','journal_photos','letters','body_metrics','goals','coach_dossier',
    'coach_facts','coach_threads','coach_messages','day_plans','day_blocks','body_profile','cardio_sessions',
    'nutrition_targets','nutrition_logs','training_prescriptions','money_accounts','transactions','category_rules',
    'budgets','money_plan','quest_photos','recaps','rule_checks','ai_consents','health_consents','health_state','health_erasure_jobs',
    'age_confirmations','subscriptions','coach_runs','oracle_usage','push_tokens','social_profile_reviews',
    'social_avatar_paths','elite_group_requests','store_reconciliation','account_erasure_jobs','friend_request_log',
    'recovery_credits','xp_daily_ledger','xp_once',
    'progress_photos','adult_confirmations','daily_scorecards','invite_rewards',
    'user_modes','mode_xp',
    'money_categories','money_recurring','money_briefs'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from public.%I r where %I=$1',
      t,case when t='profiles' then 'id' else 'user_id' end) into rows using u;
    result:=result||jsonb_build_object(t,rows);
  end loop;
  -- Pasos diarios importados (0049): solo si la tabla existe en esta base.
  if to_regclass('public.health_daily_steps') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(r) order by r.date, r.source),''[]''::jsonb) from public.health_daily_steps r where r.user_id=$1'
      into rows using u;
    result:=result||jsonb_build_object('health_daily_steps',rows);
  end if;
  -- 3. Relaciones: solo la parte de la persona (v4, sin cambios).
  result:=result||jsonb_build_object(
    'friendships',(select coalesce(jsonb_agg(jsonb_build_object('rol',case when f.requester=u then 'enviada' else 'recibida' end,
      'status',f.status,'created_at',f.created_at,'accepted_at',f.accepted_at) order by f.created_at),'[]'::jsonb)
      from public.friendships f where u in (f.requester,f.addressee)),
    'social_blocks',(select coalesce(jsonb_agg(jsonb_build_object('created_at',b.created_at) order by b.created_at),'[]'::jsonb)
      from public.social_blocks b where b.blocker=u),
    'social_reports',(select coalesce(jsonb_agg(jsonb_build_object('reason',s.reason,'status',s.status,'created_at',s.created_at,
      'resolved_at',s.resolved_at) order by s.created_at),'[]'::jsonb) from public.social_reports s where s.reporter=u),
    'elite_group_members',(select coalesce(jsonb_agg(jsonb_build_object('joined_at',m.joined_at)),'[]'::jsonb)
      from public.elite_group_members m where m.user_id=u),
    'referrals',(select coalesce(jsonb_agg(jsonb_build_object('creator_code',c.code,'source',r.source,'created_at',r.created_at)),'[]'::jsonb)
      from public.referrals r left join public.creators c on c.id=r.creator_id where r.user_id=u),
    'ai_reports',(select coalesce(jsonb_agg(jsonb_build_object('source',a.source,'message_id',a.message_id,'reason',a.reason,
      'excerpt',a.excerpt,'status',a.status,'created_at',a.created_at,'resolved_at',a.resolved_at) order by a.created_at),'[]'::jsonb)
      from public.ai_reports a where a.reporter=u),
    'store_sales',(select coalesce(jsonb_agg(jsonb_build_object('store',s.store,'product_id',s.product_id,'payment_number',s.payment_number,
      'price_cents',s.price_cents,'currency',s.currency,'purchased_at',s.purchased_at,'refunded_at',s.refunded_at) order by s.purchased_at),'[]'::jsonb)
      from public.store_sales s where s.user_id=u),
    -- Las fotos: la lista de archivos que existen. Los bytes se descargan aparte
    -- con URL firmada (dependencia de UI, ver b-privacidad-borrado.md).
    'storage_objects',(select coalesce(jsonb_agg(jsonb_build_object('bucket',o.bucket_id,'path',o.name,
      'bytes',(o.metadata->>'size')::bigint,'created_at',o.created_at) order by o.bucket_id,o.name),'[]'::jsonb)
      from storage.objects o where o.bucket_id in ('evidence','avatars','progress') and (storage.foldername(o.name))[1]=u::text));
  -- 4. Relaciones nuevas (0045, 0048). Nunca el uuid de la otra parte ni de la fila compartida.
  result:=result||jsonb_build_object(
    -- Invitaciones a NIVL: como invitada (una como mucho) y como quien invita (una por persona invitada).
    'invites',(select coalesce(jsonb_agg(x.o order by x.created_at),'[]'::jsonb) from (
        select i.created_at,jsonb_build_object('rol','recibida','status',i.status,'created_at',i.created_at,'settled_at',i.settled_at) o
          from public.invites i where i.invitee=u
        union all
        select i.created_at,jsonb_build_object('rol','enviada','status',i.status,'created_at',i.created_at,'settled_at',i.settled_at)
          from public.invites i where i.inviter=u) x),
    -- Ligas de las que soy dueña: nombre y fecha; sin ids ni lista de miembros.
    'private_leagues',(select coalesce(jsonb_agg(jsonb_build_object('nombre',l.name,'created_at',l.created_at) order by l.created_at),'[]'::jsonb)
      from public.private_leagues l where l.owner=u),
    -- Mis membresías (incluida la de mis propias ligas).
    'league_members',(select coalesce(jsonb_agg(jsonb_build_object('liga',l.name,'soy_duena',l.owner=u,'joined_at',m.joined_at,
      'liga_created_at',l.created_at) order by m.joined_at),'[]'::jsonb)
      from public.league_members m join public.private_leagues l on l.id=m.league_id where m.user_id=u),
    -- Invitaciones de liga: recibidas por mí, y enviadas desde mis ligas (sin decir a quién).
    'league_invites',(select coalesce(jsonb_agg(x.o order by x.created_at),'[]'::jsonb) from (
        select li.created_at,jsonb_build_object('rol','recibida','liga',l.name,'created_at',li.created_at,'declined_at',li.declined_at,
          'estado',case when li.declined_at is null then 'pendiente' else 'rechazada' end) o
          from public.league_invites li join public.private_leagues l on l.id=li.league_id where li.invitee=u
        union all
        select li.created_at,jsonb_build_object('rol','enviada','liga',l.name,'created_at',li.created_at,
          'estado',case when li.declined_at is null then 'pendiente' else 'rechazada' end)
          from public.league_invites li join public.private_leagues l on l.id=li.league_id where l.owner=u and li.invitee<>u) x),
    -- Duelos: rol, estado, semana y resultado (guardado desde el retador; se añade el de la persona).
    'duels',(select coalesce(jsonb_agg(jsonb_build_object('rol',case when d.challenger=u then 'retador' else 'retado' end,
      'status',d.status,'week_start',d.week_start,'week_end',d.week_start+6,'created_at',d.created_at,'result',d.result,
      'resultado_para_mi',case when d.result is null then null when d.challenger=u then d.result->>'retador'
        else case d.result->>'retador' when 'gano' then 'pierdo' when 'pierdo' then 'gano' else d.result->>'retador' end end)
      order by d.week_start,d.created_at),'[]'::jsonb)
      from public.duels d where u in (d.challenger,d.opponent)));
  -- 5. Programa de creadores (v6): la ficha propia, sus comisiones y sus liquidaciones. Sin el uuid ni
  --    el correo de los compradores, sin sale_id ni payout_id, y sin las notas internas del dueño
  --    (creators.notes, creator_payouts.note), que se dan bajo solicitud de acceso manual.
  result:=result||jsonb_build_object('creador',(
    select jsonb_build_object(
      'code',c.code,'alias',c.alias,'rank',c.rank,'role',c.role,'active',c.active,
      'monthly_fixed_cents',c.monthly_fixed_cents,'created_at',c.created_at,
      'cuentas_atribuidas',(select count(*) from public.referrals r where r.creator_id=c.id),
      'comisiones',(select coalesce(jsonb_agg(jsonb_build_object('kind',k.kind,'rank',k.rank,'pct',k.pct,
          'amount_cents',k.amount_cents,'status',k.status,'available_at',k.available_at,'clawback',k.clawback,
          'clawback_settled_at',k.clawback_settled_at,'voided_reason',k.voided_reason,'created_at',k.created_at,
          'venta_purchased_at',s.purchased_at,'venta_payment_number',s.payment_number,'venta_store',s.store,
          'venta_refunded_at',s.refunded_at) order by k.created_at),'[]'::jsonb)
        from public.commissions k join public.store_sales s on s.id=k.sale_id where k.creator_id=c.id),
      'liquidaciones',(select coalesce(jsonb_agg(jsonb_build_object('kind',p.kind,'amount_cents',p.amount_cents,
          'period',p.period,'paid_at',p.paid_at) order by p.paid_at),'[]'::jsonb)
        from public.creator_payouts p where p.creator_id=c.id),
      'notas_internas','No se incluyen: se facilitan bajo solicitud de acceso a soporte.')
    from public.creators c where c.user_id=u));
  -- Own administrative erasure evidence, without worker lease credentials.
  result := result || jsonb_build_object('store_erasure_cleanup', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'requested_at', q.requested_at, 'retain_until', q.retain_until,
      'next_attempt_at', q.next_attempt_at, 'attempts', q.attempts,
      'last_attempt_at', q.last_attempt_at, 'last_deleted_at', q.last_deleted_at
    )), '[]'::jsonb) from public.store_erasure_cleanup q where q.user_id = u
  ));
  -- v9 (0072, analítica): embudo anónimo, opinión interna y rol admin propios.
  result := result || jsonb_build_object(
    'funnel_events', (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at), '[]'::jsonb)
                        from public.funnel_events r where r.user_id = u),
    'app_feedback', (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at), '[]'::jsonb)
                       from public.app_feedback r where r.user_id = u),
    'admins', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
                 from public.admins r where r.user_id = u));
  return result;
end $$;
revoke all on function public.export_my_data() from public,anon;
grant execute on function public.export_my_data() to authenticated;
comment on function public.export_my_data() is 'Owner-only rights export v10; nivl:export-completo-v4 nivl:export-v5 nivl:export-v6 nivl:store-cleanup-export-0064 nivl:export-modos-0068 nivl:export-analitica-0072 nivl:export-work-0075';

commit;
