// Prueba SQL aislada, en memoria. Nunca se conecta a Supabase ni a una tienda.
// Uso: node scripts/test-creator-program.mjs /ruta/a/@electric-sql/pglite/dist/index.js
//
// Carga un esquema previo mínimo (roles, auth.users, auth.uid(), subscriptions,
// events), la 0025 REAL y la propuesta 0046 DOS veces, y comprueba las RPC
// nuevas del programa de creadores con datos sintéticos (ningún dato real).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (!process.argv[2]) throw new Error('Pasa la ruta de un módulo PGlite existente; esta prueba no instala nada.');
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const root = fileURLToPath(new URL('..', import.meta.url));

const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const UA = uid(1); // creador A (rol creador)
const UB = uid(2); // creador B (clipper)
const UX = uid(3); // usuario que no es creador
const UD = uid(4); // creador desactivado
const BUY = (n) => uid(100 + n);

let checks = 0;
const check = (actual, expected, msg) => {
  assert.deepEqual(actual, expected, msg);
  checks++;
};
const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];

/** Ejecuta `fn` como `authenticated` con auth.uid() = user (o como anon si user es null). */
async function como(user, fn) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? '']);
  await db.exec(user ? 'set role authenticated' : 'set role anon');
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}
const progress = (u) => como(u, () => scalar('select public.creator_progress() as r'));
const history = (u, m) =>
  como(u, () => rows(m === undefined ? 'select * from public.creator_sales_history()' : 'select * from public.creator_sales_history($1)', m === undefined ? [] : [m]));
const board = (u, p) => como(u, () => rows('select * from public.creator_board_period($1)', [p]));

const ahora = Date.now();
const DIA = 86_400_000;
const hace = (ms) => new Date(ahora - ms).toISOString();
let txn = 0;
async function venta(user, product, at) {
  txn++;
  return scalar(
    "select public.record_sale($1::uuid, 'apple', $2, $3, $4, 9999, 'EUR', 5785, $5::timestamptz)::text",
    [user, `t${txn}`, `o${txn}`, product, at],
  );
}
const mesDe = (iso) => scalar("select to_char($1::timestamptz at time zone 'Europe/Madrid', 'YYYY-MM')", [iso]);

try {
  // ── Esquema previo mínimo (lo que 0025 da por hecho de Supabase y de 0001-0024) ──
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    grant usage on schema auth to anon, authenticated;
    create table auth.users(id uuid primary key, email text, created_at timestamptz not null default now());
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.subscriptions(user_id uuid primary key, plan text not null default 'cortesia', status text not null default 'none');
    create table public.events(id bigserial primary key, user_id uuid, type text, payload jsonb, created_at timestamptz default now());
  `);
  await db.exec(await readFile(resolve(root, 'supabase/migrations/0025_creadores.sql'), 'utf8'));
  const m0046 = await readFile(resolve(root, 'docs/payment-audit/propuestas/0046_programa_creadores.sql'), 'utf8');
  await db.exec(m0046);
  await db.exec(m0046); // re-ejecutable

  // Re-ejecutar no duplica el check del rol.
  check(
    await scalar(
      "select count(*)::int from pg_constraint where conrelid = 'public.creators'::regclass and pg_get_constraintdef(oid) like '%comercial%'",
    ),
    1,
    'un solo check de rol',
  );
  // Huella para apply-migrations.
  check(
    await scalar(
      "select coalesce(obj_description(to_regprocedure('public.creator_progress()'), 'pg_proc') like '%nivl:creator-program-0046%', false)",
    ),
    true,
    'huella',
  );
  // Sin filas sembradas en reglas ni retos.
  check(await scalar('select count(*)::int from public.creator_rank_rules'), 0);
  check(await scalar('select count(*)::int from public.creator_challenges'), 0);

  // ── Datos sintéticos ──
  const usuarios = [UA, UB, UX, UD, ...Array.from({ length: 9 }, (_, i) => BUY(i + 1))];
  for (const u of usuarios) await db.query('insert into auth.users(id) values ($1)', [u]);
  const [{ id: CA }] = await rows(
    "insert into public.creators(user_id, code, alias) values ($1, 'AAA_TEST', 'Alfa') returning id::text",
    [UA],
  );
  const [{ id: CB }] = await rows(
    "insert into public.creators(user_id, code, alias, role) values ($1, 'BBB_TEST', 'Beta', 'clipper') returning id::text",
    [UB],
  );
  await db.query("insert into public.creators(user_id, code, alias, active) values ($1, 'DDD_TEST', 'Delta', false)", [UD]);
  check(await scalar('select role from public.creators where id = $1', [CA]), 'creador', 'rol por defecto');
  await assert.rejects(db.query("update public.creators set role = 'jefe' where id = $1", [CA])); checks++;

  const refer = (u, c) => db.query("insert into public.referrals(user_id, creator_id, source) values ($1, $2, 'manual')", [u, c]);
  for (let i = 1; i <= 5; i++) await refer(BUY(i), CA);
  for (let i = 6; i <= 7; i++) await refer(BUY(i), CB);

  // A: S5 (60 d) y S3 (45 d) se liquidan; luego S3 se reembolsa → clawback.
  const S5 = hace(60 * DIA);
  const S3 = hace(45 * DIA);
  await venta(BUY(5), 'nivl_elite_anual', S5);
  await venta(BUY(3), 'nivl_elite_anual', S3);
  const liq = await scalar('select public.liquidate_creator($1::uuid, null)', [CA]);
  check(liq.ok, true, 'liquidación');
  check(Number(liq.amount), 5000);
  // S2 (40 d): fuera de retención, disponible. S4 (50 d): reembolso antes de pagarse.
  const S2 = hace(40 * DIA);
  const S4 = hace(50 * DIA);
  await venta(BUY(2), 'nivl_elite_anual', S2);
  await venta(BUY(4), 'nivl_pro_anual', S4);
  await db.query("select public.record_refund('t2')"); // S3, ya pagada → clawback
  await db.query("select public.record_refund('t4')"); // S4, sin pagar → anulada
  // S1: ahora mismo, en retención de 30 días.
  const S1 = hace(60_000);
  await venta(BUY(1), 'nivl_pro_anual', S1);
  // B (clipper): dos ventas recientes.
  await venta(BUY(6), 'nivl_pro_anual', hace(120_000));
  await venta(BUY(7), 'nivl_elite_mensual', hace(180_000));

  check(
    await scalar("select status || ':' || clawback from public.commissions k join public.store_sales s on s.id = k.sale_id where s.transaction_id = 't2'"),
    'anulada:true',
    'S3 clawback',
  );

  // Reglas y retos (sintéticos).
  await db.query("insert into public.creator_rank_rules(rank, min_sales_90d, min_months_active) values ('pro', 5, 2)");
  const [{ id: R_TODOS }] = await rows(
    `insert into public.creator_challenges(title, starts_at, ends_at, goal_sales, prize_text)
     values ('Reto de prueba', now() - interval '7 days', now() + interval '7 days', 3, 'Premio de prueba') returning id::text`,
  );
  const [{ id: R_CLIP }] = await rows(
    `insert into public.creator_challenges(title, starts_at, ends_at, goal_sales, role)
     values ('Solo clippers', now() - interval '7 days', now() + interval '7 days', 2, 'clipper') returning id::text`,
  );
  await db.query(
    `insert into public.creator_challenges(title, starts_at, ends_at, goal_sales)
     values ('Terminado', now() - interval '30 days', now() - interval '20 days', 1)`,
  );
  await assert.rejects(
    db.query("insert into public.creator_challenges(title, starts_at, ends_at, goal_sales) values ('x', now(), now() - interval '1 day', 1)"),
  ); checks++;
  await assert.rejects(
    db.query("insert into public.creator_challenges(title, starts_at, ends_at, goal_sales) values ('x', now(), now() + interval '1 day', 0)"),
  ); checks++;
  await assert.rejects(
    db.query("insert into public.creator_challenges(title, starts_at, ends_at, goal_sales) values ($1, now(), now() + interval '1 day', 1)", ['x'.repeat(81)]),
  ); checks++;

  // ── No creador / desactivado / sin sesión → null y 0 filas ──
  check(await progress(UX), null, 'no creador → null');
  check(await progress(UD), null, 'desactivado → null');
  check((await history(UX)).length, 0, 'no creador: 0 filas de histórico');
  check((await board(UX, 'mes')).length, 0, 'no creador: 0 filas de tabla');
  check((await board(UX, `reto:${R_TODOS}`)).length, 0);

  // ── Progreso de A: solo lo suyo ──
  const pA = await progress(UA);
  check(pA.alias, 'Alfa');
  check(pA.code, 'AAA_TEST');
  check(pA.role, 'creador');
  check(pA.rank, 'novato');
  check(Number(pA.pct), 25);
  check(pA.base_cents, 10000);
  check(pA.sales_90d, 3, 'S1, S2, S5 vivas; S3 y S4 anuladas');
  check(pA.next_rank, 'pro');
  check(pA.next_min_sales_90d, 5);
  check(pA.next_min_months_active, 2);
  check(pA.challenges.map((c) => [c.title, c.sales, c.goal_sales, c.prize]), [['Reto de prueba', 1, 3, 'Premio de prueba']], 'A no ve el reto de clippers ni el terminado');
  // Racha: meses (Madrid) con venta viva, contando hacia atrás.
  const conVenta = new Set([await mesDe(S1), await mesDe(S2), await mesDe(S5)]);
  let esperado = 0;
  let m = new Date(`${await mesDe(new Date(ahora).toISOString())}-15T12:00:00Z`);
  if (!conVenta.has(m.toISOString().slice(0, 7))) m.setUTCMonth(m.getUTCMonth() - 1);
  while (conVenta.has(m.toISOString().slice(0, 7))) {
    esperado++;
    m.setUTCMonth(m.getUTCMonth() - 1);
  }
  check(pA.months_active, esperado, 'meses seguidos con venta');
  // Ninguna clave de dinero ajeno ni de compradores.
  check(Object.keys(pA).sort(), [
    'alias', 'base_cents', 'challenges', 'code', 'months_active', 'next_min_months_active', 'next_min_sales_90d',
    'next_rank', 'pct', 'rank', 'role', 'sales_90d',
  ]);

  const pB = await progress(UB);
  check(pB.role, 'clipper');
  check(pB.sales_90d, 2);
  check(pB.challenges.map((c) => [c.title, c.sales]).sort(), [['Reto de prueba', 2], ['Solo clippers', 2]]);

  // Sin regla para el siguiente rango: umbral null. Élite: sin siguiente.
  await db.query("update public.creators set rank = 'pro' where id = $1", [CA]);
  const pA2 = await progress(UA);
  check([pA2.next_rank, pA2.next_min_sales_90d, pA2.next_min_months_active], ['elite', null, null]);
  await db.query("update public.creators set rank = 'elite' where id = $1", [CA]);
  check((await progress(UA)).next_rank, null);
  await db.query("update public.creators set rank = 'novato' where id = $1", [CA]);

  // ── Histórico: retención 30 días, disponible, pagado, anulado y clawback ──
  const hA = await history(UA);
  check(hA.length, 12, 'por defecto 12 meses');
  check(Object.keys(hA[0]), ['month', 'sales', 'pending_cents', 'available_cents', 'paid_cents', 'voided_cents', 'clawback_cents'], 'sin user_id de compradores');
  check(hA[0].month, await mesDe(new Date(ahora).toISOString()), 'el primero es el mes en curso');
  const suma = (k) => hA.reduce((s, r) => s + r[k], 0);
  check(
    [suma('sales'), suma('pending_cents'), suma('available_cents'), suma('paid_cents'), suma('voided_cents'), suma('clawback_cents')],
    [3, 2500, 2500, 2500, 5000, 2500],
    'totales de A: solo su dinero',
  );
  const fila = (mes) => hA.find((r) => r.month === mes);
  const esp = {};
  const add = (mes, k, v) => {
    esp[mes] ??= { sales: 0, pending_cents: 0, available_cents: 0, paid_cents: 0, voided_cents: 0, clawback_cents: 0 };
    esp[mes][k] += v;
  };
  add(await mesDe(S1), 'sales', 1); add(await mesDe(S1), 'pending_cents', 2500);
  add(await mesDe(S2), 'sales', 1); add(await mesDe(S2), 'available_cents', 2500);
  add(await mesDe(S5), 'sales', 1); add(await mesDe(S5), 'paid_cents', 2500);
  add(await mesDe(S3), 'voided_cents', 2500); add(await mesDe(S3), 'clawback_cents', 2500);
  add(await mesDe(S4), 'voided_cents', 2500);
  for (const [mes, v] of Object.entries(esp)) {
    const { month, ...resto } = fila(mes);
    check(resto, v, `mes ${month}`);
  }

  const hB = await history(UB);
  check([hB.reduce((s, r) => s + r.pending_cents, 0), hB.reduce((s, r) => s + r.sales, 0)], [2500 + 1446, 2], 'B solo ve lo suyo (mensual: 25 % de 57,85 €)');

  check((await history(UA, 100)).length, 24, 'least(p_months, 24)');
  check((await history(UA, 0)).length, 1, 'mínimo 1 mes');
  check((await history(UA, null)).length, 12, 'null = 12');
  check((await history(UA, 3)).length, 3);

  // ── Tabla por periodo ──
  const mesRpc = await board(UA, 'mes');
  const mesViejo = await como(UA, () => rows('select * from public.creator_board()'));
  check(mesRpc, mesViejo, "'mes' = creator_board de 0025");
  check(Object.keys(mesRpc[0]), ['alias', 'sales', 'pos', 'is_me'], 'sin dinero ajeno');

  const reto = await board(UA, `reto:${R_TODOS}`);
  check(reto, [
    { alias: 'Beta', sales: 2, pos: 1, is_me: false },
    { alias: 'Alfa', sales: 1, pos: 2, is_me: true },
  ]);
  check(await board(UA, `reto:${R_CLIP}`), [], 'reto de otro rol: 0 filas');
  check(await board(UB, `reto:${R_CLIP}`), [{ alias: 'Beta', sales: 2, pos: 1, is_me: true }], 'en un reto con rol solo compiten los de ese rol');
  check(await board(UA, 'reto:00000000-0000-4000-8000-00000000ffff'), [], 'reto inexistente');
  check(await board(UA, "reto:x'; drop table x; --"), [], 'periodo con basura');
  check(await board(UA, 'semana'), [], 'periodo desconocido');
  check(await board(UA, null), [], 'periodo null');

  // ── Compatibilidad 1.0.7: las RPC de 0025 siguen igual ──
  const panel = await como(UA, () => scalar('select public.creator_panel()'));
  check([panel.alias, panel.code, panel.sales, panel.pending_cents, panel.available_cents, panel.clawback_cents], ['Alfa', 'AAA_TEST', 3, 2500, 2500, 2500]);
  check(await como(UX, () => scalar('select public.creator_panel()')), null);

  // ── Permisos ──
  for (const sql of [
    'select public.creator_progress()',
    'select * from public.creator_sales_history(12)',
    "select * from public.creator_board_period('mes')",
    'select count(*) from public.creator_challenges',
    'select count(*) from public.creator_rank_rules',
  ]) {
    await assert.rejects(como(null, () => db.query(sql)), /permission denied/, `anon: ${sql}`);
    checks++;
  }
  for (const sql of [
    'select count(*) from public.creator_challenges',
    'select count(*) from public.creator_rank_rules',
    "insert into public.creator_challenges(title, starts_at, ends_at, goal_sales) values ('x', now(), now() + interval '1 day', 1)",
    'select public.creator_sales_between(null, now(), now())',
    "update public.creators set role = 'clipper'",
  ]) {
    await assert.rejects(como(UA, () => db.query(sql)), /permission denied/, `authenticated: ${sql}`);
    checks++;
  }

  console.log(`OK · ${checks} comprobaciones (0025 real + 0046 ×2 en PGlite).`);
} finally {
  await db.close();
}
