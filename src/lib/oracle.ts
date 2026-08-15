import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { DIFFICULTIES, STATS } from './game';
import { callPremiumOracle, fetchSubscription, isPremium, paywallEnabled } from './subscription';
import type { Difficulty, Stat } from './types';

// Señal tipada de "necesita pagar o poner su key": las pantallas la capturan
// para mostrar el paywall en lugar de un error genérico.
export class PaywallError extends Error {
  constructor() {
    super('El Oráculo es una función premium: suscríbete o usa tu propia API key.');
    this.name = 'PaywallError';
  }
}

export type OracleAccess = 'premium' | 'byok' | 'none';

export async function resolveOracleAccess(userId: string): Promise<OracleAccess> {
  // Sin muro no hay nada que consultar: se va siempre por el servidor. Además
  // evita que un fallo de red al leer la suscripción degrade a paywall.
  if (!paywallEnabled()) return 'premium';
  try {
    const sub = await fetchSubscription(userId);
    if (isPremium(sub)) return 'premium';
  } catch {
    // Si la lectura de suscripción falla (red), probamos con la key propia.
  }
  const key = await getApiKey();
  return key ? 'byok' : 'none';
}

// El Oráculo BYOK es multi-proveedor: detecta por el prefijo de la key si es
// OpenAI (sk-proj…/sk-…) o Anthropic (sk-ant…) y llama a la API correcta.
// Modelos baratos a propósito: cada consulta cuesta ~décimas de céntimo.
const MODEL = 'claude-haiku-4-5';
// gpt-4o-mini: el mejor coste/calidad de OpenAI (~0,001 € por consulta).
const OPENAI_MODEL = 'gpt-4o-mini';
// La key vive en SecureStore (cifrado del SO), no en AsyncStorage (texto plano).
const KEY_STORAGE = 'nivl_anthropic_key';
const LEGACY_KEY = 'nivl.anthropic_key';

export type AiProvider = 'anthropic' | 'openai';

export function detectProvider(key: string): AiProvider {
  return key.startsWith('sk-ant') ? 'anthropic' : 'openai';
}

// Llamada a OpenAI en modo JSON garantizado. La forma exacta va en el prompt y
// la validación real la hacen los sanitizadores del cliente (igual que con
// Anthropic): un item inválido se descarta, nunca llega a la BD.
async function callOpenAI(
  system: string,
  user: string,
  apiKey: string,
  maxTokens: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: maxTokens,
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('El oráculo tardó demasiado. Revisa tu conexión y reintenta.');
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401) throw new Error('API key de OpenAI inválida. Revísala en el Oráculo.');
    if (res.status === 429 && body.includes('insufficient_quota')) {
      throw new Error('Tu cuenta de OpenAI se ha quedado sin saldo. Recárgala en platform.openai.com.');
    }
    if (res.status === 429) throw new Error('Límite de peticiones de OpenAI alcanzado. Espera y reintenta.');
    throw new Error(`El oráculo no responde (HTTP ${res.status}).`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('El oráculo devolvió una respuesta vacía.');
  return JSON.parse(text);
}

// Formas JSON para el modo json_object de OpenAI (van en el prompt).
const QUEST_JSON_SHAPE =
  '{"title":"string","stat":"FUE|VIT|INT|AGI|PER","difficulty":"trivial|facil|media|dificil|epica","days_of_week":[1..7],"reasoning":"string"}';
const GENERATE_SHAPE = `Responde SOLO con un JSON válido con esta forma exacta:\n{"quests":[${QUEST_JSON_SHAPE}],"plan_summary":"string"}`;
const WEEKLY_SHAPE = `Responde SOLO con un JSON válido con esta forma exacta:\n{"analysis":"string","adjustments":[{"quest_id":"id EXACTO de los datos","quest_title":"string","action":"ajustar_dificultad|desactivar","new_difficulty":"trivial|facil|media|dificil|epica","reasoning":"string"}],"new_quests":[${QUEST_JSON_SHAPE}],"advice":"string"}`;

export interface ProposedQuest {
  title: string;
  stat: Stat;
  difficulty: Difficulty;
  days_of_week: number[];
  reasoning: string;
}

export interface OracleResponse {
  quests: ProposedQuest[];
  plan_summary: string;
}

export async function getApiKey(): Promise<string | null> {
  const secure = await SecureStore.getItemAsync(KEY_STORAGE);
  if (secure) return secure;
  // Migración transparente: si venía de una versión anterior en AsyncStorage
  // (texto plano), la movemos a SecureStore y borramos el resto inseguro.
  const legacy = await AsyncStorage.getItem(LEGACY_KEY);
  if (legacy) {
    await SecureStore.setItemAsync(KEY_STORAGE, legacy);
    await AsyncStorage.removeItem(LEGACY_KEY);
    return legacy;
  }
  // Auto-sembrado SOLO para desarrollo: si el .env local trae una key por
  // defecto y el dispositivo no tiene ninguna, se instala en SecureStore.
  // El guard de __DEV__ es la red de seguridad: aunque alguien compile con
  // EXPO_PUBLIC_DEFAULT_AI_KEY puesta, un build de release la ignora y la key
  // nunca sale embebida en un binario distribuido.
  const seeded = __DEV__ ? process.env.EXPO_PUBLIC_DEFAULT_AI_KEY : undefined;
  if (seeded && seeded.trim()) {
    await SecureStore.setItemAsync(KEY_STORAGE, seeded.trim());
    return seeded.trim();
  }
  return null;
}

export async function setApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (trimmed) {
    await SecureStore.setItemAsync(KEY_STORAGE, trimmed);
  } else {
    await SecureStore.deleteItemAsync(KEY_STORAGE);
  }
  await AsyncStorage.removeItem(LEGACY_KEY);
}

const QUESTS_SCHEMA = {
  type: 'object',
  properties: {
    quests: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Título corto de la misión, en español' },
          stat: { type: 'string', enum: ['FUE', 'VIT', 'INT', 'AGI', 'PER'] },
          difficulty: { type: 'string', enum: ['trivial', 'facil', 'media', 'dificil', 'epica'] },
          days_of_week: {
            type: 'array',
            items: { type: 'integer', enum: [1, 2, 3, 4, 5, 6, 7] },
            description: 'Días de la semana (1=lunes … 7=domingo)',
          },
          reasoning: { type: 'string', description: 'Por qué esta misión acerca al objetivo (1 frase)' },
        },
        required: ['title', 'stat', 'difficulty', 'days_of_week', 'reasoning'],
        additionalProperties: false,
      },
    },
    plan_summary: {
      type: 'string',
      description: 'Resumen del plan en 2-3 frases, en la voz sobria del sistema',
    },
  },
  required: ['quests', 'plan_summary'],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `Eres "el sistema" de NIVL, una app que gamifica la vida real estilo Solo Leveling. El usuario te da un objetivo y tú lo conviertes en misiones diarias/semanales recurrentes y realistas.

Reglas:
- Genera entre 3 y 6 misiones recurrentes que, mantenidas en el tiempo, lleven al objetivo.
- Stats: FUE (ejercicio físico), VIT (nutrición/sueño/salud), INT (estudio/trabajo mental), AGI (constancia/organización), PER (reflexión/mentalidad).
- Dificultad por esfuerzo de UNA sesión: trivial (≤5 min), facil (≤20 min), media (~45 min), dificil (1-2 h), epica (medio día). XP: 10/25/50/100/250.
- Sé realista con la frecuencia: nadie aguanta 7 días/semana de todo. Progresión sostenible > ambición de papel.
- Títulos cortos y accionables, en español. Sin emojis.`;

export async function generateQuests(goal: string, apiKey: string): Promise<OracleResponse> {
  if (detectProvider(apiKey) === 'openai') {
    const raw = await callOpenAI(
      `${SYSTEM_PROMPT}\n\n${GENERATE_SHAPE}`,
      `Mi objetivo: ${goal}`,
      apiKey,
      1200,
    );
    return sanitizeGenerate(raw as OracleResponse);
  }

  // Timeout de 30 s: sin AbortController, una red en agujero dejaba el botón
  // "Consultar" girando para siempre.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Mi objetivo: ${goal}` }],
        output_config: { format: { type: 'json_schema', schema: QUESTS_SCHEMA } },
      }),
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('El oráculo tardó demasiado. Revisa tu conexión y reintenta.');
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    if (res.status === 401) throw new Error('API key inválida. Revísala en este mismo panel.');
    if (res.status === 429) throw new Error('Límite de uso alcanzado. Espera un momento y reintenta.');
    if (res.status === 529) throw new Error('La API está saturada. Reintenta en unos segundos.');
    const body = await res.text();
    throw new Error(`El oráculo no responde (HTTP ${res.status}): ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    content: { type: string; text?: string }[];
    stop_reason: string;
  };
  const text = data.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('El oráculo devolvió una respuesta vacía.');

  return sanitizeGenerate(JSON.parse(text) as OracleResponse);
}

// Valida cada propuesta contra los enums reales antes de dejar que llegue a la BD:
// la IA podría devolver stat 'STR' o difficulty 'hard' e insertar basura.
function sanitizeGenerate(parsed: OracleResponse): OracleResponse {
  if (!Array.isArray(parsed.quests)) {
    throw new Error('El oráculo devolvió un formato inesperado.');
  }
  const valid = parsed.quests.filter(isValidProposal);
  if (valid.length === 0) {
    throw new Error('El oráculo no encontró misiones válidas para ese objetivo. Reformúlalo.');
  }
  return { quests: valid, plan_summary: parsed.plan_summary ?? '' };
}

// Punto de entrada único: decide la vía (premium/servidor · key propia · paywall).
export async function askOracle(goal: string, userId: string): Promise<OracleResponse> {
  const access = await resolveOracleAccess(userId);
  if (access === 'premium') {
    const raw = await callPremiumOracle<OracleResponse>('generate', { goal });
    return sanitizeGenerate(raw);
  }
  if (access === 'byok') {
    const key = await getApiKey();
    return generateQuests(goal, key!);
  }
  throw new PaywallError();
}

export async function askWeeklyOracle(input: WeeklyInput, userId: string): Promise<WeeklyAdvice> {
  const access = await resolveOracleAccess(userId);
  if (access === 'premium') {
    const raw = await callPremiumOracle<WeeklyAdvice>('weekly', { weeklyInput: input });
    return sanitizeWeekly(raw, input);
  }
  if (access === 'byok') {
    const key = await getApiKey();
    return weeklyOracle(input, key!);
  }
  throw new PaywallError();
}

function isValidProposal(q: ProposedQuest): boolean {
  return (
    typeof q.title === 'string' &&
    q.title.trim().length > 0 &&
    STATS.includes(q.stat) &&
    DIFFICULTIES.includes(q.difficulty) &&
    Array.isArray(q.days_of_week) &&
    q.days_of_week.length > 0 &&
    q.days_of_week.every((d) => Number.isInteger(d) && d >= 1 && d <= 7)
  );
}

// ── El sistema se mejora a sí mismo: análisis semanal con ajustes ───
export interface QuestSnapshot {
  id: string;
  title: string;
  difficulty: Difficulty;
  days_of_week: number[];
  scheduled: number; // veces programada en los últimos 14 días
  completed: number; // veces completada
}

export interface WeeklyInput {
  quests: QuestSnapshot[];
  streakDays: number;
  level: number;
  rulesBroken: string[];
  penaltiesXp: number;
}

export interface OracleAdjustment {
  quest_id: string;
  quest_title: string;
  action: 'ajustar_dificultad' | 'desactivar';
  new_difficulty?: Difficulty;
  reasoning: string;
}

export interface WeeklyAdvice {
  analysis: string;
  adjustments: OracleAdjustment[];
  new_quests: ProposedQuest[];
  advice: string;
}

const WEEKLY_SCHEMA = {
  type: 'object',
  properties: {
    analysis: { type: 'string', description: 'Lectura de la semana en 2-4 frases, voz sobria del sistema' },
    adjustments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          quest_id: { type: 'string' },
          quest_title: { type: 'string' },
          action: { type: 'string', enum: ['ajustar_dificultad', 'desactivar'] },
          new_difficulty: { type: 'string', enum: ['trivial', 'facil', 'media', 'dificil', 'epica'] },
          reasoning: { type: 'string', description: '1 frase: por qué' },
        },
        required: ['quest_id', 'quest_title', 'action', 'reasoning'],
        additionalProperties: false,
      },
    },
    new_quests: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          stat: { type: 'string', enum: ['FUE', 'VIT', 'INT', 'AGI', 'PER'] },
          difficulty: { type: 'string', enum: ['trivial', 'facil', 'media', 'dificil', 'epica'] },
          days_of_week: { type: 'array', items: { type: 'integer', enum: [1, 2, 3, 4, 5, 6, 7] } },
          reasoning: { type: 'string' },
        },
        required: ['title', 'stat', 'difficulty', 'days_of_week', 'reasoning'],
        additionalProperties: false,
      },
    },
    advice: { type: 'string', description: 'Un consejo accionable para la próxima semana' },
  },
  required: ['analysis', 'adjustments', 'new_quests', 'advice'],
  additionalProperties: false,
} as const;

const WEEKLY_SYSTEM = `Eres "el sistema" de NIVL. Analizas la semana real del cazador y propones AJUSTES CONCRETOS para que el juego se adapte a él: misión que falla siempre → bajar dificultad o desactivar; misión trivial que clava el 100% → subir dificultad; huecos → como mucho 1-2 misiones nuevas. Sé conservador: pocos cambios y bien justificados. Nunca propongas más de 4 ajustes. Voz sobria, español, sin sermones.`;

export async function weeklyOracle(input: WeeklyInput, apiKey: string): Promise<WeeklyAdvice> {
  if (detectProvider(apiKey) === 'openai') {
    const raw = await callOpenAI(
      `${WEEKLY_SYSTEM}\n\n${WEEKLY_SHAPE}`,
      `Datos de mis últimos 14 días:\n${JSON.stringify(input)}`,
      apiKey,
      1500,
    );
    return sanitizeWeekly(raw as WeeklyAdvice, input);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2500,
        system: WEEKLY_SYSTEM,
        messages: [{ role: 'user', content: `Datos de mis últimos 14 días:\n${JSON.stringify(input)}` }],
        output_config: { format: { type: 'json_schema', schema: WEEKLY_SCHEMA } },
      }),
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('El oráculo tardó demasiado. Revisa tu conexión y reintenta.');
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    if (res.status === 401) throw new Error('API key inválida. Revísala en el Oráculo.');
    if (res.status === 429) throw new Error('Límite de uso alcanzado. Espera y reintenta.');
    throw new Error(`El oráculo no responde (HTTP ${res.status}).`);
  }

  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  const text = data.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('El oráculo devolvió una respuesta vacía.');

  return sanitizeWeekly(JSON.parse(text) as WeeklyAdvice, input);
}

function sanitizeWeekly(parsed: WeeklyAdvice, input: WeeklyInput): WeeklyAdvice {
  const validIds = new Set(input.quests.map((q) => q.id));
  return {
    analysis: parsed.analysis ?? '',
    adjustments: (parsed.adjustments ?? []).filter(
      (a) =>
        validIds.has(a.quest_id) &&
        (a.action === 'desactivar' || (a.new_difficulty && DIFFICULTIES.includes(a.new_difficulty))),
    ),
    new_quests: (parsed.new_quests ?? []).filter(isValidProposal),
    advice: parsed.advice ?? '',
  };
}
