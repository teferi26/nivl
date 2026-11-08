// NIVL · WORK: la misma tabla que pasa el espejo del coach (supabase/functions/_shared/trabajo_test.ts).
// Si esto falla tras tocar ahora.ts o carga.ts, toca también _shared/trabajo.ts y regenera la tabla.
import { elegirAhora, type Ahora, type EntradaAhora } from '@/work/ahora';
import { calcularCarga, type Carga, type EntradaCarga } from '@/work/carga';

const tabla = require('../../../supabase/functions/_shared/trabajo_paridad.json') as {
  ahora: { nombre: string; entrada: EntradaAhora; espera: Ahora }[];
  carga: { nombre: string; entrada: EntradaCarga; espera: Carga }[];
};

describe('paridad con el coach', () => {
  it.each(tabla.ahora.map((c) => [c.nombre, c] as const))('elegirAhora: %s', (_n, c) => {
    expect(elegirAhora(c.entrada)).toEqual(c.espera);
  });
  it.each(tabla.carga.map((c) => [c.nombre, c] as const))('calcularCarga: %s', (_n, c) => {
    expect(calcularCarga(c.entrada)).toEqual(c.espera);
  });
});
