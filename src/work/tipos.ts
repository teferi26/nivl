// NIVL · WORK: los tipos y las constantes del núcleo (puro). docs/modos/WORK.md
//
// Sin imports de Supabase ni de React Native. Lo que la pantalla enseña sale de
// aquí como códigos (`Motivo`), no como frases: el texto vive en i18n y el
// coach tiene su espejo en supabase/functions/_shared/.

// ── Topes ─────────────────────────────────────────────────────────────
export const MAX_PRIORIDADES = 3;
export const MAX_TITULO_PRIORIDAD = 120;
/** Las duraciones que se ofrecen al empezar un bloque. */
export const DURACIONES_BLOQUE = [25, 50, 90] as const;
export const MINUTOS_BLOQUE_DEFECTO = 50;
export const MIN_OBJETIVO_BLOQUE = 10;
export const MAX_OBJETIVO_BLOQUE = 180;
/** Por debajo de esto un bloque no marca misión, aunque llegue a su objetivo. */
export const MIN_MINUTOS_MISION = 25;
/** Parte del objetivo que hay que haber trabajado para que el bloque cuente. */
export const FRACCION_OBJETIVO = 0.8;
/** Por debajo de esto no se guarda ni como horas: es un falso comienzo. */
export const MIN_MINUTOS_SESION = 5;
/** Un evento con hora de inicio y sin hora de fin dura esto. */
export const DURACION_EVENTO_DEFECTO = 45;
/** Hasta dónde se reparte el trabajo pendiente del día. */
export const FIN_JORNADA_MIN = 19 * 60;
/** A partir de aquí una sesión cuenta como trabajo de tarde. */
export const HORA_TARDE_MIN = 20 * 60;

// ── Motivos (legibles vía i18n: `trabajo:motivo.<codigo>`) ────────────
export const CODIGOS_MOTIVO = [
  'bloque_en_curso',
  'bloque_pausado',
  'reunion_en_curso',
  'reunion_cerca',
  'plan_ahora',
  'hueco_corto',
  'prioridad_primera',
  'prioridad_siguiente',
  'mision_fija',
  'fuera_de_jornada',
  'entrega_atrasada',
  'entrega_hoy',
  'entrega_cerca',
  'planificar',
  'recuperar',
  'dia_cerrado',
  'soltar_no_cabe',
  'soltar_carga',
  'semana_entrega',
  'semana_pendiente',
  'semana_proyecto',
] as const;
export type CodigoMotivo = (typeof CODIGOS_MOTIVO)[number];

export interface Motivo {
  codigo: CodigoMotivo;
  vars?: Record<string, string | number>;
}

// ── Lo que viene de fuera del módulo (src/work/adaptar.ts) ────────────
export interface MisionTrabajo {
  id: string;
  titulo: string;
  hecha: boolean;
  penalizacion: boolean;
  /** XP base por dificultad (solo para enseñarlo discreto y estimar esfuerzo). */
  xp: number;
  /** quests.work_day: la fecha si es una prioridad de un solo día; null si es fija. */
  diaPrioridad: string | null;
  /** quests.work_rank: 1 a 3, en el orden en que se escribieron. */
  rango: number | null;
  creadaEn: string | null;
}

export interface BloquePlan {
  id: string;
  inicio: number;
  fin: number;
  titulo: string;
  tipo: string;
  hecho: boolean;
  questId: string | null;
}

export type OrigenEvento = 'manual' | 'dispositivo';

export interface EventoTrabajo {
  id: string;
  titulo: string;
  fecha: string;
  /** Minutos locales; null = todo el día (no ocupa hueco). */
  inicio: number | null;
  fin: number | null;
  origen: OrigenEvento;
}

// ── Tablas de la 0115 ─────────────────────────────────────────────────
export type EstadoProyecto = 'activo' | 'pausado' | 'cerrado';

export interface Proyecto {
  id: string;
  nombre: string;
  cliente: string | null;
  /** Por hora, informativa y sin impuestos. null = sin tarifa. */
  tarifaHora: number | null;
  estado: EstadoProyecto;
  posicion: number;
}

export interface Entrega {
  id: string;
  proyectoId: string | null;
  titulo: string;
  /** 'YYYY-MM-DD' o null si no tiene fecha. */
  fecha: string | null;
  hecha: boolean;
  hechaEl: string | null;
  posicion: number;
}

export type TipoSesion = 'bloque' | 'manual';

export interface SesionTrabajo {
  id: string;
  clientId: string;
  proyectoId: string | null;
  entregaId: string | null;
  questId: string | null;
  tipo: TipoSesion;
  /** Día local en que EMPEZÓ. */
  fecha: string;
  inicioMin: number | null;
  minutos: number;
  facturable: boolean;
  facturadaEl: string | null;
  nota: string | null;
}

/** Una línea de la revisión tal como queda guardada. */
export interface ItemRevision {
  titulo: string;
  origen: 'entrega' | 'mision' | 'proyecto';
  /** Solo en «lo que se quedó»: por qué, si se dijo. */
  razon?: RazonQuedo;
}

export const RAZONES_QUEDO = ['tiempo', 'imprevisto', 'esperando', 'no_importa'] as const;
export type RazonQuedo = (typeof RAZONES_QUEDO)[number];

export interface Revision {
  id: string;
  /** El lunes de la semana revisada. */
  semana: string;
  cerrado: ItemRevision[];
  seQuedo: ItemRevision[];
  prioridades: string[];
  minutosProfundos: number;
  minutosTotales: number;
  minutosReunion: number;
  nota: string | null;
}

export interface DatosWork {
  proyectos: Proyecto[];
  entregas: Entrega[];
  /** Últimos 60 días. */
  sesiones: SesionTrabajo[];
  revisiones: Revision[];
  /** De hace 14 días a dentro de 14. */
  eventos: EventoTrabajo[];
}

export const DATOS_VACIOS: DatosWork = { proyectos: [], entregas: [], sesiones: [], revisiones: [], eventos: [] };

const ESTADOS_PROYECTO: readonly string[] = ['activo', 'pausado', 'cerrado'];
export const esEstadoProyecto = (v: unknown): v is EstadoProyecto => typeof v === 'string' && ESTADOS_PROYECTO.includes(v);

// ── Normalización de texto (para comparar y no duplicar) ──────────────
export const normal = (s: string): string =>
  s
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
