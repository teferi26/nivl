// NIVL · Abrir una sesión real de usuario desde un script.
//
// Los scripts no tienen contraseña: piden al proyecto un enlace mágico de un
// solo uso con la clave de servicio, lo canjean por un JWT y a partir de ahí
// hablan con la base de datos COMO EL USUARIO. Eso importa: así las RLS siguen
// aplicando y un fallo en un script no puede tocar datos de otra cuenta.
//
// Ninguna credencial se imprime nunca, ni siquiera en los errores.

import { missingTokenMessage, readToken } from './token.mjs';

export const REF = 'dueyufxxkiixdxighpaz';
export const SB_URL = `https://${REF}.supabase.co`;

export async function abrirSesion(root, email = process.env.NIVL_EMAIL ?? 'teferi@springmarket.es') {
  const pat = readToken(root);
  if (!pat) {
    console.error(missingTokenMessage(root));
    process.exit(1);
  }

  const keysRes = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys`, {
    headers: { authorization: `Bearer ${pat}` },
  });
  if (!keysRes.ok) {
    console.error('No se pudieron leer las claves del proyecto:', keysRes.status);
    process.exit(1);
  }
  const keys = await keysRes.json();
  const find = (n) => keys.find((k) => k.name === n || k.type === n)?.api_key;
  const anon = find('anon');
  const service = find('service_role');
  if (!anon || !service) {
    console.error('Faltan las claves anon/service_role en la respuesta.');
    process.exit(1);
  }

  const linkRes = await fetch(`${SB_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: service, authorization: `Bearer ${service}`, 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
  });
  if (!linkRes.ok) {
    console.error('No se pudo generar el enlace de sesión:', (await linkRes.text()).slice(0, 300));
    process.exit(1);
  }
  const link = await linkRes.json();
  const hashed = link.properties?.hashed_token ?? link.hashed_token;

  const verifyRes = await fetch(
    `${SB_URL}/auth/v1/verify?token=${encodeURIComponent(hashed)}&type=magiclink&redirect_to=${encodeURIComponent('http://localhost/')}`,
    { headers: { apikey: anon }, redirect: 'manual' },
  );
  const loc = verifyRes.headers.get('location') ?? '';
  const params = new URLSearchParams(loc.split('#')[1] ?? '');
  const jwt = params.get('access_token');
  if (!jwt) {
    console.error('No se obtuvo sesión. HTTP', verifyRes.status, loc.slice(0, 200));
    process.exit(1);
  }

  const userId = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).sub;
  return { jwt, anon, userId, email, url: SB_URL };
}

/** Cliente REST mínimo sobre PostgREST, ya autenticado como el usuario. */
export function rest({ jwt, anon, url }) {
  const headers = {
    apikey: anon,
    authorization: `Bearer ${jwt}`,
    'content-type': 'application/json',
  };
  return {
    async select(tabla, query = '') {
      const r = await fetch(`${url}/rest/v1/${tabla}?${query}`, { headers });
      if (!r.ok) throw new Error(`${tabla}: ${r.status} ${(await r.text()).slice(0, 300)}`);
      return r.json();
    },
    /**
     * `onConflict` no es opcional cuando la colisión es contra un índice único
     * que no es la clave primaria: sin él PostgREST mira solo la primaria,
     * `resolution=ignore-duplicates` no se aplica y la inserción revienta con
     * un 409. Es exactamente lo que pasa con (user_id, dedup_hash).
     */
    async insert(tabla, filas, { upsert = false, ignorarDuplicados = false, onConflict = '' } = {}) {
      if (!filas.length) return [];
      const prefer = [
        'return=representation',
        upsert ? 'resolution=merge-duplicates' : null,
        ignorarDuplicados ? 'resolution=ignore-duplicates' : null,
      ]
        .filter(Boolean)
        .join(',');
      const qs = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
      const r = await fetch(`${url}/rest/v1/${tabla}${qs}`, {
        method: 'POST',
        headers: { ...headers, prefer },
        body: JSON.stringify(filas),
      });
      if (!r.ok) throw new Error(`${tabla}: ${r.status} ${(await r.text()).slice(0, 400)}`);
      return r.json();
    },
    async update(tabla, query, cambios) {
      const r = await fetch(`${url}/rest/v1/${tabla}?${query}`, {
        method: 'PATCH',
        headers: { ...headers, prefer: 'return=representation' },
        body: JSON.stringify(cambios),
      });
      if (!r.ok) throw new Error(`${tabla}: ${r.status} ${(await r.text()).slice(0, 300)}`);
      return r.json();
    },
  };
}
