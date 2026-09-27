import React from 'react';
import { HealthConsentGuard, HealthConsentProvider, useHealthConsent } from '../../components/ConsentimientoSalud';
import { acceptHealthConsent, fetchHealthConsent, HEALTH_CONSENT_VERSION, readHealthConsent, withdrawAndEraseHealth } from '../health';

const mockRpc = jest.fn();
const mockInvoke = jest.fn();
const mockClear = jest.fn();
const mockRemove = jest.fn();
let mockSession = { user: { id: 'owner-a' } };
let mockRealtime: () => void;
let mockActive: (state: string) => void;
jest.mock('../supabase', () => ({ supabase: {
  rpc: (...a: unknown[]) => mockRpc(...a),
  functions: { invoke: (...a: unknown[]) => mockInvoke(...a) },
  channel: () => ({ on: (_event: unknown, _filter: unknown, callback: () => void) => {
    mockRealtime = callback; return { subscribe: () => ({}) };
  } }),
  removeChannel: (...a: unknown[]) => mockRemove(...a),
} }));
jest.mock('../auth', () => ({ useAuth: () => ({ session: mockSession }) }));
jest.mock('../data', () => ({ clearEvidenceSignatures: () => mockClear() }));
jest.mock('../notifications', () => ({ cancelarAvisosSalud: jest.fn().mockResolvedValue(undefined) }));
jest.mock('expo-image', () => ({ Image: { clearMemoryCache: jest.fn().mockResolvedValue(true), clearDiskCache: jest.fn().mockResolvedValue(true) } }));
jest.mock('expo-router', () => ({ router: { canGoBack: () => false, replace: jest.fn(), push: jest.fn() } }));
jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  AppState: { addEventListener: (_name: string, callback: (s: string) => void) => { mockActive = callback; return { remove: jest.fn() }; } },
  Linking: { openURL: jest.fn() }, Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View',
  StyleSheet: { create: (s: unknown) => s },
}));
jest.mock('../../components/SystemButton', () => ({ SystemButton: 'SystemButton' }));
jest.mock('../../components/ui', () => ({ Card: 'Card', Check: 'Check', Screen: 'Screen', ScreenHeader: 'ScreenHeader', Section: 'Section', Skeleton: 'Skeleton' }));

interface Node { props: { onPress: () => void; disabled?: boolean; visible?: boolean }; }
const { create, act } = jest.requireActual<{
  create: (element: React.ReactElement) => { unmount: () => void; update: (element: React.ReactElement) => void; root: { findByProps: (p: object) => Node; findAllByProps: (p: object) => Node[] } };
  act: (fn: () => unknown) => Promise<void>;
}>('react-test-renderer');
let rendered: ReturnType<typeof create> | null;
let control: ReturnType<typeof useHealthConsent>;
const mounted = jest.fn(() => React.createElement('HealthScreen'));
function Control() { control = useHealthConsent(); return null; }
const tree = (routeName = 'gym') => React.createElement(HealthConsentProvider, null,
  React.createElement(Control), React.createElement(HealthConsentGuard, { routeName }, React.createElement(mounted)));
const state = (accepted: boolean, revision = 1) => ({ accepted, revision, version: HEALTH_CONSENT_VERSION, current_version: HEALTH_CONSENT_VERSION, erasure_pending: false });
const reply = (accepted: boolean, revision = 1) => ({ data: state(accepted, revision), error: null });
const mount = async (route?: string) => { await act(async () => { rendered = create(tree(route)); }); };
const press = async (title: string) => { await act(async () => { rendered!.root.findByProps({ title }).props.onPress(); }); };

beforeEach(() => {
  jest.clearAllMocks(); mockSession = { user: { id: 'owner-a' } };
  mockRpc.mockReset().mockResolvedValue(reply(false)); mockInvoke.mockReset();
});
afterEach(async () => { await act(async () => rendered?.unmount()); rendered = null; });

test.each([null, {}, true, { ...state(true), accepted: 'true' }, { ...state(true), version: 'old' }, { ...state(true), erasure_pending: true }])('un estado ambiguo, obsoleto o con borrado pendiente queda cerrado: %p', (value) => {
  expect(readHealthConsent(value).accepted).toBe(false);
});

test('sin permiso no se monta ni lee la pantalla; los módulos generales siguen disponibles', async () => {
  await mount(); expect(mounted).not.toHaveBeenCalled();
  await act(async () => rendered!.update(tree('(tabs)')));
  expect(mounted).toHaveBeenCalled();
});

test('sin red no abre; una comprobación vigente tras reintentar sí abre', async () => {
  mockRpc.mockRejectedValueOnce(new Error('offline'));
  await mount(); expect(mounted).not.toHaveBeenCalled();
  mockRpc.mockResolvedValueOnce(reply(true));
  await press('Volver a comprobar'); expect(mounted).toHaveBeenCalled();
});

test('aceptar requiere marcar; cancelar no escribe; el fallo de guardado no concede acceso', async () => {
  await mount(); await press('Revisar permiso');
  await press('Aceptar y activar salud'); expect(mockRpc).toHaveBeenCalledTimes(1);
  await press('Ahora no'); expect(mockRpc).toHaveBeenCalledTimes(1);
  await press('Revisar permiso');
  await act(async () => rendered!.root.findByProps({ accessibilityRole: 'checkbox' }).props.onPress());
  mockRpc.mockResolvedValueOnce({ data: { ok: false }, error: null });
  await press('Aceptar y activar salud'); expect(mounted).not.toHaveBeenCalled();
  mockRpc.mockResolvedValueOnce({ data: { ok: true }, error: null }).mockResolvedValueOnce(reply(true));
  await press('Aceptar y activar salud'); expect(mounted).toHaveBeenCalled();
  expect(mockRpc).toHaveBeenCalledWith('accept_health_consent', { p_version: HEALTH_CONSENT_VERSION });
});

test('el doble toque solo escribe una aceptación mientras la primera está pendiente', async () => {
  await mount(); await press('Revisar permiso');
  await act(async () => rendered!.root.findByProps({ accessibilityRole: 'checkbox' }).props.onPress());
  let resolve!: (r: unknown) => void;
  mockRpc.mockReturnValueOnce(new Promise(r => { resolve = r; }));
  await press('Aceptar y activar salud'); await press('Aceptar y activar salud');
  expect(mockRpc.mock.calls.filter(([name]) => name === 'accept_health_consent')).toHaveLength(1);
  mockRpc.mockResolvedValueOnce(reply(true));
  await act(async () => resolve({ data: { ok: true }, error: null }));
  expect(control.accepted).toBe(true);
});

test('retirar en otro dispositivo cierra la pantalla y limpia referencias; reaceptar la vuelve a montar', async () => {
  mockRpc.mockResolvedValueOnce(reply(true)); await mount(); const initial = mounted.mock.calls.length;
  mockRpc.mockResolvedValueOnce(reply(false, 2)); await act(async () => mockRealtime());
  expect(control.accepted).toBe(false); expect(mockClear).toHaveBeenCalled();
  expect(rendered!.root.findAllByProps({ title: 'Tu salud, con permiso' })).toHaveLength(1);
  mockRpc.mockResolvedValueOnce(reply(true, 3)); await act(async () => mockActive('active'));
  expect(mounted.mock.calls.length).toBeGreaterThan(initial);
});

test('una respuesta tardía del usuario anterior no concede permiso a la nueva sesión', async () => {
  let resolve!: (r: unknown) => void;
  mockRpc.mockReturnValueOnce(new Promise(r => { resolve = r; })); await mount();
  mockSession = { user: { id: 'owner-b' } }; await act(async () => rendered!.update(tree()));
  await act(async () => resolve(reply(true))); expect(mounted).not.toHaveBeenCalled();
});

test('desmontar cancela la suscripción y descarta una lectura pendiente', async () => {
  let resolve!: (r: unknown) => void;
  mockRpc.mockReturnValueOnce(new Promise(r => { resolve = r; })); await mount();
  await act(async () => rendered!.unmount()); rendered = null;
  await act(async () => resolve(reply(true))); expect(mockRemove).toHaveBeenCalledTimes(1); expect(mounted).not.toHaveBeenCalled();
});

test('la API no convierte errores, versión obsoleta o borrado pendiente en éxito', async () => {
  mockRpc.mockRejectedValueOnce(new Error('offline')); await expect(fetchHealthConsent()).rejects.toThrow();
  mockRpc.mockResolvedValueOnce({ data: { ok: false, reason: 'version_obsoleta' } }); await expect(acceptHealthConsent()).rejects.toThrow('Actualiza');
  mockRpc.mockResolvedValueOnce({ data: { ok: false, reason: 'borrado_pendiente' } }); await expect(acceptHealthConsent()).rejects.toThrow('borrado');
  mockInvoke.mockResolvedValueOnce({ data: { ok: false, pending: true } }); await expect(withdrawAndEraseHealth()).rejects.toThrow('no ha terminado');
  mockInvoke.mockResolvedValueOnce({ data: { ok: true }, error: null }); await expect(withdrawAndEraseHealth()).resolves.toBeUndefined();
  expect(mockInvoke).toHaveBeenCalledWith('health-erasure', { body: { confirm: 'BORRAR_SALUD_DIARIO_FOTOS_COACH' } });
});
