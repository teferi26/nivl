import type { Completion, Quest } from '@/lib/types';
import { derivarInforme } from '../derivarInforme';

const HOY = '2026-10-02'; // viernes

function q(id: string, stat: Quest['stat'], is_penalty = false): Quest {
  return { id, stat, is_penalty } as Quest;
}

function c(quest_id: string, date: string, xp: number, evidencia = false): Completion {
  return {
    id: `${quest_id}-${date}`,
    user_id: 'u',
    quest_id,
    date,
    completed_at: `${date}T10:00:00Z`,
    xp_awarded: xp,
    evidence_url: evidencia ? 'x.jpg' : null,
  };
}

describe('derivarInforme', () => {
  const quests = [q('a', 'FUE'), q('b', 'INT'), q('p', 'VIT', true)];

  it('sin actividad: ceros, sin delta y la frase del capítulo en blanco', () => {
    const d = derivarInforme([], quests, HOY);
    expect(d.misiones).toBe(0);
    expect(d.xpWeek).toBe(0);
    expect(d.delta).toBeNull();
    expect(d.evidencePct).toBe(0);
    expect(d.narrative).toMatch(/capítulos en blanco/);
    expect(d.subtitulo).toBe('Sin actividad registrada en los últimos siete días.');
  });

  it('semana frente a la previa, evidencia, estadística dominante sin penalizaciones y mejor día', () => {
    const cs = [
      c('a', '2026-10-02', 40, true),
      c('b', '2026-09-30', 25),
      c('a', '2026-09-30', 40, true),
      c('p', '2026-09-29', 100),
      c('a', '2026-09-24', 50), // semana previa
    ];
    const d = derivarInforme(cs, quests, HOY);
    expect(d.misiones).toBe(4);
    expect(d.xpWeek).toBe(205);
    expect(d.delta).toBe(310);
    expect(d.evidencePct).toBe(50);
    expect(d.xpByStat).toEqual({ FUE: 80, VIT: 0, INT: 25, AGI: 0, PER: 0 });
    expect(d.topStat).toBe('FUE');
    expect(d.byDay['2026-09-30']).toBe(2);
    expect(d.narrative).toMatch(/mejor día fue el martes \(\+100 XP\)/);
  });
});
