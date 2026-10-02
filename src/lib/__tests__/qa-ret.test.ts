// QA Chat 5 · RET-02/03 en las piezas puras de closing.ts.

import { computeDayClose, recuperacionDesbloqueada, rotosSeguidosAntes } from '../closing';
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
