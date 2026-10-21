import {
  ANGULO_MODO,
  ORDEN_RUEDA,
  RUEDA,
  VISTA_RUEDA,
  anguloDe,
  anteriorTrasCambio,
  anteriorValido,
  esDeslizarAbajo,
  finDeGesto,
  indiceSector,
  mascaraDisponibles,
  modoDeIndice,
  opacidadApuntado,
  puntoEn,
  radioCubre,
  resultadoEleccion,
  sectorEn,
  seMovio,
  trazoSector,
} from '../rueda';
import { MODOS_ETIQUETA } from '../tipos';

const TODOS = mascaraDisponibles(['general', 'iron', 'focus', 'work', 'founder']);

describe('geometría de la rueda (lámina 1 de la P01)', () => {
  it('ángulo: 0 arriba y en el sentido del reloj', () => {
    expect(anguloDe(0, -10)).toBeCloseTo(0);
    expect(anguloDe(10, 0)).toBeCloseTo(90);
    expect(anguloDe(0, 10)).toBeCloseTo(180);
    expect(anguloDe(-10, 0)).toBeCloseTo(270);
  });

  it('NIVL en el centro y cada modo en su punto cardinal fijo: IRON arriba, FOCUS derecha, WORK abajo, FOUNDER izquierda', () => {
    expect(ORDEN_RUEDA[0]).toBe('general');
    expect(ANGULO_MODO).toEqual({ iron: 0, focus: 90, work: 180, founder: 270 });
    for (const m of MODOS_ETIQUETA) expect(ORDEN_RUEDA[indiceSector(ANGULO_MODO[m])]).toBe(m);
  });

  it('los bordes de sector caen a 45°', () => {
    expect(indiceSector(44)).toBe(1);
    expect(indiceSector(46)).toBe(2);
    expect(indiceSector(359)).toBe(1);
    expect(indiceSector(-10)).toBe(1);
    expect(indiceSector(316)).toBe(1);
    expect(indiceSector(314)).toBe(4);
  });

  it('el centro es NIVL; fuera de la rueda no hay nada', () => {
    expect(sectorEn(0, 0, 1, TODOS)).toBe(0);
    expect(sectorEn(0, -RUEDA.centro, 1, TODOS)).toBe(0);
    expect(sectorEn(0, -(RUEDA.limite + 1), 1, TODOS)).toBe(-1);
  });

  it('respeta la escala: con la rueda al doble, el mismo punto relativo', () => {
    expect(sectorEn(0, -150, 2, TODOS)).toBe(1); // 75 en la caja: IRON
    expect(sectorEn(0, -150, 1, TODOS)).toBe(-1); // 150 en la caja: fuera
    expect(sectorEn(0, -150, 0, TODOS)).toBe(-1); // escala absurda: como 1
  });

  it('cada dirección elige su modo', () => {
    expect(modoDeIndice(sectorEn(10, -70, 1, TODOS))).toBe('iron');
    expect(modoDeIndice(sectorEn(70, 10, 1, TODOS))).toBe('focus');
    expect(modoDeIndice(sectorEn(-10, 70, 1, TODOS))).toBe('work');
    expect(modoDeIndice(sectorEn(-70, -10, 1, TODOS))).toBe('founder');
  });

  it('el hueco de un modo no activado no se puede elegir; NIVL siempre', () => {
    const solo = mascaraDisponibles(['general', 'iron']);
    expect(solo).toEqual([true, true, false, false, false]);
    expect(sectorEn(70, 0, 1, solo)).toBe(-1);
    expect(sectorEn(0, 0, 1, mascaraDisponibles([]))).toBe(0);
  });

  it('modoDeIndice fuera de rango es null', () => {
    expect(modoDeIndice(-1)).toBeNull();
    expect(modoDeIndice(5)).toBeNull();
  });

  it('las ondas de la recarga cubren la pantalla entera', () => {
    expect(radioCubre(0, 0, 300, 400)).toBe(500);
    expect(radioCubre(150, 200, 300, 400)).toBe(250);
  });

  it('el trazado de un sector es un camino cerrado y los iconos caen en su ángulo', () => {
    const d = trazoSector(0, 0, RUEDA.sectorDentro, RUEDA.sectorFuera, 0);
    expect(d.startsWith('M ')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(puntoEn(100, 100, 50, 90)).toEqual({ x: 150, y: 100 });
    expect(puntoEn(100, 100, 50, 0)).toEqual({ x: 100, y: 50 });
    expect(RUEDA.limite * 2).toBeGreaterThan(VISTA_RUEDA);
  });
});

describe('elegir con la rueda abierta', () => {
  it('tocar otro modo lo recarga; el mismo, fuera o un hueco vacío la cierran sin cambiar', () => {
    expect(resultadoEleccion(1, 'general')).toBe('iron');
    expect(resultadoEleccion(0, 'iron')).toBe('general');
    expect(resultadoEleccion(1, 'iron')).toBe('cerrar');
    expect(resultadoEleccion(-1, 'iron')).toBe('cerrar');
    expect(resultadoEleccion(9, 'iron')).toBe('cerrar');
  });

  it('un toque es un toque hasta que el dedo se mueve 12 pt', () => {
    expect(seMovio(3, 4)).toBe(false);
    expect(seMovio(12, 0)).toBe(false);
    expect(seMovio(9, 9)).toBe(true);
  });

  it('deslizar hacia abajo (largo o rápido, y vertical) cierra', () => {
    expect(esDeslizarAbajo(0, 80, 0)).toBe(true);
    expect(esDeslizarAbajo(5, 30, 1200)).toBe(true);
    expect(esDeslizarAbajo(0, 30, 200)).toBe(false);
    expect(esDeslizarAbajo(0, -120, -1500)).toBe(false); // hacia arriba
    expect(esDeslizarAbajo(120, 80, 0)).toBe(false); // de lado
    expect(esDeslizarAbajo(0, 8, 3000)).toBe(false); // un toque nervioso
  });

  it('cómo acaba un gesto: deslizar, toque o arrastre', () => {
    expect(finDeGesto(0, 90, 0)).toBe('deslizar');
    expect(finDeGesto(2, 3, 0)).toBe('toque');
    expect(finDeGesto(40, -60, 0)).toBe('arrastre');
  });
});

describe('anterior (se marca en la rueda)', () => {
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

describe('opacidadApuntado', () => {
  it('al abrir (nada apuntado) no enciende ningún hueco', () => {
    expect(ORDEN_RUEDA.map((_, i) => opacidadApuntado(-1, i))).toEqual([0, 0, 0, 0, 0]);
  });
  it('enciende solo el hueco bajo el dedo, nunca varios', () => {
    ORDEN_RUEDA.forEach((_, apuntado) => {
      const encendidos = ORDEN_RUEDA.map((__, i) => opacidadApuntado(apuntado, i)).filter((o) => o === 1);
      expect(encendidos).toHaveLength(1);
      expect(opacidadApuntado(apuntado, apuntado)).toBe(1);
    });
  });
});
