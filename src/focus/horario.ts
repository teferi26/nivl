// NIVL · FOCUS: horario de clases y horas de estudio (puro, con tests).

import { diasEntre, lunesDe, sumarDias } from './fechas';

export interface ClaseHorario {
  id: string;
  asignaturaId: string;
  /** 1 = lunes … 7 = domingo */
  dia: number;
  inicio: number;
  fin: number;
}

/** Las clases de un día de la semana, por hora. */
export function clasesDelDia<T extends ClaseHorario>(horario: readonly T[], dia: number): T[] {
  return horario.filter((c) => c.dia === dia).sort((a, b) => a.inicio - b.inicio || a.fin - b.fin);
}

/** Lo que falla de una clase nueva (null si está bien). */
export function errorDeClase(c: Pick<ClaseHorario, 'dia' | 'inicio' | 'fin'>): 'dia' | 'horas' | null {
  if (!Number.isInteger(c.dia) || c.dia < 1 || c.dia > 7) return 'dia';
  if (!Number.isFinite(c.inicio) || !Number.isFinite(c.fin) || c.inicio < 0 || c.fin > 24 * 60 || c.fin <= c.inicio) return 'horas';
  return null;
}

/** Las clases de `horario` que se pisan con `c` (mismo día, horas cruzadas). */
export function solapes<T extends ClaseHorario>(horario: readonly T[], c: Pick<ClaseHorario, 'dia' | 'inicio' | 'fin'> & { id?: string }): T[] {
  return horario.filter((o) => o.id !== c.id && o.dia === c.dia && o.inicio < c.fin && c.inicio < o.fin);
}

/**
 * La próxima clase desde (dia, min): la que está en curso cuenta. Recorre la
 * semana dando la vuelta; null si no hay ninguna.
 */
export function siguienteClase<T extends ClaseHorario>(
  horario: readonly T[],
  ahora: { dia: number; min: number },
): { clase: T; enCurso: boolean; enDias: number } | null {
  for (let k = 0; k < 8; k++) {
    const dia = ((ahora.dia - 1 + k) % 7) + 1;
    const delDia = clasesDelDia(horario, dia);
    const c = k === 0 ? delDia.find((x) => x.fin > ahora.min) : k === 7 ? delDia.find((x) => x.inicio < ahora.min) : delDia[0];
    if (c) return { clase: c, enCurso: k === 0 && c.inicio <= ahora.min, enDias: k };
  }
  return null;
}

/** Fin de la última clase del día (null si no hay). */
export function finUltimaClase(horario: readonly ClaseHorario[], dia: number): number | null {
  const d = clasesDelDia(horario, dia);
  return d.length === 0 ? null : Math.max(...d.map((c) => c.fin));
}

export interface SesionHoras {
  asignaturaId: string | null;
  fecha: string;
  minutos: number;
}

/** Minutos por asignatura en la semana (lunes a domingo) de `hoy`. `null` = bloques libres. */
export function minutosSemana(sesiones: readonly SesionHoras[], hoy: string): Map<string | null, number> {
  const lunes = lunesDe(hoy);
  const out = new Map<string | null, number>();
  for (const s of sesiones) {
    const d = diasEntre(lunes, s.fecha);
    if (d < 0 || d > 6 || !Number.isFinite(s.minutos) || s.minutos <= 0) continue;
    out.set(s.asignaturaId, (out.get(s.asignaturaId) ?? 0) + s.minutos);
  }
  return out;
}

/** Minutos de hoy y bloques de hoy. */
export function hoyEstudiado(sesiones: readonly SesionHoras[], hoy: string): { minutos: number; bloques: number } {
  const de = sesiones.filter((s) => s.fecha === hoy && s.minutos > 0);
  return { minutos: de.reduce((s, x) => s + x.minutos, 0), bloques: de.length };
}

/** «2 h 05 min», «45 min», «3 h». */
export function formatoHoras(min: number): { h: number; m: number } {
  const t = Math.max(0, Math.round(min));
  return { h: Math.floor(t / 60), m: t % 60 };
}

/** Días seguidos con al menos un bloque, terminando hoy o ayer. */
export function diasSeguidos(sesiones: readonly SesionHoras[], hoy: string): number {
  const dias = new Set(sesiones.filter((s) => s.minutos > 0).map((s) => s.fecha));
  let n = 0;
  let k = dias.has(hoy) ? 0 : 1;
  while (dias.has(sumarDias(hoy, -k))) {
    n++;
    k++;
  }
  return n;
}
