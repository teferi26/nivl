// NIVL · FOCUS: qué misión paga un bloque de estudio (puro, con tests).
//
// Un solo gesto, versión FOCUS: estudiar NO tiene XP propio. Lo que se mide son
// minutos reales: al acabar un bloque o una tanda de repaso se suman los de
// hoy y se mira qué misiones quedan cubiertas (`misionesCumplidas`). Esas se
// completan por el camino de siempre (`complete_quest`, una vez por misión y
// día). Un bloque de 5 minutos no paga «Estudiar 2 h», y los mismos minutos no
// sirven para dos misiones. Sin misión cubierta, cuenta horas y ni un punto.

export interface MisionFocus {
  id: string;
  titulo: string;
  hecha: boolean;
  /** Las de penalización no se enlazan: restauran, no se estudian. */
  penalizacion?: boolean;
  /** El acto al que está atada (quests.link). Si es otro, no se paga estudiando. */
  link?: string | null;
  /** Etiquetas de modo (quests.modes). Vacío: de cualquier modo. */
  modos?: readonly string[];
}

const normal = (s: string) =>
  s
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Atada a otro acto («Ir al gimnasio»): eso se demuestra allí, no estudiando. */
export const esDeOtroActo = (link: string | null | undefined): boolean => !!link && link !== 'ninguno' && link !== 'estudio';

const esDeOtroModo = (modos: readonly string[] | undefined): boolean => !!modos && modos.length > 0 && !modos.includes('focus');

/** Las misiones que se pueden enlazar a un bloque: de hoy, sin hacer, no de penalización ni de otro acto o modo. */
export function enlazables<T extends MisionFocus>(misiones: readonly T[]): T[] {
  return misiones.filter((m) => !m.hecha && !m.penalizacion && !esDeOtroActo(m.link) && !esDeOtroModo(m.modos));
}

/** Separa en palabras, con espacios en los bordes: «arte» no está en «la parte 2». */
const conBordes = (s: string) => ` ${normal(s).replace(/[\s.,;:!?¿¡()[\]/\\\-_'"«»·]+/g, ' ').trim()} `;

const nombra = (titulo: string, nombre: string) => {
  const n = conBordes(nombre);
  return n.trim().length >= 3 && conBordes(titulo).includes(n);
};

/**
 * La misión que se propone enlazar: la primera pendiente cuyo título nombra la
 * asignatura (sin tildes ni mayúsculas); si no, la enlazada al acto de estudiar
 * (vale en cualquier idioma) o la que diga que se estudia; si no, ninguna (el
 * usuario la elige a mano). «Leer 20 páginas» no se adjunta sola.
 */
export function misionPropuesta<T extends MisionFocus>(misiones: readonly T[], asignatura: string | null): T | null {
  const libres = enlazables(misiones);
  if (asignatura) {
    const porNombre = libres.find((m) => nombra(m.titulo, asignatura));
    if (porNombre) return porNombre;
  }
  return libres.find((m) => m.link === 'estudio') ?? libres.find((m) => /\b(estudi|repas|pomodoro)/.test(normal(m.titulo))) ?? null;
}

/** Lo que vale una misión sin cifra en el título: un pomodoro. */
export const MINUTOS_MISION_SIN_CIFRA = 25;
const MINUTOS_POMODORO = 25;

// Los títulos llegan en los seis idiomas de la app y ya pasados por `normal`
// (sin tildes ni mayúsculas).
const POR_VALOR: readonly [number, string][] = [
  [1, 'un una uno um uma one an une ein eine einen einer'],
  [2, 'dos dois duas two deux due zwei'],
  [3, 'tres three trois tre drei'],
  [4, 'cuatro quatro quattro quatre four vier'],
  [5, 'cinco cinque cinq five funf fuenf'],
  [6, 'seis sei six sechs'],
  [7, 'siete sete sette sept seven sieben'],
  [8, 'ocho oito otto huit eight acht'],
  [9, 'nueve nove neuf nine neun'],
  [10, 'diez dez dieci dix ten zehn'],
  [15, 'quince quinze quindici fifteen funfzehn'],
  [20, 'veinte vinte venti vingt twenty zwanzig'],
  [25, 'veinticinco'],
  [30, 'treinta trinta trenta trente thirty dreissig dreißig'],
  [40, 'cuarenta quarenta quaranta quarante forty vierzig'],
  [50, 'cincuenta cinquenta cinquante fifty funfzig'],
  [60, 'sesenta sessenta sessanta soixante sixty sechzig'],
  [90, 'noventa novanta ninety neunzig'],
];
const NUMEROS = new Map(POR_VALOR.flatMap(([v, ps]) => ps.split(' ').map((p) => [p, v] as const)));
const PALABRA = [...NUMEROS.keys()].sort((a, b) => b.length - a.length).join('|');
/** «cuarenta y cinco», «forty-five»: decenas más unidades. */
const NUM_EN_LETRA = `(?:(?:${PALABRA})(?:\\s+(?:y|e|et|and|und)\\s+|[\\s-]))?(?:${PALABRA})`;
const CIFRA = '\\d+(?:[.,]\\d+)?';
const HORAS = 'horas?|hours?|hrs?|heures?|ore|ora|stunden?|std';
const MINUTOS = 'minutos?|minutes?|minuti|minuten|mins?';
const POMODOROS = 'pomodoros?|pomodori|bloques?|blocks?|blocs?|blocchi|blocco|blocos?|blocke';
const CON = '(?:y|and|et|e|und)';

const RE_HORAS = new RegExp(`(?:(${CIFRA})\\s*(?:${HORAS}|h)|\\b(${NUM_EN_LETRA})\\s+(?:${HORAS}))(?![a-z])`);
const RE_MINUTOS = new RegExp(`(?:(\\d+)\\s*(?:${MINUTOS}|m)|\\b(${NUM_EN_LETRA})\\s+(?:${MINUTOS}))(?![a-z])`);
const RE_POMODOROS = new RegExp(`(?:(\\d+)\\s*|\\b(${NUM_EN_LETRA})\\s+)(?:${POMODOROS})(?![a-z])`);
const RE_MEDIA = new RegExp(`^\\s*${CON}\\s+(?:media|medio|a half|half|demie|mezza|mezzo|meia|meio|halb)(?![a-z])`);
const RE_CUARTO = new RegExp(`^\\s*${CON}\\s+(?:un\\s+|a\\s+)?(?:cuarto|quarter|quart|quarto)(?![a-z])`);
const RE_RESTO_LETRA = new RegExp(`^\\s*${CON}\\s+(${NUM_EN_LETRA})\\s+(?:${MINUTOS})(?![a-z])`);
const RE_RESTO_CIFRA = new RegExp(`^\\s*(?:${CON}\\s*)?(\\d{1,2})(\\s*(?:${MINUTOS}|m)(?![a-z]))?`);

/** Fracciones de hora: antes que nada, para que «half an hour» no sea «an hour». */
const FRACCIONES: readonly [RegExp, number][] = [
  [/\b(?:tres cuartos de hora|three quarters of an hour)\b/, 45],
  [/\b(?:media hora|half an hour|half hour|demi[- ]heure|mezz'?\s?ora|mezza ora|meia hora|halbe stunde)\b/, 30],
  [/\b(?:cuarto de hora|quarter of an hour|quart d'heure|quarto d'ora|quarto de hora|viertelstunde)\b/, 15],
];

/** Sin cifra pero con horas: van después de «1 hora y media», que manda. */
const FRASES: readonly [RegExp, number][] = [
  [/\b(?:hora y media|anderthalb stunden?)\b/, 90],
  [/\b(?:par de horas|couple of hours)\b/, 120],
];

const valor = (cifra: string | undefined, letra: string | undefined): number =>
  cifra !== undefined
    ? Number(cifra.replace(',', '.'))
    : (letra ?? '')
        .split(/[\s-]+/)
        .reduce((s, p) => s + (NUMEROS.get(p) ?? 0), 0);

/** Lo que sigue a las horas: «y media», «y cuarto», «30», «y 20 min», «y veinte minutos». */
function minutosTrasHoras(resto: string): number {
  if (RE_MEDIA.test(resto)) return 30;
  if (RE_CUARTO.test(resto)) return 15;
  const letra = RE_RESTO_LETRA.exec(resto);
  if (letra) return valor(undefined, letra[1]);
  const m = RE_RESTO_CIFRA.exec(resto);
  // «2 h 3 temas»: ese 3 no son minutos.
  if (!m || (!m[2] && /^\s*[a-z]/.test(resto.slice(m[0].length)))) return 0;
  return Number(m[1]);
}

function leerMinutosTitulo(n: string): number | null {
  for (const [re, min] of FRACCIONES) if (re.test(n)) return min;
  const h = RE_HORAS.exec(n);
  if (h) return Math.round(valor(h[1], h[2]) * 60) + minutosTrasHoras(n.slice(h.index + h[0].length));
  for (const [re, min] of FRASES) if (re.test(n)) return min;
  const m = RE_MINUTOS.exec(n);
  if (m) return valor(m[1], m[2]);
  const p = RE_POMODOROS.exec(n);
  if (p) return valor(p[1], p[2]) * MINUTOS_POMODORO;
  return null;
}

/**
 * Los minutos que pide el título: «Estudiar 2 h», «dos horas», «1 hora y media»,
 * «Study 2 hours», «90 min», «3 pomodoros». Sin cifra legible (o «0 min»), un pomodoro.
 */
export function minutosObjetivo(titulo: string): number {
  const min = leerMinutosTitulo(normal(titulo));
  return min !== null && Number.isFinite(min) && min > 0 ? Math.round(min) : MINUTOS_MISION_SIN_CIFRA;
}

export interface SesionParaMision {
  asignaturaId: string | null;
  minutos: number;
}

type AsignaturaNombre = { id: string; nombre: string };

/** La asignatura que nombra un título (la de nombre más largo si encajan varias). */
function asignaturaNombrada(titulo: string, asignaturas: readonly AsignaturaNombre[]): string | null {
  return [...asignaturas].sort((a, b) => b.nombre.length - a.nombre.length || a.id.localeCompare(b.id)).find((a) => nombra(titulo, a.nombre))?.id ?? null;
}

/**
 * Los ids de las misiones sin hacer que los minutos de hoy dejan cubiertas.
 * Consume minutos, sin pagar dos veces con los mismos: primero lo ya hecho
 * (hecho está), luego las que nombran una asignatura (solo con minutos de esa
 * asignatura) y al final las genéricas, de la que menos pide a la que más.
 * El orden de las sesiones no cambia el resultado.
 */
export function misionesCumplidas<T extends MisionFocus>(
  misiones: readonly T[],
  sesionesHoy: readonly SesionParaMision[],
  asignaturas: readonly AsignaturaNombre[],
): string[] {
  const bolsa = new Map<string | null, number>();
  for (const s of sesionesHoy) {
    if (!Number.isFinite(s.minutos) || s.minutos <= 0) continue;
    bolsa.set(s.asignaturaId, (bolsa.get(s.asignaturaId) ?? 0) + s.minutos);
  }
  const lista = misiones
    .filter((m) => !m.penalizacion)
    .map((m) => ({ m, objetivo: minutosObjetivo(m.titulo), asignaturaId: asignaturaNombrada(m.titulo, asignaturas) }))
    .sort(
      (a, b) =>
        Number(b.m.hecha) - Number(a.m.hecha) ||
        Number(b.asignaturaId !== null) - Number(a.asignaturaId !== null) ||
        a.objetivo - b.objetivo ||
        a.m.titulo.localeCompare(b.m.titulo) ||
        a.m.id.localeCompare(b.m.id),
    );
  // Las genéricas gastan primero lo que ninguna misión de asignatura necesita.
  const nombradas = new Set(lista.map((x) => x.asignaturaId).filter((id) => id !== null));
  const genericas: (string | null)[] = [
    null,
    ...[...bolsa.keys()]
      .filter((k): k is string => k !== null)
      .sort((a, b) => Number(nombradas.has(a)) - Number(nombradas.has(b)) || a.localeCompare(b)),
  ];
  const quedan = (ids: readonly (string | null)[]) => ids.reduce((s, id) => s + (bolsa.get(id) ?? 0), 0);
  const gastar = (ids: readonly (string | null)[], n: number) => {
    let falta = n;
    for (const id of ids) {
      const hay = bolsa.get(id) ?? 0;
      const usa = Math.min(hay, falta);
      bolsa.set(id, hay - usa);
      falta -= usa;
    }
  };
  const out: string[] = [];
  for (const { m, objetivo, asignaturaId } of lista) {
    const fuentes = asignaturaId !== null ? [asignaturaId] : genericas;
    const llega = quedan(fuentes) >= objetivo;
    if (m.hecha) {
      gastar(fuentes, objetivo);
    } else if (llega) {
      gastar(fuentes, objetivo);
      out.push(m.id);
    }
  }
  return out;
}

/**
 * ¿Llegan los minutos de hoy a lo que pide una regla del contrato? «Estudiar 2
 * horas cada día» no se da por cumplida con una tarjeta. Las reglas no pagan, así
 * que no gastan minutos: cada una se mide contra todo lo de hoy (o lo de su asignatura).
 */
export function reglaCubierta(texto: string, sesionesHoy: readonly SesionParaMision[], asignaturas: readonly AsignaturaNombre[]): boolean {
  const asignaturaId = asignaturaNombrada(texto, asignaturas);
  const minutos = sesionesHoy.reduce((s, x) => s + (Number.isFinite(x.minutos) && x.minutos > 0 && (asignaturaId === null || x.asignaturaId === asignaturaId) ? x.minutos : 0), 0);
  return minutos >= minutosObjetivo(texto);
}

/** Los minutos dictados al coach cuentan para las horas, pero no pagan nada. */
export const esSesionDictada = (clientId: unknown): boolean => typeof clientId === 'string' && clientId.startsWith('coach-');
