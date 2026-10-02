// Paridad del pago "un solo gesto" entre el coach y la app. La MISMA tabla
// vive en src/lib/__tests__/qa-paridad.test.ts contra links.restoDelModulo:
// si una cambia, cambia la otra.
import { assertEquals } from 'jsr:@std/assert@1';
import { restoDelModulo } from './tools.ts';

export const CASOS_PARIDAD: [base: number, pagadoMisiones: number | null, resto: number][] = [
  [15, 0, 15], [15, 10, 5], [15, 15, 0], [15, 25, 0], [15, null, 15],
  [5, 0, 5], [5, 10, 0], [50, 50, 0], [50, 25, 25], [50, 75, 0], [40, 13, 27],
];

Deno.test('restoDelModulo del coach = el de la app', () => {
  for (const [base, pagado, resto] of CASOS_PARIDAD) assertEquals(restoDelModulo(base, pagado), resto);
});
