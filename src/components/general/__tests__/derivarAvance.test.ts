import type { Completion, Quest } from '@/lib/types';
import { derivarAvance, SEMANAS_AVANCE, DIAS_CUMPLIMIENTO } from '../derivarAvance';

const HOY = '2026-10-21'; // miércoles
const TODOS = [1, 2, 3, 4, 5, 6, 7];

function q(id: string, stat: Quest['stat'], extra: Partial<Quest> = {}): Quest {
  return {
    id,
    stat,
    is_penalty: false,
    active: true,
    acquired_at: null,
    days_of_week: TODOS,
    created_at: '2026-01-01T00:00:00Z',
    ...extra,
  } as Quest;
}

function c(quest_id: string, date: string, xp: number): Completion {
  return { id: `${quest_id}-${date}`, user_id: 'u', quest_id, date, completed_at: `${date}T10:00:00Z`, xp_awarded: xp, evidence_url: null };
}

const CERO = { FUE: 0, VIT: 0, INT: 0, AGI: 0, PER: 0 };

describe('derivarAvance', () => {
  it('reparte el XP en 8 semanas que acaban hoy y compara con la anterior', () => {
    const d = derivarAvance({
      completions: [c('a', HOY, 30), c('a', '2026-10-15', 20), c('a', '2026-10-14', 20), c('a', '2026-08-01', 99)],
      quests: [q('a', 'FUE')],
      today: HOY,
      rachaActual: 1,
      xpStats: CERO,
    });
    expect(d.semanas).toHaveLength(SEMANAS_AVANCE);
    expect(d.semanas[SEMANAS_AVANCE - 1]).toEqual({ inicio: '2026-10-15', xp: 50 });
    expect(d.semanas[SEMANAS_AVANCE - 2]!.xp).toBe(20);
    expect(d.xpSemana).toBe(50);
    expect(d.delta).toBe(150);
  });

  it('cumplimiento: hechas entre programadas, sin contar misiones antes de crearse ni penalizaciones', () => {
    const d = derivarAvance({
      completions: [c('a', HOY, 10), c('p', HOY, 50)],
      quests: [
        q('a', 'FUE'),
        q('b', 'INT', { created_at: `${HOY}T08:00:00Z` }),
        q('p', 'FUE', { is_penalty: true, penalty_date: HOY }),
      ],
      today: HOY,
      rachaActual: 0,
      xpStats: CERO,
    });
    expect(d.dias).toHaveLength(DIAS_CUMPLIMIENTO);
    expect(d.dias[DIAS_CUMPLIMIENTO - 1]).toEqual({ fecha: HOY, hechas: 1, programadas: 2 });
    expect(d.dias[0]!.programadas).toBe(1);
    // 1 de 2 hoy y 0 de 1 los otros 6 días.
    expect(d.cumplimiento7).toBe(Math.round((1 / 8) * 100));
  });

  it('sin nada programado el cumplimiento es null, no 0', () => {
    const d = derivarAvance({ completions: [], quests: [], today: HOY, rachaActual: 0, xpStats: CERO });
    expect(d.cumplimiento7).toBeNull();
    expect(d.cumplimiento28).toBeNull();
    expect(d.delta).toBeNull();
  });

  it('la mejor racha es la tanda más larga de días seguidos, y nunca menos que la vigente', () => {
    const fechas = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05', HOY];
    const d = derivarAvance({ completions: fechas.map((f) => c('a', f, 5)), quests: [q('a', 'VIT')], today: HOY, rachaActual: 1, xpStats: CERO });
    expect(d.rachaMejor).toBe(3);
    expect(d.diasActivos28).toBe(5);
    const e = derivarAvance({ completions: [], quests: [], today: HOY, rachaActual: 40, xpStats: CERO });
    expect(e.rachaMejor).toBe(40);
  });

  it('estadísticas: total del perfil y XP de esta semana por atributo', () => {
    const d = derivarAvance({
      completions: [c('a', HOY, 30), c('b', '2026-10-16', 12), c('b', '2026-10-01', 99)],
      quests: [q('a', 'FUE'), q('b', 'INT')],
      today: HOY,
      rachaActual: 0,
      xpStats: { ...CERO, FUE: 400, INT: 120 },
    });
    expect(d.stats.find((s) => s.stat === 'FUE')).toEqual({ stat: 'FUE', total: 400, semana: 30 });
    expect(d.stats.find((s) => s.stat === 'INT')).toEqual({ stat: 'INT', total: 120, semana: 12 });
  });
});
