// NIVL · Informe: las cuentas de la semana (FASE3 Lote F). Puro: sale tal
// cual de la antigua pantalla (informe.tsx), sin cambiar una regla: XP de
// los últimos siete días frente a los siete anteriores, misiones con
// evidencia, XP por estadística (sin las de penalización), el mejor día, el
// mapa de 13 semanas y la lectura en voz del sistema.

import { t } from '@/i18n';
import { nombreDia } from '@/i18n/formato';
import { STAT_LABEL, STATS } from '@/lib/game';
import { addDays } from '@/lib/dates';
import type { Completion, Quest, Stat as StatKey } from '@/lib/types';

export interface DatosInforme {
  /** Misiones completadas en los últimos siete días. */
  misiones: number;
  xpWeek: number;
  /** % frente a la semana previa; null si la previa fue 0. */
  delta: number | null;
  evidencePct: number;
  xpByStat: Record<StatKey, number>;
  topStat: StatKey;
  /** Misiones por día (AAAA-MM-DD) de todo lo cargado: el mapa. */
  byDay: Record<string, number>;
  narrative: string;
  subtitulo: string;
}

export function derivarInforme(completions: Completion[], quests: Quest[], today: string): DatosInforme {
  const weekStart = addDays(today, -6);
  const prevWeekStart = addDays(today, -13);

  const thisWeek = completions.filter((c) => c.date >= weekStart && c.date <= today);
  const prevWeek = completions.filter((c) => c.date >= prevWeekStart && c.date < weekStart);

  const xpWeek = thisWeek.reduce((a, c) => a + c.xp_awarded, 0);
  const xpPrev = prevWeek.reduce((a, c) => a + c.xp_awarded, 0);
  const delta = xpPrev > 0 ? Math.round(((xpWeek - xpPrev) / xpPrev) * 100) : null;

  const withEvidence = thisWeek.filter((c) => c.evidence_url !== null).length;
  const evidencePct = thisWeek.length > 0 ? Math.round((withEvidence / thisWeek.length) * 100) : 0;

  const questById = new Map(quests.map((q) => [q.id, q]));
  const xpByStat: Record<StatKey, number> = { FUE: 0, VIT: 0, INT: 0, AGI: 0, PER: 0 };
  for (const c of thisWeek) {
    const q = questById.get(c.quest_id);
    if (q && !q.is_penalty) xpByStat[q.stat] += c.xp_awarded;
  }
  const topStat = STATS.reduce((best, s) => (xpByStat[s] > xpByStat[best] ? s : best), 'FUE' as StatKey);

  const byDay: Record<string, number> = {};
  for (const c of completions) {
    byDay[c.date] = (byDay[c.date] ?? 0) + 1;
  }
  let bestDay: string | null = null;
  let bestDayXp = 0;
  for (const c of thisWeek) {
    const dayXp = thisWeek.filter((x) => x.date === c.date).reduce((a, x) => a + x.xp_awarded, 0);
    if (dayXp > bestDayXp) {
      bestDayXp = dayXp;
      bestDay = c.date;
    }
  }

  const narrative = (() => {
    if (thisWeek.length === 0) {
      return t('informe:lectura.sinActividad');
    }
    const parts: string[] = [];
    parts.push(t('informe:lectura.completadas', { misiones: thisWeek.length, xp: xpWeek }));
    if (delta !== null) {
      parts.push(
        delta >= 0
          ? t('informe:lectura.sube', { delta })
          : t('informe:lectura.baja', { delta: Math.abs(delta) }),
      );
    }
    parts.push(t('informe:lectura.dominante', { stat: topStat, nombre: STAT_LABEL[topStat] }));
    if (bestDay) {
      const [y, m, d] = bestDay.split('-').map(Number);
      const wd = new Date(y!, m! - 1, d!).getDay();
      parts.push(t('informe:lectura.mejorDia', { dia: nombreDia(wd === 0 ? 6 : wd - 1), xp: bestDayXp }));
    }
    if (evidencePct >= 50) {
      parts.push(t('informe:lectura.evidencia', { pct: evidencePct }));
    }
    return parts.join(' ');
  })();

  const subtitulo =
    thisWeek.length === 0
      ? t('informe:lectura.subtituloVacio')
      : delta !== null
        ? t('informe:lectura.subtituloDelta', { xp: xpWeek, delta: `${delta >= 0 ? '+' : ''}${delta}` })
        : t('informe:lectura.subtitulo', { xp: xpWeek });

  return { misiones: thisWeek.length, xpWeek, delta, evidencePct, xpByStat, topStat, byDay, narrative, subtitulo };
}
