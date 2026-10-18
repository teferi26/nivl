// Modos F1 · el orden del onboarding: con los interruptores apagados, los
// siete pasos de siempre y avanzar es sumar uno.
import { pasoAnterior, PASO_IDIOMA, PASO_MODOS, posicionPaso, secuenciaPasos, siguientePaso } from '../pasos';

const APAGADO = secuenciaPasos({ idioma: false, modos: false });

describe('interruptores apagados', () => {
  it('la secuencia es la de siempre', () => {
    expect(APAGADO).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('avanzar es sumar uno, volver es restar uno y el progreso es N+1 de 7', () => {
    for (let n = 0; n < 6; n++) expect(siguientePaso(APAGADO, n)).toBe(n + 1);
    for (let n = 1; n <= 6; n++) expect(pasoAnterior(APAGADO, n)).toBe(n - 1);
    expect(pasoAnterior(APAGADO, 0)).toBe(0);
    expect(siguientePaso(APAGADO, 6)).toBe(6);
    for (let n = 0; n <= 6; n++) expect(posicionPaso(APAGADO, n)).toEqual({ paso: n + 1, total: 7 });
  });
});

describe('con modos', () => {
  const s = secuenciaPasos({ idioma: false, modos: true });
  it('«Elige tus modos» va tras elegir para qué', () => {
    expect(s).toEqual([0, 1, 2, PASO_MODOS, 3, 4, 5, 6]);
    expect(siguientePaso(s, 2)).toBe(PASO_MODOS);
    expect(siguientePaso(s, PASO_MODOS)).toBe(3);
    expect(pasoAnterior(s, 3)).toBe(PASO_MODOS);
    expect(posicionPaso(s, 6)).toEqual({ paso: 8, total: 8 });
  });
});

describe('con idioma', () => {
  const s = secuenciaPasos({ idioma: true, modos: true });
  it('el idioma es el primer paso', () => {
    expect(s[0]).toBe(PASO_IDIOMA);
    expect(siguientePaso(s, PASO_IDIOMA)).toBe(0);
    expect(pasoAnterior(s, PASO_IDIOMA)).toBe(PASO_IDIOMA);
    expect(posicionPaso(s, 1)).toEqual({ paso: 3, total: 9 });
  });

  it('un paso que ya no está (interruptor apagado a mitad) sigue hacia delante', () => {
    expect(siguientePaso(APAGADO, PASO_MODOS)).toBe(3);
    expect(pasoAnterior(APAGADO, PASO_MODOS)).toBe(2);
    expect(siguientePaso(APAGADO, PASO_IDIOMA)).toBe(0);
  });
});
