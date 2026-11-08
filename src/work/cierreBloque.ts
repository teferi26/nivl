// NIVL · WORK: qué pasa cuando un bloque termina (lógica sin pantalla, con tests).
//
// Una sola secuencia, en este orden (docs/modos/WORK.md):
//   1. se guardan las horas (idempotente por client_id);
//   2. si cuenta y sigue siendo su día, se paga SU misión (complete_quest, que
//      no paga dos veces: unique en BD);
//   3. si cuenta, se propaga el acto 'trabajo' (misiones fijas, reglas y UN
//      bloque del plan).
//
// Los efectos entran por `DepsCierre`: aquí no hay Supabase. El bloque en sí no
// paga nada; lo pagado sale de lo que devuelven las RPC, nunca de una cuenta
// hecha aquí.
//
// El paso 3 no se puede repetir (marcaría otro bloque del plan): `actoHecho` se
// guarda en el teléfono ANTES de propagar. Los pasos 1 y 2 sí: si fallan por
// falta de red, `reintentar` deja el cierre pendiente para la próxima apertura.

import { marcaMision, normalizarBloque, type CierreBloque, type EstadoBloque } from './bloque';

/** Lo justo del perfil para contar y celebrar lo pagado. */
export interface PerfilXp {
  xp_total: number;
  streak_days: number;
  protection_stones: number;
}

export interface ResultadoBloque {
  minutos: number;
  /** Las horas quedaron guardadas. */
  guardado: boolean;
  /** Fue un bloque de verdad. */
  cuenta: boolean;
  /** XP realmente sumado al perfil. */
  xp: number;
  /** Lo que el bloque ha marcado (títulos). */
  marcadas: string[];
  /** Faltó red a mitad: se reintenta en la próxima apertura. */
  reintentar: boolean;
  /** Para la cola de celebraciones; null si no se llegó a leer el perfil. */
  antes: PerfilXp | null;
  despues: PerfilXp | null;
}

export interface DepsCierre<P extends PerfilXp, Q extends { id: string; title: string; is_penalty: boolean }> {
  /** true si guardó; false si no hay dónde (sin la 0115). Lanza si falla la red. */
  registrar: (c: CierreBloque) => Promise<boolean>;
  perfil: () => Promise<P>;
  misiones: () => Promise<Q[]>;
  completar: (perfil: P, q: Q) => Promise<{ awarded: boolean; xp: number; profile: P }>;
  /** Persiste que el acto ya se propagó. Va ANTES de propagar. */
  fijarActoHecho: () => Promise<void>;
  propagar: (perfil: P) => Promise<{ xp: number; marcadas: string[]; profile: P }>;
}

export async function ejecutarCierre<P extends PerfilXp, Q extends { id: string; title: string; is_penalty: boolean }>(
  c: CierreBloque,
  hoy: string,
  actoHecho: boolean,
  d: DepsCierre<P, Q>,
): Promise<ResultadoBloque> {
  const base: ResultadoBloque = { minutos: c.minutos, guardado: false, cuenta: c.cuenta, xp: 0, marcadas: [], reintentar: false, antes: null, despues: null };
  if (c.guardar) {
    try {
      base.guardado = await d.registrar(c);
    } catch {
      base.reintentar = true;
    }
  }

  const pagaMision = marcaMision(c, hoy);
  const propaga = c.cuenta && c.fecha === hoy && !actoHecho;
  if (!pagaMision && !propaga) return base;

  let perfil: P;
  try {
    perfil = await d.perfil();
  } catch {
    return { ...base, reintentar: true };
  }
  const antes = perfil;
  let sumado = 0;
  const marcadas: string[] = [];
  let reintentar = base.reintentar;

  if (pagaMision) {
    try {
      const q = (await d.misiones()).find((x) => x.id === c.questId);
      if (q && !q.is_penalty) {
        const r = await d.completar(perfil, q);
        if (r.awarded) {
          sumado += r.xp;
          perfil = r.profile;
          marcadas.push(q.title);
        }
      }
    } catch {
      reintentar = true;
    }
  }

  if (propaga) {
    try {
      await d.fijarActoHecho();
      const p = await d.propagar(perfil);
      sumado += p.xp;
      perfil = p.profile;
      marcadas.push(...p.marcadas);
    } catch {
      // Propagar es accesorio: la misión y las horas ya están.
    }
  }

  // Lo PAGADO, no lo calculado: con el tope diario no se anuncia lo que no entró.
  const xp = Math.min(sumado, Math.max(0, perfil.xp_total - antes.xp_total));
  return { ...base, xp, marcadas, reintentar, antes, despues: perfil };
}

/** Un reintento suma a lo que ya se hizo; nada se olvida ni se cuenta dos veces. */
export function fundirResultado(previo: ResultadoBloque | null, nuevo: ResultadoBloque): ResultadoBloque {
  if (!previo) return nuevo;
  return {
    ...nuevo,
    guardado: previo.guardado || nuevo.guardado,
    xp: previo.xp + nuevo.xp,
    marcadas: [...previo.marcadas, ...nuevo.marcadas.filter((m) => !previo.marcadas.includes(m))],
    antes: previo.antes ?? nuevo.antes,
    despues: nuevo.despues ?? previo.despues,
  };
}

/** Lo que vive en el teléfono entre aperturas. */
export interface BloqueGuardado {
  estado: EstadoBloque;
  actoHecho: boolean;
  /** null hasta que se haya intentado cerrar. */
  resultado: ResultadoBloque | null;
  /** Ya se enseñó el resumen. */
  visto: boolean;
}

const perfilXp = (v: unknown): PerfilXp | null => {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
  if (typeof o.xp_total !== 'number') return null;
  return { xp_total: n(o.xp_total), streak_days: n(o.streak_days), protection_stones: n(o.protection_stones) };
};

function normalizarResultado(v: unknown): ResultadoBloque | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.minutos !== 'number' || !Number.isFinite(o.minutos)) return null;
  return {
    minutos: o.minutos,
    guardado: o.guardado === true,
    cuenta: o.cuenta === true,
    xp: typeof o.xp === 'number' && Number.isFinite(o.xp) ? Math.max(0, o.xp) : 0,
    marcadas: Array.isArray(o.marcadas) ? o.marcadas.filter((x): x is string => typeof x === 'string') : [],
    reintentar: o.reintentar === true,
    antes: perfilXp(o.antes),
    despues: perfilXp(o.despues),
  };
}

/** Lee lo guardado sin fiarse de nada; null si no sirve. */
export function normalizarGuardado(v: unknown): BloqueGuardado | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const estado = normalizarBloque(o.estado);
  if (!estado) return null;
  return { estado, actoHecho: o.actoHecho === true, resultado: normalizarResultado(o.resultado), visto: o.visto === true };
}
