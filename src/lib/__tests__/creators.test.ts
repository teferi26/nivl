import { fetchCreatorBoardPeriod, fetchCreatorHistory, fetchCreatorProgress } from '../creators';
import { supabase } from '../supabase';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../pro', () => ({ marcarCreadorEnTienda: jest.fn() }));
jest.mock('../supabase', () => ({ supabase: { rpc: jest.fn() } }));

const rpc = jest.mocked(supabase.rpc) as unknown as jest.Mock;
const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e';

beforeEach(() => rpc.mockReset());

describe('fetchCreatorProgress', () => {
  it('llama a creator_progress y parsea', async () => {
    rpc.mockResolvedValue({ data: { code: 'AAA_TEST', alias: 'Alfa', rank: 'pro', role: 'comercial', sales_90d: '4', challenges: [] }, error: null });
    await expect(fetchCreatorProgress()).resolves.toMatchObject({ code: 'AAA_TEST', rank: 'pro', role: 'comercial', sales90d: 4 });
    expect(rpc).toHaveBeenCalledWith('creator_progress');
  });

  it('no creador: null', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(fetchCreatorProgress()).resolves.toBeNull();
  });

  it('un error del servidor se lanza', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('x') });
    await expect(fetchCreatorProgress()).rejects.toThrow('x');
  });
});

describe('fetchCreatorHistory', () => {
  it('recorta los meses a 1..24 antes de llamar', async () => {
    rpc.mockResolvedValue({ data: [{ month: '2026-10', sales: 1 }], error: null });
    await expect(fetchCreatorHistory(100)).resolves.toHaveLength(1);
    expect(rpc).toHaveBeenLastCalledWith('creator_sales_history', { p_months: 24 });
    await fetchCreatorHistory();
    expect(rpc).toHaveBeenLastCalledWith('creator_sales_history', { p_months: 12 });
  });

  it('respuesta rara: vacío', async () => {
    rpc.mockResolvedValue({ data: { no: 'array' }, error: null });
    await expect(fetchCreatorHistory()).resolves.toEqual([]);
  });
});

describe('fetchCreatorBoardPeriod', () => {
  it('un periodo sin forma no llega al servidor', async () => {
    await expect(fetchCreatorBoardPeriod("reto:x'; --")).resolves.toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('mes y reto', async () => {
    rpc.mockResolvedValue({ data: [{ alias: 'Beta', sales: 2, pos: 1, is_me: false }], error: null });
    await expect(fetchCreatorBoardPeriod(`reto:${UUID}`)).resolves.toEqual([{ alias: 'Beta', sales: 2, pos: 1, isMe: false }]);
    expect(rpc).toHaveBeenLastCalledWith('creator_board_period', { p_period: `reto:${UUID}` });
    await fetchCreatorBoardPeriod('mes');
    expect(rpc).toHaveBeenLastCalledWith('creator_board_period', { p_period: 'mes' });
  });
});

describe('reclamarQuienTeTrajo: un solo campo para creador o amigo', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { reclamarQuienTeTrajo } = require('../creators') as typeof import('../creators');
  beforeEach(() => rpc.mockReset());

  it('código de creador conocido → creador', async () => {
    rpc.mockResolvedValueOnce({ data: { ok: true, alias: 'Alfa' }, error: null });
    await expect(reclamarQuienTeTrajo('AAA_TEST', 'onboarding')).resolves.toEqual({ ok: true, tipo: 'creador', alias: 'Alfa' });
    expect(rpc).toHaveBeenCalledWith('claim_referral', { p_code: 'AAA_TEST', p_source: 'onboarding' });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('8 caracteres que no son de ningún creador → se prueba como invitación de amigo', async () => {
    rpc.mockResolvedValueOnce({ data: { ok: false, reason: 'desconocido' }, error: null });
    rpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    await expect(reclamarQuienTeTrajo('ABCDEFGH', 'onboarding')).resolves.toEqual({ ok: true, tipo: 'amigo' });
    expect(rpc).toHaveBeenLastCalledWith('claim_invite', { p_code: 'ABCDEFGH' });
  });

  it('código de amigo con guion (no vale como creador) → directo a invitación', async () => {
    rpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    await expect(reclamarQuienTeTrajo('abcd-efgh', 'onboarding')).resolves.toEqual({ ok: true, tipo: 'amigo' });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('claim_invite', { p_code: 'ABCDEFGH' });
  });

  it('creador rechaza por otro motivo (p. ej. ya pagas) → no se prueba como amigo', async () => {
    rpc.mockResolvedValueOnce({ data: { ok: false, reason: 'ya_pagas' }, error: null });
    const r = await reclamarQuienTeTrajo('ABCDEFGH', 'perfil');
    expect(r).toMatchObject({ ok: false, tipo: 'creador', reason: 'ya_pagas' });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('invitación rechazada → mensaje de invitación', async () => {
    rpc.mockResolvedValueOnce({ data: { ok: false, reason: 'desconocido' }, error: null });
    rpc.mockResolvedValueOnce({ data: { ok: false, reason: 'fuera_de_plazo' }, error: null });
    const r = await reclamarQuienTeTrajo('ABCDEFGH', 'onboarding');
    expect(r).toMatchObject({ ok: false, tipo: 'amigo', reason: 'fuera_de_plazo' });
    if (!r.ok) expect(r.mensaje).toMatch(/7 días/);
  });

  it('sin red: lanza (el llamante lo guarda como pendiente)', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('network') });
    await expect(reclamarQuienTeTrajo('AAA_TEST', 'onboarding')).rejects.toThrow('network');
  });
});
