// NIVL · FOCUS: la campana de fin de bloque (con la app delante).
//
// Mismo estilo que la firma de los modos (src/components/modos/rueda/sonido.ts):
// sintetizada con ffmpeg (scripts/sonidos-focus.sh), dos golpes de campana de
// cristal, -9 dBFS de pico. Con la app en segundo plano suena la notificación
// local, no esto.
//
// - Respeta el modo silencio de iOS (`playsInSilentMode: false`) y se mezcla
//   con la música del usuario sin pararla.
// - expo-audio se carga al primer sonido, no al importar; sin módulo, silencio.
// - No lanza nunca: un sonido que falla no rompe el fin del bloque.
// - En la web, Web Audio con el mismo m4a (src/lib/web/sonido.ts).

import type { AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';
import { prepararSonidoWeb, sonarWeb } from '@/lib/web/sonido';

const FUENTE: number = require('../../../assets/sonidos/focus/fin.m4a');
const VOLUMEN = 0.8;

let reproductor: AudioPlayer | null = null;
let sesion: Promise<void> | null = null;
let audio: typeof import('expo-audio') | null | undefined;

function moduloAudio(): typeof import('expo-audio') | null {
  if (audio === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      audio = require('expo-audio') as typeof import('expo-audio');
    } catch {
      audio = null;
    }
  }
  return audio;
}

function preparar(): Promise<void> {
  if (!sesion) {
    const a = moduloAudio();
    sesion = a ? a.setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {}) : Promise.resolve();
  }
  return sesion;
}

/**
 * Desde el gesto de empezar un bloque: en la web el navegador solo deja sonar
 * tras un gesto, y el fin del bloque no lo es. En el móvil no hace nada.
 */
export function prepararFin(): void {
  if (Platform.OS === 'web') prepararSonidoWeb([FUENTE]);
}

/** Suena la campana de fin de bloque. No lanza nunca. */
export function sonarFin(): void {
  if (Platform.OS === 'web') {
    sonarWeb(FUENTE, VOLUMEN);
    return;
  }
  try {
    void preparar().then(() => {
      const a = moduloAudio();
      if (!a) return;
      try {
        if (!reproductor) {
          reproductor = a.createAudioPlayer(FUENTE);
          reproductor.volume = VOLUMEN;
        }
        const p = reproductor;
        p.seekTo(0)
          .then(() => p.play())
          .catch(() => {
            try {
              p.play();
            } catch {
              // nada
            }
          });
      } catch {
        // nada
      }
    });
  } catch {
    // Un sonido nunca rompe un gesto.
  }
}
