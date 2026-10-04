// Seguridad · borrar un hecho de la memoria del coach (RGPD: supresión).
// La RLS de coach_facts está probada en producción con BEGIN…ROLLBACK: A borra
// el suyo (1 fila) y no el de B (0 filas). Aquí, el cliente.

import { borrarHecho, MSG_HECHO_NO_EXISTE } from '../coach';
import { ErrorVisible } from '../validation';

const mockSelect = jest.fn();
const mockEq = jest.fn(() => ({ select: mockSelect }));
const mockDelete = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn((_tabla: string) => ({ delete: mockDelete }));
const mockRequireHealth = jest.fn(async () => undefined);
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('../supabase', () => ({ supabase: { from: (t: string) => mockFrom(t) } }));
jest.mock('../health', () => ({ requireHealthConsent: () => mockRequireHealth() }));

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

test('sin permiso de salud no se intenta borrar (la RLS lo bloquearía en silencio)', async () => {
  mockRequireHealth.mockRejectedValueOnce(new ErrorVisible('Activa el permiso de salud'));
  await expect(borrarHecho('f1')).rejects.toBeInstanceOf(ErrorVisible);
  expect(mockFrom).not.toHaveBeenCalled();
});

test('un error del servidor se propaga (mensajeSistema lo traduce en la pantalla)', async () => {
  mockSelect.mockResolvedValue({ data: null, error: new Error('boom') });
  await expect(borrarHecho('f1')).rejects.toThrow('boom');
});
