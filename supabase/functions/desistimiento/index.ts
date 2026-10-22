// NIVL · Edge Function: botón de desistimiento de la web (Directiva (UE) 2023/2673).
// POST /functions/v1/desistimiento
//   · con sesión: Authorization: Bearer <JWT del usuario>, body {motivo?}
//   · formulario: Authorization: Bearer <clave anon>, body {email, pedido, motivo?}
// → 202 {ok, referencia, recibido_at, message}. Solo REGISTRA (withdrawal_requests);
// soporte tramita reembolso y cancelación. Contrato: docs/payment-audit/STRIPE-WEB.md.
// Despliegue CON verificación de JWT (la clave anon ya es un JWT válido para la pasarela):
//   supabase functions deploy desistimiento
import { adminClient } from '../_shared/db.ts';
import { allowedOrigins } from '../_shared/store-stripe-config.ts';
import { desistimientoHandler, supabaseDesistimientoRepo } from '../_shared/store-stripe-desistimiento.ts';
import { authFromJwt, desistimientoStripe, stripeClient } from '../_shared/store-stripe-sdk.ts';

const env = (name: string) => Deno.env.get(name);
const admin = adminClient();
const { stripe } = stripeClient(env);

Deno.serve(desistimientoHandler({
  auth: authFromJwt(admin), repo: supabaseDesistimientoRepo(admin), stripe: desistimientoStripe(stripe),
  origins: allowedOrigins(env), env,
}));
