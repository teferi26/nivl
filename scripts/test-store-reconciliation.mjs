// Isolated, in-memory SQL regression test. Never connects to Supabase or a store.
// Usage: node scripts/test-store-reconciliation.mjs /path/to/@electric-sql/pglite/dist/index.js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (!process.argv[2]) throw new Error('Provide an existing PGlite module path; no dependencies are installed by this test.');
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const root = fileURLToPath(new URL('..', import.meta.url));
const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const C = '00000000-0000-4000-8000-000000000003';
let checks = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
const reserve = users => scalar('select public.begin_store_reconciliation($1::uuid[])', [users]);
const apply = (snapshots, event = null) => scalar('select public.apply_store_reconciliation($1::jsonb, $2::jsonb)', [JSON.stringify(snapshots), event === null ? null : JSON.stringify(event)]);
const native = (options = {}) => ({
  product_id: 'nivl_pro_anual', provider: 'apple', environment: 'SANDBOX', trial: false, refunded: false,
  expires_at: new Date(Date.now() + 3600_000).toISOString(), ...options,
});
const snapshot = (reservation, subscriptions) => ({ ...reservation, requested_ms: Date.now(), subscriptions });
const state = uid => db.query('select status, plan, provider, original_transaction_id, store_environment from subscriptions where user_id = $1', [uid]).then(r => r.rows[0] ?? null);

try {
  // Minimal preceding schema. The ACTUAL 0027 event function is exercised, not
  // copied into this test. Financial functions only record calls in memory.
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key);
    create table public.test_pending_erasure(user_id uuid primary key);
    create function public.account_erasure_pending(uuid) returns boolean language sql as $$
      select exists(select 1 from public.test_pending_erasure where user_id=$1); $$;
    create table public.subscriptions(
      user_id uuid primary key references auth.users(id) on delete cascade,
      status text not null default 'none', plan text not null default 'cortesia', provider text not null default 'manual',
      current_period_end timestamptz, updated_at timestamptz not null default now()
    );
    create table public.store_products(product_id text primary key, plan text, tier text, max_seats int);
    insert into public.store_products values
      ('nivl_pro_anual','pro_anual','pro',null), ('nivl_pro_mensual','pro_mensual','pro',null),
      ('nivl_elite_anual','elite_anual','elite',null), ('nivl_elite_mensual','elite_mensual','elite',null),
      ('nivl_elite_fundador','elite_fundador','elite',100);
    create table public.store_sales(transaction_id text, user_id uuid, product_id text, refunded_at timestamptz);
    create table public.creator_settings(eur_per_usd numeric);
    insert into public.creator_settings values(0.9);
    create table public.test_financial_log(kind text, transaction_id text);
    create function public.record_refund(text) returns void language sql as $$
      insert into public.test_financial_log values('refund', $1); $$;
    create function public.record_sale(uuid,text,text,text,text,integer,text,integer,timestamptz) returns void language sql as $$
      insert into public.test_financial_log values('sale', $3); $$;
    create function public.net_cents_eur(numeric) returns integer language sql as $$ select round(coalesce($1,0)*100)::integer; $$;
  `);
  await db.exec(await readFile(resolve(root, 'supabase/migrations/0027_tienda.sql'), 'utf8'));
  const migration = await readFile(resolve(root, 'supabase/migrations/0033_store_reconciliation.sql'), 'utf8');
  await db.exec(migration);
  await db.exec(migration); // rerunnable without duplicating policies/state
  await db.query('insert into auth.users values($1),($2),($3)', [A, B, C]);

  // Restore, erase the original user, restore again with a newly created UUID.
  let reservations = await reserve([A]);
  check(await apply([snapshot(reservations[0], [native()])]), { ok: true });
  check((await state(A)).plan, 'pro_anual');
  check((await state(A)).original_transaction_id, null);
  await db.query('delete from auth.users where id = $1', [A]);
  check(await state(A), null);
  check(await scalar('select count(*)::int from store_reconciliation where user_id = $1', [A]), 0);
  reservations = await reserve([A, B]);
  check(reservations.map(r => r.user_id), [B]);
  const transfer = { id: 'transfer-deleted', type: 'TRANSFER', transferred_from: [A], transferred_to: [B] };
  check(await apply([snapshot(reservations[0], [native()])], transfer), { ok: true });
  check((await state(B)).status, 'active');
  check((await state(B)).original_transaction_id, null);
  check(await scalar('select count(*)::int from test_financial_log'), 0);

  // A real source still present loses access atomically with destination grant.
  reservations = await reserve([B, C]);
  check(await apply(reservations.map(r => snapshot(r, r.user_id === C ? [native()] : [])), {
    id: 'transfer-present', type: 'TRANSFER', transferred_from: [B], transferred_to: [C],
  }), { ok: true });
  check((await state(B)).status, 'canceled'); check((await state(C)).status, 'active');

  // Later refund/expiry work WITHOUT an original chain id in the restored row.
  reservations = await reserve([C]);
  const refund = { id: 'refund-restored', type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT', app_user_id: C,
    product_id: 'nivl_pro_anual', original_transaction_id: 'real-original-id', transaction_id: 'refund-tx', environment: 'SANDBOX' };
  check(await apply([snapshot(reservations[0], [native({ refunded: true })])], refund), { ok: true });
  check((await state(C)).status, 'canceled');

  // Erasure can start after reservation: no snapshot/event mutation may commit.
  const beforeErasure = (await reserve([C]))[0];
  await db.query('insert into test_pending_erasure values($1)', [C]);
  check(await reserve([C]), []);
  check(await apply([snapshot(beforeErasure, [native()])]), { ok: false, pending: true });
  check((await state(C)).status, 'canceled');
  await db.query('delete from test_pending_erasure where user_id=$1', [C]);
  reservations = await reserve([C]);
  check(await apply([snapshot(reservations[0], [native({ refunded: true })])], refund), { ok: true });
  check(await scalar("select count(*)::int from test_financial_log where kind='refund'"), 1);
  reservations = await reserve([C]); await apply([snapshot(reservations[0], [native()])]);
  reservations = await reserve([C]);
  check(await apply([snapshot(reservations[0], [native({ expires_at: new Date(Date.now() - 1000).toISOString() })])], {
    id: 'expire-restored', type: 'EXPIRATION', app_user_id: C, original_transaction_id: 'another-real-chain',
    expiration_at_ms: Date.now() - 1000,
  }), { ok: true });
  check((await state(C)).status, 'canceled');

  // An older HTTP response cannot resurrect an expired/refunded right.
  const older = (await reserve([C]))[0]; const newer = (await reserve([C]))[0];
  check(await apply([snapshot(newer, [])]), { ok: true });
  check(await apply([snapshot(older, [native()])]), { ok: false, pending: true });
  check((await state(C)).status, 'canceled');
  const fresh = (await reserve([C]))[0];
  check(await apply([{ ...snapshot(fresh, [native()]), requested_ms: Date.now() - 130_000 }]), { ok: false, pending: true });

  // Incomplete multi-user snapshots cannot partially transfer access.
  reservations = await reserve([B, C]);
  await assert.rejects(apply([snapshot(reservations[0], [native()])], {
    id: 'incomplete', type: 'TRANSFER', transferred_from: [B], transferred_to: [C],
  }), /Incomplete store event snapshot/); checks++;
  check(await scalar("select count(*)::int from store_events where id='incomplete'"), 0);

  // Protected plans survive empty store snapshots, including legacy events.
  await db.query("update subscriptions set plan='owner', provider='manual', status='active' where user_id=$1", [B]);
  await db.query("update subscriptions set plan='cortesia', provider='manual', status='trialing' where user_id=$1", [C]);
  reservations = await reserve([B, C]);
  check(await apply(reservations.map(r => snapshot(r, []))), { ok: true });
  check((await state(B)).plan, 'owner'); check((await state(C)).status, 'trialing');
  const purchase = { id: 'real-purchase', type: 'INITIAL_PURCHASE', app_user_id: C, environment: 'PRODUCTION', store: 'APP_STORE',
    product_id: 'nivl_pro_anual', period_type: 'NORMAL', price_in_purchased_currency: 99.99, currency: 'EUR',
    original_transaction_id: 'real-chain', transaction_id: 'sale-tx', purchased_at_ms: Date.now(), expiration_at_ms: Date.now() + 3600_000 };
  reservations = await reserve([C]);
  check(await apply([snapshot(reservations[0], [native({ environment: 'PRODUCTION' })])], purchase), { ok: true });
  check((await state(C)).original_transaction_id, 'real-chain');
  reservations = await reserve([C]);
  await apply([snapshot(reservations[0], [native({ environment: 'PRODUCTION' })])], purchase);
  check(await scalar("select count(*)::int from test_financial_log where kind='sale'"), 1);

  // Sandbox cannot replace a live production entitlement of a different tier.
  reservations = await reserve([C]);
  await apply([snapshot(reservations[0], [native({ product_id: 'nivl_elite_anual' }), native({ environment: 'PRODUCTION' })])]);
  check((await state(C)).plan, 'pro_anual'); check((await state(C)).store_environment, 'PRODUCTION');
  reservations = await reserve([C]);
  await apply([snapshot(reservations[0], [native({ product_id: 'unknown_product' })])]);
  check((await state(C)).status, 'canceled');

  // No client may reserve or supply their own authoritative entitlement.
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(reserve([C]), /permission denied/); checks++;
      await assert.rejects(apply([]), /permission denied/); checks++;
      await assert.rejects(db.query('select * from store_reconciliation'), /permission denied/); checks++;
    } finally { await db.exec('reset role'); }
  }
  check(await scalar("select relrowsecurity from pg_class where oid='public.store_reconciliation'::regclass"), true);
  // The original financial/event API remains available to the existing server.
  check(await scalar("select has_function_privilege('service_role','public.apply_store_event(jsonb)','EXECUTE')"), true);
  console.log(JSON.stringify({ ok: true, checks, database: 'PGlite in memory', productionTouched: false }));
} finally { await db.close(); }
