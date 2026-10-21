// NIVL · La cartera de IA de un usuario (migración 0078).
//
// Toda llamada a un modelo pasa por aquí (callClaude y callOpenAICompat la exigen en el tipo): antes de
// llamar se RESERVA la cota del coste con `ai_reservar` (atómica en Postgres, con cerrojo por usuario) y al
// terminar se LIQUIDA con el coste real (`ai_liquidar`). Si la reserva no cabe, se lanza TopeIaError y no
// sale nada al proveedor. Si la base no responde, también: sin poder comprobar el tope, no se gasta.

import { TopeIaError, type Cartera } from './anthropic.ts';
import type { Db } from './db.ts';

export { TopeIaError };
export type { Cartera };

/** Las funciones con tope propio (ai_topes_funcion). Una que no esté en la tabla, la base la rechaza. */
export type FuncionIa =
  | 'chat'
  | 'registro'
  | 'profundo'
  | 'ritual'
  | 'estudio'
  | 'pdf'
  | 'clasificar'
  | 'resumen'
  | 'resumen_hilo'
  | 'checkin'
  | 'oracle';

export type ModoCartera = 'estandar' | 'profundo';

/** Solo el código de un error de Supabase, nunca el objeto (puede llevar datos). */
export function codigoError(e: unknown): string {
  if (e && typeof e === 'object') {
    const o = e as { code?: unknown; status?: unknown; name?: unknown };
    if (typeof o.code === 'string' && o.code) return o.code;
    if (typeof o.status === 'number') return `http_${o.status}`;
    if (typeof o.name === 'string' && o.name) return o.name;
  }
  return 'sin_codigo';
}

export class CarteraIa implements Cartera {
  /** Todas las llamadas de esta cartera son el mismo turno (para los topes de turnos al día). */
  readonly turno: string = crypto.randomUUID();
  /** Lo reservado y lo liquidado en este turno (para los logs y los tests). */
  readonly reservas: { id: string; micro: number; real?: number }[] = [];

  constructor(
    private readonly admin: Db,
    private readonly userId: string,
    readonly funcion: FuncionIa,
    readonly modo: ModoCartera = 'estandar',
  ) {}

  async reservar(micro: number): Promise<string> {
    const { data, error } = await this.admin.rpc('ai_reservar', {
      p_user: this.userId,
      p_funcion: this.funcion,
      p_modo: this.modo,
      p_micro: Math.max(1, Math.ceil(micro)),
      p_turno: this.turno,
    });
    if (error) {
      console.error('ai_reservar failed:', codigoError(error));
      throw new TopeIaError('cartera_no_disponible');
    }
    const r = data as { ok?: boolean; id?: unknown; motivo?: unknown } | null;
    if (!r?.ok || typeof r.id !== 'string') throw new TopeIaError(typeof r?.motivo === 'string' ? r.motivo : 'cerrado');
    this.reservas.push({ id: r.id, micro: Math.ceil(micro) });
    return r.id;
  }

  async liquidar(id: string, realMicro: number): Promise<void> {
    const real = Math.max(0, Math.round(Number.isFinite(realMicro) ? realMicro : 0));
    const fila = this.reservas.find((x) => x.id === id);
    if (fila) fila.real = real;
    try {
      const { error } = await this.admin.rpc('ai_liquidar', { p_id: id, p_real: real });
      // Si no se puede liquidar, la reserva se queda entera y a los 15 min caduca cobrada: nunca de menos.
      if (error) console.error('ai_liquidar failed:', codigoError(error));
    } catch (e) {
      console.error('ai_liquidar failed:', codigoError(e));
    }
  }
}

/** Lo que dice la puerta previa (`ai_puede`) para una función, sin reservar. */
export async function puertaCartera(
  admin: Db,
  userId: string,
  funcion: FuncionIa,
  modo: ModoCartera,
): Promise<{ ok: boolean; motivo: string | null; renueva?: string }> {
  const { data, error } = await admin.rpc('ai_puede', { p_user: userId, p_funcion: funcion, p_modo: modo });
  if (error) {
    console.error('ai_puede failed:', codigoError(error));
    return { ok: false, motivo: 'cartera_no_disponible' };
  }
  const r = data as { ok?: boolean; motivo?: unknown; renueva?: unknown } | null;
  return {
    ok: r?.ok === true,
    motivo: typeof r?.motivo === 'string' ? r.motivo : r?.ok === true ? null : 'cerrado',
    renueva: typeof r?.renueva === 'string' ? r.renueva : undefined,
  };
}

/** El texto (voz del sistema, sin guion largo) y el estado HTTP de cada motivo de la cartera. */
export function mensajeTope(motivo: string, renueva?: string): { status: number; error: string; reason: string } {
  switch (motivo) {
    case 'tope_mes':
      return { status: 402, reason: 'presupuesto_agotado', error: `Has usado toda la IA de este mes. Se renueva el ${renueva ?? 'día 1'}. Puedes recargarla desde NIVL Pro.` };
    case 'ritmo_diario':
      return { status: 402, reason: 'ritmo_diario', error: 'Hoy ya has usado la IA que te corresponde para llegar a fin de mes. Mañana vuelve.' };
    case 'tope_funcion':
      return { status: 429, reason: 'tope_funcion', error: 'Has llegado al máximo de hoy para esta función. Mañana vuelve.' };
    case 'profundo_agotado':
      return { status: 402, reason: 'profundo_agotado', error: 'Has usado tus turnos profundos de este mes. El modo estándar sigue disponible.' };
    case 'tope_llamada':
      return { status: 413, reason: 'tope_llamada', error: 'Esta petición es demasiado grande para el sistema. Recórtala y vuelve a intentarlo.' };
    case 'sin_suscripcion':
      return { status: 402, reason: 'sin_suscripcion', error: 'El coach es parte de NIVL Pro.' };
    default:
      return { status: 503, reason: 'cartera_no_disponible', error: 'El sistema no puede comprobar tu IA ahora mismo. Vuelve a intentarlo.' };
  }
}
