import { describe, expect, test } from '@jest/globals';
import {
  DUNGEON_CLEAR_XP,
  dungeonTaskXp,
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
