// NIVL · Idiomas: en español, el formato sale EXACTAMENTE igual que antes de
// 1.0.10 (arena/cifras, components/fecha y economia/formato delegan aquí).
import { formatoMiles } from '@/components/arena/cifras';
import { eur, eurSigno, num } from '@/components/economia/formato';
import { fechaCorta as fechaCortaComponente } from '@/components/fecha';
import { capital, decimal, fechaCorta, mayus, miles, moneda, nombreDia } from '@/i18n/formato';

// Lo que hacían las funciones viejas, copiado tal cual de 40abdbe.
const numViejo = (n: number, dec = 0) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const eurViejo = (n: number, dec = 0) => `${numViejo(n, dec)} €`;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fechaCortaVieja(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1] ?? ''}`;
}

describe('miles (es)', () => {
  it('agrupa con punto desde cuatro cifras', () => {
    expect(miles(1840)).toBe('1.840');
    expect(miles(0)).toBe('0');
    expect(miles(999)).toBe('999');
    expect(miles(1000)).toBe('1.000');
    expect(miles(245000)).toBe('245.000');
    expect(miles(1234567)).toBe('1.234.567');
    expect(miles(-12500)).toBe('-12.500');
    expect(miles(1839.6)).toBe('1.840');
  });

  it('un no finito es la cifra vacía', () => {
    expect(miles(NaN)).toBe('-');
    expect(miles(Infinity)).toBe('-');
  });

  it('formatoMiles de la arena da lo mismo', () => {
    for (const n of [0, 7, 999, 1000, 1840, 99999, -12500, 1234567.4, NaN, -Infinity]) {
      expect(formatoMiles(n)).toBe(miles(n));
    }
  });

  it('el pseudoidioma formatea como es', () => {
    expect(miles(1840, 'xx')).toBe('1.840');
  });
});

describe('decimal y moneda (es) = economía de antes', () => {
  const casos: [number, number][] = [
    [0, 0],
    [12, 0],
    [1840, 0],
    [12500, 0],
    [1234.5, 2],
    [-87.456, 2],
    [0.1, 1],
    [1000000, 0],
  ];
  it.each(casos)('num/eur(%p, %p)', (n, dec) => {
    expect(decimal(n, dec)).toBe(numViejo(n, dec));
    expect(num(n, dec)).toBe(numViejo(n, dec));
    expect(moneda(n, dec)).toBe(eurViejo(n, dec));
    expect(eur(n, dec)).toBe(eurViejo(n, dec));
  });

  it('eurSigno sigue igual', () => {
    expect(eurSigno(-12.5)).toBe(`−${eurViejo(12.5, 2)}`);
    expect(eurSigno(30)).toBe(`+${eurViejo(30, 2)}`);
  });
});

describe('fechaCorta (es)', () => {
  it('«14 sep» y lo que no es fecha, tal cual', () => {
    expect(fechaCorta('2026-09-14')).toBe('14 sep');
    expect(fechaCorta('2026-01-01T10:00:00Z')).toBe('1 ene');
    expect(fechaCorta('2026-12-31')).toBe('31 dic');
    expect(fechaCorta('ayer')).toBe('ayer');
  });

  it('components/fecha da lo mismo que antes', () => {
    for (const iso of ['2026-09-14', '2026-02-03T00:00:00', '2026-13-01', 'nada', '']) {
      expect(fechaCortaComponente(iso)).toBe(fechaCortaVieja(iso));
    }
  });
});

describe('nombreDia, mayus y capital (es)', () => {
  it('lunes en 0, como weekdayOfKey', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => nombreDia(i))).toEqual([
      'lunes',
      'martes',
      'miércoles',
      'jueves',
      'viernes',
      'sábado',
      'domingo',
    ]);
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => nombreDia(i, 'letra')).join('')).toBe('LMXJVSD');
    expect(nombreDia(7)).toBe('lunes');
    expect(nombreDia(-1)).toBe('domingo');
  });

  it('mayúsculas con acentos', () => {
    expect(mayus('día')).toBe('DÍA');
    expect(mayus('miércoles')).toBe('MIÉRCOLES');
    expect(capital('sábado')).toBe('Sábado');
    expect(capital('')).toBe('');
  });
});

describe('otros idiomas (Intl)', () => {
  it('inglés agrupa con coma y escribe el mes en inglés', () => {
    expect(miles(1840, 'en')).toBe('1,840');
    expect(fechaCorta('2026-09-14', 'en')).toMatch(/Sep/);
    expect(nombreDia(0, 'largo', 'en')).toBe('Monday');
    expect(moneda(12, 0, 'en')).toMatch(/€/);
  });
});
