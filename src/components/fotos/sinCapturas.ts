// NIVL · Fotos de progreso: sin capturas de pantalla mientras se ven.
//
// expo-screen-capture entra con la build 23 (1.0.8). La build 22 no trae el
// módulo nativo y una OTA sobre ella no puede caerse: el paquete se carga con
// require dentro de try y cada llamada va protegida. Sin módulo, no hace nada
// (queda la placa negra de useFotos al salir de la app).

import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Platform } from 'react-native';

interface ModuloCaptura {
  preventScreenCaptureAsync: (clave?: string) => Promise<void>;
  allowScreenCaptureAsync: (clave?: string) => Promise<void>;
}

const CLAVE = 'nivl-fotos';
let cache: ModuloCaptura | null | undefined;

function modulo(): ModuloCaptura | null {
  if (cache !== undefined) return cache;
  cache = null;
  if (Platform.OS === 'web') return cache;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('expo-screen-capture') as Partial<ModuloCaptura> | undefined;
    if (m && typeof m.preventScreenCaptureAsync === 'function' && typeof m.allowScreenCaptureAsync === 'function') {
      cache = m as ModuloCaptura;
    }
  } catch {
    cache = null;
  }
  return cache;
}

/** Bloquea las capturas mientras la pantalla tiene el foco; las libera al salir. */
export function useSinCapturas(activo: boolean) {
  useFocusEffect(
    useCallback(() => {
      const m = activo ? modulo() : null;
      if (!m) return undefined;
      m.preventScreenCaptureAsync(CLAVE).catch(() => {});
      return () => {
        m.allowScreenCaptureAsync(CLAVE).catch(() => {});
      };
    }, [activo]),
  );
}
