// NIVL · Apple Watch: el contrato entre el iPhone y el reloj (puro, con tests).
//
// El iPhone es la fuente de verdad. Publica en el reloj un «estado del día»
// compacto por WatchConnectivity (applicationContext: el último gana, llega
// aunque el reloj esté dormido) y el reloj solo PIDE cosas: «completa la
// misión X», «arranca o pausa el pomodoro», «mándame el estado». Las reglas
// (XP, penalización, día cambiado, propagarActo) siguen en src/lib/engine.ts:
// el reloj no calcula nada que pague.
//
// La copia en Swift de estos tipos vive en targets/watch/Contrato.swift. Si
// tocas uno, toca el otro y sube VERSION_CONTRATO si el cambio no es aditivo.
//
// Sin imports de Supabase (patrón de arquitectura del repo): este módulo se
// testea sin AsyncStorage.

import { BONUS_BY_DIFFICULTY, MAX_STONES, questXp } from '@/lib/game';
import type { Difficulty, Quest } from '@/lib/types';
import { minutosDe, restanteMs, situacion, type ConfigPomodoro, type EstadoPomodoro, type Fase } from '@/focus/pomodoro';

export const VERSION_CONTRATO = 1;

/** Una misión de hoy, lo justo para pintarla y pedir que se complete. */
export interface MisionReloj {
  id: string;
  titulo: string;
  dificultad: Difficulty;
  /** Lo que paga como mucho (el servidor puede recortarlo: «hasta +N»). */
  premio: number;
  /** 'XP' o, en las misiones extra, Puntos Bonus. */
  unidad: 'XP' | 'PB';
  /** Módulo que la demuestra (gym, cardio, …) o null. */
  enlace: string | null;
  hecha: boolean;
  penalizacion: boolean;
  extra: boolean;
  /** Pide foto: desde el reloj no se puede completar. */
  requiereFoto: boolean;
  /** Penalización con la recuperación aún cerrada (RET-03). */
  bloqueada: boolean;
}

export interface FocusReloj {
  fase: Fase;
  situacion: 'parado' | 'en_marcha' | 'en_pausa';
  /** Cuándo acaba la fase en marcha (ms de época), o null. */
  finEn: number | null;
  /** Ms que quedan (en pausa o parado, la duración entera de la fase). */
  restanteMs: number;
  /** Duración entera de la fase (para el anillo). */
  totalMs: number;
  bloque: number;
  cadaLargo: number;
}

export interface IronReloj {
  ejercicio: string;
  /** Serie que toca (1 … series). */
  serie: number;
  series: number;
  /** «8» o «8-10»; vacío si no hay prescripción. */
  reps: string;
  /** Kilos prescritos o los de la serie anterior; null sin dato. */
  carga: number | null;
  /** Descanso entre series, en segundos. */
  descansoS: number;
  /** Lo que viene después, para la línea pequeña. Vacío si es el último. */
  siguiente: string;
}

export interface EstadoReloj {
  v: number;
  /** Cuándo se calculó en el iPhone (ms de época). */
  generadoEn: number;
  /** Día al que pertenecen las misiones (YYYY-MM-DD, hora del teléfono). */
  fecha: string;
  /** false tras cerrar sesión: el reloj borra lo que tenga. */
  sesion: boolean;
  misiones: MisionReloj[];
  racha: number;
  /** El día de hoy ya cuenta para la racha a la vista. */
  rachaCerrada: boolean;
  nivel: number;
  xpEnNivel: number;
  /** 0 = nivel máximo. */
  xpSiguiente: number;
  rango: string;
  titulo: string;
  piedras: number;
  piedrasMax: number;
  focus: FocusReloj | null;
  iron: IronReloj | null;
}

// ── Las tres partes que publica cada pantalla ─────────────────────────

/** Lo que publica Hoy: misiones, racha, nivel, rango y piedras. */
export type ParteHoy = Pick<
  EstadoReloj,
  'fecha' | 'misiones' | 'racha' | 'rachaCerrada' | 'nivel' | 'xpEnNivel' | 'xpSiguiente' | 'rango' | 'titulo' | 'piedras'
>;

export interface PartesReloj {
  hoy: ParteHoy | null;
  focus: FocusReloj | null;
  iron: IronReloj | null;
}

export const PARTES_VACIAS: PartesReloj = { hoy: null, focus: null, iron: null };

/** Lo que Hoy ya tiene derivado (HeroHoy de derivarHoy) y hace falta aquí. */
export interface HeroParaReloj {
  nivel: number;
  xpEnNivel: number;
  xpSiguiente: number;
  rango: string | null;
  titulo: string;
  racha: number;
  rachaCerrada: boolean;
  piedras: number;
}

export function misionReloj(
  q: Quest,
  opts: { hecha: boolean; streakDays: number; recuperacionAbierta: boolean },
): MisionReloj {
  const extra = q.is_bonus;
  const enlace = q.link && q.link !== 'ninguno' ? q.link : null;
  return {
    id: q.id,
    titulo: q.title,
    dificultad: q.difficulty,
    premio: extra ? BONUS_BY_DIFFICULTY[q.difficulty] : questXp(q, { evidence: false, streakDays: opts.streakDays }),
    unidad: extra ? 'PB' : 'XP',
    enlace,
    hecha: opts.hecha,
    penalizacion: q.is_penalty,
    extra,
    requiereFoto: q.requires_evidence && !q.is_penalty,
    bloqueada: q.is_penalty && !opts.recuperacionAbierta,
  };
}

/**
 * Orden del reloj: pendientes primero (penalización abierta delante, extra al
 * final), las hechas abajo. Estable dentro de cada grupo.
 */
function pesoOrden(m: MisionReloj): number {
  if (m.hecha) return 4;
  if (m.penalizacion && !m.bloqueada) return 0;
  if (m.extra) return 2;
  if (m.penalizacion) return 3;
  return 1;
}

export function parteHoy(e: {
  hoy: string;
  hero: HeroParaReloj;
  quests: Quest[];
  hechas: Set<string>;
  streakDays: number;
  recuperacionAbierta: boolean;
}): ParteHoy {
  const misiones = e.quests
    .map((q) =>
      misionReloj(q, { hecha: e.hechas.has(q.id), streakDays: e.streakDays, recuperacionAbierta: e.recuperacionAbierta }),
    )
    .map((m, i) => ({ m, i }))
    .sort((a, b) => pesoOrden(a.m) - pesoOrden(b.m) || a.i - b.i)
    .map(({ m }) => m);
  return {
    fecha: e.hoy,
    misiones,
    racha: Math.max(0, e.hero.racha),
    rachaCerrada: e.hero.rachaCerrada,
    nivel: e.hero.nivel,
    xpEnNivel: e.hero.xpEnNivel,
    xpSiguiente: e.hero.xpSiguiente,
    rango: e.hero.rango ?? 'E',
    titulo: e.hero.titulo,
    piedras: Math.max(0, Math.min(MAX_STONES, e.hero.piedras)),
  };
}

export function focusReloj(e: EstadoPomodoro, c: ConfigPomodoro, ahora: number): FocusReloj {
  return {
    fase: e.fase,
    situacion: situacion(e),
    finEn: e.finEn,
    restanteMs: restanteMs(e, c, ahora),
    totalMs: minutosDe(e.fase, c) * 60_000,
    bloque: e.bloque,
    cadaLargo: c.cadaLargo,
  };
}

// ── IRON: la serie que toca y su descanso ─────────────────────────────

/**
 * Descanso entre series según las repeticiones (doctrina de
 * supabase/functions/_shared/knowledge.ts: 3 a 5 min en los pesados de 3 a 6
 * repeticiones, 90 a 120 s en el resto). Coge el número más bajo de un rango
 * («6-8» → 6). Sin dato, 120 s. Las series largas (más de 12), 90 s.
 */
export function descansoSugerido(reps: string | number | null | undefined): number {
  const n = typeof reps === 'number' ? reps : parseInt(String(reps ?? '').match(/\d+/)?.[0] ?? '', 10);
  if (!Number.isFinite(n) || n <= 0) return 120;
  if (n <= 6) return 180;
  if (n <= 12) return 120;
  return 90;
}

/** Lo mínimo de la sesión en curso (LiftInput de useGym) que lee el reloj. */
export interface EjercicioEnCurso {
  exercise: string;
  series: { weight: string; reps: string }[];
}

/** Lo mínimo de la prescripción del día (Prescription de bodywork). */
export interface PrescritoEnCurso {
  exercise_name: string;
  sets: number;
  reps: string;
  weight: number | null;
}

const lleno = (v: string) => v.trim().length > 0;
const numero = (v: string): number | null => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const mismo = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * La serie que toca: el primer ejercicio con una serie sin repeticiones
 * apuntadas. null si no hay sesión o ya está todo apuntado.
 */
export function ironReloj(lifts: EjercicioEnCurso[], prescrito: PrescritoEnCurso[]): IronReloj | null {
  for (let i = 0; i < lifts.length; i++) {
    const l = lifts[i];
    const idx = l.series.findIndex((s) => !lleno(s.reps));
    if (idx < 0) continue;
    const p = prescrito.find((x) => mismo(x.exercise_name, l.exercise));
    const anterior = idx > 0 ? numero(l.series[idx - 1].weight) : null;
    const propia = numero(l.series[idx].weight);
    const reps = p?.reps?.trim() || (idx > 0 ? l.series[idx - 1].reps.trim() : '');
    const siguiente = idx + 1 < l.series.length ? l.exercise : (lifts[i + 1]?.exercise ?? '');
    return {
      ejercicio: l.exercise,
      serie: idx + 1,
      series: Math.max(l.series.length, p?.sets ?? 0, idx + 1),
      reps,
      carga: propia ?? p?.weight ?? anterior,
      descansoS: descansoSugerido(reps),
      siguiente,
    };
  }
  return null;
}

// ── Componer y leer ───────────────────────────────────────────────────

/** El estado entero que viaja al reloj. Sin parte de Hoy, no hay sesión que enseñar. */
export function componerEstado(p: PartesReloj, ahora: number, sesion = true): EstadoReloj {
  const h = p.hoy;
  return {
    v: VERSION_CONTRATO,
    generadoEn: ahora,
    fecha: h?.fecha ?? '',
    sesion: sesion && h !== null,
    misiones: sesion ? (h?.misiones ?? []) : [],
    racha: sesion ? (h?.racha ?? 0) : 0,
    rachaCerrada: sesion ? (h?.rachaCerrada ?? false) : false,
    nivel: sesion ? (h?.nivel ?? 1) : 1,
    xpEnNivel: sesion ? (h?.xpEnNivel ?? 0) : 0,
    xpSiguiente: sesion ? (h?.xpSiguiente ?? 0) : 0,
    rango: sesion ? (h?.rango ?? 'E') : 'E',
    titulo: sesion ? (h?.titulo ?? '') : '',
    piedras: sesion ? (h?.piedras ?? 0) : 0,
    piedrasMax: MAX_STONES,
    focus: sesion ? p.focus : null,
    iron: sesion ? p.iron : null,
  };
}

/**
 * Lo que el reloj dice cuando no puede hacer algo. La app del reloj de la v1
 * está solo en español (como sus textos en Swift): cuando se traduzca, estas
 * frases pasan al catálogo junto con las de targets/watch.
 */
export const MOTIVO_RELOJ = {
  noReconocida: 'Petición no reconocida.',
  sinMision: 'Esa misión ya no está en tu día.',
  sistema: 'El sistema no responde. Inténtalo desde el iPhone.',
} as const;

/** Lo que el reloj puede pedir. */
export type PeticionReloj =
  | { tipo: 'completar'; id: string; fecha: string }
  | { tipo: 'focus'; accion: 'empezar' | 'pausar' | 'parar' }
  | { tipo: 'estado' };

/** La respuesta que vuelve al reloj (solo si la petición fue en directo). */
export type RespuestaReloj = { ok: true; premio?: number } | { ok: false; motivo: string };

/** Lee una petición del reloj sin fiarse de nada: lo que no casa, null. */
export function leerPeticion(raw: unknown): PeticionReloj | null {
  let v: unknown = raw;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (o.tipo === 'completar') {
    if (typeof o.id !== 'string' || o.id.length === 0 || o.id.length > 64) return null;
    if (typeof o.fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.fecha)) return null;
    return { tipo: 'completar', id: o.id, fecha: o.fecha };
  }
  if (o.tipo === 'focus') {
    if (o.accion === 'empezar' || o.accion === 'pausar' || o.accion === 'parar') return { tipo: 'focus', accion: o.accion };
    return null;
  }
  if (o.tipo === 'estado') return { tipo: 'estado' };
  return null;
}

/**
 * Decide si una misión pedida desde el reloj se puede completar YA, antes de
 * llamar al motor (que vuelve a comprobarlo todo). Devuelve el motivo para el
 * reloj, en voz del sistema, o null si se puede.
 */
export function motivoParaNoCompletar(
  p: { id: string; fecha: string },
  e: { hoy: string; quests: Quest[]; hechas: Set<string>; recuperacionAbierta: boolean; ocupada: boolean },
): string | null {
  if (p.fecha !== e.hoy) return 'El día ha cambiado. Abre NIVL en el iPhone para ver las misiones de hoy.';
  const q = e.quests.find((x) => x.id === p.id);
  if (!q) return MOTIVO_RELOJ.sinMision;
  if (e.hechas.has(q.id)) return 'Ya estaba hecha.';
  if (e.ocupada) return 'Esa misión se está guardando.';
  if (q.is_penalty && !e.recuperacionAbierta) return 'Primero completa hoy una de tus misiones: la recuperación quedará abierta.';
  if (q.requires_evidence && !q.is_penalty) return 'Pide foto. Complétala desde el iPhone.';
  return null;
}
