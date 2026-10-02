// NIVL · Sistema de juego v2: un modelo único de progreso.
//
//   XP → nivel → rango (y grado) → título → cosméticos (marco y corona)
//
// y el CONTRATO de celebraciones que pinta la UI (Chat 4). Lógica pura: sin
// Supabase, sin React. La curva de XP y los niveles NO cambian (game.ts):
// lo que cambia es qué significa cada tramo.
//
// Por qué rehacer los rangos: con la curva 100·N^1,5 un gladiador constante
// (~270 XP netos/día) llega al nivel 8 al mes, 13 a los tres meses y 22 al
// año. Los rangos antiguos (A = nivel 71, S = 100) tardaban 15 y 36 años: por
// encima de C eran decorativos. Ahora cada rango cae en un momento real de la
// vida del usuario y cada uno tiene tres grados, así hay algo cualitativo que
// ganar cada uno-tres meses sin tocar el XP (skill nivl-game-design: «variedad
// > magnitud»).
//
// El rango NO baja nunca. El nivel sí puede bajar con una penalización
// (invariante: solo xp_total cae), pero lo ganado como identidad —rango,
// título, marco— se queda: se registra como logro `rango_X` (tabla
// achievements, ya existente) y manda el máximo entre ese registro y el nivel.

import { levelFromXp } from './game';

export type RangoId = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
export type Grado = 1 | 2 | 3;

/** Marco del avatar: evoluciona con el rango, siempre en blanco y negro. */
export type MarcoId = 'liso' | 'doble' | 'remachado' | 'laurel_simple' | 'laurel_doble' | 'laurel_corona';
/** Corona sobre el avatar: aparece desde el rango B. */
export type CoronaId = 'casco' | 'laurel' | 'corona_arena';

export interface RangoDef {
  id: RangoId;
  nombre: string;
  /** Primer nivel de cada grado: [I, II, III]. El I es el inicio del rango. */
  grados: [number, number, number];
  /** Título que se desbloquea al entrar en el rango (equipable). */
  titulo: string;
  marco: MarcoId;
  corona: CoronaId | null;
  /** Una línea para la ceremonia, en la voz del sistema. */
  lema: string;
}

// Días orientativos para ~270 XP netos/día (simulación del Chat 5).
export const RANGOS: RangoDef[] = [
  { id: 'E', nombre: 'Tiro', grados: [1, 2, 3], titulo: 'Tiro', marco: 'liso', corona: null,
    lema: 'Has pisado la arena. Ahora, vuelve mañana.' }, // día 0
  { id: 'D', nombre: 'Gladiador', grados: [5, 6, 8], titulo: 'Gladiador', marco: 'doble', corona: null,
    lema: 'Ya no eres un recién llegado. La arena te reconoce.' }, // ~1 semana
  { id: 'C', nombre: 'Veterano', grados: [10, 11, 13], titulo: 'Veterano', marco: 'remachado', corona: null,
    lema: 'Seis semanas de hierro. Esto ya es costumbre.' }, // ~6 semanas
  { id: 'B', nombre: 'Campeón', grados: [15, 17, 19], titulo: 'Campeón', marco: 'laurel_simple', corona: 'casco',
    lema: 'Cuatro meses sin rendirte. Pocos llegan aquí.' }, // ~4 meses
  { id: 'A', nombre: 'Héroe de la arena', grados: [22, 25, 28], titulo: 'Héroe de la arena', marco: 'laurel_doble', corona: 'laurel',
    lema: 'Un año entero de disciplina. Tu nombre pesa.' }, // ~10–11 meses
  { id: 'S', nombre: 'Leyenda', grados: [30, 35, 40], titulo: 'Leyenda', marco: 'laurel_corona', corona: 'corona_arena',
    lema: 'Dos años en la arena. Ya no compites con nadie más que contigo.' }, // ~2 años
];

const ORDEN: RangoId[] = ['E', 'D', 'C', 'B', 'A', 'S'];

export function rangoPorId(id: RangoId): RangoDef {
  return RANGOS[ORDEN.indexOf(id)]!;
}

export function compararRangos(a: RangoId, b: RangoId): number {
  return ORDEN.indexOf(a) - ORDEN.indexOf(b);
}

/** Rango y grado que corresponden a un nivel (sin memoria). */
export function rangoDeNivel(nivel: number): { rango: RangoDef; grado: Grado } {
  let r = RANGOS[0]!;
  for (const def of RANGOS) if (nivel >= def.grados[0]) r = def;
  const grado: Grado = nivel >= r.grados[2] ? 3 : nivel >= r.grados[1] ? 2 : 1;
  return { rango: r, grado };
}

/** Código de logro que registra para siempre un rango alcanzado. */
export const codigoRango = (id: RangoId) => `rango_${id}`;

/** El rango más alto registrado en los logros (o E si ninguno). */
export function rangoRegistrado(logros: Iterable<string>): RangoId {
  let max: RangoId = 'E';
  for (const c of logros) {
    const m = /^rango_([EDCBAS])$/.exec(c);
    if (m && compararRangos(m[1] as RangoId, max) > 0) max = m[1] as RangoId;
  }
  return max;
}

export interface EstadoProgreso {
  xp: number;
  nivel: number;
  /** XP dentro del nivel y coste del siguiente (0 = tope). */
  xpEnNivel: number;
  xpSiguiente: number;
  /** Rango vigente: el mayor entre el del nivel actual y el registrado. Nunca baja. */
  rango: RangoId;
  /** Grado dentro del rango del NIVEL actual (si el nivel bajó por debajo del rango, 1). */
  grado: Grado;
  racha: number;
  piedras: number;
  logros: ReadonlySet<string>;
}

export function estadoDe(p: {
  xp_total: number;
  streak_days: number;
  protection_stones: number;
}, logros: Iterable<string>): EstadoProgreso {
  const set = new Set(logros);
  const lvl = levelFromXp(p.xp_total);
  const porNivel = rangoDeNivel(lvl.level);
  const registrado = rangoRegistrado(set);
  const rango = compararRangos(porNivel.rango.id, registrado) >= 0 ? porNivel.rango.id : registrado;
  const grado: Grado = rango === porNivel.rango.id ? porNivel.grado : 1;
  return {
    xp: p.xp_total, nivel: lvl.level, xpEnNivel: lvl.into, xpSiguiente: lvl.next,
    rango, grado, racha: p.streak_days, piedras: p.protection_stones, logros: set,
  };
}

/** Lo que se lleva puesto: título por defecto del rango, marco y corona. */
export function cosmeticosDe(rango: RangoId): Pick<RangoDef, 'titulo' | 'marco' | 'corona'> {
  const r = rangoPorId(rango);
  return { titulo: r.titulo, marco: r.marco, corona: r.corona };
}

/** Títulos equipables: los de cada rango alcanzado más los de logros. */
export function titulosDisponibles(rango: RangoId, titulosDeLogros: string[]): string[] {
  const deRango = RANGOS.filter((r) => compararRangos(r.id, rango) <= 0).map((r) => r.titulo);
  return [...new Set([...deRango, ...titulosDeLogros])];
}

// ── Contrato de celebraciones (lo consume la UI del Chat 4) ─────────────

/**
 * Intensidad: decide animación, vibración y sonido en la UI.
 * - `epica`: pantalla completa (ceremonia). Como mucho UNA por acción.
 * - `media`: tarjeta grande que se descarta con un toque.
 * - `suave`: aviso breve (toast) que no interrumpe.
 */
export type Intensidad = 'suave' | 'media' | 'epica';

interface Base {
  /**
   * Clave idempotente: la UI la guarda al mostrarla y no repite una
   * celebración con la misma clave (dos dispositivos, recargas, reintentos).
   */
  clave: string;
  intensidad: Intensidad;
}

export type Celebracion =
  | (Base & { tipo: 'rango'; rango: RangoId; nombre: string; titulo: string; marco: MarcoId; corona: CoronaId | null; lema: string })
  | (Base & { tipo: 'grado'; rango: RangoId; nombre: string; grado: Grado })
  | (Base & { tipo: 'nivel'; nivel: number; xpEnNivel: number; xpSiguiente: number })
  | (Base & { tipo: 'logro'; codigo: string; nombre: string; desc: string; titulo: string | null })
  | (Base & { tipo: 'racha'; dias: number })
  | (Base & { tipo: 'piedra'; total: number })
  | (Base & { tipo: 'recuperacion'; xp: number })
  | (Base & { tipo: 'insignia'; insignia: InsigniaId; nivel: 1 | 2 | 3; nombre: string });

/** Hitos de racha que se celebran. */
export const HITOS_RACHA = [7, 14, 30, 60, 100, 180, 365] as const;

const PRIORIDAD: Record<Celebracion['tipo'], number> = {
  rango: 0, grado: 1, nivel: 2, racha: 3, logro: 4, insignia: 5, recuperacion: 6, piedra: 7,
};

// ── Insignias sociales (cosméticas, sin XP ni ventaja en rankings) ──────

export type InsigniaId = 'reclutador';

/**
 * «Reclutador» (acordado con el Chat 2 para 1.0.8): por amigos invitados que
 * llegan a ACTIVOS (3 días distintos con progreso en sus primeros 14 y cuenta
 * de 72 h o más; lo decide el servidor). Cero XP, cero días de Pro (Apple
 * 3.1.1): solo identidad.
 */
export const INSIGNIAS: Record<InsigniaId, { nombres: [string, string, string]; umbrales: [number, number, number] }> = {
  reclutador: { nombres: ['Reclutador', 'Lanista', 'Señor del ludus'], umbrales: [1, 3, 10] },
};

export function nivelInsignia(id: InsigniaId, cuenta: number): 0 | 1 | 2 | 3 {
  const u = INSIGNIAS[id].umbrales;
  return cuenta >= u[2] ? 3 : cuenta >= u[1] ? 2 : cuenta >= u[0] ? 1 : 0;
}

/** Celebración al subir de nivel de insignia (p. ej. invitados activos 2 → 3). */
export function celebracionInsignia(id: InsigniaId, antes: number, despues: number): Celebracion | null {
  const a = nivelInsignia(id, antes);
  const d = nivelInsignia(id, despues);
  if (d <= a) return null;
  return { tipo: 'insignia', clave: `insignia:${id}:${d}`, intensidad: d === 3 ? 'epica' : 'media', insignia: id,
    nivel: d as 1 | 2 | 3, nombre: INSIGNIAS[id].nombres[d - 1]! };
}

export interface LogroInfo {
  codigo: string;
  nombre: string;
  desc: string;
  titulo?: string;
}

/**
 * Qué celebrar entre dos estados. Pura y determinista.
 *
 * - Subir varios niveles de golpe = UNA celebración de nivel (el último).
 * - Un rango nuevo absorbe la de nivel y la de grado (la ceremonia ya lo dice).
 * - Bajar de nivel no se celebra ni se dramatiza aquí (lo cuenta el cierre).
 * - `logrosNuevos` son los que acaba de insertar `unlockAchievements`.
 * - `fecha` (YYYY-MM-DD) entra en las claves de lo repetible (racha, piedra,
 *   recuperación): una racha de 30 se puede volver a ganar tras perderla.
 */
export function celebracionesEntre(
  antes: EstadoProgreso,
  despues: EstadoProgreso,
  ctx: { fecha: string; logrosNuevos?: LogroInfo[]; recuperadoXp?: number },
): Celebracion[] {
  const out: Celebracion[] = [];
  const rangoNuevo = compararRangos(despues.rango, antes.rango) > 0;

  if (rangoNuevo) {
    const r = rangoPorId(despues.rango);
    out.push({ tipo: 'rango', clave: `rango:${r.id}`, intensidad: 'epica', rango: r.id, nombre: r.nombre,
      titulo: r.titulo, marco: r.marco, corona: r.corona, lema: r.lema });
  } else if (despues.rango === antes.rango && despues.grado > antes.grado && despues.nivel > antes.nivel) {
    const r = rangoPorId(despues.rango);
    out.push({ tipo: 'grado', clave: `grado:${r.id}:${despues.grado}`, intensidad: 'media', rango: r.id, nombre: r.nombre, grado: despues.grado });
  } else if (despues.nivel > antes.nivel) {
    out.push({ tipo: 'nivel', clave: `nivel:${despues.nivel}`, intensidad: 'media', nivel: despues.nivel,
      xpEnNivel: despues.xpEnNivel, xpSiguiente: despues.xpSiguiente });
  }

  for (const h of HITOS_RACHA) {
    if (antes.racha < h && despues.racha >= h) {
      out.push({ tipo: 'racha', clave: `racha:${h}:${ctx.fecha}`, intensidad: h >= 30 ? 'media' : 'suave', dias: h });
    }
  }

  for (const l of ctx.logrosNuevos ?? []) {
    // Los registros internos de rango no se celebran dos veces.
    if (/^rango_/.test(l.codigo)) continue;
    out.push({ tipo: 'logro', clave: `logro:${l.codigo}`, intensidad: l.titulo ? 'media' : 'suave',
      codigo: l.codigo, nombre: l.nombre, desc: l.desc, titulo: l.titulo ?? null });
  }

  if (despues.piedras > antes.piedras) {
    out.push({ tipo: 'piedra', clave: `piedra:${ctx.fecha}:${despues.piedras}`, intensidad: 'suave', total: despues.piedras });
  }
  if ((ctx.recuperadoXp ?? 0) > 0) {
    out.push({ tipo: 'recuperacion', clave: `recuperacion:${ctx.fecha}`, intensidad: 'suave', xp: ctx.recuperadoXp! });
  }

  out.sort((a, b) => PRIORIDAD[a.tipo] - PRIORIDAD[b.tipo]);
  // Como mucho una épica por acción: el resto baja a media.
  let epica = false;
  return out.map((c) => {
    if (c.intensidad !== 'epica') return c;
    if (epica) return { ...c, intensidad: 'media' as const };
    epica = true;
    return c;
  });
}

/**
 * Cómo enseñar una lista: la primera va sola (ceremonia o tarjeta) y las
 * demás se agrupan en un resumen. Nunca una cascada de pantallas.
 */
export function colaDeCelebracion(lista: Celebracion[], yaVistas: ReadonlySet<string> = new Set()): {
  principal: Celebracion | null;
  resto: Celebracion[];
} {
  const pendientes = lista.filter((c) => !yaVistas.has(c.clave));
  return { principal: pendientes[0] ?? null, resto: pendientes.slice(1) };
}

/** Logros de rango que hay que registrar para que el rango no baje nunca. */
export function codigosDeRangoPendientes(nivel: number, logros: ReadonlySet<string>): string[] {
  const actual = rangoDeNivel(nivel).rango.id;
  return ORDEN.slice(1, ORDEN.indexOf(actual) + 1)
    .map(codigoRango)
    .filter((c) => !logros.has(c));
}

/**
 * Atajo para la UI: lo que hay que celebrar tras una acción, a partir de los
 * perfiles devueltos por la RPC y de los logros. Es lo que llama cada pantalla
 * después de completar una misión, registrar un acto o cerrar el día.
 */
export function celebrarCambio(args: {
  perfilAntes: { xp_total: number; streak_days: number; protection_stones: number };
  perfilDespues: { xp_total: number; streak_days: number; protection_stones: number };
  logrosAntes: Iterable<string>;
  logrosNuevos?: LogroInfo[];
  fecha: string;
  recuperadoXp?: number;
}): Celebracion[] {
  const antesSet = new Set(args.logrosAntes);
  const despuesSet = new Set([...antesSet, ...(args.logrosNuevos ?? []).map((l) => l.codigo)]);
  return celebracionesEntre(
    estadoDe(args.perfilAntes, antesSet),
    estadoDe(args.perfilDespues, despuesSet),
    { fecha: args.fecha, logrosNuevos: args.logrosNuevos, recuperadoXp: args.recuperadoXp },
  );
}
