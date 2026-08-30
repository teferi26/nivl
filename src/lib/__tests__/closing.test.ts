import { describe, expect, test } from '@jest/globals';
import {
  computeDayClose,
  fallosPermitidos,
  questsScheduledOn,
  rachaVisible,
  reglasIncumplidas,
} from '../closing';
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
      perfectStreak: 6,
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
      perfectStreak: 6,
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

describe('tolerancia del día (30%)', () => {
  const ocho = Array.from({ length: 8 }, (_, i) => makeQuest({ id: `q${i}` }));
  // Los ocho tocan todos los días, así que el lunes se programan los ocho.
  const cerrar = (hechas: number, streak = 3, perfectStreak = 3) =>
    computeDayClose({
      fromDate: LUNES,
      today: MARTES,
      quests: ocho,
      completedKeys: new Set(ocho.slice(0, hechas).map((q) => `${LUNES}|${q.id}`)),
      streak,
      perfectStreak,
      stones: 0,
      freezeUntil: null,
    });

  test('con ocho misiones se perdonan dos fallos', () => {
    expect(fallosPermitidos(8)).toBe(2);
    const out = cerrar(6);
    expect(out.streak).toBe(4);
    expect(out.streakLost).toBe(false);
  });

  test('el tercer fallo sí rompe la racha', () => {
    const out = cerrar(5);
    expect(out.streak).toBe(0);
    expect(out.streakLost).toBe(true);
  });

  test('un día cumplido con fallos SÍ paga la penalización', () => {
    // La tolerancia salva la racha, no el bolsillo.
    const out = cerrar(6);
    expect(out.penaltyXp).toBeGreaterThan(0);
    expect(out.missedTitles).toHaveLength(2);
  });

  test('los días pequeños siguen exigiéndolo todo', () => {
    expect(fallosPermitidos(1)).toBe(0);
    expect(fallosPermitidos(2)).toBe(0);
    expect(fallosPermitidos(3)).toBe(0);
    expect(fallosPermitidos(4)).toBe(1);
  });

  test('un día cumplido pero imperfecto corta la racha PERFECTA, no la normal', () => {
    // Es lo que impide que las piedras se regalen al ablandarse la racha.
    const out = cerrar(6, 3, 6);
    expect(out.streak).toBe(4);
    expect(out.perfectStreak).toBe(0);
    expect(out.stonesEarned).toBe(0);
  });

  test('el día perfecto suma en las dos rachas', () => {
    const out = cerrar(8, 3, 3);
    expect(out.streak).toBe(4);
    expect(out.perfectStreak).toBe(4);
    expect(out.penaltyXp).toBe(0);
  });
});

describe('rachaVisible', () => {
  const hoy = [makeQuest({ id: 'a' }), makeQuest({ id: 'b' })];

  test('suma el día en curso cuando ya está cerrado', () => {
    const r = rachaVisible(6, hoy, new Set(['a', 'b']));
    expect(r).toEqual({ valor: 7, hoyCerrado: true, perfecto: true, faltan: 0 });
  });

  test('no lo suma si queda algo pendiente', () => {
    // Con dos misiones la tolerancia es cero: floor(2 × 0,3) = 0.
    expect(rachaVisible(6, hoy, new Set(['a']))).toEqual({
      valor: 6,
      hoyCerrado: false,
      perfecto: false,
      faltan: 1,
    });
  });

  test('la penalización pendiente no impide cerrar el día', () => {
    const conPenal = [...hoy, makeQuest({ id: 'p', is_penalty: true, penalty_date: LUNES })];
    expect(rachaVisible(2, conPenal, new Set(['a', 'b'])).valor).toBe(3);
  });

  test('un día sin misiones programadas no cierra nada', () => {
    // Domingo sin nada que hacer no es una racha ganada, es un día libre.
    expect(rachaVisible(4, [], new Set())).toEqual({
      valor: 4,
      hoyCerrado: false,
      perfecto: false,
      faltan: 0,
    });
  });
});

describe('reglasIncumplidas', () => {
  const reglas = [
    { id: 'r1', text: 'Nada de pantallas después de las 22:00', consequence: 'Correr 5 km' },
    { id: 'r2', text: 'Sin azúcar', consequence: '20 burpees' },
  ];
  const base = {
    fromDate: LUNES,
    today: MARTES,
    reglas,
    freezeUntil: null,
    xpPorRegla: 25,
    topeDiario: 150,
  };

  // El juicio solo arranca cuando ya ha marcado alguna vez: con el historial
  // virgen no se castiga (ver "arranque justo" más abajo). Estos casos parten
  // de alguien que YA usa el contrato, marcando el lunes.
  const yaLoUsa = (marcadasElLunes: string[]) => new Map([[LUNES, new Set(marcadasElLunes)]]);

  test('lo no marcado cuenta como roto', () => {
    const r = reglasIncumplidas({ ...base, checksPorDia: yaLoUsa(['r1']) });
    expect(r).toHaveLength(1);
    expect(r[0]!.rotas.map((x) => x.id)).toEqual(['r2']);
    expect(r[0]!.xp).toBe(25);
  });

  test('marcarlas todas no genera consecuencia', () => {
    expect(reglasIncumplidas({ ...base, checksPorDia: yaLoUsa(['r1', 'r2']) })).toEqual([]);
  });

  test('el castigo diario tiene tope', () => {
    // Sin tope, una ausencia larga con muchas reglas se vuelve impagable y el
    // sistema deja de ser exigente para ser uno del que te vas.
    const muchas = Array.from({ length: 12 }, (_, i) => ({
      id: `r${i}`,
      text: `Regla ${i}`,
      consequence: 'algo',
    }));
    // Marca una sola para que el juicio esté activo; las once que faltan pasan
    // del tope y se quedan en 150.
    const r = reglasIncumplidas({
      ...base,
      reglas: muchas,
      checksPorDia: new Map([[LUNES, new Set(['r0'])]]),
    });
    expect(r[0]!.xp).toBe(150);
  });

  test('los días congelados no se juzgan', () => {
    const r = reglasIncumplidas({ ...base, checksPorDia: yaLoUsa(['r1']), freezeUntil: LUNES });
    expect(r).toEqual([]);
  });

  test('sin reglas no hay nada que juzgar', () => {
    expect(reglasIncumplidas({ ...base, reglas: [], checksPorDia: new Map() })).toEqual([]);
  });

  test('el día de hoy no se juzga: sigue abierto', () => {
    const r = reglasIncumplidas({
      ...base,
      fromDate: MARTES,
      today: MARTES,
      checksPorDia: yaLoUsa(['r1']),
    });
    expect(r).toEqual([]);
  });
});

describe('reglasIncumplidas — arranque justo', () => {
  const reglas = [{ id: 'r1', text: 'Sin azúcar', consequence: '20 burpees' }];
  const MIERCOLES = '2026-06-10';

  test('quien nunca ha marcado nada no es castigado', () => {
    // El día que la función existe, el historial entero está sin marcar. Sin
    // esta guarda el primer cierre cobraría semanas de una función que no
    // existía, y eso no es exigencia: es una emboscada.
    const r = reglasIncumplidas({
      fromDate: LUNES,
      today: JUEVES,
      reglas,
      checksPorDia: new Map(),
      freezeUntil: null,
      xpPorRegla: 25,
      topeDiario: 150,
    });
    expect(r).toEqual([]);
  });

  test('el juicio empieza el día de la primera marca, no antes', () => {
    const checks = new Map([[MARTES, new Set(['r1'])]]);
    const r = reglasIncumplidas({
      fromDate: LUNES,
      today: JUEVES,
      reglas,
      checksPorDia: checks,
      freezeUntil: null,
      xpPorRegla: 25,
      topeDiario: 150,
    });
    // El lunes queda fuera; el martes está marcado; el miércoles sí se juzga.
    expect(r.map((d) => d.date)).toEqual([MIERCOLES]);
  });
});
