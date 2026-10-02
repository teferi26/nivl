// L6 · Paridad de la política de push del servidor: el espejo Deno
// (_shared/pushpolicy.ts) contra el original de la app (src/lib/pushPolicy.ts,
// del Chat 5). El original no tiene imports, así que Deno lo carga tal cual
// desde fuera de supabase/ (solo en el test: el despliegue no lo necesita).
//
// Dos llaves: el texto es idéntico y la misma tabla de casos (la de
// src/lib/__tests__/pushPolicy.test.ts y algunos bordes más) da lo mismo.
import { assertEquals } from 'jsr:@std/assert@1';
import * as deno from './pushpolicy.ts';
import * as app from '../../../src/lib/pushPolicy.ts';

type Args = Parameters<typeof deno.pushDelServidorPermitido>[0];

const BASE = { wakeTime: '08:00:00', sleepTime: '23:00:00', pushesHoy: 0 };

export const CASOS_PUSH: [Args, string, { ok: boolean; motivo: string }][] = [
  // La tabla de pushPolicy.test.ts.
  [{ ...BASE, ultimaApertura: '2026-10-10' }, '2026-10-10T12:00', { ok: true, motivo: 'ok' }],
  [{ ...BASE, ultimaApertura: '2026-10-10', pushesHoy: 1 }, '2026-10-10T12:00', { ok: false, motivo: 'tope' }],
  [{ ...BASE, ultimaApertura: '2026-10-10' }, '2026-10-10T23:30', { ok: false, motivo: 'silencio' }],
  [{ ...BASE, ultimaApertura: '2026-10-03' }, '2026-10-10T12:00', { ok: false, motivo: 'caducada' }],
  [{ ...BASE, ultimaApertura: null }, '2026-10-10T12:00', { ok: true, motivo: 'ok' }],
  // Bordes: 6 días sí, 7 no; 30 tampoco; ventana; fecha mala; apertura corrupta.
  [{ ...BASE, ultimaApertura: '2026-10-04' }, '2026-10-10T12:00', { ok: true, motivo: 'ok' }],
  [{ ...BASE, ultimaApertura: '2026-09-10' }, '2026-10-10T12:00', { ok: false, motivo: 'caducada' }],
  [{ ...BASE, ultimaApertura: '2026-10-10' }, '2026-10-10T07:59', { ok: false, motivo: 'silencio' }],
  [{ ...BASE, ultimaApertura: '2026-10-10' }, '2026-10-10T08:00', { ok: true, motivo: 'ok' }],
  [{ ...BASE, ultimaApertura: '2026-10-10' }, '2026-10-10T22:59', { ok: true, motivo: 'ok' }],
  [{ ...BASE, ultimaApertura: '2026-10-10' }, '2026-02-30T12:00', { ok: false, motivo: 'fecha' }],
  [{ ...BASE, ultimaApertura: 'basura' }, '2026-10-10T12:00', { ok: true, motivo: 'ok' }],
  [{ ultimaApertura: '2026-10-10', wakeTime: null, sleepTime: null, pushesHoy: 0 }, '2026-10-10T21:59', { ok: true, motivo: 'ok' }],
  [{ ultimaApertura: '2026-10-10', wakeTime: null, sleepTime: null, pushesHoy: 0 }, '2026-10-10T22:00', { ok: false, motivo: 'silencio' }],
  [{ ...BASE, ultimaApertura: '2026-10-10', sleepTime: '01:00' }, '2026-10-10T23:30', { ok: true, motivo: 'ok' }],
  [{ ...BASE, ultimaApertura: '2026-10-10', wakeTime: '10:00', sleepTime: '12:00' }, '2026-10-10T09:00', { ok: true, motivo: 'ok' }],
];

Deno.test('pushpolicy: el espejo Deno es el mismo texto que src/lib/pushPolicy.ts', async () => {
  const leer = async (rel: string) => (await Deno.readTextFile(new URL(rel, import.meta.url))).replace(/\r\n/g, '\n');
  assertEquals(await leer('./pushpolicy.ts'), await leer('../../../src/lib/pushPolicy.ts'));
});

Deno.test('pushpolicy: misma tabla de casos en los dos lados', () => {
  for (const [args, ahora, esperado] of CASOS_PUSH) {
    assertEquals(deno.pushDelServidorPermitido(args, ahora), esperado, `deno ${JSON.stringify(args)} @ ${ahora}`);
    assertEquals(app.pushDelServidorPermitido(args, ahora), esperado, `app ${JSON.stringify(args)} @ ${ahora}`);
  }
  // Y con Momento en vez de cadena.
  const m = { fecha: '2026-10-10', min: 12 * 60 };
  assertEquals(deno.pushDelServidorPermitido({ ...BASE, ultimaApertura: '2026-10-10' }, m), app.pushDelServidorPermitido({ ...BASE, ultimaApertura: '2026-10-10' }, m));
});

Deno.test('pushpolicy: fases de caducidad iguales en los dos lados', () => {
  for (const ultima of [null, '2026-10-10', '2026-10-04', '2026-10-03', '2026-09-20', '2026-09-10', '2026-09-01']) {
    assertEquals(deno.faseCaducidad(ultima, '2026-10-10'), app.faseCaducidad(ultima, '2026-10-10'));
  }
});
