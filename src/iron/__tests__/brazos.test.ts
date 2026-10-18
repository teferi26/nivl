// NIVL · IRON · Fase 2, catálogo de BRAZOS: el grupo completo y la técnica
// de cada ejercicio, medida sobre el esqueleto que dibuja el motor en todo
// el ciclo (cada 25 ms). Lo común a todos (suelo, ciclo, esquema y textos)
// ya lo comprueban biomecanica.test.ts y esquema.test.ts.
import fs from 'fs';
import path from 'path';
import { RECURSOS_ES } from '@/i18n/recursos';
import { planta, type Esqueleto, type Punto } from '../esqueleto';
import { centroCarga, dibujar, esqueletoEn, ranuras } from '../dibujo';
import { EJERCICIOS, ejercicioPorId } from '../ejercicios';
import { BRAZOS } from '../ejercicios/brazos';
import { tramoBarraZ } from '../material/barra-z';
import { GRUPO_DE_MUSCULO, MUSCULOS } from '../musculos';
import type { Ejercicio, Material } from '../tipos';

const RADIO_CABEZA = 6.2;
const DIR = path.resolve(__dirname, '..', 'ejercicios', 'brazos');

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
const dist = (a: Punto, b: Punto) => Math.hypot(a.x - b.x, a.y - b.y);
/** Cuánto varía un valor en todo el ciclo. */
const rango = (xs: number[]) => Math.max(...xs) - Math.min(...xs);

describe('catálogo de brazos', () => {
  it('cada archivo de la carpeta está en el índice del grupo y en el catálogo', () => {
    const archivos = fs
      .readdirSync(DIR)
      .filter((f) => f.endsWith('.ts') && f !== 'index.ts' && f !== 'comun.ts')
      .map((f) => f.slice(0, -3))
      .sort();
    expect(BRAZOS.map((e) => e.id).sort()).toEqual(archivos);
    for (const e of BRAZOS) expect(EJERCICIOS).toContain(e);
  });

  it('unos 25 ejercicios, todos del grupo brazo y con textos en iron-brazos', () => {
    expect(BRAZOS.length).toBeGreaterThanOrEqual(22);
    for (const e of BRAZOS) {
      expect(e.grupo).toBe('brazo');
      expect(e.nombre.startsWith('iron-brazos:')).toBe(true);
    }
    expect(Object.keys((RECURSOS_ES['iron-brazos'] as { ejercicios: object }).ejercicios).sort()).toEqual(
      BRAZOS.map((e) => e.id).sort(),
    );
  });

  it('cubre bíceps, tríceps, antebrazo, braquial y braquiorradial, con opciones sin material de gimnasio', () => {
    const principales = new Set(BRAZOS.flatMap((e) => e.musculos.principales));
    for (const m of ['biceps', 'triceps', 'antebrazo', 'braquial', 'braquiorradial'] as const) expect(principales).toContain(m);
    const enCasa = BRAZOS.filter((e) => e.material.every((m) => m === 'peso_corporal' || m === 'mancuerna'));
    expect(enCasa.length).toBeGreaterThanOrEqual(6);
    expect(BRAZOS.filter((e) => e.material.every((m) => m === 'peso_corporal')).length).toBeGreaterThanOrEqual(2);
  });

  it('solo usa material ya dibujado o propio (barra Z); lo demás es ronda 2', () => {
    const permitido: Material[] = ['barra', 'barra_z', 'mancuerna', 'banco', 'peso_corporal'];
    for (const e of BRAZOS) for (const m of e.material) expect(permitido).toContain(m);
  });

  it('los sustitutos son del mismo grupo', () => {
    for (const e of BRAZOS) for (const s of e.sustitutos) expect(ej(s).grupo).toBe('brazo');
  });

  it('el curl de bíceps con mancuerna del prototipo no se duplica', () => {
    const curlesDePie = BRAZOS.filter(
      (e) =>
        e.material.length === 1 &&
        e.material[0] === 'mancuerna' &&
        e.carga?.tipo === 'mancuerna' &&
        e.carga.orientacion === 'punta' &&
        e.musculos.principales[0] === 'biceps' &&
        e.ancla.punto === 'tobillo_c',
    );
    expect(curlesDePie).toEqual([]);
  });
});

describe('músculos y material nuevos', () => {
  it('braquial y braquiorradial son del grupo brazo', () => {
    expect(MUSCULOS).toContain('braquial');
    expect(MUSCULOS).toContain('braquiorradial');
    expect(GRUPO_DE_MUSCULO.braquial).toBe('brazo');
    expect(GRUPO_DE_MUSCULO.braquiorradial).toBe('brazo');
  });

  it('el braquiorradial se enciende en el antebrazo en el curl martillo', () => {
    const e = ej('curl-martillo');
    const r = ranuras(e.vista);
    const capas = dibujar(e, 1000);
    expect(capas[r.findIndex((x) => x.clave === 'antebrazo_c:p')].length).toBeGreaterThan(0);
    expect(capas[r.findIndex((x) => x.clave === 'brazo_c:p')].length).toBeGreaterThan(0);
  });

  it('la barra Z es un tubo cerrado y en zigzag (no una recta)', () => {
    const d = tramoBarraZ({ x: 0, y: 0 }, { x: 10, y: 0 });
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    const ys = [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => Number(m[2]));
    expect(rango(ys)).toBeGreaterThan(2.5);
    expect(tramoBarraZ({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe('');
  });

  it('la muñeca solo gira la mano: sin `muneca`, el agarre sigue al antebrazo', () => {
    const e = ej('curl-muneca-barra');
    const pts = muestras(e).map(({ s }) => s);
    const dirMano = pts.map((s) => ang((Math.atan2(s.p.agarre_c.y - s.p.muneca_c.y, s.p.agarre_c.x - s.p.muneca_c.x) * 180) / Math.PI));
    expect(rango(dirMano)).toBeGreaterThan(100);
    const curl = esqueletoEn(ej('curl-barra'), 0);
    const a = (Math.atan2(curl.p.agarre_c.y - curl.p.muneca_c.y, curl.p.agarre_c.x - curl.p.muneca_c.x) * 180) / Math.PI;
    expect(Math.abs(ang(a - curl.a.antebrazo_c))).toBeLessThan(0.01);
  });
});

describe('cámara: la carga no tapa la cabeza', () => {
  it.each(BRAZOS.filter((e) => e.carga).map((e) => [e.id, e] as const))('%s', (_id, e) => {
    for (const { s } of muestras(e)) {
      if (e.carga?.tipo === 'barra') {
        const b = centroCarga(s, e.carga, e.vista) as Punto;
        const eje = e.carga.eje ?? { x: 0, y: 0 };
        const disco = { x: b.x + eje.x, y: b.y + eje.y };
        expect(dist(disco, s.p.cabeza)).toBeGreaterThan((e.carga.disco ?? 12.6) + RADIO_CABEZA - 1);
      } else {
        expect(dist(s.p.agarre_c, s.p.cabeza)).toBeGreaterThan(RADIO_CABEZA + 1.5);
      }
    }
  });
});

describe.each(['curl-barra', 'curl-barra-z', 'curl-martillo', 'curl-inverso-barra-z', 'curl-sentado-mancuerna'])('%s', (id) => {
  const e = ej(id);
  const m = muestras(e);
  it('codos junto al costado: hombro de 0 a 20°, sin balanceo', () => {
    for (const { s } of m) {
      const h = ang(s.a.brazo_c - s.a.tronco - 180);
      expect(h).toBeGreaterThanOrEqual(-1);
      expect(h).toBeLessThanOrEqual(20);
    }
    expect(rango(m.map(({ s }) => s.a.tronco))).toBeLessThan(0.01);
  });
  it('recorrido completo (al menos 115° de codo) y bajada más lenta que la subida', () => {
    const codos = m.map(({ s }) => ang(s.a.antebrazo_c - s.a.brazo_c));
    expect(rango(codos)).toBeGreaterThan(115);
    const subida = e.esfuerzo[0].hasta - e.esfuerzo[0].desde;
    expect(e.cicloMs - subida).toBeGreaterThan(2 * subida * 0.9);
  });
});

describe('curl de arrastre', () => {
  const e = ej('curl-arrastre-barra');
  it('la barra va pegada al torso (eje del tronco a ≤ 13: el pecho mide ~8,7)', () => {
    for (const { s } of muestras(e)) {
      const b = s.p.agarre_c;
      // Distancia horizontal al eje del tronco (que es vertical: el tronco no se mueve).
      expect(b.x - s.p.hombro.x).toBeLessThanOrEqual(13);
    }
  });
  it('arriba el codo queda por detrás del tronco', () => {
    const s = esqueletoEn(e, 1700);
    expect(s.p.codo_c.x).toBeLessThan(s.p.hombro.x - 3);
  });
});

describe('curl concentrado', () => {
  const m = muestras(ej('curl-concentrado'));
  it('el brazo cuelga vertical (±8°) y el codo no se mueve del muslo', () => {
    for (const { s } of m) expect(Math.abs(ang(s.a.brazo_c + 90))).toBeLessThanOrEqual(8);
    expect(rango(m.map(({ s }) => s.p.codo_c.x))).toBeLessThan(0.01);
    expect(rango(m.map(({ s }) => s.p.codo_c.y))).toBeLessThan(0.01);
    const s = m[0].s;
    // El codo, sobre el muslo cercano: entre la cadera y la rodilla, a su altura.
    expect(s.p.codo_c.x).toBeGreaterThan(s.p.cadera.x);
    expect(s.p.codo_c.x).toBeLessThan(s.p.rodilla_c.x);
    expect(Math.abs(s.p.codo_c.y - s.p.cadera.y)).toBeLessThan(10);
  });
  it('pies planos', () => {
    for (const { s } of m) {
      const p = planta(s, 'c');
      expect(Math.abs(p.talon.y)).toBeLessThan(0.5);
      expect(Math.abs(p.punta.y)).toBeLessThan(0.5);
    }
  });
});

describe.each(['curl-muneca-barra', 'extension-muneca-mancuerna'])('%s', (id) => {
  const m = muestras(ej(id));
  it('el antebrazo queda horizontal y quieto sobre el muslo; la muñeca, por delante de la rodilla', () => {
    for (const { s } of m) {
      expect(Math.abs(ang(s.a.antebrazo_c))).toBeLessThan(1);
      expect(s.p.muneca_c.x).toBeGreaterThan(s.p.rodilla_c.x);
      // Apoyado: el codo, encima del muslo (a la altura de su cara de arriba).
      expect(s.p.codo_c.y - s.p.cadera.y).toBeGreaterThan(5);
      expect(s.p.codo_c.y - s.p.cadera.y).toBeLessThan(10);
    }
    expect(rango(m.map(({ s }) => s.p.codo_c.x))).toBeLessThan(0.01);
  });
  it('solo se mueve la mano: recorrido de muñeca de al menos 90°', () => {
    const mano = m.map(({ s }) => (Math.atan2(s.p.agarre_c.y - s.p.muneca_c.y, s.p.agarre_c.x - s.p.muneca_c.x) * 180) / Math.PI);
    expect(rango(mano)).toBeGreaterThan(90);
  });
});

describe('curl de muñeca por detrás', () => {
  const e = ej('curl-muneca-espalda-barra');
  it('brazos estirados y quietos detrás del cuerpo; la barra no toca los glúteos', () => {
    for (const { s } of muestras(e)) {
      expect(s.p.codo_c.x).toBeLessThan(s.p.hombro.x);
      expect(ang(s.a.antebrazo_c - s.a.brazo_c)).toBeLessThan(5);
      // El glúteo sobresale ~8,6 por detrás de la cadera.
      expect(s.p.agarre_c.x).toBeLessThan(s.p.cadera.x - 8.6 - 1.5);
    }
  });
});

describe.each(['press-frances-barra-z', 'press-frances-mancuerna', 'press-frances-suelo-mancuerna'])('%s', (id) => {
  const e = ej(id);
  const m = muestras(e);
  it('el brazo no se mueve (±1°) y va inclinado hacia la cabeza (95 a 110°)', () => {
    expect(rango(m.map(({ s }) => s.a.brazo_c))).toBeLessThan(1);
    const a = ang(m[0].s.a.brazo_c);
    expect(a).toBeGreaterThanOrEqual(95);
    expect(a).toBeLessThanOrEqual(110);
  });
  it('abajo la carga pasa por encima de la cabeza, más allá de la frente, sin tocarla', () => {
    const abajo = m.reduce((a, b) => (ang(b.s.a.antebrazo_c - b.s.a.brazo_c) > ang(a.s.a.antebrazo_c - a.s.a.brazo_c) ? b : a)).s;
    expect(abajo.p.agarre_c.y).toBeGreaterThan(abajo.p.cabeza.y);
    expect(abajo.p.agarre_c.x).toBeLessThan(abajo.p.hombro.x - 8);
    expect(dist(abajo.p.agarre_c, abajo.p.cabeza)).toBeGreaterThan(RADIO_CABEZA + 2);
  });
  it('pies planos', () => {
    for (const { s } of m) {
      const p = planta(s, 'c');
      expect(Math.abs(p.talon.y)).toBeLessThan(0.6);
      expect(Math.abs(p.punta.y)).toBeLessThan(0.6);
    }
  });
});

describe.each(['press-cerrado-barra', 'press-cerrado-mancuerna'])('%s', (id) => {
  const e = ej(id);
  const m = muestras(e);
  it('antebrazo vertical todo el recorrido (±15°)', () => {
    for (const { s } of m) expect(Math.abs(ang(s.a.antebrazo_c - 90))).toBeLessThanOrEqual(15);
  });
  it('abajo toca la parte baja del pecho; arriba acaba sobre los hombros', () => {
    const abajo = esqueletoEn(e, 2750);
    const t = (abajo.p.agarre_c.x - abajo.p.cadera.x) / (abajo.p.hombro.x - abajo.p.cadera.x);
    expect(t).toBeGreaterThan(0.55);
    expect(t).toBeLessThan(0.8);
    expect(abajo.p.agarre_c.y - abajo.p.cadera.y).toBeLessThan(12);
    const arriba = esqueletoEn(e, 250);
    expect(Math.abs(arriba.p.agarre_c.x - arriba.p.hombro.x)).toBeLessThan(3);
  });
  it('codos pegados: el brazo se ve casi entero (escorzo ≥ 0,7)', () => {
    for (const p of e.poses) expect(p.escorzo?.brazo_c ?? 1).toBeGreaterThanOrEqual(0.7);
  });
});

describe.each([
  ['fondos-banco', 0],
  ['fondos-banco-pies-elevados', 25.4],
] as const)('%s', (id, alturaTalon) => {
  const e = ej(id);
  const m = muestras(e);
  const banco = (e.escenario ?? [])[0];
  it('la mano no se mueve del borde del banco', () => {
    for (const { s } of m) {
      expect(s.p.agarre_c.x).toBeGreaterThan(banco.x);
      expect(s.p.agarre_c.x).toBeLessThan(banco.x + banco.ancho);
      expect(Math.abs(s.p.agarre_c.y - (banco.alto + 2.4))).toBeLessThan(0.01);
    }
  });
  it('el talón no se mueve (±1,5) y queda apoyado', () => {
    const talones = m.map(({ s }) => planta(s, 'c').talon);
    expect(rango(talones.map((t) => t.x))).toBeLessThan(1.5);
    for (const t of talones) expect(Math.abs(t.y - alturaTalon)).toBeLessThan(1.2);
  });
  it('la cadera baja por delante del banco (el glúteo no lo atraviesa)', () => {
    for (const { s } of m) expect(s.p.cadera.x - 8.6).toBeGreaterThan(banco.x + banco.ancho - 0.5);
    expect(rango(m.map(({ s }) => s.p.cadera.y))).toBeGreaterThan(9);
  });
  it('abajo el brazo queda como mucho paralelo al suelo (el hombro no pasa por debajo del codo)', () => {
    for (const { s } of m) expect(s.p.hombro.y).toBeGreaterThan(s.p.codo_c.y - 1);
  });
});

describe.each([
  ['flexiones-diamante', 'tobillo_c'],
  ['flexiones-diamante-rodillas', 'rodilla_c'],
] as const)('%s', (id, apoyo) => {
  const e = ej(id);
  const m = muestras(e);
  it('las manos no se mueven del suelo (±1,5)', () => {
    const manos = m.map(({ s }) => s.p.agarre_c);
    expect(rango(manos.map((p) => p.x))).toBeLessThan(1.5);
    for (const p of manos) {
      expect(p.y).toBeGreaterThan(0.8);
      expect(p.y).toBeLessThan(3.6);
    }
  });
  it('cuerpo recto: la cadera en la línea del hombro y el apoyo (±1)', () => {
    for (const { s } of m) {
      const a = s.p.hombro;
      const b = s.p[apoyo];
      const p = s.p.cadera;
      const d = Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x) / dist(a, b);
      expect(d).toBeLessThan(1);
    }
  });
  it('abajo el pecho llega cerca del suelo y las manos quedan bajo el pecho', () => {
    const abajo = esqueletoEn(e, 2000);
    expect(abajo.p.hombro.y).toBeLessThan(15);
    expect(abajo.p.agarre_c.x).toBeLessThan(abajo.p.hombro.x);
    expect(abajo.p.agarre_c.x).toBeGreaterThan(abajo.p.hombro.x - 15);
  });
  it('codos pegados que van hacia atrás: el codo queda detrás de la mano al bajar', () => {
    const abajo = esqueletoEn(e, 2000);
    expect(abajo.p.codo_c.x).toBeLessThan(abajo.p.agarre_c.x);
  });
});

describe.each(['patada-triceps', 'patada-triceps-de-pie'])('%s', (id) => {
  const e = ej(id);
  const m = muestras(e);
  it('el brazo no se mueve (±1°) y el codo queda por encima de la línea de la espalda', () => {
    expect(rango(m.map(({ s }) => s.a.brazo_c))).toBeLessThan(1);
    expect(rango(m.map(({ s }) => s.a.tronco))).toBeLessThan(0.01);
    for (const { s } of m) {
      // Recta de la espalda (cadera-hombro): el codo, por encima.
      const { cadera: c, hombro: h, codo_c: k } = s.p;
      const cruz = (h.x - c.x) * (k.y - c.y) - (h.y - c.y) * (k.x - c.x);
      expect(cruz).toBeGreaterThan(0);
    }
  });
  it('abajo el antebrazo cuelga (±10° de la vertical) y arriba queda en línea con el brazo', () => {
    const codos = m.map(({ s }) => ang(s.a.antebrazo_c - s.a.brazo_c));
    expect(Math.min(...codos)).toBeLessThan(5);
    expect(Math.abs(ang(m[0].s.a.antebrazo_c + 90))).toBeLessThanOrEqual(10);
  });
  it('pie de apoyo plano', () => {
    for (const { s } of m) {
      const p = planta(s, 'c');
      expect(Math.abs(p.talon.y)).toBeLessThan(0.6);
      expect(Math.abs(p.punta.y)).toBeLessThan(0.6);
    }
  });
});

describe.each(['extension-triceps-cabeza-mancuerna', 'extension-triceps-cabeza-barra-z'])('%s', (id) => {
  const e = ej(id);
  const m = muestras(e);
  it('brazo vertical (±5°) y quieto', () => {
    expect(rango(m.map(({ s }) => s.a.brazo_c))).toBeLessThan(1);
    expect(Math.abs(ang(m[0].s.a.brazo_c - 90))).toBeLessThanOrEqual(5);
  });
  it('abajo la carga queda detrás de la cabeza, sin tocarla; la cara se ve (por delante del brazo)', () => {
    const abajo = esqueletoEn(e, 2300);
    expect(abajo.p.agarre_c.x).toBeLessThan(abajo.p.cabeza.x - RADIO_CABEZA);
    for (const { s } of m) {
      expect(dist(s.p.agarre_c, s.p.cabeza)).toBeGreaterThan(RADIO_CABEZA + 2);
      // El centro de la cabeza, por delante del eje del brazo (grosor ~5): la cara queda libre.
      expect(s.p.cabeza.x - s.p.hombro.x).toBeGreaterThan(4.5);
    }
  });
  it('tronco recto y pies planos', () => {
    for (const { s } of m) {
      expect(Math.abs(ang(s.a.tronco - 90))).toBeLessThan(5);
      expect(Math.abs(planta(s, 'c').talon.y)).toBeLessThan(0.3);
    }
  });
});

describe('paseo del granjero', () => {
  const m = muestras(ej('paseo-granjero'));
  it('tronco vertical y brazos colgando quietos', () => {
    for (const { s } of m) {
      expect(s.a.tronco).toBeCloseTo(90, 6);
      expect(Math.abs(ang(s.a.brazo_c + 90))).toBeLessThan(1);
    }
  });
  it('siempre hay un pie plano en el suelo y el otro nunca lo atraviesa', () => {
    for (const { s } of m) {
      const apoyado = (['c', 'l'] as const).some((l) => {
        const p = planta(s, l);
        return Math.abs(p.talon.y) < 0.5 && Math.abs(p.punta.y) < 0.5;
      });
      expect(apoyado).toBe(true);
    }
  });
  it('las piernas se alternan', () => {
    const alto = (l: 'c' | 'l') => Math.max(...m.map(({ s }) => planta(s, l).talon.y));
    expect(alto('c')).toBeGreaterThan(5);
    expect(alto('l')).toBeGreaterThan(5);
  });
});
