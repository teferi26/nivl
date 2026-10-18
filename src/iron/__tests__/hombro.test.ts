// NIVL · IRON · Biomecánica del grupo HOMBRO (fase 2), medida sobre el
// esqueleto que dibuja el motor cada 25 ms de todo el ciclo. Las reglas
// comunes (suelo, ciclo cerrado, esquema y textos) ya las cubren
// esquema.test.ts y biomecanica.test.ts, que recorren todo el catálogo.
import { planta, type Esqueleto, type Punto } from '../esqueleto';
import { esqueletoEn } from '../dibujo';
import { ejercicioPorId } from '../ejercicios';
import { EJERCICIOS_HOMBRO } from '../ejercicios/hombro';
import { angulosEn } from '../interpolar';
import { FORMAS_FRONTAL, FORMAS_LATERAL } from '../musculos';
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

/** Ángulo normalizado a [0, 360). */
const a360 = (a: number) => ((a % 360) + 360) % 360;
/** Diferencia angular mínima, en grados. */
const dif = (a: number, b: number) => {
  const d = Math.abs(a360(a) - a360(b));
  return Math.min(d, 360 - d);
};
const dist = (p: Punto, q: Punto) => Math.hypot(p.x - q.x, p.y - q.y);
const medioPie = (s: Esqueleto) => {
  const p = planta(s, 'c');
  return (p.talon.x + p.punta.x) / 2;
};
const RADIO_CABEZA = 6.2;

describe('catálogo de hombro', () => {
  it('unos 25 ejercicios, todos registrados en el catálogo general', () => {
    // Integración: los encogimientos (trapecio) pasaron a la carpeta de espalda.
    expect(EJERCICIOS_HOMBRO.length).toBeGreaterThanOrEqual(23);
    for (const e of EJERCICIOS_HOMBRO) expect(ejercicioPorId(e.id)).toBe(e);
  });

  it('textos en el namespace iron-hombro', () => {
    for (const e of EJERCICIOS_HOMBRO) {
      for (const c of [e.nombre, ...e.cues, ...e.errores]) expect(c.startsWith(`iron-hombro:ejercicios.${e.id}.`)).toBe(true);
    }
  });

  it('cada ejercicio de hombro tiene al menos un sustituto escrito', () => {
    for (const e of EJERCICIOS_HOMBRO) expect(e.sustitutos.length).toBeGreaterThan(0);
  });

  it('las elevaciones laterales van en vista frontal (de perfil no se ven)', () => {
    for (const id of ['elevaciones-laterales', 'elevaciones-laterales-sentado', 'elevacion-lateral-banda']) expect(ej(id).vista).toBe('frontal');
  });

  it('el músculo nuevo (manguito rotador) tiene forma lateral y por detrás', () => {
    expect(FORMAS_LATERAL.manguito_rotador.length).toBeGreaterThan(0);
    expect(FORMAS_FRONTAL.manguito_rotador.some((f) => f.cara === 'post')).toBe(true);
  });

  it('los que miran el músculo por detrás usan cara post', () => {
    for (const e of EJERCICIOS_HOMBRO) {
      const deDetras = ['deltoides_posterior', 'manguito_rotador'].includes(e.musculos.principales[0]);
      if (e.vista === 'frontal' && deDetras) expect(e.cara).toBe('post');
    }
  });
});

describe('press militar con barra', () => {
  const e = ej('press-militar-barra');
  it('antebrazo vertical bajo la barra (±15°) todo el recorrido', () => {
    for (const { s } of muestras(e)) expect(dif(s.a.antebrazo_c, 90)).toBeLessThanOrEqual(15);
  });
  it('bloqueo: barra sobre el medio del pie (±2) y brazos estirados', () => {
    const arriba = muestras(e).reduce((m, x) => (x.s.p.agarre_c.y > m.s.p.agarre_c.y ? x : m));
    expect(Math.abs(arriba.s.p.agarre_c.x - medioPie(arriba.s))).toBeLessThanOrEqual(2);
    expect(angulosEn(e, arriba.ms).cerca.codo).toBeLessThanOrEqual(15);
  });
  it('la barra libra la cara: la cabeza se aparta al pasar', () => {
    for (const { s } of muestras(e)) expect(dist(s.p.agarre_c, s.p.cabeza)).toBeGreaterThan(RADIO_CABEZA + 2);
  });
  it('la barra sube casi recta: se desvía menos de 5 en horizontal', () => {
    const xs = muestras(e).map(({ s }) => s.p.agarre_c.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(5);
  });
});

describe('push press', () => {
  const e = ej('push-press');
  it('tronco vertical (±4°) en el impulso y talones en el suelo', () => {
    for (const { s } of muestras(e)) {
      expect(dif(s.a.tronco, 90)).toBeLessThanOrEqual(4);
      expect(Math.abs(planta(s, 'c').talon.y)).toBeLessThan(0.6);
    }
  });
  it('impulso corto: rodilla ≤ 45° y de verdad flexiona (≥ 30°)', () => {
    const rodillas = muestras(e).map(({ ms }) => angulosEn(e, ms).cerca.rodilla);
    expect(Math.max(...rodillas)).toBeLessThanOrEqual(45);
    expect(Math.max(...rodillas)).toBeGreaterThanOrEqual(30);
  });
  it('antebrazo vertical (±15°) y bloqueo sobre el medio del pie (±2)', () => {
    const m = muestras(e);
    for (const { s } of m) expect(dif(s.a.antebrazo_c, 90)).toBeLessThanOrEqual(15);
    const arriba = m.reduce((a, x) => (x.s.p.agarre_c.y > a.s.p.agarre_c.y ? x : a));
    expect(Math.abs(arriba.s.p.agarre_c.x - medioPie(arriba.s))).toBeLessThanOrEqual(2);
  });
});

describe.each(['press-militar-mancuerna', 'press-mancuerna-sentado', 'press-banda'])('%s (vista frontal)', (id) => {
  const e = ej(id);
  it('antebrazos verticales (±12°) en los dos lados', () => {
    for (const { s } of muestras(e)) {
      expect(dif(s.a.antebrazo_c, 90)).toBeLessThanOrEqual(12);
      expect(dif(s.a.antebrazo_l, 90)).toBeLessThanOrEqual(12);
    }
  });
  it('las manos van por fuera de la cabeza y arriba quedan sobre ella', () => {
    const m = muestras(e);
    for (const { s } of m) {
      expect(Math.abs(s.p.agarre_c.x - s.p.cabeza.x)).toBeGreaterThan(RADIO_CABEZA + 6);
      expect(Math.abs(s.p.agarre_l.x - s.p.cabeza.x)).toBeGreaterThan(RADIO_CABEZA + 6);
    }
    expect(Math.max(...m.map(({ s }) => s.p.agarre_c.y - s.p.cabeza.y))).toBeGreaterThan(20);
  });
});

describe('press Arnold', () => {
  const e = ej('press-arnold');
  it('antebrazo vertical (±15°) y codos delante del tronco al empezar', () => {
    const m = muestras(e);
    for (const { s } of m) expect(dif(s.a.antebrazo_c, 90)).toBeLessThanOrEqual(15);
    const s0 = m[0].s;
    expect(s0.p.codo_c.x).toBeGreaterThan(s0.p.hombro.x + 4);
    expect((angulosEn(e, 0).escorzo.brazo_c ?? 1) >= 0.85).toBe(true);
  });
  it('bloqueo sobre el hombro con el brazo casi estirado', () => {
    const arriba = muestras(e).reduce((a, x) => (x.s.p.agarre_c.y > a.s.p.agarre_c.y ? x : a));
    expect(Math.abs(arriba.s.p.agarre_c.x - arriba.s.p.hombro.x)).toBeLessThan(5);
    expect(angulosEn(e, arriba.ms).cerca.codo).toBeLessThanOrEqual(15);
  });
});

describe.each(['elevaciones-laterales', 'elevaciones-laterales-sentado', 'elevacion-lateral-banda'])('%s', (id) => {
  const e = ej(id);
  it('abducción de ~10° a la altura del hombro, sin pasarla (≤ 90°)', () => {
    const h = muestras(e).map(({ ms }) => angulosEn(e, ms).cerca.hombro);
    expect(Math.min(...h)).toBeLessThanOrEqual(15);
    expect(Math.max(...h)).toBeGreaterThanOrEqual(80);
    expect(Math.max(...h)).toBeLessThanOrEqual(90);
  });
  it('codo casi estirado (≤ 15°) y tronco quieto', () => {
    const m = muestras(e);
    for (const { ms, s } of m) {
      expect(Math.abs(angulosEn(e, ms).cerca.codo)).toBeLessThanOrEqual(15);
      expect(dist(s.p.hombro, m[0].s.p.hombro)).toBeLessThan(0.01);
    }
  });
  it('arriba, la mano no sube por encima del hombro', () => {
    for (const { s } of muestras(e)) expect(s.p.agarre_l.y).toBeLessThanOrEqual(s.p.hombro.y + 2);
  });
});

describe.each(['elevaciones-frontales', 'elevacion-frontal-barra', 'elevacion-frontal-banda'])('%s', (id) => {
  const e = ej(id);
  it('flexión de hombro hasta 90° como mucho y codo casi estirado', () => {
    for (const { ms } of muestras(e)) {
      const a = angulosEn(e, ms).cerca;
      expect(a.hombro).toBeLessThanOrEqual(90);
      expect(a.codo).toBeLessThanOrEqual(15);
    }
  });
  it('arriba, la mano a la altura del hombro (±4) y tronco quieto', () => {
    const m = muestras(e);
    const arriba = m.reduce((a, x) => (x.s.p.agarre_c.y > a.s.p.agarre_c.y ? x : a));
    expect(Math.abs(arriba.s.p.agarre_c.y - arriba.s.p.hombro.y)).toBeLessThanOrEqual(4);
    for (const { s } of m) expect(dif(s.a.tronco, m[0].s.a.tronco)).toBeLessThan(0.01);
  });
});

describe.each(['remo-menton-barra', 'remo-menton-mancuerna', 'remo-menton-banda'])('%s', (id) => {
  const e = ej(id);
  it('las manos suben en vertical, al ancho de los hombros (|x| = 13 ± 1,5)', () => {
    for (const { s } of muestras(e)) {
      expect(Math.abs(Math.abs(s.p.agarre_c.x) - 13)).toBeLessThanOrEqual(1.5);
      expect(Math.abs(Math.abs(s.p.agarre_l.x) - 13)).toBeLessThanOrEqual(1.5);
    }
  });
  it('codos por encima de las manos y como mucho a la altura del hombro', () => {
    for (const { s } of muestras(e)) {
      if (s.p.agarre_l.y > 52) expect(s.p.codo_l.y).toBeGreaterThan(s.p.agarre_l.y);
      expect(s.p.codo_l.y).toBeLessThanOrEqual(s.p.hombro.y + 0.5);
    }
  });
  it('arriba, las manos a la altura de la parte baja del pecho (no al mentón)', () => {
    const maxY = Math.max(...muestras(e).map(({ s }) => s.p.agarre_l.y));
    expect(maxY).toBeGreaterThan(70);
    expect(maxY).toBeLessThan(76);
  });
});

describe.each(['encogimientos-barra', 'encogimientos-mancuerna'])('%s', (id) => {
  const e = ej(id);
  it('los hombros suben (≥ 2) y la cabeza no se mueve', () => {
    const m = muestras(e);
    const ys = m.map(({ s }) => s.p.hombro.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(2);
    for (const { s } of m) expect(dist(s.p.cabeza, m[0].s.p.cabeza)).toBeLessThan(0.15);
  });
  it('brazos estirados (codo ≤ 5°): las manos suben lo mismo que los hombros', () => {
    for (const { ms, s } of muestras(e)) {
      expect(angulosEn(e, ms).cerca.codo).toBeLessThanOrEqual(5);
      expect(s.p.hombro.y - s.p.agarre_c.y).toBeGreaterThan(36);
    }
  });
});

describe.each(['rotacion-externa-banda', 'rotacion-interna-banda'])('%s', (id) => {
  const e = ej(id);
  it('el codo no se mueve del costado (abducción ≤ 10°)', () => {
    const m = muestras(e);
    for (const { ms, s } of m) {
      expect(angulosEn(e, ms).cerca.hombro).toBeLessThanOrEqual(10);
      expect(dist(s.p.codo_c, m[0].s.p.codo_c)).toBeLessThan(0.01);
    }
  });
  it('el antebrazo va horizontal (±10°) cuando se ve (escorzo ≥ 0,5)', () => {
    for (const { ms, s } of muestras(e)) {
      if ((angulosEn(e, ms).escorzo.antebrazo_c ?? 1) < 0.5) continue;
      const a = a360(s.a.antebrazo_c);
      expect(Math.min(dif(a, 0), dif(a, 180))).toBeLessThanOrEqual(10);
    }
  });
  it('recorrido completo: de dentro (mano hacia el ombligo) a fuera', () => {
    const xs = muestras(e).map(({ s }) => s.p.agarre_c.x - s.p.codo_c.x);
    expect(Math.max(...xs)).toBeGreaterThan(8);
    expect(Math.min(...xs)).toBeLessThan(-15);
  });
});

describe('rotación externa a 90°', () => {
  const e = ej('rotacion-externa-90-banda');
  it('el codo no se mueve y el antebrazo va de horizontal a vertical sin pasarse', () => {
    const m = muestras(e);
    const angs = m.map(({ s }) => a360(s.a.antebrazo_c + 180) - 180);
    for (const { s } of m) expect(dist(s.p.codo_c, m[0].s.p.codo_c)).toBeLessThan(0.01);
    expect(Math.min(...angs)).toBeGreaterThanOrEqual(-10);
    expect(Math.min(...angs)).toBeLessThanOrEqual(10);
    expect(Math.max(...angs)).toBeGreaterThanOrEqual(80);
    expect(Math.max(...angs)).toBeLessThanOrEqual(100);
  });
  it('el antebrazo no tapa la cara (va por delante de la cabeza)', () => {
    for (const { s } of muestras(e)) expect(s.p.codo_c.x - 4).toBeGreaterThan(s.p.cabeza.x + RADIO_CABEZA);
  });
});

describe('tirón separando la banda', () => {
  const e = ej('tiron-banda');
  it('manos a la altura de los hombros (±3) y codos estirados', () => {
    for (const { ms, s } of muestras(e)) {
      expect(Math.abs(s.p.agarre_c.y - s.p.hombro.y)).toBeLessThanOrEqual(3);
      expect(angulosEn(e, ms).cerca.codo).toBe(0);
    }
  });
  it('abre hasta la cruz: escorzo de casi 0 delante a 1', () => {
    const v = muestras(e).map(({ ms }) => angulosEn(e, ms).escorzo.brazo_c ?? 1);
    expect(Math.min(...v)).toBeLessThan(0.3);
    expect(Math.max(...v)).toBeGreaterThan(0.95);
  });
});

describe('face pull con banda', () => {
  const e = ej('face-pull-banda');
  it('al final: «portería», antebrazos verticales (±12°), manos a la altura de la cabeza', () => {
    const s = esqueletoEn(e, e.msFicha ?? 0);
    expect(dif(s.a.antebrazo_c, 90)).toBeLessThanOrEqual(12);
    expect(dif(s.a.antebrazo_l, 90)).toBeLessThanOrEqual(12);
    expect(s.p.agarre_l.y).toBeGreaterThan(s.p.cabeza.y - 4);
    expect(s.p.codo_l.y).toBeLessThan(s.p.agarre_l.y);
  });
  it('codos altos: abducción entre 75° y 95° todo el recorrido', () => {
    for (const { ms } of muestras(e)) {
      const h = angulosEn(e, ms).cerca.hombro;
      expect(h).toBeGreaterThanOrEqual(75);
      expect(h).toBeLessThanOrEqual(95);
    }
  });
});

describe('pájaro con mancuernas', () => {
  const e = ej('pajaro-mancuerna');
  it('abanico hasta la altura de la espalda (≤ 90°) con codos casi estirados (≤ 20°)', () => {
    const m = muestras(e);
    for (const { ms } of m) {
      const a = angulosEn(e, ms).cerca;
      expect(a.hombro).toBeLessThanOrEqual(90);
      expect(a.codo).toBeLessThanOrEqual(20);
    }
    expect(Math.max(...m.map(({ ms }) => angulosEn(e, ms).cerca.hombro))).toBeGreaterThanOrEqual(80);
  });
  it('el tronco no se levanta: hombros quietos todo el ciclo', () => {
    const m = muestras(e);
    for (const { s } of m) expect(dist(s.p.hombro, m[0].s.p.hombro)).toBeLessThan(0.01);
  });
});

describe.each([
  ['flexion-pica', 44],
  ['flexion-pica-pies-elevados', 50],
] as const)('%s', (id, caderaMin) => {
  const e = ej(id);
  it('manos y pies quietos (±0,8) todo el recorrido', () => {
    const m = muestras(e);
    for (const { s } of m) {
      expect(dist(s.p.agarre_c, m[0].s.p.agarre_c)).toBeLessThan(0.01);
      expect(dist(s.p.tobillo_c, m[0].s.p.tobillo_c)).toBeLessThan(0.8);
    }
  });
  it(`cadera alta (≥ ${caderaMin}) todo el recorrido`, () => {
    for (const { s } of muestras(e)) expect(s.p.cadera.y).toBeGreaterThanOrEqual(caderaMin);
  });
  it('la cabeza baja por delante de las manos sin tocar el suelo', () => {
    const m = muestras(e);
    const abajo = m.reduce((a, x) => (x.s.p.cabeza.y < a.s.p.cabeza.y ? x : a));
    expect(abajo.s.p.cabeza.x).toBeGreaterThan(abajo.s.p.agarre_c.x);
    for (const { s } of m) expect(s.p.cabeza.y).toBeGreaterThan(RADIO_CABEZA + 1);
    expect(abajo.s.p.cabeza.y).toBeLessThan(RADIO_CABEZA + 10);
  });
  it('arriba, brazos casi estirados (codo ≤ 10°)', () => {
    expect(angulosEn(e, 0).cerca.codo).toBeLessThanOrEqual(10);
  });
});
