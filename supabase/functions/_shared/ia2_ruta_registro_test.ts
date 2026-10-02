// IA v2 · L3 «Ruta estrecha de registro».
//
// Medido en producción tras L1: «te he subido el gym hoy» costó 0,2543 $ y
// 14,5 s, y el coach, sin que se lo pidieran, llamó a prescribir_entreno. Un
// parte va ahora por una ruta estrecha: modelo barato, estado mínimo de hoy y
// un pack fijo de cuatro herramientas de leer y apuntar.
//
//   · rutaDelTurno: positivos y negativos con frases reales (conservadora).
//   · El pack: ninguna escritura de planificación entra, y el ejecutor rechaza
//     lo que no está en él aunque el proveedor lo pida.
//   · De punta a punta con el handler real y el backend simulado de
//     sec_coach_fake_test.ts: modelo, herramientas, sistema sin dossier ni
//     conocimiento, nada escrito, telemetría y tope de tres vueltas.
//   · Coste simulado del mismo turno por las dos rutas (imprime las fichas).

import { deepEqual, equal, ok, rejects, throws } from 'node:assert/strict';
import {
  instalar,
  peticion,
  turnoHerramienta,
  turnoTexto,
  USER_ID,
  USER_TOKEN,
  type Llamada,
} from './sec_coach_fake_test.ts';
import { rutaDelTurno } from './intencion.ts';
import { definicionesDelPack, ESCRITURA_DE_PLANIFICACION, fueraDelPack, PACK_REGISTRO, TOOL_DEFS_REGISTRO } from './packs.ts';
import { TOOL_DEFS } from './tools.ts';
import { COACH_KNOWLEDGE } from './knowledge.ts';
import { buildSystemRegistro, REGLA_COMPROBAR, REGLA_NO_ESCRIBIR, SISTEMA_REGISTRO, SISTEMA_REGISTRO_FIJO } from './prompt.ts';
import { buildContextMinimo } from './context.ts';
import { userClient } from './db.ts';
import { CHEAP_MODEL, COACH_MODEL, costMicroUsd, estimarFichas } from './anthropic.ts';
import { HEALTH_REQUIRED } from './health.ts';

const { handler } = await import('../coach/handler.ts');

// ── rutaDelTurno ─────────────────────────────────────────────────────

const PARTES = [
  'te he subido el gym hoy',
  'te he subido el gym',
  'Ya he entrenado',
  'he hecho pierna',
  'ya está',
  'Ya está hecho',
  'peso 94,2',
  'Peso 94.2 kg',
  '94,2 kg',
  'hoy peso 93,8',
  'he comido pollo con arroz y una ensalada',
  'He cenado una tortilla de tres huevos',
  'me he pesado: 80,4',
  'me pesé esta mañana, 81,2',
  'acabo de registrar la cena',
  'he corrido 5 km',
  'Hoy he comido 2.300 kcal',
  'fui al gimnasio a las 7',
  'ya lo subí',
  'he cumplido lo del alcohol',
  'ya he hecho la lectura',
  'hecho. He meditado 10 minutos',
  'he hecho la sesión de empuje, todo registrado',
  '2300 kcal',
];

const NO_PARTES = [
  '¿qué entreno hoy?',
  'qué entreno hoy',
  'he entrenado hoy?',
  '¿He entrenado hoy?',
  'he entrenado, ¿qué hago mañana?',
  'Ya he entrenado. Hazme el plan de mañana',
  'he hecho pierna, ponme cardio para el jueves',
  'he comido fatal, ayúdame con la dieta',
  'he comido mucho, ¿cómo lo compenso?',
  'he hecho pierna pero me duele la rodilla, cómo sigo',
  'ya he entrenado; cambia la rutina de la semana que viene',
  'he hecho la sesión, dime qué tal voy con el objetivo',
  'no he entrenado',
  'todavía no lo he subido',
  'voy a entrenar a las 7',
  'mañana corro 10 km',
  'hola',
  'repasa mi peso',
  'quiero bajar a 88 kg',
  'necesito un plan para el verano',
  'he entrenado. ' + 'Muy bien todo, sin molestias y con buena energía. '.repeat(8),
  'he hecho pierna. he hecho cardio. he comido bien. he dormido 8 horas. he leído',
  '',
  '   ',
];

Deno.test('L3 ruta: partes claros → registro', () => {
  ok(PARTES.length >= 20);
  for (const t of PARTES) equal(rutaDelTurno(t, 'chat'), 'registro', `«${t}» debería ir por registro`);
});

Deno.test('L3 ruta: preguntas, consejo, plan, cambios, largos y no-partes → completa', () => {
  ok(NO_PARTES.length >= 20);
  for (const t of NO_PARTES) equal(rutaDelTurno(t, 'chat'), 'completa', `«${t}» debería ir por la completa`);
});

Deno.test('L3 ruta: solo el chat; los rituales nunca van por registro', () => {
  for (const k of ['brief', 'plan', 'revision_semanal', 'cierre_mensual', 'escalada']) {
    equal(rutaDelTurno('te he subido el gym', k), 'completa');
  }
  equal(rutaDelTurno(undefined, 'chat'), 'completa');
  equal(rutaDelTurno(42, 'chat'), 'completa');
});

// ── Pack fijo ────────────────────────────────────────────────────────

Deno.test('L3 pack: las 4 del registro, en el orden de TOOL_DEFS, y ninguna escritura de planificación', () => {
  const nombres = TOOL_DEFS_REGISTRO.map((t) => t.name);
  deepEqual([...nombres].sort(), [...PACK_REGISTRO].sort());
  const ordenGlobal = TOOL_DEFS.map((t) => t.name).filter((n) => PACK_REGISTRO.includes(n));
  deepEqual(nombres, ordenGlobal, 'orden de TOOL_DEFS (prefijo estable)');
  for (const n of ESCRITURA_DE_PLANIFICACION) ok(!nombres.includes(n), `${n} no puede entrar en el pack de registro`);
  for (const n of ['prescribir_entreno', 'planificar_dia', 'gestionar_elemento', 'escribir_diario', 'desactivar_mision', 'actualizar_dossier']) {
    ok(!nombres.includes(n), n);
  }
  ok(!nombres.some((n) => n.startsWith('crear_')), 'ningún crear_*');
  // Las definiciones son las MISMAS de TOOL_DEFS (mismo objeto, sin copias que diverjan).
  for (const d of TOOL_DEFS_REGISTRO) ok(TOOL_DEFS.includes(d));
  // Toda herramienta global está clasificada: o es del pack o es de planificación, o es de solo lectura conocida.
  const clasificadas = new Set([...PACK_REGISTRO, ...ESCRITURA_DE_PLANIFICACION]);
  deepEqual(TOOL_DEFS.map((t) => t.name).filter((n) => !clasificadas.has(n)), [], 'herramienta nueva sin clasificar en packs.ts');
});

Deno.test('L3 pack: un nombre inexistente rompe al cargar; fueraDelPack veta lo ajeno', () => {
  throws(() => definicionesDelPack(['consultar_dia', 'no_existe']), /no_existe/);
  equal(fueraDelPack('registrar_dato', PACK_REGISTRO), null);
  ok(fueraDelPack('prescribir_entreno', PACK_REGISTRO)?.includes('no está disponible'));
});

Deno.test('L3 prompt: fijo idéntico entre usuarios, con comprobar-y-citar, no escribir y derivar', () => {
  const a = buildSystemRegistro('estado A');
  const b = buildSystemRegistro('estado B de otro usuario');
  const n = SISTEMA_REGISTRO_FIJO.length;
  deepEqual(a.slice(0, n), b.slice(0, n));
  ok(a[n - 1].cache_control, 'punto de caché tras la parte fija');
  ok(a.at(-1)!.cache_control, 'punto tras el estado');
  ok(SISTEMA_REGISTRO.includes(REGLA_COMPROBAR));
  ok(SISTEMA_REGISTRO.includes(REGLA_NO_ESCRIBIR));
  ok(SISTEMA_REGISTRO.includes('lo veis en el siguiente mensaje'));
  ok(!SISTEMA_REGISTRO_FIJO.join('\n').includes(COACH_KNOWLEDGE.slice(0, 200)), 'sin la doctrina');
  ok(!/\d{4}-\d{2}-\d{2}/.test(SISTEMA_REGISTRO_FIJO.join('\n')), 'sin fechas en lo fijo');
});

// ── Backend simulado con datos ───────────────────────────────────────

type Fila = Record<string, unknown>;

/** Aplica los filtros de PostgREST (eq/gte/lte/in), como en ia2_nunca_contradecir_test.ts. */
function filtrar(filas: Fila[], params: URLSearchParams): Fila[] {
  let out = filas;
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
    const punto = v.indexOf('.');
    const op = v.slice(0, punto);
    const valor = v.slice(punto + 1);
    out = out.filter((f) => {
      const x = String(f[k] ?? '');
      switch (op) {
        case 'eq': return x === valor;
        case 'gte': return x >= valor;
        case 'lte': return x <= valor;
        case 'in': return valor.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, '')).includes(x);
        default: return true;
      }
    });
  }
  return out;
}

function postgrest(datos: Record<string, Fila[]>) {
  return (c: Llamada): Response | undefined => {
    if (c.method !== 'GET') return undefined;
    const tabla = /^\/rest\/v1\/([^/]+)$/.exec(c.url.pathname)?.[1];
    if (!tabla || tabla === 'rpc' || !(tabla in datos)) return undefined;
    const filas = filtrar(datos[tabla], c.url.searchParams);
    if ((c.headers.get('accept') ?? '').includes('vnd.pgrst.object')) {
      return filas.length
        ? new Response(JSON.stringify(filas[0]), { status: 200, headers: { 'content-type': 'application/json' } })
        : new Response(JSON.stringify({ code: 'PGRST116', message: 'no rows' }), { status: 406 });
    }
    return new Response(JSON.stringify(filas), {
      status: 200,
      headers: { 'content-type': 'application/json', 'content-range': `0-${Math.max(0, filas.length - 1)}/${filas.length}` },
    });
  };
}

const HOY = '2026-10-03';
const DOSSIER = 'MARCA-DOSSIER: objetivo 88 kg, trabaja de noche, odia el cardio. ' + 'Contexto largo del dossier. '.repeat(300);
const TODOS_LOS_DIAS = [1, 2, 3, 4, 5, 6, 7];

/** Un usuario con algo de historia: lo mismo para las dos rutas. */
function datos(): Record<string, Fila[]> {
  return {
    profiles: [{
      id: USER_ID, name: 'Tafa', timezone: 'Europe/Madrid', wake_time: '07:00', sleep_time: '23:00', coach_mode: 'A',
      xp_total: 4200, streak_days: 12, perfect_streak_days: 3, protection_stones: 1, bonus_points: 0, profile_kind: 'deportista',
      xp_fue: 1, xp_vit: 1, xp_int: 1, xp_agi: 1, xp_per: 1,
    }],
    coach_dossier: [{ user_id: USER_ID, content: DOSSIER }],
    quests: [
      { id: 'q-gym', user_id: USER_ID, active: true, title: 'Entrenar fuerza', stat: 'FUE', difficulty: 'dificil', days_of_week: TODOS_LOS_DIAS, link: 'gym', is_penalty: false, created_at: '2026-08-01' },
      { id: 'q-leer', user_id: USER_ID, active: true, title: 'Leer 20 páginas', stat: 'INT', difficulty: 'facil', days_of_week: TODOS_LOS_DIAS, link: 'ninguno', is_penalty: false, created_at: '2026-08-01' },
    ],
    completions: [{ user_id: USER_ID, quest_id: 'q-leer', date: HOY }],
    rules: [{ id: 'r-alcohol', user_id: USER_ID, active: true, text: 'Cero alcohol', consequence: '−50 XP', link: 'ninguno' }],
    rule_checks: [],
    rule_breaks: [],
    gym_sessions: [{ id: 'ses1', user_id: USER_ID, date: HOY, gym_day_id: 'dia1', notes: null }],
    gym_days: [{ id: 'dia1', user_id: USER_ID, name: 'Pierna' }],
    gym_lifts: [
      { session_id: 'ses1', user_id: USER_ID, exercise_name: 'Sentadilla', weight: 100, reps: 5, set_index: 0 },
      { session_id: 'ses1', user_id: USER_ID, exercise_name: 'Sentadilla', weight: 100, reps: 5, set_index: 1 },
    ],
    cardio_sessions: [],
    body_metrics: [{ user_id: USER_ID, date: '2026-10-01', weight_kg: 94.6 }],
    nutrition_logs: [],
    coach_facts: Array.from({ length: 25 }, (_, i) => ({
      user_id: USER_ID, date: `2026-09-${String(i + 1).padStart(2, '0')}`, category: 'log', content: `MARCA-HECHO ${i}: ` + 'detalle '.repeat(40),
    })),
    journal_entries: Array.from({ length: 10 }, (_, i) => ({
      user_id: USER_ID, date: `2026-09-${String(i + 20).padStart(2, '0')}`, mood: 4, energy: 3, sleep_hours: 7, emotions: ['cansado'],
      wins: ['entrené'], text: 'MARCA-DIARIO ' + 'día largo de trabajo. '.repeat(15), lesson: null, gratitude: null, plan: null,
    })),
    coach_threads: [{ id: 'hilo1', user_id: USER_ID, archived: false }],
    coach_messages: [
      // El fake no ordena: van ya de más nuevo a más viejo, como los pide el handler.
      { thread_id: 'hilo1', role: 'assistant', content: [{ type: 'text', text: 'Anotado.' }] },
      { thread_id: 'hilo1', role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: 'Anotado en la memoria.' }] },
      { thread_id: 'hilo1', role: 'assistant', content: [{ type: 'tool_use', id: 'x', name: 'registrar_hecho', input: {} }] },
      { thread_id: 'hilo1', role: 'user', content: [{ type: 'text', text: 'ayer dormí 6 horas' }] },
      { thread_id: 'hilo1', role: 'assistant', content: [{ type: 'text', text: 'MARCA-VIEJO respuesta antigua.' }] },
      { thread_id: 'hilo1', role: 'user', content: [{ type: 'text', text: 'MARCA-VIEJO pregunta antigua' }] },
      { thread_id: 'hilo1', role: 'assistant', content: [{ type: 'text', text: 'MARCA-MUY-VIEJO respuesta.' }] },
      { thread_id: 'hilo1', role: 'user', content: [{ type: 'text', text: 'MARCA-MUY-VIEJO pregunta' }] },
    ],
  };
}

const ESCRITURAS_PERMITIDAS = new Set(['/rest/v1/coach_messages', '/rest/v1/coach_threads', '/rest/v1/coach_runs']);

function escriturasAjenas(fake: ReturnType<typeof instalar>): string[] {
  return fake.llamadas
    .filter((l) =>
      l.url.pathname.startsWith('/rest/v1/') && !l.url.pathname.startsWith('/rest/v1/rpc/') &&
      l.method !== 'GET' && l.method !== 'HEAD' && !ESCRITURAS_PERMITIDAS.has(l.url.pathname)
    )
    .map((l) => l.url.pathname);
}

interface Cuerpo {
  model: string;
  system: { text: string; cache_control?: unknown }[];
  tools: { name: string }[];
  tool_choice?: { type: string };
  messages: { role: string; content: unknown }[];
}

const cuerpo = (fake: ReturnType<typeof instalar>, n: number) => fake.proveedor[n].body as Cuerpo;
const runs = (fake: ReturnType<typeof instalar>) => fake.escrituras('coach_runs').map((l) => l.body as Record<string, unknown>);

// Uso simulado de un turno estrecho (pocas fichas, modelo barato).
const USO_ESTRECHO = { input_tokens: 4_000, output_tokens: 150 };

// ── De punta a punta ─────────────────────────────────────────────────

Deno.test('L3 «te he subido el gym hoy»: modelo barato, pack fijo, sin dossier ni conocimiento, y prescribir_entreno rechazado sin escribir nada', async () => {
  const fake = instalar({
    otras: postgrest(datos()),
    proveedor: (_b, n) =>
      n === 0
        ? turnoHerramienta(
          'prescribir_entreno',
          { fecha: HOY, ejercicios: [{ ejercicio: 'Press banca', series: 5, repeticiones: 5, peso: 80, rpe: 8, notas: '' }], motivo: 'por mi cuenta' },
          'tu_presc',
          USO_ESTRECHO,
          CHEAP_MODEL,
        )
        : turnoTexto('Consta: Sentadilla 100×5, 100×5 hoy.', USO_ESTRECHO, CHEAP_MODEL),
  });
  try {
    const r = await handler(peticion({ kind: 'chat', message: 'te he subido el gym hoy', stream: false, date: HOY }));
    equal(r.status, 200);
    const respuesta = await r.json() as { text: string };
    ok(respuesta.text.includes('Sentadilla'));

    const primera = cuerpo(fake, 0);
    equal(primera.model, CHEAP_MODEL, 'modelo barato');
    deepEqual(primera.tools.map((t) => t.name), TOOL_DEFS_REGISTRO.map((t) => t.name), 'herramientas = PACK_REGISTRO');

    const sistema = JSON.stringify(primera.system);
    ok(!sistema.includes('MARCA-DOSSIER') && !sistema.includes('Tu memoria sobre este gladiador'), 'sin dossier');
    ok(!sistema.includes(COACH_KNOWLEDGE.slice(0, 200)), 'sin conocimiento');
    ok(!sistema.includes('MARCA-HECHO') && !sistema.includes('MARCA-DIARIO'), 'sin hechos ni diario');
    ok(!sistema.includes('ESTUDIO'), 'sin estudios');
    ok(sistema.includes('Sentadilla 100×5, 100×5'), '«Registrado hoy» en el estado mínimo');
    ok(sistema.includes('[q-gym] \\"Entrenar fuerza\\" · PENDIENTE HOY'), 'misiones de hoy con estado');
    ok(sistema.includes('[q-leer] \\"Leer 20 páginas\\" · HECHA HOY'));
    ok(sistema.includes('[r-alcohol] \\"Cero alcohol\\" · pendiente hoy'), 'reglas de hoy con estado');

    // La comprobación del servidor (L1) viaja también en la ruta estrecha.
    const usuario = JSON.stringify(primera.messages.at(-1)!.content);
    ok(usuario.includes(`## Comprobación del sistema (${HOY})`));

    // Historial: solo texto, los 4 últimos como mucho, sin tool_use viejos.
    const previos = primera.messages.slice(0, -1);
    ok(previos.length <= 4);
    ok(!JSON.stringify(previos).includes('tool_use') && !JSON.stringify(previos).includes('tool_result'));
    ok(JSON.stringify(previos).includes('ayer dormí 6 horas'), 'lo reciente sí');
    ok(!JSON.stringify(previos).includes('MARCA-MUY-VIEJO'), 'nada más viejo que los 4 últimos mensajes con texto');
    equal(previos[0]?.role, 'user');

    // El ejecutor rechaza prescribir_entreno: vuelve como error y no se escribe nada.
    const resultado = JSON.stringify(cuerpo(fake, 1).messages.at(-1)!.content);
    ok(resultado.includes('"is_error":true') && resultado.includes('no está disponible'), resultado);
    deepEqual(escriturasAjenas(fake), [], 'ninguna escritura fuera del hilo y la contabilidad');
    ok(!fake.llamadas.some((l) => /\/rpc\/(complete_quest|award_xp)$/.test(l.url.pathname)), 'sin XP');

    // Telemetría.
    const [run] = runs(fake);
    equal(run.route, 'registro');
    equal(run.intent, 'afirmacion');
    equal(run.tools_offered, PACK_REGISTRO.length);
    equal(run.tool_calls, 1);
    equal(run.iterations, 2);
    equal(run.mode, 'estandar');
    equal(run.kind, 'chat', 'el kind del libro no cambia (CHECK de coach_runs)');
    ok(Number(run.state_chars) > 0 && Number(run.state_chars) < 3_000, `estado mínimo: ${run.state_chars} caracteres`);
    ok(Number(run.cost_micro_usd) < 10_000, `coste simulado ${run.cost_micro_usd} µ$`);

    // Persistencia del hilo: lo que dijo él, sin la comprobación.
    const guardados = fake.escrituras('coach_messages').map((l) => JSON.stringify(l.body));
    ok(guardados.some((g) => g.includes('te he subido el gym hoy')));
    ok(!guardados.some((g) => g.includes('Comprobación del sistema')));
  } finally {
    fake.restaurar();
  }
});

Deno.test('L3 «¿qué entreno hoy?» → ruta completa (coach, todas las herramientas, dossier)', async () => {
  const fake = instalar({ otras: postgrest(datos()) });
  try {
    await (await handler(peticion({ kind: 'chat', message: '¿qué entreno hoy?', stream: false, date: HOY }))).text();
    const c = cuerpo(fake, 0);
    equal(c.model, COACH_MODEL);
    equal(c.tools.length, TOOL_DEFS.length);
    ok(JSON.stringify(c.system).includes('MARCA-DOSSIER'));
    const [run] = runs(fake);
    equal(run.route, 'completa');
    equal(run.intent, 'general');
    equal(run.tools_offered, TOOL_DEFS.length);
  } finally {
    fake.restaurar();
  }
});

Deno.test('L3 modelo: routes.registro del plan manda; sin él, CHEAP_MODEL aunque el plan tenga default', async () => {
  for (const [routes, esperado] of [
    [{ default: 'claude-sonnet-5', profundo: 'claude-sonnet-5' }, CHEAP_MODEL],
    [{ default: 'claude-sonnet-5', registro: 'claude-opus-5' }, 'claude-opus-5'],
  ] as const) {
    const fake = instalar({
      otras: postgrest(datos()),
      rpc: { ai_begin_turn: () => ({ allowed: true, mode: 'estandar', turn_budget: 5_000_000, routes }) },
      proveedor: () => turnoTexto('Anotado.', USO_ESTRECHO, CHEAP_MODEL),
    });
    try {
      await (await handler(peticion({ kind: 'chat', message: 'peso 94,2', stream: false, date: HOY }))).text();
      equal(cuerpo(fake, 0).model, esperado);
      equal(runs(fake)[0].intent, 'dato');
    } finally {
      fake.restaurar();
    }
  }
});

Deno.test('L3 profundo y fotos: el parte va por la ruta completa', async () => {
  const fake = instalar({
    otras: postgrest(datos()),
    rpc: { ai_begin_turn: () => ({ allowed: true, mode: 'profundo', turn_budget: 5_000_000, routes: { profundo: 'claude-sonnet-5' } }) },
  });
  try {
    await (await handler(peticion({ kind: 'chat', message: 'ya he entrenado', stream: false, date: HOY }, { 'x-nivl-mode': 'profundo' }))).text();
    await (await handler(peticion({
      kind: 'chat', message: 'ya he entrenado', stream: false, date: HOY,
      imagenes: [{ media_type: 'image/jpeg', data: 'QUJD' }],
    }))).text();
    const [profundo, conFoto] = runs(fake);
    equal(profundo.route, 'completa');
    equal(conFoto.route, 'completa');
    equal(cuerpo(fake, 0).tools.length, TOOL_DEFS.length);
  } finally {
    fake.restaurar();
  }
});

Deno.test('L3 vueltas: como mucho 3 y la última va a texto (tool_choice none, mismas 4 herramientas)', async () => {
  const fake = instalar({
    otras: postgrest(datos()),
    proveedor: (_b, n) => turnoHerramienta('consultar_dia', { fecha: '' }, `tu_${n}`, USO_ESTRECHO, CHEAP_MODEL),
  });
  try {
    await (await handler(peticion({ kind: 'chat', message: 'ya está hecho', stream: false, date: HOY }))).text();
    equal(fake.proveedor.length, 3);
    equal(cuerpo(fake, 0).tool_choice, undefined);
    deepEqual(cuerpo(fake, 2).tool_choice, { type: 'none' });
    equal(cuerpo(fake, 2).tools.length, PACK_REGISTRO.length);
    equal(runs(fake)[0].iterations, 3);
  } finally {
    fake.restaurar();
  }
});

Deno.test('L3 registrar_dato del pack sí escribe (peso), con el JWT del usuario', async () => {
  const fake = instalar({
    otras: postgrest(datos()),
    proveedor: (_b, n) =>
      n === 0
        ? turnoHerramienta('registrar_dato', { tipo: 'peso', id: '', peso_kg: 94.2, kcal: 0, proteina_g: 0, notas: '' }, 'tu_peso', USO_ESTRECHO, CHEAP_MODEL)
        : turnoTexto('Peso anotado: 94,2 kg.', USO_ESTRECHO, CHEAP_MODEL),
  });
  try {
    await (await handler(peticion({ kind: 'chat', message: 'peso 94,2', stream: false, date: HOY }))).text();
    const pesos = fake.escrituras('body_metrics');
    equal(pesos.length, 1);
    equal(pesos[0].rol, 'user');
    ok(!escriturasAjenas(fake).some((p) => /training_prescriptions|day_plans|day_blocks|quests$/.test(p)));
  } finally {
    fake.restaurar();
  }
});

Deno.test('L3 contexto mínimo: respeta el consentimiento de salud igual que buildContext', async () => {
  const fake = instalar({ otras: postgrest(datos()), rpc: { health_consent_ok: () => false } });
  try {
    await rejects(buildContextMinimo(userClient(USER_TOKEN), USER_ID, HOY), (e: Error) => e.message === HEALTH_REQUIRED);
    ok(!fake.llamadas.some((l) => l.url.pathname === '/rest/v1/gym_sessions'), 'ni se pide el gimnasio');
  } finally {
    fake.restaurar();
  }
});

// ── Coste simulado: el mismo turno por las dos rutas ─────────────────

/** Fichas de entrada estimadas de una petición (sistema + herramientas + mensajes). */
function fichasDe(c: Cuerpo): { sistema: number; herramientas: number; mensajes: number; total: number } {
  const sistema = estimarFichas(c.system.map((b) => b.text).join('\n').length);
  const herramientas = estimarFichas(JSON.stringify(c.tools).length);
  const mensajes = estimarFichas(JSON.stringify(c.messages).length);
  return { sistema, herramientas, mensajes, total: sistema + herramientas + mensajes };
}

Deno.test('L3 coste simulado: «te he subido el gym hoy» estrecho frente a completo, mismos datos', async () => {
  const mensaje = 'te he subido el gym hoy';
  const medir = async (cabeceras: Record<string, string>, rutaForzada: 'registro' | 'completa') => {
    const fake = instalar({ otras: postgrest(datos()), proveedor: () => turnoTexto('Consta.', USO_ESTRECHO) });
    try {
      // La completa se fuerza con una pregunta de cortesía al final (mismo parte, mismos datos).
      const texto = rutaForzada === 'registro' ? mensaje : `${mensaje}, ¿lo ves?`;
      await (await handler(peticion({ kind: 'chat', message: texto, stream: false, date: HOY }, cabeceras))).text();
      equal(runs(fake)[0].route, rutaForzada);
      return { modelo: cuerpo(fake, 0).model, fichas: fichasDe(cuerpo(fake, 0)) };
    } finally {
      fake.restaurar();
    }
  };
  const estrecha = await medir({}, 'registro');
  const completa = await medir({}, 'completa');

  // Una llamada sin caché (peor caso) con ~250 fichas de salida.
  const coste = (m: string, fichas: number) => costMicroUsd(m, { input_tokens: fichas, output_tokens: 250 });
  const cE = coste(estrecha.modelo, estrecha.fichas.total);
  const cC = coste(completa.modelo, completa.fichas.total);
  console.log(
    `\n  ESTRECHA (${estrecha.modelo}): sistema ${estrecha.fichas.sistema} · herramientas ${estrecha.fichas.herramientas}` +
      ` · mensajes ${estrecha.fichas.mensajes} · TOTAL ${estrecha.fichas.total} fichas → ${(cE / 1e6).toFixed(4)} $ por llamada` +
      `\n  COMPLETA (${completa.modelo}): sistema ${completa.fichas.sistema} · herramientas ${completa.fichas.herramientas}` +
      ` · mensajes ${completa.fichas.mensajes} · TOTAL ${completa.fichas.total} fichas → ${(cC / 1e6).toFixed(4)} $ por llamada` +
      `\n  (fichas estimadas a 3 caracteres por ficha, sin caché; dos llamadas por turno con herramienta ≈ doble)`,
  );
  ok(estrecha.fichas.total * 4 < completa.fichas.total, 'la estrecha manda menos de una cuarta parte');
  ok(cE * 2 < 10_000, `dos llamadas estrechas < 0,01 $ (${cE * 2} µ$)`);
});

// ── Regresión del P0 de producción (02/10): Haiku 4.5 y el reintento ──────────
// Con L3 desplegado, «te he subido el gym hoy» devolvía «El sistema no responde»:
// la petición a claude-haiku-4-5 llevaba thinking adaptive + output_config.effort,
// que Haiku 4.5 rechaza con 400 (guía de la API). Clasificar y el titular,
// también en Haiku, fallaban igual en silencio.

Deno.test('P0 Haiku: la petición a Haiku 4.5 no lleva thinking adaptive ni effort; la de Sonnet sí', async () => {
  const fake = instalar({
    otras: postgrest(datos()),
    proveedor: () => turnoTexto('Consta.', USO_ESTRECHO, CHEAP_MODEL),
  });
  try {
    const r = await handler(peticion({ kind: 'chat', message: 'te he subido el gym hoy', stream: false, date: HOY }));
    equal(r.status, 200);
    const b = fake.proveedor[0].body as Record<string, unknown>;
    equal(b.model, CHEAP_MODEL);
    equal(b.thinking, undefined, 'sin thinking para Haiku 4.5');
    equal(b.output_config, undefined, 'sin effort para Haiku 4.5');
  } finally {
    fake.restaurar();
  }
  const { admitePensamientoAdaptativo } = await import('./anthropic.ts');
  ok(!admitePensamientoAdaptativo('claude-haiku-4-5'));
  ok(admitePensamientoAdaptativo(COACH_MODEL));
});

Deno.test('P0 reintento: si el proveedor rechaza la ruta estrecha (400), responde la completa y el mensaje se guarda una sola vez', async () => {
  const fake = instalar({
    otras: postgrest(datos()),
    proveedor: (body: { model: string }) =>
      body.model === CHEAP_MODEL
        ? new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'x' } }), { status: 400 })
        : turnoTexto('Consta: Sentadilla 100×5 hoy.', { input_tokens: 20_000, output_tokens: 300 }, COACH_MODEL),
  });
  try {
    const r = await handler(peticion({ kind: 'chat', message: 'te he subido el gym hoy', stream: false, date: HOY }));
    equal(r.status, 200, 'el usuario no ve un error');
    const respuesta = await r.json() as { text: string };
    ok(respuesta.text.includes('Sentadilla'));
    equal((fake.proveedor[0].body as { model: string }).model, CHEAP_MODEL);
    equal((fake.proveedor.at(-1)!.body as { model: string }).model, COACH_MODEL, 'reintento por la completa');
    const delUsuario = fake.escrituras('coach_messages').filter((l) => JSON.stringify(l.body).includes('"role":"user"'));
    equal(delUsuario.length, 1, 'el mensaje del usuario no se duplica');
    const [run] = runs(fake);
    equal(run.route, 'registro_reintento');
    equal(run.error, null);
  } finally {
    fake.restaurar();
  }
});
