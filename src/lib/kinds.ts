// NIVL · Para qué usa NIVL cada persona.
//
// La app nació para una sola persona. Abierta a la gente de Franky, la misma
// mecánica (misiones, XP, racha, campañas, coach) tiene que hablarle a un
// emprendedor, a un profesional con su jornada, a un deportista y a un
// estudiante sin que ninguno vea primero lo que no le importa. Aquí vive esa diferencia: qué módulos van delante,
// qué hábitos se proponen el primer día y cómo se llaman las campañas.
//
// Módulo PURO: sin imports de Supabase, para que los tests arranquen.

import type { Difficulty, Stat } from './types';

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

export const MODULES: readonly ModuleMeta[] = [
  { id: 'gym', label: 'Gym', icon: 'barbell-outline', route: '/gym' },
  { id: 'cardio', label: 'Cardio', icon: 'walk-outline', route: '/cardio' },
  { id: 'nutricion', label: 'Nutrición', icon: 'nutrition-outline', route: '/nutricion' },
  { id: 'dieta', label: 'Dieta', icon: 'restaurant-outline', route: '/dieta' },
  { id: 'economia', label: 'Economía', icon: 'wallet-outline', route: '/economia' },
  { id: 'compra', label: 'Compra', icon: 'cart-outline', route: '/compra' },
  { id: 'diario', label: 'Diario', icon: 'book-outline', route: '/diario' },
  { id: 'informe', label: 'Informe', icon: 'stats-chart-outline', route: '/informe' },
  { id: 'avances', label: 'Avances', icon: 'trending-up-outline', route: '/avances' },
  { id: 'resumen', label: 'Recuerdos', icon: 'images-outline', route: '/resumen' },
  { id: 'oraculo', label: 'Oráculo', icon: 'sparkles-outline', route: '/oraculo' },
  { id: 'contrato', label: 'Contrato', icon: 'document-text-outline', route: '/contrato' },
  { id: 'amigos', label: 'Amigos', icon: 'people-outline', route: '/amigos' },
];

export interface StarterQuest {
  title: string;
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
}

const LABORABLES = [1, 2, 3, 4, 5];
const DIARIO = [1, 2, 3, 4, 5, 6, 7];

export const KINDS: Record<ProfileKind, KindMeta> = {
  emprendedor: {
    id: 'emprendedor',
    label: 'Emprendedor',
    title: 'EMPRENDEDOR',
    icon: 'rocket-outline',
    tagline: 'Ventas, foco y caja. Cada día una acción que mueva el negocio.',
    description:
      'Economía y contrato delante. Proyectos con jefe final y fecha. El coach te pide números: contactos, cierres, ingresos.',
    campaignsLabel: 'Proyectos',
    campaignsHint: 'Un proyecto es una campaña: tareas, un jefe final y una fecha. Al despejarlo hay botín.',
    primaryModules: ['economia', 'contrato', 'amigos', 'informe', 'avances', 'diario', 'oraculo'],
    goalExample: 'Facturar 5.000 € al mes con mi negocio',
    starterQuests: [
      { title: 'Prospección: 10 contactos', stat: 'AGI', difficulty: 'media', days_of_week: LABORABLES, requires_evidence: false },
      { title: 'Bloque de trabajo profundo 2 h', stat: 'INT', difficulty: 'media', days_of_week: LABORABLES, requires_evidence: false },
      { title: 'Revisar métricas del negocio', stat: 'PER', difficulty: 'facil', days_of_week: LABORABLES, requires_evidence: false },
      { title: 'Entrenar', stat: 'FUE', difficulty: 'media', days_of_week: [1, 3, 5], requires_evidence: false },
      { title: 'Leer 20 minutos', stat: 'INT', difficulty: 'facil', days_of_week: DIARIO, requires_evidence: false },
      { title: 'Diario del día', stat: 'PER', difficulty: 'facil', days_of_week: DIARIO, requires_evidence: false },
    ],
    coachHint:
      'Es emprendedor: su campo de batalla son las ventas, el foco y la caja. Pide cifras de embudo (contactos, reuniones, cierres, ingresos) y ordena acciones que muevan el negocio hoy. El cuerpo se cuida para rendir, no es el centro.',
  },
  trabajador: {
    id: 'trabajador',
    label: 'Profesional',
    title: 'PROFESIONAL',
    icon: 'briefcase-outline',
    tagline: 'Crecer en tu trabajo sin descuidar el cuerpo. Foco en la jornada, orden fuera de ella.',
    description:
      'Informe, avances y diario delante, con el gym y la economía a mano. Objetivos de carrera con hito final y fecha. El coach protege tus bloques de foco y encaja entreno, comida y descanso alrededor de tu jornada.',
    campaignsLabel: 'Objetivos',
    campaignsHint: 'Un objetivo profesional es una campaña: pasos como tareas, un hito final y una fecha. Al cumplirlo hay botín.',
    primaryModules: ['informe', 'avances', 'amigos', 'diario', 'gym', 'economia', 'contrato'],
    goalExample: 'Conseguir el ascenso a responsable de equipo',
    starterQuests: [
      { title: 'Bloque de foco 90 min sin interrupciones', stat: 'INT', difficulty: 'media', days_of_week: LABORABLES, requires_evidence: false },
      { title: 'Planificar la jornada antes de empezar', stat: 'PER', difficulty: 'facil', days_of_week: LABORABLES, requires_evidence: false },
      { title: 'Formación en tu oficio 30 min', stat: 'INT', difficulty: 'facil', days_of_week: LABORABLES, requires_evidence: false },
      { title: 'Entrenar', stat: 'FUE', difficulty: 'media', days_of_week: [1, 3, 5], requires_evidence: false },
      { title: 'Dormir 7 horas', stat: 'VIT', difficulty: 'facil', days_of_week: DIARIO, requires_evidence: false },
      { title: 'Diario del día', stat: 'PER', difficulty: 'facil', days_of_week: DIARIO, requires_evidence: false },
    ],
    coachHint:
      'Es un profesional por cuenta ajena: quiere crecer en su trabajo y mantener salud y hábitos en orden. Su jornada es fija y no se negocia: protege uno o dos bloques de foco dentro de ella, pregunta por entregas, aprendizaje y objetivos de carrera (ascenso, cambio, certificación), y encaja entreno, comida y sueño antes o después del trabajo sin cargar los días largos.',
  },
  deportista: {
    id: 'deportista',
    label: 'Deportista',
    title: 'DEPORTISTA',
    icon: 'barbell-outline',
    tagline: 'Entreno, comida y descanso. El progreso se mide en kilos, ritmo y constancia.',
    description:
      'Gym, cardio, nutrición y dieta delante. Bloques de temporada con objetivo y fecha. El coach prescribe cargas con tu RPE y ajusta la dieta con tu tendencia de peso.',
    campaignsLabel: 'Bloques',
    campaignsHint: 'Un bloque de temporada es una campaña: sesiones, un objetivo final y una fecha. Al cumplirlo hay botín.',
    primaryModules: ['gym', 'cardio', 'amigos', 'nutricion', 'dieta', 'avances', 'compra'],
    goalExample: 'Bajar a 78 kg sin perder fuerza',
    starterQuests: [
      { title: 'Entrenar', stat: 'FUE', difficulty: 'media', days_of_week: LABORABLES, requires_evidence: false },
      { title: 'Registrar comidas del día', stat: 'VIT', difficulty: 'facil', days_of_week: DIARIO, requires_evidence: false },
      { title: 'Dormir 8 horas', stat: 'VIT', difficulty: 'facil', days_of_week: DIARIO, requires_evidence: false },
      { title: 'Movilidad 10 minutos', stat: 'AGI', difficulty: 'trivial', days_of_week: DIARIO, requires_evidence: false },
      { title: 'Pesarse', stat: 'VIT', difficulty: 'trivial', days_of_week: [1, 4], requires_evidence: false },
      { title: 'Diario del día', stat: 'PER', difficulty: 'facil', days_of_week: DIARIO, requires_evidence: false },
    ],
    coachHint:
      'Es deportista: el entreno, la comida y el descanso son el centro. Programa sobre el estudio (1RM, RPE, ritmo por zona, tendencia de peso), exige registro de sesiones y comidas, y protege el descanso como parte del plan.',
  },
  estudiante: {
    id: 'estudiante',
    label: 'Estudiante',
    title: 'ESTUDIANTE',
    icon: 'school-outline',
    tagline: 'Horas de estudio reales, exámenes como jefes finales y una cabeza despejada.',
    description:
      'Diario, informe y avances delante. Asignaturas con el examen como jefe final. El coach reparte el estudio por bloques y vigila que descanses.',
    campaignsLabel: 'Asignaturas',
    campaignsHint: 'Una asignatura es una campaña: temas como tareas, el examen como jefe y su fecha. Al aprobarla hay botín.',
    primaryModules: ['diario', 'informe', 'amigos', 'avances', 'oraculo', 'contrato', 'resumen'],
    goalExample: 'Aprobar las cuatro asignaturas de junio',
    starterQuests: [
      { title: 'Estudiar 2 h', stat: 'INT', difficulty: 'media', days_of_week: LABORABLES, requires_evidence: false },
      { title: 'Repasar apuntes 20 min', stat: 'INT', difficulty: 'facil', days_of_week: DIARIO, requires_evidence: false },
      { title: 'Sin móvil en clase', stat: 'AGI', difficulty: 'facil', days_of_week: LABORABLES, requires_evidence: false },
      { title: 'Entrenar', stat: 'FUE', difficulty: 'media', days_of_week: [1, 3, 5], requires_evidence: false },
      { title: 'Leer 20 minutos', stat: 'INT', difficulty: 'facil', days_of_week: DIARIO, requires_evidence: false },
      { title: 'Diario del día', stat: 'PER', difficulty: 'facil', days_of_week: DIARIO, requires_evidence: false },
    ],
    coachHint:
      'Es estudiante: las horas de estudio reales y los exámenes son el centro. Reparte el estudio en bloques con materia concreta, trata cada examen como el jefe de su campaña con fecha, y vigila el sueño en época de exámenes.',
  },
  general: {
    id: 'general',
    label: 'En general',
    title: 'GLADIADOR',
    icon: 'shield-outline',
    tagline: 'Cuerpo, cabeza y hábitos. Un 1 % mejor cada día, en lo que tú decidas.',
    description:
      'Todos los módulos a la vista. Campañas para cualquier reto con fecha. El coach te pregunta qué quieres conquistar y lo convierte en misiones.',
    campaignsLabel: 'Campañas',
    campaignsHint: 'Una campaña es un reto con fecha: tareas, un jefe final y botín al despejarla.',
    primaryModules: ['gym', 'cardio', 'amigos', 'nutricion', 'dieta', 'economia', 'compra', 'diario', 'informe', 'avances', 'resumen', 'oraculo', 'contrato'],
    goalExample: 'Entrenar cuatro días por semana durante un año',
    starterQuests: [
      { title: 'Entrenar', stat: 'FUE', difficulty: 'media', days_of_week: LABORABLES, requires_evidence: false },
      { title: 'Trabajo o estudio 2 h', stat: 'INT', difficulty: 'media', days_of_week: LABORABLES, requires_evidence: false },
      { title: 'Registrar comidas del día', stat: 'VIT', difficulty: 'facil', days_of_week: DIARIO, requires_evidence: false },
      { title: 'Leer 20 minutos', stat: 'INT', difficulty: 'facil', days_of_week: DIARIO, requires_evidence: false },
      { title: 'Diario del día', stat: 'PER', difficulty: 'facil', days_of_week: DIARIO, requires_evidence: false },
    ],
    coachHint:
      'Perfil general: no hay un dominio dominante. Pregunta qué quiere conquistar esta temporada y reparte el esfuerzo entre cuerpo, cabeza y hábitos sin cargar todo el mismo día.',
  },
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
