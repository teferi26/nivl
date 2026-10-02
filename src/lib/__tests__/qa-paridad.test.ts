// Paridad del pago "un solo gesto" entre la app y el coach. La MISMA tabla
// está en supabase/functions/_shared/tools_paridad_test.ts (propuesta en
// docs/qa-audit/propuestas/) contra el restoDelModulo del espejo Deno.

import { restoDelModulo } from '../links';

jest.mock('../supabase', () => ({ supabase: {} }));

const CASOS_PARIDAD: [base: number, pagadoMisiones: number | null, resto: number][] = [
  [15, 0, 15], [15, 10, 5], [15, 15, 0], [15, 25, 0], [15, null, 15],
  [5, 0, 5], [5, 10, 0], [50, 50, 0], [50, 25, 25], [50, 75, 0], [40, 13, 27],
];

test.each(CASOS_PARIDAD)('base %i, misiones %p → módulo %i', (base, pagado, resto) => {
  expect(restoDelModulo(base, pagado === null ? null : { xpMisiones: pagado })).toBe(resto);
});
