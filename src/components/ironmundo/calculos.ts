// NIVL · Mundo IRON: las cuentas de las pantallas (puras, sin Supabase ni
// i18n; test en __tests__/calculos.test.ts). Solo resumen datos que ya existen
// (rutina, prescripción del coach, cardio, peso): ninguna toca XP.

import { kcalCardio, type TipoCardio, type ZonaCardio } from '@/lib/bodymath';

/** Lo mínimo de un día de rutina y de sus ejercicios (GymDay, GymExercise). */
export interface DiaRutina {
  id: string;
  day_of_week: number;
  name: string;
}
export interface EjercicioRutina {
  id: string;
  gym_day_id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number | null;
  position: number;
}
/** Lo mínimo de lo que prescribe el coach para hoy (Prescription). */
export interface Prescrito {
  id: string;
  exercise_name: string;
  sets: number;
  reps: string;
  weight: number | null;
  position: number;
}

export interface FilaEntreno {
  clave: string;
  nombre: string;
  series: number;
  /** «5», «8-10» o «45 s»: tal cual lo dio la rutina o el coach. */
  reps: string;
  kg: number | null;
}

export interface EntrenoDeHoy {
  /** El día de la rutina que toca hoy; null si hoy no hay rutina (descanso). */
  dia: DiaRutina | null;
  filas: FilaEntreno[];
  /** Series de todo el entreno. */
  series: number;
  /** Minutos estimados (unos 3,5 por serie con su descanso, a múltiplos de 5). */
  minutos: number;
  /** Las filas son lo que ha prescrito el coach para hoy (manda sobre la rutina). */
  delCoach: boolean;
}

/** Minutos de un entreno de `series` series: ~3,5 por serie, a 5, nunca menos de 10. */
export function minutosEntreno(series: number): number {
  if (!(series > 0)) return 0;
  return Math.max(10, Math.round((series * 3.5) / 5) * 5);
}

/**
 * El entreno de hoy: el día de la rutina de este día de la semana y, si el
 * coach ha prescrito algo para hoy, sus cargas (es lo que hay que levantar).
 */
export function entrenoDeHoy(p: {
  dias: readonly DiaRutina[];
  ejercicios: readonly EjercicioRutina[];
  prescrito: readonly Prescrito[];
  hoyDia: number;
}): EntrenoDeHoy {
  const dia = p.dias.find((d) => d.day_of_week === p.hoyDia) ?? null;
  const delCoach = p.prescrito.length > 0;
  const filas: FilaEntreno[] = delCoach
    ? [...p.prescrito]
        .sort((a, b) => a.position - b.position)
        .map((x) => ({ clave: x.id, nombre: x.exercise_name, series: Math.max(1, x.sets), reps: x.reps, kg: x.weight }))
    : dia
      ? p.ejercicios
          .filter((e) => e.gym_day_id === dia.id)
          .sort((a, b) => a.position - b.position)
          .map((e) => ({ clave: e.id, nombre: e.name, series: Math.max(1, e.sets), reps: String(e.reps), kg: e.weight }))
      : [];
  const series = filas.reduce((s, f) => s + f.series, 0);
  return { dia, filas, series, minutos: minutosEntreno(series), delCoach };
}

/** Los ejercicios de un día, en su orden. */
export function ejerciciosDe<E extends EjercicioRutina>(diaId: string, ejercicios: readonly E[]): E[] {
  return ejercicios.filter((e) => e.gym_day_id === diaId).sort((a, b) => a.position - b.position);
}

// ── Peso corporal ────────────────────────────────────────────────────

export interface Pesaje {
  date: string;
  weight_kg: number;
}

export interface ResumenPeso {
  ultimo: number | null;
  fecha: string | null;
  /** Kilos frente al pesaje de hace ~30 días (el más cercano dentro de la ventana); null sin dos pesajes. */
  cambio30: number | null;
  /** Los pesos de la gráfica, del más antiguo al último (hasta `puntos`). */
  serie: number[];
  /** Mínimo y máximo de la serie (los ejes de la gráfica). */
  min: number | null;
  max: number | null;
}

function restarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

const red = (n: number, dec = 1) => Math.round(n * 10 ** dec) / 10 ** dec;

export function resumenPeso(pesajes: readonly Pesaje[], puntos = 30): ResumenPeso {
  const lista = [...pesajes].filter((p) => p.weight_kg > 0).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const ultimo = lista[lista.length - 1];
  if (!ultimo) return { ultimo: null, fecha: null, cambio30: null, serie: [], min: null, max: null };
  const desde = restarDias(ultimo.date, 30);
  const base = lista.find((p) => p.date >= desde);
  const cambio30 = base && base !== ultimo ? red(ultimo.weight_kg - base.weight_kg) : null;
  const serie = lista.slice(-puntos).map((p) => p.weight_kg);
  return { ultimo: ultimo.weight_kg, fecha: ultimo.date, cambio30, serie, min: Math.min(...serie), max: Math.max(...serie) };
}

// ── Cardio ───────────────────────────────────────────────────────────

/** Lo mínimo de una sesión de cardio (CardioSession). */
export interface SesionCardio {
  date: string;
  kind: TipoCardio;
  zone: ZonaCardio;
  distance_km: number | null;
  duration_min: number;
}

export interface ResumenCardio {
  sesiones: number;
  km: number;
  minutos: number;
  /** Calorías estimadas de todas las sesiones (null si ninguna se pudo estimar). */
  kcal: number | null;
  /** Minutos por semana, de la más antigua a la actual (4 semanas de 7 días que acaban hoy). */
  semanas: number[];
}

/** Las últimas 4 semanas (28 días que acaban hoy). */
export function resumenCardio(sesiones: readonly SesionCardio[], hoy: string, pesoKg: number | null): ResumenCardio {
  const desde = restarDias(hoy, 27);
  const dentro = sesiones.filter((s) => s.date >= desde && s.date <= hoy);
  const semanas = [0, 0, 0, 0];
  let km = 0;
  let minutos = 0;
  let kcal: number | null = null;
  for (const s of dentro) {
    const dur = Number(s.duration_min) || 0;
    km += Number(s.distance_km) || 0;
    minutos += dur;
    const e = kcalSesion(s, pesoKg);
    if (e !== null) kcal = (kcal ?? 0) + e;
    const atras = Math.round((Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${s.date}T00:00:00Z`)) / 86400000);
    const i = 3 - Math.floor(atras / 7);
    if (i >= 0 && i <= 3) semanas[i]! += dur;
  }
  return { sesiones: dentro.length, km: red(km, 2), minutos: red(minutos, 1), kcal, semanas: semanas.map((m) => red(m, 1)) };
}

/** Calorías estimadas de una sesión (MET de bodymath). */
export function kcalSesion(s: SesionCardio, pesoKg: number | null): number | null {
  return kcalCardio({
    tipo: s.kind,
    zona: s.zone,
    minutos: Number(s.duration_min) || 0,
    km: s.distance_km === null ? null : Number(s.distance_km),
    pesoKg,
  });
}

// ── Agua ─────────────────────────────────────────────────────────────

/** Un vaso son 250 ml; el objetivo de la pantalla, 8 vasos (2 l), o el que se le pase. */
export const ML_VASO = 250;
export const VASOS_OBJETIVO = 8;

/** Vasos llenos (redondeando hacia abajo) de `ml`. */
export function vasosDe(ml: number): number {
  return Math.max(0, Math.floor((Number(ml) || 0) / ML_VASO));
}

/** Tocar el vaso `i` (0 a 7): si ya estaba lleno y es el último lleno, se vacía; si no, se llena hasta él. */
export function mlAlTocarVaso(ml: number, i: number): number {
  const llenos = vasosDe(ml);
  return (llenos === i + 1 ? i : i + 1) * ML_VASO;
}
