// El cobro por modos (0140) en el servidor: el coach no atiende un mundo que
// no se ha pagado, y lo dice con el mismo 402 que el resto del candado.
import { deepEqual, equal, ok } from 'node:assert/strict';
import { instalar, peticion, turnoTexto } from './sec_coach_fake_test.ts';
import { planDeStripe, PRODUCTOS_MODO } from './productos-modo.ts';
import { parseCustomerInfo, normalizeStoreEvent } from './store-reconcile.ts';
import { stripeWebhookHandler, type StripeRepo, type SubscriptionRow } from './store-stripe.ts';

const { handler } = await import('../coach/handler.ts');
const LLAMADA = () => turnoTexto('Hecho.');

async function turno(modos: string[] | 'fallo', cabeceras: Record<string, string> = {}) {
  const fake = instalar({
    proveedor: LLAMADA,
    rpc: {
      ai_modos: () => {
        if (modos === 'fallo') throw new Error('sin base');
        return modos;
      },
    },
  });
  try {
    const r = await handler(peticion({ kind: 'chat', message: 'hola' }, cabeceras));
    const texto = await r.text();
    return { status: r.status, texto, puerta: fake.llamadas.filter((l) => l.url.pathname.endsWith('/rpc/ai_begin_turn')).length, modos: fake.llamadas.filter((l) => l.url.pathname.endsWith('/rpc/ai_modos')).length };
  } finally {
    fake.restaurar();
  }
}

Deno.test('uno: el coach de su modo atiende', async () => {
  const r = await turno(['iron'], { 'x-nivl-modo': 'iron' });
  equal(r.status, 200);
  equal(r.puerta, 1);
});

Deno.test('un modo no pagado: el mismo 402, sin tomar turno ni llamar al modelo', async () => {
  const r = await turno(['iron'], { 'x-nivl-modo': 'focus' });
  equal(r.status, 402);
  const body = JSON.parse(r.texto);
  equal(body.reason, 'sin_suscripcion');
  equal(body.modo, 'focus');
  equal(r.puerta, 0);
});

Deno.test('todos, y Pro o Élite antiguos: cualquier modo', async () => {
  for (const modo of ['iron', 'focus', 'work', 'founder']) {
    equal((await turno(['iron', 'focus', 'work', 'founder'], { 'x-nivl-modo': modo })).status, 200);
  }
});

Deno.test('caducado: sin modos, 402', async () => {
  equal((await turno([], { 'x-nivl-modo': 'iron' })).status, 402);
});

Deno.test('cliente antiguo o ritual sin cabecera: el coach General, sin preguntar por modos', async () => {
  const r = await turno(['iron']);
  equal(r.status, 200);
  equal(r.modos, 0);
});

Deno.test('sin poder comprobarlo, cerrado', async () => {
  const r = await turno('fallo', { 'x-nivl-modo': 'iron' });
  equal(r.status, 503);
  equal(r.puerta, 0);
});

Deno.test('RevenueCat: los diez productos cuentan y conservan el producto', () => {
  const ms = Date.parse('2026-11-08T12:00:00Z');
  const raw = { store: 'app_store', expires_date: '2027-11-08T12:00:00Z', is_sandbox: false, period_type: 'trial', refunded_at: null };
  const subs = Object.fromEntries(PRODUCTOS_MODO.map((p) => [p, raw]));
  const snap = parseCustomerInfo(
    { request_date_ms: ms, subscriber: { subscriptions: subs } },
    { user_id: '00000000-0000-4000-8000-000000000001', revision: 1 },
    ms,
  );
  deepEqual(snap.subscriptions.map((s) => s.product_id).sort(), [...PRODUCTOS_MODO].sort());
  equal(snap.subscriptions[0]!.trial, true);
  equal(normalizeStoreEvent({ product_id: 'nivl_iron_anual:anual' }).product_id, 'nivl_iron_anual');
});

Deno.test('Stripe: el lookup_key dice el plan; sin él, lo de siempre', () => {
  equal(planDeStripe('nivl_todos_anual'), 'todos_anual');
  equal(planDeStripe('price_antiguo'), null);
  equal(planDeStripe(null), null);
});

function repo(row: SubscriptionRow | null) {
  const estado = { row, escrito: null as Record<string, unknown> | null };
  const r: StripeRepo = {
    byUser: () => Promise.resolve(estado.row),
    bySubscription: () => Promise.resolve(estado.row),
    insert: (x) => { estado.escrito = x; return Promise.resolve(true); },
    update: (_u, _e, p) => { estado.escrito = p; return Promise.resolve(true); },
  };
  return { estado, r };
}
const firma = { 'stripe-signature': 't=1,v1=x' };
const evento = (type: string, object: Record<string, unknown>) => ({ id: 'evt', type, data: { object } });
const USUARIO = '00000000-0000-4000-8000-000000000001';

Deno.test('Stripe: un checkout de modo escribe su plan', async () => {
  const { estado, r } = repo(null);
  const h = stripeWebhookHandler({
    verify: () => Promise.resolve(evento('checkout.session.completed', { client_reference_id: USUARIO, subscription: 'sub_1', customer: 'cus' })),
    retrieve: () => Promise.resolve({ id: 'sub_1', status: 'active', customer: 'cus', current_period_end: 1893456000, lookup_key: 'nivl_focus_mensual' }),
    repo: r,
  });
  equal((await h(new Request('http://x', { method: 'POST', body: '{}', headers: firma }))).status, 200);
  equal(estado.escrito!.plan, 'focus_mensual');
});

Deno.test('Stripe: un enlace antiguo sigue siendo Pro heredado', async () => {
  const { estado, r } = repo(null);
  const h = stripeWebhookHandler({
    verify: () => Promise.resolve(evento('checkout.session.completed', { client_reference_id: USUARIO, subscription: 'sub_1', customer: 'cus' })),
    retrieve: () => Promise.resolve({ id: 'sub_1', status: 'active', customer: 'cus', current_period_end: 1893456000 }),
    repo: r,
  });
  await h(new Request('http://x', { method: 'POST', body: '{}', headers: firma }));
  equal(estado.escrito!.plan, 'mensual');
  ok(PRODUCTOS_MODO.length === 10);
});
