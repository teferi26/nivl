// NIVL · Arena: cuánto ocupa una inscripción (puro, con test).
//
// En la web no existe adjustsFontSizeToFit: para que el título del rango o el
// lema quepan en UNA línea se estima su ancho y se aprieta el tracking (y, en
// último caso, el cuerpo). Cinzel 700 en mayúsculas avanza ~0,75 em por letra.

const AVANCE_EM = 0.75;

export interface AjusteInscripcion {
  size: number;
  tracking: number;
  /** false: ni apretando cabe en una línea (se deja bajar a dos). */
  cabe: boolean;
}

/** Ancho estimado de `texto` en Cinzel mayúscula con ese cuerpo y tracking. */
export function anchoInscripcion(texto: string, size: number, tracking: number): number {
  const n = Array.from(texto).length;
  return n * (AVANCE_EM * size + tracking);
}

/**
 * El tracking más holgado (de `tracking` hacia abajo) con el que `texto` cabe
 * en `ancho`; si ni con 1 cabe, baja el cuerpo hasta `minimo`.
 */
export function ajustarInscripcion(
  texto: string,
  ancho: number,
  base: { size: number; tracking: number },
  minimo = 12,
): AjusteInscripcion {
  if (!(ancho > 0)) return { size: base.size, tracking: base.tracking, cabe: true };
  const pasos = [base.tracking, 3, 2, 1].filter((t, i, a) => t <= base.tracking && a.indexOf(t) === i);
  for (const t of pasos) {
    if (anchoInscripcion(texto, base.size, t) <= ancho) return { size: base.size, tracking: t, cabe: true };
  }
  for (let s = base.size - 1; s >= minimo; s--) {
    if (anchoInscripcion(texto, s, 1) <= ancho) return { size: s, tracking: 1, cabe: true };
  }
  return { size: minimo, tracking: 1, cabe: false };
}
