// NIVL · Edge Function: abre el Customer Portal de Stripe (cancelar, cambiar de
// plan, método de pago, facturas). POST /functions/v1/stripe-portal con el JWT
// → 200 {url} · 404 {error:'sin_cliente'}. Contrato: docs/payment-audit/STRIPE-WEB.md.
// Despliegue CON verificación de JWT:
//   supabase functions deploy stripe-portal
import { adminClient } from '../_shared/db.ts';
import { allowedOrigins, stripeTestPolicy } from '../_shared/store-stripe-config.ts';
import { stripePortalHandler, supabaseCheckoutRepo } from '../_shared/store-stripe-checkout.ts';
import { authFromJwt, checkoutStripe, stripeClient } from '../_shared/store-stripe-sdk.ts';

const env = (name: string) => Deno.env.get(name);
const admin = adminClient();
const { stripe, mode } = stripeClient(env);
if (!mode) console.error('stripe-portal: STRIPE_SECRET_KEY missing or invalid');

Deno.serve(stripePortalHandler({
  auth: authFromJwt(admin), repo: supabaseCheckoutRepo(admin), stripe: checkoutStripe(stripe), mode, env,
  origins: allowedOrigins(env), testAccess: stripeTestPolicy(env),
}));
