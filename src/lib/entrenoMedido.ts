// NIVL · Un entreno medido por un sensor (Apple Watch, GPS del iPhone o la app
// Salud). Puro, sin imports. Contrato entre la medición y lo que la guarda.
//
// Un dato que el sensor no ha dado es null, nunca 0: un 0 sería afirmar algo.

export type OrigenEntreno = 'watch' | 'iphone_gps' | 'salud';
export type DeporteMedido = 'carrera' | 'bici' | 'piscina' | 'aguas_abiertas' | 'fuerza' | 'otro';

export interface PuntoRuta {
  /** Milisegundos de época. */
  t: number;
  lat: number;
  lon: number;
  alt: number | null;
}

export interface ParcialMedido {
  /** 1, 2, 3… */
  n: number;
  tipo: 'km' | 'largo' | 'manual';
  /** Segundos desde el inicio, sin contar pausas. */
  inicio_s: number;
  duracion_s: number;
  distancia_m: number | null;
  fc_media: number | null;
}

export interface EntrenoMedido {
  origen: OrigenEntreno;
  /** Identificador estable en su origen (el UUID del HKWorkout si existe). */
  externo_id: string;
  deporte: DeporteMedido;
  /** ISO 8601. */
  inicio: string;
  /** ISO 8601. */
  fin: string;
  /** Tiempo en movimiento, sin pausas. */
  duracion_s: number;
  distancia_m: number | null;
  kcal: number | null;
  fc_media: number | null;
  fc_max: number | null;
  desnivel_m: number | null;
  ruta: PuntoRuta[] | null;
  parciales: ParcialMedido[];
  largo_piscina_m: number | null;
}
