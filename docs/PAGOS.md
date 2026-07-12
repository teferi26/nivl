# NIVL · Configurar pagos y Oráculo premium (~20 min, una sola vez)

El código ya está listo. Esto es lo que solo tú puedes hacer con tus cuentas.
El dinero de las suscripciones llega a TU cuenta bancaria vía Stripe.

## 1. Migración

SQL Editor → pega `supabase/migrations/0006_suscripciones.sql` (después de 0005).

## 2. Stripe (cobrar)

1. Crea cuenta en [stripe.com](https://stripe.com) (o usa la de Franky) y completa los datos de cobro.
2. Product catalog → **+ Add product**: "NIVL Premium", precio recurrente mensual (p. ej. 4,99 €).
3. **Payment Links** → crea un link con ese producto. Copia la URL (`https://buy.stripe.com/...`).
4. En `.env` del proyecto añade:
   `EXPO_PUBLIC_STRIPE_PAYMENT_LINK=https://buy.stripe.com/...`

## 3. Edge Functions (el candado del servidor)

Con [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm i -g supabase`, `supabase login`):

```bash
cd nivl
supabase link --project-ref dueyufxxkiixdxighpaz
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy oracle
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx   # sale del paso 4
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxx      # TU key, nunca en la app
```

## 4. Webhook de Stripe

Stripe → Developers → Webhooks → **+ Add endpoint**:
- URL: `https://dueyufxxkiixdxighpaz.supabase.co/functions/v1/stripe-webhook`
- Eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- Copia el **Signing secret** (`whsec_...`) → `supabase secrets set STRIPE_WEBHOOK_SECRET=...` (paso 3).

## 5. Probar (modo test de Stripe)

Usa las keys `sk_test_...` y un Payment Link de test; tarjeta `4242 4242 4242 4242`.
Al pagar: el webhook marca `subscriptions.status='active'` para ese usuario y el
Oráculo le responde. Sin suscripción, la función devuelve 402 y la app muestra
el paywall.

## Cómo queda el modelo

| | Gratis | Premium (suscripción) |
|---|---|---|
| Misiones, XP, mazmorras, gym, dieta, diario, contrato, PB | ✅ | ✅ |
| Oráculo (misiones IA + análisis semanal) | Solo con SU propia API key | ✅ incluido (tope 100 consultas/mes) |

Tu coste de API está protegido tres veces: (1) la key vive solo en el servidor,
(2) sin suscripción activa la función devuelve 402, (3) cupo mensual por usuario
(`MONTHLY_CAP` en `supabase/functions/oracle/index.ts`).

## Nota tiendas (futuro)

Distribuyendo por APK/web, Stripe es perfecto. Si algún día publicas en Google
Play/App Store, sus normas exigen pagos in-app para contenido digital (15-30% de
comisión) — ese día tocará migrar a RevenueCat/IAP. No afecta ahora.
