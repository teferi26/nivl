// NIVL · IRON · Brazos (fase 2): piezas comunes de los ejercicios del grupo.
//
// No es un ejercicio: lo usan los archivos de esta carpeta para no repetir
// posturas (de pie, sentado en el banco, tumbado en el banco) ni las claves
// de texto. Ángulos en el convenio de src/iron/tipos.ts.

import type { ClaveI18n, Extremidades, Pose } from '../../tipos';

/** Claves de texto del ejercicio en el namespace `iron-brazos`. */
export function textos(id: string, cues: readonly string[], errores: readonly string[]) {
  const base = `iron-brazos:ejercicios.${id}` as const;
  return {
    nombre: `${base}.nombre` as ClaveI18n,
    cues: cues.map((c) => `${base}.cues.${c}` as ClaveI18n),
    errores: errores.map((e) => `${base}.errores.${e}` as ClaveI18n),
  };
}

/** De pie, rodillas sueltas: como el curl de bíceps con mancuernas. */
export const DE_PIE = { tobillo: 2, rodilla: 3, cadera: 1 } as const;
/** Ancla de pie: el tobillo cercano en el suelo y el pie plano. */
export const ANCLA_DE_PIE = { punto: 'tobillo_c', x: 0, y: 4, segmento: 'pie_c', angulo: 0 } as const;

/** Tumbado en el banco (como el press de banca): piernas y ancla. */
export const TUMBADO = { cadera: -15, rodilla: 85.5, tobillo: 7 } as const;
export const ANCLA_TUMBADO = { punto: 'cadera', x: 0, y: 33.2, segmento: 'tronco', angulo: 183.5 } as const;
export const BANCO_TUMBADO = { tipo: 'banco', x: -54, ancho: 68, alto: 24.6, capa: 'medio' } as const;

/**
 * Sentado en el extremo del banco: muslo horizontal, pierna vertical y pie
 * plano (el tobillo queda en el suelo, y = 4). `cadera` es 180 menos el
 * ángulo del tronco: así el muslo sigue horizontal aunque el tronco se incline.
 */
export const sentado = (tronco: number) => ({ cadera: 180 - tronco, rodilla: 90, tobillo: 0 });
export const anclaSentado = (tronco: number) => ({ punto: 'cadera', x: 0, y: 28.5, segmento: 'tronco', angulo: tronco }) as const;
/** El banco a lo largo, por detrás: se sienta en el extremo (la pata delantera bajo la cadera). */
export const BANCO_SENTADO = { tipo: 'banco', x: -52, ancho: 60, alto: 21.5, capa: 'fondo' } as const;

/** Pose con los dos lados iguales (o el lejano aparte). */
export function pose(ms: number, cerca: Extremidades, extra: Partial<Omit<Pose, 'ms' | 'cerca'>> = {}): Pose {
  return { ms, cuello: 0, cerca, ...extra };
}
