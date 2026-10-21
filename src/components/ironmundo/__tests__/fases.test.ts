import { ejercicioPorId } from '@/iron/ejercicios';
import { faseEn, msClave, msFantasmas } from '../fases';

const sentadilla = ejercicioPorId('sentadilla-barra')!;

describe('fases de la técnica', () => {
  it('sentadilla: baja al empezar, fondo abajo y sube en el esfuerzo', () => {
    expect(faseEn(sentadilla, 1000)).toBe('baja');
    expect(faseEn(sentadilla, 2700)).toBe('fondo');
    expect(faseEn(sentadilla, 3500)).toBe('sube');
    // El ciclo se repite.
    expect(faseEn(sentadilla, 3500 + sentadilla.cicloMs)).toBe('sube');
  });

  it('la pose clave y los dos fantasmas (salida y mitad de la bajada)', () => {
    const clave = msClave(sentadilla);
    const [a, b] = msFantasmas(sentadilla);
    expect(a).toBe(0);
    expect(b).toBe(clave / 2);
  });

  it('un isométrico siempre está en el fondo', () => {
    const plancha = ejercicioPorId('plancha')!;
    expect(faseEn(plancha, 0)).toBe('fondo');
  });
});
