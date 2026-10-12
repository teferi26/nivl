// NIVL · Edge Function: EL COACH.
//
// No es un proxy de la API de Claude: es un agente con manos. Lee el estado
// real del gladiador, conversa, y escribe en su vida (misiones, plan del día,
// agenda, horarios, memoria) a través de herramientas acotadas.
//
// Dos garantías de diseño:
//   · La API key vive aquí como secret del servidor y jamás llega al móvil.
//   · Las herramientas se ejecutan con el JWT de quien llama, así que RLS
//     sigue aplicando: el coach no puede tocar datos de otro usuario aunque
//     el modelo se invente un identificador.
//
// Despliegue:
//   supabase functions deploy coach
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import {
  callClaude,
  CHEAP_MODEL,
  COACH_MODEL,
  costMicroUsd,
  LlamadaFallida,
  proveedorCompatible,
  RefusalError,
  type ApiMessage,
  type ContentBlock,
  type Effort,
  type Turn,
  type Usage,
} from '../_shared/anthropic.ts';
import { clasificarPendientes, ClasificacionConsentimientoError } from '../_shared/clasificar.ts';
import { callOpenAICompat } from '../_shared/openai.ts';
import { construirResumen, periodoMensual, periodoSemanal } from '../_shared/recap.ts';
import { buildContext, buildContextMinimo } from '../_shared/context.ts';
import { consentimientoIa, MENSAJE_SIN_CONSENTIMIENTO, SIN_CONSENTIMIENTO } from '../_shared/consent.ts';
import { healthConsent, healthGuardedResult, healthRevision, healthScopedClient, HEALTH_REQUIRED, requireHealth } from '../_shared/health.ts';
import { adminClient, userClient, type Db } from '../_shared/db.ts';
import { buildSystem, buildSystemRegistro, DATOS_ABRE, DATOS_CIERRA, neutralizarDatos } from '../_shared/prompt.ts';
import { elegirModelo, modoDeCabecera, proveedorDe, type Modo, type Routes } from '../_shared/routing.ts';
import { executeTool, TOOL_DEFS } from '../_shared/tools.ts';
import { controlHerramientas, fechaAceptable, fechaDelTurno, fotosSinVision, Gasto, mensajeDeFallo, reloj, validarImagenes } from './guard.ts';
import { pareceAfirmacion, rutaDelTurno, type Ruta } from '../_shared/intencion.ts';
import { fueraDelPack, PACK_REGISTRO, TOOL_DEFS_REGISTRO } from '../_shared/packs.ts';
import { bloqueComprobacion } from '../_shared/comprobacion.ts';
import { insertarRun, type Telemetria } from '../_shared/telemetria.ts';
import { enSegundoPlano, leerResumen, MIN_NUEVOS, resumirHilo, VENTANA_HISTORIAL } from '../_shared/resumenhilo.ts';

// Cinco vueltas, no ocho. Cada vuelta reenvía el contexto entero y genera
// pensamiento: con ocho, un turno se comía el presupuesto de tiempo de la
// función antes de contestar nada.
const MAX_TOOL_ITERATIONS = 5;

// Presupuesto de reloj del turno.
//
// Una Edge Function de Supabase se corta sobre los 150 segundos. Cuando eso
// pasa NO queda ni respuesta ni registro en coach_runs: el turno se evapora y
// desde la app parece que el sistema no contesta. Con este margen, al pasar de
// 100 s se deja de encadenar herramientas y se contesta con lo que haya, que
// siempre es mejor que un silencio.
const PRESUPUESTO_MS = 100_000;
// Plazo DURO de cualquier llamada al proveedor, contado desde que entra la
// petición. Si la plataforma corta la función (~150 s), no se apunta nada en
// coach_runs y ese gasto no lo ve el candado: hay que cortar antes nosotros,
// con margen para guardar la respuesta y la contabilidad.
const PLAZO_DURO_MS = 130_000;
// El hilo es continuo de cara a ti, pero lo que se reenvía a la API tiene tope:
// la memoria larga vive en el dossier, en coach_facts y en el resumen del hilo
// (L4), no en el transcript. Sin tope, la conversación crece sin fin y a los
// seis meses cada turno arrastra cientos de miles de tokens.
//
// L8: con resumen al día viajan 6 filas (VENTANA_HISTORIAL), y el resumen se
// compacta en cuanto hay 6 sin resumir, así que lo que sale de la ventana ya
// está en él. Sin resumen todavía (hilos antiguos) o con el resumen atrasado
// (el del turno anterior aún no se ha escrito, o falló), el tope de antes: 12.
// Medido el 02/10: el historial era la mayor parte dinámica del prefijo (las
// respuestas del asistente promediaban 4.000 caracteres con tool_use/
// tool_result serializados).
const HISTORY_LIMIT = VENTANA_HISTORIAL;
const HISTORY_LIMIT_SIN_RESUMEN = 12;
// Un turno añade como mínimo 2 filas (su mensaje y la respuesta): con eso se
// decide, sin otra consulta, si tras el turno tocará compactar.
const FILAS_POR_TURNO = 2;
// Lo más largo que viaja de una respuesta vieja del asistente (L8).
const TOPE_ASISTENTE_VIEJO = 1500;
// Freno de mano: si un turno encadena tantas herramientas que ya ha costado
// esto, algo se ha ido de madre y es mejor cortar que despertarse con la
// sorpresa. Con Sonnet un turno normal ronda 0,07 $ y un brief con herramientas
// 0,18 $, así que 0,75 $ deja margen de sobra sin dejar pasar una fuga.
const MAX_COST_MICRO_USD = 750_000; // 0,75 $
// El modo profundo (solo Élite, 0024) piensa a fondo y escribe más: su freno
// es el doble. Igual que el estándar, nunca por encima de lo que le queda en
// su bolsillo.
const MAX_COST_PROFUNDO_MICRO_USD = 1_500_000; // 1,50 $
const MAX_TOKENS_PROFUNDO = 16000;

// Ruta estrecha «registro» (L3): un parte («he hecho…», «peso 94,2») con el
// modelo barato, el estado de hoy y cuatro herramientas. Tres vueltas bastan
// (comprobar, apuntar, contestar) y la última se fuerza a texto. Su freno es
// mucho más bajo: un parte que pasa de 5 céntimos es que algo se ha torcido.
const MAX_TOOL_ITERATIONS_REGISTRO = 3;
const MAX_COST_REGISTRO_MICRO_USD = 50_000; // 0,05 $
const MAX_TOKENS_REGISTRO = 4000;
// Los 4 últimos mensajes del hilo, solo su texto: para un parte basta con saber
// de qué se hablaba, y sin tool_use viejos no hay que reenviar herramientas
// que esta ruta no ofrece.
const HISTORY_LIMIT_REGISTRO = 4;

const KINDS = ['chat', 'brief', 'plan', 'revision_semanal', 'cierre_mensual', 'escalada'] as const;
type Kind = (typeof KINDS)[number];

// 'clasificar' va aparte de KINDS a propósito: no es un ritual del coach ni
// pasa por su contexto. Es una tarea mecánica que se atiende con Haiku y con
// diez líneas de prompt. Ver _shared/clasificar.ts.
const KIND_MECANICO = 'clasificar';
// El resumen visual: tampoco es un ritual del coach, es un generador con datos
// del periodo. Ver _shared/recap.ts.
const KIND_RESUMEN = 'resumen';

/**
 * Modelo por ritual SEGÚN LOS SECRETS. Desde la 0024 el modelo sale primero
 * del plan (`ai_plans.routes`, ver `_shared/routing.ts`); esto es la reserva
 * para un plan sin modelo fijado, que hoy es el del owner.
 *
 * Dos secretos para cambiarlo sin desplegar:
 *
 *   COACH_MODEL_CHAT    → el del día a día, que es donde está el volumen
 *   COACH_MODEL_RITUAL  → brief, revisión semanal, cierre de mes y escalada
 *
 * La división no es caprichosa. El chat son decenas de turnos al mes y manda
 * en la factura; los rituales son unos treinta y uno deciden el rumbo de la
 * semana entera, así que ahí un modelo más caro cuesta céntimos y se nota.
 *
 * Para probar si Haiku aguanta de coach basta con poner COACH_MODEL_CHAT a
 * claude-haiku-4-5 en el panel de Supabase y comparar respuestas: el coste real
 * de cada turno queda en coach_runs, con su modelo al lado.
 */
function modeloDeEnv(kind: Kind): string {
  const chat = Deno.env.get('COACH_MODEL_CHAT')?.trim();
  const ritual = Deno.env.get('COACH_MODEL_RITUAL')?.trim();
  const esCharla = kind === 'chat' || kind === 'plan';
  const elegido = esCharla ? chat || ritual : ritual || chat;
  // Antes, con COACH_BASE_URL puesto y sin modelo, esto lanzaba un error: el
  // proveedor era global y "claude-sonnet-5" acababa en DeepSeek. Ahora el
  // proveedor sale del nombre del modelo, así que caer a Claude es seguro.
  return elegido || COACH_MODEL;
}

/**
 * El modelo del turno y con quién se habla. Un modelo que no es de Claude va
 * por la API compatible; si sus secrets (COACH_BASE_URL + COACH_API_KEY) no
 * están puestos, se cae a COACH_MODEL con un aviso en el log: el producto se
 * degrada, pero el candado sigue cortando el gasto.
 */
function resolverModelo(
  routes: Routes,
  kind: Kind,
  modo: Modo,
): { model: string; compat: { baseUrl: string; apiKey: string } | null } {
  const model = elegirModelo(routes, kind, modo, () => modeloDeEnv(kind));
  if (proveedorDe(model) === 'anthropic') return { model, compat: null };
  const compat = proveedorCompatible();
  if (compat) return { model, compat };
  console.warn(`Modelo ${model} sin COACH_BASE_URL/COACH_API_KEY: se atiende con ${COACH_MODEL}.`);
  return { model: COACH_MODEL, compat: null };
}

/**
 * El modelo de la ruta de registro: `routes.registro` del plan y, si no hay,
 * CHEAP_MODEL. A propósito NO cae al `default` del plan (que es el coach caro)
 * ni a `profundo`: un parte es leer y transformar, no decidir (AGENTS.md).
 */
function resolverModeloRegistro(routes: Routes): { model: string; compat: { baseUrl: string; apiKey: string } | null } {
  const model = elegirModelo({ registro: routes.registro }, 'registro', 'estandar', () => CHEAP_MODEL);
  if (proveedorDe(model) === 'anthropic') return { model, compat: null };
  const compat = proveedorCompatible();
  if (compat) return { model, compat };
  console.warn(`Modelo ${model} sin COACH_BASE_URL/COACH_API_KEY: el registro se atiende con ${CHEAP_MODEL}.`);
  return { model: CHEAP_MODEL, compat: null };
}

/**
 * El historial de la ruta de registro: los últimos mensajes con TEXTO, sin
 * tool_use ni tool_result ni pensamiento (las herramientas de entonces no
 * están en este pack) y empezando por un mensaje del gladiador.
 */
function historialDeTexto(messages: ApiMessage[], limite: number): ApiMessage[] {
  const planos: ApiMessage[] = [];
  for (const m of messages) {
    const texto = typeof m.content === 'string'
      ? m.content
      : (Array.isArray(m.content) ? m.content : [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('\n')
        .trim();
    if (!texto) continue;
    planos.push({ role: m.role, content: [{ type: 'text', text: texto.slice(0, 1500) }] as ContentBlock[] });
  }
  let out = planos.slice(-limite);
  while (out.length && out[0].role !== 'user') out = out.slice(1);
  return out;
}

// Los rituales que deciden el rumbo piensan más que una charla suelta.
//
// El chat baja a 'medium' por una razón medida: con 'high' un turno generaba
// entre 2.000 y 11.000 fichas de pensamiento, y generar es la parte lenta
// (decenas de fichas por segundo). Un "¿cómo voy?" no necesita once mil fichas
// de deliberación, necesita responder antes de que sueltes el móvil.
const EFFORT_BY_KIND: Record<Kind, Effort> = {
  chat: 'low',
  // El brief y el plan bajan a 'medium' por lo mismo que el chat, pero el
  // sintoma fue peor: con 'high' se gastaban el techo ENTERO pensando y
  // devolvian un turno sin texto y sin llamada, asi que el usuario se
  // levantaba sin plan del dia. No es reflexion, es un cuelgue. La tarea
  // tampoco lo pide: leer un estudio ya calculado y aplicar una doctrina
  // escrita, que es justo el argumento por el que el coach es Sonnet.
  brief: 'medium',
  plan: 'medium',
  revision_semanal: 'xhigh',
  cierre_mensual: 'xhigh',
  escalada: 'high',
};

// Techo de salida por tipo. El de chat es el que más importa: 16.000 fichas de
// tope invitaban a respuestas kilométricas que además tardaban minutos.
const MAX_TOKENS_BY_KIND: Record<Kind, number> = {
  // Ojo: el pensamiento cuenta DENTRO de este tope. Con 3.000 el modelo se lo
  // gastó entero deliberando y devolvió un turno VACÍO. El techo tiene que dar
  // para pensar y además responder.
  chat: 8000,
  // Los rituales necesitan MAS que el chat, no menos: ademas de escribir el
  // veredicto llaman a planificar_dia con el dia entero, y ese JSON son un par
  // de miles de fichas por si solo. Con 6.000 no cabia pensamiento + texto +
  // plan, y lo que se perdia siempre era el plan, que va al final.
  brief: 12000,
  plan: 12000,
  revision_semanal: 16000,
  cierre_mensual: 16000,
  // Con 4.000 y esfuerzo alto, la carta de las tres puertas caia en la misma
  // trampa. Es el turno mas delicado de todos: llega cuando lleva dias sin
  // aparecer. Quedarse mudo justo ahi es el peor momento posible.
  escalada: 8000,
};

const admin = adminClient();

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Marcas de texto del historial ligero (L8). Deterministas: el mismo hilo da
// los mismos bytes en cada llamada del turno y no rompe la caché.
const MARCA_SIN_TEXTO = '[el sistema consultó/registró datos]';
const MARCA_INICIO = '[sigue la conversación]';
const MARCA_SIN_RESPUESTA = '[sin respuesta]';

/** Recorta a `tope` caracteres con «…», sin partir un par sustituto (emoji). */
function recortar(texto: string, tope: number): string {
  if (texto.length <= tope) return texto;
  let corte = tope - 1;
  const c = texto.charCodeAt(corte - 1);
  if (c >= 0xd800 && c <= 0xdbff) corte--;
  return `${texto.slice(0, corte).trimEnd()}…`;
}

/**
 * L8 «historial ligero»: los mensajes ANTERIORES al turno, solo como texto.
 *
 * Antes viajaban con sus tool_use (con el input entero), sus tool_result
 * (recortados a 600) y, si se colaba, el pensamiento: de media 4.000
 * caracteres por respuesta del asistente, hasta 46.000. Pasado su turno nada
 * de eso le sirve al modelo — lo que importa ya está en el estado, el dossier,
 * los hechos y el resumen — y se pagaba entero en cada turno. Ahora:
 *
 *   · Se quedan solo los bloques de texto. De las herramientas queda una marca
 *     con su nombre («[usó consultar_dia]»), para que sepa qué se hizo.
 *   · Las filas del usuario que solo llevaban tool_result desaparecen y las
 *     respuestas del asistente que quedan seguidas se juntan en un mensaje:
 *     un turno de herramientas queda en pregunta + respuesta.
 *   · Cada respuesta vieja del asistente, a TOPE_ASISTENTE_VIEJO con «…».
 *   · Alternancia user/assistant estricta y el primero del usuario: si el
 *     primero que queda es del asistente se antepone una marca, si dos del
 *     usuario van seguidos se juntan, y si el último es del usuario (un turno
 *     que no llegó a contestarse) se cierra con una marca. Un mensaje vacío
 *     (un turno que solo pensó) se sustituye por una marca, nunca se manda vacío.
 *
 * Puro y determinista. El bucle de herramientas del turno en curso NO pasa por
 * aquí: se añade después y viaja completo y emparejado.
 */
export function historialLigero(messages: ApiMessage[]): ApiMessage[] {
  const planos: { role: 'user' | 'assistant'; partes: string[] }[] = [];
  for (const m of messages) {
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    const bloques: ContentBlock[] = typeof m.content === 'string'
      ? [{ type: 'text', text: m.content } as ContentBlock]
      : Array.isArray(m.content) ? m.content : [];
    const textos = bloques
      .filter((b) => b.type === 'text' && typeof b.text === 'string' && b.text.trim())
      .map((b) => (b.text as string).trim());
    const usadas = role === 'assistant'
      ? [...new Set(bloques.filter((b) => b.type === 'tool_use' && b.name).map((b) => String(b.name).slice(0, 40)))]
      : [];
    if (usadas.length) textos.push(`[usó ${usadas.join(', ')}]`);
    // Una fila del usuario sin texto es un tool_result: su tool_use ya no viaja.
    if (!textos.length && role === 'user') continue;
    const previo = planos[planos.length - 1];
    if (previo && previo.role === role) previo.partes.push(...textos);
    else planos.push({ role, partes: textos });
  }
  if (planos.length && planos[0].role !== 'user') planos.unshift({ role: 'user', partes: [MARCA_INICIO] });
  if (planos.length && planos[planos.length - 1].role === 'user') planos.push({ role: 'assistant', partes: [MARCA_SIN_RESPUESTA] });
  return planos.map(({ role, partes }) => {
    let texto = partes.join('\n\n') || MARCA_SIN_TEXTO;
    if (role === 'assistant') texto = recortar(texto, TOPE_ASISTENTE_VIEJO);
    return { role, content: [{ type: 'text', text: texto }] as ContentBlock[] };
  });
}

/**
 * Marca el final del historial como punto de caché.
 *
 * El prefijo (herramientas + sistema fijo, y luego dossier + estado) ya se
 * cachea en dos escalones desde el bloque de sistema (prompt.ts), pero la
 * conversación crece turno a turno y volvía a pagarse entera a precio completo
 * en cada llamada: 13.300 tokens de entrada por turno medidos en la primera
 * prueba real. Con este tercer punto (de los 4 que admite la API), todo lo
 * anterior al turno actual se lee a una décima parte. El mensaje nuevo va
 * después, así que el prefijo se mantiene byte a byte estable.
 *
 * Ojo: el historial va recortado a HISTORY_LIMIT filas. Con el hilo lleno, cada
 * turno nuevo desplaza la ventana y cambia su primer mensaje, así que entre
 * turnos esta caché se reescribe igualmente; donde rinde es dentro del bucle
 * de herramientas de un mismo turno (lo resuelve el resumen del hilo, L4).
 */
/**
 * Un error legible para el modelo.
 *
 * Los errores de PostgREST no son instancias de Error: son objetos con
 * message/code/details/hint. Con `String(e)` llegaban al modelo como
 * "[object Object]", que no le dice nada y le impide corregirse solo — que es
 * justo lo que sostiene todo el diseño de herramientas sin validación estricta.
 */
function describirFallo(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object') {
    const o = e as { message?: string; code?: string; details?: string; hint?: string };
    const partes = [o.message, o.details, o.hint].filter(Boolean);
    if (partes.length) return `${partes.join(' · ')}${o.code ? ` [${o.code}]` : ''}`;
    try {
      return JSON.stringify(e).slice(0, 300);
    } catch {
      return 'error desconocido';
    }
  }
  return String(e);
}

/** La zona horaria del perfil (`profiles.timezone`), o null si no se puede leer. */
async function zonaDelPerfil(sb: Db, userId: string): Promise<string | null> {
  try {
    const { data } = await sb.from('profiles').select('timezone').eq('id', userId).maybeSingle();
    const zona = (data as { timezone?: unknown } | null)?.timezone;
    return typeof zona === 'string' && zona ? zona : null;
  } catch {
    return null;
  }
}

function markCacheable(messages: ApiMessage[]): ApiMessage[] {
  if (!messages.length) return messages;
  const out = messages.slice();
  const last = out[out.length - 1];
  if (!Array.isArray(last.content) || !last.content.length) return out;

  // El punto de caché NO puede ir en un bloque de pensamiento: la API responde
  // 400 "thinking.cache_control: Extra inputs are not permitted" y el turno
  // entero se pierde. Pasaba de forma intermitente —solo cuando el último
  // mensaje del historial era un turno que se quedó pensando— y desde la app se
  // veía como que el sistema no contesta.
  let idx = -1;
  for (let i = last.content.length - 1; i >= 0; i--) {
    const t = last.content[i]?.type;
    if (t !== 'thinking' && t !== 'redacted_thinking') {
      idx = i;
      break;
    }
  }
  if (idx === -1) return out;

  const blocks = last.content.map((b, i) =>
    i === idx ? { ...b, cache_control: { type: 'ephemeral' } } : b,
  );
  out[out.length - 1] = { ...last, content: blocks as ContentBlock[] };
  return out;
}

interface RunArgs {
  sb: Db;
  admin: Db;
  userId: string;
  kind: Kind;
  threadId: string;
  userText: string;
  today: string;
  imagenes?: { media_type: string; data: string }[];
  /** Freno de coste del turno, en microdólares (ya acotado por el bolsillo). */
  topeMicro: number;
  /** Lo gastado, sumado al momento: lo lee la contabilidad aunque el turno falle. */
  gasto: Gasto;
  /** Instante (ms) a partir del cual ninguna llamada al proveedor sigue viva. */
  deadline: number;
  /** Modelo elegido por el plan y, si no es de Claude, la API compatible. */
  modelo: string;
  compat: { baseUrl: string; apiKey: string } | null;
  modo: Modo;
  emit: (event: string, data: unknown) => void;
  /** Telemetría del turno (0047), rellenada al momento: la lee finish aunque el turno falle. */
  telemetria: Telemetria;
  /** 'registro' = ruta estrecha (L3); 'completa' = el coach con todo. */
  ruta: Ruta;
  /** Reintento tras un rechazo de la ruta estrecha: el mensaje ya está guardado. */
  usuarioYaGuardado?: boolean;
}

/** ¿El proveedor rechazó la petición (4xx)? Es lo único que justifica reintentar por la completa. */
export function rechazoDelProveedor(e: unknown): boolean {
  const texto = e instanceof Error ? e.message : String(e);
  return /(?:anthropic|proveedor) 4\d\d/.test(texto);
}

/**
 * TTL del punto de caché fijo (ver OpcionesSistema en prompt.ts). Apagado por
 * defecto: con el tráfico medido el 2026-10-02 la escritura a 2× no compensa.
 */
function ttlFijoDeEnv(): '1h' | undefined {
  return Deno.env.get('COACH_CACHE_TTL_FIJO')?.trim() === '1h' ? '1h' : undefined;
}

interface ResultadoTurno {
  text: string;
  usage: Usage;
  model: string;
  /** L4: el hilo ya acumula MIN_NUEVOS mensajes sin resumir; se compacta tras 'done'. */
  pideResumen?: boolean;
}

async function runCoach(args: RunArgs): Promise<ResultadoTurno> {
  const { sb, admin, userId, kind, threadId, userText, today, imagenes, topeMicro, modelo, compat, modo, emit, gasto, deadline, telemetria, ruta, usuarioYaGuardado } =
    args;

  // La ruta estrecha cambia TRES cosas y nada más: el estado (mínimo), el
  // sistema (voz corta) y las herramientas (pack fijo). El candado, el
  // consentimiento, la persistencia del hilo y la comprobación del servidor
  // son los mismos que en la ruta completa.
  const estrecha = ruta === 'registro';
  // L4: en la ruta completa, el resumen del hilo sustituye a los mensajes
  // anteriores a summary_until (viaja como DATO en el sistema; ver prompt.ts).
  const [ctx, hilo] = await Promise.all([
    estrecha ? buildContextMinimo(sb, userId, today) : buildContext(sb, userId, today),
    estrecha ? Promise.resolve({ summary: null, summary_until: null }) : leerResumen(sb, threadId),
  ]);
  const system = estrecha
    ? buildSystemRegistro(ctx.text)
    : buildSystem(ctx.dossier, kind, ctx.text, { ttlFijo: ttlFijoDeEnv(), resumenHilo: hilo.summary });
  const herramientas: readonly unknown[] = estrecha ? TOOL_DEFS_REGISTRO : TOOL_DEFS;
  const maxVueltas = estrecha ? MAX_TOOL_ITERATIONS_REGISTRO : MAX_TOOL_ITERATIONS;
  telemetria.state_chars = ctx.text.length;
  telemetria.tools_offered = herramientas.length;
  const control = controlHerramientas(kind, ctx.dossier);

  // Descendente y luego la vuelta: pidiendo ascendente con LIMIT se traen los
  // mensajes MÁS VIEJOS del hilo, así que a partir del mensaje 40 el coach se
  // quedaba anclado en el principio de la conversación y dejaba de ver lo
  // último que le habías dicho. La memoria larga vive en el dossier y en los
  // hechos; el hilo solo aporta lo reciente.
  let consulta = sb
    .from('coach_messages')
    .select('role, content, created_at')
    .eq('thread_id', threadId);
  // Lo ya resumido no se reenvía: el resumen ocupa su lugar.
  if (hilo.summary_until) consulta = consulta.gt('created_at', hilo.summary_until);
  const { data: rows } = await consulta
    .order('created_at', { ascending: false })
    // En la estrecha se piden algunas filas de más: las de herramientas no
    // tienen texto y se descartan. En la completa se lee hasta el tope sin
    // resumen: así se sabe si el resumen va atrasado.
    .limit(estrecha ? HISTORY_LIMIT_REGISTRO * 2 : HISTORY_LIMIT_SIN_RESUMEN);

  let sinResumir = ((rows ?? []) as any[]).filter(
    (r) => !hilo.summary_until || typeof r.created_at !== 'string' || r.created_at > hilo.summary_until,
  );
  // Reintento por la completa tras un rechazo de la estrecha: el mensaje de
  // este turno ya está en la tabla y va a ir otra vez abajo. No se duplica.
  if (usuarioYaGuardado && sinResumir[0]?.role === 'user') sinResumir = sinResumir.slice(1);
  // L4/L8: ¿toca compactar? Se decide con lo que YA se ha leído (sin otra
  // consulta): lo sin resumir más las filas que añade este turno. Solo en la
  // ruta completa (resumirHilo vuelve a contar y no gasta si no llega).
  const pideResumen = !estrecha && sinResumir.length + FILAS_POR_TURNO >= MIN_NUEVOS;
  // L8: con resumen al día, la ventana corta (en régimen normal todo lo sin
  // resumir cabe en ella). Sin resumen o con el resumen atrasado, el tope de
  // antes: lo que no está resumido no se tira mientras quepa en él.
  const ventana = hilo.summary && sinResumir.length <= HISTORY_LIMIT ? HISTORY_LIMIT : HISTORY_LIMIT_SIN_RESUMEN;

  const history: ApiMessage[] = sinResumir
    .slice(0, estrecha ? sinResumir.length : ventana)
    .reverse()
    .map((r) => ({ role: r.role, content: r.content }));

  // El estado se reconstruye en cada llamada (así nunca ve datos caducados)
  // pero viaja en el bloque de sistema, no aquí: ver la explicación de coste
  // en buildSystem. El turno del usuario lleva solo lo que él ha dicho.
  // Se calcula UNA vez por turno: todas las vueltas del bucle llevan los
  // mismos bytes delante (la caché del historial se lee dentro del turno).
  const previos = estrecha
    ? historialDeTexto(history, HISTORY_LIMIT_REGISTRO)
    : markCacheable(historialLigero(history));

  // Las fotos van DELANTE del texto: el modelo lee mejor una imagen cuando la
  // pregunta viene después de verla, no antes.
  const bloquesUsuario: ContentBlock[] = [
    ...(imagenes ?? []).map((img) => ({
      type: 'image',
      source: { type: 'base64', media_type: img.media_type, data: img.data },
    })),
    { type: 'text', text: userText },
  ] as ContentBlock[];

  // «Te he subido el gym»: si afirma haber hecho o registrado algo, el servidor
  // mira antes de que conteste el modelo y le pega lo que consta (la misma
  // lectura que consultar_dia). Va en el mensaje de ESTE turno, después del
  // punto de caché, y no se guarda en el hilo. Si la lectura falla, el turno
  // sigue sin ella: el modelo aún tiene consultar_dia.
  const afirma = kind === 'chat' && pareceAfirmacion(userText);
  // En la ruta de registro sin afirmación es un dato suelto («peso 94,2»).
  telemetria.intent = kind === 'chat' ? (afirma ? 'afirmacion' : estrecha ? 'dato' : 'general') : null;
  if (afirma) {
    try {
      const comprobacion = await bloqueComprobacion(sb, userId, today);
      bloquesUsuario.push({
        type: 'text',
        text: `${DATOS_ABRE}\n${neutralizarDatos(comprobacion)}\n${DATOS_CIERRA}`,
      } as ContentBlock);
    } catch (e) {
      console.warn('comprobación del sistema no disponible:', describirFallo(e));
    }
  }

  const messages: ApiMessage[] = [...previos, { role: 'user', content: bloquesUsuario }];

  // Solo se persiste lo que dijo él, sin el volcado de estado. Y de las fotos
  // solo la marca, nunca los bytes: guardar base64 en el historial lo haría
  // crecer megabytes y se reenviaría entero en cada turno siguiente.
  if (!usuarioYaGuardado) await sb.from('coach_messages').insert({
    thread_id: threadId,
    user_id: userId,
    role: 'user',
    content: [
      {
        type: 'text',
        text: imagenes?.length ? `[te envía ${imagenes.length} foto(s)]
${userText}` : userText,
      },
    ],
  });

  let finalText = '';
  const elegido = modelo;
  // El profundo piensa a fondo y con más sitio para escribir; el estándar,
  // lo de cada kind.
  const esfuerzo: Effort = estrecha ? 'low' : modo === 'profundo' ? 'xhigh' : EFFORT_BY_KIND[kind];
  const techo = estrecha
    ? MAX_TOKENS_REGISTRO
    : modo === 'profundo'
      ? Math.max(MAX_TOKENS_PROFUNDO, MAX_TOKENS_BY_KIND[kind])
      : MAX_TOKENS_BY_KIND[kind];
  // Arranca en el elegido, pero lo que se apunta en la contabilidad es el que
  // devuelve la API: con el mecanismo de reserva puede resolver en otro.
  let model = elegido;

  const arranque = Date.now();

  for (let i = 0; i < maxVueltas; i++) {
    // Si ya no queda reloj, se corta el encadenado: con lo que hay se contesta,
    // y sin él la función muere sin dejar nada. En la ruta estrecha, la última
    // vuelta también va a texto: tres vueltas y siempre hay respuesta.
    const sinTiempo = Date.now() - arranque > PRESUPUESTO_MS || (estrecha && i === maxVueltas - 1);
    const pedirTurno = async (maxTokens: number, effort: Effort) => {
      // La última vuelta debe responder con lo ya calculado, no gastar el
      // margen restante en otra deliberación profunda sin herramientas.
      const tokensDeSalida = sinTiempo ? Math.min(maxTokens, 8000) : maxTokens;
      const esfuerzoDeSalida: Effort = sinTiempo ? 'low' : effort;
      // Un turno puede encadenar varias llamadas y reintentos. La aceptación
      // de su inicio no autoriza llamadas nuevas después de una retirada.
      if ((await consentimientoIa(admin, userId)) !== true || (await healthConsent(sb, userId)) !== true) return null;
      const restante = deadline - Date.now();
      if (restante < 5_000) throw new Error('plazo del turno agotado');
      const signal = AbortSignal.timeout(restante);
      let buffered = '';
      // El gasto se apunta DENTRO de la operación, en cuanto el proveedor
      // responde (o falla a medias): las comprobaciones de consentimiento que
      // vienen después pueden cortar el turno, pero lo cobrado ya no se borra.
      const llamar = async (): Promise<Turn> => {
        telemetria.iterations = (telemetria.iterations ?? 0) + 1;
        try {
          const t = await (compat
            ? callOpenAICompat({
                baseUrl: compat.baseUrl,
                apiKey: compat.apiKey,
                model: elegido,
                system,
                messages,
                // Sin tiempo: las MISMAS herramientas con tool_choice 'none'.
                // Quitarlas cambiaba el prefijo (toda la caché a reescribir) y,
                // con tool_use en el historial, la API respondía 400.
                tools: [...herramientas],
                ...(sinTiempo ? { toolChoice: 'none' as const } : {}),
                maxTokens: tokensDeSalida,
                signal,
                onText: (d) => { buffered += d; },
              })
            : callClaude({
                model: elegido,
                system,
                messages,
                tools: [...herramientas],
                ...(sinTiempo ? { toolChoice: { type: 'none' as const } } : {}),
                maxTokens: tokensDeSalida,
                effort: esfuerzoDeSalida,
                signal,
                onText: (d) => { buffered += d; },
                onThinking: () => emit('thinking', {}),
              }));
          gasto.sumar(t.usage, t.model);
          return t;
        } catch (e) {
          if (e instanceof LlamadaFallida) gasto.sumar(e.usage, e.model);
          throw e;
        }
      };
      const turn = await healthGuardedResult(sb, userId, llamar);
      if (await consentimientoIa(admin, userId) !== true) return null;
      if (buffered) emit('text', { delta: buffered });
      return turn;
    };

    let turn = await pedirTurno(techo, esfuerzo);
    if (!turn) {
      finalText = 'El coach se ha detenido porque no puede confirmar tu consentimiento. Revísalo en Perfil antes de continuar.';
      emit('text', { delta: finalText });
      break;
    }

    // Un turno que SOLO ha pensado esta perdido: ni texto ni herramienta.
    //
    // Pasa porque el pensamiento cuenta DENTRO de max_tokens y puede comerse
    // el techo entero antes de llegar a responder. Se ha cobrado ya dos
    // victimas: el chat, que devolvia respuestas vacias, y el brief, que dejo
    // de escribir el plan del dia tres dias seguidos sin dar ni un error.
    //
    // Ajustar los techos hace que sea raro; esta guarda hace que no importe.
    // Se repite una vez con el doble de sitio y sin apenas pensar, para que la
    // respuesta quepa con seguridad. Y el turno muerto NO se guarda: un
    // mensaje que solo tiene pensamiento envenena el historial de los turnos
    // siguientes (de ahi salio el 400 de thinking.cache_control).
    const util = (t: NonNullable<typeof turn>) =>
      t.content.some((b) => b.type === 'text' || b.type === 'tool_use');
    if (!util(turn)) {
      const retry = await pedirTurno(techo * 2, 'low');
      if (!retry) {
        finalText = 'El coach se ha detenido porque no puede confirmar tu consentimiento. Revísalo en Perfil antes de continuar.';
        emit('text', { delta: finalText });
        break;
      }
      turn = retry;
    }

    model = turn.model;
    if (!util(turn)) {
      // Dos intentos y nada. Mejor decirlo que dejar la pantalla en blanco.
      finalText ||= 'El sistema se ha quedado sin sitio para responder. Vuelve a preguntar.';
      break;
    }

    await requireHealth(sb, userId);
    messages.push({ role: 'assistant', content: turn.content });
    await sb.from('coach_messages').insert({
      thread_id: threadId,
      user_id: userId,
      role: 'assistant',
      content: turn.content,
    });

    finalText = turn.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')
      .trim() || finalText;

    const toolUses = turn.content.filter((b) => b.type === 'tool_use');
    // Primero se mira si el turno ya ha terminado. El tope de coste solo tiene
    // sentido ANTES de gastar otra iteración: comprobarlo antes de esto hacía
    // que un turno perfectamente acabado emitiera un error falso solo por
    // haber costado más de la cuenta.
    if (turn.stopReason !== 'tool_use' || !toolUses.length) break;

    if (gasto.micro() > topeMicro) {
      emit('error', {
        message: 'El sistema ha parado aquí: este turno ya ha costado demasiado.',
      });
      break;
    }

    // Todos los resultados vuelven en UN solo mensaje de usuario: partirlos
    // enseña al modelo a dejar de pedir herramientas en paralelo.
    const results: ContentBlock[] = [];
    telemetria.tool_calls = (telemetria.tool_calls ?? 0) + toolUses.length;
    for (const call of toolUses) {
      let text: string;
      let isError = false;
      try {
        const input = (call.input ?? {}) as Record<string, any>;
        // Cuánto puede hacer el modelo en un turno (ver guard.ts). Un veto
        // vuelve al modelo como error de herramienta, sin ejecutar nada.
        const veto = control.revisar(call.name!, input);
        if (veto) throw new Error(veto);
        // Segunda llave de la ruta estrecha: lo que no está en el pack no se
        // ejecuta, aunque el proveedor lo devuelva sin habérselo ofrecido.
        const ajena = estrecha ? fueraDelPack(call.name!, PACK_REGISTRO) : null;
        if (ajena) throw new Error(ajena);
        text = await executeTool(call.name!, input, {
          sb,
          userId,
          today,
        });
        emit('tool', { name: call.name, ok: true, detail: text.slice(0, 200) });
      } catch (e) {
        text = `Error: ${describirFallo(e)}`;
        isError = true;
        emit('tool', { name: call.name, ok: false, detail: text.slice(0, 200) });
      }
      results.push({
        type: 'tool_result',
        tool_use_id: call.id,
        content: text,
        ...(isError ? { is_error: true } : {}),
      });
    }

    messages.push({ role: 'user', content: results });
    await sb.from('coach_messages').insert({
      thread_id: threadId,
      user_id: userId,
      role: 'user',
      content: results,
    });
  }

  await requireHealth(sb, userId);
  await sb
    .from('coach_threads')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', threadId);

  return { text: finalText, usage: gasto.usage, model: gasto.model || model, pideResumen };
}

export async function handler(req: Request): Promise<Response> {
  const inicio = Date.now();
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido' });

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'No autenticado' });
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return json(401, { error: 'Sesión inválida' });
  const userId = userData.user.id;

  // El consentimiento para la IA (migración 0028), antes que nada más: sin él
  // no se lee el cuerpo, no se toma el cerrojo y no se llama a ningún modelo.
  // Cubre también a los rituales del cron y al atajo de clasificar.
  const consiente = await consentimientoIa(admin, userId);
  if (consiente === null) {
    return json(503, { error: 'El sistema no puede comprobar tu consentimiento ahora mismo. Vuelve a intentarlo.' });
  }
  if (!consiente) {
    return json(403, { error: MENSAJE_SIN_CONSENTIMIENTO, reason: SIN_CONSENTIMIENTO });
  }

  // El candado de gasto (migración 0020). Va ANTES de leer el cuerpo y de
  // cualquier llamada a un modelo: suscripción viva, presupuesto del mes sin
  // agotar y ningún otro turno en marcha. Cubre también a los rituales del
  // cron, que entran por aquí con el JWT del usuario.
  //
  // El modo va en una CABECERA y no en el cuerpo a propósito: la puerta se
  // cruza antes de leer el cuerpo. Solo 'profundo' exacto abre ese bolsillo.
  const modo = modoDeCabecera(req.headers.get('x-nivl-mode'));
  const { data: puerta, error: puertaErr } = await admin.rpc('ai_begin_turn', { p_user: userId, p_mode: modo });
  if (puertaErr) {
    console.error('ai_begin_turn failed:', puertaErr.message);
    // Cerrado por defecto: si no se puede comprobar, no se gasta.
    return json(503, { error: 'El sistema no puede comprobar tu plan ahora mismo. Vuelve a intentarlo.' });
  }
  const estado = puerta as Puerta | null;
  if (!estado || estado.allowed !== true) {
    const MENSAJES: Record<string, [number, string]> = {
      sin_suscripcion: [402, 'El coach es parte de NIVL Pro.'],
      presupuesto_agotado: [402, `Has agotado la IA de este mes. Se renueva el ${estado?.renews ?? 'día 1'}.`],
      turno_en_curso: [429, 'El sistema todavía está respondiendo a tu mensaje anterior.'],
      // Lo que recibe un Pro que pide el modo profundo.
      profundo_no_incluido: [402, 'El modo profundo es parte de NIVL Élite.'],
      profundo_agotado: [402, 'Has usado tus turnos profundos de este mes. El modo estándar sigue disponible.'],
    };
    const [status, error] = MENSAJES[estado?.reason ?? ''] ?? [402, 'Sin acceso a la IA.'];
    return json(status, { error, reason: estado?.reason });
  }

  const soltar = () =>
    admin.rpc('ai_end_turn', { p_user: userId }).then(
      () => {},
      () => {},
    );
  let res: Response;
  try {
    res = await atender(req, userId, token, estado, modo, inicio + PLAZO_DURO_MS);
  } catch (e) {
    await soltar();
    throw e;
  }
  // El cerrojo se suelta cuando la respuesta TERMINA, no cuando empieza: con
  // streaming, el turno sigue gastando mucho después de devolver el Response.
  if (!res.body) {
    await soltar();
    return res;
  }
  const alTerminar = new TransformStream<Uint8Array, Uint8Array>({ flush: soltar });
  return new Response(res.body.pipeThrough(alTerminar), { status: res.status, headers: res.headers });
}

/** Lo que devuelve `ai_begin_turn` (0024). Importes en microdólares. */
interface Puerta {
  allowed: boolean;
  reason?: string;
  remaining?: number;
  renews?: string;
  mode?: Modo;
  /** Lo que queda en el bolsillo del modo de este turno: su techo de gasto. */
  turn_budget?: number;
  routes?: Routes;
}

async function atender(
  req: Request,
  userId: string,
  token: string,
  estado: Puerta,
  modo: Modo,
  deadline: number,
): Promise<Response> {
  // Con la 0024 aplicada llega turn_budget; con la puerta de 0020, remaining.
  const restanteMicro = Number(estado.turn_budget ?? estado.remaining) || 0;
  const routes: Routes = estado.routes && typeof estado.routes === 'object' ? estado.routes : {};

  let body: {
    kind?: string;
    thread_id?: string;
    message?: string;
    date?: string;
    stream?: boolean;
    periodo?: string;
    imagenes?: { media_type: string; data: string }[];
  };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Cuerpo inválido' });
  }

  // Cliente con el JWT del usuario: RLS manda también aquí.
  let sbTemprano = userClient(token);

  // Atajo mecánico. Sale antes de construir el contexto del coach a propósito:
  // enviar 50.000 fichas de dossier y estudios para decidir si un cargo de
  // Mercadona es supermercado es tirar el dinero, y es justo lo que hay que
  // evitar en las tareas que no piden criterio.
  if (body.kind === KIND_MECANICO) {
    try {
      const r = await clasificarPendientes(sbTemprano, admin, userId);
      const { error: ledgerErr } = await insertarRun(admin, {
        user_id: userId,
        kind: KIND_MECANICO,
        mode: modo,
        model: r.model,
        in_tokens: r.usage.input_tokens ?? 0,
        cache_read_tokens: r.usage.cache_read_input_tokens ?? 0,
        cache_write_tokens: r.usage.cache_creation_input_tokens ?? 0,
        out_tokens: r.usage.output_tokens ?? 0,
        cost_micro_usd: costMicroUsd(r.model, r.usage),
      }, { route: 'mecanica', tools_offered: 0, tool_calls: 0, iterations: 1 });
      if (ledgerErr) console.error('coach_runs insert failed:', ledgerErr.message);
      return json(200, { revisados: r.revisados, clasificados: r.clasificados, texto: r.resumen });
    } catch (e) {
      if (e instanceof ClasificacionConsentimientoError) {
        return json(e.status, {
          error: e.message,
          ...(e.status === 403 ? { reason: SIN_CONSENTIMIENTO } : {}),
        });
      }
      console.error('clasificar error:', e);
      return json(500, { error: 'No se pudieron clasificar los movimientos.' });
    }
  }

  // El chat libre y los rituales mezclan salud con otros datos. No se lee el
  // historial ni se envía el mensaje sin el permiso independiente de salud.
  const health = await healthConsent(sbTemprano, userId);
  if (health === null) return json(503, { error: 'No se ha podido comprobar el permiso de salud.' });
  if (!health) return json(403, { error: 'Revisa y activa el permiso de salud en Perfil antes de usar el coach.', reason: HEALTH_REQUIRED });
  const revision = await healthRevision(sbTemprano, userId);
  sbTemprano = healthScopedClient(userClient(token, revision), revision);

  // El resumen tampoco pasa por el contexto del coach: se construye con datos
  // del periodo ya calculados y no necesita el dossier ni los estudios.
  if (body.kind === KIND_RESUMEN) {
    const periodo = body.periodo === 'mensual' ? 'mensual' : 'semanal';
    const hoy = fechaDelTurno(body.date);
    try {
      // El consentimiento de IA lo comprueba el cliente de servicio: la RPC
      // ai_consent_ok solo la puede ejecutar service_role (0028), y con el
      // cliente del usuario la comprobación fallaba siempre (resumen roto).
      const r = await construirResumen(sbTemprano, userId, periodo, hoy, admin);
      if (!r.slides.length) return json(200, { slides: [], fotos: 0, motivo: r.motivo });

      const { desde, hasta } = periodo === 'semanal' ? periodoSemanal(hoy) : periodoMensual(hoy);
      const { data: guardado, error } = await sbTemprano
        .from('recaps')
        .upsert(
          {
            user_id: userId,
            kind: periodo,
            period_start: desde,
            period_end: hasta,
            slides: r.slides,
            photo_count: r.fotos,
          },
          { onConflict: 'user_id,kind,period_start' },
        )
        .select('id')
        .single();
      if (error) throw error;

      await insertarRun(admin, {
        user_id: userId,
        kind: `resumen_${periodo}`,
        mode: modo,
        model: r.model,
        in_tokens: r.usage.input_tokens ?? 0,
        cache_read_tokens: r.usage.cache_read_input_tokens ?? 0,
        cache_write_tokens: r.usage.cache_creation_input_tokens ?? 0,
        out_tokens: r.usage.output_tokens ?? 0,
        cost_micro_usd: costMicroUsd(r.model, r.usage),
      }, { route: 'mecanica', tools_offered: 0, tool_calls: 0, iterations: 1 });

      return json(200, { id: (guardado as { id: string }).id, slides: r.slides, fotos: r.fotos });
    } catch (e) {
      console.error('resumen error:', e);
      return json(500, { error: 'No se pudo construir el resumen.' });
    }
  }

  const kind = (body.kind ?? 'chat') as Kind;
  if (!KINDS.includes(kind)) return json(400, { error: `kind inválido: ${kind}` });

  const userText = String(body.message ?? '').slice(0, 8000).trim();
  if (kind === 'chat' && !userText) return json(400, { error: 'Mensaje vacío' });

  const fotos = validarImagenes(body.imagenes);
  if (!fotos.ok) return json(400, { error: fotos.motivo });

  // RLS manda también dentro de las herramientas: se reutiliza el cliente del
  // usuario creado arriba. El cliente admin solo valida el token.
  const sb = sbTemprano;

  // El "hoy" lo manda el móvil; la app 1.0.7 no lo manda, y entonces manda la
  // zona de su perfil, no el día UTC (ver fechaDelTurno).
  const ahora = reloj.ahora();
  const today = fechaAceptable(body.date, ahora) ?? fechaDelTurno(null, ahora, await zonaDelPerfil(sb, userId));

  // Un hilo continuo por defecto: el coach lleva años de conversación, no
  // sesiones sueltas.
  let threadId = typeof body.thread_id === 'string' && body.thread_id ? body.thread_id : undefined;
  if (threadId) {
    // Un hilo ajeno o inventado no se usa: RLS ya impedía leerlo o escribir
    // en él, pero el turno seguía, se pagaba y no se guardaba nada.
    const { data: suyo } = await sb
      .from('coach_threads')
      .select('id')
      .eq('id', threadId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!suyo) return json(404, { error: 'Hilo no encontrado.' });
  } else {
    const { data: existing } = await sb
      .from('coach_threads')
      .select('id')
      .eq('user_id', userId)
      .eq('archived', false)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      threadId = (existing as any).id;
    } else {
      const { data: created, error } = await sb
        .from('coach_threads')
        .insert({ user_id: userId, title: 'El sistema' })
        .select('id')
        .single();
      if (error) return json(500, { error: 'No se pudo abrir el hilo del coach.' });
      threadId = (created as any).id;
    }
  }

  const prompt = userText || `[ritual: ${kind}]`;
  const wantsStream = body.stream !== false;

  // La "revisión semanal profunda" del Élite no es un modo: sale de sus routes
  // (Sonnet, y revision_semanal ya piensa en 'xhigh'), cuenta en el bolsillo
  // estándar y no gasta turnos profundos del usuario.
  //
  // Ruta del turno (L3). Un parte claro va por la estrecha; con fotos o en
  // modo profundo (lo pidió y lo paga de su bolsillo profundo), por la
  // completa: el profundo no aplica a la ruta de registro.
  const ruta: Ruta = !fotos.imagenes.length && modo !== 'profundo' ? rutaDelTurno(userText, kind) : 'completa';
  const { model: modelo, compat } = ruta === 'registro' ? resolverModeloRegistro(routes) : resolverModelo(routes, kind, modo);
  // Las fotos nunca salen a un proveedor sin visión acordada (solo Claude).
  const sinVision = fotosSinVision(fotos.imagenes.length, compat);
  if (sinVision) return json(400, { error: sinVision });
  const topeMicro = Math.min(
    ruta === 'registro' ? MAX_COST_REGISTRO_MICRO_USD : modo === 'profundo' ? MAX_COST_PROFUNDO_MICRO_USD : MAX_COST_MICRO_USD,
    restanteMicro,
  );
  // Lo gastado en este turno, sumado según se cobra (ver Gasto en guard.ts).
  const gasto = new Gasto(modelo);
  const telemetria: Telemetria = { route: ruta, tool_calls: 0, iterations: 0 };

  // Si el proveedor RECHAZA la ruta estrecha (4xx: parámetros que un modelo no
  // admite, nombre de modelo mal puesto en routes.registro…), el turno se
  // atiende por la completa en vez de devolver un error al usuario. El mensaje
  // ya quedó guardado en el primer intento; lo gastado se sigue sumando.
  const ejecutarTurno = async (emitir: (event: string, data: unknown) => void) => {
    const base = {
      sb, admin, userId, kind, threadId: threadId!, userText: prompt, today,
      imagenes: fotos.imagenes, gasto, deadline, modo, emit: emitir, telemetria,
    };
    try {
      return await runCoach({ ...base, topeMicro, modelo, compat, ruta });
    } catch (e) {
      if (ruta !== 'registro' || !rechazoDelProveedor(e)) throw e;
      console.warn('ruta de registro rechazada por el proveedor: se reintenta por la completa');
      const completa = resolverModelo(routes, kind, modo);
      telemetria.route = 'registro_reintento';
      return await runCoach({
        ...base,
        topeMicro: Math.max(0, Math.min(MAX_COST_MICRO_USD, restanteMicro) - gasto.micro()),
        modelo: completa.model,
        compat: completa.compat,
        ruta: 'completa',
        usuarioYaGuardado: true,
      });
    }
  };

  // El libro de cuentas lo escribe el SERVIDOR, no el usuario: coach_runs solo
  // tiene política de lectura, así que con el cliente del usuario la inserción
  // la bloquearía RLS en silencio y el coste no quedaría registrado.
  //
  // Se apunta SIEMPRE lo que de verdad se gastó (`gasto`), también si el turno
  // falla: antes un turno fallido se apuntaba a 0 y el candado no lo veía.
  const finish = async (
    _result: { text: string; usage: Usage; model: string } | null,
    error: string | null,
  ) => {
    const u: Usage = gasto.usage;
    const { error: ledgerErr } = await insertarRun(admin, {
      user_id: userId,
      kind,
      mode: modo,
      model: gasto.model || modelo,
      in_tokens: u.input_tokens ?? 0,
      cache_read_tokens: u.cache_read_input_tokens ?? 0,
      cache_write_tokens: u.cache_creation_input_tokens ?? 0,
      out_tokens: u.output_tokens ?? 0,
      cost_micro_usd: gasto.micro(),
      error: error ? 'turn_failed' : null,
    }, telemetria);
    // Que falle la contabilidad no debe tumbar el turno, pero tampoco puede
    // desaparecer sin dejar rastro: sin esto, el coste se pierde en silencio.
    if (ledgerErr) console.error('coach_runs insert failed:', ledgerErr.message);
  };

  // L4: el resumen del hilo, DESPUÉS de contestar y sin esperarlo. Lo que
  // queda de bolsillo tras el turno es su techo (resumenhilo.ts no gasta si no
  // llega al mínimo); su coste se apunta aparte como 'resumen_hilo'.
  const programarResumen = (result: ResultadoTurno) => {
    if (!result.pideResumen) return;
    enSegundoPlano(resumirHilo({
      sb, admin, userId, threadId: threadId!, presupuestoMicro: restanteMicro - gasto.micro(), modo,
    }));
  };

  const describe = (e: unknown): string => {
    if (e instanceof RefusalError) return 'El sistema no puede responder a eso.';
    if (e instanceof Error && e.message === HEALTH_REQUIRED) return 'El permiso de salud ya no está activo. Revisa Perfil antes de continuar.';
    // El detalle (saldo de la cuenta del dueño, cuerpo del proveedor, código)
    // va al log del servidor, que es donde se arregla; al usuario, un mensaje
    // genérico. Antes se le pedía que recargara la cuenta de Anthropic del
    // dueño y se le enseñaba el código de la API.
    const texto = e instanceof Error ? e.message : String(e);
    const codigo = /(?:anthropic|proveedor) (\d{3})/.exec(texto)?.[1];
    const saldo = /credit balance is too low|insufficient.quota|billing/i.test(texto);
    console.error(`coach turn failed${codigo ? ` (${codigo})` : ''}${saldo ? ' [SIN SALDO EN EL PROVEEDOR]' : ''}`);
    return mensajeDeFallo(texto);
  };

  if (!wantsStream) {
    try {
      const result = await ejecutarTurno(() => {});
      await requireHealth(sb, userId);
      await finish(result, null);
      programarResumen(result);
      return json(200, { thread_id: threadId, text: result.text });
    } catch (e) {
      const message = describe(e);
      await finish(null, message);
      return json(502, { error: message });
    }
  }

  const encoder = new TextEncoder();
  // Compartida entre start() y cancel(): el objeto permite que cancel la mute.
  const vivoGlobal = { valor: true };
  const stream = new ReadableStream({
    async start(controller) {
      // Si el móvil se va (bloqueas la pantalla, cambias de app, se cae la
      // cobertura), el canal se cierra y cada enqueue lanza. Sin esta guarda esa
      // excepción tumbaba el turno ENTERO: la respuesta no se guardaba, no
      // quedaba registro, y al volver a la app no había nada. Y no tiene
      // sentido, porque el mensaje ya estaba enviado y el trabajo ya estaba
      // pagado.
      //
      // Ahora el turno sigue hasta el final aunque nadie escuche: la respuesta
      // se persiste igual y aparece al reabrir el chat.
      const emit = (event: string, data: unknown) => {
        if (!vivoGlobal.valor) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          vivoGlobal.valor = false;
        }
      };
      emit('start', { thread_id: threadId });
      try {
        const result = await ejecutarTurno(emit);
        await requireHealth(sb, userId);
        await finish(result, null);
        emit('done', {
          thread_id: threadId,
          text: result.text,
          cost_micro_usd: gasto.micro(),
        });
        programarResumen(result);
      } catch (e) {
        const message = describe(e);
        await finish(null, message);
        emit('error', { message });
      } finally {
        try {
          controller.close();
        } catch {
          /* ya estaba cerrado porque el cliente se fue: no es un error. */
        }
      }
    },

    // El cliente se ha ido. NO se aborta nada: el turno termina y se guarda.
    cancel() {
      vivoGlobal.valor = false;
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    },
  });
}
