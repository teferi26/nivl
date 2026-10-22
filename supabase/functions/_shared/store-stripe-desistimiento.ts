// NIVL · «Botón de desistimiento» de la web (Directiva (UE) 2023/2673, que añade
// el art. 11 bis a la Directiva 2011/83/UE: función de desistimiento en línea
// tan fácil como contratar, con acuse de recibo). Contrato en
// docs/payment-audit/STRIPE-WEB.md.
//
// Este endpoint NO reembolsa ni cancela: REGISTRA la solicitud (fecha, cuenta,
// suscripción) en withdrawal_requests para que soporte la tramite con el
// reembolso proporcional (la parte no usada) y la cancelación en Stripe.
// Dos modos:
//  · con sesión (JWT de usuario): uid y correo del JWT, suscripción de su fila;
//  · formulario (sin sesión, con la clave anon): correo + código de pedido (id
//    'sub_…' o número de factura). Se comprueba contra Stripe si el correo es el
//    del cliente, pero la respuesta es la MISMA se verifique o no (no revela si
//    un correo es cliente) y la solicitud se guarda siempre: perder una
//    solicitud de desistimiento es peor que guardar una falsa.
import { corsHeaders, json, type EnvGetter } from './store-stripe-config.ts';
import type { AuthUser } from './store-stripe-checkout.ts';
import type { SubscriptionRow } from './store-stripe.ts';

export type WithdrawalSub = { id: string; customer: string; start_date: number | null };
export interface DesistimientoStripe {
  subscription(id: string): Promise<WithdrawalSub | null>;
  subscriptionByInvoiceNumber(number: string): Promise<WithdrawalSub | null>;
  customerEmail(customerId: string): Promise<string | null>;
}
export type WithdrawalRecord = {
  user_id: string | null; email: string | null; source: 'cuenta' | 'formulario'; order_ref: string | null;
  stripe_subscription_id: string | null; stripe_customer_id: string | null;
  verified: boolean; within_period: boolean | null; reason: string | null;
};
export interface DesistimientoRepo {
  subscription(userId: string): Promise<SubscriptionRow | null>;
  userBySubscription(subscriptionId: string): Promise<string | null>;
  recentByEmail(email: string, sinceIso: string): Promise<number>;
  insert(record: WithdrawalRecord): Promise<{ id: string; requested_at: string }>;
}
export interface DesistimientoDeps {
  auth(token: string): Promise<AuthUser | null>;
  repo: DesistimientoRepo;
  stripe: DesistimientoStripe | null;
  origins: Set<string>;
  env?: EnvGetter;
  now?: () => number;
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const ORDER = /^(sub_[A-Za-z0-9]{8,64}|[A-Z0-9]{4,12}-[0-9]{3,6})$/i;
const PERIOD_MS = 14 * 24 * 3600_000;
const PER_EMAIL_PER_DAY = 5;

export const ACUSE =
  'Hemos recibido tu solicitud de desistimiento. Te escribiremos al correo de tu cuenta para confirmarla '
  + 'y devolverte la parte no usada. Guarda la referencia.';

const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export const desistimientoHandler = (deps: DesistimientoDeps) => async (req: Request): Promise<Response> => {
  const cors = corsHeaders(deps.origins, req);
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: origin && cors['Access-Control-Allow-Origin'] ? 204 : 403, headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'metodo' }, cors);
  if (origin && !cors['Access-Control-Allow-Origin']) return json(403, { error: 'origen' }, cors);
  const now = (deps.now ?? Date.now)();
  let body: Record<string, unknown> = {};
  try { const parsed = await req.json(); if (parsed && typeof parsed === 'object') body = parsed as Record<string, unknown>; } catch { /* vacío */ }
  const reason = clean(body.motivo, 500) || null;

  // ¿Sesión de usuario? La clave anon también es un Bearer: si getUser falla, es formulario.
  const token = /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') ?? '')?.[1];
  let user: AuthUser | null = null;
  if (token) { try { user = await deps.auth(token); } catch { user = null; } }

  const record: WithdrawalRecord = {
    user_id: null, email: null, source: user ? 'cuenta' : 'formulario', order_ref: null,
    stripe_subscription_id: null, stripe_customer_id: null, verified: false, within_period: null, reason,
  };
  let sub: WithdrawalSub | null = null;
  try {
    if (user) {
      record.user_id = user.id.toLowerCase();
      record.email = user.email?.toLowerCase() ?? null;
      const row = await deps.repo.subscription(record.user_id);
      record.stripe_customer_id = row?.stripe_customer_id ?? null;
      if (row?.provider === 'stripe' && row.stripe_subscription_id) {
        record.stripe_subscription_id = row.stripe_subscription_id;
        sub = deps.stripe ? await deps.stripe.subscription(row.stripe_subscription_id).catch(() => null) : null;
        record.verified = true; // la sesión prueba la cuenta y la fila prueba la suscripción
      }
    } else {
      const email = clean(body.email, 320).toLowerCase();
      const order = clean(body.pedido, 80);
      if (!EMAIL.test(email) || !ORDER.test(order)) {
        return json(400, { error: 'datos', message: 'Escribe el correo con el que pagaste y el código de pedido (empieza por sub_ o es el número de la factura).' }, cors);
      }
      const since = new Date(now - 24 * 3600_000).toISOString();
      if (await deps.repo.recentByEmail(email, since) >= PER_EMAIL_PER_DAY) {
        return json(429, { error: 'demasiadas', message: 'Ya hemos recibido tu solicitud. Te escribiremos pronto.' }, cors);
      }
      record.email = email;
      record.order_ref = order;
      if (deps.stripe) {
        try {
          sub = order.toLowerCase().startsWith('sub_')
            ? await deps.stripe.subscription(order)
            : await deps.stripe.subscriptionByInvoiceNumber(order.toUpperCase());
          if (sub) {
            const owner = (await deps.stripe.customerEmail(sub.customer))?.toLowerCase() ?? null;
            if (owner && owner === email) {
              record.verified = true;
              record.stripe_subscription_id = sub.id;
              record.stripe_customer_id = sub.customer;
              record.user_id = await deps.repo.userBySubscription(sub.id);
            } else {
              sub = null; // no se guarda ni se usa una suscripción ajena
            }
          }
        } catch { sub = null; /* Stripe caído: se guarda sin verificar */ }
      }
    }
    if (sub?.start_date) record.within_period = now - sub.start_date * 1000 <= PERIOD_MS;
    const saved = await deps.repo.insert(record);
    return json(202, { ok: true, referencia: saved.id, recibido_at: saved.requested_at, message: ACUSE }, cors);
  } catch (error) {
    console.error('desistimiento error:', error instanceof Error ? error.message : 'unknown');
    return json(503, { error: 'no_disponible', message: 'No hemos podido registrar la solicitud. Escríbenos a soporte o inténtalo de nuevo.' }, cors);
  }
};

/** supabase-js (service role) sobre withdrawal_requests (propuesta SQL NNNN-borrador-desistimiento). */
export function supabaseDesistimientoRepo(admin: import('./db.ts').Db): DesistimientoRepo {
  return {
    async subscription(userId) {
      const { data, error } = await admin.from('subscriptions')
        .select('user_id,status,plan,provider,current_period_end,stripe_subscription_id,stripe_customer_id')
        .eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return (data as SubscriptionRow | null) ?? null;
    },
    async userBySubscription(subscriptionId) {
      const { data, error } = await admin.from('subscriptions').select('user_id').eq('stripe_subscription_id', subscriptionId).maybeSingle();
      if (error) throw error;
      return (data as { user_id: string } | null)?.user_id ?? null;
    },
    async recentByEmail(email, sinceIso) {
      const { count, error } = await admin.from('withdrawal_requests').select('id', { count: 'exact', head: true })
        .eq('email', email).gte('requested_at', sinceIso);
      if (error) throw error;
      return count ?? 0;
    },
    async insert(record) {
      const { data, error } = await admin.from('withdrawal_requests').insert(record).select('id,requested_at').single();
      if (error) throw error;
      return data as { id: string; requested_at: string };
    },
  };
}
