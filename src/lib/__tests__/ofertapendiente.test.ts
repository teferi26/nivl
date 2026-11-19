import {
  CADUCIDAD_PENDIENTE,
  CLAVE_OFERTA_PENDIENTE,
  hayOfertaPendiente,
  marcarOfertaPendiente,
  olvidarOfertaPendiente,
  parsearPendiente,
  quedaPendiente,
} from '../ofertapendiente';
import { DIA, decidirOferta, type DecisionOferta } from '../paywallmoment';
import { DECISION_SALTAR } from '@/components/onboarding/pasoOferta';

const mockMemoria = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => (mockMemoria.has(k) ? mockMemoria.get(k)! : null)),
  setItem: jest.fn(async (k: string, v: string) => void mockMemoria.set(k, v)),
  removeItem: jest.fn(async (k: string) => void mockMemoria.delete(k)),
}));

const AHORA = new Date(2026, 10, 19, 19, 30).getTime();

function d(parcial: Partial<DecisionOferta>): DecisionOferta {
  return { mostrar: false, forma: 'linea', tier: 'pro', prueba: false, copyKey: 'firma.pro', razon: 'x', ...parcial };
}

describe('quedaPendiente', () => {
  it('queda pendiente si no se vio por la lectura vencida, sin estado o un fallo', () => {
    expect(quedaPendiente(DECISION_SALTAR)).toBe(true); // razon 'tiempo'
    expect(quedaPendiente(d({ razon: 'sin_estado' }))).toBe(true);
    expect(quedaPendiente(d({ razon: 'error' }))).toBe(true);
  });

  it('no queda pendiente si la oferta se enseñó', () => {
    expect(quedaPendiente(d({ mostrar: true, forma: 'hoja', razon: 'primera_firma' }))).toBe(false);
  });

  it('respeta las decisiones de la cuenta: ya paga, topes, tienda cerrada', () => {
    for (const razon of ['ya_pro', 'ya_elite', 'tope_dia', 'tope_semana', 'espera_72h', 'tienda_cerrada', 'celebrando']) {
      expect(quedaPendiente(d({ razon }))).toBe(false);
    }
  });

  it('sin decisión no queda nada', () => {
    expect(quedaPendiente(null)).toBe(false);
    expect(quedaPendiente(undefined)).toBe(false);
  });

  it('a quien ya paga, la segunda oportunidad no le enseña nada (misma regla que el paso 6)', () => {
    const r = decidirOferta('firma', {
      tier: 'pro',
      entitled: true,
      trial: false,
      trialAvailable: false,
      tiendaAbierta: true,
      celebrando: false,
      ahora: AHORA,
      historial: [],
    });
    expect(r.mostrar).toBe(false);
  });

  it('a quien no vio la firma, la segunda oportunidad es la hoja entera con la prueba', () => {
    const r = decidirOferta('firma', {
      tier: 'free',
      entitled: false,
      trial: false,
      trialAvailable: true,
      tiendaAbierta: true,
      celebrando: false,
      ahora: AHORA,
      historial: [],
    });
    expect(r).toMatchObject({ mostrar: true, forma: 'hoja', prueba: true, razon: 'primera_firma' });
  });
});

describe('parsearPendiente', () => {
  it('lee un instante válido', () => {
    expect(parsearPendiente(String(AHORA - DIA), AHORA)).toBe(AHORA - DIA);
  });

  it('caduca a los 7 días', () => {
    expect(parsearPendiente(String(AHORA - CADUCIDAD_PENDIENTE + 1), AHORA)).not.toBeNull();
    expect(parsearPendiente(String(AHORA - CADUCIDAD_PENDIENTE - 1), AHORA)).toBeNull();
  });

  it('descarta lo roto, vacío o muy del futuro', () => {
    expect(parsearPendiente(null, AHORA)).toBeNull();
    expect(parsearPendiente('', AHORA)).toBeNull();
    expect(parsearPendiente('hola', AHORA)).toBeNull();
    expect(parsearPendiente('-5', AHORA)).toBeNull();
    expect(parsearPendiente(String(AHORA + 2 * DIA), AHORA)).toBeNull();
    expect(parsearPendiente(String(AHORA + 60_000), AHORA)).toBe(AHORA + 60_000);
  });
});

describe('apunte en el dispositivo', () => {
  beforeEach(() => mockMemoria.clear());

  it('marcar, leer y olvidar', async () => {
    expect(await hayOfertaPendiente(AHORA)).toBe(false);
    await marcarOfertaPendiente(AHORA);
    expect(mockMemoria.get(CLAVE_OFERTA_PENDIENTE)).toBe(String(AHORA));
    expect(await hayOfertaPendiente(AHORA + DIA)).toBe(true);
    await olvidarOfertaPendiente();
    expect(await hayOfertaPendiente(AHORA + DIA)).toBe(false);
  });

  it('un apunte caducado se borra al leerlo', async () => {
    await marcarOfertaPendiente(AHORA);
    expect(await hayOfertaPendiente(AHORA + 8 * DIA)).toBe(false);
    expect(mockMemoria.has(CLAVE_OFERTA_PENDIENTE)).toBe(false);
  });
});
