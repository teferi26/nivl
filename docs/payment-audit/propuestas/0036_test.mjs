// Prueba aislada de la propuesta 0036 (PGlite en memoria; nunca conecta a Supabase ni a tiendas).
// Uso: node docs/payment-audit/propuestas/0036_test.mjs /ruta/a/@electric-sql/pglite/dist/index.js [--sin-0036]
// Con --sin-0036 se ejecuta contra 0027 + 0033 tal cual (para ver los casos que fallan antes).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (!process.argv[2]) throw new Error('Indica la ruta de un PGlite existente; esta prueba no instala nada.');
const sin0036 = process.argv.includes('--sin-0036');
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const root = fileURLToPath(new URL('../../..', import.meta.url));
const U = n => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
const reserve = users => scalar('select public.begin_store_reconciliation($1::uuid[])', [users]);
const apply = (snapshots, event = null) => scalar('select public.apply_store_reconciliation($1::jsonb, $2::jsonb)',
  [JSON.stringify(snapshots), event === null ? null : JSON.stringify(event)]);
const days = d => new Date(Date.now() + d * 86400_000).toISOString();
const native = (o = {}) => ({ product_id: 'nivl_elite_anual', provider: 'apple', environment: 'SANDBOX', trial: false,
  refunded: false, expires_at: days(0.01), ...o });
const state = uid => db.query('select status, plan, provider, store_environment from subscriptions where user_id = $1', [uid])
  .then(r => r.rows[0] ?? null);
const grant = (uid, plan, end) => db.query(
  "insert into subscriptions(user_id, status, plan, provider, current_period_end) values($1, 'active', $2, 'manual', $3)",
  [uid, plan, end]);
const reconcile = async (uid, subs, event = null) => {
  const [r] = await reserve([uid]);
  return apply([{ ...r, requested_ms: Date.now(), subscriptions: subs }], event);
};

const results = [];
const caso = async (name, fn) => {
  try { await fn(); results.push({ caso: name, ok: true }); } catch (e) { results.push({ caso: name, ok: false, error: e.message }); }
};

try {
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
      current_period_end timestamptz, updated_at timestamptz not null default now());
    create table public.store_products(product_id text primary key, plan text, tier text, max_seats int);
    insert into public.store_products values
      ('nivl_pro_anual','pro_anual','pro',null), ('nivl_pro_mensual','pro_mensual','pro',null),
      ('nivl_elite_anual','elite_anual','elite',null), ('nivl_elite_mensual','elite_mensual','elite',null),
      ('nivl_elite_fundador','elite_fundador','elite',100);
    create table public.store_sales(transaction_id text, user_id uuid, product_id text, refunded_at timestamptz);
    create table public.creator_settings(eur_per_usd numeric); insert into public.creator_settings values(0.9);
    create table public.test_financial_log(kind text, transaction_id text);
    create function public.record_refund(text) returns void language sql as $$ insert into public.test_financial_log values('refund', $1); $$;
    create function public.record_sale(uuid,text,text,text,text,integer,text,integer,timestamptz) returns void language sql as $$
      insert into public.test_financial_log values('sale', $3); $$;
    create function public.net_cents_eur(numeric) returns integer language sql as $$ select round(coalesce($1,0)*100)::integer; $$;
  `);
  await db.exec(await readFile(resolve(root, 'supabase/migrations/0027_tienda.sql'), 'utf8'));
  await db.exec(await readFile(resolve(root, 'supabase/migrations/0033_store_reconciliation.sql'), 'utf8'));
  if (!sin0036) {
    const m = await readFile(resolve(root, 'docs/payment-audit/propuestas/0036_proteger_concesiones_manuales.sql'), 'utf8');
    await db.exec(m);
    await db.exec(m); // re-ejecutable
  }
  for (let i = 1; i <= 10; i++) await db.query('insert into auth.users values($1)', [U(i)]);

  await caso('demo Élite manual + compra sandbox (reconciliación) → conserva Élite manual', async () => {
    await grant(U(1), 'elite_anual', days(57));
    assert.deepEqual(await reconcile(U(1), [native()]), { ok: true });
    assert.deepEqual(await state(U(1)), { status: 'active', plan: 'elite_anual', provider: 'manual', store_environment: null });
  });
  await caso('demo Élite manual + evento INITIAL_PURCHASE sandbox → conserva Élite manual en la misma transacción', async () => {
    await grant(U(2), 'elite_anual', days(57));
    const ev = { id: 'ev-demo-sandbox', type: 'INITIAL_PURCHASE', app_user_id: U(2), environment: 'SANDBOX', store: 'APP_STORE',
      product_id: 'nivl_pro_mensual', period_type: 'NORMAL', expiration_at_ms: Date.now() + 600_000,
      event_timestamp_ms: Date.now() - 1000, transaction_id: 't-sb', original_transaction_id: 'o-sb' };
    assert.deepEqual(await reconcile(U(2), [native({ product_id: 'nivl_pro_mensual' })], ev), { ok: true });
    assert.equal((await state(U(2))).provider, 'manual');
    assert.equal((await state(U(2))).plan, 'elite_anual');
    assert.equal(await scalar("select count(*)::int from test_financial_log where kind='sale'"), 0);
  });
  await caso('caducada la compra sandbox, la demo sigue con Élite manual', async () => {
    assert.deepEqual(await reconcile(U(1), []), { ok: true });
    assert.deepEqual(await state(U(1)), { status: 'active', plan: 'elite_anual', provider: 'manual', store_environment: null });
  });
  await caso('Pro manual + Élite de producción → la compra real sustituye', async () => {
    await grant(U(3), 'pro_anual', days(57));
    await reconcile(U(3), [native({ environment: 'PRODUCTION', expires_at: days(365) })]);
    assert.deepEqual(await state(U(3)), { status: 'active', plan: 'elite_anual', provider: 'apple', store_environment: 'PRODUCTION' });
  });
  await caso('Pro manual corto + Pro anual de producción más largo → la compra real sustituye', async () => {
    await grant(U(4), 'pro_anual', days(5));
    await reconcile(U(4), [native({ product_id: 'nivl_pro_anual', environment: 'PRODUCTION', expires_at: days(365) })]);
    assert.equal((await state(U(4))).provider, 'apple');
  });
  await caso('Élite manual sin fin + Pro de producción → conserva Élite manual', async () => {
    await grant(U(5), 'elite_anual', null);
    await reconcile(U(5), [native({ product_id: 'nivl_pro_mensual', environment: 'PRODUCTION', expires_at: days(30) })]);
    assert.equal((await state(U(5))).provider, 'manual');
  });
  await caso('concesión caducada + compra sandbox → la tienda manda (sin cambio respecto a 0033)', async () => {
    await grant(U(6), 'elite_anual', days(-3));
    await reconcile(U(6), [native()]);
    assert.equal((await state(U(6))).provider, 'apple');
  });
  await caso('cortesía (prueba 7 días) + compra sandbox → la tienda manda (sin cambio respecto a 0033)', async () => {
    await db.query("insert into subscriptions(user_id, status, plan, provider, current_period_end) values($1,'trialing','cortesia','manual',$2)", [U(7), days(5)]);
    await reconcile(U(7), [native()]);
    assert.equal((await state(U(7))).provider, 'apple');
  });
  if (!sin0036) {
    await caso('huella 0036 detectable', async () => {
      assert.equal(await scalar(`select exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='apply_store_reconciliation' and obj_description(p.oid, 'pg_proc') like '%nivl:store-manual-grants-20261002%')`), true);
    });
    await caso('permisos: solo service_role', async () => {
      for (const role of ['anon', 'authenticated']) {
        await db.exec(`set role ${role}`);
        try { await assert.rejects(apply([]), /permission denied/); } finally { await db.exec('reset role'); }
      }
      assert.equal(await scalar("select has_function_privilege('service_role','public.apply_store_reconciliation(jsonb,jsonb)','EXECUTE')"), true);
    });
  }
  console.log(JSON.stringify({ con0036: !sin0036, pass: results.filter(r => r.ok).length, fail: results.filter(r => !r.ok).length, results }, null, 1));
  if (results.some(r => !r.ok)) process.exitCode = 1;
} finally { await db.close(); }
