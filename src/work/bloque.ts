// NIVL · WORK: el bloque de trabajo por hora de pared (puro, con tests).
//
// El estado guarda instantes, no un contador: con la app en segundo plano o
// muerta el tiempo sigue corriendo y al volver se recalcula. Quien lo persiste
// (AsyncStorage) y programa el aviso es el hook; aquí no hay reloj: todas las
// funciones reciben `ahora` en ms.
//
// Reloj hacia atrás (ajuste manual, zona, NTP): `visto` guarda el mayor instante
// conocido y nunca se descuenta lo ya trabajado; desde ese momento el tramo
// se reanuda con el reloj nuevo. Hacia delante no se puede distinguir de haber
// tenido la app cerrada: lo contado nunca pasa del objetivo.
//
// Cero XP aquí. Un bloque `cuenta` o no; lo que paga es completeQuest.

import {
  FRACCION_OBJETIVO,
  MAX_OBJETIVO_BLOQUE,
  MIN_MINUTOS_MISION,
  MIN_MINUTOS_SESION,
  MIN_OBJETIVO_BLOQUE,
  MINUTOS_BLOQUE_DEFECTO,
} from './tipos';
import { esFecha } from './fechas';

export type FaseBloque = 'corriendo' | 'pausado' | 'terminado';

export interface EstadoBloque {
  /** work_sessions.client_id: la misma sesión no se guarda dos veces. */
  clientId: string;
  fase: FaseBloque;
  objetivoMin: number;
  /** Trabajo ya consolidado (tramos anteriores). */
  acumuladoMs: number;
  /** Inicio del tramo en marcha; null si no corre. */
  tramoDesde: number | null;
  /** El mayor instante visto. Defensa contra el reloj hacia atrás. */
  visto: number;
  /** Día local y minuto local en que empezó. */
  fecha: string;
  inicioMin: number;
  titulo: string | null;
  questId: string | null;
  proyectoId: string | null;
  entregaId: string | null;
  /** El bloque del plan que se ataca: es el que se marca al acabar. */
  bloquePlanId: string | null;
  /** 'objetivo' si llegó solo, 'usuario' si lo cerró antes. null si no ha terminado. */
  cierre: 'objetivo' | 'usuario' | null;
}

export interface NuevoBloque {
  clientId: string;
  ahora: number;
  fecha: string;
  inicioMin: number;
  objetivoMin?: number;
  titulo?: string | null;
  questId?: string | null;
  proyectoId?: string | null;
  entregaId?: string | null;
  bloquePlanId?: string | null;
}

export function acotarObjetivo(min: unknown): number {
  const n = typeof min === 'number' && Number.isFinite(min) ? Math.round(min) : MINUTOS_BLOQUE_DEFECTO;
  return Math.max(MIN_OBJETIVO_BLOQUE, Math.min(MAX_OBJETIVO_BLOQUE, n));
}

export function nuevoBloque(a: NuevoBloque): EstadoBloque {
  return {
    clientId: a.clientId,
    fase: 'corriendo',
    objetivoMin: acotarObjetivo(a.objetivoMin),
    acumuladoMs: 0,
    tramoDesde: a.ahora,
    visto: a.ahora,
    fecha: a.fecha,
    inicioMin: a.inicioMin,
    titulo: a.titulo ?? null,
    questId: a.questId ?? null,
    proyectoId: a.proyectoId ?? null,
    entregaId: a.entregaId ?? null,
    bloquePlanId: a.bloquePlanId ?? null,
    cierre: null,
  };
}

const objetivoMs = (e: EstadoBloque) => e.objetivoMin * 60_000;

/** El estado visto desde `ahora`: si el reloj ha ido hacia atrás, consolida y reanuda desde el reloj nuevo. */
function alineado(e: EstadoBloque, ahora: number): EstadoBloque {
  if (ahora >= e.visto) return { ...e, visto: ahora };
  if (e.tramoDesde === null) return { ...e, visto: ahora };
  const contado = Math.max(0, e.visto - e.tramoDesde);
  return { ...e, acumuladoMs: e.acumuladoMs + contado, tramoDesde: ahora, visto: ahora };
}

/** Trabajo real, sin pasar del objetivo. */
export function transcurridoMs(e: EstadoBloque, ahora: number): number {
  const a = alineado(e, ahora);
  const tramo = a.tramoDesde === null ? 0 : Math.max(0, ahora - a.tramoDesde);
  return Math.min(objetivoMs(a), a.acumuladoMs + tramo);
}

export function restanteMs(e: EstadoBloque, ahora: number): number {
  return Math.max(0, objetivoMs(e) - transcurridoMs(e, ahora));
}

/** Minutos enteros trabajados (hacia abajo: un minuto a medias no cuenta). */
export function minutosReales(e: EstadoBloque, ahora: number): number {
  return Math.floor(transcurridoMs(e, ahora) / 60_000);
}

/** El instante en que acabará si nadie lo toca (para el aviso local). null si no corre. */
export function finPrevisto(e: EstadoBloque, ahora: number): number | null {
  if (e.fase !== 'corriendo') return null;
  return ahora + restanteMs(e, ahora);
}

/** Pasa el reloj. Si ha llegado al objetivo, lo cierra. Idempotente. */
export function avanzar(e: EstadoBloque, ahora: number): EstadoBloque {
  if (e.fase !== 'corriendo') return e;
  const a = alineado(e, ahora);
  if (transcurridoMs(a, ahora) < objetivoMs(a)) return a;
  return { ...a, fase: 'terminado', acumuladoMs: objetivoMs(a), tramoDesde: null, cierre: 'objetivo' };
}

export function pausar(e: EstadoBloque, ahora: number): EstadoBloque {
  const a = avanzar(e, ahora);
  if (a.fase !== 'corriendo') return a;
  return { ...a, fase: 'pausado', acumuladoMs: transcurridoMs(a, ahora), tramoDesde: null };
}

export function reanudar(e: EstadoBloque, ahora: number): EstadoBloque {
  if (e.fase !== 'pausado') return e;
  return { ...alineado(e, ahora), fase: 'corriendo', tramoDesde: ahora, visto: ahora };
}

/** Cerrarlo a mano. Lo trabajado se queda; si cuenta o no lo dice `cierreDe`. */
export function terminar(e: EstadoBloque, ahora: number): EstadoBloque {
  const a = avanzar(e, ahora);
  if (a.fase === 'terminado') return a;
  return { ...a, fase: 'terminado', acumuladoMs: transcurridoMs(a, ahora), tramoDesde: null, cierre: 'usuario' };
}

/** ¿Es un bloque de verdad? Mínimo absoluto y casi todo su objetivo. */
export function cuentaComoBloque(minutos: number, objetivoMin: number): boolean {
  return minutos >= MIN_MINUTOS_MISION && minutos >= Math.ceil(objetivoMin * FRACCION_OBJETIVO);
}

export interface CierreBloque {
  clientId: string;
  fecha: string;
  inicioMin: number;
  minutos: number;
  /** Se guarda como sesión (horas). */
  guardar: boolean;
  /** Es un bloque de verdad: propaga el acto y puede marcar su misión. */
  cuenta: boolean;
  questId: string | null;
  proyectoId: string | null;
  entregaId: string | null;
  bloquePlanId: string | null;
}

/** Lo que deja un bloque terminado; null si aún no lo está. */
export function cierreDe(e: EstadoBloque): CierreBloque | null {
  if (e.fase !== 'terminado') return null;
  const minutos = Math.floor(e.acumuladoMs / 60_000);
  return {
    clientId: e.clientId,
    fecha: e.fecha,
    inicioMin: e.inicioMin,
    minutos,
    guardar: minutos >= MIN_MINUTOS_SESION,
    cuenta: cuentaComoBloque(minutos, e.objetivoMin),
    questId: e.questId,
    proyectoId: e.proyectoId,
    entregaId: e.entregaId,
    bloquePlanId: e.bloquePlanId,
  };
}

/**
 * Solo marca la misión si cuenta y sigue siendo el mismo día en que empezó: un
 * bloque de anoche que acaba de verse esta mañana (o que cruzó la medianoche)
 * guarda sus horas, pero no paga la misión de hoy.
 */
export function marcaMision(c: CierreBloque, hoy: string): c is CierreBloque & { questId: string } {
  return c.cuenta && c.fecha === hoy && typeof c.questId === 'string' && c.questId.length > 0;
}

/** Lee un estado guardado sin fiarse de nada; null si no sirve. */
export function normalizarBloque(v: unknown): EstadoBloque | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  const s = (x: unknown) => (typeof x === 'string' && x ? x : null);
  const fase = o.fase === 'corriendo' || o.fase === 'pausado' || o.fase === 'terminado' ? o.fase : null;
  const visto = n(o.visto);
  const acumuladoMs = n(o.acumuladoMs);
  const inicioMin = n(o.inicioMin);
  const clientId = s(o.clientId);
  if (!fase || visto === null || acumuladoMs === null || inicioMin === null || !clientId || !esFecha(o.fecha)) return null;
  const tramoDesde = n(o.tramoDesde);
  if (fase === 'corriendo' && tramoDesde === null) return null;
  return {
    clientId,
    fase,
    objetivoMin: acotarObjetivo(o.objetivoMin),
    acumuladoMs: Math.max(0, Math.min(acumuladoMs, acotarObjetivo(o.objetivoMin) * 60_000)),
    tramoDesde: fase === 'corriendo' ? tramoDesde : null,
    visto,
    fecha: o.fecha,
    inicioMin,
    titulo: s(o.titulo),
    questId: s(o.questId),
    proyectoId: s(o.proyectoId),
    entregaId: s(o.entregaId),
    bloquePlanId: s(o.bloquePlanId),
    cierre: o.cierre === 'objetivo' || o.cierre === 'usuario' ? o.cierre : null,
  };
}
