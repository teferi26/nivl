// NIVL · IRON · ESPALDA: ayudas para escribir las poses del grupo.
//
// Las poses se guardan como ángulos de articulación (lo que interpola el
// motor), pero aquí se piensan como el dibujo: el ángulo de cada segmento y
// dónde tiene que estar la mano (en la barra fija, en el cable). Se calcula una
// vez, al cargar el catálogo, con las mismas fórmulas del esqueleto
// (src/iron/autor.ts); el motor recibe solo números.
// El archivo empieza por «_»: no es un ejercicio (lo salta el test del esquema).

import { articulacion, ikDosEslabones, normalizar } from '../../autor';
import { construirEsqueleto, LARGO, type Punto } from '../../esqueleto';
import type { Ancla, Extremidades, Pose, SegmentoId } from '../../tipos';

/** Ángulo absoluto de cada segmento (0 = hacia +x, 90 = hacia arriba). */
export interface Absolutos {
  tronco: number;
  /** Si no se da, la cabeza sigue al tronco (cuello 0). */
  cabeza?: number;
  muslo: number;
  pierna: number;
  pie: number;
  brazo: number;
  antebrazo: number;
}

/** El hombro va en (-120, 240]: un brazo por encima de la cabeza no salta de 180 a -180. */
function hombro(tronco: number, brazo: number): number {
  const h = normalizar(brazo - tronco - 180);
  return h <= -120 ? h + 360 : h;
}

export function extremidades(a: Absolutos): Extremidades {
  return {
    cadera: articulacion.cadera(a.tronco, a.muslo),
    rodilla: articulacion.rodilla(a.muslo, a.pierna),
    tobillo: articulacion.tobillo(a.pierna, a.pie),
    hombro: hombro(a.tronco, a.brazo),
    codo: articulacion.codo(a.brazo, a.antebrazo),
  };
}

export interface Extra {
  lejos?: Absolutos;
  /** Ángulo del segmento del ancla en esta pose (si cambia). */
  angulo?: number;
  escorzo?: Partial<Record<SegmentoId, number>>;
}

/** Una pose clave a partir de los ángulos absolutos. */
export function pose(ms: number, a: Absolutos, extra: Extra = {}): Pose {
  return {
    ms,
    cuello: a.cabeza === undefined ? 0 : articulacion.cuello(a.tronco, a.cabeza),
    cerca: extremidades(a),
    ...(extra.lejos ? { lejos: extremidades(extra.lejos) } : null),
    ...(extra.angulo !== undefined ? { angulo: extra.angulo } : null),
    ...(extra.escorzo ? { escorzo: extra.escorzo } : null),
  };
}

/** Dónde queda el hombro con esa pose (los brazos no cuentan). */
export function hombroEn(ancla: Ancla, p: Pose): Punto {
  const e = construirEsqueleto(
    { cuello: p.cuello, cerca: p.cerca, lejos: p.lejos ?? p.cerca, angulo: p.angulo ?? ancla.angulo, escorzo: p.escorzo ?? {} },
    ancla,
    'lateral',
  );
  return e.p.hombro;
}

/**
 * Brazo y antebrazo para que el puño (el agarre) caiga en `mano`, con el
 * escorzo de cada segmento. `codoAbajo` elige la solución.
 */
export function brazoHasta(
  desde: Punto,
  mano: Punto,
  codoAbajo: boolean,
  escorzo: { brazo?: number; antebrazo?: number } = {},
): { brazo: number; antebrazo: number } {
  const l1 = LARGO.brazo * (escorzo.brazo ?? 1);
  const l2 = LARGO.antebrazo * (escorzo.antebrazo ?? 1) + LARGO.mano;
  const r = ikDosEslabones(desde, mano, l1, l2, codoAbajo);
  return { brazo: r.a1, antebrazo: r.a2 };
}

/** Muslo y pierna para que el tobillo caiga en `tobillo` desde la cadera. */
export function piernaHasta(
  cadera: Punto,
  tobillo: Punto,
  rodillaDelante: boolean,
  escorzo: { muslo?: number; pierna?: number } = {},
): { muslo: number; pierna: number } {
  const r = ikDosEslabones(cadera, tobillo, LARGO.muslo * (escorzo.muslo ?? 1), LARGO.pierna * (escorzo.pierna ?? 1), !rodillaDelante);
  return { muslo: r.a1, pierna: r.a2 };
}

const sumar = (p: Punto, grados: number, largo: number): Punto => ({
  x: p.x + Math.cos((grados * Math.PI) / 180) * largo,
  y: p.y + Math.sin((grados * Math.PI) / 180) * largo,
});

export interface Bisagra {
  tronco: number;
  /** Brazo y antebrazo (absolutos); si no se da el antebrazo, sigue al brazo. */
  brazo: number;
  antebrazo?: number;
  /** Dónde está el puño. */
  mano: Punto;
  /** El tobillo cercano (por defecto el del ancla de pie: (0, 4)). */
  tobillo?: Punto;
  pie?: number;
  cabeza?: number;
  escorzo?: { brazo?: number; antebrazo?: number; muslo?: number; pierna?: number };
}

/**
 * De pie con los pies en el suelo y la mano donde tiene que estar (la barra
 * sobre el medio del pie): con el tronco y el brazo dados, el hombro y la
 * cadera salen solos y las piernas se despejan con la rodilla delante.
 */
export function bisagra(b: Bisagra): { abs: Absolutos; hombro: Punto; cadera: Punto } {
  const e = b.escorzo ?? {};
  const antebrazo = b.antebrazo ?? b.brazo;
  const muneca = sumar(b.mano, antebrazo, -LARGO.mano);
  const codo = sumar(muneca, antebrazo, -LARGO.antebrazo * (e.antebrazo ?? 1));
  const hombro = sumar(codo, b.brazo, -LARGO.brazo * (e.brazo ?? 1));
  const cadera = sumar(hombro, b.tronco, -LARGO.tronco);
  const piernas = piernaHasta(cadera, b.tobillo ?? { x: 0, y: 4 }, true, e);
  return {
    abs: { tronco: b.tronco, cabeza: b.cabeza, ...piernas, pie: b.pie ?? 0, brazo: b.brazo, antebrazo },
    hombro,
    cadera,
  };
}

/** De pie: el tobillo cercano en el suelo y el pie plano (como la sentadilla y el curl). */
export const ANCLA_DE_PIE: Ancla = { punto: 'tobillo_c', x: 0, y: 4, segmento: 'pie_c', angulo: 0 };

/**
 * Un punto delante del tronco: a `t` de su largo (0 cadera, 1 hombro) y a
 * `separacion` de su eje por la cara anterior (pecho y abdomen). Sirve para
 * llevar la barra o el agarre «al pecho» o «al abdomen».
 */
export function sobreTronco(cadera: Punto, tronco: number, t: number, separacion: number): Punto {
  const eje = sumar(cadera, tronco, LARGO.tronco * t);
  return sumar(eje, tronco - 90, separacion);
}

/** Un punto a `largo` de `p` en la dirección `grados`. */
export const desde = sumar;
