// IA barata (decisión de Teferi, 21/10/2026): «solucionad todos los problemas, poned IA barata; que nadie
// pase del máximo de IA ni en abuso máximo». Informe: coordinacion-winter-arc/COSTE_IA_ELITE.md.
//
// Lo que se comprueba aquí, sobre el handler REAL con el backend simulado (sec_coach_fake_test.ts):
//   1. Caché: el estado lento va en el sistema y el rápido en el turno; el prefijo estable (herramientas +
//      sistema) tiene el MISMO hash entre turnos seguidos aunque cambie el estado del día; un simulador de
//      caché mide la escritura y el coste por mensaje antes/después.
//   2. Cartera: cada llamada al proveedor va precedida de su reserva y seguida de su liquidación; la
//      reserva es una cota del coste real; sin reserva no hay llamada; error HTTP → se libera; tope a mitad
//      de turno → se contesta con lo que hay.
//   3. Abuso con el handler: muchos dispositivos a la vez contra una cartera simulada atómica de 8 $.
//   4. Atajos de estudio y brief ligero: Haiku y fuera del contexto del coach.
//   5. Solo Anthropic (routing) y las reglas de seguridad nuevas en todos los prompts.

import { deepEqual, equal, ok } from 'node:assert/strict';
import { CARTERA_DE_PRUEBA, instalar, peticion, sse, turnoHerramienta, turnoTexto } from './sec_coach_fake_test.ts';
import { AI_SAFETY_RULES, REGLA_PRODUCTOS_FINANCIEROS, REGLA_RIESGO_SALUD } from './ai-safety.ts';
import {
  callClaude,
  CHEAP_MODEL,
  COACH_MODEL,
  costeMaximo,
  costeMaximoClaude,
  costMicroUsd,
  fichasMaximas,
  FICHAS_POR_IMAGEN,
  type SystemBlock,
} from './anthropic.ts';
import { buildSystemRegistro, partirEstado, REGLA_SIN_GUIONES, SECCIONES_RAPIDAS, SISTEMA_FIJO } from './prompt.ts';
import { soloAnthropic } from './routing.ts';
import { sistemaEstudio, TAREAS_ESTUDIO } from './estudio.ts';
import { esperarSegundoPlano } from './resumenhilo.ts';

const { handler, SISTEMA_BRIEF_LIGERO } = await import('../coach/handler.ts');

type Body = {
  model: string;
  system: SystemBlock[];
  tools?: unknown[];
  max_tokens: number;
  messages: { role: string; content: unknown }[];
};

const sha256 = async (x: unknown) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(x))))]
    .map((b) => b.toString(16).padStart(2, '0')).join('');

// ── 1. Estado lento / rápido ───────────────────────────────────────────

Deno.test('caché: partirEstado manda al turno solo lo que cambia en el día', () => {
  const estado = [
    '# ESTADO DEL GLADIADOR · 2026-10-21', '', 'Nombre: Ana · Nivel 3 · 420 XP totales', '',
    '## Para qué está aquí (lo escribió y lo firmó al entrar)', 'Objetivo: 10 clientes', '',
    '## Misiones activas · adherencia real de 30 días', '- [q1] "Leer" · HECHA HOY', '',
    '## Registrado hoy (2026-10-21)', '- peso 80', '',
    '## Los últimos 14 días, uno a uno', '- L 10-20 · 3/3', '',
    '## Plan de hoy (activo)', '- 07:00-08:00 Gym', '',
    '## Contrato (reglas innegociables)', '- [r1] "Sin móvil" · CUMPLIDA HOY', '',
    '## Agenda próxima', '- cita', '',
    '## Registro reciente', '- (2026-10-21) [dato] peso 80', '',
    '# ESTUDIO DEL GLADIADOR', '## Fuerza (1RM estimado, Epley)', '- banca 90',
  ].join('\n');
  const { lento, rapido } = partirEstado(estado);
  for (const s of SECCIONES_RAPIDAS.filter((x) => estado.includes(x))) {
    ok(rapido.includes(s) && !lento.includes(s), s);
  }
  ok(rapido.startsWith('# ESTADO DEL GLADIADOR · 2026-10-21'), 'la cabecera fechada (XP, racha) es rápida');
  for (const s of ['## Para qué está aquí', '## Los últimos 14 días', '## Agenda próxima', '# ESTUDIO DEL GLADIADOR', '## Fuerza']) {
    ok(lento.includes(s) && !rapido.includes(s), s);
  }
  ok(!/\b2026-10-21\b/.test(lento.replace('(2026-10-21)', '')), 'el lento no lleva la fecha de hoy');
  deepEqual(partirEstado(estado), partirEstado(estado), 'determinista');
});

// Un simulador de la caché de Anthropic (el mismo modelo que ia2_cache_test.ts): prefijo exacto en orden
// tools → system → messages; una entrada por punto marcado; se lee la entrada viva más larga que case; se
// escribe desde ahí hasta el último punto; 5 min. Fichas ≈ caracteres / 4.
interface Seg { clave: string; fichas: number; marca: boolean }
function segmentos(body: Body): Seg[] {
  const out: Seg[] = [];
  let acumulado = '';
  const meter = (x: unknown, marca: boolean) => {
    const s = JSON.stringify(x);
    acumulado += s;
    out.push({ clave: acumulado, fichas: Math.ceil(s.length / 4), marca });
  };
  for (const t of body.tools ?? []) meter(t, false);
  for (const b of body.system) meter(b.text, !!b.cache_control);
  for (const m of body.messages) {
    const bloques = Array.isArray(m.content) ? (m.content as Record<string, unknown>[]) : [{ text: m.content }];
    for (const b of bloques) {
      const { cache_control, ...resto } = b;
      meter({ role: m.role, ...resto }, !!cache_control);
    }
  }
  return out;
}
class Cache {
  vivas = new Map<string, number>();
  peticion(body: Body, t: number) {
    const segs = segmentos(body);
    const marcas = segs.map((s, i) => (s.marca ? i : -1)).filter((i) => i >= 0);
    const ultima = marcas.at(-1) ?? -1;
    let leido = -1;
    for (let i = ultima; i >= 0; i--) {
      const vence = this.vivas.get(segs[i].clave);
      if (vence && vence > t) {
        leido = i;
        this.vivas.set(segs[i].clave, t + 300_000);
        break;
      }
    }
    const f = (a: number, b: number) => segs.slice(a, b + 1).reduce((x, s) => x + s.fichas, 0);
    let escrito = 0;
    let previa = leido;
    for (const m of marcas) {
      if (m <= leido) continue;
      escrito += f(previa + 1, m);
      this.vivas.set(segs[m].clave, t + 300_000);
      previa = m;
    }
    return { leido: f(0, leido), escrito, entrada: f(ultima + 1, segs.length - 1) };
  }
}
/** Dólares de un mensaje de Sonnet 5: entrada 2 $, lectura 0,2 $, escritura 2,5 $, salida 10 $/M (650 de salida, lo medido). */
const usdMensaje = (r: { leido: number; escrito: number; entrada: number }) =>
  (r.entrada * 2 + r.leido * 0.2 + r.escrito * 2.5 + 650 * 10) / 1e6;

/** "Antes": la misma petición con el estado rápido metido en el sistema (delante del historial) y sin punto en el turno. */
function comoAntes(body: Body): Body {
  const messages = body.messages.map((m) => ({ ...m, content: Array.isArray(m.content) ? [...m.content as Record<string, unknown>[]] : m.content }));
  const turno = messages.at(-1)!.content as Record<string, unknown>[];
  const rapido = turno.find((b) => typeof b.text === 'string' && (b.text as string).includes('# AHORA MISMO'));
  const system = body.system.map((b) => ({ ...b }));
  if (rapido) {
    const i = system.length - 1;
    system[i] = { type: 'text', text: `${system[i].text}\n${rapido.text}`, cache_control: { type: 'ephemeral' } };
    turno.splice(turno.indexOf(rapido), 1);
  }
  messages[messages.length - 1] = { ...messages.at(-1)!, content: turno.map(({ cache_control: _c, ...b }) => b) };
  return { ...body, system, messages };
}

// Memoria + estudios (lo lento, ~20 k fichas) y misiones de hoy (lo rápido), como en la cuenta medida.
const DOSSIER = 'Dato estable de la memoria y del estudio del gladiador. '.repeat(1_450);
const QUESTS = Array.from({ length: 25 }, (_, i) => ({
  id: `q-${i}`, title: `Misión diaria número ${i} con su descripción`, stat: 'INT', difficulty: 'media',
  days_of_week: [1, 2, 3, 4, 5, 6, 7], active: true,
}));

async function turno(historia: { role: string; content: unknown; created_at: string }[], xp: number, hechas: number): Promise<Body> {
  const fake = instalar({
    filas: {
      coach_dossier: [{ content: DOSSIER }],
      coach_messages: [...historia].reverse(),
      quests: QUESTS,
      completions: QUESTS.slice(0, hechas).map((q) => ({ quest_id: q.id, date: '2026-10-21' })),
      profiles: [{
        id: '00000000-0000-4000-8000-0000000000c1', name: 'Gladiador', timezone: 'Europe/Madrid', wake_time: '07:00',
        sleep_time: '23:00', coach_mode: 'A', xp_total: xp, streak_days: 3, protection_stones: 0, bonus_points: 0, profile_kind: 'general',
      }],
    },
  });
  try {
    await (await handler(peticion({ kind: 'chat', message: `mensaje ${historia.length}`, stream: false, date: '2026-10-21' }))).text();
    return fake.proveedor[0].body as Body;
  } finally {
    await esperarSegundoPlano();
    fake.restaurar();
  }
}

Deno.test('caché: prefijo estable con el mismo hash entre turnos; coste por mensaje antes/después (informe)', async () => {
  const h: { role: string; content: unknown; created_at: string }[] = [];
  const cuerpos: Body[] = [];
  for (let n = 0; n < 4; n++) {
    // Entre turno y turno el estado del día cambia: marca una misión más y gana XP.
    cuerpos.push(await turno(h, 400 + n * 50, n));
    h.push({ role: 'user', content: [{ type: 'text', text: `mensaje ${h.length}` }], created_at: `2026-10-21T10:0${n}:00Z` });
    h.push({ role: 'assistant', content: [{ type: 'text', text: `Respuesta ${n}: vas bien, sigue con la siguiente.` }], created_at: `2026-10-21T10:0${n}:30Z` });
  }
  // El prefijo estable (herramientas + sistema) es idéntico byte a byte entre turnos: se lee de la caché.
  const hashes = await Promise.all(cuerpos.map((b) => sha256({ tools: b.tools, system: b.system })));
  equal(new Set(hashes).size, 1, 'el mismo hash de prefijo en los cuatro turnos');
  // El estado rápido sí ha cambiado entre turnos (está en el turno, no en el prefijo).
  const rapido = (b: Body) => JSON.stringify(b.messages.at(-1)!.content);
  ok(rapido(cuerpos[1]) !== rapido(cuerpos[2]) && rapido(cuerpos[2]).includes('HECHA HOY'));
  ok(!JSON.stringify(cuerpos[2].system).includes('HECHA HOY'), 'el sistema no lleva el estado de hoy');

  const antes = new Cache();
  const despues = new Cache();
  const filas: string[] = [];
  let sumaAntes = 0;
  let sumaDespues = 0;
  cuerpos.forEach((b, i) => {
    const t = i * 120_000; // un mensaje cada 2 minutos
    const ra = antes.peticion(comoAntes(b), t);
    const rd = despues.peticion(b, t);
    if (i > 0) {
      sumaAntes += usdMensaje(ra);
      sumaDespues += usdMensaje(rd);
    }
    filas.push(`turno ${i + 1}: escritura ${ra.escrito} → ${rd.escrito} fichas · lectura ${ra.leido} → ${rd.leido} · ` +
      `${usdMensaje(ra).toFixed(4)} $ → ${usdMensaje(rd).toFixed(4)} $`);
  });
  const mediaAntes = sumaAntes / 3;
  const mediaDespues = sumaDespues / 3;
  console.log(`\n  prefijo estable sha256 ${hashes[0].slice(0, 16)}…\n  ${filas.join('\n  ')}\n` +
    `  mensaje seguido (turnos 2-4): ${mediaAntes.toFixed(4)} $ → ${mediaDespues.toFixed(4)} $ (Sonnet 5, 650 fichas de salida)`);
  ok(mediaDespues < mediaAntes * 0.5, 'un mensaje seguido cuesta menos de la mitad');
  ok(mediaDespues < 0.035, `objetivo del informe: ~0,03 $ por mensaje seguido (${mediaDespues.toFixed(4)} $)`);
});

// ── 2. La cartera en el handler ────────────────────────────────────────

/** Una cartera simulada y ATÓMICA (el RPC del fake corre de una vez: no hay await entre mirar y apuntar). */
function carteraSimulada(topeMicro: number) {
  const cargos = new Map<string, { reservado: number; real: number | null }>();
  let n = 0;
  const comprometido = () => [...cargos.values()].reduce((a, c) => a + (c.real ?? c.reservado), 0);
  const eventos: string[] = [];
  return {
    cargos,
    eventos,
    comprometido,
    rpc: {
      ai_puede: () => ({ ok: comprometido() + 20_000 <= topeMicro, motivo: comprometido() + 20_000 <= topeMicro ? null : 'tope_mes' }),
      ai_reservar: (a: { p_micro: number }) => {
        if (comprometido() + a.p_micro > topeMicro) return { ok: false, motivo: 'tope_mes' };
        const id = `c${n++}`;
        cargos.set(id, { reservado: a.p_micro, real: null });
        eventos.push(`reserva:${id}`);
        return { ok: true, id };
      },
      ai_liquidar: (a: { p_id: string; p_real: number }) => {
        const c = cargos.get(a.p_id);
        if (!c || c.real !== null) return { ok: false };
        c.real = a.p_real;
        eventos.push(`liquida:${a.p_id}`);
        return { ok: true };
      },
    },
  };
}

Deno.test('cartera: cada llamada reserva antes y liquida después; la reserva es una cota del coste real', async () => {
  const w = carteraSimulada(50_000_000);
  const fake = instalar({
    rpc: w.rpc,
    proveedor: (_b, n) => {
      w.eventos.push(`llamada:${n}`);
      return n === 0
        ? turnoHerramienta('consultar_historial', { que: 'peso', desde: '2026-01-01', hasta: '2026-01-02', filtro: '' }, 'tu1', { input_tokens: 30_000, output_tokens: 300 })
        : turnoTexto('Vas bien.', { input_tokens: 32_000, output_tokens: 400 });
    },
  });
  try {
    const r = await handler(peticion({ kind: 'chat', message: '¿cómo voy de peso esta semana?', stream: false }));
    equal(r.status, 200);
    await r.text();
    deepEqual(w.eventos, ['reserva:c0', 'llamada:0', 'liquida:c0', 'reserva:c1', 'llamada:1', 'liquida:c1']);
    for (const [i, c] of [...w.cargos.values()].entries()) {
      const body = fake.proveedor[i].body as Body;
      ok(c.real !== null && c.real <= c.reservado, `real ${c.real} <= reservado ${c.reservado}`);
      // La cota cubre la petición entera a precio de escritura y la salida máxima.
      ok(c.reservado >= costeMaximo(body.model, new TextEncoder().encode(JSON.stringify({ system: body.system, messages: body.messages, tools: body.tools })).length, body.max_tokens));
    }
  } finally {
    await esperarSegundoPlano();
    fake.restaurar();
  }
});

Deno.test('cartera: sin reserva no sale ni un byte; la puerta da 402 con su motivo', async () => {
  for (const [motivo, status, reason] of [['tope_mes', 402, 'presupuesto_agotado'], ['ritmo_diario', 402, 'ritmo_diario'], ['tope_funcion', 429, 'tope_funcion']] as const) {
    const fake = instalar({ rpc: { ai_puede: () => ({ ok: false, motivo, renueva: '2026-11-01' }) } });
    try {
      const r = await handler(peticion({ kind: 'chat', message: 'hola', stream: true }));
      equal(r.status, status, motivo);
      const body = await r.json();
      equal(body.reason, reason);
      ok(!/[—–]/.test(body.error), 'sin guion largo');
      equal(fake.proveedor.length, 0);
    } finally {
      fake.restaurar();
    }
  }
  // La puerta dejó pasar, pero la reserva no cabe (otra petición se llevó el saldo): tampoco hay llamada.
  const fake = instalar({ rpc: { ai_reservar: () => ({ ok: false, motivo: 'tope_mes' }) } });
  try {
    const r = await handler(peticion({ kind: 'chat', message: 'hola', stream: false }));
    equal(r.status, 402);
    equal(fake.proveedor.length, 0);
  } finally {
    fake.restaurar();
  }
});

Deno.test('cartera: error HTTP del proveedor libera la reserva; tope a mitad de turno contesta con lo que hay', async () => {
  {
    const w = carteraSimulada(50_000_000);
    const fake = instalar({ rpc: w.rpc, proveedor: () => new Response('sobrecargado', { status: 529 }) });
    try {
      await (await handler(peticion({ kind: 'chat', message: 'hola', stream: false }))).text();
      ok([...w.cargos.values()].every((c) => c.real === 0), 'no cobró: liberada');
    } finally {
      fake.restaurar();
    }
  }
  {
    let reservas = 0;
    const fake = instalar({
      rpc: { ai_reservar: () => (reservas++ === 0 ? { ok: true, id: 'r0' } : { ok: false, motivo: 'tope_mes' }) },
      proveedor: () => turnoHerramienta('consultar_historial', { que: 'peso', desde: '2026-01-01', hasta: '2026-01-02', filtro: '' }),
    });
    try {
      const r = await handler(peticion({ kind: 'chat', message: 'repasa mi peso de este mes', stream: false }));
      equal(r.status, 200);
      ok(String((await r.json()).text).includes('tope de IA'));
      equal(fake.proveedor.length, 1, 'la segunda vuelta no se llama');
    } finally {
      await esperarSegundoPlano();
      fake.restaurar();
    }
  }
});

// ── 3. Abuso con el handler ────────────────────────────────────────────

Deno.test('abuso: 10 dispositivos × 40 peticiones a la vez, reintentos y fallos a mitad, contra un tope de 8 $', async () => {
  const TOPE = 8_000_000;
  const w = carteraSimulada(TOPE);
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648);
  const fake = instalar({
    rpc: w.rpc,
    proveedor: (body: Body) => {
      // Coste real aleatorio: hasta toda la entrada sin caché y toda la salida máxima permitida.
      const entrada = Math.floor(azar() * new TextEncoder().encode(JSON.stringify(body)).length / 3);
      const salida = Math.floor(azar() * body.max_tokens);
      const x = azar();
      if (x < 0.1) return new Response('error', { status: 500 });                     // no cobra
      if (x < 0.15) return sse([{ type: 'message_start', message: { model: body.model, usage: { input_tokens: entrada } } }]); // cortado a medias
      return turnoTexto('ok', { input_tokens: entrada, output_tokens: salida }, body.model);
    },
  });
  try {
    const dispositivo = async (d: number) => {
      for (let i = 0; i < 40; i++) {
        const profundo = azar() < 0.15;
        const r = await handler(peticion({ kind: 'chat', message: `dispositivo ${d}, petición ${i}: ¿qué hago ahora?`, stream: azar() < 0.5 },
          profundo ? { 'x-nivl-mode': 'profundo' } : {}));
        await r.text();
      }
    };
    await Promise.all(Array.from({ length: 10 }, (_, d) => dispositivo(d)));
    await esperarSegundoPlano();
    const total = w.comprometido();
    const exceso = [...w.cargos.values()].filter((c) => c.real !== null && c.real > c.reservado).length;
    console.log(`\n  ${w.cargos.size} reservas, ${fake.proveedor.length} llamadas; comprometido ${total} / ${TOPE} µ$; cargos por encima de su reserva: ${exceso}`);
    ok(total <= TOPE, `${total} <= ${TOPE}`);
    equal(exceso, 0);
    ok(total > TOPE * 0.8, 'el abuso llega cerca del tope (el test es real)');
  } finally {
    fake.restaurar();
  }
});

Deno.test('cota: fichasMaximas cuenta las imágenes por su tope, no por su base64', () => {
  const foto = { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'A'.repeat(500_000) } };
  const n = fichasMaximas({ messages: [{ role: 'user', content: [foto, { type: 'text', text: 'hola' }] }] });
  ok(n < 10_000 && n >= FICHAS_POR_IMAGEN, `${n}`);
  const sys: SystemBlock[] = [{ type: 'text', text: 'x'.repeat(1000), cache_control: { type: 'ephemeral', ttl: '1h' } }];
  ok(costeMaximoClaude(COACH_MODEL, { system: sys, messages: [], maxTokens: 100 }) > costeMaximoClaude(COACH_MODEL, { system: [{ type: 'text', text: 'x'.repeat(1000) }], messages: [], maxTokens: 100 }),
    'con un punto de 1 h, la entrada se cota a 2×');
});

// ── 4. Atajos de estudio y brief ligero ───────────────────────────────

Deno.test('estudio: Haiku, sin dossier ni herramientas, con su cartera, y la respuesta en JSON', async () => {
  let reservas: { p_funcion: string }[] = [];
  const fake = instalar({
    rpc: { ai_reservar: (a: { p_funcion: string }) => { reservas.push(a); return { ok: true, id: 'e1' }; } },
    filas: { coach_dossier: [{ content: 'MEMORIA_SECRETA_DEL_DOSSIER' }] },
    proveedor: () => turnoTexto('[{"frente":"¿Qué es la mitosis?","dorso":"División celular"}]', { input_tokens: 900, output_tokens: 120 }, CHEAP_MODEL),
  });
  try {
    const r = await handler(peticion({ kind: 'estudio', tarea: 'flashcards', texto: 'La mitosis es la división celular...' }));
    equal(r.status, 200);
    deepEqual((await r.json()).resultado, [{ frente: '¿Qué es la mitosis?', dorso: 'División celular' }]);
    const b = fake.proveedor[0].body as Body;
    equal(b.model, CHEAP_MODEL);
    equal(b.tools, undefined, 'sin herramientas');
    ok(!JSON.stringify(b).includes('MEMORIA_SECRETA_DEL_DOSSIER'), 'sin el dossier');
    equal(fake.llamadas.some((l) => l.url.pathname.endsWith('/coach_dossier')), false, 'ni lo lee');
    deepEqual(reservas.map((x) => x.p_funcion), ['estudio']);
    ok(costMicroUsd(CHEAP_MODEL, { input_tokens: 900, output_tokens: 120 }) < 2_000, 'menos de 0,002 $');
    reservas = [];
    equal((await handler(peticion({ kind: 'estudio', tarea: 'inventada', texto: 'x' }))).status, 400);
  } finally {
    fake.restaurar();
  }
});

Deno.test('brief ligero: con el plan ya escrito, Haiku sin herramientas ni historial; sin plan, el de siempre sin historial', async () => {
  const planHoy = { day_plans: [{ id: 'p1' }], day_blocks: [{ start_min: 420, end_min: 480, title: 'Gimnasio', done: false }] };
  {
    const fake = instalar({ filas: { ...planHoy, coach_messages: [{ role: 'user', content: [{ type: 'text', text: 'CHARLA_DE_AYER' }] }] },
      proveedor: () => turnoTexto('07:00 Gimnasio. Empieza.', { input_tokens: 2_000, output_tokens: 150 }, CHEAP_MODEL) });
    try {
      const r = await handler(peticion({ kind: 'brief', stream: false, date: '2026-10-21' }));
      equal(r.status, 200);
      const b = fake.proveedor[0].body as Body;
      equal(fake.proveedor.length, 1);
      equal(b.model, CHEAP_MODEL);
      equal(b.tools, undefined);
      ok(JSON.stringify(b).includes('Gimnasio') && !JSON.stringify(b).includes('CHARLA_DE_AYER'));
      ok(b.system[0].text.startsWith(SISTEMA_BRIEF_LIGERO));
    } finally {
      fake.restaurar();
    }
  }
  {
    const fake = instalar({ filas: { coach_messages: [{ role: 'user', content: [{ type: 'text', text: 'CHARLA_DE_AYER' }] }] } });
    try {
      await (await handler(peticion({ kind: 'brief', stream: false, date: '2026-10-21' }))).text();
      const b = fake.proveedor[0].body as Body;
      equal(b.model, COACH_MODEL, 'sin plan, decide: el coach');
      ok((b.tools ?? []).length > 10);
      ok(!JSON.stringify(b.messages).includes('CHARLA_DE_AYER'), 'el ritual no arrastra el historial del chat');
    } finally {
      fake.restaurar();
    }
  }
});

// ── 5. Solo Anthropic y reglas de seguridad ───────────────────────────

Deno.test('routing: solo modelos de Anthropic; cualquier otro cae al modelo barato de Anthropic', () => {
  deepEqual(soloAnthropic('claude-sonnet-5', CHEAP_MODEL), { model: 'claude-sonnet-5', bloqueado: false });
  for (const otro of ['deepseek-v4-flash', 'deepseek-flash', 'gpt-5', 'gemini-2.5-pro', 'qwen-plus', ' DeepSeek-chat ', '']) {
    deepEqual(soloAnthropic(otro, CHEAP_MODEL), { model: CHEAP_MODEL, bloqueado: true }, otro);
  }
});

Deno.test('seguridad: nunca productos financieros concretos y 024/112 ante riesgo, en todos los prompts', async () => {
  ok(/fondos, acciones, ETF, criptomonedas, préstamos/.test(REGLA_PRODUCTOS_FINANCIEROS));
  ok(REGLA_RIESGO_SALUD.includes('024') && REGLA_RIESGO_SALUD.includes('112'));
  ok(AI_SAFETY_RULES.includes(REGLA_PRODUCTOS_FINANCIEROS) && AI_SAFETY_RULES.includes(REGLA_RIESGO_SALUD));
  ok(SISTEMA_FIJO.includes(AI_SAFETY_RULES), 'coach completo (parte fija)');
  ok(buildSystemRegistro('estado').some((b) => b.text.includes(REGLA_PRODUCTOS_FINANCIEROS) && b.text.includes(REGLA_RIESGO_SALUD)), 'ruta de registro');
  for (const t of TAREAS_ESTUDIO) ok(sistemaEstudio(t).includes(REGLA_RIESGO_SALUD), `estudio ${t}`);
  ok(!/[—–]/.test(REGLA_PRODUCTOS_FINANCIEROS + REGLA_RIESGO_SALUD + SISTEMA_BRIEF_LIGERO.replace(REGLA_SIN_GUIONES, '')), 'sin guion largo (salvo la regla que lo prohíbe)');
  // Y llegan de verdad al proveedor en la petición del brief ligero y de la prueba de una llamada suelta.
  const fake = instalar({ filas: { day_plans: [{ id: 'p1' }], day_blocks: [{ start_min: 420, end_min: 480, title: 'Gym' }] } });
  try {
    await (await handler(peticion({ kind: 'brief', stream: false }))).text();
    ok(JSON.stringify(fake.proveedor[0].body).includes('024'));
    await callClaude({ system: [{ type: 'text', text: AI_SAFETY_RULES }], messages: [{ role: 'user', content: 'x' }], cartera: CARTERA_DE_PRUEBA });
    ok(CARTERA_DE_PRUEBA.reservas.length > 0, 'también una llamada suelta pasa por la cartera');
  } finally {
    fake.restaurar();
  }
});

// ── 6. Recarga: solo de la información de cliente verificada ──────────

Deno.test('recarga: parseRecargas solo da crédito a nivl_ia_recarga_1 bien formada y respeta la política de sandbox', async () => {
  const { parseRecargas } = await import('./store-reconcile.ts');
  const U = '00000000-0000-4000-8000-0000000000c1';
  const info = {
    subscriber: {
      non_subscriptions: {
        nivl_ia_recarga_1: [
          { id: 'rc1', store_transaction_id: 'tx-apple-1', store: 'app_store', is_sandbox: false, purchase_date: '2026-10-21T10:00:00Z' },
          { id: 'rc2', store: 'play_store', is_sandbox: true, purchase_date: '2026-10-21T11:00:00Z' },
          { id: 'rc3', store: 'stripe', is_sandbox: false, purchase_date: '2026-10-21T11:00:00Z' },
          { id: 'rc4', store: 'app_store', is_sandbox: false, purchase_date: 'no es fecha' },
          'basura',
        ],
        otro_producto: [{ id: 'x', store: 'app_store', is_sandbox: false, purchase_date: '2026-10-21T10:00:00Z' }],
      },
    },
  };
  deepEqual(parseRecargas(info, U).map((c) => [c.id, c.store, c.sandbox]), [['tx-apple-1', 'app_store', false], ['rc2', 'play_store', true]]);
  deepEqual(parseRecargas(info, U, () => false).map((c) => c.id), ['tx-apple-1'], 'sin sandbox para esta cuenta');
  deepEqual(parseRecargas({ subscriber: {} }, U), []);
  deepEqual(parseRecargas(null, U), []);
});
