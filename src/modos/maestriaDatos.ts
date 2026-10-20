// NIVL · Modos: la marca ya vista de cada modo (efectos, AsyncStorage).
//
// La maestría no tiene estado en el servidor (se deduce de `mode_xp`). Lo
// único que se guarda es, por cuenta y modo, la última marca que este teléfono
// ha enseñado: así la subida de marca se celebra una sola vez.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { esMarca, type Marca } from './maestria';
import type { ModoEtiqueta } from './tipos';

const clave = (userId: string, modo: ModoEtiqueta) => `nivl.maestria.vista.${userId}.${modo}`;

/** La última marca vista (null si nunca se leyó en este teléfono o sin almacenamiento). */
export async function leerMarcaVista(userId: string, modo: ModoEtiqueta): Promise<Marca | null> {
  try {
    const v = Number(await AsyncStorage.getItem(clave(userId, modo)));
    return esMarca(v) ? v : null;
  } catch {
    return null;
  }
}

export async function guardarMarcaVista(userId: string, modo: ModoEtiqueta, marca: Marca): Promise<void> {
  try {
    await AsyncStorage.setItem(clave(userId, modo), String(marca));
  } catch {
    // Sin almacenamiento: la próxima lectura será la base y no celebrará nada.
  }
}
