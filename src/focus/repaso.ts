// NIVL · FOCUS: repetición espaciada (puro, con tests).
//
// Calendario fijo de repasos: 1, 3, 7, 14 y 30 días después de estudiar algo.
// Sirve igual para un tema del temario que para una flashcard:
//   · etapa 0 = recién estudiado (el primer repaso es mañana);
//   · «bien» sube una etapa (el siguiente repaso se aleja);
//   · «dudosa» repite la etapa (mismo intervalo otra vez);
//   · «mal» vuelve a la etapa 0 (mañana otra vez).
// Pasada la última etapa se queda en 30 días: lo dominado se mantiene vivo.

import { sumarDias, diasEntre } from './fechas';

export const INTERVALOS = [1, 3, 7, 14, 30] as const;
export const ETAPA_MAX = INTERVALOS.length - 1;

export type Resultado = 'bien' | 'dudosa' | 'mal';

/** Las cinco fechas de repaso de algo estudiado el día `fecha`. */
export function calendarioRepasos(fecha: string): string[] {
  return INTERVALOS.map((d) => sumarDias(fecha, d));
}

const etapaValida = (e: number) => Math.max(0, Math.min(ETAPA_MAX, Number.isFinite(e) ? Math.round(e) : 0));

/** Al estudiarlo por primera vez (o al volver a empezar): etapa 0, mañana. */
export function primerRepaso(hoy: string): { etapa: number; vence: string } {
  return { etapa: 0, vence: sumarDias(hoy, INTERVALOS[0]) };
}

/**
 * Tras repasar hoy con un resultado, la etapa nueva y el día del siguiente
 * repaso. `etapa` es la que tenía (la del repaso que acaba de hacer).
 */
export function programar(etapa: number, resultado: Resultado, hoy: string): { etapa: number; vence: string } {
  const e = etapaValida(etapa);
  const nueva = resultado === 'bien' ? Math.min(ETAPA_MAX, e + 1) : resultado === 'dudosa' ? e : 0;
  return { etapa: nueva, vence: sumarDias(hoy, INTERVALOS[nueva]) };
}

/** Toca repasarlo hoy (o se pasó la fecha). */
export function vencido(vence: string | null | undefined, hoy: string): boolean {
  return typeof vence === 'string' && diasEntre(hoy, vence) <= 0;
}

/** Los que tocan hoy, del más atrasado al más reciente. */
export function pendientesDeHoy<T extends { vence: string | null }>(items: readonly T[], hoy: string): T[] {
  return items.filter((i) => vencido(i.vence, hoy)).sort((a, b) => (a.vence ?? '').localeCompare(b.vence ?? ''));
}

export const TOPE_MIN_TARJETA = 2;
export const TOPE_MIN_TEMA = 10;

/** Minutos que cuenta una tanda de repaso: los reales, con tope por ítem. */
export function minutosDeTanda(msReales: number, tarjetas: number, temas: number): number {
  const tope = Math.max(0, tarjetas) * TOPE_MIN_TARJETA + Math.max(0, temas) * TOPE_MIN_TEMA;
  if (tope <= 0) return 0;
  const reales = Number.isFinite(msReales) && msReales > 0 ? Math.ceil(msReales / 60_000) : 1;
  return Math.min(Math.max(1, reales), tope);
}

export interface TandaRepaso {
  msReales: number;
  /** Asignatura de cada tarjeta repasada (null: mazo suelto). */
  tarjetas: readonly (string | null)[];
  /** Asignatura de cada tema repasado. */
  temas: readonly string[];
}

export interface SesionDeTanda {
  sufijo: 'flashcards' | 'espaciada';
  metodo: 'flashcards' | 'espaciada';
  asignaturaId: string | null;
  minutos: number;
}

const unica = (xs: readonly (string | null)[]) => (new Set(xs).size === 1 ? (xs[0] ?? null) : null);

/**
 * Las sesiones que deja una tanda de repaso: una por método, con los minutos
 * reales repartidos según lo que pesa cada parte. La asignatura solo se apunta
 * si toda esa parte es de la misma.
 */
export function sesionesDeTanda(t: TandaRepaso): SesionDeTanda[] {
  const total = minutosDeTanda(t.msReales, t.tarjetas.length, t.temas.length);
  if (total === 0) return [];
  const pesoT = t.tarjetas.length * TOPE_MIN_TARJETA;
  const pesoR = t.temas.length * TOPE_MIN_TEMA;
  const out: SesionDeTanda[] = [];
  const paraTarjetas = pesoT === 0 ? 0 : pesoR === 0 ? total : Math.max(1, Math.min(total - 1, Math.round((total * pesoT) / (pesoT + pesoR))));
  if (t.tarjetas.length > 0 && paraTarjetas > 0) out.push({ sufijo: 'flashcards', metodo: 'flashcards', asignaturaId: unica(t.tarjetas), minutos: paraTarjetas });
  if (t.temas.length > 0 && total - paraTarjetas > 0) out.push({ sufijo: 'espaciada', metodo: 'espaciada', asignaturaId: unica(t.temas), minutos: total - paraTarjetas });
  return out;
}
