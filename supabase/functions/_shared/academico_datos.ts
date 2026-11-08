// NIVL · FOCUS en el coach: lecturas y herramientas (efectos). Lo puro está en academico.ts.
//
// Siempre con el cliente del USUARIO: RLS manda y además cada consulta filtra por su user_id y lleva limit.
// Tablas de la 0076, columnas nuevas de la 0112. Mientras la 0076 no esté aplicada no hay sección (cadena
// vacía); sin la 0112 se lee y se escribe lo de antes, como en src/focus/datos.ts.
//
// Economía: nada de aquí paga XP. Apuntar una sesión no marca misiones ni llama a complete_quest.

import type { Db } from './db.ts';
import {
  cambioDeTema,
  coincidir,
  DIAS_ATRAS_SESION,
  DIAS_DE_SESIONES,
  diasEntre,
  enUnaLinea,
  esFecha,
  type DatosAcademicos,
  type EstadoTema,
  type Examen,
  leerFechaHora,
  leerMinutos,
  leerNota,
  leerPeso,
  minutoLocal,
  normalizar,
  partirTemas,
  type Resultado,
  seccionesAcademicas,
  sumarDias,
  type Tema,
  type TipoExamen,
} from './academico.ts';

type ErrorPg = { code?: string; message?: string } | null | undefined;
type Fila = Record<string, unknown>;

interface Ctx {
  sb: Db;
  userId: string;
  today: string;
}

const NO_DISPONIBLE = 'FOCUS todavía no está disponible en esta cuenta: díselo y sigue con otra cosa.';
const NO_LEIDO = '## FOCUS hoy\nNo se han podido leer ahora sus datos de estudio: no los des por inexistentes.';

// ── Errores tolerados (espejo de src/focus/datos.ts) ────────────────────

export function esTablaAusente(e: ErrorPg): boolean {
  if (!e) return false;
  if (e.code === '42P01' || e.code === 'PGRST205' || e.code === 'PGRST204') return true;
  return /does not exist|could not find the table|schema cache/i.test(e.message ?? '');
}

export function esColumnaAusente(e: ErrorPg): boolean {
  if (!e) return false;
  if (e.code === '42703' || e.code === 'PGRST204') return true;
  return /column .* does not exist|could not find the .* column/i.test(e.message ?? '');
}

// ── Lectura ─────────────────────────────────────────────────────────────

const num = (v: unknown, d = 0) => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const numONull = (v: unknown) => (v === null || v === undefined || v === '' ? null : num(v, NaN));
const textoDe = (v: unknown) => (typeof v === 'string' ? v : '');
const fecha = (v: unknown) => (typeof v === 'string' && esFecha(v.slice(0, 10)) ? v.slice(0, 10) : null);
const idONull = (v: unknown) => (typeof v === 'string' ? v : null);
const esEstado = (v: unknown): v is EstadoTema => v === 'pendiente' || v === 'repasando' || v === 'dominado';
const esTipo = (v: unknown): v is TipoExamen => v === 'examen' || v === 'entrega' || v === 'prueba';

const aTema = (r: Fila): Tema => ({
  id: textoDe(r.id),
  asignaturaId: textoDe(r.subject_id),
  examenId: idONull(r.exam_id),
  nombre: textoDe(r.name),
  estado: esEstado(r.status) ? r.status : 'pendiente',
  posicion: num(r.position),
  etapa: num(r.review_stage),
  repasoEl: fecha(r.review_due),
});

const aExamen = (r: Fila): Examen => ({
  id: textoDe(r.id),
  asignaturaId: textoDe(r.subject_id),
  titulo: textoDe(r.title),
  fecha: fecha(r.exam_date),
  peso: numONull(r.weight),
  hora: numONull(r.exam_time),
  tipo: esTipo(r.kind) ? r.kind : 'examen',
  estimada: r.date_estimated === true,
  hechaEl: fecha(r.done_on),
});

/** Base de la 0076 y lo que añade la 0112. Sin la 0112 se lee lo de antes. */
const COLUMNAS = {
  asignaturas: ['id,name', ',target_grade'],
  examenes: ['id,subject_id,title,exam_date,weight', ',exam_time,date_estimated,kind,done_on'],
} as const;

function prefsDe(v: unknown): DatosAcademicos['prefs'] {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? (v as Fila) : {};
  const min = typeof o.minutosDia === 'number' && Number.isFinite(o.minutosDia) ? Math.round(o.minutosDia) : 120;
  return {
    minutosDia: Math.max(15, Math.min(900, min)),
    sinClasesHasta: esFecha(o.sinClasesHasta) ? o.sinClasesHasta : null,
  };
}

// deno-lint-ignore no-explicit-any
const filasDe = (x: any): Fila[] => (Array.isArray(x?.data) ? (x.data as Fila[]) : []);

/** null si FOCUS aún no existe en la base. Cualquier otro fallo, se lanza. */
export async function leerDatosAcademicos(sb: Db, userId: string, hoy: string): Promise<DatosAcademicos | null> {
  const desde = sumarDias(hoy, -DIAS_DE_SESIONES);
  const leer = (con0112: boolean) => {
    const cols = (k: keyof typeof COLUMNAS) => COLUMNAS[k][0] + (con0112 ? COLUMNAS[k][1] : '');
    return Promise.all([
      sb.from('focus_subjects').select(cols('asignaturas')).eq('user_id', userId).eq('archived', false).order('position').order('created_at').limit(60),
      sb.from('focus_exams').select(cols('examenes')).eq('user_id', userId).order('exam_date').limit(300),
      sb.from('focus_topics').select('id,subject_id,exam_id,name,status,position,review_stage,review_due').eq('user_id', userId).order('position').order('created_at').limit(1000),
      sb.from('focus_sessions').select('subject_id,session_date,minutes,method').eq('user_id', userId).gte('session_date', desde).order('session_date', { ascending: false }).limit(600),
      sb.from('focus_classes').select('subject_id,weekday,end_min,start_min').eq('user_id', userId).limit(200),
      sb.from('focus_grades').select('subject_id,title,score,max_score,weight').eq('user_id', userId).limit(500),
      sb.from('focus_decks').select('id,subject_id').eq('user_id', userId).limit(200),
      sb.from('focus_cards').select('deck_id,due').eq('user_id', userId).lte('due', hoy).limit(1000),
    ]);
  };
  let r = await leer(true);
  if (r.some((x) => esColumnaAusente(x.error as ErrorPg))) r = await leer(false);
  if (r.some((x) => esTablaAusente(x.error as ErrorPg))) return null;
  const otro = r.find((x) => x.error);
  if (otro) throw otro.error;
  const [s, e, t, se, c, n, m, ta] = r;

  // Sin la 0112 o sin fila de modo: las preferencias de por defecto.
  const modo = await sb.from('user_modes').select('settings').eq('user_id', userId).eq('mode', 'focus').maybeSingle();

  return {
    asignaturas: filasDe(s).map((a) => ({ id: textoDe(a.id), nombre: textoDe(a.name), notaObjetivo: numONull(a.target_grade) })),
    examenes: filasDe(e).map(aExamen),
    temas: filasDe(t).map(aTema),
    sesiones: filasDe(se).map((x) => ({
      asignaturaId: idONull(x.subject_id),
      fecha: fecha(x.session_date) ?? '1970-01-01',
      minutos: num(x.minutes),
      metodo: idONull(x.method),
    })),
    clases: filasDe(c).map((x) => ({ asignaturaId: textoDe(x.subject_id), dia: num(x.weekday, 1), inicio: num(x.start_min), fin: num(x.end_min) })),
    notas: filasDe(n).map((x) => ({ asignaturaId: textoDe(x.subject_id), titulo: textoDe(x.title), nota: num(x.score), sobre: num(x.max_score, 10), peso: numONull(x.weight) })),
    mazos: filasDe(m).map((x) => ({ id: textoDe(x.id), asignaturaId: idONull(x.subject_id) })),
    tarjetas: filasDe(ta).map((x) => ({ mazoId: textoDe(x.deck_id), vence: fecha(x.due) ?? '1970-01-01' })),
    prefs: prefsDe(modo.error ? null : (modo.data as Fila | null)?.settings),
  };
}

/**
 * Las secciones de FOCUS del estado, solo para el modo FOCUS (ver buildContext). Tabla ausente: cadena vacía.
 * Un fallo de lectura no tira el turno: se dice que no se ha podido leer, nunca que no hay nada.
 */
export async function construirAcademico(sb: Db, userId: string, hoy: string, opciones: { zona?: string | null; ahora?: Date } = {}): Promise<string> {
  try {
    const d = await leerDatosAcademicos(sb, userId, hoy);
    if (!d) return '';
    return seccionesAcademicas(d, hoy, minutoLocal(opciones.ahora ?? new Date(), opciones.zona));
  } catch {
    return NO_LEIDO;
  }
}

// ── Herramientas ────────────────────────────────────────────────────────

const val = (v: unknown): string | undefined => {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v);
  return s === '' ? undefined : s;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un error de «no existe la tabla» pasa a un mensaje que el modelo entiende; los demás siguen su camino. */
function comprobar(error: ErrorPg): void {
  if (!error) return;
  if (esTablaAusente(error) && !esColumnaAusente(error)) throw new Error(NO_DISPONIBLE);
  throw error;
}

export async function marcarTema(ctx: Ctx, input: Record<string, unknown>): Promise<string> {
  const { sb, userId, today } = ctx;
  const id = String(input.tema_id ?? '').trim();
  if (!UUID.test(id)) throw new Error('tema_id inválido: usa el id entre corchetes del estado o el de consultar_historial (estudio).');
  const estado = val(input.estado);
  const repaso = val(input.repaso);
  if (estado !== undefined && !esEstado(estado)) throw new Error(`estado inválido: ${estado}`);
  if (repaso !== undefined && repaso !== 'bien' && repaso !== 'dudosa' && repaso !== 'mal') throw new Error(`repaso inválido: ${repaso}`);
  if (estado === undefined && repaso === undefined) return 'Nada que cambiar.';

  const { data, error } = await sb
    .from('focus_topics')
    .select('id,name,status,review_stage,review_due')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  comprobar(error as ErrorPg);
  if (!data) throw new Error(`No existe el tema ${id}.`);
  const t = aTema(data as Fila);
  const c = cambioDeTema(t, { estado: estado as EstadoTema | undefined, repaso: repaso as Resultado | undefined }, today);

  const patch: Fila = { status: c.estado, review_stage: c.etapa, review_due: c.repasoEl };
  if (c.repasado) patch.last_reviewed_on = today;
  let r = await sb.from('focus_topics').update(patch).eq('id', id).eq('user_id', userId);
  if (esColumnaAusente(r.error as ErrorPg)) {
    delete patch.last_reviewed_on;
    r = await sb.from('focus_topics').update(patch).eq('id', id).eq('user_id', userId);
  }
  comprobar(r.error as ErrorPg);
  return `Tema «${enUnaLinea(t.nombre, 80)}»: ${c.estado}${c.repasoEl ? ` · próximo repaso ${c.repasoEl}` : ''}. El plan se recalcula solo. No paga XP.`;
}

interface AsignaturaFila {
  id: string;
  name: string;
  position: number;
}

/** Busca la asignatura por nombre o la crea. Si lo dicho encaja con varias, pregunta. */
async function resolverAsignatura(ctx: Ctx, crudo: string): Promise<{ id: string; nombre: string; creada: boolean }> {
  const { sb, userId } = ctx;
  const nombre = enUnaLinea(crudo, 80);
  if (!nombre) throw new Error('Falta la asignatura.');
  const { data, error } = await sb.from('focus_subjects').select('id,name,position').eq('user_id', userId).eq('archived', false).order('position').limit(60);
  comprobar(error as ErrorPg);
  const lista = (data ?? []) as unknown as AsignaturaFila[];
  const c = coincidir(lista, nombre, (a) => a.name);
  if (c.tipo === 'una') return { id: c.elegido.id, nombre: c.elegido.name, creada: false };
  if (c.tipo === 'varias') throw new Error(`«${nombre}» encaja con varias asignaturas: ${c.candidatos.map((a) => enUnaLinea(a.name, 80)).join(', ')}. Pregúntale cuál y usa el nombre exacto.`);
  const position = lista.reduce((m, a) => Math.max(m, num(a.position)), -1) + 1;
  const r = await sb.from('focus_subjects').insert({ user_id: userId, name: nombre, position }).select('id').single();
  comprobar(r.error as ErrorPg);
  return { id: String((r.data as Fila).id), nombre, creada: true };
}

/** Añade los temas que no estén ya, detrás de los que hay. Devuelve cuántos ha creado. */
async function anadirTemas(ctx: Ctx, asignaturaId: string, examenId: string | null, nombres: readonly string[]): Promise<number> {
  if (nombres.length === 0) return 0;
  const { sb, userId } = ctx;
  const { data, error } = await sb
    .from('focus_topics')
    .select('name,position,exam_id')
    .eq('user_id', userId)
    .eq('subject_id', asignaturaId)
    .order('position', { ascending: false })
    .limit(1000);
  comprobar(error as ErrorPg);
  const filas = (data ?? []) as Fila[];
  // Un tema general ya cuenta para cualquier examen de la asignatura.
  const yaEstan = new Set(
    filas.filter((f) => examenId === null || f.exam_id === examenId || f.exam_id === null).map((f) => normalizar(textoDe(f.name))),
  );
  const nuevos = nombres.filter((n) => !yaEstan.has(normalizar(n)));
  if (nuevos.length === 0) return 0;
  const desde = filas.reduce((m, f) => Math.max(m, num(f.position)), -1) + 1;
  const r = await sb.from('focus_topics').insert(
    nuevos.map((name, i) => ({ user_id: userId, subject_id: asignaturaId, exam_id: examenId, name, position: desde + i })),
  );
  comprobar(r.error as ErrorPg);
  return nuevos.length;
}

type ExistenteExamen = { id: string; title: string; exam_date: string | null; weight: number | null; exam_time?: number | null; kind?: string; date_estimated?: boolean };

async function leerExamenesDe(ctx: Ctx, asignaturaId: string): Promise<ExistenteExamen[]> {
  const { sb, userId } = ctx;
  const consulta = (cols: string) => sb.from('focus_exams').select(cols).eq('user_id', userId).eq('subject_id', asignaturaId).limit(300);
  let r = await consulta('id,title,exam_date,weight,exam_time,kind,date_estimated');
  if (esColumnaAusente(r.error as ErrorPg)) r = await consulta('id,title,exam_date,weight');
  comprobar(r.error as ErrorPg);
  return (r.data ?? []) as unknown as ExistenteExamen[];
}

async function apuntarExamen(ctx: Ctx, input: Record<string, unknown>, tipo: 'examen' | 'entrega'): Promise<string> {
  const { sb, userId, today } = ctx;
  const titulo = enUnaLinea(input.titulo, 120);
  if (!titulo) throw new Error(`Falta el título de ${tipo === 'examen' ? 'el examen' : 'la entrega'}.`);
  const f = val(input.fecha) ? leerFechaHora(val(input.fecha) as string) : null;
  if (f && f.fecha < today) throw new Error(`Esa fecha ya ha pasado (${f.fecha}). Hoy es ${today}.`);
  const peso = val(input.peso) ? leerPeso(val(input.peso) as string) : null;
  const temas = tipo === 'examen' && val(input.temas) ? partirTemas(val(input.temas) as string) : [];

  const asig = await resolverAsignatura(ctx, String(input.asignatura ?? ''));
  const existentes = await leerExamenesDe(ctx, asig.id);
  // Un examen ya pasado con el mismo nombre (el parcial del año pasado) es otro examen: no se pisa.
  const vigente = (x: ExistenteExamen) => x.exam_date === null || x.exam_date >= today;
  const mismo = existentes.find((x) => normalizar(x.title) === normalizar(titulo) && (x.kind ?? 'examen') === tipo && vigente(x));
  const nombreTipo = tipo === 'examen' ? 'Examen' : 'Entrega';

  if (mismo) {
    const patch: Fila = {};
    if (f && mismo.exam_date !== f.fecha) patch.exam_date = f.fecha;
    if (f && mismo.date_estimated === true) patch.date_estimated = false;
    if (f && f.hora !== null && mismo.exam_time !== f.hora && 'exam_time' in mismo) patch.exam_time = f.hora;
    if (peso !== null && num(mismo.weight, -1) !== peso) patch.weight = peso;
    if (Object.keys(patch).length) {
      const r = await sb.from('focus_exams').update(patch).eq('id', mismo.id).eq('user_id', userId);
      comprobar(r.error as ErrorPg);
    }
    const creados = await anadirTemas(ctx, asig.id, mismo.id, temas);
    if (!Object.keys(patch).length && creados === 0) return `${nombreTipo} ya apuntado antes (id ${mismo.id}): «${titulo}» de ${enUnaLinea(asig.nombre, 80)}.`;
    return `${nombreTipo} actualizado (id ${mismo.id}): «${titulo}» de ${enUnaLinea(asig.nombre, 80)}${creados ? ` · ${creados} temas nuevos` : ''}. El plan se recalcula solo.`;
  }

  const base: Fila = { user_id: userId, subject_id: asig.id, title: titulo, exam_date: f?.fecha ?? null, weight: peso };
  let r = await sb.from('focus_exams').insert({ ...base, exam_time: f?.hora ?? null, kind: tipo, date_estimated: false }).select('id').single();
  if (esColumnaAusente(r.error as ErrorPg)) {
    if (tipo === 'entrega') throw new Error('Las entregas aún no están disponibles en esta cuenta. Apúntaselo como tarea en otro sitio.');
    r = await sb.from('focus_exams').insert(base).select('id').single();
  }
  if ((r.error as ErrorPg)?.code === '23502') throw new Error('Aún no se puede apuntar un examen sin fecha en esta cuenta: pídele la fecha, aunque sea aproximada.');
  comprobar(r.error as ErrorPg);
  const id = String((r.data as Fila).id);
  const creados = await anadirTemas(ctx, asig.id, id, temas);
  const cuando = f ? `el ${f.fecha}` : 'sin fecha';
  return `${nombreTipo} apuntado (id ${id}): «${titulo}» de ${enUnaLinea(asig.nombre, 80)} ${cuando}${asig.creada ? ' · asignatura nueva' : ''}${creados ? ` · ${creados} temas` : ''}. El plan se recalcula solo.`;
}

async function apuntarTemas(ctx: Ctx, input: Record<string, unknown>): Promise<string> {
  const crudo = val(input.temas);
  if (!crudo) throw new Error('Faltan los temas (uno por línea).');
  const temas = partirTemas(crudo);
  if (temas.length === 0) throw new Error('Faltan los temas (uno por línea).');
  const asig = await resolverAsignatura(ctx, String(input.asignatura ?? ''));
  let examenId: string | null = null;
  const tituloExamen = val(input.titulo);
  if (tituloExamen) {
    const examenes = (await leerExamenesDe(ctx, asig.id)).filter((x) => (x.kind ?? 'examen') !== 'entrega');
    const c = coincidir(examenes, tituloExamen, (x) => x.title);
    if (c.tipo !== 'una') {
      throw new Error(`No sé a qué examen van: «${enUnaLinea(tituloExamen, 80)}». Exámenes de la asignatura: ${examenes.map((x) => enUnaLinea(x.title, 60)).join(', ') || 'ninguno'}.`);
    }
    examenId = c.elegido.id;
  }
  const creados = await anadirTemas(ctx, asig.id, examenId, temas);
  return `${creados} temas nuevos en ${enUnaLinea(asig.nombre, 80)}${creados < temas.length ? ` (${temas.length - creados} ya estaban)` : ''}. El plan se recalcula solo.`;
}

async function apuntarNota(ctx: Ctx, input: Record<string, unknown>): Promise<string> {
  const { sb, userId, today } = ctx;
  const titulo = enUnaLinea(input.titulo, 120);
  if (!titulo) throw new Error('Falta el título de la nota (qué examen o trabajo es).');
  const crudo = val(input.nota);
  if (!crudo) throw new Error('Falta la nota.');
  const { nota, sobre } = leerNota(crudo);
  const peso = val(input.peso) ? leerPeso(val(input.peso) as string) : null;
  const dia = val(input.fecha) ? leerFechaHora(val(input.fecha) as string).fecha : today;
  if (dia > today) throw new Error('Una nota no puede tener fecha futura.');
  const asig = await resolverAsignatura(ctx, String(input.asignatura ?? ''));
  const { data, error } = await sb.from('focus_grades').select('id,title').eq('user_id', userId).eq('subject_id', asig.id).eq('graded_on', dia).limit(100);
  comprobar(error as ErrorPg);
  if (((data ?? []) as Fila[]).some((x) => normalizar(textoDe(x.title)) === normalizar(titulo))) {
    return `Esa nota ya estaba apuntada: «${titulo}» de ${enUnaLinea(asig.nombre, 80)} el ${dia}.`;
  }
  const r = await sb.from('focus_grades').insert({ user_id: userId, subject_id: asig.id, title: titulo, score: nota, max_score: sobre, weight: peso, graded_on: dia });
  comprobar(r.error as ErrorPg);
  return `Nota apuntada: ${nota}/${sobre} en «${titulo}» de ${enUnaLinea(asig.nombre, 80)}${asig.creada ? ' (asignatura nueva)' : ''}. La media se recalcula sola.`;
}

async function apuntarSesion(ctx: Ctx, input: Record<string, unknown>): Promise<string> {
  const { sb, userId, today } = ctx;
  const crudo = val(input.minutos);
  if (!crudo) throw new Error('Faltan los minutos.');
  const minutos = leerMinutos(crudo);
  const dia = val(input.fecha) ? leerFechaHora(val(input.fecha) as string).fecha : today;
  if (dia > today) throw new Error('No se apunta estudio con fecha futura.');
  if (diasEntre(dia, today) > DIAS_ATRAS_SESION) throw new Error(`Solo se apunta estudio de los últimos ${DIAS_ATRAS_SESION} días.`);
  const nombre = val(input.asignatura);
  const asig = nombre ? await resolverAsignatura(ctx, nombre) : null;
  // Idempotente por client_id: la misma orden repetida en el mismo rato no cuenta dos veces.
  const rato = Math.floor(Date.now() / 120_000);
  const client_id = `coach-${dia}-${asig ? asig.id.slice(0, 8) : 'libre'}-${minutos}-${rato}`;
  const r = await sb.from('focus_sessions').upsert(
    { user_id: userId, client_id, subject_id: asig?.id ?? null, topic_id: null, quest_id: null, session_date: dia, minutes: minutos, method: null },
    { onConflict: 'user_id,client_id', ignoreDuplicates: true },
  );
  comprobar(r.error as ErrorPg);
  return `Sesión apuntada: ${minutos} min${asig ? ` de ${enUnaLinea(asig.nombre, 80)}` : ''} el ${dia}. Cuenta para sus horas; no paga XP ni marca misiones.`;
}

export function apuntarEstudio(ctx: Ctx, input: Record<string, unknown>): Promise<string> {
  switch (input.que) {
    case 'examen': return apuntarExamen(ctx, input, 'examen');
    case 'entrega': return apuntarExamen(ctx, input, 'entrega');
    case 'temas': return apuntarTemas(ctx, input);
    case 'nota': return apuntarNota(ctx, input);
    case 'sesion': return apuntarSesion(ctx, input);
    default: return Promise.reject(new Error(`que inválido: ${String(input.que)}`));
  }
}

/** consultar_historial 'estudio': el temario con sus ids (para marcar_tema) y las sesiones del rango. */
export async function consultarEstudio(sb: Db, userId: string, desde: unknown, hasta: unknown, filtro: unknown): Promise<string> {
  if (!esFecha(desde) || !esFecha(hasta)) throw new Error('desde y hasta tienen que ser YYYY-MM-DD.');
  const [s, t, se] = await Promise.all([
    sb.from('focus_subjects').select('id,name').eq('user_id', userId).eq('archived', false).limit(60),
    sb.from('focus_topics').select('id,subject_id,name,status,position,review_due').eq('user_id', userId).order('position').limit(1000),
    sb.from('focus_sessions').select('session_date,minutes,method,subject_id,topic_id').eq('user_id', userId).gte('session_date', desde).lte('session_date', hasta).order('session_date', { ascending: false }).limit(200),
  ]);
  for (const r of [s, t, se]) comprobar(r.error as ErrorPg);
  const nombre = new Map(filasDe(s).map((a) => [String(a.id), enUnaLinea(a.name, 80)]));
  const nombreTema = new Map(filasDe(t).map((x) => [String(x.id), enUnaLinea(x.name, 160)]));
  const needle = val(filtro) ? normalizar(val(filtro) as string) : null;
  const pasa = (x: unknown) => needle === null || normalizar(JSON.stringify(x)).includes(needle);
  const temas = filasDe(t)
    .filter((x) => nombre.has(String(x.subject_id)))
    .map((x) => ({ id: x.id, asignatura: nombre.get(String(x.subject_id)), tema: nombreTema.get(String(x.id)), estado: x.status, repaso: x.review_due }))
    .filter(pasa);
  const sesiones = filasDe(se)
    .map((x) => ({
      fecha: x.session_date,
      minutos: x.minutes,
      metodo: x.method,
      asignatura: x.subject_id ? (nombre.get(String(x.subject_id)) ?? null) : null,
      tema: x.topic_id ? (nombreTema.get(String(x.topic_id)) ?? null) : null,
    }))
    .filter(pasa);
  if (!temas.length && !sesiones.length) return `Sin datos de estudio entre ${desde} y ${hasta}.`;
  const minutos_total = sesiones.reduce((m, x) => m + num(x.minutos), 0);
  return JSON.stringify({ minutos_total, sesiones_contadas: sesiones.length, sesiones: sesiones.slice(0, 60), temas }).slice(0, 12000);
}
