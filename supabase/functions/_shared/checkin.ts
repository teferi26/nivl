// NIVL · El coach proactivo con tope (coach v2, L6): el «checkin».
//
// Módulo PURO: sin red ni cliente de Supabase (solo Intl para los husos y el
// espejo de la política de push). Decide SI toca un mensaje proactivo del
// coach; generarlo y enviarlo es de `ritual/handler.ts`.
//
// Reglas (docs/ia-v2/PLAN.md, L6):
//   · como mucho 1 checkin al día (local) y 3 en 7 días;
//   · nunca si el gladiador escribió al coach en las últimas 6 h;
//   · nunca en horas de sueño (fuera de wake_time–sleep_time);
//   · se retira tras 2 checkins seguidos sin respuesta, y vuelve en cuanto él
//     escribe algo.
//
// El estado del retiro NO necesita columna nueva: sale de coach_runs (kind
// 'checkin', sin error) y de los mensajes del hilo (role 'user' que escribió
// él de verdad: ni los encargos del cron ni los resultados de herramientas).

import { enSilencio, ventanaActiva, type Momento } from './pushpolicy.ts';

export const MAX_CHECKIN_DIA = 1;
export const MAX_CHECKIN_SEMANA = 3;
export const HORAS_SIN_ESCRIBIR = 6;
export const IGNORADOS_PARA_RETIRO = 2;
export const MAX_CARACTERES_CHECKIN = 280;
/** Hora local preferida del checkin: la tarde, lejos del brief (despertar) y de la escalada (11:00). */
export const HORA_PREFERIDA = 18;

/**
 * Los rituales que terminan en push (además del propio checkin). Con ellos se
 * cuenta cuántos push del servidor lleva el día: 1 como mucho (pushPolicy).
 */
export const KINDS_CON_PUSH: readonly string[] = Object.freeze([
  'brief', 'revision_semanal', 'cierre_mensual', 'escalada', 'checkin',
]);

const H = 3_600_000;
const DIA = 24 * H;

/**
 * Los encargos que el cron mete en el hilo como si fueran del usuario (ver
 * `decidir` y el plan de reserva en ritual/handler.ts) y la marca de un ritual
 * sin texto (`[ritual: x]`, coach/handler.ts). No son respuestas suyas.
 */
const ENCARGO_DEL_CRON =
  /^(?:\[ritual: [a-z_]+\]|Cierra el mes\.|Haz la revisión de la semana\.|Lleva cuatro días en silencio\.|Es \d{4}-\d{2}-\d{2}\. (?:Dicta el brief|Escribe el plan))/;

/** Fecha local (YYYY-MM-DD) de un instante en una zona. null si no es válido. */
export function fechaLocal(instante: string | Date, timezone: string): string | null {
  const d = instante instanceof Date ? instante : new Date(instante);
  if (Number.isNaN(d.getTime())) return null;
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
    return fmt.format(d);
  } catch {
    return null;
  }
}

/**
 * ¿Lo escribió el gladiador? Recibe el tipo y el texto del PRIMER bloque del
 * mensaje (role 'user'). Un tool_result o un encargo del cron no cuentan.
 */
export function esMensajeDelGladiador(tipo: unknown, texto: unknown): boolean {
  if (tipo !== 'text' || typeof texto !== 'string') return false;
  const t = texto.trim();
  if (!t) return false;
  return !ENCARGO_DEL_CRON.test(t);
}

/**
 * La hora local (0–23) en que toca mirar si hay checkin: las 18:00 si caben
 * con dos horas de margen dentro de la ventana activa; si no, el centro de la
 * ventana.
 */
export function horaDelCheckin(wakeTime?: string | null, sleepTime?: string | null): number {
  const v = ventanaActiva(wakeTime, sleepTime);
  const preferida = HORA_PREFERIDA * 60;
  if (preferida >= v.inicio + 120 && preferida + 60 <= v.fin - 60) return HORA_PREFERIDA;
  return Math.min(23, Math.floor((v.inicio + v.fin) / 2 / 60));
}

const ms = (iso: string): number => {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? NaN : t;
};

/**
 * ¿Retirado? Los dos últimos checkins sin un mensaje suyo DESPUÉS del más
 * viejo de los dos: ni contestó al primero antes del segundo ni al segundo.
 */
export function retirado(checkins: readonly string[], mensajesGladiador: readonly string[]): boolean {
  const orden = checkins.map(ms).filter((t) => !Number.isNaN(t)).sort((a, b) => a - b);
  if (orden.length < IGNORADOS_PARA_RETIRO) return false;
  const desde = orden[orden.length - IGNORADOS_PARA_RETIRO];
  return !mensajesGladiador.some((m) => ms(m) > desde);
}

/**
 * Desde cuándo hay que leer mensajes suyos para decidir: lo más antiguo entre
 * hace 6 h y el penúltimo checkin.
 */
export function desdeParaMensajes(checkins: readonly string[], ahoraMs: number): string {
  const orden = checkins.map(ms).filter((t) => !Number.isNaN(t)).sort((a, b) => a - b);
  let desde = ahoraMs - HORAS_SIN_ESCRIBIR * H;
  if (orden.length >= IGNORADOS_PARA_RETIRO) desde = Math.min(desde, orden[orden.length - IGNORADOS_PARA_RETIRO]);
  return new Date(desde).toISOString();
}

/** Push del servidor ya enviados hoy (fecha local), contados por los rituales sin error. */
export function pushesDeHoy(
  runs: readonly { kind?: unknown; created_at?: unknown; error?: unknown }[],
  hoy: string,
  timezone: string,
): number {
  return runs.filter((r) =>
    typeof r.kind === 'string' && KINDS_CON_PUSH.includes(r.kind) && !r.error &&
    typeof r.created_at === 'string' && fechaLocal(r.created_at, timezone) === hoy
  ).length;
}

export interface EntradaCheckin {
  /** Ahora en hora local de pared. */
  ahora: Momento;
  /** Ahora en milisegundos (para las ventanas de 6 h y 7 días). */
  ahoraMs: number;
  timezone: string;
  wakeTime?: string | null;
  sleepTime?: string | null;
  /** Checkins que salieron bien (coach_runs kind 'checkin' sin error), ISO. */
  checkins: readonly string[];
  /** TODOS los intentos de checkin (también los fallidos), ISO: un fallo no se reintenta el mismo día. */
  intentos: readonly string[];
  /** Mensajes que escribió él (ver esMensajeDelGladiador), ISO. */
  mensajesGladiador: readonly string[];
}

export type MotivoCheckin = 'ok' | 'sueno' | 'hora' | 'tope_dia' | 'tope_semana' | 'escribio' | 'retirado';

/** ¿Toca un checkin ahora? Primera regla que lo impide gana. */
export function checkinPermitido(e: EntradaCheckin): { ok: boolean; motivo: MotivoCheckin } {
  if (enSilencio(e.ahora.min, e.wakeTime, e.sleepTime)) return { ok: false, motivo: 'sueno' };
  if (Math.floor(e.ahora.min / 60) !== horaDelCheckin(e.wakeTime, e.sleepTime)) return { ok: false, motivo: 'hora' };

  const hoy = e.intentos.filter((t) => fechaLocal(t, e.timezone) === e.ahora.fecha).length;
  if (hoy >= MAX_CHECKIN_DIA) return { ok: false, motivo: 'tope_dia' };

  const semana = e.checkins.filter((t) => {
    const x = ms(t);
    return !Number.isNaN(x) && e.ahoraMs - x < 7 * DIA;
  }).length;
  if (semana >= MAX_CHECKIN_SEMANA) return { ok: false, motivo: 'tope_semana' };

  if (e.mensajesGladiador.some((m) => {
    const x = ms(m);
    return !Number.isNaN(x) && e.ahoraMs - x < HORAS_SIN_ESCRIBIR * H;
  })) return { ok: false, motivo: 'escribio' };

  if (retirado(e.checkins, e.mensajesGladiador)) return { ok: false, motivo: 'retirado' };
  return { ok: true, motivo: 'ok' };
}

/**
 * Deja el texto del modelo listo para el chat y el push: sin markdown ni
 * comillas envolventes, en una línea, ≤280 caracteres y con una pregunta. Si
 * no cabe entero, se corta tras la última pregunta que quepa; si no hay
 * ninguna, null (no se envía: el checkin ES una pregunta).
 */
export function limpiarCheckin(texto: string): string | null {
  let t = String(texto ?? '')
    .replace(/[*#_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["“«']+|["”»']+$/g, '')
    .trim();
  if (!t || !t.includes('?')) return null;
  if (t.length > MAX_CARACTERES_CHECKIN) {
    const corte = t.lastIndexOf('?', MAX_CARACTERES_CHECKIN - 1);
    if (corte < 0) return null;
    t = t.slice(0, corte + 1).trim();
  }
  return t || null;
}
