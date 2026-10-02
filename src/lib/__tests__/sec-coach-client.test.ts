// Respuestas nuevas de la función coach (Chat 3, 11be33f): hilo perdido (404)
// y fotos rechazadas (400).
import { HiloPerdidoError, streamCoach } from '../coach';
import { ErrorVisible } from '../validation';

const mockFetch = jest.fn();
jest.mock('expo/fetch', () => ({ fetch: (...a: unknown[]) => mockFetch(...a) }));
jest.mock('../supabase', () => ({
  supabase: { auth: { getSession: jest.fn(async () => ({ data: { session: { access_token: 't' } } })) } },
}));
jest.mock('../health', () => ({ requireHealthConsent: jest.fn(async () => undefined) }));


process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://ejemplo.supabase.co';

function respuesta(status: number, body: unknown) {
  return { ok: false, status, body: null, json: async () => body };
}

function cuerpoEnviado(llamada: number): { thread_id?: string } {
  return JSON.parse((mockFetch.mock.calls[llamada]![1] as { body: string }).body);
}

beforeEach(() => mockFetch.mockReset());

test('404 de hilo: reintenta una vez sin thread_id', async () => {
  mockFetch
    .mockResolvedValueOnce(respuesta(404, { error: 'Hilo no encontrado.' }))
    .mockResolvedValueOnce(respuesta(404, { error: 'Hilo no encontrado.' }));
  await expect(streamCoach({ message: 'hola', threadId: 'viejo', onEvent: () => {} })).rejects.toBeInstanceOf(
    HiloPerdidoError,
  );
  expect(mockFetch).toHaveBeenCalledTimes(2);
  expect(cuerpoEnviado(0).thread_id).toBe('viejo');
  expect(cuerpoEnviado(1).thread_id).toBeUndefined();
});

test('404 sin hilo propio: no reintenta', async () => {
  mockFetch.mockResolvedValueOnce(respuesta(404, { error: 'Hilo no encontrado.' }));
  await expect(streamCoach({ message: 'hola', onEvent: () => {} })).rejects.toBeInstanceOf(HiloPerdidoError);
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test('400 de fotos: el motivo llega al usuario como ErrorVisible', async () => {
  mockFetch.mockResolvedValueOnce(respuesta(400, { error: 'Como mucho 4 fotos por mensaje.' }));
  const e = await streamCoach({ message: 'mira', onEvent: () => {} }).catch((x) => x);
  expect(e).toBeInstanceOf(ErrorVisible);
  expect(e.message).toBe('Como mucho 4 fotos por mensaje.');
});

test('otro 400: error normal, no visible tal cual', async () => {
  mockFetch.mockResolvedValueOnce(respuesta(400, { error: 'kind inválido: x' }));
  const e = await streamCoach({ message: 'x', onEvent: () => {} }).catch((x) => x);
  expect(e).not.toBeInstanceOf(ErrorVisible);
});
