// NIVL · Decirle algo al lector de pantalla.
//
// En iOS, `accessibilityRole="alert"` y `accessibilityLiveRegion` no hablan:
// VoiceOver no anuncia un error que aparece. Este gancho llama a
// `AccessibilityInfo.announceForAccessibility` cada vez que el texto cambia y
// no está vacío; el mismo texto seguido no se repite. Si el módulo no existe
// (pruebas con react-native simulado), no hace nada.

import { useEffect, useRef } from 'react';
import * as RN from 'react-native';

/** Anuncia `texto` una sola vez, sin más. Seguro aunque no haya lector. */
export function anunciar(texto: string | null | undefined): void {
  if (!texto) return;
  try {
    const ai = (RN as { AccessibilityInfo?: { announceForAccessibility?: (t: string) => void } }).AccessibilityInfo;
    if (ai && typeof ai.announceForAccessibility === 'function') ai.announceForAccessibility(texto);
  } catch {
    // Sin lector o sin módulo: no se anuncia nada.
  }
}

/** Anuncia `texto` cuando cambia y no está vacío; no repite el último. */
export function useAnunciar(texto: string | null | undefined): void {
  const ultimo = useRef<string | null>(null);
  useEffect(() => {
    if (!texto) {
      ultimo.current = null;
      return;
    }
    if (texto === ultimo.current) return;
    ultimo.current = texto;
    anunciar(texto);
  }, [texto]);
}
