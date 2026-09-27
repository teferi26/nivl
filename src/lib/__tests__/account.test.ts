import { deleteAccount } from '../account';
import { setApiKey } from '../oracle';
import { supabase } from '../supabase';

jest.mock('../oracle', () => ({ setApiKey: jest.fn() }));
jest.mock('../supabase', () => ({
  supabase: { rpc: jest.fn(), auth: { signOut: jest.fn() } },
}));

const rpc = jest.mocked(supabase.rpc);
const signOut = jest.mocked(supabase.auth.signOut);

beforeEach(() => {
  jest.clearAllMocks();
  rpc.mockResolvedValue({ data: null, error: null } as never);
  signOut.mockResolvedValue({ error: null });
  jest.mocked(setApiKey).mockResolvedValue(undefined);
});

test('el borrado solo llama a la RPC de NIVL y limpia la sesión local', async () => {
  const network = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('No se admite borrado remoto'));
  try {
    await deleteAccount();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('delete_own_account');
    expect(setApiKey).toHaveBeenCalledWith('');
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(network).not.toHaveBeenCalled();
  } finally {
    network.mockRestore();
  }
});

test('opciones antiguas no pueden activar un borrado de Franky', async () => {
  const network = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('No se admite borrado remoto'));
  try {
    const llamadaAntigua = deleteAccount as (...args: unknown[]) => Promise<void>;
    await llamadaAntigua({ frankyPassword: 'dato-de-prueba' });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('delete_own_account');
    expect(network).not.toHaveBeenCalled();
  } finally {
    network.mockRestore();
  }
});

test('si falla el borrado de NIVL conserva la sesión para reintentar', async () => {
  const error = new Error('Fallo de prueba');
  rpc.mockResolvedValue({ data: null, error } as never);
  await expect(deleteAccount()).rejects.toBe(error);
  expect(setApiKey).not.toHaveBeenCalled();
  expect(signOut).not.toHaveBeenCalled();
});
