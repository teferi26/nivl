// NIVL · Arena: el muelle de la Barra (puro, con test).
//
// Reanimated 4 cambió los valores por defecto de withSpring (masa 4, rigidez
// 900). Un `{ damping: 18 }` suelto, pensado para los de la 3 (masa 1,
// rigidez 100, razón 0,9), queda con razón 0,15: rebota un 62 % por encima del
// destino. Una barra al 84 % que sube desde 0 pasaba del 100 % (recortada:
// llena) varias veces antes de pararse, y una captura en mitad del rebote la
// enseñaba casi llena. Aquí la configuración va entera y sin rebote.

export interface MuelleConfig {
  mass: number;
  stiffness: number;
  damping: number;
  overshootClamping: boolean;
}

/** Razón 0,9 (casi crítico) y sin pasarse nunca del destino. */
export const MUELLE_BARRA: MuelleConfig = { mass: 1, stiffness: 100, damping: 18, overshootClamping: true };

/** Razón de amortiguamiento ζ = c / (2·√(k·m)). 1 = crítico; menos, rebota. */
export function razonAmortiguamiento(c: Pick<MuelleConfig, 'mass' | 'stiffness' | 'damping'>): number {
  return c.damping / (2 * Math.sqrt(c.stiffness * c.mass));
}

/** Fracción que el muelle se pasa del destino en el primer rebote (0 si no rebota). */
export function sobreimpulso(c: MuelleConfig): number {
  if (c.overshootClamping) return 0;
  const z = razonAmortiguamiento(c);
  if (z >= 1) return 0;
  return Math.exp((-z * Math.PI) / Math.sqrt(1 - z * z));
}
