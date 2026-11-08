// NIVL · Cliente de la API de Claude para las Edge Functions.
// La key vive como secret del servidor y jamás llega al cliente.

import { FiltroGuiones, sanearPeticion, sinGuiones, sinGuionesProfundo } from './singuiones.ts';

// Un solo modelo para toda la IA de NIVL (decisión del dueño, 8-nov-2026): chat,
// rituales, revisiones, estudio, clasificación, Oráculo, visión y prueba. No hay
// selector, ni rutas por plan, ni secreto que lo cambie. Lo que abarata lo
// mecánico ya no es otro modelo: es sacarlo antes de `buildContext` y pedirle
// menos esfuerzo (`effort`).
export const COACH_MODEL = 'claude-haiku-5-5';

// xhigh y max no se usan: en Haiku 5.5 alargan mucho y a veces cierran el turno sin texto.
export type Effort = 'low' | 'medium' | 'high';

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
  /** Total escrito en caché: suma de los dos TTL de `cache_creation`. */
  cache_creation_input_tokens?: number;
  /**
   * Desglose de la escritura por TTL (doc de prompt caching, contrastada el
   * 2026-10-02): `cache_creation_input_tokens` = 5m + 1h. La de 1 h cuesta 2×
   * la entrada y la de 5 min 1,25×, así que hace falta separarlas.
   */
  cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number };
}

/** Un punto de caché. `ttl: '1h'` no pide cabecera beta; escribe a 2×. */
export interface CacheControl {
  type: 'ephemeral';
  ttl?: '5m' | '1h';
}

export interface SystemBlock {
  type: 'text';
  text: string;
  cache_control?: CacheControl;
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
// La escritura de caché es ×1,25 (5 min) o ×2 (1 h) y la lectura ×0,1 sobre la
// tarifa de entrada, así que basta con guardar entrada y salida.
//
// `largo`: Haiku 5.5 tiene dos tarifas según el tamaño del prompt, contando en él
// la caché leída y escrita. Hasta 100.000 fichas, la barata; por encima, TODA la
// petición (entrada, caché y salida) a la cara, que es 5 veces más.
interface Tarifa { in: number; out: number }
const PRICE_PER_MTOK: Record<string, Tarifa & { largo?: Tarifa }> = {
  'claude-haiku-5-5': { in: 0.1, out: 0.5, largo: { in: 0.5, out: 2.5 } },
  // Proveedores compatibles con OpenAI. Las tarifas son las publicadas y hay
  // que revisarlas: cambian más a menudo que las de Anthropic.
  // DeepSeek cobra distinto en hora punta (01-04 y 06-10 UTC) que fuera de
  // ella, casi el doble. Aqui va SIEMPRE la tarifa de punta: el freno de gasto
  // tiene que pecar de caro, no llevarse la sorpresa. Fuera de punta lo real
  // es la mitad de lo que veras apuntado.
  // 2026-09-10: V4.1 Flash sustituye a V4 Flash con el nombre `deepseek-flash`;
  // `deepseek-v4-flash` solo se redirige temporalmente. Las rutas de ai_plans
  // usan `deepseek-flash` desde el 2026-10-04.
  'deepseek-v4-flash': { in: 0.3, out: 1.2 },
  // La API acepta `deepseek-v4-flash` pero responde con `model: "deepseek-flash"`
  // (comprobado el 2026-09-25), y el coste se calcula con lo que responde: sin
  // este alias cada turno de Pro se apuntaba como Opus, ~11 veces de más.
  'deepseek-flash': { in: 0.3, out: 1.2 },
  'deepseek-v4-pro': { in: 1.32, out: 3.96 },
  'deepseek-chat': { in: 0.27, out: 1.1 },
  'deepseek-reasoner': { in: 0.55, out: 2.19 },
  'gpt-5-mini': { in: 0.25, out: 2 },
  'gpt-5': { in: 1.25, out: 10 },
  'gemini-2.5-flash': { in: 0.3, out: 2.5 },
  'gemini-2.5-pro': { in: 1.25, out: 10 },
  'qwen-plus': { in: 0.4, out: 1.2 },
  'kimi-k2': { in: 0.6, out: 2.5 },
};

/** Por encima de estas fichas de prompt, Haiku 5.5 cobra la petición entera 5 veces más. */
export const UMBRAL_TRAMO_LARGO = 100_000;
/**
 * Hasta aquí se deja crecer un prompt del coach: queda margen para que el error de una estimación o lo
 * que añada la API no lo saque del tramo barato.
 */
export const TECHO_PROMPT = 90_000;
/** Un modelo desconocido se cobra caro a propósito (tarifa de Opus): el freno de gasto debe pecar de caro. */
const TARIFA_DESCONOCIDA: Tarifa = { in: 5, out: 25 };

/**
 * La tarifa de un modelo para un prompt de `fichasPrompt` fichas. La API responde
 * a veces con el id fechado (comprobado en producción el 2026-10-02 con Haiku
 * 4.5): sin quitar la fecha caería en la tarifa de un desconocido.
 */
export function tarifa(model: string, fichasPrompt = 0): Tarifa {
  const id = model.trim().toLowerCase();
  const p = PRICE_PER_MTOK[id] ?? PRICE_PER_MTOK[id.replace(/-\d{8}$/, '')];
  if (!p) return TARIFA_DESCONOCIDA;
  return p.largo && fichasPrompt > UMBRAL_TRAMO_LARGO ? p.largo : { in: p.in, out: p.out };
}

/** El tamaño del prompt que decide el tramo: entrada, caché leída y caché escrita. */
export function fichasDelPrompt(u: Usage): number {
  return (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
}

/** El coste de UNA llamada. No sumes usos antes de llamar aquí: el tramo es por petición. */
export function costMicroUsd(model: string, u: Usage): number {
  const p = tarifa(model, fichasDelPrompt(u));
  const cacheRead = (u.cache_read_input_tokens ?? 0) * p.in * 0.1;
  // La escritura de 1 h (2×) llega aparte en `cache_creation`; el resto del
  // total es de 5 min (1,25×). Sin desglose, todo es de 5 min, como antes.
  const total = u.cache_creation_input_tokens ?? 0;
  const unaHora = Math.min(total, Math.max(0, u.cache_creation?.ephemeral_1h_input_tokens ?? 0));
  const cacheWrite = (total - unaHora) * p.in * 1.25 + unaHora * p.in * 2;
  return Math.round((u.input_tokens ?? 0) * p.in + cacheRead + cacheWrite + (u.output_tokens ?? 0) * p.out);
}

export function addUsage(a: Usage, b: Usage): Usage {
  const suma: Usage = {
    input_tokens: (a.input_tokens ?? 0) + (b.input_tokens ?? 0),
    output_tokens: (a.output_tokens ?? 0) + (b.output_tokens ?? 0),
    cache_read_input_tokens: (a.cache_read_input_tokens ?? 0) + (b.cache_read_input_tokens ?? 0),
    cache_creation_input_tokens:
      (a.cache_creation_input_tokens ?? 0) + (b.cache_creation_input_tokens ?? 0),
  };
  if (a.cache_creation || b.cache_creation) {
    suma.cache_creation = {
      ephemeral_5m_input_tokens:
        (a.cache_creation?.ephemeral_5m_input_tokens ?? 0) + (b.cache_creation?.ephemeral_5m_input_tokens ?? 0),
      ephemeral_1h_input_tokens:
        (a.cache_creation?.ephemeral_1h_input_tokens ?? 0) + (b.cache_creation?.ephemeral_1h_input_tokens ?? 0),
    };
  }
  return suma;
}

/**
 * El uso de UNA llamada en streaming: el de `message_start` corregido por el de
 * `message_delta`.
 *
 * La doc de streaming dice que las cifras de `message_delta.usage` son
 * ACUMULADAS, y que pueden traer también entrada y caché (no solo la salida).
 * Antes se sumaban a las de `message_start`: si el delta repetía la entrada,
 * el turno se apuntaba con la entrada y la caché dos veces. Ahora cada cifra
 * que trae el delta sustituye a la de arranque; la que no trae, se queda.
 */
export function usoDeStream(inicio: Usage, delta: Usage): Usage {
  const out: Usage = { ...inicio };
  for (const k of ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'] as const) {
    const v = delta[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  if (delta.cache_creation && typeof delta.cache_creation === 'object') out.cache_creation = { ...delta.cache_creation };
  return out;
}

/**
 * Una llamada que falló DESPUÉS de que el proveedor empezara a cobrar (el
 * stream se cortó, venció el plazo, llegó basura). Lleva lo que ya se había
 * consumido para que la contabilidad no lo pierda: un turno que falla también
 * se paga, y si se apuntara a 0 el candado de gasto (0020) no lo vería nunca.
 *
 * La salida a medias no llega con su cifra (Anthropic la da en el último
 * evento), así que se estima por caracteres, a la alta: ~3 por ficha.
 */
export class LlamadaFallida extends Error {
  constructor(message: string, public usage: Usage, public model: string) {
    super(message);
    this.name = 'LlamadaFallida';
  }
}

/** Fichas de salida estimadas a partir de los caracteres recibidos. */
export function estimarFichas(caracteres: number): number {
  return Math.ceil(Math.max(0, caracteres) / 3);
}

/**
 * Plazo por defecto de una llamada al proveedor si quien llama no pone uno.
 * Una Edge Function se corta sobre los 150 s y entonces no queda NI respuesta
 * NI registro de gasto; mejor cortar nosotros antes y apuntarlo.
 */
export const PLAZO_LLAMADA_MS = 120_000;

export class RefusalError extends Error {
  /** Lo cobrado por la llamada rechazada (un rechazo también se paga): lo liquida la cartera. */
  usage?: Usage;
  model?: string;
  constructor(public category: string | null, usage?: Usage, model?: string) {
    super('El sistema no puede responder a eso.');
    this.name = 'RefusalError';
    this.usage = usage;
    this.model = model;
  }
}

export interface CallOptions {
  model?: string;
  system: SystemBlock[];
  messages: ApiMessage[];
  tools?: unknown[];
  /**
   * `none` para pedir texto SIN quitar las herramientas: quitarlas cambia el
   * prefijo (rompe toda la caché) y con tool_use en el historial da 400. Un
   * cambio de tool_choice solo invalida la caché de mensajes (doc de prompt
   * caching, 2026-10-02). Sin herramientas no se envía.
   */
  toolChoice?: { type: 'auto' | 'none' };
  maxTokens?: number;
  effort?: Effort;
  /** Se invoca con cada fragmento de texto visible según llega. */
  onText?: (delta: string) => void;
  /** Se invoca cuando el modelo empieza a pensar (para pintar el indicador). */
  onThinking?: () => void;
  /** Corta la llamada (plazo del turno). Sin él, PLAZO_LLAMADA_MS. */
  signal?: AbortSignal;
  /**
   * OBLIGATORIA (0078): toda llamada reserva antes su coste máximo en la cartera del usuario y lo liquida
   * al terminar. Sin cartera no compila: así ninguna función nueva puede gastar fuera del tope.
   */
  cartera: Cartera;
}

/**
 * Un turno del modelo, en streaming. Devuelve los bloques de contenido
 * completos (texto, pensamiento y llamadas a herramientas) listos para
 * reenviarse tal cual en el siguiente turno.
 */
async function callClaudeCrudo(opts: CallOptions): Promise<Turn> {
  const model = opts.model ?? COACH_MODEL;
  const signal = opts.signal ?? AbortSignal.timeout(PLAZO_LLAMADA_MS);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 16000,
      // Pensamiento adaptativo y resumido, para poder mostrar "el sistema está
      // pensando". Cuenta dentro de max_tokens: los techos tienen que dar para
      // pensar y además responder. Haiku 5.5 no tiene reserva en servidor (nada
      // de `fallbacks`): el rechazo lo atiende quien llama (RefusalError).
      thinking: { type: 'adaptive', display: 'summarized' },
      output_config: { effort: opts.effort ?? 'medium' },
      system: opts.system,
      messages: opts.messages,
      ...(opts.tools?.length
        ? { tools: opts.tools, ...(opts.toolChoice ? { tool_choice: opts.toolChoice } : {}) }
        : {}),
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    // El cuerpo del error se queda en el servidor: puede hablar de la cuenta
    // del dueño (saldo, límites) y no es asunto de quien usa la app.
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
  // Caracteres de salida recibidos, por si el stream se corta antes del
  // último evento (el que trae la cifra de salida de verdad).
  let salida = 0;
  let salidaContada = false;
  // El plazo corta también la LECTURA del stream, no solo la conexión: un
  // proveedor que deja el stream abierto sin mandar nada no puede retener el
  // turno (ni el cerrojo de gasto) hasta que la plataforma mate la función.
  const cortar = () => { reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cortar, { once: true });

  try {
  while (true) {
    const { done, value } = await reader.read();
    if (signal.aborted) throw signal.reason ?? new Error('abortado');
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
          usage = usoDeStream(usage, ev.message?.usage ?? {});
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
            salida += String(d.text ?? '').length;
            opts.onText?.(d.text);
          } else if (d.type === 'thinking_delta') {
            b.thinking = (b.thinking ?? '') + d.thinking;
            salida += String(d.thinking ?? '').length;
          } else if (d.type === 'signature_delta') {
            b.signature = (b.signature ?? '') + d.signature;
          } else if (d.type === 'input_json_delta') {
            partialJson[ev.index] = (partialJson[ev.index] ?? '') + d.partial_json;
            salida += String(d.partial_json ?? '').length;
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
          if (ev.usage) {
            // Acumulado, no incremento: sustituye (ver usoDeStream).
            usage = usoDeStream(usage, ev.usage);
            salidaContada = true;
          }
          break;
      }
    }
  }
  } catch (e) {
    // Lo consumido hasta aquí se paga igual: viaja en el error.
    const parcial = salidaContada ? usage : addUsage(usage, { output_tokens: estimarFichas(salida) });
    throw new LlamadaFallida(`anthropic stream: ${e instanceof Error ? e.name : 'error'}`, parcial, servedModel);
  } finally {
    signal.removeEventListener('abort', cortar);
  }

  // Comprobar el rechazo ANTES de leer el contenido: en un rechazo los
  // bloques vienen vacíos o a medias y leerlos daría una respuesta falsa.
  if (stopReason === 'refusal') throw new RefusalError(stopCategory, usage, servedModel);

  return { content: blocks.filter(Boolean), stopReason, usage, model: servedModel };
}

/**
 * Orden del dueño (02/10/2026): ningún texto de la IA lleva «—» ni «–». Todo
 * pasa por aquí: los fragmentos en streaming (filtrados por líneas, para no
 * romper un guion partido) y el turno final (texto y entradas de herramientas,
 * que también acaban a la vista: títulos, planes, diario). El pensamiento no se
 * toca: la API exige devolverlo tal cual.
 */
export function sanearTurno(turn: Turn): Turn {
  return {
    ...turn,
    content: turn.content.map((b) =>
      b.type === 'text' && typeof b.text === 'string'
        ? { ...b, text: sinGuiones(b.text) }
        : b.type === 'tool_use' && b.input !== undefined
        ? { ...b, input: sinGuionesProfundo(b.input) }
        : b
    ),
  };
}

/**
 * callClaudeCrudo con el saneado de guiones en el stream y en el resultado, y con la RESERVA de la
 * cartera (0078): antes de llamar se reserva la cota del coste (costeMaximoClaude) y al terminar se
 * liquida el coste real. Si la cartera no deja, se lanza TopeIaError y no sale ni un byte al proveedor.
 */
export async function callClaude(opts: CallOptions): Promise<Turn> {
  const filtro = new FiltroGuiones();
  const onText = opts.onText
    ? (d: string) => {
      const s = filtro.push(d);
      if (s) opts.onText!(s);
    }
    : undefined;
  const peticion = sanearPeticion({ ...opts, onText });
  const maximo = costeMaximoClaude(peticion.model ?? COACH_MODEL, peticion);
  const turn = await conReserva(opts.cartera, maximo, () => callClaudeCrudo(peticion));
  const resto = filtro.fin();
  if (resto && opts.onText) opts.onText(resto);
  return sanearTurno(turn);
}

// ── La cota del coste de una llamada (0078) ──────────────────────────────
//
// La reserva tiene que ser una COTA SUPERIOR del coste real, o el tope dejaría de ser duro:
//   · Entrada: los bytes UTF-8 de la petición serializada (system + mensajes + herramientas). Una ficha
//     de Claude cubre al menos un byte, y el JSON añade comillas, claves y escapes que no son fichas, así
//     que bytes >= fichas. Se suma un margen fijo por el prompt de herramientas que añade la API. Las
//     imágenes no se miden por su base64 sino con su tope de fichas (FICHAS_POR_IMAGEN).
//   · Toda la entrada al precio de ESCRITURA de caché (1,25×; 2× si algún punto es de 1 h): lo más caro
//     que puede costar una ficha de entrada.
//   · Salida: max_tokens (el pensamiento cuenta dentro) a la tarifa de salida.
//   · Tramo: con una cota de más de 100.000 fichas, todo a la tarifa cara de Haiku 5.5.
// La cota sale varias veces por encima del coste real de un mensaje; lo que sobra se libera al liquidar
// (docs/IA_TOPE.md).

/** Tope de fichas de una imagen: Claude reescala a ~1,15 MP (≈1.600 fichas); con alta resolución, ~4.800. */
export const FICHAS_POR_IMAGEN = 6000;
/** El prompt de sistema de herramientas que añade la API (unos cientos de fichas) y los marcadores de rol. */
export const MARGEN_FICHAS = 1024;

/** Fichas máximas de una carga: bytes del JSON sin los base64 de las imágenes, más su tope por imagen. */
export function fichasMaximas(carga: unknown): number {
  let imagenes = 0;
  const json = JSON.stringify(carga, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      // Bloque de imagen de Anthropic, o image_url de la API compatible.
      if (o.type === 'image' && o.source && typeof o.source === 'object') {
        imagenes++;
        return { type: 'image' };
      }
      if (o.type === 'image_url') {
        imagenes++;
        return { type: 'image_url' };
      }
    }
    return v;
  }) ?? '';
  return new TextEncoder().encode(json).length + imagenes * FICHAS_POR_IMAGEN + MARGEN_FICHAS;
}

/** Fichas PROBABLES de una carga, a la alta (~2,5 bytes por ficha; imágenes por su tamaño medio). */
export function fichasEstimadas(carga: unknown): number {
  let imagenes = 0;
  const json = JSON.stringify(carga, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v) && (v as { type?: unknown }).type === 'image') {
      imagenes++;
      return { type: 'image' };
    }
    return v;
  }) ?? '';
  return Math.ceil(new TextEncoder().encode(json).length / 2.5) + imagenes * 1600 + MARGEN_FICHAS;
}

/**
 * El historial que cabe bajo TECHO_PROMPT junto a lo fijo (`resto`). Se tiran los mensajes más viejos: la
 * memoria larga vive en el dossier y en el resumen. Siempre empieza por un mensaje del usuario.
 */
export function historialEnTramo(previos: ApiMessage[], resto: unknown): ApiMessage[] {
  const fijo = fichasEstimadas(resto);
  let out = previos;
  while (out.length && fijo + fichasEstimadas(out) > TECHO_PROMPT) {
    out = out.slice(1);
    while (out.length && out[0].role !== 'user') out = out.slice(1);
  }
  return out;
}

/** Cota en microdólares: entrada al precio de escritura de caché más la salida máxima. */
export function costeMaximo(model: string, fichasEntrada: number, maxSalida: number, factorEscritura = 1.25): number {
  // Si la cota de fichas cabe en el tramo barato, el prompt real también (fichas reales <= cota); si no,
  // se reserva al tramo caro, entrada y salida. Lo que sobre se libera al liquidar.
  const p = tarifa(model, fichasEntrada);
  return Math.ceil(fichasEntrada * p.in * factorEscritura + Math.max(0, maxSalida) * p.out);
}

/** La cota de una petición a Claude tal y como se va a mandar. */
export function costeMaximoClaude(
  model: string,
  opts: Pick<CallOptions, 'system' | 'messages' | 'tools' | 'maxTokens'>,
): number {
  const unaHora = opts.system.some((b) => b.cache_control?.ttl === '1h');
  const fichas = fichasMaximas({ system: opts.system, messages: opts.messages, tools: opts.tools ?? [] });
  return costeMaximo(model, fichas, opts.maxTokens ?? 16000, unaHora ? 2 : 1.25);
}

/** La cartera de IA de un usuario (la real está en _shared/cartera.ts; los tests usan otras). */
export interface Cartera {
  /** Reserva `micro` o lanza TopeIaError. Devuelve el id de la reserva. */
  reservar(micro: number): Promise<string>;
  /** Liquida con el coste real (0 = libera). Nunca lanza. */
  liquidar(id: string, realMicro: number): Promise<void>;
}

/** La cartera no deja: tope del mes, ritmo del día, tope de la función, sin plan o sin servidor. */
export class TopeIaError extends Error {
  constructor(public motivo: string) {
    super(`tope de IA: ${motivo}`);
    this.name = 'TopeIaError';
  }
}

/** ¿El proveedor respondió con un error HTTP? Entonces no ha cobrado: se libera la reserva. */
export function errorSinCobro(e: unknown): boolean {
  const texto = e instanceof Error ? e.message : String(e);
  return /^(?:anthropic|proveedor) \d{3}\b/.test(texto);
}

/**
 * Reserva `maximo`, llama y liquida:
 *   · bien → el coste real de su uso;
 *   · cortada a medias (LlamadaFallida) o rechazada con uso → lo cobrado, nunca por encima de la cota;
 *   · error HTTP del proveedor → 0 (no cobra);
 *   · cualquier otra cosa (red, plazo antes de respuesta) → la reserva entera: no se sabe si cobró.
 */
export async function conReserva(cartera: Cartera, maximo: number, llamar: () => Promise<Turn>): Promise<Turn> {
  const id = await cartera.reservar(maximo);
  let real = maximo;
  try {
    const t = await llamar();
    real = costMicroUsd(t.model, t.usage);
    return t;
  } catch (e) {
    if (e instanceof LlamadaFallida) real = Math.min(maximo, costMicroUsd(e.model, e.usage));
    else if (e instanceof RefusalError && e.usage) real = Math.min(maximo, costMicroUsd(e.model ?? '', e.usage));
    else if (errorSinCobro(e)) real = 0;
    throw e;
  } finally {
    await cartera.liquidar(id, real);
  }
}
