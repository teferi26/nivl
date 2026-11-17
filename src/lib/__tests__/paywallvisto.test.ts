// `paywall_visto` en la oferta por modos: qué motivo se apunta (puro) y que el
// hook lo apunta una sola vez, solo con la oferta en pantalla y solo cuando la
// tienda ya ha dicho si hay prueba.
import { act, createElement, type ReactElement } from 'react';
import { useOfertaModos, type OpcionesOfertaModos } from '@/components/modos/pago/useOfertaModos';
import { registrar } from '../analitica';
import { CODIGO_RE, limpiarProps } from '../analiticamath';
import { LO_VISTO, loVisto, motivoVisto, ORIGENES_OFERTA, propsPaywallVisto } from '../paywallvisto';
import { preciosModosDeTienda, pruebasModosDeTienda, purchasesAvailable } from '../pro';

jest.mock('react-native', () => ({ Platform: { OS: 'ios' }, Linking: { openURL: jest.fn() } }));
jest.mock('@/components/ConsentimientoIA', () => ({ useConsentimientoIA: () => ({ asegurar: async () => true, hoja: null }) }));
jest.mock('@/components/ui/confirmar', () => ({ avisar: jest.fn() }));
jest.mock('@/design/haptics', () => ({ vibrar: jest.fn() }));
jest.mock('@/i18n', () => ({ t: (k: string) => k }));
jest.mock('@/lib/analitica', () => ({ registrar: jest.fn() }));
jest.mock('@/lib/validation', () => ({ mensajeSistema: () => 'Sin conexión.' }));
jest.mock('@/lib/pro', () => ({
  ...jest.requireActual('@/lib/planesmodo'),
  precioVisible: (p: string | null | undefined) => p ?? null,
  preciosModosDeTienda: jest.fn(),
  pruebasModosDeTienda: jest.fn(),
  purchaseModo: jest.fn(),
  purchasesAvailable: jest.fn(),
  restorePurchases: jest.fn(),
  StorePriceChangedError: class extends Error {},
}));

describe('el motivo (puro)', () => {
  const base = { disponible: true, catalogo: 'listo' as const, conPrueba: true };

  test('mientras la tienda carga no se apunta nada', () => {
    expect(loVisto({ ...base, catalogo: 'cargando' })).toBeNull();
    expect(propsPaywallVisto('onboarding', { ...base, catalogo: 'cargando' })).toBeNull();
  });

  test('lo que se ve: con prueba, sin ella, sin precios y sin tienda', () => {
    expect(loVisto(base)).toBe('prueba');
    expect(loVisto({ ...base, conPrueba: false })).toBe('sin_prueba');
    expect(loVisto({ ...base, catalogo: 'error' })).toBe('sin_precio');
    // Sin tienda el catálogo se queda en «cargando» para siempre: no se espera.
    expect(loVisto({ disponible: false, catalogo: 'cargando', conPrueba: false })).toBe('sin_tienda');
  });

  test('solo el cuestionario de entrada es «compacto»', () => {
    expect(propsPaywallVisto('onboarding', base)).toEqual({ motivo: 'onboarding_prueba', compacto: true });
    expect(propsPaywallVisto('pro', base)).toEqual({ motivo: 'pro_prueba', compacto: false });
    expect(propsPaywallVisto('mundo', { ...base, conPrueba: false })).toEqual({ motivo: 'mundo_sin_prueba', compacto: false });
  });

  test('todos los motivos pasan la lista blanca del evento (y la del servidor, que es la misma)', () => {
    for (const origen of ORIGENES_OFERTA) {
      for (const visto of LO_VISTO) {
        const motivo = motivoVisto(origen, visto);
        expect(motivo).toMatch(CODIGO_RE);
        expect(limpiarProps('paywall_visto', { motivo, compacto: origen === 'onboarding' })).toEqual({
          motivo,
          compacto: origen === 'onboarding',
        });
      }
    }
  });
});

describe('el hook lo apunta', () => {
  const { create } = jest.requireActual<{
    create: (element: ReactElement) => { unmount: () => void; update: (element: ReactElement) => void };
  }>('react-test-renderer');
  const precios = jest.mocked(preciosModosDeTienda);
  const pruebas = jest.mocked(pruebasModosDeTienda);
  const apuntado = jest.mocked(registrar);
  const tienda = jest.mocked(purchasesAvailable);

  let ultimo: ReturnType<typeof useOfertaModos> | null = null;
  function Sonda(props: OpcionesOfertaModos) {
    ultimo = useOfertaModos(props);
    return null;
  }
  let r: ReturnType<typeof create> | null = null;
  const montar = async (props: OpcionesOfertaModos) => {
    await act(async () => {
      r = create(createElement(Sonda, props));
    });
  };
  const cambiar = async (props: OpcionesOfertaModos) => {
    await act(async () => {
      r!.update(createElement(Sonda, props));
    });
  };
  const vistos = () => apuntado.mock.calls.filter(([evento]) => evento === 'paywall_visto').map(([, props]) => props);

  beforeEach(() => {
    jest.clearAllMocks();
    tienda.mockReturnValue(true);
    precios.mockResolvedValue({ nivl_todos_anual: '99,99 €', nivl_todos_mensual: '29,99 €' });
    pruebas.mockResolvedValue({ nivl_todos_anual: '7 días' });
  });
  afterEach(async () => {
    await act(async () => r?.unmount());
    r = null;
    ultimo = null;
  });

  test('en el cuestionario de entrada: nada hasta llegar al paso de la oferta, y entonces una vez', async () => {
    await montar({ origen: 'onboarding', visible: false });
    expect(vistos()).toEqual([]);
    await cambiar({ origen: 'onboarding', visible: true });
    expect(vistos()).toEqual([{ motivo: 'onboarding_prueba', compacto: true }]);
    // Cambiar de periodo o volver a pintar no lo repite.
    await act(async () => ultimo!.onPeriodo('mensual'));
    await cambiar({ origen: 'onboarding', visible: true });
    expect(vistos()).toHaveLength(1);
  });

  test('cuenta sin prueba (o elegibilidad sin confirmar): se apunta que no la vio', async () => {
    pruebas.mockResolvedValue({});
    await montar({ origen: 'pro' });
    expect(vistos()).toEqual([{ motivo: 'pro_sin_prueba', compacto: false }]);
  });

  test('la tienda no da productos: sin precio, y reintentar no lo apunta otra vez', async () => {
    precios.mockResolvedValue({});
    pruebas.mockResolvedValue({});
    await montar({ origen: 'mundo' });
    expect(vistos()).toEqual([{ motivo: 'mundo_sin_precio', compacto: false }]);
    precios.mockResolvedValue({ nivl_todos_anual: '99,99 €' });
    await act(async () => ultimo!.onReintentar());
    expect(ultimo!.catalogo).toBe('listo');
    expect(vistos()).toHaveLength(1);
  });

  test('la tienda falla al cargar: sin precio', async () => {
    precios.mockRejectedValue(new Error('network'));
    await montar({ origen: 'onboarding' });
    expect(vistos()).toEqual([{ motivo: 'onboarding_sin_precio', compacto: true }]);
  });

  test('sin tienda en la build: se apunta sin esperar al catálogo', async () => {
    tienda.mockReturnValue(false);
    await montar({ origen: 'pro' });
    expect(precios).not.toHaveBeenCalled();
    expect(vistos()).toEqual([{ motivo: 'pro_sin_tienda', compacto: false }]);
  });

  test('sin origen (web, galería) no se apunta nada', async () => {
    await montar({});
    expect(vistos()).toEqual([]);
  });
});
