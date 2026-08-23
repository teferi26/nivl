// NIVL · Edge Function: EL COACH.
//
// No es un proxy de la API de Claude: es un agente con manos. Lee el estado
// real del cazador, conversa, y escribe en su vida (misiones, plan del día,
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
  addUsage,
  callClaude,
  COACH_MODEL,
  costMicroUsd,
  proveedorCompatible,
  RefusalError,
  type ApiMessage,
  type ContentBlock,
  type Effort,
  type Usage,
} from '../_shared/anthropic.ts';
import { clasificarPendientes } from '../_shared/clasificar.ts';
import { callOpenAICompat } from '../_shared/openai.ts';
import { construirResumen, periodoMensual, periodoSemanal } from '../_shared/recap.ts';
import { buildContext } from '../_shared/context.ts';
import { adminClient, userClient, type Db } from '../_shared/db.ts';
import { buildSystem } from '../_shared/prompt.ts';
import { executeTool, TOOL_DEFS } from '../_shared/tools.ts';

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
 * Modelo por ritual, con dos secretos para cambiarlo sin desplegar:
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
function modeloDe(kind: Kind): string {
  const chat = Deno.env.get('COACH_MODEL_CHAT')?.trim();
  const ritual = Deno.env.get('COACH_MODEL_RITUAL')?.trim();
  const esCharla = kind === 'chat' || kind === 'plan';
  const elegido = esCharla ? chat || ritual : ritual || chat;
  if (elegido) return elegido;

  // Con proveedor externo configurado NO se cae a un modelo de Claude: mandarle
  // "claude-sonnet-5" a DeepSeek devuelve un 400 que no explica nada. Mejor
  // decirlo con todas las letras que dejar el sistema mudo.
  if (proveedorCompatible()) {
    throw new Error(
      'Hay un proveedor externo configurado pero no su modelo. Añade el secret COACH_MODEL_CHAT (por ejemplo deepseek-chat o gemini-2.5-flash).',
    );
  }
  return COACH_MODEL;
}

// Los rituales que deciden el rumbo piensan más que una charla suelta.
//
// El chat baja a 'medium' por una razón medida: con 'high' un turno generaba
// entre 2.000 y 11.000 fichas de pensamiento, y generar es la parte lenta
// (decenas de fichas por segundo). Un "¿cómo voy?" no necesita once mil fichas
// de deliberación, necesita responder antes de que sueltes el móvil.
const EFFORT_BY_KIND: Record<Kind, Effort> = {
  chat: 'low',
  brief: 'high',
  plan: 'high',
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
  brief: 6000,
  plan: 6000,
  revision_semanal: 10000,
  cierre_mensual: 10000,
  escalada: 4000,
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
  userId: string;
  kind: Kind;
  threadId: string;
  userText: string;
  today: string;
  imagenes?: { media_type: string; data: string }[];
  emit: (event: string, data: unknown) => void;
}

async function runCoach(args: RunArgs): Promise<{ text: string; usage: Usage; model: string }> {
  const { sb, userId, kind, threadId, userText, today, imagenes, emit } = args;

  const ctx = await buildContext(sb, userId, today);
  const system = buildSystem(ctx.dossier, kind, ctx.text);

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

  let usage: Usage = {};
  let finalText = '';
  const elegido = modeloDe(kind);
  // Arranca en el elegido, pero lo que se apunta en la contabilidad es el que
  // devuelve la API: con el mecanismo de reserva puede resolver en otro.
  let model = elegido;

  const arranque = Date.now();

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    // Si ya no queda reloj, se corta el encadenado: con lo que hay se contesta,
    // y sin él la función muere sin dejar nada.
    const sinTiempo = Date.now() - arranque > PRESUPUESTO_MS;
    const compat = proveedorCompatible();
    const turn = compat
      ? await callOpenAICompat({
          baseUrl: compat.baseUrl,
          apiKey: compat.apiKey,
          model: elegido,
          system,
          messages,
          tools: sinTiempo ? undefined : TOOL_DEFS,
          maxTokens: MAX_TOKENS_BY_KIND[kind],
          onText: (d) => emit('text', { delta: d }),
        })
      : await callClaude({
          model: elegido,
          system,
          messages,
          tools: sinTiempo ? undefined : TOOL_DEFS,
          maxTokens: MAX_TOKENS_BY_KIND[kind],
          effort: EFFORT_BY_KIND[kind],
          onText: (d) => emit('text', { delta: d }),
          onThinking: () => emit('thinking', {}),
        });

    usage = addUsage(usage, turn.usage);
    model = turn.model;

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

    if (costMicroUsd(model, usage) > MAX_COST_MICRO_USD) {
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
        text = await executeTool(call.name!, (call.input ?? {}) as Record<string, any>, {
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

  await sb
    .from('coach_threads')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', threadId);

  return { text: finalText, usage, model };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido' });

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'No autenticado' });
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return json(401, { error: 'Sesión inválida' });
  const userId = userData.user.id;

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
  const sbTemprano = userClient(token);

  // Atajo mecánico. Sale antes de construir el contexto del coach a propósito:
  // enviar 50.000 fichas de dossier y estudios para decidir si un cargo de
  // Mercadona es supermercado es tirar el dinero, y es justo lo que hay que
  // evitar en las tareas que no piden criterio.
  if (body.kind === KIND_MECANICO) {
    try {
      const r = await clasificarPendientes(sbTemprano, userId);
      const { error: ledgerErr } = await admin.from('coach_runs').insert({
        user_id: userId,
        kind: KIND_MECANICO,
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
      console.error('clasificar error:', e);
      return json(500, { error: 'No se pudieron clasificar los movimientos.' });
    }
  }

  // El resumen tampoco pasa por el contexto del coach: se construye con datos
  // del periodo ya calculados y no necesita el dossier ni los estudios.
  if (body.kind === KIND_RESUMEN) {
    const periodo = body.periodo === 'mensual' ? 'mensual' : 'semanal';
    const hoy = (body.date ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
    try {
      const r = await construirResumen(sbTemprano, userId, periodo, hoy);
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

  // RLS manda también dentro de las herramientas: se reutiliza el cliente del
  // usuario creado arriba. El cliente admin solo valida el token.
  const sb = sbTemprano;

  const today = (body.date ?? new Date().toISOString().slice(0, 10)).slice(0, 10);

  // Un hilo continuo por defecto: el coach lleva años de conversación, no
  // sesiones sueltas.
  let threadId = body.thread_id;
  if (!threadId) {
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

  // El libro de cuentas lo escribe el SERVIDOR, no el usuario: coach_runs solo
  // tiene política de lectura, así que con el cliente del usuario la inserción
  // la bloquearía RLS en silencio y el coste no quedaría registrado.
  const finish = async (
    result: { text: string; usage: Usage; model: string } | null,
    error: string | null,
  ) => {
    const { error: ledgerErr } = await admin.from('coach_runs').insert({
      user_id: userId,
      kind,
      model: result?.model ?? modeloDe(kind),
      in_tokens: result?.usage.input_tokens ?? 0,
      cache_read_tokens: result?.usage.cache_read_input_tokens ?? 0,
      cache_write_tokens: result?.usage.cache_creation_input_tokens ?? 0,
      out_tokens: result?.usage.output_tokens ?? 0,
      cost_micro_usd: result ? costMicroUsd(result.model, result.usage) : 0,
      error,
    });
    // Que falle la contabilidad no debe tumbar el turno, pero tampoco puede
    // desaparecer sin dejar rastro: sin esto, el coste se pierde en silencio.
    if (ledgerErr) console.error('coach_runs insert failed:', ledgerErr.message);
  };

  const describe = (e: unknown): string => {
    if (e instanceof RefusalError) return 'El sistema no puede responder a eso.';
    console.error('coach error:', e);

    // Distinguir estos dos del fallo genérico importa: "reintenta en un
    // momento" es un consejo inútil cuando lo que pasa es que se acabó el
    // saldo, y te deja pensando que la app está rota mientras el coach lleva
    // días callado. Que el mensaje diga qué hacer.
    const texto = e instanceof Error ? e.message : String(e);
    if (/credit balance is too low|insufficient.quota|billing/i.test(texto)) {
      return 'Sin saldo en la cuenta de Anthropic. Recarga en console.anthropic.com → Plans & Billing y el sistema vuelve solo.';
    }
    if (/\b429\b|rate.?limit/i.test(texto)) {
      return 'La API va saturada ahora mismo. Reintenta en un minuto.';
    }
    // Un 400 es un fallo NUESTRO en la petición, y esconderlo detrás de un
    // "no responde" deja el sistema mudo sin pista de por qué. El cuerpo del
    // error de la API no lleva credenciales: es seguro enseñarlo.
    const detalle = /anthropic (\d{3}):([\s\S]*)/.exec(texto);
    if (detalle) {
      const cuerpo = (detalle[2] ?? '').replace(/\s+/g, ' ').slice(0, 200);
      return `La API ha rechazado la petición (${detalle[1]}): ${cuerpo}`;
    }
    return 'El sistema no responde. Reintenta en un momento.';
  };

  if (!wantsStream) {
    try {
      const result = await runCoach({
        sb,
        userId,
        kind,
        threadId: threadId!,
        userText: prompt,
        today,
        imagenes: body.imagenes,
        emit: () => {},
      });
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
          userId,
          kind,
          threadId: threadId!,
          userText: prompt,
          today,
          imagenes: body.imagenes,
          emit,
        });
        await finish(result, null);
        emit('done', {
          thread_id: threadId,
          text: result.text,
          cost_micro_usd: costMicroUsd(result.model, result.usage),
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
});
