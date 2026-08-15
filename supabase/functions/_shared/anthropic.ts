// NIVL · Cliente de la API de Claude para las Edge Functions.
// La key vive como secret del servidor y jamás llega al cliente.

// Sonnet 5 es el coach. La decisión es de coste medido, no de gusto: con Opus
// el turno salía a 0,42 $ en frío, que para el uso real que se le va a dar son
// del orden de 150 €/mes. La tarea de coach no lo necesita — es leer un estudio
// ya calculado, aplicar una doctrina escrita y llamar a la herramienta correcta,
// y en eso Sonnet no se despeña. La aritmética fina, que es donde un modelo
// mediano sí patina, no la hace él: sale de analytics.ts y finance.ts.
//
// Haiku se descartó a propósito para el coach: con veinte herramientas y 50.000
// tokens de contexto es donde empiezan a elegirse herramientas equivocadas y a
// inventarse cifras, y aquí eso se traduce en cargas de gimnasio y dinero.
export const COACH_MODEL = 'claude-sonnet-5';
// Haiku sí para lo mecánico (destilar la memoria importada, resumir): mismo
// trabajo por una fracción del coste.
export const CHEAP_MODEL = 'claude-haiku-4-5';

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface ContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  signature?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  // tool_result
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
  [k: string]: unknown;
}

export interface ApiMessage {
  role: 'user' | 'assistant';
  content: ContentBlock[] | string;
}

export interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface Turn {
  content: ContentBlock[];
  stopReason: string | null;
  usage: Usage;
  model: string;
}

// Dólares por millón de tokens. Como el coste se guarda en millonésimas de
// dólar, tokens × tarifa da directamente el valor.
//
// La escritura de caché es ×1,25 y la lectura ×0,1 sobre la tarifa de entrada,
// así que basta con guardar entrada y salida. Un modelo desconocido se cobra
// como Opus a propósito: si algún día la API responde con otro por el
// mecanismo de reserva, más vale que el freno de gasto peque de caro.
const PRICE_PER_MTOK: Record<string, { in: number; out: number }> = {
  'claude-opus-5': { in: 5, out: 25 },
  'claude-sonnet-5': { in: 2, out: 10 },
  'claude-haiku-4-5': { in: 1, out: 5 },
};

export function costMicroUsd(model: string, u: Usage): number {
  const p = PRICE_PER_MTOK[model] ?? PRICE_PER_MTOK['claude-opus-5'];
  const cacheRead = (u.cache_read_input_tokens ?? 0) * p.in * 0.1;
  const cacheWrite = (u.cache_creation_input_tokens ?? 0) * p.in * 1.25;
  return Math.round((u.input_tokens ?? 0) * p.in + cacheRead + cacheWrite + (u.output_tokens ?? 0) * p.out);
}

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    input_tokens: (a.input_tokens ?? 0) + (b.input_tokens ?? 0),
    output_tokens: (a.output_tokens ?? 0) + (b.output_tokens ?? 0),
    cache_read_input_tokens: (a.cache_read_input_tokens ?? 0) + (b.cache_read_input_tokens ?? 0),
    cache_creation_input_tokens:
      (a.cache_creation_input_tokens ?? 0) + (b.cache_creation_input_tokens ?? 0),
  };
}

export class RefusalError extends Error {
  constructor(public category: string | null) {
    super('El sistema no puede responder a eso.');
    this.name = 'RefusalError';
  }
}

export interface CallOptions {
  model?: string;
  system: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>;
  messages: ApiMessage[];
  tools?: unknown[];
  maxTokens?: number;
  effort?: Effort;
  /** Se invoca con cada fragmento de texto visible según llega. */
  onText?: (delta: string) => void;
  /** Se invoca cuando el modelo empieza a pensar (para pintar el indicador). */
  onThinking?: () => void;
}

const BETAS = [
  // Deja que la API reintente en otro modelo si un clasificador declina la
  // petición, en vez de devolver un turno vacío.
  'server-side-fallback-2026-07-01',
];

/**
 * El mecanismo de reserva es solo de la familia Opus: pedirlo con Sonnet o con
 * Haiku devuelve un 400 seco ("does not support the `fallbacks` parameter") y
 * tumba la llamada entera.
 *
 * Se comprueba por modelo y no por bandera de configuración a propósito: el
 * modelo se puede cambiar desde los secretos del panel sin desplegar, así que
 * una constante aquí se quedaría desfasada sin que nadie se entere y el coach
 * dejaría de responder.
 */
function admiteReserva(model: string): boolean {
  return model.startsWith('claude-opus');
}

/**
 * Un turno del modelo, en streaming. Devuelve los bloques de contenido
 * completos (texto, pensamiento y llamadas a herramientas) listos para
 * reenviarse tal cual en el siguiente turno.
 */
export async function callClaude(opts: CallOptions): Promise<Turn> {
  const model = opts.model ?? COACH_MODEL;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
      'anthropic-version': '2023-06-01',
      'anthropic-beta': BETAS.join(','),
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 16000,
      // El pensamiento va en adaptativo (por defecto en Opus 5) y resumido
      // para poder mostrar "el sistema está pensando" en la app.
      thinking: { type: 'adaptive', display: 'summarized' },
      output_config: { effort: opts.effort ?? 'high' },
      ...(admiteReserva(model) ? { fallbacks: 'default' } : {}),
      system: opts.system,
      messages: opts.messages,
      ...(opts.tools?.length ? { tools: opts.tools } : {}),
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(`anthropic ${res.status}: ${detail.slice(0, 400)}`);
  }

  const blocks: ContentBlock[] = [];
  const partialJson: Record<number, string> = {};
  let stopReason: string | null = null;
  let stopCategory: string | null = null;
  let usage: Usage = {};
  let servedModel = model;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Los eventos SSE se separan por línea en blanco; puede llegar partido.
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const dataLine = raw.split('\n').find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      let ev: Record<string, any>;
      try {
        ev = JSON.parse(dataLine.slice(5).trim());
      } catch {
        continue;
      }

      switch (ev.type) {
        case 'message_start':
          usage = addUsage(usage, ev.message?.usage ?? {});
          servedModel = ev.message?.model ?? model;
          break;
        case 'content_block_start': {
          const b = { ...ev.content_block } as ContentBlock;
          blocks[ev.index] = b;
          if (b.type === 'thinking') opts.onThinking?.();
          if (b.type === 'tool_use') partialJson[ev.index] = '';
          break;
        }
        case 'content_block_delta': {
          const b = blocks[ev.index];
          if (!b) break;
          const d = ev.delta ?? {};
          if (d.type === 'text_delta') {
            b.text = (b.text ?? '') + d.text;
            opts.onText?.(d.text);
          } else if (d.type === 'thinking_delta') {
            b.thinking = (b.thinking ?? '') + d.thinking;
          } else if (d.type === 'signature_delta') {
            b.signature = (b.signature ?? '') + d.signature;
          } else if (d.type === 'input_json_delta') {
            partialJson[ev.index] = (partialJson[ev.index] ?? '') + d.partial_json;
          }
          break;
        }
        case 'content_block_stop': {
          const b = blocks[ev.index];
          if (b?.type === 'tool_use') {
            try {
              b.input = partialJson[ev.index] ? JSON.parse(partialJson[ev.index]) : {};
            } catch {
              b.input = {};
            }
          }
          break;
        }
        case 'message_delta':
          stopReason = ev.delta?.stop_reason ?? stopReason;
          stopCategory = ev.delta?.stop_details?.category ?? stopCategory;
          if (ev.usage) usage = addUsage(usage, ev.usage);
          break;
      }
    }
  }

  // Comprobar el rechazo ANTES de leer el contenido: en un rechazo los
  // bloques vienen vacíos o a medias y leerlos daría una respuesta falsa.
  if (stopReason === 'refusal') throw new RefusalError(stopCategory);

  return { content: blocks.filter(Boolean), stopReason, usage, model: servedModel };
}
