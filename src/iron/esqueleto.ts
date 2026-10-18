// NIVL · IRON · Motor: el esqueleto (cinemática directa en 2D).
//
// A partir de los ángulos de una pose y del ancla, calcula dónde está cada
// articulación. Puro y sin dependencias: corre en Node (tests), en el hilo de
// JS y en el de la interfaz (las funciones llevan 'worklet' para Reanimated).
//
// Cómo funciona:
// 1. Ángulos absolutos: se parte del segmento del ancla (su ángulo es dato) y
//    se recorre el grafo de articulaciones hacia fuera. Cada articulación dice
//    hijo = padre + base + signo × ángulo; al subir por la cadena (del pie a la
//    cadera, por ejemplo) se despeja al revés.
// 2. Posiciones: con la cadera en el origen se encadenan los segmentos; luego
//    se traslada todo para que el punto del ancla caiga donde dice el ancla.
// Medidas en unidades de cuerpo (100 ≈ la altura de pie), sacadas de las
// proporciones antropométricas clásicas (Drillis y Contini, Winter).

import type { Ancla, Extremidades, PuntoId, SegmentoId, Vista } from './tipos';

export interface Punto {
  x: number;
  y: number;
}

/** Largo de cada segmento en unidades de cuerpo. */
export const LARGO = {
  tronco: 30,
  cabeza: 12,
  muslo: 24.5,
  pierna: 24.5,
  pie: 12,
  brazo: 18.5,
  antebrazo: 15,
  /** De la muñeca al centro del puño (donde va la barra o la mancuerna). */
  mano: 3.5,
  /** Altura del tobillo sobre la planta. */
  tobillo: 4,
} as const;

/** Media anchura de hombros y caderas en la vista frontal. */
export const MEDIA_ANCHURA = { hombro: 12.5, cadera: 8.5 } as const;

type Base = 'tronco' | 'cabeza' | 'muslo' | 'pierna' | 'pie' | 'brazo' | 'antebrazo';

interface DefSegmento {
  id: SegmentoId;
  base: Base;
  desde: PuntoId;
  hasta: PuntoId;
  lado: 'c' | 'l' | null;
}

export const SEGMENTOS: readonly DefSegmento[] = [
  { id: 'tronco', base: 'tronco', desde: 'cadera', hasta: 'hombro', lado: null },
  { id: 'cabeza', base: 'cabeza', desde: 'hombro', hasta: 'cabeza', lado: null },
  { id: 'muslo_c', base: 'muslo', desde: 'cadera', hasta: 'rodilla_c', lado: 'c' },
  { id: 'pierna_c', base: 'pierna', desde: 'rodilla_c', hasta: 'tobillo_c', lado: 'c' },
  { id: 'pie_c', base: 'pie', desde: 'tobillo_c', hasta: 'punta_c', lado: 'c' },
  { id: 'brazo_c', base: 'brazo', desde: 'hombro', hasta: 'codo_c', lado: 'c' },
  { id: 'antebrazo_c', base: 'antebrazo', desde: 'codo_c', hasta: 'muneca_c', lado: 'c' },
  { id: 'muslo_l', base: 'muslo', desde: 'cadera', hasta: 'rodilla_l', lado: 'l' },
  { id: 'pierna_l', base: 'pierna', desde: 'rodilla_l', hasta: 'tobillo_l', lado: 'l' },
  { id: 'pie_l', base: 'pie', desde: 'tobillo_l', hasta: 'punta_l', lado: 'l' },
  { id: 'brazo_l', base: 'brazo', desde: 'hombro', hasta: 'codo_l', lado: 'l' },
  { id: 'antebrazo_l', base: 'antebrazo', desde: 'codo_l', hasta: 'muneca_l', lado: 'l' },
];

type ClaveAngulo = keyof Extremidades | 'cuello';

interface DefArticulacion {
  padre: SegmentoId;
  hijo: SegmentoId;
  /** hijo = padre + base + signo × ángulo (vista lateral). */
  base: number;
  signo: 1 | -1;
  clave: ClaveAngulo;
  lado: 'c' | 'l' | null;
}

const art = (padre: Base, hijo: Base, base: number, signo: 1 | -1, clave: ClaveAngulo): DefArticulacion[] => {
  const unir = (b: Base, l: 'c' | 'l'): SegmentoId => (b === 'tronco' || b === 'cabeza' ? b : (`${b}_${l}` as SegmentoId));
  return (['c', 'l'] as const).map((l) => ({ padre: unir(padre, l), hijo: unir(hijo, l), base, signo, clave, lado: l }));
};

export const ARTICULACIONES_DEF: readonly DefArticulacion[] = [
  { padre: 'tronco', hijo: 'cabeza', base: 0, signo: -1, clave: 'cuello', lado: null },
  ...art('tronco', 'muslo', 180, 1, 'cadera'),
  ...art('muslo', 'pierna', 0, -1, 'rodilla'),
  ...art('pierna', 'pie', 90, 1, 'tobillo'),
  ...art('tronco', 'brazo', 180, 1, 'hombro'),
  ...art('brazo', 'antebrazo', 0, 1, 'codo'),
];

/** Los ángulos que necesita el esqueleto en un instante. */
export interface AngulosPose {
  cuello: number;
  cerca: Extremidades;
  lejos: Extremidades;
  /** Ángulo absoluto del segmento del ancla. */
  angulo: number;
  escorzo: Partial<Record<SegmentoId, number>>;
  /** Muñeca (los dos lados); sin ella, la mano sigue al antebrazo. */
  muneca?: number;
  /** Dónde cae el punto del ancla en este instante (saltos); si no, el del ancla. */
  punto?: Punto;
}

export interface Esqueleto {
  /** Posición de cada punto, en el mundo (y hacia arriba). */
  p: Record<PuntoId, Punto>;
  /** Ángulo absoluto de cada segmento, en grados. */
  a: Record<SegmentoId, number>;
  /** Largo con que se ve cada segmento (con el escorzo aplicado). */
  l: Record<SegmentoId, number>;
}

const RAD = Math.PI / 180;

export function dir(grados: number): Punto {
  'worklet';
  return { x: Math.cos(grados * RAD), y: Math.sin(grados * RAD) };
}

function valorArticulacion(def: DefArticulacion, pose: AngulosPose): number {
  'worklet';
  if (def.clave === 'cuello') return pose.cuello;
  const lado = def.lado === 'l' ? pose.lejos : pose.cerca;
  return lado[def.clave];
}

/**
 * Ángulos absolutos de todos los segmentos. En la vista frontal el lado
 * cercano (el derecho de la persona, a la izquierda de la pantalla) va en
 * espejo: la abducción lo abre hacia -x.
 */
export function angulosAbsolutos(pose: AngulosPose, ancla: Ancla, vista: Vista): Record<SegmentoId, number> {
  'worklet';
  const a: Partial<Record<SegmentoId, number>> = {};
  a[ancla.segmento] = pose.angulo;
  // Como mucho tantas pasadas como articulaciones: el grafo es un árbol.
  for (let pasada = 0; pasada < ARTICULACIONES_DEF.length; pasada++) {
    let cambios = 0;
    for (let i = 0; i < ARTICULACIONES_DEF.length; i++) {
      const def = ARTICULACIONES_DEF[i];
      const espejo = vista === 'frontal' && def.lado === 'c' ? -1 : 1;
      const delta = def.base + espejo * def.signo * valorArticulacion(def, pose);
      const padre = a[def.padre];
      const hijo = a[def.hijo];
      if (padre !== undefined && hijo === undefined) {
        a[def.hijo] = padre + delta;
        cambios++;
      } else if (hijo !== undefined && padre === undefined) {
        a[def.padre] = hijo - delta;
        cambios++;
      }
    }
    if (cambios === 0) break;
  }
  return a as Record<SegmentoId, number>;
}

function largoBase(base: Base): number {
  'worklet';
  return LARGO[base];
}

/** El esqueleto entero en un instante. */
export function construirEsqueleto(pose: AngulosPose, ancla: Ancla, vista: Vista): Esqueleto {
  'worklet';
  const a = angulosAbsolutos(pose, ancla, vista);
  const p: Partial<Record<PuntoId, Punto>> = { cadera: { x: 0, y: 0 } };
  const l: Partial<Record<SegmentoId, number>> = {};
  // Los segmentos están en orden de la cadera hacia fuera: una pasada basta.
  for (let i = 0; i < SEGMENTOS.length; i++) {
    const s = SEGMENTOS[i];
    const escorzo = pose.escorzo[s.id];
    const largo = largoBase(s.base) * (escorzo === undefined ? 1 : escorzo);
    l[s.id] = largo;
    let origen = p[s.desde] as Punto;
    // En la vista frontal brazos y piernas salen de los lados del tronco.
    if (vista === 'frontal' && s.lado !== null && (s.desde === 'hombro' || s.desde === 'cadera')) {
      const media = s.desde === 'hombro' ? MEDIA_ANCHURA.hombro : MEDIA_ANCHURA.cadera;
      const n = dir(a.tronco + 90);
      const k = s.lado === 'c' ? 1 : -1;
      origen = { x: origen.x + n.x * media * k, y: origen.y + n.y * media * k };
    }
    const d = dir(a[s.id]);
    p[s.hasta] = { x: origen.x + d.x * largo, y: origen.y + d.y * largo };
  }
  // El agarre: el centro del puño, en la prolongación del antebrazo.
  for (const lado of ['c', 'l'] as const) {
    const m = p[lado === 'c' ? 'muneca_c' : 'muneca_l'] as Punto;
    // La mano gira en la muñeca como el antebrazo en el codo (vista lateral).
    const muneca = pose.muneca ?? 0;
    const d = dir(a[lado === 'c' ? 'antebrazo_c' : 'antebrazo_l'] + (vista === 'frontal' && lado === 'c' ? -muneca : muneca));
    p[lado === 'c' ? 'agarre_c' : 'agarre_l'] = { x: m.x + d.x * LARGO.mano, y: m.y + d.y * LARGO.mano };
  }
  // Traslado al ancla.
  const fijo = p[ancla.punto] as Punto;
  const destino = pose.punto ?? ancla;
  const dx = destino.x - fijo.x;
  const dy = destino.y - fijo.y;
  const claves = Object.keys(p) as PuntoId[];
  for (let i = 0; i < claves.length; i++) {
    const q = p[claves[i]] as Punto;
    p[claves[i]] = { x: q.x + dx, y: q.y + dy };
  }
  return { p: p as Record<PuntoId, Punto>, a, l: l as Record<SegmentoId, number> };
}

/** Punto a lo largo de un segmento (`t` de 0 a 1) desplazado `normal` unidades a su izquierda. */
export function puntoEnSegmento(e: Esqueleto, seg: SegmentoId, t: number, normal = 0): Punto {
  'worklet';
  let def = SEGMENTOS[0];
  for (let i = 0; i < SEGMENTOS.length; i++) if (SEGMENTOS[i].id === seg) def = SEGMENTOS[i];
  const p0 = e.p[def.desde];
  const d = dir(e.a[seg]);
  const largo = e.l[seg];
  // Normal a la izquierda del sentido del segmento.
  return { x: p0.x + d.x * largo * t - d.y * normal, y: p0.y + d.y * largo * t + d.x * normal };
}

/** Puntos de la planta del pie (talón y punta) en el mundo: para apoyar en el suelo. */
export function planta(e: Esqueleto, lado: 'c' | 'l'): { talon: Punto; punta: Punto } {
  'worklet';
  const t = e.p[lado === 'c' ? 'tobillo_c' : 'tobillo_l'];
  const ang = e.a[lado === 'c' ? 'pie_c' : 'pie_l'];
  const d = dir(ang);
  const n = { x: -d.y, y: d.x };
  const en = (u: number, v: number): Punto => ({ x: t.x + d.x * u + n.x * v, y: t.y + d.y * u + n.y * v });
  return { talon: en(-4.5, -LARGO.tobillo), punta: en(LARGO.pie, -LARGO.tobillo) };
}
