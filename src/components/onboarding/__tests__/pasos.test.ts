// Modos F1 · el orden del onboarding: con los interruptores apagados, los
// siete pasos de siempre y avanzar es sumar uno.
import { pasoAnterior, PASO_CUESTIONARIO, PASO_IDIOMA, PASO_MODOS, PASO_SALUD, posicionPaso, secuenciaPasos, siguientePaso } from '../pasos';

const APAGADO = secuenciaPasos({ idioma: false, modos: false });

describe('interruptores apagados', () => {
  it('la secuencia son los pasos de Ónix', () => {
    expect(APAGADO).toEqual([0, 1, 4, 5, 6]);
  });

  it('avanzar y volver siguen la secuencia', () => {
    expect(siguientePaso(APAGADO, 0)).toBe(1);
    expect(siguientePaso(APAGADO, 1)).toBe(4);
    expect(pasoAnterior(APAGADO, 4)).toBe(1);
    expect(pasoAnterior(APAGADO, 0)).toBe(0);
    expect(siguientePaso(APAGADO, 6)).toBe(6);
    expect(posicionPaso(APAGADO, 6)).toEqual({ paso: 5, total: 5 });
  });
});

describe('con modos', () => {
  const s = secuenciaPasos({ idioma: false, modos: true });
  it('«Elige tus modos» va tras el nombre', () => {
    expect(s).toEqual([0, 1, PASO_MODOS, 4, 5, 6]);
    expect(siguientePaso(s, 1)).toBe(PASO_MODOS);
    expect(siguientePaso(s, PASO_MODOS)).toBe(4);
    expect(posicionPaso(s, 6)).toEqual({ paso: 6, total: 6 });
  });
});

describe('cuestionario y salud', () => {
  it('sin respuestas en este teléfono, el cuestionario va tras la bienvenida', () => {
    expect(secuenciaPasos({ idioma: false, modos: false, cuestionario: true })).toEqual([0, PASO_CUESTIONARIO, 1, 4, 5, 6]);
  });
  it('el permiso de salud va antes de las misiones, y si se concede a mitad se sigue', () => {
    const s = secuenciaPasos({ idioma: false, modos: true, salud: true });
    expect(s).toEqual([0, 1, PASO_MODOS, PASO_SALUD, 4, 5, 6]);
    expect(siguientePaso(secuenciaPasos({ idioma: false, modos: true }), PASO_SALUD)).toBe(4);
  });
});

describe('con idioma', () => {
  const s = secuenciaPasos({ idioma: true, modos: true });
  it('el idioma es el primer paso', () => {
    expect(s[0]).toBe(PASO_IDIOMA);
    expect(siguientePaso(s, PASO_IDIOMA)).toBe(0);
    expect(pasoAnterior(s, PASO_IDIOMA)).toBe(PASO_IDIOMA);
    expect(posicionPaso(s, 1)).toEqual({ paso: 3, total: 7 });
  });

  it('un paso que ya no está (interruptor apagado a mitad) sigue hacia delante', () => {
    expect(siguientePaso(APAGADO, PASO_MODOS)).toBe(4);
    expect(pasoAnterior(APAGADO, PASO_MODOS)).toBe(1);
    expect(siguientePaso(APAGADO, PASO_IDIOMA)).toBe(0);
  });
});
