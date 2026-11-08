// NIVL · El contrato del entreno medido.
//
// Es la frontera entre quien captura (Apple Watch, GPS del iPhone, Salud, o la
// mano de quien no tiene reloj) y quien analiza (IRON y el coach). Todo lo que
// entra pasa por `normalizarEntreno`: lo que no se puede creer se rechaza o se
// limpia aquí, y el resto del código ya no tiene que desconfiar.
//
// Puro y SIN IMPORTS a propósito: el mismo archivo se copia tal cual a
// `supabase/functions/_shared/entrenoMedido.ts` (Deno), y un test de paridad
// comprueba que no se han separado. Si tocas uno, toca el otro.

/** Quién midió. `manual` es quien lo apunta a mano, sin reloj. */
export type OrigenEntreno = 'watch' | 'iphone_gps' | 'salud' | 'manual';

export type DeporteEntreno = 'carrera' | 'bici' | 'piscina' | 'aguas_abiertas' | 'caminar' | 'fuerza' | 'otro';

export const ORIGENES_ENTRENO: readonly OrigenEntreno[] = ['watch', 'iphone_gps', 'salud', 'manual'];
export const DEPORTES_ENTRENO: readonly DeporteEntreno[] = [
  'carrera',
  'bici',
  'piscina',
  'aguas_abiertas',
  'caminar',
  'fuerza',
  'otro',
];

/** Un punto de la ruta. `t`: segundos en movimiento desde `inicio`, el reloj de `duracion_s`; `alt`, metros. */
export interface PuntoRuta {
  t: number;
  lat: number;
  lon: number;
  alt: number | null;
}

/** Una muestra de pulso. `t`: segundos en movimiento desde `inicio`. */
export interface MuestraFc {
  t: number;
  bpm: number;
}

/**
 * Un tramo medido: un kilómetro, un largo de piscina, una vuelta, una
 * transición. `n` empieza en 1. `desnivel_m` es lo subido en ese tramo.
 */
export interface Parcial {
  n: number;
  tipo: 'km' | 'largo' | 'vuelta' | 'transicion';
  distancia_m: number;
  duracion_s: number;
  fc_media: number | null;
  desnivel_m: number | null;
}

/**
 * Lo que entrega la captura. Solo son obligatorios `origen`, `externo_id`,
 * `deporte`, `inicio`, `fin` y `duracion_s`; lo que el sensor no dé va a null
 * (nunca a 0: un 0 se leería como medido).
 *
 * `externo_id` es la llave de deduplicación por persona: el UUID del
 * HKWorkout, el id de la sesión del Watch. Reimportar el mismo entreno veinte
 * veces no crea veinte filas ni paga veinte veces.
 *
 * `inicio` y `fin` van en ISO 8601. `fc_serie` es opcional pero es lo que
 * permite el tiempo real en cada zona; sin ella se estima por parciales.
 */
export interface EntrenoMedido {
  origen: OrigenEntreno;
  externo_id: string;
  deporte: DeporteEntreno;
  inicio: string;
  fin: string;
  duracion_s: number;
  distancia_m: number | null;
  kcal: number | null;
  fc_media: number | null;
  fc_max: number | null;
  desnivel_m: number | null;
  ruta: PuntoRuta[] | null;
  parciales: Parcial[];
  largo_piscina_m: number | null;
  fc_serie?: MuestraFc[] | null;
}

export type ResultadoEntreno =
  | { ok: true; entreno: EntrenoMedido }
  | { ok: false; motivo: string };

/** Puntos máximos que se guardan de una ruta o de una serie de pulso. */
export const MAX_PUNTOS = 1500;
/** Más de dos días seguidos no es un entreno: es un fallo del sensor. */
export const MAX_DURACION_S = 172800;
export const MAX_DISTANCIA_M = 1000000;

function esObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Un número dentro de [min, max], o null. Nunca NaN ni un texto colado. */
function numeroEn(x: unknown, min: number, max: number): number | null {
  if (typeof x !== 'number' || !Number.isFinite(x)) return null;
  return x >= min && x <= max ? x : null;
}

/**
 * Se queda con `max` elementos repartidos a lo largo de la serie, conservando
 * siempre el primero y el último (el final de la ruta no se pierde).
 */
export function reducirSerie<T>(serie: readonly T[], max: number = MAX_PUNTOS): T[] {
  if (max < 2 || serie.length <= max) return serie.slice();
  const salida: T[] = [];
  const paso = (serie.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) salida.push(serie[Math.round(i * paso)]!);
  return salida;
}

function limpiarRuta(x: unknown, duracion: number): PuntoRuta[] | null {
  if (!Array.isArray(x)) return null;
  const puntos: PuntoRuta[] = [];
  let ultimo = -1;
  for (const p of x) {
    if (!esObjeto(p)) continue;
    const t = numeroEn(p.t, 0, duracion + 60);
    const lat = numeroEn(p.lat, -90, 90);
    const lon = numeroEn(p.lon, -180, 180);
    if (t === null || lat === null || lon === null || t <= ultimo) continue;
    // (0,0) es el «sin señal» típico de un GPS, en mitad del Atlántico.
    if (lat === 0 && lon === 0) continue;
    puntos.push({ t, lat, lon, alt: numeroEn(p.alt, -500, 9000) });
    ultimo = t;
  }
  return puntos.length >= 2 ? reducirSerie(puntos) : null;
}

function limpiarFc(x: unknown, duracion: number): MuestraFc[] | null {
  if (!Array.isArray(x)) return null;
  const muestras: MuestraFc[] = [];
  let ultimo = -1;
  for (const m of x) {
    if (!esObjeto(m)) continue;
    const t = numeroEn(m.t, 0, duracion + 60);
    const bpm = numeroEn(m.bpm, 25, 250);
    if (t === null || bpm === null || t <= ultimo) continue;
    muestras.push({ t, bpm: Math.round(bpm) });
    ultimo = t;
  }
  return muestras.length >= 2 ? reducirSerie(muestras) : null;
}

function limpiarParciales(x: unknown): Parcial[] {
  if (!Array.isArray(x)) return [];
  const parciales: Parcial[] = [];
  for (const p of x) {
    if (!esObjeto(p)) continue;
    const tipo = p.tipo;
    if (tipo !== 'km' && tipo !== 'largo' && tipo !== 'vuelta' && tipo !== 'transicion') continue;
    const distancia = numeroEn(p.distancia_m, 0, MAX_DISTANCIA_M);
    const duracion = numeroEn(p.duracion_s, 1, MAX_DURACION_S);
    if (distancia === null || duracion === null) continue;
    const n = numeroEn(p.n, 1, 100000);
    parciales.push({
      n: n === null ? parciales.length + 1 : Math.round(n),
      tipo,
      distancia_m: distancia,
      duracion_s: duracion,
      fc_media: numeroEn(p.fc_media, 25, 250),
      desnivel_m: numeroEn(p.desnivel_m, 0, 30000),
    });
  }
  return parciales;
}

/**
 * La puerta de entrada. Rechaza lo que no identifica un entreno (sin llave,
 * sin deporte, fechas imposibles) y limpia lo demás: un pulso de 900 pasa a
 * null, no tumba la sesión entera.
 */
export function normalizarEntreno(x: unknown): ResultadoEntreno {
  if (!esObjeto(x)) return { ok: false, motivo: 'no_es_objeto' };
  const { origen, externo_id, deporte, inicio, fin } = x;
  if (!ORIGENES_ENTRENO.includes(origen as OrigenEntreno)) return { ok: false, motivo: 'origen' };
  if (!DEPORTES_ENTRENO.includes(deporte as DeporteEntreno)) return { ok: false, motivo: 'deporte' };
  if (typeof externo_id !== 'string' || externo_id.trim().length < 1 || externo_id.length > 200) {
    return { ok: false, motivo: 'externo_id' };
  }
  if (typeof inicio !== 'string' || typeof fin !== 'string') return { ok: false, motivo: 'fechas' };
  const msInicio = Date.parse(inicio);
  const msFin = Date.parse(fin);
  if (!Number.isFinite(msInicio) || !Number.isFinite(msFin) || msFin <= msInicio) {
    return { ok: false, motivo: 'fechas' };
  }
  const duracion = numeroEn(x.duracion_s, 1, MAX_DURACION_S);
  if (duracion === null) return { ok: false, motivo: 'duracion' };

  const fcMax = numeroEn(x.fc_max, 25, 250);
  const fcMedia = numeroEn(x.fc_media, 25, 250);
  return {
    ok: true,
    entreno: {
      origen: origen as OrigenEntreno,
      externo_id: externo_id.trim(),
      deporte: deporte as DeporteEntreno,
      inicio,
      fin,
      duracion_s: Math.round(duracion),
      distancia_m: numeroEn(x.distancia_m, 0, MAX_DISTANCIA_M),
      kcal: numeroEn(x.kcal, 0, 30000),
      fc_media: fcMedia,
      // Una máxima por debajo de la media es un sensor equivocado.
      fc_max: fcMax !== null && fcMedia !== null && fcMax < fcMedia ? null : fcMax,
      desnivel_m: numeroEn(x.desnivel_m, 0, 30000),
      ruta: limpiarRuta(x.ruta, duracion),
      parciales: limpiarParciales(x.parciales),
      largo_piscina_m: numeroEn(x.largo_piscina_m, 10, 100),
      fc_serie: limpiarFc(x.fc_serie, duracion),
    },
  };
}

/** La llave de un entreno apuntado a mano: la genera quien lo guarda, una vez. */
export function externoManual(idUnico: string): string {
  return `manual:${idUnico}`;
}

/** ¿Es un deporte de resistencia, de los que se registran como cardio? */
export function esResistencia(d: DeporteEntreno): boolean {
  return d !== 'fuerza';
}

/**
 * El tipo de `cardio_sessions` al que corresponde, o null para fuerza: el acto
 * real de fuerza es la sesión del gimnasio, y un Watch en modo fuerza no puede
 * cobrarlo otra vez.
 */
export function tipoCardioDe(d: DeporteEntreno): 'correr' | 'bici' | 'nadar' | 'caminar' | 'otro' | null {
  switch (d) {
    case 'carrera':
      return 'correr';
    case 'bici':
      return 'bici';
    case 'piscina':
    case 'aguas_abiertas':
      return 'nadar';
    case 'caminar':
      return 'caminar';
    case 'otro':
      return 'otro';
    case 'fuerza':
      return null;
  }
}
