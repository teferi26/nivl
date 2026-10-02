// IA v2 · L1 «Nunca contradecir sin comprobar».
//
// Regresión del fallo reproducido el 02/10: el gladiador dice «te he subido el
// gym» y el coach lo niega sin mirar. Tres causas, tres frentes:
//   · la fecha del turno (el chat no mandaba `date` y el servidor vivía en UTC),
//   · el estado no traía lo registrado hoy (unas dominadas a peso 0 no existían),
//   · las instrucciones empujaban a negar («es que no lo ha registrado»).
//
// Con el handler real y el backend simulado de sec_coach_fake_test.ts. A ese
// fake (que no filtra) se le pone delante, vía `otras`, un PostgREST mínimo que
// sí filtra eq/gte/lte/in para las tablas de este test.

import { equal, ok } from 'node:assert/strict';
import { instalar, peticion, turnoHerramienta, turnoTexto, USER_ID, USER_TOKEN, type Llamada } from './sec_coach_fake_test.ts';
import { buildContext } from './context.ts';
import { buildSystem } from './prompt.ts';
import { userClient } from './db.ts';
import { executeTool, TOOL_DEFS } from './tools.ts';
import { pareceAfirmacion } from './intencion.ts';
import { fechaDelTurno, fechaLocal, reloj } from '../coach/guard.ts';

const { handler } = await import('../coach/handler.ts');

type Fila = Record<string, unknown>;

/** Aplica los filtros de PostgREST que usa la lectura del día. */
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

/** PostgREST que filtra, solo para las tablas de `datos`. */
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
const AYER = '2026-10-02';

/** Una sesión de hoy: sentadilla 100×5 y dominadas a peso corporal (peso 0). */
function conSesion(): Record<string, Fila[]> {
  return {
    gym_sessions: [{ id: 'ses1', user_id: USER_ID, date: HOY, gym_day_id: 'dia1', notes: null }],
    gym_days: [{ id: 'dia1', user_id: USER_ID, name: 'Pierna y tirón' }],
    gym_lifts: [
      { session_id: 'ses1', user_id: USER_ID, exercise_name: 'Sentadilla', weight: 100, reps: 5, set_index: 0 },
      { session_id: 'ses1', user_id: USER_ID, exercise_name: 'Sentadilla', weight: 100, reps: 5, set_index: 1 },
      { session_id: 'ses1', user_id: USER_ID, exercise_name: 'Dominadas', weight: 0, reps: 8, set_index: 2 },
    ],
    cardio_sessions: [],
    body_metrics: [],
    nutrition_logs: [],
    journal_entries: [],
    completions: [],
    quests: [],
  };
}

function sinSesion(): Record<string, Fila[]> {
  return { ...conSesion(), gym_sessions: [], gym_lifts: [], gym_days: [] };
}

const textoDe = (x: unknown) => JSON.stringify(x);

/** El último mensaje de usuario que se envió al proveedor en la llamada n. */
function ultimoUsuario(fake: ReturnType<typeof instalar>, n = 0): string {
  const body = fake.proveedor[n].body as { messages: { role: string; content: unknown }[] };
  const usuarios = body.messages.filter((m) => m.role === 'user');
  return textoDe(usuarios[usuarios.length - 1].content);
}

function fijarReloj(iso: string): () => void {
  const original = reloj.ahora;
  reloj.ahora = () => new Date(iso);
  return () => {
    reloj.ahora = original;
  };
}

// ── (1) Fecha ────────────────────────────────────────────────────────

Deno.test('L1 fecha: con date del móvil, el estado vive en ese día', async () => {
  const soltar = fijarReloj('2026-10-02T22:30:00Z');
  const fake = instalar({ otras: postgrest(conSesion()) });
  try {
    const r = await handler(peticion({ kind: 'chat', message: 'hola', stream: false, date: HOY }));
    await r.text();
    ok(textoDe((fake.proveedor[0].body as { system: unknown }).system).includes(`· ${HOY}`));
  } finally {
    fake.restaurar();
    soltar();
  }
});

Deno.test('L1 fecha: sin date (app 1.0.7), manda la zona del perfil y no UTC', async () => {
  const soltar = fijarReloj('2026-10-02T22:30:00Z'); // 00:30 del 03/10 en Madrid
  const fake = instalar({ otras: postgrest(conSesion()) });
  try {
    const r = await handler(peticion({ kind: 'chat', message: 'hola', stream: false }));
    await r.text();
    const sistema = textoDe((fake.proveedor[0].body as { system: unknown }).system);
    ok(sistema.includes(`ESTADO DEL GLADIADOR · ${HOY}`), 'el día local de Madrid');
    ok(!sistema.includes(`ESTADO DEL GLADIADOR · ${AYER}`), 'no el día UTC');
  } finally {
    fake.restaurar();
    soltar();
  }
});

Deno.test('L1 fecha: funciones puras (zona, tolerancia ±1, zona inválida)', () => {
  const ahora = new Date('2026-10-02T22:30:00Z');
  equal(fechaLocal('Europe/Madrid', ahora), HOY);
  equal(fechaLocal('America/New_York', ahora), AYER);
  equal(fechaLocal('No/Existe', ahora), null);
  equal(fechaDelTurno(undefined, ahora, 'Europe/Madrid'), HOY);
  equal(fechaDelTurno(undefined, ahora, 'No/Existe'), AYER, 'zona inválida → UTC');
  equal(fechaDelTurno(undefined, ahora), AYER, 'sin zona → UTC, como antes');
  equal(fechaDelTurno('2026-10-01', ahora, 'Europe/Madrid'), '2026-10-01', 'la fecha del móvil manda si es válida');
  equal(fechaDelTurno('2025-01-01', ahora, 'Europe/Madrid'), HOY, 'fuera de ±1 día → la zona del perfil');
});

// ── (2) Contexto ─────────────────────────────────────────────────────

Deno.test('L1 contexto: «Registrado hoy» trae la sesión, también las dominadas a peso 0', async () => {
  const fake = instalar({ otras: postgrest(conSesion()) });
  try {
    const ctx = await buildContext(userClient(USER_TOKEN), USER_ID, HOY);
    ok(ctx.text.includes(`## Registrado hoy (${HOY})`));
    ok(ctx.text.includes('Dominadas 0×8'), 'peso corporal visible');
    ok(ctx.text.includes('Sentadilla 100×5, 100×5'));
    ok(ctx.text.includes(`Cardio: ningún cardio con fecha ${HOY}`), 'un módulo vacío lo dice explícito');
  } finally {
    fake.restaurar();
  }
});

Deno.test('L1 contexto: sin sesión, lo dice con la fecha', async () => {
  const fake = instalar({ otras: postgrest(sinSesion()) });
  try {
    const ctx = await buildContext(userClient(USER_TOKEN), USER_ID, HOY);
    ok(ctx.text.includes(`Gimnasio: ninguna sesión con fecha ${HOY}`));
  } finally {
    fake.restaurar();
  }
});

// ── (3) «te he subido el gym» con sesión ─────────────────────────────

Deno.test('L1 de punta a punta: «te he subido el gym» lleva la comprobación y consultar_dia ve la sesión', async () => {
  const soltar = fijarReloj('2026-10-02T22:30:00Z');
  const fake = instalar({
    otras: postgrest(conSesion()),
    // Desde L3 este parte va por la ruta estrecha (freno de 0,05 $): el uso
    // simulado es el de un turno de registro, no el de 50 k fichas de Sonnet.
    proveedor: (_b, n) =>
      n === 0
        ? turnoHerramienta('consultar_dia', { fecha: '' }, 'tu_dia', { input_tokens: 5_000, output_tokens: 200 })
        : turnoTexto('Visto.', { input_tokens: 5_000, output_tokens: 200 }),
  });
  try {
    const r = await handler(peticion({ kind: 'chat', message: 'te he subido el gym', stream: false, date: HOY }));
    await r.text();
    const primero = ultimoUsuario(fake, 0);
    ok(primero.includes(`## Comprobación del sistema (${HOY})`), 'el servidor comprueba antes del modelo');
    ok(primero.includes('Sentadilla 100×5'));
    ok(primero.includes('Dominadas 0×8'));

    const herramientas = (fake.proveedor[0].body as { tools: { name: string }[] }).tools.map((t) => t.name);
    ok(herramientas.includes('consultar_dia'));

    const resultado = ultimoUsuario(fake, 1);
    ok(resultado.includes('tool_result') && resultado.includes('Sentadilla 100×5'), 'consultar_dia devuelve la sesión');

    // La comprobación no se guarda en el hilo: solo lo que dijo él.
    const guardados = fake.escrituras('coach_messages').map((l) => textoDe(l.body));
    ok(guardados.some((g) => g.includes('te he subido el gym')));
    ok(!guardados.some((g) => g.includes('Comprobación del sistema')));
  } finally {
    fake.restaurar();
    soltar();
  }
});

// ── (4) sin sesión ───────────────────────────────────────────────────

const PERMITIDAS = new Set(['/rest/v1/coach_messages', '/rest/v1/coach_threads', '/rest/v1/coach_runs']);

Deno.test('L1 sin sesión: la comprobación lo dice con fechas y el turno no escribe nada', async () => {
  const soltar = fijarReloj('2026-10-02T22:30:00Z');
  const fake = instalar({ otras: postgrest(sinSesion()), proveedor: () => turnoTexto('¿Dónde lo registraste?') });
  try {
    const r = await handler(peticion({ kind: 'chat', message: 'Ya he entrenado, lo he marcado', stream: false, date: HOY }));
    await r.text();
    const primero = ultimoUsuario(fake, 0);
    ok(primero.includes(`Gimnasio: ninguna sesión con fecha ${HOY}`));
    ok(primero.includes(`Gimnasio: ninguna sesión con fecha ${AYER}`), 'también el día anterior');

    const escrituras = fake.llamadas.filter(
      (l) => l.url.pathname.startsWith('/rest/v1/') && !l.url.pathname.startsWith('/rest/v1/rpc/') &&
        l.method !== 'GET' && l.method !== 'HEAD' && !PERMITIDAS.has(l.url.pathname),
    );
    equal(escrituras.length, 0, `escrituras inesperadas: ${escrituras.map((l) => l.url.pathname).join(', ')}`);
    ok(!fake.llamadas.some((l) => /\/rpc\/(complete_quest|award_xp)$/.test(l.url.pathname)), 'sin XP en el turno');
  } finally {
    fake.restaurar();
    soltar();
  }
});

// ── (5) sin consentimiento de salud ──────────────────────────────────

Deno.test('L1 sin consentimiento de salud: «sin acceso por consentimiento», nunca «ninguna»', async () => {
  const fake = instalar({ otras: postgrest(conSesion()), rpc: { health_consent_ok: () => false } });
  try {
    const { leerDiaYAnterior } = await import('./comprobacion.ts');
    const texto = await leerDiaYAnterior(userClient(USER_TOKEN), USER_ID, HOY);
    ok(texto.includes('Gimnasio: sin acceso por consentimiento'));
    ok(!/Gimnasio: ninguna/.test(texto));
    ok(!texto.includes('Sentadilla'), 'sin permiso no se lee la tabla');
    ok(!fake.llamadas.some((l) => l.url.pathname === '/rest/v1/gym_sessions'), 'ni se pide');
    ok(texto.includes('Misiones completadas: ninguna'), 'lo que no es de salud sí se lee');
  } finally {
    fake.restaurar();
  }
});

Deno.test('L1 consultar_dia: fecha explícita y vacía (= hoy del turno)', async () => {
  const fake = instalar({ otras: postgrest(conSesion()) });
  try {
    const ctx = { sb: userClient(USER_TOKEN), userId: USER_ID, today: HOY };
    ok((await executeTool('consultar_dia', { fecha: '' }, ctx)).includes(`Registrado el ${HOY}:`));
    const manana = await executeTool('consultar_dia', { fecha: '2026-10-04' }, ctx);
    ok(manana.includes(`Registrado el ${HOY} (día anterior)`) && manana.includes('Sentadilla 100×5'));
    const def = TOOL_DEFS.find((t) => t.name === 'consultar_dia')!;
    ok(def && !('strict' in def), 'sin strict');
    equal(TOOL_DEFS.length, 26);
  } finally {
    fake.restaurar();
  }
});

// ── (6) estáticos ────────────────────────────────────────────────────

Deno.test('L1 estáticos: la regla es simétrica y ya no empuja a negar', async () => {
  const fake = instalar({ otras: postgrest(conSesion()) });
  try {
    const ctx = await buildContext(userClient(USER_TOKEN), USER_ID, HOY);
    const sistema = textoDe(buildSystem(ctx.dossier, 'chat', ctx.text)).toLowerCase();
    ok(sistema.includes('afirmar o negar'));
    ok(!sistema.includes('es que no lo ha registrado'));
    ok(sistema.includes('compruébalo con consultar_dia'));
    const historial = TOOL_DEFS.find((t) => t.name === 'consultar_historial')!;
    ok(!historial.description.includes('No la uses para lo que ya tienes delante'));
    ok(historial.description.includes('Úsala para comprobar lo que el gladiador dice haber hecho'));
  } finally {
    fake.restaurar();
  }
});

// ── Intención ────────────────────────────────────────────────────────

Deno.test('L1 intención: afirmaciones', () => {
  for (const t of [
    'te he subido el gym',
    'Ya he entrenado',
    'he hecho pierna hoy',
    'lo he marcado',
    'Ya está',
    'ya está hecho',
    'me he pesado: 80,4',
    'me pesé esta mañana',
    'Entrené espalda, ¿lo ves?',
    'acabo de registrar la cena',
    'he corrido 5 km',
    'Hoy he comido 2.300 kcal',
    'fui al gimnasio a las 7',
    'Ya lo subí',
    'no he podido dormir pero he entrenado',
  ]) ok(pareceAfirmacion(t), `debería detectar: «${t}»`);
});

Deno.test('L1 intención: consultas, negaciones y planes no son afirmación', () => {
  for (const t of [
    '¿he entrenado hoy?',
    'he entrenado hoy?',
    '¿Qué he comido esta semana?',
    'no he entrenado',
    'todavía no lo he subido',
    'voy a entrenar a las 7',
    'mañana corro 10 km',
    'cuando acabe te lo subo',
    'si he entrenado tres días, ¿me toca descanso?',
    'hola',
    'pese a todo, sigo',
    '¿ya está el plan de hoy?',
    '',
  ]) ok(!pareceAfirmacion(t), `no debería detectar: «${t}»`);
});
