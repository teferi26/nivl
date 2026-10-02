// NIVL · Política de push del SERVIDOR (y la fecha/caducidad que comparte con
// el plan de avisos). SIN IMPORTS a propósito: el Chat 3 la espeja en Deno
// (supabase/functions/ritual) con un test de paridad. Si tocas una, toca la
// otra. Solo claves YYYY-MM-DD y minutos de pared: no depende del huso de la
// máquina.

export const MAX_PUSH_SERVIDOR_DIA = 1;

export const DIAS_CADUCIDAD = 7;

export const DIAS_VUELTA_FINAL = 30;

/** Ventana activa por defecto (fuera de ella, silencio). */
export const VENTANA_POR_DEFECTO = { inicio: 8 * 60, fin: 22 * 60 } as const;

/** Una ventana más corta que esto es un dato corrupto: se usa la de defecto. */
export const VENTANA_MINIMA = 6 * 60;

/** Un instante en hora local de pared: clave de fecha + minuto del día. */
export interface Momento {
  fecha: string;
  min: number;
}

export type FaseCaducidad = 'activa' | 'vuelta7' | 'silencio' | 'vuelta30' | 'apagada';

export const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const MOMENTO_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/;

/** Días desde 1970-01-01 de una clave. Aritmética UTC pura: sin DST. */
export function diaNum(key: string): number | null {
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

export function keyDeNum(n: number): string {
  const d = new Date(n * 86400000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Días entre dos claves (b − a). */
export function diasEntre(a: string, b: string): number {
  const na = diaNum(a);
  const nb = diaNum(b);
  if (na === null || nb === null) throw new Error(`Clave de fecha inválida: ${a} / ${b}`);
  return nb - na;
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

/** 'YYYY-MM-DDTHH:MM' → Momento. null si no es válido. */
export function momentoDeCuando(cuando: string): Momento | null {
  const m = MOMENTO_RE.exec(cuando);
  if (!m || diaNum(m[1]) === null) return null;
  const h = Number(m[2]);
  const mi = Number(m[3]);
  if (h > 23 || mi > 59) return null;
  return { fecha: m[1], min: h * 60 + mi };
}

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

export function normalizarAhora(ahora: Momento | string): Momento | null {
  if (typeof ahora === 'string') return momentoDeCuando(ahora);
  if (!ahora || diaNum(ahora.fecha) === null) return null;
  if (!Number.isInteger(ahora.min) || ahora.min < 0 || ahora.min > 1439) return null;
  return ahora;
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
