// NIVL · WORK: la agenda contra Supabase (efectos). Copia del calendario del
// teléfono (columnas de la 0116) y reunión o bloque añadidos a mano.
//
// Nada de aquí mueve XP. Un evento no paga; un bloque reservado tampoco: paga
// la misión que cierre el bloque de verdad.

import { supabase } from '@/lib/supabase';
import { idsObsoletos, rangoCalendario, type FilaImportada } from './calendario';
import { encajarEnPlan } from './agendaRapida';
import { esMigracionAusente, WorkNoDisponible } from './datos';
import { minAHora } from './fechas';

/** El plan del día está tras el consentimiento de salud (0030) y la cuenta no lo ha dado. */
export class BloqueSinPermiso extends Error {
  constructor() {
    super('bloque_sin_permiso');
    this.name = 'BloqueSinPermiso';
  }
}

const esPermiso = (e: { code?: string } | null) => e?.code === '42501';

/** Copia lo del teléfono sin duplicar y retira lo que ya no está. */
export async function volcarImportados(userId: string, filas: readonly FilaImportada[], hoy: string): Promise<void> {
  const { desde, hasta } = rangoCalendario(hoy);
  if (filas.length) {
    const { error } = await supabase
      .from('calendar_events')
      .upsert(filas.map((f) => ({ ...f, user_id: userId })), { onConflict: 'user_id,external_id' });
    if (error) {
      if (esMigracionAusente(error)) throw new WorkNoDisponible();
      throw error;
    }
  }
  const { data, error } = await supabase.from('calendar_events').select('id, date, external_id').eq('source', 'dispositivo').gte('date', desde).lte('date', hasta);
  if (error) {
    if (esMigracionAusente(error)) throw new WorkNoDisponible();
    throw error;
  }
  const sobran = idsObsoletos((data ?? []) as { id: string; date: string; external_id: string | null }[], filas, hoy);
  if (sobran.length) {
    const { error: e2 } = await supabase.from('calendar_events').delete().in('id', sobran);
    if (e2) throw e2;
  }
}

/** Desconectar: borra todo lo copiado, también lo pasado. */
export async function borrarImportados(): Promise<void> {
  const { error } = await supabase.from('calendar_events').delete().eq('source', 'dispositivo');
  if (error && !esMigracionAusente(error)) throw error;
}

export interface NuevoTramo {
  titulo: string;
  fecha: string;
  inicioMin: number;
  finMin: number;
}

/** Sin la 0116 la reunión se guarda igual, sin hora de fin. */
export async function crearReunion(userId: string, r: NuevoTramo): Promise<void> {
  const base = { user_id: userId, title: r.titulo, date: r.fecha, time: minAHora(r.inicioMin) };
  const { error } = await supabase.from('calendar_events').insert({ ...base, end_time: minAHora(r.finMin) });
  if (!error) return;
  if (!esMigracionAusente(error)) throw error;
  const { error: e2 } = await supabase.from('calendar_events').insert(base);
  if (e2) throw e2;
}

async function planDelDia(userId: string, fecha: string): Promise<string> {
  const buscar = () => supabase.from('day_plans').select('id').eq('date', fecha).maybeSingle();
  const hay = await buscar();
  if (hay.error) throw hay.error;
  if (hay.data) return (hay.data as { id: string }).id;
  const nuevo = await supabase.from('day_plans').insert({ user_id: userId, date: fecha }).select('id').single();
  if (!nuevo.error) return (nuevo.data as { id: string }).id;
  if (esPermiso(nuevo.error)) throw new BloqueSinPermiso();
  // Otro móvil lo creó a la vez.
  const otra = await buscar();
  if (otra.error || !otra.data) throw nuevo.error;
  return (otra.data as { id: string }).id;
}

/**
 * Reserva un bloque de trabajo en el plan del día. Sin aviso propio: el aviso
 * es el del temporizador. Si el coach reescribe el plan de ese día, lo sustituye.
 */
export async function crearBloque(userId: string, b: NuevoTramo): Promise<void> {
  const planId = await planDelDia(userId, b.fecha);
  const { data, error } = await supabase.from('day_blocks').select('id, start_min, position').eq('plan_id', planId);
  if (error) throw error;
  const { posicion, mover } = encajarEnPlan((data ?? []) as { id: string; start_min: number; position: number }[], b.inicioMin);
  const { error: e2 } = await supabase.from('day_blocks').insert({
    plan_id: planId,
    user_id: userId,
    start_min: b.inicioMin,
    end_min: b.finMin,
    title: b.titulo,
    kind: 'deep_work',
    notify: false,
    position: posicion,
  });
  if (e2) {
    if (esPermiso(e2)) throw new BloqueSinPermiso();
    throw e2;
  }
  // El bloque ya está; si correr los demás falla, solo se desordena la lectura de «el siguiente».
  await Promise.all(mover.map((m) => supabase.from('day_blocks').update({ position: m.position }).eq('id', m.id)));
}
