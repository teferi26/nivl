import { describe, expect, test } from '@jest/globals';
import { checkPassword, isValidEmail, isValidName } from '../validation';

describe('isValidEmail', () => {
  test('acepta correos válidos', () => {
    expect(isValidEmail('gladiador@nivl.app')).toBe(true);
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

describe('checkPassword (política Franky, NIST 800-63B)', () => {
  test('menos de 12 caracteres no es válida para registrar', () => {
    const r = checkPassword('Ab1cdefg');
    expect(r.ok).toBe(false);
    expect(r.missing[0]).toContain('12 caracteres');
  });

  test('una frase en minúsculas de 12+ es válida: no hay reglas de composición', () => {
    const r = checkPassword('el gato de mi abuela ronca');
    expect(r.ok).toBe(true);
    expect(r.missing).toHaveLength(0);
    expect(r.strength).toBe('fuerte');
  });

  test('12 caracteres repetitivos se rechazan aunque cumplan la longitud', () => {
    const r = checkPassword('aaaaaaaaaaaa');
    expect(r.ok).toBe(false);
    expect(r.missing).toContain('más variedad de caracteres');
  });

  test('solo espacios se rechaza', () => {
    expect(checkPassword('            ').ok).toBe(false);
  });

  test('las contraseñas de diccionario puntúan cero', () => {
    const r = checkPassword('password12345');
    expect(r.strength).toBe('debil');
    expect(r.score).toBe(0);
  });

  test('el score se acota a 0..4', () => {
    const r = checkPassword('Gladiador2026!SuperLarga$$');
    expect(r.score).toBeLessThanOrEqual(4);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});

describe('isValidName', () => {
  test('acepta nombres normales y recorta espacios', () => {
    expect(isValidName('Teferi')).toBe(true);
    expect(isValidName('  Pau  ')).toBe(true);
  });
  test('rechaza vacío y demasiado largo', () => {
    expect(isValidName('   ')).toBe(false);
    expect(isValidName('x'.repeat(25))).toBe(false);
  });
});
