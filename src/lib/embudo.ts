// NIVL · El embudo de entrada (Ónix, 1.1): las preguntas, el porcentaje de
// «Tu perfil», el veredicto y lo que se guarda. Puro, con tests.
//
// El cuestionario se contesta antes de tener cuenta y vive solo en el teléfono
// (embudoGuardado.ts). Al entrar, el onboarding lo convierte en el evento
// `onboarding_goal` de siempre. El detalle (cuánto lleva, qué le frena, tono…)
// va en la clave `reason`, que el trigger de `events` admite en una cuenta sin
// permiso de salud: es la única que acepta texto y no es un dato de salud.

import { t } from '@/i18n';
import type { ProfileKind } from '@/lib/kinds';

/** Las claves de opciones se componen en tiempo de ejecución: el tipado estricto de `t` no las ve. */
export const tx = t as unknown as (clave: string, opciones?: Record<string, unknown>) => string;

export type IdPregunta = 'mejora' | 'kind' | 'meta' | 'cuanto' | 'freno' | 'coach' | 'min' | 'mom';
export type Tono = 'duro' | 'tacto';

export interface Respuestas {
  mejora: string[];
  kind: ProfileKind | null;
  meta: string | null;
  cuanto: string | null;
  freno: string[];
  coach: string | null;
  min: string | null;
  mom: string | null;
  tono: Tono | null;
}

export const RESPUESTAS_VACIAS: Respuestas = {
  mejora: [],
  kind: null,
  meta: null,
  cuanto: null,
  freno: [],
  coach: null,
  min: null,
  mom: null,
  tono: null,
};

const KINDS_EMBUDO: readonly ProfileKind[] = ['deportista', 'estudiante', 'trabajador', 'emprendedor', 'general'];

export const METAS: Record<ProfileKind, readonly string[]> = {
  deportista: ['carrera', 'musculo', 'grasa', 'forma'],
  estudiante: ['oposicion', 'notas', 'examenes', 'procrastinar'],
  trabajador: ['ascenso', 'rendir', 'cambiar', 'vida'],
  emprendedor: ['facturar', 'clientes', 'ordenar', 'lanzarme'],
  general: ['disciplina', 'dormir', 'dinero', 'aprender'],
};

export const OPCIONES: Record<Exclude<IdPregunta, 'kind' | 'meta'>, readonly string[]> = {
  mejora: ['cuerpo', 'estudios', 'trabajo', 'negocio', 'disciplina', 'calma'],
  cuanto: ['semanas', 'meses', 'anio', 'anios'],
  freno: ['tiempo', 'dejo', 'empezar', 'exige', 'movil'],
  coach: ['funciono', 'nofunciono', 'nunca', 'caro'],
  min: ['15', '30', '60', '90'],
  mom: ['primera', 'media', 'tarde', 'noche'],
};

export const MULTIPLE: ReadonlySet<IdPregunta> = new Set<IdPregunta>(['mejora', 'freno']);

/** El guion del cuestionario. `crudo` y `curva` son pantallas sin respuesta en la barra. */
export const GUION = ['mejora', 'kind', 'meta', 'cuanto', 'freno', 'coach', 'crudo', 'min', 'mom', 'curva'] as const;
export type PasoGuion = (typeof GUION)[number];

/** La barra cuenta 12 tramos: el guion, la cuenta y el plan. Nunca baja del 5 %. */
export function porcentajeGuion(indice: number): number {
  return Math.min(100, Math.max(5, Math.round(((indice + 1) / 12) * 100)));
}

export function opcionesDe(id: IdPregunta, kind: ProfileKind | null): readonly string[] {
  if (id === 'kind') return KINDS_EMBUDO;
  if (id === 'meta') return METAS[kind ?? 'general'];
  return OPCIONES[id];
}

export function textoOpcion(id: IdPregunta, clave: string, kind: ProfileKind | null): string {
  if (id === 'meta') return tx(`onboarding:embudo.metas.${kind ?? 'general'}.${clave}`);
  return tx(`onboarding:embudo.preguntas.${id}.o.${clave}`);
}

export function respondida(id: IdPregunta, r: Respuestas): boolean {
  const v = r[id];
  return Array.isArray(v) ? v.length > 0 : v !== null;
}

export function elegir(id: IdPregunta, clave: string, r: Respuestas): Respuestas {
  if (MULTIPLE.has(id)) {
    const previo = r[id] as string[];
    const nuevo = previo.includes(clave) ? previo.filter((x) => x !== clave) : [...previo, clave];
    return { ...r, [id]: nuevo };
  }
  // Cambiar de perfil invalida la meta, que depende de él.
  if (id === 'kind' && r.kind !== clave) return { ...r, kind: clave as ProfileKind, meta: null };
  return { ...r, [id]: clave };
}

/** ¿Está lo que necesita el onboarding para no volver a preguntar? */
export function completas(r: Respuestas): boolean {
  return r.kind !== null && r.meta !== null && r.tono !== null && r.cuanto !== null && r.min !== null && r.freno.length > 0;
}

const METAS_SALUD = new Set(['carrera', 'musculo', 'grasa', 'forma', 'dormir']);
const MEJORA_SALUD = new Set(['cuerpo', 'calma']);

/** La meta elegida habla de cuerpo o salud: guardarla exige el permiso de salud. */
export function metaEsSalud(r: Respuestas): boolean {
  return r.meta !== null && METAS_SALUD.has(r.meta);
}

/** Algo de lo contestado es dato de salud, y por tanto hay que preguntar antes de guardar. */
export function necesitaPermisoSalud(r: Respuestas): boolean {
  return metaEsSalud(r) || r.mejora.some((m) => MEJORA_SALUD.has(m));
}

export function textoMeta(r: Respuestas): string {
  return r.meta ? tx(`onboarding:embudo.metas.${r.kind ?? 'general'}.${r.meta}`) : '';
}

/** El detalle del cuestionario como texto corto y sin datos libres. Tope del trigger: 500. */
export function resumenCuestionario(r: Respuestas, conSalud: boolean): string {
  const mejora = conSalud ? r.mejora : r.mejora.filter((m) => !MEJORA_SALUD.has(m));
  return [
    `tono:${r.tono ?? 'tacto'}`,
    `mejora:${mejora.join('+')}`,
    `lleva:${r.cuanto ?? ''}`,
    `freno:${r.freno.join('+')}`,
    `coach:${r.coach ?? ''}`,
    `min:${r.min ?? ''}`,
    `rinde:${r.mom ?? ''}`,
  ].join(';');
}

export interface PayloadObjetivo {
  health_data: boolean;
  goal: string | null;
  target: null;
  deadline: null;
  kind: ProfileKind | null;
  reason: string;
}

/**
 * El evento `onboarding_goal`. Sin permiso de salud, una meta de salud no se
 * guarda: se conserva el resto, que no lo es.
 */
export function payloadObjetivo(r: Respuestas, permisoSalud: boolean): PayloadObjetivo {
  const saludEnMeta = metaEsSalud(r);
  const guardaMeta = !saludEnMeta || permisoSalud;
  const saludGuardada = permisoSalud && necesitaPermisoSalud(r);
  return {
    health_data: saludGuardada,
    goal: guardaMeta ? textoMeta(r) || null : null,
    target: null,
    deadline: null,
    kind: r.kind,
    reason: resumenCuestionario(r, permisoSalud),
  };
}

export function veredicto(r: Respuestas): string {
  const cuanto = r.cuanto ? tx(`onboarding:embudo.preguntas.cuanto.o.${r.cuanto}`) : '';
  const clave = r.freno[0] ?? 'tiempo';
  const freno = tx(`onboarding:embudo.preguntas.freno.o.${clave}`).toLowerCase();
  const min = r.min ? tx(`onboarding:embudo.preguntas.min.o.${r.min}`).toLowerCase() : '';
  return tx(r.tono === 'duro' ? 'onboarding:embudo.veredicto.duro' : 'onboarding:embudo.veredicto.tacto', { cuanto, freno, min });
}

export interface Hito {
  cuando: string;
  titulo: string;
  detalle: string;
}

export function hitos(kind: ProfileKind | null): Hito[] {
  const k = kind ?? 'general';
  return (['hoy', 'sem4', 'dia90'] as const).map((h) => ({
    cuando: tx(`onboarding:embudo.plan.cuando.${h}`),
    titulo: tx(`onboarding:embudo.hitos.${k}.${h}.titulo`),
    detalle: tx(`onboarding:embudo.hitos.${k}.${h}.detalle`),
  }));
}

function listaValida(v: unknown, permitidas: readonly string[]): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && permitidas.includes(x)) : [];
}

function unaValida(v: unknown, permitidas: readonly string[]): string | null {
  return typeof v === 'string' && permitidas.includes(v) ? v : null;
}

/** Lee lo guardado en el teléfono sin fiarse de su forma. */
export function validarRespuestas(crudo: unknown): Respuestas | null {
  if (!crudo || typeof crudo !== 'object') return null;
  const o = crudo as Record<string, unknown>;
  const kind = unaValida(o.kind, KINDS_EMBUDO) as ProfileKind | null;
  const r: Respuestas = {
    mejora: listaValida(o.mejora, OPCIONES.mejora),
    kind,
    meta: kind ? unaValida(o.meta, METAS[kind]) : null,
    cuanto: unaValida(o.cuanto, OPCIONES.cuanto),
    freno: listaValida(o.freno, OPCIONES.freno),
    coach: unaValida(o.coach, OPCIONES.coach),
    min: unaValida(o.min, OPCIONES.min),
    mom: unaValida(o.mom, OPCIONES.mom),
    tono: o.tono === 'duro' || o.tono === 'tacto' ? o.tono : null,
  };
  return r;
}
