// NIVL · IRON · Tu historial de un ejercicio y la carga de la próxima sesión
// (puro, sin Supabase ni i18n; test en __tests__/historial.test.ts). Los
// datos los trae historialDatos.ts y los pinta HistorialIron.
//
// Las series salen de lo que ya guarda Gimnasio (`gym_lifts`, texto libre en
// `exercise_name`) y se casan con el catálogo por el MISMO casar.ts que
// enseña «Ver técnica»: si la fila no casa, aquí tampoco cuenta.
//
// LA SUGERENCIA ES DETERMINISTA, SIN IA Y ORIENTATIVA. Doble progresión:
// · Series de trabajo = las de la carga más alta de la última sesión.
// · Si TODAS llegaron al tope del rango de repeticiones, la próxima sube la
//   carga (+2,5 kg tren superior, +5 kg tren inferior) y vuelve al suelo del
//   rango.
// · Si no, la misma carga, buscando una repetición más que la serie más floja
//   (sin pasar del tope ni bajar del suelo del rango).
// · Si la última sesión es de hace más de 28 días, la misma carga y el suelo
//   del rango: después de un parón no se sube.
// · Sin carga (peso corporal) no hay sugerencia: no hay kilos que mover.
// El rango sale de tu rutina (repeticiones fijas: el tope y el suelo son el
// mismo número), si no de lo último que prescribió el coach («8-10»), y si no
// de 8 a 12. Nada de esto promete nada: es la regla de una libreta.

import { e1rm } from '@/lib/bodymath';
import type { Ejercicio, MusculoId } from './tipos';

/** Una serie registrada en Gimnasio, con la fecha de su sesión. */
export interface FilaSerie {
  readonly fecha: string; // AAAA-MM-DD
  readonly nombre: string; // exercise_name tal cual
  readonly kg: number;
  readonly reps: number;
  readonly orden: number; // set_index
}

export interface Serie {
  readonly kg: number;
  readonly reps: number;
}

/** Las series de un ejercicio en un día, en el orden en que se hicieron. */
export interface SesionEjercicio {
  readonly fecha: string;
  readonly series: readonly Serie[];
}

/** «3 × 8 × 60 kg»: series consecutivas iguales, juntas. */
export interface Bloque {
  readonly series: number;
  readonly reps: number;
  readonly kg: number;
}

export interface MejorMarca {
  /** 1RM estimado por Epley, redondeado a 0,5 kg. */
  readonly e1rm: number;
  readonly kg: number;
  readonly reps: number;
  readonly fecha: string;
}

export interface RangoReps {
  readonly min: number;
  readonly max: number;
}

export type Tren = 'superior' | 'inferior';

export type MotivoCarga = 'subir' | 'mantener' | 'retomar';

export interface Sugerencia {
  readonly series: number;
  readonly reps: number;
  readonly kg: number;
  readonly motivo: MotivoCarga;
  /** El tope del rango que se usó (para explicar «llegaste a 10»). */
  readonly tope: number;
}

/** Sin rutina ni prescripción: el rango de hipertrofia de toda la vida. */
export const RANGO_POR_DEFECTO: RangoReps = { min: 8, max: 12 };
/** Lo que se sube cuando se completa el rango. */
export const SUBIDA_KG: Readonly<Record<Tren, number>> = { superior: 2.5, inferior: 5 };
/** Más días que estos sin hacerlo y no se sube. */
export const DIAS_PARON = 28;

const MUSCULOS_INFERIORES: ReadonlySet<MusculoId> = new Set<MusculoId>([
  'gluteo',
  'gluteo_medio',
  'cuadriceps',
  'isquiotibiales',
  'aductores',
  'gemelos',
  'soleo',
  'tibial',
]);

/**
 * Tren inferior: los de pierna y los que mueven sobre todo cadera y pierna
 * aunque el catálogo los ponga en espalda (el peso muerto). El resto, superior.
 */
export function trenDe(ej: Pick<Ejercicio, 'grupo' | 'musculos'>): Tren {
  if (ej.grupo === 'pierna') return 'inferior';
  return ej.musculos.principales.some((m) => MUSCULOS_INFERIORES.has(m)) ? 'inferior' : 'superior';
}

/**
 * Las sesiones de un ejercicio, de la más reciente a la más antigua. `idDe`
 * es el casado (catalogo.ts → casar.ts); solo cuentan series con repeticiones.
 */
export function sesionesDe(id: string, filas: readonly FilaSerie[], idDe: (nombre: string) => string | null): SesionEjercicio[] {
  const cache = new Map<string, string | null>();
  const casa = (n: string) => {
    if (!cache.has(n)) cache.set(n, idDe(n));
    return cache.get(n) === id;
  };
  const porFecha = new Map<string, FilaSerie[]>();
  for (const f of filas) {
    if (!(f.reps > 0) || !(f.kg >= 0) || !casa(f.nombre)) continue;
    porFecha.set(f.fecha, [...(porFecha.get(f.fecha) ?? []), f]);
  }
  return [...porFecha.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([fecha, lista]) => ({
      fecha,
      series: [...lista].sort((a, b) => a.orden - b.orden).map((f) => ({ kg: f.kg, reps: f.reps })),
    }));
}

/** Junta las series consecutivas iguales: 60×8, 60×8, 60×7 → [2 × 8 × 60, 1 × 7 × 60]. */
export function bloques(series: readonly Serie[]): Bloque[] {
  const out: Bloque[] = [];
  for (const s of series) {
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo.kg === s.kg && ultimo.reps === s.reps) {
      out[out.length - 1] = { ...ultimo, series: ultimo.series + 1 };
    } else {
      out.push({ series: 1, reps: s.reps, kg: s.kg });
    }
  }
  return out;
}

/** La serie con el mayor 1RM estimado (Epley, hasta 12 repeticiones). Empate: la más reciente. */
export function mejorMarca(sesiones: readonly SesionEjercicio[]): MejorMarca | null {
  let mejor: MejorMarca | null = null;
  for (const s of sesiones) {
    for (const serie of s.series) {
      const est = e1rm(serie.kg, serie.reps);
      if (est === null) continue;
      if (mejor === null || est > mejor.e1rm + 1e-9) {
        mejor = { e1rm: est, kg: serie.kg, reps: serie.reps, fecha: s.fecha };
      }
    }
  }
  return mejor ? { ...mejor, e1rm: redondearMedio(mejor.e1rm) } : null;
}

/**
 * El rango escrito como lo escribe el coach o la rutina: 8 → 8 a 8;
 * «8-10», «8 a 10», «8/10» → 8 a 10. Lo que no se entiende, null.
 */
export function rangoDeTexto(reps: string | number | null | undefined): RangoReps | null {
  if (typeof reps === 'number') return Number.isInteger(reps) && reps > 0 && reps <= 50 ? { min: reps, max: reps } : null;
  if (typeof reps !== 'string') return null;
  const nums = reps.match(/\d+/g)?.map(Number) ?? [];
  if (nums.length === 0 || nums.length > 2) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (min < 1 || max > 50) return null;
  return { min, max };
}

/** Días entre dos fechas AAAA-MM-DD (b - a). */
function diasEntre(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : 0;
}

function redondearMedio(n: number): number {
  return Math.round(n * 2) / 2;
}

/** La carga de la próxima sesión según la doble progresión (cabecera del archivo). */
export function sugerirCarga(p: {
  ultima: SesionEjercicio | undefined;
  rango: RangoReps;
  tren: Tren;
  hoy: string;
}): Sugerencia | null {
  const { ultima, rango, tren, hoy } = p;
  if (!ultima || ultima.series.length === 0) return null;
  const carga = Math.max(...ultima.series.map((s) => s.kg));
  if (!(carga > 0)) return null;
  const trabajo = ultima.series.filter((s) => s.kg === carga);
  const series = trabajo.length;
  const masFloja = Math.min(...trabajo.map((s) => s.reps));

  if (diasEntre(ultima.fecha, hoy) > DIAS_PARON) {
    return { series, reps: rango.min, kg: carga, motivo: 'retomar', tope: rango.max };
  }
  if (masFloja >= rango.max) {
    return { series, reps: rango.min, kg: Math.round((carga + SUBIDA_KG[tren]) * 100) / 100, motivo: 'subir', tope: rango.max };
  }
  const reps = Math.min(rango.max, Math.max(rango.min, masFloja + 1));
  return { series, reps, kg: carga, motivo: 'mantener', tope: rango.max };
}

/** Lo que trae historialDatos.ts, sin casar todavía. */
export interface DatosHistorial {
  readonly filas: readonly FilaSerie[];
  /** La rutina semanal (`gym_exercises`): nombre y repeticiones. */
  readonly rutina: readonly { readonly nombre: string; readonly reps: number }[];
  /** Lo prescrito por el coach, del más reciente al más antiguo. */
  readonly prescripciones: readonly { readonly nombre: string; readonly reps: string }[];
}

export interface ResumenHistorial {
  /** Las últimas sesiones, de la más reciente a la más antigua (como mucho `cuantas`). */
  readonly sesiones: readonly SesionEjercicio[];
  readonly total: number;
  readonly mejor: MejorMarca | null;
  readonly sugerencia: Sugerencia | null;
}

/** Todo lo que pinta la ficha para un ejercicio del catálogo. */
export function resumenHistorial(
  ej: Pick<Ejercicio, 'id' | 'grupo' | 'musculos'>,
  datos: DatosHistorial,
  idDe: (nombre: string) => string | null,
  hoy: string,
  cuantas = 5,
): ResumenHistorial {
  const todas = sesionesDe(ej.id, datos.filas, idDe);
  const rutina = datos.rutina.find((r) => idDe(r.nombre) === ej.id);
  const prescrita = datos.prescripciones.find((p) => idDe(p.nombre) === ej.id);
  return {
    sesiones: todas.slice(0, cuantas),
    total: todas.length,
    mejor: mejorMarca(todas),
    sugerencia: sugerirCarga({ ultima: todas[0], rango: elegirRango(rutina?.reps, prescrita?.reps), tren: trenDe(ej), hoy }),
  };
}

/** El rango que manda: la rutina, si no lo último que prescribió el coach, si no 8 a 12. */
export function elegirRango(rutina: number | null | undefined, prescripcion: string | null | undefined): RangoReps {
  return rangoDeTexto(rutina) ?? rangoDeTexto(prescripcion) ?? RANGO_POR_DEFECTO;
}
