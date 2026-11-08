// NIVL · FOCUS: notas y media (puro, con tests).
//
// Todas las notas se pasan a la escala de 10 (`nota / sobre × 10`).
//   · Ninguna lleva peso → media simple.
//   · Alguna lleva peso (porcentaje de la nota final) → media PONDERADA de
//     las que lo llevan. Las que no lo llevan no cuentan y se dice (`sinPeso`):
//     nunca se quedan con lo que aún no se ha evaluado.
// Además, cuánto queda por evaluar y qué nota hace falta en lo que queda para
// llegar a un objetivo (el 5 para aprobar, o la que sea).

export interface NotaParaMedia {
  nota: number;
  sobre: number;
  peso: number | null;
}

export interface Media {
  /** Sobre 10, con dos decimales; null si no hay notas válidas. */
  media: number | null;
  ponderada: boolean;
  /** Suma de pesos usados (solo ponderada; tope 100). */
  pesoEvaluado: number;
  /** Notas sin peso que no han contado (los pesos ya llenaban el 100). */
  sinPeso: number;
}

const valida = (n: NotaParaMedia) =>
  Number.isFinite(n.nota) && Number.isFinite(n.sobre) && n.sobre > 0 && n.nota >= 0 && n.nota <= n.sobre;

const sobre10 = (n: NotaParaMedia) => (n.nota / n.sobre) * 10;
const dos = (x: number) => Math.round(x * 100) / 100;
const pesoValido = (p: number | null): p is number => p !== null && Number.isFinite(p) && p > 0;

export function media(notas: readonly NotaParaMedia[]): Media {
  const v = notas.filter(valida);
  if (v.length === 0) return { media: null, ponderada: false, pesoEvaluado: 0, sinPeso: 0 };
  const conPeso = v.filter((n) => pesoValido(n.peso));
  if (conPeso.length === 0) {
    return { media: dos(v.reduce((s, n) => s + sobre10(n), 0) / v.length), ponderada: false, pesoEvaluado: 0, sinPeso: 0 };
  }
  const pesoTotal = conPeso.reduce((s, n) => s + (n.peso as number), 0);
  return {
    media: dos(conPeso.reduce((s, n) => s + sobre10(n) * (n.peso as number), 0) / pesoTotal),
    ponderada: true,
    pesoEvaluado: Math.min(100, dos(pesoTotal)),
    sinPeso: v.length - conPeso.length,
  };
}

export type Necesaria =
  /** Ya no queda nada por evaluar y el objetivo está. */
  | { tipo: 'asegurado' }
  /** Con lo evaluado ya se llega, pero queda por evaluar: puede haber nota mínima. */
  | { tipo: 'encaminada' }
  | { tipo: 'imposible'; necesaria: number }
  | { tipo: 'necesaria'; necesaria: number }
  | { tipo: 'sin_datos' };

/**
 * Con lo evaluado y el porcentaje que queda por evaluar, la nota (sobre 10) que
 * hace falta en lo que queda para acabar con `objetivo`. Se calcula con las
 * notas sin redondear. «Asegurado» solo si ya no queda nada por evaluar.
 */
export function notaNecesaria(notas: readonly NotaParaMedia[], objetivo = 5): Necesaria {
  const conPeso = notas.filter(valida).filter((n) => pesoValido(n.peso));
  if (conPeso.length === 0) return { tipo: 'sin_datos' };
  const suma = conPeso.reduce((s, n) => s + (n.peso as number), 0);
  const escala = suma > 100 ? 100 / suma : 1;
  const llevo = conPeso.reduce((s, n) => s + (sobre10(n) * (n.peso as number) * escala) / 100, 0);
  const queda = 100 - Math.min(100, suma);
  if (queda <= 0) return llevo >= objetivo ? { tipo: 'asegurado' } : { tipo: 'sin_datos' };
  const falta = ((objetivo - llevo) * 100) / queda;
  if (falta <= 0) return { tipo: 'encaminada' };
  const necesaria = Math.round(falta * 100) / 100;
  return necesaria > 10 ? { tipo: 'imposible', necesaria } : { tipo: 'necesaria', necesaria };
}

/** Media de las medias de cada asignatura (las que tienen nota). */
export function mediaGlobal(medias: readonly (number | null)[]): number | null {
  const v = medias.filter((x): x is number => x !== null && Number.isFinite(x));
  return v.length === 0 ? null : dos(v.reduce((s, x) => s + x, 0) / v.length);
}

/** «7,25» (coma decimal, como en un boletín). */
export function formatoNota(x: number | null): string {
  if (x === null) return '-';
  const r = Math.round(x * 100) / 100;
  return (Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0$/, '')).replace('.', ',');
}

/** Lee lo que se escribe en un campo de nota: «7,5», «7.5», «8». null si no es número. */
export function leerNumero(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(t)) return null;
  return Number(t);
}
