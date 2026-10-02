import { act, createElement, type ReactElement } from 'react';
import { ProOfferActions, ProOfferBody, ProOfferLegal, useProOffer } from '@/components/ProOffer';
import { introsDeTienda, preciosDeTienda, purchase, restorePurchases, startTrial, StorePriceChangedError, type PreciosTienda, type ProPlanId } from '../pro';

const mockOS = { OS: 'ios' };
jest.mock('@/lib/pro', () => ({
  ...jest.requireActual('@/lib/proplans'),
  StorePriceChangedError: class extends Error {},
  purchasesAvailable: () => true,
  fetchFounderSeatsLeft: jest.fn().mockResolvedValue(10),
  preciosDeTienda: jest.fn(),
  introsDeTienda: jest.fn(),
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
  Platform: { get OS() { return mockOS.OS; } },
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

const intros = jest.mocked(introsDeTienda);

function Harness({ trialAvailable = false, planActual = null }: { trialAvailable?: boolean; planActual?: ProPlanId | null }) {
  control = useProOffer({ userId: 'user-test', trialAvailable, planActual });
  return createElement('View', null,
    createElement(ProOfferBody, { oferta: control, kind: 'general' }),
    createElement(ProOfferActions, { oferta: control, exitLabel: 'Seguir gratis', onExit: () => {} }),
    createElement(ProOfferLegal, { oferta: control }),
  );
}

const button = (title: string) => renderer!.root.findByProps({ title });
const content = () => JSON.stringify(renderer!.toJSON());
const mount = async (trialAvailable = false, planActual: ProPlanId | null = null) => {
  await act(async () => { renderer = create(createElement(Harness, { trialAvailable, planActual })); });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockOS.OS = 'ios';
  prices.mockReset().mockResolvedValue({ nivl_pro_anual: '$109.99' });
  intros.mockReset().mockResolvedValue({});
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

const CATALOGO: PreciosTienda = {
  nivl_pro_mensual: '12,99 €',
  nivl_pro_anual: '99,99 €',
  nivl_elite_mensual: '29,99 €',
  nivl_elite_anual: '299,00 €',
  nivl_elite_fundador: '249,00 €',
};

test('Apple 2.1/3.1.2: los cinco productos a la vista con título, duración y precio de la tienda', async () => {
  prices.mockResolvedValue(CATALOGO);
  await mount();
  const texto = content();
  // Antes: solo se veían los planes del nivel elegido (Pro); el Élite pedía tocar otra pestaña.
  for (const titulo of ['NIVL Pro mensual', 'NIVL Pro anual', 'NIVL Élite mensual', 'NIVL Élite anual', 'NIVL Élite fundador']) {
    expect(texto).toContain(titulo);
  }
  for (const precio of Object.values(CATALOGO)) expect(texto).toContain(precio!);
  expect(texto).toContain('Mensual · 1 mes · renovación automática');
  expect(texto).toContain('Anual · 1 año · renovación automática');
  // Términos, privacidad y (en iOS) el EULA estándar de Apple, sin desplegar nada.
  expect(texto).toContain('Términos de uso');
  expect(texto).toContain('Política de privacidad');
  expect(texto).toContain('EULA de Apple');
  // 2.3.10: en iOS la letra no nombra Google Play.
  expect(texto).not.toMatch(/Google/);
});

test('el fundador se describe como suscripción anual autorrenovable, no vitalicia', async () => {
  prices.mockResolvedValue(CATALOGO);
  await mount();
  await act(async () => control.elegir('nivl_elite_fundador'));
  expect(control.tier).toBe('elite');
  const texto = content();
  expect(texto).toContain('NIVL Élite fundador es una suscripción anual (1 año) de renovación automática: 249,00 € cada año.');
  expect(texto).toMatch(/no es un pago único ni vitalicio/);
  expect(button('Activar NIVL Élite · 249,00 €/año').props.disabled).toBe(false);
});

test('en Android no se enlaza el EULA de Apple', async () => {
  mockOS.OS = 'android';
  prices.mockResolvedValue(CATALOGO);
  await mount();
  expect(content()).not.toContain('EULA');
  expect(content()).not.toMatch(/Apple|App Store/);
  expect(content()).toContain('Google Play > Pagos y suscripciones');
  expect(content()).toContain('Términos de uso');
});

test('sin oferta introductoria en la tienda no se habla de prueba de tienda; si la hay, se declara', async () => {
  prices.mockResolvedValue(CATALOGO);
  await mount();
  expect(content()).not.toMatch(/Oferta de la tienda/);
  await act(async () => renderer!.unmount());
  intros.mockResolvedValue({ nivl_pro_anual: 'Oferta de la tienda: los primeros 1 semana gratis; después se cobra el precio indicado.' });
  await mount();
  expect(content()).toMatch(/Oferta de la tienda: los primeros 1 semana gratis/);
});

test('si no se puede saber la oferta introductoria, no se vende (catálogo en error)', async () => {
  prices.mockResolvedValue(CATALOGO);
  intros.mockRejectedValue(new Error('network'));
  await mount();
  expect(control.catalogo).toBe('error');
  expect(control.puedeComprar).toBe(false);
});

test('el plan que ya se paga se marca y no se puede volver a comprar', async () => {
  prices.mockResolvedValue(CATALOGO);
  await mount(false, 'nivl_pro_anual');
  expect(content()).toContain('Tu plan actual');
  expect(control.planId).not.toBe('nivl_pro_anual');
  await act(async () => control.elegir('nivl_pro_anual'));
  expect(control.planId).not.toBe('nivl_pro_anual');
});

test('un cambio programado para la renovación lo dice, no promete activación inmediata', async () => {
  prices.mockResolvedValue(CATALOGO);
  buy.mockResolvedValue('programada');
  await mount();
  await act(async () => control.onPrincipal());
  expect(control.aviso).toMatch(/próxima renovación/);
});

test('compra pendiente: el aviso da salida (Restaurar compras)', async () => {
  prices.mockResolvedValue(CATALOGO);
  buy.mockResolvedValue('pendiente');
  await mount();
  await act(async () => control.onPrincipal());
  expect(control.aviso).toMatch(/Restaurar compras/);
});

test('catálogo parcial avisa de que falta algún plan en vez de callarlo', async () => {
  prices.mockResolvedValue({ nivl_pro_anual: '99,99 €' });
  await mount();
  expect(content()).toMatch(/Algún plan no está disponible/);
});

test('doble toque en Activar solo lanza una compra', async () => {
  prices.mockResolvedValue(CATALOGO);
  let soltar!: (r: 'activa') => void;
  buy.mockReturnValue(new Promise((r) => { soltar = r; }));
  await mount();
  await act(async () => { void control.onPrincipal(); void control.onPrincipal(); });
  expect(buy).toHaveBeenCalledTimes(1);
  await act(async () => soltar('activa'));
});
