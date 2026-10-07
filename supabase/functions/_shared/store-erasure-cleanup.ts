import type { Db } from './db.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT = 20;
type Lease = { user_id: string; lease_id: string };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

function secretMatches(received: string | null, expected: string): boolean {
  if (!expected || received === null) return false;
  const encoder = new TextEncoder();
  const a = encoder.encode(received);
  const b = encoder.encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  return diff === 0;
}

function leases(value: unknown): value is Lease[] {
  return Array.isArray(value) && value.length <= LIMIT && value.every(item =>
    !!item && typeof item === 'object' && typeof item.user_id === 'string' && UUID.test(item.user_id) &&
    typeof item.lease_id === 'string' && UUID.test(item.lease_id));
}

/** Repeated deletion is intentional even after 404: an aborted GET can finish remotely later. */
export const storeErasureCleanupHandler = (
  admin: Db, apiKey: string, secret: string, fetcher: typeof fetch = fetch,
) => async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (!secretMatches(request.headers.get('x-ritual-secret'), secret)) return json(401, { error: 'unauthorized' });
  if (!apiKey.trim().startsWith('sk_')) return json(503, { ok: false, pending: true });
  try {
    // The body is deliberately ignored. Only a service-only database lease may choose an identity.
    const { data, error } = await admin.rpc('claim_store_erasure_cleanup', { p_limit: LIMIT });
    if (error || !leases(data)) return json(503, { ok: false, pending: true });
    const results = await Promise.allSettled(data.map(async lease => {
      let deleted = false;
      try {
        const response = await fetcher(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(lease.user_id)}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${apiKey.trim()}`, Accept: 'application/json' },
          signal: AbortSignal.timeout(10_000),
        });
        await response.body?.cancel().catch(() => undefined);
        deleted = response.status === 200 || response.status === 404;
      } catch {
        // Lease expiry recovers process death; provider failures are persisted for retry.
      }
      const { data: finished, error: finishError } = await admin.rpc('finish_store_erasure_cleanup', {
        p_user: lease.user_id, p_lease: lease.lease_id, p_deleted: deleted,
      });
      if (finishError || finished !== true || !deleted) throw new Error('Cleanup pending');
    }));
    const pending = results.some(result => result.status === 'rejected');
    // Never return customer identifiers, provider errors, credentials, or claim tokens.
    return json(pending ? 503 : 200, { ok: !pending, processed: data.length, ...(pending ? { pending: true } : {}) });
  } catch {
    return json(503, { ok: false, pending: true });
  }
};
