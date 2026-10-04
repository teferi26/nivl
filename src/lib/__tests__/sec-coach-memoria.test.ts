// Seguridad · borrar un hecho de la memoria del coach (RGPD: supresión).
// La RLS de coach_facts está probada en producción con BEGIN…ROLLBACK: A borra
// el suyo (1 fila) y no el de B (0 filas). Aquí, el cliente.

import { borrarHecho, MSG_HECHO_NO_EXISTE, MSG_MEMORIA_SIN_PERMISO } from '../coach';
import { ErrorVisible } from '../validation';

const mockSelect = jest.fn();
const mockEq = jest.fn(() => ({ select: mockSelect }));
const mockDelete = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn((_tabla: string) => ({ delete: mockDelete }));
const mockConsent = jest.fn(async () => ({ accepted: true, erasurePending: false }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('../supabase', () => ({ supabase: { from: (t: string) => mockFrom(t) } }));
jest.mock('../health', () => ({ fetchHealthConsent: () => mockConsent(), requireHealthConsent: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

test('borra por id en coach_facts y pide la fila borrada para comprobarlo', async () => {
  mockSelect.mockResolvedValue({ data: [{ id: 'f1' }], error: null });
  await borrarHecho('f1');
  expect(mockFrom).toHaveBeenCalledWith('coach_facts');
  expect(mockEq).toHaveBeenCalledWith('id', 'f1');
  expect(mockSelect).toHaveBeenCalledWith('id');
});

test('si no se borra nada (id ajeno o ya borrado), avisa en vez de fingir éxito', async () => {
  mockSelect.mockResolvedValue({ data: [], error: null });
  await expect(borrarHecho('ajeno')).rejects.toEqual(new ErrorVisible(MSG_HECHO_NO_EXISTE));
});

test('sin permiso de salud no se intenta borrar y el aviso lleva al borrado, nunca a aceptar', async () => {
  mockConsent.mockResolvedValueOnce({ accepted: false, erasurePending: true });
  await expect(borrarHecho('f1')).rejects.toEqual(new ErrorVisible(MSG_MEMORIA_SIN_PERMISO));
  expect(MSG_MEMORIA_SIN_PERMISO).not.toMatch(/activa|acepta/i);
  expect(mockFrom).not.toHaveBeenCalled();
});

test('un error del servidor se propaga (mensajeSistema lo traduce en la pantalla)', async () => {
  mockSelect.mockResolvedValue({ data: null, error: new Error('boom') });
  await expect(borrarHecho('f1')).rejects.toThrow('boom');
});
