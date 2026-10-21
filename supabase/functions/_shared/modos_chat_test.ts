// Modos · chat del coach entre modos (FEEDBACK 1.0.11, punto 3).
//
// Lo que se comprueba:
//   · crear_mision acepta `modos` y los guarda en quests.modes (limpios y en orden); sin modos, el insert es
//     el de siempre (sin la clave `modes`).
//   · El evento SSE `tool` lleva `mision: { titulo, modos }` solo si la misión tiene modos y salió bien: con
//     eso la app pinta «Ir a FOCUS» sin volver a leer nada.
import { deepEqual, equal, ok } from 'node:assert/strict';
import { misionConModos, modosDeEntrada } from './modos.ts';
import { executeTool, TOOL_DEFS } from './tools.ts';
import { userClient } from './db.ts';
import { instalar, peticion, turnoHerramienta, turnoTexto, USER_ID, USER_TOKEN } from './sec_coach_fake_test.ts';

const { handler } = await import('../coach/handler.ts');

const BASE = { stat: 'INT', dificultad: 'media', dias_semana: [1, 3, 5], requiere_evidencia: false, es_extra: false };

Deno.test('modosDeEntrada: solo modos válidos, sin repetir y en orden canónico', () => {
  deepEqual(modosDeEntrada(['work', 'FOCUS', 'focus', 'general', 'x', 3, null]), ['focus', 'work']);
  deepEqual(modosDeEntrada(undefined), []);
  deepEqual(modosDeEntrada('focus'), []);
  deepEqual(modosDeEntrada([]), []);
});

Deno.test('misionConModos: solo crear_mision con modos y título', () => {
  deepEqual(misionConModos('crear_mision', { titulo: ' Repasa el tema 4 ', modos: ['focus'] }), { titulo: 'Repasa el tema 4', modos: ['focus'] });
  equal(misionConModos('crear_mision', { titulo: 'Sin modo', modos: [] }), null);
  equal(misionConModos('crear_mision', { titulo: '', modos: ['focus'] }), null);
  equal(misionConModos('editar_mision', { titulo: 'x', modos: ['focus'] }), null);
});

Deno.test('crear_mision: el esquema ofrece modos con su enum', () => {
  const def = TOOL_DEFS.find((d) => d.name === 'crear_mision')!;
  const modos = (def.input_schema.properties as Record<string, any>).modos;
  deepEqual(modos.items.enum, ['iron', 'focus', 'work', 'founder']);
  ok(def.input_schema.required.includes('modos'));
  const guiones = [0x2013, 0x2014].map((c) => String.fromCharCode(c));
  ok(!guiones.some((g) => modos.description.includes(g)), 'sin guiones largos');
});

Deno.test('crear_mision: guarda los modos; sin modos, el insert de siempre', async () => {
  const fake = instalar();
  try {
    const sb = userClient(USER_TOKEN);
    const ctx = { sb, userId: USER_ID, today: '2026-10-21' };
    const r = await executeTool('crear_mision', { ...BASE, titulo: 'Repasa el tema 4', modos: ['work', 'focus'] }, ctx);
    ok(r.includes('modos: FOCUS, WORK'), r);
    await executeTool('crear_mision', { ...BASE, titulo: 'Leer 10 páginas', modos: [] }, ctx);
    await executeTool('crear_mision', { ...BASE, titulo: 'Modelo viejo' }, ctx);
    const [con, vacia, vieja] = fake.escrituras('quests').map((l) => l.body as Record<string, unknown>);
    deepEqual(con.modes, ['focus', 'work']);
    ok(!('modes' in vacia), 'lista vacía: sin clave modes');
    ok(!('modes' in vieja), 'sin parámetro: sin clave modes');
  } finally {
    fake.restaurar();
  }
});

async function eventosTool(input: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const fake = instalar({
    proveedor: (_b, n) => (n === 0 ? turnoHerramienta('crear_mision', input) : turnoTexto('Hecho.')),
  });
  try {
    const r = await handler(peticion({ kind: 'chat', message: 'ponme repasar el tema 4' }, { 'x-nivl-modo': 'iron' }));
    const texto = await r.text();
    return texto
      .split(/\r?\n\r?\n/)
      .filter((b) => /^event:\s*tool$/m.test(b))
      .map((b) => JSON.parse(b.match(/^data:\s*(.*)$/m)![1]));
  } finally {
    fake.restaurar();
  }
}

Deno.test('handler: el evento tool lleva la misión con sus modos', async () => {
  const [ev] = await eventosTool({ ...BASE, titulo: 'Repasa el tema 4', modos: ['focus'] });
  equal(ev.name, 'crear_mision');
  equal(ev.ok, true);
  deepEqual(ev.mision, { titulo: 'Repasa el tema 4', modos: ['focus'] });
});

Deno.test('handler: sin modos, el evento tool es el de siempre', async () => {
  const [ev] = await eventosTool({ ...BASE, titulo: 'Leer 10 páginas', modos: [] });
  equal(ev.name, 'crear_mision');
  ok(!('mision' in ev));
});
