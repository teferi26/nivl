import { describe, expect, test } from '@jest/globals';
import { alSoltar, formatoGrabacion, unirDictado, UMBRAL_CANCELAR } from '../coach/dictadoGesto';

describe('formatoGrabacion', () => {
  test('minutos y segundos con dos cifras', () => {
    expect(formatoGrabacion(0)).toBe('0:00');
    expect(formatoGrabacion(4200)).toBe('0:04');
    expect(formatoGrabacion(59999)).toBe('0:59');
    expect(formatoGrabacion(72000)).toBe('1:12');
  });

  test('nunca negativo ni NaN', () => {
    expect(formatoGrabacion(-500)).toBe('0:00');
    expect(formatoGrabacion(Number.NaN)).toBe('0:00');
  });
});

describe('alSoltar', () => {
  test('el umbral es -60', () => {
    expect(UMBRAL_CANCELAR).toBe(-60);
  });

  test('soltar sin desplazarse escribe lo dictado', () => {
    expect(alSoltar(0)).toBe('detener');
    expect(alSoltar(-59)).toBe('detener');
    expect(alSoltar(40)).toBe('detener');
  });

  test('deslizar hacia arriba cancela', () => {
    expect(alSoltar(-60)).toBe('cancelar');
    expect(alSoltar(-200)).toBe('cancelar');
  });

  test('un desplazamiento roto no cancela', () => {
    expect(alSoltar(Number.NaN)).toBe('detener');
  });
});

describe('unirDictado', () => {
  test('cuadro vacío', () => {
    expect(unirDictado('', 'hoy he entrenado')).toBe('hoy he entrenado');
    expect(unirDictado('   ', 'hola')).toBe('hola');
  });

  test('se añade con un espacio', () => {
    expect(unirDictado('Mira', 'esto')).toBe('Mira esto');
    expect(unirDictado('Mira ', 'esto')).toBe('Mira esto');
    expect(unirDictado('Mira\n', 'esto')).toBe('Mira\nesto');
  });

  test('un final vacío no toca nada', () => {
    expect(unirDictado('Mira', '  ')).toBe('Mira');
  });
});
