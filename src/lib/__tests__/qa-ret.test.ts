// QA Chat 5 · RET-02/03 en las piezas puras de closing.ts.

import { computeDayClose, enJuegoHoy, rachaVisible, recuperacionDesbloqueada, rotosSeguidosAntes } from '../closing';
import { mision } from './qa/servidor';

const q = mision({ id: 'q', difficulty: 'media' });

test('las piedras no se gastan en días que ya no se cobran', () => {
  // Trae 3 días rotos seguidos y racha 0, con 2 piedras: el 4º día es exento.
  const r = computeDayClose({ fromDate: '2026-10-09', today: '2026-10-10', quests: [q], completedKeys: new Set(),
    streak: 0, stones: 2, freezeUntil: null, rotosSeguidosPrevios: 3 });
  expect(r).toMatchObject({ stones: 2, stonesUsed: 0, penaltyXp: 0, diasExentos: ['2026-10-09'] });
});

test('con racha viva, la piedra sigue salvando el día aunque traiga días rotos contados', () => {
  // La mirada atrás puede contar como roto un día salvado por piedra: si la
  // racha sigue viva, manda la piedra, no la exención.
  const r = computeDayClose({ fromDate: '2026-10-09', today: '2026-10-10', quests: [q], completedKeys: new Set(),
    streak: 12, stones: 1, freezeUntil: null, rotosSeguidosPrevios: 3 });
  expect(r).toMatchObject({ stonesUsed: 1, streak: 12, penaltyXp: 0, diasExentos: [] });
});

test('un día cumplido reinicia la cuenta de días rotos', () => {
  const keys = new Set(['2026-10-04|q']);
  const r = computeDayClose({ fromDate: '2026-10-01', today: '2026-10-10', quests: [q], completedKeys: keys,
    streak: 0, stones: 0, freezeUntil: null });
  // 01-03 cobrados, 04 cumplido, 05-07 cobrados, 08-09 exentos.
  expect(r.porDia.map((d) => d.date)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05', '2026-10-06', '2026-10-07']);
  expect(r.diasExentos).toEqual(['2026-10-08', '2026-10-09']);
});

test('rotosSeguidosAntes se para en el primer día cumplido y en la congelación', () => {
  const keys = new Set(['2026-10-06|q']);
  expect(rotosSeguidosAntes({ fromDate: '2026-10-09', quests: [q], completedKeys: keys, freezeUntil: null })).toBe(2);
  expect(rotosSeguidosAntes({ fromDate: '2026-10-09', quests: [q], completedKeys: new Set(), freezeUntil: '2026-10-07' })).toBe(1);
  // Una misión creada después no cuenta para días anteriores a su alta.
  const nueva = mision({ id: 'n', created_at: '2026-10-08T10:00:00' });
  expect(rotosSeguidosAntes({ fromDate: '2026-10-09', quests: [nueva], completedKeys: new Set(), freezeUntil: null })).toBe(1);
});

test('recuperacionDesbloqueada: sin misiones válidas hoy no hay candado; bonus y penalización no abren', () => {
  const hoy = '2026-10-10';
  const bonus = mision({ id: 'b', is_bonus: true });
  expect(recuperacionDesbloqueada([], new Set(), hoy)).toBe(true);
  expect(recuperacionDesbloqueada([q, bonus], new Set(['b']), hoy)).toBe(false);
  expect(recuperacionDesbloqueada([q, bonus], new Set(['q']), hoy)).toBe(true);
  expect(recuperacionDesbloqueada([mision({ id: 'x', created_at: '2026-10-10T07:00:00' })], new Set(), hoy)).toBe(true);
});

test('sin piedras, abrir cada día o volver de golpe cobra lo mismo', () => {
  const desde = '2026-10-01';
  const hasta = '2026-10-07'; // 6 días rotos: 01–06
  const bloque = computeDayClose({ fromDate: desde, today: hasta, quests: [q], completedKeys: new Set(), streak: 0, stones: 0, freezeUntil: null });
  let diario = 0;
  let streak = 0;
  for (const [d, mañana] of [['01', '02'], ['02', '03'], ['03', '04'], ['04', '05'], ['05', '06'], ['06', '07']]) {
    const fromDate = `2026-10-${d}`;
    const r = computeDayClose({ fromDate, today: `2026-10-${mañana}`, quests: [q], completedKeys: new Set(), streak, stones: 0, freezeUntil: null,
      rotosSeguidosPrevios: rotosSeguidosAntes({ fromDate, quests: [mision({ id: 'q', difficulty: 'media', created_at: '2026-10-01T00:00:00' })], completedKeys: new Set(), freezeUntil: null }) });
    diario += r.penaltyXp;
    streak = r.streak;
  }
  expect(bloque.penaltyXp).toBe(75);
  expect(diario).toBe(bloque.penaltyXp);
});

describe('RET-05 · enJuegoHoy dice lo mismo que dirá el cierre', () => {
  const qs = [1, 2, 3, 4].map((i) => mision({ id: `m${i}`, difficulty: 'media' }));
  test('con 4 misiones se perdona 1: con 2 pendientes falta 1 para salvar y cuestan 50', () => {
    const r = enJuegoHoy({ questsHoy: qs, completadasHoy: new Set(['m1', 'm2']), streak: 10, stones: 0 });
    expect(r).toEqual({ pendientes: 2, faltanParaSalvar: 1, rachaEnRiesgo: true, gastariaPiedra: false, xpEnJuego: 50 });
    // Y el cierre coincide.
    const c = computeDayClose({ fromDate: '2026-10-09', today: '2026-10-10', quests: qs.map((q) => ({ ...q })),
      completedKeys: new Set(['2026-10-09|m1', '2026-10-09|m2']), streak: 10, stones: 0, freezeUntil: null });
    expect([c.streakLost, c.penaltyXp]).toEqual([true, 50]);
  });
  test('salvada por la tolerancia: sin riesgo de racha pero lo pendiente cuesta', () => {
    const r = enJuegoHoy({ questsHoy: qs, completadasHoy: new Set(['m1', 'm2', 'm3']), streak: 10, stones: 0 });
    expect(r).toMatchObject({ faltanParaSalvar: 0, rachaEnRiesgo: false, xpEnJuego: 25 });
  });
  test('una piedra la salvaría: sin coste', () => {
    expect(enJuegoHoy({ questsHoy: qs, completadasHoy: new Set(), streak: 10, stones: 1 }))
      .toMatchObject({ gastariaPiedra: true, xpEnJuego: 0, rachaEnRiesgo: false });
  });
  test('cuarto día roto seguido con racha 0: no cuesta (RET-02)', () => {
    expect(enJuegoHoy({ questsHoy: qs, completadasHoy: new Set(), streak: 0, stones: 2, rotosSeguidosPrevios: 3 }))
      .toMatchObject({ xpEnJuego: 0, gastariaPiedra: false, rachaEnRiesgo: false });
  });
});

describe('auditoría de coherencia (fase 3)', () => {
  const media = (id: string, extra = {}) => mision({ id, difficulty: 'media', ...extra });
  test('las misiones extra no se juzgan: ni rompen la racha ni cobran XP', () => {
    const qs = [media('a'), media('b'), mision({ id: 'x', difficulty: 'dificil', is_bonus: true })];
    const r = computeDayClose({ fromDate: '2026-10-09', today: '2026-10-10', quests: qs,
      completedKeys: new Set(['2026-10-09|a', '2026-10-09|b']), streak: 10, stones: 0, freezeUntil: null });
    expect(r).toMatchObject({ streak: 11, streakLost: false, penaltyXp: 0 });
    expect(rachaVisible(10, qs, new Set(['a', 'b']))).toMatchObject({ valor: 11, perfecto: true });
  });
  test('con congelación vigente, la racha visible no suma ni celebra', () => {
    const qs = [media('a')];
    expect(rachaVisible(6, qs, new Set(['a']), { hoy: '2026-10-10', freezeUntil: '2026-10-10' }))
      .toMatchObject({ valor: 6, hoyCerrado: false });
    expect(rachaVisible(6, qs, new Set(['a']), { hoy: '2026-10-11', freezeUntil: '2026-10-10' }))
      .toMatchObject({ valor: 7, hoyCerrado: true });
  });
  test('enJuegoHoy suma las reglas sin marcar con el tope común de 150 (y la piedra no las absorbe)', () => {
    const qs = [media('a')];
    expect(enJuegoHoy({ questsHoy: qs, completadasHoy: new Set(), streak: 10, stones: 0, reglasSinMarcar: 3 }).xpEnJuego).toBe(100);
    expect(enJuegoHoy({ questsHoy: qs, completadasHoy: new Set(), streak: 10, stones: 1, reglasSinMarcar: 3 }).xpEnJuego).toBe(75);
    expect(enJuegoHoy({ questsHoy: [1, 2, 3, 4, 5].map((i) => media(`m${i}`)), completadasHoy: new Set(), streak: 10, stones: 0, reglasSinMarcar: 6 }).xpEnJuego).toBe(150);
  });
});
