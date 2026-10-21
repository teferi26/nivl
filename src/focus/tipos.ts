// NIVL · FOCUS: los tipos del mundo del estudiante (migración 0075).
//
// Puro: sin Supabase ni React Native. Las filas llegan de `src/focus/datos.ts`
// ya convertidas a estos tipos (fechas como 'YYYY-MM-DD', minutos del día como
// número). Ninguna de estas tablas mueve XP: el estudio paga por las misiones
// de FOCUS (complete_quest), nunca por su cuenta.

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
}

export interface Examen {
  id: string;
  asignaturaId: string;
  titulo: string;
  /** 'YYYY-MM-DD' */
  fecha: string;
  /** Peso del examen en la nota final (0 a 100), si se sabe. */
  peso: number | null;
}

export interface Sesion {
  id: string;
  asignaturaId: string | null;
  temaId: string | null;
  /** 'YYYY-MM-DD' (día local en que acabó). */
  fecha: string;
  minutos: number;
  metodo: string | null;
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
};
