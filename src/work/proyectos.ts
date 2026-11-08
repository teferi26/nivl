// NIVL · WORK: proyectos y entregas (puro, con tests).
// riesgoEntrega tiene ESPEJO en supabase/functions/_shared/trabajo.ts: si tocas uno, toca el otro.

import { diasEntre, sumarDias } from './fechas';
import type { Entrega, Proyecto, SesionTrabajo } from './tipos';

export type RiesgoEntrega = 'hecha' | 'atrasada' | 'hoy' | 'en_riesgo' | 'a_tiempo' | 'sin_fecha';

/** A cuántos días una entrega ya aprieta aunque se esté trabajando en ella. */
export const DIAS_APRIETA = 2;
/** A cuántos días una entrega sin ninguna hora reciente ya está en riesgo. */
export const DIAS_SIN_TOCAR = 7;

const GRAVEDAD: Record<RiesgoEntrega, number> = { atrasada: 0, hoy: 1, en_riesgo: 2, a_tiempo: 3, sin_fecha: 4, hecha: 5 };

/**
 * El riesgo sale solo de la fecha y de si se ha trabajado en ella: nunca se
 * pinta una nota sobre la persona. `minutosRecientes` son los de la última
 * semana imputados a esa entrega.
 */
export function riesgoEntrega(e: Pick<Entrega, 'fecha' | 'hecha'>, hoy: string, minutosRecientes = 0): RiesgoEntrega {
  if (e.hecha) return 'hecha';
  if (!e.fecha) return 'sin_fecha';
  const dias = diasEntre(hoy, e.fecha);
  if (dias < 0) return 'atrasada';
  if (dias === 0) return 'hoy';
  if (dias <= DIAS_APRIETA) return 'en_riesgo';
  if (dias <= DIAS_SIN_TOCAR && minutosRecientes === 0) return 'en_riesgo';
  return 'a_tiempo';
}

function minutosPorEntrega(sesiones: readonly SesionTrabajo[], desde: string, hasta: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sesiones) {
    if (!s.entregaId || s.fecha < desde || s.fecha > hasta) continue;
    m.set(s.entregaId, (m.get(s.entregaId) ?? 0) + s.minutos);
  }
  return m;
}

export interface EntregaConRiesgo extends Entrega {
  riesgo: RiesgoEntrega;
  /** Días hasta la fecha (negativo si ya pasó); null sin fecha. */
  dias: number | null;
}

/** Con riesgo calculado, de lo más urgente a lo que menos. */
export function entregasConRiesgo(entregas: readonly Entrega[], sesiones: readonly SesionTrabajo[], hoy: string): EntregaConRiesgo[] {
  const recientes = minutosPorEntrega(sesiones, sumarDias(hoy, -6), hoy);
  return entregas
    .map((e) => ({ ...e, riesgo: riesgoEntrega(e, hoy, recientes.get(e.id) ?? 0), dias: e.fecha ? diasEntre(hoy, e.fecha) : null }))
    .sort(
      (a, b) =>
        GRAVEDAD[a.riesgo] - GRAVEDAD[b.riesgo] ||
        (a.fecha ?? '9999-12-31').localeCompare(b.fecha ?? '9999-12-31') ||
        a.posicion - b.posicion ||
        a.id.localeCompare(b.id),
    );
}

/** Lo pendiente que vence en los próximos `dias` (lo atrasado va incluido). */
export function entregasProximas(entregas: readonly Entrega[], sesiones: readonly SesionTrabajo[], hoy: string, dias = 7): EntregaConRiesgo[] {
  const hasta = sumarDias(hoy, dias);
  return entregasConRiesgo(entregas, sesiones, hoy).filter((e) => !e.hecha && e.fecha !== null && e.fecha <= hasta);
}

export interface ResumenProyecto {
  proyecto: Proyecto;
  pendientes: number;
  hechas: number;
  /** 0 a 100; null si no tiene entregas. */
  avance: number | null;
  proxima: EntregaConRiesgo | null;
  /** El peor riesgo de lo pendiente. */
  riesgo: RiesgoEntrega | null;
  minutosSemana: number;
}

export function resumenProyecto(proyecto: Proyecto, entregas: readonly Entrega[], sesiones: readonly SesionTrabajo[], hoy: string): ResumenProyecto {
  const propias = entregas.filter((e) => e.proyectoId === proyecto.id);
  const conRiesgo = entregasConRiesgo(propias, sesiones, hoy);
  const pendientes = conRiesgo.filter((e) => !e.hecha);
  const hechas = propias.length - pendientes.length;
  const desde = sumarDias(hoy, -6);
  return {
    proyecto,
    pendientes: pendientes.length,
    hechas,
    avance: propias.length ? Math.round((hechas / propias.length) * 100) : null,
    proxima: pendientes[0] ?? null,
    riesgo: pendientes[0]?.riesgo ?? null,
    minutosSemana: sesiones.filter((s) => s.proyectoId === proyecto.id && s.fecha >= desde && s.fecha <= hoy).reduce((a, s) => a + s.minutos, 0),
  };
}

/** Los proyectos activos con su resumen, los que más aprietan primero. */
export function resumenProyectos(proyectos: readonly Proyecto[], entregas: readonly Entrega[], sesiones: readonly SesionTrabajo[], hoy: string): ResumenProyecto[] {
  const peso = (r: ResumenProyecto) => (r.riesgo ? GRAVEDAD[r.riesgo] : 9);
  return proyectos
    .filter((p) => p.estado === 'activo')
    .map((p) => resumenProyecto(p, entregas, sesiones, hoy))
    .sort((a, b) => peso(a) - peso(b) || a.proyecto.posicion - b.proyecto.posicion || a.proyecto.id.localeCompare(b.proyecto.id));
}
