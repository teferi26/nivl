// Fotos de progreso: lógica pura (sin Supabase, sin rutas, sin XP).
//
// La foto vive en el bucket privado `progress` bajo {uid}/{uuid}, pero eso es
// cosa de la capa de datos y del SQL. Aquí solo entran METADATOS
// ({ id, fecha, pose, pesoKg }) y nunca sale una ruta ni una URL: cada función
// construye sus objetos de salida campo a campo, así que aunque la capa de
// datos pase la fila entera, `path` no viaja.
//
// Es dato de salud: la capa de datos solo llama aquí tras el consentimiento de
// salud. No paga XP: la racha semanal alimenta un logro cosmético y nada más.
//
// Todo se calcula con claves YYYY-MM-DD. La distancia entre días se mide en
// UTC con las cifras de la clave, así el cambio de hora (25/10/2026) no mueve
// ningún día de semana.

import { addDays, isValidKey, weekdayOfKey } from './dates';

export type Pose = 'frente' | 'lado' | 'espalda';
export const POSES: readonly Pose[] = ['frente', 'lado', 'espalda'];

export interface FotoProgreso {
  id: string;
  fecha: string; // YYYY-MM-DD
  pose: Pose;
  pesoKg?: number | null;
}

export interface PesoDia {
  fecha: string;
  kg: number;
}

export interface NutricionDia {
  fecha: string;
  cumplido: boolean;
}

/** De dónde sale el peso de una foto: el que se apuntó con ella o el registro más cercano. */
export type FuentePeso = 'foto' | 'registro' | null;

export interface FotoConPeso {
  id: string;
  fecha: string;
  pose: Pose;
  pesoKg: number | null;
  fuentePeso: FuentePeso;
}

/** Ventana para casar una foto con un peso registrado: ±3 días. */
export const VENTANA_PESO_DIAS = 3;

/** Hitos del logro cosmético de constancia (semanas completas seguidas). */
export const HITOS_RACHA = [4, 12, 52] as const;

// ---------------------------------------------------------------------------
// Fechas

/** Día absoluto de una clave (días desde 1970-01-01, en UTC): inmune al DST. */
function ordinal(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

/** Días de `a` a `b` (positivo si b es posterior). */
export function diasEntre(a: string, b: string): number {
  return ordinal(b) - ordinal(a);
}

/** Lunes de la semana ISO de la clave. */
export function lunesDe(key: string): string {
  return addDays(key, 1 - weekdayOfKey(key));
}

/** Año y número de semana ISO (el año es el del jueves de esa semana). */
export function semanaIso(key: string): { anio: number; semana: number } {
  const jueves = addDays(lunesDe(key), 3);
  const anio = Number(jueves.slice(0, 4));
  const semana = Math.floor(diasEntre(`${anio}-01-01`, jueves) / 7) + 1;
  return { anio, semana };
}

// ---------------------------------------------------------------------------
// Saneado

function esPose(p: unknown): p is Pose {
  return p === 'frente' || p === 'lado' || p === 'espalda';
}

function pesoValido(kg: unknown): kg is number {
  return typeof kg === 'number' && Number.isFinite(kg) && kg > 0;
}

/** Fotos con fecha y pose válidas. Lo corrupto se ignora, no rompe la pantalla. */
function fotosValidas(fotos: readonly FotoProgreso[]): FotoProgreso[] {
  return (fotos ?? []).filter(
    (f) => f && typeof f.id === 'string' && isValidKey(f.fecha) && esPose(f.pose),
  );
}

function pesosValidos(pesos: readonly PesoDia[] | undefined): PesoDia[] {
  return (pesos ?? []).filter((p) => p && isValidKey(p.fecha) && pesoValido(p.kg));
}

/** Más reciente primero; a igual fecha, en el orden frente · lado · espalda; luego por id. */
function compararDesc(a: FotoProgreso, b: FotoProgreso): number {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
  const pa = POSES.indexOf(a.pose);
  const pb = POSES.indexOf(b.pose);
  if (pa !== pb) return pa - pb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Peso

/**
 * Peso registrado más cercano a la fecha dentro de ±3 días. A igual distancia
 * gana el anterior (el peso de antes de la foto describe mejor lo que se ve).
 */
export function pesoCercano(fecha: string, pesos: readonly PesoDia[]): number | null {
  let mejor: PesoDia | null = null;
  let mejorDist = Infinity;
  for (const p of pesosValidos(pesos)) {
    const d = diasEntre(fecha, p.fecha);
    const dist = Math.abs(d);
    if (dist > VENTANA_PESO_DIAS) continue;
    if (
      dist < mejorDist ||
      (dist === mejorDist && mejor !== null && p.fecha < mejor.fecha)
    ) {
      mejor = p;
      mejorDist = dist;
    }
  }
  return mejor ? mejor.kg : null;
}

function conPeso(f: FotoProgreso, pesos: readonly PesoDia[]): FotoConPeso {
  if (pesoValido(f.pesoKg)) {
    return { id: f.id, fecha: f.fecha, pose: f.pose, pesoKg: f.pesoKg, fuentePeso: 'foto' };
  }
  const kg = pesoCercano(f.fecha, pesos);
  return {
    id: f.id,
    fecha: f.fecha,
    pose: f.pose,
    pesoKg: kg,
    fuentePeso: kg === null ? null : 'registro',
  };
}

const redondear1 = (n: number) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------------------
// 1. Línea temporal

export interface SemanaFotos {
  /** Lunes de la semana ISO. */
  semana: string;
  anioIso: number;
  numeroIso: number;
  /** Una foto por pose (la más reciente de esa pose en la semana), en orden frente · lado · espalda. */
  fotos: FotoConPeso[];
  /** Poses que faltan esa semana. */
  faltan: Pose[];
  completa: boolean;
  /** Días con parte de nutrición cumplido / días con parte. `null` sin partes. */
  adherencia: number | null;
  diasCumplidos: number;
  diasRegistrados: number;
}

export function lineaTemporal(
  fotos: readonly FotoProgreso[],
  pesos: readonly PesoDia[] = [],
  nutricion: readonly NutricionDia[] = [],
): SemanaFotos[] {
  // Por semana y pose, la foto más reciente.
  const porSemana = new Map<string, Map<Pose, FotoProgreso>>();
  for (const f of fotosValidas(fotos).sort(compararDesc)) {
    const semana = lunesDe(f.fecha);
    let poses = porSemana.get(semana);
    if (!poses) {
      poses = new Map();
      porSemana.set(semana, poses);
    }
    if (!poses.has(f.pose)) poses.set(f.pose, f); // ya vienen de reciente a antigua
  }

  // Nutrición: un parte por día (el último que llegue manda).
  const partes = new Map<string, boolean>();
  for (const n of nutricion ?? []) {
    if (n && isValidKey(n.fecha)) partes.set(n.fecha, n.cumplido === true);
  }

  const salida: SemanaFotos[] = [];
  for (const [semana, poses] of porSemana) {
    const domingo = addDays(semana, 6);
    let registrados = 0;
    let cumplidos = 0;
    for (const [fecha, ok] of partes) {
      if (fecha >= semana && fecha <= domingo) {
        registrados++;
        if (ok) cumplidos++;
      }
    }
    const iso = semanaIso(semana);
    const presentes = POSES.filter((p) => poses.has(p));
    salida.push({
      semana,
      anioIso: iso.anio,
      numeroIso: iso.semana,
      fotos: presentes.map((p) => conPeso(poses.get(p)!, pesos)),
      faltan: POSES.filter((p) => !poses.has(p)),
      completa: presentes.length === POSES.length,
      adherencia: registrados === 0 ? null : cumplidos / registrados,
      diasCumplidos: cumplidos,
      diasRegistrados: registrados,
    });
  }
  return salida.sort((a, b) => (a.semana < b.semana ? 1 : -1));
}

// ---------------------------------------------------------------------------
// 2. Antes y después

export interface ParAntesDespues {
  antes: FotoConPeso;
  despues: FotoConPeso;
  /** Días entre las dos fotos. */
  dias: number;
  /** despues − antes, en kg con un decimal. `null` si falta alguno de los dos pesos. */
  difPesoKg: number | null;
}

export function parAntesDespues(
  fotos: readonly FotoProgreso[],
  pose: Pose,
  opciones: { dias?: number; hoy: string; pesos?: readonly PesoDia[] },
): ParAntesDespues | null {
  const { hoy, pesos = [] } = opciones;
  const dias = opciones.dias ?? 90;
  if (!isValidKey(hoy) || !esPose(pose)) return null;

  const dePose = fotosValidas(fotos)
    .filter((f) => f.pose === pose && f.fecha <= hoy)
    .sort(compararDesc);
  if (dePose.length < 2) return null;

  const despues = dePose[0];
  // Candidatas: anteriores en fecha a la de "después" (dos del mismo día no son un antes/después).
  const previas = dePose.filter((f) => f.fecha < despues.fecha);
  if (previas.length === 0) return null;

  // La más cercana al objetivo. Si el objetivo cae antes de la primera foto,
  // la más cercana ES la primera: no se inventa un antes que no existe.
  // Empate: gana la más antigua (enseña más recorrido).
  const objetivo = addDays(hoy, -Math.max(0, Math.round(dias)));
  let antes = previas[0];
  let mejor = Math.abs(diasEntre(objetivo, antes.fecha));
  for (const f of previas) {
    const d = Math.abs(diasEntre(objetivo, f.fecha));
    if (d < mejor || (d === mejor && f.fecha < antes.fecha)) {
      antes = f;
      mejor = d;
    }
  }

  const a = conPeso(antes, pesos);
  const b = conPeso(despues, pesos);
  return {
    antes: a,
    despues: b,
    dias: diasEntre(a.fecha, b.fecha),
    difPesoKg: a.pesoKg !== null && b.pesoKg !== null ? redondear1(b.pesoKg - a.pesoKg) : null,
  };
}

// ---------------------------------------------------------------------------
// 3. Estado de la semana

export interface EstadoSemanal {
  semana: string;
  hechas: Pose[];
  faltan: Pose[];
  completa: boolean;
  /** true solo en domingo y con la semana incompleta. */
  recordar: boolean;
  /**
   * Clave única del aviso de esta semana (`fotos-progreso:{lunes}`), para que
   * la capa de avisos no lo mande dos veces. `null` si no toca avisar.
   */
  claveAviso: string | null;
}

export function estadoSemanal(fotos: readonly FotoProgreso[], hoy: string): EstadoSemanal {
  const semana = lunesDe(hoy);
  const domingo = addDays(semana, 6);
  const presentes = new Set<Pose>();
  for (const f of fotosValidas(fotos)) {
    if (f.fecha >= semana && f.fecha <= domingo) presentes.add(f.pose);
  }
  const hechas = POSES.filter((p) => presentes.has(p));
  const faltan = POSES.filter((p) => !presentes.has(p));
  const completa = faltan.length === 0;
  const recordar = !completa && weekdayOfKey(hoy) === 7;
  return {
    semana,
    hechas,
    faltan,
    completa,
    recordar,
    claveAviso: recordar ? `fotos-progreso:${semana}` : null,
  };
}

// ---------------------------------------------------------------------------
// 4. Racha semanal (logro cosmético, sin XP)

export interface RachaFotos {
  /** Semanas ISO seguidas con las tres poses, contando hasta la última semana cerrada o la actual si ya está completa. */
  semanas: number;
  /** La semana en curso ya tiene las tres poses. */
  actualCompleta: boolean;
  /** La racha más larga de la historia (los logros no se pierden). */
  mejor: number;
  /** Hitos (4, 12, 52) alcanzados alguna vez, según `mejor`. */
  hitos: number[];
  /** Próximo hito por encima de la racha actual, o `null` si ya pasó el último. */
  siguienteHito: number | null;
}

export function rachaFotosSemanal(fotos: readonly FotoProgreso[], hoy: string): RachaFotos {
  const posesPorSemana = new Map<string, Set<Pose>>();
  for (const f of fotosValidas(fotos)) {
    if (isValidKey(hoy) && f.fecha > hoy) continue; // una foto "del futuro" no cuenta
    const s = lunesDe(f.fecha);
    let set = posesPorSemana.get(s);
    if (!set) {
      set = new Set();
      posesPorSemana.set(s, set);
    }
    set.add(f.pose);
  }
  const completas = new Set(
    [...posesPorSemana].filter(([, s]) => s.size === POSES.length).map(([k]) => k),
  );

  const actual = lunesDe(hoy);
  const actualCompleta = completas.has(actual);
  // La semana en curso no rompe la racha mientras no haya terminado.
  let cursor = actualCompleta ? actual : addDays(actual, -7);
  let semanas = 0;
  while (completas.has(cursor)) {
    semanas++;
    cursor = addDays(cursor, -7);
  }

  let mejor = 0;
  let corrida = 0;
  let previa: string | null = null;
  for (const s of [...completas].sort()) {
    corrida = previa !== null && diasEntre(previa, s) === 7 ? corrida + 1 : 1;
    mejor = Math.max(mejor, corrida);
    previa = s;
  }

  return {
    semanas,
    actualCompleta,
    mejor,
    hitos: HITOS_RACHA.filter((h) => mejor >= h),
    siguienteHito: HITOS_RACHA.find((h) => h > semanas) ?? null,
  };
}

// ---------------------------------------------------------------------------
// 5. Lo que ve el coach

export interface MetadatoCoach {
  fecha: string;
  pose: Pose;
  pesoKg: number | null;
}

/**
 * La forma que devuelve la RPC de solo lectura del coach: fecha, pose y peso.
 * Sin id, sin ruta, sin URL. Más reciente primero.
 */
export function metadatosParaCoach(
  fotos: readonly FotoProgreso[],
  pesos: readonly PesoDia[] = [],
): MetadatoCoach[] {
  return fotosValidas(fotos)
    .sort(compararDesc)
    .map((f) => {
      const { pesoKg } = conPeso(f, pesos);
      return { fecha: f.fecha, pose: f.pose, pesoKg };
    });
}
