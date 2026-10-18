// NIVL · Consentimiento de la medición de uso (parte pura). Dictamen
// `coordinacion-winter-arc/LSSI-ANALITICA-NIVL.md` (18/10/2026): la analítica
// del embudo guarda y lee datos en el móvil y no es necesaria para el
// servicio, así que necesita consentimiento previo (art. 22.2 LSSI), y la base
// RGPD es ese consentimiento (art. 6.1.a).
//
// Reglas:
//   · Sin una decisión «acepta» VIGENTE no se guarda ni se envía nada.
//   · Vigente = de la versión actual del texto y con menos de 24 meses
//     (Guía de cookies de la AEPD, 3.2.8). Un rechazo también caduca a los 24
//     meses: entonces se puede volver a preguntar, una vez.
//   · Cambiar el texto de forma material = subir VERSION_CONSENTIMIENTO
//     (solo [a-z0-9_]: viaja como prop del evento `consentimiento_analitica`).

export const VERSION_CONSENTIMIENTO = 'a2026_10';
export const MESES_VALIDEZ_CONSENTIMIENTO = 24;

export type Decision = 'acepta' | 'rechaza';

export interface DecisionGuardada {
  decision: Decision;
  version: string;
  /** ISO de cuándo se decidió. */
  fecha: string;
}

export function leerDecision(crudo: string | null): DecisionGuardada | null {
  if (!crudo) return null;
  try {
    const v = JSON.parse(crudo) as Partial<DecisionGuardada>;
    if ((v.decision !== 'acepta' && v.decision !== 'rechaza') || typeof v.version !== 'string' || typeof v.fecha !== 'string') {
      return null;
    }
    if (!Number.isFinite(Date.parse(v.fecha))) return null;
    return { decision: v.decision, version: v.version, fecha: v.fecha };
  } catch {
    return null;
  }
}

function sumarMesesIso(iso: string, n: number): number {
  const d = new Date(iso);
  const r = new Date(d.getTime());
  r.setUTCMonth(r.getUTCMonth() + n);
  return r.getTime();
}

/**
 * La decisión que vale hoy: `acepta`, `rechaza` o null (no hay, es de otra
 * versión del texto o tiene 24 meses o más: hay que volver a preguntar).
 */
export function decisionVigente(d: DecisionGuardada | null, ahora: number): Decision | null {
  if (!d) return null;
  if (d.version !== VERSION_CONSENTIMIENTO) return null;
  if (ahora >= sumarMesesIso(d.fecha, MESES_VALIDEZ_CONSENTIMIENTO)) return null;
  return d.decision;
}

export function nuevaDecision(decision: Decision, ahora: number): DecisionGuardada {
  return { decision, version: VERSION_CONSENTIMIENTO, fecha: new Date(ahora).toISOString() };
}

export const URL_PRIVACIDAD_ANALITICA = 'https://nivl.app/privacidad#analitica';
