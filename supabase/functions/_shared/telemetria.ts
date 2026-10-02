// NIVL · Telemetría de coste del coach (coach v2, L0).
//
// Módulo PURO (sin red ni cliente de Supabase): recibe el cliente ya creado.
//
// Las columnas de telemetría de coach_runs (route, intent, tools_offered,
// tool_calls, iterations, state_chars) llegan con la migración 0047. Para que
// la función se pueda desplegar ANTES que la migración, la fila se intenta con
// ellas y, si la base dice que una columna no existe, se repite sin ellas: el
// gasto (lo que lee el candado) se apunta siempre.

export interface Telemetria {
  /** Ruta del turno: 'completa' (coach con todo), 'registro' (parte, L3), 'mecanica' (Haiku sin contexto)… */
  route?: string | null;
  /** Intención detectada del mensaje ('afirmacion', 'dato', 'general') o null en rituales. */
  intent?: string | null;
  tools_offered?: number | null;
  tool_calls?: number | null;
  /** Llamadas al proveedor del turno (incluye reintentos). */
  iterations?: number | null;
  /** Tamaño en caracteres del estado del día que viajó en el sistema. */
  state_chars?: number | null;
}

export const COLUMNAS_TELEMETRIA = ['route', 'intent', 'tools_offered', 'tool_calls', 'iterations', 'state_chars'] as const;

const SMALLINT_MAX = 32_767;
const INT_MAX = 2_147_483_647;

function entero(v: unknown, max: number): number | null {
  const n = Number(v);
  if (v === null || v === undefined || !Number.isFinite(n)) return null;
  return Math.min(max, Math.max(0, Math.round(n)));
}

function etiqueta(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, 40);
  return t || null;
}

/** Las columnas de telemetría, saneadas (sin textos libres, enteros acotados). */
export function columnasTelemetria(t: Telemetria): Record<string, string | number | null> {
  return {
    route: etiqueta(t.route),
    intent: etiqueta(t.intent),
    tools_offered: entero(t.tools_offered, SMALLINT_MAX),
    tool_calls: entero(t.tool_calls, SMALLINT_MAX),
    iterations: entero(t.iterations, SMALLINT_MAX),
    state_chars: entero(t.state_chars, INT_MAX),
  };
}

/**
 * ¿El error es "esa columna no existe"? Postgres da 42703; PostgREST, cuando
 * la columna del cuerpo no está en su caché de esquema, responde PGRST204
 * ("Could not find the 'x' column of 'coach_runs' in the schema cache").
 */
export function esColumnaInexistente(err: unknown): boolean {
  const e = err as { code?: unknown; message?: unknown } | null;
  if (!e) return false;
  if (e.code === '42703' || e.code === 'PGRST204') return true;
  return typeof e.message === 'string' && /column .* (does not exist|of '.*' in the schema cache)/i.test(e.message);
}

interface Insertable {
  // deno-lint-ignore no-explicit-any
  from(tabla: string): { insert(fila: Record<string, unknown>): PromiseLike<{ error: any }> };
}

/**
 * Inserta una fila de coach_runs con telemetría; si la base aún no tiene las
 * columnas (migración 0047 sin aplicar), la repite sin ellas.
 */
// deno-lint-ignore no-explicit-any
export async function insertarRun(db: Insertable, fila: Record<string, unknown>, t: Telemetria): Promise<{ error: any }> {
  const completa = { ...fila, ...columnasTelemetria(t) };
  const primero = await db.from('coach_runs').insert(completa);
  if (!primero.error || !esColumnaInexistente(primero.error)) return primero;
  return await db.from('coach_runs').insert(fila);
}
