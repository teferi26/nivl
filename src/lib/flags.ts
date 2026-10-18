// NIVL · Interruptores del servidor: lectura, caché y refresco (efectos).
//
// `useFlags()` devuelve los interruptores públicos de `app_flags()` (0067).
// Regla de oro del contrato de Modos F1: TODO APAGADO mientras no se sabe, si
// la función no existe en el servidor o si nunca se ha podido leer. Así la
// 1.0.9 y cualquier build con el servidor viejo se ven exactamente igual.
//
//   · caché en memoria (una lectura vale para toda la app);
//   · caché en el teléfono (AsyncStorage): al arrancar se pinta con lo último
//     que dijo el servidor, sin esperar a la red;
//   · refresco al volver a primer plano (como mucho uno cada REFRESCO_MIN_MS).
//
// Un fallo de red deja lo último leído; si la función no existe, se apaga
// todo y se olvida la caché (flagsmath.faltaLaFuncion).
//
// La forma y la normalización (puras, con test) viven en flagsmath.ts.
//
// Integración F1: es la versión del equipo cliente; de la del equipo idiomas se
// conserva `flagActivo()`, la lectura síncrona que usa la cabecera del coach.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { FLAGS_APAGADOS, faltaLaFuncion, mismosFlags, normalizarFlags, type Flags } from './flagsmath';
import { supabase } from './supabase';

export { FLAGS_APAGADOS, normalizarFlags, type Flags } from './flagsmath';

const CLAVE = 'nivl.flags.v1';
/** Entre dos lecturas al volver a primer plano, como poco. */
const REFRESCO_MIN_MS = 60_000;

let actuales: Flags = FLAGS_APAGADOS;
let ultimaLectura = 0;
let enVuelo: Promise<Flags> | null = null;
let arrancado = false;
const oyentes = new Set<() => void>();

function fijar(nuevos: Flags): void {
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
 * cabecera `x-nivl-locale` del coach, lib/coach.ts). Apagado mientras no se sepa.
 */
export function flagActivo(k: FlagBooleano): boolean {
  return actuales[k] === true;
}

async function leerCache(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CLAVE);
    // Si el servidor ya contestó, manda el servidor.
    if (raw && ultimaLectura === 0) fijar(normalizarFlags(JSON.parse(raw)));
  } catch {
    // Sin caché: apagado.
  }
}

/** Pide `app_flags()` al servidor. Nunca lanza. */
export function refrescarFlags(): Promise<Flags> {
  if (enVuelo) return enVuelo;
  enVuelo = (async () => {
    try {
      const { data, error } = await supabase.rpc('app_flags');
      if (error) {
        if (faltaLaFuncion(error)) {
          ultimaLectura = Date.now();
          fijar(FLAGS_APAGADOS);
          await AsyncStorage.removeItem(CLAVE).catch(() => {});
        }
        return actuales;
      }
      const leidos = normalizarFlags(data);
      ultimaLectura = Date.now();
      fijar(leidos);
      await AsyncStorage.setItem(CLAVE, JSON.stringify(leidos)).catch(() => {});
      return leidos;
    } catch {
      return actuales;
    } finally {
      enVuelo = null;
    }
  })();
  return enVuelo;
}

/** Primera vez: caché del teléfono, servidor y escucha de primer plano. */
function arrancar(): void {
  if (arrancado) return;
  arrancado = true;
  // En el render web de Node (SSR) no hay nada que leer.
  if (Platform.OS === 'web' && typeof window === 'undefined') return;
  leerCache().finally(() => {
    void refrescarFlags();
  });
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active' && Date.now() - ultimaLectura > REFRESCO_MIN_MS) void refrescarFlags();
  });
}

function suscribir(fn: () => void): () => void {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
}

/** Los interruptores del servidor. Apagados hasta que se sepa lo contrario. */
export function useFlags(): Flags {
  useEffect(arrancar, []);
  return useSyncExternalStore(suscribir, flagsActuales, flagsActuales);
}

/** Solo pruebas y galería: fija los interruptores sin servidor. */
export function __fijarFlagsParaPruebas(f: Partial<Flags> | null): void {
  ultimaLectura = f ? Date.now() : 0;
  fijar(f ? { ...FLAGS_APAGADOS, ...f } : FLAGS_APAGADOS);
}
