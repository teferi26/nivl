// La voz del coach, parte de efectos: lee en voz alta con expo-speech.
//
// - Español de España, la mejor voz es-ES del dispositivo (Enhanced si la
//   hay), ritmo y tono fijos: sobria, un punto grave. El sistema constata.
// - El texto pasa por `paraVoz` y se trocea en frases de ≤ 200 caracteres
//   (iOS); los trozos salen en cola, uno tras otro.
// - El módulo nativo se carga de forma OPCIONAL: en un binario sin
//   `ExpoSpeech` (o donde falle la carga) `hablar` resuelve sin hacer nada y
//   `disponible()` es false. En web, expo-speech usa speechSynthesis.
// - Nunca habla en segundo plano: al pasar la app a fondo se calla
//   (`pararAlSegundoPlano`, idempotente; `hablar` lo registra solo).
// - Mientras se dicta no habla (`dictar.ts` pone el silencio).

import type * as SpeechTipo from 'expo-speech';
import { requireOptionalNativeModule } from 'expo';
import { AppState, Platform, type NativeEventSubscription } from 'react-native';
import { prepararVoz, trocear, type OpcionesVoz } from './texto';

type Speech = typeof SpeechTipo;
type Voz = SpeechTipo.Voice;

/** Idioma de la voz del coach. */
export const IDIOMA_VOZ = 'es-ES';
/** Ritmo: un pelo por debajo del normal (1). Serio, sin prisa. */
export const RITMO_VOZ = 0.95;
/** Tono: algo más grave que el normal (1). */
export const TONO_VOZ = 0.9;

// ---------------------------------------------------------------------------
// Carga opcional del módulo
// ---------------------------------------------------------------------------

let speechCache: Speech | null | undefined;

function speech(): Speech | null {
  if (speechCache !== undefined) return speechCache;
  try {
    if (Platform.OS === 'web') {
      const g = globalThis as { speechSynthesis?: unknown };
      if (!g.speechSynthesis) {
        speechCache = null;
        return speechCache;
      }
    } else if (!requireOptionalNativeModule('ExpoSpeech')) {
      speechCache = null;
      return speechCache;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    speechCache = require('expo-speech') as Speech;
  } catch {
    speechCache = null;
  }
  return speechCache;
}

/** ¿Puede hablar esta build? (false en un binario sin el módulo nativo). */
export function disponible(): boolean {
  return speech() !== null;
}

// ---------------------------------------------------------------------------
// Elección de voz
// ---------------------------------------------------------------------------

function idiomaDe(v: Pick<Voz, 'language'>): string {
  return (v.language ?? '').replace('_', '-').toLowerCase();
}

/** Puntuación de una voz es-ES: más es mejor; null = descartada. */
function puntuar(v: Voz): number | null {
  if (idiomaDe(v) !== IDIOMA_VOZ.toLowerCase()) return null;
  const id = `${v.identifier ?? ''} ${v.name ?? ''}`.toLowerCase();
  // Voces de novedad de Apple (Eddy, Flo, Grandma, Rocko…): fuera.
  if (id.includes('eloquence') || id.includes('speech.synthesis.voice')) return null;
  let p = 0;
  if (String(v.quality) === 'Enhanced') p += 100;
  if (id.includes('premium')) p += 50;
  if (id.includes('enhanced')) p += 20;
  // Android: «-network» manda el texto fuera; preferimos la local.
  if (id.includes('network')) p -= 30;
  if (id.includes('local')) p += 5;
  return p;
}

/**
 * La mejor voz es-ES de la lista: Enhanced/premium primero, local antes que
 * de red, nunca las voces de novedad. Null si no hay ninguna es-ES (entonces
 * se habla solo con `language: 'es-ES'` y el sistema elige).
 */
export function elegirVoz(voces: readonly Voz[]): string | null {
  let mejor: { id: string; p: number } | null = null;
  for (const v of voces ?? []) {
    if (!v?.identifier) continue;
    const p = puntuar(v);
    if (p === null) continue;
    if (!mejor || p > mejor.p) mejor = { id: v.identifier, p };
  }
  return mejor?.id ?? null;
}

let vozCache: string | null | undefined;
let vozPendiente: Promise<string | null> | null = null;

/** La voz elegida, cacheada. Una lista vacía (Android aún cargando) no se cachea. */
async function vozCoach(s: Speech): Promise<string | null> {
  if (vozCache !== undefined) return vozCache;
  if (!vozPendiente) {
    vozPendiente = (async () => {
      try {
        const voces = await s.getAvailableVoicesAsync();
        const id = elegirVoz(voces ?? []);
        if (voces && voces.length > 0) vozCache = id;
        return id;
      } catch {
        return null;
      } finally {
        vozPendiente = null;
      }
    })();
  }
  return vozPendiente;
}

// ---------------------------------------------------------------------------
// Estado, cola y parada
// ---------------------------------------------------------------------------

let turno = 0; // cada hablar() y cada parar() abre un turno nuevo
let hablando = false;
let silencio = false; // lo pone dictar.ts mientras escucha
const oyentes = new Set<(hablando: boolean) => void>();

function fijarHablando(v: boolean): void {
  if (hablando === v) return;
  hablando = v;
  for (const o of oyentes) {
    try {
      o(v);
    } catch {
      // un oyente roto no para la voz
    }
  }
}

/** ¿Está hablando ahora mismo? (estado propio, síncrono). */
export function estaHablando(): boolean {
  return hablando;
}

/** Avisa cada vez que empieza o deja de hablar. Devuelve cómo darse de baja. */
export function suscribirHablando(oyente: (hablando: boolean) => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

/** Calla ya y vacía la cola. Seguro de llamar siempre, haya módulo o no. */
export function parar(): void {
  turno += 1;
  fijarHablando(false);
  const s = speech();
  if (!s) return;
  try {
    void Promise.resolve(s.stop()).catch(() => undefined);
  } catch {
    // nada que parar
  }
}

/** Uso interno (dictar.ts): mientras dura el dictado, `hablar` no suena. */
export function fijarSilencio(activo: boolean): void {
  silencio = activo;
  if (activo) parar();
}

let suscripcionFondo: NativeEventSubscription | null = null;

/**
 * Registra (una sola vez) que la voz se calle cuando la app deja de estar
 * en primer plano. Idempotente: llamarlo mil veces deja un solo oyente.
 * `hablar` lo llama solo; la UI puede llamarlo al montar si quiere.
 */
export function pararAlSegundoPlano(): void {
  if (suscripcionFondo) return;
  try {
    suscripcionFondo = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active') parar();
    });
  } catch {
    suscripcionFondo = null;
  }
}

function enPrimerPlano(): boolean {
  const estado = AppState.currentState;
  // `null`/`unknown` al arrancar: se da por bueno.
  return estado === 'active' || estado == null || estado === 'unknown';
}

export interface OpcionesHablar extends OpcionesVoz {
  /** true: no pasa por `paraVoz` (el texto ya viene limpio). */
  crudo?: boolean;
  /** Al empezar el primer trozo. */
  onInicio?: () => void;
  /** Al acabar (terminado, parado o con error): siempre una vez. */
  onFin?: (motivo: 'terminado' | 'parado' | 'error' | 'nada') => void;
}

/** Tiempo máximo por trozo por si el nativo nunca avisa del final. */
function tiempoMaximo(trozo: string): number {
  return 5000 + trozo.length * 150;
}

function decirTrozo(
  s: Speech,
  trozo: string,
  voz: string | null,
  miTurno: number,
  alEmpezar: () => void,
): Promise<'ok' | 'parado' | 'error'> {
  return new Promise((resolve) => {
    let hecho = false;
    const acabar = (r: 'ok' | 'parado' | 'error') => {
      if (hecho) return;
      hecho = true;
      clearTimeout(reloj);
      resolve(turno === miTurno ? r : 'parado');
    };
    const reloj = setTimeout(() => acabar('ok'), tiempoMaximo(trozo));
    try {
      s.speak(trozo, {
        language: IDIOMA_VOZ,
        rate: RITMO_VOZ,
        pitch: TONO_VOZ,
        ...(voz ? { voice: voz } : {}),
        onStart: () => {
          alEmpezar();
        },
        onDone: () => acabar('ok'),
        onStopped: () => acabar('parado'),
        onError: () => acabar('error'),
      });
    } catch {
      acabar('error');
    }
  });
}

/**
 * Lee el texto con la voz del coach. Corta lo que estuviera diciendo antes
 * (una respuesta nueva manda). Resuelve al terminar, al pararse o si no hay
 * con qué hablar; nunca lanza.
 */
export async function hablar(texto: string, opciones: OpcionesHablar = {}): Promise<void> {
  const { crudo, onInicio, onFin, ...voz } = opciones;
  let finAvisado = false;
  const fin = (m: 'terminado' | 'parado' | 'error' | 'nada') => {
    if (finAvisado) return;
    finAvisado = true;
    try {
      onFin?.(m);
    } catch {
      // el oyente de la UI no rompe la voz
    }
  };

  const s = speech();
  if (!s || silencio || !enPrimerPlano()) {
    fin('nada');
    return;
  }
  // Crudo: sin limpiar, pero troceado igual (iOS no admite enunciados largos).
  const trozos = crudo ? trocear(texto) : prepararVoz(texto, voz);
  if (trozos.length === 0) {
    fin('nada');
    return;
  }

  pararAlSegundoPlano();
  parar(); // lo anterior se calla
  const miTurno = turno;
  const idVoz = await vozCoach(s);
  if (turno !== miTurno || silencio) {
    fin('parado');
    return;
  }

  let empezado = false;
  const alEmpezar = () => {
    if (empezado || turno !== miTurno) return;
    empezado = true;
    try {
      onInicio?.();
    } catch {
      // idem
    }
  };
  fijarHablando(true);
  let motivo: 'terminado' | 'parado' | 'error' = 'terminado';
  for (const trozo of trozos) {
    if (turno !== miTurno) {
      motivo = 'parado';
      break;
    }
    const r = await decirTrozo(s, trozo, idVoz, miTurno, alEmpezar);
    if (r === 'parado') {
      motivo = 'parado';
      break;
    }
    if (r === 'error') {
      motivo = 'error';
      break;
    }
  }
  if (turno === miTurno) fijarHablando(false);
  fin(motivo);
}
