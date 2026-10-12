// NIVL · Idiomas: la preferencia del gladiador en este teléfono.
//
// AsyncStorage con la clave `nivl.idioma.v1`. Se carga con import() dentro de
// un try: así src/i18n se puede importar en cualquier prueba sin simular
// AsyncStorage (sin módulo nativo, leer da null y guardar no hace nada).

import { esPreferencia, type Preferencia } from './estado';

export const CLAVE_PREFERENCIA = 'nivl.idioma.v1';

interface Almacen {
  getItem(clave: string): Promise<string | null>;
  setItem(clave: string, valor: string): Promise<void>;
}

async function almacen(): Promise<Almacen | null> {
  try {
    const mod = await import('@react-native-async-storage/async-storage');
    return (mod.default ?? null) as Almacen | null;
  } catch {
    return null;
  }
}

/** La preferencia guardada, o null si nunca se eligió (o no se puede leer). */
export async function leerPreferencia(): Promise<Preferencia | null> {
  try {
    const a = await almacen();
    const v = a ? await a.getItem(CLAVE_PREFERENCIA) : null;
    return esPreferencia(v) ? v : null;
  } catch {
    return null;
  }
}

/** Guarda la preferencia. Nunca lanza: devuelve false si no se ha podido. */
export async function guardarPreferencia(p: Preferencia): Promise<boolean> {
  try {
    const a = await almacen();
    if (!a) return false;
    await a.setItem(CLAVE_PREFERENCIA, p);
    return true;
  } catch {
    return false;
  }
}
