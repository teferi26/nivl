// NIVL · Resistencia: la capa de datos (efectos). Lo puro, en `resistenciaPura.ts`.
//
// Las tablas son de la 0105-0107 y van tras el permiso de salud, como
// `cardio_sessions`. Sin filtro por user_id en las lecturas: lo pone la RLS.

import {
  cardioDayState,
  fetchCardio,
  saveCardio,
  type CardioKind,
  type CardioSession,
  type CardioZone,
} from './bodywork';
import { ensureProfile, fetchCompletionsForDate, fetchQuests } from './data';
import { dateKey } from './dates';
import { awardXp } from './engine';
import { espejoCardio, mismoActo, restarDelEspejo, type EspejoFila } from './entrenoEspejo';
import { normalizarEntreno, tipoCardioDe, type DeporteEntreno, type EntrenoMedido } from './entrenoMedido';
import {
  limitesZonas,
  nuevosRecords,
  recordsPersonales,
  zonaDe,
  type EntrenoRecord,
  type Record_,
} from './entrenomath';
import { CARDIO_DAILY_CAP, cardioXp } from './game';
import { propagarActo } from './links';
import type { HoraClima } from './mejorHora';
import { anuncioCardio, pagoDelModulo, primeraSesionQuePropaga, xpPagado } from './pagoActo';
import type { Disciplina, Fase, PlanCarrera, TipoPrueba } from './planCarrera';
import {
  camposReimportacion,
  deportesDelMismoRecord,
  elegirSesionPlan,
  decidirPago,
  filasDelPlan,
  notaValida,
  redondearCoordenada,
  rpeValido,
} from './resistenciaPura';
import { t } from '@/i18n';
import { supabase } from './supabase';
import type { Profile } from './types';
import { mensajeSistema } from './validation';

export type EntrenoFila = EntrenoMedido & {
  id: string;
  user_id: string;
  fecha: string;
  rpe: number | null;
  notas: string | null;
  xp_awarded: number;
  created_at?: string;
};

export interface PerfilEntreno {
  fc_max: number | null;
  fc_reposo: number | null;
  fc_umbral: number | null;
  ftp_w: number | null;
  css_seg_100m: number | null;
  ubicacion_lat: number | null;
  ubicacion_lon: number | null;
  ubicacion_nombre: string | null;
  ubicacion_consentida_en: string | null;
}

export type NivelCarrera = 'principiante' | 'intermedio' | 'avanzado';

export interface ObjetivoCarrera {
  id: string;
  user_id: string;
  tipo: TipoPrueba;
  nombre: string | null;
  fecha: string;
  natacion_m: number | null;
  bici_m: number | null;
  carrera_m: number | null;
  horas_semana: number;
  nivel: NivelCarrera;
  activo: boolean;
  created_at: string;
}

export type NuevoObjetivo = Pick<
  ObjetivoCarrera,
  'tipo' | 'nombre' | 'fecha' | 'natacion_m' | 'bici_m' | 'carrera_m' | 'horas_semana' | 'nivel'
>;

export interface PlanSesionFila {
  id: string;
  user_id: string;
  objetivo_id: string;
  semana: number;
  fecha: string;
  disciplina: Disciplina;
  titulo: string;
  detalle: string;
  duracion_min: number;
  zona: 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5' | null;
  clave: boolean;
  fase: Fase | null;
  hecha_entreno_id: string | null;
  editada_por_coach: boolean;
  nota_coach: string | null;
  created_at: string;
}

export interface Bienestar {
  fecha: string;
  sueno_h: number | null;
  calidad: number | null;
  fatiga: number | null;
  dolor: boolean;
  dolor_zona: string | null;
  vfc_ms: number | null;
  fc_reposo: number | null;
  origen: string | null;
}

/** Las horas que devuelve la función `prevision`, listas para `mejorVentana`. */
export type PrevisionDia = HoraClima[];

/**
 * `pagado` es lo que entró de verdad con este entreno: misión enlazada más
 * módulo. `motivo` es la razón técnica de `normalizarEntreno` si la entrada no
 * es un entreno, o el texto de `mensajeSistema` si falló el guardado.
 */
export type ResultadoGuardar =
  | { ok: true; nuevo: boolean; fila: EntrenoFila; anuncio: string | null; records: Record_[]; pagado: number; proponer?: boolean }
  | { ok: false; motivo: string };

// Las columnas de la lista: la ruta y el pulso pesan cientos de KB por fila.
const COLUMNAS_LISTA =
  'id,user_id,origen,externo_id,deporte,fecha,inicio,fin,duracion_s,distancia_m,kcal,fc_media,fc_max,desnivel_m,parciales,largo_piscina_m,rpe,notas,xp_awarded,created_at';

export async function fetchEntrenos(desde: string): Promise<EntrenoFila[]> {
  const { data, error } = await supabase
    .from('entrenos_medidos')
    .select(COLUMNAS_LISTA)
    .gte('fecha', desde)
    .order('inicio', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Omit<EntrenoFila, 'ruta' | 'fc_serie'>[]).map((f) => ({
    ...f,
    ruta: null,
    fc_serie: null,
  }));
}

/**
 * Los entrenos desde una fecha, con el contrato de la captura (sin ruta ni
 * serie de pulso): para detectar duplicados entre orígenes y contrastar.
 */
export async function listarEntrenosRecientes(userId: string, desde: string): Promise<EntrenoMedido[]> {
  const { data, error } = await supabase
    .from('entrenos_medidos')
    .select(COLUMNAS_LISTA)
    .eq('user_id', userId)
    .gte('fecha', desde)
    .order('inicio', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as EntrenoFila[]).map((f) => ({
    origen: f.origen,
    externo_id: f.externo_id,
    deporte: f.deporte,
    inicio: f.inicio,
    fin: f.fin,
    duracion_s: f.duracion_s,
    distancia_m: f.distancia_m,
    kcal: f.kcal,
    fc_media: f.fc_media,
    fc_max: f.fc_max,
    desnivel_m: f.desnivel_m,
    ruta: null,
    parciales: f.parciales ?? [],
    largo_piscina_m: f.largo_piscina_m,
    fc_serie: null,
  }));
}

export async function fetchEntreno(id: string): Promise<EntrenoFila | null> {
  const { data, error } = await supabase.from('entrenos_medidos').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as EntrenoFila | null) ?? null;
}

export async function borrarEntreno(id: string): Promise<void> {
  const { error } = await supabase.from('entrenos_medidos').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Borra un entreno apuntado a mano y le quita al espejo lo que aportó, solo si
 * fue él quien lo creó (apuntado el mismo día). El XP no se devuelve y la fila del
 * día conserva lo pagado: borrar y volver a apuntar no cobra otra vez.
 */
export async function borrarEntrenoManual(userId: string, e: EntrenoFila): Promise<void> {
  await borrarEntreno(e.id);
  const kind = tipoCardioDe(e.deporte);
  const creado = dateKey(e.created_at ? new Date(e.created_at) : new Date());
  if (!kind || e.fecha !== creado) return;
  try {
    const previa = await sesionPrevia(e.fecha, kind);
    // Si no coincide, la fila del día es de otra sesión y este entreno no aportó nada.
    if (!previa || Math.abs(previa.duration_min - e.duracion_s / 60) > 0.02) return;
    const resto = restarDelEspejo(previa, { distance_km: e.distancia_m === null ? null : e.distancia_m / 1000, duration_min: e.duracion_s / 60 });
    await saveCardio(userId, {
      date: previa.date,
      kind,
      ...resto,
      avg_hr: previa.avg_hr,
      rpe: previa.rpe,
      zone: previa.zone,
      notes: previa.notes,
      xp: previa.xp_awarded,
    });
  } catch {
    /* el entreno ya no está; el espejo se corrige a mano desde Cardio */
  }
}

export async function fetchPerfilEntreno(): Promise<PerfilEntreno | null> {
  const { data, error } = await supabase.from('entreno_perfil').select('*').maybeSingle();
  if (error) throw error;
  return (data as PerfilEntreno | null) ?? null;
}

export async function savePerfilEntreno(userId: string, cambios: Partial<PerfilEntreno>): Promise<void> {
  const fila: Partial<PerfilEntreno> = { ...cambios };
  if (typeof fila.ubicacion_lat === 'number') fila.ubicacion_lat = redondearCoordenada(fila.ubicacion_lat);
  if (typeof fila.ubicacion_lon === 'number') fila.ubicacion_lon = redondearCoordenada(fila.ubicacion_lon);
  const { error } = await supabase
    .from('entreno_perfil')
    .upsert({ ...fila, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function fetchObjetivoActivo(): Promise<ObjetivoCarrera | null> {
  const { data, error } = await supabase.from('objetivos_carrera').select('*').eq('activo', true).maybeSingle();
  if (error) throw error;
  return (data as ObjetivoCarrera | null) ?? null;
}

async function ponerActivo(id: string, activo: boolean): Promise<void> {
  const { error } = await supabase.from('objetivos_carrera').update({ activo }).eq('id', id);
  if (error) throw error;
}

/**
 * Desactiva el objetivo anterior y crea el nuevo con todo su plan. Son tres
 * escrituras: si falla una, se deshace lo hecho para no dejar a nadie sin
 * objetivo o con un objetivo sin sesiones.
 */
export async function crearObjetivo(userId: string, o: NuevoObjetivo, plan: PlanCarrera): Promise<ObjetivoCarrera> {
  const previo = await fetchObjetivoActivo();
  if (previo) await ponerActivo(previo.id, false);
  const restaurar = async () => {
    if (previo) await ponerActivo(previo.id, true).catch(() => undefined);
  };

  const { data, error } = await supabase
    .from('objetivos_carrera')
    .insert({ ...o, user_id: userId, activo: true })
    .select()
    .single();
  if (error) {
    await restaurar();
    throw error;
  }
  const nuevo = data as ObjetivoCarrera;

  const { error: errorSesiones } = await supabase.from('plan_sesiones').insert(filasDelPlan(plan, userId, nuevo.id));
  if (errorSesiones) {
    await supabase.from('objetivos_carrera').delete().eq('id', nuevo.id);
    await restaurar();
    throw errorSesiones;
  }
  return nuevo;
}

export async function borrarObjetivo(id: string): Promise<void> {
  const { error } = await supabase.from('objetivos_carrera').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchPlanSesiones(objetivoId: string, desde?: string, hasta?: string): Promise<PlanSesionFila[]> {
  let q = supabase.from('plan_sesiones').select('*').eq('objetivo_id', objetivoId);
  if (desde) q = q.gte('fecha', desde);
  if (hasta) q = q.lte('fecha', hasta);
  const { data, error } = await q.order('fecha', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PlanSesionFila[];
}

export async function fetchBienestar(desde: string): Promise<Bienestar[]> {
  const { data, error } = await supabase
    .from('entreno_bienestar')
    .select('fecha,sueno_h,calidad,fatiga,dolor,dolor_zona,vfc_ms,fc_reposo,origen')
    .gte('fecha', desde)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Bienestar[];
}

export async function saveBienestar(userId: string, b: Bienestar): Promise<void> {
  const { error } = await supabase
    .from('entreno_bienestar')
    .upsert({ ...b, user_id: userId }, { onConflict: 'user_id,fecha' });
  if (error) throw error;
}

/** La previsión es un extra: sin ella la pantalla sigue, así que nunca lanza. */
export async function fetchPrevision(): Promise<PrevisionDia | null> {
  try {
    const { data, error } = await supabase.functions.invoke('prevision', { body: {}, timeout: 15000 });
    if (error || !Array.isArray(data)) return null;
    return data as PrevisionDia;
  } catch {
    return null;
  }
}

// ── Guardar y pagar ─────────────────────────────────────────────────

// Los récords miran TODO el historial: los últimos con su ruta (mejor tramo) y
// los anteriores sin ella, que pesa cientos de KB por fila. Un 5K suelto de hace
// años sigue contando; un mejor tramo dentro de una ruta muy antigua, no.
const CON_RUTA = 120;
const PAGINA_LIGERA = 1000;
const MAX_PAGINAS_LIGERAS = 20;

type Eco = { xp: number; xpMisiones: number; marcadas: string[] };

function filaNueva(userId: string, e: EntrenoMedido, fecha: string, extra?: { rpe?: number | null; notas?: string | null }) {
  return {
    user_id: userId,
    origen: e.origen,
    externo_id: e.externo_id,
    deporte: e.deporte,
    fecha,
    inicio: e.inicio,
    fin: e.fin,
    duracion_s: e.duracion_s,
    distancia_m: e.distancia_m,
    kcal: e.kcal,
    fc_media: e.fc_media,
    fc_max: e.fc_max,
    desnivel_m: e.desnivel_m,
    ruta: e.ruta,
    parciales: e.parciales,
    fc_serie: e.fc_serie ?? null,
    largo_piscina_m: e.largo_piscina_m,
    rpe: rpeValido(extra?.rpe),
    notas: notaValida(extra?.notas),
  };
}

/**
 * ON CONFLICT DO NOTHING devuelve la fila solo a quien la ha creado: dos
 * sincronizaciones a la vez no pueden creerse las dos que el entreno es nuevo.
 */
async function insertarSiNuevo(fila: ReturnType<typeof filaNueva>): Promise<EntrenoFila | null> {
  const { data, error } = await supabase
    .from('entrenos_medidos')
    .upsert(fila, { onConflict: 'user_id,externo_id', ignoreDuplicates: true })
    .select();
  if (error) throw error;
  return ((data ?? [])[0] as EntrenoFila | undefined) ?? null;
}

async function actualizarExistente(userId: string, externoId: string, cambios: Record<string, unknown>): Promise<EntrenoFila> {
  const { data, error } = await supabase
    .from('entrenos_medidos')
    .update(cambios)
    .eq('user_id', userId)
    .eq('externo_id', externoId)
    .select()
    .single();
  if (error) throw error;
  return data as EntrenoFila;
}

/** Con pulso y perfil, su zona. Sin ellos, `libre`: no se mezcla con Z2 al estudiar. */
async function zonaDelEntreno(e: EntrenoMedido): Promise<CardioZone> {
  if (e.fc_media === null) return 'libre';
  try {
    const p = await fetchPerfilEntreno();
    if (!p) return 'libre';
    return zonaDe(e.fc_media, limitesZonas({ fc_max: p.fc_max, fc_reposo: p.fc_reposo, umbral: p.fc_umbral })) ?? 'libre';
  } catch {
    return 'libre';
  }
}

async function sesionPrevia(fecha: string, kind: CardioKind): Promise<CardioSession | null> {
  return (await fetchCardio(fecha)).find((s) => s.date === fecha && s.kind === kind) ?? null;
}

/** Marca la sesión del plan que este entreno salda. Si falla, el entreno sigue guardado. */
async function enlazarPlan(fila: EntrenoFila): Promise<void> {
  try {
    const objetivo = await fetchObjetivoActivo();
    if (!objetivo) return;
    const sesion = elegirSesionPlan(await fetchPlanSesiones(objetivo.id, fila.fecha, fila.fecha), fila.deporte);
    if (!sesion) return;
    await supabase.from('plan_sesiones').update({ hecha_entreno_id: fila.id }).eq('id', sesion.id);
  } catch {
    /* la adherencia se recupera en la siguiente carga manual; el acto ya cuenta */
  }
}

/** El historial con el que se calculan los récords, de un deporte o de todos. */
export async function fetchHistorialRecords(deporte?: DeporteEntreno): Promise<EntrenoRecord[]> {
  const leer = async (columnas: string, desde: number, hasta: number) => {
    let q = supabase.from('entrenos_medidos').select(columnas);
    if (deporte) q = q.in('deporte', deportesDelMismoRecord(deporte));
    const { data, error } = await q.order('fecha', { ascending: false }).order('id').range(desde, hasta);
    if (error) throw error;
    return (data ?? []) as unknown as EntrenoRecord[];
  };
  const lista = await leer('id,deporte,fecha,distancia_m,duracion_s,desnivel_m,ruta,parciales', 0, CON_RUTA - 1);
  if (lista.length < CON_RUTA) return lista;
  for (let p = 0; p < MAX_PAGINAS_LIGERAS; p++) {
    const desde = CON_RUTA + p * PAGINA_LIGERA;
    const pagina = await leer('id,deporte,fecha,distancia_m,duracion_s,desnivel_m,parciales', desde, desde + PAGINA_LIGERA - 1);
    lista.push(...pagina);
    if (pagina.length < PAGINA_LIGERA) break;
  }
  return lista;
}

/** Récords que estrena este entreno. Cosméticos: nunca pagan y su fallo no importa. */
async function recordsDelEntreno(fila: EntrenoFila): Promise<Record_[]> {
  try {
    const despues = await fetchHistorialRecords(fila.deporte);
    const antes = despues.filter((e) => e.id !== fila.id);
    return nuevosRecords(recordsPersonales(antes), recordsPersonales(despues), fila.id);
  } catch {
    return [];
  }
}

/** Otro entreno del mismo deporte que cuenta el mismo acto, si lo hay. */
async function gemeloDe(e: EntrenoMedido): Promise<EntrenoFila | null> {
  const { data, error } = await supabase
    .from('entrenos_medidos')
    .select(COLUMNAS_LISTA)
    .eq('deporte', e.deporte)
    .lte('inicio', e.fin)
    .gte('fin', e.inicio);
  if (error) return null;
  const filas = (data ?? []) as unknown as EntrenoFila[];
  return filas.find((f) => f.externo_id !== e.externo_id && mismoActo(f, e)) ?? null;
}

/**
 * Mismo acto: ni fila nueva, ni espejo, ni pago. Si lo apuntado a mano llega
 * después medido, la medición sustituye a la mano y se queda con su llave.
 */
async function fundirGemelo(gemelo: EntrenoFila, e: EntrenoMedido, fecha: string, extra?: { rpe?: number | null; notas?: string | null }): Promise<EntrenoFila> {
  if (gemelo.origen !== 'manual' || e.origen === 'manual') return gemelo;
  const { data, error } = await supabase
    .from('entrenos_medidos')
    .update({ ...camposReimportacion(e, fecha, extra), externo_id: e.externo_id })
    .eq('id', gemelo.id)
    .select(COLUMNAS_LISTA)
    .single();
  if (error) throw error;
  return data as unknown as EntrenoFila;
}

/** Lo que entró por este entreno si la RPC confirmó y se perdió su respuesta. */
async function cobroConfirmado(entrenoId: string): Promise<number> {
  try {
    const { data } = await supabase
      .from('events')
      .select('payload')
      .eq('type', 'cardio_session')
      .contains('payload', { entreno_id: entrenoId })
      .limit(1);
    const xp = Number((data?.[0] as { payload?: { xp?: unknown } } | undefined)?.payload?.xp);
    return Number.isFinite(xp) && xp > 0 ? xp : 0;
  } catch {
    return 0;
  }
}

/**
 * Guarda un entreno medido y, si toca, lo paga. Una sola puerta para el reloj,
 * el GPS, Salud y la hoja manual; quien llama no toca XP ni `propagarActo`.
 *
 * Lo que paga lo decide `decidirPago`, y el pago es el de `useCardio.guardar`.
 * Si ese día ya hay cardio de ese tipo no se reescribe, ni se propaga, ni se
 * paga: una fila con 0 XP (descontada por la misión) también cuenta como hecha.
 */
export async function guardarEntrenoMedido(
  userId: string,
  entrada: unknown,
  extra?: { rpe?: number | null; notas?: string | null; esOtraSesion?: boolean },
): Promise<ResultadoGuardar> {
  const normalizado = normalizarEntreno(entrada);
  if (!normalizado.ok) return { ok: false, motivo: normalizado.motivo };
  const e = normalizado.entreno;
  // Del fin y con la hora local: cortar el ISO daría ayer a las 00:30 en Madrid.
  const fecha = dateKey(new Date(e.fin));
  const hoy = dateKey();
  const decision = decidirPago({ ...e, fecha }, hoy);
  const kind = tipoCardioDe(e.deporte);

  let fila: EntrenoFila | null;
  try {
    const gemelo = extra?.esOtraSesion ? null : await gemeloDe(e);
    if (gemelo) {
      const resultado = await fundirGemelo(gemelo, e, fecha, extra);
      return { ok: true, nuevo: false, fila: resultado, anuncio: null, records: [], pagado: 0 };
    }
    // `propagarActo` se traga un fallo de lectura y cobraría el módulo: la
    // misión, marcada luego a mano, pagaría otra vez. Si no se puede leer, no
    // se guarda y el reintento vuelve a entrar limpio.
    if (decision === 'pagar') {
      const leer = () => Promise.all([fetchQuests(), fetchCompletionsForDate(hoy)]);
      await leer().catch(leer);
    }
    fila = await insertarSiNuevo(filaNueva(userId, e, fecha, extra));
    if (!fila) {
      const existente = await actualizarExistente(userId, e.externo_id, camposReimportacion(e, fecha, extra));
      return { ok: true, nuevo: false, fila: existente, anuncio: null, records: [], pagado: 0 };
    }
  } catch (err) {
    return { ok: false, motivo: mensajeSistema(err) };
  }

  if (decision !== 'pagar' || !kind) {
    await enlazarPlan(fila);
    return {
      ok: true,
      nuevo: true,
      fila,
      anuncio: kind && fecha < hoy ? t('resistencia:anuncioXp.otroDia') : null,
      records: [],
      pagado: 0,
      ...(decision === 'proponer' ? { proponer: true } : {}),
    };
  }

  // Primero el acto: mientras nada se haya movido, un fallo deshace la fila. Si
  // se quedara, el reintento la vería como «ya existía» y no pagaría nunca.
  let base: number;
  let tiposHoy: string[];
  let espejo: EspejoFila<CardioKind, CardioZone>;
  try {
    const estado = await cardioDayState(fecha, kind);
    if (estado.pagadoEsteTipo !== null) {
      await enlazarPlan(fila);
      return { ok: true, nuevo: true, fila, anuncio: t('resistencia:anuncioXp.yaConstaba'), records: await recordsDelEntreno(fila), pagado: 0 };
    }
    tiposHoy = estado.tiposHoy;
    base = cardioXp(kind, estado.pagadoHoy);
    espejo = espejoCardio<CardioKind, CardioZone>({
      date: fecha,
      kind,
      distance_km: e.distancia_m === null ? null : e.distancia_m / 1000,
      duration_min: e.duracion_s / 60,
      avg_hr: e.fc_media,
      rpe: rpeValido(extra?.rpe),
      // Lo medido no tiene zona declarada: un Z2 por defecto ensucia la tendencia.
      zone: e.origen === 'manual' ? await zonaDelEntreno(e) : 'libre',
      notes: notaValida(extra?.notas),
      // Nada pagado aún: el XP se apunta cuando la RPC lo confirma.
      xp: 0,
    });
    await saveCardio(userId, espejo);
  } catch (err) {
    await supabase.from('entrenos_medidos').delete().eq('id', fila.id);
    return { ok: false, motivo: mensajeSistema(err) };
  }

  let eco: Eco | null = null;
  let pagado = 0;
  let nuevo = 0;
  const primera = primeraSesionQuePropaga(tiposHoy);
  try {
    let perfil: Profile = await ensureProfile(userId);
    // Un paseo no salda un «Correr 5 km»: como en useCardio.
    if (kind !== 'caminar') eco = await propagarActo(perfil, 'cardio', fecha, { deporte: e.deporte });
    nuevo = pagoDelModulo(base, eco, primera);
    if (nuevo > 0) {
      perfil = await ensureProfile(userId);
      const res = await awardXp(perfil, nuevo, 'FUE', 'cardio_session', {
        kind,
        km: espejo.distance_km,
        min: espejo.duration_min,
        zone: espejo.zone,
        date: fecha,
        entreno_id: fila.id,
        origen: e.origen,
        externo_id: e.externo_id,
      });
      pagado = xpPagado(nuevo, perfil.xp_total, res.profile.xp_total);
    }
    // Se apunta lo PAGADO: de `xp` sale el tope diario de cardio.
    if (pagado > 0) await saveCardio(userId, { ...espejo, xp: pagado });
  } catch {
    // El acto ya está y la misión pudo cobrar: el entreno se queda sin deshacer.
    // Si la RPC confirmó y se perdió la respuesta, se apunta lo que entró.
    const cobrado = pagado > 0 ? pagado : nuevo > 0 ? await cobroConfirmado(fila.id) : 0;
    if (cobrado > 0) {
      await saveCardio(userId, { ...espejo, xp: cobrado }).catch(() => undefined);
      await supabase.from('entrenos_medidos').update({ xp_awarded: cobrado }).eq('id', fila.id);
    }
    await enlazarPlan(fila);
    return { ok: true, nuevo: true, fila, anuncio: null, records: [], pagado: (eco?.xp ?? 0) + cobrado };
  }

  if (pagado > 0) {
    await supabase.from('entrenos_medidos').update({ xp_awarded: pagado }).eq('id', fila.id);
    fila = { ...fila, xp_awarded: pagado };
  }
  await enlazarPlan(fila);
  const records = await recordsDelEntreno(fila);

  const anuncio = anuncioCardio({
    xpMision: eco?.xp ?? 0,
    marcadas: eco?.marcadas ?? [],
    xpModulo: pagado,
    pedidoModulo: nuevo,
    misionYaPagada: primera && (eco?.xpMisiones ?? 0) > 0,
    esCorreccion: false,
    topeDiario: CARDIO_DAILY_CAP,
  });
  return { ok: true, nuevo: true, fila, anuncio, records, pagado: (eco?.xp ?? 0) + pagado };
}
