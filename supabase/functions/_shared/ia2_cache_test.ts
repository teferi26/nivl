// IA v2 · L2 «Caché en dos escalones».
//
// Hecho medido (02/10): ~75 % del coste del coach era ESCRITURA de caché. Había
// un único punto al final del estado, así que cada vez que cambiaba el estado
// (o caducaban los 5 min) se reescribían también ~16,6 k fichas fijas
// (herramientas, voz, conocimiento, reglas). Ahora:
//
//   [herramientas] → FIJO ◆ → dossier + ritual + estado ◆ → historial ◆   (3 de 4)
//
// Lo que se comprueba:
//   · La parte fija es byte a byte idéntica entre usuarios, kinds y días.
//   · Posición de cada cache_control (y el orden de TTL si se activa 1 h).
//   · La regla «no escribas lo que no te han pedido» vive en la parte fija.
//   · Sin tiempo, la última llamada lleva LAS MISMAS herramientas con
//     tool_choice 'none' (antes iba sin herramientas: prefijo roto y 400).
//   · Un simulador de caché sobre las peticiones REALES del handler (backend
//     simulado) mide la escritura por turno antes/después.

import { deepEqual, equal, ok } from 'node:assert/strict';
import { instalar, peticion, turnoHerramienta, turnoTexto } from './sec_coach_fake_test.ts';
import { buildSystem, COACH_SYSTEM, DATOS_ABRE, SISTEMA_FIJO } from './prompt.ts';
import { TOOL_DEFS } from './tools.ts';
import type { SystemBlock } from './anthropic.ts';

const { handler } = await import('../coach/handler.ts');

const N_FIJO = SISTEMA_FIJO.length;

// ── La parte fija ──────────────────────────────────────────────────────

Deno.test('cache: la parte fija es idéntica byte a byte entre usuarios, kinds, dossiers y días', () => {
  const a = buildSystem('Ana, 34 años, emprendedora. Objetivo: 10 clientes.', 'chat', 'Fecha 2026-10-02 · perfil emprendedor · 3 misiones');
  const b = buildSystem('', 'brief', 'Fecha 2027-01-15 · perfil deportista · Luis');
  const c = buildSystem('Marta', 'revision_semanal', '');
  const d = buildSystem('', 'chat', '');
  const fijo = (s: SystemBlock[]) => JSON.stringify(s.slice(0, N_FIJO));
  equal(fijo(a), fijo(b));
  equal(fijo(a), fijo(c));
  equal(fijo(a), fijo(d));
  deepEqual(a.slice(0, N_FIJO).map((x) => x.text), [...SISTEMA_FIJO]);
});

Deno.test('cache: la parte fija no lleva fecha, nombre, perfil ni datos', () => {
  const texto = SISTEMA_FIJO.join('\n');
  ok(!/\b20\d\d-\d\d-\d\d\b/.test(texto), 'sin fechas ISO');
  // Sin reloj: con otra hora del sistema sale lo mismo.
  const realNow = Date.now;
  Date.now = () => realNow() + 400 * 86_400_000;
  try {
    equal(JSON.stringify(buildSystem('', 'chat', '').slice(0, N_FIJO)), JSON.stringify(SISTEMA_FIJO.map((text, i) => ({
      type: 'text', text, ...(i === N_FIJO - 1 ? { cache_control: { type: 'ephemeral' } } : {}),
    }))));
  } finally {
    Date.now = realNow;
  }
  ok(!texto.includes(DATOS_ABRE + '\n'), 'sin bloques de datos del gladiador');
  // Lo que construye buildSystem con datos de un usuario no puede colarse arriba.
  const s = buildSystem('NOMBRE_SECRETO', 'chat', 'ESTADO_SECRETO');
  ok(!JSON.stringify(s.slice(0, N_FIJO)).includes('SECRETO'));
});

Deno.test('cache: dos puntos en el sistema — tras la parte fija y tras la dinámica', () => {
  const s = buildSystem('memoria', 'brief', 'estado del día');
  const marcas = s.map((b, i) => (b.cache_control ? i : -1)).filter((i) => i >= 0);
  deepEqual(marcas, [N_FIJO - 1, s.length - 1]);
  deepEqual(s[N_FIJO - 1].cache_control, { type: 'ephemeral' }, 'por defecto 5 min');
  // Sin parte dinámica, un solo punto (el fijo).
  const vacio = buildSystem('', 'chat', '');
  equal(vacio.length, N_FIJO);
  deepEqual(vacio.map((b) => !!b.cache_control), [false, false, false, true]);
});

Deno.test('cache: con TTL de 1 h, solo el punto fijo es de 1 h y va antes que los de 5 min', () => {
  const s = buildSystem('memoria', 'chat', 'estado', { ttlFijo: '1h' });
  deepEqual(s[N_FIJO - 1].cache_control, { type: 'ephemeral', ttl: '1h' });
  deepEqual(s.at(-1)!.cache_control, { type: 'ephemeral' });
  const ttls = s.filter((b) => b.cache_control).map((b) => b.cache_control!.ttl ?? '5m');
  deepEqual(ttls, ['1h', '5m'], 'la API exige los de 1 h antes que los de 5 min');
});

Deno.test('cache: la regla de no escribir lo no pedido está en la parte fija (coordinador, smoke del gym)', () => {
  const regla =
    'No escribas planes, prescripciones, misiones ni eventos que no te hayan pedido en este turno (el encargo de un ritual cuenta como pedido): propónlos en una línea y espera un sí. Tras un "lo he hecho", comprueba, cita y marca; no reprogrames nada.';
  ok(COACH_SYSTEM.includes(regla));
  ok(SISTEMA_FIJO[0].includes(regla));
  const s = buildSystem('x', 'chat', 'y');
  ok(s.slice(0, N_FIJO).some((b) => b.text.includes(regla)), 'antes del primer punto de caché');
  ok(!s.slice(N_FIJO).some((b) => b.text.includes(regla)));
});

// ── La petición real del handler ───────────────────────────────────────

type Body = { system: SystemBlock[]; tools?: unknown[]; tool_choice?: unknown; messages: { content: unknown }[] };

function marcasEn(body: Body): number {
  let n = 0;
  for (const b of body.system) if (b.cache_control) n++;
  for (const t of (body.tools ?? []) as { cache_control?: unknown }[]) if (t.cache_control) n++;
  for (const m of body.messages) {
    if (Array.isArray(m.content)) for (const b of m.content as { cache_control?: unknown }[]) if (b.cache_control) n++;
  }
  return n;
}

const HISTORIA = [
  { role: 'user', content: [{ type: 'text', text: '¿Cómo voy esta semana?' }] },
  { role: 'assistant', content: [{ type: 'text', text: 'Vas al 80 %. Te falta el cardio del jueves.' }] },
];

Deno.test('cache: la petición del handler lleva 3 puntos (fijo, dinámico, historial) y nunca más de 4', async () => {
  const fake = instalar({
    filas: { coach_dossier: [{ content: 'Memoria del gladiador.' }], coach_messages: [...HISTORIA].reverse() },
  });
  try {
    await (await handler(peticion({ kind: 'chat', message: 'hola', stream: false }))).text();
    const body = fake.proveedor[0].body as Body;
    equal(marcasEn(body), 3);
    ok(body.system[N_FIJO - 1].cache_control, 'punto tras la parte fija');
    ok(body.system.at(-1)!.cache_control, 'punto tras dossier + estado');
    deepEqual(body.system.slice(0, N_FIJO).map((b) => b.text), [...SISTEMA_FIJO]);
    equal(JSON.stringify(body.tools), JSON.stringify(TOOL_DEFS), 'herramientas deterministas');
    equal(body.tool_choice, undefined, 'con tiempo, tool_choice por defecto (auto)');
  } finally {
    fake.restaurar();
  }
});

Deno.test('cache: sin tiempo, la última llamada lleva las MISMAS herramientas con tool_choice none', async () => {
  const realNow = Date.now;
  let salto = 0;
  const fake = instalar({
    proveedor: (_b, n) => {
      if (n === 0) {
        // La primera vuelta "tarda" 101 s: la siguiente ya va sin presupuesto.
        salto = 101_000;
        return turnoHerramienta('consultar_historial', { que: 'peso', desde: '2026-01-01', hasta: '2026-01-02', filtro: '' });
      }
      return turnoTexto('Con lo que hay: vas bien.');
    },
  });
  Date.now = () => realNow() + salto;
  try {
    await (await handler(peticion({ kind: 'chat', message: 'repasa mi peso', stream: false }))).text();
    equal(fake.proveedor.length, 2);
    const [primera, ultima] = fake.proveedor.map((c) => c.body as Body);
    ok(ultima.tools?.length, 'la última llamada SIGUE llevando herramientas');
    equal(JSON.stringify(ultima.tools), JSON.stringify(primera.tools), 'las mismas, en el mismo orden');
    deepEqual(ultima.tool_choice, { type: 'none' });
    equal(primera.tool_choice, undefined);
    deepEqual(ultima.system, primera.system, 'mismo sistema: la caché fija y la dinámica se leen');
    // El historial del turno lleva tool_use: sin herramientas era un 400.
    ok(JSON.stringify(ultima.messages).includes('"tool_use"'));
  } finally {
    Date.now = realNow;
    fake.restaurar();
  }
});

// ── Simulador de caché: escritura por turno antes/después ──────────────
//
// Modelo de la caché de Anthropic, simplificado: prefijo exacto en orden
// tools → system → messages; una entrada por punto marcado; se lee la entrada
// viva más larga que case; se escribe desde ahí hasta el último punto; TTL de
// 5 min o 1 h desde el inicio de la petición, y leer refresca. Fichas ≈ 4
// caracteres. "Antes" es la misma petición sin el punto fijo (el orden de los
// bloques no ha cambiado, solo dónde va el primer cache_control).

interface Seg { clave: string; fichas: number; ttl: number | null }

function segmentos(body: Body): Seg[] {
  const out: Seg[] = [];
  let acumulado = '';
  const meter = (x: unknown, cc?: { ttl?: string } | null) => {
    const s = JSON.stringify(x);
    acumulado += s;
    out.push({ clave: acumulado, fichas: Math.ceil(s.length / 4), ttl: cc ? (cc.ttl === '1h' ? 3_600_000 : 300_000) : null });
  };
  for (const t of body.tools ?? []) meter(t);
  for (const b of body.system) meter(b.text, b.cache_control ?? null);
  for (const m of body.messages) {
    const bloques = Array.isArray(m.content) ? (m.content as { cache_control?: { ttl?: string } }[]) : [{ text: m.content }];
    for (const b of bloques) {
      const { cache_control, ...resto } = b as { cache_control?: { ttl?: string } };
      meter(resto, cache_control ?? null);
    }
  }
  return out;
}

class Cache {
  entradas = new Map<string, { vence: number; ttl: number }>();
  peticion(body: Body, t: number) {
    const segs = segmentos(body);
    const marcas = segs.map((s, i) => (s.ttl ? i : -1)).filter((i) => i >= 0);
    const ultima = marcas.at(-1) ?? -1;
    let leido = -1;
    for (let i = ultima; i >= 0; i--) {
      const e = this.entradas.get(segs[i].clave);
      if (e && e.vence > t) {
        leido = i;
        e.vence = t + e.ttl;
        break;
      }
    }
    const fichas = (desde: number, hasta: number) => segs.slice(desde, hasta + 1).reduce((a, s) => a + s.fichas, 0);
    let escrito = 0;
    let escrito1h = 0;
    let previa = leido;
    for (const m of marcas) {
      if (m <= leido) continue;
      const f = fichas(previa + 1, m);
      escrito += f;
      if (segs[m].ttl === 3_600_000) escrito1h += f;
      this.entradas.set(segs[m].clave, { vence: t + segs[m].ttl!, ttl: segs[m].ttl! });
      previa = m;
    }
    return { leido: fichas(0, leido), escrito, escrito1h, entrada: fichas(ultima + 1, segs.length - 1) };
  }
}

/** Coste de entrada en Sonnet 5 (2 $/M): lectura 0,1×, escritura 5 min 1,25×, 1 h 2×. */
function usd(r: { leido: number; escrito: number; escrito1h: number; entrada: number }): number {
  return (r.entrada * 2 + r.leido * 0.2 + (r.escrito - r.escrito1h) * 2.5 + r.escrito1h * 4) / 1e6;
}

function sinPuntoFijo(body: Body): Body {
  return { ...body, system: body.system.map((b, i) => (i === N_FIJO - 1 ? { type: b.type, text: b.text } : b)) };
}

/** Peticiones reales del handler para dos turnos con dossier distinto (cambio de estado). */
async function dosTurnos(dossierA: string, dossierB: string, ttl1h = false): Promise<[Body, Body]> {
  const cuerpos: Body[] = [];
  for (const dossier of [dossierA, dossierB]) {
    if (ttl1h) Deno.env.set('COACH_CACHE_TTL_FIJO', '1h');
    const fake = instalar({ filas: { coach_dossier: [{ content: dossier }], coach_messages: [...HISTORIA].reverse() } });
    try {
      await (await handler(peticion({ kind: 'chat', message: 'hola', stream: false }))).text();
      cuerpos.push(fake.proveedor[0].body as Body);
    } finally {
      fake.restaurar();
      Deno.env.delete('COACH_CACHE_TTL_FIJO');
    }
  }
  return [cuerpos[0], cuerpos[1]];
}

// ~30 k fichas de parte dinámica (dossier + estudios + estado), como en el medido.
const DIN_A = 'Dato de la memoria y del estudio del día. '.repeat(2_900);
const DIN_B = DIN_A + ' Misión completada hace un momento.';

Deno.test('cache: simulador — escritura por turno antes/después (informe)', async () => {
  const [a, b] = await dosTurnos(DIN_A, DIN_B);
  const fijo = segmentos(a).filter((_, i) => i < (a.tools?.length ?? 0) + N_FIJO).reduce((x, s) => x + s.fichas, 0);

  const escenario = (gapMs: number, conFijo: boolean) => {
    const c = new Cache();
    const p = (x: Body) => (conFijo ? x : sinPuntoFijo(x));
    c.peticion(p(a), 0);
    return c.peticion(p(b), gapMs);
  };

  const filas: string[] = [];
  const caso = (nombre: string, gap: number) => {
    const antes = escenario(gap, false);
    const despues = escenario(gap, true);
    filas.push(
      `${nombre}: escritura ${antes.escrito} → ${despues.escrito} fichas; lectura ${antes.leido} → ${despues.leido}; ` +
        `entrada ${usd(antes).toFixed(4)} $ → ${usd(despues).toFixed(4)} $`,
    );
    return { antes, despues };
  };

  // 1) Sigue la charla a los 3 min y el estado ha cambiado (completó una misión).
  const charla = caso('charla, 3 min, estado cambiado', 180_000);
  ok(charla.despues.escrito <= charla.antes.escrito - fijo * 0.95, 'la parte fija ya no se reescribe');
  ok(charla.despues.leido >= fijo * 0.95, 'la parte fija se lee');

  // 2) Otro turno horas después: con TTL de 5 min no queda nada vivo.
  const horas = caso('3 h después', 3 * 3_600_000);
  equal(horas.despues.escrito, horas.antes.escrito, 'sin regresión cuando todo ha caducado');

  // 3) Otro usuario a los 3 min: comparte la parte fija (mismo prefijo exacto).
  {
    const [u1] = await dosTurnos(DIN_A, DIN_A);
    const [u2] = await dosTurnos('Otro gladiador, otra memoria. '.repeat(4_000), 'x');
    const c0 = new Cache();
    c0.peticion(sinPuntoFijo(u1), 0);
    const antes = c0.peticion(sinPuntoFijo(u2), 180_000);
    const c1 = new Cache();
    c1.peticion(u1, 0);
    const despues = c1.peticion(u2, 180_000);
    ok(despues.leido >= fijo * 0.95, 'el segundo usuario lee la parte fija del primero');
    filas.push(`otro usuario, 3 min: escritura ${antes.escrito} → ${despues.escrito} fichas; entrada ${usd(antes).toFixed(4)} $ → ${usd(despues).toFixed(4)} $`);
  }

  // 4) Con TTL 1 h en el punto fijo: turnos a 40 min.
  {
    const [a1, b1] = await dosTurnos(DIN_A, DIN_B, true);
    ok(a1.system[N_FIJO - 1].cache_control?.ttl === '1h');
    const c5 = new Cache();
    c5.peticion(a, 0);
    const r5 = c5.peticion(b, 40 * 60_000);
    const c1h = new Cache();
    const r1h0 = c1h.peticion(a1, 0);
    const r1h = c1h.peticion(b1, 40 * 60_000);
    const c5b = new Cache();
    const r50 = c5b.peticion(a, 0);
    filas.push(
      `TTL fijo 1 h, turnos a 40 min: 2.º turno ${usd(r5).toFixed(4)} $ (5 min) → ${usd(r1h).toFixed(4)} $ (1 h); ` +
        `1.er turno en frío ${usd(r50).toFixed(4)} $ → ${usd(r1h0).toFixed(4)} $`,
    );
  }

  console.log(`\n  parte fija (herramientas + sistema fijo) ≈ ${fijo} fichas\n  ` + filas.join('\n  '));
});
