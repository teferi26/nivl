// NIVL · Stripe (web only; never inside the iOS/Android binaries) → subscriptions.
//
// Hardened 2026-10-02 (docs/payment-audit/SERVIDOR.md):
//  · fails closed when STRIPE_WEBHOOK_SECRET / STRIPE_SECRET_KEY are missing
//    (an empty secret must never be used to verify a signature);
//  · order-independent: Stripe does not guarantee event order and may deliver
//    duplicates, so the subscription is RE-READ from the Stripe API and its
//    current state is written (an old "active" event cannot resurrect a
//    canceled subscription) — https://docs.stripe.com/webhooks (event ordering);
//  · never clobbers a protected row: owner, an entitled native-store (Apple /
//    Google) row, or an entitled manual grant; subscription.updated/deleted only
//    touch the row that still points to THAT Stripe subscription and provider;
//  · client_reference_id must be a uuid; a checkout without a subscription
//    grants nothing (it used to write status active with no end date = forever).
//
// Web checkout, 2026-10-21 (docs/payment-audit/STRIPE-WEB.md):
//  · plan from the subscription's price id (STRIPE_PRICE_<PRODUCTO>) → the
//    PRECIOS.md plans; an unknown price keeps the legacy 'mensual' (Pro);
//  · idempotent by event.id in store_events (same table as RevenueCat, ids
//    'evt_…'); the event is recorded only AFTER it was applied, so a crash
//    mid-way is simply retried (every step is itself idempotent);
//  · P1-3: a payment over a protected row grants nothing, CANCELS that Stripe
//    subscription (no more charges) and leaves an auditable store_events note
//    'conflicto…' for a manual refund;
//  · invoice.paid → record_sale(store 'stripe') ONLY for live mode, a real
//    amount in EUR and a subscription this account actually holds; the
//    commission rules (first payment / monthly up to the cap / renewals 0 %)
//    are record_sale's own (0025). charge.refunded → record_refund (live only);
//  · test mode (livemode false) grants access only to STRIPE_TEST_ACCESS.
import type { Db } from './db.ts';
import {
  LEGACY_PLAN, STRIPE_PRODUCTS, productForPrice, type EnvGetter, type StripeProduct,
} from './store-stripe-config.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GRACE_MS = 2 * 24 * 3600_000; // same two days as ai_state (0020/0024)

export type StripeSubscriptionState = {
  id: string; status: string; customer: string | null; current_period_end: number | null;
  /** First item's price id (one item per NIVL subscription). */
  price_id?: string | null;
  /** subscription.metadata.uid, set by stripe-checkout (subscription_data.metadata). */
  uid?: string | null;
  livemode?: boolean;
};
export type SubscriptionRow = {
  user_id: string; status: string; plan: string; provider: string;
  current_period_end: string | null; stripe_subscription_id: string | null;
  stripe_customer_id?: string | null;
};
export type StripeEventLike = { id: string; type: string; livemode?: boolean; data: { object: Record<string, unknown> } };

export type StripeEventRecord = {
  id: string; type: string; user_id: string | null; livemode: boolean | null; object_id: string | null; note: string;
};
export type StripeSale = {
  user_id: string; transaction_id: string; original_transaction_id: string; product_id: StripeProduct;
  price_cents: number; currency: string; net_cents: number; purchased_at: string;
};

export interface StripeRepo {
  byUser(userId: string): Promise<SubscriptionRow | null>;
  bySubscription(subscriptionId: string): Promise<SubscriptionRow | null>;
  /** false when a row already exists (no overwrite). */
  insert(row: Record<string, unknown>): Promise<boolean>;
  /** Optimistic update: only if provider/plan/stripe id still match `expect`; false if nothing changed. */
  update(userId: string, expect: Pick<SubscriptionRow, 'provider' | 'plan' | 'stripe_subscription_id'>, patch: Record<string, unknown>): Promise<boolean>;
  /** Idempotency (store_events.id). Optional so older doubles keep compiling. */
  eventSeen?(eventId: string): Promise<boolean>;
  recordEvent?(event: StripeEventRecord): Promise<void>;
  /** record_sale(p_store 'stripe', …): idempotent by transaction_id (the invoice id). */
  recordSale?(sale: StripeSale): Promise<void>;
  /** record_refund(transaction_id): idempotent. */
  recordRefund?(transactionId: string): Promise<void>;
}
export interface StripeDeps {
  verify(body: string, signature: string): Promise<StripeEventLike>;
  retrieve(subscriptionId: string): Promise<StripeSubscriptionState>;
  repo: StripeRepo;
  now?: () => number;
  /** STRIPE_PRICE_* lookup; without it every price is "unknown" (legacy plan). */
  env?: EnvGetter;
  /** Who may get access from a TEST-mode payment (STRIPE_TEST_ACCESS). Default: nobody. */
  testAccess?: (userId: string) => boolean;
  /** Cancel a Stripe subscription immediately (P1-3 conflicts). */
  cancel?(subscriptionId: string): Promise<void>;
}

export function mapStripeStatus(status: string): 'active' | 'trialing' | 'past_due' | 'canceled' {
  return status === 'active' || status === 'trialing' || status === 'past_due' ? status : 'canceled';
}

export function entitled(row: SubscriptionRow, now: number): boolean {
  if (!['active', 'trialing', 'past_due'].includes(row.status)) return false;
  if (row.current_period_end === null) return true;
  return Date.parse(row.current_period_end) > now - GRACE_MS;
}

/** A trial never blocks a purchase: the 7-day cortesía (0024) and the automatic trial (0069). */
export const isTrialRow = (row: SubscriptionRow) =>
  (row.provider === 'manual' && row.plan === 'cortesia') || row.provider === 'prueba' || row.plan === 'prueba_auto';

/** May a Stripe checkout take over this row? */
export function stripeMayTakeOver(row: SubscriptionRow | null, now: number, subscriptionId?: string): boolean {
  if (!row) return true;
  if (row.plan === 'owner') return false;
  // A Payment Link carries client_reference_id in the URL: anyone can pay with
  // another user's uuid. A live Stripe subscription is never replaced by a
  // DIFFERENT one (review c, P1-2: a third party could pay, cancel, and leave
  // the victim paying without access).
  if (row.provider === 'stripe') {
    return !entitled(row, now) || !row.stripe_subscription_id || row.stripe_subscription_id === subscriptionId;
  }
  if (isTrialRow(row)) return true; // 0069: the automatic trial never blocks a purchase
  return !entitled(row, now); // a live store purchase or manual grant is never overwritten
}

/** Plan for a Stripe subscription: the PRECIOS.md plan of its price, else the legacy one. */
export function planForSubscription(env: EnvGetter, sub: StripeSubscriptionState, row: SubscriptionRow | null): string {
  const product = productForPrice(env, sub.price_id);
  if (product) return STRIPE_PRODUCTS[product];
  // Unknown/legacy price: keep what a Stripe row already had (e.g. 'mensual', 'anual').
  return row && row.provider === 'stripe' && row.stripe_subscription_id === sub.id ? row.plan : LEGACY_PLAN;
}

const text = (status: number, body: string) => new Response(body, { status });
const ok = (body: Record<string, unknown>) => new Response(JSON.stringify({ received: true, ...body }), {
  status: 200, headers: { 'content-type': 'application/json' },
});
const iso = (seconds: number | null) => seconds ? new Date(seconds * 1000).toISOString() : null;
const str = (value: unknown) => typeof value === 'string' && value ? value : null;
const int = (value: unknown) => typeof value === 'number' && Number.isInteger(value) ? value : null;

type Outcome = { body: Record<string, unknown>; note: string; userId: string | null; objectId: string | null };
type SyncResult = 'ok' | 'protected' | 'test_denied' | 'canceled_elsewhere';

/** Writes the CURRENT state of a Stripe subscription to the account's row, if it may. */
async function syncSubscription(deps: StripeDeps, userId: string, sub: StripeSubscriptionState, customer: string | null,
  now: number): Promise<{ result: SyncResult; row: SubscriptionRow | null }> {
  if (sub.livemode === false && !(deps.testAccess ?? (() => false))(userId)) return { result: 'test_denied', row: null };
  const env = deps.env ?? (() => undefined);
  const product = productForPrice(env, sub.price_id);
  const status = mapStripeStatus(sub.status);
  const patch: Record<string, unknown> = {
    status, provider: 'stripe',
    stripe_customer_id: customer ?? sub.customer,
    stripe_subscription_id: sub.id,
    current_period_end: iso(sub.current_period_end),
    updated_at: new Date(now).toISOString(),
  };
  if (product) patch.store_product_id = product;
  if (typeof sub.livemode === 'boolean') patch.store_environment = sub.livemode ? 'PRODUCTION' : 'SANDBOX';
  for (let attempt = 0; attempt < 2; attempt++) {
    const row = await deps.repo.byUser(userId);
    const sameSub = row?.provider === 'stripe' && row.stripe_subscription_id === sub.id;
    // A dead subscription never overwrites somebody else's row (a trial, a store
    // purchase, another Stripe subscription) and never creates one.
    if (status === 'canceled' && !sameSub) return { result: 'canceled_elsewhere', row };
    if (!row) {
      if (await deps.repo.insert({ user_id: userId, plan: planForSubscription(env, sub, null), ...patch })) return { result: 'ok', row: null };
      continue; // created concurrently: re-read and decide again
    }
    if (!stripeMayTakeOver(row, now, sub.id)) return { result: 'protected', row };
    if (await deps.repo.update(userId, row, { ...patch, plan: planForSubscription(env, sub, row) })) return { result: 'ok', row };
  }
  throw new Error('Concurrent subscription change');
}

async function conflict(deps: StripeDeps, sub: StripeSubscriptionState, row: SubscriptionRow | null): Promise<string> {
  // P1-3: the account already has another live entitlement. No double access:
  // stop future charges now and leave the already-paid invoice to support.
  let canceled = false;
  if (deps.cancel) {
    try { await deps.cancel(sub.id); canceled = true; } catch (error) {
      console.error('stripe-webhook: cancel failed', sub.id, error instanceof Error ? error.message : 'unknown');
    }
  }
  console.error('stripe-webhook: payment over a protected subscription row; manual refund needed', sub.id);
  return `conflicto: pago sobre fila protegida (${row?.provider ?? '?'}/${row?.plan ?? '?'}); `
    + `suscripcion ${sub.id} ${canceled ? 'cancelada' : 'SIN cancelar'}; reembolsar a mano`;
}

async function handleEvent(deps: StripeDeps, event: StripeEventLike, now: number): Promise<Outcome> {
  const object = event.data.object;
  const done = (body: Record<string, unknown>, note: string, userId: string | null = null, objectId: string | null = null): Outcome =>
    ({ body, note, userId, objectId });

  if (event.type === 'checkout.session.completed') {
    const userId = typeof object.client_reference_id === 'string' ? object.client_reference_id.toLowerCase() : '';
    const subId = str(object.subscription);
    if (!UUID.test(userId)) return done({ ignored: 'client_reference_id' }, 'ignorado: client_reference_id');
    if (!subId) return done({ ignored: 'sin_suscripcion' }, 'ignorado: sin suscripcion', userId);
    const sub = await deps.retrieve(subId);
    if (sub.uid && sub.uid.toLowerCase() !== userId) {
      return done({ ignored: 'uid_distinto' }, 'ignorado: metadata.uid distinto de client_reference_id', userId, subId);
    }
    const { result, row } = await syncSubscription(deps, userId, sub, str(object.customer), now);
    if (result === 'protected') return done({ ignored: 'fila_protegida' }, await conflict(deps, sub, row), userId, subId);
    if (result === 'test_denied') return done({ ignored: 'modo_prueba' }, 'ignorado: modo test sin STRIPE_TEST_ACCESS', userId, subId);
    if (result === 'canceled_elsewhere') return done({ ignored: 'cancelada' }, 'ignorado: suscripcion ya cancelada', userId, subId);
    return done({}, 'aplicado', userId, subId);
  }

  if (event.type === 'invoice.paid') {
    const subId = str(object.subscription);
    const invoiceId = str(object.id);
    if (!subId || !invoiceId) return done({ ignored: 'sin_suscripcion' }, 'ignorado: factura sin suscripcion');
    const sub = await deps.retrieve(subId);
    const known = await deps.repo.bySubscription(subId);
    const userId = (sub.uid && UUID.test(sub.uid) ? sub.uid.toLowerCase() : null) ?? known?.user_id ?? null;
    if (!userId) return done({ ignored: 'sin_usuario' }, 'ignorado: suscripcion sin uid (checkout aun no aplicado)', null, subId);
    const { result, row } = await syncSubscription(deps, userId, sub, str(object.customer), now);
    if (result === 'protected') return done({ ignored: 'fila_protegida' }, await conflict(deps, sub, row), userId, subId);
    if (result === 'test_denied') return done({ ignored: 'modo_prueba' }, 'ignorado: modo test sin STRIPE_TEST_ACCESS', userId, subId);
    if (result === 'canceled_elsewhere') return done({ ignored: 'cancelada' }, 'ignorado: suscripcion ya cancelada', userId, subId);
    // Sales (and creator commissions) only from REAL money: live mode, > 0, EUR,
    // a current catalogue price. Test mode never creates sales (like SANDBOX, 0027).
    const product = productForPrice(deps.env ?? (() => undefined), sub.price_id);
    const paid = int(object.amount_paid) ?? 0;
    const currency = (str(object.currency) ?? '').toLowerCase();
    if (event.livemode !== true || object.livemode === false) return done({}, 'aplicado; modo test: sin venta', userId, invoiceId);
    if (paid <= 0) return done({}, 'aplicado; importe 0: sin venta', userId, invoiceId);
    if (!product) return done({}, 'aplicado; precio fuera del catalogo: sin venta', userId, invoiceId);
    if (currency !== 'eur') return done({}, `aplicado; moneda ${currency}: sin venta (revisar)`, userId, invoiceId);
    if (!deps.repo.recordSale) return done({}, 'aplicado; sin registro de ventas', userId, invoiceId);
    const paidAt = int((object.status_transitions as Record<string, unknown> | undefined)?.paid_at) ?? int(object.created) ?? Math.floor(now / 1000);
    await deps.repo.recordSale({
      user_id: userId, transaction_id: invoiceId, original_transaction_id: sub.id, product_id: product,
      price_cents: paid, currency: 'EUR', net_cents: Math.max(0, paid - (int(object.tax) ?? 0)),
      purchased_at: new Date(paidAt * 1000).toISOString(),
    });
    return done({ sale: true }, 'aplicado; venta registrada', userId, invoiceId);
  }

  if (event.type === 'charge.refunded') {
    const invoiceId = str(object.invoice);
    if (!invoiceId) return done({ ignored: 'sin_factura' }, 'ignorado: reembolso sin factura', null, str(object.id));
    if (event.livemode !== true) return done({ ignored: 'modo_prueba' }, 'reembolso en modo test: sin ventas que anular', null, invoiceId);
    if (!deps.repo.recordRefund) return done({ ignored: 'sin_registro' }, 'reembolso sin registro de ventas', null, invoiceId);
    await deps.repo.recordRefund(invoiceId);
    const partial = object.refunded !== true;
    return done({ refund: true }, partial ? 'reembolso PARCIAL: venta y comision anuladas (revisar)' : 'reembolso: venta y comision anuladas', null, invoiceId);
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const subId = str(object.id);
    if (!subId) return done({ ignored: 'sin_id' }, 'ignorado: sin id');
    const row = await deps.repo.bySubscription(subId);
    if (!row || row.provider !== 'stripe' || row.plan === 'owner') return done({ ignored: 'sin_fila_stripe' }, 'ignorado: sin fila stripe', null, subId);
    const sub = await deps.retrieve(subId); // current state, not the (possibly stale) event payload
    const patch: Record<string, unknown> = {
      status: mapStripeStatus(sub.status),
      current_period_end: iso(sub.current_period_end),
      updated_at: new Date(now).toISOString(),
    };
    // A plan change in the Customer Portal (Pro ↔ Élite, monthly ↔ annual).
    const product = productForPrice(deps.env ?? (() => undefined), sub.price_id);
    if (product) { patch.plan = STRIPE_PRODUCTS[product]; patch.store_product_id = product; }
    const changed = await deps.repo.update(row.user_id, row, patch);
    if (!changed) throw new Error('Concurrent subscription change');
    return done({}, 'aplicado', row.user_id, subId);
  }
  return done({ ignored: 'tipo' }, 'ignorado: tipo');
}

export const stripeWebhookHandler = (deps: StripeDeps | null) => async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return text(405, 'Método no permitido');
  if (!deps) {
    console.error('stripe-webhook: STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET not configured');
    return text(500, 'No configurado'); // Stripe retries (live mode: up to 3 days)
  }
  const signature = req.headers.get('stripe-signature');
  if (!signature) return text(400, 'Sin firma');
  let event: StripeEventLike;
  try {
    event = await deps.verify(await req.text(), signature);
  } catch {
    return text(400, 'Firma inválida');
  }
  const now = (deps.now ?? Date.now)();
  try {
    if (typeof event.id === 'string' && event.id && deps.repo.eventSeen && await deps.repo.eventSeen(event.id)) {
      return ok({ duplicate: true });
    }
    const outcome = await handleEvent(deps, event, now);
    if (deps.repo.recordEvent && typeof event.id === 'string' && event.id) {
      await deps.repo.recordEvent({
        id: event.id, type: event.type, user_id: outcome.userId,
        livemode: typeof event.livemode === 'boolean' ? event.livemode : null,
        object_id: outcome.objectId, note: outcome.note,
      });
    }
    return ok(outcome.body);
  } catch (error) {
    console.error('stripe-webhook error:', error instanceof Error ? error.message : 'unknown');
    return text(500, 'Error interno');
  }
};

const COLUMNS = 'user_id,status,plan,provider,current_period_end,stripe_subscription_id,stripe_customer_id';

/** supabase-js implementation (service role). */
export function supabaseStripeRepo(admin: Db): StripeRepo {
  return {
    async byUser(userId) {
      const { data, error } = await admin.from('subscriptions').select(COLUMNS).eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return (data as SubscriptionRow | null) ?? null;
    },
    async bySubscription(subscriptionId) {
      const { data, error } = await admin.from('subscriptions').select(COLUMNS)
        .eq('stripe_subscription_id', subscriptionId).maybeSingle();
      if (error) throw error;
      return (data as SubscriptionRow | null) ?? null;
    },
    async insert(row) {
      const { data, error } = await admin.from('subscriptions')
        .upsert(row, { onConflict: 'user_id', ignoreDuplicates: true }).select('user_id');
      if (error) throw error;
      return Array.isArray(data) && data.length > 0;
    },
    async update(userId, expect, patch) {
      let query = admin.from('subscriptions').update(patch).eq('user_id', userId)
        .eq('provider', expect.provider).eq('plan', expect.plan);
      query = expect.stripe_subscription_id === null
        ? query.is('stripe_subscription_id', null)
        : query.eq('stripe_subscription_id', expect.stripe_subscription_id);
      const { data, error } = await query.select('user_id');
      if (error) throw error;
      return Array.isArray(data) && data.length > 0;
    },
    async eventSeen(eventId) {
      const { data, error } = await admin.from('store_events').select('id').eq('id', eventId).maybeSingle();
      if (error) throw error;
      return data !== null;
    },
    async recordEvent(event) {
      // Minimal payload: no e-mail, card or address from Stripe ever lands here.
      const { error } = await admin.from('store_events').upsert({
        id: event.id, type: event.type, app_user_id: event.user_id,
        environment: event.livemode === null ? null : event.livemode ? 'PRODUCTION' : 'SANDBOX',
        payload: { provider: 'stripe', id: event.id, type: event.type, object: event.object_id, livemode: event.livemode },
        note: event.note,
      }, { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw error;
    },
    async recordSale(sale) {
      const { error } = await admin.rpc('record_sale', {
        p_user: sale.user_id, p_store: 'stripe', p_txn: sale.transaction_id, p_orig: sale.original_transaction_id,
        p_product: sale.product_id, p_price_cents: sale.price_cents, p_currency: sale.currency,
        p_net_cents: sale.net_cents, p_purchased_at: sale.purchased_at,
      });
      if (error) throw error;
    },
    async recordRefund(transactionId) {
      const { error } = await admin.rpc('record_refund', { p_txn: transactionId });
      if (error) throw error;
    },
  };
}
