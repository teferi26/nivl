// NIVL · IRON · Las ayudas de autor devuelven ángulos que el esqueleto respeta.
import { articulacion, ikDosEslabones } from '../autor';
import { construirEsqueleto, LARGO } from '../esqueleto';

describe('ikDosEslabones', () => {
  it('llega al objetivo cuando alcanza', () => {
    const r = ikDosEslabones({ x: 0, y: 0 }, { x: 20, y: -10 }, 18.5, 18.5, true);
    expect(r.alcanza).toBe(true);
    const fin = {
      x: r.medio.x + 18.5 * Math.cos((r.a2 * Math.PI) / 180),
      y: r.medio.y + 18.5 * Math.sin((r.a2 * Math.PI) / 180),
    };
    expect(fin.x).toBeCloseTo(20, 5);
    expect(fin.y).toBeCloseTo(-10, 5);
  });

  it('avisa si no alcanza', () => {
    expect(ikDosEslabones({ x: 0, y: 0 }, { x: 100, y: 0 }, 10, 10, true).alcanza).toBe(false);
  });
});

describe('articulacion', () => {
  it('ida y vuelta con el esqueleto: la mano cae donde dijo la IK', () => {
    const tronco = 90;
    const objetivo = { x: 12, y: 15 };
    // Hombro en (0, 30) con la cadera en el origen y el tronco vertical.
    const r = ikDosEslabones({ x: 0, y: LARGO.tronco }, objetivo, LARGO.brazo, LARGO.antebrazo, false);
    const ext = { cadera: 0, rodilla: 0, tobillo: 0, hombro: articulacion.hombro(tronco, r.a1), codo: articulacion.codo(r.a1, r.a2) };
    const e = construirEsqueleto(
      { cuello: 0, cerca: ext, lejos: ext, angulo: tronco, escorzo: {} },
      { punto: 'cadera', x: 0, y: 0, segmento: 'tronco', angulo: tronco },
      'lateral',
    );
    expect(e.p.muneca_c.x).toBeCloseTo(objetivo.x, 4);
    expect(e.p.muneca_c.y).toBeCloseTo(objetivo.y, 4);
  });
});
