// Respuestas nuevas de la función coach (Chat 3, 11be33f): hilo perdido (404)
// y fotos rechazadas (400).
import { HiloPerdidoError, runRitual, streamCoach } from '../coach';
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

// L1 «nunca contradecir sin comprobar»: el turno lleva el "hoy" del móvil.
// Sin él, el servidor usaba la fecha UTC y de 00:00 a 02:00 en Madrid el coach
// miraba el día de ayer y negaba lo que acababas de registrar.
test('el cuerpo del turno lleva la fecha local del móvil', async () => {
  const { dateKey } = jest.requireActual('../dates') as typeof import('../dates');
  mockFetch.mockResolvedValueOnce(respuesta(400, { error: 'kind inválido: x' }));
  await streamCoach({ message: 'te he subido el gym', onEvent: () => {} }).catch(() => {});
  const cuerpo = cuerpoEnviado(0) as { date?: string };
  expect(cuerpo.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(cuerpo.date).toBe(dateKey());
});

test('runRitual también manda la fecha local', async () => {
  const { dateKey } = jest.requireActual('../dates') as typeof import('../dates');
  const original = global.fetch;
  const espia = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ text: 'ok' }) }));
  global.fetch = espia as unknown as typeof fetch;
  try {
    await runRitual('brief');
    const cuerpo = JSON.parse((espia.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(cuerpo.date).toBe(dateKey());
  } finally {
    global.fetch = original;
  }
});

function streamResponse(chunks: string[]) {
  let cursor = 0;
  return {
    ok: true, status: 200,
    body: { getReader: () => ({
      read: async () => cursor < chunks.length
        ? { done: false, value: new TextEncoder().encode(chunks[cursor++]) }
        : { done: true, value: undefined },
      releaseLock: jest.fn(),
    }) },
  };
}

test('un stream cortado antes de done nunca se confirma como éxito', async () => {
  mockFetch.mockResolvedValueOnce(streamResponse([
    'event: text\ndata: {"delta":"parcial"}\n\n',
  ]));
  await expect(streamCoach({ message: 'hola', onEvent: () => {} })).rejects.toThrow();
});

test('el stream acepta CRLF incluso si el separador llega partido', async () => {
  mockFetch.mockResolvedValueOnce(streamResponse([
    'event: text\r\ndata: {"delta":"hola"}\r',
    '\n\r\nevent: done\r\ndata: {"thread_id":"h","text":"hola"}\r\n\r\n',
  ]));
  const eventos = jest.fn();
  await streamCoach({ message: 'hola', onEvent: eventos });
  expect(eventos).toHaveBeenCalledWith({ type: 'text', delta: 'hola' });
  expect(eventos).toHaveBeenCalledWith({ type: 'done', threadId: 'h', text: 'hola', costMicroUsd: 0 });
});
