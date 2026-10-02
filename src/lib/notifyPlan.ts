// NIVL · El plan de avisos del sistema (E6).
//
// Lógica PURA: decide QUÉ avisos merece hoy el gladiador y A QUÉ HORA, sin red,
// sin expo-notifications y sin la zona horaria de la máquina. Trabaja solo con
// claves de fecha ('YYYY-MM-DD') y minutos del día en hora local de pared.
// Las dos únicas funciones que tocan `Date` local (`momentoDe` y
// `fechaDeAviso`) son adaptadores para quien programa de verdad (Chat 4).
//
// Reglas (contrato en docs/game-v2/PLAN-AVISOS.md):
//   · Como mucho 2 avisos LOCALES del sistema al día (+1 push del ritual).
//   · Silencio fuera de [despertar, dormir): por defecto 08:00–22:00.
//   · Caducidad: tras 7 días sin abrir, solo UN aviso de vuelta a los 7 días y
//     otro a los 30. Después, silencio total. Sin culpa.
//   · Enfriamiento de 24 h por tipo y nunca dos avisos a menos de 3 h.
//   · Prioridad si no caben: racha > recuperación > duelo > foto > rango.
//   · Cero avisos promocionales o de compra (no existen aquí a propósito).
//
// El copy NO vive aquí: `titulo` va siempre vacío y el Chat 4 lo escribe con
// la voz del sistema a partir de `tipo` y `datos`.

import { rachaVisible, recuperacionDesbloqueada } from './closing';
import type { Quest } from './types';

// ─── Constantes ──────────────────────────────────────────────────────────────

export const MAX_LOCALES_DIA = 2;
export const MAX_PUSH_SERVIDOR_DIA = 1;
export const SEPARACION_MIN = 180;
export const ENFRIAMIENTO_MIN = 24 * 60;
export const DIAS_CADUCIDAD = 7;
export const DIAS_VUELTA_FINAL = 30;
/** Ventana activa por defecto (fuera de ella, silencio). */
export const VENTANA_POR_DEFECTO = { inicio: 8 * 60, fin: 22 * 60 } as const;
/** Una ventana más corta que esto es un dato corrupto: se usa la de defecto. */
const VENTANA_MINIMA = 6 * 60;
/** Hora del aviso de racha cuando no hay sleep_time. */
const RACHA_SIN_SUENO = 21 * 60 + 30;
const RACHA_ANTES_DE_DORMIR = 90;
const PASO = 15;

export type TipoAviso = 'racha' | 'recuperacion' | 'duelo' | 'foto' | 'rango' | 'vuelta';

/** 1 = más importante. La vuelta nunca compite: va sola en su día. */
export const PRIORIDAD: Record<TipoAviso, number> = {
  vuelta: 0,
  racha: 1,
  recuperacion: 2,
  duelo: 3,
  foto: 4,
  rango: 5,
};

/**
 * Hora preferida y margen en el que se puede mover si choca. Todo en minutos
 * locales y siempre recortado a la ventana activa. `null` = usar la regla
 * propia del tipo (la racha depende de sleep_time).
 */
const HORARIO: Record<Exclude<TipoAviso, 'racha'>, { pref: number; desde: number; hasta: number }> = {
  recuperacion: { pref: 17 * 60, desde: 15 * 60, hasta: 19 * 60 }, // media tarde
  duelo: { pref: 19 * 60, desde: 10 * 60, hasta: 22 * 60 },
  foto: { pref: 11 * 60, desde: 10 * 60, hasta: 20 * 60 },
  rango: { pref: 13 * 60, desde: 10 * 60, hasta: 21 * 60 },
  vuelta: { pref: 12 * 60, desde: 10 * 60, hasta: 20 * 60 },
};

// ─── Tipos públicos ──────────────────────────────────────────────────────────

/** Un instante en hora local de pared: clave de fecha + minuto del día. */
export interface Momento {
  fecha: string;
  min: number;
}

/** Aviso del sistema ya entregado (o ya disparado) y su hora local. */
export interface AvisoPasado {
  tipo: TipoAviso;
  /** 'YYYY-MM-DDTHH:MM' local. */
  cuando: string;
}

export interface EstadoPlanAvisos {
  /** Día local de la última apertura de la app. null = nunca (se toma hoy). */
  ultimaApertura: string | null;
  /** 'HH:MM' o 'HH:MM:SS' (Postgres). null/ausente = 08:00. */
  wakeTime?: string | null;
  /** 'HH:MM' o 'HH:MM:SS'. null/ausente = 22:00. */
  sleepTime?: string | null;
  /** profiles.streak_days (días cerrados). */
  streakDays: number;
  /** questsScheduledOn(quests, hoy): incluye las penalizaciones de hoy. */
  questsHoy: Quest[];
  completadasHoy: Set<string>;
  /** Una piedra o congelación ya salva el día: no se avisa de la racha. */
  rachaProtegida?: boolean;
  /** Poses de la foto semanal que faltan. */
  fotosPendientes: number;
  /** Duelos aceptados o resueltos que aún no ha visto. */
  duelosPendientes: number;
  /** Subida de rango (u otra celebración épica) sin ver. */
  celebracionPendiente: boolean | { clave: string } | null;
  /** Avisos LOCALES del sistema ya disparados (para tope, 3 h y 24 h). */
  historial?: AvisoPasado[];
  /** Push del ritual del servidor, enviados o previstos ('YYYY-MM-DDTHH:MM'). */
  pushesServidor?: string[];
}

export type DatosAviso =
  | { tipo: 'racha'; racha: number; faltan: number }
  | { tipo: 'recuperacion'; desbloqueada: boolean; pista: 'completa_una_mision' | null; xp: number }
  | { tipo: 'duelo'; pendientes: number }
  | { tipo: 'foto'; pendientes: number }
  | { tipo: 'rango'; clave: string | null }
  | { tipo: 'vuelta'; dias: 7 | 30 };

export interface Aviso {
  /** Estable: `nivl.aviso.<tipo>.<fecha>` (vuelta: `nivl.aviso.vuelta7.<fecha>`). */
  id: string;
  tipo: TipoAviso;
  /** 'YYYY-MM-DDTHH:MM' en hora local de pared, sin zona. */
  cuando: string;
  /** Siempre vacío: el copy lo pone el Chat 4. */
  titulo?: undefined;
  datos: DatosAviso;
  prioridad: number;
}

export type FaseCaducidad = 'activa' | 'vuelta7' | 'silencio' | 'vuelta30' | 'apagada';

// ─── Fechas sin zona horaria ─────────────────────────────────────────────────

const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MOMENTO_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/;

/** Días desde 1970-01-01 de una clave. Aritmética UTC pura: sin DST. */
function diaNum(key: string): number | null {
  const m = KEY_RE.exec(key);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const t = Date.UTC(y, mo - 1, d);
  // Rechaza fechas imposibles (2026-02-30 caería en marzo).
  if (new Date(t).getUTCDate() !== d) return null;
  return Math.round(t / 86400000);
}

function keyDeNum(n: number): string {
  const d = new Date(n * 86400000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Suma días a una clave sin pasar por la zona horaria de la máquina. */
export function sumarDias(key: string, n: number): string {
  const base = diaNum(key);
  if (base === null) throw new Error(`Clave de fecha inválida: ${key}`);
  return keyDeNum(base + n);
}

/** Días entre dos claves (b − a). */
export function diasEntre(a: string, b: string): number {
  const na = diaNum(a);
  const nb = diaNum(b);
  if (na === null || nb === null) throw new Error(`Clave de fecha inválida: ${a} / ${b}`);
  return nb - na;
}

/** 1 = lunes … 7 = domingo, sin zona horaria. */
export function diaSemana(key: string): number {
  const n = diaNum(key);
  if (n === null) throw new Error(`Clave de fecha inválida: ${key}`);
  const wd = new Date(n * 86400000).getUTCDay();
  return wd === 0 ? 7 : wd;
}

/** 'HH:MM' o 'HH:MM:SS' → minutos. null si no es una hora válida. */
export function minutosDe(hora: string | null | undefined): number | null {
  if (!hora) return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(hora.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

export function hhmmDe(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export function cuandoDe(m: Momento): string {
  return `${m.fecha}T${hhmmDe(m.min)}`;
}

/** 'YYYY-MM-DDTHH:MM' → Momento. null si no es válido. */
export function momentoDeCuando(cuando: string): Momento | null {
  const m = MOMENTO_RE.exec(cuando);
  if (!m || diaNum(m[1]) === null) return null;
  const h = Number(m[2]);
  const mi = Number(m[3]);
  if (h > 23 || mi > 59) return null;
  return { fecha: m[1], min: h * 60 + mi };
}

/** Minuto absoluto de pared (para distancias de 3 h y 24 h). */
function absoluto(m: Momento): number {
  return (diaNum(m.fecha) as number) * 1440 + m.min;
}

// ─── Adaptadores (los únicos que dependen de la hora local del dispositivo) ──

/** `new Date()` → Momento local. Para construir `ahora` en la app. */
export function momentoDe(d: Date): Momento {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return { fecha: `${y}-${m}-${day}`, min: d.getHours() * 60 + d.getMinutes() };
}

/**
 * `cuando` → Date local para el disparador DATE de expo-notifications. El SO
 * resuelve la hora de pared, así que 21:30 sigue siendo 21:30 el día del
 * cambio de hora.
 */
export function fechaDeAviso(cuando: string): Date | null {
  const m = momentoDeCuando(cuando);
  if (!m) return null;
  const [y, mo, d] = m.fecha.split('-').map(Number);
  return new Date(y, mo - 1, d, Math.floor(m.min / 60), m.min % 60, 0, 0);
}

// ─── Ventana activa y caducidad ──────────────────────────────────────────────

/**
 * Minutos del día en los que se puede avisar: [inicio, fin). Fuera, silencio.
 * Si dormir cae pasada la medianoche, el día se corta en 24:00 (lo de después
 * de medianoche es de la noche anterior y no se usa).
 */
export function ventanaActiva(wakeTime?: string | null, sleepTime?: string | null): { inicio: number; fin: number } {
  const w = minutosDe(wakeTime);
  const s = minutosDe(sleepTime);
  const inicio = w ?? VENTANA_POR_DEFECTO.inicio;
  let fin = s ?? VENTANA_POR_DEFECTO.fin;
  if (fin <= inicio) fin += 1440;
  if (fin - inicio < VENTANA_MINIMA) return { ...VENTANA_POR_DEFECTO };
  return { inicio, fin: Math.min(fin, 1440) };
}

/** ¿Es hora de silencio? */
export function enSilencio(min: number, wakeTime?: string | null, sleepTime?: string | null): boolean {
  const v = ventanaActiva(wakeTime, sleepTime);
  return min < v.inicio || min >= v.fin;
}

/** Minuto del aviso de racha: 90 min antes de dormir, o 21:30. */
export function horaRacha(sleepTime?: string | null): number {
  const s = minutosDe(sleepTime);
  if (s === null) return RACHA_SIN_SUENO;
  // Dormir pasada la medianoche (00:30) cuenta como 24:30.
  const fin = s < 12 * 60 ? s + 1440 : s;
  return Math.min(fin - RACHA_ANTES_DE_DORMIR, 1439);
}

/**
 * En qué punto de la caducidad está. 0–6 días sin abrir: activa. Día 7: solo
 * la vuelta. 8–29: silencio. Día 30: la última vuelta. Después, nada.
 */
export function faseCaducidad(ultimaApertura: string | null, hoy: string): { dias: number; fase: FaseCaducidad } {
  const dias = ultimaApertura ? Math.max(0, diasEntre(ultimaApertura, hoy)) : 0;
  let fase: FaseCaducidad;
  if (dias < DIAS_CADUCIDAD) fase = 'activa';
  else if (dias === DIAS_CADUCIDAD) fase = 'vuelta7';
  else if (dias < DIAS_VUELTA_FINAL) fase = 'silencio';
  else if (dias === DIAS_VUELTA_FINAL) fase = 'vuelta30';
  else fase = 'apagada';
  return { dias, fase };
}

/**
 * Último día en que pueden sonar avisos recurrentes del usuario (despertador,
 * bloques del plan): RET-06. Se reprograman en cada apertura.
 */
export function ultimoDiaConAvisos(ultimaApertura: string): string {
  return sumarDias(ultimaApertura, DIAS_CADUCIDAD - 1);
}

// ─── Colocación ──────────────────────────────────────────────────────────────

interface Candidato {
  tipo: TipoAviso;
  fecha: string;
  pref: number;
  desde: number;
  hasta: number;
  datos: DatosAviso;
  idTipo: string;
}

interface Ocupacion {
  /** Minutos absolutos de cualquier aviso ya puesto o enviado. */
  todos: number[];
  /** Por tipo, para el enfriamiento. */
  porTipo: Map<TipoAviso, number[]>;
  /** Avisos locales por fecha (para el tope diario). */
  localesPorDia: Map<string, number>;
}

function colocar(c: Candidato, occ: Ocupacion, ventana: { inicio: number; fin: number }, ahora: Momento): number | null {
  const lo = Math.max(c.desde, ventana.inicio);
  const hi = Math.min(c.hasta, ventana.fin - 1);
  if (lo > hi) return null;
  const base = diaNum(c.fecha) as number;
  const minimo = c.fecha === ahora.fecha ? ahora.min + 1 : 0;
  const mismos = occ.porTipo.get(c.tipo) ?? [];
  const valido = (t: number): boolean => {
    if (t < lo || t > hi || t < minimo) return false;
    const abs = base * 1440 + t;
    if (occ.todos.some((o) => Math.abs(abs - o) < SEPARACION_MIN)) return false;
    if (mismos.some((o) => Math.abs(abs - o) < ENFRIAMIENTO_MIN)) return false;
    return true;
  };
  // Primero la hora preferida; después alternando más tarde / más temprano en
  // pasos de 15 min, el más cercano primero (a igual distancia, el anterior).
  const maxPasos = Math.ceil(1440 / PASO);
  if (valido(c.pref)) return c.pref;
  for (let k = 1; k <= maxPasos; k++) {
    const antes = c.pref - k * PASO;
    const despues = c.pref + k * PASO;
    if (valido(antes)) return antes;
    if (valido(despues)) return despues;
    if (antes < lo && despues > hi) break;
  }
  // Si el inicio permitido no cae en la rejilla, pruébalo tal cual.
  const primero = Math.max(lo, minimo);
  return valido(primero) ? primero : null;
}

function registrar(occ: Ocupacion, tipo: TipoAviso, m: Momento, local: boolean): void {
  const abs = absoluto(m);
  occ.todos.push(abs);
  if (!local) return;
  const lista = occ.porTipo.get(tipo) ?? [];
  lista.push(abs);
  occ.porTipo.set(tipo, lista);
  occ.localesPorDia.set(m.fecha, (occ.localesPorDia.get(m.fecha) ?? 0) + 1);
}

function normalizarAhora(ahora: Momento | string): Momento | null {
  if (typeof ahora === 'string') return momentoDeCuando(ahora);
  if (!ahora || diaNum(ahora.fecha) === null) return null;
  if (!Number.isInteger(ahora.min) || ahora.min < 0 || ahora.min > 1439) return null;
  return ahora;
}

// ─── Candidatos de hoy ───────────────────────────────────────────────────────

function candidatosDeHoy(estado: EstadoPlanAvisos, hoy: string): Candidato[] {
  const out: Candidato[] = [];
  const quests = estado.questsHoy ?? [];
  const hechas = estado.completadasHoy ?? new Set<string>();

  // Racha en juego: quedan misiones que la romperían.
  if (estado.streakDays > 0 && !estado.rachaProtegida) {
    const rv = rachaVisible(estado.streakDays, quests, hechas);
    if (rv.faltan > 0) {
      const pref = horaRacha(estado.sleepTime);
      out.push({
        tipo: 'racha', fecha: hoy, pref, desde: pref - 120, hasta: pref,
        datos: { tipo: 'racha', racha: estado.streakDays, faltan: rv.faltan },
        idTipo: 'racha',
      });
    }
  }

  // Recuperación: penalización de hoy sin completar.
  const penalizaciones = quests.filter((q) => q.is_penalty && !hechas.has(q.id));
  if (penalizaciones.length) {
    const desbloqueada = recuperacionDesbloqueada(quests, hechas, hoy);
    out.push({
      tipo: 'recuperacion', fecha: hoy, ...HORARIO.recuperacion,
      datos: {
        tipo: 'recuperacion',
        desbloqueada,
        pista: desbloqueada ? null : 'completa_una_mision',
        xp: penalizaciones.reduce((s, q) => s + (q.penalty_xp ?? 0), 0),
      },
      idTipo: 'recuperacion',
    });
  }

  if (estado.duelosPendientes > 0) {
    out.push({
      tipo: 'duelo', fecha: hoy, ...HORARIO.duelo,
      datos: { tipo: 'duelo', pendientes: estado.duelosPendientes },
      idTipo: 'duelo',
    });
  }

  if (estado.fotosPendientes > 0 && diaSemana(hoy) === 7) {
    out.push({
      tipo: 'foto', fecha: hoy, ...HORARIO.foto,
      datos: { tipo: 'foto', pendientes: estado.fotosPendientes },
      idTipo: 'foto',
    });
  }

  const cel = estado.celebracionPendiente;
  if (cel) {
    out.push({
      tipo: 'rango', fecha: hoy, ...HORARIO.rango,
      datos: { tipo: 'rango', clave: typeof cel === 'object' ? cel.clave : null },
      idTipo: 'rango',
    });
  }

  return out.sort((a, b) => PRIORIDAD[a.tipo] - PRIORIDAD[b.tipo]);
}

function candidatoVuelta(fecha: string, dias: 7 | 30): Candidato {
  return {
    tipo: 'vuelta', fecha, ...HORARIO.vuelta,
    datos: { tipo: 'vuelta', dias },
    idTipo: `vuelta${dias}`,
  };
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Los avisos locales del sistema que hay que tener programados AHORA.
 *
 * Se recalcula en cada apertura y cada vez que cambia algo relevante
 * (completar, aceptar un duelo, ver la celebración). Devuelve los avisos de hoy
 * que aún no han pasado y las dos vueltas futuras (día +7 y +30 desde la
 * última apertura). Quien programa cancela lo anterior y pone esto.
 */
export function planDeAvisos(estado: EstadoPlanAvisos, ahoraIn: Momento | string): Aviso[] {
  const ahora = normalizarAhora(ahoraIn);
  if (!ahora) return [];
  const hoy = ahora.fecha;
  const apertura = estado.ultimaApertura && diaNum(estado.ultimaApertura) !== null ? estado.ultimaApertura : hoy;
  const { fase } = faseCaducidad(apertura, hoy);
  if (fase === 'apagada') return [];

  const ventana = ventanaActiva(estado.wakeTime, estado.sleepTime);
  const occ: Ocupacion = { todos: [], porTipo: new Map(), localesPorDia: new Map() };
  for (const h of estado.historial ?? []) {
    const m = momentoDeCuando(h.cuando);
    if (m && absoluto(m) <= absoluto(ahora)) registrar(occ, h.tipo, m, true);
  }
  for (const p of estado.pushesServidor ?? []) {
    const m = momentoDeCuando(p);
    if (m) registrar(occ, 'vuelta', m, false);
  }

  const candidatos: Candidato[] = [];
  if (fase === 'activa') candidatos.push(...candidatosDeHoy(estado, hoy));
  const dia7 = sumarDias(apertura, DIAS_CADUCIDAD);
  const dia30 = sumarDias(apertura, DIAS_VUELTA_FINAL);
  if (fase === 'activa' || fase === 'vuelta7') candidatos.push(candidatoVuelta(dia7, 7));
  candidatos.push(candidatoVuelta(dia30, 30));

  const avisos: Aviso[] = [];
  for (const c of candidatos) {
    if ((occ.localesPorDia.get(c.fecha) ?? 0) >= MAX_LOCALES_DIA) continue;
    if (diasEntre(hoy, c.fecha) < 0) continue;
    const min = colocar(c, occ, ventana, ahora);
    if (min === null) continue;
    const m: Momento = { fecha: c.fecha, min };
    registrar(occ, c.tipo, m, true);
    avisos.push({
      id: `nivl.aviso.${c.idTipo}.${c.fecha}`,
      tipo: c.tipo,
      cuando: cuandoDe(m),
      datos: c.datos,
      prioridad: PRIORIDAD[c.tipo],
    });
  }
  return avisos.sort((a, b) => (a.cuando < b.cuando ? -1 : a.cuando > b.cuando ? 1 : a.prioridad - b.prioridad));
}

/**
 * Regla para el ritual del servidor (se copia tal cual al espejo Deno): como
 * mucho UN push al día, solo en la ventana activa y solo mientras la app no
 * haya caducado (menos de 7 días sin abrir). En caducidad el servidor calla:
 * las dos vueltas son locales y no se duplican.
 */
export function pushDelServidorPermitido(
  args: {
    ultimaApertura: string | null;
    wakeTime?: string | null;
    sleepTime?: string | null;
    /** Push del ritual ya enviados hoy (fecha local). */
    pushesHoy: number;
  },
  ahoraIn: Momento | string,
): { ok: boolean; motivo: 'ok' | 'caducada' | 'silencio' | 'tope' | 'fecha' } {
  const ahora = normalizarAhora(ahoraIn);
  if (!ahora) return { ok: false, motivo: 'fecha' };
  const apertura = args.ultimaApertura && diaNum(args.ultimaApertura) !== null ? args.ultimaApertura : ahora.fecha;
  if (faseCaducidad(apertura, ahora.fecha).fase !== 'activa') return { ok: false, motivo: 'caducada' };
  if (enSilencio(ahora.min, args.wakeTime, args.sleepTime)) return { ok: false, motivo: 'silencio' };
  if (args.pushesHoy >= MAX_PUSH_SERVIDOR_DIA) return { ok: false, motivo: 'tope' };
  return { ok: true, motivo: 'ok' };
}
