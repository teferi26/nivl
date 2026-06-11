import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { voice } from './voice';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Notificaciones locales estilo "sistema". En Expo Go pueden no estar
// disponibles (limitación de Expo Go); en un development build funcionan siempre.
export async function ensureDailyNotifications(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'El sistema',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Nuevas misiones diarias',
        body: voice.morningNotif(),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 8,
        minute: 0,
      },
    });
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'El cierre del día se acerca',
        body: voice.eveningNotif(),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 21,
        minute: 30,
      },
    });
  } catch {
    // Expo Go sin soporte de notificaciones: se ignora silenciosamente.
  }
}
