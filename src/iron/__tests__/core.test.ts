// NIVL · IRON · Fase 2, grupo CORE Y CARDIO: la biomecánica de cada
// ejercicio, medida sobre el esqueleto que dibuja el motor en todo el ciclo
// (cada 25 ms), y el material propio (esterilla, comba, rueda).
import { centroCarga, dibujar, esqueletoEn, ranuras } from '../dibujo';
import { planta, type Esqueleto, type Punto } from '../esqueleto';
import { EJERCICIOS, ejercicioPorId } from '../ejercicios';
import { EJERCICIOS_CORE } from '../ejercicios/core';
import { angulosEn } from '../interpolar';
import { apiceComba, giroComba } from '../material/comba';
import type { Banco, Ejercicio } from '../tipos';

const ej = (id: string): Ejercicio => {
  const e = ejercicioPorId(id);
  if (!e) throw new Error(id);
  return e;
};

function muestras(e: Ejercicio, paso = 25): { ms: number; s: Esqueleto }[] {
  const out: { ms: number; s: Esqueleto }[] = [];
  for (let ms = 0; ms < e.cicloMs; ms += paso) out.push({ ms, s: esqueletoEn(e, ms) });
  return out;
}

/** Ángulo normalizado a (-180, 180]. */
const ang = (a: number) => {
  const r = ((a % 360) + 360) % 360;
  return r > 180 ? r - 360 : r;
};

const dist = (a: Punto, b: Punto) => Math.hypot(a.x - b.x, a.y - b.y);

/** Distancia de p a la recta que pasa por a y b. */
function distanciaARecta(p: Punto, a: Punto, b: Punto): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / Math.hypot(dx, dy);
}

/** Distancia de p al segmento ab. */
function distanciaASegmento(p: Punto, a: Punto, b: Punto): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return dist(p, { x: a.x + dx * t, y: a.y + dy * t });
}

/** Grosor de la esterilla del ejercicio (0 si no hay). */
const esterilla = (e: Ejercicio) => (e.escenario?.find((x) => x.tipo === 'esterilla') as Banco | undefined)?.alto ?? 0;

const RADIO_CABEZA = 6.2;

/** El punto está donde dice el ancla (no se ha movido). */
function enAncla(p: Punto, e: Ejercicio): void {
  expect(p.x).toBeCloseTo(e.ancla.x, 6);
  expect(p.y).toBeCloseTo(e.ancla.y, 6);
}

describe('el grupo', () => {
  it('unos 25 ejercicios, todos registrados en el catálogo y con textos en iron-core', () => {
    expect(EJERCICIOS_CORE.length).toBeGreaterThanOrEqual(22);
    for (const e of EJERCICIOS_CORE) {
      expect(EJERCICIOS).toContain(e);
      expect(e.nombre.startsWith('iron-core:')).toBe(true);
    }
  });

  it('solo usa material propio (esterilla, comba, rueda) o peso corporal', () => {
    for (const e of EJERCICIOS_CORE) for (const m of e.material) expect(['esterilla', 'comba', 'rueda', 'peso_corporal']).toContain(m);
  });

  it('la plancha del prototipo no se duplica', () => {
    expect(EJERCICIOS.filter((e) => e.id === 'plancha')).toHaveLength(1);
    expect(EJERCICIOS_CORE.map((e) => e.id)).not.toContain('plancha');
  });

  it('cada ejercicio tiene al menos un sustituto de su mismo grupo', () => {
    for (const e of EJERCICIOS_CORE) {
      const mismos = e.sustitutos.map(ej).filter((o) => o.grupo === e.grupo);
      expect(mismos.length).toBeGreaterThan(0);
    }
  });
});

describe.each(EJERCICIOS_CORE.map((e) => [e.id, e] as const))('%s', (_id, e) => {
  const m = muestras(e);

  it('nada atraviesa el suelo (ni la planta de los pies)', () => {
    for (const { s } of m) {
      for (const [k, p] of Object.entries(s.p)) if (!k.startsWith('punta')) expect(p.y).toBeGreaterThan(-0.1);
      if (e.vista === 'lateral') {
        // La planta gira sobre la punta en despegues y aterrizajes: la misma
        // holgura que el test del motor.
        for (const lado of ['c', 'l'] as const) {
          const pl = planta(s, lado);
          expect(pl.talon.y).toBeGreaterThan(-0.6);
          expect(pl.punta.y).toBeGreaterThan(-0.6);
        }
      }
    }
  });

  it('el brazo de delante nunca pasa por encima de la cabeza (no la tapa)', () => {
    for (const { s } of m) {
      const c = s.p.cabeza;
      const d = Math.min(distanciaASegmento(c, s.p.hombro, s.p.codo_c), distanciaASegmento(c, s.p.codo_c, s.p.agarre_c));
      expect(d).toBeGreaterThan(RADIO_CABEZA);
    }
  });

  it('el cuerpo cabe entero en el encuadre (nada cortado en el GIF ni en la ficha)', () => {
    const { x, y, ancho, alto } = e.encuadre;
    for (const { s } of m) {
      for (const [k, p] of Object.entries(s.p)) {
        const r = k === 'cabeza' ? 7.5 : 4;
        expect(p.x - r).toBeGreaterThanOrEqual(x);
        expect(p.x + r).toBeLessThanOrEqual(x + ancho);
        expect(p.y + r).toBeLessThanOrEqual(y + alto);
      }
    }
  });

  it('el ciclo cierra sin salto', () => {
    const a = angulosEn(e, 0);
    const b = angulosEn(e, e.cicloMs - 0.01);
    for (const k of ['cadera', 'rodilla', 'tobillo', 'hombro', 'codo'] as const) {
      expect(Math.abs(a.cerca[k] - b.cerca[k])).toBeLessThan(1);
      expect(Math.abs(a.lejos[k] - b.lejos[k])).toBeLessThan(1);
    }
  });

  it('el principal se dibuja en la pose de la ficha', () => {
    const r = ranuras(e.vista);
    const capas = dibujar(e, e.msFicha ?? e.poses[Math.floor(e.poses.length / 2)].ms);
    expect(r.some((x, i) => x.estilo === 'principal' && capas[i].length > 0)).toBe(true);
  });
});

// ── Core ────────────────────────────────────────────────────────────────

describe('crunch', () => {
  const e = ej('crunch');
  const m = muestras(e);
  const M = esterilla(e);

  it('cadera quieta y pies planos en la esterilla', () => {
    for (const { s } of m) {
      enAncla(s.p.cadera, e);
      const p = planta(s, 'c');
      expect(Math.abs(p.talon.y - M)).toBeLessThan(0.3);
      expect(Math.abs(p.punta.y - M)).toBeLessThan(0.3);
    }
  });

  it('recorrido corto: el tronco sube entre 18 y 30°', () => {
    const giros = m.map(({ s }) => Math.abs(ang(s.a.tronco - e.ancla.angulo)));
    expect(Math.max(...giros)).toBeGreaterThanOrEqual(18);
    expect(Math.max(...giros)).toBeLessThanOrEqual(30);
  });

  it('abajo la cabeza apoya en la esterilla', () => {
    const s = esqueletoEn(e, 0);
    expect(Math.abs(s.p.cabeza.y - RADIO_CABEZA - M)).toBeLessThan(1);
  });
});

describe('crunch inverso', () => {
  const e = ej('crunch-inverso');
  const M = esterilla(e);

  it('hombros quietos y brazos apoyados en el suelo', () => {
    for (const { s } of muestras(e)) {
      enAncla(s.p.hombro, e);
      expect(s.p.agarre_c.y).toBeLessThan(M + 5);
    }
  });

  it('la cadera se despega poco (≤ 10)', () => {
    const alturas = muestras(e).map(({ s }) => s.p.cadera.y);
    const sube = Math.max(...alturas) - Math.min(...alturas);
    expect(sube).toBeGreaterThan(3);
    expect(sube).toBeLessThanOrEqual(10);
  });

  it('la cabeza sigue en la esterilla', () => {
    for (const { s } of muestras(e)) expect(Math.abs(s.p.cabeza.y - RADIO_CABEZA - M)).toBeLessThan(1.2);
  });
});

describe('elevaciones de piernas', () => {
  const e = ej('elevaciones-piernas');
  const M = esterilla(e);

  it('tronco quieto y rodillas casi estiradas', () => {
    for (let ms = 0; ms < e.cicloMs; ms += 25) {
      expect(angulosEn(e, ms).cerca.rodilla).toBeLessThanOrEqual(10);
      expect(esqueletoEn(e, ms).a.tronco).toBeCloseTo(e.ancla.angulo, 6);
    }
  });

  it('de casi el suelo a la vertical, sin que los talones toquen', () => {
    const muslos = muestras(e).map(({ s }) => ang(s.a.muslo_c));
    expect(Math.min(...muslos)).toBeLessThan(10);
    expect(Math.max(...muslos)).toBeGreaterThan(80);
    for (const { s } of muestras(e)) expect(planta(s, 'c').talon.y).toBeGreaterThan(M + 1);
  });

  it('la bajada dura más que la subida', () => {
    expect(e.cicloMs - e.poses[3].ms).toBeGreaterThan(e.poses[2].ms - e.poses[1].ms);
  });
});

describe('tijeras abdominales', () => {
  const e = ej('tijeras-abdominales');
  const M = esterilla(e);

  it('piernas estiradas que se cruzan, sin tocar el suelo', () => {
    for (const { ms, s } of muestras(e)) {
      const a = angulosEn(e, ms);
      expect(a.cerca.rodilla).toBe(0);
      expect(planta(s, 'c').talon.y).toBeGreaterThan(M + 1);
      expect(planta(s, 'l').talon.y).toBeGreaterThan(M + 1);
    }
    const medio = angulosEn(e, 400);
    expect(Math.abs(medio.cerca.cadera - medio.lejos.cadera)).toBeLessThan(1);
  });
});

describe('hollow hold', () => {
  const e = ej('hollow-hold');
  const s = esqueletoEn(e, 0);
  const M = esterilla(e);

  it('hombros y piernas despegados: solo apoyan glúteos y zona lumbar', () => {
    expect(s.p.hombro.y).toBeGreaterThan(s.p.cadera.y + 3);
    expect(s.p.cabeza.y - RADIO_CABEZA).toBeGreaterThan(M + 2);
    expect(planta(s, 'c').talon.y).toBeGreaterThan(M + 5);
  });

  it('piernas a 15 a 30° del suelo y estiradas', () => {
    expect(ang(s.a.muslo_c)).toBeGreaterThanOrEqual(15);
    expect(ang(s.a.muslo_c)).toBeLessThanOrEqual(30);
    expect(angulosEn(e, 0).cerca.rodilla).toBe(0);
  });
});

describe('dead bug', () => {
  const e = ej('dead-bug');
  const M = esterilla(e);

  it('siempre brazo y pierna contrarios', () => {
    for (let ms = 0; ms < e.cicloMs; ms += 25) {
      const a = angulosEn(e, ms);
      // Brazo de cerca estirado arriba ⇒ la pierna de cerca sigue en la mesa (y al revés).
      if (a.cerca.hombro > 120) expect(a.cerca.cadera).toBeGreaterThan(80);
      if (a.lejos.hombro > 120) expect(a.lejos.cadera).toBeGreaterThan(80);
      if (a.lejos.cadera < 20) expect(a.lejos.hombro).toBeLessThan(90);
    }
  });

  it('tronco quieto y la pierna estirada no toca el suelo', () => {
    for (const { s } of muestras(e)) {
      expect(s.a.tronco).toBeCloseTo(e.ancla.angulo, 6);
      expect(planta(s, 'c').talon.y).toBeGreaterThan(M + 1);
      expect(planta(s, 'l').talon.y).toBeGreaterThan(M + 1);
    }
  });
});

describe('plancha alta', () => {
  const e = ej('plancha-alta');
  const s = esqueletoEn(e, 0);
  const M = esterilla(e);

  it('mano bajo el hombro y brazo estirado', () => {
    expect(Math.abs(s.p.agarre_c.x - s.p.hombro.x)).toBeLessThan(1.5);
    expect(angulosEn(e, 0).cerca.codo).toBe(0);
  });

  it('hombro, cadera y tobillo en línea recta', () => {
    expect(distanciaARecta(s.p.cadera, s.p.hombro, s.p.tobillo_c)).toBeLessThan(1);
  });

  it('apoyo en manos y puntas de los pies', () => {
    expect(Math.abs(planta(s, 'c').punta.y - M)).toBeLessThan(0.3);
    expect(Math.abs(s.p.agarre_c.y - 2.4 - M)).toBeLessThan(0.3);
  });
});

describe('toques de hombro', () => {
  const e = ej('toques-hombro');
  const M = esterilla(e);

  it('tronco quieto y siempre una mano en el suelo', () => {
    for (const { s } of muestras(e)) {
      expect(s.a.tronco).toBeCloseTo(e.ancla.angulo, 6);
      expect(Math.min(s.p.agarre_c.y, s.p.agarre_l.y)).toBeLessThan(M + 2.4 + 0.5);
    }
  });

  it('la mano llega al pecho, junto al hombro', () => {
    const s = esqueletoEn(e, 800);
    expect(dist(s.p.agarre_c, s.p.hombro)).toBeLessThan(12);
  });
});

describe('bird dog', () => {
  const e = ej('bird-dog');
  const M = esterilla(e);

  it('tronco quieto, una rodilla y una mano siempre apoyadas', () => {
    for (const { s } of muestras(e)) {
      expect(s.a.tronco).toBeCloseTo(e.ancla.angulo, 6);
      expect(Math.min(Math.abs(s.p.rodilla_c.y - 4 - M), Math.abs(s.p.rodilla_l.y - 4 - M))).toBeLessThan(0.6);
      expect(Math.min(s.p.agarre_c.y, s.p.agarre_l.y)).toBeLessThan(M + 2.4 + 0.6);
    }
  });

  it('arriba brazo y pierna casi horizontales, sin pasar de la cadera', () => {
    const s = esqueletoEn(e, 1600);
    expect(Math.abs(ang(s.a.brazo_c))).toBeLessThan(15);
    expect(Math.abs(ang(s.a.muslo_l - 180))).toBeLessThan(15);
    expect(s.p.tobillo_l.y).toBeLessThan(s.p.cadera.y + 5);
  });
});

describe('mountain climbers', () => {
  const e = ej('mountain-climbers');
  const M = esterilla(e);

  it('manos y tronco quietos', () => {
    for (const { s } of muestras(e)) {
      enAncla(s.p.agarre_c, e);
      expect(Math.abs(s.p.agarre_l.x - s.p.agarre_c.x)).toBeLessThan(0.01);
    }
  });

  it('la rodilla sube bajo el pecho y la pierna de atrás apoya la punta', () => {
    const s = esqueletoEn(e, 0);
    expect(s.p.rodilla_c.x).toBeGreaterThan(s.p.cadera.x);
    expect(s.p.rodilla_c.y).toBeLessThan(s.p.hombro.y);
    expect(Math.abs(planta(s, 'l').punta.y - M)).toBeLessThan(0.4);
  });
});

describe('rueda abdominal', () => {
  const e = ej('rueda-abdominal');
  const M = esterilla(e);
  const radio = e.carga?.tipo === 'rueda' ? e.carga.radio : 0;

  it('rodillas quietas y dedos de los pies apoyados', () => {
    for (const { s } of muestras(e)) {
      enAncla(s.p.rodilla_c, e);
      expect(Math.abs(planta(s, 'c').punta.y - M)).toBeLessThan(0.4);
    }
  });

  it('la rueda va por el suelo y los brazos, estirados', () => {
    for (const { ms, s } of muestras(e)) {
      expect(Math.abs((centroCarga(s, e.carga, e.vista) as Punto).y - radio - M)).toBeLessThan(1.5);
      expect(angulosEn(e, ms).cerca.codo).toBe(0);
    }
  });

  it('avanza hasta casi alinear el cuerpo sin hundir la cadera', () => {
    let antes = -Infinity;
    for (let ms = 300; ms <= 2300; ms += 25) {
      const x = esqueletoEn(e, ms).p.agarre_c.x;
      expect(x).toBeGreaterThanOrEqual(antes - 0.01);
      antes = x;
    }
    for (let ms = 0; ms < e.cicloMs; ms += 25) expect(angulosEn(e, ms).cerca.cadera).toBeGreaterThanOrEqual(10);
    expect(Math.abs(ang(esqueletoEn(e, 2500).a.tronco))).toBeLessThan(15);
  });
});

describe('plancha lateral (vista frontal)', () => {
  const e = ej('plancha-lateral');
  const s = esqueletoEn(e, 0);

  it('codo de apoyo bajo el hombro: brazo vertical', () => {
    expect(Math.abs(ang(s.a.brazo_c) + 90)).toBeLessThan(2);
  });

  it('el cuerpo recto: de la cadera a los pies sigue la línea del tronco', () => {
    const pies = { x: (s.p.tobillo_c.x + s.p.tobillo_l.x) / 2, y: (s.p.tobillo_c.y + s.p.tobillo_l.y) / 2 };
    const tronco = ang(s.a.tronco + 180);
    const piernas = (Math.atan2(pies.y - s.p.cadera.y, pies.x - s.p.cadera.x) * 180) / Math.PI;
    expect(Math.abs(ang(tronco - piernas))).toBeLessThan(5);
    expect(ang(s.a.tronco)).toBeGreaterThan(150);
  });

  it('pies apilados: el de arriba sobre el de abajo', () => {
    expect(Math.abs(s.p.tobillo_c.x - s.p.tobillo_l.x)).toBeLessThan(3);
    expect(s.p.tobillo_l.y).toBeGreaterThan(s.p.tobillo_c.y);
  });
});

describe('russian twist', () => {
  const e = ej('russian-twist');
  const M = esterilla(e);

  it('cadera, tronco y piernas quietos; talones en la esterilla', () => {
    for (const { ms, s } of muestras(e)) {
      expect(s.a.tronco).toBeCloseTo(e.ancla.angulo, 6);
      expect(angulosEn(e, ms).cerca.cadera).toBeCloseTo(e.poses[0].cerca.cadera, 6);
      expect(Math.abs(planta(s, 'c').talon.y - M)).toBeLessThan(0.5);
    }
  });

  it('las manos bajan junto a la cadera y vuelven al frente', () => {
    const alturas = muestras(e).map(({ s }) => s.p.agarre_c.y);
    expect(Math.min(...alturas)).toBeLessThan(12);
    expect(Math.max(...alturas)).toBeGreaterThan(20);
  });
});

// ── Cardio y peso corporal ──────────────────────────────────────────────

describe('burpees', () => {
  const e = ej('burpees');
  const MANOS = { x: 16, y: 2.4 };

  it('las manos no se mueven mientras apoyan (de las cuclillas a la plancha y vuelta)', () => {
    for (let ms = 700; ms <= 1850; ms += 25) expect(dist(esqueletoEn(e, ms).p.agarre_c, MANOS)).toBeLessThan(1.5);
  });

  it('plancha: mano bajo el hombro y el cuerpo en línea', () => {
    const s = esqueletoEn(e, 1300);
    expect(Math.abs(s.p.agarre_c.x - s.p.hombro.x)).toBeLessThan(1.5);
    expect(distanciaARecta(s.p.cadera, s.p.hombro, s.p.tobillo_c)).toBeLessThan(1.5);
  });

  it('salto: pies en el aire y brazos por encima de la cabeza; aterrizaje con rodillas dobladas', () => {
    const s = esqueletoEn(e, 2750);
    expect(Math.min(planta(s, 'c').talon.y, planta(s, 'c').punta.y)).toBeGreaterThan(3);
    expect(s.p.agarre_c.y).toBeGreaterThan(s.p.cabeza.y);
    expect(angulosEn(e, 3200).cerca.rodilla).toBeGreaterThanOrEqual(40);
  });
});

describe('saltos de tijera (vista frontal)', () => {
  const e = ej('saltos-tijera');

  it('abiertos: brazos arriba, piernas separadas y pies en el suelo', () => {
    const s = esqueletoEn(e, 750);
    expect(angulosEn(e, 750).cerca.hombro).toBeGreaterThanOrEqual(150);
    expect(Math.abs(s.p.tobillo_c.x - s.p.tobillo_l.x)).toBeGreaterThan(30);
    expect(Math.abs(s.p.tobillo_c.y - 4)).toBeLessThan(0.3);
  });

  it('cerrados: pies juntos bajo la cadera y en el suelo; entre medias, en el aire', () => {
    const s = esqueletoEn(e, 0);
    expect(Math.abs(s.p.tobillo_c.x - s.p.tobillo_l.x)).toBeLessThan(20);
    expect(Math.abs(s.p.tobillo_c.y - 4)).toBeLessThan(0.3);
    expect(esqueletoEn(e, 375).p.tobillo_c.y).toBeGreaterThan(6);
  });
});

describe('comba', () => {
  const e = ej('comba');
  const vueltas = e.carga?.tipo === 'comba' ? e.carga.vueltas : 0;
  const m = muestras(e);

  it('la cuerda pasa bajo los pies cuando están en el aire', () => {
    for (const ms of [0, 800]) {
      const s = esqueletoEn(e, ms);
      const pies = Math.min(planta(s, 'c').punta.y, planta(s, 'c').talon.y);
      const manos = { x: (s.p.agarre_c.x + s.p.agarre_l.x) / 2, y: (s.p.agarre_c.y + s.p.agarre_l.y) / 2 };
      const cuerda = apiceComba(manos, giroComba(ms / e.cicloMs, vueltas));
      expect(cuerda.y).toBeLessThan(pies);
      expect(pies).toBeGreaterThan(1);
    }
  });

  it('saltos bajos, codos junto al cuerpo y manos a la altura de la cadera', () => {
    const alturas = m.map(({ s }) => planta(s, 'c').punta.y);
    expect(Math.max(...alturas) - Math.min(...alturas)).toBeLessThanOrEqual(6);
    for (const { ms, s } of m) {
      expect(Math.abs(angulosEn(e, ms).cerca.hombro)).toBeLessThan(15);
      expect(Math.abs(s.p.agarre_c.y - s.p.cadera.y)).toBeLessThan(10);
    }
  });
});

describe('rodillas arriba', () => {
  const e = ej('rodillas-arriba');

  it('la rodilla llega a la altura de la cadera, con el brazo contrario delante', () => {
    const s = esqueletoEn(e, 0);
    expect(Math.abs(ang(s.a.muslo_c))).toBeLessThan(15);
    const a = angulosEn(e, 0);
    expect(a.lejos.hombro).toBeGreaterThan(a.cerca.hombro);
  });

  it('tronco erguido y la pierna de apoyo sobre la parte delantera del pie', () => {
    for (const { s } of muestras(e)) expect(ang(s.a.tronco)).toBeGreaterThanOrEqual(80);
    const s = esqueletoEn(e, 0);
    expect(Math.abs(planta(s, 'l').punta.y)).toBeLessThan(0.3);
    expect(planta(s, 'l').talon.y).toBeGreaterThan(1);
  });
});

describe('talones al glúteo', () => {
  const e = ej('talones-gluteo');

  it('el talón llega al glúteo con el muslo casi vertical', () => {
    const a = angulosEn(e, 0);
    expect(a.cerca.rodilla).toBeGreaterThanOrEqual(130);
    expect(a.cerca.cadera).toBeGreaterThanOrEqual(-10);
    expect(a.cerca.cadera).toBeLessThanOrEqual(15);
  });
});

describe('sentadilla con salto', () => {
  const e = ej('sentadilla-salto');

  it('el pie apoyado no resbala: tobillo quieto y pie plano mientras baja', () => {
    for (let ms = 0; ms <= 1000; ms += 25) {
      const s = esqueletoEn(e, ms);
      enAncla(s.p.tobillo_c, e);
      expect(Math.abs(planta(s, 'c').talon.y)).toBeLessThan(0.3);
    }
  });

  it('abajo la cadera cerca de las rodillas; en el aire, pies despegados', () => {
    const abajo = esqueletoEn(e, 1000);
    expect(abajo.p.cadera.y).toBeLessThan(abajo.p.rodilla_c.y + 8);
    const aire = esqueletoEn(e, 1450);
    expect(Math.min(planta(aire, 'c').talon.y, planta(aire, 'c').punta.y)).toBeGreaterThan(3);
  });

  it('aterriza con las rodillas dobladas', () => {
    expect(angulosEn(e, 1900).cerca.rodilla).toBeGreaterThanOrEqual(40);
  });
});

describe('paso del oso', () => {
  const e = ej('oso');

  it('rodillas sin tocar el suelo y por debajo de la cadera; tronco y altura fijos', () => {
    for (const { s } of muestras(e)) {
      expect(Math.min(s.p.rodilla_c.y, s.p.rodilla_l.y)).toBeGreaterThan(5);
      expect(Math.max(s.p.rodilla_c.y, s.p.rodilla_l.y)).toBeLessThan(s.p.cadera.y);
      expect(s.a.tronco).toBeCloseTo(e.ancla.angulo, 6);
      expect(s.p.cadera.y).toBeCloseTo(e.ancla.y, 6);
    }
  });

  it('mano y pie contrarios: con la mano de cerca en el aire, apoya la de lejos y sube el pie de lejos', () => {
    const s = esqueletoEn(e, 450);
    expect(s.p.agarre_c.y).toBeGreaterThan(5);
    expect(s.p.agarre_l.y).toBeLessThan(3);
    expect(planta(s, 'l').punta.y).toBeGreaterThan(3);
    expect(Math.abs(planta(s, 'c').punta.y)).toBeLessThan(0.3);
  });
});

// ── Movilidad ───────────────────────────────────────────────────────────

describe('perro boca abajo', () => {
  const e = ej('perro-boca-abajo');

  it('manos quietas y la cadera, el punto más alto', () => {
    for (const { s } of muestras(e)) {
      enAncla(s.p.agarre_c, e);
      expect(s.p.cadera.y).toBeGreaterThan(s.p.hombro.y);
      expect(s.p.cadera.y).toBeGreaterThan(s.p.cabeza.y);
    }
  });

  it('el talón que baja deja la rodilla casi estirada', () => {
    expect(angulosEn(e, 0).cerca.rodilla).toBeLessThanOrEqual(15);
    expect(angulosEn(e, 1400).lejos.rodilla).toBeLessThanOrEqual(15);
  });
});

describe('bisagra de cadera', () => {
  const e = ej('bisagra-cadera');

  it('pies quietos, tronco abajo entre 30 y 50° y la cadera detrás del tobillo', () => {
    const s = esqueletoEn(e, 1700);
    expect(ang(s.a.tronco)).toBeGreaterThanOrEqual(30);
    expect(ang(s.a.tronco)).toBeLessThanOrEqual(50);
    expect(s.p.cadera.x).toBeLessThan(s.p.tobillo_c.x);
    for (const { ms, s: t } of muestras(e)) {
      enAncla(t.p.tobillo_c, e);
      expect(angulosEn(e, ms).cerca.rodilla).toBeLessThanOrEqual(20);
    }
  });
});

describe('flexores de cadera', () => {
  const e = ej('flexor-cadera');
  const M = esterilla(e);

  it('pie de delante quieto y rodilla de atrás en la esterilla', () => {
    for (const { s } of muestras(e)) {
      enAncla(s.p.tobillo_l, e);
      expect(Math.abs(s.p.rodilla_c.y - 4 - M)).toBeLessThan(1.5);
    }
  });

  it('la cadera de atrás se extiende entre 20 y 30° con el tronco vertical', () => {
    const a = angulosEn(e, 2000);
    expect(a.cerca.cadera).toBeLessThanOrEqual(-20);
    expect(a.cerca.cadera).toBeGreaterThanOrEqual(-30);
    for (const { s } of muestras(e)) expect(Math.abs(ang(s.a.tronco) - 90)).toBeLessThanOrEqual(5);
  });
});

describe('movilidad de tobillo', () => {
  const e = ej('movilidad-tobillo');
  const M = esterilla(e);

  it('pie de delante quieto y plano; la rodilla pasa por delante del tobillo', () => {
    for (const { s } of muestras(e)) {
      enAncla(s.p.tobillo_c, e);
      expect(Math.abs(planta(s, 'c').talon.y - M)).toBeLessThan(0.3);
      expect(Math.abs(s.p.rodilla_l.y - 4 - M)).toBeLessThan(1.5);
    }
    const tob = muestras(e).map(({ ms }) => angulosEn(e, ms).cerca.tobillo);
    expect(Math.max(...tob) - Math.min(...tob)).toBeGreaterThanOrEqual(20);
    const s = esqueletoEn(e, 1600);
    expect(s.p.rodilla_c.x).toBeGreaterThan(s.p.tobillo_c.x);
  });
});

describe('balanceo de pierna', () => {
  const e = ej('balanceo-pierna');

  it('pierna de apoyo quieta, tronco erguido y recorrido de -20 a 60° o más', () => {
    const caderas: number[] = [];
    for (const { ms, s } of muestras(e)) {
      enAncla(s.p.tobillo_l, e);
      expect(Math.abs(ang(s.a.tronco) - 90)).toBeLessThan(3);
      caderas.push(angulosEn(e, ms).cerca.cadera);
    }
    expect(Math.min(...caderas)).toBeLessThanOrEqual(-20);
    expect(Math.max(...caderas)).toBeGreaterThanOrEqual(60);
  });
});

// ── Material ────────────────────────────────────────────────────────────

describe('material', () => {
  it('la esterilla se dibuja en su capa y no tapa a nadie (va al fondo)', () => {
    for (const e of EJERCICIOS_CORE) {
      if (!e.escenario?.some((x) => x.tipo === 'esterilla')) continue;
      for (const x of e.escenario) if (x.tipo === 'esterilla') expect(x.capa).toBe('fondo');
      const r = ranuras(e.vista);
      const capas = dibujar(e, 0);
      expect(capas[r.findIndex((x) => x.clave === 'ESC_FONDO')].length).toBeGreaterThan(0);
    }
  });

  it('el lazo de la comba pasa bajo los pies, detrás, por encima de la cabeza y delante', () => {
    const manos = { x: 0, y: 50 };
    expect(apiceComba(manos, 0).y).toBeLessThan(1);
    expect(apiceComba(manos, 0.25).x).toBeLessThan(manos.x - 20);
    expect(apiceComba(manos, 0.5).y).toBeGreaterThan(105);
    expect(apiceComba(manos, 0.75).x).toBeGreaterThan(manos.x + 20);
    expect(giroComba(0.5, 2)).toBeCloseTo(0);
  });
});
