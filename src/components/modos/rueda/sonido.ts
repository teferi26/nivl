// NIVL · Modos: la firma de sonido de cada modo (tabla de la P10).
//
// NIVL gong · IRON disco y clank · FOCUS campana de cristal · WORK interruptor
// · FOUNDER ignición. Sintetizados con ffmpeg (sin licencias, < 600 ms,
// normalizados a -9 dBFS de pico): los genera scripts/sonidos-modos.sh.
//
// - Respeta el modo silencio de iOS: `playsInSilentMode: false` (categoría
//   ambient) y se mezcla con la música del usuario sin pararla.
// - No lanza nunca: un sonido que falla no rompe el cambio de modo.
// - expo-audio se carga al primer sonido, no al importar: es nativo y un
//   binario sin él (1.0.10) no debe caerse por importar Hoy. Sin módulo, silencio.

import type { AudioPlayer } from 'expo-audio';
import type { ModoId } from '@/modos/tipos';

const FUENTES: Record<ModoId, number> = {
  general: require('../../../../assets/sonidos/modos/general.m4a'),
  iron: require('../../../../assets/sonidos/modos/iron.m4a'),
  focus: require('../../../../assets/sonidos/modos/focus.m4a'),
  work: require('../../../../assets/sonidos/modos/work.m4a'),
  founder: require('../../../../assets/sonidos/modos/founder.m4a'),
};

/** Volumen discreto: son efectos de interfaz, no música. */
const VOLUMEN = 0.6;

const reproductores: Partial<Record<ModoId, AudioPlayer>> = {};
let modoListo: Promise<void> | null = null;
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

function prepararSesion(): Promise<void> {
  if (!modoListo) {
    const a = moduloAudio();
    modoListo = a
      ? a.setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {})
      : Promise.resolve();
  }
  return modoListo;
}

function reproductor(m: ModoId): AudioPlayer | null {
  try {
    let p = reproductores[m];
    if (!p) {
      const a = moduloAudio();
      if (!a) return null;
      p = a.createAudioPlayer(FUENTES[m]);
      p.volume = VOLUMEN;
      reproductores[m] = p;
    }
    return p;
  } catch {
    return null;
  }
}

/** Carga los cinco sonidos antes de hacer falta (al abrir la rueda). */
export function precargarSonidos(): void {
  void prepararSesion();
  for (const m of Object.keys(FUENTES) as ModoId[]) reproductor(m);
}

/** Suena la firma del modo. No lanza nunca. */
export function sonarModo(m: ModoId): void {
  try {
    void prepararSesion().then(() => {
      const p = reproductor(m);
      if (!p) return;
      p.seekTo(0)
        .then(() => p.play())
        .catch(() => {
          try {
            p.play();
          } catch {
            // nada
          }
        });
    });
  } catch {
    // Un sonido nunca rompe un gesto.
  }
}
