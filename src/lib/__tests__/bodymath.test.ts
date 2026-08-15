import { e1rm, paceOf, pendientePorDia } from '../bodymath';

// Esta matemática no es cosmética: de ella salen los kilos que el coach te
// manda levantar la próxima sesión. Un error aquí se traduce en carga real.

describe('paceOf', () => {
  it('convierte distancia y tiempo en min/km', () => {
    expect(paceOf(5, 25)).toBe('5:00');
    expect(paceOf(10, 52)).toBe('5:12');
    expect(paceOf(5.2, 32)).toBe('6:09');
  });

  it('rellena los segundos a dos cifras', () => {
    expect(paceOf(6, 30.5)).toBe('5:05');
  });

  it('no produce un ritmo de :60 al redondear', () => {
    // 4,999… min/km: los segundos redondean a 60 y eso es el minuto siguiente.
    expect(paceOf(60, 299.99)).toBe('5:00');
  });

  it('devuelve null cuando no hay distancia que medir', () => {
    // Natación por tiempo, cinta sin distancia, o datos a medias.
    expect(paceOf(null, 40)).toBeNull();
    expect(paceOf(0, 40)).toBeNull();
    expect(paceOf(5, 0)).toBeNull();
    expect(paceOf(-3, 20)).toBeNull();
  });
});

describe('e1rm', () => {
  it('aplica Epley', () => {
    expect(e1rm(100, 1)).toBeCloseTo(103.333, 3);
    expect(e1rm(60, 5)).toBeCloseTo(70, 5);
    expect(e1rm(120, 10)).toBeCloseTo(160, 5);
  });

  it('no estima por encima de 12 repeticiones', () => {
    // Epley sobreestima tanto en series largas que la cifra engañaría al coach.
    expect(e1rm(40, 13)).toBeNull();
    expect(e1rm(40, 12)).not.toBeNull();
  });

  it('rechaza entradas sin sentido', () => {
    expect(e1rm(0, 5)).toBeNull();
    expect(e1rm(-20, 5)).toBeNull();
    expect(e1rm(80, 0)).toBeNull();
  });
});

describe('pendientePorDia', () => {
  it('recupera la pendiente de una recta exacta', () => {
    const puntos = [0, 1, 2, 3, 4].map((x) => ({ x, y: 80 - 0.1 * x }));
    expect(pendientePorDia(puntos)).toBeCloseTo(-0.1, 10);
  });

  it('ve la bajada aunque la báscula oscile', () => {
    // Pesajes con ruido de ±0,4 kg sobre una bajada real de 0,5 kg/semana.
    const puntos = [
      { x: 0, y: 82.0 },
      { x: 1, y: 82.4 },
      { x: 2, y: 81.6 },
      { x: 3, y: 81.9 },
      { x: 4, y: 81.5 },
      { x: 5, y: 81.8 },
      { x: 6, y: 81.3 },
    ];
    const porSemana = pendientePorDia(puntos)! * 7;
    expect(porSemana).toBeLessThan(0);
    expect(porSemana).toBeGreaterThan(-1.2);
  });

  it('no inventa tendencia con menos de tres pesajes', () => {
    expect(pendientePorDia([])).toBeNull();
    expect(pendientePorDia([{ x: 0, y: 80 }])).toBeNull();
    expect(pendientePorDia([{ x: 0, y: 80 }, { x: 1, y: 79 }])).toBeNull();
  });

  it('devuelve null si todos los pesajes son del mismo día', () => {
    // Varianza cero en x: la recta sería vertical, no hay pendiente.
    const puntos = [
      { x: 3, y: 80 },
      { x: 3, y: 81 },
      { x: 3, y: 79 },
    ];
    expect(pendientePorDia(puntos)).toBeNull();
  });

  it('detecta el estancamiento', () => {
    // Oscilación simétrica alrededor de 80 kg: siete días, empieza y acaba
    // igual. Ahí no hay déficit y el coach tiene que verlo plano.
    const puntos = [0, 1, 2, 3, 4, 5, 6].map((x) => ({ x, y: 80 + (x % 2 ? 0.2 : -0.2) }));
    expect(Math.abs(pendientePorDia(puntos)! * 7)).toBeLessThan(0.05);
  });
});
