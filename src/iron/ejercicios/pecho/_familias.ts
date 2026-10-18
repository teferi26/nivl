// NIVL · IRON · Pecho: las familias de ejercicios del grupo.
//
// Cada familia arma la parte del ejercicio que comparten sus variantes
// (ancla, poses, ciclo, esfuerzo, escenario y encuadre) a partir de unas
// pocas medidas; el archivo de cada ejercicio pone el resto (nombre,
// músculos, material, carga, cues). No es un ejercicio: el guion bajo lo deja
// fuera del catálogo. La biomecánica de cada familia la comprueba
// src/iron/__tests__/biomecanica-pecho.test.ts.

import { dir, LARGO, type Punto } from '../../esqueleto';
import type { Ejercicio, Escenario, Extremidades, Pose } from '../../tipos';
import {
  APOYO_ESPALDA,
  bisagra,
  CICLO_PRESS,
  cuelloApoyado,
  ESFUERZO_PRESS,
  grosorPecho,
  hombroDe,
  manoArriba,
  piernasAlSuelo,
  poseApertura,
  posePecDeck,
  posesPress,
  poseFlexion,
  poseFondo,
  puntoRespaldo,
  puntoTronco,
  RADIO_CABEZA,
  RADIO_MANO,
  betaConBrazoA,
  betaConHombroEn,
  tobilloEnPuntas,
  largo,
  menos,
  type Prono,
  type Tumbado,
} from './_geometria';

type Parte = Pick<Ejercicio, 'ancla' | 'poses' | 'cicloMs' | 'esfuerzo' | 'msFicha' | 'escenario' | 'encuadre'>;

// ── Tumbado: banco plano, inclinado, declinado y suelo ──────────────────────

export type Apoyo = 'plano' | 'inclinado' | 'declinado' | 'suelo';

/** Altura del tablero del banco plano (la del press de banca). */
export const ALTO_BANCO = 24.6;

const r1 = (v: number) => Math.round(v * 10) / 10;

/** El cuello que deja la cabeza apoyada en una superficie horizontal a la altura `y`. */
function cuelloSobre(c: Tumbado, y: number): number {
  const s = hombroDe(c);
  const seno = (y + RADIO_CABEZA - s.y) / LARGO.cabeza;
  const cabeza = 180 - (Math.asin(seno) * 180) / Math.PI;
  return r1(c.tronco - cabeza);
}

export interface Tumbada {
  cuerpo: Tumbado;
  cuello: number;
  escenario: Escenario[];
  encuadre: Ejercicio['encuadre'];
}

/** El cuerpo tumbado y su banco (o el suelo) para cada apoyo. */
export function tumbada(apoyo: Apoyo): Tumbada {
  if (apoyo === 'plano') {
    // El del press de banca: hombros un poco más bajos que la cadera, cabeza en el banco.
    const cuerpo: Tumbado = { cadera: { x: 0, y: 33.2 }, tronco: 183.5, piernas: { muslo: 348.5, pierna: 263, pie: 0 } };
    return {
      cuerpo,
      cuello: 0,
      escenario: [{ tipo: 'banco', x: -54, ancho: 68, alto: ALTO_BANCO, capa: 'medio' }],
      encuadre: { x: -66, y: -4, ancho: 104, alto: 96 },
    };
  }
  if (apoyo === 'inclinado') {
    // Respaldo a 30°: glúteos en el asiento, espalda y cabeza en el respaldo, pies planos.
    const cadera = { x: 0, y: ALTO_BANCO + 8.6 };
    const base = { cadera, tronco: 150 };
    const b = bisagra(base, ALTO_BANCO);
    const cuerpo: Tumbado = { ...base, piernas: piernasAlSuelo(cadera, { x: 26, y: 4 }) };
    return {
      cuerpo,
      cuello: cuelloApoyado(),
      escenario: [{ tipo: 'banco_inclinado', x: r1(b.x), alto: ALTO_BANCO, angulo: 30, respaldo: 54, asiento: 20, capa: 'medio' }],
      encuadre: { x: -74, y: -4, ancho: 114, alto: 112 },
    };
  }
  if (apoyo === 'declinado') {
    // Tablero a 20° con la cabeza abajo; rodillas dobladas sobre el alto y los pies bajo el rodillo.
    const cadera = { x: 0, y: 40 };
    const muslo = 35;
    const pierna = -100;
    const cuerpo: Tumbado = { cadera, tronco: 200, piernas: { muslo, pierna, pie: pierna + 90 - 20 } };
    const alto = puntoRespaldo(cuerpo, -7);
    const rodilla = { x: cadera.x + Math.cos((muslo * Math.PI) / 180) * LARGO.muslo, y: cadera.y + Math.sin((muslo * Math.PI) / 180) * LARGO.muslo };
    const tobillo = { x: rodilla.x + Math.cos((pierna * Math.PI) / 180) * LARGO.pierna, y: rodilla.y + Math.sin((pierna * Math.PI) / 180) * LARGO.pierna };
    return {
      cuerpo,
      cuello: cuelloApoyado(),
      escenario: [
        {
          tipo: 'banco_declinado',
          x: r1(alto.x),
          alto: r1(alto.y),
          angulo: 20,
          respaldo: 60,
          rodillo: { x: r1(tobillo.x + 6.4), y: r1(tobillo.y + 1), r: 3 },
          rodillera: { x: r1(rodilla.x + 1), y: r1(rodilla.y - 8.5), r: 3.5 },
          capa: 'medio',
        },
      ],
      encuadre: { x: -70, y: -4, ancho: 112, alto: 92 },
    };
  }
  // Suelo: rodillas dobladas y pies planos; espalda y cabeza en el suelo.
  const cadera = { x: 0, y: 8.6 };
  const tronco = 180 + (Math.asin((cadera.y - APOYO_ESPALDA) / LARGO.tronco) * 180) / Math.PI;
  const cuerpo: Tumbado = { cadera, tronco, piernas: piernasAlSuelo(cadera, { x: 33, y: 4 }) };
  return { cuerpo, cuello: cuelloSobre(cuerpo, 0), escenario: [], encuadre: { x: -66, y: -4, ancho: 108, alto: 64 } };
}

const anclaTumbada = (c: Tumbado): Ejercicio['ancla'] => ({ punto: 'cadera', x: c.cadera.x, y: c.cadera.y, segmento: 'tronco', angulo: c.tronco });

/** Dónde toca la carga el pecho en cada apoyo: más arriba en el inclinado, más abajo en el declinado. */
const T_PECHO: Readonly<Record<Apoyo, number>> = { plano: 0.72, inclinado: 0.88, declinado: 0.66, suelo: 0.7 };

/**
 * Press tumbado con antebrazo vertical (barra o mancuernas). `bajo`: cuánto
 * más baja la mano respecto al pecho (las mancuernas bajan un poco más; el
 * agarre cerrado toca más abajo con `t`). En el suelo, abajo es cuando el
 * codo toca el suelo.
 */
export function press(apoyo: Apoyo, opciones: { t?: number; sobrePecho?: number } = {}): Parte {
  const b = tumbada(apoyo);
  const c = b.cuerpo;
  const t = opciones.t ?? T_PECHO[apoyo];
  let abajo = puntoTronco(c, t, grosorPecho(t) + (opciones.sobrePecho ?? 1.5));
  // En el suelo, el codo apoyado (su radio, 3,4) para el recorrido.
  if (apoyo === 'suelo') abajo = { x: abajo.x, y: 3.6 + LARGO.antebrazo + LARGO.mano };
  const arriba = manoArriba(c);
  return {
    ancla: anclaTumbada(c),
    poses: posesPress(c, abajo, arriba, b.cuello),
    cicloMs: CICLO_PRESS,
    esfuerzo: [...ESFUERZO_PRESS],
    // Abajo el brazo tapa el pecho: la ficha enseña la carga arriba.
    msFicha: 250,
    escenario: b.escenario,
    encuadre: b.encuadre,
  };
}

/** Aperturas tumbado: de brazos sobre los hombros a brazos en cruz (en el suelo, hasta que el codo lo toca). */
export function aperturas(apoyo: Apoyo): Parte {
  const b = tumbada(apoyo);
  const c = b.cuerpo;
  const fondo = apoyo === 'suelo' ? 0.85 : 0.95;
  const p = (ms: number, u: number) => poseApertura(c, ms, u, b.cuello);
  return {
    ancla: anclaTumbada(c),
    poses: [p(0, 0), p(500, 0), p(1300, fondo * 0.4), p(2000, fondo * 0.75), p(2600, fondo), p(2900, fondo), p(3400, fondo * 0.6), p(4000, 0)],
    cicloMs: 4400,
    esfuerzo: [{ desde: 2900, hasta: 4000 }],
    msFicha: 250,
    escenario: b.escenario,
    encuadre: b.encuadre,
  };
}

// ── Boca abajo: flexiones ───────────────────────────────────────────────────

export type Flexion = 'normal' | 'rodillas' | 'inclinada' | 'declinada' | 'diamante' | 'abierta' | 'pliometrica' | 'isometrica';

/** Pie de las flexiones: casi vertical, apoyado en las puntas (el de la plancha). */
const PIE = -100;
/** Separación del pecho al suelo (o al banco) abajo, medida en el eje del hombro. */
const HOMBRO_ABAJO = 12.5;
const BRAZO_ARRIBA = 36.4;

interface Montaje {
  apoyo: Prono;
  /** Altura de la superficie de las manos. */
  manos: number;
  escenario: Escenario[];
  encuadre: Ejercicio['encuadre'];
}

function montaje(tipo: Flexion): Montaje {
  if (tipo === 'rodillas') {
    // Apoyo en las rodillas (radio 4), piernas dobladas hacia arriba y cruzadas en los tobillos.
    return { apoyo: { apoyo: 'rodilla', en: { x: -22, y: 4 }, fijo: 140 }, manos: 0, escenario: [], encuadre: { x: -62, y: -4, ancho: 116, alto: 60 } };
  }
  if (tipo === 'inclinada') {
    // Manos en el borde de un banco: el cuerpo, más vertical, carga menos peso.
    return {
      // Con el cuerpo tan inclinado el pie queda menos vertical (tobillo dentro de su rango).
      apoyo: { apoyo: 'tobillo', en: tobilloEnPuntas(-58, PIE + 8), fijo: PIE + 8 },
      manos: ALTO_BANCO,
      escenario: [],
      encuadre: { x: -76, y: -4, ancho: 132, alto: 76 },
    };
  }
  if (tipo === 'declinada') {
    // Pies en el banco: el cuerpo baja hacia la cabeza y carga la parte alta del pecho.
    return {
      apoyo: { apoyo: 'tobillo', en: tobilloEnPuntas(-50, PIE, ALTO_BANCO), fijo: PIE },
      manos: 0,
      escenario: [{ tipo: 'banco', x: -78, ancho: 36, alto: ALTO_BANCO, capa: 'medio' }],
      encuadre: { x: -84, y: -4, ancho: 130, alto: 66 },
    };
  }
  return {
    apoyo: { apoyo: 'tobillo', en: tobilloEnPuntas(-50, PIE), fijo: PIE },
    manos: 0,
    escenario: [],
    encuadre: { x: -66, y: -4, ancho: 118, alto: 58 },
  };
}

/**
 * Flexiones: el cuerpo recto pivota sobre las puntas (o las rodillas), la
 * mano fija en el suelo. Abajo el pecho a un palmo del suelo y el antebrazo
 * casi vertical; arriba los brazos casi estirados.
 */
export function flexion(tipo: Flexion): Parte {
  const m = montaje(tipo);
  const p = m.apoyo;
  const yMano = m.manos + RADIO_MANO;
  const bAbajo = betaConHombroEn(p, m.manos + HOMBRO_ABAJO);
  const sAbajo = puntoDe(p, bAbajo);
  // Manos a la altura del pecho, por detrás del hombro; diamante: juntas bajo
  // el esternón (más atrás); abiertas: algo más adelante.
  const atras = tipo === 'diamante' ? 10 : tipo === 'abierta' ? 4.5 : 6.5;
  const mano: Punto = { x: sAbajo.x - atras, y: yMano };
  // Abajo, antebrazo vertical: el brazo sale del plano lo que haga falta para
  // llegar del hombro al codo (codos a unos 45° del tronco; abiertas, más).
  const codoAbajo = { x: mano.x, y: yMano + LARGO.antebrazo + LARGO.mano };
  const escAbajo = Math.round((largo(menos(codoAbajo, sAbajo)) / LARGO.brazo) * 1000) / 1000;
  const escArriba = tipo === 'abierta' ? 0.88 : 1;
  // Arriba, brazos casi estirados (lo que dé de sí el brazo que se ve).
  const estirado = Math.min(BRAZO_ARRIBA, (LARGO.brazo * escArriba + LARGO.antebrazo + LARGO.mano) * 0.985);
  const bArriba = betaConBrazoA(p, mano, estirado, bAbajo + 1);
  const f = (ms: number, b: number, e: number, en: Punto = mano) => poseFlexion(p, ms, b, en, e);
  // Un punto del recorrido: u = 0 abajo, 1 arriba (el ángulo del cuerpo y el escorzo, en proporción).
  const en = (ms: number, u: number) => f(ms, bAbajo + (bArriba - bAbajo) * u, Math.round((escAbajo + (escArriba - escAbajo) * u) * 1000) / 1000);
  const ancla: Ejercicio['ancla'] =
    p.apoyo === 'tobillo'
      ? { punto: 'tobillo_c', x: p.en.x, y: p.en.y, segmento: 'pie_c', angulo: p.fijo }
      : { punto: 'rodilla_c', x: p.en.x, y: p.en.y, segmento: 'muslo_c', angulo: r1(bArriba + 180) };
  // En la inclinada el banco se pone bajo las manos.
  const escenario: Escenario[] =
    tipo === 'inclinada' ? [{ tipo: 'banco', x: r1(mano.x - 5), ancho: 46, alto: ALTO_BANCO, capa: 'medio' }] : m.escenario;
  const base = { ancla, escenario, encuadre: m.encuadre };
  if (tipo === 'isometrica') {
    // Se aguanta a medio camino de abajo (codos a unos 90°).
    return { ...base, poses: [en(0, 0.35), en(2000, 0.35)], cicloMs: 4000, esfuerzo: [{ desde: 0, hasta: 4000 }] };
  }
  if (tipo === 'pliometrica') {
    // Bajada controlada y empuje explosivo: las manos se despegan y el cuerpo cae en la posición de arriba.
    const vuelo: Punto = { x: mano.x + 1, y: yMano + 5 };
    const bVuelo = betaConBrazoA(p, vuelo, estirado + 0.2, bArriba);
    return {
      ...base,
      poses: [
        en(0, 1),
        en(300, 1),
        en(500, 0.8),
        en(700, 0.6),
        en(900, 0.4),
        en(1050, 0.2),
        en(1150, 0),
        en(1250, 0),
        en(1340, 0.33),
        en(1430, 0.66),
        en(1520, 1),
        f(1780, bVuelo, escArriba, vuelo),
        en(2000, 1),
      ],
      cicloMs: 2800,
      esfuerzo: [{ desde: 1250, hasta: 1780 }],
      msFicha: 1200,
    };
  }
  return {
    ...base,
    poses: [
      en(0, 1),
      en(400, 1),
      en(670, 0.83),
      en(930, 0.67),
      en(1200, 0.5),
      en(1470, 0.33),
      en(1730, 0.17),
      en(2000, 0),
      en(2300, 0),
      en(2500, 0.17),
      en(2700, 0.33),
      en(2900, 0.5),
      en(3100, 0.67),
      en(3300, 0.83),
      en(3500, 1),
    ],
    cicloMs: 3900,
    esfuerzo: [{ desde: 2300, hasta: 3500 }],
    // A media bajada: abajo el antebrazo tapa el pecho y arriba lo tapa el brazo.
    msFicha: 1200,
  };
}

function puntoDe(p: Prono, beta: number): Punto {
  const d = dir(beta);
  const hasta = p.apoyo === 'tobillo' ? LARGO.muslo + LARGO.pierna : LARGO.muslo;
  return { x: p.en.x + d.x * (hasta + LARGO.tronco), y: p.en.y + d.y * (hasta + LARGO.tronco) };
}

// ── Fondos en paralelas ─────────────────────────────────────────────────────

/** Altura de la barra de las paralelas (el centro del puño). */
export const ALTO_PARALELA = 62;
const MANO_PARALELA: Punto = { x: 0, y: ALTO_PARALELA };
/** Piernas dobladas hacia atrás: muslo casi vertical, pierna hacia atrás. */
const PIERNAS_FONDO = { muslo: -100, pierna: 200, pie: 265 } as const;

interface Fase {
  hombro: Punto;
  tronco: number;
}
// Arriba: brazos casi estirados y el tronco algo inclinado. Abajo: brazo
// paralelo al suelo, codo detrás y el tronco más inclinado (carga el pecho).
const FONDO_ARRIBA: Fase = { hombro: { x: 3.2, y: ALTO_PARALELA + 36.3 }, tronco: 72 };
const FONDO_MEDIO: Fase = { hombro: { x: 10, y: ALTO_PARALELA + 27.5 }, tronco: 60 };
const FONDO_ABAJO: Fase = { hombro: { x: 15.3, y: ALTO_PARALELA + 18.2 }, tronco: 50 };

const fondo = (ms: number, f: Fase, esc: number) => poseFondo(ms, MANO_PARALELA, f.hombro, f.tronco, PIERNAS_FONDO, esc);

/** Fondos en paralelas para pecho; `negativo`: bajada de 3,4 s y subida rápida con ayuda de un salto. */
export function fondos(negativo: boolean): Parte {
  const escenario: Escenario[] = [{ tipo: 'paralelas', x: -30, ancho: 54, alto: ALTO_PARALELA, capa: 'medio' }];
  const ancla: Ejercicio['ancla'] = { punto: 'agarre_c', x: MANO_PARALELA.x, y: MANO_PARALELA.y, segmento: 'antebrazo_c', angulo: fondo(0, FONDO_ARRIBA, 1).angulo ?? -90 };
  const encuadre = { x: -54, y: -4, ancho: 100, alto: 126 };
  if (negativo) {
    return {
      ancla,
      poses: [
        fondo(0, FONDO_ARRIBA, 1),
        fondo(600, FONDO_ARRIBA, 1),
        fondo(2300, FONDO_MEDIO, 0.95),
        fondo(4000, FONDO_ABAJO, 0.9),
        fondo(4300, FONDO_ABAJO, 0.9),
        fondo(4900, FONDO_MEDIO, 0.95),
        fondo(5500, FONDO_ARRIBA, 1),
      ],
      cicloMs: 6000,
      esfuerzo: [{ desde: 600, hasta: 4000 }],
      msFicha: 4150,
      escenario,
      encuadre,
    };
  }
  return {
    ancla,
    poses: [
      fondo(0, FONDO_ARRIBA, 1),
      fondo(400, FONDO_ARRIBA, 1),
      fondo(1300, FONDO_MEDIO, 0.95),
      fondo(2200, FONDO_ABAJO, 0.9),
      fondo(2500, FONDO_ABAJO, 0.9),
      fondo(3100, FONDO_MEDIO, 0.95),
      fondo(3700, FONDO_ARRIBA, 1),
    ],
    cicloMs: 4100,
    esfuerzo: [{ desde: 2500, hasta: 3700 }],
    // Abajo el brazo va hacia atrás y deja ver el pecho entero.
    msFicha: 2350,
    escenario,
    encuadre,
  };
}


// ── Pec deck ────────────────────────────────────────────────────────────────

/** Sentado de frente: muslos hacia la cámara (se ven cortos) y piernas verticales. */
const PIERNAS_SENTADO: Pick<Extremidades, 'cadera' | 'rodilla' | 'tobillo'> = { cadera: 14, rodilla: 14, tobillo: 0 };
const ESC_MUSLO = 0.3;
/** Altura de la cadera: el muslo visto corto y la pierna vertical hasta el tobillo (y = 4). */
const CADERA_SENTADO = r1(4 + LARGO.pierna + LARGO.muslo * ESC_MUSLO * Math.cos((14 * Math.PI) / 180));
/** Los ejes de las palancas, encima de los hombros. */
export const PIVOTE_PEC_DECK = 12.5;

export function maquinaPecDeck(): Parte {
  const p = (ms: number, a: number): Pose => posePecDeck(ms, a, PIERNAS_SENTADO, ESC_MUSLO);
  const cadera = CADERA_SENTADO;
  return {
    ancla: { punto: 'cadera', x: 0, y: cadera, segmento: 'tronco', angulo: 90 },
    poses: [
      p(0, 0),
      p(300, 0),
      p(900, 45),
      p(1300, 86),
      p(1340, 94),
      p(1700, 120),
      p(2000, 120),
      p(2550, 94),
      p(2590, 86),
      p(3100, 45),
      p(3800, 0),
    ],
    cicloMs: 4100,
    esfuerzo: [{ desde: 300, hasta: 1700 }],
    // Abierto: los brazos dejan el pecho a la vista.
    msFicha: 150,
    escenario: [
      { tipo: 'pec_deck', x: 0, alto: r1(cadera - 7), respaldo: r1(cadera + 46), travesano: 100, pivote: PIVOTE_PEC_DECK, capa: 'fondo' },
    ],
    encuadre: { x: -48, y: -4, ancho: 96, alto: 112 },
  };
}
