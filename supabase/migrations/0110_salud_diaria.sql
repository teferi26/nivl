-- NIVL · 0110 · Resumen diario de Apple Salud y la preferencia de enviarlo al coach.
-- Huella para scripts/apply-migrations.mjs:
--   to_regclass('public.salud_diaria') is not null
--   and coalesce(obj_description(to_regprocedure('public.export_my_data()'), 'pg_proc') like '%nivl:salud-diaria-0110%', false)
--   and coalesce(obj_description(to_regprocedure('public.complete_health_erasure(uuid,uuid)'), 'pg_proc') like '%nivl:salud-diaria-0110%', false)
-- Orden: esta migración → OTA o binario con la subida (`src/lib/medicion/saludDiaria.ts`) → `coach`.
--
-- Por qué ENVOLTORIOS y no otra copia de export_my_data y complete_health_erasure: es el criterio de la
-- 0079. Otras ramas reescriben o envuelven esas funciones; una copia entera aquí borraría lo suyo si se
-- aplicara después. Envueltas, las migraciones se componen en cualquier orden, y re-ejecutar esta vuelve a
-- envolver si alguien las sustituyó por una copia (detecta por el comentario si la vigente ya es esta).
begin;

-- Una fila por persona y día local del móvil. Un valor sin muestras es null, nunca 0.
create table if not exists public.salud_diaria (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fecha date not null,
  pasos integer check (pasos between 0 and 300000),
  kcal_activas integer check (kcal_activas between 0 and 30000),
  fc_media smallint check (fc_media between 25 and 250),
  fc_max smallint check (fc_max between 25 and 250),
  fc_reposo smallint check (fc_reposo between 25 and 250),
  sueno_min smallint check (sueno_min between 0 and 1440),
  peso_kg numeric(5,2) check (peso_kg > 20 and peso_kg < 400),
  primary key (user_id, fecha),
  constraint salud_diaria_fecha_suelo check (fecha >= date '2000-01-01')
);
alter table public.salud_diaria enable row level security;
revoke all on public.salud_diaria from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.salud_diaria to authenticated;
grant select, insert, update, delete on public.salud_diaria to service_role;

drop policy if exists salud_diaria_owner on public.salud_diaria;
create policy salud_diaria_owner on public.salud_diaria for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Como las demás tablas de salud (0030): health_row('salud_diaria', …) cae en «else true».
drop policy if exists health_permission on public.salud_diaria;
create policy health_permission on public.salud_diaria as restrictive for all to authenticated
  using (not public.health_row('salud_diaria', to_jsonb(salud_diaria)) or public.health_consent_ok(auth.uid()))
  with check (not public.health_row('salud_diaria', to_jsonb(salud_diaria)) or public.health_consent_ok(auth.uid()));
-- El disparador comprueba además la revisión del permiso, igual que el resto.
drop trigger if exists health_write on public.salud_diaria;
create trigger health_write before insert or update on public.salud_diaria
  for each row execute function public.require_health_write();

-- Enviar al coach es otra aceptación, apagada por defecto y aparte del permiso de IA.
create table if not exists public.salud_preferencias (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  enviar_a_coach boolean not null default false,
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.salud_preferencias enable row level security;
revoke all on public.salud_preferencias from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.salud_preferencias to authenticated;
grant select, insert, update, delete on public.salud_preferencias to service_role;

drop policy if exists salud_preferencias_owner on public.salud_preferencias;
create policy salud_preferencias_owner on public.salud_preferencias for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Apagarlo se puede siempre; encenderlo, solo con el permiso de salud vigente.
drop policy if exists salud_preferencias_permiso on public.salud_preferencias;
create policy salud_preferencias_permiso on public.salud_preferencias as restrictive for all to authenticated
  using (true)
  with check (not enviar_a_coach or public.health_consent_ok(auth.uid()));

-- Exportación (RGPD arts. 15 y 20; regla de AGENTS.md).
do $$
begin
  if to_regprocedure('public.export_my_data()') is null then
    raise exception 'export_my_data() no existe: aplica antes la 0079';
  end if;
  if coalesce(obj_description(to_regprocedure('public.export_my_data()'), 'pg_proc'), '') not like '%nivl:salud-diaria-0110%' then
    drop function if exists public._export_my_data_sin_salud_diaria();
    alter function public.export_my_data() rename to _export_my_data_sin_salud_diaria;
  end if;
end $$;

revoke all on function public._export_my_data_sin_salud_diaria() from public, anon, authenticated;

create or replace function public.export_my_data() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  return public._export_my_data_sin_salud_diaria() || jsonb_build_object(
    'salud_diaria', (select coalesce(jsonb_agg(to_jsonb(s) order by s.fecha), '[]'::jsonb)
      from public.salud_diaria s where s.user_id = u),
    'salud_preferencias', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
      from public.salud_preferencias p where p.user_id = u));
end $$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
-- Conserva las marcas de lo envuelto: las huellas anteriores las buscan en export_my_data().
do $$
begin
  execute format('comment on function public.export_my_data() is %L',
    coalesce(obj_description(to_regprocedure('public._export_my_data_sin_salud_diaria()'), 'pg_proc'), '')
    || ' · nivl:salud-diaria-0110 (envoltorio + salud_diaria y salud_preferencias)');
end $$;

-- Borrado de salud: la función envuelta valida rol y trabajo, y si falla aquí no se borra nada (una transacción).
do $$
begin
  if to_regprocedure('public.complete_health_erasure(uuid,uuid)') is null then
    raise exception 'complete_health_erasure no existe: aplica antes la 0050';
  end if;
  if coalesce(obj_description(to_regprocedure('public.complete_health_erasure(uuid,uuid)'), 'pg_proc'), '') not like '%nivl:salud-diaria-0110%' then
    drop function if exists public._complete_health_erasure_sin_salud_diaria(uuid, uuid);
    alter function public.complete_health_erasure(uuid, uuid) rename to _complete_health_erasure_sin_salud_diaria;
  end if;
end $$;

revoke all on function public._complete_health_erasure_sin_salud_diaria(uuid, uuid) from public, anon, authenticated, service_role;

create or replace function public.complete_health_erasure(p_user uuid, p_job uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare resultado jsonb;
begin
  resultado := public._complete_health_erasure_sin_salud_diaria(p_user, p_job);
  delete from public.salud_diaria where user_id = p_user;
  delete from public.salud_preferencias where user_id = p_user;
  return resultado;
end $$;
revoke all on function public.complete_health_erasure(uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_health_erasure(uuid, uuid) to service_role;
do $$
begin
  execute format('comment on function public.complete_health_erasure(uuid, uuid) is %L',
    coalesce(obj_description(to_regprocedure('public._complete_health_erasure_sin_salud_diaria(uuid,uuid)'), 'pg_proc'), '')
    || ' · nivl:salud-diaria-0110 (envoltorio + salud_diaria y salud_preferencias)');
end $$;

commit;
