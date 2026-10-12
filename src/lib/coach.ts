// NIVL · Cliente del coach.
//
// Habla con la Edge Function `coach`, que es la que tiene la clave de IA y las
// manos para escribir en la vida del gladiador. Aquí no hay ninguna credencial
// de IA: solo el JWT de la sesión.
//
// El streaming va por `expo/fetch`, no por el fetch de React Native: el de RN
// está montado sobre XHR y no expone `response.body`, así que el texto llegaría
// de golpe al final y el chat se sentiría muerto.

import { fetch as streamingFetch } from 'expo/fetch';
import type { Slide } from './photos';
import { supabase } from './supabase';
import { dateKey } from './dates';
import { fetchHealthConsent, requireHealthConsent } from './health';
import { ErrorVisible } from './validation';
import { sinGuiones } from './singuiones';

export type CoachKind =
  | 'chat'
  | 'brief'
  | 'plan'
  | 'revision_semanal'
  | 'cierre_mensual'
  | 'escalada';

/** Bloque de contenido tal y como lo guarda coach_messages. */
export interface CoachBlock {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: unknown;
  is_error?: boolean;
}

export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: CoachBlock[];
  created_at: string;
}

export interface CoachThread {
  id: string;
  title: string;
  last_message_at: string;
}

export interface CoachFact {
  id: string;
  date: string;
  category: string;
  content: string;
  source: string;
}

export interface CoachRun {
  id: string;
  kind: string;
  cost_micro_usd: number;
  created_at: string;
}

/** Lo que la pantalla necesita pintar de un turno. */
export interface CoachAction {
  name: string;
  ok: boolean;
  detail: string;
}

export type CoachEvent =
  | { type: 'start'; threadId: string }
  | { type: 'thinking' }
  | { type: 'text'; delta: string }
  | { type: 'tool'; action: CoachAction }
  | { type: 'done'; threadId: string; text: string; costMicroUsd: number }
  | { type: 'error'; message: string };

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sesión caducada. Vuelve a entrar.');
  return {
    authorization: `Bearer ${token}`,
    apikey: process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '',
    'content-type': 'application/json',
  };
}

/** Por qué el candado de gasto (migraciones 0020 y 0024) ha dicho que no. */
export type CoachDenyReason =
  | 'sin_suscripcion'
  | 'presupuesto_agotado'
  | 'turno_en_curso'
  | 'profundo_no_incluido'
  | 'profundo_agotado'
  /** Sin consentimiento vigente para la IA (0028): se abre la hoja, no un error. */
  | 'sin_consentimiento'
  | 'sin_consentimiento_salud';

const DENY_REASONS: readonly CoachDenyReason[] = [
  'sin_suscripcion',
  'presupuesto_agotado',
  'turno_en_curso',
  'profundo_no_incluido',
  'profundo_agotado',
  'sin_consentimiento',
  'sin_consentimiento_salud',
];

/** Potencia del turno (0024): el profundo es solo del Élite y tiene su propio bolsillo. */
export type CoachMode = 'estandar' | 'profundo';

/**
 * El coach ha rechazado el turno por el candado, no por un fallo. Es una señal
 * tipada para que las pantallas respondan con diseño y no con una alerta de
 * error: sin suscripción → NIVL Pro; presupuesto agotado → aviso sereno con la
 * fecha de recarga; turno en curso → "sigue respondiendo".
 */
export class CoachAccessError extends Error {
  readonly reason: CoachDenyReason;
  readonly status: number;
  constructor(reason: CoachDenyReason, status: number, message: string) {
    super(message);
    this.name = 'CoachAccessError';
    this.reason = reason;
    this.status = status;
  }
}

/** Texto sereno para cada negativa del candado, en la voz del sistema. */
export function accessNotice(e: CoachAccessError): string {
  switch (e.reason) {
    case 'sin_consentimiento_salud':
      return 'Revisa el permiso de salud en Perfil antes de continuar con el coach.';
    case 'sin_suscripcion':
      return 'El coach es parte de NIVL Pro. El resto de NIVL sigue siendo tuyo.';
    case 'presupuesto_agotado':
      // El servidor ya trae la fecha de recarga en su mensaje.
      return e.message || 'La energía del coach de este mes se ha agotado. Se recarga el día 1.';
    case 'turno_en_curso':
      return 'El sistema sigue respondiendo a tu mensaje anterior. Dale unos segundos.';
    case 'profundo_no_incluido':
      return 'El modo profundo es parte de NIVL Élite. El estándar sigue contigo.';
    case 'profundo_agotado':
      return 'Has usado tus turnos profundos de este mes. El modo estándar sigue disponible.';
    case 'sin_consentimiento':
      return 'Antes de usar el coach tienes que aceptar el envío de tus datos al proveedor de IA. Puedes hacerlo en Perfil.';
  }
}

/**
 * Convierte una respuesta fallida de la función `coach` en el error que toca:
 * 402 y 429 con `reason` conocido son negativas del candado; lo demás, un
 * fallo de verdad.
 */
async function errorDe(res: { status: number; json: () => Promise<unknown> }): Promise<Error> {
  let body: { error?: string; reason?: string } = {};
  try {
    body = ((await res.json()) ?? {}) as { error?: string; reason?: string };
  } catch {
    /* respuesta no JSON */
  }
  const reason = DENY_REASONS.find((r) => r === body.reason);
  if (reason && (res.status === 402 || res.status === 403 || res.status === 429)) {
    return new CoachAccessError(reason, res.status, body.error ?? '');
  }
  // Un 402 sin motivo reconocible (servidor más nuevo que la app) sigue siendo
  // "no tienes acceso", no un error del sistema.
  if (res.status === 402) return new CoachAccessError('sin_suscripcion', 402, body.error ?? '');
  // Las fotos rechazadas (demasiadas, formato, tamaño) traen un motivo ya
  // escrito para el usuario: pasa tal cual.
  if (res.status === 400 && typeof body.error === 'string' && /foto/i.test(body.error)) {
    return new ErrorVisible(body.error);
  }
  if (res.status === 404) return new HiloPerdidoError();
  return new Error(body.error || `El sistema no responde (HTTP ${res.status}).`);
}

/** El hilo guardado ya no existe en el servidor (o no es de esta cuenta). */
export class HiloPerdidoError extends Error {
  constructor() {
    super('Hilo no encontrado.');
    this.name = 'HiloPerdidoError';
  }
}

function functionsUrl(): string {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error('Falta EXPO_PUBLIC_SUPABASE_URL');
  return `${base}/functions/v1/coach`;
}

/**
 * Envía un turno al coach y va emitiendo lo que llega. Resuelve cuando el
 * turno termina; los errores del servidor llegan como evento 'error' y además
 * se lanzan, para que la pantalla pueda elegir cómo tratarlos. Una negativa
 * del candado (402/429) se lanza como `CoachAccessError`, sin evento.
 */
export async function streamCoach(opts: {
  kind?: CoachKind;
  message: string;
  threadId?: string;
  /** Fotos en base64. Viajan solo en este turno: no se guardan en el hilo. */
  imagenes?: { media_type: string; data: string }[];
  /**
   * Potencia del turno. Viaja en la cabecera `x-nivl-mode`, no en el cuerpo:
   * el servidor cruza la puerta del candado antes de leer el cuerpo.
   */
  mode?: CoachMode;
  onEvent: (e: CoachEvent) => void;
  signal?: AbortSignal;
}): Promise<void> {
  await requireHealthConsent();
  const headers: Record<string, string> = await authHeaders();
  if (opts.mode === 'profundo') headers['x-nivl-mode'] = 'profundo';
  const res = await streamingFetch(functionsUrl(), {
    method: 'POST',
    headers,
    signal: opts.signal,
    body: JSON.stringify({
      kind: opts.kind ?? 'chat',
      message: opts.message,
      thread_id: opts.threadId,
      imagenes: opts.imagenes,
      // El "hoy" del móvil (su zona horaria). Sin él, el servidor vivía en la
      // fecha UTC y de 00:00 a 02:00 en Madrid el coach miraba el día de ayer:
      // negaba la sesión que acababas de registrar.
      date: dateKey(),
    }),
  });

  if (!res.ok || !res.body) {
    const err = await errorDe(res);
    // Hilo borrado o ajeno: se olvida y el turno va al hilo principal, una
    // sola vez. El nuevo id llega en el evento 'start'.
    if (err instanceof HiloPerdidoError && opts.threadId) {
      return streamCoach({ ...opts, threadId: undefined });
    }
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fallo: string | null = null;
  let terminado = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Los eventos SSE se separan por línea en blanco y pueden llegar partidos
      // entre dos chunks: solo se procesa lo que ya está completo.
      let separador: RegExpExecArray | null;
      while ((separador = /\r?\n\r?\n/.exec(buffer)) !== null) {
        const raw = buffer.slice(0, separador.index);
        buffer = buffer.slice(separador.index + separador[0].length);
        const evento = raw.match(/^event:\s*(.*)$/m)?.[1];
        const datos = raw.match(/^data:\s*(.*)$/m)?.[1];
        if (!evento || !datos) continue;
        let d: Record<string, any>;
        try {
          d = JSON.parse(datos);
        } catch {
          continue;
        }
        switch (evento) {
          case 'start':
            opts.onEvent({ type: 'start', threadId: d.thread_id });
            break;
          case 'thinking':
            opts.onEvent({ type: 'thinking' });
            break;
          case 'text':
            opts.onEvent({ type: 'text', delta: d.delta ?? '' });
            break;
          case 'tool':
            opts.onEvent({
              type: 'tool',
              action: { name: d.name, ok: !!d.ok, detail: d.detail ?? '' },
            });
            break;
          case 'done':
            terminado = true;
            opts.onEvent({
              type: 'done',
              threadId: d.thread_id,
              text: sinGuiones(d.text ?? ''),
              costMicroUsd: d.cost_micro_usd ?? 0,
            });
            break;
          case 'error':
            fallo = d.message ?? 'El sistema no responde.';
            opts.onEvent({ type: 'error', message: fallo! });
            break;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (fallo) throw new Error(fallo);
  if (!terminado) throw new Error('La respuesta del coach se ha interrumpido.');
}

/** Ritual sin streaming (brief, revisión…): devuelve el texto ya completo. */
export async function runRitual(kind: CoachKind, message = ''): Promise<string> {
  await requireHealthConsent();
  const res = await fetch(functionsUrl(), {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ kind, message, stream: false, date: dateKey() }),
  });
  if (!res.ok) throw await errorDe(res);
  const body = (await res.json().catch(() => ({}))) as { text?: string };
  return body.text ?? '';
}

/**
 * Genera el resumen del periodo. Devuelve `motivo` en vez de diapositivas
 * cuando no hay fotos: un pase vacío no motiva, recuerda que no registraste
 * nada, así que se dice con palabras y ya está.
 */
export async function generarResumen(
  periodo: 'semanal' | 'mensual',
): Promise<{ id?: string; slides: Slide[]; fotos: number; motivo?: string }> {
  await requireHealthConsent();
  const res = await fetch(functionsUrl(), {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ kind: 'resumen', periodo, date: dateKey() }),
  });
  if (!res.ok) throw await errorDe(res);
  const body = (await res.json().catch(() => ({}))) as {
    id?: string;
    slides?: Slide[];
    fotos?: number;
    motivo?: string;
  };
  return { id: body.id, slides: body.slides ?? [], fotos: body.fotos ?? 0, motivo: body.motivo };
}

/**
 * Clasifica los movimientos pendientes. No pasa por el coach: es una tarea
 * mecánica que atiende Haiku con un prompt de diez líneas y sin nada del
 * contexto del gladiador. Un extracto entero cuesta céntimas.
 */
export async function clasificarMovimientos(): Promise<{ clasificados: number; texto: string }> {
  const res = await fetch(functionsUrl(), {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ kind: 'clasificar' }),
  });
  if (!res.ok) throw await errorDe(res);
  const body = (await res.json().catch(() => ({}))) as {
    clasificados?: number;
    texto?: string;
  };
  return { clasificados: body.clasificados ?? 0, texto: body.texto ?? '' };
}

// ── Lecturas ────────────────────────────────────────────────────────

export async function fetchMainThread(): Promise<CoachThread | null> {
  const { data, error } = await supabase
    .from('coach_threads')
    .select('id, title, last_message_at')
    .eq('archived', false)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as CoachThread) ?? null;
}

/** Sanea los bloques de texto de un mensaje del coach (los del usuario no se tocan). */
export function sinGuionesEnMensaje(m: CoachMessage): CoachMessage {
  if (m.role !== 'assistant' || !Array.isArray(m.content)) return m;
  return {
    ...m,
    content: m.content.map((b) =>
      b && (b as { type?: string }).type === 'text' && typeof (b as { text?: unknown }).text === 'string'
        ? { ...b, text: sinGuiones((b as { text: string }).text) }
        : b,
    ),
  };
}

export async function fetchMessages(threadId: string, limit = 60): Promise<CoachMessage[]> {
  const { data, error } = await supabase
    .from('coach_messages')
    .select('id, role, content, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  // Se pide del más nuevo al más viejo para quedarnos con los últimos, pero se
  // pinta en orden cronológico.
  // Orden del dueño: ningún texto de la IA con «—» ni «–», tampoco los ya guardados.
  return ((data ?? []) as CoachMessage[]).reverse().map(sinGuionesEnMensaje);
}

export async function fetchDossier(): Promise<{ content: string; version: number } | null> {
  const { data, error } = await supabase
    .from('coach_dossier')
    .select('content, version')
    .maybeSingle();
  if (error) throw error;
  return (data as { content: string; version: number }) ?? null;
}

export async function fetchFacts(limit = 100): Promise<CoachFact[]> {
  const { data, error } = await supabase
    .from('coach_facts')
    .select('id, date, category, content, source')
    .order('date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as CoachFact[];
}

export const MSG_HECHO_NO_EXISTE = 'Ese recuerdo ya no está en la memoria del coach.';

/**
 * Borra un hecho de la memoria del coach (RGPD: supresión; la persona decide
 * qué recuerda la IA de ella). Solo los propios: la RLS de coach_facts
 * («own coach_facts», 0008) deja borrar las filas con user_id = auth.uid() y
 * ninguna otra; con un id ajeno o inexistente no se borra nada y se avisa.
 * Desde el turno siguiente el coach ya no lo ve: los hechos se leen en cada
 * turno, no se guardan en caché.
 */
export const MSG_MEMORIA_SIN_PERMISO =
  'Con el permiso de salud retirado, la memoria del coach se borra entera: termina el borrado pendiente en Perfil.';

export async function borrarHecho(id: string): Promise<void> {
  // Sin permiso de salud la RLS no deja tocar coach_facts (política
  // restrictiva health_permission). No es un muro para borrar: retirar el
  // permiso BORRA toda la memoria (complete_health_erasure: hechos, dossier y
  // conversación). El aviso lleva ahí, nunca a aceptar.
  if (!(await fetchHealthConsent()).accepted) throw new ErrorVisible(MSG_MEMORIA_SIN_PERMISO);
  const { data, error } = await supabase.from('coach_facts').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new ErrorVisible(MSG_HECHO_NO_EXISTE);
}

/** Gasto de IA del mes en curso, en dólares. */
export async function fetchMonthCost(): Promise<number> {
  const desde = `${new Date().toISOString().slice(0, 7)}-01`;
  const { data, error } = await supabase
    .from('coach_runs')
    .select('cost_micro_usd')
    .gte('created_at', desde);
  if (error) throw error;
  const micros = (data ?? []).reduce(
    (s: number, r: { cost_micro_usd: number }) => s + (r.cost_micro_usd ?? 0),
    0,
  );
  return micros / 1e6;
}

// ── Presentación ────────────────────────────────────────────────────

const ACCION_LEGIBLE: Record<string, string> = {
  crear_mision: 'ha creado una misión',
  editar_mision: 'ha ajustado una misión',
  desactivar_mision: 'ha desactivado una misión',
  planificar_dia: 'ha escrito el plan del día',
  programar_evento: 'ha puesto una cita en la agenda',
  fijar_horarios: 'ha fijado tus horarios',
  registrar_hecho: 'ha anotado en su memoria',
  actualizar_dossier: 'ha reescrito su memoria',
  crear_mazmorra: 'ha abierto una campaña',
  crear_tarea: 'ha añadido una tarea',
  registrar_regla: 'ha añadido una regla al contrato',
  ajustar_meta: 'ha fijado una meta',
  prescribir_entreno: 'ha prescrito tu entreno',
  fijar_nutricion: 'ha fijado tus calorías y tu proteína',
  planificar_comidas: 'ha escrito tus comidas',
  configurar_rutina: 'ha reescrito tu rutina',
  fijar_plan_economico: 'ha fijado tu plan económico',
  fijar_presupuesto: 'ha puesto un tope de gasto',
  regla_categoria: 'ha aprendido a clasificar un movimiento',
  registrar_movimiento: 'ha anotado un movimiento',
  gestionar_elemento: 'ha modificado tu sistema',
  registrar_dato: 'ha registrado un dato por ti',
  fijar_ficha: 'ha actualizado tu ficha física',
  escribir_diario: 'ha escrito en tu diario',
  consultar_historial: 'ha consultado tu historial',
  consultar_dia: 'ha comprobado lo registrado ese día',
};

export function describeAction(name: string): string {
  return `El sistema ${ACCION_LEGIBLE[name] ?? `ha ejecutado ${name}`}`;
}

/** Texto visible de un turno guardado (ignora pensamiento y herramientas). */
export function messageText(m: CoachMessage): string {
  return (m.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
    .trim();
}

/** Acciones ejecutadas en un turno guardado, para pintarlas bajo el texto. */
export function messageActions(m: CoachMessage): string[] {
  return (m.content ?? [])
    .filter((b) => b.type === 'tool_use' && b.name)
    .map((b) => describeAction(b.name!));
}

/** Un turno de usuario que solo lleva resultados de herramienta no se pinta. */
export function isToolResultOnly(m: CoachMessage): boolean {
  const blocks = m.content ?? [];
  return blocks.length > 0 && blocks.every((b) => b.type === 'tool_result');
}
