// El permiso de salud y la activación de la medición (0111), sobre las migraciones reales.
// Usuario antiguo, usuario antiguo que activa y usuario nuevo. Sin red ni datos reales.
// No remote service, network credentials or real user data.
// node scripts/test-medicion-permiso.mjs /path/to/pglite/dist/index.js
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
if (!process.argv[2]) throw new Error('Provide an existing PGlite module path.');
const moduleUrl = pathToFileURL(resolve(process.argv[2]));
const { PGlite } = await import(moduleUrl.href);
const { pgcrypto } = await import(new URL('./contrib/pgcrypto.js',moduleUrl).href);
const db = new PGlite({extensions:{pgcrypto}});
const root = new URL('../',import.meta.url);
try {
await db.exec(`
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
`);
const migrations = new URL('supabase/migrations/',root);
for (const name of (await readdir(migrations)).filter((n) => /^\d{4}.*\.sql$/.test(n) && !n.startsWith('0010')).sort()) {
  try { await db.exec(await readFile(new URL(name,migrations),'utf8')); }
  catch(e) { throw new Error('Bootstrap actual migration '+name+': '+e.message); }
}
const V1='2026-09-27-salud-v1';
const ANTIGUO='10000000-0000-4000-8000-000000000001', ACTIVA='20000000-0000-4000-8000-000000000002', NUEVO='30000000-0000-4000-8000-000000000003';
await db.query("insert into auth.users(id,email) values($1,'a@example.invalid'),($2,'b@example.invalid'),($3,'c@example.invalid')",[ANTIGUO,ACTIVA,NUEVO]);
// Quien aceptó antes de la actualización: fila y registro de la v1, como en producción.
for (const u of [ANTIGUO,ACTIVA]) {
  await db.query("insert into health_consents(user_id,action,version,source) values($1,'accept',$2,'app')",[u,V1]);
  await db.query("insert into health_state(user_id,accepted,version) values($1,true,$2)",[u,V1]);
}
await db.exec("select set_config('request.jwt.claim.role','authenticated',false); set role authenticated");
const como = (u) => db.query("select set_config('request.jwt.claim.sub',$1,false)",[u]);
const estado = async () => (await db.query('select my_health_consent() c')).rows[0].c;
const dia = "insert into salud_diaria(fecha,pasos) values(current_date,1000)";
const entreno = (origen,id) => db.query("insert into entrenos_medidos(origen,externo_id,deporte,fecha,inicio,fin,duracion_s) values($1,$2,'carrera',current_date,now()-interval '1 hour',now(),3600)",[origen,id]);
assert.equal((await db.query('select health_consent_version() v')).rows[0].v,V1,'la versión no sube');

// Usuario antiguo: al actualizar nada le pide volver a aceptar y conserva su acceso.
await como(ANTIGUO);
let e = await estado();
assert.equal(e.accepted,true); assert.equal(e.version,V1); assert.equal(e.current_version,V1); assert.equal(e.medicion_activa,false);
assert.equal((await db.query('select health_consent_ok(auth.uid()) ok')).rows[0].ok,true,'sigue con acceso');
// ...pero su aceptación antigua no enciende las fuentes nuevas, ni por la vía directa.
await assert.rejects(()=>db.query(dia),/row-level security|violates/,'salud_diaria apagada');
for (const o of ['watch','iphone_gps','salud']) await assert.rejects(()=>entreno(o,'x-'+o),/row-level security|violates/,o+' apagado');
await entreno('manual','a-mano');
assert.equal((await db.query('select count(*)::int n from entrenos_medidos')).rows[0].n,1,'a mano sigue');

// Usuario antiguo que activa HealthKit: una sola vez, queda registrado y no toca el permiso.
await como(ACTIVA);
assert.deepEqual((await db.query('select activar_medicion() r')).rows[0].r,{ok:true});
assert.deepEqual((await db.query('select activar_medicion() r')).rows[0].r,{ok:true},'idempotente');
e = await estado();
assert.equal(e.medicion_activa,true); assert.equal(e.accepted,true); assert.equal(e.revision,1,'el permiso no cambia');
assert.equal((await db.query("select count(*)::int n from health_consents where version='2026-11-09-medicion-v1'")).rows[0].n,1,'una fila en el registro');
await db.query(dia); await entreno('salud','s-1'); await entreno('watch','w-1'); await entreno('iphone_gps','g-1');
// Retirar y volver a aceptar pide activar otra vez.
await db.query('select withdraw_health_consent(true)');
await db.exec('reset role');
await db.query("update health_erasure_jobs set status='complete',completed_at=now() where user_id=$1",[ACTIVA]);
await db.exec("set role authenticated");
await como(ACTIVA);
assert.equal((await db.query('select accept_health_consent($1) r',[V1])).rows[0].r.ok,true);
e = await estado();
assert.equal(e.accepted,true); assert.equal(e.medicion_activa,false,'tras retirar, hay que activar de nuevo');

// Usuario nuevo: sin aceptar no puede activar; acepta una vez y la medición sigue apagada.
await como(NUEVO);
e = await estado();
assert.equal(e.accepted,false); assert.equal(e.medicion_activa,false);
assert.equal((await db.query('select activar_medicion() r')).rows[0].r.reason,'sin_permiso_salud');
assert.equal((await db.query('select accept_health_consent($1) r',[V1])).rows[0].r.ok,true);
e = await estado();
assert.equal(e.accepted,true); assert.equal(e.medicion_activa,false);
await assert.rejects(()=>entreno('iphone_gps','n-1'),/row-level security|violates/);
assert.equal((await db.query('select activar_medicion() r')).rows[0].r.ok,true);
assert.equal((await estado()).medicion_activa,true);
await entreno('iphone_gps','n-1');

// Separado del permiso de IA, y dentro de la exportación.
assert.equal((await db.query("select count(*)::int n from ai_consents where user_id=auth.uid()")).rows[0].n,0,'no concede IA');
const exp=(await db.query('select export_my_data() x')).rows[0].x;
assert.ok(JSON.stringify(exp).includes('2026-11-09-medicion-v1'),'la activación sale en la exportación');
console.log('medicion-permiso: OK');
} finally { await db.close(); }
