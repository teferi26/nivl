import {
  aceptarLiga, crearLiga, esFaltaDeServidor, misDuelos, misLigas, retarADuelo, tableroDeLiga,
} from '../competicionData';
import { ErrorVisible } from '../validation';

const mockRpc = jest.fn();
jest.mock('../supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));
beforeEach(() => mockRpc.mockReset());

test('llama a las RPC de la 0048 con sus parámetros', async () => {
  mockRpc.mockResolvedValue({ data: 'id-liga', error: null });
  await expect(crearLiga('Los del gym')).resolves.toBe('id-liga');
  expect(mockRpc).toHaveBeenCalledWith('league_create', { p_name: 'Los del gym' });
  await retarADuelo('amigo');
  expect(mockRpc).toHaveBeenLastCalledWith('duel_challenge', { p_opponent: 'amigo' });
});

test('los límites de negocio (22023) llegan como ErrorVisible; lo demás no', async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'Máximo 3 ligas nuevas al día' } });
  await expect(crearLiga('x')).rejects.toBeInstanceOf(ErrorVisible);
  mockRpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'invalid value for parameter "TimeZone": "Marte/Olympus"' } });
  expect(await crearLiga('x').catch((x) => x)).not.toBeInstanceOf(ErrorVisible); // 22023 técnico de Postgres: no se enseña
  mockRpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'Invitación no disponible' } });
  const e = await aceptarLiga('l').catch((x) => x);
  expect(e).not.toBeInstanceOf(ErrorVisible);
});

test('numeric de Postgres llega como texto: se convierte; null → lista vacía', async () => {
  mockRpc.mockResolvedValueOnce({ data: [{ es_yo: true, alias: 'Yo', retrato: null, indice: 80, velocidad: '1.25', dias_activos: 5, sin_datos: false }], error: null });
  expect((await tableroDeLiga('l'))[0]!.velocidad).toBe(1.25);
  mockRpc.mockResolvedValueOnce({ data: null, error: null });
  await expect(misLigas()).resolves.toEqual([]);
  mockRpc.mockResolvedValueOnce({ data: null, error: null });
  await expect(misDuelos()).resolves.toEqual([]);
});

test('detecta la falta de la 0048 en el servidor', () => {
  expect(esFaltaDeServidor({ code: 'PGRST202' })).toBe(true);
  expect(esFaltaDeServidor({ code: '22023' })).toBe(false);
});
