// Modos F1: flags del servidor. Apagados por defecto y si la lectura falla.
import { __fijarFlagsParaTest, cargarFlags, flagActivo, flagsActuales, FLAGS_APAGADOS, normalizarFlags } from '../flags';

const mockRpc = jest.fn();
jest.mock('../supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));

beforeEach(() => {
  mockRpc.mockReset();
  __fijarFlagsParaTest(null);
});

test('por defecto, todo apagado', () => {
  expect(flagsActuales()).toEqual(FLAGS_APAGADOS);
  expect(flagActivo('idiomas_activos')).toBe(false);
  expect(flagActivo('modos_activos')).toBe(false);
});

test('normalizar: solo true enciende; números válidos o el defecto', () => {
  expect(normalizarFlags({ idiomas_activos: true, modos_activos: 'true', valoracion_activa: 1, prueba_auto_dias: 5 })).toEqual({
    ...FLAGS_APAGADOS,
    idiomas_activos: true,
    prueba_auto_dias: 5,
  });
  expect(normalizarFlags({ prueba_auto_dias: 'x', prueba_ia_mensajes_dia: NaN })).toEqual(FLAGS_APAGADOS);
  expect(normalizarFlags(null)).toEqual(FLAGS_APAGADOS);
  expect(normalizarFlags([true])).toEqual(FLAGS_APAGADOS);
});

test('lee app_flags() una vez y enciende lo que diga el servidor', async () => {
  mockRpc.mockResolvedValue({ data: { idiomas_activos: true }, error: null });
  await cargarFlags();
  await cargarFlags();
  expect(mockRpc).toHaveBeenCalledTimes(1);
  expect(mockRpc).toHaveBeenCalledWith('app_flags');
  expect(flagActivo('idiomas_activos')).toBe(true);
});

test('si la lectura falla (error o excepción), todo apagado', async () => {
  mockRpc.mockResolvedValue({ data: { idiomas_activos: true }, error: { message: 'no existe' } });
  await cargarFlags(true);
  expect(flagActivo('idiomas_activos')).toBe(false);
  mockRpc.mockRejectedValue(new Error('sin red'));
  await cargarFlags(true);
  expect(flagsActuales()).toEqual(FLAGS_APAGADOS);
});
