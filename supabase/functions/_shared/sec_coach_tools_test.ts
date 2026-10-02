// Chat 3 · c — Las herramientas del coach se ejecutan como el usuario.
//
// Lo que se comprueba aquí (con el handler real y el backend simulado):
//   · Toda escritura que nace de una herramienta va con el JWT del usuario
//     (RLS manda) y filtrada por SU user_id, aunque el modelo pase el id de
//     una fila ajena. El cliente de servicio solo toca coach_runs y las RPC
//     del candado/consentimiento.
//   · Hallazgo P2 (tools.ts es del coordinador: propuesta, no arreglo): el
//     patrón de regla_categoria entra sin escapar en un filtro `or=(…)` de
//     PostgREST y puede añadir condiciones propias.

import { equal, ok } from 'node:assert/strict';
import { instalar, peticion, turnoHerramienta, turnoTexto, USER_ID } from './sec_coach_fake_test.ts';
import { executeTool } from './tools.ts';
import { userClient } from './db.ts';
import { USER_TOKEN } from './sec_coach_fake_test.ts';

const { handler } = await import('../coach/handler.ts');

const AJENO = '99999999-9999-4999-8999-999999999999';

Deno.test('herramientas: un id ajeno se ejecuta como el usuario y filtrado por su user_id', async () => {
  const llamadas = [
    ['gestionar_elemento', { tipo: 'evento', accion: 'editar', id: AJENO, titulo: 'x', fecha: '', hora: '', nota: '', valor: '', motivo: 'm' }],
    ['editar_mision', { mision_id: AJENO, titulo: 'y', dificultad: '', dias_semana: [] }],
    ['registrar_dato', { tipo: 'mision_hecha', id: AJENO, peso_kg: 0, kcal: 0, proteina_g: 0, notas: '' }],
  ] as const;
  const fake = instalar({
    proveedor: (_b, n) => (n < llamadas.length ? turnoHerramienta(llamadas[n][0], llamadas[n][1], `tu${n}`) : turnoTexto('ok')),
  });
  try {
    const r = await handler(peticion({ kind: 'chat', message: 'hazlo', stream: false }));
    await r.text();
    const deTablas = fake.llamadas.filter(
      (l) => l.url.pathname.startsWith('/rest/v1/') && !l.url.pathname.startsWith('/rest/v1/rpc/'),
    );
    for (const l of deTablas) {
      if (l.url.pathname === '/rest/v1/coach_runs') {
        equal(l.rol, 'service', 'el libro lo escribe el servidor');
        continue;
      }
      equal(l.rol, 'user', `${l.method} ${l.url.pathname} debe ir con el JWT del usuario`);
    }
    const escrituras = deTablas.filter((l) => l.method === 'PATCH' || l.method === 'DELETE');
    ok(escrituras.length >= 2);
    for (const l of escrituras) {
      const filtro = l.url.searchParams.get('user_id') ?? '';
      ok(filtro === `eq.${USER_ID}` || l.url.pathname === '/rest/v1/coach_threads', `${l.url} sin filtro de dueño`);
    }
    // completarMision busca la misión con id Y user_id antes de llamar a la RPC.
    const busca = fake.llamadas.find((l) => l.url.pathname === '/rest/v1/quests' && l.method === 'GET' && l.url.searchParams.get('id') === `eq.${AJENO}`);
    equal(busca?.url.searchParams.get('user_id'), `eq.${USER_ID}`);
    ok(!fake.llamadas.some((l) => l.url.pathname === '/rest/v1/rpc/complete_quest'), 'sin misión propia no hay XP');
  } finally {
    fake.restaurar();
  }
});

Deno.test('herramientas [P2, corregido c-03]: regla_categoria ya no deja inyectar condiciones en el filtro or=()', async () => {
  const fake = instalar();
  try {
    const sb = userClient(USER_TOKEN);
    await executeTool(
      'regla_categoria',
      { patron: 'zz,category.eq.sin_clasificar,description.ilike.zz', categoria: 'ocio' },
      { sb, userId: USER_ID, today: '2026-10-02' },
    ).catch(() => {});
    const patch = fake.llamadas.find((l) => l.url.pathname === '/rest/v1/transactions' && l.method === 'PATCH');
    // Tras c-03 el patrón con separadores de filtro se rechaza o se escapa:
    // ninguna condición nueva llega al or=() de PostgREST.
    if (patch) {
      const or = patch.url.searchParams.get('or') ?? '';
      ok(!or.includes(',category.eq.sin_clasificar,'), `filtro resultante: ${or}`);
      equal(patch.url.searchParams.get('user_id'), `eq.${USER_ID}`, 'sigue acotado a su cuenta');
    }
  } finally {
    fake.restaurar();
  }
});
