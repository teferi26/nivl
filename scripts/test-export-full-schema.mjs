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
// 0075 (WORK): cuenta con saldo inicial, fijo, categoría propia y brief de A.
const cuentaA = (await db.query("insert into money_accounts(user_id,name,provider,opening_balance) values($1,'Efectivo','efectivo',85) returning id",[A])).rows[0].id;
await db.query("insert into money_categories(user_id,name,base_category) values($1,'Mascota','otros')",[A]);
await db.query("insert into money_recurring(user_id,account_id,kind,name,amount,day_of_month,category) values($1,$2,'gasto','Alquiler',750,3,'vivienda')",[A,cuentaA]);
await db.query("insert into money_briefs(user_id,month,numbers,text) values($1,'2026-09','{}','Brief de prueba.')",[A]);
for (const t of ['money_categories','money_recurring','money_briefs']) {
  const g = await db.query("select count(*)::int n from pg_trigger where tgname='account_write_guard' and tgrelid=$1::regclass",['public.'+t]);
  assert.equal(g.rows[0].n,1,'account_write_guard en '+t);
}
await db.exec("select set_config('request.jwt.claim.role','authenticated',false); set role authenticated");
// RLS y referencias ajenas: B no ve lo de A ni cuelga un fijo de la cuenta de A; el brief solo lo escribe el servidor.
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[B]);
assert.equal((await db.query('select count(*)::int n from money_recurring')).rows[0].n,0);
await assert.rejects(()=>db.query("insert into money_recurring(user_id,account_id,kind,name,amount,day_of_month) values($1,$2,'gasto','X',1,1)",[B,cuentaA]),/Referencia ajena/);
await assert.rejects(()=>db.query("insert into money_briefs(user_id,month,text) values($1,'2026-08','x')",[B]),/permission denied/);
async function exportAs(uid) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
  return (await db.query('select export_my_data() as exported')).rows[0].exported;
}
// FOCUS (0076): RLS de dueño y referencias de la misma cuenta.
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);
const subA = (await db.query("insert into focus_subjects(name) values('Cálculo II') returning id")).rows[0].id;
await db.query("insert into focus_topics(subject_id,name) values($1,'Integrales dobles')",[subA]);
await db.query("insert into focus_sessions(subject_id,client_id,session_date,minutes) values($1,'foco-1-1',current_date,25)",[subA]);
await assert.rejects(()=>db.query("insert into focus_sessions(subject_id,client_id,session_date,minutes) values($1,'foco-1-1',current_date,25)",[subA]),/duplicate|unique/);
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[B]);
assert.equal((await db.query('select count(*)::int as n from focus_subjects')).rows[0].n,0,'B no ve las asignaturas de A');
await assert.rejects(()=>db.query("insert into focus_topics(subject_id,name) values($1,'Robado')",[subA]),/ajena/);
await assert.rejects(()=>db.query("insert into focus_subjects(user_id,name) values($1,'Suplantada')",[A]),/row-level security|violates/);
assert.equal((await db.query("update focus_subjects set name='x' where id=$1 returning id",[subA])).rows.length,0);
const own = await exportAs(A), other = await exportAs(B);
// v11 desde la 0076: la v9 de la 0072 (funnel_events, app_feedback y admins), más las tres tablas de WORK (0075)
// y las ocho de FOCUS (0076). La 0077 (IRON) no toca la exportación: sus columnas viajan en nutrition_logs.
assert.equal(own.version,11);
assert.equal(own.money_recurring.length,1); assert.equal(own.money_categories.length,1); assert.equal(own.money_briefs.length,1);
assert.equal(other.money_recurring.length,0); assert.deepEqual(other.money_categories,[]); assert.equal(Number(own.money_accounts[0].opening_balance),85);
const comentario = (await db.query("select obj_description(to_regprocedure('public.export_my_data()'),'pg_proc') as c")).rows[0].c;
for (const h of ['nivl:export-analitica-0072','nivl:export-work-0075','nivl:export-focus-0076']) assert.ok(comentario.includes(h),'huella '+h);
assert.equal(own.focus_subjects.length,1); assert.equal(own.focus_topics.length,1); assert.equal(own.focus_sessions.length,1);
assert.deepEqual(other.focus_subjects,[]); assert.deepEqual(own.focus_cards,[]);
assert.deepEqual(own.funnel_events,[]); assert.deepEqual(own.app_feedback,[]); assert.deepEqual(own.admins,[]);
assert.deepEqual(own.user_modes,[]); assert.deepEqual(own.mode_xp,[]);
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
console.log('PASS full-schema export v11 (WORK 0075: RLS, refs ajenas, briefs solo servidor, account_write_guard; FOCUS 0076: RLS): all actual migrations except scheduler0010, own/other creator and queue, commission/payout coverage, identity and lease redaction, unauthenticated/anon denies');
} finally { await db.close(); }
