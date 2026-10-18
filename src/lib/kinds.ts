// NIVL · Para qué usa NIVL cada persona.
//
// La app nació para una sola persona. Abierta a la gente de Franky, la misma
// mecánica (misiones, XP, racha, campañas, coach) tiene que hablarle a un
// emprendedor, a un profesional con su jornada, a un deportista y a un
// estudiante sin que ninguno vea primero lo que no le importa. Aquí vive esa diferencia: qué módulos van delante,
// qué hábitos se proponen el primer día y cómo se llaman las campañas.
//
// Módulo PURO: sin imports de Supabase, para que los tests arranquen.
//
// QA F1 (M4): los textos que se ven (nombres, rótulos, ejemplos, misiones
// propuestas y módulos) salen del catálogo `juego` al leerlos (textosVivos.ts);
// en español dicen lo de siempre. `coachHint` no se ve: es para el coach y se
// queda en español, como su copia en supabase/functions/_shared/kinds.ts.

import { t } from '@/i18n';
import { idiomaInterfazActual } from '@/i18n/estado';
import { conTextos } from './textosVivos';
import type { ActLink, Difficulty, Stat } from './types';

// Al añadir un perfil: el CHECK de `profiles.profile_kind` va en una migración
// nueva (0018 → 0022) y el coach tiene su copia en supabase/functions/_shared/kinds.ts.
export type ProfileKind = 'emprendedor' | 'trabajador' | 'deportista' | 'estudiante' | 'general';

export const PROFILE_KINDS: readonly ProfileKind[] = ['emprendedor', 'trabajador', 'deportista', 'estudiante', 'general'];

export function isProfileKind(value: unknown): value is ProfileKind {
  return typeof value === 'string' && (PROFILE_KINDS as readonly string[]).includes(value);
}

export type ModuleId =
  | 'gym'
  | 'cardio'
  | 'nutricion'
  | 'dieta'
  | 'economia'
  | 'compra'
  | 'diario'
  | 'informe'
  | 'avances'
  | 'resumen'
  | 'oraculo'
  | 'contrato'
  | 'amigos';

export type ModuleRoute =
  | '/gym'
  | '/cardio'
  | '/nutricion'
  | '/dieta'
  | '/economia'
  | '/compra'
  | '/diario'
  | '/informe'
  | '/avances'
  | '/resumen'
  | '/oraculo'
  | '/contrato'
  | '/amigos';

export interface ModuleMeta {
  id: ModuleId;
  label: string;
  /** Nombre de Ionicons. */
  icon: string;
  route: ModuleRoute;
}

function modulo(id: ModuleId, icon: string, route: ModuleRoute): ModuleMeta {
  return conTextos({ id, icon, route }, { label: () => t(`juego:modulo.${id}`) });
}

export const MODULES: readonly ModuleMeta[] = [
  modulo('gym', 'barbell-outline', '/gym'),
  modulo('cardio', 'walk-outline', '/cardio'),
  modulo('nutricion', 'nutrition-outline', '/nutricion'),
  modulo('dieta', 'restaurant-outline', '/dieta'),
  modulo('economia', 'wallet-outline', '/economia'),
  modulo('compra', 'cart-outline', '/compra'),
  modulo('diario', 'book-outline', '/diario'),
  modulo('informe', 'stats-chart-outline', '/informe'),
  modulo('avances', 'trending-up-outline', '/avances'),
  modulo('resumen', 'images-outline', '/resumen'),
  modulo('oraculo', 'sparkles-outline', '/oraculo'),
  modulo('contrato', 'document-text-outline', '/contrato'),
  modulo('amigos', 'people-outline', '/amigos'),
];

export interface StarterQuest {
  health_data?: boolean;
  title: string;
  /**
   * El acto que la marca sola (0019). En español no hace falta: el trigger
   * `infer_link` lo deduce del título. Traducido, el título ya no lo dice y el
   * enlace va explícito (solo fuera del español, para no cambiar nada en es).
   */
  link?: ActLink;
  stat: Stat;
  difficulty: Difficulty;
  days_of_week: number[];
  requires_evidence: boolean;
}

export interface KindMeta {
  id: ProfileKind;
  /** Nombre corto para tarjetas y ajustes. */
  label: string;
  /** Vocativo en mayúsculas para la cabecera del perfil ("EMPRENDEDOR · RANGO C"). */
  title: string;
  /** Nombre de Ionicons. */
  icon: string;
  /** Una línea que resume qué mide NIVL para este perfil. */
  tagline: string;
  /** Qué se activa al elegirlo; se enseña en el onboarding. */
  description: string;
  /** Cómo se llaman las campañas (la pestaña de proyectos) para este perfil. */
  campaignsLabel: string;
  campaignsHint: string;
  /** Módulos que van delante en la pantalla de hoy, en este orden. */
  primaryModules: readonly ModuleId[];
  /** Ejemplo de objetivo concreto para el onboarding: enseña el nivel de detalle que se pide. */
  goalExample: string;
  /** Hábitos propuestos el primer día. El usuario elige cuáles crear. */
  starterQuests: readonly StarterQuest[];
  /** Instrucción breve para el coach: cambia el énfasis, no las leyes. */
  coachHint: string;
  /** El perfil dentro de una frase: «deportista», «en general». */
  enFrase: string;
}

const LABORABLES = [1, 2, 3, 4, 5];
const DIARIO = [1, 2, 3, 4, 5, 6, 7];

/** Las misiones propuestas, por su clave en `juego:mision`. */
type MisionId =
  | 'prospeccion'
  | 'trabajoProfundo'
  | 'metricas'
  | 'entrenar'
  | 'leer'
  | 'diario'
  | 'foco'
  | 'planificar'
  | 'formacion'
  | 'dormir7'
  | 'comidas'
  | 'dormir8'
  | 'movilidad'
  | 'pesarse'
  | 'estudiar'
  | 'repasar'
  | 'sinMovil'
  | 'trabajoEstudio';

/** Lo que `infer_link` deduce de su título en español (0019). */
const VINCULO: Partial<Record<MisionId, ActLink>> = { entrenar: 'gym', diario: 'diario', pesarse: 'peso', comidas: 'nutricion' };

function mision(id: MisionId, stat: Stat, difficulty: Difficulty, days_of_week: number[], salud = false): StarterQuest {
  const q = conTextos(
    { ...(salud ? { health_data: true } : {}), stat, difficulty, days_of_week, requires_evidence: false },
    { title: () => t(`juego:mision.${id}`) },
  ) as StarterQuest;
  const vinculo = VINCULO[id];
  if (vinculo) {
    Object.defineProperty(q, 'link', {
      enumerable: true,
      get: () => (idiomaInterfazActual() === 'es' ? undefined : vinculo),
    });
  }
  return q;
}

type CampoPerfil = 'label' | 'title' | 'tagline' | 'description' | 'campaignsLabel' | 'campaignsHint' | 'goalExample' | 'enFrase';
const CAMPOS_PERFIL: readonly CampoPerfil[] = ['label', 'title', 'tagline', 'description', 'campaignsLabel', 'campaignsHint', 'goalExample', 'enFrase'];

function perfil(id: ProfileKind, datos: Pick<KindMeta, 'icon' | 'primaryModules' | 'starterQuests' | 'coachHint'>): KindMeta {
  const textos = {} as Record<CampoPerfil, () => string>;
  for (const c of CAMPOS_PERFIL) textos[c] = () => t(`juego:perfil.${id}.${c}`);
  return conTextos({ id, ...datos }, textos);
}

export const KINDS: Record<ProfileKind, KindMeta> = {
  emprendedor: perfil('emprendedor', {
    icon: 'rocket-outline',
    primaryModules: ['economia', 'contrato', 'amigos', 'informe', 'avances', 'diario', 'oraculo'],
    starterQuests: [
      mision('prospeccion', 'AGI', 'media', LABORABLES),
      mision('trabajoProfundo', 'INT', 'media', LABORABLES),
      mision('metricas', 'PER', 'facil', LABORABLES),
      mision('entrenar', 'FUE', 'media', [1, 3, 5], true),
      mision('leer', 'INT', 'facil', DIARIO),
      mision('diario', 'PER', 'facil', DIARIO, true),
    ],
    coachHint:
      'Es emprendedor: su campo de batalla son las ventas, el foco y la caja. Pide cifras de embudo (contactos, reuniones, cierres, ingresos) y ordena acciones que muevan el negocio hoy. El cuerpo se cuida para rendir, no es el centro.',
  }),
  trabajador: perfil('trabajador', {
    icon: 'briefcase-outline',
    primaryModules: ['informe', 'avances', 'amigos', 'diario', 'gym', 'economia', 'contrato'],
    starterQuests: [
      mision('foco', 'INT', 'media', LABORABLES),
      mision('planificar', 'PER', 'facil', LABORABLES),
      mision('formacion', 'INT', 'facil', LABORABLES),
      mision('entrenar', 'FUE', 'media', [1, 3, 5], true),
      mision('dormir7', 'VIT', 'facil', DIARIO, true),
      mision('diario', 'PER', 'facil', DIARIO, true),
    ],
    coachHint:
      'Es un profesional por cuenta ajena: quiere crecer en su trabajo y mantener salud y hábitos en orden. Su jornada es fija y no se negocia: protege uno o dos bloques de foco dentro de ella, pregunta por entregas, aprendizaje y objetivos de carrera (ascenso, cambio, certificación), y encaja entreno, comida y sueño antes o después del trabajo sin cargar los días largos.',
  }),
  deportista: perfil('deportista', {
    icon: 'barbell-outline',
    primaryModules: ['gym', 'cardio', 'amigos', 'nutricion', 'dieta', 'avances', 'compra'],
    starterQuests: [
      mision('entrenar', 'FUE', 'media', LABORABLES, true),
      mision('comidas', 'VIT', 'facil', DIARIO, true),
      mision('dormir8', 'VIT', 'facil', DIARIO, true),
      mision('movilidad', 'AGI', 'trivial', DIARIO, true),
      mision('pesarse', 'VIT', 'trivial', [1, 4], true),
      mision('diario', 'PER', 'facil', DIARIO, true),
    ],
    coachHint:
      'Es deportista: el entreno, la comida y el descanso son el centro. Programa sobre el estudio (1RM, RPE, ritmo por zona, tendencia de peso), exige registro de sesiones y comidas, y protege el descanso como parte del plan.',
  }),
  estudiante: perfil('estudiante', {
    icon: 'school-outline',
    primaryModules: ['diario', 'informe', 'amigos', 'avances', 'oraculo', 'contrato', 'resumen'],
    starterQuests: [
      mision('estudiar', 'INT', 'media', LABORABLES),
      mision('repasar', 'INT', 'facil', DIARIO),
      mision('sinMovil', 'AGI', 'facil', LABORABLES),
      mision('entrenar', 'FUE', 'media', [1, 3, 5], true),
      mision('leer', 'INT', 'facil', DIARIO),
      mision('diario', 'PER', 'facil', DIARIO, true),
    ],
    coachHint:
      'Es estudiante: las horas de estudio reales y los exámenes son el centro. Reparte el estudio en bloques con materia concreta, trata cada examen como el jefe de su campaña con fecha, y vigila el sueño en época de exámenes.',
  }),
  general: perfil('general', {
    icon: 'shield-outline',
    primaryModules: ['gym', 'cardio', 'amigos', 'nutricion', 'dieta', 'economia', 'compra', 'diario', 'informe', 'avances', 'resumen', 'oraculo', 'contrato'],
    starterQuests: [
      mision('entrenar', 'FUE', 'media', LABORABLES, true),
      mision('trabajoEstudio', 'INT', 'media', LABORABLES),
      mision('comidas', 'VIT', 'facil', DIARIO, true),
      mision('leer', 'INT', 'facil', DIARIO),
      mision('diario', 'PER', 'facil', DIARIO, true),
    ],
    coachHint:
      'Perfil general: no hay un dominio dominante. Pregunta qué quiere conquistar esta temporada y reparte el esfuerzo entre cuerpo, cabeza y hábitos sin cargar todo el mismo día.',
  }),
};

/** Devuelve la meta del perfil; con un valor desconocido (fila vieja) cae en general. */
export function kindMeta(kind: unknown): KindMeta {
  return isProfileKind(kind) ? KINDS[kind] : KINDS.general;
}

/**
 * Módulos en el orden de la pantalla de hoy: los del perfil delante, el resto
 * detrás. Nunca se oculta nada: un deportista puede llevar su economía, pero
 * no tiene por qué verla primero.
 */
export function modulesFor(kind: unknown): { primary: ModuleMeta[]; secondary: ModuleMeta[] } {
  const meta = kindMeta(kind);
  const byId = new Map(MODULES.map((m) => [m.id, m]));
  const primary: ModuleMeta[] = [];
  for (const id of meta.primaryModules) {
    const m = byId.get(id);
    if (m) primary.push(m);
  }
  const chosen = new Set<ModuleId>(meta.primaryModules);
  const secondary = MODULES.filter((m) => !chosen.has(m.id));
  return { primary, secondary };
}
