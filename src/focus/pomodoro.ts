// NIVL · FOCUS: el pomodoro como máquina de estados (puro, con tests).
//
//   foco (25) → descanso (5) → foco → descanso → foco → descanso → foco → LARGO (15) → foco…
//
// El reloj no cuenta segundos: guarda CUÁNDO acaba la fase (`finEn`, ms de
// época). Así sobrevive a la app en segundo plano, a un cierre o a un reinicio:
// al volver se mira `ahora >= finEn` y se cierra la fase que acabó fuera. La
// notificación local se programa para `finEn` (src/focus/temporizador.ts).
//
// Ningún paso de aquí paga XP: una fase de foco terminada ENTERA es lo único
// que puede cumplir una misión de FOCUS enlazada (src/focus/mision.ts).

export type Fase = 'foco' | 'descanso' | 'largo';

export interface ConfigPomodoro {
  /** Minutos de cada bloque de foco. */
  foco: number;
  descanso: number;
  largo: number;
  /** Cada cuántos bloques de foco toca el descanso largo. */
  cadaLargo: number;
  /** Encadenar la fase siguiente sola al acabar una. */
  encadenar: boolean;
  sonido: boolean;
}

export const CONFIG_POR_DEFECTO: ConfigPomodoro = {
  foco: 25,
  descanso: 5,
  largo: 15,
  cadaLargo: 4,
  encadenar: false,
  sonido: true,
};

/** Topes: un bloque de foco de 5 a 90 min; descansos de 1 a 30 (largo hasta 45). */
export const LIMITES = {
  foco: [5, 90],
  descanso: [1, 30],
  largo: [5, 45],
  cadaLargo: [2, 8],
} as const;

const recorta = (v: unknown, [min, max]: readonly [number, number], defecto: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : defecto;
  return Math.max(min, Math.min(max, n));
};

/** Lee una configuración guardada (o de un formulario) sin fiarse de nada. */
export function normalizarConfig(c: Partial<ConfigPomodoro> | null | undefined): ConfigPomodoro {
  const d = CONFIG_POR_DEFECTO;
  return {
    foco: recorta(c?.foco, LIMITES.foco, d.foco),
    descanso: recorta(c?.descanso, LIMITES.descanso, d.descanso),
    largo: recorta(c?.largo, LIMITES.largo, d.largo),
    cadaLargo: recorta(c?.cadaLargo, LIMITES.cadaLargo, d.cadaLargo),
    encadenar: typeof c?.encadenar === 'boolean' ? c.encadenar : d.encadenar,
    sonido: typeof c?.sonido === 'boolean' ? c.sonido : d.sonido,
  };
}

export function minutosDe(fase: Fase, c: ConfigPomodoro): number {
  return fase === 'foco' ? c.foco : fase === 'descanso' ? c.descanso : c.largo;
}

/** Lo que estudia el bloque (todo opcional: un bloque libre también vale). */
export interface Objetivo {
  asignaturaId: string | null;
  temaId: string | null;
  /** La misión de FOCUS que paga si el bloque se completa entero. */
  misionId: string | null;
}

export interface EstadoPomodoro {
  fase: Fase;
  /** Bloque de foco en curso o el que viene (1 … cadaLargo). */
  bloque: number;
  /** Cuándo acaba la fase en marcha (ms de época), o null si está parada. */
  finEn: number | null;
  /** Con la fase en pausa, los ms que le quedaban. */
  pausaRestante: number | null;
  objetivo: Objetivo;
  /** Id de la fase en marcha: la sesión se registra UNA vez por id. */
  idFase: string | null;
}

export const OBJETIVO_LIBRE: Objetivo = { asignaturaId: null, temaId: null, misionId: null };

export const ESTADO_INICIAL: EstadoPomodoro = {
  fase: 'foco',
  bloque: 1,
  finEn: null,
  pausaRestante: null,
  objetivo: OBJETIVO_LIBRE,
  idFase: null,
};

export type Situacion = 'parado' | 'en_marcha' | 'en_pausa';

export function situacion(e: EstadoPomodoro): Situacion {
  if (e.finEn !== null) return 'en_marcha';
  if (e.pausaRestante !== null) return 'en_pausa';
  return 'parado';
}

/** Ms que quedan de la fase (la duración entera si está parada). */
export function restanteMs(e: EstadoPomodoro, c: ConfigPomodoro, ahora: number): number {
  if (e.finEn !== null) return Math.max(0, e.finEn - ahora);
  if (e.pausaRestante !== null) return Math.max(0, e.pausaRestante);
  return minutosDe(e.fase, c) * 60_000;
}

/** Fracción hecha de la fase, 0 a 1 (para el anillo). */
export function progreso(e: EstadoPomodoro, c: ConfigPomodoro, ahora: number): number {
  const total = minutosDe(e.fase, c) * 60_000;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - restanteMs(e, c, ahora) / total));
}

/** «25:00», «4:05», «1:02:00». Redondea hacia arriba: el último segundo se ve como 0:01. */
export function formatoReloj(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Arranca la fase actual desde el principio (o desde la pausa, si la hay). */
export function arrancar(e: EstadoPomodoro, c: ConfigPomodoro, ahora: number, objetivo?: Objetivo): EstadoPomodoro {
  if (e.finEn !== null) return e;
  const dura = e.pausaRestante ?? minutosDe(e.fase, c) * 60_000;
  return {
    ...e,
    finEn: ahora + dura,
    pausaRestante: null,
    objetivo: objetivo ?? e.objetivo,
    idFase: e.idFase ?? `${e.fase}-${e.bloque}-${ahora}`,
  };
}

export function pausar(e: EstadoPomodoro, ahora: number): EstadoPomodoro {
  if (e.finEn === null) return e;
  return { ...e, finEn: null, pausaRestante: Math.max(0, e.finEn - ahora) };
}

/** Ha acabado la fase en marcha (aunque fuera con la app cerrada). */
export function acabada(e: EstadoPomodoro, ahora: number): boolean {
  return e.finEn !== null && ahora >= e.finEn;
}

/** La fase que viene después de `e` (sin arrancarla). */
export function siguiente(e: Pick<EstadoPomodoro, 'fase' | 'bloque'>, c: ConfigPomodoro): Pick<EstadoPomodoro, 'fase' | 'bloque'> {
  if (e.fase === 'foco') return { fase: e.bloque >= c.cadaLargo ? 'largo' : 'descanso', bloque: e.bloque };
  if (e.fase === 'largo') return { fase: 'foco', bloque: 1 };
  return { fase: 'foco', bloque: Math.min(c.cadaLargo, e.bloque + 1) };
}

export interface Cierre {
  estado: EstadoPomodoro;
  /** Si lo que acaba de cerrarse es un bloque de foco completo, sus minutos. */
  focoCompleto: { minutos: number; objetivo: Objetivo; idFase: string } | null;
}

/**
 * Cierra la fase (acabada sola o saltada) y deja la siguiente lista. Saltar un
 * foco a medias NO cuenta como completo: solo paga lo que se termina.
 * Con `encadenar`, la siguiente arranca sola en el instante en que acabó esta.
 */
export function cerrarFase(e: EstadoPomodoro, c: ConfigPomodoro, ahora: number, saltada = false): Cierre {
  const completa = !saltada && acabada(e, ahora);
  const focoCompleto =
    completa && e.fase === 'foco' ? { minutos: c.foco, objetivo: e.objetivo, idFase: e.idFase ?? `foco-${e.bloque}-${ahora}` } : null;
  const sig = siguiente(e, c);
  let estado: EstadoPomodoro = { ...e, ...sig, finEn: null, pausaRestante: null, idFase: null };
  if (completa && c.encadenar && e.finEn !== null) {
    const inicio = e.finEn;
    estado = { ...estado, finEn: inicio + minutosDe(sig.fase, c) * 60_000, idFase: `${sig.fase}-${sig.bloque}-${inicio}` };
    // Si también la encadenada acabó fuera, se deja para el siguiente vistazo (nunca se paga un bloque no vivido).
  }
  return { estado, focoCompleto };
}

/** Parar del todo: vuelve al foco del bloque en curso, sin pagar nada. */
export function detener(e: EstadoPomodoro): EstadoPomodoro {
  return { ...e, fase: 'foco', finEn: null, pausaRestante: null, idFase: null };
}

/** Lee un estado guardado sin fiarse (AsyncStorage puede traer cualquier cosa). */
export function normalizarEstado(v: unknown, c: ConfigPomodoro): EstadoPomodoro {
  if (!v || typeof v !== 'object') return ESTADO_INICIAL;
  const o = v as Record<string, unknown>;
  const fase: Fase = o.fase === 'descanso' || o.fase === 'largo' ? o.fase : 'foco';
  const bloque = typeof o.bloque === 'number' && Number.isFinite(o.bloque) ? Math.max(1, Math.min(c.cadaLargo, Math.round(o.bloque))) : 1;
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  const str = (x: unknown) => (typeof x === 'string' && x.length > 0 && x.length < 80 ? x : null);
  const obj = (o.objetivo && typeof o.objetivo === 'object' ? o.objetivo : {}) as Record<string, unknown>;
  const finEn = num(o.finEn);
  const pausa = finEn === null ? num(o.pausaRestante) : null;
  return {
    fase,
    bloque,
    finEn,
    pausaRestante: pausa,
    objetivo: { asignaturaId: str(obj.asignaturaId), temaId: str(obj.temaId), misionId: str(obj.misionId) },
    idFase: str(o.idFase),
  };
}
