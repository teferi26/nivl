import Purchases from 'react-native-purchases';
import { preciosDeTienda } from '../pro';
import { ErrorTiempoAgotado, LIMITE_RED_MS } from '../limiteRed';
import { supabase } from '../supabase';
import { MENSAJE_SIN_CONEXION, mensajeSistema } from '../validation';

// Tope de espera solo en getOfferings: una tienda que no contesta deja el
// catálogo en error (Reintentar precios). Nunca una lista vacía, que se leería
// como «la tienda no tiene planes».

jest.mock('react-native', () => ({
  NativeModules: { RNPurchases: {} },
  Platform: { OS: 'ios' },
  Linking: { openURL: jest.fn() },
}));
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(), logIn: jest.fn().mockResolvedValue({}), logOut: jest.fn().mockResolvedValue({}),
    getAppUserID: jest.fn(), getOfferings: jest.fn(), getCustomerInfo: jest.fn(),
    purchasePackage: jest.fn(), restorePurchases: jest.fn(), showManageSubscriptions: jest.fn(),
    checkTrialOrIntroductoryPriceEligibility: jest.fn(),
  },
  PURCHASES_ERROR_CODE: {},
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../supabase', () => ({ supabase: {
  auth: { getSession: jest.fn() },
  rpc: jest.fn(),
  functions: { invoke: jest.fn() },
} }));

const initialKey = process.env.EXPO_PUBLIC_RC_IOS_KEY;

beforeEach(() => {
  process.env.EXPO_PUBLIC_RC_IOS_KEY = 'appl_test_public_key';
  jest.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'test-user' } } } } as never);
  jest.mocked(Purchases.getAppUserID).mockResolvedValue('test-user');
});

afterAll(() => {
  if (initialKey === undefined) delete process.env.EXPO_PUBLIC_RC_IOS_KEY;
  else process.env.EXPO_PUBLIC_RC_IOS_KEY = initialKey;
});

test('getOfferings colgado: lanza un error de red al tope, no devuelve catálogo vacío', async () => {
  jest.mocked(Purchases.getOfferings).mockReturnValue(new Promise<never>(() => {}));
  jest.useFakeTimers();
  try {
    const r = preciosDeTienda();
    let error: unknown = null;
    const fin = r.then(
      () => null,
      (e: unknown) => {
        error = e;
      },
    );
    await jest.advanceTimersByTimeAsync(LIMITE_RED_MS - 1);
    expect(error).toBeNull();
    await jest.advanceTimersByTimeAsync(1);
    await fin;
    expect(error).toBeInstanceOf(ErrorTiempoAgotado);
    expect(mensajeSistema(error)).toBe(MENSAJE_SIN_CONEXION);
  } finally {
    jest.useRealTimers();
  }
});
