// NIVL · WORK: lo que une proyectos y revisión con las misiones (efectos).
//
// Nada de aquí da XP por su cuenta: lo único que paga es `completeQuest`.

import { ensureProfile, fetchQuests } from '@/lib/data';
import { completeQuest, type CompleteResult } from '@/lib/engine';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { crearPrioridades, esMigracionAusente, WorkNoDisponible } from './datos';
import { filasDeEntregas, misionDeEntrega, planCierreEntrega, prioridadesNuevas, DIAS_ANTELACION_MISION, type MisionConDia } from './entregaMision';
import { diaSemana, sumarDias } from './fechas';
import type { Entrega } from './tipos';

type ErrorPg = { code?: string; message?: string } | null;

function comprobar(error: ErrorPg): void {
  if (!error) return;
  if (esMigracionAusente(error)) throw new WorkNoDisponible();
  throw error;
}

/** Las misiones con día propio del rango, también las retiradas. */
async function leerMisionesConDia(desde: string, hasta: string): Promise<MisionConDia[]> {
  const { data, error } = await supabase.from('quests').select('id,title,work_day,active').gte('work_day', desde).lte('work_day', hasta);
  comprobar(error as ErrorPg);
  return ((data ?? []) as { id: string; title: string; work_day: string; active: boolean }[]).map((q) => ({
    id: q.id,
    titulo: q.title,
    dia: q.work_day.slice(0, 10),
    activa: q.active,
  }));
}

let programando = false;

/**
 * Crea las misiones de las entregas que entran en la ventana. Idempotente, sin
 * consulta si no hay nada en la ventana, y nunca lanza: se reintenta en la
 * próxima lectura.
 */
export async function programarMisionesDeEntregas(userId: string, entregas: readonly Entrega[], hoy: string): Promise<void> {
  if (programando) return;
  const hasta = sumarDias(hoy, DIAS_ANTELACION_MISION);
  if (!entregas.some((e) => !e.hecha && e.fecha !== null && e.fecha >= hoy && e.fecha <= hasta)) return;
  programando = true;
  try {
    const filas = filasDeEntregas(entregas, await leerMisionesConDia(hoy, hasta), hoy);
    if (filas.length > 0) await supabase.from('quests').insert(filas.map((f) => ({ user_id: userId, ...f })));
  } catch {
    // Sin la 0115 o sin red.
  } finally {
    programando = false;
  }
}

/** Sin `work_day`: si la entrega vuelve a ese día y título, tendrá misión otra vez. */
const retirar = (id: string) => supabase.from('quests').update({ active: false, work_day: null, work_rank: null }).eq('id', id);

/** Al cambiar o borrar una entrega, la misión pendiente que tenía deja de valer. Nunca lanza. */
export async function retirarMisionDeEntrega(e: Pick<Entrega, 'titulo' | 'fecha'>, hoy: string): Promise<void> {
  if (!e.fecha || e.fecha < hoy) return;
  try {
    const m = misionDeEntrega(e, await leerMisionesConDia(e.fecha, e.fecha));
    if (!m?.activa) return;
    // Pagada, se queda: retirarla liberaría su hueco de los tres y se podría cobrar otra.
    const { count, error } = await supabase.from('completions').select('id', { count: 'exact', head: true }).eq('quest_id', m.id);
    if (!error && !count) await retirar(m.id);
  } catch {
    // Se queda: la retira retirarPrioridadesCaducadas al pasar su día.
  }
}

export interface MisionPagada {
  antes: Profile;
  resultado: CompleteResult;
  titulo: string;
}

/**
 * Cerrar una entrega completa su misión, si la tiene. Un fallo aquí no tumba el
 * cierre de la entrega: la misión queda para marcarla a mano.
 */
export async function cerrarMisionDeEntrega(userId: string, e: Pick<Entrega, 'titulo' | 'fecha'>, hoy: string): Promise<MisionPagada | null> {
  try {
    const plan = planCierreEntrega(e, await leerMisionesConDia(hoy, sumarDias(hoy, DIAS_ANTELACION_MISION)), hoy);
    if (plan.accion === 'nada') return null;
    if (plan.accion === 'retirar') {
      await retirar(plan.questId);
      return null;
    }
    if (plan.accion === 'adelantar') {
      const { error } = await supabase.from('quests').update({ days_of_week: [diaSemana(hoy)], work_day: hoy, work_rank: plan.rango }).eq('id', plan.questId);
      if (error) return null;
    }
    const q = (await fetchQuests()).find((x) => x.id === plan.questId);
    if (!q || q.is_penalty) return null;
    const antes = await ensureProfile(userId);
    const resultado = await completeQuest(antes, q, null);
    return resultado.awarded ? { antes, resultado, titulo: q.title } : null;
  } catch {
    return null;
  }
}

/** Las prioridades de `dia`, contra lo que ya hay en el servidor: repetir no duplica ni pasa de tres. Devuelve cuántas se crearon. */
export async function crearPrioridadesDelDia(userId: string, titulos: readonly string[], dia: string): Promise<number> {
  const nuevas = prioridadesNuevas(titulos, await leerMisionesConDia(dia, dia), dia);
  return (await crearPrioridades(userId, nuevas.titulos, dia, nuevas.rangoDesde)).length;
}
