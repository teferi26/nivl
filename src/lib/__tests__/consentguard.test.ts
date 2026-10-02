import { act, createElement, type ReactElement } from 'react';
import { useConsentimientoIA } from '@/components/ConsentimientoIA';
import { aceptarConsentimiento, fetchConsentimiento } from '@/lib/consent';
import {
  AI_CONSENT_VERSION,
  leerConsentimiento,
  TEXTO_CONSENTIMIENTO,
  type EstadoConsentimiento,
} from '@/lib/consentmath';

jest.mock('@/lib/consent', () => ({
  ...jest.requireActual('@/lib/consentmath'),
  fetchConsentimiento: jest.fn(),
  aceptarConsentimiento: jest.fn(),
}));
// Conservamos la hoja y sus callbacks reales; aislamos solo las primitivas
// nativas para que la primera pulsación no cargue Modal/ScrollView en frío.
jest.mock('react-native', () => ({
  Linking: { openURL: jest.fn().mockResolvedValue(undefined) },
  Modal: 'Modal',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Text: 'Text',
  View: 'View',
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('@/design/haptics', () => ({ vibrar: jest.fn() }));
jest.mock('@/components/SystemButton', () => ({ SystemButton: 'SystemButton' }));

// El renderer viene con jest-expo; este contrato mínimo evita añadir tipos
// o dependencias solo para montar el hook y la hoja.
const { create } = jest.requireActual<{
  create: (element: ReactElement) => {
    unmount: () => void;
    root: {
      findByProps: (props: object) => {
        props: { onPress: () => Promise<void> | void; loading?: boolean; children?: unknown };
      };
    };
  };
}>('react-test-renderer');
const fetchMock = jest.mocked(fetchConsentimiento);
const aceptarMock = jest.mocked(aceptarConsentimiento);
const vigente = leerConsentimiento({ current_version: AI_CONSENT_VERSION, granted: true });
const pendiente = leerConsentimiento({ current_version: AI_CONSENT_VERSION, granted: false });

let control: ReturnType<typeof useConsentimientoIA>;
let renderer: ReturnType<typeof create> | null;

function Harness() {
  control = useConsentimientoIA();
  return control.hoja;
}

const button = (title: string) => renderer!.root.findByProps({ title });

beforeEach(async () => {
  fetchMock.mockReset();
  aceptarMock.mockReset();
  fetchMock.mockResolvedValue(pendiente);
  await act(async () => {
    renderer = create(createElement(Harness));
  });
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = null;
});

async function iniciar() {
  let resultado!: Promise<boolean>;
  const continuar = jest.fn();
  await act(async () => {
    resultado = control.asegurar();
    void resultado.then(continuar);
  });
  return { resultado, continuar };
}

describe('el consentimiento bloquea la acción hasta comprobarlo o aceptarlo', () => {
  test('un fallo de la RPC abre la hoja y no permite continuar', async () => {
    fetchMock.mockRejectedValue(new Error('Network request failed'));
    const { resultado, continuar } = await iniciar();

    expect(control.hoja.props.visible).toBe(true);
    expect(continuar).not.toHaveBeenCalled();
    await act(async () => control.hoja.props.onCerrar());
    await expect(resultado).resolves.toBe(false);
  });

  test('sin aceptación vigente sigue pendiente hasta que el usuario decide', async () => {
    const { continuar } = await iniciar();

    expect(control.hoja.props.visible).toBe(true);
    expect(continuar).not.toHaveBeenCalled();
  });

  test('una aceptación vigente permite continuar sin abrir la hoja', async () => {
    fetchMock.mockResolvedValue(vigente);
    const { resultado } = await iniciar();

    await expect(resultado).resolves.toBe(true);
    expect(control.hoja.props.visible).toBe(false);
  });

  test('la aceptación guardada desde la hoja permite continuar', async () => {
    const { resultado } = await iniciar();

    await act(async () => control.hoja.props.onAceptado());

    await expect(resultado).resolves.toBe(true);
    expect(control.hoja.props.visible).toBe(false);
  });

  test('cancelar la hoja impide continuar', async () => {
    const { resultado } = await iniciar();

    await act(async () => control.hoja.props.onCerrar());

    await expect(resultado).resolves.toBe(false);
    expect(control.hoja.props.visible).toBe(false);
  });

  test('desmontar con la hoja abierta cancela la acción pendiente', async () => {
    const { resultado } = await iniciar();

    await act(async () => renderer?.unmount());
    renderer = null;

    await expect(resultado).resolves.toBe(false);
  });

  test.each([vigente, pendiente])('una lectura que termina tras desmontar no permite continuar (%j)', async (estado) => {
    let responder!: (estado: EstadoConsentimiento) => void;
    fetchMock.mockReturnValue(new Promise((resolve) => { responder = resolve; }));
    const { resultado } = await iniciar();

    await act(async () => renderer?.unmount());
    renderer = null;
    await act(async () => responder(estado));

    await expect(resultado).resolves.toBe(false);
  });

  test('dos toques en aceptar guardan una sola aceptación y esperan al servidor', async () => {
    let guardar!: () => void;
    aceptarMock.mockReturnValue(new Promise<void>((resolve) => {
      guardar = resolve;
    }));
    const { resultado, continuar } = await iniciar();
    const aceptar = button(TEXTO_CONSENTIMIENTO.aceptar).props.onPress;
    const cerrar = button(TEXTO_CONSENTIMIENTO.rechazar).props.onPress;
    await act(async () => {
      void aceptar();
      void aceptar();
      void cerrar();
    });

    expect(aceptarMock).toHaveBeenCalledTimes(1);
    expect(button(TEXTO_CONSENTIMIENTO.aceptar).props.loading).toBe(true);
    expect(continuar).not.toHaveBeenCalled();
    expect(control.hoja.props.visible).toBe(true);
    await act(async () => guardar());
    await expect(resultado).resolves.toBe(true);
    expect(button(TEXTO_CONSENTIMIENTO.aceptar).props.loading).toBe(false);
    expect(control.hoja.props.visible).toBe(false);
  });

  test('si el servidor falla, no sigue, avisa y deja reintentar', async () => {
    aceptarMock.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    const { resultado, continuar } = await iniciar();

    await act(async () => button(TEXTO_CONSENTIMIENTO.aceptar).props.onPress());
    expect(renderer!.root.findByProps({ accessibilityRole: 'alert' }).props.children).toEqual(expect.any(String));
    expect(continuar).not.toHaveBeenCalled();
    expect(button(TEXTO_CONSENTIMIENTO.aceptar).props.loading).toBe(false);
    expect(control.hoja.props.visible).toBe(true);

    await act(async () => button(TEXTO_CONSENTIMIENTO.aceptar).props.onPress());
    expect(aceptarMock).toHaveBeenCalledTimes(2);
    await expect(resultado).resolves.toBe(true);
    expect(control.hoja.props.visible).toBe(false);
  });
});
