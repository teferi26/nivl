// NIVL · El coach sobre cualquier API compatible con OpenAI.
//
// Un solo adaptador cubre OpenAI, DeepSeek, Gemini (por su capa compatible),
// Qwen, Kimi, Groq, Together y prácticamente cualquier proveedor nuevo: todos
// hablan el mismo dialecto de /chat/completions. El proveedor pasa a ser
// configuración —una URL, un modelo y una clave— en vez de código.
//
// Por qué existe: medido sobre una semana real, el coste del coach lo domina el
// prefijo de ~78.000 fichas que se escribe en caché en cada conversación nueva.
// Con las tarifas de Claude eso son 0,19 $ por turno en frío; con DeepSeek o
// Gemini Flash ronda 0,03 $. Para uso personal da igual; para monetizar es la
// diferencia entre viable e inviable.
//
// Lo que NO cambia: el resto del sistema sigue hablando en el formato de
// Anthropic (bloques de contenido, tool_use, tool_result). Aquí se traduce a la
// ida y a la vuelta, así que las 21 herramientas, el estudio, la doctrina y la
// memoria funcionan igual con cualquier proveedor.

import type { ApiMessage, ContentBlock, Turn, Usage } from './anthropic.ts';

export interface OpcionesCompat {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: Array<{ type: 'text'; text: string }>;
  messages: ApiMessage[];
  tools?: unknown[];
  maxTokens?: number;
  onText?: (delta: string) => void;
}

interface MensajeChat {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | Array<Record<string, unknown>> | null;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

/**
 * Traduce los bloques de Anthropic al formato de chat de OpenAI.
 *
 * Las tres diferencias que importan:
 *   · Anthropic mete el resultado de una herramienta en un mensaje de USUARIO;
 *     OpenAI usa un rol propio, 'tool', con su tool_call_id.
 *   · Anthropic pone las llamadas dentro del contenido del asistente; OpenAI
 *     las saca a un campo aparte, tool_calls.
 *   · Los bloques de pensamiento no tienen equivalente y se descartan.
 */
function aFormatoChat(system: Array<{ text: string }>, messages: ApiMessage[]): MensajeChat[] {
  const salida: MensajeChat[] = [];

  const texto = system.map((b) => b.text).join('\n\n').trim();
  if (texto) salida.push({ role: 'system', content: texto });

  for (const m of messages) {
    const bloques: ContentBlock[] = Array.isArray(m.content)
      ? m.content
      : [{ type: 'text', text: String(m.content ?? '') }];

    if (m.role === 'user') {
      // Los resultados de herramienta salen a mensajes 'tool' propios, y lo que
      // no sea resultado se queda como mensaje de usuario normal.
      const resultados = bloques.filter((b) => b.type === 'tool_result');
      for (const r of resultados) {
        const c = (r as { content?: unknown }).content;
        salida.push({
          role: 'tool',
          tool_call_id: String(r.tool_use_id ?? ''),
          content: typeof c === 'string' ? c : JSON.stringify(c ?? ''),
        });
      }

      const resto = bloques.filter((b) => b.type === 'text' || b.type === 'image');
      if (resto.length) {
        const soloTexto = resto.every((b) => b.type === 'text');
        salida.push({
          role: 'user',
          content: soloTexto
            ? resto.map((b) => b.text ?? '').join('\n')
            : resto.map((b) =>
                b.type === 'image'
                  ? {
                      type: 'image_url',
                      image_url: {
                        url: `data:${(b.source as { media_type?: string })?.media_type ?? 'image/jpeg'};base64,${(b.source as { data?: string })?.data ?? ''}`,
                      },
                    }
                  : { type: 'text', text: b.text ?? '' },
              ),
        });
      }
      continue;
    }

    // Asistente: el texto por un lado, las llamadas por otro.
    const textos = bloques.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n');
    const llamadas = bloques
      .filter((b) => b.type === 'tool_use')
      .map((b) => ({
        id: String(b.id ?? ''),
        type: 'function' as const,
        function: { name: String(b.name ?? ''), arguments: JSON.stringify(b.input ?? {}) },
      }));

    if (!textos && !llamadas.length) continue; // era solo pensamiento
    salida.push({
      role: 'assistant',
      content: textos || null,
      ...(llamadas.length ? { tool_calls: llamadas } : {}),
    });
  }

  return salida;
}

/** Las herramientas, del esquema de Anthropic al de funciones de OpenAI. */
function aFunciones(tools: unknown[] | undefined) {
  if (!tools?.length) return undefined;
  return (tools as Array<{ name: string; description: string; input_schema: unknown }>).map((t) => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
}

/**
 * Un turno contra un proveedor compatible con OpenAI, en streaming.
 *
 * Devuelve exactamente la misma forma que `callClaude`, así que el bucle de
 * herramientas, la contabilidad y la persistencia no se enteran de con quién
 * están hablando.
 */
export async function callOpenAICompat(opts: OpcionesCompat): Promise<Turn> {
  const res = await fetch(`${opts.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${opts.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 8000,
      messages: aFormatoChat(opts.system, opts.messages),
      ...(aFunciones(opts.tools) ? { tools: aFunciones(opts.tools) } : {}),
      stream: true,
      // Pide el desglose de uso en el último fragmento; sin esto no hay forma
      // de saber lo que costó el turno y la contabilidad se queda a ciegas.
      stream_options: { include_usage: true },
    }),
  });

  if (!res.ok || !res.body) {
    const detalle = await res.text().catch(() => '');
    throw new Error(`proveedor ${res.status}: ${detalle.slice(0, 400)}`);
  }

  const lector = res.body.getReader();
  const decodificador = new TextDecoder();
  let buffer = '';
  let texto = '';
  let motivo: string | null = null;
  let usage: Usage = {};
  let modelo = opts.model;

  // Las llamadas llegan a trozos: el nombre en el primer fragmento y los
  // argumentos repartidos entre los siguientes. Se acumulan por índice.
  const llamadas = new Map<number, { id: string; name: string; args: string }>();

  while (true) {
    const { done, value } = await lector.read();
    if (done) break;
    buffer += decodificador.decode(value, { stream: true });

    let corte: number;
    while ((corte = buffer.indexOf('\n')) !== -1) {
      const linea = buffer.slice(0, corte).trim();
      buffer = buffer.slice(corte + 1);
      if (!linea.startsWith('data:')) continue;
      const datos = linea.slice(5).trim();
      if (datos === '[DONE]') continue;

      let d: any;
      try {
        d = JSON.parse(datos);
      } catch {
        continue;
      }

      if (d.model) modelo = d.model;
      if (d.usage) {
        usage = {
          input_tokens: d.usage.prompt_tokens ?? 0,
          output_tokens: d.usage.completion_tokens ?? 0,
          // Casi todos los compatibles informan del acierto de caché aquí.
          cache_read_input_tokens:
            d.usage.prompt_tokens_details?.cached_tokens ?? d.usage.prompt_cache_hit_tokens ?? 0,
          cache_creation_input_tokens: 0,
        };
      }

      const delta = d.choices?.[0]?.delta;
      if (d.choices?.[0]?.finish_reason) motivo = d.choices[0].finish_reason;
      if (!delta) continue;

      if (typeof delta.content === 'string' && delta.content) {
        texto += delta.content;
        opts.onText?.(delta.content);
      }

      for (const tc of delta.tool_calls ?? []) {
        const i = tc.index ?? 0;
        const previa = llamadas.get(i) ?? { id: '', name: '', args: '' };
        llamadas.set(i, {
          id: tc.id || previa.id,
          name: tc.function?.name || previa.name,
          args: previa.args + (tc.function?.arguments ?? ''),
        });
      }
    }
  }

  const content: ContentBlock[] = [];
  if (texto) content.push({ type: 'text', text: texto });
  for (const [, c] of [...llamadas.entries()].sort((a, b) => a[0] - b[0])) {
    let input: Record<string, unknown> = {};
    try {
      input = c.args ? JSON.parse(c.args) : {};
    } catch {
      // Argumentos rotos: se deja el objeto vacío y el ejecutor devolverá su
      // error al modelo para que lo corrija, que es como funciona el resto.
      input = {};
    }
    content.push({ type: 'tool_use', id: c.id || `call_${c.name}`, name: c.name, input });
  }

  return {
    content,
    // El resto del sistema decide si seguir por el stop_reason de Anthropic.
    stopReason: llamadas.size ? 'tool_use' : motivo === 'length' ? 'max_tokens' : 'end_turn',
    usage,
    model: modelo,
  };
}
