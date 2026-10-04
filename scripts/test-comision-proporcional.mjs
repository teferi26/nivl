// Prueba SQL aislada, en memoria. Nunca se conecta a Supabase ni a una tienda.
// Uso: node scripts/test-comision-proporcional.mjs /ruta/a/@electric-sql/pglite/dist/index.js
//
// Carga un esquema previo mínimo, la 0025 y la 0027 REALES y la propuesta
// docs/payment-audit/propuestas/NNNN-borrador-comision-proporcional.sql (dos
// veces), y recorre apply_store_event con eventos sintéticos de RevenueCat.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (!process.argv[2]) throw new Error('Pasa la ruta de un módulo PGlite existente; esta prueba no instala nada.');
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const root = fileURLToPath(new URL('..', import.meta.url));
const PROPUESTA = 'docs/payment-audit/propuestas/NNNN-borrador-comision-proporcional.sql';

const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CREADOR = uid(1);
let checks = 0;
const check = (actual, expected, msg) => { assert.deepEqual(actual, expected, msg); checks++; };
const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];

let n = 0;
const evento = (user, o = {}) => {
  n++;
  return {
    id: `ev${n}`, type: 'INITIAL_PURCHASE', app_user_id: user, environment: 'PRODUCTION', store: 'APP_STORE',
    product_id: 'nivl_elite_anual', period_type: 'NORMAL', currency: 'EUR', price_in_purchased_currency: 299,
    price: 320, transaction_id: `tx${n}`, original_transaction_id: `orig-${user}`,
    purchased_at_ms: Date.now(), expiration_at_ms: Date.now() + 365 * 86_400_000, ...o,
  };
};
const aplicar = (ev) => scalar('select public.apply_store_event($1::jsonb)', [JSON.stringify(ev)]);
const ventas = (u) => scalar('select count(*)::int from store_sales where user_id = $1', [u]);
const comisiones = (u) => rows(
  `select k.kind, k.amount_cents, k.status, k.price_ratio::text as ratio, s.payment_number
   from commissions k join store_sales s on s.id = k.sale_id where s.user_id = $1 order by s.purchased_at, k.created_at`, [u]);
const nota = (id) => scalar('select note from store_events where id = $1', [id]);
let comprador = 100;
async function nuevoReferido() {
  const u = uid(++comprador);
  await db.query('insert into auth.users(id) values($1)', [u]);
  await db.query("insert into referrals(user_id, creator_id, source) select $1, id, 'manual' from creators where code = 'TEST'", [u]);
  return u;
}

try {
  // ── Esquema previo mínimo (lo que 0025/0027 dan por hecho de Supabase y de 0001-0024) ──
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key, email text, created_at timestamptz not null default now());
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.subscriptions(
      user_id uuid primary key references auth.users(id) on delete cascade,
      status text not null default 'none', plan text not null default 'cortesia', provider text not null default 'manual',
      current_period_end timestamptz, updated_at timestamptz not null default now());
    create table public.events(id bigserial primary key, user_id uuid, type text, payload jsonb, created_at timestamptz default now());
  `);
  await db.exec(await readFile(resolve(root, 'supabase/migrations/0025_creadores.sql'), 'utf8'));
  await db.exec(await readFile(resolve(root, 'supabase/migrations/0027_tienda.sql'), 'utf8'));
  const sql = await readFile(resolve(root, PROPUESTA), 'utf8');
  await db.exec(sql);
  await db.exec(sql); // re-ejecutable

  // Dentro del SBP (sin el tope del 35 % del Pro anual) y creador Élite al 50 %: tope 50 €.
  await db.exec(`
    update creator_settings set small_business_program = true;
    insert into auth.users(id) values ('${CREADOR}');
    insert into creators(user_id, code, alias, rank) values ('${CREADOR}', 'TEST', 'Prueba', 'elite');
  `);

  // Re-ejecutable: una sola columna, catálogo sin pisar un ajuste manual.
  check(await scalar("select count(*)::int from information_schema.columns where table_name='store_products' and column_name='list_price_cents'"), 1);
  check(await rows('select product_id, list_price_cents from store_products order by product_id'), [
    { product_id: 'nivl_elite_anual', list_price_cents: 29900 },
    { product_id: 'nivl_elite_fundador', list_price_cents: 24900 },
    { product_id: 'nivl_elite_mensual', list_price_cents: 2999 },
    { product_id: 'nivl_pro_anual', list_price_cents: 9999 },
    { product_id: 'nivl_pro_mensual', list_price_cents: 1299 },
  ]);
  await db.exec("update store_products set list_price_cents = 30000 where product_id = 'nivl_elite_anual'");
  await db.exec(sql);
  check(await scalar("select list_price_cents from store_products where product_id='nivl_elite_anual'"), 30000, 'no pisa un ajuste');
  await db.exec("update store_products set list_price_cents = 29900 where product_id = 'nivl_elite_anual'");
  // Huella.
  check(await scalar(`select coalesce(obj_description(to_regprocedure('public.record_sale_proporcional(uuid,text,text,text,text,integer,text,integer,timestamptz,numeric)'),'pg_proc') like '%nivl:comision-proporcional%', false)
    and coalesce(obj_description(to_regprocedure('public.apply_store_event(jsonb)'),'pg_proc') like '%nivl:comision-proporcional%', false)`), true);

  // 1. Precio null (offer code gratis sin precio) → sin venta ni comisión, con nota.
  let u = await nuevoReferido();
  let ev = evento(u, { price_in_purchased_currency: null, price: null, offer_code: 'free_month' });
  check(await aplicar(ev), { ok: true });
  check(await ventas(u), 0); check(await comisiones(u), []);
  check(await nota(ev.id), 'venta sin precio: no se registra');
  check(await scalar('select plan from subscriptions where user_id=$1', [u]), 'elite_anual', 'el acceso sí se da');
  // Moneda no EUR con price_in_purchased_currency null pero price USD presente: tampoco.
  ev = evento(u, { currency: 'USD', price_in_purchased_currency: null, price: 320 });
  await aplicar(ev);
  check(await ventas(u), 0); check(await nota(ev.id), 'venta sin precio: no se registra');
  // El primer cobro real posterior es payment_number 1 con la comisión entera.
  await aplicar(evento(u, { type: 'RENEWAL' }));
  check(await comisiones(u), [{ kind: 'primer_pago', amount_cents: 5000, status: 'pendiente', ratio: '1.0000', payment_number: 1 }]);

  // 2. Precio 0 (oferta gratis) → sin venta.
  u = await nuevoReferido();
  await aplicar(evento(u, { price_in_purchased_currency: 0, price: 0 }));
  check(await ventas(u), 0);

  // 3. Anual a precio completo → comisión entera.
  u = await nuevoReferido();
  await aplicar(evento(u));
  check(await comisiones(u), [{ kind: 'primer_pago', amount_cents: 5000, status: 'pendiente', ratio: '1.0000', payment_number: 1 }]);

  // 4. Anual con OFERTA al 50 % en EUR (Élite 149,50 € y Pro 49,995 €) → la mitad.
  u = await nuevoReferido();
  await aplicar(evento(u, { price_in_purchased_currency: 149.5, offer_code: 'winback_50' }));
  check(await comisiones(u), [{ kind: 'primer_pago', amount_cents: 2500, status: 'pendiente', ratio: '0.5000', payment_number: 1 }]);
  const uPro = await nuevoReferido();
  await aplicar(evento(uPro, { product_id: 'nivl_pro_anual', price_in_purchased_currency: 49.995, period_type: 'INTRO' }));
  check((await comisiones(uPro))[0].amount_cents, 2500);
  // Oferta PROMOTIONAL al 50 % también escala.
  const uPromo = await nuevoReferido();
  await aplicar(evento(uPromo, { price_in_purchased_currency: 149.5, period_type: 'PROMOTIONAL' }));
  check((await comisiones(uPromo))[0].amount_cents, 2500);
  // Sin oferta, un precio en EUR por debajo del catálogo NO recorta (factor 1).
  const uSin = await nuevoReferido();
  await aplicar(evento(uSin, { price_in_purchased_currency: 149.5 }));
  check((await comisiones(uSin))[0], { kind: 'primer_pago', amount_cents: 5000, status: 'pendiente', ratio: '1.0000', payment_number: 1 });
  // Pagar MÁS que el catálogo con oferta nunca sube la comisión (tope 1).
  const uMas = await nuevoReferido();
  await aplicar(evento(uMas, { price_in_purchased_currency: 350, offer_code: 'raro' }));
  check((await comisiones(uMas))[0], { kind: 'primer_pago', amount_cents: 5000, status: 'pendiente', ratio: '1.0000', payment_number: 1 });

  // 5. Mensual: % del neto de cada mes, sin factor encima (no se escala dos veces).
  u = await nuevoReferido();
  const esperado = (eur) => scalar('select round(public.net_cents_eur($1::numeric) * 50::numeric / 100)::int', [eur]);
  await aplicar(evento(u, { product_id: 'nivl_pro_mensual', price_in_purchased_currency: 12.99 }));
  const uDesc = await nuevoReferido();
  await aplicar(evento(uDesc, { product_id: 'nivl_pro_mensual', price_in_purchased_currency: 6.495, period_type: 'INTRO' }));
  const completo = await comisiones(u); const rebajado = await comisiones(uDesc);
  check(completo, [{ kind: 'mensual', amount_cents: await esperado(12.99), status: 'pendiente', ratio: null, payment_number: 1 }]);
  check(rebajado, [{ kind: 'mensual', amount_cents: await esperado(6.495), status: 'pendiente', ratio: null, payment_number: 1 }]);
  check(Math.abs(rebajado[0].amount_cents * 2 - completo[0].amount_cents) <= 1, true, 'mitad, no un cuarto');
  // Los meses siguientes siguen sumando hasta el tope de 50 €.
  for (let i = 0; i < 14; i++) await aplicar(evento(u, { type: 'RENEWAL', product_id: 'nivl_pro_mensual', price_in_purchased_currency: 12.99 }));
  check(await scalar("select sum(k.amount_cents)::int from commissions k join store_sales s on s.id=k.sale_id where s.user_id=$1", [u]), 5000);

  // 6. Renovación anual: sin comisión (renewal_pct = 0).
  u = await nuevoReferido();
  await aplicar(evento(u));
  await aplicar(evento(u, { type: 'RENEWAL' }));
  check(await ventas(u), 2);
  check((await comisiones(u)).length, 1);
  // Con renewal_pct > 0, la renovación también se escala por lo pagado.
  await db.exec('update creator_settings set renewal_pct = 10');
  await aplicar(evento(u, { type: 'RENEWAL', price_in_purchased_currency: 149.5, offer_code: 'promo_50' }));
  check((await comisiones(u))[1], { kind: 'renovacion', amount_cents: 500, status: 'pendiente', ratio: '0.5000', payment_number: 3 });
  await db.exec('update creator_settings set renewal_pct = 0');

  // 7. Reembolso de una venta proporcional → se anula lo proporcional, sin más.
  u = await nuevoReferido();
  ev = evento(u, { price_in_purchased_currency: 149.5, offer_code: 'winback_50' });
  await aplicar(ev);
  await aplicar(evento(u, { type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT', transaction_id: ev.transaction_id, price_in_purchased_currency: -149.5 }));
  check(await comisiones(u), [{ kind: 'primer_pago', amount_cents: 2500, status: 'anulada', ratio: '0.5000', payment_number: 1 }]);
  check(await scalar("select status from subscriptions where user_id=$1", [u]), 'canceled');
  // Una compra completa después vuelve a tener el tope entero libre (lo anulado no cuenta).
  await aplicar(evento(u, { original_transaction_id: `orig2-${u}` }));
  check((await comisiones(u))[1].amount_cents, 5000);

  // 8. Sandbox nunca crea venta (ni Google sandbox, ni con precio completo).
  u = await nuevoReferido();
  await aplicar(evento(u, { environment: 'SANDBOX' }));
  await aplicar(evento(u, { environment: 'SANDBOX', store: 'PLAY_STORE' }));
  check(await ventas(u), 0);
  check(await scalar("select status from subscriptions where user_id=$1", [u]), 'active', 'el sandbox sí da acceso');

  // 9. Idempotencia: el mismo id de evento dos veces, y el mismo transaction_id con otro id.
  u = await nuevoReferido();
  ev = evento(u, { price_in_purchased_currency: 149.5 });
  await aplicar(ev);
  check(await aplicar(ev), { ok: true, duplicate: true });
  await aplicar({ ...ev, id: `${ev.id}-reintento` });
  check(await ventas(u), 1); check((await comisiones(u)).length, 1);

  // 10. record_sale con la firma de 0025 sigue igual (envoltorio, factor 1).
  u = await nuevoReferido();
  await db.query("select public.record_sale($1, 'apple', 'legacy-tx', 'legacy-orig', 'nivl_elite_anual', 14950, 'EUR', 100, now())", [u]);
  check((await comisiones(u))[0].amount_cents, 5000, 'la firma vieja no cambia de resultado');

  // 11. Moneda no EUR (decisión del Chat 2: no se recorta por precio regional).
  // USD sin oferta, por debajo del equivalente del catálogo → comisión completa, sin nota.
  u = await nuevoReferido();
  ev = evento(u, { currency: 'USD', price_in_purchased_currency: 160.75, price: 160.75 });
  await aplicar(ev);
  check((await comisiones(u))[0], { kind: 'primer_pago', amount_cents: 5000, status: 'pendiente', ratio: '1.0000', payment_number: 1 });
  check(await nota(ev.id), null);
  // Oferta en USD: sin precio de referencia del país → completa y con nota.
  u = await nuevoReferido();
  ev = evento(u, { currency: 'USD', price_in_purchased_currency: 160.75, price: 160.75, offer_code: 'winback_50' });
  await aplicar(ev);
  check((await comisiones(u))[0].amount_cents, 5000);
  check(await nota(ev.id), 'oferta sin referencia: comisión completa');

  // 12. Oferta en EUR sobre un producto sin precio de catálogo → completa y con nota.
  await db.exec("update store_products set list_price_cents = null where product_id = 'nivl_elite_fundador'");
  u = await nuevoReferido();
  ev = evento(u, { product_id: 'nivl_elite_fundador', price_in_purchased_currency: 100, offer_code: 'x' });
  await aplicar(ev);
  check((await comisiones(u))[0].amount_cents, 5000);
  check(await nota(ev.id), 'oferta sin referencia: comisión completa');

  // 13. Permisos: ni anon ni authenticated; service_role sí.
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(db.query("select public.record_sale_proporcional(null,'apple','x','x','nivl_pro_anual',1,'EUR',1,now(),1)"), /permission denied/); checks++;
      await assert.rejects(db.query("select public.record_sale(null,'apple','x','x','nivl_pro_anual',1,'EUR',1,now())"), /permission denied/); checks++;
      await assert.rejects(db.query("select public.apply_store_event('{}'::jsonb)"), /permission denied/); checks++;
    } finally { await db.exec('reset role'); }
  }
  for (const fn of ['public.record_sale_proporcional(uuid,text,text,text,text,integer,text,integer,timestamptz,numeric)',
    'public.record_sale(uuid,text,text,text,text,integer,text,integer,timestamptz)', 'public.apply_store_event(jsonb)']) {
    check(await scalar('select has_function_privilege($1, $2, $3)', ['service_role', fn, 'EXECUTE']), true, fn);
  }

  console.log(JSON.stringify({ ok: true, checks, database: 'PGlite in memory', productionTouched: false }));
} finally { await db.close(); }
