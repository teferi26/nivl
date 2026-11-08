// NIVL · Dónde acaban los entrenos medidos.
//
// El buzón no sabe de tablas ni de XP: habla con este almacén. En producción lo
// enchufa una línea con `guardarEntrenoMedido` (src/lib/resistencia.ts), que es
// quien guarda, deduplica y paga. Hasta entonces no hay dónde guardar y se dice
// así: el reloj, el GPS y Salud conservan lo suyo. Dar por bueno un guardado sin
// historial haría borrar la copia del reloj y no se podría volver a pagar.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EntrenoMedido } from '@/lib/entrenoMedido';

export interface AlmacenEntrenos {
  /** Devolver `{ ok: false }` o lanzar significa «no confirmes, reintenta luego». */
  guardar(userId: string, entreno: EntrenoMedido): Promise<unknown>;
  /**
   * Entrenos cuya fecha local de `fin` es `desde` o posterior. Obligatorio: sin
   * él la fusión se apaga y un mismo entreno de dos orígenes cobraría dos veces.
   */
  listarRecientes(userId: string, desde: string): Promise<EntrenoMedido[]>;
}

const sinEnchufar: AlmacenEntrenos = {
  async guardar() {
    return { ok: false, motivo: 'sin_almacen' };
  },
  async listarRecientes() {
    return [];
  },
};

let actual: AlmacenEntrenos = sinEnchufar;

export function fijarAlmacenEntrenos(almacen: AlmacenEntrenos): void {
  actual = almacen;
}

export function almacenEntrenos(): AlmacenEntrenos {
  return actual;
}

/** Lo que dejaran en el teléfono las compilaciones con almacén local. */
export async function borrarAlmacenLocal(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`nivl:medicion:entrenos:${userId}`);
  } catch {
    // Sin almacenamiento tampoco hay nada que borrar.
  }
}
