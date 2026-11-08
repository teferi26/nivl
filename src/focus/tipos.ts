// NIVL · FOCUS: los tipos del mundo del estudiante (migración 0076).
//
// Puro: sin Supabase ni React Native. Las filas llegan de `src/focus/datos.ts`
// ya convertidas a estos tipos (fechas como 'YYYY-MM-DD', minutos del día como
// número). Ninguna de estas tablas mueve XP: el estudio paga por las misiones
// de FOCUS (complete_quest), nunca por su cuenta.

import { esFecha } from './fechas';

/** El estado de un tema del temario. */
export type EstadoTema = 'pendiente' | 'repasando' | 'dominado';

export const ESTADOS_TEMA: readonly EstadoTema[] = ['pendiente', 'repasando', 'dominado'];

export function esEstadoTema(v: unknown): v is EstadoTema {
  return typeof v === 'string' && (ESTADOS_TEMA as readonly string[]).includes(v);
}

/** El siguiente estado al tocar la casilla: pendiente → repasando → dominado → pendiente. */
export function siguienteEstado(e: EstadoTema): EstadoTema {
  return e === 'pendiente' ? 'repasando' : e === 'repasando' ? 'dominado' : 'pendiente';
}

export interface Asignatura {
  id: string;
  nombre: string;
  posicion: number;
  /** La nota que se quiere (sobre 10, o hasta 14 en admisión). null: el 5 de siempre. */
  notaObjetivo: number | null;
  /** Vuelta al temario en la que se va (1, 2, 3...). */
  vuelta: number;
}

export interface Tema {
  id: string;
  asignaturaId: string;
  /** El examen al que pertenece (null: temario general de la asignatura). */
  examenId: string | null;
  nombre: string;
  estado: EstadoTema;
  posicion: number;
  /** Repetición espaciada: etapa 0 a 5 y próximo repaso (null si aún no se ha estudiado). */
  etapa: number;
  repasoEl: string | null;
  /** Bloque o parte del temario (oposiciones), si lo tiene. */
  seccion: string | null;
  /** 'YYYY-MM-DD': el último repaso hecho. */
  repasadoEl: string | null;
}

export type TipoExamen = 'examen' | 'entrega' | 'prueba';

export const TIPOS_EXAMEN: readonly TipoExamen[] = ['examen', 'entrega', 'prueba'];

export function esTipoExamen(v: unknown): v is TipoExamen {
  return typeof v === 'string' && (TIPOS_EXAMEN as readonly string[]).includes(v);
}

export interface Examen {
  id: string;
  asignaturaId: string;
  titulo: string;
  /** 'YYYY-MM-DD'; null si aún no se sabe. */
  fecha: string | null;
  /** Peso del examen en la nota final (0 a 100), si se sabe. */
  peso: number | null;
  /** Minuto del día (0 a 1439), si se sabe. */
  hora: number | null;
  /** Examen, entrega (también deberes) o prueba. */
  tipo: TipoExamen;
  /** La fecha es aproximada: no se planifica como si fuera cierta. */
  estimada: boolean;
  /** 'YYYY-MM-DD' en que se cerró (entregas y deberes). */
  hechaEl: string | null;
}

export interface Sesion {
  id: string;
  asignaturaId: string | null;
  temaId: string | null;
  /** 'YYYY-MM-DD' (día local en que acabó). */
  fecha: string;
  minutos: number;
  metodo: string | null;
  /** Veces que se salió de la app durante el bloque. Informativo: nunca toca el pago. */
  salidas: number;
}

export interface Clase {
  id: string;
  asignaturaId: string;
  /** 1 = lunes … 7 = domingo */
  dia: number;
  /** Minutos desde medianoche. */
  inicio: number;
  fin: number;
  aula: string | null;
}

export interface Nota {
  id: string;
  asignaturaId: string;
  titulo: string;
  nota: number;
  sobre: number;
  /** Porcentaje de la nota final (0 a 100), o null si no se sabe. */
  peso: number | null;
  fecha: string;
}

export interface Mazo {
  id: string;
  asignaturaId: string | null;
  nombre: string;
}

export interface Tarjeta {
  id: string;
  mazoId: string;
  anverso: string;
  reverso: string;
  etapa: number;
  /** 'YYYY-MM-DD': el día que toca repasarla. */
  vence: string;
}

export type PerfilFocus = 'oposicion' | 'universidad' | 'instituto';

export const PERFILES_FOCUS: readonly PerfilFocus[] = ['oposicion', 'universidad', 'instituto'];

/** Preferencias de FOCUS: viajan en `user_modes.settings` de mode='focus'. */
export interface PrefsFocus {
  perfil: PerfilFocus | null;
  /** Minutos de estudio que caben en un día normal. */
  minutosDia: number;
  /** 'YYYY-MM-DD': hasta ese día (incluido) el horario de clases no cuenta (época de exámenes). */
  sinClasesHasta: string | null;
  arranqueHecho: boolean;
}

export const PREFS_POR_DEFECTO: PrefsFocus = {
  perfil: null,
  minutosDia: 120,
  sinClasesHasta: null,
  arranqueHecho: false,
};

/** Topes de `minutosDia`: de un rato a una jornada entera de opositor. */
export const LIMITES_MINUTOS_DIA = [15, 900] as const;

/** Lee las preferencias guardadas sin fiarse de nada (columna ausente, JSON viejo). */
export function normalizarPrefs(v: unknown): PrefsFocus {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const min = typeof o.minutosDia === 'number' && Number.isFinite(o.minutosDia) ? Math.round(o.minutosDia) : PREFS_POR_DEFECTO.minutosDia;
  return {
    perfil: typeof o.perfil === 'string' && (PERFILES_FOCUS as readonly string[]).includes(o.perfil) ? (o.perfil as PerfilFocus) : null,
    minutosDia: Math.max(LIMITES_MINUTOS_DIA[0], Math.min(LIMITES_MINUTOS_DIA[1], min)),
    sinClasesHasta: typeof o.sinClasesHasta === 'string' && esFecha(o.sinClasesHasta) ? o.sinClasesHasta : null,
    arranqueHecho: o.arranqueHecho === true,
  };
}

/** Todo lo de FOCUS de una cuenta. */
export interface DatosFocus {
  asignaturas: Asignatura[];
  temas: Tema[];
  examenes: Examen[];
  sesiones: Sesion[];
  clases: Clase[];
  notas: Nota[];
  mazos: Mazo[];
  tarjetas: Tarjeta[];
  prefs: PrefsFocus;
}

export const DATOS_VACIOS: DatosFocus = {
  asignaturas: [],
  temas: [],
  examenes: [],
  sesiones: [],
  clases: [],
  notas: [],
  mazos: [],
  tarjetas: [],
  prefs: PREFS_POR_DEFECTO,
};
