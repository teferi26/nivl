// NIVL · Interruptores del servidor: el estado en memoria (sin efectos).
//
// Integración F1: lo que se sabe ahora de `app_flags()` vive aquí, sin
// AsyncStorage ni Supabase, para que la lectura síncrona (`flagActivo`, la
// cabecera `x-nivl-locale` de lib/coach.ts) no arrastre los módulos nativos a
// las pruebas de coach. La lectura, la caché del teléfono y el refresco son de
// flags.ts, que es quien llama a `fijarFlags`.

import { FLAGS_APAGADOS, mismosFlags, type Flags } from './flagsmath';

let actuales: Flags = FLAGS_APAGADOS;
const oyentes = new Set<() => void>();

/** Cambia lo que se sabe y avisa a quien escuche (si cambia algo). */
export function fijarFlags(nuevos: Flags): void {
  if (mismosFlags(nuevos, actuales)) return;
  actuales = nuevos;
  for (const f of [...oyentes]) {
    try {
      f();
    } catch {
      // Un oyente roto no tumba a los demás.
    }
  }
}

/** Lo que se sabe ahora mismo (apagado hasta la primera lectura). */
export function flagsActuales(): Flags {
  return actuales;
}

/** Las claves booleanas de `Flags` (los interruptores de verdad). */
export type FlagBooleano = { [K in keyof Flags]: Flags[K] extends boolean ? K : never }[keyof Flags];

/**
 * ¿Está encendido este interruptor? Síncrono, para fuera de React (p. ej. la
 * cabecera `x-nivl-locale` del coach). Apagado mientras no se sepa.
 */
export function flagActivo(k: FlagBooleano): boolean {
  return actuales[k] === true;
}

export function escucharFlags(fn: () => void): () => void {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
}
