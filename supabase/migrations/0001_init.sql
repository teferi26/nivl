-- NIVL · Fase 1 — esquema inicial
-- Pegar completo en: Supabase Dashboard → SQL Editor → Run

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'Cazador',
  avatar_url text,
  xp_total integer not null default 0,
  xp_fue integer not null default 0,
  xp_vit integer not null default 0,
  xp_int integer not null default 0,
  xp_agi integer not null default 0,
  xp_per integer not null default 0,
  streak_days integer not null default 0,
  last_day_processed date,
  created_at timestamptz not null default now()
);

create table public.quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  stat text not null check (stat in ('FUE', 'VIT', 'INT', 'AGI', 'PER')),
  difficulty text not null check (difficulty in ('trivial', 'facil', 'media', 'dificil', 'epica')),
  days_of_week integer[] not null default '{1,2,3,4,5,6,7}',
  requires_evidence boolean not null default false,
  active boolean not null default true,
  is_penalty boolean not null default false,
  penalty_date date,
  penalty_xp integer,
  created_at timestamptz not null default now()
);

create table public.completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  quest_id uuid not null references public.quests (id) on delete cascade,
  date date not null,
  completed_at timestamptz not null default now(),
  xp_awarded integer not null,
  evidence_url text,
  unique (user_id, quest_id, date)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index quests_user_active_idx on public.quests (user_id, active);
create index completions_user_date_idx on public.completions (user_id, date);
create index events_user_created_idx on public.events (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.quests enable row level security;
alter table public.completions enable row level security;
alter table public.events enable row level security;

create policy "own profile" on public.profiles
  for all to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "own quests" on public.quests
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own completions" on public.completions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own events" on public.events
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Crea el perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Buckets privados para evidencias y avatar
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

-- Cada usuario solo accede a su carpeta ({user_id}/...)
create policy "own evidence" on storage.objects
  for all to authenticated
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own avatars" on storage.objects
  for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
