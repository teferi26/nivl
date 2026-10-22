// NIVL · Edge Function: webhook de Stripe → tabla subscriptions (solo web).
// Contrato, variables y pruebas: docs/payment-audit/STRIPE-WEB.md.
//
// Despliegue (OBLIGATORIO --no-verify-jwt: Stripe no manda JWT de Supabase; sin
// él la pasarela responde 401 antes de que corra este código y Stripe reintenta
// hasta desactivar el endpoint):
//   supabase functions deploy stripe-webhook --no-verify-jwt
//   supabase secrets set STRIPE_SECRET_KEY=sk_test_… STRIPE_WEBHOOK_SECRET=whsec_… STRIPE_PRICE_NIVL_PRO_MENSUAL=price_… (…)
// En Stripe → Developers → Webhooks: apuntar a
//   https://<PROJECT>.supabase.co/functions/v1/stripe-webhook
// con los eventos: checkout.session.completed, invoice.paid, charge.refunded,
// customer.subscription.updated, customer.subscription.deleted
// La lógica (y por qué) está en _shared/store-stripe.ts.

import Stripe from 'https://esm.sh/stripe@17?target=denonext';
import { adminClient } from '../_shared/db.ts';
import { stripeWebhookHandler, supabaseStripeRepo, type StripeEventLike } from '../_shared/store-stripe.ts';
import { stripeKeyMode, stripeTestPolicy } from '../_shared/store-stripe-config.ts';

const env = (name: string) => Deno.env.get(name);
const secretKey = (env('STRIPE_SECRET_KEY') ?? '').trim();
const webhookSecret = (env('STRIPE_WEBHOOK_SECRET') ?? '').trim();

function deps() {
  // Sin secreto no hay verificación posible: 500 y Stripe reintenta.
  if (!stripeKeyMode(secretKey)) return null;
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
        price_id: sub.items?.data?.[0]?.price?.id ?? null,
        uid: typeof sub.metadata?.uid === 'string' ? sub.metadata.uid : null,
        livemode: sub.livemode,
      };
    },
    cancel: async (id: string) => { await stripe.subscriptions.cancel(id, { prorate: false }); },
    env,
    testAccess: stripeTestPolicy(env),
    repo: supabaseStripeRepo(adminClient()),
  };
}

Deno.serve(stripeWebhookHandler(deps()));
