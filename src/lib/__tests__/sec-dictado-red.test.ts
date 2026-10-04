// Seguridad · el permiso de dictar por la red es de una cuenta (auditoría 1.0.8, P1).
// Antes se guardaba '1' en el móvil y la cuenta siguiente lo heredaba: su voz
// salía a Apple o Google sin haber visto el aviso.

import { aceptarRed, CLAVE_RED_DICTADO, olvidarRedDictado, redAceptada } from '@/components/coach/redDictado';

const mockAlmacen = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => mockAlmacen.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => { mockAlmacen.set(k, v); }),
    removeItem: jest.fn(async (k: string) => { mockAlmacen.delete(k); }),
  },
}));
let mockUid: string | null = 'cuenta-a';
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: mockUid ? { user: { id: mockUid } } : null } }) } },
}));

beforeEach(async () => {
  mockAlmacen.clear();
  mockUid = 'cuenta-a';
  await olvidarRedDictado();
});

test('A acepta; B entra en el mismo móvil y NO hereda el permiso', async () => {
  await aceptarRed();
  expect(await redAceptada()).toBe(true);
  mockUid = 'cuenta-b';
  expect(await redAceptada()).toBe(false);
  mockUid = 'cuenta-a';
  expect(await redAceptada()).toBe(true);
});

test('el valor «1» de la 1.0.8 no vale para nadie: se vuelve a preguntar', async () => {
  mockAlmacen.set(CLAVE_RED_DICTADO, '1');
  expect(await redAceptada()).toBe(false);
});

test('sin sesión no hay permiso ni se guarda nada', async () => {
  mockUid = null;
  await aceptarRed();
  expect(await redAceptada()).toBe(false);
  expect(mockAlmacen.has(CLAVE_RED_DICTADO)).toBe(false);
});

test('olvidarRedDictado (cerrarSesion) borra el permiso y la caché', async () => {
  await aceptarRed();
  await olvidarRedDictado();
  expect(mockAlmacen.has(CLAVE_RED_DICTADO)).toBe(false);
  expect(await redAceptada()).toBe(false);
});
