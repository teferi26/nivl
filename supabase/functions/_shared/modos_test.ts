// Modos F1 · el coach con idioma y modo, sin cambiar nada para quien no los manda.
//
// Lo que se comprueba:
//   · Sin cabeceras, el sistema montado es IDÉNTICO byte a byte al de antes de Modos F1: hash SHA-256 del
//     JSON de buildSystem / buildSystemRegistro con el mismo estado de ejemplo, calculado en 659714e (la
//     base de la rama) y fijado aquí. Español y General tampoco cambian nada.
//   · Con idioma o modo, solo se añade un bloque en la parte dinámica: la fija sigue igual (caché).
//   · El filtro «sin guiones largos» se aplica en todos los idiomas y el bloque no lleva ninguno.
//   · El handler: cabeceras → bloque; sin cabeceras → el perfil (rituales); el tope diario de la prueba
//     sale como 402 'presupuesto_agotado' (lo que la 1.0.9 ya sabe pintar).
//   · Stripe puede sustituir a la prueba automática.
import { deepEqual, equal, notEqual, ok } from 'node:assert/strict';
import { buildSystem, buildSystemRegistro, SISTEMA_FIJO, SISTEMA_REGISTRO_FIJO } from './prompt.ts';
import { bloqueIdiomaModo, etiquetaModos, idiomaDeCabecera, MODOS_COACH, modoDeCabeceraNivl, nombreIdioma } from './modos.ts';
import { sinGuiones, tieneGuiones } from './singuiones.ts';
import { stripeMayTakeOver } from './store-stripe.ts';
import { instalar, peticion, USER_ID } from './sec_coach_fake_test.ts';

const { handler } = await import('../coach/handler.ts');

const ESTADO = '# ESTADO DEL GLADIADOR · 2026-10-18\nNombre: Prueba · nivel 7 · racha 12 días\n## Misiones activas\n- [q1] "Entreno de pierna" · FUE · media';
const DOSSIER = 'Objetivo: 85 kg. Entrena lunes, miércoles y viernes.';

async function sha256(v: unknown): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(v)));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Calculados con el prompt.ts de 659714e (antes de Modos F1). Si cambias a propósito la voz, el
// conocimiento o las reglas, recalcúlalos; si cambian sin querer, algo ha roto la regla «sin cabeceras, igual».
const HASH_ANTES = {
  chat: 'b000f0cb33bd9db4f2e94ea26c1591cbaa6c614874262d0db39ae16fbbaa2466',
  brief: 'c8e463ea12f6ef3d125e5094f527159e9ea5ccb6661048b3dd0c73cf8d74d756',
  vacio: 'f21fc8c1ccb20cae1160fe456cdb80f86ceb3b73f5f05a7fe96d52a6251708d0',
  registro: 'd0380017a4a436ee4b7548cccc240e4a1419d741d242c2ad569772f166d36956',
};

Deno.test('modos: sin idioma ni modo el sistema es idéntico byte a byte al de antes (SHA-256)', async () => {
  for (const neutro of [undefined, {}, { idioma: null, modo: null }, { idioma: 'es' }, { idioma: 'es-ES', modo: null }, { idioma: '' }]) {
    equal(await sha256(buildSystem(DOSSIER, 'chat', ESTADO, neutro)), HASH_ANTES.chat, JSON.stringify(neutro));
    equal(await sha256(buildSystem(DOSSIER, 'brief', ESTADO, { resumenHilo: 'Hablamos de la sentadilla.', ...neutro })), HASH_ANTES.brief);
    equal(await sha256(buildSystem('', 'chat', '', neutro)), HASH_ANTES.vacio);
    equal(await sha256(buildSystemRegistro(ESTADO, neutro)), HASH_ANTES.registro);
  }
  equal(await sha256(buildSystemRegistro(ESTADO)), HASH_ANTES.registro);
});

Deno.test('modos: idioma y modo van en la parte dinámica; la fija no cambia', async () => {
  const s = buildSystem(DOSSIER, 'chat', ESTADO, { idioma: 'en', modo: 'iron' });
  notEqual(await sha256(s), HASH_ANTES.chat);
  deepEqual(s.slice(0, SISTEMA_FIJO.length).map((b) => b.text), [...SISTEMA_FIJO]);
  const bloque = s[SISTEMA_FIJO.length].text;
  ok(bloque.includes('inglés') && bloque.includes('(en)'), bloque);
  ok(bloque.includes('IRON'), bloque);
  equal(s.filter((b) => b.cache_control).length, 2, 'siguen siendo dos puntos de caché');
  ok(s.at(-1)!.cache_control);
  const r = buildSystemRegistro(ESTADO, { idioma: 'fr' });
  deepEqual(r.slice(0, SISTEMA_REGISTRO_FIJO.length).map((b) => b.text), [...SISTEMA_REGISTRO_FIJO]);
  ok(r[SISTEMA_REGISTRO_FIJO.length].text.includes('francés'));
  ok(r.at(-1)!.cache_control && r.at(-1)!.text.includes('Entreno de pierna'));
  const soloBloque = buildSystemRegistro('', { modo: 'focus' });
  ok(soloBloque.at(-1)!.cache_control && soloBloque.at(-1)!.text.includes('FOCUS'));
});

Deno.test('modos: cabeceras normalizadas; lo raro es como no mandarlas', () => {
  deepEqual(['en', 'EN', 'pt_br', 'pt-BR', 'zh-hant-tw', 'de-DE'].map(idiomaDeCabecera), ['en', 'en', 'pt-BR', 'pt-BR', 'zh-Hant-TW', 'de-DE']);
  deepEqual(['', ' ', 'es', 'es-ES', 'ES_419', 'spa', 'x', 'english please', '<script>', 'e'.repeat(40)].map(idiomaDeCabecera), Array(10).fill(null));
  deepEqual(['iron', ' IRON ', 'Focus', 'work', 'founder'].map(modoDeCabeceraNivl), ['iron', 'iron', 'focus', 'work', 'founder']);
  deepEqual(['general', '', 'gym', null, undefined].map(modoDeCabeceraNivl), [null, null, null, null, null]);
  equal(bloqueIdiomaModo(null, null), '');
  equal(bloqueIdiomaModo('es', null), '');
  equal(nombreIdioma('pt-BR'), 'portugués');
  ok(nombreIdioma('sw').length > 2);
});

Deno.test('modos: el bloque no lleva guiones largos en ningún idioma ni modo', () => {
  for (const lng of ['en', 'fr', 'pt', 'de', 'it', 'ar', 'ja', 'sw', null]) {
    for (const m of [...MODOS_COACH, null]) {
      const b = bloqueIdiomaModo(lng, m);
      equal(tieneGuiones(b), false, `${lng} ${m}`);
      equal(sinGuiones(b), b, 'el saneado no lo toca: la caché sigue estable');
    }
  }
});

Deno.test('modos: el filtro sin guiones se aplica igual en todos los idiomas', () => {
  const casos = [
    'Today — legs and no excuses.', 'Squat 8–12 reps.', 'Aujourd’hui — jambes.', 'Heute – Beine und Rumpf.',
    'Hoje — pernas.', 'Oggi — gambe, poi cardio.', 'اليوم — تمرين الأرجل', '今日は — 脚の日', 'Сегодня — ноги.',
  ];
  for (const c of casos) equal(tieneGuiones(sinGuiones(c)), false, c);
  equal(sinGuiones('We train legs today — and no excuses.'), 'We train legs today, and no excuses.');
  equal(sinGuiones('Today — legs.'), 'Today: legs.');
  equal(sinGuiones('Squat 8–12 reps.'), 'Squat 8-12 reps.');
});

Deno.test('modos: etiqueta de modos en la línea de la misión (vacía para la 1.0.9)', () => {
  for (const vacio of [undefined, null, [], '{}', ['general'], [1, 2]]) equal(etiquetaModos(vacio), '');
  equal(etiquetaModos(['iron', 'iron', 'focus', 'x']), ' · modos: IRON, FOCUS');
});

type Body = { system: { type: string; text: string; cache_control?: unknown }[] };

async function sistemaDe(cabeceras: Record<string, string>, perfil: Record<string, unknown> = {}): Promise<Body['system']> {
  const fake = instalar({
    filas: {
      profiles: [{
        id: USER_ID, name: 'Gladiador de prueba', timezone: 'Europe/Madrid', wake_time: '07:00', sleep_time: '23:00',
        coach_mode: 'A', xp_total: 0, streak_days: 0, protection_stones: 0, bonus_points: 0, profile_kind: 'general', ...perfil,
      }],
      quests: [{ id: 'q-1', title: 'Leer 20 minutos', stat: 'INT', difficulty: 'media', days_of_week: [1, 2, 3, 4, 5, 6, 7], active: true, modes: ['focus'] }],
    },
  });
  try {
    await (await handler(peticion({ kind: 'chat', message: 'Plan para hoy y tres prioridades', stream: false }, cabeceras))).text();
    return (fake.proveedor[0].body as Body).system;
  } finally {
    fake.restaurar();
  }
}

Deno.test('modos: handler, sin cabeceras igual; con cabeceras el bloque; sin cabecera, el idioma del perfil', async () => {
  const base = await sistemaDe({});
  deepEqual(await sistemaDe({ 'x-nivl-locale': 'es', 'x-nivl-modo': 'general' }), base, 'español y General = sin cabeceras');
  deepEqual(await sistemaDe({ 'x-nivl-locale': '???', 'x-nivl-modo': 'gym' }), base, 'valores raros = sin cabeceras');
  ok(!base.some((b) => b.text.includes('# Idioma y modo')));
  ok(base.some((b) => b.text.includes('"Leer 20 minutos"') && b.text.includes('modos: FOCUS')), 'la misión lleva su modo en el estado');
  const conModo = await sistemaDe({ 'x-nivl-locale': 'en', 'x-nivl-modo': 'focus' });
  const bloque = conModo.find((b) => b.text.startsWith('# Idioma y modo'));
  ok(bloque && bloque.text.includes('inglés') && bloque.text.includes('FOCUS'));
  deepEqual(conModo.slice(0, SISTEMA_FIJO.length), base.slice(0, SISTEMA_FIJO.length), 'la parte fija y su caché no cambian');
  const ritual = await sistemaDe({}, { locale: 'fr' });
  ok(ritual.some((b) => b.text.includes('francés')), 'sin cabecera, el idioma del perfil');
  const manda = await sistemaDe({ 'x-nivl-locale': 'es' }, { locale: 'fr' });
  deepEqual(manda, base, 'con cabecera es, manda la cabecera');
});

Deno.test('modos: el tope diario de la prueba sale como 402 presupuesto_agotado con su texto', async () => {
  const fake = instalar({ rpc: { ai_begin_turn: () => ({ entitled: true, allowed: false, reason: 'tope_diario', plan: 'prueba_auto' }) } });
  try {
    const res = await handler(peticion({ kind: 'chat', message: 'hola', stream: false }));
    equal(res.status, 402);
    const body = await res.json();
    equal(body.reason, 'presupuesto_agotado');
    equal(body.detalle, 'tope_diario');
    ok(String(body.error).includes('mensajes de hoy'));
    equal(tieneGuiones(String(body.error)), false);
    equal(fake.proveedor.length, 0, 'no se llama al modelo');
  } finally {
    fake.restaurar();
  }
});

Deno.test('modos: Stripe puede sustituir a la prueba automática viva', () => {
  const ahora = Date.now();
  const prueba = {
    user_id: USER_ID, status: 'trialing', plan: 'prueba_auto', provider: 'prueba',
    current_period_end: new Date(ahora + 86400000).toISOString(), stripe_subscription_id: null,
  };
  equal(stripeMayTakeOver(prueba as any, ahora), true);
  equal(stripeMayTakeOver({ ...prueba, plan: 'elite_anual', provider: 'manual', status: 'active' } as any, ahora), false, 'una concesión manual sigue protegida');
});
