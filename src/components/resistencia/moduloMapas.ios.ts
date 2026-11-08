// NIVL · El mapa nativo, solo en iOS. Metro resuelve cualquier `require` al
// empaquetar, así que vive en su propio archivo por plataforma.

export function moduloMapas(): { default?: unknown; Polyline?: unknown } | null {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- sin el nativo, un import estático rompería la OTA
  return require('react-native-maps') as { default?: unknown; Polyline?: unknown };
}
