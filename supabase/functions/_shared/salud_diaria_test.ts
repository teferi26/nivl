// El resumen de Salud solo llega al coach con el interruptor y el permiso de IA.

import { assert as ok, assertEquals as equal } from 'jsr:@std/assert@1';
import { instalar, USER_ID, USER_TOKEN } from './sec_coach_fake_test.ts';
import { buildContext } from './context.ts';
import { userClient } from './db.ts';
import { partirEstado } from './prompt.ts';

const HOY = '2026-11-08';
const TITULO = '## Apple Salud';
const DIA = { fecha: '2026-11-07', pasos: 9500, kcal_activas: 430, fc_media: 70, fc_reposo: 52, sueno_min: 430, peso_kg: 72.4 };
const leyoTabla = (fake: ReturnType<typeof instalar>) =>
  fake.llamadas.some((l) => l.url.pathname === '/rest/v1/salud_diaria');

Deno.test('Salud al coach: con ambos permisos, días cerrados y en la parte cacheada', async () => {
  const fake = instalar({
    filas: { salud_preferencias: [{ enviar_a_coach: true }], salud_diaria: [DIA] },
    rpc: { my_ai_consent: () => ({ granted: true }) },
  });
  try {
    const { text } = await buildContext(userClient(USER_TOKEN), USER_ID, HOY);
    ok(text.includes('2026-11-07: 9500 pasos · 430 kcal activas · pulso medio 70 · reposo 52 · sueño 7 h 10 min · 72.4 kg'), text);
    const { lento, rapido } = partirEstado(text);
    ok(lento.includes(TITULO));
    ok(!rapido.includes(TITULO));
    const lectura = fake.llamadas.find((l) => l.url.pathname === '/rest/v1/salud_diaria')!;
    equal(lectura.url.searchParams.get('fecha'), `lt.${HOY}`);
    equal(lectura.rol, 'user');
  } finally {
    fake.restaurar();
  }
});

Deno.test('Salud al coach: interruptor apagado, ni se lee', async () => {
  const fake = instalar({
    filas: { salud_preferencias: [{ enviar_a_coach: false }], salud_diaria: [DIA] },
    rpc: { my_ai_consent: () => ({ granted: true }) },
  });
  try {
    const { text } = await buildContext(userClient(USER_TOKEN), USER_ID, HOY);
    ok(!text.includes(TITULO));
    ok(!leyoTabla(fake));
  } finally {
    fake.restaurar();
  }
});

for (const [nombre, respuesta] of [['denegado', { granted: false }], ['sin respuesta', null]] as const) {
  Deno.test(`Salud al coach: permiso de IA ${nombre}, ni se lee`, async () => {
    const fake = instalar({
      filas: { salud_preferencias: [{ enviar_a_coach: true }], salud_diaria: [DIA] },
      rpc: { my_ai_consent: () => respuesta },
    });
    try {
      const { text } = await buildContext(userClient(USER_TOKEN), USER_ID, HOY);
      ok(!text.includes(TITULO));
      ok(!leyoTabla(fake));
    } finally {
      fake.restaurar();
    }
  });
}
