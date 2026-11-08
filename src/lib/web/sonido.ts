// NIVL · Web: los mismos sonidos (m4a) con Web Audio.
//
// En el móvil suenan con expo-audio (categoría ambient, respeta el modo
// silencio). En el navegador no hay modo silencio que respetar y un <audio>
// por sonido tarda en arrancar: aquí se decodifica cada m4a una vez en un
// AudioContext y se dispara al instante.
//
// · El navegador no deja sonar nada antes del primer gesto. `prepararSonidoWeb`
//   se llama desde un gesto (abrir la rueda, empezar un bloque) para crear o
//   reanudar el contexto y precargar; así el fin del bloque, que no es un
//   gesto, también suena.
// · Nunca lanza: un sonido que falla no rompe nada.

import { Asset } from 'expo-asset';

type Ctx = AudioContext;

let ctx: Ctx | null = null;
const buffers = new Map<number, Promise<AudioBuffer | null>>();

function contexto(): Ctx | null {
  if (ctx) return ctx;
  const g = globalThis as { AudioContext?: new () => Ctx; webkitAudioContext?: new () => Ctx };
  const C = g.AudioContext ?? g.webkitAudioContext;
  if (!C) return null;
  try {
    ctx = new C();
  } catch {
    ctx = null;
  }
  return ctx;
}

function uriDe(fuente: number): string | null {
  try {
    return Asset.fromModule(fuente).uri || null;
  } catch {
    return null;
  }
}

function cargar(c: Ctx, fuente: number): Promise<AudioBuffer | null> {
  let p = buffers.get(fuente);
  if (!p) {
    const uri = uriDe(fuente);
    p = uri
      ? fetch(uri)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('audio'))))
          // La forma con callbacks: Safari antiguo no devuelve promesa.
          .then((datos) => new Promise<AudioBuffer>((ok, mal) => c.decodeAudioData(datos, ok, mal)))
          .catch(() => {
            buffers.delete(fuente);
            return null;
          })
      : Promise.resolve(null);
    buffers.set(fuente, p);
  }
  return p;
}

/** Desde un gesto: despierta el audio y precarga estos sonidos. */
export function prepararSonidoWeb(fuentes: readonly number[]): void {
  try {
    const c = contexto();
    if (!c) return;
    if (c.state === 'suspended') void c.resume().catch(() => {});
    for (const f of fuentes) void cargar(c, f);
  } catch {
    // nada
  }
}

/** Suena una vez, al volumen dado (0 a 1). */
export function sonarWeb(fuente: number, volumen: number): void {
  try {
    const c = contexto();
    if (!c) return;
    if (c.state === 'suspended') void c.resume().catch(() => {});
    void cargar(c, fuente).then((buffer) => {
      if (!buffer) return;
      try {
        const origen = c.createBufferSource();
        origen.buffer = buffer;
        const ganancia = c.createGain();
        ganancia.gain.value = Math.max(0, Math.min(1, volumen));
        origen.connect(ganancia).connect(c.destination);
        origen.start();
      } catch {
        // nada
      }
    });
  } catch {
    // Un sonido nunca rompe un gesto.
  }
}
