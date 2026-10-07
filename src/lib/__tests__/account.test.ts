import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Image } from 'expo-image';
import { olvidarCodigoPendiente } from '../creators';
import { borrarTemporalesFotos } from '@/components/fotos/datos';
import { olvidarRedDictado } from '@/components/coach/redDictado';
import { deleteAccount } from '../account';
import { olvidarConsentimiento } from '../consent';
import { cancelarTodo } from '../notifications';
import { setApiKey } from '../oracle';
import { supabase } from '../supabase';
import { ErrorVisible } from '../validation';
import { olvidarDispositivo } from '../push';

jest.mock('../oracle', () => ({ setApiKey: jest.fn() }));
jest.mock('../notifications', () => ({ cancelarTodo: jest.fn() }));
jest.mock('../consent', () => ({ olvidarConsentimiento: jest.fn() }));
jest.mock('../supabase', () => ({
  supabase: { functions: { invoke: jest.fn() }, auth: { signOut: jest.fn() } },
}));

const invoke = jest.mocked(supabase.functions.invoke);
const signOut = jest.mocked(supabase.auth.signOut);

beforeEach(() => {
  jest.clearAllMocks();
  invoke.mockResolvedValue({ data: { ok: true }, error: null });
  signOut.mockResolvedValue({ error: null });
  jest.mocked(setApiKey).mockResolvedValue(undefined);
  jest.mocked(cancelarTodo).mockResolvedValue(undefined);
});

test('only confirmed NIVL erasure succeeds before local cleanup', async () => {
  let finish!: (value: never) => void;
  invoke.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const operation = deleteAccount();
  expect(invoke).toHaveBeenCalledWith('account-erasure', { body: { confirm: 'BORRAR_CUENTA_NIVL' } });
  expect(setApiKey).not.toHaveBeenCalled();
  expect(signOut).not.toHaveBeenCalled();
  finish({ data: { ok: true }, error: null } as never);
  await operation;
  expect(setApiKey).toHaveBeenCalledWith('');
  expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
});

test('opciones antiguas no pueden activar un borrado de Franky', async () => {
  const network = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('No se admite borrado remoto'));
  try {
    const llamadaAntigua = deleteAccount as (...args: unknown[]) => Promise<void>;
    await llamadaAntigua({ frankyPassword: 'dato-de-prueba' });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('account-erasure', { body: { confirm: 'BORRAR_CUENTA_NIVL' } });
    expect(network).not.toHaveBeenCalled();
  } finally {
    network.mockRestore();
  }
});

test.each([
  { data: { ok: false, pending: true }, error: null },
  { data: { pending: true }, error: null },
  { data: null, error: new Error('private provider details') },
  { data: { ok: true }, error: new Error('ambiguous response') },
])('incomplete/failed erasure keeps session and key for retry', async result => {
  invoke.mockResolvedValueOnce(result as never);
  await expect(deleteAccount()).rejects.toBeInstanceOf(ErrorVisible);
  expect(setApiKey).not.toHaveBeenCalled();
  expect(signOut).not.toHaveBeenCalled();
  expect(cancelarTodo).not.toHaveBeenCalled();
});

test('network interruption keeps the local session', async () => {
  invoke.mockRejectedValueOnce(new Error('network interrupted'));
  await expect(deleteAccount()).rejects.toThrow('Reintenta desde Eliminar cuenta');
  expect(signOut).not.toHaveBeenCalled();
});

test('failed legacy-key cleanup does not leave a deleted account signed in', async () => {
  jest.mocked(setApiKey).mockRejectedValueOnce(new Error('local key error'));
  await deleteAccount();
  expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
});

test('confirmed erasure cancels local reminders and forgets the cached AI consent', async () => {
  await deleteAccount();
  expect(cancelarTodo).toHaveBeenCalledTimes(1);
  expect(olvidarConsentimiento).toHaveBeenCalledTimes(1);
  expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
});

test('local cleanup failures never surface as a failed erasure nor keep the session', async () => {
  jest.mocked(cancelarTodo).mockRejectedValueOnce(new Error('os error'));
  jest.mocked(olvidarConsentimiento).mockImplementationOnce(() => { throw new Error('cache'); });
  signOut.mockRejectedValueOnce(new Error('storage'));
  await expect(deleteAccount()).resolves.toBeUndefined();
  expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
});

jest.mock('../creators', () => ({ olvidarCodigoPendiente: jest.fn() }));
jest.mock('../push', () => ({ olvidarDispositivo: jest.fn() }));
jest.mock('@/components/coach/redDictado', () => ({ olvidarRedDictado: jest.fn() }));
jest.mock('@/components/fotos/datos', () => ({ borrarTemporalesFotos: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { multiRemove: jest.fn() } }));
jest.mock('expo-notifications', () => ({ dismissAllNotificationsAsync: jest.fn() }));
jest.mock('expo-image', () => ({ Image: { clearMemoryCache: jest.fn(), clearDiskCache: jest.fn() } }));

test('confirmed erasure removes the same private device traces as logout', async () => {
  await deleteAccount();
  expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(['nivl:duelos:vistos', 'nivl.ofertas.v1']);
  expect(Notifications.dismissAllNotificationsAsync).toHaveBeenCalledTimes(1);
  expect(olvidarCodigoPendiente).toHaveBeenCalledTimes(1);
  expect(olvidarRedDictado).toHaveBeenCalledTimes(1);
  expect(borrarTemporalesFotos).toHaveBeenCalledTimes(1);
  expect(Image.clearMemoryCache).toHaveBeenCalledTimes(1);
  expect(Image.clearDiskCache).toHaveBeenCalledTimes(1);
  expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
});
test('erased Auth only signs out locally and does not try authenticated push deletion', async () => {
  await deleteAccount();
  expect(olvidarDispositivo).not.toHaveBeenCalled();
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
});

test('incomplete erasure preserves all device traces so the account can retry', async () => {
  invoke.mockResolvedValueOnce({ data: { pending: true }, error: null });
  await expect(deleteAccount()).rejects.toBeInstanceOf(ErrorVisible);
  expect(AsyncStorage.multiRemove).not.toHaveBeenCalled();
  expect(Notifications.dismissAllNotificationsAsync).not.toHaveBeenCalled();
  expect(olvidarCodigoPendiente).not.toHaveBeenCalled();
  expect(borrarTemporalesFotos).not.toHaveBeenCalled();
  expect(signOut).not.toHaveBeenCalled();
});

test('failed image and temporary-file cleanup does not stop other cleanup or local logout', async () => {
  jest.mocked(borrarTemporalesFotos).mockImplementationOnce(() => { throw new Error('filesystem'); });
  jest.mocked(Image.clearMemoryCache).mockRejectedValueOnce(new Error('images'));
  await expect(deleteAccount()).resolves.toBeUndefined();
  expect(Image.clearDiskCache).toHaveBeenCalled();
  expect(AsyncStorage.multiRemove).toHaveBeenCalled();
  expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
});