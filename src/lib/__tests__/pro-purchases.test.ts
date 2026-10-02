import { Linking } from 'react-native';
import Purchases from 'react-native-purchases';
import {
  gestionarSuscripcion,
  identificarEnTienda,
  introsDeTienda,
  preciosDeTienda,
  purchase,
  restorePurchases,
  startTrial,
  StorePriceChangedError,
} from '../pro';
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

describe('catálogo y precio', () => {
  test('solo expone productos reconocidos con precio localizado no vacío', async () => {
    getOfferings.mockResolvedValue(offerings(packageFor(), packageFor(' ', 'nivl_pro_mensual'), packageFor('$5', 'unknown')));
    await expect(preciosDeTienda()).resolves.toEqual({ nivl_pro_anual: '$109.99' });
  });

  test('en Google Play el id con base plan ("producto:baseplan") se reconoce', async () => {
    mockPlatform.OS = 'android';
    getOfferings.mockResolvedValue(offerings(packageFor('12,99 €', 'nivl_pro_mensual:mensual')));
    await expect(preciosDeTienda()).resolves.toEqual({ nivl_pro_mensual: '12,99 €' });
  });

  test('no cobra si el importe cambió desde que se mostró la oferta', async () => {
    await expect(purchase('nivl_pro_anual', '99,99 €')).rejects.toBeInstanceOf(StorePriceChangedError);
    expect(buy).not.toHaveBeenCalled();
  });

  test('no cobra sin precio mostrado ni sin producto', async () => {
    await expect(purchase('nivl_pro_anual', ' ')).rejects.toThrow(/cargue el precio/);
    expect(getOfferings).not.toHaveBeenCalled();
    getOfferings.mockResolvedValue(offerings());
    await expect(purchase('nivl_pro_anual', '$109.99')).rejects.toThrow(/no está disponible/);
    expect(buy).not.toHaveBeenCalled();
  });

  test('ignora paquetes duplicados sin precio tanto al mostrar la oferta como al comprar', async () => {
    getOfferings.mockResolvedValue(offerings(packageFor(' '), packageFor()));
    await expect(preciosDeTienda()).resolves.toEqual({ nivl_pro_anual: '$109.99' });
    await expect(purchase('nivl_pro_anual', '$109.99')).resolves.toBe('activa');
    expect(buy).toHaveBeenCalledWith(packageFor());
  });
});

describe('oferta introductoria de la tienda', () => {
  const semanaGratis: Intro = { price: 0, priceString: '0,00 €', cycles: 1, periodUnit: 'WEEK', periodNumberOfUnits: 1, period: 'P1W' };

  test('sin oferta en la tienda no se promete ninguna prueba de tienda', async () => {
    await expect(introsDeTienda()).resolves.toEqual({});
    expect(eligibility).not.toHaveBeenCalled();
  });

  test('Google Play: si la tienda declara una semana gratis, se dice', async () => {
    mockPlatform.OS = 'android';
    getOfferings.mockResolvedValue(offerings(packageFor('99,99 €', 'nivl_pro_anual:anual', semanaGratis)));
    const r = await introsDeTienda();
    expect(r.nivl_pro_anual).toMatch(/1 semana gratis/);
    expect(r.nivl_pro_anual).not.toMatch(/elegible/);
  });

  test('iOS: inelegible no se dice; desconocida se dice como condicional', async () => {
    getOfferings.mockResolvedValue(offerings(
      packageFor('$109.99', 'nivl_pro_anual', semanaGratis),
      packageFor('$12.99', 'nivl_pro_mensual', semanaGratis),
    ));
    eligibility.mockResolvedValue({ nivl_pro_anual: { status: 1 }, nivl_pro_mensual: { status: 0 } } as never);
    const r = await introsDeTienda();
    expect(r.nivl_pro_anual).toBeUndefined();
    expect(r.nivl_pro_mensual).toMatch(/elegible/);
  });
});

describe('compra nueva', () => {
  test('compra el paquete cuyo precio coincide y confirma el derecho del servidor', async () => {
    await expect(purchase('nivl_pro_anual', '$109.99')).resolves.toBe('activa');
    expect(buy).toHaveBeenCalledWith(packageFor());
    expect(reconcile).toHaveBeenCalledWith('store-reconcile', { body: {}, timeout: 15000 });
    expect(buy.mock.invocationCallOrder[0]).toBeLessThan(reconcile.mock.invocationCallOrder[0]!);
    expect(reconcile.mock.invocationCallOrder[0]).toBeLessThan(status.mock.invocationCallOrder[0]!);
  });

  test('cancelar la hoja no es error ni se transforma en una compra', async () => {
    buy.mockRejectedValue({ code: 'cancelled' });
    await expect(purchase('nivl_pro_anual', '$109.99')).resolves.toBe('cancelada');
    expect(reconcile).not.toHaveBeenCalled();
  });

  test('Ask to Buy / pago diferido: dice que no se ha cobrado y da salida', async () => {
    buy.mockRejectedValue({ code: 'pending' });
    await expect(purchase('nivl_pro_anual', '$109.99')).rejects.toThrow(/pendiente de aprobación.*no se ha cobrado.*Restaurar compras/);
    expect(reconcile).not.toHaveBeenCalled();
  });

  test('sin poder leer lo que ya tiene en la tienda, no cobra (fail closed)', async () => {
    customerInfo.mockRejectedValue({ code: 'network' });
    await expect(purchase('nivl_pro_anual', '$109.99')).rejects.toThrow('network');
    expect(buy).not.toHaveBeenCalled();
  });

  test('ningún id de usuario, producto ni recibo viaja al servidor desde el cliente', async () => {
    await purchase('nivl_pro_anual', '$109.99');
    for (const call of reconcile.mock.calls) expect(call[1]).toEqual({ body: {}, timeout: 15000 });
    for (const call of status.mock.calls) expect(call).toEqual(['ai_status']);
  });
});

describe('cambios de plan: sin segunda suscripción', () => {
  test('Android Pro → Élite pasa productChangeInfo (sin base plan) con prorrata inmediata', async () => {
    mockPlatform.OS = 'android';
    getOfferings.mockResolvedValue(offerings(packageFor('29,99 €', 'nivl_elite_mensual:mensual')));
    customerInfo.mockResolvedValue(info([['nivl_pro_mensual:mensual', 'PLAY_STORE']]));
    status.mockResolvedValue(server('elite_mensual', 'elite'));
    await expect(purchase('nivl_elite_mensual', '29,99 €')).resolves.toBe('activa');
    // Antes: purchasePackage(paquete) a secas → Google abría una SEGUNDA suscripción.
    expect(buy).toHaveBeenCalledWith(
      packageFor('29,99 €', 'nivl_elite_mensual:mensual'),
      null,
      { oldProductIdentifier: 'nivl_pro_mensual', replacementMode: 'CHARGE_PRORATED_PRICE' },
    );
  });

  test('Android Élite → Pro se programa para la renovación (DEFERRED)', async () => {
    mockPlatform.OS = 'android';
    getOfferings.mockResolvedValue(offerings(packageFor('99,99 €', 'nivl_pro_anual:anual')));
    customerInfo.mockResolvedValue(info([['nivl_elite_anual:anual', 'PLAY_STORE']]));
    status.mockResolvedValue(server('elite_anual', 'elite'));
    await expect(conReloj(() => purchase('nivl_pro_anual', '99,99 €'))).resolves.toBe('programada');
    expect(buy).toHaveBeenCalledWith(expect.anything(), null, { oldProductIdentifier: 'nivl_elite_anual', replacementMode: 'DEFERRED' });
  });

  test('Android anual ↔ mensual del mismo nivel también es un cambio, no otra suscripción', async () => {
    mockPlatform.OS = 'android';
    getOfferings.mockResolvedValue(offerings(packageFor('12,99 €', 'nivl_pro_mensual:mensual')));
    customerInfo.mockResolvedValue(info([['nivl_pro_anual:anual', null]])); // solo activeSubscriptions
    await conReloj(() => purchase('nivl_pro_mensual', '12,99 €'));
    expect(buy).toHaveBeenCalledWith(expect.anything(), null, { oldProductIdentifier: 'nivl_pro_anual', replacementMode: 'DEFERRED' });
  });

  test('iOS: el grupo de suscripción lo gestiona Apple; se espera el plan EXACTO', async () => {
    getOfferings.mockResolvedValue(offerings(packageFor('$24.99', 'nivl_elite_mensual')));
    customerInfo.mockResolvedValue(info([['nivl_pro_mensual', 'APP_STORE']]));
    status.mockResolvedValue(server('pro_mensual'));
    // Antes, un Pro que sube a Élite y sigue en Pro pasaba por "activa" si se miraba solo el derecho.
    await expect(conReloj(() => purchase('nivl_elite_mensual', '$24.99'))).resolves.toBe('pendiente');
    expect(buy).toHaveBeenCalledWith(packageFor('$24.99', 'nivl_elite_mensual'));
  });

  test('ya tiene ese mismo plan: no se vuelve a cobrar', async () => {
    customerInfo.mockResolvedValue(info([['nivl_pro_anual', 'APP_STORE']]));
    await expect(purchase('nivl_pro_anual', '$109.99')).rejects.toThrow(/Ya tienes este plan/);
    expect(buy).not.toHaveBeenCalled();
  });

  test('suscripción viva en OTRA tienda: no se compra aquí (sería un segundo cobro)', async () => {
    mockPlatform.OS = 'android';
    getOfferings.mockResolvedValue(offerings(packageFor('29,99 €', 'nivl_elite_mensual:mensual')));
    customerInfo.mockResolvedValue(info([['nivl_pro_anual', 'APP_STORE']]));
    await expect(purchase('nivl_elite_mensual', '29,99 €')).rejects.toThrow(/otra tienda.*segundo cobro/);
    expect(buy).not.toHaveBeenCalled();
  });
});

describe('identidad de la tienda', () => {
  test('si el SDK no está a nombre de la cuenta con sesión, no cobra ni restaura', async () => {
    appUserId.mockResolvedValue('otra-cuenta');
    await expect(purchase('nivl_pro_anual', '$109.99')).rejects.toThrow(/no está vinculada/);
    await expect(restorePurchases()).rejects.toThrow(/no está vinculada/);
    expect(buy).not.toHaveBeenCalled();
    expect(rcRestore).not.toHaveBeenCalled();
  });

  test('un cambio de sesión en cola termina antes de comprar con la cuenta nueva', async () => {
    await preciosDeTienda(); // configura con test-user
    let soltar!: () => void;
    logIn.mockImplementationOnce(() => new Promise((r) => { soltar = () => r({} as never); }));
    void identificarEnTienda('cuenta-b');
    asUser('cuenta-a');
    appUserId.mockResolvedValue('cuenta-a');
    const compra = purchase('nivl_pro_anual', '$109.99');
    await Promise.resolve();
    expect(buy).not.toHaveBeenCalled();
    soltar();
    await expect(compra).resolves.toBe('activa');
    expect(logIn.mock.calls.map((c) => c[0])).toEqual(['cuenta-b', 'cuenta-a']);
    expect(logIn.mock.invocationCallOrder[1]).toBeLessThan(buy.mock.invocationCallOrder[0]!);
    asUser('test-user');
    appUserId.mockResolvedValue('test-user');
  });

  test('si logIn falla, la compra no sigue a nombre de la cuenta anterior', async () => {
    asUser('cuenta-c');
    logIn.mockRejectedValueOnce(new Error('logIn failed'));
    await expect(purchase('nivl_pro_anual', '$109.99')).rejects.toThrow('logIn failed');
    expect(buy).not.toHaveBeenCalled();
  });
});

describe('restaurar', () => {
  test('restaurar no necesita cargar el catálogo de productos', async () => {
    getOfferings.mockRejectedValue(new Error('catalog unavailable'));
    await expect(restorePurchases()).resolves.toBe('activa');
    expect(rcRestore).toHaveBeenCalledTimes(1);
    expect(getOfferings).not.toHaveBeenCalled();
    expect(reconcile).toHaveBeenCalledWith('store-reconcile', { body: {}, timeout: 15000 });
    expect(rcRestore.mock.invocationCallOrder[0]).toBeLessThan(reconcile.mock.invocationCallOrder[0]!);
  });

  test('restaurar sin compra reconocida no inventa un derecho ni consulta el catálogo', async () => {
    rcRestore.mockResolvedValue(info([['unrelated-product', 'APP_STORE']]));
    await expect(restorePurchases()).resolves.toBe('nada');
    expect(reconcile).not.toHaveBeenCalled();
    expect(getOfferings).not.toHaveBeenCalled();
  });

  test('Google Play: id con base plan en activeSubscriptions no da "nada" (cuenta nueva tras borrar)', async () => {
    mockPlatform.OS = 'android';
    rcRestore.mockResolvedValue(info([['nivl_elite_fundador:anual', null]]));
    status.mockResolvedValue(server('elite_fundador', 'elite'));
    await expect(restorePurchases()).resolves.toBe('activa');
    expect(reconcile).toHaveBeenCalledWith('store-reconcile', { body: {}, timeout: 15000 });
  });

  test('suscripción solo visible por el entitlement activo: tampoco es "nada"', async () => {
    rcRestore.mockResolvedValue(info([], {
      entitlements: { active: { coach: { isActive: true, productIdentifier: 'nivl_pro_mensual', store: 'APP_STORE' } }, all: {} },
    }));
    await expect(restorePurchases()).resolves.toBe('activa');
  });

  test('compra de otra cuenta de NIVL (sin transferencia): mensaje claro', async () => {
    rcRestore.mockRejectedValue({ code: 'receipt-in-use' });
    await expect(restorePurchases()).rejects.toThrow(/pertenece a otra cuenta de NIVL/);
  });

  test('una compra del SDK no da acceso si el servidor sigue sin confirmarla', async () => {
    status.mockResolvedValue(server(null, 'free', false));
    await expect(conReloj(() => restorePurchases())).resolves.toBe('pendiente');
    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledTimes(6);
  });

  test('un fallo temporal de reconciliación permanece pendiente y Restaurar vuelve a intentarlo', async () => {
    status.mockResolvedValue(server(null, 'free', false));
    reconcile.mockResolvedValue({ data: null, error: new Error('upstream unavailable') });
    await expect(conReloj(() => restorePurchases())).resolves.toBe('pendiente');
    reconcile.mockResolvedValue({ data: { ok: true }, error: null });
    status.mockResolvedValue(server('pro_anual'));
    await expect(restorePurchases()).resolves.toBe('activa');
    expect(reconcile).toHaveBeenCalledTimes(2);
  });

  test('un webhook confirmado permite terminar aunque la llamada cliente falle', async () => {
    reconcile.mockRejectedValue(new Error('network'));
    await expect(restorePurchases()).resolves.toBe('activa');
    expect(status).toHaveBeenCalledTimes(1);
  });
});

describe('gestionar / cancelar', () => {
  test('iOS abre la hoja nativa de suscripciones de la App Store', async () => {
    customerInfo.mockResolvedValue(info([['nivl_pro_anual', 'APP_STORE']]));
    await gestionarSuscripcion();
    expect(manage).toHaveBeenCalledTimes(1);
    expect(openURL).not.toHaveBeenCalled();
  });

  test('Android abre la managementURL que da RevenueCat', async () => {
    mockPlatform.OS = 'android';
    customerInfo.mockResolvedValue(info([['nivl_pro_anual:anual', 'PLAY_STORE']], { managementURL: 'https://play.google.com/store/account/subscriptions?sku=nivl_pro_anual' }));
    await gestionarSuscripcion();
    expect(manage).not.toHaveBeenCalled();
    expect(openURL).toHaveBeenCalledWith('https://play.google.com/store/account/subscriptions?sku=nivl_pro_anual');
  });

  test('sin red, cae en la página de suscripciones de la tienda', async () => {
    mockPlatform.OS = 'android';
    customerInfo.mockRejectedValue({ code: 'network' });
    await gestionarSuscripcion();
    expect(openURL).toHaveBeenCalledWith('https://play.google.com/store/account/subscriptions');
  });
});

describe('prueba de 7 días (servidor)', () => {
  test('un error del servidor (p. ej. consentimiento de salud) no se disfraza de "prueba ya usada"', async () => {
    status.mockResolvedValueOnce({ data: null, error: { message: 'sin_consentimiento_salud' } } as never);
    await expect(startTrial()).rejects.toEqual({ message: 'sin_consentimiento_salud' });
    status.mockResolvedValueOnce({ data: { ok: false, reason: 'otro_motivo' }, error: null } as never);
    await expect(startTrial()).rejects.toThrow(/otro_motivo/);
    status.mockResolvedValueOnce({ data: { ok: false, reason: 'ya_usada' }, error: null } as never);
    await expect(startTrial()).resolves.toEqual({ ok: false, reason: 'ya_usada' });
  });
});
