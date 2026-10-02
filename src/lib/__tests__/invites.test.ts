import {
  claimInvite,
  fetchMyInvites,
  mensajeInvite,
  normalizarCodigo,
  settleMyInvites,
  siguienteUmbral,
  type InviteReason,
} from '../invites';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({ supabase: { rpc: jest.fn() } }));

const rpc = jest.mocked(supabase.rpc);
const responde = (data: unknown, error: unknown = null) =>
  rpc.mockResolvedValueOnce({ data, error } as never);

beforeEach(() => jest.clearAllMocks());

describe('siguienteUmbral', () => {
  test('1, 3 y 10 invitados activos', () => {
    expect(siguienteUmbral(0)).toBe(1);
    expect(siguienteUmbral(1)).toBe(3);
    expect(siguienteUmbral(2)).toBe(3);
    expect(siguienteUmbral(3)).toBe(10);
    expect(siguienteUmbral(9)).toBe(10);
    expect(siguienteUmbral(10)).toBeNull();
    expect(siguienteUmbral(250)).toBeNull();
  });
  test('entradas raras no rompen', () => {
    expect(siguienteUmbral(-4)).toBe(1);
    expect(siguienteUmbral(Number.NaN)).toBe(1);
    expect(siguienteUmbral(2.9)).toBe(3);
  });
});

describe('mensajeInvite', () => {
  const reasons: (InviteReason | string | null | undefined)[] = [
    'sin_sesion', 'limite', 'formato', 'desconocido', 'propio', 'fuera_de_plazo',
    'ya_invitado', 'reciproca', 'tope', 'borrado_pendiente', 'otro', 'inventado', null, undefined,
  ];
  test('voz del sistema: sin exclamaciones, no vacío', () => {
    for (const r of reasons) {
      const m = mensajeInvite(r);
      expect(m.length).toBeGreaterThan(0);
      expect(m).not.toMatch(/[!¡]/);
    }
  });
  test('cada motivo conocido tiene su frase', () => {
    const conocidas = reasons.slice(0, 10).map((r) => mensajeInvite(r));
    expect(new Set(conocidas).size).toBe(10);
    expect(mensajeInvite('inventado')).toBe(mensajeInvite(null));
  });
});

describe('normalizarCodigo', () => {
  test('acepta espacios, guiones y minúsculas', () => {
    expect(normalizarCodigo(' abcd-ef23 ')).toBe('ABCDEF23');
  });
  test('rechaza longitud o alfabeto ajenos (sin 0/O/1/I)', () => {
    expect(normalizarCodigo('ABC')).toBeNull();
    expect(normalizarCodigo('ABCDEFG0')).toBeNull();
    expect(normalizarCodigo('ABCDEFGI')).toBeNull();
  });
});

describe('claimInvite', () => {
  test('formato inválido no llama al servidor', async () => {
    await expect(claimInvite('xx')).resolves.toEqual({ ok: false, reason: 'formato' });
    expect(rpc).not.toHaveBeenCalled();
  });
  test('manda el código normalizado y devuelve ok', async () => {
    responde({ ok: true, reason: null });
    await expect(claimInvite('abcd ef23')).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith('claim_invite', { p_code: 'ABCDEF23' });
  });
  test('pasa el motivo del servidor; uno desconocido o una respuesta rota es "otro"', async () => {
    responde({ ok: false, reason: 'fuera_de_plazo' });
    await expect(claimInvite('ABCDEF23')).resolves.toEqual({ ok: false, reason: 'fuera_de_plazo' });
    responde({ ok: false, reason: 'nuevo_motivo' });
    await expect(claimInvite('ABCDEF23')).resolves.toEqual({ ok: false, reason: 'otro' });
    responde(null);
    await expect(claimInvite('ABCDEF23')).resolves.toEqual({ ok: false, reason: 'otro' });
    responde('basura');
    await expect(claimInvite('ABCDEF23')).resolves.toEqual({ ok: false, reason: 'otro' });
  });
  test('un error de red se lanza (lo traduce mensajeSistema)', async () => {
    const err = new Error('Network request failed');
    responde(null, err);
    await expect(claimInvite('ABCDEF23')).rejects.toBe(err);
  });
});

describe('settleMyInvites', () => {
  test('parsea cifras e insignias nuevas en orden y sin duplicados', async () => {
    responde({ ok: true, activos: 3, activas: 3, pendientes: '2', nuevas_insignias: ['lanista', 'reclutador', 'x', 'lanista'] });
    await expect(settleMyInvites()).resolves.toEqual({ activos: 3, pendientes: 2, nuevasInsignias: ['reclutador', 'lanista'] });
    expect(rpc).toHaveBeenCalledWith('settle_my_invites');
  });
  test('respuesta rechazada o rota: ceros', async () => {
    responde({ ok: false, reason: 'borrado_pendiente' });
    await expect(settleMyInvites()).resolves.toEqual({ activos: 0, pendientes: 0, nuevasInsignias: [] });
    responde({ ok: true, activos: -5, pendientes: 'abc', nuevas_insignias: 'reclutador' });
    await expect(settleMyInvites()).resolves.toEqual({ activos: 0, pendientes: 0, nuevasInsignias: [] });
  });
  test('error se lanza', async () => {
    responde(null, new Error('fallo'));
    await expect(settleMyInvites()).rejects.toThrow('fallo');
  });
});

describe('fetchMyInvites', () => {
  test('contadores e insignias propias', async () => {
    responde({
      activos: 4, pendientes: 1, caducadas: 2, tope: 1,
      insignias: ['lanista', 'reclutador'], siguiente_umbral: 10, invitado: true,
    });
    await expect(fetchMyInvites()).resolves.toEqual({
      activos: 4, pendientes: 1, caducadas: 2, tope: 1,
      insignias: ['reclutador', 'lanista'], siguienteUmbral: 10, invitado: true,
    });
    expect(rpc).toHaveBeenCalledWith('my_invites');
  });
  test('sin sesión (null) o campos ausentes: todo a cero', async () => {
    responde(null);
    await expect(fetchMyInvites()).resolves.toEqual({
      activos: 0, pendientes: 0, caducadas: 0, tope: 0, insignias: [], siguienteUmbral: 1, invitado: false,
    });
  });
  test('todas las insignias: sin siguiente umbral', async () => {
    responde({ activos: 12, insignias: ['senor_del_ludus', 'lanista', 'reclutador'] });
    const r = await fetchMyInvites();
    expect(r.siguienteUmbral).toBeNull();
    expect(r.insignias).toEqual(['reclutador', 'lanista', 'senor_del_ludus']);
  });
});
