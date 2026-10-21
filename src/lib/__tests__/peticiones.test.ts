import AsyncStorage from '@react-native-async-storage/async-storage';
import { __reiniciarPeticiones, alMomentoPositivo, enviarOpinion, type ValoracionNativa } from '../peticiones';
import {
  decidirPeticion,
  DIAS_ENTRE_VALORACIONES,
  ESTADO_INICIAL,
  leerEstado,
  limpiarOpinion,
  tocaValoracion,
  type Contexto,
  type EstadoPeticiones,
} from '../peticionesmath';
import { __olvidarFlags } from '../flagsServidor';
import { supabase } from '../supabase';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.10' } } }));
jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn(() => null) }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' }, AppState: { addEventListener: jest.fn() } }));
const mockInsert = jest.fn();
jest.mock('../supabase', () => ({
  supabase: { rpc: jest.fn(), auth: { getSession: jest.fn() }, from: jest.fn(() => ({ insert: mockInsert })) },
}));

const DIA = 86_400_000;
const AHORA = Date.parse('2026-10-20T12:00:00Z');
const base: Contexto = { diaDeUso: 2, valoracionActiva: true, opinionActiva: true, valoracionDisponible: true, ahora: AHORA };

describe('decisión (pura)', () => {
  test('día 2-3 tras un momento bueno: primero la valoración, luego la opinión', () => {
    const a = decidirPeticion(ESTADO_INICIAL, base);
    expect(a.peticion).toBe('valoracion');
    const b = decidirPeticion(a.estado, base);
    expect(b.peticion).toBe('opinion');
    expect(decidirPeticion(b.estado, base).peticion).toBeNull();
  });

  test('fuera de la ventana (día 0, 1 o 4+) no se pide nada la primera vez', () => {
    for (const dia of [0, 1, 4, 30, null]) {
      expect(decidirPeticion(ESTADO_INICIAL, { ...base, diaDeUso: dia }).peticion).toBeNull();
    }
    expect(decidirPeticion(ESTADO_INICIAL, { ...base, diaDeUso: 3 }).peticion).toBe('valoracion');
  });

  test('la valoración, como mucho una vez cada 120 días', () => {
    const pedida: EstadoPeticiones = { primerDia: null, valoracionPedidaEn: new Date(AHORA - 119 * DIA).toISOString(), opinionVistaEn: 'x' };
    expect(tocaValoracion(pedida, { ...base, diaDeUso: 200 })).toBe(false);
    const vieja: EstadoPeticiones = { ...pedida, valoracionPedidaEn: new Date(AHORA - DIAS_ENTRE_VALORACIONES * DIA).toISOString() };
    expect(tocaValoracion(vieja, { ...base, diaDeUso: 200 })).toBe(true);
  });

  test('sin «review gating»: la opinión (vista, enviada o cerrada) no cambia la decisión de la valoración', () => {
    const ctx = { ...base, diaDeUso: 3 };
    const sinOpinion = tocaValoracion(ESTADO_INICIAL, ctx);
    const conOpinion = tocaValoracion({ ...ESTADO_INICIAL, opinionVistaEn: new Date(AHORA - DIA).toISOString() }, ctx);
    expect(conOpinion).toBe(sinOpinion);
    // La función ni siquiera recibe lo contestado: solo fechas de cuándo se pidió.
    expect(Object.keys(ESTADO_INICIAL).sort()).toEqual(['opinionVistaEn', 'primerDia', 'valoracionPedidaEn']);
  });

  test('cada cosa con su flag; sin diálogo nativo en la build, solo la opinión', () => {
    expect(decidirPeticion(ESTADO_INICIAL, { ...base, valoracionActiva: false }).peticion).toBe('opinion');
    expect(decidirPeticion(ESTADO_INICIAL, { ...base, valoracionDisponible: false }).peticion).toBe('opinion');
    expect(decidirPeticion(ESTADO_INICIAL, { ...base, opinionActiva: false, valoracionDisponible: false }).peticion).toBeNull();
  });

  test('estado guardado corrupto = inicial; opinión vacía no se manda', () => {
    expect(leerEstado('{')).toEqual(ESTADO_INICIAL);
    expect(leerEstado('{"valoracionPedidaEn":3}')).toEqual(ESTADO_INICIAL);
    expect(limpiarOpinion('  ', '')).toBeNull();
    expect(limpiarOpinion(' La racha ', '')).toEqual({ gusta: 'La racha', cambiaria: null });
    expect(limpiarOpinion('x'.repeat(1500), '')!.gusta).toHaveLength(1000);
  });
});

describe('efectos', () => {
  const rpc = jest.mocked(supabase.rpc);
  let flags: Record<string, boolean>;
  const nativa: ValoracionNativa & { pedir: jest.Mock; disponible: jest.Mock } = {
    disponible: jest.fn(async () => true),
    pedir: jest.fn(async () => undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    __olvidarFlags();
    __reiniciarPeticiones();
    flags = { valoracion_1011: true, opinion_1011: true };
    rpc.mockImplementation(((n: string) =>
      Promise.resolve(n === 'app_flags' ? { data: flags, error: null } : { data: null, error: null })) as never);
    // El día 0 es el primer momento bueno, propio de esta pieza (no depende de la analítica).
    await AsyncStorage.setItem('nivl.peticiones.v1', JSON.stringify({ primerDia: '2026-10-18' }));
  });

  test('con los flags apagados (o ilegibles) no se pide nada', async () => {
    flags = {};
    expect(await alMomentoPositivo('mision', nativa, AHORA)).toBeNull();
    __olvidarFlags();
    rpc.mockImplementation((() => Promise.reject(new Error('red'))) as never);
    expect(await alMomentoPositivo('mision', nativa, AHORA)).toBeNull();
  });

  test('día 2: valoración y luego opinión, y lo decidido queda guardado', async () => {
    expect(await alMomentoPositivo('nivel', nativa, AHORA)).toBe('valoracion');
    expect(await alMomentoPositivo('mision', nativa, AHORA)).toBe('opinion');
    expect(await alMomentoPositivo('mision', nativa, AHORA)).toBeNull();
    const guardado = leerEstado(await AsyncStorage.getItem('nivl.peticiones.v1'));
    expect(guardado.valoracionPedidaEn).not.toBeNull();
    expect(guardado.opinionVistaEn).not.toBeNull();
  });

  test('el primer momento bueno marca el día 0 y no pide nada; no hace falta aceptar la medición', async () => {
    await AsyncStorage.clear();
    expect(await alMomentoPositivo('mision', nativa, AHORA)).toBeNull();
    expect(leerEstado(await AsyncStorage.getItem('nivl.peticiones.v1')).primerDia).toBe('2026-10-20');
    expect(await AsyncStorage.getItem('nivl.analitica.consentimiento.v1')).toBeNull();
    expect(await alMomentoPositivo('mision', nativa, AHORA + 2 * DIA)).toBe('valoracion');
  });

  test('sin expo-store-review en la build (hoy) la valoración no está disponible', async () => {
    flags = { valoracion_1011: true };
    expect(await alMomentoPositivo('mision', undefined, AHORA)).toBeNull();
  });

  test('la opinión manda solo lo escrito y la versión; el user_id lo pone el servidor', async () => {
    mockInsert.mockResolvedValue({ error: null });
    await enviarOpinion(' Las misiones ', '');
    expect(supabase.from).toHaveBeenCalledWith('app_feedback');
    expect(mockInsert).toHaveBeenCalledWith({ gusta: 'Las misiones', cambiaria: null, version: '1.0.10' });
    mockInsert.mockResolvedValue({ error: { code: '54000' } });
    await expect(enviarOpinion('a', 'b')).rejects.toBeTruthy();
  });
});
