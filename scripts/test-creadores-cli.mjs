// Prueba de las piezas puras de scripts/creadores.mjs, en memoria. Nunca se
// conecta a Supabase: importa el script (que no arranca la CLI al importarse)
// y lanza su SQL contra PGlite con la 0025 y la 0046 reales y datos sintéticos.
// Uso: node scripts/test-creadores-cli.mjs /ruta/a/@electric-sql/pglite/dist/index.js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  SQL_LISTA,
  diaMadrid,
  elegirSolo,
  errorFechasReto,
  errorMesPago,
  fechaReal,
  fotoLiquidacion,
  leerResultado,
  listaCodigos,
  proponerRangos,
  racha,
  sqlCuentaParaVincular,
  sqlDetalleLiquidacion,
  sqlFotoDescuentos,
  sqlInforme,
  sqlLiquidarSiIgual,
} from './creadores.mjs';

if (!process.argv[2]) throw new Error('Pasa la ruta de un módulo PGlite existente; esta prueba no instala nada.');
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const root = fileURLToPath(new URL('..', import.meta.url));

let checks = 0;
const check = (actual, expected, msg) => {
  assert.deepEqual(actual, expected, msg);
  checks++;
};
const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const DIA = 86_400_000;
const hace = (ms) => new Date(Date.now() - ms).toISOString();
let txn = 0;
const venta = (user, product, at) => {
  txn++;
  return db.query(
    "select public.record_sale($1::uuid, 'apple', $2, $3, $4, 9999, 'EUR', 5785, $5::timestamptz)",
    [user, `t${txn}`, `o${txn}`, product, at],
  );
};

try {
  // ── Puras ──
  check(fechaReal('2026-02-28'), true);
  check(fechaReal('2026-02-30'), false, 'día que no existe');
  check(fechaReal('2026-2-3'), false);
  check(errorFechasReto('2026-10-01', '2026-10-31'), null);
  check(errorFechasReto('2026-10-05', '2026-10-05'), null, 'reto de un día');
  assert.match(errorFechasReto('2026-10-05', '2026-10-01'), /antes de empezar/); checks++;
  assert.match(errorFechasReto('2026-13-01', '2026-10-01'), /inicio no válida/); checks++;
  assert.match(errorFechasReto('2026-10-01', '2026-04-31'), /fin no válida/); checks++;
  check(errorMesPago('2026-09', '2026-10'), null);
  check(errorMesPago('2026-10', '2026-10'), null);
  assert.match(errorMesPago('2026-11', '2026-10'), /futuro/); checks++;
  assert.match(errorMesPago('2026-9', '2026-10'), /AAAA-MM/); checks++;
  check(listaCodigos(' aaa_test, BBB_TEST ,aaa_test'), ['AAA_TEST', 'BBB_TEST']);
  assert.match(listaCodigos('AAA_TEST,x'), /no válido/); checks++;
  assert.match(listaCodigos(','), /Falta/); checks++;
  check(racha(['2026-09', '2026-08', '2026-06'], '2026-10'), 2, 'el mes en curso sin venta no rompe');
  check(racha(['2026-10', '2026-09'], '2026-10'), 2);

  const reglas = [{ rank: 'pro', min_sales_90d: 5, min_months_active: 0 }, { rank: 'elite', min_sales_90d: 20, min_months_active: 0 }];
  const props = proponerRangos(
    [
      { code: 'AAA_TEST', alias: 'Alfa', rank: 'novato', ventas90: 6, meses: '' },
      { code: 'BBB_TEST', alias: 'Beta', rank: 'elite', ventas90: 1, meses: '' }, // subido a mano
      { code: 'CCC_TEST', alias: 'Gama', rank: 'pro', ventas90: 7, meses: '' },
    ],
    reglas,
    '2026-10',
  );
  check(props.map((p) => [p.code, p.propuesto, p.cambio]), [['AAA_TEST', 'pro', 'sube'], ['BBB_TEST', 'novato', 'baja']]);
  check(elegirSolo(props, null).elegidas.length, 2, 'sin --solo, todas');
  check(elegirSolo(props, ['AAA_TEST']), { elegidas: [props[0]], fuera: [] }, '--solo deja fuera la bajada');
  check(elegirSolo(props, ['AAA_TEST', 'ZZZ_TEST']).fuera, ['ZZZ_TEST'], 'código sin propuesta');

  // ── Esquema (mínimo previo + 0025 y 0046 reales) ──
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key, email text, created_at timestamptz not null default now());
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.subscriptions(user_id uuid primary key, plan text not null default 'cortesia', status text not null default 'none');
    create table public.events(id bigserial primary key, user_id uuid, type text, payload jsonb, created_at timestamptz default now());
  `);
  await db.exec(await readFile(resolve(root, 'supabase/migrations/0025_creadores.sql'), 'utf8'));
  await db.exec(await readFile(resolve(root, 'supabase/migrations/0046_programa_creadores.sql'), 'utf8'));

  const UA = uid(1);
  const UB = uid(2);
  const BUY = (n) => uid(100 + n);
  await db.query("insert into auth.users(id, email) values ($1, 'a@example.test'), ($2, 'b@example.test')", [UA, UB]);
  for (let i = 1; i <= 6; i++) await db.query('insert into auth.users(id) values ($1)', [BUY(i)]);
  const [{ id: CA }] = await rows(
    "insert into public.creators(user_id, code, alias, role) values ($1, 'AAA_TEST', 'Alfa', 'clipper') returning id::text",
    [UA],
  );
  await db.query("insert into public.creators(code, alias) values ('BBB_TEST', 'Beta')");
  for (let i = 1; i <= 6; i++) await db.query("insert into public.referrals(user_id, creator_id, source) values ($1, $2, 'manual')", [BUY(i), CA]);

  // ── lista e informe llevan el rol ──
  const l = await rows(SQL_LISTA);
  check(l.map((r) => [r.code, r.rol]), [['AAA_TEST', 'clipper'], ['BBB_TEST', 'creador']]);
  const inf = await rows(sqlInforme('2026-10'));
  check(Object.keys(inf[0]).slice(0, 4), ['code', 'alias', 'rol', 'rank'], 'informe (y su CSV) con rol');

  // ── vincular: la comprobación previa ve la cuenta y a qué creador está ──
  check(await rows(sqlCuentaParaVincular('nadie@example.test')), [], 'cuenta que no existe');
  check(await rows(sqlCuentaParaVincular(' A@Example.test ')), [{ id: UA, otro: 'AAA_TEST' }], 'ya vinculada a AAA_TEST');
  check(await rows(sqlCuentaParaVincular('b@example.test')), [{ id: UB, otro: null }], 'libre');

  // ── reto alta: un reto de un día cabe en el CHECK ends_at > starts_at ──
  await db.query(
    `insert into public.creator_challenges(title, starts_at, ends_at, goal_sales)
     values ('Un día', ${diaMadrid('2026-10-05')}, ${diaMadrid('2026-10-05', { masUno: true })}, 1)`,
  );
  check(await scalar("select (ends_at - starts_at)::text from public.creator_challenges where title = 'Un día'"), '1 day');

  // ── liquidar: lo apuntado es exactamente lo de la vista previa ──
  await venta(BUY(1), 'nivl_elite_anual', hace(60 * DIA)); // disponible
  await venta(BUY(2), 'nivl_pro_anual', hace(45 * DIA)); // disponible
  await venta(BUY(3), 'nivl_pro_anual', hace(5 * DIA)); // en retención
  const fotoDe = async () => fotoLiquidacion(await rows(sqlDetalleLiquidacion(CA)), (await rows(sqlFotoDescuentos(CA)))[0]);
  const pagos = () => scalar("select count(*)::int from public.creator_payouts where kind = 'comisiones'");

  const f1 = await fotoDe();
  check([f1.n, f1.disponible, f1.descuento, f1.aPagar], [2, 5000, 0, 5000]);

  // 1) Llega un reembolso de una disponible entre la vista previa y la confirmación → aborta.
  await db.query("select public.record_refund('t2')");
  check(leerResultado(await rows(sqlLiquidarSiIgual(CA, f1, null))), null, 'reembolso entre medias: no apunta');
  check(await pagos(), 0, 'nada apuntado');

  // 2) Madura una comisión entre medias → aborta.
  const f2 = await fotoDe();
  check([f2.n, f2.aPagar], [1, 2500]);
  await db.query(
    "update public.commissions set available_at = now() - interval '1 minute' where sale_id = (select id from public.store_sales where transaction_id = 't3')",
  );
  check(leerResultado(await rows(sqlLiquidarSiIgual(CA, f2, null))), null, 'maduró una: no apunta');
  check(await pagos(), 0);

  // 3) Sin cambios → apunta exactamente la cifra de la vista previa.
  const f3 = await fotoDe();
  check(f3.aPagar, 5000);
  const r3 = leerResultado(await rows(sqlLiquidarSiIgual(CA, f3, "Nota con 'comillas'")));
  check([r3.ok, Number(r3.amount)], [true, f3.aPagar], 'apuntado = vista previa');
  check(
    await rows("select amount_cents, period, note from public.creator_payouts where kind = 'comisiones'"),
    [{ amount_cents: 5000, period: await scalar("select to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM')"), note: "Nota con 'comillas'" }],
  );

  // 4) Repetir con la foto vieja (doble Enter, dos terminales) → no paga dos veces.
  check(leerResultado(await rows(sqlLiquidarSiIgual(CA, f3, null))), null, 'foto vieja tras pagar: no apunta');
  check(await pagos(), 1);

  // 5) Descuento (clawback) que aparece entre medias → aborta; con la foto nueva, descuenta.
  await venta(BUY(4), 'nivl_elite_anual', hace(40 * DIA));
  const f5 = await fotoDe();
  check([f5.disponible, f5.descuento], [2500, 0]);
  await db.query("select public.record_refund('t1')"); // ya pagada → clawback de 25 €
  check(leerResultado(await rows(sqlLiquidarSiIgual(CA, f5, null))), null, 'clawback entre medias: no apunta');
  const f6 = await fotoDe();
  check([f6.disponible, f6.descuento, f6.nDescuentos, f6.aPagar], [2500, 2500, 1, 0], 'A pagar 0: el script ni pregunta');
  check(await pagos(), 1);

  // 6) Con varias comisiones y un descuento, el orden de los ids casa entre JS y Postgres.
  await venta(BUY(5), 'nivl_elite_anual', hace(50 * DIA));
  await venta(BUY(6), 'nivl_elite_anual', hace(55 * DIA));
  const f7 = await fotoDe();
  check([f7.n, f7.disponible, f7.descuento, f7.aPagar], [3, 7500, 2500, 5000]);
  const r7 = leerResultado(await rows(sqlLiquidarSiIgual(CA, f7, null)));
  check([r7.ok, Number(r7.amount), Number(r7.clawback)], [true, 5000, 2500]);
  check(await scalar('select count(*)::int from public.commissions where clawback and clawback_settled_at is null'), 0);

  // ids raros en la foto → la pieza pura se niega antes de montar SQL.
  assert.throws(() => fotoLiquidacion([{ id: "x'; drop", amount_cents: 1 }], { cents: 0, n: 0, ids: '' })); checks++;

  console.log(`OK · ${checks} comprobaciones (creadores.mjs: puras + SQL en PGlite con 0025 y 0046 reales).`);
} finally {
  await db.close();
}
