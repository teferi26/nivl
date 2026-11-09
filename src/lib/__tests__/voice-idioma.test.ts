import { localeDeVoz } from '../coachvoz/idioma';

describe('idioma del dictado y la voz', () => {
  test.each([
    ['es', null, 'es-ES'],
    ['en', null, 'en-US'],
    ['fr', null, 'fr-FR'],
    ['de', null, 'de-DE'],
    ['it', null, 'it-IT'],
    ['pt', null, 'pt-PT'],
  ])('%s sin variante del teléfono', (idioma, dispositivo, esperado) => {
    expect(localeDeVoz(idioma, dispositivo)).toBe(esperado);
  });

  test('respeta la variante del teléfono si es el mismo idioma', () => {
    expect(localeDeVoz('pt', 'pt-BR')).toBe('pt-BR');
    expect(localeDeVoz('es', 'es-MX')).toBe('es-MX');
  });

  test('un teléfono en otro idioma no cambia el de la voz', () => {
    expect(localeDeVoz('es', 'en-US')).toBe('es-ES');
    expect(localeDeVoz('de', 'es')).toBe('de-DE');
  });
});
