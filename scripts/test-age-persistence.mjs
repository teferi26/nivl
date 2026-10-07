// PostgreSQL regression checks for minimum-age persistence. Local only.
// Usage: node scripts/test-age-persistence.mjs /path/to/pglite/dist/index.js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
if (!process.argv[2]) throw new Error('Provide an existing PGlite module path.');
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const root = new URL('../', import.meta.url);
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth, public to anon, authenticated;
    create table public.ai_consents (
      id bigint generated always as identity, user_id uuid,
      action text, version text, source text, created_at timestamptz default now()
    );
    create function public.ai_consent_version() returns text language sql as $$ select 'test'::text $$;
  `);
  const initial = await readFile(new URL('supabase/migrations/0028_consentimiento_ia.sql', root), 'utf8');
  const ageSql = initial.slice(initial.indexOf('create table if not exists public.age_confirmations'), initial.indexOf('-- El dueño'));
  await db.exec(ageSql);
  const a = '10000000-0000-4000-8000-000000000001';
  const b = '20000000-0000-4000-8000-000000000002';
  await db.query('insert into auth.users values ($1), ($2)', [a, b]);
  // Historical row is deliberately NOT evidence of an explicit app action.
  await db.query('insert into public.age_confirmations(user_id,min_age) values ($1,16)', [a]);
  await db.exec(await readFile(new URL('supabase/migrations/0029_consentimiento_explicito.sql', root), 'utf8'));
  async function session(role, uid = '') {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
    await db.exec('set role ' + role);
  }
  async function scalar(sql, args = []) { return Object.values((await db.query(sql, args)).rows[0])[0]; }
  await session('authenticated', a);
  assert.equal(await scalar('select my_age_confirmation()'), false);
  assert.equal(await scalar('select confirm_minimum_age(15)'), false);
  assert.equal(await scalar('select confirm_minimum_age(null)'), false);
  assert.equal(await scalar('select my_age_confirmation()'), false);
  assert.equal(await scalar('select confirm_minimum_age(16)'), true);
  assert.equal(await scalar('select my_age_confirmation()'), true);
  const first = await scalar('select app_confirmed_at::text from age_confirmations');
  assert.equal(await scalar('select confirm_minimum_age(16)'), true);
  assert.equal(await scalar('select app_confirmed_at::text from age_confirmations'), first);
  assert.equal(await scalar('select count(*)::int from age_confirmations'), 1);
  await session('authenticated', b);
  assert.equal(await scalar('select my_age_confirmation()'), false);
  assert.equal(await scalar('select count(*)::int from age_confirmations'), 0);
  assert.equal(await scalar('select confirm_minimum_age(16)'), true);
  // Signing out and back in must not erase the first account's decision.
  await session('anon');
  await assert.rejects(() => db.query('select my_age_confirmation()'), /permission denied/);
  await session('authenticated', a);
  assert.equal(await scalar('select my_age_confirmation()'), true);
  assert.equal(await scalar('select app_confirmed_at::text from age_confirmations'), first);
  await assert.rejects(() => db.query('update age_confirmations set app_confirmed_at = null'), /permission denied/);
  console.log('PASS age persistence: explicit acceptance, invalid age, idempotency, account isolation, relogin and permissions');
} finally { await db.close(); }
