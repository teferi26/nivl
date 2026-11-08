import { alturas, hace, leerResumen, pasosClave, porcentaje, retencion } from '../metricasAdmin';

describe('metricasAdmin', () => {
  test('leerResumen convierte y nunca deja NaN', () => {
    const r = leerResumen({ usuarios: '12', altas_hoy: 'x', activos_7d: 4 });
    expect(r.usuarios).toBe(12);
    expect(r.altasHoy).toBe(0);
    expect(r.activos7).toBe(4);
    expect(leerResumen(null).suscripciones).toBe(0);
  });

  test('hace: tramos y fecha mala', () => {
    const ahora = new Date('2026-11-08T12:00:00Z');
    expect(hace('2026-11-08T11:59:40Z', ahora)).toBe('ahora');
    expect(hace('2026-11-08T11:48:00Z', ahora)).toBe('hace 12 min');
    expect(hace('2026-11-08T09:00:00Z', ahora)).toBe('hace 3 h');
    expect(hace('2026-11-06T12:00:00Z', ahora)).toBe('hace 2 d');
    expect(hace('mal', ahora)).toBe('');
  });

  test('alturas y porcentaje con todo a cero', () => {
    expect(alturas([0, 0])).toEqual([0, 0]);
    expect(alturas([1, 2, 4])).toEqual([0.25, 0.5, 1]);
    expect(porcentaje(1, 0)).toBe(0);
    expect(porcentaje(1, 3)).toBe(33);
  });

  test('retencion suma cohortes en vez de promediar porcentajes', () => {
    expect(retencion([{ instalaciones: 90, d1: 45, d3: 9, d7: 0 }, { instalaciones: 10, d1: 10, d3: 1, d7: 5 }]))
      .toEqual({ instalaciones: 100, d1: 55, d3: 10, d7: 5 });
    expect(retencion([])).toEqual({ instalaciones: 0, d1: 0, d3: 0, d7: 0 });
  });

  test('pasosClave respeta el orden y rellena lo que falta', () => {
    const p = pasosClave([{ paso: 'compra_ok', instalaciones: 2, porcentaje: 4 }, { paso: 'otro', instalaciones: 9, porcentaje: 9 }]);
    expect(p[0]).toMatchObject({ paso: 'primer_arranque', instalaciones: 0 });
    expect(p[p.length - 1]).toMatchObject({ paso: 'compra_ok', rotulo: 'Compran', instalaciones: 2 });
    expect(p.some((x) => x.paso === 'otro')).toBe(false);
  });
});
