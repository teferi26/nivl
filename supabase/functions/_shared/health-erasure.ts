// Owner-requested erasure only. No scheduled sweep and no cross-service account operation.
import type { Db } from './db.ts';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const healthErasureHandler = (admin: Db, userClient: (token: string) => Db) => async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') return json(405, { error: 'Método no permitido' });
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'No autenticado' });
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
  const prefix = `${auth.user.id}/`;
  // Bounded work; a pending job can be resumed without re-enabling health.
  for (let batch = 0; batch < 20; batch++) {
    const { data: paths, error } = await user.rpc('health_erasure_paths', { p_job: job.job_id });
    if (error || !Array.isArray(paths) || paths.some(p => typeof p !== 'string' || !p.startsWith(prefix) || p.includes('/../'))) {
      return json(503, { error: 'El permiso está retirado. El borrado sigue pendiente.', pending: true });
    }
    if (!paths.length) {
      const { data, error: finished } = await admin.rpc('complete_health_erasure', { p_user: auth.user.id, p_job: job.job_id });
      return !finished && data?.ok === true ? json(200, { ok: true })
        : json(503, { error: 'El permiso está retirado. Falta completar el borrado.', pending: true });
    }
    const { error: removalError } = await admin.storage.from('evidence').remove(paths);
    if (removalError) return json(503, { error: 'El permiso está retirado. Algunas fotos siguen pendientes de borrar.', pending: true });
  }
  return json(202, { ok: false, pending: true, error: 'El permiso está retirado. Reintenta para terminar de borrar las fotos restantes.' });
};