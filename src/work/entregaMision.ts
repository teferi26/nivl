// NIVL · WORK: de una entrega a su misión (puro, con tests).
//
// Una entrega con fecha se convierte en una misión normal de WORK para ese día,
// con la misma forma que una prioridad (`filasDePrioridad`, link 'ninguno', sin
// XP propio). El enlace no es una columna: una misión es de una entrega si
// coinciden título y día. Así no hace falta migración nueva.
//
// OJO con `days_of_week`: es semanal, así que una misión creada con más de seis
// días de antelación saldría también (y se cobraría) en el mismo día de la
// semana anterior. Por eso solo se crea cuando faltan seis días o menos, y por
// eso la crea una pasada idempotente al leer los datos.

import { sumarDias } from './fechas';
import { filasDePrioridad, limpiarEntradas, type FilaPrioridad } from './prioridades';
import { MAX_PRIORIDADES, normal, type Entrega } from './tipos';

export const DIAS_ANTELACION_MISION = 6;

/** Una misión con día propio (`work_day`), activa o ya retirada. */
export interface MisionConDia {
  id: string;
  titulo: string;
  dia: string;
  activa: boolean;
}

const tituloNormal = (titulo: string) => normal(limpiarEntradas([titulo])[0] ?? '');
const clave = (titulo: string, dia: string) => `${dia}|${tituloNormal(titulo)}`;

/** El tope de tres al día es también el tope de lo que puede pagar WORK en un día. */
export const activasDelDia = (misiones: readonly MisionConDia[], dia: string): number => misiones.filter((m) => m.activa && m.dia === dia).length;

/** La misión de una entrega; primero la activa. */
export function misionDeEntrega(e: Pick<Entrega, 'titulo' | 'fecha'>, misiones: readonly MisionConDia[]): MisionConDia | null {
  if (!e.fecha) return null;
  const k = clave(e.titulo, e.fecha);
  const suyas = misiones.filter((m) => clave(m.titulo, m.dia) === k);
  return suyas.find((m) => m.activa) ?? suyas[0] ?? null;
}

/**
 * Las misiones que faltan. Solo lo pendiente y dentro de la ventana; una misión
 * ya existente, aunque esté retirada (la soltaron), no se vuelve a crear; y
 * ningún día pasa de tres.
 *
 * Se compara por título en TODA la ventana, no por día: cerrar antes de tiempo
 * mueve la misión a hoy, y al reabrir la entrega el par día y título ya no
 * existiría. Por día, cada reapertura crearía y pagaría otra.
 */
export function filasDeEntregas(entregas: readonly Entrega[], existentes: readonly MisionConDia[], hoy: string): FilaPrioridad[] {
  const hasta = sumarDias(hoy, DIAS_ANTELACION_MISION);
  const vistas = new Set(existentes.filter((m) => m.dia >= hoy && m.dia <= hasta).map((m) => tituloNormal(m.titulo)));
  const ocupadas = new Map<string, number>();
  const candidatas = entregas
    .filter((e): e is Entrega & { fecha: string } => !e.hecha && e.fecha !== null && e.fecha >= hoy && e.fecha <= hasta)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.posicion - b.posicion || a.id.localeCompare(b.id));
  const out: FilaPrioridad[] = [];
  for (const e of candidatas) {
    const k = tituloNormal(e.titulo);
    if (vistas.has(k)) continue;
    const n = ocupadas.get(e.fecha) ?? activasDelDia(existentes, e.fecha);
    if (n >= MAX_PRIORIDADES) continue;
    const [fila] = filasDePrioridad([e.titulo], e.fecha, n + 1);
    if (!fila) continue;
    out.push(fila);
    vistas.add(k);
    ocupadas.set(e.fecha, n + 1);
  }
  return out;
}

/**
 * Editar una entrega retira su misión solo si estaba pendiente y cambia lo que
 * las une. La de una entrega ya cerrada se pagó: su hueco de los tres sigue ocupado.
 */
export function editarRetiraMision(anterior: Pick<Entrega, 'titulo' | 'fecha' | 'hecha'>, nueva: { titulo: string; fecha: string | null }): boolean {
  return !anterior.hecha && (anterior.titulo !== nueva.titulo.trim() || anterior.fecha !== nueva.fecha);
}

export type PlanCierre = { accion: 'nada' } | { accion: 'completar' | 'adelantar' | 'retirar'; questId: string; rango: number };

/**
 * Qué le pasa a la misión al cerrar la entrega. Cerrar no paga: paga la misión.
 * Cerrar antes de tiempo la adelanta a hoy, para que acabar pronto no salga peor
 * que acabar en la fecha, salvo que hoy ya haya tres; entonces se retira.
 */
export function planCierreEntrega(e: Pick<Entrega, 'titulo' | 'fecha'>, misiones: readonly MisionConDia[], hoy: string): PlanCierre {
  const m = misionDeEntrega(e, misiones);
  if (!m || !m.activa || m.dia < hoy) return { accion: 'nada' };
  if (m.dia === hoy) return { accion: 'completar', questId: m.id, rango: 1 };
  const n = activasDelDia(misiones, hoy);
  return n < MAX_PRIORIDADES ? { accion: 'adelantar', questId: m.id, rango: n + 1 } : { accion: 'retirar', questId: m.id, rango: 1 };
}

/** Lo que se puede crear de verdad ese día: sin repetir lo que ya hay y sin pasar de tres. */
export function prioridadesNuevas(titulos: readonly string[], existentes: readonly MisionConDia[], dia: string): { titulos: string[]; rangoDesde: number } {
  const activas = activasDelDia(existentes, dia);
  const ya = new Set(existentes.filter((m) => m.activa && m.dia === dia).map((m) => normal(m.titulo)));
  return {
    titulos: limpiarEntradas(titulos)
      .filter((t) => !ya.has(normal(t)))
      .slice(0, Math.max(0, MAX_PRIORIDADES - activas)),
    rangoDesde: activas + 1,
  };
}
