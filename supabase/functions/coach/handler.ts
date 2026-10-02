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
import { buildContext } from '../_shared/context.ts';
import { consentimientoIa, MENSAJE_SIN_CONSENTIMIENTO, SIN_CONSENTIMIENTO } from '../_shared/consent.ts';
import { healthConsent, healthGuardedResult, healthRevision, healthScopedClient, HEALTH_REQUIRED, requireHealth } from '../_shared/health.ts';
import { adminClient, userClient, type Db } from '../_shared/db.ts';
import { buildSystem, DATOS_ABRE, DATOS_CIERRA, neutralizarDatos } from '../_shared/prompt.ts';
import { elegirModelo, modoDeCabecera, proveedorDe, type Modo, type Routes } from '../_shared/routing.ts';
import { executeTool, TOOL_DEFS } from '../_shared/tools.ts';
import { controlHerramientas, fechaAceptable, fechaDelTurno, Gasto, mensajeDeFallo, reloj, validarImagenes } from './guard.ts';
import { pareceAfirmacion } from '../_shared/intencion.ts';
import { bloqueComprobacion } from '../_shared/comprobacion.ts';

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
// Doce intercambios. El hilo es continuo de cara a ti, pero lo que se reenvía
// a la API tiene tope: la memoria larga vive en el dossier y en coach_facts,
// no en el transcript. Sin tope, la conversación crece sin fin y a los seis
// meses cada turno arrastra cientos de miles de tokens, primero caros y luego
// imposibles. Si algo de un turno viejo importa, el coach lo anota como hecho.
const HISTORY_LIMIT = 12;
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

/**
 * Recorta el historial sin partir un turno por la mitad. Si la primera
 * entrada fuese un tool_result huérfano (o un turno del asistente), la API
 * rechaza la petición: hay que empezar siempre en un mensaje de usuario que
 * sea texto de verdad.
 */
function trimHistory(messages: ApiMessage[]): ApiMessage[] {
  let out = messages.slice(-HISTORY_LIMIT);
  while (out.length) {
    const first = out[0];
    const blocks = Array.isArray(first.content) ? first.content : [];
    const isToolResult = blocks.some((b) => b.type === 'tool_result');
    if (first.role === 'user' && !isToolResult) break;
    out = out.slice(1);
  }
  return out;
}

/**
 * Aligera el historial antes de reenviarlo.
 *
 * Dos cosas engordan un hilo viejo hasta hacerlo caro: los bloques de
 * pensamiento y los resultados de herramienta, que pueden llegar a 12.000
 * caracteres cada uno. Ninguno de los dos aporta nada pasado su turno — lo que
 * hay que recordar ya está en el dossier y en los hechos — pero se pagan
 * enteros en cada llamada. Medido: 74.000 tokens de historia por turno.
 *
 * El pensamiento solo es obligatorio dentro del turno que se está resolviendo,
 * y ese turno todavía no está en la tabla cuando se lee esto. Si al quitarlo un
 * mensaje se quedara sin contenido, se deja intacto: la API rechaza los
 * mensajes vacíos, y un tool_use sin su tool_result detrás también.
 */
function aligerarHistorial(messages: ApiMessage[]): ApiMessage[] {
  const TOPE_RESULTADO = 600;
  return messages.map((m) => {
    if (!Array.isArray(m.content)) return m;
    const blocks = m.content
      .filter((b) => b.type !== 'thinking' && b.type !== 'redacted_thinking')
      .map((b) => {
        if (b.type !== 'tool_result') return b;
        const c = (b as { content?: unknown }).content;
        if (typeof c !== 'string' || c.length <= TOPE_RESULTADO) return b;
        return { ...b, content: `${c.slice(0, TOPE_RESULTADO)}\n[…recortado]` };
      });
    return { ...m, content: blocks as ContentBlock[] };
  })
  // Un mensaje que se queda SIN bloques al quitarle el pensamiento era un turno
  // que solo pensó y no llegó a decir ni a hacer nada — lo que pasaba cuando el
  // turno se cortaba a mitad. No aporta nada al siguiente y la API rechaza los
  // mensajes vacíos, así que desaparece. Antes se devolvía el original CON su
  // pensamiento, y eso es lo que reventaba la petición más abajo.
  .filter((m) => !Array.isArray(m.content) || m.content.length > 0);
}

/**
 * Marca el final del historial como punto de caché.
 *
 * El prefijo (voz + dossier + herramientas) ya se cachea desde el bloque de
 * sistema, pero la conversación crece turno a turno y volvía a pagarse entera
 * a precio completo en cada llamada: 13.300 tokens de entrada por turno medidos
 * en la primera prueba real. Con este segundo punto, todo lo anterior al turno
 * actual se lee a una décima parte. El estado fresco y el mensaje nuevo van
 * después, así que el prefijo se mantiene byte a byte estable.
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
}

async function runCoach(args: RunArgs): Promise<{ text: string; usage: Usage; model: string }> {
  const { sb, admin, userId, kind, threadId, userText, today, imagenes, topeMicro, modelo, compat, modo, emit, gasto, deadline } =
    args;

  const ctx = await buildContext(sb, userId, today);
  const system = buildSystem(ctx.dossier, kind, ctx.text);
  const control = controlHerramientas(kind, ctx.dossier);

  // Descendente y luego la vuelta: pidiendo ascendente con LIMIT se traen los
  // mensajes MÁS VIEJOS del hilo, así que a partir del mensaje 40 el coach se
  // quedaba anclado en el principio de la conversación y dejaba de ver lo
  // último que le habías dicho. La memoria larga vive en el dossier y en los
  // hechos; el hilo solo aporta lo reciente.
  const { data: rows } = await sb
    .from('coach_messages')
    .select('role, content')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  const history: ApiMessage[] = ((rows ?? []) as any[])
    .reverse()
    .map((r) => ({ role: r.role, content: r.content }));

  // El estado se reconstruye en cada llamada (así nunca ve datos caducados)
  // pero viaja en el bloque de sistema, no aquí: ver la explicación de coste
  // en buildSystem. El turno del usuario lleva solo lo que él ha dicho.
  const previos = markCacheable(aligerarHistorial(trimHistory(history)));

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
  if (kind === 'chat' && pareceAfirmacion(userText)) {
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
  await sb.from('coach_messages').insert({
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
  const esfuerzo: Effort = modo === 'profundo' ? 'xhigh' : EFFORT_BY_KIND[kind];
  const techo =
    modo === 'profundo' ? Math.max(MAX_TOKENS_PROFUNDO, MAX_TOKENS_BY_KIND[kind]) : MAX_TOKENS_BY_KIND[kind];
  // Arranca en el elegido, pero lo que se apunta en la contabilidad es el que
  // devuelve la API: con el mecanismo de reserva puede resolver en otro.
  let model = elegido;

  const arranque = Date.now();

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    // Si ya no queda reloj, se corta el encadenado: con lo que hay se contesta,
    // y sin él la función muere sin dejar nada.
    const sinTiempo = Date.now() - arranque > PRESUPUESTO_MS;
    const pedirTurno = async (maxTokens: number, effort: Effort) => {
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
        try {
          const t = await (compat
            ? callOpenAICompat({
                baseUrl: compat.baseUrl,
                apiKey: compat.apiKey,
                model: elegido,
                system,
                messages,
                tools: sinTiempo ? undefined : TOOL_DEFS,
                maxTokens,
                signal,
                onText: (d) => { buffered += d; },
              })
            : callClaude({
                model: elegido,
                system,
                messages,
                tools: sinTiempo ? undefined : TOOL_DEFS,
                maxTokens,
                effort,
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
    for (const call of toolUses) {
      let text: string;
      let isError = false;
      try {
        const input = (call.input ?? {}) as Record<string, any>;
        // Cuánto puede hacer el modelo en un turno (ver guard.ts). Un veto
        // vuelve al modelo como error de herramienta, sin ejecutar nada.
        const veto = control.revisar(call.name!, input);
        if (veto) throw new Error(veto);
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

  return { text: finalText, usage: gasto.usage, model: gasto.model || model };
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
      const { error: ledgerErr } = await admin.from('coach_runs').insert({
        user_id: userId,
        kind: KIND_MECANICO,
        mode: modo,
        model: r.model,
        in_tokens: r.usage.input_tokens ?? 0,
        cache_read_tokens: r.usage.cache_read_input_tokens ?? 0,
        cache_write_tokens: r.usage.cache_creation_input_tokens ?? 0,
        out_tokens: r.usage.output_tokens ?? 0,
        cost_micro_usd: costMicroUsd(r.model, r.usage),
      });
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

      await admin.from('coach_runs').insert({
        user_id: userId,
        kind: `resumen_${periodo}`,
        mode: modo,
        model: r.model,
        in_tokens: r.usage.input_tokens ?? 0,
        cache_read_tokens: r.usage.cache_read_input_tokens ?? 0,
        cache_write_tokens: r.usage.cache_creation_input_tokens ?? 0,
        out_tokens: r.usage.output_tokens ?? 0,
        cost_micro_usd: costMicroUsd(r.model, r.usage),
      });

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
  const { model: modelo, compat } = resolverModelo(routes, kind, modo);
  const topeMicro = Math.min(modo === 'profundo' ? MAX_COST_PROFUNDO_MICRO_USD : MAX_COST_MICRO_USD, restanteMicro);
  // Lo gastado en este turno, sumado según se cobra (ver Gasto en guard.ts).
  const gasto = new Gasto(modelo);

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
    const { error: ledgerErr } = await admin.from('coach_runs').insert({
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
    });
    // Que falle la contabilidad no debe tumbar el turno, pero tampoco puede
    // desaparecer sin dejar rastro: sin esto, el coste se pierde en silencio.
    if (ledgerErr) console.error('coach_runs insert failed:', ledgerErr.message);
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
      const result = await runCoach({
        sb,
        admin,
        userId,
        kind,
        threadId: threadId!,
        userText: prompt,
        today,
        imagenes: fotos.imagenes,
        topeMicro,
        gasto,
        deadline,
        modelo,
        compat,
        modo,
        emit: () => {},
      });
      await requireHealth(sb, userId);
      await finish(result, null);
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
        const result = await runCoach({
          sb,
          admin,
          userId,
          kind,
          threadId: threadId!,
          userText: prompt,
          today,
          imagenes: fotos.imagenes,
          topeMicro,
          gasto,
          deadline,
          modelo,
          compat,
          modo,
          emit,
        });
        await requireHealth(sb, userId);
        await finish(result, null);
        emit('done', {
          thread_id: threadId,
          text: result.text,
          cost_micro_usd: gasto.micro(),
        });
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
