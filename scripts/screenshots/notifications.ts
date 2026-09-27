// Existing permission-denied state, supplied locally so a fresh simulator
// cannot obscure the original screens with a system permission alert.
if (process.env.EXPO_PUBLIC_SCREENSHOT_MODE !== '1') throw new Error('Screenshot mode required');
const permission = { granted: false, canAskAgain: false, expires: 'never', status: 'denied' };
export const getPermissionsAsync = async () => permission;
export const requestPermissionsAsync = async () => permission;
export const getAllScheduledNotificationsAsync = async () => [];
export const getLastNotificationResponseAsync = async () => null;
export const addNotificationResponseReceivedListener = () => ({ remove() {} });
export const setNotificationHandler = () => {};
export const setNotificationCategoryAsync = async () => null;
export const setNotificationChannelAsync = async () => null;
export const cancelAllScheduledNotificationsAsync = async () => {};
export const cancelScheduledNotificationAsync = async () => {};
export const scheduleNotificationAsync = async () => 'screenshot-local-notification-disabled';
export const getExpoPushTokenAsync = async (): Promise<never> => { throw new Error('Push is disabled in the screenshot simulator'); };
export const SchedulableTriggerInputTypes = { DAILY: 'daily', DATE: 'date', TIME_INTERVAL: 'timeInterval' };
