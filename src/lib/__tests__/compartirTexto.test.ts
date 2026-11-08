import { Clipboard, Platform, Share } from 'react-native';
import { compartirTexto } from '../compartirTexto';

const originalOS = Platform.OS;
const nav = globalThis as unknown as { navigator?: { share?: unknown; clipboard?: unknown } };
const originalNav = nav.navigator;

function web(navigatorFalso: { share?: unknown; clipboard?: unknown }) {
  Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: navigatorFalso, configurable: true, writable: true });
}

afterEach(() => {
  jest.restoreAllMocks();
  Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: originalNav, configurable: true, writable: true });
});

test('en nativo sigue siendo la hoja del sistema', async () => {
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  await expect(compartirTexto('hola', 7)).resolves.toBe('compartido');
  expect(share).toHaveBeenCalledWith({ message: 'hola' }, { anchor: 7 });
});

test('web con hoja: la usa', async () => {
  const share = jest.fn().mockResolvedValue(undefined);
  web({ share });
  await expect(compartirTexto('hola')).resolves.toBe('compartido');
  expect(share).toHaveBeenCalledWith({ text: 'hola' });
});

test('web: cerrar la hoja no es un error ni copia nada', async () => {
  const writeText = jest.fn();
  web({ share: jest.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })), clipboard: { writeText } });
  await expect(compartirTexto('hola')).resolves.toBe('cancelado');
  expect(writeText).not.toHaveBeenCalled();
});

test('web sin hoja (Firefox): copia el texto', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  web({ clipboard: { writeText } });
  await expect(compartirTexto('hola')).resolves.toBe('copiado');
  expect(writeText).toHaveBeenCalledWith('hola');
});

test('web con la hoja bloqueada: también copia', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  web({ share: jest.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' })), clipboard: { writeText } });
  await expect(compartirTexto('hola')).resolves.toBe('copiado');
});

test('web sin portapapeles moderno: cae a la vía antigua y dice si ha podido', async () => {
  web({});
  const setString = jest.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
  (Clipboard as unknown as { setString: unknown }).setString = setString;
  await expect(compartirTexto('hola')).resolves.toBe('copiado');
  await expect(compartirTexto('hola')).resolves.toBe('imposible');
});
