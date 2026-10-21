// NIVL · Modos: el chat del coach entre modos (FEEDBACK 1.0.11, punto 3).
//
// Si el coach deja una misión de OTRO modo (desde IRON: «repasa el tema 4»,
// que es de FOCUS), el chat lo avisa con «Ir a FOCUS», que cambia de mundo
// con la misma recarga que la rueda.
//
// De dónde sale el modo: el coach etiqueta la misión con `modos` en
// crear_mision (se guarda en quests.modes, 0068). En vivo llega en el evento
// `tool` (`mision: { titulo, modos }`); en el hilo guardado, en el bloque
// tool_use (su `input`) con su tool_result sin error.
//
// Reglas: sin modo no se avisa; si uno de sus modos es el mundo en el que
// estás, tampoco (ya la tienes aquí); solo modos activados (la rueda no lleva
// a los demás); varias misiones de otros modos: un aviso por modo, en el orden
// de la rueda. Con `modos_activos` apagado, nada.
//
// Puro: sin Supabase ni React Native, con test.

import { MODOS_ETIQUETA, type ModoEtiqueta, type ModoId } from './tipos';

/** Una misión que el coach acaba de crear con sus modos. */
export interface MisionConModos {
  titulo: string;
  modos: ModoEtiqueta[];
}

/** Un aviso del chat: el modo al que ir y las misiones que ha dejado allí. */
export interface AvisoModo {
  modo: ModoEtiqueta;
  titulos: string[];
}

/** Lo que hace falta saber del modo para decidir los avisos (de useModo). */
export interface EstadoAvisos {
  activo: boolean;
  modo: ModoId;
  activados: readonly ModoEtiqueta[];
}

/** Las etiquetas válidas, sin repetir y en el orden de la rueda. */
function modosLimpios(v: unknown): ModoEtiqueta[] {
  if (!Array.isArray(v)) return [];
  const crudo = v.map((x) => (typeof x === 'string' ? x.trim().toLowerCase() : ''));
  return MODOS_ETIQUETA.filter((m) => crudo.includes(m));
}

/** `{ titulo, modos }` de lo que manda el servidor o de un `input` guardado; null si no hay título o modos. */
export function misionDe(v: unknown): MisionConModos | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as { titulo?: unknown; modos?: unknown };
  const titulo = typeof o.titulo === 'string' ? o.titulo.trim() : '';
  const modos = modosLimpios(o.modos);
  return titulo && modos.length ? { titulo, modos } : null;
}

/** De una acción del stream (`tool`): solo crear_mision que salió bien. */
export function misionDeAccion(a: { name: string; ok: boolean; mision?: unknown }): MisionConModos | null {
  return a.name === 'crear_mision' && a.ok ? misionDe(a.mision) : null;
}

interface Bloque {
  type: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  is_error?: boolean;
}

/** Los ids de herramienta con resultado bueno en el hilo (los tool_result sin error). */
export function resultadosBuenos(mensajes: readonly { content?: readonly Bloque[] | null }[]): Set<string> {
  const ok = new Set<string>();
  for (const m of mensajes) {
    for (const b of m.content ?? []) {
      if (b && b.type === 'tool_result' && b.tool_use_id && !b.is_error) ok.add(b.tool_use_id);
    }
  }
  return ok;
}

/** Las misiones con modos que creó un turno guardado del coach (solo las que salieron bien). */
export function misionesDeMensaje(m: { content?: readonly Bloque[] | null }, buenos: ReadonlySet<string>): MisionConModos[] {
  const out: MisionConModos[] = [];
  for (const b of m.content ?? []) {
    if (!b || b.type !== 'tool_use' || b.name !== 'crear_mision' || !b.id || !buenos.has(b.id)) continue;
    const mision = misionDe(b.input);
    if (mision) out.push(mision);
  }
  return out;
}

/** Los avisos «Ir a {modo}» de un turno: uno por modo, en el orden de la rueda. */
export function avisosDeModo(misiones: readonly MisionConModos[], estado: EstadoAvisos): AvisoModo[] {
  if (!estado.activo || !misiones.length) return [];
  const porModo = new Map<ModoEtiqueta, string[]>();
  for (const mision of misiones) {
    const modos = modosLimpios(mision.modos);
    if (!modos.length || modos.includes(estado.modo as ModoEtiqueta)) continue;
    for (const m of modos) {
      if (!estado.activados.includes(m)) continue;
      const titulos = porModo.get(m) ?? [];
      if (!titulos.includes(mision.titulo)) titulos.push(mision.titulo);
      porModo.set(m, titulos);
    }
  }
  return MODOS_ETIQUETA.filter((m) => porModo.has(m)).map((m) => ({ modo: m, titulos: porModo.get(m)! }));
}
