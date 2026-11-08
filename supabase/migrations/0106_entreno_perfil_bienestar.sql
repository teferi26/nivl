-- NIVL · 0106 · IRON Resistencia: perfil fisiológico, ubicación aproximada y bienestar diario.
-- Huella: coalesce(obj_description(to_regclass('public.entreno_perfil'), 'pg_class') like '%nivl:entreno-perfil-0106%', false) and coalesce(obj_description(to_regclass('public.entreno_bienestar'), 'pg_class') like '%nivl:entreno-bienestar-0106%', false)
--
-- La ubicación solo existe redondeada a 2 decimales (un kilómetro y pico, la
-- ciudad, no la casa) y solo con consentimiento fechado: lo garantiza un CHECK,
-- no la buena voluntad del cliente.
--
-- Salud: como `cardio_sessions` (ver 0105). Exportación y borrado de salud: 0108.
begin;

create table public.entreno_perfil (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  fc_max numeric check (fc_max is null or fc_max between 80 and 250),
  fc_reposo numeric check (fc_reposo is null or fc_reposo between 20 and 150),
  fc_umbral numeric check (fc_umbral is null or fc_umbral between 60 and 240),
  ftp_w numeric check (ftp_w is null or ftp_w between 20 and 700),
  css_seg_100m numeric check (css_seg_100m is null or css_seg_100m between 30 and 400),
  ubicacion_lat numeric check (ubicacion_lat is null or (ubicacion_lat between -90 and 90 and ubicacion_lat = round(ubicacion_lat, 2))),
  ubicacion_lon numeric check (ubicacion_lon is null or (ubicacion_lon between -180 and 180 and ubicacion_lon = round(ubicacion_lon, 2))),
  ubicacion_nombre text check (ubicacion_nombre is null or char_length(ubicacion_nombre) <= 120),
  ubicacion_consentida_en timestamptz,
  updated_at timestamptz not null default now(),
  constraint entreno_perfil_ubicacion_par check ((ubicacion_lat is null) = (ubicacion_lon is null)),
  constraint entreno_perfil_ubicacion_consentida check (ubicacion_lat is null or ubicacion_consentida_en is not null)
);

create table public.entreno_bienestar (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha date not null check (fecha between date '2000-01-01' and date '2100-12-31'),
  sueno_h numeric check (sueno_h is null or sueno_h between 0 and 24),
  calidad integer check (calidad is null or calidad between 1 and 5),
  fatiga integer check (fatiga is null or fatiga between 1 and 5),
  dolor boolean not null default false,
  dolor_zona text check (dolor_zona is null or char_length(dolor_zona) <= 120),
  vfc_ms numeric check (vfc_ms is null or vfc_ms between 0 and 500),
  fc_reposo numeric check (fc_reposo is null or fc_reposo between 20 and 150),
  origen text check (origen is null or char_length(origen) <= 40),
  primary key (user_id, fecha)
);

alter table public.entreno_perfil enable row level security;
alter table public.entreno_bienestar enable row level security;
revoke all on public.entreno_perfil, public.entreno_bienestar from public, anon;
grant select, insert, update, delete on public.entreno_perfil, public.entreno_bienestar to authenticated;
grant all on public.entreno_perfil, public.entreno_bienestar to service_role;

do $$
declare t text;
begin
  foreach t in array array['entreno_perfil', 'entreno_bienestar'] loop
    execute format('create policy %I on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', 'own ' || t, t);
    execute format('create policy health_permission on public.%I as restrictive for all to authenticated using ((select public.health_consent_ok(auth.uid()))) with check ((select public.health_consent_ok(auth.uid())))', t);
    execute format('create trigger account_write_guard before insert or update on public.%I for each row execute function public.require_account_active(%L)', t, 'user_id');
    execute format('create trigger health_write before insert or update on public.%I for each row execute function public.require_health_write()', t);
  end loop;
end $$;

comment on table public.entreno_perfil is
  'Zonas, umbrales y ubicación aproximada con consentimiento; dato de salud. nivl:entreno-perfil-0106';
comment on table public.entreno_bienestar is
  'Sueño, fatiga y dolor por día; dato de salud. nivl:entreno-bienestar-0106';

commit;
