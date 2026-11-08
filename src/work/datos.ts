// NIVL · WORK: lecturas y escrituras (efectos, con Supabase). Tablas de la 0115 y columnas de la 0116.
//
// Sin la 0115 las tablas no existen: leer devuelve vacío con `disponible:
// false` (estado vacío, nunca error rojo) y escribir lanza `WorkNoDisponible`,
// que la pantalla enseña como aviso tranquilo. Cualquier otro fallo sí es fallo.
//
// Nada de aquí mueve XP. Lo único que paga en WORK es completar una misión con
// `completeQuest` (src/lib/engine.ts → complete_quest) y `propagarActo`.

import { supabase } from '@/lib/supabase';
import { aEvento } from './adaptar';
import { esFecha } from './fechas';
import { filasDePrioridad } from './prioridades';
import type { MisionSemana } from './semana';
import {
  DATOS_VACIOS,
  RAZONES_QUEDO,
  esEstadoProyecto,
  type DatosWork,
  type Entrega,
  type EstadoProyecto,
  type EventoTrabajo,
  type ItemRevision,
  type Proyecto,
  type Revision,
  type SesionTrabajo,
  type TipoSesion,
} from './tipos';

/** La migración aún no está en el servidor. */
export class WorkNoDisponible extends Error {
  constructor() {
    super('work_no_disponible');
    this.name = 'WorkNoDisponible';
  }
}

type ErrorPg = { code?: string; message?: string } | null;

/** Falta la tabla o la columna (42P01, 42703, PGRST204, PGRST205), o el CHECK del enlace 'trabajo'. */
export function esMigracionAusente(e: ErrorPg): boolean {
  if (!e) return false;
  if (e.code === '42P01' || e.code === '42703' || e.code === 'PGRST205' || e.code === 'PGRST204') return true;
  if (e.code === '23514' && /link_check/.test(e.message ?? '')) return true;
  return /does not exist|could not find the table|schema cache/i.test(e.message ?? '');
}

function comprobar(error: ErrorPg): void {
  if (!error) return;
  if (esMigracionAusente(error)) throw new WorkNoDisponible();
  throw error;
}

// ── Lectura ─────────────────────────────────────────────────────────────

type Fila = Record<string, unknown>;
const num = (v: unknown, d = 0) => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const numONull = (v: unknown) => (v === null || v === undefined || v === '' ? null : num(v));
const texto = (v: unknown) => (typeof v === 'string' ? v : '');
const textoONull = (v: unknown) => (typeof v === 'string' && v ? v : null);
const fecha = (v: unknown) => (typeof v === 'string' && esFecha(v.slice(0, 10)) ? v.slice(0, 10) : null);

const aProyecto = (r: Fila): Proyecto => ({
  id: texto(r.id),
  nombre: texto(r.name),
  cliente: textoONull(r.client_name),
  tarifaHora: numONull(r.hourly_rate),
  estado: esEstadoProyecto(r.status) ? r.status : 'activo',
  posicion: num(r.position),
});
const aEntrega = (r: Fila): Entrega => ({
  id: texto(r.id),
  proyectoId: textoONull(r.project_id),
  titulo: texto(r.title),
  fecha: fecha(r.due_date),
  hecha: r.done === true,
  hechaEl: fecha(r.done_on),
  posicion: num(r.position),
});
const aSesion = (r: Fila): SesionTrabajo => ({
  id: texto(r.id),
  clientId: texto(r.client_id),
  proyectoId: textoONull(r.project_id),
  entregaId: textoONull(r.deliverable_id),
  questId: textoONull(r.quest_id),
  tipo: r.kind === 'manual' ? 'manual' : 'bloque',
  fecha: fecha(r.session_date) ?? '1970-01-01',
  inicioMin: numONull(r.start_min),
  minutos: num(r.minutes),
  facturable: r.billable === true,
  facturadaEl: fecha(r.billed_on),
  nota: textoONull(r.note),
});
const aItems = (v: unknown): ItemRevision[] =>
  Array.isArray(v)
    ? v.flatMap((x) => {
        const o = (x ?? {}) as Fila;
        const origen = o.origen === 'entrega' || o.origen === 'proyecto' ? o.origen : ('mision' as const);
        const razon = RAZONES_QUEDO.find((r) => r === o.razon);
        return typeof o.titulo === 'string' && o.titulo ? [{ titulo: o.titulo, origen, ...(razon ? { razon } : {}) }] : [];
      })
    : [];
const aRevision = (r: Fila): Revision => ({
  id: texto(r.id),
  semana: fecha(r.week_start) ?? '1970-01-01',
  cerrado: aItems(r.closed),
  seQuedo: aItems(r.left_over),
  prioridades: Array.isArray(r.priorities) ? r.priorities.filter((x): x is string => typeof x === 'string') : [],
  minutosProfundos: num(r.deep_minutes),
  minutosTotales: num(r.total_minutes),
  minutosReunion: num(r.meeting_minutes),
  nota: textoONull(r.note),
});
const filas = (r: { data: unknown }) => (Array.isArray(r.data) ? (r.data as Fila[]) : []);

export interface RangoWork {
  /** Desde qué día se leen las sesiones. */
  desdeSesiones: string;
  desdeEventos: string;
  hastaEventos: string;
}

export interface LecturaWork {
  datos: DatosWork;
  /** false: la 0115 no está aplicada (estado vacío, sin error). `datos.eventos` sí viene. */
  disponible: boolean;
}

/** Los eventos del rango; sin la 0116, los de siempre, sin hora de fin. */
async function leerEventos(desde: string, hasta: string): Promise<EventoTrabajo[]> {
  const base = () => supabase.from('calendar_events').select('id,title,date,time').gte('date', desde).lte('date', hasta).order('date');
  const nuevo = await supabase.from('calendar_events').select('id,title,date,time,end_time,source').gte('date', desde).lte('date', hasta).order('date');
  if (!nuevo.error) return ((nuevo.data ?? []) as Parameters<typeof aEvento>[0][]).map(aEvento);
  if (!esMigracionAusente(nuevo.error as ErrorPg)) throw nuevo.error;
  const viejo = await base();
  if (viejo.error) throw viejo.error;
  return ((viejo.data ?? []) as Parameters<typeof aEvento>[0][]).map(aEvento);
}

export async function leerWork(r: RangoWork): Promise<LecturaWork> {
  const [p, e, s, v, eventos] = await Promise.all([
    supabase.from('work_projects').select('id,name,client_name,hourly_rate,status,position').order('position').order('created_at'),
    supabase.from('work_deliverables').select('id,project_id,title,due_date,done,done_on,position').order('due_date', { nullsFirst: false }),
    supabase.from('work_sessions').select('id,client_id,project_id,deliverable_id,quest_id,kind,session_date,start_min,minutes,billable,billed_on,note').gte('session_date', r.desdeSesiones),
    supabase.from('work_reviews').select('id,week_start,closed,left_over,priorities,deep_minutes,total_minutes,meeting_minutes,note').order('week_start', { ascending: false }).limit(26),
    leerEventos(r.desdeEventos, r.hastaEventos),
  ]);
  const errores = [p, e, s, v].map((x) => x.error as ErrorPg);
  if (errores.some(esMigracionAusente)) return { datos: { ...DATOS_VACIOS, eventos }, disponible: false };
  const otro = errores.find((x) => x);
  if (otro) throw otro;
  return {
    datos: { proyectos: filas(p).map(aProyecto), entregas: filas(e).map(aEntrega), sesiones: filas(s).map(aSesion), revisiones: filas(v).map(aRevision), eventos },
    disponible: true,
  };
}

/**
 * Las misiones de WORK de un rango, para la revisión: las prioridades escritas
 * (hechas o no) y las fijas completadas. Sin la 0115, vacío.
 */
export async function leerMisionesSemana(desde: string, hasta: string): Promise<MisionSemana[]> {
  const [p, c] = await Promise.all([
    supabase.from('quests').select('id,title,work_day').gte('work_day', desde).lte('work_day', hasta),
    supabase.from('completions').select('quest_id,date,quests!inner(title,modes)').gte('date', desde).lte('date', hasta).contains('quests.modes', ['work']),
  ]);
  if (esMigracionAusente(p.error as ErrorPg)) return [];
  if (p.error) throw p.error;
  if (c.error) throw c.error;
  const hechas = filas(c).map((x) => {
    const q = (Array.isArray(x.quests) ? x.quests[0] : x.quests) as Fila | null;
    return { id: texto(x.quest_id), fecha: fecha(x.date) ?? '1970-01-01', titulo: texto(q?.title) };
  });
  const clave = (id: string, f: string) => `${id}|${f}`;
  const prioridades = new Set(filas(p).map((q) => clave(texto(q.id), texto(q.work_day).slice(0, 10))));
  const hechasClave = new Set(hechas.map((h) => clave(h.id, h.fecha)));
  return [
    ...hechas.map((h): MisionSemana => ({ ...h, hecha: true, prioridad: prioridades.has(clave(h.id, h.fecha)) })),
    ...filas(p)
      .map((q) => ({ id: texto(q.id), titulo: texto(q.title), fecha: fecha(q.work_day) ?? '1970-01-01' }))
      .filter((q) => !hechasClave.has(clave(q.id, q.fecha)))
      .map((q): MisionSemana => ({ ...q, hecha: false, prioridad: true })),
  ];
}

// ── Prioridades del día (misiones normales de WORK) ─────────────────────

/** Crea las prioridades escritas. Devuelve lo creado. `rangoDesde`: 1 + las ya escritas hoy. */
export async function crearPrioridades(userId: string, titulos: readonly string[], hoy: string, rangoDesde = 1): Promise<{ id: string; title: string }[]> {
  const filasNuevas = filasDePrioridad(titulos, hoy, rangoDesde);
  if (filasNuevas.length === 0) return [];
  const { data, error } = await supabase
    .from('quests')
    .insert(filasNuevas.map((f) => ({ user_id: userId, ...f })))
    .select('id,title');
  comprobar(error);
  return (data ?? []) as { id: string; title: string }[];
}

/** Soltar una prioridad el día que se escribió: no se juega nada (closing.ts → debeEsperarAManana). */
export async function soltarPrioridad(questId: string, hoy: string): Promise<void> {
  const { error } = await supabase.from('quests').update({ active: false }).eq('id', questId).eq('work_day', hoy);
  comprobar(error);
}

/**
 * Las prioridades duran un día. Se llama con Hoy ya cargado (useHoy ya hizo el
 * cierre): así el día anterior se ha juzgado antes de retirarlas. Nunca lanza.
 */
export async function retirarPrioridadesCaducadas(hoy: string): Promise<void> {
  try {
    await supabase.from('quests').update({ active: false }).lt('work_day', hoy).eq('active', true);
  } catch {
    // Se reintenta en la próxima apertura.
  }
}

// ── Proyectos ───────────────────────────────────────────────────────────

export interface EdicionProyecto {
  id?: string;
  nombre: string;
  cliente: string | null;
  tarifaHora: number | null;
}

export async function guardarProyecto(p: EdicionProyecto): Promise<void> {
  const fila = { name: p.nombre.trim(), client_name: p.cliente?.trim() || null, hourly_rate: p.tarifaHora };
  const { error } = p.id ? await supabase.from('work_projects').update(fila).eq('id', p.id) : await supabase.from('work_projects').insert(fila);
  comprobar(error);
}

export async function fijarEstadoProyecto(id: string, estado: EstadoProyecto): Promise<void> {
  const { error } = await supabase.from('work_projects').update({ status: estado }).eq('id', id);
  comprobar(error);
}

/** Se lleva sus entregas; las horas se quedan, sin proyecto. */
export async function borrarProyecto(id: string): Promise<void> {
  const { error } = await supabase.from('work_projects').delete().eq('id', id);
  comprobar(error);
}

// ── Entregas ────────────────────────────────────────────────────────────

export interface EdicionEntrega {
  id?: string;
  proyectoId: string | null;
  titulo: string;
  fecha: string | null;
}

export async function guardarEntrega(e: EdicionEntrega): Promise<void> {
  const fila = { project_id: e.proyectoId, title: e.titulo.trim(), due_date: e.fecha };
  const { error } = e.id ? await supabase.from('work_deliverables').update(fila).eq('id', e.id) : await supabase.from('work_deliverables').insert(fila);
  comprobar(error);
}

/** `dia` es el día local. Cerrar una entrega no paga nada. */
export async function marcarEntrega(id: string, hecha: boolean, dia: string): Promise<void> {
  const { error } = await supabase.from('work_deliverables').update({ done: hecha, done_on: hecha ? dia : null }).eq('id', id);
  comprobar(error);
}

export async function borrarEntrega(id: string): Promise<void> {
  const { error } = await supabase.from('work_deliverables').delete().eq('id', id);
  comprobar(error);
}

// ── Sesiones ────────────────────────────────────────────────────────────

export interface NuevaSesion {
  clientId: string;
  tipo: TipoSesion;
  proyectoId: string | null;
  entregaId: string | null;
  questId: string | null;
  fecha: string;
  inicioMin: number | null;
  minutos: number;
  facturable: boolean;
  nota?: string | null;
}

/** Idempotente por client_id: la misma sesión se registra una sola vez. */
export async function registrarSesion(s: NuevaSesion): Promise<void> {
  const { error } = await supabase.from('work_sessions').upsert(
    {
      client_id: s.clientId,
      kind: s.tipo,
      project_id: s.proyectoId,
      deliverable_id: s.entregaId,
      quest_id: s.questId,
      session_date: s.fecha,
      start_min: s.inicioMin,
      minutes: Math.max(1, Math.min(720, Math.round(s.minutos))),
      billable: s.facturable,
      note: s.nota?.trim() || null,
    },
    { onConflict: 'user_id,client_id', ignoreDuplicates: true },
  );
  comprobar(error);
}

export async function borrarSesion(id: string): Promise<void> {
  const { error } = await supabase.from('work_sessions').delete().eq('id', id);
  comprobar(error);
}

export async function marcarFacturadas(ids: readonly string[], dia: string): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from('work_sessions').update({ billed_on: dia }).in('id', [...ids]);
  comprobar(error);
}

// ── Revisiones ──────────────────────────────────────────────────────────

export type EdicionRevision = Omit<Revision, 'id'>;

/** Una por semana: guardar otra vez la pisa. */
export async function guardarRevision(r: EdicionRevision): Promise<void> {
  const { error } = await supabase.from('work_reviews').upsert(
    {
      week_start: r.semana,
      closed: r.cerrado,
      left_over: r.seQuedo,
      priorities: r.prioridades.slice(0, 3),
      deep_minutes: r.minutosProfundos,
      total_minutes: r.minutosTotales,
      meeting_minutes: r.minutosReunion,
      note: r.nota?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,week_start' },
  );
  comprobar(error);
}
