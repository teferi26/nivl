import { olvidarRedDictado } from '@/components/coach/redDictado';
import { olvidarConsentimiento } from './consent';
import { olvidarCodigoPendiente } from './creators';
import { cancelarTodo } from './notifications';
import { setApiKey } from './oracle';
import { olvidarDispositivo } from './push';

/** Shared cleanup for logout and completed erasure, before clearing auth. */
export async function limpiarDatosDelDispositivo(desvincularPush = true): Promise<void> {
  const steps: (() => unknown)[] = [
    cancelarTodo,
    () => setApiKey(''),
    olvidarCodigoPendiente,
    olvidarConsentimiento,
    olvidarRedDictado,
    olvidarRestosDelDispositivo,
  ];
  // Completed erasure has already deleted Auth and the server push token.
  if (desvincularPush) steps.push(olvidarDispositivo);
  await Promise.allSettled(steps.map((step) => Promise.resolve().then(step)));
}
/** Claves del dispositivo sin usuario que no deben pasar a la cuenta siguiente. */
export const CLAVES_DEL_USUARIO = ['nivl:duelos:vistos', 'nivl.ofertas.v1'];

/**
 * Lo que queda de la cuenta en el móvil fuera de la sesión (auditoría 1.0.8,
 * P2): avisos ya mostrados en el centro de notificaciones, la caché de
 * imágenes (avatares de amigos, fotos) y claves sin uid. Módulos cargados
 * aquí dentro para no arrastrar los nativos a los tests. Nunca lanza.
 */
async function olvidarRestosDelDispositivo(): Promise<void> {
  /* eslint-disable @typescript-eslint/no-require-imports */
  await Promise.allSettled([
    Promise.resolve().then(async () => {
      const AsyncStorage = (require('@react-native-async-storage/async-storage') as { default: { multiRemove: (k: string[]) => Promise<void> } }).default;
      await AsyncStorage.multiRemove(CLAVES_DEL_USUARIO);
    }),
    Promise.resolve().then(async () => {
      const N = require('expo-notifications') as { dismissAllNotificationsAsync?: () => Promise<void> };
      await N.dismissAllNotificationsAsync?.();
    }),
    Promise.resolve().then(async () => {
      // Copias de comparar fotos y caché del selector (fotos/datos.ts, Experiencia).
      const f = require('@/components/fotos/datos') as { borrarTemporalesFotos?: () => Promise<void> };
      await f.borrarTemporalesFotos?.();
    }),
    Promise.resolve().then(async () => {
      const { Image } = require('expo-image') as { Image: { clearDiskCache: () => Promise<boolean>; clearMemoryCache: () => Promise<boolean> } };
      await Promise.allSettled([Image.clearMemoryCache(), Image.clearDiskCache()]);
    }),
  ]);
  /* eslint-enable @typescript-eslint/no-require-imports */
}
