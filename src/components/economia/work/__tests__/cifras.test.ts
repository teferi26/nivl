import { euros, eurosSigno } from '../cifras';
import { mesAbierto, origenBrief } from '../calculoWork';

describe('euros: siempre miles y dos decimales', () => {
  it('agrupa también las cuatro cifras, que es donde Intl falla en español', () => {
    expect(euros(2150, 'es')).toBe('2.150,00 €');
    expect(euros(1234.5, 'es')).toBe('1.234,50 €');
    expect(euros(12450.05, 'es')).toBe('12.450,05 €');
    expect(euros(1234567.8, 'es')).toBe('1.234.567,80 €');
    expect(euros(1234.5, 'pt')).toBe('1.234,50 €');
  });
  it('los importes pequeños llevan decimales igual', () => {
    expect(euros(0, 'es')).toBe('0,00 €');
    expect(euros(7, 'es')).toBe('7,00 €');
    expect(euros(999.999, 'es')).toBe('1.000,00 €');
  });
  it('negativos sin «-0», y signo explícito', () => {
    expect(euros(-12.5, 'es')).toBe('−12,50 €');
    expect(euros(-0.001, 'es')).toBe('0,00 €');
    expect(eurosSigno(-2150, 'es')).toBe('−2.150,00 €');
    expect(eurosSigno(2150, 'es')).toBe('+2.150,00 €');
  });
  it('sigue el idioma y aguanta lo no finito', () => {
    expect(euros(1234.5, 'en')).toBe('€1,234.50');
    expect(euros(1234.5, 'de')).toBe('1.234,50 €');
    expect(euros(1234.5, 'fr')).toBe('1 234,50 €');
    expect(euros(Number.NaN, 'es')).toBe('-');
  });
});

describe('origen del brief', () => {
  it('con texto lo escribió la IA, con su fecha si la hay', () => {
    expect(origenBrief({ texto: 'x', generado: '2026-10-01T10:00:00Z' }, '2026-09', '2026-10-21')).toEqual({ tipo: 'ia', generado: '2026-10-01T10:00:00Z' });
    expect(origenBrief({ texto: 'x' }, '2026-09', '2026-10-21')).toEqual({ tipo: 'ia', generado: null });
  });
  it('sin texto son cifras, y distingue el mes aún abierto', () => {
    expect(origenBrief({ texto: null }, '2026-09', '2026-10-21')).toEqual({ tipo: 'cifras', mesAbierto: false });
    expect(origenBrief({ texto: null }, '2026-10', '2026-10-26')).toEqual({ tipo: 'cifras', mesAbierto: true });
    expect(mesAbierto('2026-09', '2026-10-01')).toBe(false);
  });
});
