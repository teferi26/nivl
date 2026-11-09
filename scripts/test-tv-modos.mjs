// Prueba SQL local del candado de IRON en la TV (0144). Sin red, sin credenciales y sin tocar producción:
// PostgreSQL en memoria (PGlite) con TODAS las migraciones reales del repo, salvo la 0010 (cron y vault).
//   PGLITE_PACKAGE_ROOT=<carpeta con @electric-sql/pglite> node scripts/test-tv-modos.mjs
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
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
assert.ok(migraciones.includes('0144_tv_modo_iron.sql'), 'falta la 0144');

const A = 'a0000000-0000-4000-8000-00000000000a';
async function como(rol, uid = '') {
  await db.exec('reset role');
  const claims = rol === 'postgres' && !uid ? '' : JSON.stringify(uid ? { sub: uid, role: rol } : { role: rol });
  await db.query("select set_config('request.jwt.claims',$1,false),set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claim.role','',false)", [claims]);
  if (rol !== 'postgres') await db.exec('set role ' + rol);
}
const uno = async (q, a = []) => Object.values((await db.query(q, a)).rows[0])[0];
let n = 0;
async function test(nombre, fn) { await como('postgres'); await fn(); console.log('PASS', nombre); n++; }

await como('postgres');
await db.query('insert into auth.users(id,email) values($1,$2)', [A, 'a@correo.invalid']);
await db.query("insert into profiles(id,name,timezone) values($1,'Ana','UTC') on conflict (id) do update set name=excluded.name,timezone='UTC'", [A]);
await como('authenticated', A);
await uno('select accept_health_consent($1)', [await uno('select health_consent_version()')]);
const hoy = new Date().toISOString().slice(0, 10);
await db.query("insert into training_prescriptions(user_id,date,exercise_name,sets,reps,position) values($1,$2,'Remo con barra',4,'8',0)", [A, hoy]);

await como('anon');
const e = await uno("select tv_emitir_codigo('Salón')");
await como('authenticated', A);
assert.equal((await uno('select tv_aprobar($1)', [e.codigo])).ok, true);
await como('postgres');
await db.query("update tv_enlaces set ultimo_sondeo = now() - interval '1 minute'");
await como('anon');
let canje = await uno('select tv_canjear($1)', [e.secreto]);
for (let i = 0; i < 8 && canje.estado !== 'aprobado'; i++) {
  await new Promise((r) => setTimeout(r, 1100));
  canje = await uno('select tv_canjear($1)', [e.secreto]);
}
assert.equal(canje.estado, 'aprobado', JSON.stringify(canje));
const token = canje.token;

// El freno de la lectura es de 5 s por token: entre pruebas se abre a mano.
async function datos() {
  await como('postgres');
  await db.exec('update tv_dispositivos set ultima_lectura = null');
  await como('anon');
  return uno('select tv_datos($1,$2::date)', [token, hoy]);
}
async function flag(v) {
  await como('postgres');
  await db.query("update app_config set value=$1::jsonb where key='modos_1011'", [v ? 'true' : 'false']);
}
async function plan(p) {
  await como('postgres');
  await db.query('delete from subscriptions where user_id=$1', [A]);
  if (p) {
    await db.query("insert into subscriptions(user_id,plan,status,provider,current_period_end) values($1,$2,'active','apple',now()+interval '30 days')", [A, p]);
  }
}

await test('con los modos apagados nada se cierra', async () => {
  await flag(false); await plan(null);
  const r = await datos();
  assert.equal(r.estado, 'ok', JSON.stringify(r));
  assert.equal(r.iron_abierto, true);
  assert.ok(r.rutina, 'la rutina sale');
});

await test('sin plan y con modos encendidos: IRON cerrado, base abierta', async () => {
  await flag(true); await plan(null);
  const r = await datos();
  assert.equal(r.estado, 'ok', JSON.stringify(r));
  assert.equal(r.iron_abierto, false);
  assert.equal(r.rutina, null);
  assert.equal(r.proxima, null);
  assert.ok(r.semana, 'la semana sigue');
  assert.ok(Array.isArray(r.arena), 'la arena sigue');
});

await test('un plan de otro modo no abre IRON', async () => {
  await flag(true); await plan('focus_mensual');
  const r = await datos();
  assert.equal(r.iron_abierto, false, JSON.stringify({ a: r.iron_abierto, e: r.estado }));
  assert.equal(r.rutina, null);
});

for (const p of ['iron_mensual', 'todos_anual', 'elite_mensual']) {
  await test(`${p} abre la rutina`, async () => {
    await flag(true); await plan(p);
    const r = await datos();
    assert.equal(r.iron_abierto, true, JSON.stringify({ a: r.iron_abierto, e: r.estado }));
    assert.ok(r.rutina, 'la rutina sale');
  });
}

await test('un token malo sigue sin devolver nada', async () => {
  await como('anon');
  const r = await uno("select tv_datos('no-vale',null)");
  assert.equal(r.estado, 'sesion_invalida');
  assert.equal(r.iron_abierto, undefined);
});

await test('la tv no puede leer ai_modos ni su envoltura interna', async () => {
  await como('anon');
  await assert.rejects(db.query('select _tv_datos_0128($1,null)', [token]));
  await assert.rejects(db.query('select ai_modos($1)', [A]));
});

await test('reejecutable y con huella', async () => {
  await db.exec(await leer('0144_tv_modo_iron.sql'));
  const c = await uno("select obj_description(to_regprocedure('public.tv_datos(text,date)'),'pg_proc')");
  for (const h of ['nivl:tv-datos-0126', 'nivl:tv-proxima-0128', 'nivl:tv-iron-0144']) assert.ok(c.includes(h), h);
});

console.log(`\n${n} pruebas correctas`);
