// NIVL · IRON · Biomecánica del grupo ESPALDA (fase 2), medida sobre el
// esqueleto que dibuja el motor en todo el ciclo (cada 25 ms). Lo común a
// todos los ejercicios (suelo, ciclo cerrado, esquema y textos) ya lo miran
// biomecanica.test.ts y esquema.test.ts.
import { dir, planta, type Esqueleto, type Punto } from '../esqueleto';
import { centroCarga, dibujar, esqueletoEn, ranuras } from '../dibujo';
import { ejercicioPorId } from '../ejercicios';
import { ESPALDA } from '../ejercicios/espalda';
import { angulosEn } from '../interpolar';
import { enganche } from '../material/polea';
import { sustituto } from '../sustituir';
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
const dist = (a: Punto, b: Punto) => Math.hypot(a.x - b.x, a.y - b.y);
const medioPie = (s: Esqueleto) => {
  const p = planta(s, 'c');
  return (p.talon.x + p.punta.x) / 2;
};

/** Distancia de p al segmento ab. */
function aSegmento(p: Punto, a: Punto, b: Punto): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return dist(p, { x: a.x + dx * t, y: a.y + dy * t });
}

/** ¿El codo cercano está del lado de la espalda (a la izquierda del eje cadera→hombro)? */
function codoDetras(s: Esqueleto): number {
  const d = dir(s.a.tronco);
  const rel = { x: s.p.codo_c.x - s.p.cadera.x, y: s.p.codo_c.y - s.p.cadera.y };
  return d.x * rel.y - d.y * rel.x;
}

const RADIO_CABEZA = 6.2;

describe('catálogo de espalda', () => {
  it('unos 25 ejercicios, todos del grupo espalda y con su namespace', () => {
    expect(ESPALDA.length).toBeGreaterThanOrEqual(24);
    for (const e of ESPALDA) {
      expect(e.grupo).toBe('espalda');
      expect(e.nombre.startsWith('iron-espalda:')).toBe(true);
    }
  });

  it('incluye opciones sin gimnasio (peso corporal, mancuernas o barra fija)', () => {
    const casa = ESPALDA.filter((e) => e.material.every((m) => ['peso_corporal', 'mancuerna', 'barra_fija'].includes(m)));
    expect(casa.length).toBeGreaterThanOrEqual(8);
  });

  it('cada uno tiene al menos un sustituto escrito a mano', () => {
    for (const e of ESPALDA) expect(e.sustitutos.length).toBeGreaterThan(0);
  });

  it('«Sustituir» respeta el material: sin barra fija, la dominada pasa al jalón; en casa, al remo', () => {
    expect(sustituto('dominada')).toEqual({ ejercicio: ej('jalon-pecho'), motivo: 'elegido' });
    expect(sustituto('dominada', { material: ['mancuerna'] })?.ejercicio.grupo).toBe('espalda');
    expect(sustituto('peso-muerto', { material: ['mancuerna'] })?.ejercicio.id).toBe('peso-muerto-mancuernas');
  });
});

describe.each(ESPALDA.map((e) => [e.id, e] as const))('%s: material y cámara', (_id, e) => {
  const m = muestras(e);

  it('el disco de la barra no tapa la cabeza ni el torso', () => {
    if (e.carga?.tipo !== 'barra') return;
    const eje = e.carga.eje ?? { x: 0, y: 0 };
    const r = e.carga.disco ?? 12.6;
    for (const { s } of m) {
      const b = centroCarga(s, e.carga, e.vista) as Punto;
      const c = { x: b.x + eje.x, y: b.y + eje.y };
      expect(dist(c, s.p.cabeza)).toBeGreaterThan(r + RADIO_CABEZA - 1);
      // Del eje del tronco al disco: el radio del disco y casi todo el grosor del pecho.
      expect(aSegmento(c, s.p.cadera, s.p.hombro)).toBeGreaterThan(r + 4);
      // Y el disco no se mete en el suelo.
      expect(c.y - r).toBeGreaterThan(-0.6);
    }
  });

  it('el cable va del agarre a la polea en cada cuadro y no cruza la cabeza', () => {
    if (e.carga?.tipo !== 'polea') return;
    for (const { s } of m) {
      const v = enganche(s.p.agarre_c, e.carga.polea, e.carga.agarre);
      expect(aSegmento(s.p.cabeza, v, e.carga.polea)).toBeGreaterThan(RADIO_CABEZA + 0.5);
    }
  });

  it('el material se dibuja (escenario y carga) sin números rotos', () => {
    const r = ranuras(e.vista);
    const capas = dibujar(e, e.cicloMs / 2);
    const de = (clave: string) => capas[r.findIndex((x) => x.clave === clave)];
    if (e.escenario?.length) expect(`${de('ESC_FONDO')}${de('ESC_MEDIO')}`.length).toBeGreaterThan(0);
    if (e.carga) expect(de('CARGA_C').length).toBeGreaterThan(0);
  });
});

describe('dominadas', () => {
  const colgadas = ['dominada', 'dominada-supina', 'dominada-neutra', 'dominada-negativa', 'dominada-escapular'];

  it.each(colgadas)('%s: las manos no se mueven de la barra y el tronco no se balancea', (id) => {
    const e = ej(id);
    const barra = e.escenario?.[0] as { x: number; y: number };
    for (const { s } of muestras(e)) {
      expect(dist(s.p.agarre_c, barra)).toBeLessThan(0.01);
      expect(Math.abs(ang(s.a.tronco) - 90)).toBeLessThanOrEqual(20);
      // Nada por debajo de la cadera toca el suelo: está colgado.
      expect(planta(s, 'c').punta.y).toBeGreaterThan(4);
    }
  });

  it.each(['dominada', 'dominada-supina', 'dominada-neutra', 'dominada-negativa'])(
    '%s: arriba la barbilla pasa la barra con la cabeza detrás; abajo, brazos estirados',
    (id) => {
      const e = ej(id);
      const barra = e.escenario?.[0] as { x: number; y: number };
      const m = muestras(e);
      const arriba = m.reduce((a, b) => (b.s.p.hombro.y > a.s.p.hombro.y ? b : a)).s;
      expect(arriba.p.cabeza.y - 4).toBeGreaterThan(barra.y);
      expect(arriba.p.cabeza.x + RADIO_CABEZA).toBeLessThan(barra.x + 1);
      const codos = m.map(({ ms }) => angulosEn(e, ms).cerca.codo);
      expect(Math.min(...codos)).toBeLessThan(6);
      expect(Math.max(...codos)).toBeGreaterThan(90);
    },
  );

  it.each(['dominada', 'dominada-supina', 'dominada-neutra'])('%s: el antebrazo sigue casi vertical (±40°: a medio tirón el codo abierto sale del plano)', (id) => {
    for (const { s } of muestras(ej(id))) expect(Math.abs(ang(s.a.antebrazo_c) - 90)).toBeLessThan(40);
  });

  it('negativa: la bajada dura más del doble que la subida', () => {
    const e = ej('dominada-negativa');
    const bajada = e.esfuerzo[0].hasta - e.esfuerzo[0].desde;
    expect(bajada).toBeGreaterThanOrEqual(3000);
    expect(bajada).toBeGreaterThan(2 * (e.cicloMs - e.poses[4].ms));
  });

  it('escapular: los codos no se doblan y el cuerpo sube algo', () => {
    const e = ej('dominada-escapular');
    const m = muestras(e);
    for (const { ms } of m) expect(Math.abs(angulosEn(e, ms).cerca.codo)).toBeLessThan(8);
    const ys = m.map(({ s }) => s.p.hombro.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(2);
  });
});

describe('remo invertido', () => {
  const e = ej('remo-invertido');
  const barra = e.escenario?.[0] as { x: number; y: number };
  const m = muestras(e);

  it('cuerpo recto: hombro, cadera y tobillo en línea', () => {
    for (const { s } of m) expect(aSegmento(s.p.cadera, s.p.hombro, s.p.tobillo_c)).toBeLessThan(1);
  });

  it('las manos siguen en la barra y los talones en el suelo', () => {
    for (const { s } of m) {
      expect(dist(s.p.agarre_c, barra)).toBeLessThan(2.5);
      expect(Math.abs(planta(s, 'c').talon.y)).toBeLessThan(0.4);
    }
  });

  it('arriba el pecho llega a la barra; abajo los brazos están estirados', () => {
    const arriba = esqueletoEn(e, 1600);
    const pecho = { x: arriba.p.cadera.x, y: arriba.p.cadera.y };
    const d = dir(arriba.a.tronco);
    const t = { x: pecho.x + d.x * 23.4, y: pecho.y + d.y * 23.4 };
    expect(dist(t, barra)).toBeLessThan(11);
    expect(angulosEn(e, 200).cerca.codo).toBeLessThan(8);
  });
});

describe('jalones', () => {
  it.each(['jalon-pecho', 'jalon-supino', 'jalon-neutro'])('%s: tronco entre la vertical y 20° atrás, sin balanceo', (id) => {
    for (const { s } of muestras(ej(id))) {
      expect(ang(s.a.tronco)).toBeGreaterThanOrEqual(90);
      expect(ang(s.a.tronco)).toBeLessThanOrEqual(112);
    }
  });

  it.each(['jalon-pecho', 'jalon-supino', 'jalon-neutro'])(
    '%s: abajo la barra llega al pecho, delante de la cara; el antebrazo sigue al cable',
    (id) => {
      const e = ej(id);
      const abajo = esqueletoEn(e, 1550);
      expect(abajo.p.agarre_c.y).toBeLessThan(abajo.p.hombro.y + 2);
      expect(abajo.p.agarre_c.y).toBeGreaterThan(abajo.p.hombro.y - 12);
      expect(abajo.p.agarre_c.x).toBeGreaterThan(abajo.p.cabeza.x + RADIO_CABEZA);
      for (const { s } of muestras(e)) expect(Math.abs(ang(s.a.antebrazo_c) - 90)).toBeLessThan(45);
    },
  );

  it('los muslos quedan bajo el rodillo y los pies planos', () => {
    const e = ej('jalon-pecho');
    for (const { s } of muestras(e)) {
      expect(Math.abs(planta(s, 'c').talon.y)).toBeLessThan(0.4);
      expect(Math.abs(planta(s, 'c').punta.y)).toBeLessThan(0.4);
    }
  });
});

describe('remos', () => {
  it.each(['remo-barra', 'remo-barra-supino', 'remo-mancuernas'])('%s: tronco quieto y la carga abajo sobre el medio del pie', (id) => {
    const e = ej(id);
    const m = muestras(e);
    const troncos = m.map(({ s }) => ang(s.a.tronco));
    expect(Math.max(...troncos) - Math.min(...troncos)).toBeLessThan(0.01);
    const abajo = esqueletoEn(e, 200);
    expect(Math.abs(abajo.p.agarre_c.x - medioPie(abajo))).toBeLessThan(3);
    expect(Math.abs(ang(abajo.a.antebrazo_c) + 90)).toBeLessThan(5);
  });

  it.each(['remo-barra', 'remo-barra-supino', 'remo-mancuernas', 'remo-polea-sentado', 'remo-polea-abierto', 'remo-polea-una-mano', 'remo-maquina', 'remo-invertido'])(
    '%s: arriba el codo pasa la línea de la espalda',
    (id) => {
      const e = ej(id);
      const fin = e.esfuerzo[0].hasta;
      expect(codoDetras(esqueletoEn(e, fin + 100))).toBeGreaterThan(0);
    },
  );

  it('remo en polea sentado: el tronco se mueve poco (82° a 96°)', () => {
    for (const { s } of muestras(ej('remo-polea-sentado'))) {
      expect(ang(s.a.tronco)).toBeGreaterThanOrEqual(81.5);
      expect(ang(s.a.tronco)).toBeLessThanOrEqual(96.5);
    }
  });

  it('remo en máquina: la mano sigue el arco de la palanca', () => {
    const e = ej('remo-maquina');
    const c = e.carga;
    if (c?.tipo !== 'palanca') throw new Error('sin palanca');
    const radios = muestras(e).map(({ s }) => dist(s.p.agarre_c, c.pivote));
    expect(Math.max(...radios) - Math.min(...radios)).toBeLessThan(2);
  });

  it('face pull: al final los codos altos y las manos delante de la cara, sin taparla', () => {
    const e = ej('face-pull');
    const fin = esqueletoEn(e, 1600);
    expect(fin.p.codo_c.y).toBeGreaterThan(fin.p.hombro.y - 3);
    expect(fin.p.agarre_c.x).toBeGreaterThan(fin.p.cabeza.x + RADIO_CABEZA);
    const troncos = muestras(e).map(({ s }) => ang(s.a.tronco));
    expect(Math.max(...troncos) - Math.min(...troncos)).toBeLessThan(0.01);
  });
});

describe('pullovers', () => {
  it.each(['pullover-polea', 'pullover-mancuerna'])('%s: el codo no cambia, solo se mueve el hombro', (id) => {
    const e = ej(id);
    const codos = muestras(e).map(({ ms }) => angulosEn(e, ms).cerca.codo);
    expect(Math.max(...codos) - Math.min(...codos)).toBeLessThan(1);
    expect(Math.max(...codos)).toBeLessThanOrEqual(15);
    const hombros = muestras(e).map(({ ms }) => angulosEn(e, ms).cerca.hombro);
    expect(Math.max(...hombros) - Math.min(...hombros)).toBeGreaterThan(80);
  });

  it('pullover con mancuerna: la mancuerna no baja del banco y la cabeza sigue apoyada', () => {
    const e = ej('pullover-mancuerna');
    const banco = e.escenario?.[0] as { alto: number };
    for (const { s } of muestras(e)) {
      expect(s.p.agarre_c.y).toBeGreaterThan(banco.alto + 5);
      expect(Math.abs(s.p.cabeza.y - RADIO_CABEZA - banco.alto)).toBeLessThan(0.8);
    }
  });
});

describe('pesos muertos', () => {
  it.each(['peso-muerto', 'peso-muerto-sumo'])('%s: la barra sube y baja sobre el medio del pie (±3)', (id) => {
    const e = ej(id);
    for (const { s } of muestras(e)) expect(Math.abs(s.p.agarre_c.x - medioPie(s))).toBeLessThan(3);
  });

  it.each(['peso-muerto', 'peso-muerto-sumo'])('%s: sale del suelo con la cadera por encima de la rodilla y acaba de pie', (id) => {
    const e = ej(id);
    const suelo = esqueletoEn(e, 0);
    const barra = e.carga?.tipo === 'barra' ? (e.carga.disco ?? 12.6) : 0;
    expect(Math.abs(suelo.p.agarre_c.y - barra)).toBeLessThan(0.5);
    expect(suelo.p.cadera.y).toBeGreaterThan(suelo.p.rodilla_c.y);
    const arriba = esqueletoEn(e, e.esfuerzo[0].hasta + 100);
    expect(angulosEn(e, e.esfuerzo[0].hasta + 100).cerca.rodilla).toBeLessThan(5);
    expect(Math.abs(ang(arriba.a.tronco) - 90)).toBeLessThan(5);
  });

  it('con mancuernas: baja hasta media espinilla y sube a estar de pie', () => {
    const e = ej('peso-muerto-mancuernas');
    const ys = muestras(e).map(({ s }) => s.p.agarre_c.y);
    expect(Math.min(...ys)).toBeLessThan(21);
    expect(Math.max(...ys)).toBeGreaterThan(44);
  });

});

describe('zona lumbar', () => {
  it('hiperextensión: nunca pasa de la línea de las piernas y arriba queda recto', () => {
    const e = ej('hiperextension');
    for (const { ms } of muestras(e)) expect(angulosEn(e, ms).cerca.cadera).toBeGreaterThanOrEqual(-0.5);
    const arriba = esqueletoEn(e, 300);
    expect(aSegmento(arriba.p.cadera, arriba.p.hombro, arriba.p.tobillo_c)).toBeLessThan(1);
  });

  it('superman: elevación pequeña y la cadera apoyada', () => {
    const e = ej('superman');
    const m = muestras(e);
    for (const { s } of m) {
      expect(ang(s.a.tronco)).toBeLessThanOrEqual(18);
      expect(180 - ((s.a.muslo_c % 360) + 360) % 360).toBeLessThanOrEqual(15);
      expect(s.p.cadera).toEqual(m[0].s.p.cadera);
    }
  });
});
