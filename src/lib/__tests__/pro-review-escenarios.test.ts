// Revisión independiente (c) · seguridad y escenarios de cobro (2026-10-02).
// docs/payment-audit/REVISION-SEGURIDAD.md. Los tests "DEFECTO" reproducen el
// comportamiento actual (pasan mientras el defecto exista); al corregirlo,
// invierte la aserción marcada. Ningún mock acredita una compra real.
import { Linking } from 'react-native';
import Purchases from 'react-native-purchases';
import { identificarEnTienda, purchase } from '../pro';
import { supabase } from '../supabase';


const mockPlatform = { OS: 'ios' };
jest.mock('react-native', () => ({
  NativeModules: { RNPurchases: {} },
  Platform: { get OS() { return mockPlatform.OS; } },
  Linking: { openURL: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(), logIn: jest.fn().mockResolvedValue({}), logOut: jest.fn().mockResolvedValue({}),
    getAppUserID: jest.fn(), getOfferings: jest.fn(), getCustomerInfo: jest.fn(),
    purchasePackage: jest.fn(), restorePurchases: jest.fn(), showManageSubscriptions: jest.fn(),
    checkTrialOrIntroductoryPriceEligibility: jest.fn(),
  },
  PURCHASES_ERROR_CODE: {
    PURCHASE_CANCELLED_ERROR: 'cancelled', PAYMENT_PENDING_ERROR: 'pending', NETWORK_ERROR: 'network',
    RECEIPT_ALREADY_IN_USE_ERROR: 'receipt-in-use', RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER_ERROR: 'receipt-other',
    PRODUCT_ALREADY_PURCHASED_ERROR: 'already', OPERATION_ALREADY_IN_PROGRESS_ERROR: 'busy', STORE_PROBLEM_ERROR: 'store',
    OFFLINE_CONNECTION_ERROR: 'offline',
  },
}));
jest.mock('../supabase', () => ({ supabase: {
  auth: { getSession: jest.fn() },
  rpc: jest.fn(),
  functions: { invoke: jest.fn() },
} }));

const getOfferings = jest.mocked(Purchases.getOfferings);
const buy = jest.mocked(Purchases.purchasePackage);
const rcRestore = jest.mocked(Purchases.restorePurchases);
const customerInfo = jest.mocked(Purchases.getCustomerInfo);
const appUserId = jest.mocked(Purchases.getAppUserID);
const logIn = jest.mocked(Purchases.logIn);
const manage = jest.mocked(Purchases.showManageSubscriptions);
const eligibility = jest.mocked(Purchases.checkTrialOrIntroductoryPriceEligibility);
const openURL = jest.mocked(Linking.openURL);
const session = jest.mocked(supabase.auth.getSession);
const reconcile = jest.mocked(supabase.functions.invoke);
const status = jest.mocked(supabase.rpc);
const initialKeys = { ios: process.env.EXPO_PUBLIC_RC_IOS_KEY, android: process.env.EXPO_PUBLIC_RC_ANDROID_KEY };

type Intro = { price: number; priceString: string; cycles: number; periodUnit: string; periodNumberOfUnits: number; period: string };
const packageFor = (priceString = '$109.99', identifier = 'nivl_pro_anual', introPrice: Intro | null = null) =>
  ({ identifier: 'annual', product: { identifier, priceString, introPrice } });
const offerings = (...packages: ReturnType<typeof packageFor>[]) => ({ current: { availablePackages: packages }, all: {} }) as never;
/** customerInfo con suscripciones activas: [idTienda, store]. */
const info = (subs: [string, string | null][] = [], extra: Record<string, unknown> = {}) => ({
  activeSubscriptions: subs.map(([id]) => id),
  subscriptionsByProductIdentifier: Object.fromEntries(
    subs.filter(([, store]) => store).map(([id, store]) => [id, { productIdentifier: id, store, isActive: true, managementURL: null }]),
  ),
  entitlements: { active: {}, all: {} },
  managementURL: null,
  ...extra,
}) as never;
const server = (plan: string | null, tier = 'pro', entitled = true) =>
  ({ data: { entitled, plan, tier }, error: null }) as never;
const asUser = (id: string) => session.mockResolvedValue({ data: { session: { user: { id } } } } as never);

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatform.OS = 'ios';
  process.env.EXPO_PUBLIC_RC_IOS_KEY = 'appl_test_public_key';
  process.env.EXPO_PUBLIC_RC_ANDROID_KEY = 'goog_test_public_key';
  asUser('test-user');
  appUserId.mockReset().mockResolvedValue('test-user');
  logIn.mockReset().mockResolvedValue({} as never);
  getOfferings.mockReset().mockResolvedValue(offerings(packageFor()));
  customerInfo.mockReset().mockResolvedValue(info());
  buy.mockReset().mockResolvedValue({} as never);
  rcRestore.mockReset().mockResolvedValue(info([['nivl_pro_anual', 'APP_STORE']]));
  manage.mockReset().mockResolvedValue(undefined);
  eligibility.mockReset().mockResolvedValue({});
  openURL.mockReset().mockResolvedValue(undefined);
  reconcile.mockReset().mockResolvedValue({ data: { ok: true }, error: null });
  status.mockReset().mockResolvedValue(server('pro_anual'));
});

afterAll(() => {
  for (const [k, v] of [['EXPO_PUBLIC_RC_IOS_KEY', initialKeys.ios], ['EXPO_PUBLIC_RC_ANDROID_KEY', initialKeys.android]] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

/** Ejecuta con temporizadores falsos (esperarDerecho reintenta 6 veces cada 2 s). */
async function conReloj<T>(fn: () => Promise<T>): Promise<T> {
  jest.useFakeTimers();
  try {
    const p = fn();
    await jest.runAllTimersAsync();
    return await p;
  } finally {
    jest.useRealTimers();
  }
}


describe('revisión (c): escenarios de cobro', () => {
  test('CORREGIDO P1 Android: cuenta NIVL nueva tras borrar la anterior, con la suscripción Play viva en la cuenta de Google → se sincroniza antes y se compra con productChangeInfo (sin 2ª suscripción)', async () => {
    mockPlatform.OS = 'android';
    asUser('cuenta-nueva');
    appUserId.mockResolvedValue('cuenta-nueva');
    getOfferings.mockResolvedValue(offerings(packageFor('29,99 €', 'nivl_elite_mensual:mensual')));
    customerInfo.mockResolvedValue(info()); // RevenueCat: este uid aún no tiene nada
    rcRestore.mockResolvedValue(info([], {
      activeSubscriptions: ['nivl_pro_mensual:mensual'],
      subscriptionsByProductIdentifier: { 'nivl_pro_mensual:mensual': { productIdentifier: 'nivl_pro_mensual:mensual', store: 'PLAY_STORE', isActive: true, willRenew: true, managementURL: null } },
    }));
    await conReloj(() => purchase('nivl_elite_mensual', '29,99 €'));
    expect(rcRestore).toHaveBeenCalledTimes(1);
    expect(rcRestore.mock.invocationCallOrder[0]!).toBeLessThan(buy.mock.invocationCallOrder[0]!);
    expect(buy).toHaveBeenCalledTimes(1);
    expect(buy.mock.calls[0]![2]).toMatchObject({ oldProductIdentifier: 'nivl_pro_mensual' });
  });

  test('Android sin nada que sincronizar → compra nueva normal (tras intentar sincronizar)', async () => {
    mockPlatform.OS = 'android';
    asUser('cuenta-nueva');
    appUserId.mockResolvedValue('cuenta-nueva');
    getOfferings.mockResolvedValue(offerings(packageFor('12,99 €', 'nivl_pro_mensual:mensual')));
    customerInfo.mockResolvedValue(info());
    rcRestore.mockResolvedValue(info());
    await conReloj(() => purchase('nivl_pro_mensual', '12,99 €'));
    expect(rcRestore).toHaveBeenCalledTimes(1);
    expect(buy.mock.calls[0]).toHaveLength(1);
  });

  test('CORREGIDO P2: suscripción cancelada pero vigente (willRenew=false) del mismo plan → bloqueada y remitida a Gestionar (reactivar), no a Restaurar', async () => {
    customerInfo.mockResolvedValue(info([], {
      activeSubscriptions: ['nivl_pro_anual'],
      subscriptionsByProductIdentifier: { nivl_pro_anual: { productIdentifier: 'nivl_pro_anual', store: 'APP_STORE', isActive: true, willRenew: false, managementURL: null } },
    }));
    await expect(purchase('nivl_pro_anual', '$109.99')).rejects.toThrow(/Gestionar o cancelar suscripción/);
    expect(buy).not.toHaveBeenCalled();
  });

  test('CORREGIDO P2 (carrera): si la cuenta cambia mientras se prepara la compra, el cobro se aborta antes de pagar', async () => {
    let actual = 'test-user';
    logIn.mockImplementation(async (id: string) => { actual = id; return {} as never; });
    appUserId.mockImplementation(async () => actual);
    customerInfo.mockImplementation(async () => {
      void identificarEnTienda('otra-cuenta'); // el usuario cambia de cuenta mientras se lee customerInfo
      await Promise.resolve();
      await Promise.resolve();
      return info();
    });
    await identificarEnTienda('test-user'); // asegura configure previo
    const e = await conReloj(() => purchase('nivl_pro_anual', '$109.99').catch((x: Error) => x));
    expect(String(e)).toMatch(/La cuenta ha cambiado/);
    expect(buy).not.toHaveBeenCalled();
  });

  test('PASS: sin red getCustomerInfo falla → no se cobra (sin falso "ya lo tienes")', async () => {
    customerInfo.mockRejectedValue({ code: 'network' });
    await expect(purchase('nivl_pro_anual', '$109.99')).rejects.toThrow('network');
    expect(buy).not.toHaveBeenCalled();
  });

  test('PASS: el cliente nunca envía uid, plan ni recibo a store-reconcile', async () => {
    await conReloj(() => purchase('nivl_pro_anual', '$109.99'));
    expect(reconcile).toHaveBeenCalledWith('store-reconcile', { body: {}, timeout: 15000 });
  });
});
