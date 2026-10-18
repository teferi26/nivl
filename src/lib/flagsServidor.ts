// NIVL · Lectura de flags del servidor fuera de React (analítica y
// valoración). Lee `app_flags()` (0067, equipo servidor) con caché corta.
//
// Regla del contrato de Modos F1: si la lectura falla, TODO apagado. Un flag
// solo vale si es exactamente `true`.
//
// Integración: el equipo cliente publica `src/lib/flags.ts` → `useFlags()`.
// Si ese módulo expone una lectura sin hook, este archivo se reduce a
// reexportarla; hasta entonces es independiente para no pisarse.

import { supabase } from './supabase';

const CACHE_MS = 5 * 60_000;

let cache: { en: number; flags: Record<string, unknown> } | null = null;
let enCurso: Promise<Record<string, unknown>> | null = null;

async function leerTodos(): Promise<Record<string, unknown>> {
  if (cache && Date.now() - cache.en < CACHE_MS) return cache.flags;
  if (enCurso) return enCurso;
  enCurso = (async () => {
    try {
      const { data, error } = await supabase.rpc('app_flags');
      const flags = !error && data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
      // Un fallo no se guarda en caché: el siguiente intento vuelve a preguntar.
      if (!error) cache = { en: Date.now(), flags };
      return flags;
    } catch {
      return {};
    } finally {
      enCurso = null;
    }
  })();
  return enCurso;
}

/** ¿Está encendido el flag? false ante cualquier duda. */
export async function flagActivo(clave: string): Promise<boolean> {
  const flags = await leerTodos();
  return flags[clave] === true;
}

/** Solo tests. */
export function __olvidarFlags(): void {
  cache = null;
  enCurso = null;
}
