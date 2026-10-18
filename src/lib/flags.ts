// NIVL · Flags del servidor (Modos F1, contrato común §Cliente).
//
// VERSIÓN MÍNIMA DEL EQUIPO IDIOMAS: el dueño de este archivo es el equipo
// cliente (`modos-f1/cliente`). Cuando llegue la suya, manda la suya; esta solo
// garantiza la misma forma pública:
//   · `useFlags()`: los flags, con repintado cuando llegan;
//   · `cargarFlags()`: lee la RPC `app_flags()` (0067) una vez por sesión de app;
//   · `flagsActuales()` / `flagActivo(k)`: lectura síncrona (fuera de React,
//     p. ej. la cabecera del coach).
//
// Regla de oro 2: todo apagado por defecto y si la lectura falla (sin red, sin
// la migración 0067, respuesta rara), todo apagado. No hay caché persistente:
// un flag encendido solo vale si el servidor lo ha dicho en esta sesión.

import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from './supabase';

export interface Flags {
  modos_activos: boolean;
  idiomas_activos: boolean;
  prueba_auto_activa: boolean;
  prueba_auto_dias: number;
  prueba_ia_mensajes_dia: number;
  valoracion_activa: boolean;
}

export type FlagBooleano = { [K in keyof Flags]: Flags[K] extends boolean ? K : never }[keyof Flags];

export const FLAGS_APAGADOS: Readonly<Flags> = Object.freeze({
  modos_activos: false,
  idiomas_activos: false,
  prueba_auto_activa: false,
  prueba_auto_dias: 2,
  prueba_ia_mensajes_dia: 20,
  valoracion_activa: false,
});

/**
 * Lo que devuelve `app_flags()` → Flags. Solo `true` enciende un booleano (ni
 * "true" ni 1); un número que no lo es se queda en su valor por defecto.
 */
export function normalizarFlags(crudo: unknown): Flags {
  const out: Flags = { ...FLAGS_APAGADOS };
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return out;
  const c = crudo as Record<string, unknown>;
  for (const k of Object.keys(FLAGS_APAGADOS) as (keyof Flags)[]) {
    const v = c[k];
    if (typeof FLAGS_APAGADOS[k] === 'boolean') {
      (out as unknown as Record<string, unknown>)[k] = v === true;
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      (out as unknown as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

let actuales: Flags = FLAGS_APAGADOS;
let pendiente: Promise<Flags> | null = null;
const oyentes = new Set<() => void>();

function fijar(f: Flags): void {
  actuales = f;
  for (const o of [...oyentes]) {
    try {
      o();
    } catch {
      // Un oyente roto no tumba a los demás.
    }
  }
}

/** Los flags que se conocen ahora (apagados hasta que responde el servidor). */
export function flagsActuales(): Flags {
  return actuales;
}

/** ¿Está encendido este flag? Síncrono: apagado mientras no se sepa. */
export function flagActivo(k: FlagBooleano): boolean {
  return actuales[k] === true;
}

/** Lee `app_flags()`. Una vez por sesión de app (`forzar` para releer). Nunca lanza. */
export function cargarFlags(forzar = false): Promise<Flags> {
  if (pendiente && !forzar) return pendiente;
  pendiente = (async () => {
    try {
      const { data, error } = await supabase.rpc('app_flags');
      const f = error ? FLAGS_APAGADOS : normalizarFlags(data);
      fijar(f);
      return f;
    } catch {
      fijar(FLAGS_APAGADOS);
      return FLAGS_APAGADOS;
    }
  })();
  return pendiente;
}

export function escucharFlags(fn: () => void): () => void {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
}

/** Los flags del servidor, con repintado al llegar. Pide la lectura la primera vez. */
export function useFlags(): Flags {
  useEffect(() => {
    void cargarFlags();
  }, []);
  return useSyncExternalStore(escucharFlags, flagsActuales, flagsActuales);
}

/** Solo pruebas. */
export function __fijarFlagsParaTest(f: Partial<Flags> | null): void {
  pendiente = null;
  fijar(f ? { ...FLAGS_APAGADOS, ...f } : FLAGS_APAGADOS);
}
