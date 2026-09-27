import React from 'react';
import { EdadMinimaGuard, EdadMinimaProvider } from '../../components/EdadMinima';
import { confirmarEdad, fetchEdadConfirmada } from '../age';

const mockRpc = jest.fn();
const mockSignOut = jest.fn();
let mockSession: { user: { id: string } } | null = { user: { id: 'usuario-a' } };
let mockLoading = false;
jest.mock('../supabase', () => ({ supabase: { rpc: (...args: unknown[]) => mockRpc(...args), auth: { signOut: (...args: unknown[]) => mockSignOut(...args) } } }));
jest.mock('../auth', () => ({ useAuth: () => ({ session: mockSession, loading: mockLoading }) }));
jest.mock('../../components/SystemButton', () => ({ SystemButton: 'SystemButton' }));
jest.mock('../../components/ui', () => ({ Screen: 'Screen', ScreenHeader: 'ScreenHeader', Card: 'Card', Check: 'Check', Skeleton: 'Skeleton' }));

// jest-expo ya incluye el renderer de la versión de React instalada.
// Contrato mínimo del renderer, sin añadir sus tipos como dependencia.
interface Nodo {
  props: Record<string, any>;
}
const { create, act } = jest.requireActual<{
  create: (element: React.ReactElement) => {
    unmount: () => void;
    update: (element: React.ReactElement) => void;
    root: { findByProps: (props: object) => Nodo; findAllByProps: (props: object) => Nodo[] };
  };
  act: (fn: () => unknown) => Promise<void>;
}>('react-test-renderer');
let rendered: ReturnType<typeof create>;
const privateMount = jest.fn(() => React.createElement('PrivateScreen'));
const tree = (routeName = '(tabs)') => React.createElement(
  EdadMinimaProvider,
  null,
  React.createElement(EdadMinimaGuard, { routeName }, React.createElement(privateMount)),
);
const mount = async (routeName?: string) => {
  await act(async () => { rendered = create(tree(routeName)); });
};
const button = (title: string) => rendered.root.findByProps({ title });
const press = async (title: string) => {
  await act(async () => { button(title).props.onPress(); });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSession = { user: { id: 'usuario-a' } };
  mockLoading = false;
  mockRpc.mockReset().mockResolvedValue({ data: false, error: null });
  mockSignOut.mockResolvedValue({ error: null });
});
afterEach(async () => { if (rendered) await act(async () => rendered.unmount()); });

test('una cuenta existente sin confirmación no monta pantallas privadas ni permite confirmar sin marcar', async () => {
  await mount();
  expect(privateMount).not.toHaveBeenCalled();
  expect(button('Confirmar y continuar').props.disabled).toBe(true);
  await press('Confirmar y continuar');
  expect(mockRpc).toHaveBeenCalledTimes(1);
});

test.each(['login', 'c', 'c/[code]'])('la ruta pública %s sigue funcionando durante la comprobación', async (route) => {
  mockRpc.mockReturnValue(new Promise(() => {}));
  await mount(route);
  expect(privateMount).toHaveBeenCalled();
});

test('cargar o fallar la lectura mantiene cerrado el acceso; se puede reintentar', async () => {
  let reply!: (value: unknown) => void;
  mockRpc.mockReturnValueOnce(new Promise((resolve) => { reply = resolve; }));
  await mount();
  expect(privateMount).not.toHaveBeenCalled();
  await act(async () => reply({ data: null, error: new Error('offline') }));
  expect(privateMount).not.toHaveBeenCalled();
  mockRpc.mockResolvedValueOnce({ data: true, error: null });
  await press('Volver a comprobar');
  expect(privateMount).toHaveBeenCalled();
});

test('un fallo al guardar no abre; solo la confirmación persistida permite montar la pantalla', async () => {
  await mount();
  await act(async () => rendered.root.findAllByProps({ accessibilityRole: 'checkbox' })[0].props.onPress());
  mockRpc.mockResolvedValueOnce({ data: null, error: new Error('offline') });
  await press('Confirmar y continuar');
  expect(privateMount).not.toHaveBeenCalled();
  mockRpc.mockResolvedValueOnce({ data: true, error: null });
  await press('Confirmar y continuar');
  expect(mockRpc).toHaveBeenLastCalledWith('confirm_minimum_age', { p_min_age: 16 });
  expect(privateMount).toHaveBeenCalled();
});

test('una cuenta que ya confirmó entra sin repetir la pregunta', async () => {
  mockRpc.mockResolvedValueOnce({ data: true, error: null });
  await mount('gym');
  expect(privateMount).toHaveBeenCalled();
  expect(rendered.root.findAllByProps({ title: 'Confirmar y continuar' })).toHaveLength(0);
});

test('una lectura de la cuenta anterior que termina tarde no abre la nueva cuenta', async () => {
  let previousReply!: (value: unknown) => void;
  mockRpc.mockReturnValueOnce(new Promise((resolve) => { previousReply = resolve; }));
  await mount();
  mockSession = { user: { id: 'usuario-b' } };
  await act(async () => rendered.update(tree()));
  await act(async () => previousReply({ data: true, error: null }));
  expect(privateMount).not.toHaveBeenCalled();
  expect(button('Confirmar y continuar').props.disabled).toBe(true);
});

test('cerrar sesión está disponible incluso si la comprobación no termina', async () => {
  mockRpc.mockReturnValue(new Promise(() => {}));
  await mount();
  await press('Cerrar sesión');
  expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  expect(privateMount).not.toHaveBeenCalled();
});

test('una sesión que aún está cargando no monta una pantalla privada', async () => {
  mockLoading = true;
  mockSession = null;
  await mount();
  expect(privateMount).not.toHaveBeenCalled();
  expect(mockRpc).not.toHaveBeenCalled();
});

test('las respuestas vacías o ambiguas de las RPC no cuentan como confirmación', async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: null });
  await expect(fetchEdadConfirmada()).rejects.toThrow();
  mockRpc.mockResolvedValueOnce({ data: 'true', error: null });
  await expect(confirmarEdad()).rejects.toThrow();
});
