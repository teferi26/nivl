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
  RefusalError,
  type ApiMessage,
  type ContentBlock,
  type Effort,
  type Usage,
} from '../_shared/anthropic.ts';
import { buildContext } from '../_shared/context.ts';
import { adminClient, userClient, type Db } from '../_shared/db.ts';
import { buildSystem } from '../_shared/prompt.ts';
import { executeTool, TOOL_DEFS } from '../_shared/tools.ts';

const MAX_TOOL_ITERATIONS = 8;
// Doce intercambios. El hilo es continuo de cara a ti, pero lo que se reenvía
// a la API tiene tope: la memoria larga vive en el dossier y en coach_facts,
// no en el transcript. Sin tope, la conversación crece sin fin y a los seis
// meses cada turno arrastra cientos de miles de tokens, primero caros y luego
// imposibles. Si algo de un turno viejo importa, el coach lo anota como hecho.
const HISTORY_LIMIT = 24;
// Freno de mano: si un turno encadena tantas herramientas que ya ha costado
// esto, algo se ha ido de madre y es mejor cortar que despertarse con la
// sorpresa. No limita turnos normales — un brief completo ronda 0,40 $.
const MAX_COST_MICRO_USD = 1_500_000; // 1,50 $

const KINDS = ['chat', 'brief', 'plan', 'revision_semanal', 'cierre_mensual', 'escalada'] as const;
type Kind = (typeof KINDS)[number];

// Los rituales que deciden el rumbo piensan más que una charla suelta.
const EFFORT_BY_KIND: Record<Kind, Effort> = {
  chat: 'high',
  brief: 'high',
  plan: 'high',
  revision_semanal: 'xhigh',
  cierre_mensual: 'xhigh',
  escalada: 'high',
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
  const TOPE_RESULTADO = 1200;
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
    return blocks.length ? { ...m, content: blocks as ContentBlock[] } : m;
  });
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
function markCacheable(messages: ApiMessage[]): ApiMessage[] {
  if (!messages.length) return messages;
  const out = messages.slice();
  const last = out[out.length - 1];
  if (!Array.isArray(last.content) || !last.content.length) return out;
  const blocks = last.content.map((b, i) =>
    i === last.content.length - 1 ? { ...b, cache_control: { type: 'ephemeral' } } : b,
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
  emit: (event: string, data: unknown) => void;
}

async function runCoach(args: RunArgs): Promise<{ text: string; usage: Usage; model: string }> {
  const { sb, userId, kind, threadId, userText, today, emit } = args;

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
  const messages: ApiMessage[] = [
    ...previos,
    { role: 'user', content: [{ type: 'text', text: userText }] },
  ];

  // Solo se persiste lo que dijo él, sin el volcado de estado.
  await sb.from('coach_messages').insert({
    thread_id: threadId,
    user_id: userId,
    role: 'user',
    content: [{ type: 'text', text: userText }],
  });

  let usage: Usage = {};
  let finalText = '';
  let model = COACH_MODEL;

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const turn = await callClaude({
      system,
      messages,
      tools: TOOL_DEFS,
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
        text = `Error: ${e instanceof Error ? e.message : String(e)}`;
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
  };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Cuerpo inválido' });
  }

  const kind = (body.kind ?? 'chat') as Kind;
  if (!KINDS.includes(kind)) return json(400, { error: `kind inválido: ${kind}` });

  const userText = String(body.message ?? '').slice(0, 8000).trim();
  if (kind === 'chat' && !userText) return json(400, { error: 'Mensaje vacío' });

  // Cliente con el JWT del usuario: RLS manda también dentro de las
  // herramientas. El cliente admin solo se usa para validar el token.
  const sb = userClient(token);

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
      model: result?.model ?? COACH_MODEL,
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
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
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
        controller.close();
      }
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
