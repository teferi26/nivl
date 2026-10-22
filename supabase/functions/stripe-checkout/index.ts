// NIVL · Edge Function: crea la sesión de Stripe Checkout de la web (Pro/Élite).
// POST /functions/v1/stripe-checkout · Authorization: Bearer <JWT de la sesión>
// body {plan: 'nivl_pro_mensual'|'nivl_pro_anual'|'nivl_elite_mensual'|'nivl_elite_anual'|'nivl_elite_fundador', locale?}
// → 200 {url} · 4xx/5xx {error, message}. Contrato: docs/payment-audit/STRIPE-WEB.md.
// Despliegue CON verificación de JWT (la de por defecto):
//   supabase functions deploy stripe-checkout
import { adminClient } from '../_shared/db.ts';
import { allowedOrigins, stripeTestPolicy } from '../_shared/store-stripe-config.ts';
import { stripeCheckoutHandler, supabaseCheckoutRepo } from '../_shared/store-stripe-checkout.ts';
import { authFromJwt, checkoutStripe, stripeClient } from '../_shared/store-stripe-sdk.ts';

const env = (name: string) => Deno.env.get(name);
const admin = adminClient();
const { stripe, mode } = stripeClient(env);
if (!mode) console.error('stripe-checkout: STRIPE_SECRET_KEY missing or invalid');

Deno.serve(stripeCheckoutHandler({
  auth: authFromJwt(admin), repo: supabaseCheckoutRepo(admin), stripe: checkoutStripe(stripe), mode, env,
  origins: allowedOrigins(env), testAccess: stripeTestPolicy(env),
}));
