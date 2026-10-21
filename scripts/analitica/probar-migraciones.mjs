// NIVL · Modos F1 (analítica): 0070 a 0072 contra TODAS las migraciones reales
// del repo (0001 a 0072, con las 0066-0069 de servidor), en PostgreSQL en
// memoria (PGlite). Sin red, sin Supabase, sin credenciales ni datos reales.
//
//   node scripts/analitica/probar-migraciones.mjs /ruta/a/@electric-sql/pglite/dist/index.js
//
// PGlite no es dependencia del proyecto: se pasa la ruta de uno ya instalado
// (p. ej. C:\temp\nivl-age-sql-check\node_modules\@electric-sql\pglite\dist\index.js).
// El esqueleto de Supabase (roles, auth, storage) es el de scripts/test-modos-f1.mjs.
//
// Qué comprueba: embudo (lista blanca, sin texto libre, límites, nadie lee),
// opinión (solo insertar la propia, tope), admin (rol en servidor, RPC de solo
// agregados), export v9 = v8 + tres claves (y lo de la v8 sigue), borrado de
// cuenta (también las filas anónimas de la misma instalación) y flags apagados.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

if (!process.argv[2]) throw new Error('Indica la ruta de un módulo PGlite existente (este test no instala nada).');
const moduleUrl = pathToFileURL(resolve(process.argv[2]));
const { PGlite } = await import(moduleUrl.href);
const { pgcrypto } = await import(new URL('./contrib/pgcrypto.js', moduleUrl).href);
const migrations = new URL('../../supabase/migrations/', import.meta.url);

const STUBS = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema storage; create schema extensions;
create extension pgcrypto with schema extensions;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('sub',auth.uid(),'role',auth.role()) $$;
create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,
  created_at timestamptz default now(), updated_at timestamptz default now(),metadata jsonb default '{}');
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
create publication supabase_realtime;
grant usage on schema public,auth,storage to anon,authenticated,service_role;
grant all on all tables in schema storage to anon,authenticated,service_role;
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
`;

const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(STUBS);
for (const n of (await readdir(migrations)).filter((x) => /^\d{4}.*\.sql$/.test(x) && !x.startsWith('0010')).sort()) {
  try { await db.exec(await readFile(new URL(n, migrations), 'utf8')); }
  catch (e) { throw new Error(`Migración ${n}: ${e.message}`); }
}

let checks = 0;
const ok = (v, m) => { assert.ok(v, m); checks++; };
const q = (sql, p) => db.query(sql, p);
const ex = (sql) => db.exec(sql);
const como = async (rol, uid, sql, p) => {
  await ex(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); select set_config('request.jwt.claim.role', '${rol}', false); set role ${rol};`);
  try { return await db.query(sql, p); } finally { await ex('reset role'); }
};
const falla = async (rol, uid, sql, p, re) => {
  try { await como(rol, uid, sql, p); return false; } catch (e) { return re ? re.test(e.message) : true; }
};

const u1 = '11111111-1111-4111-8111-111111111111';
const u2 = '22222222-2222-4222-8222-222222222222';
await q(`insert into auth.users(id,email) values ($1,'a@prueba.invalid'),($2,'b@prueba.invalid')`, [u1, u2]);
await q(`insert into public.profiles(id) values ($1),($2) on conflict do nothing`, [u1, u2]);

// Export de un usuario 1.0.9 ANTES de tocar nada de lo nuevo: v9 = v8 + tres listas vacías.
let r = await como('authenticated', u1, `select export_my_data() x`);
const exp0 = r.rows[0].x;
// Integración v3: con WORK (0075) y FOCUS (0076) la última es la v11; la v9 de la 0072 sigue dentro.
ok(exp0.version >= 9, 'export v9 o posterior');
for (const k of ['funnel_events', 'app_feedback', 'admins']) ok(Array.isArray(exp0[k]) && exp0[k].length === 0, `export trae ${k} vacío`);
for (const k of ['profiles', 'quests', 'completions', 'events', 'user_modes', 'mode_xp', 'store_erasure_cleanup']) ok(k in exp0, `la v8 sigue: ${k}`);
r = await q(`select obj_description(to_regprocedure('public.export_my_data()'),'pg_proc') c`);
for (const h of ['nivl:export-v5', 'nivl:export-v6', 'nivl:store-cleanup-export-0064', 'nivl:export-modos-0068', 'nivl:export-analitica-0072']) ok(r.rows[0].c.includes(h), `huella ${h}`);

// Embudo.
const INST = 'abcdef12-3456-4789-abcd-ef1234567890';
r = await como('anon', null, `select registrar_evento($1,'primer_arranque','{}'::jsonb,'1.0.10','ios',null) ok`, [INST]);
ok(r.rows[0].ok === true, 'anon registra primer_arranque');
await como('anon', null, `select registrar_evento($1,'onboarding_paso','{"paso":2}'::jsonb,'1.0.10','ios',now()-interval '2 hours')`, [INST]);
await como('authenticated', u1, `select registrar_evento($1,'apertura_dia','{"dia":1}'::jsonb,'1.0.10','android',now()-interval '90 days')`, [INST]);
await como('anon', null, `select registrar_evento('previo00-3456-4789-abcd-ef1234567890','primer_arranque','{"previo":true}'::jsonb)`);
ok(await falla('anon', null, `select registrar_evento($1,'hackeo','{}'::jsonb)`, [INST], /no admitido/), 'evento fuera de lista');
ok(await falla('anon', null, `select registrar_evento($1,'registro','{"email":"a@b.es"}'::jsonb)`, [INST], /props/), 'clave fuera de lista');
ok(await falla('anon', null, `select registrar_evento($1,'registro','{"resultado":"Juan Pérez"}'::jsonb)`, [INST], /props/), 'texto libre rechazado');
ok(await falla('anon', null, `select registrar_evento($1,'registro','{"resultado":"a@b.es"}'::jsonb)`, [INST], /props/), 'correo rechazado');
ok(await falla('anon', null, `select registrar_evento($1,'apertura_dia','{"dia":1.5}'::jsonb)`, [INST], /props/), 'decimal rechazado');
ok(await falla('anon', null, `select registrar_evento('corto','primer_arranque','{}'::jsonb)`, [], /install_id/), 'install_id corto');
ok(await falla('anon', null, `select count(*) from funnel_events`, [], /permission/), 'anon no lee');
ok(await falla('authenticated', u1, `select count(*) from funnel_events`, [], /permission/), 'auth no lee');
ok(await falla('authenticated', u1, `insert into funnel_events(install_id,evento) values ('${INST}','registro')`, [], /permission/), 'auth no inserta directo');
r = await q(`select user_id, created_at > now()-interval '1 day' reciente from funnel_events where evento='apertura_dia'`);
ok(r.rows[0].user_id === u1 && r.rows[0].reciente, 'user_id del servidor y fecha antigua acotada');
const INST2 = 'zzzzef12-3456-4789-abcd-ef1234567890';
await q(`insert into funnel_events(install_id,evento) select $1,'apertura_dia' from generate_series(1,120)`, [INST2]);
r = await como('anon', null, `select registrar_evento($1,'primer_arranque','{}'::jsonb) ok`, [INST2]);
ok(r.rows[0].ok === false, 'límite por hora devuelve false');
await q(`delete from funnel_events where install_id=$1`, [INST2]);

// 0073: prueba del consentimiento y revocación.
r = await como('anon', null, `select registrar_evento($1,'consentimiento_analitica','{"version":"a2026_10"}'::jsonb) ok`, [INST]);
ok(r.rows[0].ok === true, 'evento consentimiento_analitica con versión');
const REV = 'revocada-3456-4789-abcd-ef1234567890';
await como('anon', null, `select registrar_evento($1,'primer_arranque','{}'::jsonb)`, [REV]);
await como('authenticated', u2, `select registrar_evento($1,'apertura_dia','{"dia":1}'::jsonb)`, [REV]);
r = await como('authenticated', u1, `select olvidar_instalacion($1) n`, [REV]);
ok(r.rows[0].n === 1, 'olvidar_instalacion no borra filas de otra cuenta');
r = await como('authenticated', u2, `select olvidar_instalacion($1) n`, [REV]);
ok(r.rows[0].n === 1, 'olvidar_instalacion borra lo propio');
ok(await falla('anon', null, `select olvidar_instalacion('x')`, [], /install_id/), 'olvidar_instalacion valida el formato');
ok(await falla('anon', null, `select purgar_funnel_events()`, [], /permission/), 'purgas solo service_role');
r = await q(`select purgar_app_feedback() n`); ok(r.rows[0].n === 0, 'purga de opiniones (24 meses)');
await q(`delete from funnel_events where evento='consentimiento_analitica'`);

// Opinión.
await como('authenticated', u1, `insert into app_feedback(gusta, cambiaria, version) values ('Las misiones','Más avisos','1.0.10')`);
ok(await falla('authenticated', u1, `insert into app_feedback(user_id, gusta) values ($1,'x')`, [u2]), 'no inserta la de otro');
ok(await falla('authenticated', u1, `select * from app_feedback`), 'no lee opiniones');
ok(await falla('anon', null, `insert into app_feedback(gusta) values ('x')`), 'anon no opina');
ok(await falla('authenticated', u1, `insert into app_feedback(gusta, cambiaria) values ('  ', null)`), 'vacía rechazada');
await como('authenticated', u1, `insert into app_feedback(gusta) values ('b')`);
await como('authenticated', u1, `insert into app_feedback(gusta) values ('c')`);
ok(await falla('authenticated', u1, `insert into app_feedback(gusta) values ('d')`, [], /Demasiadas/), 'tope diario');

// Admin.
ok(await falla('authenticated', u1, `select admin_resumen()`, [], /Solo admin/), 'no admin no ve resumen');
ok(await falla('anon', null, `select admin_resumen()`, [], /permission/), 'anon no ejecuta admin');
ok(await falla('authenticated', u1, `select * from admins`, [], /permission/), 'admins cerrada');
r = await como('authenticated', u1, `select es_admin() a`); ok(r.rows[0].a === false, 'es_admin false');
await q(`insert into admins(user_id) values ($1)`, [u2]);
r = await como('authenticated', u2, `select es_admin() a`); ok(r.rows[0].a === true, 'es_admin true');
for (const sql of [`select admin_resumen() x`, `select * from admin_altas_por_dia(null,null)`, `select * from admin_embudo(null,null)`,
  `select * from admin_donde_se_quedan(null,null)`, `select * from admin_retencion(null,null)`, `select * from admin_misiones_por_dia(null,null)`,
  `select * from admin_uso_modulos(null,null)`, `select admin_conversiones(null,null) x`, `select * from admin_opiniones(10,null)`]) {
  r = await como('authenticated', u2, sql); ok(r.rows.length > 0, `admin: ${sql}`);
}
r = await como('authenticated', u2, `select admin_resumen() x`);
ok(r.rows[0].x.instalaciones === 1 && r.rows[0].x.instalaciones_previas === 1, 'quien venía de antes no cuenta como instalación nueva');
r = await como('authenticated', u2, `select instalaciones from admin_embudo(null,null) where paso='onboarding_paso_2'`);
ok(Number(r.rows[0].instalaciones) === 1, 'embudo por paso');
r = await como('authenticated', u2, `select * from admin_retencion(null,null)`); ok(Number(r.rows[0].d1) === 1, 'retención D1');
ok(await falla('authenticated', u2, `select * from admin_embudo('2020-01-01','2026-01-01')`, [], /366/), 'ventana máxima');
r = await como('authenticated', u2, `select * from admin_opiniones(10,null)`); ok(!('user_id' in r.rows[0]), 'opiniones sin user_id');

// Export con datos.
r = await como('authenticated', u1, `select export_my_data() x`);
ok(r.rows[0].x.funnel_events.length === 1 && r.rows[0].x.app_feedback.length === 3, 'export con lo propio');

// Borrado de cuenta.
await q(`insert into funnel_events(install_id,evento) values ($1,'primer_arranque')`, ['otraotra-3456-4789-abcd-ef1234567890']);
await q(`delete from auth.users where id=$1`, [u1]);
r = await q(`select install_id from funnel_events`);
ok(r.rows.every((y) => y.install_id !== INST), 'el borrado se lleva la instalación entera');
ok(r.rows.length === 2, 'otras instalaciones intactas');
r = await q(`select count(*)::int n from app_feedback`); ok(r.rows[0].n === 0, 'opiniones borradas');

// Flags apagados y públicos.
r = await como('anon', null, `select app_flags() f`);
for (const k of ['analitica_activa', 'opinion_activa', 'valoracion_activa', 'analitica_1011', 'opinion_1011', 'valoracion_1011']) ok(r.rows[0].f[k] === false, `flag ${k} apagado y legible`);

console.log(`PASS modos F1 analítica: ${checks} comprobaciones`);
