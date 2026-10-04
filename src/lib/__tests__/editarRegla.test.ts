// Editar una regla del contrato sin reescribir el pasado (encargo del coordinador, fase 3).
import { reglasIncumplidas } from '../closing';
import { editarRegla } from '../contract';
import type { Rule } from '../types';
import { ErrorVisible } from '../validation';

// Supabase en memoria, solo lo que usa editarRegla.
type Fila = Record<string, unknown>;
const mockDb: { rules: Fila[]; rule_checks: Fila[]; fallarArchivar: boolean; orden: string[] } = {
  rules: [], rule_checks: [], fallarArchivar: false, orden: [],
};
jest.mock('../supabase', () => ({
  supabase: {
    from: (t: 'rules' | 'rule_checks') => ({
      insert: (fila: Fila) => ({
        select: () => ({
          single: async () => {
            const nueva = { id: `r${mockDb.rules.length + 1}`, active: true, created_at: '2026-10-10T10:00:00Z', ...fila };
            mockDb.rules.push(nueva);
            mockDb.orden.push('insert');
            return { data: nueva, error: null };
          },
        }),
      }),
      update: (cambios: Fila) => ({
        eq: async (_c: string, id: string) => {
          mockDb.orden.push('archivar');
          if (mockDb.fallarArchivar) return { error: { message: 'red' } };
          Object.assign(mockDb.rules.find((r) => r.id === id)!, cambios);
          return { error: null };
        },
      }),
      delete: () => ({
        eq: async (_c: string, id: string) => {
          mockDb.orden.push('deshacer');
          mockDb.rules = mockDb.rules.filter((r) => r.id !== id);
          return { error: null };
        },
      }),
      select: () => ({
        eq: async (_c: string, fecha: string) => ({ data: mockDb[t].filter((r) => r.date === fecha), error: null }),
      }),
      upsert: async (fila: Fila) => {
        mockDb.rule_checks.push(fila);
        return { error: null };
      },
    }),
  },
}));

const vieja: Rule = { id: 'vieja', user_id: 'u1', position: 2, text: 'Sin móvil en la cama', consequence: 'Correr 5 km', active: true, created_at: '2026-09-01T10:00:00Z' };

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 9, 10, 12, 0) });
  mockDb.rules = [{ ...vieja }];
  mockDb.rule_checks = [];
  mockDb.fallarArchivar = false;
  mockDb.orden = [];
});
afterEach(() => jest.useRealTimers());

const perfilAlDia = { id: 'u1', last_day_processed: '2026-10-09' };

test('crea la nueva (desde hoy) y archiva la vieja con su historial', async () => {
  const nueva = await editarRegla(perfilAlDia, vieja, { text: 'Sin móvil después de las 23:00' });
  expect(nueva).toMatchObject({ text: 'Sin móvil después de las 23:00', consequence: 'Correr 5 km', position: 2, active: true });
  expect(mockDb.rules.find((r) => r.id === 'vieja')!.active).toBe(false);
  expect(mockDb.orden).toEqual(['insert', 'archivar']);
});

test('si hoy ya estaba marcada, la marca pasa a la nueva', async () => {
  mockDb.rule_checks.push({ rule_id: 'vieja', date: '2026-10-10' });
  const nueva = await editarRegla(perfilAlDia, vieja, { consequence: 'Correr 3 km' });
  expect(mockDb.rule_checks).toContainEqual(expect.objectContaining({ rule_id: nueva.id, date: '2026-10-10' }));
});

test('con días pendientes de cierre no deja editar (no se libra del cobro)', async () => {
  await expect(editarRegla({ id: 'u1', last_day_processed: '2026-10-07' }, vieja, { text: 'x' })).rejects.toBeInstanceOf(ErrorVisible);
  expect(mockDb.orden).toEqual([]);
});

test('si archivar falla, se deshace la nueva y la vieja sigue vigente', async () => {
  mockDb.fallarArchivar = true;
  await expect(editarRegla(perfilAlDia, vieja, { text: 'Otra' })).rejects.toBeTruthy();
  expect(mockDb.orden).toEqual(['insert', 'archivar', 'deshacer']);
  expect(mockDb.rules.map((r) => r.id)).toEqual(['vieja']);
});

test('sin cambios no toca nada; vacía no se acepta', async () => {
  expect(await editarRegla(perfilAlDia, vieja, { text: ' Sin móvil en la cama ' })).toBe(vieja);
  await expect(editarRegla(perfilAlDia, vieja, { consequence: '  ' })).rejects.toBeInstanceOf(ErrorVisible);
  expect(mockDb.orden).toEqual([]);
});

test('el cierre no juzga una regla en días anteriores a su creación', () => {
  const r = reglasIncumplidas({
    fromDate: '2026-10-07', today: '2026-10-10',
    reglas: [{ id: 'n', text: 'Nueva', consequence: 'c', creadaEl: '2026-10-09' }],
    checksPorDia: new Map([['2026-10-01', new Set(['otra'])]]),
    freezeUntil: null, xpPorRegla: 25, topeDiario: 150,
  });
  expect(r.map((d) => d.date)).toEqual(['2026-10-09']);
});
