// NIVL · Permiso para dictar por la red (L4, A3). Si el dispositivo no
// transcribe en local, el audio saldría a Apple o Google: se pregunta una vez
// (HojaPrivacidadDictado) y la respuesta se guarda en el dispositivo.
//
// El permiso es de UNA cuenta, no del móvil (auditoría 1.0.8, P1): se guarda
// el uid de quien aceptó y solo vale mientras esa misma cuenta tenga la
// sesión. Si entra otra, se le vuelve a preguntar. `cerrarSesion` además lo
// borra (olvidarRedDictado).

import type AsyncStorageTipo from '@react-native-async-storage/async-storage';

export const CLAVE_RED_DICTADO = 'nivl.dictado.red.v1';

// Carga perezosa, como en pro.ts: un import estático arrastraría el módulo
// nativo a cualquier test que importe esto de rebote.
type Almacen = Pick<typeof AsyncStorageTipo, 'getItem' | 'setItem' | 'removeItem'>;
function almacen(): Almacen {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require('@react-native-async-storage/async-storage') as { default?: Almacen } & Almacen;
  return m.default ?? m;
}

/** uid de la sesión actual, o null. Perezoso por lo mismo que `almacen`. */
async function uidActual(): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('@/lib/supabase') as typeof import('@/lib/supabase');
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

// uid → aceptado, para no leer el almacenamiento en cada pulsación.
let cache: { uid: string; ok: boolean } | null = null;

/** ¿Aceptó ya ESTA cuenta dictar por la red? Nunca lanza: ante la duda, no. */
export async function redAceptada(): Promise<boolean> {
  const uid = await uidActual();
  if (!uid) return false;
  if (cache?.uid === uid) return cache.ok;
  let ok = false;
  try {
    ok = (await almacen().getItem(CLAVE_RED_DICTADO)) === uid;
  } catch {
    ok = false;
  }
  cache = { uid, ok };
  return ok;
}

/** Apunta que ESTA cuenta acepta dictar por la red. Nunca lanza. */
export async function aceptarRed(): Promise<void> {
  const uid = await uidActual();
  if (!uid) return;
  cache = { uid, ok: true };
  try {
    await almacen().setItem(CLAVE_RED_DICTADO, uid);
  } catch {
    /* sin almacenamiento: vale para esta sesión */
  }
}

/** Al cerrar sesión: fuera el permiso y la caché. Nunca lanza. */
export async function olvidarRedDictado(): Promise<void> {
  cache = null;
  try {
    await almacen().removeItem(CLAVE_RED_DICTADO);
  } catch {
    /* nada que borrar */
  }
}
