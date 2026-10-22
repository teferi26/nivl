// Botón de desistimiento (Directiva (UE) 2023/2673). Sin red: dobles de Stripe y de la base.
import { ACUSE, desistimientoHandler, type DesistimientoDeps, type WithdrawalRecord } from './store-stripe-desistimiento.ts';
import { allowedOrigins } from './store-stripe-config.ts';
import type { SubscriptionRow } from './store-stripe.ts';

const UID = '00000000-0000-4000-8000-0000000000e1';
const NOW = Date.UTC(2026, 9, 21);
const equal = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
};

function fixture(o: { row?: SubscriptionRow | null; recent?: number; stripeDown?: boolean } = {}) {
  const saved: WithdrawalRecord[] = [];
  const subs: Record<string, { id: string; customer: string; start_date: number }> = {
    sub_AbCdEfGh12: { id: 'sub_AbCdEfGh12', customer: 'cus_1', start_date: Math.floor((NOW - 3 * 86400_000) / 1000) },
    sub_Viejo00001: { id: 'sub_Viejo00001', customer: 'cus_1', start_date: Math.floor((NOW - 40 * 86400_000) / 1000) },
  };
  const deps: DesistimientoDeps = {
    auth: t => Promise.resolve(t === 'jwt-user' ? { id: UID, email: 'Ana@Correo.es' } : null),
    repo: {
      subscription: () => Promise.resolve(o.row ?? null),
      userBySubscription: () => Promise.resolve(UID),
      recentByEmail: () => Promise.resolve(o.recent ?? 0),
      insert: r => { saved.push(r); return Promise.resolve({ id: 'wr_' + saved.length, requested_at: new Date(NOW).toISOString() }); },
    },
    stripe: {
      subscription: id => o.stripeDown ? Promise.reject(new Error('down')) : Promise.resolve(subs[id] ?? null),
      subscriptionByInvoiceNumber: n => Promise.resolve(n === 'ABCD1234-0001' ? subs.sub_AbCdEfGh12! : null),
      customerEmail: () => Promise.resolve('ana@correo.es'),
    },
    origins: allowedOrigins(n => n === 'NIVL_WEB_ORIGINS' ? 'https://nivl.app' : undefined),
    now: () => NOW,
  };
  return { deps, saved };
}
const post = (body: unknown, token = 'anon-key') => new Request('https://x/functions/v1/desistimiento', {
  method: 'POST', headers: { authorization: `Bearer ${token}`, origin: 'https://nivl.app' }, body: JSON.stringify(body),
});

Deno.test('desistimiento con sesión: registra uid, correo, suscripción y si está en plazo; acuse 202', async () => {
  const f = fixture({ row: { user_id: UID, status: 'active', plan: 'pro_mensual', provider: 'stripe', current_period_end: null,
    stripe_subscription_id: 'sub_AbCdEfGh12', stripe_customer_id: 'cus_1' } });
  const res = await desistimientoHandler(f.deps)(post({ motivo: 'No lo uso', email: 'otro@x.es' }, 'jwt-user'));
  equal(res.status, 202);
  equal(await res.json(), { ok: true, referencia: 'wr_1', recibido_at: new Date(NOW).toISOString(), message: ACUSE });
  equal(f.saved[0], { user_id: UID, email: 'ana@correo.es', source: 'cuenta', order_ref: null, stripe_subscription_id: 'sub_AbCdEfGh12',
    stripe_customer_id: 'cus_1', verified: true, within_period: true, reason: 'No lo uso' });
});

Deno.test('desistimiento por formulario: correo + pedido verificados contra Stripe (sub_ o número de factura)', async () => {
  const f = fixture();
  equal((await desistimientoHandler(f.deps)(post({ email: 'ANA@correo.es', pedido: 'sub_AbCdEfGh12' }))).status, 202);
  equal((await desistimientoHandler(f.deps)(post({ email: 'ana@correo.es', pedido: 'ABCD1234-0001' }))).status, 202);
  equal((await desistimientoHandler(f.deps)(post({ email: 'ana@correo.es', pedido: 'sub_Viejo00001' }))).status, 202);
  equal(f.saved.map(r => [r.source, r.verified, r.user_id, r.stripe_subscription_id, r.within_period]), [
    ['formulario', true, UID, 'sub_AbCdEfGh12', true], ['formulario', true, UID, 'sub_AbCdEfGh12', true],
    ['formulario', true, UID, 'sub_Viejo00001', false]]);
});

Deno.test('desistimiento por formulario: un correo ajeno recibe la MISMA respuesta y no se le asocia la suscripción', async () => {
  const f = fixture();
  const res = await desistimientoHandler(f.deps)(post({ email: 'intruso@x.es', pedido: 'sub_AbCdEfGh12' }));
  equal([res.status, (await res.json()).message], [202, ACUSE]);
  equal([f.saved[0]!.verified, f.saved[0]!.user_id, f.saved[0]!.stripe_subscription_id, f.saved[0]!.order_ref], [false, null, null, 'sub_AbCdEfGh12']);
});

Deno.test('desistimiento: Stripe caído no pierde la solicitud; datos inválidos → 400; abuso → 429', async () => {
  const down = fixture({ stripeDown: true });
  equal((await desistimientoHandler(down.deps)(post({ email: 'ana@correo.es', pedido: 'sub_AbCdEfGh12' }))).status, 202);
  equal(down.saved[0]!.verified, false);
  const f = fixture();
  equal((await desistimientoHandler(f.deps)(post({ email: 'no-es-correo', pedido: 'sub_AbCdEfGh12' }))).status, 400);
  equal((await desistimientoHandler(f.deps)(post({ email: 'ana@correo.es', pedido: "x' or 1=1" }))).status, 400);
  equal((await desistimientoHandler(fixture({ recent: 5 }).deps)(post({ email: 'ana@correo.es', pedido: 'sub_AbCdEfGh12' }))).status, 429);
  equal(f.saved.length, 0);
});
