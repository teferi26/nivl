// NIVL · Lectura del token de acceso de Supabase.
//
// Se busca primero en el entorno y después en un fichero local gitignorado,
// para que la credencial no tenga que pasar por ningún sitio que quede
// registrado. Se ignoran líneas en blanco y comentarios: da igual cómo quede
// el fichero al pegar.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const TOKEN_FILE = 'supabase-token.txt';

export function readToken(root) {
  if (process.env.SUPABASE_ACCESS_TOKEN?.trim()) return process.env.SUPABASE_ACCESS_TOKEN.trim();
  for (const nombre of [TOKEN_FILE, '.supabase-token']) {
    try {
      const linea = readFileSync(join(root, nombre), 'utf8')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find((l) => l && !l.startsWith('#'));
      if (linea) return linea;
    } catch {
      /* siguiente candidato */
    }
  }
  return undefined;
}

export function missingTokenMessage(root) {
  return (
    'Falta el token de acceso de Supabase.\n\n' +
    '  1. Genéralo en supabase.com/dashboard/account/tokens\n' +
    `  2. Pégalo dentro de: ${join(root, TOKEN_FILE)}\n\n` +
    'Ese fichero ya existe y está gitignorado. También vale por entorno:\n' +
    '  SUPABASE_ACCESS_TOKEN=sbp_...'
  );
}
