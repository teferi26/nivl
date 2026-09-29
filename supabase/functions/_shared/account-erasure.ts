import type { Db } from './db.ts';

const CONFIRMATION = 'BORRAR_CUENTA_NIVL';
const BUCKETS = ['evidence', 'avatars'] as const;
type OwnedObject = { bucket: typeof BUCKETS[number]; path: string };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});
const pending = () => json(503, { ok: false, pending: true, error: 'El borrado sigue pendiente. Reintenta para completarlo.' });

function ownObjects(value: unknown, userId: string): value is OwnedObject[] {
  return Array.isArray(value) && value.length <= 100 && value.every(item => {
    if (!item || typeof item !== 'object') return false;
    const { bucket, path } = item;
    return BUCKETS.includes(bucket) && typeof path === 'string' && path.startsWith(`${userId}/`)
      && !/[\\\u0000]/.test(path) && path.split('/').every(part => part !== '' && part !== '.' && part !== '..');
  });
}

/** Auth stays alive until all real files have been removed. No SQL object DELETE. */
export const accountErasureHandler = (admin: Db) => async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') return json(405, { error: 'Método no permitido' });
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '');
  if (!match) return json(401, { error: 'No autenticado' });
  let started = false;
  try {
    // Body IDs are never trusted: every operation targets the verified caller.
    const { data: auth, error: authError } = await admin.auth.getUser(match[1]);
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
        const { error: deleteError } = await admin.auth.admin.deleteUser(userId, false);
        return deleteError ? pending() : json(200, { ok: true });
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
