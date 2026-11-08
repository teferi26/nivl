-- NIVL · 0105 · IRON Resistencia: el entreno medido (reloj, GPS, Salud o a mano).
-- Huella: coalesce(obj_description(to_regclass('public.entrenos_medidos'), 'pg_class') like '%nivl:entrenos-medidos-0105%', false)
--
-- Es el detalle de cada sesión; `cardio_sessions` no cambia de forma y sigue
-- siendo el resumen diario y la llave del XP. Los rangos copian los de
-- `normalizarEntreno` (src/lib/entrenoMedido.ts): lo que el cliente ya limpia
-- aquí no puede colarse por otra vía.
--
-- Salud: gateada como `cardio_sessions` (política restrictiva `health_permission`
-- y trigger `health_write` de la 0030). health_row() trata una tabla que no
-- conoce como de salud, que aquí es justo lo que se quiere. La política va sin
-- to_jsonb(fila): el resultado es el mismo y evita descomprimir la ruta GPS
-- de cada fila solo para contestar «sí, es de salud».
--
-- Exportación y borrado de salud: 0108. Borrado de cuenta: cascada de auth.users.
begin;

create table public.entrenos_medidos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  origen text not null check (origen in ('watch', 'iphone_gps', 'salud', 'manual')),
  externo_id text not null check (char_length(externo_id) between 1 and 200),
  deporte text not null check (deporte in ('carrera', 'bici', 'piscina', 'aguas_abiertas', 'caminar', 'fuerza', 'otro')),
  fecha date not null check (fecha between date '2000-01-01' and date '2100-12-31'),
  inicio timestamptz not null,
  fin timestamptz not null,
  duracion_s integer not null check (duracion_s between 1 and 172800),
  distancia_m numeric check (distancia_m is null or distancia_m between 0 and 1000000),
  kcal numeric check (kcal is null or kcal between 0 and 30000),
  fc_media numeric check (fc_media is null or fc_media between 25 and 250),
  fc_max numeric check (fc_max is null or fc_max between 25 and 250),
  desnivel_m numeric check (desnivel_m is null or desnivel_m between 0 and 30000),
  ruta jsonb check (ruta is null or (jsonb_typeof(ruta) = 'array' and pg_column_size(ruta) < 512000)),
  parciales jsonb not null default '[]'::jsonb
    check (jsonb_typeof(parciales) = 'array' and pg_column_size(parciales) < 512000),
  fc_serie jsonb check (fc_serie is null or (jsonb_typeof(fc_serie) = 'array' and pg_column_size(fc_serie) < 512000)),
  largo_piscina_m numeric check (largo_piscina_m is null or largo_piscina_m between 10 and 100),
  rpe numeric check (rpe is null or rpe between 1 and 10),
  notas text check (notas is null or char_length(notas) <= 2000),
  xp_awarded integer not null default 0 check (xp_awarded >= 0),
  created_at timestamptz not null default now(),
  constraint entrenos_medidos_fechas check (fin > inicio),
  -- La llave de deduplicación: reimportar veinte veces no crea veinte filas.
  constraint entrenos_medidos_externo_key unique (user_id, externo_id)
);
create index entrenos_medidos_fecha_idx on public.entrenos_medidos (user_id, fecha desc);

alter table public.entrenos_medidos enable row level security;
revoke all on public.entrenos_medidos from public, anon;
grant select, insert, update, delete on public.entrenos_medidos to authenticated;
grant all on public.entrenos_medidos to service_role;

create policy "own entrenos_medidos" on public.entrenos_medidos for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy health_permission on public.entrenos_medidos as restrictive for all to authenticated
  using ((select public.health_consent_ok(auth.uid())))
  with check ((select public.health_consent_ok(auth.uid())));

-- Con un borrado de cuenta pendiente no entra nada nuevo (0031).
create trigger account_write_guard before insert or update on public.entrenos_medidos
  for each row execute function public.require_account_active('user_id');
create trigger health_write before insert or update on public.entrenos_medidos
  for each row execute function public.require_health_write();

comment on table public.entrenos_medidos is
  'Entreno medido con ruta, parciales y pulso; dato de salud. nivl:entrenos-medidos-0105';

commit;
