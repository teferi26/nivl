import { act, createElement, type ReactElement } from 'react';
import { ProOfferActions, ProOfferBody, ProOfferLegal, useProOffer } from '@/components/ProOffer';
import { preciosDeTienda, purchase, restorePurchases, startTrial, StorePriceChangedError, type PreciosTienda } from '../pro';

jest.mock('@/lib/pro', () => ({
  ...jest.requireActual('@/lib/proplans'),
  StorePriceChangedError: class extends Error {},
  purchasesAvailable: () => true,
  fetchFounderSeatsLeft: jest.fn().mockResolvedValue(10),
  preciosDeTienda: jest.fn(),
  purchase: jest.fn(),
  restorePurchases: jest.fn(),
  startTrial: jest.fn(),
}));
jest.mock('@/lib/data', () => ({ insertEvent: jest.fn() }));
jest.mock('@/components/ConsentimientoIA', () => ({
  useConsentimientoIA: () => ({ asegurar: () => Promise.resolve(true), hoja: null }),
}));
jest.mock('react-native', () => ({
  Linking: { openURL: jest.fn().mockResolvedValue(undefined) },
  Pressable: 'Pressable', Text: 'Text', View: 'View',
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Success: 'success' },
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/components/SystemButton', () => ({ SystemButton: 'SystemButton' }));
jest.mock('@/components/ui', () => ({ Card: 'Card', Chip: 'Chip', Skeleton: 'Skeleton', Tag: 'Tag' }));

const { create } = jest.requireActual<{
  create: (element: ReactElement) => {
    unmount: () => void;
    toJSON: () => unknown;
    root: {
      findByProps: (props: object) => { props: { onPress: () => Promise<void> | void; disabled?: boolean } };
    };
  };
}>('react-test-renderer');

let control: ReturnType<typeof useProOffer>;
let renderer: ReturnType<typeof create> | null = null;
const prices = jest.mocked(preciosDeTienda);
const buy = jest.mocked(purchase);
const restore = jest.mocked(restorePurchases);

function Harness({ trialAvailable = false }: { trialAvailable?: boolean }) {
  control = useProOffer({ userId: 'user-test', trialAvailable });
  return createElement('View', null,
    createElement(ProOfferBody, { oferta: control, kind: 'general' }),
    createElement(ProOfferActions, { oferta: control, exitLabel: 'Seguir gratis', onExit: () => {} }),
    createElement(ProOfferLegal, { oferta: control }),
  );
}

const button = (title: string) => renderer!.root.findByProps({ title });
const content = () => JSON.stringify(renderer!.toJSON());
const mount = async (trialAvailable = false) => {
  await act(async () => { renderer = create(createElement(Harness, { trialAvailable })); });
};

beforeEach(() => {
  jest.clearAllMocks();
  prices.mockReset().mockResolvedValue({ nivl_pro_anual: '$109.99' });
  buy.mockReset().mockResolvedValue('cancelada');
  restore.mockReset().mockResolvedValue('nada');
  jest.mocked(startTrial).mockReset().mockResolvedValue({ ok: true });
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = null;
});

test('mientras carga no inventa precio ni permite comprar; después muestra el real', async () => {
  let resolve!: (value: PreciosTienda) => void;
  prices.mockReturnValue(new Promise((r) => { resolve = r; }));
  await mount();
  expect(control.catalogo).toBe('cargando');
  expect(button('Cargando precios de la tienda').props.disabled).toBe(true);
  expect(content()).not.toMatch(/99,99|€/);
  await act(async () => control.onPrincipal());
  expect(buy).not.toHaveBeenCalled();
  await act(async () => resolve({ nivl_pro_anual: '$109.99' }));
  expect(control.puedeComprar).toBe(true);
  expect(button('Activar NIVL Pro · $109.99/año').props.disabled).toBe(false);
  expect(content()).toContain('$109.99 cada año');
});

test('si falla catálogo permite restaurar y reintentar; nunca usa euros de respaldo', async () => {
  prices.mockRejectedValueOnce(new Error('network'));
  await mount();
  expect(control.catalogo).toBe('error');
  expect(button('Compra no disponible').props.disabled).toBe(true);
  expect(content()).not.toMatch(/99,99|€/);
  expect(button('Restaurar compras').props.disabled).toBe(false);
  await act(async () => button('Restaurar compras').props.onPress());
  expect(restore).toHaveBeenCalledTimes(1);
  await act(async () => button('Reintentar precios').props.onPress());
  expect(prices).toHaveBeenCalledTimes(2);
  expect(control.puedeComprar).toBe(true);
  await act(async () => control.onPrincipal());
  expect(buy).toHaveBeenCalledWith('nivl_pro_anual', '$109.99');
});

test('catálogo parcial selecciona un producto real y no recupera el fundador que falta', async () => {
  prices.mockResolvedValue({ nivl_pro_mensual: '14,99 CAD', nivl_elite_anual: '349,99 CAD' });
  await mount();
  expect(control.planId).toBe('nivl_pro_mensual');
  await act(async () => control.elegir('nivl_pro_anual'));
  expect(control.planId).toBe('nivl_pro_mensual');
  await act(async () => control.elegirNivel('elite'));
  expect(control.planId).toBe('nivl_elite_anual');
  expect(content()).not.toMatch(/249|299,00|%|meses gratis/);
  await act(async () => control.onPrincipal());
  expect(buy).toHaveBeenCalledWith('nivl_elite_anual', '349,99 CAD');
});

test('catálogo vacío bloquea compra y conserva la prueba gratuita y restauración', async () => {
  prices.mockResolvedValue({});
  await mount(true);
  expect(control.puedeComprar).toBe(false);
  expect(button('Compra no disponible').props.disabled).toBe(true);
  expect(button('Restaurar compras').props.disabled).toBe(false);
  await act(async () => button('Probar el coach 7 días').props.onPress());
  expect(startTrial).toHaveBeenCalledTimes(1);
  expect(buy).not.toHaveBeenCalled();
});

test('si cambia precio lo recarga y exige un nuevo toque; no vuelve a comprar solo', async () => {
  prices.mockResolvedValueOnce({ nivl_pro_anual: '$109.99' }).mockResolvedValue({ nivl_pro_anual: '$119.99' });
  buy.mockRejectedValueOnce(new StorePriceChangedError());
  await mount();
  await act(async () => control.onPrincipal());
  expect(prices).toHaveBeenCalledTimes(2);
  expect(buy).toHaveBeenCalledTimes(1);
  expect(button('Activar NIVL Pro · $119.99/año').props.disabled).toBe(false);
  expect(content()).toContain('$119.99 cada año');
  expect(content()).not.toContain('$109.99');
});
