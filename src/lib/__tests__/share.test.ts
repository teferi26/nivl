import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { __soltarCerrojo, compartirTarjeta, type PeticionCompartir } from '../share';
import { OPCIONES_POR_DEFECTO, type Tarjeta } from '../sharecard';
import { ErrorVisible } from '../validation';

const mockDelete = jest.fn();
const mockExists = { value: true };
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => ({
    uri,
    get exists() {
      return mockExists.value;
    },
    delete: mockDelete,
  })),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn().mockResolvedValue('file:///tmp/tarjeta.png') }));
jest.mock('../supabase', () => ({ supabase: {} }));

const vista = { current: null };
const base: PeticionCompartir = { tarjeta: { tipo: 'racha', dias: 7 }, formato: 'stories', opciones: OPCIONES_POR_DEFECTO, vista };
const progreso: Tarjeta = {
  tipo: 'antesDespues',
  antes: { uri: 'file:///a.jpg', fecha: '2026-07-01' },
  despues: { uri: 'file:///b.jpg', fecha: '2026-10-01' },
};
const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  mockExists.value = true;
  __soltarCerrojo();
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
});
afterAll(() => Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true }));

test('captura a los píxeles exactos del formato, comparte y borra el temporal', async () => {
  await expect(compartirTarjeta({ ...base, formato: 'post' })).resolves.toBe('compartida');
  expect(captureRef).toHaveBeenCalledWith(vista, expect.objectContaining({ format: 'png', width: 1080, height: 1350, result: 'tmpfile' }));
  expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///tmp/tarjeta.png', expect.objectContaining({ mimeType: 'image/png', UTI: 'public.png' }));
  expect(mockDelete).toHaveBeenCalledTimes(1);
});

test('con fotos permitidas sale en JPG 0,9', async () => {
  await compartirTarjeta({ ...base, tarjeta: progreso, opciones: { ...OPCIONES_POR_DEFECTO, mostrarFotos: true } });
  expect(captureRef).toHaveBeenCalledWith(vista, expect.objectContaining({ format: 'jpg', quality: 0.9, width: 1080, height: 1920 }));
  expect(Sharing.shareAsync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ mimeType: 'image/jpeg' }));
});

test('antes/después sin permiso de fotos: error visible y sin capturar nada', async () => {
  await expect(compartirTarjeta({ ...base, tarjeta: progreso })).rejects.toBeInstanceOf(ErrorVisible);
  expect(captureRef).not.toHaveBeenCalled();
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
});

test('en iPad pasa el ancla del botón', async () => {
  const ancla = { x: 10, y: 20, width: 100, height: 44 };
  await compartirTarjeta({ ...base, ancla });
  expect(Sharing.shareAsync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ anchor: ancla }));
});

test('si la hoja falla, el temporal se borra igual y el error sube', async () => {
  jest.mocked(Sharing.shareAsync).mockRejectedValueOnce(new Error('cancelada'));
  await expect(compartirTarjeta(base)).rejects.toThrow('cancelada');
  expect(mockDelete).toHaveBeenCalledTimes(1);
  // Y el cerrojo queda libre.
  await expect(compartirTarjeta(base)).resolves.toBe('compartida');
});

test('un doble toque no abre dos hojas', async () => {
  let soltar: () => void = () => undefined;
  jest.mocked(Sharing.shareAsync).mockImplementationOnce(() => new Promise<void>((r) => (soltar = r)));
  const primera = compartirTarjeta(base);
  await new Promise((r) => setTimeout(r, 0));
  await expect(compartirTarjeta(base)).resolves.toBe('ocupado');
  soltar();
  await expect(primera).resolves.toBe('compartida');
  expect(Sharing.shareAsync).toHaveBeenCalledTimes(1);
});

test('sin hoja de compartir, comparte solo el texto con el enlace', async () => {
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValueOnce(false);
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
  await expect(compartirTarjeta({ ...base, codigoAmigo: 'ABCD2345', opciones: { ...OPCIONES_POR_DEFECTO, incluirInvitacion: true } })).resolves.toBe('solo-texto');
  expect(share).toHaveBeenCalledWith({ message: expect.stringContaining('/c/ABCD2345') });
  expect(captureRef).not.toHaveBeenCalled();
  expect(mockDelete).not.toHaveBeenCalled();
});

test('en web no usa la hoja nativa ni borra archivos', async () => {
  Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
  await expect(compartirTarjeta(base)).resolves.toBe('solo-texto');
  expect(Sharing.isAvailableAsync).not.toHaveBeenCalled();
  expect(share).toHaveBeenCalled();
});

test('un temporal que no se puede borrar no rompe el compartir', async () => {
  mockDelete.mockImplementationOnce(() => {
    throw new Error('EPERM');
  });
  await expect(compartirTarjeta(base)).resolves.toBe('compartida');
});
