import { equal, ok, rejects } from 'node:assert/strict';
import { frenoEdad, LINEA_FRENO } from './menores.ts';
import { COACH_KNOWLEDGE as KNOWLEDGE } from './knowledge.ts';
import { executeTool } from './tools.ts';

Deno.test('freno de edad: cuenta la edad más baja posible y sin año también frena', () => {
  equal(frenoEdad(2010, 2026), 'menor');
  equal(frenoEdad(2008, 2026), 'menor', 'nacido hace 18 años naturales puede tener 17');
  equal(frenoEdad(2007, 2026), 'libre');
  for (const v of [null, undefined, 0, 1800, 2030, 'x']) equal(frenoEdad(v, 2026), 'sin_edad', String(v));
  ok(/sin cifras de calorías/.test(LINEA_FRENO.menor) && /sin cifras de calorías/.test(LINEA_FRENO.sin_edad));
});

Deno.test('la doctrina frena a menores y fija el suelo calórico para todos', () => {
  ok(/Menores de 18 o edad sin confirmar/.test(KNOWLEDGE));
  ok(/Menos de 1\.500 kcal al día no se prescribe, sea hombre o mujer/.test(KNOWLEDGE));
  ok(!/para un hombre que entrena no se prescribe/.test(KNOWLEDGE));
});

function dbConFicha(birth_year: number | null) {
  return { rpc: async () => ({ data: true, error: null }), from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { birth_year }, error: null }) }), maybeSingle: async () => ({ data: { birth_year }, error: null }) }) }) }) } as never;
}

Deno.test('fijar_nutricion no fija calorías sin edad confirmada ni a un posible menor', async () => {
  const pedir = (birth_year: number | null) => executeTool('fijar_nutricion', { kcal: 2000, proteina_g: 120, motivo: 'prueba' }, { sb: dbConFicha(birth_year), userId: 'u1', today: '2026-11-09' });
  await rejects(() => pedir(null), /año de nacimiento/);
  await rejects(() => pedir(new Date().getUTCFullYear() - 16), /menor de edad/);
});
