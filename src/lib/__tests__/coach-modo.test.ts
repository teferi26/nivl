// Modos F1 · el coach recibe el modo en `x-nivl-modo` solo con el interruptor
// encendido (lo deja ModoProvider en modos/coach.ts). Apagado: las cabeceras
// son exactamente las de hoy.
import { fijarModoCoach } from '@/modos/coach';
import { runRitual, streamCoach } from '../coach';

const mockFetch = jest.fn();
jest.mock('expo/fetch', () => ({ fetch: (...a: unknown[]) => mockFetch(...a) }));
jest.mock('../supabase', () => ({
  supabase: { auth: { getSession: jest.fn(async () => ({ data: { session: { access_token: 't' } } })) } },
}));
jest.mock('../health', () => ({ requireHealthConsent: jest.fn(async () => undefined) }));

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://ejemplo.supabase.co';

const cabecerasEnviadas = (): Record<string, string> =>
  (mockFetch.mock.calls[0]![1] as { headers: Record<string, string> }).headers;

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: false, status: 400, body: null, json: async () => ({ error: 'x' }) });
});
afterEach(() => fijarModoCoach(null));

test('interruptor apagado: sin x-nivl-modo y las cabeceras de siempre', async () => {
  fijarModoCoach(null);
  await streamCoach({ message: 'hola', onEvent: () => {} }).catch(() => {});
  expect(Object.keys(cabecerasEnviadas()).sort()).toEqual(['apikey', 'authorization', 'content-type']);
});

test('modo General: sin cabecera', async () => {
  fijarModoCoach('general');
  await streamCoach({ message: 'hola', onEvent: () => {} }).catch(() => {});
  expect(cabecerasEnviadas()['x-nivl-modo']).toBeUndefined();
});

test('modo IRON: el turno lleva x-nivl-modo', async () => {
  fijarModoCoach('iron');
  await streamCoach({ message: 'hola', onEvent: () => {} }).catch(() => {});
  expect(cabecerasEnviadas()['x-nivl-modo']).toBe('iron');
});

test('los rituales también lo llevan', async () => {
  const original = global.fetch;
  const espia = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ text: 'ok' }) }));
  global.fetch = espia as unknown as typeof fetch;
  try {
    fijarModoCoach('focus');
    await runRitual('brief');
    const opciones = (espia.mock.calls[0] as unknown as [string, { headers: Record<string, string> }])[1];
    expect(opciones.headers['x-nivl-modo']).toBe('focus');
  } finally {
    global.fetch = original;
  }
});
