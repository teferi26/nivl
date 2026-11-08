import { debeEsperarAManana } from '../closing';
import type { Quest } from '../types';

const hoy = '2026-11-08'; // domingo
const base = {
  id: 'q1', active: true, is_penalty: false, is_bonus: false, acquired_at: null,
  days_of_week: [1, 2, 3, 4, 5, 6, 7], created_at: '2026-11-01T10:00:00',
} as unknown as Quest;

describe('debeEsperarAManana', () => {
  test('pendiente hoy: espera', () => expect(debeEsperarAManana(base, hoy, new Set())).toBe(true));
  test('ya hecha hoy: se puede tocar', () => expect(debeEsperarAManana(base, hoy, new Set(['q1']))).toBe(false));
  test('creada hoy: se puede corregir', () => {
    expect(debeEsperarAManana({ ...base, created_at: '2026-11-08T10:00:00' }, hoy, new Set())).toBe(false);
  });
  test('no toca hoy: se puede tocar', () => {
    expect(debeEsperarAManana({ ...base, days_of_week: [] } as Quest, hoy, new Set())).toBe(false);
  });
  test('inactiva, penalización y extra no esperan', () => {
    for (const cambio of [{ active: false }, { is_penalty: true }, { is_bonus: true }]) {
      expect(debeEsperarAManana({ ...base, ...cambio } as Quest, hoy, new Set())).toBe(false);
    }
  });
});
