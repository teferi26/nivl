// NIVL · IRON · Biomecánica del grupo PECHO (fase 2), medida sobre el
// esqueleto que dibuja el motor en todo el ciclo (cada 25 ms), como en
// biomecanica.test.ts: la interpolación tampoco puede romper la técnica.
import { centroCarga, esqueletoEn } from '../dibujo';
import { EJERCICIOS, ejercicioPorId } from '../ejercicios';
import { grosorPecho } from '../ejercicios/pecho/_geometria';
import { ALTO_PARALELA } from '../ejercicios/pecho/_familias';
import { dir, planta, type Esqueleto, type Punto } from '../esqueleto';
import { angulosEn } from '../interpolar';
import type { Ejercicio, Escenario } from '../tipos';

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

/** Distancia con signo de p a la recta (a, ángulo): positiva a la izquierda del sentido. */
function aRecta(p: Punto, a: Punto, grados: number): number {
  const d = dir(grados);
  return d.x * (p.y - a.y) - d.y * (p.x - a.x);
}

/** Distancia de p a la recta que pasa por a y b. */
function distanciaARecta(p: Punto, a: Punto, b: Punto): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / Math.hypot(dx, dy);
}

/** Dónde toca la mano el tronco: t (0 cadera, 1 hombro) y altura sobre el eje. */
function sobreTronco(s: Esqueleto, p: Punto): { t: number; fuera: number } {
  const d = dir(s.a.tronco);
  const rel = { x: p.x - s.p.cadera.x, y: p.y - s.p.cadera.y };
  const t = (rel.x * d.x + rel.y * d.y) / 30;
  // Hacia el pecho: la normal a la derecha del sentido cadera→hombro (tumbado boca arriba).
  return { t, fuera: d.y * rel.x - d.x * rel.y };
}

const PECHO = EJERCICIOS.filter((e) => e.grupo === 'pecho' && e.id !== 'press-banca');

const PRESS = [
  'press-inclinado-barra',
  'press-declinado-barra',
  'press-banca-cerrado',
  'press-suelo-barra',
  'press-banca-mancuerna',
  'press-inclinado-mancuerna',
  'press-declinado-mancuerna',
  'press-suelo-mancuerna',
  'press-squeeze-mancuerna',
];
const APERTURAS = ['aperturas-mancuerna', 'aperturas-inclinado-mancuerna', 'aperturas-declinado-mancuerna', 'aperturas-suelo-mancuerna'];
const FLEXIONES = [
  'flexiones',
  'flexiones-rodillas',
  'flexiones-inclinadas',
  'flexiones-declinadas',
  'flexiones-diamante',
  'flexiones-abiertas',
  'flexiones-pliometricas',
  'flexion-isometrica',
];

const escenarioDe = (e: Ejercicio, tipo: Escenario['tipo']) => e.escenario?.find((x) => x.tipo === tipo);

/** Recta de apoyo de la espalda de un banco inclinado o declinado: punto y ángulo (hacia la cabeza). */
function respaldo(e: Ejercicio): { p: Punto; a: number } | null {
  const b = e.escenario?.[0];
  if (b?.tipo === 'banco_inclinado') return { p: { x: b.x, y: b.alto }, a: 180 - b.angulo };
  if (b?.tipo === 'banco_declinado') return { p: { x: b.x, y: b.alto }, a: 180 + b.angulo };
  return null;
}

describe('pecho: catálogo', () => {
  it('unos 25 ejercicios de pecho, con press de banca incluido', () => {
    const ids = EJERCICIOS.filter((e) => e.grupo === 'pecho').map((e) => e.id);
    expect(ids.length).toBeGreaterThanOrEqual(24);
    expect(ids).toContain('press-banca');
  });

  it('todos los de pecho tienen 2 o 3 sustitutos de pecho', () => {
    for (const e of PECHO) {
      expect(e.sustitutos.length).toBeGreaterThanOrEqual(2);
      for (const s of e.sustitutos) expect(ej(s).grupo).toBe('pecho');
    }
  });

  it('el material dibujado está en la lista de material', () => {
    for (const e of PECHO) {
      for (const x of e.escenario ?? []) {
        const pide = x.tipo === 'pec_deck' ? 'maquina' : x.tipo;
        expect(e.material).toContain(pide);
      }
      if (e.carga?.tipo === 'pec_deck') expect(e.material).toContain('maquina');
    }
  });

  it('hay versión en casa: sin material o solo con mancuernas', () => {
    const casa = PECHO.filter((e) => e.material.every((m) => m === 'peso_corporal' || m === 'mancuerna'));
    expect(casa.length).toBeGreaterThanOrEqual(8);
  });

  it('el pectoral superior es el principal de los inclinados y de las flexiones declinadas', () => {
    for (const id of ['press-inclinado-barra', 'press-inclinado-mancuerna', 'aperturas-inclinado-mancuerna', 'flexiones-declinadas']) {
      expect(ej(id).musculos.principales[0]).toBe('pectoral_superior');
    }
  });
});

describe('pecho: nada tapa la cabeza', () => {
  it.each(PECHO.filter((e) => e.carga?.tipo === 'barra').map((e) => [e.id, e] as const))('%s: el disco no tapa la cabeza', (_id, e) => {
    if (e.carga?.tipo !== 'barra') return;
    const eje = e.carga.eje ?? { x: 0, y: 0 };
    const r = e.carga.disco ?? 12.6;
    for (const { s } of muestras(e)) {
      const b = centroCarga(s, e.carga, e.vista) as Punto;
      expect(dist({ x: b.x + eje.x, y: b.y + eje.y }, s.p.cabeza)).toBeGreaterThan(r + 6.2 - 1);
    }
  });
});

describe.each(PRESS.map((id) => [id, ej(id)] as const))('press %s', (id, e) => {
  const m = muestras(e);
  const suelo = id.includes('suelo');

  it('antebrazo vertical en todo el recorrido (±15°)', () => {
    for (const { s } of m) expect(Math.abs(ang(s.a.antebrazo_c) - 90)).toBeLessThan(15);
  });

  it('arriba la carga queda sobre los hombros, con los brazos casi estirados', () => {
    const s = esqueletoEn(e, 200);
    expect(Math.abs(s.p.agarre_c.x - s.p.hombro.x)).toBeLessThan(2);
    expect(s.p.agarre_c.y - s.p.hombro.y).toBeGreaterThan(30);
  });

  it(suelo ? 'abajo el codo toca el suelo y la carga queda sobre el pecho' : 'abajo la carga toca el pecho', () => {
    const s = esqueletoEn(e, 2750);
    const { t, fuera } = sobreTronco(s, s.p.agarre_c);
    if (suelo) {
      expect(s.p.codo_c.y).toBeLessThan(4.5);
      expect(s.p.codo_c.y).toBeGreaterThan(3);
      expect(fuera).toBeGreaterThan(grosorPecho(t));
      return;
    }
    expect(fuera - grosorPecho(t)).toBeGreaterThan(-1.5);
    expect(fuera - grosorPecho(t)).toBeLessThan(2.5);
    if (id.includes('inclinado')) {
      expect(t).toBeGreaterThan(0.8);
      expect(t).toBeLessThan(0.95);
    } else if (id.includes('declinado')) {
      expect(t).toBeGreaterThan(0.55);
      expect(t).toBeLessThan(0.75);
    } else {
      expect(t).toBeGreaterThan(0.6);
      expect(t).toBeLessThan(0.85);
    }
  });

  it('trayectoria en J: entre el punto del pecho y los hombros, sin pasarse', () => {
    const abajo = esqueletoEn(e, 2750).p.agarre_c.x;
    for (const { s } of m) {
      expect(s.p.agarre_c.x).toBeGreaterThan(s.p.hombro.x - 2);
      expect(s.p.agarre_c.x).toBeLessThan(abajo + 2);
    }
  });

  it('el tronco no se mueve y la cabeza se apoya', () => {
    const r = respaldo(e);
    for (const { s } of m) {
      expect(ang(s.a.tronco)).toBeCloseTo(ang(esqueletoEn(e, 0).a.tronco), 5);
      if (r) expect(Math.abs(aRecta(s.p.cabeza, r.p, r.a))).toBeCloseTo(6.2, 0);
      else if (suelo) expect(Math.abs(s.p.cabeza.y - 6.2)).toBeLessThan(0.8);
      else expect(Math.abs(s.p.cabeza.y - 6.2 - (e.escenario?.[0]?.alto ?? 0))).toBeLessThan(0.8);
    }
  });
});

describe('press: el apoyo de cada banco', () => {
  it('inclinado: tronco a 30° y pies planos', () => {
    for (const id of ['press-inclinado-barra', 'press-inclinado-mancuerna', 'aperturas-inclinado-mancuerna']) {
      const e = ej(id);
      for (const { s } of muestras(e)) {
        expect(ang(s.a.tronco)).toBeCloseTo(150, 5);
        expect(Math.abs(planta(s, 'c').talon.y)).toBeLessThan(0.3);
        expect(Math.abs(planta(s, 'c').punta.y)).toBeLessThan(0.3);
      }
    }
  });

  it('inclinado: glúteos en el asiento (la cadera a su radio del asiento)', () => {
    const e = ej('press-inclinado-barra');
    const b = escenarioDe(e, 'banco_inclinado');
    expect(esqueletoEn(e, 0).p.cadera.y - (b?.alto ?? 0)).toBeCloseTo(8.6, 1);
  });

  it('declinado: cabeza más baja que la cadera y pies enganchados bajo el rodillo', () => {
    for (const id of ['press-declinado-barra', 'press-declinado-mancuerna', 'aperturas-declinado-mancuerna']) {
      const e = ej(id);
      const b = escenarioDe(e, 'banco_declinado');
      if (b?.tipo !== 'banco_declinado') throw new Error('sin banco declinado');
      for (const { s } of muestras(e)) {
        expect(s.p.cabeza.y).toBeLessThan(s.p.cadera.y - 10);
        // El rodillo, delante del tobillo y a su lado (entre 4 y 9 del eje del tobillo).
        const d = dist(s.p.tobillo_c, b.rodillo);
        expect(d).toBeGreaterThan(4);
        expect(d).toBeLessThan(9);
        expect(b.rodillo.x).toBeGreaterThan(s.p.tobillo_c.x);
        // La rodillera, bajo el hueco de la rodilla: ni la atraviesa ni se separa.
        const r = dist(s.p.rodilla_c, b.rodillera);
        expect(r).toBeGreaterThan(b.rodillera.r + 3);
        expect(r).toBeLessThan(b.rodillera.r + 6.5);
      }
    }
  });

  it('plano y suelo: pies planos en el suelo', () => {
    for (const id of ['press-banca-cerrado', 'press-banca-mancuerna', 'press-squeeze-mancuerna', 'press-suelo-barra', 'press-suelo-mancuerna', 'aperturas-mancuerna', 'aperturas-suelo-mancuerna']) {
      for (const { s } of muestras(ej(id))) {
        expect(Math.abs(planta(s, 'c').talon.y)).toBeLessThan(0.3);
        expect(Math.abs(planta(s, 'c').punta.y)).toBeLessThan(0.3);
      }
    }
  });
});

describe.each(APERTURAS.map((id) => [id, ej(id)] as const))('aperturas %s', (id, e) => {
  const m = muestras(e);

  it('la mano baja en arco desde encima del hombro hasta el lado del pecho, sin tocar la cabeza', () => {
    const fondo = esqueletoEn(e, 2750);
    const t = sobreTronco(fondo, fondo.p.agarre_c).t;
    expect(t).toBeGreaterThan(0.72);
    expect(t).toBeLessThan(0.88);
    const x0 = Math.min(fondo.p.hombro.x, fondo.p.agarre_c.x) - 2;
    const x1 = Math.max(fondo.p.hombro.x, fondo.p.agarre_c.x) + 2;
    for (const { s } of m) {
      expect(s.p.agarre_c.x).toBeGreaterThan(x0);
      expect(s.p.agarre_c.x).toBeLessThan(x1);
      expect(dist(s.p.agarre_c, s.p.cabeza)).toBeGreaterThan(6.2 + 8);
    }
  });

  it('arriba brazos sobre los hombros; abajo, en cruz a la altura del pecho', () => {
    const arriba = esqueletoEn(e, 250);
    const abajo = esqueletoEn(e, 2750);
    expect(Math.abs(arriba.p.agarre_c.x - arriba.p.hombro.x)).toBeLessThan(2);
    expect(arriba.p.agarre_c.y - arriba.p.hombro.y).toBeGreaterThan(30);
    const { fuera } = sobreTronco(abajo, abajo.p.agarre_c);
    expect(fuera).toBeGreaterThan(0);
    expect(fuera).toBeLessThan(id.includes('suelo') ? 9 : 4);
  });

  it('codos un poco flexionados y fijos: el ángulo del codo no cambia', () => {
    const codos = m.map(({ ms }) => angulosEn(e, ms).cerca.codo);
    expect(Math.max(...codos) - Math.min(...codos)).toBeLessThan(0.01);
    expect(codos[0]).toBeGreaterThan(5);
    expect(codos[0]).toBeLessThan(25);
  });
});

describe.each(FLEXIONES.map((id) => [id, ej(id)] as const))('flexiones %s', (id, e) => {
  const m = muestras(e);
  const rodillas = id === 'flexiones-rodillas';
  const apoyoManos = id === 'flexiones-inclinadas' ? 24.6 : 0;
  const apoyoPies = id === 'flexiones-declinadas' ? 24.6 : 0;
  const mano0 = esqueletoEn(e, 0).p.agarre_c;
  // En la pliométrica las manos se despegan entre el empuje y la caída.
  const enElSuelo = (ms: number) => id !== 'flexiones-pliometricas' || ms < 1520 || ms > 2000;

  it('cuerpo recto: hombro, cadera y apoyo en línea (±1)', () => {
    for (const { s } of m) {
      const apoyo = rodillas ? s.p.rodilla_c : s.p.tobillo_c;
      expect(distanciaARecta(s.p.cadera, s.p.hombro, apoyo)).toBeLessThan(1);
    }
  });

  it('el apoyo no se mueve: puntas de los pies (o rodillas) quietas', () => {
    for (const { s } of m) {
      if (rodillas) expect(Math.abs(s.p.rodilla_c.y - 4)).toBeLessThan(0.1);
      else expect(Math.abs(planta(s, 'c').punta.y - apoyoPies)).toBeLessThan(0.3);
    }
  });

  it('las manos quedan fijas en el suelo (o en el banco) mientras empujan (±1,5)', () => {
    for (const { ms, s } of m) {
      if (!enElSuelo(ms)) continue;
      expect(dist(s.p.agarre_c, mano0)).toBeLessThan(1.5);
      expect(Math.abs(s.p.agarre_c.y - 2.4 - apoyoManos)).toBeLessThan(1.5);
    }
  });

  it('abajo el pecho a un palmo del apoyo; arriba los brazos casi estirados', () => {
    const hombros = m.map(({ s }) => s.p.hombro.y - apoyoManos);
    if (e.tipo === 'isometrico') {
      expect(Math.min(...hombros)).toBeGreaterThan(14);
      expect(Math.max(...hombros)).toBeLessThan(26);
      return;
    }
    expect(Math.min(...hombros)).toBeGreaterThan(11);
    expect(Math.min(...hombros)).toBeLessThan(14);
    expect(angulosEn(e, 200).cerca.codo).toBeLessThan(25);
  });

  it('abajo el antebrazo queda casi vertical (±20°) y el codo detrás de la mano', () => {
    if (e.tipo === 'isometrico') return;
    const s = esqueletoEn(e, id === 'flexiones-pliometricas' ? 1200 : 2150);
    expect(Math.abs(ang(s.a.antebrazo_c) + 90)).toBeLessThan(20);
    expect(s.p.codo_c.y).toBeGreaterThan(s.p.hombro.y);
  });

  it('cabeza neutra, en la línea del cuerpo', () => {
    for (let ms = 0; ms < e.cicloMs; ms += 25) expect(Math.abs(angulosEn(e, ms).cuello)).toBeLessThan(1);
  });
});

describe('flexiones: variantes', () => {
  const atras = (id: string) => {
    const e = ej(id);
    const s = esqueletoEn(e, 2150);
    return s.p.hombro.x - s.p.agarre_c.x;
  };

  it('diamante: manos más atrás (bajo el esternón) que en la normal; abiertas, más adelante', () => {
    expect(atras('flexiones-diamante')).toBeGreaterThan(atras('flexiones') + 2);
    expect(atras('flexiones-abiertas')).toBeLessThan(atras('flexiones'));
  });

  it('abiertas: el brazo se ve más corto (sale más del plano)', () => {
    const esc = (id: string) => angulosEn(ej(id), 2150).escorzo.brazo_c ?? 1;
    expect(esc('flexiones-abiertas')).toBeLessThan(esc('flexiones'));
  });

  it('pliométrica: las manos se despegan del suelo en el vuelo', () => {
    const s = esqueletoEn(ej('flexiones-pliometricas'), 1780);
    expect(s.p.agarre_c.y).toBeGreaterThan(2.4 + 3);
  });

  it('declinadas: la cabeza baja más que los pies', () => {
    const e = ej('flexiones-declinadas');
    const s = esqueletoEn(e, 2150);
    expect(s.p.hombro.y).toBeLessThan(s.p.cadera.y);
  });

  it('rodillas: las piernas dobladas hacia arriba (pies en el aire)', () => {
    for (const { s } of muestras(ej('flexiones-rodillas'))) expect(planta(s, 'c').punta.y).toBeGreaterThan(5);
  });
});

describe.each(['fondos-paralelas', 'fondos-negativos'].map((id) => [id, ej(id)] as const))('%s', (_id, e) => {
  const m = muestras(e);

  it('la mano no se mueve de la barra', () => {
    for (const { s } of m) expect(dist(s.p.agarre_c, { x: 0, y: ALTO_PARALELA })).toBeLessThan(0.05);
  });

  it('tronco inclinado hacia delante (entre 45 y 75°) para cargar el pecho', () => {
    for (const { s } of m) {
      expect(ang(s.a.tronco)).toBeGreaterThan(45);
      expect(ang(s.a.tronco)).toBeLessThan(75);
    }
  });

  it('abajo el brazo queda paralelo al suelo (±15°) con el codo detrás', () => {
    const s = esqueletoEn(e, e.msFicha ?? 0);
    expect(Math.abs(Math.abs(ang(s.a.brazo_c)) - 180)).toBeLessThan(15);
    expect(s.p.codo_c.x).toBeLessThan(s.p.hombro.x);
  });

  it('no baja de más: el hombro nunca pasa por debajo del codo', () => {
    for (const { s } of m) expect(s.p.hombro.y).toBeGreaterThan(s.p.codo_c.y - 1.5);
  });

  it('arriba los brazos casi estirados y los pies nunca tocan el suelo', () => {
    expect(angulosEn(e, 200).cerca.codo).toBeLessThan(25);
    for (const { s } of m) expect(Math.min(planta(s, 'c').punta.y, planta(s, 'c').talon.y)).toBeGreaterThan(5);
  });
});

describe('pec deck', () => {
  const e = ej('pec-deck');
  const m = muestras(e);

  it('el antebrazo sigue vertical todo el recorrido (±1°), contra la almohadilla', () => {
    for (const { s } of m) {
      expect(Math.abs(ang(s.a.antebrazo_c) - 90)).toBeLessThan(1);
      expect(Math.abs(ang(s.a.antebrazo_l) - 90)).toBeLessThan(1);
    }
  });

  it('el codo a la altura del hombro (brazo horizontal)', () => {
    // Al pasar por delante del hombro el brazo se ve de punta (escorzo mínimo)
    // y gira sin que se note: ahí basta con que no se separe más de su grosor.
    for (const { ms, s } of m) {
      const tope = (angulosEn(e, ms).escorzo.brazo_c ?? 1) >= 0.2 ? 0.01 : 1.5;
      expect(Math.abs(s.p.codo_c.y - s.p.hombro.y)).toBeLessThan(tope);
      expect(Math.abs(s.p.codo_l.y - s.p.hombro.y)).toBeLessThan(tope);
    }
  });

  it('abierto en cruz y cerrado con los codos juntos delante del pecho', () => {
    const abierto = esqueletoEn(e, 150);
    const cerrado = esqueletoEn(e, 1850);
    expect(abierto.p.codo_l.x - abierto.p.codo_c.x).toBeGreaterThan(55);
    expect(cerrado.p.codo_l.x - cerrado.p.codo_c.x).toBeLessThan(10);
    expect(cerrado.p.codo_l.x - cerrado.p.codo_c.x).toBeGreaterThan(4);
  });

  it('simétrico: los dos brazos a la misma distancia del centro', () => {
    for (const { s } of m) expect(Math.abs(s.p.codo_c.x + s.p.codo_l.x - 2 * s.p.hombro.x)).toBeLessThan(0.01);
  });

  it('sentado: pies planos y espalda vertical', () => {
    for (const { s } of m) {
      expect(Math.abs(s.p.tobillo_c.y - 4)).toBeLessThan(0.1);
      expect(ang(s.a.tronco)).toBeCloseTo(90, 5);
    }
  });
});
