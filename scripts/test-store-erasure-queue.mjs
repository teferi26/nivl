// Local durable RevenueCat erasure regression tests. Never connects to Supabase.
// node scripts/test-store-erasure-queue.mjs /path/to/pglite/dist/index.js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
if (!process.argv[2]) throw new Error('Provide an existing PGlite module path.');
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const root = new URL('../', import.meta.url);
const A = '10000000-0000-4000-8000-000000000001';
const B = '20000000-0000-4000-8000-000000000002';
const C = '30000000-0000-4000-8000-000000000003';
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$;
    create table public.account_erasure_jobs(user_id uuid primary key references auth.users on delete cascade,
      id uuid not null unique default gen_random_uuid(), requested_at timestamptz default now());
    create function public.account_erasure_pending(p_user uuid) returns boolean language sql volatile security definer as $$
      select exists(select 1 from account_erasure_jobs where user_id=p_user) $$;
    create table store_events(id text primary key,type text,app_user_id text,environment text,payload jsonb,note text,received_at timestamptz default now());
    grant usage on schema public,auth to anon,authenticated,service_role;
  `);
  const old = await readFile(new URL('supabase/migrations/0031_account_erasure.sql', root), 'utf8');
  await db.exec(old.slice(old.indexOf('create function public.begin_account_erasure'), old.indexOf('create function public.account_erasure_paths')));
  await db.exec('revoke all on function begin_account_erasure(uuid) from public; grant execute on function begin_account_erasure(uuid) to service_role');
  await db.exec(await readFile(new URL('supabase/migrations/0063_store_events_late_identity_redaction.sql', root), 'utf8'));
  const migration = await readFile(new URL('supabase/migrations/0064_store_erasure_cleanup_queue.sql', root), 'utf8');
  await db.exec(migration); await db.exec(migration);
  async function service(sql, args = []) {
    await db.exec("select set_config('test.role','service_role',false); set role service_role");
    try { return (await db.query(sql, args)).rows; } finally { await db.exec('reset role'); }
  }
  async function scalar(sql, args = []) { return Object.values((await service(sql, args))[0])[0]; }
  async function claim(limit = 20) { return await scalar('select claim_store_erasure_cleanup($1)', [limit]); }
  async function finish(job, deleted) { return await scalar('select finish_store_erasure_cleanup($1,$2,$3)', [job.user_id, job.lease_id, deleted]); }
  const count = async () => (await db.query('select count(*)::int as n from store_erasure_cleanup')).rows[0].n;
  await db.query('insert into auth.users values($1),($2),($3)', [A,B,C]);
  await assert.rejects(() => scalar('select request_store_erasure_cleanup($1)', [A]), /Cuenta activa/);
  await service('select begin_account_erasure($1)', [A]);
  assert.equal(await count(), 1, 'begin erasure transaction must persist cleanup before any external operation');
  await service('select begin_account_erasure($1)', [A]);
  assert.equal(await count(), 1, 'repeated begin remains one identity');
  assert.equal(await scalar('select request_store_erasure_cleanup($1)', [A]), true);
  await db.query('delete from auth.users where id=$1', [A]);
  assert.equal(await count(), 1, 'Auth deletion never cascades to provider queue');
  await db.query('delete from auth.users where id=$1', [B]);
  assert.equal(await count(), 2, 'direct Auth delete also must enqueue atomically');
  await db.exec(`create function fail_store_queue() returns trigger language plpgsql as $$begin
    if new.user_id='${C}'::uuid then raise exception 'simulated queue failure'; end if; return new; end$$;
    create trigger fail_store_queue before insert on store_erasure_cleanup for each row execute function fail_store_queue();`);
  await assert.rejects(() => db.query('delete from auth.users where id=$1',[C]), /simulated queue failure/);
  assert.equal((await db.query('select count(*)::int as n from auth.users where id=$1',[C])).rows[0].n,1,'enqueue failure aborts Auth deletion');
  await db.exec('drop trigger fail_store_queue on store_erasure_cleanup; drop function fail_store_queue()');
  const jobs = await claim();
  assert.equal(jobs.length, 2);
  assert.equal((await claim()).length, 0, 'two workers cannot claim the same current lease');
  const a = jobs.find((j) => j.user_id === A), b = jobs.find((j) => j.user_id === B);
  assert.equal(await scalar('select finish_store_erasure_cleanup($1,$2,true)', [A,b.lease_id]), false, 'lease cannot finish a different user');
  assert.equal(await finish(a, true), true);
  assert.equal(await finish(a, true), false, 'completion is CAS, not repeated acknowledgement');
  assert.equal(await count(), 2, 'DELETE 404/success does not discard tombstone');
  await db.query("update store_erasure_cleanup set next_attempt_at=now()-interval '1 second' where user_id=$1", [A]);
  const retry = (await claim()).find((j) => j.user_id === A);
  assert.ok(retry, 'success retries again during horizon to catch later provider recreation');
  assert.equal(await finish(retry, true), true);
  await db.query("update store_erasure_cleanup set lease_until=now()-interval '1 second' where user_id=$1", [B]);
  assert.equal(await finish(b, true), false, 'expired worker cannot finish lease');
  const renewed = (await claim()).find((j) => j.user_id === B);
  assert.ok(renewed && renewed.lease_id !== b.lease_id);
  assert.equal(await finish(renewed, false), true);
  await db.query("update store_erasure_cleanup set retain_until=now()-interval '1 second',next_attempt_at=now()-interval '1 second' where user_id=$1", [B]);
  assert.ok((await claim()).some((j) => j.user_id === B), 'failed jobs survive expiry until external delete succeeds');
  // Provider was recreated just before horizon by a delayed read; an old
  // successful DELETE cannot justify purge without a final post-horizon DELETE.
  await db.query("update store_erasure_cleanup set retain_until=now()-interval '1 second',last_deleted_at=now()-interval '2 minutes',last_attempt_at=now()-interval '3 minutes',next_attempt_at=now()+interval '15 minutes' where user_id=$1", [A]);
  const boundary = (await claim()).find((j) => j.user_id === A);
  assert.ok(boundary,'expired tombstone with only pre-horizon success must get a final deletion lease');
  assert.equal((await db.query('select count(*)::int as n from store_erasure_cleanup where user_id=$1',[A])).rows[0].n,1,'pre-horizon success must never purge an active boundary lease');
  assert.equal(await finish(boundary,true),true);
  await claim();
  assert.equal((await db.query('select count(*)::int as n from store_erasure_cleanup where user_id=$1',[A])).rows[0].n,0,'only successful expired unleased row may purge');
  assert.equal(await scalar('select request_store_erasure_cleanup($1)',[A]),true,'late invalid read re-enqueues after purge');
  for (const role of ['anon','authenticated']) {
    await db.exec('set role '+role);
    for (const sql of ['select * from store_erasure_cleanup','select claim_store_erasure_cleanup(20)',`select request_store_erasure_cleanup('${A}')`, `select finish_store_erasure_cleanup('${A}','${a.lease_id}',true)`]) {
      await assert.rejects(() => db.query(sql), /permission denied/);
    }
    await db.exec('reset role');
  }
  await assert.rejects(() => claim(0), /Límite/);
  const exportSection = migration.slice(migration.indexOf('create or replace function public.export_my_data'));
  assert.match(exportSection, /store_erasure_cleanup/);
  assert.match(exportSection, /q\.user_id = u/);
  assert.ok(!exportSection.includes('lease_id'), 'export does not disclose worker lease token');
  // Fingerprints must recognize the consolidated superset and recover if an
  // old export gets replayed: table existence alone must not hide lost coverage.
  const runner = await readFile(new URL('scripts/apply-migrations.mjs', root), 'utf8');
  const fingerprint = async (number) => {
    const line = runner.split('\n').find((line) => line.trimStart().startsWith("'" + number + "':"));
    const expression = line.slice(line.indexOf('`') + 1, line.lastIndexOf('`'));
    return (await db.query('select (' + expression + ') as applied')).rows[0].applied;
  };
  for (const number of ['0040','0044','0056','0060','0064']) assert.equal(await fingerprint(number),true,number+' must recognize consolidated export');
  const source = async () => (await db.query("select prosrc from pg_proc where oid='public.export_my_data()'::regprocedure")).rows[0].prosrc;
  assert.ok((await source()).includes("'creador'"),'new export must preserve creator coverage');
  assert.ok((await source()).includes("'store_erasure_cleanup'"),'new export includes durable queue coverage');
  const creatorMigration = await readFile(new URL('supabase/migrations/0056_creadores_borrado_exportacion.sql',root),'utf8');
  await db.exec(creatorMigration.slice(creatorMigration.indexOf('create or replace function public.export_my_data'),creatorMigration.indexOf('notify pgrst')));
  assert.equal(await fingerprint('0064'),false,'old replay must make new fingerprint pending, not silently lose queue');
  await db.exec(migration);
  assert.equal(await fingerprint('0064'),true);
  assert.ok((await source()).includes("'creador'") && (await source()).includes("'store_erasure_cleanup'"));
  console.log('PASS durable store erasure: atomic enqueue, Auth independence, role denies, CAS leases, expiry/reclaim, success retries, retention/purge, late reads and export coverage');
} finally { await db.close(); }
