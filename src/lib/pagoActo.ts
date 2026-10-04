// NIVL · Lo que paga un acto registrado en un módulo (cardio, pesaje, metas,
// nutrición) y cómo se anuncia. Puro, con tests: sin Supabase.
//
// Dos reglas que la interfaz tiene que respetar:
//   · El mismo acto no paga dos veces: si una misión enlazada ya ha pagado por
//     él, el módulo solo cobra la diferencia hasta su base (links.ts). Pero la
//     misión descuenta UNA vez al día: una segunda sesión real de cardio no
//     vuelve a perder lo que ya pagó la misión con la primera.
//   · Se anuncia lo PAGADO, no lo calculado: el servidor recorta por topes
//     diarios y una línea «+40 XP» que no entró es mentira.

import { SIN_DATO } from '@/components/ui/sinDato';
import type { Propagado } from './links';
import { deMisiones, desgloseXp } from './voice';

type Eco = Pick<Propagado, 'xp' | 'xpMisiones'>;

/**
 * Cuánto de lo pagado por las misiones enlazadas se descuenta al módulo.
 *
 * - Primera sesión del día: todo lo que han pagado hoy (marcadas ahora o a
 *   mano antes): el acto ya está cobrado.
 * - Sesiones siguientes: solo lo que se acaba de marcar con ESTA sesión
 *   (`eco.xp`). Lo que la misión pagó con la primera ya se descontó entonces.
 */
export function descuentoDeMision(eco: Eco | null, primeraDelDia: boolean): number {
  if (!eco) return 0;
  return Math.max(0, primeraDelDia ? eco.xpMisiones : eco.xp);
}

/**
 * ¿Es la primera sesión de hoy que marca la misión enlazada? Caminar no la
 * marca (un paseo no salda un «Correr 5 km»), así que no cuenta.
 */
export function primeraSesionQuePropaga(tiposHoy: readonly string[]): boolean {
  return !tiposHoy.some((k) => k !== 'caminar');
}

/** Lo que le queda por pagar al módulo con ese descuento. */
export function pagoDelModulo(base: number, eco: Eco | null, primeraDelDia: boolean): number {
  return Math.max(0, base - descuentoDeMision(eco, primeraDelDia));
}

/**
 * XP que entró de verdad: el pedido, acotado por lo que subió el perfil (el
 * servidor recorta por topes y no baja de lo que había).
 */
export function xpPagado(pedido: number, xpAntes: number, xpDespues: number): number {
  return Math.max(0, Math.min(pedido, xpDespues - xpAntes));
}

/** «12,5» · «5» · «5,25»: decimales con coma y sin ceros de sobra. Sin dato, «-». */
export function numeroES(n: number | null | undefined, decimales = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return SIN_DATO;
  const factor = 10 ** decimales;
  const redondo = Math.round(n * factor) / factor;
  return String(redondo).replace('.', ',');
}

/** «12,5 km»; sin distancia, «-». */
export function kmES(km: number | null | undefined): string {
  const n = numeroES(km);
  return n === SIN_DATO ? SIN_DATO : `${n} km`;
}

/**
 * El desglose de lo pagado por un acto: la misión enlazada marcada ahora (si
 * pagó) y el módulo. Vacío si no entró nada.
 */
export function anuncioActo(a: { xpMision: number; marcadas: string[]; xpModulo: number; deModulo: string }): string {
  return desgloseXp([
    { xp: a.xpMision, de: a.marcadas.length > 0 ? deMisiones(a.marcadas) : 'de la misión enlazada' },
    { xp: a.xpModulo, de: a.deModulo },
  ]);
}

/**
 * El aviso de una sesión de cardio: lo que pagó la misión enlazada (si la
 * marcó esta sesión) y lo que pagó el módulo. Si no entró XP, dice por qué.
 */
export function anuncioCardio(a: {
  /** XP pagado ahora por las misiones marcadas con esta sesión. */
  xpMision: number;
  /** Títulos de esas misiones. */
  marcadas: string[];
  /** XP que pagó de verdad el módulo. */
  xpModulo: number;
  /** Lo que el módulo pidió (antes del recorte del servidor). */
  pedidoModulo: number;
  /** Una misión enlazada ya había pagado este acto hoy. */
  misionYaPagada: boolean;
  esCorreccion: boolean;
  topeDiario: number;
}): string {
  const pagado = anuncioActo({ ...a, deModulo: 'a FUE por la sesión' });
  if (pagado) return pagado;
  if (a.esCorreccion) return 'El sistema corrige el registro. El XP de esta sesión ya estaba pagado.';
  if (a.pedidoModulo > 0) return 'Anotada. Hoy ya has llegado al tope diario de XP: la sesión cuenta igual para tu estudio.';
  if (a.misionYaPagada) return 'Anotada. La misión de hoy ya estaba marcada y pagada.';
  return `Anotada. Hoy ya has cobrado el máximo de cardio (${a.topeDiario} XP), pero la sesión cuenta igual para tu estudio.`;
}
