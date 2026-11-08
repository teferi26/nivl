// Permiso ya denegado: un simulador nuevo no tapa la pantalla con el diálogo del
// sistema y no se programa ningún aviso real.
const permiso = { granted: false, canAskAgain: false, expires: 'never', status: 'denied' };
export const getPermissionsAsync = async () => permiso;
export const requestPermissionsAsync = async () => permiso;
export const getAllScheduledNotificationsAsync = async () => [];
export const getPresentedNotificationsAsync = async () => [];
export const getLastNotificationResponseAsync = async () => null;
export const clearLastNotificationResponse = () => {};
export const addNotificationResponseReceivedListener = () => ({ remove() {} });
export const setNotificationHandler = () => {};
export const setNotificationCategoryAsync = async () => null;
export const setNotificationChannelAsync = async () => null;
export const cancelAllScheduledNotificationsAsync = async () => {};
export const cancelScheduledNotificationAsync = async () => {};
export const dismissAllNotificationsAsync = async () => {};
export const dismissNotificationAsync = async () => {};
export const scheduleNotificationAsync = async () => 'arnes-sin-avisos';
export const getExpoPushTokenAsync = async (): Promise<never> => {
  throw new Error('Sin push en el arnés');
};
export const SchedulableTriggerInputTypes = { DAILY: 'daily', DATE: 'date', TIME_INTERVAL: 'timeInterval', CALENDAR: 'calendar', WEEKLY: 'weekly' };
export const AndroidImportance = { MAX: 5, HIGH: 4, DEFAULT: 3 };
export type NotificationResponse = unknown;
