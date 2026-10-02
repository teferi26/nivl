-- Test de 0050_fotos_progreso.sql. Se ejecuta con rosql.mjs (BEGIN…ROLLBACK): nada queda escrito.
-- Montaje: sustituir la línea-marcador MIGRACION (más abajo) por 0050_fotos_progreso.sql SIN sus líneas begin;/commit;
-- (ver docs/ia-v2/fotos-progreso.md). Solo cuentas ficticias @example.invalid; ningún dato personal.
-- A: salud aceptada. B: empieza sin salud. C: salud + 18+ y luego borrado de cuenta pendiente.
create temp table r(step text, result text); grant all on r to public;
create function pg_temp.try(p_step text, p_sql text) returns void language plpgsql as $$
declare v text;
begin
  begin
    execute p_sql into v;
    insert into r values (p_step, 'ok' || coalesce(': ' || v, ''));
  exception when others then
    insert into r values (p_step, 'ERR ' || sqlstate || ' ' || left(sqlerrm, 90));
  end;
end $$;
grant execute on function pg_temp.try(text, text) to public;

-- (12) huella ANTES
insert into r select '12a huella antes (false)', (to_regclass('public.progress_photos') is not null)::text;

-- @@MIGRACION@@

-- (12) huella DESPUÉS y catálogo
insert into r select '12b huella despues (true)', (to_regclass('public.progress_photos') is not null)::text;
insert into r select '00 bucket progress (false,3145728,{jpeg,webp})', (select format('%s,%s,%s', public, file_size_limit, allowed_mime_types) from storage.buckets where id = 'progress');
insert into r select '00 health_row(progress_photos) cae en else true', public.health_row('progress_photos', '{}'::jsonb)::text;
insert into r select '00 triggers progress_photos', (select string_agg(tgname, ',' order by tgname) from pg_trigger where tgrelid = 'public.progress_photos'::regclass and not tgisinternal);
insert into r select '00 RLS progress_photos/adult_confirmations', (select string_agg(relname || '=' || relrowsecurity, ',' order by relname) from pg_class where oid in ('public.progress_photos'::regclass, 'public.adult_confirmations'::regclass));
insert into r select '00 TRUNCATE/DML anon o authenticated (todo false)', format('trunc_auth=%s trunc_anon=%s anon_select=%s anon_insert=%s auth_update_path=%s',
  has_table_privilege('authenticated', 'public.progress_photos', 'TRUNCATE'), has_table_privilege('anon', 'public.progress_photos', 'TRUNCATE'),
  has_table_privilege('anon', 'public.progress_photos', 'SELECT'), has_table_privilege('anon', 'public.adult_confirmations', 'INSERT'),
  has_column_privilege('authenticated', 'public.progress_photos', 'path', 'UPDATE'));
insert into r select '00 funciones con progress (5)', (select count(*)::text || ' ' || string_agg(proname, ',' order by proname) from pg_proc where pronamespace = 'public'::regnamespace
  and prosrc like '%progress%' and proname in ('require_account_storage_active','account_erasure_paths','account_erasure_ready','health_erasure_paths','complete_health_erasure'));
insert into r select '00 transversal: tablas public sin RLS (0)', (select count(*)::text from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity);
insert into r select '00 politicas storage progress', (select string_agg(policyname || ':' || permissive || ':' || cmd, ',' order by policyname) from pg_policies where schemaname = 'storage' and (qual like '%progress%' or with_check like '%progress%'));

-- Cuentas ficticias
insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data) values
 ('f0700a00-0000-4000-8000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','fotos-a@example.invalid','',now(),now(),now(),'{}','{}'),
 ('f0700b00-0000-4000-8000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','fotos-b@example.invalid','',now(),now(),now(),'{}','{}'),
 ('f0700c00-0000-4000-8000-00000000000c','00000000-0000-0000-0000-000000000000','authenticated','authenticated','fotos-c@example.invalid','',now(),now(),now(),'{}','{}');
insert into public.health_state(user_id, accepted, version) values
 ('f0700a00-0000-4000-8000-00000000000a', true, public.health_consent_version()),
 ('f0700c00-0000-4000-8000-00000000000c', true, public.health_consent_version());

-- ═══ Como A ═══
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f0700a00-0000-4000-8000-00000000000a","role":"authenticated"}', true);
-- (1) sin 18+
select pg_temp.try('01a A sin 18+ my_adult_confirmation', 'select public.my_adult_confirmation()::text');
select pg_temp.try('01b A sin 18+ inserta progress_photos (ERR)', $q$with x as (insert into public.progress_photos(id, taken_on, pose, path) values ('a1000000-0000-4000-8000-000000000001', date '2026-09-30', 'frente', 'f0700a00-0000-4000-8000-00000000000a/a1000000-0000-4000-8000-000000000001.jpg') returning id) select count(*)::text from x$q$);
select pg_temp.try('01c A sin 18+ sube a storage progress (ERR)', $q$with x as (insert into storage.objects(bucket_id, name, owner, owner_id, metadata) values ('progress', 'f0700a00-0000-4000-8000-00000000000a/a1000000-0000-4000-8000-000000000001.jpg', 'f0700a00-0000-4000-8000-00000000000a', 'f0700a00-0000-4000-8000-00000000000a', '{"size":1000,"mimetype":"image/jpeg"}') returning 1) select count(*)::text from x$q$);
select pg_temp.try('01d A sin 18+ my_progress_photos_meta (42501)', 'select public.my_progress_photos_meta()::text');
-- (2) con confirm_adult()
select pg_temp.try('02a A confirm_adult', 'select public.confirm_adult()::text');
select pg_temp.try('02b A confirm_adult idempotente', 'select public.confirm_adult()::text || (select count(*) from public.adult_confirmations)::text');
select pg_temp.try('02c A inserta foto 1 (frente, jpg)', $q$with x as (insert into public.progress_photos(id, taken_on, pose, path) values ('a1000000-0000-4000-8000-000000000001', date '2026-09-30', 'frente', 'f0700a00-0000-4000-8000-00000000000a/a1000000-0000-4000-8000-000000000001.jpg') returning id) select count(*)::text from x$q$);
select pg_temp.try('02d A inserta foto 2 (lado, webp)', $q$with x as (insert into public.progress_photos(id, taken_on, pose, path) values ('a2000000-0000-4000-8000-000000000002', date '2026-09-29', 'lado', 'f0700a00-0000-4000-8000-00000000000a/a2000000-0000-4000-8000-000000000002.webp') returning id) select count(*)::text from x$q$);
select pg_temp.try('02e A sube objeto de la foto 1', $q$with x as (insert into storage.objects(bucket_id, name, owner, owner_id, metadata) values ('progress', 'f0700a00-0000-4000-8000-00000000000a/a1000000-0000-4000-8000-000000000001.jpg', 'f0700a00-0000-4000-8000-00000000000a', 'f0700a00-0000-4000-8000-00000000000a', '{"size":1000,"mimetype":"image/jpeg"}') returning 1) select count(*)::text from x$q$);
select pg_temp.try('02f A sube objeto de la foto 2', $q$with x as (insert into storage.objects(bucket_id, name, owner, owner_id, metadata) values ('progress', 'f0700a00-0000-4000-8000-00000000000a/a2000000-0000-4000-8000-000000000002.webp', 'f0700a00-0000-4000-8000-00000000000a', 'f0700a00-0000-4000-8000-00000000000a', '{"size":1000,"mimetype":"image/webp"}') returning 1) select count(*)::text from x$q$);
select pg_temp.try('02g A sube evidence (para el formato mixto)', $q$with x as (insert into storage.objects(bucket_id, name, owner, owner_id, metadata) values ('evidence', 'f0700a00-0000-4000-8000-00000000000a/e.jpg', 'f0700a00-0000-4000-8000-00000000000a', 'f0700a00-0000-4000-8000-00000000000a', '{"size":1000}') returning 1) select count(*)::text from x$q$);
select pg_temp.try('02h A corrige la pose (update permitido)', $q$with x as (update public.progress_photos set pose = 'frente' where id = 'a2000000-0000-4000-8000-000000000002' returning 1) select count(*)::text from x$q$);
select pg_temp.try('02i A cambia path (ERR sin privilegio)', $q$with x as (update public.progress_photos set path = 'f0700a00-0000-4000-8000-00000000000a/x.jpg' returning 1) select count(*)::text from x$q$);
update public.progress_photos set pose = 'lado' where id = 'a2000000-0000-4000-8000-000000000002';
-- (6) rutas y extensiones
select pg_temp.try('06a ruta en carpeta de B (ERR)', $q$with x as (insert into public.progress_photos(id, taken_on, pose, path) values ('a3000000-0000-4000-8000-000000000003', date '2026-09-30', 'frente', 'f0700b00-0000-4000-8000-00000000000b/a3000000-0000-4000-8000-000000000003.jpg') returning id) select count(*)::text from x$q$);
select pg_temp.try('06b ruta con otro id (ERR)', $q$with x as (insert into public.progress_photos(id, taken_on, pose, path) values ('a3000000-0000-4000-8000-000000000003', date '2026-09-30', 'frente', 'f0700a00-0000-4000-8000-00000000000a/a9999999-0000-4000-8000-000000000003.jpg') returning id) select count(*)::text from x$q$);
select pg_temp.try('06c extension png (ERR)', $q$with x as (insert into public.progress_photos(id, taken_on, pose, path) values ('a3000000-0000-4000-8000-000000000003', date '2026-09-30', 'frente', 'f0700a00-0000-4000-8000-00000000000a/a3000000-0000-4000-8000-000000000003.png') returning id) select count(*)::text from x$q$);
select pg_temp.try('06d subcarpeta con fecha (ERR)', $q$with x as (insert into public.progress_photos(id, taken_on, pose, path) values ('a3000000-0000-4000-8000-000000000003', date '2026-09-30', 'frente', 'f0700a00-0000-4000-8000-00000000000a/2026-09-30/a3000000-0000-4000-8000-000000000003.jpg') returning id) select count(*)::text from x$q$);
select pg_temp.try('06e pose no permitida (ERR)', $q$with x as (insert into public.progress_photos(id, taken_on, pose, path) values ('a3000000-0000-4000-8000-000000000003', date '2026-09-30', 'perfil', 'f0700a00-0000-4000-8000-00000000000a/a3000000-0000-4000-8000-000000000003.jpg') returning id) select count(*)::text from x$q$);
select pg_temp.try('06f objeto sin fila propia (ERR)', $q$with x as (insert into storage.objects(bucket_id, name, owner, owner_id, metadata) values ('progress', 'f0700a00-0000-4000-8000-00000000000a/a3000000-0000-4000-8000-000000000003.jpg', 'f0700a00-0000-4000-8000-00000000000a', 'f0700a00-0000-4000-8000-00000000000a', '{"size":1}') returning 1) select count(*)::text from x$q$);
select pg_temp.try('06g objeto png de la foto 1 (ERR)', $q$with x as (insert into storage.objects(bucket_id, name, owner, owner_id, metadata) values ('progress', 'f0700a00-0000-4000-8000-00000000000a/a1000000-0000-4000-8000-000000000001.png', 'f0700a00-0000-4000-8000-00000000000a', 'f0700a00-0000-4000-8000-00000000000a', '{"size":1}') returning 1) select count(*)::text from x$q$);
select pg_temp.try('06h objeto fuera de su carpeta (ERR)', $q$with x as (insert into storage.objects(bucket_id, name, owner, owner_id, metadata) values ('progress', 'otra/a1000000-0000-4000-8000-000000000001.jpg', 'f0700a00-0000-4000-8000-00000000000a', 'f0700a00-0000-4000-8000-00000000000a', '{"size":1}') returning 1) select count(*)::text from x$q$);
select pg_temp.try('06i sobrescribir objeto (update, 0 filas)', $q$with x as (update storage.objects set metadata = '{"size":2}' where bucket_id = 'progress' returning 1) select count(*)::text from x$q$);
-- (10) peso del mismo día
select pg_temp.try('10a A registra peso del 30/09', $q$with x as (insert into public.body_metrics(user_id, date, weight_kg) values ('f0700a00-0000-4000-8000-00000000000a', date '2026-09-30', 80.5) returning 1) select count(*)::text from x$q$);
select pg_temp.try('10b my_progress_photos_meta()', 'select public.my_progress_photos_meta()::text');
select pg_temp.try('10c sin path ni url', $q$select (not (public.my_progress_photos_meta()::text ~* '(path|url|\.jpg|\.webp|f0700a00)'))::text$q$);
select pg_temp.try('10d p_from 2026-09-30 (1 foto)', $q$select jsonb_array_length(public.my_progress_photos_meta(date '2026-09-30'))::text$q$);
select pg_temp.try('10e A ve sus objetos de progress (2)', $q$select count(*)::text from storage.objects where bucket_id = 'progress'$q$);
-- (7) DOCUMENTA la exportación consolidada (export_my_data NO se toca aquí)
select pg_temp.try('07 export vivo (consolidada debe dar true,true,true)', $q$select format('progress_photos=%s adult_confirmations=%s objetos_progress=%s nada_de_B=%s', j ? 'progress_photos', j ? 'adult_confirmations',
  coalesce((select bool_or(o->>'bucket' = 'progress') from jsonb_array_elements(j->'storage_objects') o), false), not j::text like '%f0700b00%') from (select public.export_my_data() j) e$q$);

-- ═══ Como B (sin salud) ═══
select set_config('request.jwt.claims', '{"sub":"f0700b00-0000-4000-8000-00000000000b","role":"authenticated"}', true);
select pg_temp.try('05a B confirm_adult', 'select public.confirm_adult()::text');
select pg_temp.try('05b B sin salud my_progress_photos_meta (42501)', 'select public.my_progress_photos_meta()::text');
select pg_temp.try('05c B sin salud inserta foto propia (ERR)', $q$with x as (insert into public.progress_photos(id, taken_on, pose, path) values ('b1000000-0000-4000-8000-000000000001', date '2026-09-30', 'frente', 'f0700b00-0000-4000-8000-00000000000b/b1000000-0000-4000-8000-000000000001.jpg') returning id) select count(*)::text from x$q$);
reset role;
insert into public.health_state(user_id, accepted, version) values ('f0700b00-0000-4000-8000-00000000000b', true, public.health_consent_version());
set local role authenticated;
-- (3) B con salud y 18+ no alcanza nada de A
select pg_temp.try('03a B ve filas de A (0)', $q$select count(*)::text from public.progress_photos where user_id = 'f0700a00-0000-4000-8000-00000000000a'$q$);
select pg_temp.try('03b B ve objetos de A (0)', $q$select count(*)::text from storage.objects where bucket_id = 'progress' and name like 'f0700a00%'$q$);
select pg_temp.try('03c B borra filas de A (0)', $q$with x as (delete from public.progress_photos where user_id = 'f0700a00-0000-4000-8000-00000000000a' returning 1) select count(*)::text from x$q$);
-- storage.allow_delete_query simula la API de Storage (sin ella, protect_delete veta todo DELETE directo).
select set_config('storage.allow_delete_query', 'true', true);
select pg_temp.try('03d B borra objetos de A (0)', $q$with x as (delete from storage.objects where bucket_id = 'progress' and name like 'f0700a00%' returning 1) select count(*)::text from x$q$);
select pg_temp.try('03e B actualiza fila de A (0)', $q$with x as (update public.progress_photos set pose = 'espalda' where user_id = 'f0700a00-0000-4000-8000-00000000000a' returning 1) select count(*)::text from x$q$);
select pg_temp.try('03f B inserta fila a nombre de A (ERR)', $q$with x as (insert into public.progress_photos(id, user_id, taken_on, pose, path) values ('b2000000-0000-4000-8000-000000000002', 'f0700a00-0000-4000-8000-00000000000a', date '2026-09-30', 'frente', 'f0700a00-0000-4000-8000-00000000000a/b2000000-0000-4000-8000-000000000002.jpg') returning id) select count(*)::text from x$q$);
select pg_temp.try('03g B sube a la carpeta de A con ruta de fila de A (ERR)', $q$with x as (insert into storage.objects(bucket_id, name, owner, owner_id, metadata) values ('progress', 'f0700a00-0000-4000-8000-00000000000a/a1000000-0000-4000-8000-000000000001.jpeg', 'f0700b00-0000-4000-8000-00000000000b', 'f0700b00-0000-4000-8000-00000000000b', '{"size":1}') returning 1) select count(*)::text from x$q$);
select pg_temp.try('03h B my_progress_photos_meta ([])', 'select public.my_progress_photos_meta()::text');
select pg_temp.try('03i B ve adult_confirmations de A (0)', $q$select count(*)::text from public.adult_confirmations where user_id = 'f0700a00-0000-4000-8000-00000000000a'$q$);
select pg_temp.try('03j B sondea adult_ok(A) (false)', $q$select public.adult_ok('f0700a00-0000-4000-8000-00000000000a')::text$q$);
-- Contraprueba: A sí borra (y vuelve a subir) su propio objeto.
select set_config('request.jwt.claims', '{"sub":"f0700a00-0000-4000-8000-00000000000a","role":"authenticated"}', true);
select pg_temp.try('03k A borra su objeto de la foto 2 (1)', $q$with x as (delete from storage.objects where bucket_id = 'progress' and name = 'f0700a00-0000-4000-8000-00000000000a/a2000000-0000-4000-8000-000000000002.webp' returning 1) select count(*)::text from x$q$);
select pg_temp.try('03l A la vuelve a subir (1)', $q$with x as (insert into storage.objects(bucket_id, name, owner, owner_id, metadata) values ('progress', 'f0700a00-0000-4000-8000-00000000000a/a2000000-0000-4000-8000-000000000002.webp', 'f0700a00-0000-4000-8000-00000000000a', 'f0700a00-0000-4000-8000-00000000000a', '{"size":1000,"mimetype":"image/webp"}') returning 1) select count(*)::text from x$q$);
select set_config('storage.allow_delete_query', 'false', true);
reset role;

-- ═══ (4) anon ═══
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_temp.try('04a anon select progress_photos (ERR)', 'select count(*)::text from public.progress_photos');
select pg_temp.try('04b anon select adult_confirmations (ERR)', 'select count(*)::text from public.adult_confirmations');
select pg_temp.try('04c anon objetos progress (0)', $q$select count(*)::text from storage.objects where bucket_id = 'progress'$q$);
select pg_temp.try('04d anon sube a progress (ERR)', $q$with x as (insert into storage.objects(bucket_id, name, metadata) values ('progress', 'f0700a00-0000-4000-8000-00000000000a/a1000000-0000-4000-8000-000000000001.jpeg', '{"size":1}') returning 1) select count(*)::text from x$q$);
select pg_temp.try('04e anon my_progress_photos_meta (ERR)', 'select public.my_progress_photos_meta()::text');
select pg_temp.try('04f anon confirm_adult (ERR)', 'select public.confirm_adult()::text');
reset role;

-- ═══ C: borrado de cuenta pendiente ═══
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f0700c00-0000-4000-8000-00000000000c","role":"authenticated"}', true);
select pg_temp.try('11a C confirm_adult', 'select public.confirm_adult()::text');
select pg_temp.try('11b C inserta foto', $q$with x as (insert into public.progress_photos(id, taken_on, pose, path) values ('c1000000-0000-4000-8000-000000000001', date '2026-09-30', 'espalda', 'f0700c00-0000-4000-8000-00000000000c/c1000000-0000-4000-8000-000000000001.jpg') returning id) select count(*)::text from x$q$);
select pg_temp.try('11c C sube objeto', $q$with x as (insert into storage.objects(bucket_id, name, owner, owner_id, metadata) values ('progress', 'f0700c00-0000-4000-8000-00000000000c/c1000000-0000-4000-8000-000000000001.jpg', 'f0700c00-0000-4000-8000-00000000000c', 'f0700c00-0000-4000-8000-00000000000c', '{"size":1}') returning 1) select count(*)::text from x$q$);
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select pg_temp.try('11d begin_account_erasure(C)', $q$select (public.begin_account_erasure('f0700c00-0000-4000-8000-00000000000c')->>'ok')$q$);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f0700c00-0000-4000-8000-00000000000c","role":"authenticated"}', true);
select pg_temp.try('11e C pendiente inserta fila (ERR)', $q$with x as (insert into public.progress_photos(id, taken_on, pose, path) values ('c2000000-0000-4000-8000-000000000002', date '2026-09-30', 'frente', 'f0700c00-0000-4000-8000-00000000000c/c2000000-0000-4000-8000-000000000002.jpg') returning id) select count(*)::text from x$q$);
select pg_temp.try('11f C pendiente sube objeto (ERR)', $q$with x as (insert into storage.objects(bucket_id, name, owner, owner_id, metadata) values ('progress', 'f0700c00-0000-4000-8000-00000000000c/c1000000-0000-4000-8000-000000000001.webp', 'f0700c00-0000-4000-8000-00000000000c', 'f0700c00-0000-4000-8000-00000000000c', '{"size":1}') returning 1) select count(*)::text from x$q$);
select pg_temp.try('11g C pendiente my_progress_photos_meta (42501)', 'select public.my_progress_photos_meta()::text');
reset role;
-- service_role tampoco sube a 'progress' sin 18+ (B ya es adulta; se prueba con una carpeta sin declaración)
delete from public.adult_confirmations where user_id = 'f0700b00-0000-4000-8000-00000000000b';
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select pg_temp.try('11h service_role sube a progress de B sin 18+ (ERR trigger)', $q$with x as (insert into storage.objects(bucket_id, name, metadata) values ('progress', 'f0700b00-0000-4000-8000-00000000000b/b9000000-0000-4000-8000-000000000009.jpg', '{"size":1}') returning 1) select count(*)::text from x$q$);
select pg_temp.try('11i service_role inserta fila de B sin 18+ (ERR trigger)', $q$with x as (insert into public.progress_photos(id, user_id, taken_on, pose, path) values ('b9000000-0000-4000-8000-000000000009', 'f0700b00-0000-4000-8000-00000000000b', date '2026-09-30', 'frente', 'f0700b00-0000-4000-8000-00000000000b/b9000000-0000-4000-8000-000000000009.jpg') returning id) select count(*)::text from x$q$);
select pg_temp.try('11j service_role sube a progress con carpeta no uuid (ERR)', $q$with x as (insert into storage.objects(bucket_id, name, metadata) values ('progress', 'publico/x.jpg', '{"size":1}') returning 1) select count(*)::text from x$q$);
-- (8) borrado de cuenta de C
select pg_temp.try('08a account_erasure_paths(C) incluye progress', $q$select public.account_erasure_paths('f0700c00-0000-4000-8000-00000000000c', (select id from public.account_erasure_jobs where user_id = 'f0700c00-0000-4000-8000-00000000000c'))::text$q$);
select pg_temp.try('08b account_erasure_ready(C) con objeto (false)', $q$select public.account_erasure_ready('f0700c00-0000-4000-8000-00000000000c', (select id from public.account_erasure_jobs where user_id = 'f0700c00-0000-4000-8000-00000000000c'))::text$q$);
reset role;
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where bucket_id = 'progress' and name like 'f0700c00%';
select set_config('storage.allow_delete_query', 'false', true);
set local role service_role;
select pg_temp.try('08c account_erasure_ready(C) vacio (true)', $q$select public.account_erasure_ready('f0700c00-0000-4000-8000-00000000000c', (select id from public.account_erasure_jobs where user_id = 'f0700c00-0000-4000-8000-00000000000c'))::text$q$);
reset role;

-- ═══ A retira salud con borrado: (5), (8) y (9) ═══
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f0700a00-0000-4000-8000-00000000000a","role":"authenticated"}', true);
create temp table job as select (public.withdraw_health_consent(true)->>'job_id')::uuid id; grant all on job to public;
select pg_temp.try('05d A con salud retirada my_progress_photos_meta (42501)', 'select public.my_progress_photos_meta()::text');
select pg_temp.try('05e A con salud retirada ve sus fotos (0)', 'select count(*)::text from public.progress_photos');
select pg_temp.try('08d health_erasure_paths(A): evidence en cadena + progress como objeto', 'select public.health_erasure_paths((select id from job))::text');
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select pg_temp.try('09a complete_health_erasure con progress lleno (ERR)', $q$select public.complete_health_erasure('f0700a00-0000-4000-8000-00000000000a', (select id from job))::text$q$);
reset role;
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where bucket_id = 'progress' and name like 'f0700a00%';
select set_config('storage.allow_delete_query', 'false', true);
set local role service_role;
select pg_temp.try('09b con evidence aun lleno (ERR)', $q$select public.complete_health_erasure('f0700a00-0000-4000-8000-00000000000a', (select id from job))::text$q$);
reset role;
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where bucket_id = 'evidence' and name like 'f0700a00%';
select set_config('storage.allow_delete_query', 'false', true);
set local role service_role;
select pg_temp.try('09c complete_health_erasure con buckets vacios', $q$select public.complete_health_erasure('f0700a00-0000-4000-8000-00000000000a', (select id from job))::text$q$);
reset role;
insert into r select '09d tras borrado: fotos A / 18+ A (0 / 1)', (select count(*) from public.progress_photos where user_id = 'f0700a00-0000-4000-8000-00000000000a')::text || ' / ' || (select count(*) from public.adult_confirmations where user_id = 'f0700a00-0000-4000-8000-00000000000a')::text;
insert into r select '09e fotos de C intactas por el borrado de salud de A (1)', (select count(*)::text from public.progress_photos where user_id = 'f0700c00-0000-4000-8000-00000000000c');

select string_agg(step || ' => ' || result, E'\n' order by step) from r;
