import { describe, expect, test } from '@jest/globals';
import { addDays, isValidKey, weekdayOfKey } from '../dates';

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
