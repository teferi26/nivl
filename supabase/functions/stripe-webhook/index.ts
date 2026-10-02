// NIVL · Edge Function: webhook de Stripe → tabla subscriptions (solo web).
// Despliegue (ver docs/PAGOS.md):
//   supabase functions deploy stripe-webhook --no-verify-jwt
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_...
// En Stripe → Developers → Webhooks: apuntar a
//   https://<PROJECT>.supabase.co/functions/v1/stripe-webhook
// con los eventos: checkout.session.completed, customer.subscription.updated,
// customer.subscription.deleted
// La lógica (y por qué) está en _shared/store-stripe.ts.

import Stripe from 'https://esm.sh/stripe@17?target=denonext';
import { adminClient } from '../_shared/db.ts';
import { stripeWebhookHandler, supabaseStripeRepo, type StripeEventLike } from '../_shared/store-stripe.ts';

const secretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

function deps() {
  // Sin secreto no hay verificación posible: 500 y Stripe reintenta.
  if (!secretKey.startsWith('sk_') && !secretKey.startsWith('rk_')) return null;
  if (!webhookSecret.startsWith('whsec_')) return null;
  const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });
  const crypto = Stripe.createSubtleCryptoProvider();
  return {
    // Tolerancia por defecto de la librería: 300 s (firma + marca de tiempo).
    verify: async (body: string, signature: string) =>
      (await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, crypto)) as unknown as StripeEventLike,
    retrieve: async (id: string) => {
      const sub = await stripe.subscriptions.retrieve(id);
      return {
        id: sub.id, status: sub.status,
        customer: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null,
        current_period_end: typeof sub.current_period_end === 'number' ? sub.current_period_end : null,
      };
    },
    repo: supabaseStripeRepo(adminClient()),
  };
}

Deno.serve(stripeWebhookHandler(deps()));
