// Prueba SQL local de la próxima sesión de la TV (0128). Sin red, sin credenciales y sin tocar producción:
// PostgreSQL en memoria (PGlite) con TODAS las migraciones reales del repo, salvo la 0010 (cron y vault).
//   PGLITE_PACKAGE_ROOT=<carpeta con @electric-sql/pglite> node scripts/test-tv-proxima.mjs
//
// auth.uid() y auth.role() son las de Supabase: leen request.jwt.claim.sub y también request.jwt.claims. Aquí
// la sesión se identifica solo con request.jwt.claims, como hace la PostgREST actual.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(process.env.PGLITE_PACKAGE_ROOT || root, 'package.json'));
const dist = path.dirname(require.resolve('@electric-sql/pglite'));
const { PGlite } = await import(pathToFileURL(path.join(dist, 'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.join(dist, 'contrib/pgcrypto.js')).href);
const leer = (n) => readFile(path.join(root, 'supabase/migrations', n), 'utf8');

const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema storage; create schema extensions;
create extension pgcrypto with schema extensions;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
    (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'))::uuid $$;
create function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
    (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'))::text $$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,
  created_at timestamptz default now(),updated_at timestamptz default now(),metadata jsonb default '{}');
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
create publication supabase_realtime;
grant usage on schema public,auth,storage,extensions to anon,authenticated,service_role;
grant all on all tables in schema storage to anon,authenticated,service_role;
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
`);

const migraciones = (await readdir(path.join(root, 'supabase/migrations')))
  .filter((n) => /^\d{4}.*\.sql$/.test(n) && !n.startsWith('0010')).sort();
for (const n of migraciones) {
  try { await db.exec(await leer(n)); } catch (e) { throw new Error(`Migración ${n}: ${e.message}`); }
}

assert.ok(migraciones.includes('0128_tv_proxima.sql'), 'falta la 0128');

const A = 'a0000000-0000-4000-8000-00000000000a', B = 'b0000000-0000-4000-8000-00000000000b';
async function como(rol, uid = '') {
  await db.exec('reset role');
  const claims = rol === 'postgres' && !uid ? '' : JSON.stringify(uid ? { sub: uid, role: rol } : { role: rol });
  await db.query("select set_config('request.jwt.claims',$1,false),set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claim.role','',false)", [claims]);
  if (rol !== 'postgres') await db.exec('set role ' + rol);
}
const uno = async (q, a = []) => Object.values((await db.query(q, a)).rows[0])[0];
const fecha = (delta) => new Date(Date.now() + delta * 86400000).toISOString().slice(0, 10);
let n = 0;
async function test(nombre, fn) { await como('postgres'); await fn(); console.log('PASS', nombre); n++; }

await como('postgres');
for (const [u, nom] of [[A, 'Ana'], [B, 'Berta']]) {
  await db.query('insert into auth.users(id,email) values($1,$2)', [u, u[0] + '@correo.invalid']);
  await db.query("insert into profiles(id,name,timezone) values($1,$2,'UTC') on conflict (id) do update set name=excluded.name,timezone='UTC'", [u, nom]);
}
async function enlazar(u) {
  await como('anon');
  const e = await uno("select tv_emitir_codigo('Salón')");
  await como('authenticated', u);
  assert.equal((await uno('select tv_aprobar($1)', [e.codigo])).ok, true);
  await como('postgres');
  await db.query("update tv_enlaces set ultimo_sondeo = now() - interval '10 seconds' where secreto_hash = sha256(convert_to($1,'UTF8'))", [e.secreto]);
  await como('anon');
  const r = await uno('select tv_canjear($1)', [e.secreto]);
  assert.equal(r.estado, 'aprobado');
  return r.token;
}
const tokenA = await enlazar(A);
const tokenB = await enlazar(B);
const datos = async (t) => { await como('postgres'); await db.exec('update tv_dispositivos set ultima_lectura = null'); await como('anon'); return uno('select tv_datos($1,null::date)', [t]); };
const isodow = (delta) => { const d = new Date(Date.now() + delta * 86400000).getUTCDay(); return d === 0 ? 7 : d; };
await como('authenticated', A);
const version = await uno('select health_consent_version()');
await uno('select accept_health_consent($1)', [version]);

async function dia(u, delta, nombre, ejercicios) {
  await como('postgres', u);
  await db.query("select set_config('request.jwt.claim.role','authenticated',false)");
  const id = await uno('insert into gym_days(user_id,day_of_week,name) values($1,$2,$3) returning id', [u, isodow(delta), nombre]);
  for (let i = 0; i < ejercicios; i++) {
    await db.query("insert into gym_exercises(gym_day_id,user_id,name,sets,reps,position) values($1,$2,$3,3,8,$4)", [id, u, 'E' + i, i]);
  }
  await como('postgres');
}

await test('sin rutina, proxima es null y la clave existe', async () => {
  const d = await datos(tokenA);
  assert.equal(d.estado, 'ok');
  assert.ok('proxima' in d);
  assert.equal(d.proxima, null);
});

await test('un día de rutina sin ejercicios no cuenta', async () => {
  await dia(A, 1, 'Vacío', 0);
  await dia(A, 3, 'Pierna', 2);
  const d = await datos(tokenA);
  assert.deepEqual(d.proxima, { nombre: 'Pierna', dia_semana: isodow(3), en_dias: 3, ejercicios: 2 });
});

await test('la prescripción manda y hoy no cuenta como próxima', async () => {
  await como('postgres', A);
  await db.query("select set_config('request.jwt.claim.role','authenticated',false)");
  await db.query("insert into training_prescriptions(user_id,date,exercise_name,sets,reps,position) values ($1,$2,'P1',3,'8',0),($1,$2,'P2',3,'8',1),($1,$3,'Hoy',3,'8',0)", [A, fecha(2), fecha(0)]);
  await como('postgres');
  const d = await datos(tokenA);
  assert.equal(d.proxima.en_dias, 2);
  assert.equal(d.proxima.ejercicios, 2);
  assert.equal(d.proxima.nombre, 'Entreno prescrito');
  assert.equal(d.rutina.fuente, 'prescripcion', 'lo demás sigue igual que en la 0126');
});

await test('sin consentimiento de salud no sale nada, aunque haya rutina', async () => {
  // Sin consentimiento la app no puede escribirlo: aquí se siembra saltándose el trigger.
  await db.exec('set session_replication_role = replica');
  await dia(B, 1, 'Secreto', 3);
  await db.exec('set session_replication_role = default');
  const d = await datos(tokenB);
  assert.equal(d.salud_activa, false);
  assert.equal(d.proxima, null);
  assert.ok(!JSON.stringify(d).includes('Secreto'));
});

await test('no cruza cuentas', async () => {
  const d = await datos(tokenA);
  assert.notEqual(d.proxima.nombre, 'Secreto');
});

await test('token malo: la respuesta exacta de la 0126', async () => {
  assert.deepEqual(await datos('0'.repeat(64)), { estado: 'sesion_invalida' });
  assert.deepEqual(await datos('nada'), { estado: 'sesion_invalida' });
});

await test('permisos: la envoltura es para anon; la función base, para nadie de fuera', async () => {
  const puede = (rol, f) => uno('select has_function_privilege($1,$2,$3)', [rol, f, 'execute']);
  assert.equal(await puede('anon', 'public.tv_datos(text,date)'), true);
  assert.equal(await puede('authenticated', 'public.tv_datos(text,date)'), false);
  assert.equal(await puede('anon', 'public._tv_datos_0126(text,date)'), false);
  assert.equal(await puede('authenticated', 'public._tv_datos_0126(text,date)'), false);
  assert.equal(await uno("select prosecdef from pg_proc where oid='public.tv_datos(text,date)'::regprocedure"), true);
  assert.match(await uno("select array_to_string(proconfig,',') from pg_proc where oid='public.tv_datos(text,date)'::regprocedure"), /search_path=public, ?pg_temp/);
});

await test('las huellas de la 0126 y la 0128 siguen en la función', async () => {
  const c = await uno("select obj_description('public.tv_datos(text,date)'::regprocedure,'pg_proc')");
  assert.match(c, /nivl:tv-datos-0126/);
  assert.match(c, /nivl:tv-proxima-0128/);
});

await test('reejecutable: aplicarla otra vez no rompe nada', async () => {
  await db.exec(await leer('0128_tv_proxima.sql'));
  assert.equal((await datos(tokenA)).estado, 'ok');
});

console.log(`\n${n} pruebas correctas`);
process.exit(0);
