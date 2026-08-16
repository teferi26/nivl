import { describe, expect, test } from '@jest/globals';
import { addDays, isValidKey, nombreDia, relativoDe, weekdayOfKey } from '../dates';

describe('isValidKey', () => {
  test('acepta claves YYYY-MM-DD válidas', () => {
    expect(isValidKey('2026-06-11')).toBe(true);
    expect(isValidKey('2000-01-01')).toBe(true);
  });

  test('rechaza formatos corruptos', () => {
    expect(isValidKey('2026-6-1')).toBe(false);
    expect(isValidKey('')).toBe(false);
    expect(isValidKey('2026-13-01')).toBe(false);
    expect(isValidKey('2026-06-11T00:00:00')).toBe(false);
    expect(isValidKey('basura')).toBe(false);
  });
});

describe('addDays y weekdayOfKey', () => {
  test('addDays cruza meses y años', () => {
    expect(addDays('2026-06-30', 1)).toBe('2026-07-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  test('weekdayOfKey: lunes=1 … domingo=7', () => {
    expect(weekdayOfKey('2026-06-08')).toBe(1);
    expect(weekdayOfKey('2026-06-14')).toBe(7);
  });

  test('una clave inválida lanza en vez de devolver NaN silencioso', () => {
    expect(() => weekdayOfKey('basura')).toThrow();
  });
});

describe('relativoDe', () => {
  const HOY = '2026-08-16';

  test('los días cercanos se nombran, no se cuentan', () => {
    expect(relativoDe('2026-08-16', HOY)).toBe('Hoy');
    expect(relativoDe('2026-08-15', HOY)).toBe('Ayer');
    expect(relativoDe('2026-08-17', HOY)).toBe('Mañana');
  });

  test('cuenta días hasta que dejan de significar algo', () => {
    expect(relativoDe('2026-08-11', HOY)).toBe('Hace 5 días');
    expect(relativoDe('2026-08-04', HOY)).toBe('Hace 12 días');
  });

  test('a partir de dos semanas pasa a semanas y luego a meses', () => {
    // "Hace 34 días" no lo procesa nadie de un vistazo.
    expect(relativoDe('2026-08-02', HOY)).toBe('Hace 2 semanas');
    expect(relativoDe('2026-05-16', HOY)).toBe('Hace 3 meses');
  });

  test('cruza el cambio de mes sin descuadrarse', () => {
    expect(relativoDe('2026-07-31', '2026-08-01')).toBe('Ayer');
  });
});

describe('nombreDia', () => {
  test('devuelve el día con su nombre y en mayúscula inicial', () => {
    expect(nombreDia('2026-08-16')).toMatch(/^Domingo, 16 de agosto$/);
  });
});
