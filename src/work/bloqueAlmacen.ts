// NIVL · WORK: el bloque fuera de la pantalla (efectos).
//
// · Se guarda en el teléfono por cuenta: cerrar la app no pierde el bloque.
// · Una notificación local para el final, siempre con el mismo id: nunca se
//   acumulan. Sin permiso de avisos el temporizador funciona igual.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { asegurarPermiso, avisarEn } from '@/lib/notifications';
import { normalizarGuardado, type BloqueGuardado } from './cierreBloque';

const clave = (uid: string) => `nivl.work.bloque.${uid}`;
const ID_AVISO = 'nivl.work.bloque.fin';

export async function leerBloque(uid: string): Promise<BloqueGuardado | null> {
  try {
    const v = await AsyncStorage.getItem(clave(uid));
    return normalizarGuardado(v ? JSON.parse(v) : null);
  } catch {
    return null;
  }
}

export async function guardarBloque(uid: string, g: BloqueGuardado | null): Promise<void> {
  try {
    if (g) await AsyncStorage.setItem(clave(uid), JSON.stringify(g));
    else await AsyncStorage.removeItem(clave(uid));
  } catch {
    // Sin almacenamiento, el bloque vive hasta cerrar la app.
  }
}

/** Programa el aviso del final. Nunca lanza. */
export async function avisarFinBloque(cuando: number, titulo: string, cuerpo: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (!(await asegurarPermiso())) return;
    // '/(tabs)': rutaSegura lo admite y rutaAvisoEnMundo lo lleva al inicio del mundo (Hoy de WORK), donde el bloque se cierra.
    await avisarEn(ID_AVISO, new Date(cuando), titulo, cuerpo, '/(tabs)');
  } catch {
    // Un aviso que no se programa no para el bloque.
  }
}

export async function cancelarAvisoBloque(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(ID_AVISO);
  } catch {
    // ídem
  }
}
