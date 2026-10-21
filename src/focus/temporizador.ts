// NIVL · FOCUS: el pomodoro fuera de la pantalla (efectos).
//
// · El estado (src/focus/pomodoro.ts) y la configuración se guardan en el
//   teléfono por cuenta: cerrar la app no pierde el bloque.
// · Al arrancar o reanudar una fase se programa UNA notificación local para
//   su final (suena aunque la app esté en segundo plano); al pausar, parar o
//   cerrar la fase, se cancela. Mismo id siempre: nunca se acumulan.
// · Sin permiso de avisos, el temporizador funciona igual (solo no avisa fuera).
// · En la web no hay avisos locales: un temporizador de la pestaña dispara el
//   aviso en pantalla y, con permiso y la pestaña oculta, la notificación del
//   navegador (src/lib/web/avisos.ts). El permiso se pide al empezar el bloque,
//   que es un gesto; nunca al cargar.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { asegurarPermiso, avisarEn } from '@/lib/notifications';
import { avisarWeb, pedirPermisoNavegador } from '@/lib/web/avisos';
import { normalizarConfig, normalizarEstado, type ConfigPomodoro, type EstadoPomodoro } from './pomodoro';

const claveEstado = (uid: string) => `nivl.focus.pomodoro.${uid}`;
const claveConfig = (uid: string) => `nivl.focus.config.${uid}`;
const ID_AVISO = 'nivl.focus.fin';

export async function leerConfig(uid: string): Promise<ConfigPomodoro> {
  try {
    const v = await AsyncStorage.getItem(claveConfig(uid));
    return normalizarConfig(v ? (JSON.parse(v) as Partial<ConfigPomodoro>) : null);
  } catch {
    return normalizarConfig(null);
  }
}

export async function guardarConfig(uid: string, c: ConfigPomodoro): Promise<void> {
  try {
    await AsyncStorage.setItem(claveConfig(uid), JSON.stringify(c));
  } catch {
    // Sin almacenamiento, la configuración vive hasta cerrar la app.
  }
}

export async function leerEstado(uid: string, c: ConfigPomodoro): Promise<EstadoPomodoro> {
  try {
    const v = await AsyncStorage.getItem(claveEstado(uid));
    return normalizarEstado(v ? JSON.parse(v) : null, c);
  } catch {
    return normalizarEstado(null, c);
  }
}

export async function guardarEstado(uid: string, e: EstadoPomodoro): Promise<void> {
  try {
    await AsyncStorage.setItem(claveEstado(uid), JSON.stringify(e));
  } catch {
    // ídem
  }
}

let relojWeb: ReturnType<typeof setTimeout> | null = null;

function avisarFinWeb(cuando: number, titulo: string, cuerpo: string): void {
  if (relojWeb) clearTimeout(relojWeb);
  void pedirPermisoNavegador();
  relojWeb = setTimeout(
    () => {
      relojWeb = null;
      avisarWeb(titulo, cuerpo, ID_AVISO);
    },
    Math.max(0, cuando - Date.now()),
  );
}

/** Programa el aviso de fin de fase. Nunca lanza. */
export async function avisarFin(cuando: number, titulo: string, cuerpo: string): Promise<void> {
  if (Platform.OS === 'web') {
    avisarFinWeb(cuando, titulo, cuerpo);
    return;
  }
  try {
    if (!(await asegurarPermiso())) return;
    await avisarEn(ID_AVISO, new Date(cuando), titulo, cuerpo);
  } catch {
    // Un aviso que no se programa no para el bloque.
  }
}

export async function cancelarAvisoFin(): Promise<void> {
  if (Platform.OS === 'web') {
    if (relojWeb) clearTimeout(relojWeb);
    relojWeb = null;
    return;
  }
  try {
    await Notifications.cancelScheduledNotificationAsync(ID_AVISO);
  } catch {
    // ídem
  }
}
