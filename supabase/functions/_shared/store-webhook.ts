// Same shared-secret authentication as the original RevenueCat webhook.
// Only after verification do we obtain authoritative Customer Info; the RPC
// keeps the existing financial event processor and applies access atomically.
import type { Db } from './db.ts';
import { eventUsers, reconcileStore } from './store-reconcile.ts';

async function igualSeguro(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const x = new Uint8Array(ha); const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const storeWebhookHandler = (admin: Db, auth: string, apiKey: string, fetcher: typeof fetch = fetch) => async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json(405, { error: 'method' });
  if (!auth) return json(401, { error: 'unauthorized' });
  const received = req.headers.get('authorization') ?? '';
  if (!(await igualSeguro(received, auth)) && !(await igualSeguro(received, `Bearer ${auth}`))) return json(401, { error: 'unauthorized' });
  let body: unknown;
  try { body = await req.json(); } catch { return json(200, { ok: false, ignored: 'json' }); }
  const event = (body as { event?: unknown } | null)?.event;
  if (!event || typeof event !== 'object' || typeof (event as { id?: unknown }).id !== 'string') {
    return json(200, { ok: false, ignored: 'sin_evento' });
  }
  try {
    const verified = event as Record<string, unknown>;
    const result = await reconcileStore(admin, eventUsers(verified), apiKey, verified, fetcher);
    // A conflict or unavailable provider is retryable, never a successful
    // acknowledgement of a transfer whose entitlement has not been applied.
    return result.ok ? json(200, result) : json(503, { error: 'pending' });
  } catch {
    return json(503, { error: 'reconcile' });
  }
};
