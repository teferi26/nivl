import { confirmarMayorDeEdad, fetchMayorDeEdadConfirmada } from '../age';
import { ErrorVisible } from '../validation';

const mockRpc = jest.fn();
jest.mock('../supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));

beforeEach(() => mockRpc.mockReset());

test('true solo si el servidor dice true', async () => {
  mockRpc.mockResolvedValueOnce({ data: true, error: null });
  await expect(fetchMayorDeEdadConfirmada()).resolves.toBe(true);
  mockRpc.mockResolvedValueOnce({ data: null, error: null });
  await expect(fetchMayorDeEdadConfirmada()).resolves.toBe(false);
  expect(mockRpc).toHaveBeenCalledWith('my_adult_confirmation');
});

test('servidor sin 0050: no confirmado, sin romper', async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
  await expect(fetchMayorDeEdadConfirmada()).resolves.toBe(false);
});

test('otros errores se propagan', async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: { code: '500', message: 'x' } });
  await expect(fetchMayorDeEdadConfirmada()).rejects.toBeTruthy();
});

test('confirmar llama a confirm_adult; sin 0050, mensaje visible', async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: null });
  await confirmarMayorDeEdad();
  expect(mockRpc).toHaveBeenCalledWith('confirm_adult');
  mockRpc.mockResolvedValueOnce({ data: null, error: { code: '42883', message: 'no existe' } });
  await expect(confirmarMayorDeEdad()).rejects.toBeInstanceOf(ErrorVisible);
});
