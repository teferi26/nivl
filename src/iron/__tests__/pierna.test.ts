// NIVL · IRON · Biomecánica del catálogo de PIERNA y GLÚTEO (fase 2), medida
// sobre el esqueleto que dibuja el motor en todo el ciclo (cada 25 ms), no
// solo en las poses clave. Las reglas generales (nada atraviesa el suelo, el
// ciclo cierra sin salto, el esquema) están en biomecanica.test.ts y
// esquema.test.ts, que ya recorren estos ejercicios.
import { dir, LARGO, planta, puntoEnSegmento, type Esqueleto, type Punto } from '../esqueleto';
import { centroCarga, dibujar, esqueletoEn, ranuras } from '../dibujo';
import { EJERCICIOS, ejercicioPorId } from '../ejercicios';
import { EJERCICIOS_PIERNA } from '../ejercicios/pierna';
import { angulosEn } from '../interpolar';
import { almohadilla } from '../material/abductora';
import { rodilloPalanca } from '../material/palanca';
import { RESPALDO_PRENSA } from '../material/prensa';
import { GRUPO_DE_MUSCULO } from '../musculos';
import type { Ejercicio, Escenario } from '../tipos';

const ej = (id: string): Ejercicio => {
  const e = ejercicioPorId(id);
  if (!e) throw new Error(id);
  return e;
};

function muestras(e: Ejercicio, desde = 0, hasta = e.cicloMs): { ms: number; s: Esqueleto }[] {
  const out: { ms: number; s: Esqueleto }[] = [];
  for (let ms = desde; ms < hasta; ms += 25) out.push({ ms, s: esqueletoEn(e, ms) });
  return out;
}

/** Ángulo normalizado a (-180, 180]. */
const ang = (a: number) => {
  const r = ((a % 360) + 360) % 360;
  return r > 180 ? r - 360 : r;
};
const dist = (a: Punto, b: Punto) => Math.hypot(a.x - b.x, a.y - b.y);
const medioPie = (s: Esqueleto) => {
  const p = planta(s, 'c');
  return (p.talon.x + p.punta.x) / 2;
};
const escenario = (e: Ejercicio, tipo: Escenario['tipo']): Escenario => {
  const b = e.escenario?.find((x) => x.tipo === tipo);
  if (!b) throw new Error(`${e.id} sin ${tipo}`);
  return b;
};

function piesPlanos(e: Ejercicio, lado: 'c' | 'l' = 'c', suelo = 0) {
  for (const { s } of muestras(e)) {
    const p = planta(s, lado);
    expect(Math.abs(p.talon.y - suelo)).toBeLessThan(0.3);
    expect(Math.abs(p.punta.y - suelo)).toBeLessThan(0.3);
  }
}

/** Distancia de p al segmento a-b. */
function aSegmento(p: Punto, a: Punto, b: Punto): { d: number; t: number } {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy)));
  return { d: Math.hypot(p.x - a.x - vx * t, p.y - a.y - vy * t), t };
}

/** Holgura entre un punto y la cara delantera de la pierna cercana (muslo y espinilla). */
function holguraPierna(p: Punto, s: Esqueleto): number {
  const m = aSegmento(p, s.p.cadera, s.p.rodilla_c);
  const q = aSegmento(p, s.p.rodilla_c, s.p.tobillo_c);
  return Math.min(m.d - (7.2 + (4 - 7.2) * m.t), q.d - (4 + (2.2 - 4) * q.t));
}

/** El punto de apoyo de la espalda alta: tronco a 0,8 de su largo y 7,4 por detrás del eje. */
const apoyoEspalda = (s: Esqueleto) => {
  const d = dir(s.a.tronco);
  const atras = { x: -d.y, y: d.x };
  const q = puntoEnSegmento(s, 'tronco', 0.8);
  return { x: q.x + atras.x * 7.4 * (d.x < 0 ? 1 : -1), y: q.y + atras.y * 7.4 * (d.x < 0 ? 1 : -1) };
};

describe('catálogo de pierna', () => {
  it('unos 25 ejercicios, todos del grupo pierna y registrados en el catálogo', () => {
    expect(EJERCICIOS_PIERNA.length).toBeGreaterThanOrEqual(24);
    for (const e of EJERCICIOS_PIERNA) {
      expect(e.grupo).toBe('pierna');
      expect(GRUPO_DE_MUSCULO[e.musculos.principales[0]]).toBe('pierna');
      expect(EJERCICIOS).toContain(e);
      expect(e.nombre.startsWith('iron-pierna:')).toBe(true);
    }
  });

  it('no duplica la sentadilla con barra del prototipo', () => {
    expect(EJERCICIOS_PIERNA.map((e) => e.id)).not.toContain('sentadilla-barra');
  });

  it('hay opciones de casa y sin material', () => {
    const casa = EJERCICIOS_PIERNA.filter((e) => e.material.every((m) => m === 'peso_corporal'));
    expect(casa.length).toBeGreaterThanOrEqual(6);
  });

  it('cada sustituto es de pierna (sustitutos cruzados dentro del grupo)', () => {
    for (const e of EJERCICIOS_PIERNA) {
      expect(e.sustitutos.length).toBeGreaterThan(0);
      for (const id of e.sustitutos) expect(ej(id).grupo).toBe('pierna');
    }
  });

  it('los músculos nuevos (sóleo, glúteo medio, psoas) trabajan en algún ejercicio y se pintan', () => {
    const usados = new Set(EJERCICIOS_PIERNA.flatMap((e) => [...e.musculos.principales, ...e.musculos.secundarios]));
    for (const m of ['soleo', 'gluteo_medio', 'psoas', 'tibial'] as const) expect(usados).toContain(m);
    // El principal de la abducción y de los gemelos sentado se ve en la capa del acento.
    for (const id of ['abduccion-tumbado', 'abduccion-maquina', 'gemelos-sentado', 'elevacion-tibial']) {
      const e = ej(id);
      const r = ranuras(e.vista);
      const capas = dibujar(e, e.msFicha ?? 0);
      expect(r.some((x, i) => x.estilo === 'principal' && capas[i].length > 0)).toBe(true);
    }
  });
});

describe('sentadilla frontal', () => {
  const e = ej('sentadilla-frontal');
  const m = muestras(e);

  it('la barra va sobre el medio del pie (±2) y delante del cuello', () => {
    for (const { s } of m) {
      const b = centroCarga(s, e.carga, e.vista) as Punto;
      expect(Math.abs(b.x - medioPie(s))).toBeLessThan(2);
      expect(b.x).toBeGreaterThan(s.p.hombro.x);
    }
  });

  it('pies planos y profundidad: abajo la cadera pasa la rodilla', () => {
    piesPlanos(e);
    const abajo = esqueletoEn(e, 2750);
    expect(abajo.p.cadera.y).toBeLessThan(abajo.p.rodilla_c.y);
  });

  it('tronco más vertical que en la sentadilla trasera (≥ 60°)', () => {
    for (const { s } of m) expect(ang(s.a.tronco)).toBeGreaterThanOrEqual(60);
  });

  it('codos altos: el codo queda delante del hombro', () => {
    for (const { s } of m) expect(s.p.codo_c.x).toBeGreaterThan(s.p.hombro.x + 4);
  });

  it('el disco no tapa la cabeza', () => {
    for (const { s } of m) {
      const b = centroCarga(s, e.carga, e.vista) as Punto;
      const c = e.carga?.tipo === 'barra' ? e.carga : null;
      const d = { x: b.x + (c?.eje?.x ?? 0), y: b.y + (c?.eje?.y ?? 0) };
      expect(dist(d, s.p.cabeza)).toBeGreaterThan((c?.disco ?? 12.6) + 6.2 - 1);
    }
  });

  it('los seguros del rack quedan por debajo del punto más bajo de la barra', () => {
    const rack = escenario(e, 'rack');
    const minY = Math.min(...m.map(({ s }) => (centroCarga(s, e.carga, e.vista) as Punto).y));
    expect(rack.seguro ?? 0).toBeLessThan(minY - 3);
  });
});

describe('sentadilla goblet', () => {
  const e = ej('sentadilla-goblet');
  const m = muestras(e);

  it('la kettlebell sube y baja sobre el medio del pie (±3)', () => {
    for (const { s } of m) expect(Math.abs((centroCarga(s, e.carga, e.vista) as Punto).x - medioPie(s))).toBeLessThan(3);
  });

  it('la kettlebell va pegada al pecho (las manos a menos de 14 del eje del tronco)', () => {
    for (const { s } of m) expect(aSegmento(s.p.agarre_c, s.p.cadera, s.p.hombro).d).toBeLessThan(14);
  });

  it('pies planos y abajo la cadera pasa la rodilla', () => {
    piesPlanos(e);
    const abajo = esqueletoEn(e, 2750);
    expect(abajo.p.cadera.y).toBeLessThan(abajo.p.rodilla_c.y);
  });
});

describe('sentadilla sin peso', () => {
  const e = ej('sentadilla-peso-corporal');

  it('pies planos y abajo la cadera pasa la rodilla', () => {
    piesPlanos(e);
    const abajo = esqueletoEn(e, 2400);
    expect(abajo.p.cadera.y).toBeLessThan(abajo.p.rodilla_c.y);
  });

  it('los hombros quedan sobre el pie y los brazos horizontales (±5°)', () => {
    for (const { s } of muestras(e)) {
      const p = planta(s, 'c');
      expect(s.p.hombro.x).toBeGreaterThan(p.talon.x);
      expect(s.p.hombro.x).toBeLessThan(p.punta.x + 4);
      expect(Math.abs(ang(s.a.brazo_c))).toBeLessThan(5);
    }
  });
});

describe('sentadilla al cajón', () => {
  const e = ej('sentadilla-cajon');
  const caja = escenario(e, 'cajon');

  it('pies planos y espinillas más verticales que en la sentadilla libre (tobillo ≤ 32°)', () => {
    piesPlanos(e);
    for (let ms = 0; ms < e.cicloMs; ms += 25) expect(angulosEn(e, ms).cerca.tobillo).toBeLessThanOrEqual(32);
  });

  it('abajo los glúteos tocan el cajón sin atravesarlo', () => {
    const alturas = muestras(e).map(({ s }) => s.p.cadera.y - caja.alto);
    expect(Math.min(...alturas)).toBeGreaterThan(6);
    expect(Math.min(...alturas)).toBeLessThan(9);
    const abajo = esqueletoEn(e, 2500);
    expect(abajo.p.cadera.x).toBeGreaterThan(caja.x);
    expect(abajo.p.cadera.x).toBeLessThan(caja.x + caja.ancho);
  });
});

/** Pie de atrás de puntillas (o con los dedos en el banco): la planta bajo la punta no se mueve. */
function puntaQuieta(e: Ejercicio, desde: number, hasta: number) {
  const ref = planta(esqueletoEn(e, desde), 'l').punta;
  for (const { s } of muestras(e, desde, hasta)) expect(dist(planta(s, 'l').punta, ref)).toBeLessThan(1.5);
}

describe('sentadilla búlgara', () => {
  const e = ej('sentadilla-bulgara');

  it('pie de delante plano; los dedos de atrás no se mueven del banco', () => {
    piesPlanos(e);
    puntaQuieta(e, 0, e.cicloMs);
    const banco = escenario(e, 'banco');
    expect(Math.abs(planta(esqueletoEn(e, 0), 'l').punta.y - banco.alto)).toBeLessThan(0.6);
  });

  it('abajo la rodilla de atrás cerca del suelo y la de delante sin pasar la punta más de 3', () => {
    const abajo = esqueletoEn(e, 2300);
    expect(abajo.p.rodilla_l.y).toBeLessThan(12);
    for (const { s } of muestras(e)) expect(s.p.rodilla_c.x).toBeLessThan(planta(s, 'c').punta.x + 3);
  });

  it('brazos colgando en vertical (±10°)', () => {
    for (const { s } of muestras(e)) expect(Math.abs(ang(s.a.brazo_c) + 90)).toBeLessThan(10);
  });
});

describe('zancada estática', () => {
  const e = ej('zancada-estatica');

  it('pie de delante plano y la punta del de atrás quieta en el suelo', () => {
    piesPlanos(e);
    puntaQuieta(e, 0, e.cicloMs);
    expect(Math.abs(planta(esqueletoEn(e, 0), 'l').punta.y)).toBeLessThan(0.5);
  });

  it('abajo la rodilla de atrás cerca del suelo y bajo la cadera; tronco casi vertical', () => {
    const abajo = esqueletoEn(e, 2100);
    expect(abajo.p.rodilla_l.y).toBeLessThan(12);
    expect(Math.abs(abajo.p.rodilla_l.x - abajo.p.cadera.x)).toBeLessThan(8);
    for (const { s } of muestras(e)) {
      expect(ang(s.a.tronco)).toBeGreaterThanOrEqual(80);
      expect(s.p.rodilla_c.x).toBeLessThan(planta(s, 'c').punta.x + 3);
    }
  });
});

describe('zancada atrás', () => {
  const e = ej('zancada-atras-mancuerna');

  it('el pie de delante va plano y no se mueve', () => {
    piesPlanos(e);
  });

  it('con el paso dado, la punta de atrás no se mueve del suelo', () => {
    puntaQuieta(e, 1100, 2850);
  });

  it('abajo la rodilla de atrás cerca del suelo; brazos colgando (±10°)', () => {
    expect(esqueletoEn(e, 1900).p.rodilla_l.y).toBeLessThan(12);
    for (const { s } of muestras(e)) expect(Math.abs(ang(s.a.brazo_c) + 90)).toBeLessThan(10);
  });
});

describe('subida al cajón', () => {
  const e = ej('step-up-cajon');
  const caja = escenario(e, 'cajon');

  it('el pie de apoyo va plano sobre el cajón', () => {
    piesPlanos(e, 'c', caja.alto);
  });

  it('arriba, de pie sobre el cajón con la rodilla lejana arriba', () => {
    const s = esqueletoEn(e, 1600);
    expect(angulosEn(e, 1600).cerca.rodilla).toBeLessThanOrEqual(8);
    expect(Math.abs(ang(s.a.tronco) - 90)).toBeLessThan(8);
    expect(s.p.rodilla_l.y).toBeGreaterThan(s.p.cadera.y - 6);
  });

  it('el pie lejano no atraviesa el cajón', () => {
    for (const { s } of muestras(e)) {
      const p = planta(s, 'l');
      for (const q of [p.talon, p.punta, s.p.tobillo_l]) {
        if (q.x > caja.x && q.x < caja.x + caja.ancho) expect(q.y).toBeGreaterThan(caja.alto - 0.6);
      }
    }
  });
});

describe('pesos muertos rumanos', () => {
  it.each(['peso-muerto-rumano', 'peso-muerto-rumano-mancuerna'])('%s: la carga baja sobre el medio del pie rozando las piernas', (id) => {
    const e = ej(id);
    for (const { s } of muestras(e)) {
      const b = centroCarga(s, e.carga, e.vista) as Punto;
      expect(Math.abs(b.x - medioPie(s))).toBeLessThan(2);
      expect(holguraPierna(b, s)).toBeGreaterThan(-0.3);
      expect(holguraPierna(b, s)).toBeLessThan(3);
    }
  });

  it.each(['peso-muerto-rumano', 'peso-muerto-rumano-mancuerna'])('%s: bisagra con espinillas verticales y brazos estirados', (id) => {
    const e = ej(id);
    for (let ms = 0; ms < e.cicloMs; ms += 25) {
      const a = angulosEn(e, ms).cerca;
      expect(Math.abs(a.tobillo)).toBeLessThanOrEqual(6);
      expect(a.rodilla).toBeLessThanOrEqual(25);
      expect(a.codo).toBe(0);
    }
    expect(esqueletoEn(e, 2300).p.cadera.x).toBeLessThan(esqueletoEn(e, 200).p.cadera.x - 5);
  });
});

describe('peso muerto a una pierna', () => {
  const e = ej('peso-muerto-una-pierna');

  it('pie de apoyo plano, espinilla casi vertical y rodilla suave', () => {
    piesPlanos(e);
    for (let ms = 0; ms < e.cicloMs; ms += 25) {
      const a = angulosEn(e, ms).cerca;
      expect(Math.abs(a.tobillo)).toBeLessThanOrEqual(6);
      expect(a.rodilla).toBeLessThanOrEqual(25);
    }
  });

  it('abajo la pierna libre sigue la línea del tronco y no toca el suelo', () => {
    expect(Math.abs(angulosEn(e, 2500).lejos.cadera)).toBeLessThanOrEqual(10);
    for (const { s } of muestras(e)) {
      const p = planta(s, 'l');
      expect(Math.min(p.talon.y, p.punta.y)).toBeGreaterThan(1);
    }
  });

  it('el brazo cuelga vertical (±12°)', () => {
    for (const { s } of muestras(e)) expect(Math.abs(ang(s.a.brazo_c) + 90)).toBeLessThan(12);
  });
});

describe('buenos días', () => {
  const e = ej('buenos-dias');

  it('espalda neutra, rodillas suaves y espinillas casi verticales', () => {
    for (let ms = 0; ms < e.cicloMs; ms += 25) {
      const a = angulosEn(e, ms);
      expect(Math.abs(a.cuello)).toBeLessThanOrEqual(10);
      expect(a.cerca.rodilla).toBeLessThanOrEqual(25);
      expect(Math.abs(a.cerca.tobillo)).toBeLessThanOrEqual(6);
    }
    expect(esqueletoEn(e, 2500).p.cadera.x).toBeLessThan(esqueletoEn(e, 200).p.cadera.x - 5);
  });

  it('la barra cerca del medio del pie (±5) y las manos en la barra', () => {
    for (const { s } of muestras(e)) {
      const b = centroCarga(s, e.carga, e.vista) as Punto;
      expect(Math.abs(b.x - medioPie(s))).toBeLessThan(5);
      expect(dist(s.p.agarre_c, b)).toBeLessThan(3);
    }
  });
});

describe('hip thrust', () => {
  const e = ej('hip-thrust');
  const banco = escenario(e, 'banco');

  it('pies planos y la espalda alta quieta en el borde del banco', () => {
    piesPlanos(e);
    const ref = apoyoEspalda(esqueletoEn(e, 0));
    expect(Math.abs(ref.y - banco.alto)).toBeLessThan(0.6);
    expect(Math.abs(ref.x - (banco.x + banco.ancho))).toBeLessThan(1.5);
    for (const { s } of muestras(e)) expect(dist(apoyoEspalda(s), ref)).toBeLessThan(0.8);
  });

  it('arriba: tronco y muslo en línea, muslo horizontal y espinilla vertical', () => {
    const s = esqueletoEn(e, 1500);
    expect(Math.abs(angulosEn(e, 1500).cerca.cadera)).toBeLessThanOrEqual(6);
    expect(Math.abs(ang(s.a.muslo_c))).toBeLessThan(8);
    expect(Math.abs(ang(s.a.pierna_c) + 90)).toBeLessThan(8);
  });

  it('la barra va sobre la cadera', () => {
    for (const { s } of muestras(e)) expect(dist(centroCarga(s, e.carga, e.vista) as Punto, s.p.cadera)).toBeLessThan(9);
  });
});

describe('puentes de glúteo', () => {
  it.each(['puente-gluteo', 'puente-gluteo-una-pierna'])('%s: pie plano y la espalda alta quieta en el suelo', (id) => {
    const e = ej(id);
    piesPlanos(e);
    for (const { s } of muestras(e)) expect(Math.abs(apoyoEspalda(s).y)).toBeLessThan(0.6);
  });

  it.each(['puente-gluteo', 'puente-gluteo-una-pierna'])('%s: arriba en línea; abajo los glúteos rozan el suelo', (id) => {
    const e = ej(id);
    expect(Math.abs(angulosEn(e, e.msFicha ?? 0).cerca.cadera)).toBeLessThanOrEqual(6);
    const alturas = muestras(e).map(({ s }) => s.p.cadera.y);
    expect(Math.min(...alturas)).toBeGreaterThan(8);
    expect(Math.min(...alturas)).toBeLessThan(9.5);
    for (const { s } of muestras(e)) expect(s.p.cabeza.y).toBeGreaterThan(6.2 - 0.8);
  });

  it('a una pierna: la libre estirada, paralela al muslo de apoyo y sin tocar el suelo', () => {
    const e = ej('puente-gluteo-una-pierna');
    for (const { ms, s } of muestras(e)) {
      expect(angulosEn(e, ms).lejos.rodilla).toBeLessThanOrEqual(5);
      expect(Math.abs(ang(s.a.muslo_l - s.a.muslo_c))).toBeLessThan(2);
      expect(planta(s, 'l').punta.y).toBeGreaterThan(2);
    }
  });
});

describe('prensa', () => {
  const e = ej('prensa');
  const m = muestras(e);

  it('la espalda no se mueve del respaldo', () => {
    for (const { s } of m) expect(Math.abs(ang(s.a.tronco) - RESPALDO_PRENSA)).toBeLessThan(0.01);
  });

  it('el tobillo va en línea recta por el raíl (45°) y el pie, perpendicular a él', () => {
    const a0 = m[0].s.p.tobillo_c;
    const r = dir(45);
    for (const { s } of m) {
      const v = { x: s.p.tobillo_c.x - a0.x, y: s.p.tobillo_c.y - a0.y };
      expect(Math.abs(v.x * r.y - v.y * r.x)).toBeLessThan(0.6);
      expect(Math.abs(ang(s.a.pie_c - 135))).toBeLessThan(0.5);
    }
  });

  it('arriba sin bloquear y abajo a unos 90°, sin que se despegue la cadera', () => {
    const rodillas: number[] = [];
    for (let ms = 0; ms < e.cicloMs; ms += 25) {
      const a = angulosEn(e, ms).cerca;
      rodillas.push(a.rodilla);
      expect(a.cadera).toBeLessThanOrEqual(130);
    }
    expect(Math.min(...rodillas)).toBeGreaterThanOrEqual(10);
    expect(Math.max(...rodillas)).toBeGreaterThan(80);
    expect(Math.max(...rodillas)).toBeLessThan(100);
  });
});

describe('máquinas de palanca', () => {
  it.each([
    ['extension-cuadriceps', 8, 90],
    ['curl-femoral-tumbado', 8, 110],
  ] as const)('%s: la rodilla en el eje y recorrido completo', (id, estirada, doblada) => {
    const e = ej(id);
    const carga = e.carga?.tipo === 'palanca' ? e.carga : null;
    if (!carga) throw new Error('sin palanca');
    const rod: number[] = [];
    for (const { ms, s } of muestras(e)) {
      expect(dist(s.p.rodilla_c, carga.eje)).toBeLessThan(0.5);
      // El rodillo va con la pierna, junto al tobillo.
      expect(dist(rodilloPalanca(s, carga.cara), s.p.tobillo_c)).toBeLessThan(8);
      rod.push(angulosEn(e, ms).cerca.rodilla);
    }
    expect(Math.min(...rod)).toBeLessThanOrEqual(estirada);
    expect(Math.max(...rod)).toBeGreaterThanOrEqual(doblada);
  });

  it('curl femoral: el tronco descansa en el banco sin atravesarlo', () => {
    const e = ej('curl-femoral-tumbado');
    const banco = escenario(e, 'curl_femoral');
    for (const { s } of muestras(e)) {
      expect(s.p.cadera.y - banco.alto).toBeGreaterThan(6.4);
      expect(s.p.cadera.y - banco.alto).toBeLessThan(8);
    }
  });
});

describe('gemelos y tibial', () => {
  it('de pie: solo se mueve el tobillo, de +15° a -30°, y la planta apenas se mueve del borde', () => {
    const e = ej('gemelos-de-pie');
    const caja = escenario(e, 'cajon');
    const xs: number[] = [];
    const tob: number[] = [];
    for (const { ms, s } of muestras(e)) {
      const a = angulosEn(e, ms).cerca;
      expect(a.rodilla).toBeLessThanOrEqual(4);
      expect(Math.abs(a.cadera)).toBeLessThanOrEqual(4);
      expect(Math.abs(ang(s.a.tronco) - 90)).toBeLessThan(3);
      const p = planta(s, 'c').punta;
      expect(Math.abs(p.y - caja.alto)).toBeLessThan(0.6);
      expect(p.x).toBeGreaterThan(caja.x);
      xs.push(p.x);
      tob.push(a.tobillo);
    }
    // El pie gira sobre la punta: la planta apenas se desliza (±1,6 alrededor de su sitio).
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(3.2);
    expect(Math.max(...tob)).toBeGreaterThanOrEqual(15);
    expect(Math.min(...tob)).toBeLessThanOrEqual(-30);
    expect(planta(esqueletoEn(e, 200), 'c').talon.y).toBeLessThan(caja.alto);
    expect(planta(esqueletoEn(e, 1500), 'c').talon.y).toBeGreaterThan(caja.alto);
  });

  it('sentado: la planta quieta en el escalón, rodilla a 90-105° y la mancuerna sobre la rodilla', () => {
    const e = ej('gemelos-sentado');
    const caja = escenario(e, 'cajon');
    const ref = planta(esqueletoEn(e, 0), 'c').punta;
    expect(Math.abs(ref.y - caja.alto)).toBeLessThan(0.3);
    for (const { ms, s } of muestras(e)) {
      expect(dist(planta(s, 'c').punta, ref)).toBeLessThan(0.6);
      const a = angulosEn(e, ms).cerca;
      expect(a.rodilla).toBeGreaterThanOrEqual(90);
      expect(a.rodilla).toBeLessThanOrEqual(105);
      expect(s.p.agarre_c.y).toBeGreaterThan(s.p.rodilla_c.y);
      expect(Math.abs(s.p.agarre_c.x - s.p.rodilla_c.x)).toBeLessThan(5);
    }
  });

  it('tibial: el talón quieto en el suelo y la espinilla casi vertical', () => {
    const e = ej('elevacion-tibial');
    const ref = planta(esqueletoEn(e, 0), 'c').talon;
    expect(Math.abs(ref.y)).toBeLessThan(0.3);
    const tob: number[] = [];
    for (const { ms, s } of muestras(e)) {
      expect(dist(planta(s, 'c').talon, ref)).toBeLessThan(0.6);
      expect(Math.abs(ang(s.a.pierna_c) + 90)).toBeLessThan(12);
      tob.push(angulosEn(e, ms).cerca.tobillo);
    }
    expect(Math.min(...tob)).toBeLessThanOrEqual(0);
    expect(Math.max(...tob)).toBeGreaterThanOrEqual(25);
  });
});

describe('swing con kettlebell', () => {
  const e = ej('swing-kettlebell');

  it('bisagra, no sentadilla: pies planos, rodillas ≤ 25° y la cadera siempre sobre la rodilla', () => {
    piesPlanos(e);
    for (const { ms, s } of muestras(e)) {
      const a = angulosEn(e, ms).cerca;
      expect(a.rodilla).toBeLessThanOrEqual(25);
      expect(a.codo).toBe(0);
      expect(s.p.cadera.y).toBeGreaterThan(s.p.rodilla_c.y + 10);
    }
  });

  it('arriba: tronco vertical, cadera extendida y kettlebell a la altura del pecho', () => {
    const s = esqueletoEn(e, 850);
    expect(Math.abs(ang(s.a.tronco) - 90)).toBeLessThan(6);
    expect(Math.abs(angulosEn(e, 850).cerca.cadera)).toBeLessThanOrEqual(6);
    expect(Math.abs(ang(s.a.brazo_c))).toBeLessThan(12);
  });

  it('atrás la kettlebell pasa por detrás de las rodillas', () => {
    const s = esqueletoEn(e, 0);
    expect((centroCarga(s, e.carga, e.vista) as Punto).x).toBeLessThan(s.p.rodilla_c.x);
  });
});

describe('patada de glúteo', () => {
  const e = ej('patada-gluteo');

  it('el tronco no se mueve y las manos siguen en el suelo', () => {
    const s0 = esqueletoEn(e, 0);
    for (const { s } of muestras(e)) {
      expect(dist(s.p.hombro, s0.p.hombro)).toBeLessThan(0.01);
      expect(Math.abs(s.p.agarre_c.y - 2.4)).toBeLessThan(0.8);
    }
  });

  it('rodilla a unos 90° y arriba el muslo en la horizontal sin arquear', () => {
    for (let ms = 0; ms < e.cicloMs; ms += 25) {
      const a = angulosEn(e, ms).cerca;
      expect(a.rodilla).toBeGreaterThanOrEqual(85);
      expect(a.rodilla).toBeLessThanOrEqual(108);
      expect(a.cadera).toBeGreaterThanOrEqual(-30);
    }
    const arriba = esqueletoEn(e, 1350);
    expect(Math.abs(ang(arriba.a.muslo_c - 180))).toBeLessThan(15);
    expect(esqueletoEn(e, 0).p.rodilla_c.y).toBeGreaterThan(LARGO.tobillo - 0.5);
  });
});

describe('curl nórdico', () => {
  const e = ej('curl-nordico');

  it('rodillas fijas y cuerpo recto de rodillas a cabeza', () => {
    const r0 = esqueletoEn(e, 0).p.rodilla_c;
    for (const { ms, s } of muestras(e)) {
      expect(dist(s.p.rodilla_c, r0)).toBeLessThan(0.01);
      expect(Math.abs(angulosEn(e, ms).cerca.cadera)).toBeLessThanOrEqual(5);
    }
  });

  it('la bajada dura más del doble que la subida', () => {
    const bajada = e.poses[3].ms - e.poses[1].ms;
    const subida = e.cicloMs - e.poses[4].ms;
    expect(bajada).toBeGreaterThan(2 * subida);
  });
});

describe('abducciones', () => {
  it('tumbado: tronco y pierna de abajo quietos; la de arriba sube recta a 35-45°', () => {
    const e = ej('abduccion-tumbado');
    const s0 = esqueletoEn(e, 0);
    const abd: number[] = [];
    for (const { ms, s } of muestras(e)) {
      expect(dist(s.p.hombro, s0.p.hombro)).toBeLessThan(0.01);
      expect(dist(s.p.tobillo_c, s0.p.tobillo_c)).toBeLessThan(0.01);
      const l = angulosEn(e, ms).lejos;
      expect(l.rodilla).toBe(0);
      abd.push(l.cadera);
    }
    expect(Math.max(...abd)).toBeGreaterThanOrEqual(35);
    expect(Math.max(...abd)).toBeLessThanOrEqual(45);
  });

  it('máquina: cadera quieta, apertura simétrica, espinillas colgando y almohadillas en la rodilla', () => {
    const e = ej('abduccion-maquina');
    const s0 = esqueletoEn(e, 0);
    const aperturas: number[] = [];
    for (const { s } of muestras(e)) {
      expect(dist(s.p.cadera, s0.p.cadera)).toBeLessThan(0.01);
      expect(Math.abs(s.p.rodilla_c.x + s.p.rodilla_l.x - 2 * s.p.cadera.x)).toBeLessThan(0.5);
      expect(Math.abs(ang(s.a.pierna_c) + 90)).toBeLessThan(3);
      expect(Math.abs(ang(s.a.pierna_l) + 90)).toBeLessThan(3);
      expect(dist(almohadilla(s, 'c'), s.p.rodilla_c)).toBeLessThan(8);
      aperturas.push(s.p.rodilla_l.x - s.p.rodilla_c.x);
    }
    expect(Math.max(...aperturas) - Math.min(...aperturas)).toBeGreaterThan(20);
  });
});
