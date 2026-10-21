// NIVL · Modos: la rueda (lógica pura, con test).
//
// La rueda de la propuesta P01 (lámina 1): NIVL es la BASE, en el centro, y
// los cuatro modos viven en los puntos cardinales, SIEMPRE en el mismo sitio
// (memoria muscular): IRON arriba, FOCUS a la derecha, WORK abajo y FOUNDER a
// la izquierda. Un modo sin activar deja su hueco vacío y no se elige.
//
// Cómo se usa (decisión de Teferi, 21-oct):
//   · Tocar el emblema ABRE la rueda y se queda abierta. Se toca el modo y
//     empieza la recarga. Tocar fuera o deslizar hacia abajo la cierra sin
//     cambiar nada.
//   · Atajo: mantener el emblema, arrastrar hasta el modo y soltar. Soltar sin
//     haber movido el dedo deja la rueda abierta (como un toque).
//
// Aquí solo vive la geometría y las reglas, sin React Native ni efectos: lo
// usan los tests y, como worklet, el hilo de la interfaz (por eso las
// funciones del gesto llevan la directiva 'worklet').
//
// Unidades: la rueda se dibuja en una caja de VISTA_RUEDA (220) con el centro
// en el medio, igual que la lámina; `escala` = lado real / VISTA_RUEDA.

import type { ModoEtiqueta, ModoId } from './tipos';

/** El orden de los índices de la rueda: 0 es el centro (NIVL), luego los cardinales en el sentido del reloj. */
export const ORDEN_RUEDA: readonly ModoId[] = ['general', 'iron', 'focus', 'work', 'founder'];

/** Grados que ocupa cada sector de modo (cuatro sectores). */
export const ANCHO_SECTOR = 90;

/** Ángulo del centro de cada sector: 0 arriba, creciendo en el sentido del reloj. */
export const ANGULO_MODO: Record<ModoEtiqueta, number> = {
  iron: 0,
  focus: 90,
  work: 180,
  founder: 270,
};

/** Las medidas de la lámina, en la caja de 220 (centro en 0). */
export const VISTA_RUEDA = 220;
export const RUEDA = {
  /** El disco de fondo con su regla de muescas. */
  fuera: 104,
  /** La corona de los sectores. */
  sectorDentro: 40,
  sectorFuera: 93,
  /** El filo encendido del sector apuntado. */
  filoDentro: 95,
  filoFuera: 99,
  /** El círculo central (NIVL, la base). */
  centro: 34,
  /** Radio de los iconos de los sectores. */
  icono: 66,
  /** Más allá de este radio, el dedo está fuera de la rueda. */
  limite: 112,
} as const;

/** Lo que tiene que moverse el dedo (pt) para que deje de ser un toque. */
export const UMBRAL_MOVIMIENTO = 12;
/** Deslizar hacia abajo cierra: recorrido mínimo (pt) o velocidad (pt/s). */
export const DESLIZAR_DY = 72;
export const DESLIZAR_VY = 900;

/**
 * Ángulo (0 a 360, 0 arriba, sentido del reloj) del vector (dx, dy) en
 * coordenadas de pantalla (y crece hacia abajo).
 */
export function anguloDe(dx: number, dy: number): number {
  'worklet';
  const grados = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return grados < 0 ? grados + 360 : grados;
}

/** Índice en ORDEN_RUEDA (1 a 4) del sector de modo que cubre un ángulo. */
export function indiceSector(angulo: number): number {
  'worklet';
  const a = ((angulo % 360) + 360) % 360;
  return (Math.floor((a + ANCHO_SECTOR / 2) / ANCHO_SECTOR) % 4) + 1;
}

/**
 * A qué apunta el dedo, como índice de ORDEN_RUEDA, o -1 si a nada: fuera de
 * la rueda o en el hueco de un modo sin activar. El centro es NIVL (0).
 *
 * (dx, dy) es el vector desde el centro de la rueda en pt; `escala` el lado
 * real entre VISTA_RUEDA. `disponibles` es la máscara por índice de
 * ORDEN_RUEDA (worklet: nada de Set ni de cierres).
 */
export function sectorEn(dx: number, dy: number, escala: number, disponibles: readonly boolean[]): number {
  'worklet';
  const e = escala > 0 ? escala : 1;
  const r = Math.sqrt(dx * dx + dy * dy) / e;
  if (r > RUEDA.limite) return -1;
  const i = r <= RUEDA.centro + 3 ? 0 : indiceSector(anguloDe(dx, dy));
  return disponibles[i] ? i : -1;
}

/**
 * Opacidad del resaltado «apuntado» del hueco `indice`: 1 solo si el dedo está
 * sobre él. Con `resaltado` a -1 (rueda recién abierta, nada apuntado) ninguno
 * se enciende, y nunca hay dos a la vez.
 */
export function opacidadApuntado(resaltado: number, indice: number): number {
  'worklet';
  return resaltado >= 0 && resaltado === indice ? 1 : 0;
}

/** La máscara de `sectorEn`: qué huecos de la rueda se pueden elegir. NIVL siempre. */
export function mascaraDisponibles(disponibles: readonly ModoId[]): boolean[] {
  return ORDEN_RUEDA.map((m) => m === 'general' || disponibles.includes(m));
}

/** El modo de un índice de la rueda (null si no es ninguno). */
export function modoDeIndice(i: number): ModoId | null {
  return i >= 0 && i < ORDEN_RUEDA.length ? ORDEN_RUEDA[i] : null;
}

/**
 * Qué hace la rueda al elegir el índice `i` estando en `actual`: cerrarse sin
 * cambiar (fuera, hueco vacío o el mismo modo) o recargar el modo nuevo.
 */
export function resultadoEleccion(i: number, actual: ModoId): ModoId | 'cerrar' {
  'worklet';
  if (i < 0 || i >= ORDEN_RUEDA.length) return 'cerrar';
  const m = ORDEN_RUEDA[i];
  return m === actual ? 'cerrar' : m;
}

/** ¿El dedo se ha movido lo bastante para no ser un toque? */
export function seMovio(dx: number, dy: number): boolean {
  'worklet';
  return dx * dx + dy * dy > UMBRAL_MOVIMIENTO * UMBRAL_MOVIMIENTO;
}

/** ¿El gesto es «deslizar hacia abajo» (cierra la rueda)? Vertical, hacia abajo y largo o rápido. */
export function esDeslizarAbajo(dx: number, dy: number, vy: number): boolean {
  'worklet';
  if (dy <= UMBRAL_MOVIMIENTO || dy < Math.abs(dx) * 1.2) return false;
  return dy >= DESLIZAR_DY || vy >= DESLIZAR_VY;
}

/**
 * Con la rueda abierta, cómo acaba un gesto de un dedo:
 *   · 'deslizar': hacia abajo, cierra sin cambiar;
 *   · 'toque': no se movió, cuenta donde EMPEZÓ;
 *   · 'arrastre': se movió por la rueda, cuenta donde TERMINA.
 */
export function finDeGesto(dx: number, dy: number, vy: number): 'deslizar' | 'toque' | 'arrastre' {
  'worklet';
  if (esDeslizarAbajo(dx, dy, vy)) return 'deslizar';
  return seMovio(dx, dy) ? 'arrastre' : 'toque';
}

/**
 * El anterior guardado que vale: un modo válido, distinto del actual y que
 * siga activado (General siempre lo está). Si no, null. Se marca en la rueda.
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

/** Radio que cubre toda la pantalla desde (cx, cy): las ondas de la recarga llegan ahí. */
export function radioCubre(cx: number, cy: number, ancho: number, alto: number): number {
  const dx = Math.max(cx, ancho - cx);
  const dy = Math.max(cy, alto - cy);
  return Math.ceil(Math.sqrt(dx * dx + dy * dy));
}

/**
 * El trazado SVG de un sector de corona (de `r1` a `r2`) centrado en `angulo`
 * con `ancho` grados, alrededor de (cx, cy). Deja `hueco` grados a cada lado
 * (la lámina: ±43° de 90°, hueco 2).
 */
export function trazoSector(
  cx: number,
  cy: number,
  r1: number,
  r2: number,
  angulo: number,
  ancho: number = ANCHO_SECTOR,
  hueco = 2,
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

/** Punto (x, y) a radio `r` y `angulo` grados de (cx, cy): para colocar iconos y rótulos. */
export function puntoEn(cx: number, cy: number, r: number, angulo: number): { x: number; y: number } {
  const a = (angulo * Math.PI) / 180;
  return { x: redondo(cx + r * Math.sin(a)), y: redondo(cy - r * Math.cos(a)) };
}

function redondo(n: number): number {
  return Math.round(n * 100) / 100;
}
