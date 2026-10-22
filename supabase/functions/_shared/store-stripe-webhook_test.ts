// Stripe web (2026-10-21, docs/payment-audit/STRIPE-WEB.md): webhook con planes de PRECIOS.md,
// idempotencia por event.id, orden, fila protegida (P1-3), prueba sustituida, ventas y reembolsos.
// Sin red: dobles de Stripe y de la base.
import {
  stripeWebhookHandler, type StripeDeps, type StripeEventRecord, type StripeSale, type StripeSubscriptionState,
  type SubscriptionRow,
} from './store-stripe.ts';
import { productForPrice, stripeTestPolicy } from './store-stripe-config.ts';

const UID = '00000000-0000-4000-8000-0000000000b1';
const QA = '00000000-0000-4000-8000-0000000000c1';
const equal = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
};
const ENV: Record<string, string> = {
  STRIPE_PRICE_NIVL_PRO_MENSUAL: 'price_ProMensual01',
  STRIPE_PRICE_NIVL_PRO_ANUAL: 'price_ProAnual0001',
  STRIPE_PRICE_NIVL_ELITE_MENSUAL: 'price_EliteMens001',
  STRIPE_PRICE_NIVL_ELITE_ANUAL: 'price_EliteAnual01',
  STRIPE_PRICE_NIVL_ELITE_FUNDADOR: 'price_EliteFund001',
};
const env = (name: string) => ENV[name];
const future = () => Math.floor(Date.now() / 1000) + 30 * 86400;

function fixture(rows: SubscriptionRow[], subs: Record<string, Partial<StripeSubscriptionState>>, options: { testAccess?: string } = {}) {
  const table = new Map(rows.map(r => [r.user_id, { ...r }]));
  const events = new Map<string, StripeEventRecord>();
  const sales: StripeSale[] = [];
  const refunds: string[] = [];
  const canceled: string[] = [];
  const deps: StripeDeps = {
    verify: body => Promise.resolve(JSON.parse(body)),
    retrieve: id => Promise.resolve({
      id, status: 'active', customer: 'cus_1', current_period_end: future(), price_id: 'price_ProMensual01',
      uid: UID, livemode: true, ...subs[id],
    }),
    env,
    testAccess: stripeTestPolicy(n => n === 'STRIPE_TEST_ACCESS' ? options.testAccess : undefined),
    cancel: id => { canceled.push(id); return Promise.resolve(); },
    repo: {
      byUser: id => Promise.resolve(table.get(id) ?? null),
      bySubscription: id => Promise.resolve([...table.values()].find(r => r.stripe_subscription_id === id) ?? null),
      insert: row => {
        if (table.has(row.user_id as string)) return Promise.resolve(false);
        table.set(row.user_id as string, row as unknown as SubscriptionRow); return Promise.resolve(true);
      },
      update: (id, expect, patch) => {
        const row = table.get(id);
        if (!row || row.provider !== expect.provider || row.plan !== expect.plan || row.stripe_subscription_id !== expect.stripe_subscription_id) return Promise.resolve(false);
        table.set(id, { ...row, ...patch } as SubscriptionRow); return Promise.resolve(true);
      },
      eventSeen: id => Promise.resolve(events.has(id)),
      recordEvent: e => { events.set(e.id, e); return Promise.resolve(); },
      // record_sale es idempotente por transaction_id (0025).
      recordSale: s => { if (!sales.some(x => x.transaction_id === s.transaction_id)) sales.push(s); return Promise.resolve(); },
      recordRefund: txn => { refunds.push(txn); return Promise.resolve(); },
    },
  };
  return { deps, table, events, sales, refunds, canceled };
}
const req = (event: unknown) => new Request('https://local.invalid/stripe-webhook', {
  method: 'POST', headers: { 'stripe-signature': 'valid' }, body: JSON.stringify(event),
});
const checkout = (id: string, sub = 'sub_1', livemode = true, ref = UID) => ({
  id, type: 'checkout.session.completed', livemode,
  data: { object: { client_reference_id: ref, subscription: sub, customer: 'cus_1', mode: 'subscription' } },
});
const invoice = (id: string, inv: string, o: Record<string, unknown> = {}, livemode = true) => ({
  id, type: 'invoice.paid', livemode,
  data: { object: { id: inv, subscription: 'sub_1', customer: 'cus_1', amount_paid: 1299, tax: 225, currency: 'eur',
    livemode, status_transitions: { paid_at: 1_800_000_000 }, ...o } },
});
const row = (o: Partial<SubscriptionRow>): SubscriptionRow => ({
  user_id: UID, status: 'active', plan: 'pro_anual', provider: 'apple',
  current_period_end: new Date(Date.now() + 86400_000).toISOString(), stripe_subscription_id: null, ...o,
});

Deno.test('planes: cada price id configurado da su plan de PRECIOS.md; uno desconocido mantiene el heredado', async () => {
  equal(productForPrice(env, 'price_EliteFund001'), 'nivl_elite_fundador');
  equal(productForPrice(env, 'price_otro'), null);
  for (const [price, plan] of [['price_ProMensual01', 'pro_mensual'], ['price_ProAnual0001', 'pro_anual'],
    ['price_EliteMens001', 'elite_mensual'], ['price_EliteAnual01', 'elite_anual'], ['price_EliteFund001', 'elite_fundador']]) {
    const f = fixture([], { sub_1: { price_id: price } });
    equal((await stripeWebhookHandler(f.deps)(req(checkout('evt_' + plan)))).status, 200);
    equal([f.table.get(UID)!.plan, f.table.get(UID)!.provider, f.table.get(UID)!.status], [plan, 'stripe', 'active']);
  }
  // Suscripción heredada (Payment Link antiguo, precio fuera del catálogo): sigue siendo Pro 'mensual'.
  const legacy = fixture([], { sub_1: { price_id: 'price_legacy99', uid: null } });
  await stripeWebhookHandler(legacy.deps)(req(checkout('evt_l')));
  equal(legacy.table.get(UID)!.plan, 'mensual');
  // …y una renovación heredada conserva el plan que tenía ('anual').
  const old = fixture([row({ provider: 'stripe', plan: 'anual', stripe_subscription_id: 'sub_1' })], { sub_1: { price_id: 'price_legacy99', uid: null } });
  await stripeWebhookHandler(old.deps)(req(invoice('evt_r', 'in_1')));
  equal(old.table.get(UID)!.plan, 'anual');
  equal(old.sales, []); // precio fuera del catálogo: sin venta
});

Deno.test('idempotencia: el mismo event.id dos veces solo se aplica una (ni dos ventas ni dos notas)', async () => {
  const f = fixture([], {});
  const handler = stripeWebhookHandler(f.deps);
  equal(await (await handler(req(invoice('evt_1', 'in_1')))).json(), { received: true, sale: true });
  equal(await (await handler(req(invoice('evt_1', 'in_1')))).json(), { received: true, duplicate: true });
  equal(f.sales.length, 1);
  equal(f.events.get('evt_1')!.note, 'aplicado; venta registrada');
  // Otro evento con la misma factura (reenvío manual desde el panel): record_sale no duplica.
  await handler(req(invoice('evt_2', 'in_1')));
  equal(f.sales.length, 1);
});

Deno.test('orden: invoice.paid antes que checkout.session.completed concede igual (uid de metadata) y el checkout tardío no cambia nada', async () => {
  const f = fixture([], { sub_1: { price_id: 'price_EliteAnual01' } });
  const handler = stripeWebhookHandler(f.deps);
  equal((await handler(req(invoice('evt_a', 'in_1', { amount_paid: 29900, tax: 5189 })))).status, 200);
  equal([f.table.get(UID)!.plan, f.table.get(UID)!.stripe_subscription_id], ['elite_anual', 'sub_1']);
  equal(f.sales.map(s => [s.product_id, s.net_cents, s.price_cents, s.currency]), [['nivl_elite_anual', 24711, 29900, 'EUR']]);
  equal((await handler(req(checkout('evt_b')))).status, 200);
  equal(f.table.get(UID)!.plan, 'elite_anual');
  // Un checkout viejo de una suscripción ya cancelada no crea ni pisa nada.
  const g = fixture([row({ provider: 'prueba', plan: 'prueba_auto', status: 'trialing' })], { sub_1: { status: 'canceled' } });
  equal(await (await stripeWebhookHandler(g.deps)(req(checkout('evt_c')))).json(), { received: true, ignored: 'cancelada' });
  equal(g.table.get(UID)!.provider, 'prueba');
});

Deno.test('P1-3 resuelto: pago sobre fila protegida → sin acceso doble, suscripción cancelada y nota auditable para reembolso', async () => {
  for (const protectedRow of [row({}), row({ provider: 'google', plan: 'elite_mensual' }), row({ provider: 'manual', plan: 'elite_anual' }),
    row({ provider: 'manual', plan: 'owner', current_period_end: null }),
    row({ provider: 'stripe', plan: 'pro_mensual', stripe_subscription_id: 'sub_otra' })]) {
    const f = fixture([protectedRow], { sub_1: {} });
    const res = await stripeWebhookHandler(f.deps)(req(invoice('evt_p', 'in_p')));
    equal(await res.json(), { received: true, ignored: 'fila_protegida' });
    equal(f.table.get(UID), protectedRow); // intacta
    equal(f.canceled, ['sub_1']);
    equal(f.sales, []); // ni venta ni comisión por un pago que hay que devolver
    const note = f.events.get('evt_p')!;
    equal([note.user_id, note.object_id, note.note.startsWith('conflicto: pago sobre fila protegida'), note.note.includes('reembolsar a mano')],
      [UID, 'sub_1', true, true]);
  }
});

Deno.test('prueba y cortesía: una compra web las sustituye', async () => {
  for (const trial of [row({ provider: 'prueba', plan: 'prueba_auto', status: 'trialing' }),
    row({ provider: 'manual', plan: 'cortesia', status: 'trialing' })]) {
    const f = fixture([trial], { sub_1: { price_id: 'price_ProAnual0001' } });
    equal((await stripeWebhookHandler(f.deps)(req(checkout('evt_t')))).status, 200);
    const r = f.table.get(UID)!;
    equal([r.provider, r.plan, r.status, r.stripe_subscription_id], ['stripe', 'pro_anual', 'active', 'sub_1']);
    equal(f.canceled, []);
  }
});

Deno.test('modo test: sin STRIPE_TEST_ACCESS no hay acceso; con la cuenta de QA sí, y nunca venta ni comisión', async () => {
  const denied = fixture([], { sub_1: { livemode: false } });
  equal(await (await stripeWebhookHandler(denied.deps)(req(checkout('evt_x', 'sub_1', false)))).json(), { received: true, ignored: 'modo_prueba' });
  equal(denied.table.size, 0);
  const qa = fixture([], { sub_1: { livemode: false, uid: QA } }, { testAccess: QA });
  await stripeWebhookHandler(qa.deps)(req(checkout('evt_q', 'sub_1', false, QA)));
  await stripeWebhookHandler(qa.deps)(req(invoice('evt_qi', 'in_q', {}, false)));
  equal([qa.table.get(QA)!.provider, (qa.table.get(QA) as unknown as Record<string, unknown>).store_environment], ['stripe', 'SANDBOX']);
  equal(qa.sales, []);
  equal(qa.events.get('evt_qi')!.note, 'aplicado; modo test: sin venta');
});

Deno.test('ventas: solo cobros reales en EUR con importe; renovación = otra venta (record_sale decide la comisión)', async () => {
  const f = fixture([], {});
  const handler = stripeWebhookHandler(f.deps);
  await handler(req(invoice('evt_1', 'in_1', { billing_reason: 'subscription_create' })));
  await handler(req(invoice('evt_2', 'in_2', { billing_reason: 'subscription_cycle' })));
  await handler(req(invoice('evt_3', 'in_3', { amount_paid: 0 })));
  await handler(req(invoice('evt_4', 'in_4', { currency: 'usd' })));
  equal(f.sales.map(s => [s.transaction_id, s.original_transaction_id, s.net_cents]), [['in_1', 'sub_1', 1074], ['in_2', 'sub_1', 1074]]);
  equal(f.events.get('evt_3')!.note, 'aplicado; importe 0: sin venta');
  equal(f.events.get('evt_4')!.note, 'aplicado; moneda usd: sin venta (revisar)');
});

Deno.test('reembolso: charge.refunded anula la venta de su factura (live); en test no toca ventas', async () => {
  const f = fixture([], {});
  const handler = stripeWebhookHandler(f.deps);
  await handler(req({ id: 'evt_r', type: 'charge.refunded', livemode: true, data: { object: { id: 'ch_1', invoice: 'in_1', refunded: true } } }));
  await handler(req({ id: 'evt_rp', type: 'charge.refunded', livemode: true, data: { object: { id: 'ch_2', invoice: 'in_2', refunded: false } } }));
  await handler(req({ id: 'evt_rt', type: 'charge.refunded', livemode: false, data: { object: { id: 'ch_3', invoice: 'in_3', refunded: true } } }));
  equal(f.refunds, ['in_1', 'in_2']);
  equal(f.events.get('evt_rp')!.note, 'reembolso PARCIAL: venta y comision anuladas (revisar)');
});

Deno.test('portal: un cambio de plan (Pro → Élite) llega por subscription.updated y actualiza el plan', async () => {
  const f = fixture([row({ provider: 'stripe', plan: 'pro_mensual', stripe_subscription_id: 'sub_1' })], { sub_1: { price_id: 'price_EliteMens001' } });
  await stripeWebhookHandler(f.deps)(req({ id: 'evt_u', type: 'customer.subscription.updated', data: { object: { id: 'sub_1' } } }));
  equal(f.table.get(UID)!.plan, 'elite_mensual');
});

Deno.test('un fallo a mitad no deja el evento marcado: el reintento lo aplica', async () => {
  const f = fixture([], {});
  let fail = true;
  const original = f.deps.repo.recordSale!;
  f.deps.repo.recordSale = s => { if (fail) { fail = false; return Promise.reject(new Error('db')); } return original(s); };
  const handler = stripeWebhookHandler(f.deps);
  equal((await handler(req(invoice('evt_f', 'in_f')))).status, 500);
  equal(f.events.has('evt_f'), false);
  equal((await handler(req(invoice('evt_f', 'in_f')))).status, 200);
  equal(f.sales.length, 1);
});
