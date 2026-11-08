import {
  desnivelPositivo,
  distanciaM,
  distanciaRuta,
  formatoRitmo,
  limitesZonas,
  mejorTramoSeg,
  nuevosRecords,
  parcialesDeRuta,
  recordsPersonales,
  ritmoSeg100m,
  ritmoSegKm,
  tiempoEnZonas,
  velocidadKmh,
  zonaDe,
  type EntrenoRecord,
  type PerfilFc,
  type PuntoAlt,
} from '../entrenomath';

// Sobre un meridiano, un arco de m metros son m·180/(π·R) grados: las rutas de
// estos tests miden exactamente lo que se escribe a mano.
const R = 6371000;
const lat = (m: number) => (m * 180) / (Math.PI * R);
const p = (m: number, t: number, alt: number | null = null): PuntoAlt => ({ t, lat: lat(m), lon: 0, alt });
const conAlt = (alts: (number | null)[]): PuntoAlt[] => alts.map((a, i) => p(i * 10, i, a));

describe('distanciaM', () => {
  it('un grado de ecuador', () => {
    expect(distanciaM({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(111194.93, 1);
  });
  it('un cuarto de meridiano', () => {
    expect(distanciaM({ lat: 0, lon: 0 }, { lat: 90, lon: 0 })).toBeCloseTo((Math.PI * R) / 2, 3);
  });
  it('Madrid a Barcelona ronda los 505 km', () => {
    const d = distanciaM({ lat: 40.4168, lon: -3.7038 }, { lat: 41.3874, lon: 2.1686 });
    expect(d / 1000).toBeGreaterThan(503);
    expect(d / 1000).toBeLessThan(507);
  });
  it('un punto consigo mismo es 0', () => {
    expect(distanciaM({ lat: 40, lon: -3 }, { lat: 40, lon: -3 })).toBe(0);
  });
});

describe('ritmos', () => {
  it('formatea min:seg', () => {
    expect(formatoRitmo(298)).toBe('4:58');
    expect(formatoRitmo(305)).toBe('5:05');
  });
  it('redondea antes de partir: nunca x:60', () => {
    expect(formatoRitmo(59.6)).toBe('1:00');
    expect(formatoRitmo(119.7)).toBe('2:00');
  });
  it('sin dato no inventa', () => {
    expect(formatoRitmo(null)).toBeNull();
    expect(formatoRitmo(0)).toBeNull();
    expect(formatoRitmo(Number.NaN)).toBeNull();
  });
  it('calcula ritmo y velocidad', () => {
    expect(ritmoSegKm(10000, 3000)).toBe(300);
    expect(ritmoSeg100m(1500, 1800)).toBe(120);
    expect(velocidadKmh(40000, 3600)).toBe(40);
  });
  it('sin distancia o sin tiempo es null', () => {
    for (const f of [ritmoSegKm, ritmoSeg100m, velocidadKmh]) {
      expect(f(null, 100)).toBeNull();
      expect(f(0, 100)).toBeNull();
      expect(f(100, 0)).toBeNull();
    }
  });
});

describe('distanciaRuta', () => {
  it('suma los tramos', () => {
    expect(distanciaRuta([p(0, 0), p(300, 60), p(1000, 200)])).toBeCloseTo(1000, 6);
  });
  it('un punto o ninguno es 0', () => {
    expect(distanciaRuta([])).toBe(0);
    expect(distanciaRuta([p(0, 0)])).toBe(0);
  });
});

describe('desnivelPositivo', () => {
  it('el ruido por debajo del umbral no suma', () => {
    // La suma ingenua de subidas daría 1+2+2+2 = 7.
    expect(desnivelPositivo(conAlt([100, 101, 99, 101, 100, 102, 99, 101]))).toBe(0);
  });
  it('una subida con ruido cuenta lo subido', () => {
    // 100 → 104 (+4) → 107 (+3) → 110 (+3)
    expect(desnivelPositivo(conAlt([100, 102, 101, 104, 103, 107, 105, 110]))).toBe(10);
  });
  it('bajar mueve la referencia y no suma', () => {
    expect(desnivelPositivo(conAlt([200, 190, 195]))).toBe(5);
    expect(desnivelPositivo(conAlt([200, 190, 180]))).toBe(0);
  });
  it('los puntos sin altitud se saltan', () => {
    expect(desnivelPositivo(conAlt([100, null, 104]))).toBe(4);
    expect(desnivelPositivo(conAlt([null, null]))).toBe(0);
  });
  it('respeta un umbral propio', () => {
    expect(desnivelPositivo(conAlt([100, 101, 102]), 1)).toBe(2);
    expect(desnivelPositivo(conAlt([100, 104]), 5)).toBe(0);
  });
  it('ruta vacía es 0', () => {
    expect(desnivelPositivo([])).toBe(0);
  });
});

describe('parcialesDeRuta', () => {
  const ruta = [p(0, 0, 100), p(400, 100, 100), p(1200, 300, 110), p(2500, 700, 110)];
  const fc = [
    { t: 0, bpm: 150 },
    { t: 100, bpm: 160 },
    { t: 260, bpm: 170 },
    { t: 500, bpm: 180 },
    { t: 600, bpm: 190 },
  ];

  it('interpola el instante en que se cruza el km', () => {
    const r = parcialesDeRuta(ruta);
    expect(r).toHaveLength(3);
    // Marca 1000 en el tramo 400→1200 (800 m, 200 s): 100 + 600/800·200 = 250
    expect(r[0]).toMatchObject({ n: 1, tipo: 'km', distancia_m: 1000, duracion_s: 250 });
    // Marca 2000 en el tramo 1200→2500 (1300 m, 400 s): 300 + 800/1300·400 = 546,15
    expect(r[1]).toMatchObject({ n: 2, tipo: 'km', distancia_m: 1000, duracion_s: 296.2 });
    // Sobran 500 m hasta el segundo 700.
    expect(r[2]).toMatchObject({ n: 3, tipo: 'km', distancia_m: 500, duracion_s: 153.8 });
  });

  it('la suma de los parciales es el tiempo total', () => {
    const suma = parcialesDeRuta(ruta).reduce((s, x) => s + x.duracion_s, 0);
    expect(suma).toBeCloseTo(700, 0);
  });

  it('asigna el pulso medio del tiempo de cada parcial', () => {
    const r = parcialesDeRuta(ruta, 1000, fc);
    expect(r.map((x) => x.fc_media)).toEqual([155, 175, 190]);
  });

  it('sin serie de pulso, fc_media es null', () => {
    expect(parcialesDeRuta(ruta).every((x) => x.fc_media === null)).toBe(true);
  });

  it('el desnivel cae en el parcial donde se confirma y suma el total', () => {
    const r = parcialesDeRuta(ruta);
    expect(r.map((x) => x.desnivel_m)).toEqual([0, 10, 0]);
    const total = r.reduce((s, x) => s + (x.desnivel_m ?? 0), 0);
    expect(total).toBe(desnivelPositivo(ruta));
  });

  it('sin altitud, desnivel null y no 0', () => {
    expect(parcialesDeRuta([p(0, 0), p(1500, 300)]).every((x) => x.desnivel_m === null)).toBe(true);
  });

  it('un tramo largo que salta varias marcas se reparte', () => {
    const r = parcialesDeRuta([p(0, 0), p(2500, 500)]);
    expect(r.map((x) => x.duracion_s)).toEqual([200, 200, 100]);
    expect(r.map((x) => x.distancia_m)).toEqual([1000, 1000, 500]);
  });

  it('acabar justo en la marca no deja un parcial vacío', () => {
    const r = parcialesDeRuta([p(0, 0), p(1000, 300), p(2000, 620)]);
    expect(r.map((x) => x.duracion_s)).toEqual([300, 320]);
  });

  it('otro tamaño de tramo es una vuelta', () => {
    const r = parcialesDeRuta([p(0, 0), p(500, 100), p(1000, 200)], 400);
    expect(r[0]).toMatchObject({ tipo: 'vuelta', distancia_m: 400, duracion_s: 80 });
    expect(r).toHaveLength(3);
  });

  it('sin ruta no hay parciales', () => {
    expect(parcialesDeRuta([])).toEqual([]);
    expect(parcialesDeRuta([p(0, 0)])).toEqual([]);
    expect(parcialesDeRuta([p(0, 0), p(10, 10)], 0)).toEqual([]);
  });
});

describe('limitesZonas', () => {
  it('Karvonen con máxima y reposo', () => {
    // Reserva 190 - 50 = 140: 50+70, 50+84, 50+98, 50+112, 50+126
    expect(limitesZonas({ fc_max: 190, fc_reposo: 50, umbral: null })).toEqual([
      { zona: 'Z1', desde: 120, hasta: 133 },
      { zona: 'Z2', desde: 134, hasta: 147 },
      { zona: 'Z3', desde: 148, hasta: 161 },
      { zona: 'Z4', desde: 162, hasta: 175 },
      { zona: 'Z5', desde: 176, hasta: 190 },
    ]);
  });

  it('el umbral manda sobre todo lo demás', () => {
    expect(limitesZonas({ fc_max: 190, fc_reposo: 50, umbral: 160 })).toEqual([
      { zona: 'Z1', desde: 0, hasta: 135 },
      { zona: 'Z2', desde: 136, hasta: 143 },
      { zona: 'Z3', desde: 144, hasta: 151 },
      { zona: 'Z4', desde: 152, hasta: 159 },
      { zona: 'Z5', desde: 160, hasta: 190 },
    ]);
  });

  it('con umbral y sin máxima, el techo es un 110 %', () => {
    expect(limitesZonas({ fc_max: null, fc_reposo: null, umbral: 160 })![4]).toEqual({
      zona: 'Z5',
      desde: 160,
      hasta: 176,
    });
  });

  it('solo máxima: porcentajes de la máxima', () => {
    expect(limitesZonas({ fc_max: 200, fc_reposo: null, umbral: null })!.map((z) => z.desde)).toEqual([
      100, 120, 140, 160, 180,
    ]);
  });

  it('un reposo imposible se ignora', () => {
    expect(limitesZonas({ fc_max: 150, fc_reposo: 160, umbral: null })![0]!.desde).toBe(75);
  });

  it('sin nada es null', () => {
    expect(limitesZonas({ fc_max: null, fc_reposo: 50, umbral: null })).toBeNull();
    expect(limitesZonas({ fc_max: 0, fc_reposo: null, umbral: 0 })).toBeNull();
  });
});

describe('zonaDe', () => {
  const lim = limitesZonas({ fc_max: 190, fc_reposo: 50, umbral: null });
  it('clasifica en los bordes', () => {
    expect(zonaDe(133, lim)).toBe('Z1');
    expect(zonaDe(134, lim)).toBe('Z2');
    expect(zonaDe(175, lim)).toBe('Z4');
    expect(zonaDe(176, lim)).toBe('Z5');
  });
  it('un pulso decimal no cae en ningún hueco', () => {
    expect(zonaDe(133.5, lim)).toBe('Z1');
  });
  it('fuera de la tabla va a la zona extrema', () => {
    expect(zonaDe(90, lim)).toBe('Z1');
    expect(zonaDe(205, lim)).toBe('Z5');
  });
  it('sin límites o sin pulso es null', () => {
    expect(zonaDe(150, null)).toBeNull();
    expect(zonaDe(0, lim)).toBeNull();
  });
});

describe('tiempoEnZonas', () => {
  const perfil: PerfilFc = { fc_max: 190, fc_reposo: 50, umbral: null };

  it('con serie, cada muestra vale hasta la siguiente', () => {
    const t = tiempoEnZonas(
      {
        fc_serie: [
          { t: 0, bpm: 130 },
          { t: 60, bpm: 140 },
          { t: 120, bpm: 150 },
          { t: 180, bpm: 170 },
        ],
        duracion_s: 240,
        fc_media: 150,
      },
      perfil,
    );
    expect(t).toEqual({ Z1: 60, Z2: 60, Z3: 60, Z4: 60, Z5: 0 });
  });

  it('la serie cubre inicio y final y no se pasa de la duración', () => {
    const t = tiempoEnZonas(
      {
        fc_serie: [
          { t: 30, bpm: 130 },
          { t: 90, bpm: 180 },
          { t: 150, bpm: 130 },
        ],
        duracion_s: 120,
        fc_media: null,
      },
      perfil,
    );
    expect(t).toEqual({ Z1: 90, Z2: 0, Z3: 0, Z4: 0, Z5: 30 });
  });

  it('sin serie, por parciales', () => {
    const t = tiempoEnZonas(
      {
        parciales: [
          { duracion_s: 300, fc_media: 140 },
          { duracion_s: 300, fc_media: 170 },
        ],
        duracion_s: 600,
        fc_media: 150,
      },
      perfil,
    );
    expect(t).toEqual({ Z1: 0, Z2: 300, Z3: 0, Z4: 300, Z5: 0 });
  });

  it('lo que los parciales no cubren va a la zona de la media', () => {
    const t = tiempoEnZonas(
      {
        parciales: [
          { duracion_s: 300, fc_media: 140 },
          { duracion_s: 200, fc_media: null },
        ],
        duracion_s: 600,
        fc_media: 170,
      },
      perfil,
    );
    expect(t).toEqual({ Z1: 0, Z2: 300, Z3: 0, Z4: 300, Z5: 0 });
  });

  it('sin media, los parciales se reescalan a la duración', () => {
    const t = tiempoEnZonas(
      { parciales: [{ duracion_s: 300, fc_media: 140 }], duracion_s: 600, fc_media: null },
      perfil,
    );
    expect(t!.Z2).toBe(600);
  });

  it('solo con la media, toda la sesión en su zona', () => {
    expect(tiempoEnZonas({ duracion_s: 1000, fc_media: 150 }, perfil)).toEqual({
      Z1: 0,
      Z2: 0,
      Z3: 1000,
      Z4: 0,
      Z5: 0,
    });
  });

  it('sin datos o sin perfil es null', () => {
    expect(tiempoEnZonas({ duracion_s: 1000, fc_media: null, fc_serie: null, parciales: [] }, perfil)).toBeNull();
    expect(tiempoEnZonas({ duracion_s: 1000, fc_media: 150 }, { fc_max: null, fc_reposo: null, umbral: null })).toBeNull();
  });
});

describe('mejorTramoSeg', () => {
  // 2,5 m/s salvo el tramo 1000→1500, que va a 5 m/s.
  const ruta = [p(0, 0), p(500, 200), p(1000, 400), p(1500, 500), p(2000, 700)];

  it('encuentra el mejor kilómetro en cualquier punto', () => {
    // El tramo rápido (100 s) más 500 m a 2,5 m/s (200 s).
    expect(mejorTramoSeg(ruta, 1000)).toBeCloseTo(300, 6);
  });

  it('interpola: la ventana no tiene que caer en puntos de la ruta', () => {
    // 500 m a 5 m/s y 250 m a 2,5 m/s. Sin interpolar saldrían 300 s.
    expect(mejorTramoSeg(ruta, 750)).toBeCloseTo(200, 6);
  });

  it('dentro de un tramo vale la velocidad del tramo', () => {
    expect(mejorTramoSeg(ruta, 100)).toBeCloseTo(20, 6);
  });

  it('la ruta entera es el único tramo posible', () => {
    expect(mejorTramoSeg(ruta, 2000)).toBeCloseTo(700, 6);
  });

  it('no inventa si la ruta no llega', () => {
    expect(mejorTramoSeg(ruta, 2001)).toBeNull();
    expect(mejorTramoSeg([p(0, 0)], 100)).toBeNull();
    expect(mejorTramoSeg(ruta, 0)).toBeNull();
  });

  it('una parada al GPS no la cuenta como metros', () => {
    const conParada = [p(0, 0), p(500, 100), p(500, 400), p(1000, 500)];
    expect(mejorTramoSeg(conParada, 1000)).toBeCloseTo(500, 6);
  });
});

describe('recordsPersonales', () => {
  const base = { distancia_m: null, duracion_s: 1, desnivel_m: null };
  const buscar = (rs: ReturnType<typeof recordsPersonales>, deporte: string, clave: string) =>
    rs.find((r) => r.deporte === deporte && r.clave === clave);

  it('saca los récords de carrera de la ruta', () => {
    const e: EntrenoRecord = {
      ...base,
      id: 'a',
      deporte: 'carrera',
      fecha: '2026-01-01',
      distancia_m: 6000,
      duracion_s: 1800,
      desnivel_m: 40,
      // 3,33 m/s de media, con un km a 4 m/s.
      ruta: [p(0, 0), p(2000, 600), p(3000, 850), p(6000, 1750)],
    };
    const rs = recordsPersonales([e]);
    expect(buscar(rs, 'carrera', '1k')!.valor_s).toBe(250);
    // 5 km: el km rápido (250 s) y 4 km a 300 s/km (1200 s).
    expect(buscar(rs, 'carrera', '5k')!.valor_s).toBe(1450);
    expect(buscar(rs, 'carrera', '10k')).toBeUndefined();
    expect(buscar(rs, 'carrera', 'distancia_max')).toMatchObject({ valor_s: 6000, entreno_id: 'a' });
    expect(buscar(rs, 'carrera', 'desnivel_max')).toMatchObject({ valor_s: 40, entreno_id: 'a' });
  });

  it('bici: marcas propias', () => {
    const rs = recordsPersonales([
      { ...base, id: 'b', deporte: 'bici', fecha: '2026-01-01', distancia_m: 40000, duracion_s: 4000, ruta: [p(0, 0), p(40000, 4000)] },
    ]);
    expect(buscar(rs, 'bici', '20k')!.valor_s).toBeCloseTo(2000, 0);
    expect(buscar(rs, 'bici', '40k')!.valor_s).toBeCloseTo(4000, 0);
    expect(buscar(rs, 'bici', '90k')).toBeUndefined();
  });

  it('natación: mejores largos consecutivos', () => {
    const largo = (duracion_s: number) => ({ tipo: 'largo', distancia_m: 25, duracion_s });
    const rs = recordsPersonales([
      {
        ...base,
        id: 'n',
        deporte: 'piscina',
        fecha: '2026-01-01',
        distancia_m: 200,
        duracion_s: 221,
        parciales: [30, 28, 25, 25, 26, 26, 30, 31].map(largo),
      },
    ]);
    // 25 + 25 + 26 + 26
    expect(buscar(rs, 'natacion', '100m')).toMatchObject({ valor_s: 102, entreno_id: 'n' });
    expect(buscar(rs, 'natacion', '400m')).toBeUndefined();
  });

  it('natación: una pausa corta la serie de largos', () => {
    const largo = (duracion_s: number) => ({ tipo: 'largo', distancia_m: 50, duracion_s });
    const rs = recordsPersonales([
      {
        ...base,
        id: 'n',
        deporte: 'piscina',
        fecha: '2026-01-01',
        distancia_m: 150,
        duracion_s: 300,
        parciales: [largo(40), { tipo: 'vuelta', distancia_m: 0, duracion_s: 60 }, largo(40), largo(70)],
      },
    ]);
    expect(buscar(rs, 'natacion', '100m')!.valor_s).toBe(110);
  });

  it('natación: la sesión completa vale si coincide la distancia', () => {
    const sesion = (distancia_m: number): EntrenoRecord => ({
      ...base,
      id: 'n',
      deporte: 'aguas_abiertas',
      fecha: '2026-01-01',
      distancia_m,
      duracion_s: 1800,
    });
    expect(buscar(recordsPersonales([sesion(1500)]), 'natacion', '1500m')!.valor_s).toBe(1800);
    expect(buscar(recordsPersonales([sesion(1510)]), 'natacion', '1500m')!.valor_s).toBe(1800);
    expect(buscar(recordsPersonales([sesion(1490)]), 'natacion', '1500m')).toBeUndefined();
    expect(buscar(recordsPersonales([sesion(1600)]), 'natacion', '1500m')).toBeUndefined();
  });

  it('se queda con el mejor; a igualdad, el primero', () => {
    const sesion = (id: string, fecha: string, duracion_s: number): EntrenoRecord => ({
      ...base,
      id,
      deporte: 'piscina',
      fecha,
      distancia_m: 400,
      duracion_s,
    });
    const rs = recordsPersonales([sesion('c', '2026-03-01', 400), sesion('a', '2026-01-01', 400), sesion('b', '2026-02-01', 450)]);
    expect(buscar(rs, 'natacion', '400m')).toMatchObject({ entreno_id: 'a', fecha: '2026-01-01', valor_s: 400 });
  });

  it('un salto del GPS o el coche no es un récord', () => {
    const rs = recordsPersonales([
      { ...base, id: 'x', deporte: 'carrera', fecha: '2026-01-01', distancia_m: 30000, duracion_s: 1200, ruta: [p(0, 0), p(30000, 1200)] },
    ]);
    expect(rs).toEqual([]);
  });

  it('un salto dentro de una ruta normal no cuela en ese tramo', () => {
    const rs = recordsPersonales([
      {
        ...base,
        id: 'x',
        deporte: 'carrera',
        fecha: '2026-01-01',
        distancia_m: 3000,
        duracion_s: 1000,
        ruta: [p(0, 0), p(1000, 495), p(2000, 505), p(3000, 1000)],
      },
    ]);
    expect(buscar(rs, 'carrera', '1k')).toBeUndefined();
    expect(buscar(rs, 'carrera', 'distancia_max')!.valor_s).toBe(3000);
  });

  it('sin datos no hay récords', () => {
    expect(recordsPersonales([])).toEqual([]);
    expect(recordsPersonales([{ ...base, id: 'f', deporte: 'fuerza', fecha: '2026-01-01' }])).toEqual([]);
  });

  it('sin distancia declarada la toma de la ruta, y el desnivel también', () => {
    const rs = recordsPersonales([
      { ...base, id: 'r', deporte: 'carrera', fecha: '2026-01-01', duracion_s: 600, ruta: [p(0, 0, 100), p(2000, 600, 150)] },
    ]);
    expect(buscar(rs, 'carrera', 'distancia_max')!.valor_s).toBe(2000);
    expect(buscar(rs, 'carrera', 'desnivel_max')!.valor_s).toBe(50);
  });

  it('el orden es estable: por deporte y por tabla', () => {
    const rs = recordsPersonales([
      { ...base, id: 'o', deporte: 'otro', fecha: '2026-01-01', distancia_m: 500, duracion_s: 300 },
      { ...base, id: 'n', deporte: 'piscina', fecha: '2026-01-01', distancia_m: 100, duracion_s: 100 },
      { ...base, id: 'c', deporte: 'carrera', fecha: '2026-01-01', distancia_m: 2000, duracion_s: 600, ruta: [p(0, 0), p(2000, 600)] },
    ]);
    expect(rs.map((r) => `${r.deporte}/${r.clave}`)).toEqual([
      'carrera/1k',
      'carrera/distancia_max',
      'natacion/100m',
      'natacion/distancia_max',
      'otro/distancia_max',
    ]);
  });
});

describe('nuevosRecords', () => {
  const rec = (clave: string, valor_s: number, entreno_id: string, deporte = 'carrera') => ({
    clave,
    etiqueta: clave,
    deporte,
    valor_s,
    entreno_id,
    fecha: '2026-01-01',
  });

  it('anuncia lo batido por este entreno', () => {
    const antes = [rec('5k', 1500, 'a'), rec('10k', 3200, 'a')];
    const despues = [rec('5k', 1450, 'b'), rec('10k', 3200, 'a')];
    expect(nuevosRecords(antes, despues, 'b')).toEqual([despues[0]]);
  });

  it('la primera marca también es nueva', () => {
    const despues = [rec('5k', 1450, 'b')];
    expect(nuevosRecords([], despues, 'b')).toEqual(despues);
  });

  it('reimportar el mismo entreno no anuncia nada', () => {
    const r = [rec('5k', 1450, 'b')];
    expect(nuevosRecords(r, r, 'b')).toEqual([]);
  });

  it('en las máximas, más es mejor', () => {
    const antes = [rec('distancia_max', 10000, 'a')];
    const despues = [rec('distancia_max', 12000, 'b')];
    expect(nuevosRecords(antes, despues, 'b')).toEqual(despues);
  });

  it('la misma clave en otro deporte no se confunde', () => {
    const antes = [rec('distancia_max', 90000, 'a', 'bici')];
    const despues = [rec('distancia_max', 90000, 'a', 'bici'), rec('distancia_max', 5000, 'b', 'carrera')];
    expect(nuevosRecords(antes, despues, 'b')).toEqual([despues[1]]);
  });
});
