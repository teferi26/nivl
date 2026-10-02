import { sincronizarRango, sincronizarRangoDetalle } from '../achievements';

const mockRpc = jest.fn();
jest.mock('../supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));
beforeEach(() => mockRpc.mockReset());

test('lee nuevos y días activos de sync_rank y filtra lo que no es un rango', async () => {
  mockRpc.mockResolvedValue({ data: { rango: 'C', nuevos: ['rango_D', 'rango_C', 'otro', 7], nivel: 12, dias_activos: 45 }, error: null });
  await expect(sincronizarRangoDetalle()).resolves.toEqual({ nuevos: ['rango_D', 'rango_C'], diasActivos: 45 });
  await expect(sincronizarRango()).resolves.toEqual(['rango_D', 'rango_C']);
});

test('sin la 0051 no lanza: nada nuevo y días desconocidos', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'x' } });
  await expect(sincronizarRangoDetalle()).resolves.toEqual({ nuevos: [], diasActivos: null });
});

test('otros errores sí se propagan; días raros → null', async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: { code: '500', message: 'caído' } });
  await expect(sincronizarRango()).rejects.toMatchObject({ code: '500' });
  mockRpc.mockResolvedValueOnce({ data: { nuevos: [], dias_activos: 'mucho' }, error: null });
  await expect(sincronizarRangoDetalle()).resolves.toEqual({ nuevos: [], diasActivos: null });
});
