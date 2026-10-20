import {
  ANGULO_MODO,
  ORDEN_RUEDA,
  anguloDe,
  anteriorTrasCambio,
  anteriorValido,
  destinoToqueCorto,
  indiceSector,
  mascaraDisponibles,
  modoDeIndice,
  puntoEn,
  radioCubre,
  sectorEn,
  trazoSector,
} from '../rueda';

const TODOS = mascaraDisponibles(['general', 'iron', 'focus', 'work', 'founder']);

describe('geometría de la rueda', () => {
  it('ángulo: 0 arriba y en el sentido del reloj', () => {
    expect(anguloDe(0, -10)).toBeCloseTo(0);
    expect(anguloDe(10, 0)).toBeCloseTo(90);
    expect(anguloDe(0, 10)).toBeCloseTo(180);
    expect(anguloDe(-10, 0)).toBeCloseTo(270);
  });

  it('cada modo vive siempre en su punto fijo, NIVL arriba', () => {
    expect(ORDEN_RUEDA[0]).toBe('general');
    for (const [i, m] of ORDEN_RUEDA.entries()) expect(indiceSector(ANGULO_MODO[m])).toBe(i);
  });

  it('los bordes de sector caen a mitad de camino', () => {
    expect(indiceSector(35)).toBe(0);
    expect(indiceSector(37)).toBe(1);
    expect(indiceSector(359)).toBe(0);
    expect(indiceSector(-10)).toBe(0);
    expect(indiceSector(325)).toBe(0);
    expect(indiceSector(323)).toBe(4);
  });

  it('dentro del círculo central no hay sector (soltar cancela)', () => {
    expect(sectorEn(0, -5, 20, TODOS)).toBe(-1);
    expect(sectorEn(0, -25, 20, TODOS)).toBe(0);
  });

  it('el pulgar a la derecha y algo arriba elige IRON; abajo a la izquierda, WORK', () => {
    expect(modoDeIndice(sectorEn(60, -20, 20, TODOS))).toBe('iron');
    expect(modoDeIndice(sectorEn(-30, 60, 20, TODOS))).toBe('work');
    expect(modoDeIndice(sectorEn(-60, -20, 20, TODOS))).toBe('founder');
    expect(modoDeIndice(sectorEn(40, 60, 20, TODOS))).toBe('focus');
  });

  it('el hueco de un modo no activado no se puede elegir; NIVL siempre', () => {
    const solo = mascaraDisponibles(['general', 'iron']);
    expect(solo).toEqual([true, true, false, false, false]);
    expect(sectorEn(40, 60, 20, solo)).toBe(-1);
    expect(sectorEn(0, -40, 20, mascaraDisponibles([]))).toBe(0);
  });

  it('modoDeIndice fuera de rango es null', () => {
    expect(modoDeIndice(-1)).toBeNull();
    expect(modoDeIndice(5)).toBeNull();
  });

  it('el barrido cubre la pantalla entera', () => {
    expect(radioCubre(0, 0, 300, 400)).toBe(500);
    expect(radioCubre(150, 200, 300, 400)).toBe(250);
  });

  it('el trazado de un sector es un camino cerrado y los rótulos caen en su ángulo', () => {
    const d = trazoSector(100, 100, 40, 90, 0);
    expect(d.startsWith('M ')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(puntoEn(100, 100, 50, 90)).toEqual({ x: 150, y: 100 });
    expect(puntoEn(100, 100, 50, 0)).toEqual({ x: 100, y: 50 });
  });
});

describe('toque corto', () => {
  const disp = ['general', 'iron', 'focus'] as const;

  it('vuelve al modo anterior', () => {
    expect(destinoToqueCorto('iron', 'focus', disp)).toBe('focus');
    expect(destinoToqueCorto('iron', 'general', disp)).toBe('general');
  });

  it('sin anterior, o si ya no está disponible, abre la rueda (null)', () => {
    expect(destinoToqueCorto('iron', null, disp)).toBeNull();
    expect(destinoToqueCorto('iron', 'iron', disp)).toBeNull();
    expect(destinoToqueCorto('iron', 'work', disp)).toBeNull();
  });
});

describe('anterior', () => {
  it('el guardado vale si es distinto del actual y sigue activado', () => {
    expect(anteriorValido('focus', 'iron', ['iron', 'focus'])).toBe('focus');
    expect(anteriorValido('general', 'iron', ['iron'])).toBe('general');
    expect(anteriorValido('work', 'iron', ['iron'])).toBeNull();
    expect(anteriorValido('iron', 'iron', ['iron'])).toBeNull();
    expect(anteriorValido('basura', 'general', ['iron'])).toBeNull();
    expect(anteriorValido(null, 'general', ['iron'])).toBeNull();
  });

  it('tras cambiar, el anterior es el que se deja; sin cambio real, no se toca', () => {
    expect(anteriorTrasCambio('general', 'iron', null)).toBe('general');
    expect(anteriorTrasCambio('iron', 'focus', 'general')).toBe('iron');
    expect(anteriorTrasCambio('iron', 'iron', 'general')).toBe('general');
  });
});
