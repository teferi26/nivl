import type { Db } from './db.ts';

const CONFIRMATION = 'BORRAR_CUENTA_NIVL';
// Same list as account_erasure_paths/account_erasure_ready/require_account_storage_active in SQL.
const BUCKETS = ['evidence', 'avatars', 'progress'] as const;
type OwnedObject = { bucket: typeof BUCKETS[number]; path: string };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});
const pending = () => json(503, { ok: false, pending: true, error: 'El borrado sigue pendiente. Reintenta para completarlo.' });
// Auth signs the token and then reports that its subject no longer exists:
// the account was already erased (lost response, concurrent retry). Only this
// exact code counts; an expired or revoked session is NOT proof of erasure.
const userGone = (error: unknown) => !!error && typeof error === 'object'
  && ((error as { code?: unknown }).code === 'user_not_found' || (error as { status?: unknown }).status === 404);
const erased = () => json(200, { ok: true });

function ownObjects(value: unknown, userId: string): value is OwnedObject[] {
  return Array.isArray(value) && value.length <= 100 && value.every(item => {
    if (!item || typeof item !== 'object') return false;
    const { bucket, path } = item;
    return BUCKETS.includes(bucket) && typeof path === 'string' && path.startsWith(`${userId}/`)
      && !/[\\\u0000]/.test(path) && path.split('/').every(part => part !== '' && part !== '.' && part !== '..');
  });
}

export interface ErasureOptions {
  /** RevenueCat SECRET key (sk_…). Public SDK keys can't delete and are ignored. */
  revenueCatKey?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

/**
 * RevenueCat customer erasure (GDPR). 200 and 404 both mean "ensure deleted"
 * (https://www.revenuecat.com/docs/api-v1/customers#tag/customers/operation/delete-subscriber).
 * Runs before Auth deletion: if it fails, Auth stays and the app's idempotent
 * retry repeats it. It does NOT cancel a store subscription.
 */
async function eraseRevenueCatCustomer(userId: string, opts: ErasureOptions): Promise<boolean> {
  const key = opts.revenueCatKey?.trim() ?? '';
  if (!key.startsWith('sk_')) {
    // No personal data in the log line; deployment config issue only.
    console.warn('account-erasure: REVENUECAT_API_KEY (secret) not configured; RevenueCat customer not erased');
    return true;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000);
  try {
    const response = await (opts.fetcher ?? fetch)(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }, signal: controller.signal },
    );
    await response.body?.cancel().catch(() => undefined);
    return response.status === 200 || response.status === 404;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Auth stays alive until all real files have been removed. No SQL object DELETE. */
export const accountErasureHandler = (admin: Db, opts: ErasureOptions = {}) => async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') return json(405, { error: 'Método no permitido' });
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '');
  if (!match) return json(401, { error: 'No autenticado' });
  let started = false;
  try {
    // Body IDs are never trusted: every operation targets the verified caller.
    const { data: auth, error: authError } = await admin.auth.getUser(match[1]);
    if (authError && (authError as { code?: unknown }).code === 'user_not_found') return erased();
    if (authError || !auth.user) return json(401, { error: 'Sesión inválida' });
    let body: unknown;
    try { body = await request.json(); } catch { return json(400, { error: 'Confirmación inválida' }); }
    if (!body || typeof body !== 'object' || (body as { confirm?: unknown }).confirm !== CONFIRMATION) {
      return json(400, { error: 'Confirma el borrado de tu cuenta de NIVL.' });
    }
    const userId = auth.user.id;
    // Idempotent job; commits write/upload/AI guards BEFORE touching Storage.
    const { data: job, error: beginError } = await admin.rpc('begin_account_erasure', { p_user: userId });
    if (beginError || job?.ok !== true || typeof job.job_id !== 'string') return pending();
    started = true;
    for (let batch = 0; batch < 20; batch++) {
      const args = { p_user: userId, p_job: job.job_id };
      const { data: objects, error } = await admin.rpc('account_erasure_paths', args);
      if (error || !ownObjects(objects, userId)) return pending();
      if (objects.length === 0) {
        // Independent final database check, including ownership/job identity.
        // The upload trigger keeps this result valid until Auth is deleted.
        const { data: ready, error: readyError } = await admin.rpc('account_erasure_ready', args);
        if (readyError || ready !== true) return pending();
        if (!(await eraseRevenueCatCustomer(userId, opts))) return pending();
        const { error: deleteError } = await admin.auth.admin.deleteUser(userId, false);
        return !deleteError || userGone(deleteError) ? erased() : pending();
      }
      for (const bucket of BUCKETS) {
        const paths = objects.filter(item => item.bucket === bucket).map(item => item.path);
        if (!paths.length) continue;
        const { error: removeError } = await admin.storage.from(bucket).remove(paths);
        if (removeError) return pending();
      }
      // Always re-read metadata; a success response alone is not proof of erasure.
    }
    return json(202, { ok: false, pending: true, error: 'Quedan archivos por borrar. Reintenta para terminar.' });
  } catch {
    // Provider errors/credentials and paths never enter logs or client responses.
    return started ? pending() : json(503, { ok: false, error: 'No se ha podido completar el borrado. Reintenta.' });
  }
};
