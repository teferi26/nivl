// La pausa del coach (0135) en la función `coach`: un turno de chat pone el
// reloj a cero, un ritual no, y no hay más de un brief al día.

import { equal, ok } from 'node:assert/strict';
import { instalar, peticion, turnoTexto, USER_ID, type Fake } from './sec_coach_fake_test.ts';

const { handler } = await import('../coach/handler.ts');

const HOY = new Date().toISOString().slice(0, 10);
const perfil = { id: USER_ID, name: 'G', timezone: 'UTC', wake_time: '08:00', sleep_time: '23:00', coach_mode: 'A' };
const relojes = (f: Fake) => f.llamadas.filter((l) => l.url.pathname === '/rest/v1/rpc/reactivar_coach' && l.rol === 'user');

Deno.test('Pausa: escribir en el chat pone en marcha el coach', async () => {
  const f = instalar({ filas: { profiles: [perfil] }, proveedor: () => turnoTexto('Bien.') });
  try {
    const r = await handler(peticion({ kind: 'chat', message: 'hola', stream: false, date: HOY }));
    await r.text();
    equal(r.status, 200);
    equal(relojes(f).length, 1);
  } finally {
    f.restaurar();
  }
});

Deno.test('Pausa: un ritual no cuenta como respuesta', async () => {
  const f = instalar({ filas: { profiles: [perfil], coach_runs: [] }, proveedor: () => turnoTexto('Brief.') });
  try {
    const r = await handler(peticion({ kind: 'brief', message: `Es ${HOY}. Dicta el brief.`, stream: false, date: HOY }));
    await r.text();
    equal(r.status, 200);
    equal(relojes(f).length, 0);
    ok(f.proveedor.length >= 1);
  } finally {
    f.restaurar();
  }
});

Deno.test('Pausa: con un brief hoy, no se genera otro ni se llama al modelo', async () => {
  const f = instalar({
    filas: { profiles: [perfil], coach_runs: [{ created_at: new Date().toISOString(), error: null }] },
    proveedor: () => turnoTexto('No debería.'),
  });
  try {
    const r = await handler(peticion({ kind: 'brief', message: 'x', stream: false, date: HOY }));
    const cuerpo = await r.json() as { reason?: string };
    equal(r.status, 429);
    equal(cuerpo.reason, 'brief_ya_hecho');
    equal(f.proveedor.length, 0);
  } finally {
    f.restaurar();
  }
});

Deno.test('Pausa: un brief fallido no gasta el del día', async () => {
  const f = instalar({
    filas: { profiles: [perfil], coach_runs: [{ created_at: new Date().toISOString(), error: 'turn_failed' }] },
    proveedor: () => turnoTexto('Brief.'),
  });
  try {
    const r = await handler(peticion({ kind: 'brief', message: 'x', stream: false, date: HOY }));
    await r.text();
    equal(r.status, 200);
  } finally {
    f.restaurar();
  }
});
