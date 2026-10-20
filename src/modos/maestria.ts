// NIVL · Modos: la maestría de cada modo por marcas, MK I a MK V (puro, con test).
//
// Propuesta P07 («el plus» de RANKING.md). La maestría NO es economía: es una
// LECTURA de la XP por modo que ya existe (`mode_xp`, migración 0068, la suma
// un trigger con lo pagado en `completions` y nunca baja). No da XP, no quita
// XP, no multiplica nada y no tiene estado en el servidor: la marca se deduce
// de la XP en cada lectura. Las pasivas de la P06 quedan fuera (fase 2).
//
// ── Los umbrales y su porqué ───────────────────────────────────────────
// Cada marca se ancla a un NIVEL del modo, y el nivel sale de la misma curva
// que el global (game.ts: el nivel N→N+1 cuesta round(100 × N^1,5)). Así el
// umbral en XP es la XP acumulada para llegar a ese nivel (`xpParaNivel`):
//
//   marca   nivel   XP del modo   a 100 XP/día   a 300 XP/día (techo)
//   MK I      1          0         desde el día 1
//   MK II     4        903         ~9 días        ~3 días
//   MK III    7      4.291         ~6 semanas     ~2 semanas
//   MK IV     9      8.406         ~12 semanas    ~4 semanas
//   MK V     12     17.916         ~6 meses       ~2 meses
//
// Ritmo de referencia: el presupuesto de un día cumplido es 150 a 300 XP
// (skill nivl-game-design) y se reparte entre NIVL y los modos; un modo en el
// que se trabaja a diario recibe del orden de 100 XP/día (una difícil o dos
// medias con su etiqueta). 300 XP/día es el techo: el día entero, todo
// etiquetado con el mismo modo. Con eso:
//   · MK II cae en la primera o segunda semana: el primer marco nuevo llega
//     mientras el hábito aún se está formando (refuerzo temprano).
//   · Los saltos se alargan (9 → 34 → 42 → 95 días a ritmo de referencia):
//     cada marca cuesta más que la anterior, como los rangos.
//   · MK V es un logro de MESES: unos 6 a ritmo de referencia y ni con el día
//     entero dedicado baja de ~60 días. No hay forma de comprarlo en días.
// Como la XP por modo no baja (0068), la marca tampoco: lo ganado no se pierde.

import { xpCostForLevel } from '@/lib/game';

export type Marca = 1 | 2 | 3 | 4 | 5;

export const MARCAS: readonly Marca[] = [1, 2, 3, 4, 5];
export const MARCA_MAXIMA: Marca = 5;

/** El nivel del modo con el que se entra en cada marca. */
export const NIVEL_MARCA: Readonly<Record<Marca, number>> = { 1: 1, 2: 4, 3: 7, 4: 9, 5: 12 };

/** XP de referencia por día en un modo trabajado a diario (documentación y tests). */
export const RITMO_REFERENCIA_XP_DIA = 100;
/** Techo realista por día en un solo modo: el presupuesto diario entero. */
export const RITMO_TECHO_XP_DIA = 300;

/** XP acumulada para llegar al nivel `nivel` (nivel 1 = 0), con la curva de game.ts. */
export function xpParaNivel(nivel: number): number {
  let total = 0;
  for (let n = 1; n < Math.max(1, Math.floor(nivel)); n++) total += xpCostForLevel(n);
  return total;
}

/** XP del modo con la que se entra en cada marca. */
export const UMBRAL_MARCA: Readonly<Record<Marca, number>> = {
  1: xpParaNivel(NIVEL_MARCA[1]),
  2: xpParaNivel(NIVEL_MARCA[2]),
  3: xpParaNivel(NIVEL_MARCA[3]),
  4: xpParaNivel(NIVEL_MARCA[4]),
  5: xpParaNivel(NIVEL_MARCA[5]),
};

export function esMarca(v: unknown): v is Marca {
  return v === 1 || v === 2 || v === 3 || v === 4 || v === 5;
}

/** XP limpia: número finito y no negativo (basura o null → 0). */
function xpLimpia(xp: unknown): number {
  const n = typeof xp === 'number' ? xp : typeof xp === 'string' ? Number(xp) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** La marca que corresponde a una XP de modo. */
export function marcaDeXp(xp: unknown): Marca {
  const total = xpLimpia(xp);
  let marca: Marca = 1;
  for (const m of MARCAS) if (total >= UMBRAL_MARCA[m]) marca = m;
  return marca;
}

export interface ProgresoMarca {
  marca: Marca;
  /** null en MK V. */
  siguiente: Marca | null;
  xp: number;
  /** XP con la que se entró en esta marca. */
  desde: number;
  /** XP de la siguiente marca (null en MK V). */
  hasta: number | null;
  /** XP ganada dentro de esta marca. */
  xpEnMarca: number;
  /** Lo que falta para la siguiente (0 en MK V). */
  faltan: number;
  /** 0 a 1 dentro de la marca; 1 en MK V. */
  ratio: number;
}

/** Marca y progreso hacia la siguiente. */
export function progresoMarca(xp: unknown): ProgresoMarca {
  const total = xpLimpia(xp);
  const marca = marcaDeXp(total);
  const desde = UMBRAL_MARCA[marca];
  if (marca === MARCA_MAXIMA) {
    return { marca, siguiente: null, xp: total, desde, hasta: null, xpEnMarca: total - desde, faltan: 0, ratio: 1 };
  }
  const siguiente = (marca + 1) as Marca;
  const hasta = UMBRAL_MARCA[siguiente];
  const tramo = hasta - desde;
  const xpEnMarca = total - desde;
  return {
    marca,
    siguiente,
    xp: total,
    desde,
    hasta,
    xpEnMarca,
    faltan: Math.max(0, hasta - total),
    ratio: tramo > 0 ? Math.min(1, Math.max(0, xpEnMarca / tramo)) : 0,
  };
}

/**
 * ¿Ha subido de marca entre dos lecturas? Devuelve la marca nueva o null.
 * Sin lectura anterior (`antes` null o basura: primera vez en este teléfono,
 * o quien ya tenía XP al llegar la maestría) NO hay subida: esa lectura es la
 * base, no se celebra lo que no se ha visto ganar. Si se saltan varias marcas
 * de golpe, se celebra solo la última.
 */
export function subidaDeMarca(antes: unknown, ahora: Marca): Marca | null {
  if (!esMarca(antes)) return null;
  return ahora > antes ? ahora : null;
}

const ROMANOS: Readonly<Record<Marca, string>> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };

/** «I» a «V». */
export function romanoMarca(m: Marca): string {
  return ROMANOS[m];
}

/** Días hasta una XP a un ritmo dado (para documentar y probar la curva). */
export function diasHasta(xp: number, xpPorDia: number): number {
  return xpPorDia > 0 ? Math.ceil(Math.max(0, xp) / xpPorDia) : Infinity;
}

/**
 * La cabecera que llevaría la marca al coach (`x-nivl-mk`: «1» a «5»).
 * PREPARADA Y APAGADA: src/lib/coach.ts no la envía hasta que el servidor la
 * lea (ver el comentario de `cabecerasMarcaCoach` allí). Sin marca, nada.
 */
export function cabeceraMarca(marca: unknown): Record<string, string> {
  return esMarca(marca) ? { 'x-nivl-mk': String(marca) } : {};
}
