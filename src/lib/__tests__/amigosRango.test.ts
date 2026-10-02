import { fetchRangosAmigos, mapaDeRangos } from '../amigosRango';

// jest.mock se eleva sobre el import; las variables `mock*` se pueden usar dentro.
const mockRpc = jest.fn();
jest.mock('../supabase', () => ({ supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));

describe('mapaDeRangos', () => {
  it('cruza user_id con su rango y descarta lo inválido', () => {
    const m = mapaDeRangos([
      { user_id: 'a', rango: 'S' },
      { user_id: 'b', rango: 'E' },
      { user_id: 'c', rango: 'Z' },
      { user_id: '', rango: 'A' },
      null,
      { rango: 'B' },
    ]);
    expect([...m.entries()]).toEqual([
      ['a', 'S'],
      ['b', 'E'],
    ]);
  });

  it('con algo que no es una lista devuelve un Map vacío', () => {
    expect(mapaDeRangos(null).size).toBe(0);
    expect(mapaDeRangos({}).size).toBe(0);
  });
});

describe('fetchRangosAmigos', () => {
  beforeEach(() => mockRpc.mockReset());

  it('llama a friends_ranks y devuelve el Map', async () => {
    mockRpc.mockResolvedValue({ data: [{ user_id: 'x', rango: 'C' }], error: null });
    const m = await fetchRangosAmigos();
    expect(mockRpc).toHaveBeenCalledWith('friends_ranks');
    expect(m.get('x')).toBe('C');
  });

  it.each(['PGRST202', '42883', '42501'])('con el error %s devuelve un Map vacío', async (code) => {
    mockRpc.mockResolvedValue({ data: null, error: { code, message: 'x' } });
    await expect(fetchRangosAmigos()).resolves.toEqual(new Map());
  });

  it('nunca lanza, ni sin red', async () => {
    mockRpc.mockRejectedValue(new Error('Network request failed'));
    await expect(fetchRangosAmigos()).resolves.toEqual(new Map());
  });
});
