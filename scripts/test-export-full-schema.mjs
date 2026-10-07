// Executes export_my_data against the actual repository migrations in PostgreSQL.
// No remote service, network credentials or real user data.
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
await db.query("insert into auth.users(id,email) values($1,'own@example.invalid'),($2,'other@example.invalid')",[A,B]);
const creatorA = (await db.query("insert into creators(user_id,code,alias,notes) values($1,'OWNTEST','Own creator','OWN_INTERNAL_NOTE') returning id",[A])).rows[0].id;
const creatorB = (await db.query("insert into creators(user_id,code,alias,notes) values($1,'OTHERTEST','Other creator','OTHER_INTERNAL_NOTE') returning id",[B])).rows[0].id;
await db.query("insert into store_erasure_cleanup(user_id,lease_id,lease_until) values($1,gen_random_uuid(),now()+interval '5 minutes'),($2,gen_random_uuid(),now()+interval '5 minutes')",[A,B]);
const sale = (await db.query("insert into store_sales(user_id,creator_id,store,transaction_id,original_transaction_id,product_id,payment_number,net_cents,price_cents,currency,purchased_at) values($1,$2,'apple','FAKE_TX','FAKE_ORIG','nivl_pro_anual',1,8000,10000,'EUR',now()) returning id",[B,creatorA])).rows[0].id;
await db.query("insert into commissions(creator_id,sale_id,kind,rank,pct,cap_cents,amount_cents,status,available_at) values($1,$2,'primer_pago','novato',25,2500,2000,'pendiente',now())",[creatorA,sale]);
await db.query("insert into creator_payouts(creator_id,kind,amount_cents,note) values($1,'comisiones',2000,'SECRET_PAYOUT_NOTE'),($2,'comisiones',9000,'OTHER_PAYOUT_NOTE')",[creatorA,creatorB]);
await db.exec("select set_config('request.jwt.claim.role','authenticated',false); set role authenticated");
async function exportAs(uid) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
  return (await db.query('select export_my_data() as exported')).rows[0].exported;
}
const own = await exportAs(A), other = await exportAs(B);
assert.equal(own.version,7);
assert.equal(own.creador.code,'OWNTEST');
assert.equal(own.creador.comisiones.length,1);
assert.equal(own.creador.comisiones[0].amount_cents,2000);
assert.equal(own.creador.liquidaciones.length,1);
assert.equal(other.creador.code,'OTHERTEST');
assert.equal(other.creador.comisiones.length,0);
assert.equal(own.store_erasure_cleanup.length,1);
assert.equal(other.store_erasure_cleanup.length,1);
const serialized=JSON.stringify(own);
assert.ok(!serialized.includes(B),'own export must not disclose buyer/other UUID');
assert.ok(!serialized.includes('OTHERTEST') && !serialized.includes('OTHER_INTERNAL_NOTE'));
assert.ok(!serialized.includes('OWN_INTERNAL_NOTE') && !serialized.includes('SECRET_PAYOUT_NOTE'));
assert.ok(!serialized.includes('lease_id') && !serialized.includes('lease_until'));
assert.ok(!serialized.includes('FAKE_TX') && !serialized.includes('FAKE_ORIG'));
await db.query("select set_config('request.jwt.claim.sub','',false)");
await assert.rejects(()=>db.query('select export_my_data()'),/No autenticado/);
await db.exec('reset role; set role anon');
await assert.rejects(()=>db.query('select export_my_data()'),/permission denied/);
console.log('PASS full-schema export v7: all actual migrations except scheduler0010, own/other creator and queue, commission/payout coverage, identity and lease redaction, unauthenticated/anon denies');
} finally { await db.close(); }
