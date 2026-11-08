import {
  cargaSesion,
  estadoForma,
  ratioAgudoCronico,
  rampaSemanal,
  serieCarga,
  volumenSemanal,
  type DiaCarga,
} from '../cargamath';

const SIN_PERFIL = { fc_max: null, fc_reposo: null, umbral: null };
const sesion = { fecha: '2026-06-01', deporte: 'carrera', duracion_s: 3600, fc_media: null, rpe: null };

/** `n` días seguidos de `carga` que terminan el día anterior a `hasta` incluido. */
function constante(desde: string, n: number, carga: number) {
  const inicio = Date.UTC(Number(desde.slice(0, 4)), Number(desde.slice(5, 7)) - 1, Number(desde.slice(8, 10)));
  return Array.from({ length: n }, (_, i) => ({
    fecha: new Date(inicio + i * 86400000).toISOString().slice(0, 10),
    carga,
  }));
}

function dia(fecha: string, carga: number, ctl: number, atl: number, tsb: number): DiaCarga {
  return { fecha, carga, ctl, atl, tsb };
}

/** Una serie de ocho días cuyo último día es `hoy` y hace siete días, `ctlAntes`. */
function serieCon(hoy: Omit<DiaCarga, 'fecha' | 'carga'>, ctlAntes: number): DiaCarga[] {
  const serie = Array.from({ length: 7 }, (_, i) => dia(`2026-06-0${i + 1}`, 50, ctlAntes, ctlAntes, 0));
  return [...serie, dia('2026-06-08', 50, hoy.ctl, hoy.atl, hoy.tsb)];
}

describe('cargaSesion', () => {
  it('una hora justo en el umbral vale 100 con reserva de pulso', () => {
    expect(cargaSesion({ ...sesion, fc_media: 165 }, { fc_max: 190, fc_reposo: 50, umbral: 165 })).toBe(100);
  });

  it('dos horas en el umbral valen 200: es lineal con el tiempo', () => {
    expect(cargaSesion({ ...sesion, duracion_s: 7200, fc_media: 165 }, { fc_max: 190, fc_reposo: 50, umbral: 165 })).toBe(200);
  });

  it('por debajo del umbral vale menos, a mano con Banister', () => {
    // Reserva 0,5: 0,5·e^0,96 = 1,3030. Umbral (120/140): 0,857·e^1,6457 = 4,4443.
    // 1,3030 / 4,4443 · 100 = 29,3.
    expect(cargaSesion({ ...sesion, fc_media: 120 }, { fc_max: 190, fc_reposo: 50, umbral: 170 })).toBe(29);
  });

  it('solo con umbral usa la intensidad al cuadrado', () => {
    // (150/160)² = 0,8789 → 88.
    expect(cargaSesion({ ...sesion, fc_media: 150 }, { fc_max: null, fc_reposo: null, umbral: 160 })).toBe(88);
  });

  it('solo con FC máxima estima el umbral en el 89 %', () => {
    // Umbral 178: (178/178)² → 100.
    expect(cargaSesion({ ...sesion, fc_media: 178 }, { fc_max: 200, fc_reposo: null, umbral: null })).toBe(100);
  });

  it('sin perfil cae al RPE: una hora a RPE 7 son 70', () => {
    expect(cargaSesion({ ...sesion, fc_media: 150, rpe: 7 }, SIN_PERFIL)).toBe(70);
  });

  it('sin pulso ni RPE son 50 por hora', () => {
    expect(cargaSesion({ ...sesion, duracion_s: 5400 }, SIN_PERFIL)).toBe(75);
  });

  it('un pulso por debajo del reposo es un sensor equivocado: cae al RPE', () => {
    expect(cargaSesion({ ...sesion, fc_media: 40, rpe: 5 }, { fc_max: 190, fc_reposo: 50, umbral: 165 })).toBe(50);
  });

  it('nunca es negativa ni NaN', () => {
    expect(cargaSesion({ ...sesion, duracion_s: 0, rpe: 9 }, SIN_PERFIL)).toBe(0);
    expect(cargaSesion({ ...sesion, duracion_s: -60 }, SIN_PERFIL)).toBe(0);
    expect(cargaSesion({ ...sesion, duracion_s: Number.NaN }, SIN_PERFIL)).toBe(0);
  });
});

describe('serieCarga', () => {
  it('el primer día, a mano: 100/42, 100/7 y forma cero', () => {
    const [d] = serieCarga([{ fecha: '2026-06-01', carga: 100 }], '2026-06-01', 1);
    expect(d).toEqual({ fecha: '2026-06-01', carga: 100, ctl: 2.4, atl: 14.3, tsb: 0 });
  });

  it('la forma de hoy es la resta de ayer', () => {
    const serie = serieCarga([{ fecha: '2026-06-01', carga: 100 }], '2026-06-02', 2);
    // Ayer: ctl 2,381, atl 14,286 → tsb -11,905. Hoy, sin carga: ctl 2,324, atl 12,245.
    expect(serie[1]).toEqual({ fecha: '2026-06-02', carga: 0, ctl: 2.3, atl: 12.2, tsb: -11.9 });
  });

  it('con carga constante CTL y ATL convergen a esa carga y la forma a cero', () => {
    const cargas = constante('2025-01-01', 500, 80);
    const hasta = cargas[cargas.length - 1]!.fecha;
    const hoy = serieCarga(cargas, hasta, 30).pop()!;
    expect(hoy.ctl).toBeCloseTo(80, 1);
    expect(hoy.atl).toBeCloseTo(80, 1);
    expect(hoy.tsb).toBeCloseTo(0, 1);
  });

  it('lo anterior a la ventana calienta la media', () => {
    const cargas = constante('2025-01-01', 500, 80);
    const hasta = cargas[cargas.length - 1]!.fecha;
    const visible = serieCarga(cargas, hasta, 7);
    expect(visible).toHaveLength(7);
    expect(visible[0]!.ctl).toBeGreaterThan(79);
  });

  it('suma las sesiones del mismo día e ignora las futuras y las malas', () => {
    const serie = serieCarga(
      [
        { fecha: '2026-06-01', carga: 30 },
        { fecha: '2026-06-01', carga: 40 },
        { fecha: '2026-06-02', carga: 999 },
        { fecha: '2026-02-31', carga: 999 },
        { fecha: '2026-06-01', carga: Number.NaN },
      ],
      '2026-06-01',
      1,
    );
    expect(serie).toEqual([{ fecha: '2026-06-01', carga: 70, ctl: 1.7, atl: 10, tsb: 0 }]);
  });

  it('ni el cambio de hora de marzo ni el de octubre comen o repiten un día', () => {
    for (const [hasta, esperadas] of [
      ['2026-03-30', ['2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30']],
      ['2026-10-26', ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26']],
    ] as const) {
      expect(serieCarga([], hasta, 4).map((d) => d.fecha)).toEqual(esperadas);
    }
  });

  it('una fecha o una ventana imposibles dan una serie vacía', () => {
    expect(serieCarga([], 'ayer')).toEqual([]);
    expect(serieCarga([], '2026-06-01', 0)).toEqual([]);
  });
});

describe('ACWR y rampa', () => {
  it('con carga constante el ACWR es 1 y la rampa 0', () => {
    const cargas = constante('2025-01-01', 500, 80);
    const serie = serieCarga(cargas, cargas[cargas.length - 1]!.fecha, 30);
    expect(ratioAgudoCronico(serie)).toBe(1);
    expect(rampaSemanal(serie)).toBe(0);
  });

  it('una semana de golpe, a mano', () => {
    // Estable en 50 y siete días a 150:
    // atl = 150 - 100·(6/7)^7 = 116,0; ctl = 150 - 100·(41/42)^7 = 65,5.
    const cargas = [...constante('2025-01-01', 500, 50), ...constante('2026-05-16', 7, 150)];
    const serie = serieCarga(cargas, '2026-05-22', 30);
    const hoy = serie[serie.length - 1]!;
    expect(hoy.atl).toBeCloseTo(116, 0);
    expect(hoy.ctl).toBeCloseTo(65.5, 0);
    expect(ratioAgudoCronico(serie)).toBeCloseTo(1.77, 2);
    expect(rampaSemanal(serie)).toBeCloseTo(15.5, 0);
    expect(estadoForma(serie).estado).toBe('riesgo');
  });

  it('el ACWR es null con forma inferior a 5 y la rampa sin ocho días', () => {
    expect(ratioAgudoCronico([dia('2026-06-01', 10, 4.9, 20, 0)])).toBeNull();
    expect(ratioAgudoCronico([])).toBeNull();
    expect(rampaSemanal([dia('2026-06-01', 10, 40, 20, 0)])).toBeNull();
  });
});

describe('estadoForma', () => {
  it('sin nada o sin carga: sin datos', () => {
    expect(estadoForma([]).estado).toBe('sin_datos');
    expect(estadoForma(serieCarga([], '2026-06-01')).estado).toBe('sin_datos');
  });

  it.each([
    ['ACWR alto', { ctl: 40, atl: 61, tsb: 0 }, 40, 'riesgo'],
    ['TSB hundido', { ctl: 60, atl: 60, tsb: -31 }, 60, 'riesgo'],
    ['rampa alta', { ctl: 60, atl: 60, tsb: 0 }, 51.9, 'riesgo'],
    ['cargado', { ctl: 60, atl: 70, tsb: -11 }, 58, 'cargado'],
    ['productivo en el borde bajo', { ctl: 60, atl: 65, tsb: -10 }, 58, 'productivo'],
    ['productivo en 4,9', { ctl: 60, atl: 55, tsb: 4.9 }, 58, 'productivo'],
    ['óptimo en 5', { ctl: 60, atl: 55, tsb: 5 }, 58, 'optimo'],
    ['óptimo en 25', { ctl: 60, atl: 35, tsb: 25 }, 58, 'optimo'],
    ['fresco en 25,1', { ctl: 60, atl: 35, tsb: 25.1 }, 58, 'fresco'],
    ['sin subir: no es productivo', { ctl: 60, atl: 60, tsb: 0 }, 60, 'optimo'],
  ])('%s', (_, hoy, ctlAntes, estado) => {
    expect(estadoForma(serieCon(hoy, ctlAntes)).estado).toBe(estado);
  });

  it('devuelve los números que la explican', () => {
    expect(estadoForma(serieCon({ ctl: 60, atl: 55, tsb: 5 }, 58))).toEqual({
      estado: 'optimo',
      ctl: 60,
      atl: 55,
      tsb: 5,
      acwr: 0.92,
      rampa: 2,
    });
  });
});

describe('volumenSemanal', () => {
  it('agrupa de lunes a domingo y saca también las semanas vacías', () => {
    const v = volumenSemanal(
      [
        { fecha: '2026-06-01', deporte: 'carrera', duracion_s: 1800, distancia_m: 5000 }, // lunes
        { fecha: '2026-06-07', deporte: 'carrera', duracion_s: 1800, distancia_m: null }, // domingo
        { fecha: '2026-06-07', deporte: 'bici', duracion_s: 3600, distancia_m: 30000 },
        { fecha: '2026-06-15', deporte: 'piscina', duracion_s: 1200, distancia_m: 1000 },
      ],
      '2026-06-15',
      3,
    );
    expect(v).toEqual([
      {
        semana: '2026-06-01',
        porDeporte: {
          carrera: { duracion_s: 3600, distancia_m: 5000 },
          bici: { duracion_s: 3600, distancia_m: 30000 },
        },
        total_s: 7200,
      },
      { semana: '2026-06-08', porDeporte: {}, total_s: 0 },
      { semana: '2026-06-15', porDeporte: { piscina: { duracion_s: 1200, distancia_m: 1000 } }, total_s: 1200 },
    ]);
  });

  it('ignora lo posterior a hasta y lo anterior a la ventana', () => {
    const v = volumenSemanal(
      [
        { fecha: '2026-06-03', deporte: 'carrera', duracion_s: 600, distancia_m: 0 },
        { fecha: '2026-06-01', deporte: 'carrera', duracion_s: 600, distancia_m: 0 },
        { fecha: '2026-05-31', deporte: 'carrera', duracion_s: 600, distancia_m: 0 },
      ],
      '2026-06-02',
      1,
    );
    expect(v).toEqual([{ semana: '2026-06-01', porDeporte: { carrera: { duracion_s: 600, distancia_m: 0 } }, total_s: 600 }]);
  });

  it('el domingo del cambio de hora sigue en su semana', () => {
    const v = volumenSemanal([{ fecha: '2026-03-29', deporte: 'bici', duracion_s: 60, distancia_m: null }], '2026-03-30', 2);
    expect(v.map((s) => s.semana)).toEqual(['2026-03-23', '2026-03-30']);
    expect(v[0]!.total_s).toBe(60);
    expect(v[1]!.total_s).toBe(0);
  });
});
