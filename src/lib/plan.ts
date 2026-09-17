// NIVL · El plan del día: tipos y lógica pura.
//
// Sin red y sin Supabase, igual que closing.ts frente a engine.ts. Así se
// puede probar de verdad: importar el cliente de Supabase aquí arrastraría
// AsyncStorage y los tests ni siquiera arrancarían.
//
// Los bloques se guardan en minutos desde medianoche a propósito. El plan es
// local por definición (la mañana del gladiador es su mañana), así que guardar
// instantes UTC solo traería líos de zona horaria y de cambio de hora.

export type BlockKind =
  | 'despertar'
  | 'ritual'
  | 'gym'
  | 'aerobico'
  | 'ventas'
  | 'contenido'
  | 'deep_work'
  | 'estudio'
  | 'comida'
  | 'redes'
  | 'descanso'
  | 'dormir'
  | 'libre';

export interface DayBlock {
  id: string;
  plan_id: string;
  start_min: number;
  end_min: number;
  title: string;
  kind: BlockKind;
  detail: string | null;
  quest_id: string | null;
  notify: boolean;
  done: boolean;
  position: number;
}

export interface DayPlan {
  id: string;
  date: string;
  status: 'borrador' | 'activo' | 'cerrado';
  verdict: string | null;
  brief: string | null;
  generated_at: string;
}

export interface PlanConBloques {
  plan: DayPlan;
  bloques: DayBlock[];
}

export const KIND_ICON: Record<BlockKind, string> = {
  despertar: 'alarm-outline',
  ritual: 'sparkles-outline',
  gym: 'barbell-outline',
  aerobico: 'walk-outline',
  ventas: 'call-outline',
  contenido: 'videocam-outline',
  deep_work: 'code-slash-outline',
  estudio: 'book-outline',
  comida: 'restaurant-outline',
  redes: 'share-social-outline',
  descanso: 'cafe-outline',
  dormir: 'moon-outline',
  libre: 'ellipse-outline',
};

export function hhmm(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function minutosAhora(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Convierte "HH:MM" o el "HH:MM:SS" que devuelve Postgres a minutos.
 * Devuelve null si no es una hora real: un "25:99" colándose programaría un
 * aviso a una hora que no existe.
 */
export function horaAMinutos(hora: string | null | undefined): number | null {
  if (!hora) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hora);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** El bloque que toca ahora mismo. El inicio pertenece al bloque; el fin, no. */
export function bloqueActual(bloques: DayBlock[], ahora = minutosAhora()): DayBlock | null {
  return bloques.find((b) => ahora >= b.start_min && ahora < b.end_min) ?? null;
}

/** El siguiente que empieza, para poder decir "en 20 minutos". */
export function bloqueSiguiente(bloques: DayBlock[], ahora = minutosAhora()): DayBlock | null {
  return bloques.find((b) => b.start_min > ahora) ?? null;
}

export function progresoDelPlan(bloques: DayBlock[]): { hechos: number; total: number } {
  // Dormir y descanso no son órdenes que se "cumplan": no cuentan.
  const contables = bloques.filter((b) => b.kind !== 'dormir' && b.kind !== 'descanso');
  return { hechos: contables.filter((b) => b.done).length, total: contables.length };
}
