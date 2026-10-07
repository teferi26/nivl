import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { cancelarTodo, programarAvisosDelPlan, registrarFuenteAvisos, reprogramarAvisosDelPlan } from '../notifications';
import type { EstadoPlanAvisos } from '../notifyPlan';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date' },
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => 'aviso'),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));
jest.mock('../health', () => ({ requireHealthConsent: jest.fn(async () => undefined) }));

const estado: EstadoPlanAvisos = {
  ultimaApertura: '2026-10-07', streakDays: 0, questsHoy: [],
  completadasHoy: new Set(), fotosPendientes: 0, duelosPendientes: 0,
  celebracionPendiente: null,
};

test('salir invalida la fuente pendiente y no programa avisos de la cuenta anterior', async () => {
  jest.useFakeTimers();
  let resolver!: (value: EstadoPlanAvisos) => void;
  const fuente = jest.fn(() => new Promise<EstadoPlanAvisos>((resolve) => { resolver = resolve; }));
  const quitar = registrarFuenteAvisos(fuente);
  try {
    reprogramarAvisosDelPlan();
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
    expect(fuente).toHaveBeenCalledTimes(1);
    await cancelarTodo();
    resolver(estado);
    for (let i = 0; i < 12; i++) await Promise.resolve();
    expect(Notifications.getAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    reprogramarAvisosDelPlan();
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
    expect(fuente).toHaveBeenCalledTimes(1);
  } finally {
    quitar();
    jest.useRealTimers();
  }
});


function pendiente<T>() {
  let resolve!: (value: T) => void;
  return { promise: new Promise<T>((r) => { resolve = r; }), resolve: (value: T) => resolve(value) };
}

beforeEach(() => { jest.clearAllMocks(); });

test('logout durante permiso pendiente no vuelve a leer ni guardar el plan', async () => {
  const permiso = pendiente<{ granted: boolean }>();
  jest.mocked(Notifications.getPermissionsAsync).mockReturnValueOnce(permiso.promise as never);
  const programando = programarAvisosDelPlan(estado);
  const saliendo = cancelarTodo();
  permiso.resolve({ granted: true });
  await Promise.all([programando, saliendo]);
  expect(Notifications.getAllScheduledNotificationsAsync).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

test('logout durante lectura nativa no restaura el historial después del borrado', async () => {
  const lectura = pendiente<never[]>();
  jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockReturnValueOnce(lectura.promise);
  const programando = programarAvisosDelPlan(estado);
  for (let i = 0; i < 12; i++) await Promise.resolve();
  expect(Notifications.getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
  const saliendo = cancelarTodo();
  lectura.resolve([]);
  await Promise.all([programando, saliendo]);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});


test('logout espera la escritura nativa y cancela el aviso que acaba de terminar', async () => {
  const escritura = pendiente<string>();
  jest.mocked(Notifications.scheduleNotificationAsync).mockReturnValueOnce(escritura.promise);
  const programando = programarAvisosDelPlan(estado);
  for (let i = 0; i < 20; i++) await Promise.resolve();
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  let terminado = false;
  const saliendo = cancelarTodo().then(() => { terminado = true; });
  for (let i = 0; i < 12; i++) await Promise.resolve();
  expect(terminado).toBe(false);
  escritura.resolve('aviso');
  expect(await programando).toBe(0);
  await saliendo;
  expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(AsyncStorage.removeItem).toHaveBeenCalledWith('nivl:avisos:historial');
});


test('logout borra el historial después de una escritura de almacenamiento ya iniciada', async () => {
  const escritura = pendiente<void>();
  jest.mocked(AsyncStorage.setItem).mockReturnValueOnce(escritura.promise);
  const programando = programarAvisosDelPlan(estado);
  for (let i = 0; i < 30; i++) await Promise.resolve();
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  const saliendo = cancelarTodo();
  for (let i = 0; i < 12; i++) await Promise.resolve();
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  escritura.resolve(undefined);
  await Promise.all([programando, saliendo]);
  expect(AsyncStorage.removeItem).toHaveBeenCalledWith('nivl:avisos:historial');
});
