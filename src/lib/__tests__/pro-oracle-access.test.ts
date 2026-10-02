// El Oráculo y el candado de gasto (Chat 3, 2026-10-02): 402/429 con motivo
// son negativas serenas, no errores técnicos; solo "sin suscripción" lleva a /pro.
import { callPremiumOracle, PaywallError } from '../subscription';
import { ErrorVisible } from '../validation';

jest.mock('react-native', () => ({ Platform: { OS: 'web' }, Linking: { openURL: jest.fn() } }));
jest.mock('../supabase', () => ({ supabase: {
  auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 't' } } }) },
} }));

const responde = (status: number, body: unknown) => {
  global.fetch = jest.fn().mockResolvedValue({ status, ok: status < 400, json: async () => body }) as never;
};

describe('callPremiumOracle ante el candado de gasto', () => {
  beforeAll(() => { process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'; });

  it('402 presupuesto_agotado → aviso visible con el texto del servidor, no paywall', async () => {
    responde(402, { reason: 'presupuesto_agotado', error: 'Se recarga el 1 de noviembre.' });
    const e = await callPremiumOracle('generate', {}).catch((x: Error) => x);
    expect(e).toBeInstanceOf(ErrorVisible);
    expect(e).not.toBeInstanceOf(PaywallError);
    expect(e.message).toBe('Se recarga el 1 de noviembre.');
  });

  it('429 turno_en_curso → aviso visible de espera', async () => {
    responde(429, { reason: 'turno_en_curso' });
    const e = await callPremiumOracle('weekly', {}).catch((x: Error) => x);
    expect(e).toBeInstanceOf(ErrorVisible);
    expect(e.message).toMatch(/unos segundos/);
  });

  it('402 sin motivo o sin_suscripcion → PaywallError (lleva a /pro)', async () => {
    responde(402, { reason: 'sin_suscripcion' });
    await expect(callPremiumOracle('generate', {})).rejects.toBeInstanceOf(PaywallError);
    responde(402, {});
    await expect(callPremiumOracle('generate', {})).rejects.toBeInstanceOf(PaywallError);
  });
});
