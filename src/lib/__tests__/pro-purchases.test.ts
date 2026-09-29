import Purchases from 'react-native-purchases';
import { preciosDeTienda, purchase, restorePurchases, StorePriceChangedError } from '../pro';
import { supabase } from '../supabase';

jest.mock('react-native', () => ({ NativeModules: { RNPurchases: {} }, Platform: { OS: 'ios' } }));
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(), logIn: jest.fn().mockResolvedValue({}), getOfferings: jest.fn(),
    purchasePackage: jest.fn(), restorePurchases: jest.fn(),
  },
  PURCHASES_ERROR_CODE: { PURCHASE_CANCELLED_ERROR: 'cancelled' },
}));
jest.mock('../supabase', () => ({ supabase: {
  auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user' } } } }) },
  rpc: jest.fn().mockResolvedValue({ data: { entitled: true, plan: 'pro_anual', tier: 'pro' }, error: null }),
  functions: { invoke: jest.fn().mockResolvedValue({ data: { ok: true }, error: null }) },
} }));

const getOfferings = jest.mocked(Purchases.getOfferings);
const buy = jest.mocked(Purchases.purchasePackage);
const rcRestore = jest.mocked(Purchases.restorePurchases);
const reconcile = jest.mocked(supabase.functions.invoke);
const status = jest.mocked(supabase.rpc);
const initialKey = process.env.EXPO_PUBLIC_RC_IOS_KEY;
const packageFor = (priceString = '$109.99', identifier = 'nivl_pro_anual') => ({ identifier: 'annual', product: { identifier, priceString } });
const offerings = (...packages: ReturnType<typeof packageFor>[]) => ({ current: { availablePackages: packages }, all: {} }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_RC_IOS_KEY = 'appl_test_public_key';
  getOfferings.mockReset().mockResolvedValue(offerings(packageFor()));
  buy.mockReset().mockResolvedValue({} as never);
  rcRestore.mockReset().mockResolvedValue({ activeSubscriptions: ['nivl_pro_anual'] } as never);
  reconcile.mockReset().mockResolvedValue({ data: { ok: true }, error: null });
  status.mockReset().mockResolvedValue({ data: { entitled: true, plan: 'pro_anual', tier: 'pro' }, error: null } as never);
});

afterAll(() => {
  if (initialKey === undefined) delete process.env.EXPO_PUBLIC_RC_IOS_KEY;
  else process.env.EXPO_PUBLIC_RC_IOS_KEY = initialKey;
});

test('solo expone productos reconocidos con precio localizado no vacío', async () => {
  getOfferings.mockResolvedValue(offerings(packageFor(), packageFor(' ', 'nivl_pro_mensual'), packageFor('$5', 'unknown')));
  await expect(preciosDeTienda()).resolves.toEqual({ nivl_pro_anual: '$109.99' });
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

test('compra el paquete cuyo precio coincide y confirma el derecho del servidor', async () => {
  await expect(purchase('nivl_pro_anual', '$109.99')).resolves.toBe('activa');
  expect(buy).toHaveBeenCalledWith(packageFor());
  expect(reconcile).toHaveBeenCalledWith('store-reconcile', { body: {}, timeout: 15000 });
  expect(buy.mock.invocationCallOrder[0]).toBeLessThan(reconcile.mock.invocationCallOrder[0]);
  expect(reconcile.mock.invocationCallOrder[0]).toBeLessThan(status.mock.invocationCallOrder[0]);
});

test('ignora paquetes duplicados sin precio tanto al mostrar la oferta como al comprar', async () => {
  getOfferings.mockResolvedValue(offerings(packageFor(' '), packageFor()));
  await expect(preciosDeTienda()).resolves.toEqual({ nivl_pro_anual: '$109.99' });
  await expect(purchase('nivl_pro_anual', '$109.99')).resolves.toBe('activa');
  expect(buy).toHaveBeenCalledWith(packageFor());
});

test('cancelar la hoja no es error ni se transforma en una compra', async () => {
  buy.mockRejectedValue({ code: 'cancelled' });
  await expect(purchase('nivl_pro_anual', '$109.99')).resolves.toBe('cancelada');
  expect(reconcile).not.toHaveBeenCalled();
});

test('restaurar no necesita cargar el catálogo de productos', async () => {
  getOfferings.mockRejectedValue(new Error('catalog unavailable'));
  await expect(restorePurchases()).resolves.toBe('activa');
  expect(rcRestore).toHaveBeenCalledTimes(1);
  expect(getOfferings).not.toHaveBeenCalled();
  expect(reconcile).toHaveBeenCalledWith('store-reconcile', { body: {}, timeout: 15000 });
  expect(rcRestore.mock.invocationCallOrder[0]).toBeLessThan(reconcile.mock.invocationCallOrder[0]);
});

test('restaurar sin compra reconocida no inventa un derecho ni consulta el catálogo', async () => {
  rcRestore.mockResolvedValue({ activeSubscriptions: ['unrelated-product'] } as never);
  await expect(restorePurchases()).resolves.toBe('nada');
  expect(reconcile).not.toHaveBeenCalled();
  expect(getOfferings).not.toHaveBeenCalled();
});

test('una compra del SDK no da acceso si el servidor sigue sin confirmarla', async () => {
  jest.useFakeTimers();
  try {
    status.mockResolvedValue({ data: { entitled: false, tier: 'free' }, error: null } as never);
    const result = restorePurchases();
    await jest.runAllTimersAsync();
    await expect(result).resolves.toBe('pendiente');
    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledTimes(6);
  } finally { jest.useRealTimers(); }
});

test('un fallo temporal de reconciliación permanece pendiente y Restaurar vuelve a intentarlo', async () => {
  jest.useFakeTimers();
  try {
    status.mockResolvedValue({ data: { entitled: false, tier: 'free' }, error: null } as never);
    reconcile.mockResolvedValue({ data: null, error: new Error('upstream unavailable') });
    const first = restorePurchases();
    await jest.runAllTimersAsync();
    await expect(first).resolves.toBe('pendiente');
    reconcile.mockResolvedValue({ data: { ok: true }, error: null });
    status.mockResolvedValue({ data: { entitled: true, plan: 'pro_anual', tier: 'pro' }, error: null } as never);
    await expect(restorePurchases()).resolves.toBe('activa');
    expect(reconcile).toHaveBeenCalledTimes(2);
  } finally { jest.useRealTimers(); }
});

test('un webhook confirmado permite terminar aunque la llamada cliente falle', async () => {
  reconcile.mockRejectedValue(new Error('network'));
  await expect(restorePurchases()).resolves.toBe('activa');
  expect(status).toHaveBeenCalledTimes(1);
});
