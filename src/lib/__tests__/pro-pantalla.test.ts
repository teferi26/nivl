// La pantalla /pro: a quien ya paga nunca se le vende por un fallo de red, y
// con la oferta abierta solo hay una inversión (la acción de la oferta).
import { act, createElement, type ReactElement } from 'react';
import Pro from '@/app/pro';
import { vibrar } from '@/design/haptics';
import { SIN_IA, type AiStatus } from '../proplans';
import { fetchAiStatus, gestionarSuscripcion } from '../pro';
import { fetchSubscription } from '../subscription';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true, push: jest.fn() },
    useLocalSearchParams: () => ({}),
    useFocusEffect: (cb: () => void) => useEffect(() => cb(), [cb]),
  };
});
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Text: 'Text',
  View: 'View',
  StyleSheet: { create: (s: unknown) => s },
}));
jest.mock('@/components/ProOffer', () => ({ ProOffer: 'ProOffer' }));
jest.mock('@/components/arena', () => {
  const { createElement: h } = jest.requireActual<typeof import('react')>('react');
  return {
    Barra: 'Barra',
    CargaArena: 'CargaArena',
    EncabezadoArena: 'EncabezadoArena',
    Entrada: 'Entrada',
    TarjetaArena: 'TarjetaArena',
    ErrorSistema: ({ mensaje, onReintentar }: { mensaje: string; onReintentar?: () => void }) =>
      h('ErrorSistema', null, h('Text', null, mensaje), onReintentar ? h('Button', { title: 'Reintentar', onPress: onReintentar }) : null),
  };
});
jest.mock('@/components/ui', () => ({ Button: 'Button', Row: 'Row', Screen: 'Screen', Section: 'Section' }));
jest.mock('@/design/haptics', () => ({ vibrar: jest.fn() }));
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ session: { user: { id: 'user-test' } } }) }));
jest.mock('@/lib/data', () => ({ ensureProfile: jest.fn().mockResolvedValue({ profile_kind: 'general' }) }));
jest.mock('@/lib/dates', () => ({ isValidKey: () => false, nombreDia: () => '' }));
jest.mock('@/lib/subscription', () => ({ fetchSubscription: jest.fn() }));
jest.mock('@/lib/validation', () => ({ mensajeSistema: () => 'Sin conexión.' }));
jest.mock('@/lib/pro', () => ({
  ...jest.requireActual('@/lib/proplans'),
  ...jest.requireActual('@/lib/paywallmoment'),
  anotarOferta: jest.fn().mockResolvedValue(undefined),
  fetchAiStatus: jest.fn(),
  gestionarSuscripcion: jest.fn(),
  purchasesAvailable: () => true,
}));

interface Nodo {
  type: string;
  props: Record<string, unknown> & { onPress?: () => unknown; variant?: string; title?: string };
}
const { create } = jest.requireActual<{
  create: (element: ReactElement) => {
    unmount: () => void;
    toJSON: () => unknown;
    root: { findAllByType: (t: string) => Nodo[]; findAll: (f: (n: Nodo) => boolean) => Nodo[] };
  };
}>('react-test-renderer');

const estado = jest.mocked(fetchAiStatus);
const suscripcion = jest.mocked(fetchSubscription);
const PRO_TIENDA: AiStatus = { ...SIN_IA, entitled: true, tier: 'pro', plan: 'pro_anual', budget: 100, spent: 10, remaining: 90 };

let r: ReturnType<typeof create> | null = null;
const montar = async () => {
  await act(async () => {
    r = create(createElement(Pro));
  });
};
// Las props con elementos (`trailing`) llevan `_owner`, que es circular.
const texto = () => JSON.stringify(r!.toJSON(), (k, v: unknown) => (k === '_owner' || k === '_store' ? undefined : v));
const boton = (title: string) => r!.root.findAll((n) => n.type === 'Button' && n.props.title === title)[0];
const primarios = () => r!.root.findAll((n) => n.type === 'Button' && (n.props.variant ?? 'primary') === 'primary');

beforeEach(() => {
  jest.clearAllMocks();
  suscripcion.mockResolvedValue({ current_period_end: null, provider: 'apple' } as never);
});
afterEach(async () => {
  await act(async () => r?.unmount());
  r = null;
});

test('sin poder leer el estado: error con Reintentar y salida, nunca la oferta', async () => {
  estado.mockRejectedValueOnce(new Error('network')).mockResolvedValue(PRO_TIENDA);
  await montar();
  expect(texto()).toContain('No se ha podido comprobar tu plan.');
  expect(r!.root.findAllByType('ProOffer')).toHaveLength(0);
  expect(boton('Volver')).toBeTruthy();
  await act(async () => {
    await boton('Reintentar').props.onPress!();
  });
  expect(estado).toHaveBeenCalledTimes(2);
  expect(texto()).not.toContain('No se ha podido comprobar tu plan.');
  expect(texto()).toContain('El coach está contigo.');
});

test('con el estado leído y sin coach, la oferta se pinta sin error', async () => {
  estado.mockResolvedValue({ ...SIN_IA });
  await montar();
  expect(r!.root.findAllByType('ProOffer')).toHaveLength(1);
  expect(texto()).not.toContain('No se ha podido comprobar tu plan.');
});

test('una sola inversión: con la oferta abierta, «Hablar con el coach» pasa a secondary', async () => {
  estado.mockResolvedValue(PRO_TIENDA);
  await montar();
  expect(boton('Hablar con el coach').props.variant).toBe('primary');
  await act(async () => {
    boton('Ver NIVL Élite').props.onPress!();
  });
  expect(r!.root.findAllByType('ProOffer')).toHaveLength(1);
  expect(boton('Hablar con el coach').props.variant).toBe('secondary');
  expect(primarios()).toHaveLength(0);
});

test('gestionar falla: aviso en línea y vibración de penalización', async () => {
  estado.mockResolvedValue(PRO_TIENDA);
  jest.mocked(gestionarSuscripcion).mockRejectedValueOnce(new Error('x'));
  await montar();
  const gestionar = boton('Gestionar o cancelar suscripción');
  expect(gestionar.props.size).toBe('md');
  await act(async () => {
    await gestionar.props.onPress!();
  });
  expect(vibrar).toHaveBeenCalledWith('penalizacion');
  expect(texto()).toContain('Sin conexión.');
});
