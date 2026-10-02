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
import type { Db } from './db.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GRACE_MS = 2 * 24 * 3600_000; // same two days as ai_state (0020/0024)

export type StripeSubscriptionState = {
  id: string; status: string; customer: string | null; current_period_end: number | null;
};
export type SubscriptionRow = {
  user_id: string; status: string; plan: string; provider: string;
  current_period_end: string | null; stripe_subscription_id: string | null;
};
export type StripeEventLike = { id: string; type: string; data: { object: Record<string, unknown> } };

export interface StripeRepo {
  byUser(userId: string): Promise<SubscriptionRow | null>;
  bySubscription(subscriptionId: string): Promise<SubscriptionRow | null>;
  /** false when a row already exists (no overwrite). */
  insert(row: Record<string, unknown>): Promise<boolean>;
  /** Optimistic update: only if provider/plan/stripe id still match `expect`; false if nothing changed. */
  update(userId: string, expect: Pick<SubscriptionRow, 'provider' | 'plan' | 'stripe_subscription_id'>, patch: Record<string, unknown>): Promise<boolean>;
}
export interface StripeDeps {
  verify(body: string, signature: string): Promise<StripeEventLike>;
  retrieve(subscriptionId: string): Promise<StripeSubscriptionState>;
  repo: StripeRepo;
  now?: () => number;
}

export function mapStripeStatus(status: string): 'active' | 'trialing' | 'past_due' | 'canceled' {
  return status === 'active' || status === 'trialing' || status === 'past_due' ? status : 'canceled';
}

function entitled(row: SubscriptionRow, now: number): boolean {
  if (!['active', 'trialing', 'past_due'].includes(row.status)) return false;
  if (row.current_period_end === null) return true;
  return Date.parse(row.current_period_end) > now - GRACE_MS;
}

/** May a Stripe checkout take over this row? */
export function stripeMayTakeOver(row: SubscriptionRow | null, now: number): boolean {
  if (!row) return true;
  if (row.plan === 'owner') return false;
  if (row.provider === 'stripe') return true;
  if (row.provider === 'manual' && row.plan === 'cortesia') return true; // the 7-day trial
  return !entitled(row, now); // a live store purchase or manual grant is never overwritten
}

const text = (status: number, body: string) => new Response(body, { status });
const ok = (body: Record<string, unknown>) => new Response(JSON.stringify({ received: true, ...body }), {
  status: 200, headers: { 'content-type': 'application/json' },
});

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
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = typeof session.client_reference_id === 'string' ? session.client_reference_id.toLowerCase() : '';
      const subId = typeof session.subscription === 'string' ? session.subscription : null;
      if (!UUID.test(userId)) return ok({ ignored: 'client_reference_id' });
      if (!subId) return ok({ ignored: 'sin_suscripcion' });
      const sub = await deps.retrieve(subId);
      const patch = {
        status: mapStripeStatus(sub.status), provider: 'stripe',
        stripe_customer_id: typeof session.customer === 'string' ? session.customer : sub.customer,
        stripe_subscription_id: sub.id,
        current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        updated_at: new Date(now).toISOString(),
      };
      for (let attempt = 0; attempt < 2; attempt++) {
        const row = await deps.repo.byUser(userId);
        if (!row) {
          if (await deps.repo.insert({ user_id: userId, plan: 'mensual', ...patch })) return ok({});
          continue; // created concurrently: re-read and decide again
        }
        if (!stripeMayTakeOver(row, now)) return ok({ ignored: 'fila_protegida' });
        const plan = row.provider === 'stripe' ? row.plan : 'mensual';
        if (await deps.repo.update(userId, row, { ...patch, plan })) return ok({});
      }
      throw new Error('Concurrent subscription change');
    }
    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subId = typeof event.data.object.id === 'string' ? event.data.object.id : '';
      if (!subId) return ok({ ignored: 'sin_id' });
      const row = await deps.repo.bySubscription(subId);
      if (!row || row.provider !== 'stripe' || row.plan === 'owner') return ok({ ignored: 'sin_fila_stripe' });
      const sub = await deps.retrieve(subId); // current state, not the (possibly stale) event payload
      const changed = await deps.repo.update(row.user_id, row, {
        status: mapStripeStatus(sub.status),
        current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        updated_at: new Date(now).toISOString(),
      });
      if (!changed) throw new Error('Concurrent subscription change');
      return ok({});
    }
    return ok({ ignored: 'tipo' });
  } catch (error) {
    console.error('stripe-webhook error:', error instanceof Error ? error.message : 'unknown');
    return text(500, 'Error interno');
  }
};

const COLUMNS = 'user_id,status,plan,provider,current_period_end,stripe_subscription_id';

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
  };
}
