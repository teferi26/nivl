// NIVL · Analítica del recorrido, parte pura (sin Supabase ni AsyncStorage).
// Los efectos viven en `analitica.ts`; el servidor, en la 0070.
//
// Qué se mide: el embudo de una instalación, de su primer arranque a la
// compra (docs/modos/F1-analitica.md). Qué NO se mide: nada que la persona
// escriba. Cada evento admite unas claves fijas y cada valor es un entero, un
// booleano o un código corto [a-z0-9_]; lo demás se tira aquí antes de salir
// del móvil, y el servidor lo vuelve a comprobar con la misma lista
// (`funnel_claves_admitidas` / `funnel_props_validas`). Si tocas una, toca la
// otra.

export const EVENTOS_EMBUDO = [
  'primer_arranque',
  'onboarding_paso',
  'onboarding_fin',
  'registro',
  'primera_mision_creada',
  'primera_mision_completada',
  'apertura_dia',
  'paywall_visto',
  'compra_iniciada',
  'compra_ok',
] as const;

export type EventoEmbudo = (typeof EVENTOS_EMBUDO)[number];

export type ValorEmbudo = string | number | boolean;
export type PropsEmbudo = Record<string, ValorEmbudo>;

type Regla =
  | { tipo: 'entero'; min: number; max: number }
  | { tipo: 'booleano' }
  /** Un código de la app (plan, momento del paywall): solo [a-z0-9_]{1,32}. */
  | { tipo: 'codigo' }
  /** Un código de una lista cerrada. */
  | { tipo: 'uno_de'; valores: readonly string[] };

export const SALIDAS_ONBOARDING = ['compra', 'prueba', 'cerrada', 'sin_oferta', 'ya_pro'] as const;
export type SalidaOnboarding = (typeof SALIDAS_ONBOARDING)[number];
export const ORIGENES_MISION = ['onboarding', 'habitos', 'informe', 'oraculo', 'otro'] as const;
export type OrigenMision = (typeof ORIGENES_MISION)[number];

/** Lista blanca: por evento, las claves admitidas y su forma. */
export const PROPS_ADMITIDAS: Record<EventoEmbudo, Record<string, Regla>> = {
  /** previo: ya había sesión al estrenar la analítica (viene de una versión anterior). */
  primer_arranque: { previo: { tipo: 'booleano' } },
  onboarding_paso: { paso: { tipo: 'entero', min: 0, max: 20 } },
  onboarding_fin: { salida: { tipo: 'uno_de', valores: SALIDAS_ONBOARDING } },
  registro: { resultado: { tipo: 'uno_de', valores: ['sesion', 'confirmar_email'] } },
  primera_mision_creada: { origen: { tipo: 'uno_de', valores: ORIGENES_MISION } },
  primera_mision_completada: { con_foto: { tipo: 'booleano' } },
  apertura_dia: { dia: { tipo: 'entero', min: 0, max: 3650 } },
  paywall_visto: { motivo: { tipo: 'codigo' }, compacto: { tipo: 'booleano' } },
  compra_iniciada: { plan: { tipo: 'codigo' } },
  compra_ok: { plan: { tipo: 'codigo' }, resultado: { tipo: 'uno_de', valores: ['activa', 'pendiente', 'programada'] } },
};

export const CODIGO_RE = /^[a-z0-9_]{1,32}$/;

export function esEvento(x: unknown): x is EventoEmbudo {
  return typeof x === 'string' && (EVENTOS_EMBUDO as readonly string[]).includes(x);
}

function cumple(regla: Regla, v: unknown): v is ValorEmbudo {
  switch (regla.tipo) {
    case 'entero':
      return typeof v === 'number' && Number.isInteger(v) && v >= regla.min && v <= regla.max;
    case 'booleano':
      return typeof v === 'boolean';
    case 'codigo':
      return typeof v === 'string' && CODIGO_RE.test(v);
    case 'uno_de':
      return typeof v === 'string' && regla.valores.includes(v);
  }
}

/**
 * Las props que pueden salir del móvil: solo las claves de la lista del
 * evento y solo con un valor de su forma. Lo demás se descarta en silencio
 * (nunca se manda «a ver si cuela»). Un evento desconocido da {}.
 */
export function limpiarProps(evento: EventoEmbudo, props?: Record<string, unknown> | null): PropsEmbudo {
  const reglas = PROPS_ADMITIDAS[evento];
  const out: PropsEmbudo = {};
  if (!reglas || !props || typeof props !== 'object') return out;
  for (const [k, regla] of Object.entries(reglas)) {
    const v = props[k];
    if (cumple(regla, v)) out[k] = v;
  }
  return out;
}

/** Lo que espera en el móvil a que haya red (y el flag). */
export interface EventoEnCola {
  evento: EventoEmbudo;
  props: PropsEmbudo;
  /** Cuándo pasó (ISO). El servidor lo acota a los últimos 30 días. */
  ts: string;
}

/** Tope de la cola: si el móvil pasa semanas sin red, se pierde lo más viejo. */
export const MAX_COLA = 200;

export function encolar(cola: readonly EventoEnCola[], item: EventoEnCola, max = MAX_COLA): EventoEnCola[] {
  const out = [...cola, item];
  return out.length > max ? out.slice(out.length - max) : out;
}

/** Lee una cola guardada sin fiarse de lo que haya: lo que no tiene forma se tira. */
export function leerCola(crudo: string | null): EventoEnCola[] {
  if (!crudo) return [];
  try {
    const v: unknown = JSON.parse(crudo);
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is EventoEnCola =>
        !!x && typeof x === 'object' && esEvento((x as EventoEnCola).evento) && typeof (x as EventoEnCola).ts === 'string')
      .map((x) => ({ evento: x.evento, props: limpiarProps(x.evento, x.props), ts: x.ts }))
      .slice(-MAX_COLA);
  } catch {
    return [];
  }
}

// ── Instalación ─────────────────────────────────────────────────────

/** Mismo patrón que el CHECK de `funnel_events.install_id`. */
export const INSTALL_ID_RE = /^[A-Za-z0-9-]{16,64}$/;

export function esInstallId(x: unknown): x is string {
  return typeof x === 'string' && INSTALL_ID_RE.test(x);
}

/** Un uuid v4 con el azar que se le dé (Math.random por defecto: no es secreto, solo distinto). */
export function nuevoInstallId(azar: () => number = Math.random): string {
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(azar() * 16).toString(16)).join('');
  const variante = (8 + Math.floor(azar() * 4)).toString(16);
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${variante}${hex(3)}-${hex(12)}`;
}

export interface Instalacion {
  id: string;
  /** Día local (YYYY-MM-DD) del primer arranque. */
  primerDia: string;
  /** Último día local en que se apuntó una apertura. */
  ultimoDia: string;
}

const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;

export function leerInstalacion(crudo: string | null): Instalacion | null {
  if (!crudo) return null;
  try {
    const v = JSON.parse(crudo) as Partial<Instalacion>;
    if (!esInstallId(v.id) || !DIA_RE.test(v.primerDia ?? '') || !DIA_RE.test(v.ultimoDia ?? '')) return null;
    return { id: v.id, primerDia: v.primerDia!, ultimoDia: v.ultimoDia! };
  } catch {
    return null;
  }
}

/** Días naturales entre dos claves YYYY-MM-DD (hasta − desde). */
export function diasEntre(desde: string, hasta: string): number {
  const utc = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(hasta) - utc(desde)) / 86_400_000);
}

/**
 * Lo que toca al abrir la app hoy. Primera vez: una instalación nueva, el
 * `primer_arranque` y la apertura del día 0. Un día nuevo: `apertura_dia`
 * con los días desde el primer arranque (D1, D3, D7 salen de ahí). El mismo
 * día otra vez: nada. Un reloj que va hacia atrás no apunta días negativos.
 */
export function aperturaDeHoy(
  previa: Instalacion | null,
  hoy: string,
  nuevoId: () => string = nuevoInstallId,
): { instalacion: Instalacion; eventos: { evento: EventoEmbudo; props: PropsEmbudo }[] } {
  if (!previa) {
    return {
      instalacion: { id: nuevoId(), primerDia: hoy, ultimoDia: hoy },
      eventos: [
        { evento: 'primer_arranque', props: {} },
        { evento: 'apertura_dia', props: { dia: 0 } },
      ],
    };
  }
  if (previa.ultimoDia === hoy) return { instalacion: previa, eventos: [] };
  const dia = diasEntre(previa.primerDia, hoy);
  const instalacion = { ...previa, ultimoDia: hoy };
  if (dia < 0) return { instalacion, eventos: [] };
  return { instalacion, eventos: [{ evento: 'apertura_dia', props: limpiarProps('apertura_dia', { dia }) }] };
}

// ── Respuesta del servidor ──────────────────────────────────────────

/**
 * ¿Qué hacer con un evento tras intentar mandarlo?
 * - `hecho`: guardado o descartado por el límite del servidor.
 * - `tirar`: el servidor lo rechaza por forma (22023); reintentarlo no lo arregla.
 * - `reintentar`: sin red, sin la migración aún (PGRST202 / 404) o cualquier
 *   otro fallo: se queda en la cola.
 */
export function destinoTrasEnvio(error: { code?: string | null } | null | undefined): 'hecho' | 'tirar' | 'reintentar' {
  if (!error) return 'hecho';
  if (error.code === '22023') return 'tirar';
  return 'reintentar';
}
