// NIVL · IRON · Pecho: ayudas para escribir las poses del grupo.
//
// No es un ejercicio (el guion bajo lo deja fuera del catálogo). Las poses se
// guardan como ángulos de articulación, pero aquí se piensan en el espacio,
// como en src/iron/autor.ts: «la mano sobre el pecho bajo con el antebrazo
// vertical», «el cuerpo recto pivotando sobre las puntas», «la mano fija en
// la paralela». Todo se calcula una vez al cargar el módulo y el ejercicio
// queda como datos puros (lo que el motor anima en el hilo de la interfaz).

import { articulacion, ikDosEslabones } from '../../autor';
import { dir, LARGO, type Punto } from '../../esqueleto';
import type { Extremidades, Pose, SegmentoId } from '../../tipos';

const r1 = (v: number) => Math.round(v * 10) / 10;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const grados = (rad: number) => (rad * 180) / Math.PI;

/** Ángulos absolutos de los segmentos de un lado (los del dibujo). */
export interface Absolutos {
  tronco: number;
  muslo: number;
  pierna: number;
  pie: number;
  brazo: number;
  antebrazo: number;
}

/** De ángulos absolutos a ángulos de articulación (redondeados a 0,1°). */
export function extremidades(a: Absolutos): Extremidades {
  return {
    cadera: r1(articulacion.cadera(a.tronco, a.muslo)),
    rodilla: r1(articulacion.rodilla(a.muslo, a.pierna)),
    tobillo: r1(articulacion.tobillo(a.pierna, a.pie)),
    hombro: r1(articulacion.hombro(a.tronco, a.brazo)),
    codo: r1(articulacion.codo(a.brazo, a.antebrazo)),
  };
}

export const mas = (p: Punto, v: Punto, k = 1): Punto => ({ x: p.x + v.x * k, y: p.y + v.y * k });
export const menos = (a: Punto, b: Punto): Punto => ({ x: a.x - b.x, y: a.y - b.y });
export const largo = (v: Punto) => Math.hypot(v.x, v.y);

// Grosor del tronco por delante y por detrás (el perfil lateral de dibujo.ts,
// con la misma transición suave entre puntos).
const DELANTE: readonly (readonly [number, number])[] = [
  [0, 6.6],
  [0.12, 6.2],
  [0.3, 5.3],
  [0.45, 5.6],
  [0.62, 7.6],
  [0.78, 8.7],
  [0.9, 7.7],
  [1, 5.8],
];

function perfil(tabla: readonly (readonly [number, number])[], t: number): number {
  if (t <= tabla[0][0]) return tabla[0][1];
  for (let i = 1; i < tabla.length; i++) {
    const [tb, vb] = tabla[i];
    if (t <= tb) {
      const [ta, va] = tabla[i - 1];
      const u = 0.5 - 0.5 * Math.cos((Math.PI * (t - ta)) / (tb - ta));
      return va + (vb - va) * u;
    }
  }
  return tabla[tabla.length - 1][1];
}

/** Grosor del pecho (cara anterior del tronco) a la altura `t` (0 cadera, 1 hombro). */
export const grosorPecho = (t: number) => perfil(DELANTE, t);

/** Desde el eje del tronco hasta la superficie en la que se apoya la espalda (dorsal y escápulas). */
export const APOYO_ESPALDA = 7.3;
/** Desde la cadera hasta la superficie en la que se apoyan los glúteos. */
export const APOYO_GLUTEO = 8.6;
/** Radio de la cabeza (dibujo.ts). */
export const RADIO_CABEZA = 6.2;
/** Del centro del puño a la palma apoyada (radio de la mano en dibujo.ts). */
export const RADIO_MANO = 2.4;

// ── Tumbado boca arriba (banco plano, inclinado, declinado o suelo) ─────────

/** Tronco tumbado: la cadera fija y el ángulo absoluto del tronco (cabeza a la izquierda: ~180). */
export interface Tumbado {
  cadera: Punto;
  tronco: number;
  piernas: Pick<Absolutos, 'muslo' | 'pierna' | 'pie'>;
}

/** La normal del pecho (hacia donde mira el pecho) de un tronco tumbado. */
export function normalPecho(tronco: number): Punto {
  const d = dir(tronco);
  return { x: d.y, y: -d.x };
}

export const hombroDe = (c: Tumbado): Punto => mas(c.cadera, dir(c.tronco), LARGO.tronco);

/** Un punto del tronco: `t` de la cadera al hombro, `fuera` unidades hacia el pecho (negativo: hacia la espalda). */
export function puntoTronco(c: Pick<Tumbado, 'cadera' | 'tronco'>, t: number, fuera: number): Punto {
  return mas(mas(c.cadera, dir(c.tronco), LARGO.tronco * t), normalPecho(c.tronco), fuera);
}

/** El cuello que deja la cabeza apoyada en la superficie de la espalda (a `apoyo` del eje). */
export function cuelloApoyado(apoyo = APOYO_ESPALDA): number {
  return r1(grados(Math.asin(-(apoyo - RADIO_CABEZA) / LARGO.cabeza)));
}

/**
 * Piernas con el pie plano en el suelo: el tobillo en `tobillo` (y = 4, la
 * altura del tobillo sobre la planta) y la rodilla hacia arriba.
 */
export function piernasAlSuelo(cadera: Punto, tobillo: Punto): Pick<Absolutos, 'muslo' | 'pierna' | 'pie'> {
  const ik = ikDosEslabones(cadera, tobillo, LARGO.muslo, LARGO.pierna, false);
  if (!ik.alcanza) throw new Error('las piernas no llegan al suelo');
  return { muslo: ik.a1, pierna: ik.a2, pie: 0 };
}

/**
 * Pose de empuje tumbado con el antebrazo vertical (press): la mano (el centro
 * del puño) en `mano`. El codo queda debajo; el brazo sale del plano lo que
 * haga falta para llegar del hombro al codo (escorzo).
 */
export function poseEmpuje(c: Tumbado, ms: number, mano: Punto, escAntebrazo: number, cuello: number): Pose {
  const codo = { x: mano.x, y: mano.y - LARGO.antebrazo * escAntebrazo - LARGO.mano };
  const v = menos(codo, hombroDe(c));
  const escBrazo = largo(v) / LARGO.brazo;
  if (escBrazo > 1.0001) throw new Error(`el brazo no llega (${escBrazo.toFixed(3)})`);
  const brazo = grados(Math.atan2(v.y, v.x));
  const cerca = extremidades({ tronco: c.tronco, ...c.piernas, brazo, antebrazo: 90 });
  const e = Math.min(1, r3(escBrazo));
  return { ms, cuello, cerca, escorzo: { brazo_c: e, brazo_l: e, antebrazo_c: escAntebrazo, antebrazo_l: escAntebrazo } };
}

/** Las manos sobre los hombros con los brazos casi estirados (bloqueo del press). */
export function manoArriba(c: Tumbado, escBrazo = 0.95, escAntebrazo = 0.95): Punto {
  const s = hombroDe(c);
  return { x: s.x, y: s.y + LARGO.brazo * escBrazo + LARGO.antebrazo * escAntebrazo + LARGO.mano };
}

/** La trayectoria en «J»: de abajo (u = 0) a arriba (u = 1); se acerca a los hombros al principio. */
export function enJ(abajo: Punto, arriba: Punto, u: number): Punto {
  const k = 1 - (1 - u) * (1 - u);
  return { x: abajo.x + (arriba.x - abajo.x) * k, y: abajo.y + (arriba.y - abajo.y) * u };
}

/** Los instantes del ciclo de un press (4,5 s): arriba, bajada en 2,1 s, pausa, subida en 1,25 s. */
export const TIEMPOS_PRESS: readonly (readonly [number, number])[] = [
  [0, 1],
  [500, 1],
  [1000, 0.75],
  [1550, 0.5],
  [2100, 0.25],
  [2600, 0],
  [2900, 0],
  [3200, 0.25],
  [3500, 0.5],
  [3800, 0.75],
  [4150, 1],
];
export const CICLO_PRESS = 4500;
export const ESFUERZO_PRESS = [{ desde: 2900, hasta: 4150 }] as const;

/** Las poses de un press tumbado con antebrazo vertical, de `arriba` a `abajo` en J. */
export function posesPress(c: Tumbado, abajo: Punto, arriba: Punto, cuello: number): Pose[] {
  return TIEMPOS_PRESS.map(([ms, u]) => poseEmpuje(c, ms, enJ(abajo, arriba, u), r3(1 - 0.05 * u), cuello));
}

/**
 * Aperturas: los brazos se abren hacia los lados, fuera del plano, así que de
 * perfil la mano baja y el brazo se ve cada vez más corto. `abierto` de 0
 * (arriba, sobre los hombros) a 1 (abajo, brazos en cruz): la mano acaba al
 * lado del pecho (`abajo`, a la altura de la línea de los pezones), no junto
 * a la cabeza. El codo, un poco flexionado y fijo (9°).
 */
export function poseApertura(c: Tumbado, ms: number, abierto: number, abajo: Punto, cuello: number): Pose {
  const s = hombroDe(c);
  const k = Math.sin((abierto * Math.PI) / 2);
  const arriba = { x: s.x, y: s.y + 0.97 * (LARGO.brazo + LARGO.antebrazo) + LARGO.mano };
  const mano = { x: arriba.x + (abajo.x - arriba.x) * k, y: arriba.y + (abajo.y - arriba.y) * k };
  const v = menos(mano, s);
  const angulo = grados(Math.atan2(v.y, v.x));
  // Brazo y antebrazo casi en línea (codo a 9°): su proyección, más la mano, llega a la mano.
  const visto = r3(Math.max(0.04, (largo(v) - LARGO.mano) / ((LARGO.brazo + LARGO.antebrazo) * Math.cos((4.5 * Math.PI) / 180))));
  const cerca = extremidades({ tronco: c.tronco, ...c.piernas, brazo: angulo - 4.5, antebrazo: angulo + 4.5 });
  return { ms, cuello, cerca, escorzo: { brazo_c: visto, brazo_l: visto, antebrazo_c: visto, antebrazo_l: visto } };
}

/** Superficie de apoyo de la espalda: la recta paralela al tronco a APOYO_ESPALDA por detrás. */
export function puntoRespaldo(c: Pick<Tumbado, 'cadera' | 'tronco'>, s: number): Punto {
  return mas(puntoTronco(c, 0, -APOYO_ESPALDA), dir(c.tronco), s);
}

/** Dónde corta la superficie de la espalda la horizontal y = `alto` (la bisagra de un banco inclinado). */
export function bisagra(c: Pick<Tumbado, 'cadera' | 'tronco'>, alto: number): Punto {
  const p0 = puntoRespaldo(c, 0);
  const d = dir(c.tronco);
  const s = (alto - p0.y) / d.y;
  return mas(p0, d, s);
}

// ── Boca abajo: flexiones ───────────────────────────────────────────────────

/**
 * Cuerpo recto que pivota sobre un apoyo fijo (las puntas de los pies o las
 * rodillas): `beta` es el ángulo del tronco (la cabeza hacia +x).
 */
export interface Prono {
  /** El punto fijo: el tobillo (apoyo en las puntas) o la rodilla. */
  apoyo: 'tobillo' | 'rodilla';
  /** Dónde está ese punto. */
  en: Punto;
  /** Ángulo absoluto fijo del pie (apoyo en puntas) o de la pierna (apoyo en rodillas). */
  fijo: number;
}

/**
 * Brazo y antebrazo del hombro a la mano con el codo hacia atrás y arriba
 * (la persona mira a +x): de las dos soluciones, la que deja el codo a la
 * derecha del sentido hombro→mano.
 */
export function codoAtras(hombro: Punto, mano: Punto, l1: number, l2: number) {
  const a = ikDosEslabones(hombro, mano, l1, l2, true);
  const b = ikDosEslabones(hombro, mano, l1, l2, false);
  const hm = menos(mano, hombro);
  const lado = (m: Punto) => hm.x * (m.y - hombro.y) - hm.y * (m.x - hombro.x);
  return lado(a.medio) <= lado(b.medio) ? a : b;
}

/** Del apoyo al hombro con el cuerpo recto. */
export function hombroProno(p: Prono, beta: number): Punto {
  const d = dir(beta);
  const hastaCadera = p.apoyo === 'tobillo' ? LARGO.muslo + LARGO.pierna : LARGO.muslo;
  return mas(p.en, d, hastaCadera + LARGO.tronco);
}

/** El tobillo a la altura justa para que la punta del pie (planta) toque `suelo`. */
export function tobilloEnPuntas(x: number, pie: number, suelo = 0): Punto {
  const d = dir(pie);
  // punta de la planta = tobillo + d × pie + n × (-altura del tobillo), con n a la izquierda de d.
  return { x, y: suelo - (d.y * LARGO.pie - d.x * LARGO.tobillo) };
}

/** Busca el ángulo (entre a y b) en que f cambia de signo (bisección). */
export function resolver(f: (v: number) => number, a: number, b: number): number {
  let fa = f(a);
  for (let i = 0; i < 60; i++) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (fa * fm <= 0) b = m;
    else {
      a = m;
      fa = fm;
    }
  }
  return (a + b) / 2;
}

/**
 * Pose de flexión: cuerpo recto a `beta`, la mano (centro del puño) en
 * `mano`, codos hacia atrás (hacia los pies). `escBrazo`: cuánto se ve del
 * brazo (codos abiertos = menos).
 */
export function poseFlexion(p: Prono, ms: number, beta: number, mano: Punto, escBrazo = 1, cuello = 0): Pose {
  const s = hombroProno(p, beta);
  const l1 = LARGO.brazo * escBrazo;
  const l2 = LARGO.antebrazo + LARGO.mano;
  const ik = codoAtras(s, mano, l1, l2);
  const recto = beta + 180;
  const pierna = p.apoyo === 'tobillo' ? recto : p.fijo;
  const pie = p.apoyo === 'tobillo' ? p.fijo : p.fijo + 90 - 35;
  const cerca = extremidades({ tronco: beta, muslo: recto, pierna, pie, brazo: ik.a1, antebrazo: ik.a2 });
  const pose: Pose = { ms, cuello, cerca, angulo: r1(p.apoyo === 'tobillo' ? p.fijo : recto) };
  if (escBrazo < 1) return { ...pose, escorzo: { brazo_c: escBrazo, brazo_l: escBrazo } };
  return pose;
}

/** El ángulo del cuerpo con el que el hombro queda a la altura `y`. */
export function betaConHombroEn(p: Prono, y: number): number {
  return resolver((b) => hombroProno(p, b).y - y, -40, 70);
}

/** El ángulo del cuerpo con el que el hombro queda a `dist` de la mano (brazos casi estirados). */
export function betaConBrazoA(p: Prono, mano: Punto, dist: number, desde = -40): number {
  return resolver((b) => largo(menos(hombroProno(p, b), mano)) - dist, desde, 75);
}

// ── Fondos en paralelas ─────────────────────────────────────────────────────

/**
 * Pose de fondos: la mano fija en la barra (`mano`), el hombro en `hombro`
 * con el tronco a `tronco` grados y las piernas dobladas hacia atrás.
 * Devuelve también el ángulo del antebrazo (el segmento del ancla).
 */
export function poseFondo(
  ms: number,
  mano: Punto,
  hombro: Punto,
  tronco: number,
  piernas: Pick<Absolutos, 'muslo' | 'pierna' | 'pie'>,
  escBrazo = 1,
  cuello = 0,
): Pose {
  const l1 = LARGO.brazo * escBrazo;
  const l2 = LARGO.antebrazo + LARGO.mano;
  const ik = codoAtras(hombro, mano, l1, l2);
  const cerca = extremidades({ tronco, ...piernas, brazo: ik.a1, antebrazo: ik.a2 });
  const pose: Pose = { ms, cuello, cerca, angulo: r1(ik.a2) };
  return escBrazo < 1 ? { ...pose, escorzo: { brazo_c: escBrazo, brazo_l: escBrazo } } : pose;
}

/** Del hombro a la cadera con el tronco a `tronco` grados. */
export const caderaBajoHombro = (hombro: Punto, tronco: number): Punto => mas(hombro, dir(tronco), -LARGO.tronco);

// ── Pec deck (vista frontal) ────────────────────────────────────────────────

/**
 * Pec deck visto de frente, sentado: brazo horizontal a la altura del hombro
 * y antebrazo vertical. `aduccion` es el giro horizontal del brazo: 0 = en
 * cruz (abierto), 90 = el codo delante del hombro, 120 = los codos juntos
 * delante del pecho. De frente solo se ve la proyección del brazo: hacia
 * fuera hasta 90° y hacia dentro después (el paso por 90° es invisible: el
 * brazo se ve de punta). El antebrazo sigue vertical todo el recorrido.
 */
export function posePecDeck(
  ms: number,
  aduccion: number,
  piernas: Pick<Extremidades, 'cadera' | 'rodilla' | 'tobillo'>,
  escMuslo: number,
): Pose {
  const c = Math.cos((aduccion * Math.PI) / 180);
  const fuera = aduccion <= 90;
  const visto = r3(Math.max(0.04, Math.abs(c)));
  const hombro = fuera ? 90 : 270;
  // De frente (lado cercano en espejo): brazo = 270 - hombro y antebrazo = brazo - codo = 90.
  const cerca: Extremidades = { ...piernas, hombro, codo: 180 - hombro };
  const escorzo: Partial<Record<SegmentoId, number>> = { brazo_c: visto, brazo_l: visto, muslo_c: escMuslo, muslo_l: escMuslo };
  return { ms, cuello: 0, cerca, escorzo };
}
