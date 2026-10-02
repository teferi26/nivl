// Owner-requested erasure only. No scheduled sweep and no cross-service account operation.
import type { Db } from './db.ts';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

/** Same rule as account-erasure: only plain segments inside the caller's own folder. */
const ownPath = (path: unknown, userId: string): path is string =>
  typeof path === 'string' && path.startsWith(`${userId}/`) && !/[\\\u0000]/.test(path)
  && path.split('/').every(part => part !== '' && part !== '.' && part !== '..');

// health_erasure_paths keeps 'evidence' as plain strings (format of the deployed
// function) and lists 'progress' (body progress photos) as {bucket, path}.
const BUCKETS = ['evidence', 'progress'] as const;
type HealthObject = { bucket: typeof BUCKETS[number]; path: string };

function ownObjects(value: unknown, userId: string): HealthObject[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const objects: HealthObject[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      if (!ownPath(item, userId)) return null;
      objects.push({ bucket: 'evidence', path: item });
    } else if (item && typeof item === 'object' && (item as { bucket?: unknown }).bucket === 'progress'
      && ownPath((item as { path?: unknown }).path, userId)) {
      objects.push({ bucket: 'progress', path: (item as { path: string }).path });
    } else return null;
  }
  return objects;
}

export const healthErasureHandler = (admin: Db, userClient: (token: string) => Db) => async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') return json(405, { error: 'Método no permitido' });
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'No autenticado' });
  let withdrawn = false;
  try {
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return json(401, { error: 'Sesión inválida' });
    let body: unknown;
    try { body = await request.json(); } catch { return json(400, { error: 'Confirmación inválida' }); }
    if (!body || typeof body !== 'object' || (body as { confirm?: unknown }).confirm !== 'BORRAR_SALUD_DIARIO_FOTOS_COACH') {
      return json(400, { error: 'Confirma qué registros deseas borrar.' });
    }
    const user = userClient(token);
    const { data: job, error: withdrawError } = await user.rpc('withdraw_health_consent', { p_erase: true });
    if (withdrawError || job?.ok !== true || typeof job.job_id !== 'string') {
      return json(503, { error: 'No se ha podido registrar la retirada. Reintenta.' });
    }
    withdrawn = true;
    // Bounded work; a pending job can be resumed without re-enabling health.
    for (let batch = 0; batch < 20; batch++) {
      const { data: paths, error } = await user.rpc('health_erasure_paths', { p_job: job.job_id });
      const objects = error ? null : ownObjects(paths, auth.user.id);
      if (!objects) {
        return json(503, { error: 'El permiso está retirado. El borrado sigue pendiente.', pending: true });
      }
      if (!objects.length) {
        const { data, error: finished } = await admin.rpc('complete_health_erasure', { p_user: auth.user.id, p_job: job.job_id });
        return !finished && data?.ok === true ? json(200, { ok: true })
          : json(503, { error: 'El permiso está retirado. Falta completar el borrado.', pending: true });
      }
      for (const bucket of BUCKETS) {
        const names = objects.filter(item => item.bucket === bucket).map(item => item.path);
        if (!names.length) continue;
        const { error: removalError } = await admin.storage.from(bucket).remove(names);
        if (removalError) return json(503, { error: 'El permiso está retirado. Algunas fotos siguen pendientes de borrar.', pending: true });
      }
    }
    return json(202, { ok: false, pending: true, error: 'El permiso está retirado. Reintenta para terminar de borrar las fotos restantes.' });
  } catch {
    // Provider errors never reach the client or the logs; the job stays resumable.
    return withdrawn
      ? json(503, { error: 'El permiso está retirado. El borrado sigue pendiente.', pending: true })
      : json(503, { error: 'No se ha podido registrar la retirada. Reintenta.' });
  }
};
