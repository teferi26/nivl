// El dictado al coach: voz → texto con expo-speech-recognition.
//
// - Permisos SOLO al llamar a `dictar` (nunca al cargar ni al montar).
// - Español de España, resultados parciales.
// - En el dispositivo cuando se puede: `supportsOnDeviceRecognition()` y
//   es-ES entre los idiomas instalados. Si no, NO se dicta por la red sin
//   avisar: `dictar` devuelve el error tipado `sin_dictado_local` (sin pedir
//   permisos) para que la UI pregunte, y la UI repite con `permitirRed: true`.
// - Mientras se dicta, la voz del coach calla.
// - Carga opcional del módulo: en un binario sin `ExpoSpeechRecognition`
//   (Expo Go, 1.0.7) `disponibleDictado()` es false y `dictar` devuelve
//   `sin_modulo`. En web usa la Web Speech API del propio paquete, que NUNCA
//   es local (el navegador manda el audio fuera): pide `permitirRed`.

import type * as ReconocimientoTipo from 'expo-speech-recognition';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { fijarSilencio } from './hablar';

type Modulo = typeof ReconocimientoTipo.ExpoSpeechRecognitionModule;
type Suscripcion = { remove: () => void };

/** Idioma del dictado. */
export const IDIOMA_DICTADO = 'es-ES';

export type CodigoErrorDictado =
  | 'sin_modulo' // la build no trae el reconocimiento
  | 'no_disponible' // el sistema no lo ofrece ahora (Siri/dictado apagado, sin servicio)
  | 'sin_dictado_local' // solo se podría por la red: la UI debe avisar antes
  | 'sin_permiso' // micrófono o reconocimiento denegados
  | 'sin_voz' // no se ha oído nada
  | 'red' // por la red y la red ha fallado
  | 'ocupado' // el micrófono lo tiene otro
  | 'interrumpido' // una llamada, Siri, una alarma
  | 'microfono' // fallo al capturar audio
  | 'fallo'; // cualquier otro

export interface ErrorDictado {
  codigo: CodigoErrorDictado;
  /** Frase corta, en la voz del sistema, apta para enseñar tal cual. */
  mensaje: string;
  /** Código original del módulo, para registro (nunca para la UI). */
  original?: string;
}

const MENSAJES: Record<CodigoErrorDictado, string> = {
  sin_modulo: 'El dictado llega con la próxima versión de la app.',
  no_disponible: 'El dictado del sistema no está disponible en este dispositivo.',
  sin_dictado_local: 'Este dispositivo no transcribe en local. Para dictar, el audio saldría a los servidores de Apple o Google.',
  sin_permiso: 'Sin permiso de micrófono no hay dictado. Actívalo en Ajustes.',
  sin_voz: 'El sistema no ha oído nada.',
  red: 'Sin conexión, el dictado por la red no funciona.',
  ocupado: 'El micrófono está ocupado.',
  interrumpido: 'Dictado interrumpido.',
  microfono: 'No se ha podido usar el micrófono.',
  fallo: 'El dictado ha fallado. Prueba otra vez.',
};

export function errorDictado(codigo: CodigoErrorDictado, original?: string): ErrorDictado {
  return original ? { codigo, mensaje: MENSAJES[codigo], original } : { codigo, mensaje: MENSAJES[codigo] };
}

/** Traduce el código de error del módulo al nuestro (null = no es error: cancelado). */
export function traducirError(codigo: string, local: boolean): CodigoErrorDictado | null {
  switch (codigo) {
    case 'aborted':
      return null;
    case 'not-allowed':
      return 'sin_permiso';
    case 'service-not-allowed':
      return 'no_disponible';
    case 'language-not-supported':
      return local ? 'sin_dictado_local' : 'no_disponible';
    case 'network':
      return 'red';
    case 'no-speech':
    case 'speech-timeout':
    case 'nomatch':
      return 'sin_voz';
    case 'busy':
      return 'ocupado';
    case 'interrupted':
      return 'interrumpido';
    case 'audio-capture':
      return 'microfono';
    default:
      return 'fallo';
  }
}

// ---------------------------------------------------------------------------
// Carga opcional del módulo
// ---------------------------------------------------------------------------

let moduloCache: Modulo | null | undefined;

function modulo(): Modulo | null {
  if (moduloCache !== undefined) return moduloCache;
  try {
    if (Platform.OS !== 'web' && !requireOptionalNativeModule('ExpoSpeechRecognition')) {
      moduloCache = null;
      return moduloCache;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const paquete = require('expo-speech-recognition') as typeof ReconocimientoTipo;
    moduloCache = paquete.ExpoSpeechRecognitionModule ?? null;
  } catch {
    moduloCache = null;
  }
  return moduloCache;
}

/** ¿Se puede dictar en esta build y en este momento? Síncrono, sin permisos. */
export function disponibleDictado(): boolean {
  const m = modulo();
  if (!m) return false;
  try {
    return m.isRecognitionAvailable();
  } catch {
    return false;
  }
}

function esEsEs(locale: string): boolean {
  return locale.replace('_', '-').toLowerCase() === IDIOMA_DICTADO.toLowerCase();
}

/**
 * ¿Transcribe este dispositivo es-ES sin red? Pide al sistema el soporte
 * local y la lista de idiomas instalados; no pide permisos. Ante cualquier
 * duda (Android ≤ 12, error, lista vacía), false.
 */
export async function dictadoLocalDisponible(): Promise<boolean> {
  // iOS NO puede garantizarlo: supportsOnDeviceRecognition() mira el idioma del
  // sistema, getSupportedLocales da por «instalados» todos los soportados y, si
  // el reconocedor de es-ES no admite el modo local, el nativo ignora en
  // silencio requiresOnDeviceRecognition y transcribe por la red. Así que en
  // iOS nunca se promete «local»: la UI avisa una vez y pasa permitirRed (y se
  // sigue pidiendo el modo local, que se usa cuando de verdad existe).
  if (Platform.OS === 'ios') return false;
  return localPreferido();
}

/** ¿Pedir el modo local? (preferencia; en iOS no es garantía, ver arriba). */
async function localPreferido(): Promise<boolean> {
  const m = modulo();
  if (!m) return false;
  try {
    if (!m.supportsOnDeviceRecognition()) return false;
    const { locales, installedLocales } = await m.getSupportedLocales({});
    const lista = Platform.OS === 'ios' ? [...(installedLocales ?? []), ...(locales ?? [])] : installedLocales ?? [];
    return lista.some(esEsEs);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Sesión de dictado
// ---------------------------------------------------------------------------

export interface OpcionesDictado {
  /** Texto provisional mientras habla (sustituye al anterior, no se suma). */
  onParcial?: (texto: string) => void;
  /** Texto definitivo. */
  onFinal?: (texto: string) => void;
  /** Error tipado; `mensaje` se puede enseñar tal cual. */
  onError?: (error: ErrorDictado) => void;
  /** La sesión ha terminado (siempre, una vez, haya ido bien o mal). */
  onFin?: () => void;
  /** La UI ya ha avisado de que el audio sale a la red y el usuario acepta. */
  permitirRed?: boolean;
  /** Palabras que el reconocedor debe esperar (nombres de misiones, etc.). */
  contexto?: string[];
}

export type ResultadoDictado =
  | { ok: true; local: boolean }
  | { ok: false; error: ErrorDictado };

interface Sesion {
  id: number;
  subs: Suscripcion[];
  op: OpcionesDictado;
  cancelada: boolean;
  terminada: boolean;
  local: boolean;
}

let sesion: Sesion | null = null;
let siguienteId = 1;

/** ¿Hay un dictado en marcha? */
export function dictando(): boolean {
  return sesion !== null;
}

function seguro(f: () => void): void {
  try {
    f();
  } catch {
    // un callback de la UI no rompe el dictado
  }
}

function cerrarSesion(s: Sesion): void {
  if (s.terminada) return;
  s.terminada = true;
  for (const sub of s.subs) seguro(() => sub.remove());
  s.subs = [];
  if (sesion === s) {
    sesion = null;
    fijarSilencio(false);
  }
  seguro(() => s.op.onFin?.());
}

function fallar(op: OpcionesDictado, error: ErrorDictado): ResultadoDictado {
  seguro(() => op.onError?.(error));
  return { ok: false, error };
}

/**
 * Empieza a dictar. Resuelve en cuanto el reconocimiento ha arrancado (o no
 * ha podido): `{ ok: true, local }` o `{ ok: false, error }`. Los textos
 * llegan por `onParcial`/`onFinal`; el final de la sesión, por `onFin`.
 * El error también se entrega por `onError`. Nunca lanza.
 *
 * Orden: módulo → disponibilidad → local o permiso de red (sin_dictado_local
 * se devuelve SIN pedir permisos) → permisos → calla la voz → arranca.
 */
export async function dictar(op: OpcionesDictado = {}): Promise<ResultadoDictado> {
  const m = modulo();
  if (!m) return fallar(op, errorDictado('sin_modulo'));
  if (sesion) cancelarDictado();

  let disponible = false;
  try {
    disponible = m.isRecognitionAvailable();
  } catch {
    disponible = false;
  }
  if (!disponible) return fallar(op, errorDictado('no_disponible'));

  const local = await dictadoLocalDisponible();
  if (!local && !op.permitirRed) return fallar(op, errorDictado('sin_dictado_local'));

  // Permisos: solo ahora. En iOS con reconocimiento local basta el micrófono
  // (el permiso de reconocimiento de Apple solo hace falta para la red).
  try {
    const permiso = await m.requestPermissionsAsync();
    if (!permiso?.granted) return fallar(op, errorDictado('sin_permiso'));
  } catch (e) {
    return fallar(op, errorDictado('sin_permiso', e instanceof Error ? e.message : undefined));
  }

  const s: Sesion = { id: siguienteId++, subs: [], op, cancelada: false, terminada: false, local };
  sesion = s;
  fijarSilencio(true); // calla al coach y no le deja hablar mientras dura

  try {
    s.subs.push(
      m.addListener('result', (ev) => {
        if (s.cancelada || s.terminada) return;
        const texto = (ev?.results?.[0]?.transcript ?? '').trim();
        if (ev?.isFinal) seguro(() => op.onFinal?.(texto));
        else if (texto) seguro(() => op.onParcial?.(texto));
      }),
      m.addListener('error', (ev) => {
        if (s.cancelada || s.terminada) return;
        const codigo = traducirError(String(ev?.error ?? ''), s.local);
        if (codigo) seguro(() => op.onError?.(errorDictado(codigo, String(ev?.error ?? ''))));
      }),
      m.addListener('end', () => {
        cerrarSesion(s);
      }),
    );
    m.start({
      lang: IDIOMA_DICTADO,
      interimResults: true,
      continuous: false,
      requiresOnDeviceRecognition: local || (Platform.OS === 'ios' && (await localPreferido())),
      addsPunctuation: true,
      ...(op.contexto && op.contexto.length > 0 ? { contextualStrings: op.contexto.slice(0, 100) } : {}),
    });
  } catch (e) {
    const error = errorDictado('fallo', e instanceof Error ? e.message : undefined);
    s.cancelada = true;
    cerrarSesion(s);
    return fallar(op, error);
  }
  return { ok: true, local };
}

/** Deja de escuchar y entrega lo dictado (llega por `onFinal`). */
export function detenerDictado(): void {
  const m = modulo();
  if (!m || !sesion) return;
  try {
    m.stop();
  } catch {
    const s = sesion;
    if (s) cerrarSesion(s);
  }
}

/** Deja de escuchar y tira lo dictado: no llega ni `onFinal` ni `onError`. */
export function cancelarDictado(): void {
  const s = sesion;
  if (!s) return;
  s.cancelada = true;
  const m = modulo();
  try {
    m?.abort();
  } catch {
    // ya estaba parado
  }
  cerrarSesion(s);
}
