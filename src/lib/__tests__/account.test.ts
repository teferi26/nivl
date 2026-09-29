import { deleteAccount } from '../account';
import { setApiKey } from '../oracle';
import { supabase } from '../supabase';
import { ErrorVisible } from '../validation';

jest.mock('../oracle', () => ({ setApiKey: jest.fn() }));
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
