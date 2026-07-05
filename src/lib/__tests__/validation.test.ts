import { describe, expect, test } from '@jest/globals';
import { checkPassword, isValidEmail } from '../validation';

describe('isValidEmail', () => {
  test('acepta correos válidos', () => {
    expect(isValidEmail('cazador@nivl.app')).toBe(true);
    expect(isValidEmail('a.b-c+d@sub.example.co')).toBe(true);
    expect(isValidEmail('  teferi@gmail.com  ')).toBe(true); // trim
  });

  test('rechaza correos inválidos', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('sinarroba.com')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false); // sin TLD
    expect(isValidEmail('a @b.com')).toBe(false); // espacio
    expect(isValidEmail('a@@b.com')).toBe(false);
  });
});

describe('checkPassword', () => {
  test('menos de 8 caracteres no es válida para registrar', () => {
    const r = checkPassword('Ab1');
    expect(r.ok).toBe(false);
    expect(r.missing).toContain('8 caracteres');
  });

  test('8+ caracteres es válida aunque no sea fuerte', () => {
    const r = checkPassword('todoenminuscula');
    expect(r.ok).toBe(true);
    expect(r.strength).not.toBe('fuerte');
  });

  test('mezcla larga con símbolo es fuerte', () => {
    const r = checkPassword('Cazador2026!');
    expect(r.ok).toBe(true);
    expect(r.strength).toBe('fuerte');
    expect(r.missing).toHaveLength(0);
  });

  test('el score se acota a 0..4', () => {
    const r = checkPassword('Cazador2026!SuperLarga$$');
    expect(r.score).toBeLessThanOrEqual(4);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});
