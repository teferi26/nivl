// NIVL · Matemática del cuerpo, sin efectos.
//
// Vive aparte de `bodywork.ts` por la razón de siempre: ese módulo importa
// Supabase, y eso arrastra AsyncStorage, y con AsyncStorage dentro los tests
// de este archivo no arrancarían. Aquí solo hay números.

import { EDAD_MINIMA } from './consentmath';

/** Ritmo en minutos por kilómetro, formateado como 5:42. */
export function paceOf(distanciaKm: number | null, duracionMin: number): string | null {
  if (!distanciaKm || distanciaKm <= 0 || duracionMin <= 0) return null;
  const minPorKm = duracionMin / distanciaKm;
  const m = Math.floor(minPorKm);
  const s = Math.round((minPorKm - m) * 60);
  // 59,7 segundos redondea a 60: eso no es "5:60", es el minuto siguiente.
  if (s === 60) return `${m + 1}:00`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * 1RM estimado por la fórmula de Epley: peso × (1 + reps/30).
 *
 * Por encima de 12 repeticiones sobreestima tanto que deja de servir para
 * decidir cargas, así que esas series no producen estimación.
 */
export function e1rm(peso: number, reps: number): number | null {
  if (peso <= 0 || reps <= 0 || reps > 12) return null;
  return peso * (1 + reps / 30);
}

/**
 * Pendiente por mínimos cuadrados en unidades por día. Para el peso corporal:
 * con una báscula que oscila ±1 kg de un día para otro, el último dato es
 * ruido y la pendiente es la señal.
 */
export function pendientePorDia(puntos: { x: number; y: number }[]): number | null {
  const n = puntos.length;
  if (n < 3) return null;
  const mx = puntos.reduce((s, p) => s + p.x, 0) / n;
  const my = puntos.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of puntos) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  if (den === 0) return null;
  return num / den;
}

export type NivelActividad = 'sedentario' | 'ligero' | 'moderado' | 'alto' | 'muy_alto';

const FACTOR_ACTIVIDAD: Record<NivelActividad, number> = {
  sedentario: 1.2,
  ligero: 1.375,
  moderado: 1.55,
  alto: 1.725,
  muy_alto: 1.9,
};

/**
 * Mantenimiento calórico estimado: metabolismo basal por Mifflin-St Jeor por
 * el factor de actividad. Es un PUNTO DE PARTIDA con ±10 % de error: a las
 * tres semanas manda la tendencia real del peso, no esta fórmula. Fuera de
 * 16-100 años (la edad mínima de NIVL) no da número.
 */
export function mantenimientoKcal(f: {
  pesoKg: number;
  alturaCm: number;
  edad: number;
  sexo: 'hombre' | 'mujer';
  actividad: NivelActividad;
}): { basal: number; mantenimiento: number } | null {
  if (!(f.pesoKg > 20) || !(f.alturaCm > 100) || !(f.edad >= EDAD_MINIMA && f.edad <= 100)) return null;
  const basal = 10 * f.pesoKg + 6.25 * f.alturaCm - 5 * f.edad + (f.sexo === 'hombre' ? 5 : -161);
  return { basal: Math.round(basal), mantenimiento: Math.round((basal * FACTOR_ACTIVIDAD[f.actividad]) / 10) * 10 };
}

// ── Calorías estimadas de una sesión de cardio ──────────────────────

export type TipoCardio = 'correr' | 'nadar' | 'bici' | 'caminar' | 'remo' | 'otro';
export type ZonaCardio = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5' | 'intervalos' | 'libre';

/**
 * MET por tipo y zona (redondeados del Compendium of Physical Activities,
 * Ainsworth 2011). «otro» es el HIIT, la comba o la elíptica: un término medio.
 * Solo lo usa la pantalla (IRON · Cardio); el coach no lo lee.
 */
const MET_CARDIO: Readonly<Record<TipoCardio, Readonly<Record<ZonaCardio, number>>>> = {
  correr: { Z1: 6, Z2: 8, Z3: 10, Z4: 11.5, Z5: 13, intervalos: 11, libre: 9 },
  bici: { Z1: 4, Z2: 6, Z3: 8, Z4: 10, Z5: 12, intervalos: 9, libre: 7 },
  nadar: { Z1: 5, Z2: 6, Z3: 8, Z4: 9.5, Z5: 10, intervalos: 9, libre: 7 },
  caminar: { Z1: 3, Z2: 3.5, Z3: 4.5, Z4: 5, Z5: 6, intervalos: 5, libre: 3.5 },
  remo: { Z1: 4.5, Z2: 6, Z3: 7.5, Z4: 9, Z5: 11, intervalos: 9, libre: 7 },
  otro: { Z1: 4, Z2: 5, Z3: 7, Z4: 8, Z5: 10, intervalos: 8, libre: 6 },
};

/** Sin peso registrado se estima con este (y la pantalla lo dice). */
export const PESO_REFERENCIA_KG = 70;

/**
 * Calorías estimadas de una sesión: MET × kg × horas. Corriendo con distancia
 * manda la regla de ~1 kcal por kilo y kilómetro (casi no depende del ritmo).
 * Es una estimación de ±20 %: orienta, no es un dato. Redondeada a 5. Sin
 * duración válida, null.
 */
export function kcalCardio(s: {
  tipo: TipoCardio;
  zona: ZonaCardio;
  minutos: number;
  km?: number | null;
  pesoKg?: number | null;
}): number | null {
  if (!(s.minutos > 0)) return null;
  const kg = s.pesoKg && s.pesoKg > 20 && s.pesoKg < 400 ? s.pesoKg : PESO_REFERENCIA_KG;
  const kcal = s.tipo === 'correr' && s.km && s.km > 0 ? kg * s.km : MET_CARDIO[s.tipo][s.zona] * kg * (s.minutos / 60);
  return Math.round(kcal / 5) * 5;
}
