import { describe, expect, test } from '@jest/globals';
import {
  CARDIO_DAILY_CAP,
  CARDIO_SESSION_XP,
  CARDIO_WALK_XP,
  cardioXp,
  DUNGEON_CLEAR_XP,
  dungeonTaskXp,
  goalProgress,
  levelFromXp,
  questXp,
  rankForLevel,
  statPoints,
  streakMultiplier,
  xpCostForLevel,
} from '../game';
import type { Quest } from '../types';

function makeQuest(partial: Partial<Quest>): Quest {
  return {
    id: 'q1',
    user_id: 'u1',
    title: 'Test',
    stat: 'FUE',
    difficulty: 'media',
    days_of_week: [1, 2, 3, 4, 5, 6, 7],
    requires_evidence: false,
    active: true,
    is_penalty: false,
    penalty_date: null,
    penalty_xp: null,
    is_bonus: false,
    created_at: '',
    ...partial,
  };
}

describe('curva de niveles', () => {
  test('nivel 1→2 cuesta 100 XP', () => {
    expect(xpCostForLevel(1)).toBe(100);
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
  });

  test('la curva es monótona creciente', () => {
    for (let n = 1; n < 60; n++) {
      expect(xpCostForLevel(n + 1)).toBeGreaterThan(xpCostForLevel(n));
    }
  });

  test('primer mes razonable: 250 XP/día × 30 días → nivel 8-12', () => {
    const { level } = levelFromXp(250 * 30);
    expect(level).toBeGreaterThanOrEqual(8);
    expect(level).toBeLessThanOrEqual(12);
  });
});

describe('rangos de cazador', () => {
  test('fronteras E→S', () => {
    expect(rankForLevel(1)).toBe('E');
    expect(rankForLevel(10)).toBe('E');
    expect(rankForLevel(11)).toBe('D');
    expect(rankForLevel(25)).toBe('D');
    expect(rankForLevel(26)).toBe('C');
    expect(rankForLevel(45)).toBe('C');
    expect(rankForLevel(46)).toBe('B');
    expect(rankForLevel(70)).toBe('B');
    expect(rankForLevel(71)).toBe('A');
    expect(rankForLevel(99)).toBe('A');
    expect(rankForLevel(100)).toBe('S');
  });
});

describe('multiplicador de racha', () => {
  test('sube +0,1 cada 7 días con tope ×1,5', () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(6)).toBe(1);
    expect(streakMultiplier(7)).toBeCloseTo(1.1);
    expect(streakMultiplier(14)).toBeCloseTo(1.2);
    expect(streakMultiplier(35)).toBeCloseTo(1.5);
    expect(streakMultiplier(700)).toBeCloseTo(1.5);
  });
});

describe('XP de misiones', () => {
  test('base por dificultad', () => {
    expect(questXp(makeQuest({ difficulty: 'media' }), { evidence: false, streakDays: 0 })).toBe(50);
    expect(questXp(makeQuest({ difficulty: 'epica' }), { evidence: false, streakDays: 0 })).toBe(250);
  });

  test('bonus de evidencia +25%', () => {
    expect(questXp(makeQuest({ difficulty: 'media' }), { evidence: true, streakDays: 0 })).toBe(63);
  });

  test('evidencia + racha se componen', () => {
    expect(questXp(makeQuest({ difficulty: 'media' }), { evidence: true, streakDays: 7 })).toBe(69);
  });

  test('las penalizaciones restauran exacto, sin bonus ni racha', () => {
    const penalty = makeQuest({ is_penalty: true, penalty_xp: 38 });
    expect(questXp(penalty, { evidence: true, streakDays: 70 })).toBe(38);
  });
});

describe('mazmorras', () => {
  test('los jefes dan ×2', () => {
    expect(dungeonTaskXp('media', false)).toBe(50);
    expect(dungeonTaskXp('media', true)).toBe(100);
  });

  test('el botín máximo (rango S) cabe en ~2 días normales', () => {
    expect(DUNGEON_CLEAR_XP.S).toBeLessThanOrEqual(600);
    expect(DUNGEON_CLEAR_XP.E).toBeLessThan(DUNGEON_CLEAR_XP.S);
  });
});

describe('puntos de stat', () => {
  test('1 punto por cada 100 XP', () => {
    expect(statPoints(0)).toBe(0);
    expect(statPoints(99)).toBe(0);
    expect(statPoints(250)).toBe(2);
  });
});

describe('goalProgress (metas medibles)', () => {
  test('meta de bajar peso: 85 → 78', () => {
    expect(goalProgress(85, 78, 85)).toBe(0);
    expect(goalProgress(85, 78, 81.5)).toBeCloseTo(0.5);
    expect(goalProgress(85, 78, 78)).toBe(1);
    expect(goalProgress(85, 78, 75)).toBe(1); // sobrepasada → 100%
  });

  test('meta de subir PR: 80 → 100', () => {
    expect(goalProgress(80, 100, 90)).toBeCloseTo(0.5);
    expect(goalProgress(80, 100, 70)).toBe(0); // retroceso → 0%
  });

  test('start === target no divide por cero', () => {
    expect(goalProgress(80, 80, 80)).toBe(1);
    expect(goalProgress(80, 80, 79)).toBe(0);
  });
});

describe('casos límite (auditoría de código)', () => {
  test('nivel tope 999 devuelve estado terminal sin desbordar el ratio', () => {
    const maxed = levelFromXp(5_000_000_000);
    expect(maxed.level).toBe(999);
    expect(maxed.next).toBe(0);
    expect(maxed.into).toBe(0);
  });

  test('racha negativa nunca reduce el multiplicador por debajo de ×1', () => {
    expect(streakMultiplier(-1)).toBe(1);
    expect(streakMultiplier(-100)).toBe(1);
  });
});

describe('cardioXp — tope diario y anti-grinding', () => {
  test('la primera sesión del día cobra completa', () => {
    expect(cardioXp('correr', 0)).toBe(CARDIO_SESSION_XP);
    expect(cardioXp('nadar', 0)).toBe(CARDIO_SESSION_XP);
  });

  test('caminar paga menos que entrenar', () => {
    expect(cardioXp('caminar', 0)).toBe(CARDIO_WALK_XP);
    expect(CARDIO_WALK_XP).toBeLessThan(CARDIO_SESSION_XP);
  });

  test('la segunda sesión cobra solo lo que queda hasta el tope', () => {
    expect(cardioXp('bici', CARDIO_SESSION_XP)).toBe(CARDIO_DAILY_CAP - CARDIO_SESSION_XP);
  });

  test('a partir del tope no se paga nada', () => {
    expect(cardioXp('correr', CARDIO_DAILY_CAP)).toBe(0);
    expect(cardioXp('correr', CARDIO_DAILY_CAP + 500)).toBe(0);
  });

  test('seis tipos de sesión no pueden dar un presupuesto diario entero', () => {
    // El agujero que esto cierra: 6 tipos × 40 XP = 240, un día completo de
    // misiones sacado desde una sola pantalla.
    let pagado = 0;
    for (const k of ['correr', 'nadar', 'bici', 'caminar', 'remo', 'otro']) {
      pagado += cardioXp(k, pagado);
    }
    expect(pagado).toBe(CARDIO_DAILY_CAP);
  });

  test('un total corrupto en negativo no regala XP extra', () => {
    expect(cardioXp('correr', -999)).toBe(CARDIO_SESSION_XP);
  });
});
