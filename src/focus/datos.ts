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
import { cierreBloque, type ResultadoBloque } from './cierreBloque';
import { esSesionDictada } from './mision';
import { primerRepaso, programar, type Resultado } from './repaso';
import {
  DATOS_VACIOS,
  esEstadoTema,
  esTipoExamen,
  normalizarPrefs,
  type Asignatura,
  type Clase,
  type DatosFocus,
  type EstadoTema,
  type Examen,
  type Mazo,
  type Nota,
  type PrefsFocus,
  type Sesion,
  type Tarjeta,
  type Tema,
  type TipoExamen,
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

/** Falta una columna de la 0112 (la tabla sí existe). */
export function esColumnaAusente(e: ErrorPg): boolean {
  if (!e) return false;
  if (e.code === '42703' || e.code === 'PGRST204') return true;
  return /column .* does not exist|could not find the .* column/i.test(e.message ?? '');
}

function comprobar(error: ErrorPg): void {
  if (!error) return;
  if (esTablaAusente(error)) throw new FocusNoDisponible();
  // Sin la 0112, exam_date sigue siendo obligatoria: un examen sin fecha aún no cabe.
  if (error.code === '23502' && /exam_date/.test(error.message ?? '')) throw new FocusNoDisponible();
  throw error;
}

// ── Lectura ─────────────────────────────────────────────────────────────

const num = (v: unknown, d = 0) => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const numONull = (v: unknown) => (v === null || v === undefined || v === '' ? null : num(v, NaN));
const texto = (v: unknown) => (typeof v === 'string' ? v : '');
const fecha = (v: unknown) => (typeof v === 'string' && esFecha(v.slice(0, 10)) ? v.slice(0, 10) : null);
type Fila = Record<string, unknown>;

const textoONull = (v: unknown) => (typeof v === 'string' && v !== '' ? v : null);

const aAsignatura = (r: Fila): Asignatura => ({
  id: texto(r.id),
  nombre: texto(r.name),
  posicion: num(r.position),
  notaObjetivo: numONull(r.target_grade),
  vuelta: Math.max(1, num(r.lap, 1)),
});
const aTema = (r: Fila): Tema => ({
  id: texto(r.id),
  asignaturaId: texto(r.subject_id),
  examenId: typeof r.exam_id === 'string' ? r.exam_id : null,
  nombre: texto(r.name),
  estado: esEstadoTema(r.status) ? r.status : 'pendiente',
  posicion: num(r.position),
  etapa: num(r.review_stage),
  repasoEl: fecha(r.review_due),
  seccion: textoONull(r.section),
  repasadoEl: fecha(r.last_reviewed_on),
});
const aExamen = (r: Fila): Examen => ({
  id: texto(r.id),
  asignaturaId: texto(r.subject_id),
  titulo: texto(r.title),
  fecha: fecha(r.exam_date),
  peso: numONull(r.weight),
  hora: numONull(r.exam_time),
  tipo: esTipoExamen(r.kind) ? r.kind : 'examen',
  estimada: r.date_estimated === true,
  hechaEl: fecha(r.done_on),
});
const aSesion = (r: Fila): Sesion => ({
  id: texto(r.id),
  asignaturaId: typeof r.subject_id === 'string' ? r.subject_id : null,
  temaId: typeof r.topic_id === 'string' ? r.topic_id : null,
  fecha: fecha(r.session_date) ?? '1970-01-01',
  minutos: num(r.minutes),
  metodo: typeof r.method === 'string' ? r.method : null,
  salidas: num(r.exits),
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

/** Las columnas de la 0076 y las que añade la 0112. Sin la 0112 se lee lo de antes. */
const COLUMNAS = {
  asignaturas: ['id,name,position', ',target_grade,lap'],
  examenes: ['id,subject_id,title,exam_date,weight', ',exam_time,date_estimated,kind,done_on'],
  temas: ['id,subject_id,exam_id,name,status,position,review_stage,review_due', ',section,last_reviewed_on'],
  sesiones: ['id,subject_id,topic_id,session_date,minutes,method', ',exits'],
} as const;

const PAGINA = 1000;
const MAX_PAGINAS = 10;

async function leerSesiones(desde: string, columnas: string): Promise<{ data: Fila[]; error: ErrorPg }> {
  // PostgREST corta en 1000 filas: un año de bloques no cabe en una respuesta.
  const out: Fila[] = [];
  for (let p = 0; p < MAX_PAGINAS; p++) {
    const r = await supabase
      .from('focus_sessions')
      .select(columnas)
      .gte('session_date', desde)
      .order('session_date', { ascending: false })
      .order('id')
      .range(p * PAGINA, p * PAGINA + PAGINA - 1);
    if (r.error) return { data: [], error: r.error as ErrorPg };
    const filas = (Array.isArray(r.data) ? r.data : []) as unknown as Fila[];
    out.push(...filas);
    if (filas.length < PAGINA) break;
  }
  return { data: out, error: null };
}

async function leerPrefs(): Promise<PrefsFocus> {
  // Sin la 0112 (o sin fila de modo): las de por defecto.
  const { data, error } = await supabase.from('user_modes').select('settings').eq('mode', 'focus').maybeSingle();
  if (error) return normalizarPrefs(null);
  return normalizarPrefs((data as { settings?: unknown } | null)?.settings);
}

async function leerTablas(desdeSesiones: string, con0112: boolean) {
  const cols = (k: keyof typeof COLUMNAS) => COLUMNAS[k][0] + (con0112 ? COLUMNAS[k][1] : '');
  return Promise.all([
    supabase.from('focus_subjects').select(cols('asignaturas')).eq('archived', false).order('position').order('created_at'),
    supabase.from('focus_exams').select(cols('examenes')).order('exam_date'),
    supabase.from('focus_topics').select(cols('temas')).order('position').order('created_at'),
    leerSesiones(desdeSesiones, cols('sesiones')),
    supabase.from('focus_classes').select('id,subject_id,weekday,start_min,end_min,room').order('weekday').order('start_min'),
    supabase.from('focus_grades').select('id,subject_id,title,score,max_score,weight,graded_on').order('graded_on'),
    supabase.from('focus_decks').select('id,subject_id,name').order('created_at'),
    supabase.from('focus_cards').select('id,deck_id,front,back,stage,due').order('due'),
  ]);
}

/** Todo lo de FOCUS de la cuenta. Las sesiones, desde `desdeSesiones` (paginadas). */
export async function leerFocus(desdeSesiones: string): Promise<LecturaFocus> {
  let r = await leerTablas(desdeSesiones, true);
  if (r.some((x) => esColumnaAusente(x.error as ErrorPg))) r = await leerTablas(desdeSesiones, false);
  const [s, e, t, se, c, n, m, ta] = r;
  const errores = r.map((x) => x.error as ErrorPg);
  if (errores.some(esTablaAusente)) return { datos: DATOS_VACIOS, disponible: false };
  const otro = errores.find((x) => x);
  if (otro) throw otro;
  const filas = (x: { data: unknown }) => (Array.isArray(x.data) ? (x.data as Fila[]) : []);
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
      prefs: await leerPrefs(),
    },
  };
}

// ── Escritura ───────────────────────────────────────────────────────────

const COLUMNAS_0112 = ['exam_time', 'date_estimated', 'kind', 'done_on', 'target_grade', 'lap', 'section', 'last_reviewed_on', 'exits'] as const;

/** Sin la 0112 se reintenta sin sus columnas; si no queda nada que escribir, FOCUS no está listo. */
async function escribir(fila: Fila, fn: (f: Fila) => PromiseLike<{ error: unknown }>): Promise<void> {
  const { error } = await fn(fila);
  if (!esColumnaAusente(error as ErrorPg)) {
    comprobar(error as ErrorPg);
    return;
  }
  const sin = Object.fromEntries(Object.entries(fila).filter(([c]) => !(COLUMNAS_0112 as readonly string[]).includes(c)));
  if (Object.keys(sin).length === 0) throw new FocusNoDisponible();
  const r = await fn(sin);
  comprobar(r.error as ErrorPg);
}

export async function crearAsignatura(nombre: string, posicion: number): Promise<void> {
  const { error } = await supabase.from('focus_subjects').insert({ name: nombre.trim(), position: posicion });
  comprobar(error);
}

/** Varias de golpe (el arranque guiado con plantilla). */
export async function crearAsignaturas(nombres: readonly string[], desde: number): Promise<void> {
  const filas = nombres
    .map((n) => n.trim())
    .filter(Boolean)
    .map((name, i) => ({ name, position: desde + i }));
  if (filas.length === 0) return;
  const { error } = await supabase.from('focus_subjects').insert(filas);
  comprobar(error);
}

/** Archiva (no borra): sus horas y notas siguen en la exportación. */
export async function archivarAsignatura(id: string): Promise<void> {
  const { error } = await supabase.from('focus_subjects').update({ archived: true }).eq('id', id);
  comprobar(error);
}

/** La nota que se quiere en una asignatura (null: el 5 de siempre). */
export async function fijarNotaObjetivo(asignaturaId: string, nota: number | null): Promise<void> {
  await escribir({ target_grade: nota }, (f) => supabase.from('focus_subjects').update(f).eq('id', asignaturaId));
}

const LOTE = 200;

const trozos = <T>(xs: readonly T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
};

export type TemaNuevo = string | { nombre: string; seccion?: string | null };

/** Por lotes: 70 temas de golpe. Cada nombre, recortado al tope de la tabla. */
export async function crearTemas(asignaturaId: string, temas: readonly TemaNuevo[], examenId: string | null, desde: number): Promise<void> {
  const filas = temas
    .map((t) => (typeof t === 'string' ? { nombre: t, seccion: null } : { nombre: t.nombre, seccion: t.seccion ?? null }))
    .map((t) => ({ name: t.nombre.trim().slice(0, 160).trim(), section: t.seccion ? t.seccion.trim().slice(0, 80) || null : null }))
    .filter((t) => t.name.length > 0)
    .map((t, i) => ({ subject_id: asignaturaId, exam_id: examenId, name: t.name, section: t.section, position: desde + i }));
  for (const lote of trozos(filas, LOTE)) {
    const { error } = await supabase.from('focus_topics').insert(lote);
    if (esColumnaAusente(error as ErrorPg)) {
      const r = await supabase.from('focus_topics').insert(lote.map(({ section: _s, ...f }) => f));
      comprobar(r.error as ErrorPg);
    } else {
      comprobar(error as ErrorPg);
    }
  }
}

export async function renombrarTema(id: string, nombre: string, seccion?: string | null): Promise<void> {
  const fila: Fila = { name: nombre.trim().slice(0, 160).trim() };
  if (seccion !== undefined) fila.section = seccion ? seccion.trim().slice(0, 80) || null : null;
  await escribir(fila, (f) => supabase.from('focus_topics').update(f).eq('id', id));
}

/**
 * Cambia el estado de un tema. Al pasar a «repasando» o «dominado» sin
 * calendario, lo arranca (mañana). Volver a «pendiente» NO borra etapa ni
 * repaso: solo con `borrarRepaso`, después de confirmarlo con la persona.
 */
export async function cambiarEstadoTema(
  tema: Pick<Tema, 'id' | 'repasoEl'>,
  estado: EstadoTema,
  hoy: string,
  opciones?: { borrarRepaso?: boolean },
): Promise<void> {
  const patch: Fila = { status: estado };
  if (estado === 'pendiente') {
    if (opciones?.borrarRepaso) {
      patch.review_stage = 0;
      patch.review_due = null;
    }
  } else if (!tema.repasoEl) {
    const p = primerRepaso(hoy);
    patch.review_stage = p.etapa;
    patch.review_due = p.vence;
  }
  const { error } = await supabase.from('focus_topics').update(patch).eq('id', tema.id);
  comprobar(error);
}

/** Aplica el «¿Cómo te ha ido?» de un bloque al tema. «Sin acabar» no escribe. */
export async function cerrarBloqueTema(tema: Pick<Tema, 'id' | 'estado' | 'etapa' | 'repasoEl'>, resultado: ResultadoBloque, hoy: string): Promise<void> {
  const c = cierreBloque(tema, resultado, hoy);
  if (!c) return;
  const { error } = await supabase.from('focus_topics').update({ status: c.estado, review_stage: c.etapa, review_due: c.repasoEl }).eq('id', tema.id);
  comprobar(error);
}

export async function repasarTema(tema: Pick<Tema, 'id' | 'etapa'>, resultado: Resultado, hoy: string): Promise<void> {
  const p = programar(tema.etapa, resultado, hoy);
  await escribir({ review_stage: p.etapa, review_due: p.vence, last_reviewed_on: hoy }, (f) => supabase.from('focus_topics').update(f).eq('id', tema.id));
}

/**
 * Empezar otra vuelta al temario: lo visto vuelve a «pendiente» SIN tocar etapa
 * ni repaso (los repasos siguen su calendario) y la asignatura sube de vuelta.
 */
export async function empezarVuelta(asignaturaId: string, vueltaActual: number): Promise<void> {
  // La vuelta primero: sin su columna falla aquí, antes de tocar el temario.
  await escribir({ lap: Math.min(99, vueltaActual + 1) }, (f) => supabase.from('focus_subjects').update(f).eq('id', asignaturaId));
  const { error } = await supabase.from('focus_topics').update({ status: 'pendiente' }).eq('subject_id', asignaturaId).neq('status', 'pendiente');
  comprobar(error);
}

export async function borrarTema(id: string): Promise<void> {
  const { error } = await supabase.from('focus_topics').delete().eq('id', id);
  comprobar(error);
}

export interface NuevoExamen {
  asignaturaId: string;
  titulo: string;
  fecha: string | null;
  peso: number | null;
  temas: TemaNuevo[];
  hora?: number | null;
  tipo?: TipoExamen;
  estimada?: boolean;
}

export async function crearExamen(x: NuevoExamen, desdePosicion: number): Promise<void> {
  const base: Fila = { subject_id: x.asignaturaId, title: x.titulo.trim(), exam_date: x.fecha, weight: x.peso };
  const fila: Fila = { ...base, exam_time: x.hora ?? null, kind: x.tipo ?? 'examen', date_estimated: x.estimada ?? false };
  let r = await supabase.from('focus_exams').insert(fila).select('id').single();
  if (esColumnaAusente(r.error as ErrorPg)) {
    // Sin la 0112 ni una entrega ni un examen sin fecha caben en lo de antes.
    if (x.tipo === 'entrega' || x.fecha === null) throw new FocusNoDisponible();
    r = await supabase.from('focus_exams').insert(base).select('id').single();
  }
  comprobar(r.error as ErrorPg);
  const id = (r.data as { id?: string } | null)?.id ?? null;
  if (id && x.temas.length > 0) await crearTemas(x.asignaturaId, x.temas, id, desdePosicion);
}

export interface CambioExamen {
  asignaturaId?: string;
  titulo?: string;
  fecha?: string | null;
  peso?: number | null;
  hora?: number | null;
  tipo?: TipoExamen;
  estimada?: boolean;
}

export async function editarExamen(id: string, c: CambioExamen): Promise<void> {
  const fila: Fila = {};
  if (c.asignaturaId !== undefined) fila.subject_id = c.asignaturaId;
  if (c.titulo !== undefined) fila.title = c.titulo.trim();
  if (c.fecha !== undefined) fila.exam_date = c.fecha;
  if (c.peso !== undefined) fila.weight = c.peso;
  if (c.hora !== undefined) fila.exam_time = c.hora;
  if (c.tipo !== undefined) fila.kind = c.tipo;
  if (c.estimada !== undefined) fila.date_estimated = c.estimada;
  if (Object.keys(fila).length === 0) return;
  await escribir(fila, (f) => supabase.from('focus_exams').update(f).eq('id', id));
}

/** Cierra (o reabre, con null) una entrega o unos deberes. */
export async function marcarEntrega(id: string, hechaEl: string | null): Promise<void> {
  await escribir({ done_on: hechaEl }, (f) => supabase.from('focus_exams').update(f).eq('id', id));
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
  salidas?: number;
}

/** Registra un bloque terminado. Idempotente por `clientId` (reintentos, dos pantallas). */
export async function registrarSesion(s: NuevaSesion): Promise<void> {
  await escribir(
    {
      client_id: s.clientId,
      subject_id: s.asignaturaId,
      topic_id: s.temaId,
      quest_id: s.misionId,
      session_date: s.fecha,
      minutes: Math.max(1, Math.min(240, Math.round(s.minutos))),
      method: s.metodo,
      exits: Math.max(0, Math.min(1000, Math.round(s.salidas ?? 0))),
    },
    (f) => supabase.from('focus_sessions').upsert(f, { onConflict: 'user_id,client_id', ignoreDuplicates: true }),
  );
}

/** Minutos del día que miden misiones (sin los dictados al coach). null si no se pueden leer. */
export async function leerMinutosDelDia(fecha: string): Promise<{ asignaturaId: string | null; minutos: number }[] | null> {
  const { data, error } = await supabase.from('focus_sessions').select('subject_id,minutes,client_id').eq('session_date', fecha);
  if (error || !Array.isArray(data)) return null;
  return (data as unknown as Fila[])
    .filter((r) => !esSesionDictada(r.client_id))
    .map((r) => ({ asignaturaId: typeof r.subject_id === 'string' ? r.subject_id : null, minutos: num(r.minutes) }));
}

export async function crearClase(c: Omit<Clase, 'id'>): Promise<void> {
  const { error } = await supabase
    .from('focus_classes')
    .insert({ subject_id: c.asignaturaId, weekday: c.dia, start_min: c.inicio, end_min: c.fin, room: c.aula });
  comprobar(error);
}

/** Por lotes: copiar un día del horario a otros. */
export async function crearClases(clases: readonly Omit<Clase, 'id'>[]): Promise<void> {
  if (clases.length === 0) return;
  const { error } = await supabase
    .from('focus_classes')
    .insert(clases.map((c) => ({ subject_id: c.asignaturaId, weekday: c.dia, start_min: c.inicio, end_min: c.fin, room: c.aula })));
  comprobar(error);
}

export async function editarClase(id: string, c: Omit<Clase, 'id'>): Promise<void> {
  const { error } = await supabase
    .from('focus_classes')
    .update({ subject_id: c.asignaturaId, weekday: c.dia, start_min: c.inicio, end_min: c.fin, room: c.aula })
    .eq('id', id);
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

/** Por lotes: pegar un mazo entero. */
export async function crearTarjetas(mazoId: string, tarjetas: readonly { anverso: string; reverso: string }[], hoy: string): Promise<void> {
  const filas = tarjetas
    .map((c) => ({ deck_id: mazoId, front: c.anverso.trim().slice(0, 500).trim(), back: c.reverso.trim().slice(0, 1000).trim(), stage: 0, due: hoy }))
    .filter((c) => c.front.length > 0 && c.back.length > 0);
  for (const lote of trozos(filas, LOTE)) {
    const { error } = await supabase.from('focus_cards').insert(lote);
    comprobar(error);
  }
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

// ── Preferencias y misión del arranque ──────────────────────────────────

/** Guarda las preferencias en la fila del modo. Sin la 0112 o sin fila, no pasa nada grave. */
export async function guardarPrefs(prefs: PrefsFocus): Promise<void> {
  const { error } = await supabase.from('user_modes').upsert({ mode: 'focus', settings: prefs }, { onConflict: 'user_id,mode' });
  if (esColumnaAusente(error as ErrorPg)) return;
  comprobar(error as ErrorPg);
}

/**
 * Al acabar el arranque guiado: si no hay ninguna misión de FOCUS, crea una.
 * `titulo` llega ya traducido de quien llama, así que el `link` va explícito: el
 * trigger de la 0113 solo reconoce títulos en español. Sin la 0113 el CHECK no
 * admite 'estudio' y se crea sin él. Fácil y de lunes a viernes (nivl-game-balancer):
 * cabe en el presupuesto de recurrentes y no exige estudiar todos los días.
 */
export async function asegurarMisionFocus(userId: string, titulo: string): Promise<void> {
  const { data, error } = await supabase.from('quests').select('id').eq('active', true).contains('modes', ['focus']).limit(1);
  if (error) throw error;
  if ((data ?? []).length > 0) return;
  const fila = { user_id: userId, title: titulo.trim(), stat: 'INT', difficulty: 'facil', days_of_week: [1, 2, 3, 4, 5], modes: ['focus'] };
  let r = await supabase.from('quests').insert({ ...fila, link: 'estudio' });
  if (r.error?.code === '23514') r = await supabase.from('quests').insert(fila);
  if (r.error) throw r.error;
}
