-- 0075 · FOCUS: el mundo del estudiante (asignaturas, temario, exámenes, sesiones de estudio,
-- horario de clases, notas y flashcards). docs/modos/FOCUS.md
-- Huella: coalesce(obj_description(to_regclass('public.focus_subjects'),'pg_class') like '%nivl:focus-0075%', false)
--         and coalesce(obj_description(to_regprocedure('public.export_my_data()'),'pg_proc') like '%nivl:export-focus-0075%', false)
--
-- Escrita, NO aplicada (la aplica el dueño con `node scripts/apply-migrations.mjs`). Hasta entonces la
-- app no se rompe: src/focus/datos.ts trata «la tabla no existe» como estado vacío.
--
-- Reglas:
--   · RLS estricta por usuario en las ocho tablas: cada fila es de `user_id = auth.uid()` (select,
--     insert, update, delete). Sin acceso anónimo. Las referencias entre tablas se validan con
--     triggers: no se puede colgar un tema, una clase o una nota de la asignatura de otra cuenta.
--   · CERO economía nueva: ninguna tabla mueve XP. Una sesión de estudio solo paga si cumple una
--     misión de FOCUS, y eso va por `complete_quest` (que ya suma el XP del modo, 0068).
--   · Borrado: FK a auth.users on delete cascade (el borrado de la cuenta se lo lleva todo).
--   · Exportación: `export_my_data` v10 = la v9 de la 0072 copiada entera + las ocho tablas.
--   · Topes: textos cortos y cuántas filas puede tener una cuenta (un bucle o un script con un
--     token válido no llena la base).
begin;

-- ── Asignaturas ───────────────────────────────────────────────────────
create table if not exists public.focus_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  position int not null default 0 check (position between 0 and 10000),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists focus_subjects_user_idx on public.focus_subjects (user_id, position);

-- ── Exámenes ──────────────────────────────────────────────────────────
create table if not exists public.focus_exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null references public.focus_subjects (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  exam_date date not null check (exam_date between date '2000-01-01' and date '2100-12-31'),
  weight numeric(5,2) null check (weight is null or (weight > 0 and weight <= 100)),
  created_at timestamptz not null default now()
);
create index if not exists focus_exams_user_idx on public.focus_exams (user_id, exam_date);

-- ── Temario: temas de una asignatura (y, si se dice, de un examen) ───
create table if not exists public.focus_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null references public.focus_subjects (id) on delete cascade,
  exam_id uuid null references public.focus_exams (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  status text not null default 'pendiente' check (status in ('pendiente','repasando','dominado')),
  position int not null default 0 check (position between 0 and 10000),
  -- Repetición espaciada (1, 3, 7, 14, 30 días): etapa 0 a 4 y siguiente repaso.
  review_stage smallint not null default 0 check (review_stage between 0 and 4),
  review_due date null,
  created_at timestamptz not null default now()
);
create index if not exists focus_topics_user_idx on public.focus_topics (user_id, subject_id, position);

-- ── Sesiones de estudio (los bloques de foco terminados) ─────────────
create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid null references public.focus_subjects (id) on delete set null,
  topic_id uuid null references public.focus_topics (id) on delete set null,
  -- La misión de FOCUS que pagó el bloque (si la había). Solo informativo: el pago es de complete_quest.
  quest_id uuid null references public.quests (id) on delete set null,
  -- Id del bloque en el teléfono: la misma fase no se registra dos veces (reintentos, dos pantallas).
  client_id text not null check (char_length(client_id) between 1 and 80),
  session_date date not null,
  minutes smallint not null check (minutes between 1 and 240),
  method text null check (method is null or method in ('pomodoro','recuerdo','espaciada','feynman','flashcards','mapas','anteriores')),
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);
create index if not exists focus_sessions_user_idx on public.focus_sessions (user_id, session_date desc);

-- ── Horario de clases ─────────────────────────────────────────────────
create table if not exists public.focus_classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null references public.focus_subjects (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  start_min smallint not null check (start_min between 0 and 1439),
  end_min smallint not null check (end_min between 1 and 1440),
  room text null check (room is null or char_length(room) <= 60),
  created_at timestamptz not null default now(),
  constraint focus_classes_horas check (end_min > start_min)
);
create index if not exists focus_classes_user_idx on public.focus_classes (user_id, weekday, start_min);

-- ── Notas ─────────────────────────────────────────────────────────────
create table if not exists public.focus_grades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null references public.focus_subjects (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  score numeric(6,2) not null check (score >= 0),
  max_score numeric(6,2) not null default 10 check (max_score > 0 and max_score <= 1000),
  weight numeric(5,2) null check (weight is null or (weight > 0 and weight <= 100)),
  graded_on date not null default current_date,
  created_at timestamptz not null default now(),
  constraint focus_grades_rango check (score <= max_score)
);
create index if not exists focus_grades_user_idx on public.focus_grades (user_id, subject_id, graded_on);

-- ── Flashcards: mazos y tarjetas (repaso con la repetición espaciada) ─
create table if not exists public.focus_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid null references public.focus_subjects (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);
create index if not exists focus_decks_user_idx on public.focus_decks (user_id, created_at);

create table if not exists public.focus_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  deck_id uuid not null references public.focus_decks (id) on delete cascade,
  front text not null check (char_length(btrim(front)) between 1 and 500),
  back text not null check (char_length(btrim(back)) between 1 and 1000),
  stage smallint not null default 0 check (stage between 0 and 4),
  due date not null default current_date,
  last_reviewed_at timestamptz null,
  created_at timestamptz not null default now()
);
create index if not exists focus_cards_user_idx on public.focus_cards (user_id, deck_id, due);

-- ── RLS: cada cuenta, lo suyo ─────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['focus_subjects','focus_exams','focus_topics','focus_sessions',
                           'focus_classes','focus_grades','focus_decks','focus_cards'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "focus propio" on public.%I', t);
    execute format('create policy "focus propio" on public.%I for all to authenticated '
                   'using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Nadie cambia el dueño de una fila (ni la mueve a otra cuenta).
create or replace function public._focus_dueno_fijo()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'No se cambia el dueño' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public._focus_dueno_fijo() from public, anon, authenticated;

-- Las referencias son de la misma cuenta: un tema no cuelga de la asignatura de otro, etc.
-- SECURITY DEFINER para poder mirar la fila referida aunque la RLS la esconda, y se valida
-- contra el user_id de la fila nueva (que la RLS ya obliga a ser auth.uid()).
create or replace function public._focus_misma_cuenta()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  j jsonb := to_jsonb(new);
  ref uuid;
begin
  if j ? 'subject_id' and (j->>'subject_id') is not null then
    ref := (j->>'subject_id')::uuid;
    if not exists (select 1 from public.focus_subjects s where s.id = ref and s.user_id = new.user_id) then
      raise exception 'Asignatura ajena' using errcode = '42501';
    end if;
  end if;
  if j ? 'exam_id' and (j->>'exam_id') is not null then
    ref := (j->>'exam_id')::uuid;
    if not exists (select 1 from public.focus_exams e where e.id = ref and e.user_id = new.user_id) then
      raise exception 'Examen ajeno' using errcode = '42501';
    end if;
  end if;
  if j ? 'topic_id' and (j->>'topic_id') is not null then
    ref := (j->>'topic_id')::uuid;
    if not exists (select 1 from public.focus_topics x where x.id = ref and x.user_id = new.user_id) then
      raise exception 'Tema ajeno' using errcode = '42501';
    end if;
  end if;
  if j ? 'deck_id' and (j->>'deck_id') is not null then
    ref := (j->>'deck_id')::uuid;
    if not exists (select 1 from public.focus_decks d where d.id = ref and d.user_id = new.user_id) then
      raise exception 'Mazo ajeno' using errcode = '42501';
    end if;
  end if;
  if j ? 'quest_id' and (j->>'quest_id') is not null then
    ref := (j->>'quest_id')::uuid;
    if not exists (select 1 from public.quests q where q.id = ref and q.user_id = new.user_id) then
      raise exception 'Misión ajena' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
revoke all on function public._focus_misma_cuenta() from public, anon, authenticated;

-- Topes por cuenta (filas vivas). Generosos para un curso entero; frenan un bucle.
create or replace function public._focus_tope()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare n int; tope int := tg_argv[0]::int;
begin
  execute format('select count(*) from public.%I where user_id = $1', tg_table_name) into n using new.user_id;
  if n >= tope then
    raise exception 'Has llegado al máximo de filas de %', tg_table_name using errcode = '54000';
  end if;
  return new;
end $$;
revoke all on function public._focus_tope() from public, anon, authenticated;

do $$
declare
  t text;
  topes jsonb := '{"focus_subjects":60,"focus_exams":300,"focus_topics":3000,"focus_sessions":20000,
                   "focus_classes":200,"focus_grades":1000,"focus_decks":200,"focus_cards":10000}';
begin
  foreach t in array array['focus_subjects','focus_exams','focus_topics','focus_sessions',
                           'focus_classes','focus_grades','focus_decks','focus_cards'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_dueno', t);
    execute format('create trigger %I before update on public.%I for each row execute function public._focus_dueno_fijo()',
                   t || '_dueno', t);
    execute format('drop trigger if exists %I on public.%I', t || '_cuenta', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public._focus_misma_cuenta()',
                   t || '_cuenta', t);
    execute format('drop trigger if exists %I on public.%I', t || '_tope', t);
    execute format('create trigger %I before insert on public.%I for each row execute function public._focus_tope(%L)',
                   t || '_tope', t, (topes->>t));
  end loop;
end $$;

comment on table public.focus_subjects is 'nivl:focus-0075 · Asignaturas del modo FOCUS. RLS de dueño. Sin XP.';
comment on table public.focus_exams is 'nivl:focus-0075 · Exámenes (fecha y peso).';
comment on table public.focus_topics is 'nivl:focus-0075 · Temario: estado y repetición espaciada (1, 3, 7, 14, 30 días).';
comment on table public.focus_sessions is 'nivl:focus-0075 · Bloques de foco terminados. Cero XP propio: paga la misión (complete_quest).';
comment on table public.focus_classes is 'nivl:focus-0075 · Horario de clases.';
comment on table public.focus_grades is 'nivl:focus-0075 · Notas (media ponderada en el cliente, src/focus/notas.ts).';
comment on table public.focus_decks is 'nivl:focus-0075 · Mazos de flashcards.';
comment on table public.focus_cards is 'nivl:focus-0075 · Flashcards (sistema Leitner con los intervalos de repaso).';

-- ── Exportación v10 = v9 (0072) + las ocho tablas de FOCUS ────────────
create or replace function public.export_my_data() returns jsonb
language plpgsql security definer set search_path=public, pg_temp as $$
declare u uuid:=auth.uid(); t text; rows jsonb;
  result jsonb:=jsonb_build_object('app','NIVL','version',10,'exported_at',clock_timestamp());
begin
  if u is null then raise exception 'No autenticado' using errcode='42501'; end if;
  -- 1. Igual que 0030 (filas completas) y 2. tablas propias sin terceros (v4 + 0045/0048/0050 + 0068).
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
    -- v10 (0075, FOCUS): el mundo del estudiante.
    'focus_subjects','focus_exams','focus_topics','focus_sessions','focus_classes','focus_grades',
    'focus_decks','focus_cards'] loop
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
comment on function public.export_my_data() is 'Owner-only rights export v10; nivl:export-completo-v4 nivl:export-v5 nivl:export-v6 nivl:store-cleanup-export-0064 nivl:export-modos-0068 nivl:export-analitica-0072 nivl:export-focus-0075';

commit;
