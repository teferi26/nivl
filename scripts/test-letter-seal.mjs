// Executes export_my_data against the actual repository migrations in PostgreSQL.
// No remote service, network credentials or real user data.
// PGlite serializes overlapping submissions on one connection; the real
// PostgreSQL unique index proves the persistence invariant, not multi-session timing.
// node scripts/test-export-full-schema.mjs /path/to/pglite/dist/index.js
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
const A='10000000-0000-4000-8000-000000000001', B='20000000-0000-4000-8000-000000000002';
await db.query("insert into auth.users(id,email) values($1,'a@example.invalid'),($2,'b@example.invalid')",[A,B]);
await db.query("insert into letters(user_id,body,open_at) values($1,'Legacy historical letter','2030-01-01'),($1,'Legacy historical letter','2030-01-01')",[A]);
async function role(name,uid='') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[uid,name]);
  await db.exec('set role '+name);
}
async function seal(user=A,body='Frozen signed body',date='2030-01-01',health=false) {
  return (await db.query('select seal_letter($1,$2,$3,$4) as letter',[user,body,date,health])).rows[0].letter;
}
await role('authenticated',A);
// No new age/health requirement for general letters: existing policy parity.
const pending=Array.from({length:8},()=>seal());
const sealed=await Promise.all(pending);
assert.equal(new Set(sealed.map((r)=>r.id)).size,1,'overlapping RPC submissions must yield one persisted letter');
const first=sealed[0];
await db.exec("set datestyle='SQL, DMY'");
const retry=await seal();
assert.equal(retry.id,first.id,'date formatting must not alter server fingerprint');
assert.equal(retry.sealed_at,first.sealed_at);
await db.exec("set datestyle='ISO, MDY'");
assert.equal((await db.query('select count(*)::int as n from letters where seal_key is not null')).rows[0].n,1);
assert.equal((await db.query('select count(*)::int as n from letters where seal_key is null')).rows[0].n,2,'legacy duplicates remain intact');
await assert.rejects(()=>seal(B),/No autorizado/);
await assert.rejects(()=>seal(A,'Health letter','2030-01-01',true),/sin_consentimiento_salud|row-level security/);
await db.query('select accept_health_consent(health_consent_version())');
const health=await seal(A,'Health letter','2030-01-01',true);
assert.equal(health.health_data,true);
await assert.rejects(()=>seal(A,first.body,first.open_at,true),/contenido de la firma ha cambiado/);
const unchanged=await seal();
assert.equal(unchanged.health_data,false);
await db.query('select withdraw_health_consent(true)');
await assert.rejects(()=>seal(A,'Health letter','2030-01-01',true),/sin_consentimiento_salud|row-level security/);
await assert.rejects(()=>seal(A,'Health letter','2030-01-01',false),/sin_consentimiento_salud|row-level security|No se ha podido leer/);
await role('authenticated',B);
const other=await seal(B);
assert.notEqual(other.id,first.id,'same content in different accounts is independent');
assert.equal((await db.query('select count(*)::int as n from letters')).rows[0].n,1,'RLS hides other account letters');
await role('anon');
await assert.rejects(()=>seal(),/permission denied/);
await role('service_role');
await assert.rejects(()=>seal(),/permission denied/);
await db.query('select begin_account_erasure($1)',[A]);
await role('authenticated',A);
await assert.rejects(()=>seal(),/borrado_cuenta_pendiente/);
await db.exec('reset role');
assert.equal((await db.query('select count(*)::int as n from letters where user_id=$1 and seal_key is not null',[A])).rows[0].n,2,'failed or ambiguous retry must not overwrite/create signed copies');
console.log('PASS seal RPC full real schema: overlapping submissions, same retry/DateStyle, historical preservation, owner isolation, health withdrawal, changed signature, anon/service denies and erasure guard');
} finally { await db.close(); }
