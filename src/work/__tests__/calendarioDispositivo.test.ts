// Lo que la OTA necesita: en un binario sin el módulo, nada se carga ni falla.
const mockNativo = { hay: false };
jest.mock('expo', () => ({ requireOptionalNativeModule: () => (mockNativo.hay ? {} : null) }));
jest.mock('expo-calendar', () => {
  throw new Error('No debe cargarse sin el módulo nativo');
});
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));
jest.mock('../datosCalendario', () => ({ borrarImportados: jest.fn(), volcarImportados: jest.fn() }));

import { calendarioDisponible, conectarCalendario, copiarAhora, leerPermiso } from '../calendarioDispositivo';

describe('sin el módulo nativo', () => {
  it('no se ofrece, no carga el paquete y nada lanza', async () => {
    expect(calendarioDisponible()).toBe(false);
    await expect(leerPermiso()).resolves.toBe('undetermined');
    await expect(conectarCalendario('u', '2026-10-21', 'x')).resolves.toBe('no_disponible');
    await expect(copiarAhora('u', '2026-10-21', 'x')).resolves.toBe(false);
  });
});
