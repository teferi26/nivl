// NIVL · Adaptadores del SDK de Stripe para las Edge Functions web (checkout,
// portal, desistimiento). Aparte de la lógica para que los tests no carguen el
// SDK ni toquen la red. API fijada a 2024-06-20, la misma del webhook.
import Stripe from 'https://esm.sh/stripe@17?target=denonext';
import type { Db } from './db.ts';
import { stripeKeyMode, type EnvGetter } from './store-stripe-config.ts';
import type { AuthUser, CheckoutStripe } from './store-stripe-checkout.ts';
import type { DesistimientoStripe } from './store-stripe-desistimiento.ts';

export function stripeClient(env: EnvGetter): { stripe: Stripe | null; mode: 'live' | 'test' | null } {
  const key = (env('STRIPE_SECRET_KEY') ?? '').trim();
  const mode = stripeKeyMode(key);
  if (!mode) return { stripe: null, mode: null };
  return { stripe: new Stripe(key, { apiVersion: '2024-06-20' }), mode };
}

export function checkoutStripe(stripe: Stripe | null): CheckoutStripe | null {
  if (!stripe) return null;
  return {
    async liveSubscriptions(customer) {
      const list = await stripe.subscriptions.list({ customer, status: 'all', limit: 20 });
      return list.data.filter(s => ['active', 'trialing', 'past_due', 'incomplete'].includes(s.status)).length;
    },
    async createCheckout(params) {
      const session = await stripe.checkout.sessions.create(params as unknown as Stripe.Checkout.SessionCreateParams);
      return { url: session.url };
    },
    async createPortal(customer, returnUrl) {
      const portal = await stripe.billingPortal.sessions.create({ customer, return_url: returnUrl });
      return { url: portal.url };
    },
  };
}

export function desistimientoStripe(stripe: Stripe | null): DesistimientoStripe | null {
  if (!stripe) return null;
  const view = (s: Stripe.Subscription) => ({
    id: s.id, customer: typeof s.customer === 'string' ? s.customer : s.customer.id,
    start_date: typeof s.start_date === 'number' ? s.start_date : null,
  });
  return {
    async subscription(id) {
      try { return view(await stripe.subscriptions.retrieve(id)); } catch { return null; }
    },
    async subscriptionByInvoiceNumber(number) {
      const found = await stripe.invoices.search({ query: `number:"${number.replace(/"/g, '')}"`, limit: 1 });
      const sub = found.data[0]?.subscription;
      const id = typeof sub === 'string' ? sub : sub?.id;
      return id ? this.subscription(id) : null;
    },
    async customerEmail(customer) {
      const c = await stripe.customers.retrieve(customer);
      return 'deleted' in c && c.deleted ? null : (c as Stripe.Customer).email ?? null;
    },
  };
}

/** uid + correo del JWT de Supabase (null si no es una sesión de usuario). */
export const authFromJwt = (admin: Db) => async (token: string): Promise<AuthUser | null> => {
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
};
