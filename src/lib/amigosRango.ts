// NIVL · Rango registrado de mis amigos (0052 `friends_ranks`), para pintar su
// marco en el ranking de Amigos. Es adorno: nunca lanza. Con el servidor aún
// sin la 0052 (PGRST202 / 42883), sin red o con cualquier fallo, el Map sale
// vacío y cada amigo se pinta con el marco liso (rank = null).

import type { Rank } from '@/design/tokens';
import { supabase } from './supabase';

const RANGOS: ReadonlySet<string> = new Set(['E', 'D', 'C', 'B', 'A', 'S']);

/** Filas de la RPC → Map user_id → rango. Ignora lo que no sea un rango válido. */
export function mapaDeRangos(data: unknown): Map<string, Rank> {
  const out = new Map<string, Rank>();
  if (!Array.isArray(data)) return out;
  for (const fila of data) {
    if (!fila || typeof fila !== 'object') continue;
    const { user_id, rango } = fila as { user_id?: unknown; rango?: unknown };
    if (typeof user_id === 'string' && user_id && typeof rango === 'string' && RANGOS.has(rango)) {
      out.set(user_id, rango as Rank);
    }
  }
  return out;
}

export async function fetchRangosAmigos(): Promise<Map<string, Rank>> {
  try {
    const { data, error } = await supabase.rpc('friends_ranks');
    // PGRST202 / 42883: la 0052 aún no está en el servidor. Cualquier otro
    // error tampoco rompe nada: el marco es adorno.
    if (error) return new Map();
    return mapaDeRangos(data);
  } catch {
    return new Map();
  }
}
