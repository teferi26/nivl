import { fetchAliasCompartir } from '../social';

const mockRpc = jest.fn();
jest.mock('../supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));

beforeEach(() => mockRpc.mockReset());

test('devuelve el alias propio y si está aprobado', async () => {
  mockRpc.mockResolvedValueOnce({ data: { alias: 'Leónidas', aprobado: true }, error: null });
  await expect(fetchAliasCompartir()).resolves.toEqual({ alias: 'Leónidas', aprobado: true });
  expect(mockRpc).toHaveBeenCalledWith('my_share_alias');
});

test('sin la 0053 en el servidor: null, sin romper', async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
  await expect(fetchAliasCompartir()).resolves.toBeNull();
});

test('respuesta vacía o rara: null', async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: null });
  await expect(fetchAliasCompartir()).resolves.toBeNull();
});

test('otros errores se propagan', async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: { code: '500', message: 'x' } });
  await expect(fetchAliasCompartir()).rejects.toBeTruthy();
});
