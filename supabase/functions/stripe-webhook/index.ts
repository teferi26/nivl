// NIVL · Edge Function: webhook de Stripe → tabla subscriptions
// Despliegue (una vez, ver README):
//   supabase functions deploy stripe-webhook --no-verify-jwt
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_...
// En Stripe → Developers → Webhooks: apuntar a
//   https://<PROJECT>.supabase.co/functions/v1/stripe-webhook
// con los eventos: checkout.session.completed, customer.subscription.updated,
// customer.subscription.deleted

import Stripe from 'https://esm.sh/stripe@17?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

async function upsertSubscription(userId: string, patch: Record<string, unknown>) {
  const { error } = await supabase
    .from('subscriptions')
    .upsert({ user_id: userId, updated_at: new Date().toISOString(), ...patch });
  if (error) throw error;
}

async function userIdFromSubscription(subscriptionId: string): Promise<string | null> {
  const { data } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();
  return (data?.user_id as string) ?? null;
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Sin firma', { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await req.text(),
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '',
    );
  } catch {
    return new Response('Firma inválida', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        // El Payment Link se abre con ?client_reference_id=<user_id de Supabase>
        const userId = session.client_reference_id;
        if (!userId) break;
        let periodEnd: string | null = null;
        const subId = typeof session.subscription === 'string' ? session.subscription : null;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          periodEnd = new Date(sub.current_period_end * 1000).toISOString();
        }
        await upsertSubscription(userId, {
          status: 'active',
          stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
          stripe_subscription_id: subId,
          current_period_end: periodEnd,
        });
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await userIdFromSubscription(sub.id);
        if (!userId) break;
        const status =
          event.type === 'customer.subscription.deleted'
            ? 'canceled'
            : sub.status === 'active' || sub.status === 'trialing'
              ? (sub.status as 'active' | 'trialing')
              : sub.status === 'past_due'
                ? 'past_due'
                : 'canceled';
        await upsertSubscription(userId, {
          status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        });
        break;
      }
    }
  } catch (e) {
    console.error('stripe-webhook error:', e);
    return new Response('Error interno', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'content-type': 'application/json' },
  });
});
