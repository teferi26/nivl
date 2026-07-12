-- NIVL · 0005 — El Contrato: reglas propias, puntos bonus, diario con fotos,
-- carta al yo futuro. (Traslada el sistema "CAMINO AL ÉXITO" del cuaderno del
-- usuario a la app.) Pegar en SQL Editor después de 0004.

-- ── Reglas del juego (las normas que el usuario se impone) ──────────
create table public.rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position integer not null default 0,
  text text not null,
  consequence text not null, -- lo que toca hacer al romperla, p. ej. "Correr 5 km"
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.rule_breaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rule_id uuid not null references public.rules (id) on delete cascade,
  date date not null,
  note text,
  created_at timestamptz not null default now()
);

-- ── Puntos Bonus (misiones extra → PB canjeables por descanso) ──────
alter table public.profiles
  add column bonus_points integer not null default 0,
  add constraint profiles_bonus_nonneg check (bonus_points >= 0);

alter table public.quests
  add column is_bonus boolean not null default false;

create table public.bonus_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount integer not null check (amount > 0),
  reward text not null, -- p. ej. "1 h de descanso"
  created_at timestamptz not null default now()
);

-- RPC atómicas (delta en SQL): los PB nacen sin el read-modify-write que
-- arrastraba el XP. SECURITY DEFINER pero siempre acotadas a auth.uid().
create or replace function public.award_bonus(p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_total integer;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if p_amount <= 0 or p_amount > 100 then raise exception 'Cantidad inválida'; end if;
  update public.profiles
    set bonus_points = bonus_points + p_amount
    where id = auth.uid()
    returning bonus_points into new_total;
  return new_total;
end;
$$;

create or replace function public.redeem_bonus(p_amount integer, p_reward text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_total integer;
  spent_week integer;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if p_amount <= 0 then raise exception 'Cantidad inválida'; end if;

  -- Regla 6 del cuaderno: máximo 30 PB canjeados por semana.
  select coalesce(sum(amount), 0) into spent_week
    from public.bonus_redemptions
    where user_id = auth.uid() and created_at > now() - interval '7 days';
  if spent_week + p_amount > 30 then
    raise exception 'Tope semanal alcanzado: máximo 30 PB canjeados cada 7 días';
  end if;

  update public.profiles
    set bonus_points = bonus_points - p_amount
    where id = auth.uid() and bonus_points >= p_amount
    returning bonus_points into new_total;
  if not found then
    raise exception 'Puntos Bonus insuficientes';
  end if;

  insert into public.bonus_redemptions (user_id, amount, reward)
    values (auth.uid(), p_amount, p_reward);
  return new_total;
end;
$$;

revoke all on function public.award_bonus(integer) from public, anon;
revoke all on function public.redeem_bonus(integer, text) from public, anon;
grant execute on function public.award_bonus(integer) to authenticated;
grant execute on function public.redeem_bonus(integer, text) to authenticated;

-- ── Diario de dos hojas + fotos comprobante ─────────────────────────
alter table public.journal_entries
  add column plan text; -- segunda "hoja": el plan del día (text = lo vivido/aprendido)

create table public.journal_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  path text not null, -- objeto en el bucket evidence ({user_id}/journal/...)
  created_at timestamptz not null default now()
);

create index journal_photos_date_idx on public.journal_photos (user_id, date desc);

-- ── Carta al yo del futuro ──────────────────────────────────────────
create table public.letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null,
  sealed_at timestamptz not null default now(),
  open_at date not null,
  opened_at timestamptz
);

-- ── RLS ─────────────────────────────────────────────────────────────
alter table public.rules enable row level security;
alter table public.rule_breaks enable row level security;
alter table public.bonus_redemptions enable row level security;
alter table public.journal_photos enable row level security;
alter table public.letters enable row level security;

create policy "own rules" on public.rules for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rule_breaks" on public.rule_breaks for all to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.rules r where r.id = rule_id and r.user_id = auth.uid())
  );
create policy "own bonus_redemptions" on public.bonus_redemptions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own journal_photos" on public.journal_photos for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own letters" on public.letters for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
