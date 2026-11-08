import { almacenEntrenos } from '../medicion/almacen';
import type { EntrenoMedido } from '../entrenoMedido';

jest.mock('@react-native-async-storage/async-storage', () => ({ removeItem: jest.fn() }));

describe('sin almacén enchufado', () => {
  it('no dice que ha guardado: el reloj y Salud conservan lo suyo', async () => {
    await expect(almacenEntrenos().guardar('u', {} as EntrenoMedido)).resolves.toEqual({ ok: false, motivo: 'sin_almacen' });
    await expect(almacenEntrenos().listarRecientes('u', '2026-11-08')).resolves.toEqual([]);
  });
});
