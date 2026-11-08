// NIVL · FOCUS: la cola de sesiones por guardar (puro, con tests).
//
// Un bloque se termina justo al volver a primer plano, cuando la red puede no
// estar lista. La sesión entra en la cola ANTES de intentar guardarla y sale
// solo cuando el servidor la tiene: reintentar es seguro porque `client_id` es
// idempotente. Un fallo de red para el envío y deja el resto para luego; un tema
// o una misión ya borrados no pierden las horas, se guardan sin esa referencia.

import type { NuevaSesion } from './datos';

/** Un mes de bloques de sobra: si se llena, se van los más viejos. */
export const TOPE_COLA = 300;

export interface ColaEstudio {
  sesiones: NuevaSesion[];
  /** Día con sesiones ya guardadas cuyo pago de misiones falta por propagar. */
  pago: { fecha: string; misiones: string[] } | null;
}

export const COLA_VACIA: ColaEstudio = { sesiones: [], pago: null };

const esTexto = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const idONull = (v: unknown) => (esTexto(v) ? v : null);

function aSesion(v: unknown): NuevaSesion | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!esTexto(o.clientId) || !esTexto(o.fecha) || typeof o.minutos !== 'number' || !Number.isFinite(o.minutos)) return null;
  return {
    clientId: o.clientId,
    asignaturaId: idONull(o.asignaturaId),
    temaId: idONull(o.temaId),
    misionId: idONull(o.misionId),
    fecha: o.fecha,
    minutos: o.minutos,
    metodo: idONull(o.metodo),
    salidas: typeof o.salidas === 'number' ? o.salidas : 0,
  };
}

/** Lee lo guardado en el teléfono sin fiarse de nada. */
export function normalizarCola(v: unknown): ColaEstudio {
  if (!v || typeof v !== 'object') return COLA_VACIA;
  const o = v as Record<string, unknown>;
  const sesiones = Array.isArray(o.sesiones) ? o.sesiones.flatMap((x) => aSesion(x) ?? []) : [];
  const p = o.pago as Record<string, unknown> | null | undefined;
  const pago = p && esTexto(p.fecha) && Array.isArray(p.misiones) ? { fecha: p.fecha, misiones: p.misiones.filter(esTexto) } : null;
  return { sesiones, pago };
}

/** Añade sin repetir `clientId`; con la cola llena se quedan las más nuevas. */
export function anadirACola(cola: readonly NuevaSesion[], nuevas: readonly NuevaSesion[]): NuevaSesion[] {
  const vistos = new Set(cola.map((s) => s.clientId));
  const out = [...cola];
  for (const s of nuevas) {
    if (vistos.has(s.clientId)) continue;
    vistos.add(s.clientId);
    out.push(s);
  }
  return out.slice(-TOPE_COLA);
}

type ErrorConCodigo = { code?: unknown; message?: unknown } | null | undefined;

const RE_REFERENCIA = /(asignatura|examen|tema|mazo|misi[oó]n) ajen[ao]/i;

/** El tema, la asignatura o la misión del bloque ya no están (trigger de la 0076 o FK). */
export function esReferenciaPerdida(e: unknown): boolean {
  const x = e as ErrorConCodigo;
  if (x?.code === '23503') return true;
  return x?.code === '42501' && RE_REFERENCIA.test(String(x.message ?? ''));
}

/** El servidor ha dicho que no y lo seguirá diciendo: reintentar no sirve de nada. */
export function esRechazoDefinitivo(e: unknown): boolean {
  const c = (e as ErrorConCodigo)?.code;
  return typeof c === 'string' && /^[0-9A-Z]{5}$/.test(c) && !/^(08|40|53|57|58)/.test(c);
}

export interface Vaciado {
  enviadas: NuevaSesion[];
  quedan: NuevaSesion[];
}

/**
 * Envía la cola en orden. Si se ha borrado lo que apuntaba, va primero sin tema
 * ni misión y luego también sin asignatura. Un rechazo definitivo se descarta
 * para no taponar lo demás. Cualquier otro fallo (red) para aquí.
 */
export async function vaciarCola(cola: readonly NuevaSesion[], enviar: (s: NuevaSesion) => Promise<void>): Promise<Vaciado> {
  const enviadas: NuevaSesion[] = [];
  for (let i = 0; i < cola.length; i++) {
    const original = cola[i] as NuevaSesion;
    const intentos = [original, { ...original, temaId: null, misionId: null }, { ...original, temaId: null, misionId: null, asignaturaId: null }];
    let n = 0;
    for (;;) {
      const s = intentos[n] as NuevaSesion;
      try {
        await enviar(s);
        enviadas.push(s);
        break;
      } catch (e) {
        if (esReferenciaPerdida(e) && n < intentos.length - 1) {
          n++;
          continue;
        }
        if (esRechazoDefinitivo(e)) break;
        return { enviadas, quedan: cola.slice(i) };
      }
    }
  }
  return { enviadas, quedan: [] };
}
