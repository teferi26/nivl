// NIVL · El espejo de un entreno medido en `cardio_sessions`.
//
// `cardio_sessions` guarda una fila por tipo y día, y de ella salen el XP y el
// tope diario. Un entreno medido solo la crea si ese día no había: la que ya
// existe (apuntada a mano o medida antes) no se toca ni vuelve a cobrar.
//
// Puro y sin imports: nada de Supabase, para que sus tests arranquen.

/** La forma exacta que recibe `saveCardio`. */
export interface EspejoFila<K extends string = string, Z extends string = string> {
  date: string;
  kind: K;
  distance_km: number | null;
  duration_min: number;
  avg_hr: number | null;
  rpe: number | null;
  zone: Z;
  notes: string | null;
  xp: number;
}

// Los CHECK de `cardio_sessions` (0012): pasarse tumbaría el guardado entero.
const MAX_KM = 499.99;
const MAX_MIN = 1439;
const MIN_MIN = 0.01;
const MIN_PULSO = 31;
const MAX_PULSO = 239;

function redondear(x: number, decimales: number): number {
  const f = 10 ** decimales;
  return Math.round(x * f) / f;
}

function kmValidos(km: number | null): number | null {
  if (km === null || !Number.isFinite(km) || km <= 0) return null;
  return Math.min(MAX_KM, redondear(km, 3));
}

function minutosValidos(min: number): number {
  return Math.min(MAX_MIN, Math.max(MIN_MIN, redondear(min, 2)));
}

function pulsoValido(bpm: number | null): number | null {
  if (bpm === null || !Number.isFinite(bpm)) return null;
  const entero = Math.round(bpm);
  return entero >= MIN_PULSO && entero <= MAX_PULSO ? entero : null;
}

function rpeValido(rpe: number | null): number | null {
  if (rpe === null || !Number.isFinite(rpe)) return null;
  const r = redondear(rpe, 1);
  return r >= 1 && r <= 10 ? r : null;
}

/**
 * La fila a guardar, dentro de los límites de la tabla. Solo se llama si ese
 * día no había sesión de ese tipo: la que ya existe no se pisa ni se cobra.
 */
export function espejoCardio<K extends string, Z extends string>(nueva: EspejoFila<K, Z>): EspejoFila<K, Z> {
  return {
    ...nueva,
    distance_km: kmValidos(nueva.distance_km),
    duration_min: minutosValidos(nueva.duration_min),
    avg_hr: pulsoValido(nueva.avg_hr),
    rpe: rpeValido(nueva.rpe),
  };
}

/** Lo que queda en la fila del día al borrar un entreno. El XP no se toca. */
export function restarDelEspejo(
  previa: { distance_km: number | null; duration_min: number },
  quitar: { distance_km: number | null; duration_min: number },
): { distance_km: number | null; duration_min: number } {
  const km = kmValidos(previa.distance_km);
  return {
    distance_km: km === null ? null : kmValidos(km - (kmValidos(quitar.distance_km) ?? 0)),
    duration_min: minutosValidos(previa.duration_min - quitar.duration_min),
  };
}

/**
 * ¿Puede este deporte saldar esa misión? Solo descarta los títulos inequívocos:
 * «Nadar 2 km» no la salda una bici. Lo ambiguo («cardio», «Z2») sigue valiendo.
 */
export function misionCasaConDeporte(titulo: string, deporte: string): boolean {
  const t = titulo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const validos: string[] = [];
  if (/\b(correr|corriendo|carrera|running)\b/.test(t)) validos.push('carrera');
  if (/\b(nadar|nadando|natacion|piscina)\b/.test(t)) validos.push('piscina', 'aguas_abiertas');
  if (/\b(bici\w*|ciclismo)\b/.test(t)) validos.push('bici');
  if (/\bbrick\b/.test(t)) validos.push('bici', 'carrera');
  return validos.length === 0 || validos.includes(deporte);
}

/**
 * ¿Son el mismo acto? Dos entrenos del mismo deporte cuyos intervalos se solapan
 * en más de la mitad del más corto: el Watch y la mano contando la misma carrera.
 */
export function mismoActo(a: { inicio: string; fin: string }, b: { inicio: string; fin: string }): boolean {
  const ia = Date.parse(a.inicio);
  const fa = Date.parse(a.fin);
  const ib = Date.parse(b.inicio);
  const fb = Date.parse(b.fin);
  if (![ia, fa, ib, fb].every(Number.isFinite) || fa <= ia || fb <= ib) return false;
  return Math.min(fa, fb) - Math.max(ia, ib) > 0.5 * Math.min(fa - ia, fb - ib);
}
