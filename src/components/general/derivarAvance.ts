// NIVL · Modo GENERAL · Avance: las cuentas (puro, con test). Solo LEE lo que
// ya hay (misiones, cumplimientos y el perfil): no paga ni quita nada.
//
//   · XP por semana: las 8 últimas semanas de 7 días que acaban hoy.
//   · Cumplimiento: misiones cumplidas / programadas de cada uno de los
//     últimos 28 días (las programadas, con questsScheduledOn de closing.ts;
//     una misión no cuenta antes del día en que se creó; sin penalizaciones).
//   · Racha: la vigente es la del perfil (la que paga); la mejor es la tanda
//     más larga de días seguidos con alguna misión cumplida en lo cargado.
//   · Estadísticas: el XP acumulado de cada una (perfil) y el de esta semana.

import { questsScheduledOn } from '@/lib/closing';
import { addDays } from '@/lib/dates';
import { STATS } from '@/lib/game';
import type { Completion, Quest, Stat } from '@/lib/types';

export const SEMANAS_AVANCE = 8;
export const DIAS_CUMPLIMIENTO = 28;
/** Lo que se pide para tener las 8 semanas: 56 días. */
export const DIAS_CARGA = SEMANAS_AVANCE * 7;

export interface DiaCumplimiento {
  fecha: string;
  hechas: number;
  programadas: number;
}

export interface DatosAvance {
  semanas: { inicio: string; xp: number }[];
  xpSemana: number;
  /** % frente a la semana anterior; null si la anterior fue 0. */
  delta: number | null;
  dias: DiaCumplimiento[];
  /** 0 a 100; null sin nada programado. */
  cumplimiento7: number | null;
  cumplimiento28: number | null;
  rachaActual: number;
  rachaMejor: number;
  /** Días con alguna misión cumplida en los últimos 28. */
  diasActivos28: number;
  stats: { stat: Stat; total: number; semana: number }[];
}

export interface EntradaAvance {
  completions: readonly Completion[];
  quests: readonly Quest[];
  today: string;
  rachaActual: number;
  /** XP acumulado por estadística (perfil: xp_fue, xp_vit…). */
  xpStats: Record<Stat, number>;
}

function pct(hechas: number, programadas: number): number | null {
  if (programadas <= 0) return null;
  return Math.round((Math.min(hechas, programadas) / programadas) * 100);
}

export function derivarAvance(e: EntradaAvance): DatosAvance {
  const { completions, quests, today } = e;
  const xpDe = (desde: string, hasta: string) =>
    completions.filter((c) => c.date >= desde && c.date <= hasta).reduce((a, c) => a + c.xp_awarded, 0);

  const semanas: { inicio: string; xp: number }[] = [];
  for (let i = SEMANAS_AVANCE - 1; i >= 0; i--) {
    const fin = addDays(today, -7 * i);
    const inicio = addDays(fin, -6);
    semanas.push({ inicio, xp: xpDe(inicio, fin) });
  }
  const xpSemana = semanas[semanas.length - 1]?.xp ?? 0;
  const xpPrevia = semanas[semanas.length - 2]?.xp ?? 0;
  const delta = xpPrevia > 0 ? Math.round(((xpSemana - xpPrevia) / xpPrevia) * 100) : null;

  const normales = quests.filter((q) => !q.is_penalty);
  const idsNormales = new Set(normales.map((q) => q.id));
  const hechasPorDia = new Map<string, Set<string>>();
  const activos = new Set<string>();
  for (const c of completions) {
    activos.add(c.date);
    if (!idsNormales.has(c.quest_id)) continue;
    const s = hechasPorDia.get(c.date) ?? new Set<string>();
    s.add(c.quest_id);
    hechasPorDia.set(c.date, s);
  }

  const dias: DiaCumplimiento[] = [];
  for (let i = DIAS_CUMPLIMIENTO - 1; i >= 0; i--) {
    const fecha = addDays(today, -i);
    const programadas = questsScheduledOn(
      normales.filter((q) => q.created_at.slice(0, 10) <= fecha),
      fecha,
    );
    const ids = new Set(programadas.map((q) => q.id));
    const hechas = [...(hechasPorDia.get(fecha) ?? [])].filter((id) => ids.has(id)).length;
    dias.push({ fecha, hechas, programadas: programadas.length });
  }
  const suma = (lista: DiaCumplimiento[]) =>
    lista.reduce((a, d) => ({ h: a.h + Math.min(d.hechas, d.programadas), p: a.p + d.programadas }), { h: 0, p: 0 });
  const s7 = suma(dias.slice(-7));
  const s28 = suma(dias);

  // La mejor tanda de días seguidos con algo cumplido (en lo cargado).
  const fechas = [...activos].sort();
  let mejor = 0;
  let tanda = 0;
  let previa: string | null = null;
  for (const f of fechas) {
    tanda = previa !== null && addDays(previa, 1) === f ? tanda + 1 : 1;
    mejor = Math.max(mejor, tanda);
    previa = f;
  }

  const inicioSemana = addDays(today, -6);
  const porId = new Map(quests.map((q) => [q.id, q]));
  const semanaStat: Record<Stat, number> = { FUE: 0, VIT: 0, INT: 0, AGI: 0, PER: 0 };
  for (const c of completions) {
    if (c.date < inicioSemana || c.date > today) continue;
    const q = porId.get(c.quest_id);
    if (q && !q.is_penalty) semanaStat[q.stat] += c.xp_awarded;
  }

  const desde28 = addDays(today, -(DIAS_CUMPLIMIENTO - 1));
  return {
    semanas,
    xpSemana,
    delta,
    dias,
    cumplimiento7: pct(s7.h, s7.p),
    cumplimiento28: pct(s28.h, s28.p),
    rachaActual: e.rachaActual,
    rachaMejor: Math.max(mejor, e.rachaActual),
    diasActivos28: fechas.filter((f) => f >= desde28 && f <= today).length,
    stats: STATS.map((s) => ({ stat: s, total: e.xpStats[s] ?? 0, semana: semanaStat[s] })),
  };
}
