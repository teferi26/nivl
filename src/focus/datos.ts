// NIVL · FOCUS: lecturas y escrituras (efectos, con Supabase). Tablas de la 0076.
//
// Mientras la 0076 no esté aplicada, las tablas no existen: leer devuelve
// DATOS_VACIOS con `disponible: false` (la pantalla pinta su estado vacío,
// nunca un error rojo) y escribir lanza `FocusNoDisponible`, que la pantalla
// enseña como aviso tranquilo. Cualquier otro fallo sí es un fallo.
//
// Nada de aquí mueve XP. El único pago de FOCUS es completar una misión de
// FOCUS por `completeQuest` (src/lib/engine.ts → complete_quest).

import { supabase } from '@/lib/supabase';
import { esFecha } from './fechas';
import { primerRepaso, programar, type Resultado } from './repaso';
import {
  DATOS_VACIOS,
  esEstadoTema,
  type Asignatura,
  type Clase,
  type DatosFocus,
  type EstadoTema,
  type Examen,
  type Mazo,
  type Nota,
  type Sesion,
  type Tarjeta,
  type Tema,
} from './tipos';

/** La 0076 aún no está en el servidor. */
export class FocusNoDisponible extends Error {
  constructor() {
    super('focus_no_disponible');
    this.name = 'FocusNoDisponible';
  }
}

type ErrorPg = { code?: string; message?: string } | null;

/** «No existe la tabla» (Postgres 42P01 o PostgREST PGRST205/PGRST204). */
export function esTablaAusente(e: ErrorPg): boolean {
  if (!e) return false;
  if (e.code === '42P01' || e.code === 'PGRST205' || e.code === 'PGRST204') return true;
  return /does not exist|could not find the table|schema cache/i.test(e.message ?? '');
}

function comprobar(error: ErrorPg): void {
  if (!error) return;
  if (esTablaAusente(error)) throw new FocusNoDisponible();
  throw error;
}

// ── Lectura ─────────────────────────────────────────────────────────────

const num = (v: unknown, d = 0) => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const numONull = (v: unknown) => (v === null || v === undefined || v === '' ? null : num(v, NaN));
const texto = (v: unknown) => (typeof v === 'string' ? v : '');
const fecha = (v: unknown) => (typeof v === 'string' && esFecha(v.slice(0, 10)) ? v.slice(0, 10) : null);
type Fila = Record<string, unknown>;

const aAsignatura = (r: Fila): Asignatura => ({ id: texto(r.id), nombre: texto(r.name), posicion: num(r.position) });
const aTema = (r: Fila): Tema => ({
  id: texto(r.id),
  asignaturaId: texto(r.subject_id),
  examenId: typeof r.exam_id === 'string' ? r.exam_id : null,
  nombre: texto(r.name),
  estado: esEstadoTema(r.status) ? r.status : 'pendiente',
  posicion: num(r.position),
  etapa: num(r.review_stage),
  repasoEl: fecha(r.review_due),
});
const aExamen = (r: Fila): Examen => ({
  id: texto(r.id),
  asignaturaId: texto(r.subject_id),
  titulo: texto(r.title),
  fecha: fecha(r.exam_date) ?? '1970-01-01',
  peso: numONull(r.weight),
});
const aSesion = (r: Fila): Sesion => ({
  id: texto(r.id),
  asignaturaId: typeof r.subject_id === 'string' ? r.subject_id : null,
  temaId: typeof r.topic_id === 'string' ? r.topic_id : null,
  fecha: fecha(r.session_date) ?? '1970-01-01',
  minutos: num(r.minutes),
  metodo: typeof r.method === 'string' ? r.method : null,
});
const aClase = (r: Fila): Clase => ({
  id: texto(r.id),
  asignaturaId: texto(r.subject_id),
  dia: num(r.weekday, 1),
  inicio: num(r.start_min),
  fin: num(r.end_min),
  aula: typeof r.room === 'string' && r.room ? r.room : null,
});
const aNota = (r: Fila): Nota => ({
  id: texto(r.id),
  asignaturaId: texto(r.subject_id),
  titulo: texto(r.title),
  nota: num(r.score),
  sobre: num(r.max_score, 10),
  peso: numONull(r.weight),
  fecha: fecha(r.graded_on) ?? '1970-01-01',
});
const aMazo = (r: Fila): Mazo => ({
  id: texto(r.id),
  asignaturaId: typeof r.subject_id === 'string' ? r.subject_id : null,
  nombre: texto(r.name),
});
const aTarjeta = (r: Fila): Tarjeta => ({
  id: texto(r.id),
  mazoId: texto(r.deck_id),
  anverso: texto(r.front),
  reverso: texto(r.back),
  etapa: num(r.stage),
  vence: fecha(r.due) ?? '1970-01-01',
});

export interface LecturaFocus {
  datos: DatosFocus;
  /** false: la 0076 no está aplicada (estado vacío, sin error). */
  disponible: boolean;
}

/** Todo lo de FOCUS de la cuenta (las sesiones, de los últimos 60 días). */
export async function leerFocus(desdeSesiones: string): Promise<LecturaFocus> {
  const [s, e, t, se, c, n, m, ta] = await Promise.all([
    supabase.from('focus_subjects').select('id,name,position').eq('archived', false).order('position').order('created_at'),
    supabase.from('focus_exams').select('id,subject_id,title,exam_date,weight').order('exam_date'),
    supabase.from('focus_topics').select('id,subject_id,exam_id,name,status,position,review_stage,review_due').order('position').order('created_at'),
    supabase.from('focus_sessions').select('id,subject_id,topic_id,session_date,minutes,method').gte('session_date', desdeSesiones),
    supabase.from('focus_classes').select('id,subject_id,weekday,start_min,end_min,room').order('weekday').order('start_min'),
    supabase.from('focus_grades').select('id,subject_id,title,score,max_score,weight,graded_on').order('graded_on'),
    supabase.from('focus_decks').select('id,subject_id,name').order('created_at'),
    supabase.from('focus_cards').select('id,deck_id,front,back,stage,due').order('due'),
  ]);
  const errores = [s, e, t, se, c, n, m, ta].map((r) => r.error as ErrorPg);
  if (errores.some(esTablaAusente)) return { datos: DATOS_VACIOS, disponible: false };
  const otro = errores.find((x) => x);
  if (otro) throw otro;
  const filas = (r: { data: unknown }) => (Array.isArray(r.data) ? (r.data as Fila[]) : []);
  return {
    disponible: true,
    datos: {
      asignaturas: filas(s).map(aAsignatura),
      examenes: filas(e).map(aExamen),
      temas: filas(t).map(aTema),
      sesiones: filas(se).map(aSesion),
      clases: filas(c).map(aClase),
      notas: filas(n).map(aNota),
      mazos: filas(m).map(aMazo),
      tarjetas: filas(ta).map(aTarjeta),
    },
  };
}

// ── Escritura ───────────────────────────────────────────────────────────

export async function crearAsignatura(nombre: string, posicion: number): Promise<void> {
  const { error } = await supabase.from('focus_subjects').insert({ name: nombre.trim(), position: posicion });
  comprobar(error);
}

/** Archiva (no borra): sus horas y notas siguen en la exportación. */
export async function archivarAsignatura(id: string): Promise<void> {
  const { error } = await supabase.from('focus_subjects').update({ archived: true }).eq('id', id);
  comprobar(error);
}

export async function crearTemas(asignaturaId: string, nombres: readonly string[], examenId: string | null, desde: number): Promise<void> {
  const filas = nombres
    .map((n) => n.trim())
    .filter(Boolean)
    .map((name, i) => ({ subject_id: asignaturaId, exam_id: examenId, name, position: desde + i }));
  if (filas.length === 0) return;
  const { error } = await supabase.from('focus_topics').insert(filas);
  comprobar(error);
}

/**
 * Cambia el estado de un tema. Al pasar a «repasando» por primera vez arranca
 * su calendario de repasos (mañana); a «pendiente», lo quita.
 */
export async function cambiarEstadoTema(tema: Pick<Tema, 'id' | 'repasoEl'>, estado: EstadoTema, hoy: string): Promise<void> {
  const patch: Fila = { status: estado };
  if (estado === 'pendiente') {
    patch.review_stage = 0;
    patch.review_due = null;
  } else if (!tema.repasoEl) {
    const p = primerRepaso(hoy);
    patch.review_stage = p.etapa;
    patch.review_due = p.vence;
  }
  const { error } = await supabase.from('focus_topics').update(patch).eq('id', tema.id);
  comprobar(error);
}

export async function repasarTema(tema: Pick<Tema, 'id' | 'etapa'>, resultado: Resultado, hoy: string): Promise<void> {
  const p = programar(tema.etapa, resultado, hoy);
  const { error } = await supabase.from('focus_topics').update({ review_stage: p.etapa, review_due: p.vence }).eq('id', tema.id);
  comprobar(error);
}

export async function borrarTema(id: string): Promise<void> {
  const { error } = await supabase.from('focus_topics').delete().eq('id', id);
  comprobar(error);
}

export interface NuevoExamen {
  asignaturaId: string;
  titulo: string;
  fecha: string;
  peso: number | null;
  temas: string[];
}

export async function crearExamen(x: NuevoExamen, desdePosicion: number): Promise<void> {
  const { data, error } = await supabase
    .from('focus_exams')
    .insert({ subject_id: x.asignaturaId, title: x.titulo.trim(), exam_date: x.fecha, weight: x.peso })
    .select('id')
    .single();
  comprobar(error);
  const id = (data as { id?: string } | null)?.id ?? null;
  if (id && x.temas.length > 0) await crearTemas(x.asignaturaId, x.temas, id, desdePosicion);
}

export async function borrarExamen(id: string): Promise<void> {
  const { error } = await supabase.from('focus_exams').delete().eq('id', id);
  comprobar(error);
}

export interface NuevaSesion {
  clientId: string;
  asignaturaId: string | null;
  temaId: string | null;
  misionId: string | null;
  fecha: string;
  minutos: number;
  metodo: string | null;
}

/** Registra un bloque terminado. Idempotente por `clientId` (reintentos, dos pantallas). */
export async function registrarSesion(s: NuevaSesion): Promise<void> {
  const { error } = await supabase.from('focus_sessions').upsert(
    {
      client_id: s.clientId,
      subject_id: s.asignaturaId,
      topic_id: s.temaId,
      quest_id: s.misionId,
      session_date: s.fecha,
      minutes: Math.max(1, Math.min(240, Math.round(s.minutos))),
      method: s.metodo,
    },
    { onConflict: 'user_id,client_id', ignoreDuplicates: true },
  );
  comprobar(error);
}

export async function crearClase(c: Omit<Clase, 'id'>): Promise<void> {
  const { error } = await supabase
    .from('focus_classes')
    .insert({ subject_id: c.asignaturaId, weekday: c.dia, start_min: c.inicio, end_min: c.fin, room: c.aula });
  comprobar(error);
}

export async function borrarClase(id: string): Promise<void> {
  const { error } = await supabase.from('focus_classes').delete().eq('id', id);
  comprobar(error);
}

export async function crearNota(n: Omit<Nota, 'id'>): Promise<void> {
  const { error } = await supabase.from('focus_grades').insert({
    subject_id: n.asignaturaId,
    title: n.titulo.trim(),
    score: n.nota,
    max_score: n.sobre,
    weight: n.peso,
    graded_on: n.fecha,
  });
  comprobar(error);
}

export async function borrarNota(id: string): Promise<void> {
  const { error } = await supabase.from('focus_grades').delete().eq('id', id);
  comprobar(error);
}

export async function crearMazo(nombre: string, asignaturaId: string | null): Promise<void> {
  const { error } = await supabase.from('focus_decks').insert({ name: nombre.trim(), subject_id: asignaturaId });
  comprobar(error);
}

export async function crearTarjeta(mazoId: string, anverso: string, reverso: string, hoy: string): Promise<void> {
  const { error } = await supabase
    .from('focus_cards')
    .insert({ deck_id: mazoId, front: anverso.trim(), back: reverso.trim(), stage: 0, due: hoy });
  comprobar(error);
}

export async function repasarTarjeta(t: Pick<Tarjeta, 'id' | 'etapa'>, resultado: Resultado, hoy: string): Promise<void> {
  const p = programar(t.etapa, resultado, hoy);
  const { error } = await supabase
    .from('focus_cards')
    .update({ stage: p.etapa, due: p.vence, last_reviewed_at: new Date().toISOString() })
    .eq('id', t.id);
  comprobar(error);
}

export async function borrarTarjeta(id: string): Promise<void> {
  const { error } = await supabase.from('focus_cards').delete().eq('id', id);
  comprobar(error);
}
