// NIVL · Atajos baratos de «leer y transformar» (IA barata, 21/10/2026).
//
// Flashcards, resúmenes, mapas conceptuales, extractos bancarios, dietas y entrenos generados a partir de
// un texto que pega el gladiador. Regla de AGENTS.md: si la tarea es leer y transformar, va con
// CHEAP_MODEL (Haiku) y FUERA del contexto del coach, como el atajo `kind: 'clasificar'`: sin dossier, sin
// estudios, sin historial y sin herramientas. Coste medido con la cota: ~0,005-0,02 $ por petición frente
// a 0,08-0,16 $ si fueran turnos del coach (COSTE_IA_ELITE.md).
//
// Cada petición reserva su coste en la cartera (función 'estudio', 50 al día) antes de llamar.

import { callClaude, CHEAP_MODEL, type Cartera, type Turn } from './anthropic.ts';
import { AI_SAFETY_RULES, REGLA_PRODUCTOS_FINANCIEROS } from './ai-safety.ts';
import { DATOS_ABRE, DATOS_CIERRA, neutralizarDatos, REGLA_DATOS, REGLA_SIN_GUIONES } from './prompt.ts';

export const TAREAS_ESTUDIO = ['flashcards', 'resumen', 'mapa', 'extracto', 'dieta', 'entreno'] as const;
export type TareaEstudio = (typeof TAREAS_ESTUDIO)[number];

/** Las que tocan cuerpo o comida: piden además el permiso de salud vigente (lo comprueba el handler). */
export const TAREAS_DE_SALUD: readonly TareaEstudio[] = ['dieta', 'entreno'];

/** Lo más largo que se acepta de texto de entrada (~10 k fichas). Lo demás se recorta. */
export const MAX_TEXTO_ESTUDIO = 40_000;

/** Techo de salida por tarea: la cota de la reserva sale de aquí. */
export const MAX_SALIDA_ESTUDIO: Record<TareaEstudio, number> = {
  flashcards: 2500,
  resumen: 1500,
  mapa: 2000,
  extracto: 3000,
  dieta: 2500,
  entreno: 2000,
};

const VOZ = `Eres una herramienta de NIVL que transforma el texto que te da el usuario. Español, claro y directo, sin emojis. No inventes datos que no estén en el texto. ${REGLA_SIN_GUIONES}`;

const ENCARGO: Record<TareaEstudio, string> = {
  flashcards:
    'Convierte el texto en tarjetas de estudio. Devuelve SOLO un array JSON de objetos {"frente": string, "dorso": string}, entre 5 y 30 tarjetas, una idea por tarjeta, frente como pregunta corta.',
  resumen:
    'Resume el texto para estudiarlo. Devuelve SOLO un objeto JSON {"titulo": string, "puntos": string[]} con 3 a 12 puntos, cada uno de una o dos frases.',
  mapa:
    'Haz un mapa conceptual del texto. Devuelve SOLO un objeto JSON {"centro": string, "ramas": [{"concepto": string, "hijos": string[]}]} con 3 a 8 ramas.',
  extracto: `Ordena los movimientos del extracto bancario pegado. Devuelve SOLO un array JSON de objetos {"fecha": "AAAA-MM-DD", "concepto": string, "importe": number} con el signo del extracto (negativo es gasto). No sumes ni deduzcas nada. ${REGLA_PRODUCTOS_FINANCIEROS}`,
  dieta:
    'Con lo que pide el usuario y su ficha, propone un menú orientativo de un día. Devuelve SOLO un objeto JSON {"comidas": [{"nombre": string, "platos": string[], "kcal_aprox": number}], "nota": string}. Es orientativo y no sustituye a un profesional.',
  entreno:
    'Con lo que pide el usuario y su ficha, propone UNA sesión de entrenamiento. Devuelve SOLO un objeto JSON {"ejercicios": [{"nombre": string, "series": number, "reps": string, "descanso_s": number}], "nota": string}. Respeta las lesiones de la ficha; ante dolor o síntomas, nada de prescripción.',
};

/** El sistema de una tarea: fijo por tarea (cacheable entre usuarios), con las reglas de seguridad. */
export function sistemaEstudio(tarea: TareaEstudio): string {
  return `${VOZ}\n\n# Tarea\n${ENCARGO[tarea]}\n\n${AI_SAFETY_RULES}\n\n${REGLA_DATOS}`;
}

export function esTareaEstudio(v: unknown): v is TareaEstudio {
  return typeof v === 'string' && (TAREAS_ESTUDIO as readonly string[]).includes(v);
}

/** Saca el primer JSON (objeto o array) de la respuesta; null si no hay uno válido. */
export function extraerJson(texto: string): unknown {
  const ini = [texto.indexOf('['), texto.indexOf('{')].filter((i) => i >= 0);
  if (!ini.length) return null;
  const desde = Math.min(...ini);
  const cierra = texto[desde] === '[' ? ']' : '}';
  const hasta = texto.lastIndexOf(cierra);
  if (hasta <= desde) return null;
  try {
    return JSON.parse(texto.slice(desde, hasta + 1));
  } catch {
    return null;
  }
}

export interface ResultadoEstudio {
  resultado: unknown;
  turn: Turn;
}

/** Una tarea de estudio con el modelo barato. `ficha` solo en dieta/entreno (ya con permiso de salud). */
export async function generarEstudio(
  tarea: TareaEstudio,
  texto: string,
  cartera: Cartera,
  ficha = '',
): Promise<ResultadoEstudio> {
  const entrada = [
    ficha.trim() ? `# Ficha del usuario\n${DATOS_ABRE}\n${neutralizarDatos(ficha.slice(0, 2000))}\n${DATOS_CIERRA}\n` : '',
    `# Texto del usuario\n${DATOS_ABRE}\n${neutralizarDatos(texto.slice(0, MAX_TEXTO_ESTUDIO))}\n${DATOS_CIERRA}`,
  ].join('\n');
  const turn = await callClaude({
    model: CHEAP_MODEL,
    system: [{ type: 'text', text: sistemaEstudio(tarea), cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: [{ type: 'text', text: entrada }] }],
    maxTokens: MAX_SALIDA_ESTUDIO[tarea],
    signal: AbortSignal.timeout(60_000),
    cartera,
  });
  const salida = turn.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
  return { resultado: extraerJson(salida), turn };
}
