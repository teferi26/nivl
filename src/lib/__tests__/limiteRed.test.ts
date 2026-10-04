import { fetchEdadConfirmada } from '../age';
import { ensureProfile } from '../data';
import { conLimiteDeRed, ErrorTiempoAgotado, LIMITE_RED_MS } from '../limiteRed';
import { supabase } from '../supabase';
import { MENSAJE_FALLO, MENSAJE_SIN_CONEXION, mensajeSistema } from '../validation';

jest.mock('../supabase', () => ({ supabase: { rpc: jest.fn(), from: jest.fn() } }));

const rpc = jest.mocked(supabase.rpc);
const from = jest.mocked(supabase.from);
const colgada = () => new Promise<never>(() => {});

/** Una consulta de PostgREST (thenable) que no contesta nunca. */
function consultaColgada() {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'upsert']) q[m] = () => q;
  q.maybeSingle = colgada;
  q.single = colgada;
  return q as never;
}

beforeEach(() => {
  jest.useFakeTimers();
  rpc.mockReset();
  from.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('conLimiteDeRed', () => {
  it('devuelve el valor si llega a tiempo', async () => {
    await expect(conLimiteDeRed(Promise.resolve('ok'))).resolves.toBe('ok');
  });

  it('propaga el fallo propio tal cual (no lo disfraza de «sin conexión»)', async () => {
    const propio = new Error('duplicate key');
    await expect(conLimiteDeRed(Promise.reject(propio))).rejects.toBe(propio);
    expect(mensajeSistema(propio)).toBe(MENSAJE_FALLO);
  });

  it('una promesa colgada falla al tope con un error que se lee como «sin conexión»', async () => {
    const r = conLimiteDeRed(colgada());
    const expectativa = expect(r).rejects.toBeInstanceOf(ErrorTiempoAgotado);
    await jest.advanceTimersByTimeAsync(LIMITE_RED_MS - 1);
    await jest.advanceTimersByTimeAsync(1);
    await expectativa;
    expect(mensajeSistema(new ErrorTiempoAgotado())).toBe(MENSAJE_SIN_CONEXION);
  });

  it('el tope está entre 10 y 15 s', () => {
    expect(LIMITE_RED_MS).toBeGreaterThanOrEqual(10_000);
    expect(LIMITE_RED_MS).toBeLessThanOrEqual(15_000);
  });
});

describe('ensureProfile con red colgada', () => {
  it('falla con «sin conexión» en vez de quedarse cargando', async () => {
    from.mockReturnValue(consultaColgada());
    const r = ensureProfile('u1');
    const expectativa = expect(r).rejects.toBeInstanceOf(ErrorTiempoAgotado);
    await jest.advanceTimersByTimeAsync(LIMITE_RED_MS);
    await expectativa;
  });
});

describe('fetchEdadConfirmada con red colgada', () => {
  it('falla con «sin conexión» (la guarda enseña Reintentar)', async () => {
    rpc.mockReturnValue(colgada() as never);
    const r = fetchEdadConfirmada();
    const expectativa = expect(r).rejects.toBeInstanceOf(ErrorTiempoAgotado);
    await jest.advanceTimersByTimeAsync(LIMITE_RED_MS);
    await expectativa;
  });

  it('con respuesta a tiempo no cambia nada', async () => {
    rpc.mockResolvedValue({ data: true, error: null } as never);
    await expect(fetchEdadConfirmada()).resolves.toBe(true);
  });
});
