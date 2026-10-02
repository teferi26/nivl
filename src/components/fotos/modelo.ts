// NIVL · Fotos de progreso: la parte pura de la pantalla (L5 · A).
//
// Sin Supabase ni React Native: ids, rutas, tamaño, fechas, mensajes de error
// y la tarjeta de antes/después. La lógica de semanas, pares y rachas es del
// Chat 5 (`@/lib/progressPhotos`); aquí solo lo que necesita la interfaz.
//
// Contrato de 0050: la ruta es exactamente `{uid}/{id}.jpg` con el id de la
// fila, que genera el cliente. Sin fecha ni pose en la ruta.

import { isValidKey } from '@/lib/dates';
import type { ParAntesDespues, Pose } from '@/lib/progressPhotos';
import type { Tarjeta } from '@/lib/sharecard';
import { mensajeSistema } from '@/lib/validation';

// ---------------------------------------------------------------------------
// Ids y rutas

const HEX = '0123456789abcdef';

/**
 * UUID v4. Con `rand` (tests) se usa esa fuente; si no, crypto.randomUUID,
 * luego crypto.getRandomValues y, como último recurso, Math.random. El id no
 * es un secreto (la ruta solo se lee con sesión y RLS): basta con que no choque.
 */
export function uuidV4(rand?: () => number): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!rand && c && typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (!rand && c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    const r = rand ?? Math.random;
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(r() * 256) & 0xff;
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // versión 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122
  let s = '';
  for (let i = 0; i < 16; i++) {
    if (i === 4 || i === 6 || i === 8 || i === 10) s += '-';
    s += HEX[bytes[i] >> 4] + HEX[bytes[i] & 0x0f];
  }
  return s;
}

/** La ruta del objeto en el bucket `progress` (siempre .jpg desde esta app). */
export function rutaFoto(uid: string, id: string): string {
  return `${uid}/${id}.jpg`;
}

// ---------------------------------------------------------------------------
// Tamaño

/** Tope propio, por debajo de los 3 MiB del bucket (3.145.728). */
export const TOPE_BYTES = 3_000_000;

/** Bytes reales de un base64 (sin cabecera data:). */
export function bytesDeBase64(b64: string): number {
  const limpio = b64.replace(/\s/g, '');
  const relleno = limpio.endsWith('==') ? 2 : limpio.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((limpio.length * 3) / 4) - relleno);
}

export function cabe(b64: string): boolean {
  return typeof b64 === 'string' && b64.length > 0 && bytesDeBase64(b64) <= TOPE_BYTES;
}

// ---------------------------------------------------------------------------
// Fechas

/** Suelo de 0050 (`taken_on >= 2000-01-01`). */
export const FECHA_MINIMA = '2000-01-01';
/** Hasta dónde se puede retrasar la fecha desde la hoja. */
export const DIAS_ATRAS_MAX = 60;

/** Una foto es de hoy o de antes, nunca del futuro. */
export function fechaFotoValida(fecha: string, hoy: string): boolean {
  return isValidKey(fecha) && isValidKey(hoy) && fecha <= hoy && fecha >= FECHA_MINIMA;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** «2 oct», y con el año si no es el de `hoy`: «2 oct 2025». */
export function fechaCorta(fecha: string, hoy?: string): string {
  if (!isValidKey(fecha)) return '-';
  const [y, m, d] = fecha.split('-').map(Number);
  const base = `${d} ${MESES[m - 1]}`;
  return hoy && isValidKey(hoy) && hoy.slice(0, 4) !== fecha.slice(0, 4) ? `${base} ${y}` : base;
}

// ---------------------------------------------------------------------------
// Textos

export const NOMBRE_POSE: Record<Pose, string> = { frente: 'Frente', lado: 'Lado', espalda: 'Espalda' };

/** «1 semana seguida», «4 semanas seguidas». */
export function textoSemanas(n: number): string {
  return `${n} ${n === 1 ? 'semana seguida' : 'semanas seguidas'}`;
}

/** «1 día», «92 días». */
export function textoDias(n: number): string {
  return `${n} ${n === 1 ? 'día' : 'días'}`;
}

/** «78,4 kg». */
export function textoKg(kg: number | null | undefined): string {
  if (typeof kg !== 'number' || !Number.isFinite(kg)) return '-';
  return `${(Math.round(kg * 10) / 10).toString().replace('.', ',')} kg`;
}

/** «+1,2 kg», «-3 kg», «0 kg». */
export function textoDifKg(kg: number | null | undefined): string {
  if (typeof kg !== 'number' || !Number.isFinite(kg)) return '-';
  const r = Math.round(kg * 10) / 10;
  return `${r > 0 ? '+' : ''}${textoKg(r)}`;
}

// ---------------------------------------------------------------------------
// Errores

export const MENSAJE_LIMITE = 'Hoy ya has guardado 12 fotos. Mañana puedes seguir.';
export const MENSAJE_GATE = 'Ha cambiado el permiso de las fotos. Vuelve a comprobarlo.';
export const MENSAJE_PESO = 'La foto pesa demasiado. Recórtala o hazla de nuevo.';
export const MENSAJE_FECHA = 'La fecha de la foto no es válida.';

function texto(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') {
    const o = e as { message?: unknown; code?: unknown; error?: unknown; statusCode?: unknown };
    return [o.message, o.code, o.error, o.statusCode].filter((x) => typeof x === 'string' || typeof x === 'number').join(' ');
  }
  return '';
}

/**
 * La frase para la persona y si hay que volver a leer el permiso. Los errores
 * del gate de 0050 (salud o 18+ retirados mientras tanto) piden refresco.
 */
export function mensajeErrorFotos(e: unknown): { mensaje: string; refrescar: boolean } {
  const t = texto(e);
  if (/limite_fotos_progreso/.test(t)) return { mensaje: MENSAJE_LIMITE, refrescar: false };
  if (/sin_consentimiento_salud|sin_confirmacion_adulto|sin_permiso_fotos_progreso/.test(t)) {
    return { mensaje: MENSAJE_GATE, refrescar: true };
  }
  if (/payload too large|entity too large|exceeded the maximum allowed size|\b413\b/i.test(t)) {
    return { mensaje: MENSAJE_PESO, refrescar: false };
  }
  if (/Fecha de foto no válida/.test(t)) return { mensaje: MENSAJE_FECHA, refrescar: false };
  return { mensaje: mensajeSistema(e), refrescar: false };
}

// ---------------------------------------------------------------------------
// Tarjeta

/**
 * La tarjeta de antes/después con las URI LOCALES ya descargadas (nunca una
 * URL firmada). El peso solo viaja si la persona lo ha encendido en la
 * pantalla (`conPeso`); aun así, la hoja de compartir lo abre apagado.
 */
export function tarjetaAntesDespues(
  par: ParAntesDespues,
  uriAntes: string,
  uriDespues: string,
  conPeso = false,
): Extract<Tarjeta, { tipo: 'antesDespues' }> {
  return {
    tipo: 'antesDespues',
    antes: { uri: uriAntes, fecha: par.antes.fecha },
    despues: { uri: uriDespues, fecha: par.despues.fecha },
    ...(conPeso ? { pesoAntesKg: par.antes.pesoKg, pesoDespuesKg: par.despues.pesoKg } : null),
  };
}
