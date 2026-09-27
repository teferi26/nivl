import { act, createElement, type ReactElement } from 'react';
import { useConsentimientoIA } from '@/components/ConsentimientoIA';
import { aceptarConsentimiento, fetchConsentimiento } from '@/lib/consent';
import {
  AI_CONSENT_VERSION,
  crearCerrojoAceptacion,
  leerConsentimiento,
  type EstadoConsentimiento,
} from '@/lib/consentmath';

jest.mock('@/lib/consent', () => ({
  ...jest.requireActual('@/lib/consentmath'),
  fetchConsentimiento: jest.fn(),
  aceptarConsentimiento: jest.fn(),
}));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Success: 'success' },
  notificationAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/components/SystemButton', () => ({ SystemButton: () => null }));

// El renderer viene con jest-expo; este contrato mínimo evita añadir tipos
// o dependencias solo para montar el hook (la hoja no se renderiza).
const { create } = jest.requireActual<{
  create: (element: ReactElement) => { unmount: () => void };
}>('react-test-renderer');
const fetchMock = jest.mocked(fetchConsentimiento);
const aceptarMock = jest.mocked(aceptarConsentimiento);
const vigente = leerConsentimiento({ current_version: AI_CONSENT_VERSION, granted: true });
const pendiente = leerConsentimiento({ current_version: AI_CONSENT_VERSION, granted: false });

let control: ReturnType<typeof useConsentimientoIA>;
let renderer: ReturnType<typeof create> | null;

function Harness() {
  control = useConsentimientoIA();
  return null;
}

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

  // El cerrojo de la hoja se prueba sin montarla: montar el Modal y el
  // ScrollView reales carga en frío cientos de módulos de React Native dentro
  // del test (varios segundos con la suite en paralelo), y eso era lo que
  // agotaba los 5 s. La lógica es pura (consentmath.ts) y la hoja solo la usa.
  test('dos toques en aceptar guardan una sola aceptación y esperan al servidor', async () => {
    let guardar!: () => void;
    const pendienteServidor = new Promise<void>((resolve) => {
      guardar = resolve;
    });
    const acciones = {
      guardar: jest.fn(() => pendienteServidor),
      alEmpezar: jest.fn(),
      alTerminar: jest.fn(),
      alAceptar: jest.fn(),
      alFallar: jest.fn(),
    };
    const onCerrar = jest.fn();
    const cerrojo = crearCerrojoAceptacion(() => acciones);

    const primero = cerrojo.aceptar();
    const segundo = cerrojo.aceptar();
    expect(cerrojo.cerrar(onCerrar)).toBe(false);

    expect(acciones.guardar).toHaveBeenCalledTimes(1);
    expect(cerrojo.guardando).toBe(true);
    expect(acciones.alAceptar).not.toHaveBeenCalled();
    expect(onCerrar).not.toHaveBeenCalled();
    await segundo;
    expect(acciones.alAceptar).not.toHaveBeenCalled();

    guardar();
    await primero;
    expect(acciones.alAceptar).toHaveBeenCalledTimes(1);
    expect(acciones.alTerminar).toHaveBeenCalledTimes(1);
    expect(acciones.alFallar).not.toHaveBeenCalled();
    expect(cerrojo.guardando).toBe(false);
    expect(cerrojo.cerrar(onCerrar)).toBe(true);
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  test('si el servidor falla, no sigue, avisa y deja reintentar', async () => {
    const acciones = {
      guardar: jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined),
      alEmpezar: jest.fn(),
      alTerminar: jest.fn(),
      alAceptar: jest.fn(),
      alFallar: jest.fn(),
    };
    const cerrojo = crearCerrojoAceptacion(() => acciones);

    await cerrojo.aceptar();
    expect(acciones.alFallar).toHaveBeenCalledTimes(1);
    expect(acciones.alAceptar).not.toHaveBeenCalled();
    expect(cerrojo.guardando).toBe(false);

    await cerrojo.aceptar();
    expect(acciones.guardar).toHaveBeenCalledTimes(2);
    expect(acciones.alAceptar).toHaveBeenCalledTimes(1);
  });
});
