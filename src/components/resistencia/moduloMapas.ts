// NIVL · Sin mapa nativo (web y Android): RutaMapa pinta el SVG. En Android
// `react-native-maps` exigiría una clave de Google, y en web no empaqueta.
// La versión de iOS está en moduloMapas.ios.ts.

export function moduloMapas(): { default?: unknown; Polyline?: unknown } | null {
  return null;
}
