// NIVL · Los avisos del sistema.
//
// Reescrito entero. Lo que había antes tenía cinco fallos que la auditoría
// marcó como críticos y que hacían que la app no avisara de forma fiable:
//
//   1. El texto se congelaba al programar la notificación, así que decía lo
//      mismo el día 1 que el día 200.
//   2. Se creaba un canal de Android y luego nunca se pasaba como channelId,
//      así que Android usaba el suyo por defecto.
//   3. shouldPlaySound iba a false en global: el aviso de cierre no sonaba.
//   4. cancelAllScheduledNotificationsAsync() en cada montaje de la pestaña
//      Sistema: bastaba abrir la app para borrar todo lo programado.
//   5. Todo dentro de un catch vacío: si fallaba, nadie se enteraba nunca.
//
// Ahora los avisos se derivan del plan del día que escribe el coach, se
// reconcilian en vez de borrarse a lo bruto, y el estado es consultable.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { DayBlock } from './plan';
import { hhmm } from './plan';
import { voice } from './voice';

export const CANALES = {
  despertar: 'despertar',
  bloque: 'bloque',
  sistema: 'sistema',
  cierre: 'cierre',
} as const;

export const CATEGORIAS = {
  bloque: 'BLOQUE',
  cierre: 'CIERRE',
} as const;

// Identificadores estables: permiten cancelar solo lo de un día concreto sin
// tocar el resto de lo programado.
const ID_DESPERTAR = 'nivl.despertar';
const idBloque = (fecha: string, blockId: string) => `nivl.bloque.${fecha}.${blockId}`;
const idCierre = (fecha: string) => `nivl.cierre.${fecha}`;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export interface EstadoAvisos {
  permitido: boolean;
  puedePreguntar: boolean;
  programados: number;
  error: string | null;
}

let ultimoError: string | null = null;

export function ultimoErrorDeAvisos(): string | null {
  return ultimoError;
}

async function prepararCanales(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const { AndroidImportance, AndroidNotificationVisibility } = Notifications;
  await Notifications.setNotificationChannelAsync(CANALES.despertar, {
    name: 'Despertador',
    importance: AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 400, 200, 400],
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
  });
  await Notifications.setNotificationChannelAsync(CANALES.bloque, {
    name: 'Bloques del día',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250],
  });
  await Notifications.setNotificationChannelAsync(CANALES.cierre, {
    name: 'Cierre del día',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync(CANALES.sistema, {
    name: 'El sistema',
    importance: AndroidImportance.DEFAULT,
  });
}

async function prepararCategorias(): Promise<void> {
  // Acciones desde la propia notificación. Si la app está viva se aplican al
  // instante; si no, expo-notifications entrega la respuesta en el siguiente
  // arranque y se aplica entonces (ver manejarRespuestas).
  await Notifications.setNotificationCategoryAsync(CATEGORIAS.bloque, [
    { identifier: 'HECHO', buttonTitle: 'Hecho', options: { opensAppToForeground: false } },
    { identifier: 'POSPONER', buttonTitle: 'Posponer 10 min', options: { opensAppToForeground: false } },
  ]);
  await Notifications.setNotificationCategoryAsync(CATEGORIAS.cierre, [
    { identifier: 'REPORTAR', buttonTitle: 'Reportar', options: { opensAppToForeground: true } },
  ]);
}

/**
 * Pide permiso si hace falta. Comprueba antes el estado actual: volver a pedir
 * cuando ya está denegado no muestra nada y hace creer que se preguntó.
 */
export async function asegurarPermiso(): Promise<boolean> {
  const actual = await Notifications.getPermissionsAsync();
  if (actual.granted) return true;
  if (!actual.canAskAgain) return false;
  const pedido = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return pedido.granted;
}

export async function estadoAvisos(): Promise<EstadoAvisos> {
  try {
    const permiso = await Notifications.getPermissionsAsync();
    const programados = await Notifications.getAllScheduledNotificationsAsync();
    return {
      permitido: permiso.granted,
      puedePreguntar: permiso.canAskAgain,
      programados: programados.length,
      error: ultimoError,
    };
  } catch (e) {
    return {
      permitido: false,
      puedePreguntar: false,
      programados: 0,
      error: e instanceof Error ? e.message : 'Fallo leyendo el estado de los avisos.',
    };
  }
}

/** Inicializa canales, categorías y permiso. Idempotente. */
export async function inicializarAvisos(): Promise<boolean> {
  try {
    ultimoError = null;
    await prepararCanales();
    await prepararCategorias();
    return await asegurarPermiso();
  } catch (e) {
    // Antes esto se tragaba en silencio: en Expo Go las notificaciones no
    // están disponibles y no había forma de saberlo. Ahora queda registrado.
    ultimoError = e instanceof Error ? e.message : 'Los avisos no están disponibles aquí.';
    return false;
  }
}

function fechaLocal(fecha: string, minutos: number): Date {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(a, m - 1, d, Math.floor(minutos / 60), minutos % 60, 0, 0);
}

/** El despertador, a la hora pactada, todos los días. */
export async function programarDespertador(horaMin: number | null): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(ID_DESPERTAR).catch(() => {});
    if (horaMin === null) return;
    await Notifications.scheduleNotificationAsync({
      identifier: ID_DESPERTAR,
      content: {
        title: 'Arriba, gladiador',
        body: voice.morningNotif(),
        sound: 'default',
        interruptionLevel: 'timeSensitive',
        data: { ruta: '/(tabs)' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: Math.floor(horaMin / 60),
        minute: horaMin % 60,
        channelId: CANALES.despertar,
      },
    });
  } catch (e) {
    ultimoError = e instanceof Error ? e.message : 'No se pudo programar el despertador.';
  }
}

/**
 * Reconcilia los avisos de un día con su plan.
 *
 * Cancela SOLO los de esa fecha (por identificador estable) y reprograma los
 * que siguen en el futuro. Nada de borrar todo lo programado: el despertador y
 * los avisos de otros días sobreviven.
 */
export async function reconciliarAvisosDelDia(
  fecha: string,
  bloques: DayBlock[],
  horaCierreMin: number | null,
): Promise<number> {
  try {
    const programadas = await Notifications.getAllScheduledNotificationsAsync();
    const prefijo = `nivl.bloque.${fecha}.`;
    await Promise.all(
      programadas
        .filter((n) => n.identifier?.startsWith(prefijo) || n.identifier === idCierre(fecha))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );

    const ahora = new Date();
    let puestas = 0;

    for (const b of bloques) {
      if (!b.notify || b.done) continue;
      const cuando = fechaLocal(fecha, b.start_min);
      if (cuando <= ahora) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: idBloque(fecha, b.id),
        content: {
          title: `${hhmm(b.start_min)} · ${b.title}`,
          // El texto sale del plan en el momento de programar cada día, así
          // que refleja las órdenes reales de hoy y no un texto fósil.
          body: b.detail?.trim() || 'El sistema espera ejecución.',
          sound: 'default',
          interruptionLevel: 'timeSensitive',
          categoryIdentifier: CATEGORIAS.bloque,
          data: { ruta: '/(tabs)', blockId: b.id, fecha },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: cuando,
          channelId: CANALES.bloque,
        },
      });
      puestas++;
    }

    if (horaCierreMin !== null) {
      const cuando = fechaLocal(fecha, horaCierreMin);
      if (cuando > ahora) {
        await Notifications.scheduleNotificationAsync({
          identifier: idCierre(fecha),
          content: {
            title: 'El cierre del día se acerca',
            body: voice.eveningNotif(),
            sound: 'default',
            categoryIdentifier: CATEGORIAS.cierre,
            data: { ruta: '/diario' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: cuando,
            channelId: CANALES.cierre,
          },
        });
        puestas++;
      }
    }

    return puestas;
  } catch (e) {
    ultimoError = e instanceof Error ? e.message : 'No se pudieron programar los avisos del día.';
    return 0;
  }
}

/** Aviso puntual: racha en peligro, deadline, fin de congelación… */
export async function avisarEn(
  id: string,
  cuando: Date,
  titulo: string,
  cuerpo: string,
  ruta?: string,
): Promise<void> {
  try {
    if (cuando <= new Date()) return;
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: titulo,
        body: cuerpo,
        sound: 'default',
        data: ruta ? { ruta } : {},
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: cuando,
        channelId: CANALES.sistema,
      },
    });
  } catch (e) {
    ultimoError = e instanceof Error ? e.message : 'No se pudo programar el aviso.';
  }
}

export async function cancelarTodo(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    /* nada que cancelar */
  }
}
