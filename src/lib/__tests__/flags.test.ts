// Modos F1 · interruptores del servidor: todo apagado por defecto, ante la
// basura y si la función no existe; la caché del teléfono y la red.
import { FLAGS_APAGADOS, faltaLaFuncion, mismosFlags, normalizarFlags } from '../flagsmath';

const mockRpc = jest.fn();
const mockAlmacen = new Map<string, string>();
jest.mock('../supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => mockAlmacen.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => void mockAlmacen.set(k, v)),
    removeItem: jest.fn(async (k: string) => void mockAlmacen.delete(k)),
  },
}));

describe('normalizarFlags', () => {
  it('sin datos, todo apagado', () => {
    for (const raw of [null, undefined, 'x', 3, [], true]) expect(normalizarFlags(raw)).toEqual(FLAGS_APAGADOS);
  });

  it('los apagados son los del contrato', () => {
    expect(FLAGS_APAGADOS).toEqual({
      modos_activos: false,
      idiomas_activos: false,
      prueba_auto_activa: false,
      prueba_auto_dias: 2,
      prueba_ia_mensajes_dia: 20,
      valoracion_activa: false,
    });
  });

  it('un interruptor solo se enciende con true de verdad', () => {
    expect(normalizarFlags({ modos_1011: 'true', idiomas_1011: 1 })).toEqual(FLAGS_APAGADOS);
    expect(normalizarFlags({ modos_1011: true }).modos_activos).toBe(true);
    expect(normalizarFlags({ modos_1011: true }).idiomas_activos).toBe(false);
  });

  it('1.0.11: las claves viejas de la 1.0.10 no encienden nada; las *_1011 sí', () => {
    const viejas = { modos_activos: true, idiomas_activos: true, prueba_auto_activa: true, valoracion_activa: true };
    expect(normalizarFlags(viejas)).toEqual(FLAGS_APAGADOS);
    const nuevas = { modos_1011: true, idiomas_1011: true, prueba_auto_1011: true, valoracion_1011: true };
    expect(normalizarFlags(nuevas)).toEqual({
      ...FLAGS_APAGADOS,
      modos_activos: true,
      idiomas_activos: true,
      prueba_auto_activa: true,
      valoracion_activa: true,
    });
  });

  it('los números raros se quedan en su valor por defecto', () => {
    expect(normalizarFlags({ prueba_auto_dias: -1, prueba_ia_mensajes_dia: 'x' })).toEqual(FLAGS_APAGADOS);
    expect(normalizarFlags({ prueba_auto_dias: 5 }).prueba_auto_dias).toBe(5);
  });

  it('las claves desconocidas no entran', () => {
    expect(Object.keys(normalizarFlags({ otra: true }))).toEqual(Object.keys(FLAGS_APAGADOS));
  });

  it('mismosFlags y faltaLaFuncion', () => {
    expect(mismosFlags(FLAGS_APAGADOS, { ...FLAGS_APAGADOS })).toBe(true);
    expect(mismosFlags(FLAGS_APAGADOS, { ...FLAGS_APAGADOS, modos_activos: true })).toBe(false);
    expect(faltaLaFuncion({ code: 'PGRST202' })).toBe(true);
    expect(faltaLaFuncion({ code: '42883' })).toBe(true);
    expect(faltaLaFuncion({ code: '08006' })).toBe(false);
    expect(faltaLaFuncion(null)).toBe(false);
  });
});

describe('refrescarFlags', () => {
  beforeEach(() => {
    jest.resetModules();
    mockRpc.mockReset();
    mockAlmacen.clear();
  });

  // Un módulo nuevo en cada prueba: la caché en memoria empieza vacía.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cargar = () => require('../flags') as typeof import('../flags');

  it('antes de leer nada, todo apagado', () => {
    expect(cargar().flagsActuales()).toEqual(FLAGS_APAGADOS);
  });

  it('flagActivo (lectura síncrona del coach): apagado hasta que el servidor diga true', async () => {
    const f = cargar();
    expect(f.flagActivo('idiomas_activos')).toBe(false);
    mockRpc.mockResolvedValue({ data: { idiomas_1011: true }, error: null });
    await f.refrescarFlags();
    expect(f.flagActivo('idiomas_activos')).toBe(true);
    expect(f.flagActivo('modos_activos')).toBe(false);
    mockRpc.mockResolvedValue({ data: null, error: { code: '42883', message: 'no existe' } });
    await f.refrescarFlags();
    expect(f.flagActivo('idiomas_activos')).toBe(false);
  });

  it('lee el servidor y lo guarda en el teléfono', async () => {
    mockRpc.mockResolvedValue({ data: { modos_1011: true }, error: null });
    const f = cargar();
    const leidos = await f.refrescarFlags();
    expect(mockRpc).toHaveBeenCalledWith('app_flags');
    expect(leidos.modos_activos).toBe(true);
    expect(f.flagsActuales().modos_activos).toBe(true);
    expect(JSON.parse(mockAlmacen.get('nivl.flags.1011')!).modos_1011).toBe(true);
  });

  it('si la función no existe: apagado y sin caché', async () => {
    mockAlmacen.set('nivl.flags.1011', JSON.stringify({ modos_1011: true }));
    mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'no existe' } });
    const f = cargar();
    f.__fijarFlagsParaPruebas({ modos_activos: true });
    await f.refrescarFlags();
    expect(f.flagsActuales()).toEqual(FLAGS_APAGADOS);
    expect(mockAlmacen.has('nivl.flags.1011')).toBe(false);
  });

  it('sin red: se queda con lo último leído (y nunca lanza)', async () => {
    mockRpc.mockResolvedValueOnce({ data: { modos_1011: true }, error: null });
    const f = cargar();
    await f.refrescarFlags();
    mockRpc.mockRejectedValueOnce(new Error('Network request failed'));
    await expect(f.refrescarFlags()).resolves.toMatchObject({ modos_activos: true });
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: '08006', message: 'caída' } });
    await expect(f.refrescarFlags()).resolves.toMatchObject({ modos_activos: true });
  });

  it('sin red y sin nada leído: apagado', async () => {
    mockRpc.mockRejectedValue(new Error('Network request failed'));
    const f = cargar();
    await expect(f.refrescarFlags()).resolves.toEqual(FLAGS_APAGADOS);
  });
});
