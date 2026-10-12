// Local PostgreSQL regression tests. No remote credentials or production access.
// node scripts/test-store-late-redaction.mjs /path/to/pglite/dist/index.js
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
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create table public.profiles(id uuid primary key references auth.users on delete cascade);
    create table public.account_erasure_jobs(user_id uuid primary key);
    create function public.account_erasure_pending(p_user uuid) returns boolean
      language sql volatile security definer as $$
      select exists(select 1 from public.account_erasure_jobs where user_id=p_user) $$;
    create table public.store_events(id text primary key, type text not null, app_user_id text,
      environment text, payload jsonb not null, note text, received_at timestamptz default now());
    grant usage on schema public to anon, authenticated, service_role;
  `);
  await db.query('insert into auth.users values ($1)', [B]);
  await db.exec(await readFile(new URL('supabase/migrations/0039_store_events_seudonimizar.sql', root), 'utf8'));
  const aliasEvent = { id: 'old-alias', type: 'RENEWAL', app_user_id: B, aliases: [A, B], price: 100 };
  const transferEvent = { id: 'old-transfer', type: 'TRANSFER', transferred_from: [A], transferred_to: [B] };
  async function put(event, app = event.app_user_id ?? null) {
    await db.query('insert into store_events(id,type,app_user_id,environment,payload) values($1,$2,$3,$4,$5)',
      [event.id, event.type, app, 'PRODUCTION', event]);
  }
  async function row(id) { return (await db.query('select * from store_events where id=$1', [id])).rows[0]; }
  await put(aliasEvent); await put(transferEvent);
  // These cases reproduce the old leak before the new migration is applied.
  assert.deepEqual((await row(aliasEvent.id)).payload, aliasEvent);
  assert.deepEqual((await row(transferEvent.id)).payload, transferEvent);
  const before = await row(aliasEvent.id);
  const migration = await readFile(new URL('supabase/migrations/0063_store_events_late_identity_redaction.sql', root), 'utf8');
  await db.exec(migration);
  await db.exec(migration); // Re-executable; does not drop event idempotency keys.
  async function redacted(id, type) {
    const saved = await row(id);
    assert.deepEqual(saved.payload, { id, type, redacted: true });
    assert.equal(saved.app_user_id, null);
    assert.equal(saved.environment, 'PRODUCTION');
    assert.equal(saved.note, 'redactado por borrado');
  }
  await redacted(aliasEvent.id, aliasEvent.type);
  await redacted(transferEvent.id, transferEvent.type);
  assert.deepEqual((await row(aliasEvent.id)).received_at, before.received_at);
  for (const [key, value] of [
    ['original_app_user_id', A], ['aliases', [A, B]],
    ['transferred_from', [A]], ['transferred_to', [B, A]],
  ]) {
    const event = { id: 'late-' + key, type: 'TRANSFER', app_user_id: B, [key]: value };
    await put(event);
    await redacted(event.id, event.type);
  }
  await put({ ...transferEvent, id: 'late-no-app-id' });
  await redacted('late-no-app-id', 'TRANSFER');
  await put({ id: 'payload-only-deleted', type: 'RENEWAL', app_user_id: A }, B);
  await redacted('payload-only-deleted', 'RENEWAL');
  await put({ id: 'column-only-deleted', type: 'RENEWAL', app_user_id: B }, A);
  await redacted('column-only-deleted', 'RENEWAL');
  const live = { id: 'live', type: 'RENEWAL', app_user_id: B, aliases: [B, '$RCAnonymousID:retained'] };
  await put(live);
  assert.deepEqual((await row('live')).payload, live);
  const anonymous = { id: 'anonymous', type: 'TRANSFER', aliases: '$RCAnonymousID:string', transferred_from: null };
  await put(anonymous);
  assert.deepEqual((await row('anonymous')).payload, anonymous);
  await db.query('update store_events set payload = $1 where id=$2', [{ ...live, aliases: [A] }, 'live']);
  await redacted('live', 'RENEWAL');
  await assert.rejects(() => put(aliasEvent), /duplicate key/);
  await db.exec('set role service_role');
  const active = async (uid) => (await db.query('select store_account_active($1) as active', [uid])).rows[0].active;
  assert.equal(await active(B), true);
  assert.equal(await active(A), false);
  assert.equal(await active(null), false);
  await db.exec('reset role');
  await db.query('insert into account_erasure_jobs values($1)', [B]);
  await db.exec('set role service_role');
  assert.equal(await active(B), false);
  for (const role of ['anon', 'authenticated']) {
    await db.exec('reset role; set role ' + role);
    await assert.rejects(() => active(B), /permission denied/);
  }
  console.log('PASS late store redaction: reproduced old leaks, backfill, transfer and alias identities, live/anonymous payloads, updates, idempotency and server-only erasure guard');
} finally { await db.close(); }
