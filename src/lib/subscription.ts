import { Linking } from 'react-native';
import { supabase } from './supabase';

export interface Subscription {
  user_id: string;
  status: 'none' | 'active' | 'trialing' | 'past_due' | 'canceled';
  current_period_end: string | null;
}

// Payment Link de Stripe (se crea en el dashboard de Stripe, sin código).
// Va en .env como EXPO_PUBLIC_STRIPE_PAYMENT_LINK.
const PAYMENT_LINK = process.env.EXPO_PUBLIC_STRIPE_PAYMENT_LINK;

// Interruptor del modelo de pago. Mientras NIVL sea de uso personal el muro
// no existe: el acceso es siempre premium y no se ofrece checkout en ninguna
// pantalla. Todo el camino de Stripe (webhook, tabla subscriptions, Payment
// Link) queda intacto: para reactivarlo basta con EXPO_PUBLIC_PAYWALL=on.
//
// Además evita el motivo de rechazo de la Guideline 3.1.1 de Apple, que
// prohíbe cobrar contenido digital fuera de las compras dentro de la app.
export function paywallEnabled(): boolean {
  return process.env.EXPO_PUBLIC_PAYWALL === 'on';
}

export function paymentsConfigured(): boolean {
  return paywallEnabled() && !!PAYMENT_LINK;
}

export async function fetchSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('user_id, status, current_period_end')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Subscription) ?? null;
}

export function isPremium(sub: Subscription | null): boolean {
  // Sin muro, todo el mundo es premium: el Oráculo va siempre por el servidor.
  if (!paywallEnabled()) return true;
  if (!sub) return false;
  if (sub.status !== 'active' && sub.status !== 'trialing') return false;
  if (sub.current_period_end && new Date(sub.current_period_end) <= new Date()) return false;
  return true;
}

// Abre el checkout de Stripe en el navegador. client_reference_id enlaza el
// pago con el usuario de Supabase: el webhook lo usa para activar su cuenta.
export async function openCheckout(userId: string): Promise<void> {
  if (!PAYMENT_LINK) {
    throw new Error('Los pagos aún no están configurados en este servidor.');
  }
  const url = `${PAYMENT_LINK}?client_reference_id=${encodeURIComponent(userId)}`;
  await Linking.openURL(url);
}

// Llama al Oráculo premium (Edge Function): la API key vive en el servidor y
// solo responde con suscripción activa. Devuelve el JSON del modelo.
export async function callPremiumOracle<T>(
  kind: 'generate' | 'weekly',
  payload: Record<string, unknown>,
): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Sesión caducada. Vuelve a entrar.');

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  let res: Response;
  try {
    res = await fetch(`${url}/functions/v1/oracle`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ kind, ...payload }),
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('El oráculo tardó demasiado. Reintenta.');
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }

  const body = (await res.json().catch(() => ({}))) as { result?: T; error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? `El oráculo no responde (HTTP ${res.status}).`);
  }
  if (!body.result) throw new Error('Respuesta vacía del oráculo.');
  return body.result;
}
