// NIVL · IRON · Ronda 2 (integración de la fase 2): los ejercicios que solo
// esperaban material de otro equipo. Biomecánica medida sobre el esqueleto
// que dibuja el motor en todo el ciclo (cada 25 ms), como en el resto de
// grupos, más el material nuevo de la ronda (banco en espejo, banda en la
// rodilla, polea al tobillo).
import { dir, planta, type Esqueleto, type Punto } from '../esqueleto';
import { dibujar, esqueletoEn, ranuras } from '../dibujo';
import { EJERCICIOS, ejercicioPorId } from '../ejercicios';
import { angulosEn } from '../interpolar';
import { bancoInclinado } from '../material/banco-inclinado';
import type { Ejercicio } from '../tipos';

const ej = (id: string): Ejercicio => {
  const e = ejercicioPorId(id);
  if (!e) throw new Error(id);
  return e;
};

function muestras(e: Ejercicio): { ms: number; s: Esqueleto }[] {
  const out: { ms: number; s: Esqueleto }[] = [];
  for (let ms = 0; ms < e.cicloMs; ms += 25) out.push({ ms, s: esqueletoEn(e, ms) });
  return out;
}

const ang = (a: number) => {
  const r = ((a % 360) + 360) % 360;
  return r > 180 ? r - 360 : r;
};
const rango = (v: number[]) => Math.max(...v) - Math.min(...v);
const dist = (a: Punto, b: Punto) => Math.hypot(a.x - b.x, a.y - b.y);

/** Distancia de p al segmento ab. */
function aSegmento(p: Punto, a: Punto, b: Punto): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return dist(p, { x: a.x + dx * t, y: a.y + dy * t });
}

const RADIO_CABEZA = 6.2;
const codo = (e: Ejercicio, ms: number, lado: 'cerca' | 'lejos' = 'cerca') => angulosEn(e, ms)[lado].codo;
const caderaArt = (e: Ejercicio, ms: number, lado: 'cerca' | 'lejos' = 'cerca') => angulosEn(e, ms)[lado].cadera;
const tiempos = (e: Ejercicio) => muestras(e).map((m) => m.ms);

/** Pies planos en el suelo (los dos) en todo el ciclo. */
function piesPlanos(e: Ejercicio) {
  for (const { s } of muestras(e))
    for (const l of ['c', 'l'] as const) {
      const p = planta(s, l);
      expect(Math.abs(p.talon.y)).toBeLessThan(0.3);
      expect(Math.abs(p.punta.y)).toBeLessThan(0.3);
    }
}

/** El cable (del punto `de` a la polea) no toca la cabeza. */
function cableLibre(e: Ejercicio, de: 'agarre_c' | 'agarre_l' | 'tobillo_c') {
  if (e.carga?.tipo !== 'polea') throw new Error('sin polea');
  const polea = e.carga.polea;
  for (const { s } of muestras(e)) expect(aSegmento(s.p.cabeza, s.p[de], polea)).toBeGreaterThan(RADIO_CABEZA);
}

const RONDA_2 = [
  'curl-polea',
  'extension-triceps-polea',
  'curl-inclinado-mancuerna',
  'curl-arana',
  'remo-apoyo-pecho',
  'dominada-asistida-banda',
  'pallof-press',
  'elevacion-rodillas-colgado',
  'patada-gluteo-polea',
  'abduccion-banda',
  'cruce-poleas',
];

describe('ronda 2: catálogo', () => {
  it('están todos registrados y usan material de otro equipo que ya existe', () => {
    for (const id of RONDA_2) expect(ejercicioPorId(id)).toBeDefined();
    const deOtro = ['polea', 'banco_inclinado', 'banda', 'barra_fija'];
    for (const id of RONDA_2) expect(ej(id).material.some((m) => deOtro.includes(m))).toBe(true);
  });

  it('el principal se dibuja en la pose de la ficha', () => {
    for (const id of RONDA_2) {
      const e = ej(id);
      const r = ranuras(e.vista);
      const capas = dibujar(e, e.msFicha ?? 0);
      expect(r.some((x, i) => x.estilo === 'principal' && capas[i].length > 0)).toBe(true);
    }
  });

  it('el catálogo completo no tiene ids repetidos', () => {
    const ids = EJERCICIOS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('material nuevo de la ronda 2', () => {
  it('el banco inclinado en espejo es el normal reflejado en x alrededor de la bisagra', () => {
    const normal = bancoInclinado(0, 24.6, 35, 50, 10, 1);
    const espejo = bancoInclinado(0, 24.6, 35, 50, 10, -1);
    const xs = (d: string) => [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.max(...xs(normal))).toBeCloseTo(-Math.min(...xs(espejo)), 0);
    expect(Math.min(...xs(normal))).toBeLessThan(-35);
    expect(Math.max(...xs(espejo))).toBeGreaterThan(35);
  });

  it('la banda en la rodilla y la polea al tobillo se dibujan en la capa de carga', () => {
    for (const id of ['dominada-asistida-banda', 'abduccion-banda', 'patada-gluteo-polea']) {
      const e = ej(id);
      const r = ranuras(e.vista);
      const capas = dibujar(e, 0);
      const i = r.findIndex((x) => x.clave === 'CARGA_C');
      expect(capas[i].length).toBeGreaterThan(0);
      expect(capas[i]).not.toMatch(/NaN/);
    }
  });
});

describe('curl-polea', () => {
  const e = ej('curl-polea');
  it('hombro de 0 a 20° (codos quietos) y ≥ 115° de codo', () => {
    for (const ms of tiempos(e)) {
      const h = angulosEn(e, ms).cerca.hombro;
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(20);
    }
    expect(rango(tiempos(e).map((ms) => codo(e, ms)))).toBeGreaterThanOrEqual(115);
  });
  it('bajada más lenta que la subida, pies planos y el cable lejos de la cabeza', () => {
    expect(e.cicloMs - e.esfuerzo[0].hasta).toBeGreaterThan(e.esfuerzo[0].hasta - e.esfuerzo[0].desde);
    piesPlanos(e);
    cableLibre(e, 'agarre_c');
  });
});

describe('extension-triceps-polea', () => {
  const e = ej('extension-triceps-polea');
  const m = muestras(e);
  it('el brazo no se mueve (±2°) y va casi vertical, pegado al costado', () => {
    const a = m.map(({ s }) => ang(s.a.brazo_c));
    expect(rango(a)).toBeLessThan(2);
    for (const x of a) expect(Math.abs(x + 90)).toBeLessThan(10);
  });
  it('el codo va de ≥ 95° a ≤ 8°, el tronco quieto', () => {
    const c = tiempos(e).map((ms) => codo(e, ms));
    expect(Math.max(...c)).toBeGreaterThanOrEqual(95);
    expect(Math.min(...c)).toBeLessThanOrEqual(8);
    expect(rango(m.map(({ s }) => s.a.tronco))).toBeLessThan(0.5);
  });
  it('pies planos y el cable no toca la cabeza', () => {
    piesPlanos(e);
    cableLibre(e, 'agarre_c');
  });
});

describe.each([
  ['curl-inclinado-mancuerna', 110],
  ['curl-arana', 120],
] as const)('%s', (id, minimo) => {
  const e = ej(id);
  const m = muestras(e);
  it('el brazo cuelga vertical y quieto (±3°)', () => {
    for (const { s } of m) {
      expect(Math.abs(ang(s.a.brazo_c) + 90)).toBeLessThan(3);
      expect(Math.abs(ang(s.a.brazo_l) + 90)).toBeLessThan(3);
    }
  });
  it(`el codo va de ≤ 8° a ≥ ${minimo}°, con el tronco quieto`, () => {
    const c = tiempos(e).map((ms) => codo(e, ms));
    expect(Math.min(...c)).toBeLessThanOrEqual(8);
    expect(Math.max(...c)).toBeGreaterThanOrEqual(minimo);
    expect(rango(m.map(({ s }) => s.a.tronco))).toBeLessThan(0.5);
    expect(rango(m.map(({ s }) => s.p.hombro.x))).toBeLessThan(0.5);
  });
  it('pies planos en el suelo', () => piesPlanos(e));
  it('la mancuerna no toca la cabeza', () => {
    for (const { s } of m) expect(dist(s.p.agarre_c, s.p.cabeza)).toBeGreaterThan(RADIO_CABEZA + 4);
  });
});

describe('curl-inclinado-mancuerna: apoyado en el respaldo', () => {
  it('la espalda va sobre la cara del respaldo (a la distancia de la espalda, ±1)', () => {
    const e = ej('curl-inclinado-mancuerna');
    const b = e.escenario?.[0];
    if (b?.tipo !== 'banco_inclinado') throw new Error('sin banco');
    const u = dir(180 - b.angulo);
    for (const { s } of muestras(e)) {
      // Distancia (con signo) del eje del tronco a la recta del respaldo, en hombro y cadera.
      for (const p of [s.p.hombro, s.p.cadera]) {
        const d = (p.x - b.x) * -u.y + (p.y - b.alto) * u.x;
        expect(Math.abs(d)).toBeGreaterThan(6.3);
        expect(Math.abs(d)).toBeLessThan(10.2);
      }
    }
  });
});

describe.each(['remo-apoyo-pecho', 'curl-arana'])('%s: pecho en el respaldo (banco en espejo)', (id) => {
  const e = ej(id);
  it('el banco está en espejo y el tronco va paralelo a él, a la distancia del pecho (±1)', () => {
    const b = e.escenario?.[0];
    if (b?.tipo !== 'banco_inclinado') throw new Error('sin banco');
    expect(b.espejo).toBe(true);
    const u = dir(b.angulo);
    for (const { s } of muestras(e)) {
      expect(Math.abs(ang(s.a.tronco) - b.angulo)).toBeLessThan(0.5);
      const d = (s.p.cadera.x - b.x) * -u.y + (s.p.cadera.y - b.alto) * u.x;
      expect(Math.abs(d - 7)).toBeLessThan(1);
    }
  });
});

describe('remo-apoyo-pecho', () => {
  const e = ej('remo-apoyo-pecho');
  it('abajo el brazo cuelga vertical; arriba el codo pasa la línea de la espalda', () => {
    const abajo = esqueletoEn(e, 200);
    expect(Math.abs(ang(abajo.a.brazo_c) + 90)).toBeLessThan(3);
    const arriba = esqueletoEn(e, 1450);
    const atras = dir(arriba.a.tronco + 90);
    const c = { x: arriba.p.codo_c.x - arriba.p.hombro.x, y: arriba.p.codo_c.y - arriba.p.hombro.y };
    expect(c.x * atras.x + c.y * atras.y).toBeGreaterThan(0);
  });
  it('pies planos', () => piesPlanos(e));
});

describe('dominada-asistida-banda', () => {
  const e = ej('dominada-asistida-banda');
  it('las manos no se mueven de la barra y la barbilla pasa la barra arriba', () => {
    const m = muestras(e);
    for (const { s } of m) expect(dist(s.p.agarre_c, { x: 0, y: 118 })).toBeLessThan(0.01);
    expect(Math.max(...m.map(({ s }) => s.p.cabeza.y))).toBeGreaterThan(118 - 2);
  });
  it('la banda va de la barra a la rodilla, que siempre queda por debajo', () => {
    if (e.carga?.tipo !== 'banda' || typeof e.carga.anclaje !== 'object') throw new Error('sin banda');
    expect(e.carga.en).toBe('rodilla');
    expect(Math.abs(e.carga.anclaje.y - 118)).toBeLessThan(0.01);
    for (const { s } of muestras(e)) expect(s.p.rodilla_c.y).toBeLessThan(118 - 30);
  });
});

describe('pallof-press', () => {
  const e = ej('pallof-press');
  const m = muestras(e);
  it('cadera, hombros y pies quietos y simétricos', () => {
    for (const { s } of m) {
      expect(dist(s.p.cadera, { x: 0, y: 52.9 })).toBeLessThan(0.01);
      expect(Math.abs(s.p.tobillo_c.x + s.p.tobillo_l.x)).toBeLessThan(0.01);
      expect(Math.abs(s.p.codo_c.x + s.p.codo_l.x)).toBeLessThan(0.01);
      expect(Math.abs(planta(s, 'l').talon.y)).toBeLessThan(0.5);
    }
  });
  it('las manos van juntas en el centro del pecho todo el ciclo', () => {
    for (const { s } of m) {
      expect(Math.abs(s.p.agarre_c.x)).toBeLessThan(4);
      expect(dist(s.p.agarre_c, s.p.agarre_l)).toBeLessThan(7);
      expect(s.p.agarre_c.y).toBeGreaterThan(s.p.hombro.y - 18);
      expect(s.p.agarre_c.y).toBeLessThan(s.p.hombro.y);
    }
  });
  it('al empujar los brazos se acortan (van hacia la cámara)', () => {
    expect(esqueletoEn(e, 1800).l.brazo_c).toBeLessThan(esqueletoEn(e, 0).l.brazo_c * 0.5);
  });
  it('la banda sale hacia el poste del lado lejano', () => {
    if (e.carga?.tipo !== 'banda' || typeof e.carga.anclaje !== 'object') throw new Error('sin banda');
    expect(e.carga.anclaje.x).toBeGreaterThan(40);
  });
});

describe('elevacion-rodillas-colgado', () => {
  const e = ej('elevacion-rodillas-colgado');
  const m = muestras(e);
  it('las manos no se mueven de la barra y los brazos siguen estirados', () => {
    for (const { s } of m) expect(dist(s.p.agarre_c, { x: 0, y: 118 })).toBeLessThan(0.01);
    for (const ms of tiempos(e)) expect(codo(e, ms)).toBeLessThan(10);
  });
  it('la cadera va de ≤ 10° a ≥ 85° de flexión y el tronco se inclina como mucho 12°', () => {
    const c = tiempos(e).map((ms) => caderaArt(e, ms));
    expect(Math.min(...c)).toBeLessThanOrEqual(10);
    expect(Math.max(...c)).toBeGreaterThanOrEqual(85);
    expect(rango(m.map(({ s }) => s.a.tronco))).toBeLessThanOrEqual(12);
  });
  it('los pies no tocan el suelo y la cara queda delante del brazo', () => {
    for (const { s } of m) {
      for (const l of ['c', 'l'] as const) expect(Math.min(planta(s, l).talon.y, planta(s, l).punta.y)).toBeGreaterThan(1);
      expect(s.p.cabeza.x).toBeLessThan(s.p.codo_c.x);
    }
  });
});

describe('patada-gluteo-polea', () => {
  const e = ej('patada-gluteo-polea');
  const m = muestras(e);
  it('el pie de apoyo y el tronco no se mueven', () => {
    for (const { s } of m) {
      expect(Math.abs(planta(s, 'l').talon.y)).toBeLessThan(0.3);
      expect(Math.abs(planta(s, 'l').punta.y)).toBeLessThan(0.3);
    }
    expect(rango(m.map(({ s }) => s.a.tronco))).toBeLessThan(0.5);
    expect(rango(m.map(({ s }) => s.p.cadera.x))).toBeLessThan(0.5);
  });
  it('la cadera que trabaja va de flexión a 20 a 30° de extensión, sin pasar de -30', () => {
    const c = tiempos(e).map((ms) => caderaArt(e, ms));
    expect(Math.max(...c)).toBeGreaterThanOrEqual(5);
    expect(Math.min(...c)).toBeLessThanOrEqual(-20);
    expect(Math.min(...c)).toBeGreaterThanOrEqual(-30);
  });
  it('arriba la rodilla casi estirada y el cable sale del tobillo', () => {
    expect(angulosEn(e, 1450).cerca.rodilla).toBeLessThan(15);
    if (e.carga?.tipo !== 'polea') throw new Error('sin polea');
    expect(e.carga.en).toBe('tobillo');
    cableLibre(e, 'tobillo_c');
  });
});

describe('abduccion-banda', () => {
  const e = ej('abduccion-banda');
  const m = muestras(e);
  it('cadera y tronco quietos, pie de apoyo plano', () => {
    for (const { s } of m) {
      expect(dist(s.p.cadera, { x: 0, y: 52.9 })).toBeLessThan(0.01);
      expect(Math.abs(ang(s.a.tronco) - 90)).toBeLessThan(0.01);
      expect(Math.abs(s.p.tobillo_l.y - 4)).toBeLessThan(0.3);
    }
  });
  it('la pierna se abre de ≤ 5° a 25 a 35° y no toca el suelo al abrir', () => {
    const c = tiempos(e).map((ms) => caderaArt(e, ms));
    expect(Math.min(...c)).toBeLessThanOrEqual(5);
    expect(Math.max(...c)).toBeGreaterThanOrEqual(25);
    expect(Math.max(...c)).toBeLessThanOrEqual(35);
    for (const { s } of m) expect(s.p.tobillo_c.y).toBeGreaterThan(3.8);
  });
  it('la banda va de rodilla a rodilla', () => {
    if (e.carga?.tipo !== 'banda') throw new Error('sin banda');
    expect(e.carga.en).toBe('rodilla');
    expect(e.carga.anclaje).toBe('manos');
  });
});

describe('cruce-poleas', () => {
  const e = ej('cruce-poleas');
  const m = muestras(e);
  it('tronco y piernas quietos, pies planos', () => {
    expect(rango(m.map(({ s }) => s.a.tronco))).toBeLessThan(0.5);
    piesPlanos(e);
  });
  it('abiertos, la mano a la altura del hombro; cerrados, por delante y por debajo', () => {
    const abierto = esqueletoEn(e, 200);
    expect(Math.abs(abierto.p.agarre_c.y - abierto.p.hombro.y)).toBeLessThan(8);
    const cerrado = esqueletoEn(e, 1650);
    expect(cerrado.p.agarre_c.x - cerrado.p.hombro.x).toBeGreaterThan(18);
    expect(cerrado.p.hombro.y - cerrado.p.agarre_c.y).toBeGreaterThan(18);
  });
  it('el brazo sale del plano abierto (se ve corto) y vuelve entero al cerrar', () => {
    expect(esqueletoEn(e, 200).l.brazo_c).toBeLessThan(8);
    expect(esqueletoEn(e, 1650).l.brazo_c).toBeGreaterThan(17);
  });
  it('el cable (lado lejano, por detrás) no toca la cabeza', () => cableLibre(e, 'agarre_l'));
});
