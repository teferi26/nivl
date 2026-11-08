// NIVL · Gafas Meta: el contrato entre la lógica pura, la fachada y el nativo.
//
// Solo tipos y constantes: sin React Native, sin Supabase y sin nada de src/
// que arrastre efectos. Las formas de entrada son las mínimas que hacen falta y
// se rellenan desde lo que ya existe en la app (Prescription, DayBlock, Quest).

/** Estado de las gafas tal como lo ve la app. */
export type EstadoGafas =
  | 'no_disponible'
  | 'sin_registrar'
  | 'registrando'
  | 'desconectadas'
  | 'conectadas';

export const ESTADOS_GAFAS: readonly EstadoGafas[] = [
  'no_disponible',
  'sin_registrar',
  'registrando',
  'desconectadas',
  'conectadas',
];

/** Los tres estilos de texto de la pantalla de 600x600. */
export type EstiloTexto = 'heading' | 'body' | 'meta';

export interface LineaTarjeta {
  estilo: EstiloTexto;
  texto: string;
}

export interface BotonTarjeta {
  id: 'hecho';
  texto: 'Hecho';
}

export type TipoTarjeta = 'serie' | 'cardio' | 'mision' | 'estudio' | 'vacia';

/** Lo que se pinta en las gafas o, si no tienen pantalla, se lee por audio. */
export interface Tarjeta {
  id: string;
  tipo: TipoTarjeta;
  lineas: LineaTarjeta[];
  /** Como máximo uno. Pulsarlo solo avisa: no completa nada. */
  boton: BotonTarjeta | null;
  /** Versión breve para leer por audio. */
  hablado: string;
  /** Solo en las tarjetas de misión: a cuál se refiere el botón. */
  misionId?: string;
}

// ── Entradas de las tarjetas ────────────────────────────────────────

export interface DatosSerie {
  ejercicio: string;
  /** Número de la serie que toca, empezando en 1. */
  serie: number;
  totalSeries: number;
  /** null o 0: peso corporal. */
  kilos: number | null;
  /** Como en Prescription.reps: admite rangos («8-12»). */
  repeticiones: string | number | null;
  descansoSeg?: number | null;
}

export interface DatosCardio {
  ritmoActualSegKm: number | null;
  ritmoObjetivoSegKm: number | null;
  distanciaKm: number | null;
}

export interface MisionPendiente {
  id: string;
  titulo: string;
}

/** Como un DayBlock: minutos desde medianoche, hora local. */
export interface DatosEstudio {
  titulo: string;
  inicioMin: number;
  finMin: number;
  ahoraMin: number;
}

// ── Voz ─────────────────────────────────────────────────────────────

export type Intencion = 'completar' | 'siguiente' | 'repetir' | 'cancelar' | 'nada';

/**
 * Lo que sale de una transcripción. Ninguna variante completa nada: lo máximo
 * es `confirmar`, y confirmar es del usuario.
 */
export type Candidata =
  | { tipo: 'confirmar'; mision: MisionPendiente; pregunta: string }
  | { tipo: 'ambigua'; opciones: MisionPendiente[]; pregunta: string }
  | { tipo: 'siguiente' }
  | { tipo: 'repetir' }
  | { tipo: 'cancelar' }
  | { tipo: 'nada' };

/** Solo 'si' puede llevar a completar. El silencio y lo dudoso son 'nada'. */
export type RespuestaConfirmacion = 'si' | 'no' | 'nada';

// ── Eventos del nativo ──────────────────────────────────────────────

export interface EventosGafas {
  estado: { estado: EstadoGafas };
  boton: { tarjetaId: string; boton: BotonTarjeta['id'] };
  transcripcion: { texto: string; final: boolean };
}

export type EventoGafas = keyof EventosGafas;
