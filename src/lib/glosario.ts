// NIVL · Primer uso: la lista de palabras del juego que la app puede explicar.
//
// Módulo puro (sin Supabase, sin React, sin i18n). Aquí solo están los ids, en
// qué grupo va cada uno y si tiene un segundo párrafo con el detalle. Los
// textos viven en el namespace `ayuda` (src/i18n/<lng>/ayuda.json, bajo
// `terminos.<id>`): `titulo` y `definicion` siempre, `detalle` si `detalle: true`.
//
// Las cifras de las definiciones las contrasta el test con game.ts, closing.ts,
// habits.ts y elite.ts: si cambia una regla, el test obliga a reescribir el texto.
// Los atributos usan el mismo código que `Stat` (FUE, VIT...), así se puede
// escribir <Termino termino={quest.stat}> sin traducir nada.

/** Cómo se agrupan en la lista completa, en este orden. */
export const GRUPOS_GLOSARIO = ['dia', 'progreso', 'habitos', 'campanas', 'ayudantes'] as const;
export type GrupoGlosario = (typeof GRUPOS_GLOSARIO)[number];

export const TERMINOS = [
  { id: 'misiones', grupo: 'dia', detalle: true },
  { id: 'dificultad', grupo: 'dia', detalle: false },
  { id: 'evidencia', grupo: 'dia', detalle: false },
  { id: 'cierre', grupo: 'dia', detalle: false },
  { id: 'racha', grupo: 'dia', detalle: true },
  { id: 'penalizacion', grupo: 'dia', detalle: true },
  { id: 'piedras', grupo: 'dia', detalle: true },
  { id: 'pausa', grupo: 'dia', detalle: false },

  { id: 'xp', grupo: 'progreso', detalle: true },
  { id: 'nivel', grupo: 'progreso', detalle: true },
  { id: 'rango', grupo: 'progreso', detalle: true },
  { id: 'stats', grupo: 'progreso', detalle: true },
  { id: 'FUE', grupo: 'progreso', detalle: false },
  { id: 'VIT', grupo: 'progreso', detalle: false },
  { id: 'INT', grupo: 'progreso', detalle: false },
  { id: 'AGI', grupo: 'progreso', detalle: false },
  { id: 'PER', grupo: 'progreso', detalle: false },

  { id: 'forja', grupo: 'habitos', detalle: false },
  { id: 'adquirido', grupo: 'habitos', detalle: false },
  { id: 'contrato', grupo: 'habitos', detalle: true },
  { id: 'puntosBonus', grupo: 'habitos', detalle: false },

  { id: 'campana', grupo: 'campanas', detalle: false },
  { id: 'jefe', grupo: 'campanas', detalle: false },
  { id: 'botin', grupo: 'campanas', detalle: false },

  { id: 'coach', grupo: 'ayudantes', detalle: false },
  { id: 'oraculo', grupo: 'ayudantes', detalle: false },
  { id: 'modos', grupo: 'ayudantes', detalle: true },
  { id: 'elite', grupo: 'ayudantes', detalle: true },
  { id: 'ludus', grupo: 'ayudantes', detalle: false },
] as const satisfies readonly { id: string; grupo: GrupoGlosario; detalle: boolean }[];

type Entrada = (typeof TERMINOS)[number];

export type TerminoId = Entrada['id'];
/** Los términos con segundo párrafo: solo estos tienen la clave `detalle` en el catálogo. */
export type TerminoConDetalle = Extract<Entrada, { detalle: true }>['id'];

const POR_ID = new Map<string, Entrada>(TERMINOS.map((e) => [e.id, e]));

export function esTermino(valor: unknown): valor is TerminoId {
  return typeof valor === 'string' && POR_ID.has(valor);
}

export function tieneDetalle(id: TerminoId): id is TerminoConDetalle {
  return POR_ID.get(id)?.detalle === true;
}

/** Los términos de un grupo, en el orden de la lista. */
export function terminosDeGrupo(grupo: GrupoGlosario): TerminoId[] {
  return TERMINOS.filter((e) => e.grupo === grupo).map((e) => e.id);
}
