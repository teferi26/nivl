// NIVL · FOCUS: notas y media (puro, con tests).
//
// Todas las notas se pasan a la escala de 10 (`nota / sobre × 10`).
//   · Ninguna lleva peso → media simple.
//   · Alguna lleva peso (porcentaje de la nota final) → media PONDERADA:
//     las que no lo llevan se reparten a partes iguales lo que falte hasta
//     100; si los pesos ya suman 100 o más, las que no lo llevan no cuentan
//     (y se dice: `sinPeso`).
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
  const sinPeso = v.filter((n) => !pesoValido(n.peso));
  const suma = conPeso.reduce((s, n) => s + (n.peso as number), 0);
  const resto = Math.max(0, 100 - suma);
  const pesoCadaSin = sinPeso.length > 0 && resto > 0 ? resto / sinPeso.length : 0;
  const partes = [
    ...conPeso.map((n) => ({ x: sobre10(n), p: n.peso as number })),
    ...(pesoCadaSin > 0 ? sinPeso.map((n) => ({ x: sobre10(n), p: pesoCadaSin })) : []),
  ];
  const pesoTotal = partes.reduce((s, q) => s + q.p, 0);
  return {
    media: dos(partes.reduce((s, q) => s + q.x * q.p, 0) / pesoTotal),
    ponderada: true,
    pesoEvaluado: Math.min(100, dos(pesoTotal)),
    sinPeso: pesoCadaSin > 0 ? 0 : sinPeso.length,
  };
}

export type Necesaria =
  | { tipo: 'asegurado' }
  | { tipo: 'imposible'; necesaria: number }
  | { tipo: 'necesaria'; necesaria: number }
  | { tipo: 'sin_datos' };

/**
 * Con la media ponderada de lo evaluado y el porcentaje que queda por evaluar,
 * la nota (sobre 10) que hace falta en lo que queda para acabar con `objetivo`.
 */
export function notaNecesaria(notas: readonly NotaParaMedia[], objetivo = 5): Necesaria {
  const m = media(notas);
  if (m.media === null || !m.ponderada) return { tipo: 'sin_datos' };
  const queda = 100 - m.pesoEvaluado;
  if (queda <= 0) return { tipo: 'sin_datos' };
  const llevo = (m.media * m.pesoEvaluado) / 100;
  const falta = ((objetivo - llevo) * 100) / queda;
  if (falta <= 0) return { tipo: 'asegurado' };
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
