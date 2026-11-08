// NIVL · WORK: reunión o bloque en dos toques (puro). Un toque abre la hoja con
// todo ya propuesto (día, primer hueco libre, duración); el segundo guarda.

import { finEvento } from './carga';
import { sumarDias } from './fechas';
import { DURACIONES_BLOQUE, MINUTOS_BLOQUE_DEFECTO, type EventoTrabajo } from './tipos';

export type TipoRapido = 'reunion' | 'bloque';

export const DURACIONES_REUNION = [30, 45, 60] as const;
export const MINUTOS_REUNION_DEFECTO = 30;
/** Donde empieza a buscarse hueco en un día que no es hoy. */
export const INICIO_JORNADA_MIN = 9 * 60;
const PASO_MIN = 15;
const MIN_DIA = 1440;

export interface Ocupado {
  inicio: number;
  fin: number;
}

export function duracionesDe(tipo: TipoRapido): readonly number[] {
  return tipo === 'reunion' ? DURACIONES_REUNION : DURACIONES_BLOQUE;
}

export function duracionDefecto(tipo: TipoRapido): number {
  return tipo === 'reunion' ? MINUTOS_REUNION_DEFECTO : MINUTOS_BLOQUE_DEFECTO;
}

const redondear = (min: number) => Math.ceil(min / PASO_MIN) * PASO_MIN;

/** El primer inicio libre desde `desdeMin` en el que cabe `duracion`; null si ya no cabe hoy. */
export function huecoLibre(desdeMin: number, ocupados: readonly Ocupado[], duracion: number): number | null {
  const lista = ocupados.filter((o) => o.fin > o.inicio).sort((a, b) => a.inicio - b.inicio);
  let inicio = redondear(desdeMin);
  for (const o of lista) {
    if (inicio + duracion <= o.inicio) break;
    if (o.fin > inicio) inicio = redondear(o.fin);
  }
  return inicio + duracion <= MIN_DIA ? inicio : null;
}

/**
 * Qué propone la hoja: el día que se mira (nunca uno pasado) y su primer hueco.
 * Si hoy ya no cabe, mañana a primera hora.
 */
export function propuestaInicial(a: {
  dia: string;
  hoy: string;
  ahoraMin: number;
  ocupados: readonly Ocupado[];
  duracion: number;
}): { dia: string; inicioMin: number } {
  const dia = a.dia < a.hoy ? a.hoy : a.dia;
  const desde = dia === a.hoy ? Math.max(a.ahoraMin, 0) : INICIO_JORNADA_MIN;
  const hueco = huecoLibre(desde, a.ocupados, a.duracion);
  if (hueco !== null) return { dia, inicioMin: hueco };
  return { dia: sumarDias(dia, 1), inicioMin: INICIO_JORNADA_MIN };
}

/** Lee «9», «9:30», «09.30» o «0930»; null si no es una hora. */
export function leerHoraEscrita(s: string): number | null {
  const t = s.trim().replace('.', ':');
  const m = /^(\d{1,2})(?::?(\d{2}))?$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  return h > 23 || min > 59 ? null : h * 60 + min;
}

/** El tramo que se guarda; null si acabaría pasada la medianoche. */
export function tramo(inicioMin: number | null, duracion: number): Ocupado | null {
  if (inicioMin === null || !(duracion > 0)) return null;
  const fin = inicioMin + duracion;
  return fin <= MIN_DIA ? { inicio: inicioMin, fin } : null;
}

/**
 * Dónde encaja un bloque nuevo en el plan. El plan se lee por `position` y se
 * supone en orden de hora (`bloqueSiguiente`), así que los posteriores se corren.
 */
export function encajarEnPlan(
  bloques: readonly { id: string; start_min: number; position: number }[],
  inicioMin: number,
): { posicion: number; mover: { id: string; position: number }[] } {
  const orden = [...bloques].sort((a, b) => a.position - b.position);
  const i = orden.findIndex((b) => b.start_min > inicioMin);
  const posicion = i === -1 ? orden.length : i;
  const mover: { id: string; position: number }[] = [];
  orden.forEach((b, k) => {
    const nueva = k < posicion ? k : k + 1;
    if (nueva !== b.position) mover.push({ id: b.id, position: nueva });
  });
  return { posicion, mover };
}

/** Lo ya ocupado un día: eventos con hora y bloques del plan. */
export function ocupadosDelDia(
  eventos: readonly EventoTrabajo[],
  bloques: readonly { start_min: number; end_min: number }[],
  dia: string,
): Ocupado[] {
  const deEventos = eventos.flatMap((e) => {
    if (e.fecha !== dia || e.inicio === null) return [];
    return [{ inicio: e.inicio, fin: finEvento(e) ?? e.inicio }];
  });
  return [...deEventos, ...bloques.map((b) => ({ inicio: b.start_min, fin: b.end_min }))];
}
