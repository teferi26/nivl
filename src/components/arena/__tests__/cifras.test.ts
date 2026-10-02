import { formatoMiles, ordinal, ratioSeguro, romano } from '../cifras';

describe('formatoMiles', () => {
  it('agrupa con punto desde las cuatro cifras', () => {
    expect(formatoMiles(0)).toBe('0');
    expect(formatoMiles(999)).toBe('999');
    expect(formatoMiles(1840)).toBe('1.840');
    expect(formatoMiles(12500)).toBe('12.500');
    expect(formatoMiles(1234567)).toBe('1.234.567');
  });

  it('negativos, decimales y no finitos', () => {
    expect(formatoMiles(-1840)).toBe('-1.840');
    expect(formatoMiles(1839.6)).toBe('1.840');
    expect(formatoMiles(Number.NaN)).toBe('-');
    expect(formatoMiles(Infinity)).toBe('-');
  });
});

describe('romano', () => {
  it('1..39', () => {
    expect([1, 2, 3, 4, 5, 6, 9, 10, 14, 19, 24, 39].map(romano)).toEqual([
      'I', 'II', 'III', 'IV', 'V', 'VI', 'IX', 'X', 'XIV', 'XIX', 'XXIV', 'XXXIX',
    ]);
  });

  it('fuera del rango devuelve el número', () => {
    expect(romano(0)).toBe('0');
    expect(romano(40)).toBe('40');
    expect(romano(2.5)).toBe('2.5');
  });
});

describe('ordinal', () => {
  it('pone el indicador masculino', () => {
    expect(ordinal(1)).toBe('1.º');
    expect(ordinal(3)).toBe('3.º');
    expect(ordinal(Number.NaN)).toBe('-');
  });
});

describe('ratioSeguro', () => {
  it('acota a 0..1', () => {
    expect(ratioSeguro(1840, 2200)).toBeCloseTo(0.836, 3);
    expect(ratioSeguro(3000, 2200)).toBe(1);
    expect(ratioSeguro(-5, 10)).toBe(0);
  });

  it('con divisor 0 o negativo la barra está llena', () => {
    expect(ratioSeguro(10, 0)).toBe(1);
    expect(ratioSeguro(0, -1)).toBe(1);
    expect(ratioSeguro(Number.NaN, 10)).toBe(0);
  });
});
