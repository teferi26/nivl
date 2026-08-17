import { describe, expect, test } from '@jest/globals';
import { computeDayClose, questsScheduledOn, rachaVisible } from '../closing';
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
    acquired_at: null,
    acquired_streak: null,
    created_at: '',
    ...partial,
  };
}

// 2026-06-08 fue lunes; 2026-06-11 jueves.
const LUNES = '2026-06-08';
const MARTES = '2026-06-09';
const JUEVES = '2026-06-11';

describe('questsScheduledOn', () => {
  test('filtra por día de la semana', () => {
    const soloLunes = makeQuest({ id: 'a', days_of_week: [1] });
    const soloViernes = makeQuest({ id: 'b', days_of_week: [5] });
    const ids = questsScheduledOn([soloLunes, soloViernes], LUNES).map((q) => q.id);
    expect(ids).toEqual(['a']);
  });

  test('las misiones de penalización solo aparecen en su fecha', () => {
    const penalty = makeQuest({ id: 'p', is_penalty: true, penalty_date: MARTES, days_of_week: [] });
    expect(questsScheduledOn([penalty], LUNES)).toHaveLength(0);
    expect(questsScheduledOn([penalty], MARTES)).toHaveLength(1);
  });

  test('las inactivas no cuentan', () => {
    const off = makeQuest({ active: false });
    expect(questsScheduledOn([off], LUNES)).toHaveLength(0);
  });
});

describe('computeDayClose', () => {
  const quest = makeQuest({ id: 'q1', difficulty: 'media' });

  test('día perfecto suma racha', () => {
    const out = computeDayClose({
      fromDate: LUNES,
      today: MARTES,
      quests: [quest],
      completedKeys: new Set([`${LUNES}|q1`]),
      streak: 3,
      stones: 0,
      freezeUntil: null,
    });
    expect(out.streak).toBe(4);
    expect(out.penaltyXp).toBe(0);
    expect(out.streakLost).toBe(false);
  });

  test('el 7º día perfecto forja una piedra (tope 3)', () => {
    const earned = computeDayClose({
      fromDate: LUNES,
      today: MARTES,
      quests: [quest],
      completedKeys: new Set([`${LUNES}|q1`]),
      streak: 6,
      stones: 0,
      freezeUntil: null,
    });
    expect(earned.streak).toBe(7);
    expect(earned.stones).toBe(1);
    expect(earned.stonesEarned).toBe(1);

    const capped = computeDayClose({
      fromDate: LUNES,
      today: MARTES,
      quests: [quest],
      completedKeys: new Set([`${LUNES}|q1`]),
      streak: 6,
      stones: 3,
      freezeUntil: null,
    });
    expect(capped.stones).toBe(3);
    expect(capped.stonesEarned).toBe(0);
  });

  test('día fallado sin piedras: penalización 50% y racha a cero', () => {
    const out = computeDayClose({
      fromDate: LUNES,
      today: MARTES,
      quests: [quest],
      completedKeys: new Set(),
      streak: 10,
      stones: 0,
      freezeUntil: null,
    });
    expect(out.penaltyXp).toBe(25);
    expect(out.streak).toBe(0);
    expect(out.streakLost).toBe(true);
    expect(out.missedTitles).toEqual(['Test']);
  });

  test('una piedra absorbe el día entero', () => {
    const out = computeDayClose({
      fromDate: LUNES,
      today: MARTES,
      quests: [quest],
      completedKeys: new Set(),
      streak: 10,
      stones: 2,
      freezeUntil: null,
    });
    expect(out.penaltyXp).toBe(0);
    expect(out.streak).toBe(10);
    expect(out.stones).toBe(1);
    expect(out.stonesUsed).toBe(1);
    expect(out.streakLost).toBe(false);
  });

  test('tope de daño diario: 150 XP', () => {
    const epicas = [1, 2, 3].map((n) =>
      makeQuest({ id: `e${n}`, title: `Épica ${n}`, difficulty: 'epica' }),
    );
    const out = computeDayClose({
      fromDate: LUNES,
      today: MARTES,
      quests: epicas,
      completedKeys: new Set(),
      streak: 0,
      stones: 0,
      freezeUntil: null,
    });
    expect(out.penaltyXp).toBe(150);
  });

  test('los días congelados no penalizan ni suman racha', () => {
    const out = computeDayClose({
      fromDate: LUNES,
      today: JUEVES,
      quests: [quest],
      completedKeys: new Set(),
      streak: 5,
      stones: 0,
      freezeUntil: '2026-06-10',
    });
    expect(out.penaltyXp).toBe(0);
    expect(out.streak).toBe(5);
    expect(out.frozenDays).toBe(3);
  });

  test('varios días: perfecto + fallado se procesan en orden', () => {
    const out = computeDayClose({
      fromDate: LUNES,
      today: '2026-06-10',
      quests: [quest],
      completedKeys: new Set([`${LUNES}|q1`]),
      streak: 0,
      stones: 0,
      freezeUntil: null,
    });
    expect(out.streak).toBe(0);
    expect(out.streakLost).toBe(true);
    expect(out.penaltyXp).toBe(25);
  });

  test('las misiones de penalización falladas no generan nueva penalización', () => {
    const penalty = makeQuest({
      id: 'p',
      is_penalty: true,
      penalty_date: LUNES,
      penalty_xp: 40,
      days_of_week: [],
    });
    const out = computeDayClose({
      fromDate: LUNES,
      today: MARTES,
      quests: [penalty],
      completedKeys: new Set(),
      streak: 0,
      stones: 0,
      freezeUntil: null,
    });
    expect(out.penaltyXp).toBe(0);
  });
});

describe('las penalizaciones no juzgan el día', () => {
  test('ignorar la penalización no vuelve a romper la racha', () => {
    // El escenario que lo destapó: el fallo original ya costó racha y XP. Si la
    // penalización pendiente cuenta como misión fallada, al día siguiente la
    // racha se rompe otra vez aunque se haya cumplido todo lo demás, y no hay
    // forma de arrancar de nuevo mientras haya una pendiente.
    const diaria = makeQuest({ id: 'd' });
    const penal = makeQuest({ id: 'p', is_penalty: true, penalty_date: LUNES, days_of_week: [] });
    const out = computeDayClose({
      fromDate: LUNES,
      today: MARTES,
      quests: [diaria, penal],
      completedKeys: new Set([`${LUNES}|d`]),
      streak: 4,
      stones: 0,
      freezeUntil: null,
    });
    expect(out.streak).toBe(5);
    expect(out.streakLost).toBe(false);
    expect(out.penaltyXp).toBe(0);
  });

  test('un día con solo penalización pendiente no cuenta como día fallado', () => {
    const penal = makeQuest({ id: 'p', is_penalty: true, penalty_date: LUNES, days_of_week: [] });
    const out = computeDayClose({
      fromDate: LUNES,
      today: MARTES,
      quests: [penal],
      completedKeys: new Set(),
      streak: 3,
      stones: 0,
      freezeUntil: null,
    });
    // Ni suma ni resta: ese día no tenía obligaciones de verdad.
    expect(out.streak).toBe(3);
    expect(out.penaltyXp).toBe(0);
  });

  test('fallar una misión de verdad sigue rompiendo la racha', () => {
    const diaria = makeQuest({ id: 'd' });
    const out = computeDayClose({
      fromDate: LUNES,
      today: MARTES,
      quests: [diaria],
      completedKeys: new Set(),
      streak: 9,
      stones: 0,
      freezeUntil: null,
    });
    expect(out.streak).toBe(0);
    expect(out.streakLost).toBe(true);
    expect(out.penaltyXp).toBe(25);
  });
});

describe('rachaVisible', () => {
  const hoy = [makeQuest({ id: 'a' }), makeQuest({ id: 'b' })];

  test('suma el día en curso cuando ya está cerrado', () => {
    const r = rachaVisible(6, hoy, new Set(['a', 'b']));
    expect(r).toEqual({ valor: 7, hoyCerrado: true });
  });

  test('no lo suma si queda algo pendiente', () => {
    expect(rachaVisible(6, hoy, new Set(['a']))).toEqual({ valor: 6, hoyCerrado: false });
  });

  test('la penalización pendiente no impide cerrar el día', () => {
    const conPenal = [...hoy, makeQuest({ id: 'p', is_penalty: true, penalty_date: LUNES })];
    expect(rachaVisible(2, conPenal, new Set(['a', 'b'])).valor).toBe(3);
  });

  test('un día sin misiones programadas no cierra nada', () => {
    // Domingo sin nada que hacer no es una racha ganada, es un día libre.
    expect(rachaVisible(4, [], new Set())).toEqual({ valor: 4, hoyCerrado: false });
  });
});
