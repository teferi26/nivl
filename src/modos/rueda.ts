// NIVL · Modos: la rueda (lógica pura, con test).
//
// El gesto de la propuesta P01: se mantiene el emblema, se abre la rueda, el
// pulgar apunta a un sector y al soltar se elige. Aquí solo vive la geometría
// y las reglas, sin React Native ni efectos: lo usan los tests y, como
// worklet, el hilo de la interfaz (por eso las funciones del gesto llevan la
// directiva 'worklet').
//
// Memoria muscular: cada modo vive SIEMPRE en el mismo punto, aunque no esté
// activado (su hueco queda vacío y no se puede elegir). NIVL arriba y los
// cuatro modos en el sentido de las agujas del reloj, a 72° unos de otros.

import type { ModoEtiqueta, ModoId } from './tipos';

/** El orden fijo de la rueda, empezando arriba y en el sentido del reloj. */
export const ORDEN_RUEDA: readonly ModoId[] = ['general', 'iron', 'focus', 'work', 'founder'];

/** Grados que ocupa cada sector. */
export const ANCHO_SECTOR = 360 / ORDEN_RUEDA.length;

/** Ángulo del centro de cada sector: 0 arriba, creciendo en el sentido del reloj. */
export const ANGULO_MODO: Record<ModoId, number> = {
  general: 0,
  iron: 72,
  focus: 144,
  work: 216,
  founder: 288,
};

/**
 * Ángulo (0 a 360, 0 arriba, sentido del reloj) del vector (dx, dy) en
 * coordenadas de pantalla (y crece hacia abajo).
 */
export function anguloDe(dx: number, dy: number): number {
  'worklet';
  const grados = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return grados < 0 ? grados + 360 : grados;
}

/** Índice en ORDEN_RUEDA del sector que cubre un ángulo. */
export function indiceSector(angulo: number): number {
  'worklet';
  const a = ((angulo % 360) + 360) % 360;
  return Math.floor((a + ANCHO_SECTOR / 2) / ANCHO_SECTOR) % ORDEN_RUEDA.length;
}

/**
 * El sector al que apunta el pulgar, como índice de ORDEN_RUEDA, o -1 si no
 * apunta a nada: dentro del círculo central (soltar ahí cancela) o en el
 * hueco de un modo que no está activado.
 *
 * `disponibles` es una máscara por índice de ORDEN_RUEDA (worklet: nada de
 * Set ni de cierres).
 */
export function sectorEn(dx: number, dy: number, radioCentro: number, disponibles: readonly boolean[]): number {
  'worklet';
  if (dx * dx + dy * dy < radioCentro * radioCentro) return -1;
  const i = indiceSector(anguloDe(dx, dy));
  return disponibles[i] ? i : -1;
}

/** La máscara de `sectorEn`: qué huecos de la rueda se pueden elegir. NIVL siempre. */
export function mascaraDisponibles(disponibles: readonly ModoId[]): boolean[] {
  return ORDEN_RUEDA.map((m) => m === 'general' || disponibles.includes(m));
}

/** El modo de un índice de la rueda (null si no es un sector). */
export function modoDeIndice(i: number): ModoId | null {
  return i >= 0 && i < ORDEN_RUEDA.length ? ORDEN_RUEDA[i] : null;
}

/**
 * Toque corto en el emblema: el modo al que se vuelve, o null si no hay a
 * dónde volver (entonces se abre la rueda). El anterior tiene que seguir
 * disponible y ser distinto del actual.
 */
export function destinoToqueCorto(
  actual: ModoId,
  anterior: ModoId | null,
  disponibles: readonly ModoId[],
): ModoId | null {
  if (!anterior || anterior === actual) return null;
  return disponibles.includes(anterior) ? anterior : null;
}

/**
 * El anterior guardado que vale: un modo válido, distinto del actual y que
 * siga activado (General siempre lo está). Si no, null.
 */
export function anteriorValido(guardado: unknown, actual: ModoId, activados: readonly ModoEtiqueta[]): ModoId | null {
  if (typeof guardado !== 'string' || guardado === actual) return null;
  if (guardado === 'general') return 'general';
  return (activados as readonly string[]).includes(guardado) ? (guardado as ModoEtiqueta) : null;
}

/** Tras cambiar de `actual` a `nuevo`, ¿cuál es el anterior? (sin cambio real, el mismo). */
export function anteriorTrasCambio(actual: ModoId, nuevo: ModoId, anterior: ModoId | null): ModoId | null {
  return nuevo === actual ? anterior : actual;
}

/** Radio que cubre toda la pantalla desde (cx, cy): el barrido termina ahí. */
export function radioCubre(cx: number, cy: number, ancho: number, alto: number): number {
  const dx = Math.max(cx, ancho - cx);
  const dy = Math.max(cy, alto - cy);
  return Math.ceil(Math.sqrt(dx * dx + dy * dy));
}

/**
 * El trazado SVG de un sector de corona (de `r1` a `r2`) centrado en `angulo`
 * con `ancho` grados, alrededor de (cx, cy). Deja `hueco` grados a cada lado.
 */
export function trazoSector(
  cx: number,
  cy: number,
  r1: number,
  r2: number,
  angulo: number,
  ancho: number = ANCHO_SECTOR,
  hueco = 1.5,
): string {
  const a0 = ((angulo - ancho / 2 + hueco) * Math.PI) / 180;
  const a1 = ((angulo + ancho / 2 - hueco) * Math.PI) / 180;
  const p = (r: number, a: number) => `${redondo(cx + r * Math.sin(a))} ${redondo(cy - r * Math.cos(a))}`;
  const grande = ancho - 2 * hueco > 180 ? 1 : 0;
  return [
    `M ${p(r2, a0)}`,
    `A ${r2} ${r2} 0 ${grande} 1 ${p(r2, a1)}`,
    `L ${p(r1, a1)}`,
    `A ${r1} ${r1} 0 ${grande} 0 ${p(r1, a0)}`,
    'Z',
  ].join(' ');
}

/** Punto (x, y) a radio `r` y `angulo` grados de (cx, cy): para colocar rótulos. */
export function puntoEn(cx: number, cy: number, r: number, angulo: number): { x: number; y: number } {
  const a = (angulo * Math.PI) / 180;
  return { x: redondo(cx + r * Math.sin(a)), y: redondo(cy - r * Math.cos(a)) };
}

function redondo(n: number): number {
  return Math.round(n * 100) / 100;
}
