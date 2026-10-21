// NIVL · Modos: el «tiempo bala» detrás de la rueda (P01, lámina 1, cuadro 02):
// la app se queda debajo, desenfocada y en gris.
//
//   · iOS y Android: BlurView de expo-blur (tinte oscuro). El gris lo pone la
//     capa de color encima; en Android el desenfoque es el experimental de
//     expo-blur (dimezisBlurView).
//   · Web: `backdrop-filter: blur(5px) grayscale(1) brightness(.8)`.
//   · Un binario sin expo-blur (1.0.11 y anteriores, que reciben OTA): sin
//     desenfoque, solo el velo. Se mira el módulo nativo ANTES de importar el
//     componente: `requireNativeViewManager` de un módulo que no está rompe.

import type { ComponentType } from 'react';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';

type PropsBlur = ViewProps & { intensity?: number; tint?: string; experimentalBlurMethod?: string };

let blur: ComponentType<PropsBlur> | null | undefined;

function componenteBlur(): ComponentType<PropsBlur> | null {
  if (blur !== undefined) return blur;
  blur = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nucleo = require('expo-modules-core') as typeof import('expo-modules-core');
    if (nucleo.requireOptionalNativeModule('ExpoBlurView')) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      blur = (require('expo-blur') as { BlurView: ComponentType<PropsBlur> }).BlurView;
    }
  } catch {
    blur = null;
  }
  return blur;
}

/** ¿Hay desenfoque real en este dispositivo? (si no, el velo tiene que tapar más). */
export function hayDesenfoque(): boolean {
  return Platform.OS === 'web' || componenteBlur() !== null;
}

/** La capa que desenfoca y apaga lo que hay debajo. Decorativa. */
export function Desenfoque() {
  if (Platform.OS === 'web') {
    return (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backdropFilter: 'blur(5px) grayscale(1) brightness(0.8)' } as object]}
      />
    );
  }
  const Blur = componenteBlur();
  if (!Blur) return null;
  return (
    <Blur
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      intensity={30}
      tint="dark"
      experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
    />
  );
}
