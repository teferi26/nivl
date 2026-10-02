// NIVL · El gesto de dictar (L4, A3). Puro: sin React Native.
// Mantener pulsado graba; soltar escribe lo dictado en el cuadro; deslizar
// hacia arriba y soltar lo tira.

/** Desplazamiento vertical (pt, negativo = arriba) a partir del cual soltar cancela. */
export const UMBRAL_CANCELAR = -60;

/** «0:04», «1:12». Nunca negativo. */
export function formatoGrabacion(ms: number): string {
  const s = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000));
  const min = Math.floor(s / 60);
  const seg = s % 60;
  return `${min}:${String(seg).padStart(2, '0')}`;
}

/** ¿Qué hace soltar el dedo tras desplazarse `dy` desde donde se pulsó? */
export function alSoltar(dy: number): 'detener' | 'cancelar' {
  return Number.isFinite(dy) && dy <= UMBRAL_CANCELAR ? 'cancelar' : 'detener';
}

/**
 * Lo dictado se añade a lo que ya había escrito, con un espacio entre medias
 * (o sin él si lo previo ya acaba en espacio o salto de línea).
 */
export function unirDictado(previo: string, final: string): string {
  const nuevo = final.trim();
  if (!nuevo) return previo;
  if (!previo.trim()) return nuevo;
  return /\s$/.test(previo) ? `${previo}${nuevo}` : `${previo} ${nuevo}`;
}
