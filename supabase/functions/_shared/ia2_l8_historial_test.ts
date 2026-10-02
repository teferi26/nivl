// NIVL · Coach v2 · L8 «historial ligero» (ruta completa).
//
// Medido el 02/10 con Sonnet: ~40.700 fichas escritas en caché por turno, sin
// lecturas (los turnos van separados por horas). Con el resumen del hilo (L4)
// el historial ya no tiene que cargar con la memoria: lo que viaja es poco y
// solo texto.
//
//   · Ventana de 6 filas con resumen al día; sin resumen (o con el resumen
//     atrasado) el tope de antes, 12, para no perder nada.
//   · El resumen compacta a partir de 6 mensajes nuevos.
//   · Mensajes ANTERIORES al turno: sin tool_use, tool_result ni pensamiento;
//     el asistente recortado a 1.500 caracteres; alternancia user/assistant
//     garantizada y el primero siempre del usuario.
//   · El bucle de herramientas del turno ACTUAL no se toca.
//
// Con el arnés sec_coach_fake_test.ts: nada sale a la red.

import { assert as ok, assertEquals as equal } from 'jsr:@std/assert@1';
import { instalar, peticion, turnoHerramienta, turnoTexto, USER_ID, type Llamada } from './sec_coach_fake_test.ts';
import { handler } from '../coach/handler.ts';
import { CHEAP_MODEL, estimarFichas, type ApiMessage } from './anthropic.ts';
import {
  esperarSegundoPlano,
  MANTENER_RECIENTES,
  MIN_NUEVOS,
  seleccionarParaResumir,
  VENTANA_HISTORIAL,
} from './resumenhilo.ts';

type Fila = Record<string, unknown>;

// ── PostgREST de juguete (eq, gt, is, orden y límite) ───────────────────

function filtrar(filas: Fila[], p: URLSearchParams): Fila[] {
  let out = filas.slice();
  for (const [k, v] of p) {
    if (['select', 'order', 'limit'].includes(k)) continue;
    const i = v.indexOf('.');
    const op = v.slice(0, i);
    const arg = v.slice(i + 1);
    out = out.filter((f) => {
      const x = f[k] === null || f[k] === undefined ? null : String(f[k]);
      if (op === 'eq') return x === arg;
      if (op === 'gt') return x !== null && x > arg;
      if (op === 'is') return arg === 'null' ? x === null : x === arg;
      return true;
    });
  }
  const orden = p.get('order');
  if (orden) {
    const [col, dir] = orden.split('.');
    out.sort((a, b) => String(a[col] ?? '').localeCompare(String(b[col] ?? '')) * (dir === 'desc' ? -1 : 1));
  }
  const lim = Number(p.get('limit'));
  return lim > 0 ? out.slice(0, lim) : out;
}

function postgrest(datos: Record<string, Fila[]>) {
  return (c: Llamada): Response | undefined => {
    if (c.method !== 'GET') return undefined;
    const tabla = /^\/rest\/v1\/([^/]+)$/.exec(c.url.pathname)?.[1];
    if (!tabla || !(tabla in datos)) return undefined;
    const filas = filtrar(datos[tabla], c.url.searchParams);
    if ((c.headers.get('accept') ?? '').includes('vnd.pgrst.object')) {
      return filas.length
        ? new Response(JSON.stringify(filas[0]), { status: 200, headers: { 'content-type': 'application/json' } })
        : new Response(JSON.stringify({ code: 'PGRST116', message: 'no rows' }), { status: 406 });
    }
    return new Response(JSON.stringify(filas), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}

const HILO = 'hilo-l8';
const hora = (n: number) => `2026-10-01T10:${String(n).padStart(2, '0')}:00+00:00`;
const RESUMEN = '- Acordó entrenar L-X-V a las 7:00.\n- Sentadilla 100×5 el 30/09.';

function datos(hilo: Fila, msgs: Fila[], extra: Record<string, Fila[]> = {}): Record<string, Fila[]> {
  return {
    coach_threads: [{ id: HILO, user_id: USER_ID, archived: false, last_message_at: hora(59), ...hilo }],
    coach_messages: msgs,
    ...extra,
  };
}

const fila = (n: number, role: string, content: unknown): Fila => ({
  thread_id: HILO, user_id: USER_ID, role, content, created_at: hora(n),
});

/** Texto de exactamente n caracteres, con una marca al principio. */
const largo = (marca: string, n: number) => (marca + ' ' + 'serie con buena técnica y descanso medido. '.repeat(Math.ceil(n / 40))).slice(0, n);

/** Un turno viejo CON herramientas (4 filas): pregunta, tool_use, tool_result, respuesta. */
function turnoConHerramientas(desde: number, marca: string): Fila[] {
  return [
    fila(desde, 'user', [{ type: 'text', text: `${marca}-PREGUNTA ¿cómo va mi sentadilla?` }]),
    fila(desde + 1, 'assistant', [
      { type: 'thinking', thinking: `${marca}-PIENSA dudas internas`, signature: 'firma' },
      { type: 'text', text: `${marca}-MIRO Voy a mirarlo.` },
      { type: 'tool_use', id: `tu_${marca}`, name: 'consultar_historial', input: { que: 'gym', desde: '2026-09-01', hasta: '2026-09-30', filtro: '' } },
    ]),
    fila(desde + 2, 'user', [{ type: 'tool_result', tool_use_id: `tu_${marca}`, content: `${marca}-RESULTADO Sentadilla 100×5` }]),
    fila(desde + 3, 'assistant', [{ type: 'text', text: `${marca}-RESPUESTA Vas bien: 100×5.` }]),
  ];
}

/** Un turno viejo de solo texto (2 filas). */
function turnoTextoViejo(desde: number, marca: string, largoRespuesta = 60): Fila[] {
  return [
    fila(desde, 'user', [{ type: 'text', text: `${marca}-PREGUNTA ¿y el peso?` }]),
    fila(desde + 1, 'assistant', [{ type: 'text', text: largo(`${marca}-RESPUESTA`, largoRespuesta) }]),
  ];
}

interface Cuerpo {
  system: { text: string; cache_control?: unknown }[];
  tools: unknown[];
  messages: ApiMessage[];
}

const cuerpo = (fake: ReturnType<typeof instalar>, n = 0) => fake.proveedor[n].body as Cuerpo;
const esHaiku = (body: any) => String(body?.model ?? '').startsWith('claude-haiku');

function proveedorTexto() {
  return (body: any) =>
    esHaiku(body)
      ? turnoTexto(RESUMEN, { input_tokens: 3_000, output_tokens: 200 }, CHEAP_MODEL)
      : turnoTexto('Entendido.', { input_tokens: 20_000, output_tokens: 300 });
}

/** La API exige: primero el usuario y luego alternancia estricta. */
function alternanciaValida(msgs: ApiMessage[]): boolean {
  if (!msgs.length || msgs[0].role !== 'user') return false;
  return msgs.every((m, i) => i === 0 || m.role !== msgs[i - 1].role);
}

const tiposDe = (msgs: ApiMessage[]) =>
  msgs.flatMap((m) => (Array.isArray(m.content) ? (m.content as { type: string }[]).map((b) => b.type) : ['text']));

async function turno(d: Record<string, Fila[]>, message = '¿cómo voy?', proveedor?: (b: any, n: number) => Response) {
  const fake = instalar({ otras: postgrest(d), proveedor: proveedor ?? proveedorTexto() });
  const res = await handler(peticion({ kind: 'chat', message, stream: false }));
  await res.text();
  await esperarSegundoPlano();
  return fake;
}

// ── (a) Historial viejo con herramientas: solo texto y alternancia válida ──

Deno.test('L8 (a): los mensajes viejos con tool_use/tool_result/thinking llegan solo como texto y la alternancia es válida', async () => {
  // Sin resumen: dos turnos con herramientas + uno de texto (10 filas).
  const msgs = [...turnoConHerramientas(0, 'T1'), ...turnoTextoViejo(4, 'T2'), ...turnoConHerramientas(6, 'T3')];
  const fake = await turno(datos({}, msgs));
  try {
    const body = cuerpo(fake);
    const previos = body.messages.slice(0, -1);
    const tipos = tiposDe(previos);
    ok(tipos.every((t) => t === 'text'), `solo texto en el historial viejo: ${tipos.join(',')}`);
    ok(alternanciaValida(body.messages), JSON.stringify(body.messages.map((m) => m.role)));
    const texto = JSON.stringify(previos);
    ok(!texto.includes('PIENSA'), 'sin pensamiento');
    ok(!texto.includes('-RESULTADO'), 'sin el contenido de los tool_result');
    ok(texto.includes('T1-PREGUNTA') && texto.includes('T1-RESPUESTA') && texto.includes('T3-RESPUESTA'), 'el texto sigue');
    ok(texto.includes('[usó consultar_historial]'), 'queda constancia de qué herramienta se usó');
    // Un turno de herramientas (pregunta, tool_use, tool_result, respuesta) queda en dos mensajes.
    equal(previos.length, 6, 'tres turnos → seis mensajes');
    // El punto de caché sigue en el último mensaje del historial (un bloque de texto).
    const ultimo = previos.at(-1)!.content as { type: string; cache_control?: unknown }[];
    ok(ultimo.at(-1)!.cache_control, 'punto de caché al final del historial');
  } finally {
    fake.restaurar();
  }
});

Deno.test('L8 (a): un historial que empieza en un tool_result, con un turno solo de pensamiento y uno sin respuesta, sigue siendo válido', async () => {
  const msgs = [
    // Corte en mitad de un turno: lo primero que queda es un tool_result y luego el asistente.
    fila(0, 'user', [{ type: 'tool_result', tool_use_id: 'tu_x', content: 'Anotado.' }]),
    fila(1, 'assistant', [{ type: 'text', text: 'CORTADO-RESPUESTA Hecho.' }]),
    fila(2, 'user', [{ type: 'text', text: 'SOLO-PIENSA-PREGUNTA ¿y mañana?' }]),
    fila(3, 'assistant', [{ type: 'thinking', thinking: 'nada', signature: 's' }]),
    fila(4, 'user', [{ type: 'text', text: 'SIN-RESPUESTA ¿sigues ahí?' }]),
  ];
  const fake = await turno(datos({}, msgs));
  try {
    const body = cuerpo(fake);
    ok(alternanciaValida(body.messages), JSON.stringify(body.messages));
    ok(tiposDe(body.messages.slice(0, -1)).every((t) => t === 'text'));
    const texto = JSON.stringify(body.messages);
    ok(texto.includes('CORTADO-RESPUESTA'), 'la respuesta tras un tool_result huérfano no se pierde');
    ok(texto.includes('SOLO-PIENSA-PREGUNTA') && texto.includes('SIN-RESPUESTA'), 'las preguntas siguen');
    ok(!texto.includes('"thinking"'));
  } finally {
    fake.restaurar();
  }
});

// ── (b) El bucle de herramientas del turno actual no se toca ──────────

Deno.test('L8 (b): en el turno actual los tool_use/tool_result siguen completos y emparejados', async () => {
  const msgs = [...turnoConHerramientas(0, 'T1')];
  const fake = await turno(datos({}, msgs), 'repasa mi peso', (b, n) => {
    if (esHaiku(b)) return turnoTexto(RESUMEN, { input_tokens: 3_000, output_tokens: 200 }, CHEAP_MODEL);
    return n === 0
      ? turnoHerramienta('consultar_historial', { que: 'peso', desde: '2026-09-01', hasta: '2026-09-30', filtro: '' }, 'tu_actual')
      : turnoTexto('Con lo que hay: vas bien.');
  });
  try {
    equal(fake.proveedor.filter((c) => !esHaiku(c.body)).length, 2);
    const primera = cuerpo(fake, 0);
    const segunda = cuerpo(fake, 1);
    // Lo anterior al turno, idéntico en las dos vueltas (prefijo estable para la caché).
    const nPrevios = primera.messages.length - 1;
    equal(JSON.stringify(segunda.messages.slice(0, nPrevios)), JSON.stringify(primera.messages.slice(0, nPrevios)));
    const actual = segunda.messages.slice(nPrevios);
    equal(actual.map((m) => m.role).join(','), 'user,assistant,user');
    const tu = (actual[1].content as any[]).find((b) => b.type === 'tool_use');
    const tr = (actual[2].content as any[]).find((b) => b.type === 'tool_result');
    ok(tu && tr, 'tool_use y tool_result del turno actual presentes');
    equal(tr.tool_use_id, tu.id, 'emparejados');
    equal(tu.input.que, 'peso', 'el input completo');
    ok(alternanciaValida(segunda.messages));
    // Lo viejo, en cambio, sin herramientas.
    ok(tiposDe(segunda.messages.slice(0, nPrevios)).every((t) => t === 'text'));
  } finally {
    fake.restaurar();
  }
});

// ── (c) Recorte de las respuestas viejas del asistente ─────────────────

Deno.test('L8 (c): cada respuesta vieja del asistente se recorta a 1.500 caracteres con «…»; lo del usuario no', async () => {
  const msgs = [
    fila(0, 'user', [{ type: 'text', text: largo('USUARIO-LARGO', 900) }]),
    fila(1, 'assistant', [{ type: 'text', text: largo('ASISTENTE-LARGO', 5_000) }]),
    fila(2, 'user', [{ type: 'text', text: 'corta' }]),
    fila(3, 'assistant', [{ type: 'text', text: 'ASISTENTE-CORTO bien.' }]),
  ];
  const fake = await turno(datos({}, msgs));
  try {
    const previos = cuerpo(fake).messages.slice(0, -1);
    const textoDe = (m: ApiMessage) => (m.content as { text: string }[]).map((b) => b.text).join('');
    const largoA = textoDe(previos[1]);
    ok(largoA.startsWith('ASISTENTE-LARGO'));
    ok(largoA.length <= 1_500, `recortado: ${largoA.length}`);
    ok(largoA.endsWith('…'), 'con puntos suspensivos');
    equal(textoDe(previos[3]), 'ASISTENTE-CORTO bien.', 'lo corto, intacto');
    equal(textoDe(previos[0]), largo('USUARIO-LARGO', 900).trim(), 'el usuario no se recorta');
  } finally {
    fake.restaurar();
  }
});

// ── (d) Ventana: 6 con resumen al día; sin resumen, la de antes ────────

Deno.test('L8 (d): con resumen al día viajan solo las 6 filas posteriores; sin resumen, las 12 últimas como antes', async () => {
  const msgs = Array.from({ length: 16 }, (_, i) =>
    fila(i, i % 2 === 0 ? 'user' : 'assistant', [{ type: 'text', text: `FILA-${i} ${i % 2 === 0 ? 'pregunta' : 'respuesta'}` }])
  );
  // Con resumen hasta la fila 9: quedan 6 sin resumir (10..15).
  const con = await turno(datos({ summary: RESUMEN, summary_until: hora(9) }, msgs));
  try {
    const previos = cuerpo(con).messages.slice(0, -1);
    equal(previos.length, VENTANA_HISTORIAL, '6 filas');
    const t = JSON.stringify(previos);
    ok(t.includes('FILA-10 ') && t.includes('FILA-15 ') && !t.includes('FILA-9 '));
    const limite = con.llamadas.find((l) => l.method === 'GET' && l.url.pathname === '/rest/v1/coach_messages')!;
    ok(limite.url.searchParams.get('created_at')?.startsWith('gt.'), 'lo resumido ni se pide');
  } finally {
    con.restaurar();
  }
  // Sin resumen: el comportamiento anterior (12 filas).
  const sin = await turno(datos({}, msgs));
  try {
    const previos = cuerpo(sin).messages.slice(0, -1);
    equal(previos.length, 12);
    const t = JSON.stringify(previos);
    ok(t.includes('FILA-4 ') && t.includes('FILA-15 ') && !t.includes('FILA-3 '));
  } finally {
    sin.restaurar();
  }
});

Deno.test('L8 (d): con el resumen atrasado (más de 6 sin resumir) no se tira nada: tope de antes', async () => {
  const msgs = Array.from({ length: 16 }, (_, i) =>
    fila(i, i % 2 === 0 ? 'user' : 'assistant', [{ type: 'text', text: `FILA-${i} texto` }])
  );
  // Resumen hasta la fila 5: quedan 10 sin resumir (p. ej. el resumen del turno anterior aún no se ha escrito).
  const fake = await turno(datos({ summary: RESUMEN, summary_until: hora(5) }, msgs));
  try {
    const previos = cuerpo(fake).messages.slice(0, -1);
    equal(previos.length, 10, 'las 10 sin resumir viajan: ninguna cae en el vacío');
    ok(JSON.stringify(previos).includes('FILA-6 '));
  } finally {
    fake.restaurar();
  }
});

// ── (e) El disparador del resumen con el nuevo umbral ──────────────────

Deno.test('L8 (e): umbral y selección — se compacta desde 6 nuevos y lo que queda cabe en la ventana', () => {
  equal(MIN_NUEVOS, 6);
  equal(VENTANA_HISTORIAL, 6);
  ok(MANTENER_RECIENTES < VENTANA_HISTORIAL);
  const textos = (n: number, desde = 0) =>
    Array.from({ length: n }, (_, i) => ({
      role: (i + desde) % 2 === 0 ? 'user' : 'assistant', content: [{ type: 'text', text: `M${i + desde}` }], created_at: hora(i + desde),
    }));
  equal(seleccionarParaResumir(textos(5)), null, '5: aún no');
  const sel = seleccionarParaResumir(textos(6))!;
  equal(sel.compactar.length, 2, '6 − 4 recientes');
  equal(sel.hasta, hora(1));
  // Un último turno largo de herramientas (8 filas): el corte NO retrocede hasta su
  // pregunta (dejaría 8 > 6 fuera del resumen); se queda dentro de la ventana.
  const largoTurno = [
    ...textos(2),
    { role: 'user', content: [{ type: 'text', text: 'P' }], created_at: hora(2) },
    { role: 'assistant', content: [{ type: 'tool_use', id: 'a', name: 'x', input: {} }], created_at: hora(3) },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'a', content: 'r' }], created_at: hora(4) },
    { role: 'assistant', content: [{ type: 'tool_use', id: 'b', name: 'x', input: {} }], created_at: hora(5) },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'b', content: 'r' }], created_at: hora(6) },
    { role: 'assistant', content: [{ type: 'tool_use', id: 'c', name: 'x', input: {} }], created_at: hora(7) },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'c', content: 'r' }], created_at: hora(8) },
    { role: 'assistant', content: [{ type: 'text', text: 'fin' }], created_at: hora(9) },
  ];
  const sel2 = seleccionarParaResumir(largoTurno)!;
  ok(largoTurno.length - sel2.compactar.length <= VENTANA_HISTORIAL, 'lo que queda fuera del resumen cabe en la ventana');
});

Deno.test('L8 (e): por el handler — con 4 nuevos (+ el turno = 6) se resume; con 3 no', async () => {
  const msgs = (n: number, desde: number) => Array.from({ length: n }, (_, i) =>
    fila(i + desde, (i + desde) % 2 === 0 ? 'user' : 'assistant', [{ type: 'text', text: `FILA-${i + desde}` }])
  );
  const viejos = msgs(10, 0);
  // 6 sin resumir en la tabla (el fake no guarda lo que se inserta: así simulamos las 4 + las 2 del turno).
  const si = await turno(datos({ summary: RESUMEN, summary_until: hora(9) }, [...viejos, ...msgs(6, 10)]));
  try {
    const haikus = si.proveedor.filter((c) => esHaiku(c.body));
    equal(haikus.length, 1, 'se resume');
    const upd = si.escrituras('coach_threads').find((l) => (l.body as Fila)?.summary !== undefined)!;
    equal((upd.body as Fila).summary_until, hora(11), 'quedan fuera los 4 últimos');
    equal(upd.url.searchParams.get('summary_until'), `eq.${hora(9)}`);
  } finally {
    si.restaurar();
  }
  const no = await turno(datos({ summary: RESUMEN, summary_until: hora(9) }, [...viejos, ...msgs(3, 10)]));
  try {
    equal(no.proveedor.filter((c) => esHaiku(c.body)).length, 0, '3 + 2 < 6: no toca');
  } finally {
    no.restaurar();
  }
});

// ── (f) Medición: fichas del prefijo antes/después ─────────────────────

/**
 * RÉPLICA EXACTA de la ruta completa en bc51047 (antes de L8): 12 filas,
 * trimHistory, aligerarHistorial (quita pensamiento, tool_result a 600) y el
 * punto de caché al final. Comprobada contra el handler de bc51047 con estos
 * mismos datos antes de cambiarlo.
 */
function historialAntesL8(filasAsc: Fila[]): ApiMessage[] {
  let out = filasAsc.slice(-12).map((r) => ({ role: r.role, content: r.content }) as ApiMessage);
  while (out.length) {
    const b = Array.isArray(out[0].content) ? (out[0].content as { type: string }[]) : [];
    if (out[0].role === 'user' && !b.some((x) => x.type === 'tool_result')) break;
    out = out.slice(1);
  }
  out = out
    .map((m) => {
      if (!Array.isArray(m.content)) return m;
      const blocks = (m.content as any[])
        .filter((b) => b.type !== 'thinking' && b.type !== 'redacted_thinking')
        .map((b) => {
          if (b.type !== 'tool_result') return b;
          const c = b.content;
          if (typeof c !== 'string' || c.length <= 600) return b;
          return { ...b, content: `${c.slice(0, 600)}\n[…recortado]` };
        });
      return { ...m, content: blocks } as ApiMessage;
    })
    .filter((m) => !Array.isArray(m.content) || m.content.length > 0);
  if (out.length) {
    const last = out[out.length - 1];
    const c = last.content as any[];
    let idx = -1;
    for (let i = c.length - 1; i >= 0; i--) {
      if (c[i]?.type !== 'thinking' && c[i]?.type !== 'redacted_thinking') {
        idx = i;
        break;
      }
    }
    if (idx >= 0) out[out.length - 1] = { ...last, content: c.map((b, i) => (i === idx ? { ...b, cache_control: { type: 'ephemeral' } } : b)) };
  }
  return out;
}

/**
 * Hilo sintético realista (12 filas: 6 respuestas del asistente de ~4.000
 * caracteres serializados, con tool_use; 6 filas del usuario de ~500, texto o
 * tool_result). Dos turnos con herramientas y dos de texto, alternos.
 */
function hiloRealista(): Fila[] {
  const out: Fila[] = [];
  let n = 0;
  const conHerramientas = (k: number) => {
    out.push(fila(n++, 'user', [{ type: 'text', text: largo(`R${k}-PREGUNTA`, 500) }]));
    const tu = { type: 'tool_use', id: `tu_r${k}`, name: 'consultar_historial', input: { que: 'gym', desde: '2026-09-01', hasta: '2026-09-30', filtro: largo('f', 1_200) } };
    const prosa = 4_000 - JSON.stringify([{ type: 'text', text: '' }, tu]).length;
    out.push(fila(n++, 'assistant', [{ type: 'text', text: largo(`R${k}-MIRO`, prosa) }, tu]));
    out.push(fila(n++, 'user', [{ type: 'tool_result', tool_use_id: `tu_r${k}`, content: largo(`R${k}-RESULTADO`, 440) }]));
    out.push(fila(n++, 'assistant', [{ type: 'text', text: largo(`R${k}-RESPUESTA`, 3_970) }]));
  };
  const deTexto = (k: number) => {
    out.push(fila(n++, 'user', [{ type: 'text', text: largo(`R${k}-PREGUNTA`, 500) }]));
    out.push(fila(n++, 'assistant', [{ type: 'text', text: largo(`R${k}-RESPUESTA`, 3_970) }]));
  };
  conHerramientas(1);
  deTexto(2);
  conHerramientas(3);
  deTexto(4);
  return out;
}

function fichasDe(c: { system: { text: string }[]; tools: unknown[]; messages: unknown[] }) {
  const sistema = estimarFichas(c.system.map((b) => b.text).join('\n').length);
  const herramientas = estimarFichas(JSON.stringify(c.tools).length);
  const mensajes = estimarFichas(JSON.stringify(c.messages).length);
  return { sistema, herramientas, mensajes, total: sistema + herramientas + mensajes };
}

// Estado de producción (~16 k caracteres) simulado con el dossier.
const DOSSIER_16K = largo('Memoria del gladiador', 16_000);

Deno.test('L8 (f): MEDICIÓN — fichas del prefijo (sistema + herramientas + mensajes) antes/después', async () => {
  const filas = hiloRealista();
  equal(filas.length, 12);
  const asis = filas.filter((f) => f.role === 'assistant').map((f) => JSON.stringify(f.content).length);
  const usu = filas.filter((f) => f.role === 'user').map((f) => JSON.stringify(f.content).length);
  ok(asis.every((l) => l >= 3_900 && l <= 4_100), `asistente ~4.000: ${asis}`);
  ok(usu.every((l) => l >= 450 && l <= 650), `usuario ~500: ${usu}`);

  // Después: régimen estable con resumen (6 filas sin resumir: los dos últimos turnos).
  const fake = await turno(
    datos({ summary: RESUMEN, summary_until: hora(5) }, filas, { coach_dossier: [{ user_id: USER_ID, content: DOSSIER_16K }] }),
  );
  let despues: ReturnType<typeof fichasDe>;
  let antes: ReturnType<typeof fichasDe>;
  let suelo: ReturnType<typeof fichasDe>;
  try {
    const body = cuerpo(fake);
    despues = fichasDe(body);
    // Suelo teórico: el mismo prefijo sin historial alguno (solo el mensaje actual).
    suelo = fichasDe({ ...body, messages: [body.messages.at(-1)!] });
    // Antes: mismo sistema (con el mismo resumen) y herramientas; el historial
    // de bc51047, que con resumen llevaba hasta 12 filas sin resumir.
    antes = fichasDe({ ...body, messages: [...historialAntesL8(filas), body.messages.at(-1)!] });
    ok(alternanciaValida(body.messages));
  } finally {
    fake.restaurar();
  }
  const pct = (a: number, d: number) => `${(((a - d) / a) * 100).toFixed(1)} %`;
  console.log(
    `\n  L8 prefijo de la ruta completa (fichas estimadas, caracteres/3):` +
      `\n    sistema       ${antes.sistema} → ${despues.sistema}` +
      `\n    herramientas  ${antes.herramientas} → ${despues.herramientas}` +
      `\n    mensajes      ${antes.mensajes} → ${despues.mensajes}  (−${pct(antes.mensajes, despues.mensajes)})` +
      `\n    TOTAL         ${antes.total} → ${despues.total}  (−${pct(antes.total, despues.total)})` +
      `\n    suelo sin historial alguno: ${suelo.total} (−${pct(antes.total, suelo.total)}: lo más que da tocar solo el historial)`,
  );
  ok(despues.mensajes < antes.mensajes * 0.25, 'el historial baja más de un 75 %');
  ok(despues.total < antes.total, 'el prefijo baja');
});

Deno.test('L8 (f): la réplica de «antes» es fiel — sin tool_result largos ni pensamiento, coincide con la entrada', () => {
  // Control de la propia réplica: con texto plano no cambia nada salvo el punto de caché.
  const filas = [fila(0, 'user', [{ type: 'text', text: 'a' }]), fila(1, 'assistant', [{ type: 'text', text: 'b' }])];
  const r = historialAntesL8(filas);
  equal(r.length, 2);
  ok((r[1].content as any[])[0].cache_control);
});
