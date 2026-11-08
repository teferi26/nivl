// NIVL · Edge Function: previsión por horas para IRON Resistencia.
//
// Dos acciones:
//   · Sin parámetros: la previsión de la ciudad GUARDADA en `entreno_perfil` del
//     usuario autenticado. No admite coordenadas del cliente, y por eso ni se
//     lee el cuerpo: exige permiso de salud y ubicación consentida.
//   · `?accion=buscar` con `{ buscar }` en el cuerpo: busca una ciudad por su
//     nombre. El texto va en el cuerpo para que no acabe en los logs de URLs.
//
// Nada de logs con coordenadas, texto de búsqueda ni URLs.

import { adminClient, userClient, type Db } from '../_shared/db.ts';
import { HEALTH_REQUIRED, requireHealth } from '../_shared/health.ts';
import type { HoraClima } from '../_shared/mejorHora.ts';
import { buscarCiudades, fetchPrevision, type Ciudad } from '../_shared/tiempo.ts';

export interface Deps {
  admin: Db;
  userClient: (token: string) => Db;
  prevision: (lat: number, lon: number, tz: string) => Promise<HoraClima[] | null>;
  buscar: (texto: string) => Promise<Ciudad[] | null>;
}

export function depsPorDefecto(): Deps {
  return { admin: adminClient(), userClient, prevision: fetchPrevision, buscar: buscarCiudades };
}

const MIN_BUSQUEDA = 2;
const MAX_BUSQUEDA = 80;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** Lo buscado en una línea, sin controles. Null si no se puede buscar. */
export function textoBusqueda(v: string): string | null {
  // deno-lint-ignore no-control-regex
  const t = v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length >= MIN_BUSQUEDA && t.length <= MAX_BUSQUEDA ? t : null;
}

export function crearHandler(deps: Deps = depsPorDefecto()) {
  return async function handler(req: Request): Promise<Response> {
    if (req.method !== 'GET' && req.method !== 'POST') return json(405, { error: 'metodo' });
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json(401, { error: 'no_autenticado' });
    const { data: u, error: uErr } = await deps.admin.auth.getUser(token);
    if (uErr || !u?.user) return json(401, { error: 'sesion_invalida' });
    const userId = u.user.id;

    try {
      if (new URL(req.url).searchParams.get('accion') === 'buscar') {
        if (req.method !== 'POST') return json(405, { error: 'metodo' });
        const cuerpo = (await req.json().catch(() => null)) as { buscar?: unknown } | null;
        const texto = typeof cuerpo?.buscar === 'string' ? textoBusqueda(cuerpo.buscar) : null;
        if (!texto) return json(400, { error: 'busqueda' });
        const ciudades = await deps.buscar(texto);
        return ciudades === null ? json(502, { error: 'sin_servicio' }) : json(200, ciudades);
      }

      const sb = deps.userClient(token);
      await requireHealth(sb, userId);
      const [perfilRes, cuentaRes] = await Promise.all([
        sb.from('entreno_perfil').select('ubicacion_lat, ubicacion_lon, ubicacion_consentida_en').eq('user_id', userId).maybeSingle(),
        sb.from('profiles').select('timezone').eq('id', userId).maybeSingle(),
      ]);
      if (perfilRes.error) {
        console.error('prevision: entreno_perfil', perfilRes.error.code ?? 'sin_codigo');
        return json(503, { error: 'sin_servicio' });
      }
      const p = perfilRes.data as { ubicacion_lat: number | null; ubicacion_lon: number | null; ubicacion_consentida_en: string | null } | null;
      if (!p || p.ubicacion_lat === null || p.ubicacion_lon === null || !p.ubicacion_consentida_en) {
        return json(409, { error: 'sin_ubicacion' });
      }

      const zona = (cuentaRes.data as { timezone?: unknown } | null)?.timezone;
      const horas = await deps.prevision(Number(p.ubicacion_lat), Number(p.ubicacion_lon), typeof zona === 'string' ? zona : 'auto');
      return horas === null ? json(502, { error: 'sin_servicio' }) : json(200, horas);
    } catch (e) {
      if (e instanceof Error && e.message === HEALTH_REQUIRED) return json(403, { error: HEALTH_REQUIRED });
      console.error('prevision: fallo', e instanceof Error ? e.name : 'error');
      return json(500, { error: 'sin_servicio' });
    }
  };
}
