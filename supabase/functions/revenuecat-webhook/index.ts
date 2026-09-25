// NIVL · Edge Function: webhook de RevenueCat → apply_store_event (0027).
//
// Solo autentica y entrega: toda la lógica (suscripción, venta, comisión,
// reembolso, idempotencia por id de evento) vive en la RPC, dentro de una
// transacción. Aquí no se decide nada de dinero.
//
// Despliegue (orden en docs/PLAN_NIVELES_Y_CREADORES.md §6):
//   supabase functions deploy revenuecat-webhook --no-verify-jwt
//   supabase secrets set REVENUECAT_WEBHOOK_AUTH=<el mismo valor exacto que
//     se pone en RevenueCat → Integrations → Webhooks → Authorization header>
// URL del webhook: https://<PROJECT>.supabase.co/functions/v1/revenuecat-webhook
//
// Contrato de RevenueCat (documentación vigente, 2026-09-25):
//   https://www.revenuecat.com/docs/integrations/webhooks
//   https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
//   · El cuerpo es { api_version, event: { id, type, app_user_id, … } }.
//   · Manda la cabecera Authorization con el valor configurado en el panel.
//   · Reintenta cualquier respuesta distinta de 200 (hasta 5 veces: 5, 10, 20,
//     40 y 80 min) con el MISMO id de evento. Por eso un evento que se ignora
//     responde 200, y solo un fallo real (la base no responde) responde 500
//     para que vuelva a llegar.

import { adminClient } from '../_shared/db.ts';

const AUTH = Deno.env.get('REVENUECAT_WEBHOOK_AUTH') ?? '';

/** Comparación en tiempo constante (sobre SHA-256, así la longitud tampoco se filtra). */
async function igualSeguro(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });

  // Sin secreto configurado no se acepta nada: un webhook abierto dejaría a
  // cualquiera escribir suscripciones.
  if (!AUTH) {
    console.error('revenuecat-webhook: falta REVENUECAT_WEBHOOK_AUTH');
    return json(401, { error: 'unauthorized' });
  }
  const recibido = req.headers.get('authorization') ?? '';
  // Se acepta el valor tal cual o con "Bearer " delante, según cómo se haya
  // escrito en el panel de RevenueCat.
  const ok = (await igualSeguro(recibido, AUTH)) || (await igualSeguro(recibido, `Bearer ${AUTH}`));
  if (!ok) return json(401, { error: 'unauthorized' });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    // Un cuerpo ilegible no mejora con reintentos.
    return json(200, { ok: false, ignored: 'json' });
  }
  const event = (body as { event?: unknown } | null)?.event;
  if (!event || typeof event !== 'object' || typeof (event as { id?: unknown }).id !== 'string') {
    return json(200, { ok: false, ignored: 'sin_evento' });
  }

  const { data, error } = await adminClient().rpc('apply_store_event', { p_event: event });
  if (error) {
    // Sin datos del usuario en el log: tipo e id bastan para buscarlo en store_events.
    const e = event as { id: string; type?: string };
    console.error('revenuecat-webhook: apply_store_event', e.type, e.id, error.message);
    return json(500, { error: 'apply' });
  }
  return json(200, (data ?? { ok: true }) as Record<string, unknown>);
});
