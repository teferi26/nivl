// NIVL · WORK: la semana del héroe de Hoy y sus cifras cortas.
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));

import { semanaDelAno, textoDuracion } from '../textos';

describe('semanaDelAno (ISO 8601)', () => {
  it.each([
    ['2026-11-08', 45],
    ['2026-11-09', 46],
    ['2026-01-01', 1],
    ['2024-12-30', 1],
    ['2027-01-03', 53],
  ])('%s es la semana %i', (fecha, semana) => {
    expect(semanaDelAno(fecha)).toBe(semana);
  });
});

describe('textoDuracion', () => {
  it('por debajo de la hora, minutos; por encima, horas redondas', () => {
    expect(textoDuracion(45)).toBe('45 min');
    expect(textoDuracion(90)).toBe('2 h');
    expect(textoDuracion(540)).toBe('9 h');
  });
});
