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
// El estado en memoria vive en flagsEstado.ts (sin AsyncStorage), y de ahí lo
// lee lib/coach.ts.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { FLAGS_APAGADOS, faltaLaFuncion, normalizarFlags, type Flags } from './flagsmath';
import { escucharFlags, fijarFlags as fijar, flagsActuales } from './flagsEstado';
import { supabase } from './supabase';

export { FLAGS_APAGADOS, normalizarFlags, type Flags } from './flagsmath';
export { flagActivo, flagsActuales, type FlagBooleano } from './flagsEstado';

const CLAVE = 'nivl.flags.v1';
/** Entre dos lecturas al volver a primer plano, como poco. */
const REFRESCO_MIN_MS = 60_000;

let ultimaLectura = 0;
let enVuelo: Promise<Flags> | null = null;
let arrancado = false;

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
        return flagsActuales();
      }
      const leidos = normalizarFlags(data);
      ultimaLectura = Date.now();
      fijar(leidos);
      await AsyncStorage.setItem(CLAVE, JSON.stringify(leidos)).catch(() => {});
      return leidos;
    } catch {
      return flagsActuales();
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

/** Los interruptores del servidor. Apagados hasta que se sepa lo contrario. */
export function useFlags(): Flags {
  useEffect(arrancar, []);
  return useSyncExternalStore(escucharFlags, flagsActuales, flagsActuales);
}

/** Solo pruebas y galería: fija los interruptores sin servidor. */
export function __fijarFlagsParaPruebas(f: Partial<Flags> | null): void {
  ultimaLectura = f ? Date.now() : 0;
  fijar(f ? { ...FLAGS_APAGADOS, ...f } : FLAGS_APAGADOS);
}
