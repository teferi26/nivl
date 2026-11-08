// NIVL · FOCUS: que la pantalla no se apague con un bloque en marcha.
//
// Se carga con require y sin lanzar nunca: en un binario sin el módulo (o sin
// actividad en Android) el bloque sigue igual, solo que la pantalla se apagará.

const ETIQUETA = 'nivl-focus';

let modulo: typeof import('expo-keep-awake') | null | undefined;

function cargar(): typeof import('expo-keep-awake') | null {
  if (modulo === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      modulo = require('expo-keep-awake') as typeof import('expo-keep-awake');
    } catch {
      modulo = null;
    }
  }
  return modulo;
}

export function mantenerDespierto(encendido: boolean): void {
  try {
    const m = cargar();
    if (!m) return;
    const p = encendido ? m.activateKeepAwakeAsync(ETIQUETA) : m.deactivateKeepAwake(ETIQUETA);
    void Promise.resolve(p).catch(() => {});
  } catch {
    // ídem
  }
}
