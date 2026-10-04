import { act, createElement, type ReactElement } from 'react';
import { router } from 'expo-router';
import { vibrar } from '@/design/haptics';
import { AVISO_SIN_PERMISO, ProOfferActions, ProOfferBody, ProOfferLegal, ProUpsellLine, useProOffer } from '@/components/ProOffer';
import { introsDeTienda, preciosDeTienda, purchase, restorePurchases, startTrial, StorePriceChangedError, type Momento, type OfferTier, type PreciosTienda, type ProPlanId } from '../pro';

const mockOS = { OS: 'ios' };
const mockTienda = { abierta: true };
const mockPermiso = { asegurar: jest.fn(() => Promise.resolve(true)) };
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/pro', () => ({
  ...jest.requireActual('@/lib/proplans'),
  ...jest.requireActual('@/lib/paywallmoment'),
  StorePriceChangedError: class extends Error {},
  purchasesAvailable: () => mockTienda.abierta,
  fetchFounderSeatsLeft: jest.fn().mockResolvedValue(10),
  preciosDeTienda: jest.fn(),
  introsDeTienda: jest.fn(),
  purchase: jest.fn(),
  restorePurchases: jest.fn(),
  startTrial: jest.fn(),
}));
jest.mock('@/lib/data', () => ({ insertEvent: jest.fn() }));
jest.mock('@/components/ConsentimientoIA', () => ({
  useConsentimientoIA: () => ({ asegurar: () => mockPermiso.asegurar(), hoja: null }),
}));
jest.mock('react-native', () => ({
  Linking: { openURL: jest.fn().mockResolvedValue(undefined) },
  Platform: { get OS() { return mockOS.OS; } },
  Pressable: 'Pressable', Text: 'Text', View: 'View',
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('@/design/haptics', () => ({ vibrar: jest.fn() }));
jest.mock('@/components/ui', () => ({ Button: 'Button', Card: 'Card', Chip: 'Chip', Skeleton: 'Skeleton', Tag: 'Tag' }));
// ErrorSistema del kit: el mensaje y, con `onReintentar`, su botón «Reintentar».
jest.mock('@/components/arena', () => {
  const { createElement: h } = jest.requireActual<typeof import('react')>('react');
  return {
    ErrorSistema: ({ mensaje, onReintentar }: { mensaje: string; onReintentar?: () => void }) =>
      h('ErrorSistema', null, h('Text', null, mensaje), onReintentar ? h('Button', { title: 'Reintentar', onPress: onReintentar }) : null),
  };
});

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

interface HarnessProps { trialAvailable?: boolean; planActual?: ProPlanId | null; motivo?: Momento | null; initialTier?: OfferTier }
function Harness({ trialAvailable = false, planActual = null, motivo = null, initialTier }: HarnessProps) {
  control = useProOffer({ userId: 'user-test', trialAvailable, planActual, initialTier });
  return createElement('View', null,
    createElement(ProOfferBody, { oferta: control, kind: 'general', motivo }),
    createElement(ProOfferActions, { oferta: control, exitLabel: 'Seguir gratis', onExit: () => {} }),
    createElement(ProOfferLegal, { oferta: control }),
  );
}

const button = (title: string) => renderer!.root.findByProps({ title });
const content = () => JSON.stringify(renderer!.toJSON());
const mount = async (trialAvailable = false, planActual: ProPlanId | null = null, extra: Omit<HarnessProps, 'trialAvailable' | 'planActual'> = {}) => {
  await act(async () => { renderer = create(createElement(Harness, { trialAvailable, planActual, ...extra })); });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockOS.OS = 'ios';
  mockTienda.abierta = true;
  mockPermiso.asegurar.mockReset().mockResolvedValue(true);
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
  expect(button('Activar NIVL Pro anual · $109.99 al año').props.disabled).toBe(false);
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
  expect(content()).toContain('No se han podido cargar los precios de la tienda.');
  await act(async () => button('Reintentar').props.onPress());
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
  expect(button('Activar NIVL Pro anual · $119.99 al año').props.disabled).toBe(false);
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
  expect(button('Activar NIVL Élite fundador · 249,00 € al año').props.disabled).toBe(false);
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

test('compra fallida: aviso en línea y vibración de penalización', async () => {
  prices.mockResolvedValue(CATALOGO);
  buy.mockRejectedValueOnce(new Error('boom'));
  await mount();
  await act(async () => control.onPrincipal());
  expect(control.aviso).toBeTruthy();
  expect(jest.mocked(vibrar)).toHaveBeenCalledWith('penalizacion');
});

test('catálogo vacío: el error del sistema ofrece reintentar los precios', async () => {
  prices.mockResolvedValueOnce({}).mockResolvedValue(CATALOGO);
  await mount();
  expect(content()).toContain('La tienda no tiene planes de NIVL Pro disponibles ahora.');
  await act(async () => button('Reintentar').props.onPress());
  expect(prices).toHaveBeenCalledTimes(2);
  expect(control.puedeComprar).toBe(true);
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

describe('fase 2: oferta con motivo y línea de upsell', () => {
  const at = (texto: string, aguja: string) => texto.indexOf(aguja);

  test('el motivo abre con su línea de contexto y pone su beneficio primero', async () => {
    prices.mockResolvedValue(CATALOGO);
    await mount(false, null, { motivo: 'coach_profundo', initialTier: 'elite' });
    const texto = content();
    expect(control.tier).toBe('elite');
    expect(texto).toContain('El modo profundo es de NIVL Élite');
    expect(at(texto, '"Modo profundo"')).toBeGreaterThan(-1);
    expect(at(texto, '"Modo profundo"')).toBeLessThan(at(texto, '"Máxima potencia"'));
  });

  test('sin motivo, el orden de siempre y sin línea de contexto', async () => {
    prices.mockResolvedValue(CATALOGO);
    await mount(false, null, { initialTier: 'elite' });
    const texto = content();
    expect(texto).not.toContain('El modo profundo es de NIVL Élite');
    expect(at(texto, '"Máxima potencia"')).toBeLessThan(at(texto, '"Modo profundo"'));
  });

  test('con motivo siguen visibles la salida, Restaurar, Términos y Privacidad', async () => {
    prices.mockResolvedValue(CATALOGO);
    await mount(true, null, { motivo: 'primer_dia' });
    const texto = content();
    expect(button('Seguir gratis').props.disabled).toBe(false);
    expect(button('Restaurar compras').props.disabled).toBe(false);
    expect(texto).toContain('Términos de uso');
    expect(texto).toContain('Política de privacidad');
    expect(texto).toContain('Primer día en la arena');
  });

  test('el importe que se cobra es la cifra del plan: ningún equivalente mensual de un anual compite con él', async () => {
    prices.mockResolvedValue(CATALOGO);
    await mount(false, null, { motivo: 'firma' });
    const texto = content();
    expect(texto).not.toMatch(/≈|\/mes|8,33|20,75|24,92/);
    expect(button('Activar NIVL Pro anual · 99,99 € al año').props.disabled).toBe(false);
    // El plan mensual: el rótulo dice «al mes», nunca «/mes».
    await act(async () => control.elegir('nivl_pro_mensual'));
    expect(content()).not.toMatch(/≈|\/mes|8,33|20,75|24,92/);
    expect(button('Activar NIVL Pro mensual · 12,99 € al mes').props.disabled).toBe(false);
  });

  test('con la tienda cerrada tampoco: la lista de referencia no enseña equivalentes mensuales', async () => {
    mockTienda.abierta = false;
    for (const tier of ['pro', 'elite'] as const) {
      await mount(false, null, { motivo: 'firma', initialTier: tier });
      const texto = content();
      expect(texto).toContain('PRECIOS DE REFERENCIA');
      expect(texto).not.toMatch(/≈|\/mes|8,33|20,75|24,92|meses gratis/);
      expect(texto).toContain('Se cobra una vez al año');
      expect(button('Seguir gratis').props.disabled).toBe(false);
      expect(button('Avísame cuando abra').props.disabled).toBe(false);
      await act(async () => renderer!.unmount());
      renderer = null;
    }
  });

  test('voz: el contexto dice que va con el coach y no reordena beneficios', async () => {
    prices.mockResolvedValue(CATALOGO);
    await mount(false, null, { motivo: 'voz_premium' });
    expect(content()).toContain('La voz va con el coach');
  });

  test('ProUpsellLine: una fila (no modal) que lleva a /pro con motivo y nivel', async () => {
    await act(async () => { renderer = create(createElement(ProUpsellLine, { momento: 'coach_profundo', tier: 'elite' })); });
    expect(content()).toContain('El modo profundo es de NIVL Élite.');
    expect(content()).toContain('Ver NIVL Élite');
    const fila = renderer!.root.findByProps({ accessibilityRole: 'link' });
    await act(async () => fila.props.onPress());
    expect(router.push).toHaveBeenCalledWith('/pro?motivo=coach_profundo&tier=elite');
  });

  test('fase 3: las condiciones de la prueba se dicen también con la tienda cerrada', async () => {
    mockTienda.abierta = false;
    await mount(true);
    const texto = content();
    expect(texto).toContain('gratis y una sola vez por cuenta');
    expect(texto).toContain('No se renueva sola');
    expect(texto).not.toMatch(/tarjeta/);
    expect(button('Probar el coach 7 días').props.disabled).toBeFalsy();
    expect(button('Seguir gratis').props.disabled).toBe(false);
  });

  test('fase 3: mirando Élite, la prueba dice que es de Pro y sin modo profundo', async () => {
    prices.mockResolvedValue(CATALOGO);
    await mount(true, null, { initialTier: 'elite' });
    expect(content()).toContain('sin modo profundo');
    await act(async () => button('Probar Pro 7 días').props.onPress());
    expect(startTrial).toHaveBeenCalledTimes(1);
    await act(async () => control.elegirNivel('pro'));
    expect(button('Probar el coach 7 días')).toBeTruthy();
  });

  test('tienda cerrada: Términos, Privacidad y EULA (iOS) siguen a la vista; sin Restaurar ni renovación', async () => {
    mockTienda.abierta = false;
    await mount(false, null, { motivo: 'firma' });
    const texto = content();
    expect(texto).toContain('Términos de uso');
    expect(texto).toContain('Política de privacidad');
    expect(texto).toContain('EULA de Apple');
    expect(texto).not.toContain('Restaurar compras');
    expect(texto).not.toContain('renovación automática');
    const { Linking } = jest.requireMock<{ Linking: { openURL: jest.Mock } }>('react-native');
    await act(async () => renderer!.root.findByProps({ accessibilityLabel: 'Términos de uso' }).props.onPress());
    await act(async () => renderer!.root.findByProps({ accessibilityLabel: 'Política de privacidad' }).props.onPress());
    expect(Linking.openURL).toHaveBeenCalledWith('https://nivl.app/terminos');
    expect(Linking.openURL).toHaveBeenCalledWith('https://nivl.app/privacidad');
    await act(async () => renderer!.unmount());
    renderer = null;
    // En Android, con la tienda cerrada, los dos enlaces y ningún EULA de Apple.
    mockOS.OS = 'android';
    await mount(false);
    expect(content()).toContain('Términos de uso');
    expect(content()).toContain('Política de privacidad');
    expect(content()).not.toContain('EULA');
  });

  test('sin permiso de IA al comprar: aviso visible, sin cobro, y «Revisar el permiso» reabre la hoja', async () => {
    prices.mockResolvedValue(CATALOGO);
    mockPermiso.asegurar.mockResolvedValue(false);
    await mount();
    await act(async () => button('Activar NIVL Pro anual · 99,99 € al año').props.onPress());
    expect(buy).not.toHaveBeenCalled();
    expect(content()).toContain(AVISO_SIN_PERMISO);
    expect(vibrar).not.toHaveBeenCalledWith('mision');
    // Revisar y aceptar: el aviso se va y no se compra solo.
    mockPermiso.asegurar.mockResolvedValue(true);
    await act(async () => button('Revisar el permiso').props.onPress());
    expect(mockPermiso.asegurar).toHaveBeenCalledTimes(2);
    expect(content()).not.toContain(AVISO_SIN_PERMISO);
    expect(content()).not.toContain('Revisar el permiso');
    expect(buy).not.toHaveBeenCalled();
    // Con el permiso dado, la compra sigue su camino de siempre.
    await act(async () => button('Activar NIVL Pro anual · 99,99 € al año').props.onPress());
    expect(buy).toHaveBeenCalledTimes(1);
  });

  test('sin permiso de IA al probar: aviso visible, la prueba no empieza, y se puede revisar', async () => {
    prices.mockResolvedValue(CATALOGO);
    mockPermiso.asegurar.mockResolvedValue(false);
    await mount(true);
    await act(async () => button('Probar el coach 7 días').props.onPress());
    expect(startTrial).not.toHaveBeenCalled();
    expect(content()).toContain(AVISO_SIN_PERMISO);
    await act(async () => button('Revisar el permiso').props.onPress());
    expect(mockPermiso.asegurar).toHaveBeenCalledTimes(2);
    expect(content()).toContain(AVISO_SIN_PERMISO);
    expect(startTrial).not.toHaveBeenCalled();
  });

  test('fase 3: sin prueba disponible no se menciona ninguna prueba', async () => {
    prices.mockResolvedValue(CATALOGO);
    await mount(false);
    expect(content()).not.toMatch(/una sola vez por cuenta|Probar|7 días/);
  });
});

