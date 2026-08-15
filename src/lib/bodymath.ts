// NIVL · Matemática del cuerpo, sin efectos.
//
// Vive aparte de `bodywork.ts` por la razón de siempre: ese módulo importa
// Supabase, y eso arrastra AsyncStorage, y con AsyncStorage dentro los tests
// de este archivo no arrancarían. Aquí solo hay números.

/** Ritmo en minutos por kilómetro, formateado como 5:42. */
export function paceOf(distanciaKm: number | null, duracionMin: number): string | null {
  if (!distanciaKm || distanciaKm <= 0 || duracionMin <= 0) return null;
  const minPorKm = duracionMin / distanciaKm;
  const m = Math.floor(minPorKm);
  const s = Math.round((minPorKm - m) * 60);
  // 59,7 segundos redondea a 60: eso no es "5:60", es el minuto siguiente.
  if (s === 60) return `${m + 1}:00`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * 1RM estimado por la fórmula de Epley: peso × (1 + reps/30).
 *
 * Por encima de 12 repeticiones sobreestima tanto que deja de servir para
 * decidir cargas, así que esas series no producen estimación.
 */
export function e1rm(peso: number, reps: number): number | null {
  if (peso <= 0 || reps <= 0 || reps > 12) return null;
  return peso * (1 + reps / 30);
}

/**
 * Pendiente por mínimos cuadrados en unidades por día. Para el peso corporal:
 * con una báscula que oscila ±1 kg de un día para otro, el último dato es
 * ruido y la pendiente es la señal.
 */
export function pendientePorDia(puntos: { x: number; y: number }[]): number | null {
  const n = puntos.length;
  if (n < 3) return null;
  const mx = puntos.reduce((s, p) => s + p.x, 0) / n;
  const my = puntos.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of puntos) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  if (den === 0) return null;
  return num / den;
}
