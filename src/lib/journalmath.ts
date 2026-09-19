// NIVL · El diario con forma (puro: sin Supabase, con tests).
//
// Desde la 0023 una entrada ya no son dos cajas de texto: cada pieza responde a
// una pregunta (cómo me sentí, cómo dormí, qué logré, qué viví, qué aprendí,
// qué agradezco, qué va primero mañana). Aquí vive lo que se puede calcular sin
// tocar la red: el vocabulario de emociones, cuánto del cierre está hecho, la
// tendencia que enseña el Archivo y los "hace un año" que dan gusto releer.
//
// Regla de la casa: los números son deterministas. Si el coach necesita una de
// estas cifras, se copia a `supabase/functions/_shared/` (el empaquetado de la
// Edge Function no sube nada de fuera de `supabase/`); no se recalcula a ojo en
// el prompt.

import { addDays, isValidKey } from './dates';

export type Valencia = 'up' | 'down';

export interface Emocion {
  /** Lo que se guarda en `journal_entries.emotions`. Minúsculas, sin tildes. */
  id: string;
  label: string;
  valence: Valencia;
}

// El vocabulario es corto a propósito: catorce palabras se recorren de un
// vistazo y dan series comparables. Con texto libre, "cansado", "agotado" y
// "reventado" serían tres emociones distintas y ninguna tendencia.
export const EMOCIONES: readonly Emocion[] = [
  { id: 'orgulloso', label: 'Orgulloso', valence: 'up' },
  { id: 'motivado', label: 'Motivado', valence: 'up' },
  { id: 'tranquilo', label: 'Tranquilo', valence: 'up' },
  { id: 'agradecido', label: 'Agradecido', valence: 'up' },
  { id: 'enfocado', label: 'Enfocado', valence: 'up' },
  { id: 'fuerte', label: 'Fuerte', valence: 'up' },
  { id: 'feliz', label: 'Feliz', valence: 'up' },
  { id: 'cansado', label: 'Cansado', valence: 'down' },
  { id: 'estresado', label: 'Estresado', valence: 'down' },
  { id: 'ansioso', label: 'Ansioso', valence: 'down' },
  { id: 'frustrado', label: 'Frustrado', valence: 'down' },
  { id: 'disperso', label: 'Disperso', valence: 'down' },
  { id: 'triste', label: 'Triste', valence: 'down' },
  { id: 'solo', label: 'Solo', valence: 'down' },
];

/** Los topes son los CHECK de la 0023: pasarse es un error de Postgres. */
export const MAX_EMOCIONES = 8;
export const MAX_VICTORIAS = 10;
/** Filas que el editor deja añadir a mano. Cinco victorias ya es un gran día. */
export const VICTORIAS_VISIBLES = 5;
export const MAX_LARGO_VICTORIA = 140;

export const SUENO_MIN = 0;
export const SUENO_MAX = 14;
export const SUENO_PASO = 0.5;
/** Donde arranca el contador al tocarlo por primera vez. */
export const SUENO_INICIAL = 7;

const POR_ID = new Map(EMOCIONES.map((e) => [e.id, e]));

/** El nombre visible de una emoción. Una que no esté en el vocabulario (la pudo
 *  escribir el coach) se enseña tal cual, con mayúscula inicial. */
export function etiquetaEmocion(id: string): string {
  const conocida = POR_ID.get(id);
  if (conocida) return conocida.label;
  const limpio = id.trim();
  return limpio ? limpio.charAt(0).toUpperCase() + limpio.slice(1) : '';
}

/** Minúsculas, sin vacíos, sin repetidos y con el tope del esquema. */
export function limpiarEmociones(list: readonly string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const raw of list ?? []) {
    if (typeof raw !== 'string') continue;
    const id = raw.trim().toLowerCase();
    if (!id || out.includes(id)) continue;
    out.push(id);
    if (out.length >= MAX_EMOCIONES) break;
  }
  return out;
}

/**
 * Las victorias tal como se guardan: recortadas, sin filas vacías, sin
 * repetidas (sin distinguir mayúsculas; gana la primera forma escrita) y con el
 * tope del esquema.
 */
export function limpiarVictorias(list: readonly string[] | null | undefined): string[] {
  const out: string[] = [];
  const vistas = new Set<string>();
  for (const raw of list ?? []) {
    if (typeof raw !== 'string') continue;
    const v = raw.replace(/\s+/g, ' ').trim();
    if (!v) continue;
    const clave = v.toLocaleLowerCase('es');
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    out.push(v);
    if (out.length >= MAX_VICTORIAS) break;
  }
  return out;
}

/** Media hora arriba o abajo, dentro de 0–14. Desde "sin registrar" arranca en 7. */
export function pasoDeSueno(actual: number | null, direccion: 1 | -1): number {
  if (actual === null || !Number.isFinite(actual)) return SUENO_INICIAL;
  const siguiente = Math.round((actual + direccion * SUENO_PASO) * 2) / 2;
  return Math.min(SUENO_MAX, Math.max(SUENO_MIN, siguiente));
}

/** "7,5 h", "8 h". Con coma: la interfaz es española. */
export function formatoHoras(h: number): string {
  return `${formatoDecimal(h)} h`;
}

/** Un decimal como mucho, con coma y sin ",0". */
export function formatoDecimal(n: number): string {
  const r = Math.round(n * 10) / 10;
  return (Number.isInteger(r) ? String(r) : r.toFixed(1)).replace('.', ',');
}

// ── Completitud ─────────────────────────────────────────────────────────────

/** Lo que se pregunta en el cierre del día. `JournalEntry` lo cumple tal cual. */
export interface CierreDelDia {
  mood: number | null;
  energy: number | null;
  emotions?: readonly string[] | null;
  sleep_hours?: number | null;
  wins?: readonly string[] | null;
  text: string | null;
  lesson?: string | null;
  gratitude?: string | null;
  plan: string | null;
}

export const SECCIONES = ['sentir', 'sueno', 'victorias', 'vivido', 'leccion', 'gratitud', 'manana'] as const;
export type SeccionId = (typeof SECCIONES)[number];

export interface Completitud {
  hechas: number;
  total: number;
  porSeccion: Record<SeccionId, boolean>;
}

const hayTexto = (s: string | null | undefined) => typeof s === 'string' && s.trim().length > 0;

/**
 * Cuántas de las siete preguntas tienen respuesta. Las fotos no cuentan: son
 * prueba, no reflexión. "Cómo me sentí" vale con cualquiera de sus tres piezas
 * (una nota o una emoción con nombre): nadie debería sentirse a medias por no
 * puntuar la energía.
 */
export function completitud(entry: CierreDelDia): Completitud {
  const porSeccion: Record<SeccionId, boolean> = {
    sentir: entry.mood != null || entry.energy != null || limpiarEmociones(entry.emotions).length > 0,
    sueno: entry.sleep_hours != null,
    victorias: limpiarVictorias(entry.wins).length > 0,
    vivido: hayTexto(entry.text),
    leccion: hayTexto(entry.lesson),
    gratitud: hayTexto(entry.gratitude),
    manana: hayTexto(entry.plan),
  };
  const hechas = SECCIONES.filter((s) => porSeccion[s]).length;
  return { hechas, total: SECCIONES.length, porSeccion };
}

/** Una entrada sin nada dentro: ni se guarda ni se enseña como recuerdo. */
export function entradaVacia(entry: CierreDelDia): boolean {
  return completitud(entry).hechas === 0;
}

// ── Tendencia ───────────────────────────────────────────────────────────────

/** Lo mínimo de una entrada para estudiarla: su fecha y lo que se preguntó. */
export interface EntradaFechada extends CierreDelDia {
  date: string;
}

export interface Comparativa {
  /** Media de los últimos 7 días (hoy incluido). Null con menos de 3 datos. */
  actual: number | null;
  /** Media de los 7 días anteriores a esos. Null con menos de 3 datos. */
  anterior: number | null;
  /** actual − anterior, a un decimal. Null si falta cualquiera de las dos. */
  delta: number | null;
}

export interface EmocionFrecuente {
  id: string;
  label: string;
  count: number;
}

export interface ResumenTendencia {
  animo: Comparativa;
  energia: Comparativa;
  sueno: Comparativa;
  /** Días seguidos con entrada. Si hoy aún no se ha escrito, cuenta desde ayer. */
  racha: number;
  /** Las tres emociones más repetidas en los últimos 14 días. */
  emociones: EmocionFrecuente[];
}

/** Con menos de tres puntos una media es una anécdota: no se pinta tendencia. */
export const MIN_DATOS_MEDIA = 3;

const redondear1 = (n: number) => Math.round(n * 10) / 10;

function ventana(hasta: string, dias: number): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < dias; i++) out.add(addDays(hasta, -i));
  return out;
}

function media(valores: number[]): number | null {
  if (valores.length < MIN_DATOS_MEDIA) return null;
  return redondear1(valores.reduce((a, b) => a + b, 0) / valores.length);
}

function comparar(
  entries: readonly EntradaFechada[],
  actual: Set<string>,
  anterior: Set<string>,
  leer: (e: EntradaFechada) => number | null | undefined,
): Comparativa {
  const de = (dias: Set<string>) =>
    entries
      .filter((e) => dias.has(e.date))
      .map(leer)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const a = media(de(actual));
  const b = media(de(anterior));
  return { actual: a, anterior: b, delta: a !== null && b !== null ? redondear1(a - b) : null };
}

/**
 * El estudio que abre el Archivo. Las ventanas son de CALENDARIO (los últimos
 * 7 días, no las últimas 7 entradas): una semana sin escribir tiene que verse
 * como un hueco, no disimularse tirando de entradas de hace un mes.
 */
export function resumenTendencia(entries: readonly EntradaFechada[], hoy: string): ResumenTendencia {
  // Una fila con fecha corrupta o futura no entra: rompería `addDays` o
  // inflaría la racha.
  const validas = dedupePorFecha(entries.filter((e) => isValidKey(e.date) && e.date <= hoy));

  const ultimos7 = ventana(hoy, 7);
  const previos7 = ventana(addDays(hoy, -7), 7);

  const fechas = new Set(validas.map((e) => e.date));
  let cursor = fechas.has(hoy) ? hoy : addDays(hoy, -1);
  let racha = 0;
  while (fechas.has(cursor)) {
    racha += 1;
    cursor = addDays(cursor, -1);
  }

  const ultimos14 = ventana(hoy, 14);
  const cuenta = new Map<string, number>();
  for (const e of validas) {
    if (!ultimos14.has(e.date)) continue;
    for (const id of limpiarEmociones(e.emotions)) cuenta.set(id, (cuenta.get(id) ?? 0) + 1);
  }
  const orden = new Map(EMOCIONES.map((e, i) => [e.id, i]));
  const emociones = [...cuenta.entries()]
    // Empates: primero el orden del vocabulario, para que la lista no baile.
    .sort((a, b) => b[1] - a[1] || (orden.get(a[0]) ?? 99) - (orden.get(b[0]) ?? 99) || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([id, count]) => ({ id, label: etiquetaEmocion(id), count }));

  return {
    animo: comparar(validas, ultimos7, previos7, (e) => e.mood),
    energia: comparar(validas, ultimos7, previos7, (e) => e.energy),
    sueno: comparar(validas, ultimos7, previos7, (e) => e.sleep_hours),
    racha,
    emociones,
  };
}

function dedupePorFecha<T extends { date: string }>(entries: readonly T[]): T[] {
  const vistas = new Set<string>();
  return entries.filter((e) => (vistas.has(e.date) ? false : (vistas.add(e.date), true)));
}

/** La serie de una métrica en orden cronológico, sin nulos: lo que pinta la gráfica. */
export function serieDe(
  entries: readonly EntradaFechada[],
  campo: 'mood' | 'energy' | 'sleep_hours',
  max = 30,
): number[] {
  return dedupePorFecha(entries.filter((e) => isValidKey(e.date)))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((e) => e[campo])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    .slice(-max);
}

// ── Flashbacks ──────────────────────────────────────────────────────────────

export type FlashbackId = 'semana' | 'mes' | 'anio';

export const TITULO_FLASHBACK: Record<FlashbackId, string> = {
  semana: 'Hace una semana',
  mes: 'Hace un mes',
  anio: 'Hace un año',
};

function partes(key: string): [number, number, number] {
  const [y, m, d] = key.split('-').map(Number);
  return [y!, m!, d!];
}

const diasDelMes = (y: number, m: number) => new Date(y, m, 0).getDate();
const clave = (y: number, m: number, d: number) =>
  `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * Las tres fechas que se buscan. "Hace un mes" y "hace un año" son el MISMO día
 * del calendario, recortado al largo del mes: el 31 de marzo mira al 28 (o 29)
 * de febrero, y el 29 de febrero al 28 del año anterior. Restar 30 o 365 días
 * iría desplazando el aniversario y "hace un año" dejaría de caer en tu fecha.
 */
export function fechasFlashback(hoy: string): Record<FlashbackId, string> {
  const [y, m, d] = partes(hoy);
  const mesY = m === 1 ? y - 1 : y;
  const mesM = m === 1 ? 12 : m - 1;
  return {
    semana: addDays(hoy, -7),
    mes: clave(mesY, mesM, Math.min(d, diasDelMes(mesY, mesM))),
    anio: clave(y - 1, m, Math.min(d, diasDelMes(y - 1, m))),
  };
}

export interface Flashback<T extends EntradaFechada> {
  id: FlashbackId;
  titulo: string;
  entry: T;
}

/** Las entradas de hace una semana, un mes y un año, si existen y dicen algo. */
export function flashbacks<T extends EntradaFechada>(entries: readonly T[], hoy: string): Flashback<T>[] {
  if (!isValidKey(hoy)) return [];
  const fechas = fechasFlashback(hoy);
  const out: Flashback<T>[] = [];
  for (const id of ['semana', 'mes', 'anio'] as const) {
    const entry = entries.find((e) => e.date === fechas[id]);
    if (entry && !entradaVacia(entry)) out.push({ id, titulo: TITULO_FLASHBACK[id], entry });
  }
  return out;
}

/** Las primeras letras de un texto, cortadas en palabra y con puntos suspensivos. */
export function extracto(text: string | null | undefined, max = 120): string {
  const limpio = (text ?? '').replace(/\s+/g, ' ').trim();
  if (limpio.length <= max) return limpio;
  const corte = limpio.slice(0, max);
  const espacio = corte.lastIndexOf(' ');
  return `${(espacio > max * 0.6 ? corte.slice(0, espacio) : corte).replace(/[\s.,;:]+$/, '')}…`;
}
