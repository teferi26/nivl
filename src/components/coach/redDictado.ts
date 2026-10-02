// NIVL · Permiso para dictar por la red (L4, A3). Si el dispositivo no
// transcribe en local, el audio saldría a Apple o Google: se pregunta una vez
// (HojaPrivacidadDictado) y la respuesta se guarda en el dispositivo.

import type AsyncStorageTipo from '@react-native-async-storage/async-storage';

export const CLAVE_RED_DICTADO = 'nivl.dictado.red.v1';

// Carga perezosa, como en pro.ts: un import estático arrastraría el módulo
// nativo a cualquier test que importe esto de rebote.
type Almacen = Pick<typeof AsyncStorageTipo, 'getItem' | 'setItem'>;
function almacen(): Almacen {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require('@react-native-async-storage/async-storage') as { default?: Almacen } & Almacen;
  return m.default ?? m;
}

let cache: boolean | null = null;

/** ¿Aceptó ya dictar por la red? Nunca lanza: sin almacenamiento, no. */
export async function redAceptada(): Promise<boolean> {
  if (cache !== null) return cache;
  try {
    cache = (await almacen().getItem(CLAVE_RED_DICTADO)) === '1';
  } catch {
    cache = false;
  }
  return cache;
}

/** Apunta que acepta dictar por la red. Nunca lanza. */
export async function aceptarRed(): Promise<void> {
  cache = true;
  try {
    await almacen().setItem(CLAVE_RED_DICTADO, '1');
  } catch {
    /* sin almacenamiento: vale para esta sesión */
  }
}
