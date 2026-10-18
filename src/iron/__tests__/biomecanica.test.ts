// NIVL · IRON · Biomecánica de los 5 ejercicios del prototipo, medida sobre
// el esqueleto que dibuja el motor en todo el ciclo (cada 25 ms), no solo en
// las poses clave: la interpolación tampoco puede romper la técnica.
import { dir, planta, type Esqueleto, type Punto } from '../esqueleto';
import { centroCarga, esqueletoEn } from '../dibujo';
import { EJERCICIOS, ejercicioPorId } from '../ejercicios';
import { angulosEn } from '../interpolar';
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

/** Ángulo de un segmento normalizado a (-180, 180]. */
const ang = (a: number) => {
  const r = ((a % 360) + 360) % 360;
  return r > 180 ? r - 360 : r;
};

const medioPie = (s: Esqueleto) => {
  const p = planta(s, 'c');
  return (p.talon.x + p.punta.x) / 2;
};

/** Distancia de p a la recta que pasa por a y b. */
function distanciaARecta(p: Punto, a: Punto, b: Punto): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / Math.hypot(dx, dy);
}

describe('todos', () => {
  it.each(EJERCICIOS.map((e) => [e.id, e] as const))('%s: nada del esqueleto atraviesa el suelo', (_id, e) => {
    for (const { s } of muestras(e)) {
      // punta_c/punta_l son el eje del pie; la planta se mira aparte.
      for (const [k, p] of Object.entries(s.p)) if (!k.startsWith('punta')) expect(p.y).toBeGreaterThan(-0.6);
      for (const lado of ['c', 'l'] as const) {
        const pl = planta(s, lado);
        expect(pl.talon.y).toBeGreaterThan(-0.6);
        expect(pl.punta.y).toBeGreaterThan(-0.6);
      }
    }
  });

  it.each(EJERCICIOS.map((e) => [e.id, e] as const))('%s: el ciclo cierra sin salto', (_id, e) => {
    const a = angulosEn(e, 0);
    const b = angulosEn(e, e.cicloMs - 1);
    expect(Math.abs(a.cerca.codo - b.cerca.codo)).toBeLessThan(1);
    expect(Math.abs(a.cerca.cadera - b.cerca.cadera)).toBeLessThan(1);
  });
});

describe('sentadilla con barra', () => {
  const e = ej('sentadilla-barra');
  const m = muestras(e);

  it('la barra va sobre el medio del pie en todo el recorrido (±2)', () => {
    for (const { s } of m) {
      const b = centroCarga(s, e.carga, e.vista) as Punto;
      expect(Math.abs(b.x - medioPie(s))).toBeLessThan(2);
    }
  });

  it('pies planos en el suelo todo el recorrido', () => {
    for (const { s } of m) {
      const p = planta(s, 'c');
      expect(Math.abs(p.talon.y)).toBeLessThan(0.3);
      expect(Math.abs(p.punta.y)).toBeLessThan(0.3);
    }
  });

  it('profundidad: abajo la cadera queda por debajo de la rodilla', () => {
    const abajo = esqueletoEn(e, 2750);
    expect(abajo.p.cadera.y).toBeLessThan(abajo.p.rodilla_c.y);
  });

  it('arriba, de pie: rodilla casi estirada y tronco casi vertical', () => {
    const arriba = esqueletoEn(e, 300);
    expect(angulosEn(e, 300).cerca.rodilla).toBeLessThan(10);
    expect(Math.abs(ang(arriba.a.tronco) - 90)).toBeLessThan(15);
  });

  it('las rodillas avanzan, como mucho un poco más allá de la punta del pie', () => {
    for (const { s } of m) expect(s.p.rodilla_c.x).toBeLessThan(planta(s, 'c').punta.x + 3);
  });

  it('espalda neutra: la cabeza sigue al tronco (cuello entre -15 y 10)', () => {
    for (let ms = 0; ms < e.cicloMs; ms += 25) {
      const c = angulosEn(e, ms).cuello;
      expect(c).toBeGreaterThanOrEqual(-15);
      expect(c).toBeLessThanOrEqual(10);
    }
  });

  it('las manos siguen en la barra', () => {
    for (const { s } of m) {
      const b = centroCarga(s, e.carga, e.vista) as Punto;
      expect(Math.hypot(s.p.agarre_c.x - b.x, s.p.agarre_c.y - b.y)).toBeLessThan(3);
    }
  });
});

describe('press de banca', () => {
  const e = ej('press-banca');
  const m = muestras(e);

  it('antebrazo vertical en todo el recorrido (±15°)', () => {
    for (const { s } of m) expect(Math.abs(ang(s.a.antebrazo_c) - 90)).toBeLessThan(15);
  });

  it('abajo la barra toca la parte baja del pecho', () => {
    const s = esqueletoEn(e, 2750);
    const b = s.p.agarre_c;
    // La barra cae entre el 60 y el 85 % del tronco, contando desde la cadera.
    const t = (s.p.cadera.x - b.x) / (s.p.cadera.x - s.p.hombro.x);
    expect(t).toBeGreaterThan(0.6);
    expect(t).toBeLessThan(0.85);
    // Pecho (eje + 7,2 de grosor) + radio de la barra: a menos de 2 unidades.
    expect(b.y - (s.p.cadera.y + 7.2)).toBeLessThan(2);
  });

  it('arriba la barra queda sobre los hombros', () => {
    const s = esqueletoEn(e, 200);
    expect(Math.abs(s.p.agarre_c.x - s.p.hombro.x)).toBeLessThan(2);
    expect(s.p.agarre_c.y - s.p.hombro.y).toBeGreaterThan(30);
  });

  it('trayectoria en J: la barra siempre entre el pecho bajo y los hombros', () => {
    for (const { s } of m) {
      expect(s.p.agarre_c.x).toBeGreaterThan(s.p.hombro.x - 2);
      expect(s.p.agarre_c.x).toBeLessThan(s.p.hombro.x + 10);
    }
  });

  it('pies planos en el suelo y la cabeza sobre el banco', () => {
    const banco = e.escenario?.[0];
    for (const { s } of m) {
      const p = planta(s, 'c');
      expect(Math.abs(p.talon.y)).toBeLessThan(0.3);
      expect(Math.abs(p.punta.y)).toBeLessThan(0.3);
      expect(s.p.cabeza.y - 6.2).toBeGreaterThanOrEqual((banco?.alto ?? 0) - 0.5);
    }
  });
});

describe('remo con mancuerna', () => {
  const e = ej('remo-mancuerna');
  const m = muestras(e);
  const banco = e.escenario?.[0];

  it('el antebrazo cuelga vertical (±15°): tira el codo, no la mano', () => {
    for (const { s } of m) expect(Math.abs(ang(s.a.antebrazo_c) + 90)).toBeLessThan(15);
  });

  it('el tronco no se mueve ni gira', () => {
    const angulos = m.map(({ s }) => ang(s.a.tronco));
    expect(Math.max(...angulos) - Math.min(...angulos)).toBeLessThan(0.01);
    expect(angulos[0]).toBeGreaterThanOrEqual(10);
    expect(angulos[0]).toBeLessThanOrEqual(30);
  });

  it('arriba el codo pasa la línea de la espalda', () => {
    const s = esqueletoEn(e, 1800);
    const d = dir(s.a.tronco);
    const rel = { x: s.p.codo_c.x - s.p.cadera.x, y: s.p.codo_c.y - s.p.cadera.y };
    // Lado de la espalda = a la izquierda del eje cadera→hombro.
    expect(d.x * rel.y - d.y * rel.x).toBeGreaterThan(0);
  });

  it('apoyos: rodilla y mano lejanas sobre el banco, pie cercano plano en el suelo', () => {
    for (const { s } of m) {
      expect(Math.abs(s.p.rodilla_l.y - 3.8 - (banco?.alto ?? 0))).toBeLessThan(0.8);
      expect(Math.abs(s.p.agarre_l.y - 2.4 - (banco?.alto ?? 0))).toBeLessThan(0.8);
      const p = planta(s, 'c');
      expect(Math.abs(p.talon.y)).toBeLessThan(0.4);
      expect(Math.abs(p.punta.y)).toBeLessThan(0.4);
    }
  });
});

describe('curl de bíceps', () => {
  const e = ej('curl-biceps-mancuerna');

  it('codo pegado: el hombro no pasa de 15° y el tronco no se balancea', () => {
    for (let ms = 0; ms < e.cicloMs; ms += 25) {
      const a = angulosEn(e, ms);
      expect(a.cerca.hombro).toBeLessThanOrEqual(15);
      expect(a.cerca.hombro).toBeGreaterThanOrEqual(-1);
      expect(Math.abs(ang(esqueletoEn(e, ms).a.tronco) - 90)).toBeLessThan(3);
    }
  });

  it('recorrido completo: de casi estirado a codo cerrado', () => {
    const codos = muestras(e).map(({ ms }) => angulosEn(e, ms).cerca.codo);
    expect(Math.min(...codos)).toBeLessThanOrEqual(10);
    expect(Math.max(...codos)).toBeGreaterThanOrEqual(135);
  });

  it('la bajada dura más que la subida', () => {
    const subida = e.poses[2].ms - e.poses[1].ms;
    const bajada = e.cicloMs - e.poses[3].ms;
    expect(bajada).toBeGreaterThan(subida);
  });
});

describe('plancha', () => {
  const e = ej('plancha');
  const s = esqueletoEn(e, 0);

  it('codo bajo el hombro', () => {
    expect(Math.abs(s.p.codo_c.x - s.p.hombro.x)).toBeLessThan(1.5);
  });

  it('hombro, cadera y tobillo en línea recta', () => {
    expect(distanciaARecta(s.p.cadera, s.p.hombro, s.p.tobillo_c)).toBeLessThan(1);
  });

  it('apoyo en antebrazos y puntas de los pies', () => {
    expect(Math.abs(planta(s, 'c').punta.y)).toBeLessThan(0.5);
    expect(Math.abs(ang(s.a.antebrazo_c))).toBeLessThan(10);
    expect(s.p.codo_c.y).toBeLessThan(4);
  });

  it('no se mueve en todo el ciclo', () => {
    const fin = esqueletoEn(e, 3000);
    expect(fin.p.cadera).toEqual(s.p.cadera);
  });
});
