// NIVL · Coach v2 · L4: contexto más pequeño (recortes FIJOS) y medición.
//
// Backend simulado con el arnés sec_coach_fake_test.ts y un PostgREST de
// juguete que SÍ aplica filtros, orden y límite (el del arnés devuelve todas
// las filas): sin eso, recortar un .limit() no se notaría en la medición.
//
// Datos sintéticos realistas: un usuario de unos meses de uso, con hechos
// importados largos, diario escrito a diario, campañas con muchas tareas,
// agenda llena, gimnasio, cardio, nutrición y movimientos bancarios.

import { assert as ok, assertEquals as equal } from 'jsr:@std/assert@1';
import { instalar, USER_ID, type Llamada } from './sec_coach_fake_test.ts';
import { buildContext } from './context.ts';

type Fila = Record<string, unknown>;

// ── PostgREST de juguete con filtros, orden y límite ─────────────────────

function cumple(valor: unknown, op: string, arg: string): boolean {
  const x = valor === null || valor === undefined ? null : String(valor);
  const lista = () => arg.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, ''));
  switch (op) {
    case 'eq': return x === arg;
    case 'neq': return x !== arg;
    case 'gt': return x !== null && x > arg;
    case 'gte': return x !== null && x >= arg;
    case 'lt': return x !== null && x < arg;
    case 'lte': return x !== null && x <= arg;
    case 'in': return x !== null && lista().includes(x);
    case 'is': return arg === 'null' ? x === null : x === arg;
    default: return true;
  }
}

export function filtrar(filas: Fila[], params: URLSearchParams): Fila[] {
  let out = filas.slice();
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(k)) continue;
    let expr = v;
    let negar = false;
    if (expr.startsWith('not.')) {
      negar = true;
      expr = expr.slice(4);
    }
    const punto = expr.indexOf('.');
    const op = expr.slice(0, punto);
    const arg = expr.slice(punto + 1);
    out = out.filter((f) => cumple(f[k], op, arg) !== negar);
  }
  const orden = params.get('order');
  if (orden) {
    const claves = orden.split(',').map((o) => {
      const [col, dir] = o.split('.');
      return { col, desc: dir === 'desc' };
    });
    out.sort((a, b) => {
      for (const { col, desc } of claves) {
        const c = String(a[col] ?? '').localeCompare(String(b[col] ?? ''));
        if (c) return desc ? -c : c;
      }
      return 0;
    });
  }
  const limite = Number(params.get('limit'));
  if (limite > 0) out = out.slice(0, limite);
  // Proyección: como PostgREST, solo las columnas pedidas (sin esto, una
  // lectura "ligera" traería el texto entero y la medición mentiría).
  const cols = (params.get('select') ?? '*').split(',').map((s) => s.trim()).filter(Boolean);
  if (!cols.includes('*')) out = out.map((f) => Object.fromEntries(cols.filter((c) => c in f).map((c) => [c, f[c]])));
  return out;
}

export function postgrest(datos: Record<string, Fila[]>) {
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

// ── Datos sintéticos realistas ───────────────────────────────────────────

export const HOY = '2026-10-02';
const dia = (n: number) => new Date(new Date(HOY).getTime() - n * 86400000).toISOString().slice(0, 10);
const futuro = (n: number) => new Date(new Date(HOY).getTime() + n * 86400000).toISOString().slice(0, 10);
const TODOS = [1, 2, 3, 4, 5, 6, 7];
const LAB = [1, 2, 3, 4, 5];

export function datosRealistas(): Record<string, Fila[]> {
  const quests: Fila[] = [
    ['Entrenar fuerza', 'FUE', 'dificil', [1, 3, 5], 'gym'],
    ['Cardio Z2 45 min', 'VIT', 'media', [2, 4, 6], 'cardio'],
    ['Pesarse en ayunas', 'PER', 'trivial', TODOS, 'peso'],
    ['Parte de comidas', 'VIT', 'facil', TODOS, 'nutricion'],
    ['Diario de la noche', 'PER', 'facil', TODOS, 'diario'],
    ['25 llamadas de prospección', 'INT', 'dificil', LAB, 'ninguno'],
    ['Leer 20 páginas', 'INT', 'facil', TODOS, 'ninguno'],
    ['Meditar 10 min', 'PER', 'trivial', TODOS, 'ninguno'],
    ['Inglés 30 min', 'INT', 'media', LAB, 'ninguno'],
    ['Movilidad de cadera', 'AGI', 'facil', [2, 4, 6, 7], 'ninguno'],
  ].map(([title, stat, difficulty, days, link], i) => ({
    id: `q${i}`, user_id: USER_ID, active: true, title, stat, difficulty, days_of_week: days, link,
    is_penalty: false, is_bonus: false, acquired_at: null, created_at: '2026-07-01',
  }));
  const completions: Fila[] = [];
  for (let n = 0; n < 30; n++) {
    for (const q of quests) if ((n + Number(String(q.id).slice(1))) % 3 !== 0) completions.push({ user_id: USER_ID, quest_id: q.id, date: dia(n) });
  }
  const largo = (marca: string, n: number) => `${marca} ` + 'Contexto con detalle real de lo que pasó y por qué importa. '.repeat(n);
  return {
    profiles: [{
      id: USER_ID, name: 'Tafa', timezone: 'Europe/Madrid', wake_time: '06:30', sleep_time: '23:00', coach_mode: 'A',
      xp_total: 18_400, streak_days: 23, perfect_streak_days: 4, protection_stones: 2, bonus_points: 12, profile_kind: 'emprendedor',
      xp_fue: 3200, xp_vit: 4100, xp_int: 6200, xp_agi: 900, xp_per: 4000,
    }],
    coach_dossier: [{ user_id: USER_ID, content: largo('DOSSIER', 120) }],
    quests,
    completions,
    day_plans: [{ id: 'plan1', user_id: USER_ID, date: HOY, brief: 'Brief', verdict: null, status: 'active' }],
    day_blocks: Array.from({ length: 12 }, (_, i) => ({
      plan_id: 'plan1', position: i, start_min: 390 + i * 75, end_min: 450 + i * 75, title: `Bloque ${i}`, kind: 'trabajo',
      detail: 'Detalle del bloque con su objetivo concreto y la cifra.', done: i < 4,
    })),
    goals: Array.from({ length: 4 }, (_, i) => ({
      id: `g${i}`, user_id: USER_ID, status: 'active', title: `Meta ${i}`, start_value: 0, target_value: 100, unit: 'u', deadline: futuro(90),
    })),
    body_metrics: Array.from({ length: 40 }, (_, i) => ({ user_id: USER_ID, date: dia(i), weight_kg: 94 - i * 0.05, notes: null, created_at: dia(i) })),
    rules: Array.from({ length: 5 }, (_, i) => ({
      id: `r${i}`, user_id: USER_ID, active: true, text: `Regla ${i} del contrato`, consequence: '−50 XP', link: 'ninguno',
    })),
    rule_breaks: Array.from({ length: 6 }, (_, i) => ({ user_id: USER_ID, date: dia(i * 9), rule_id: `r${i % 5}` })),
    rule_checks: Array.from({ length: 50 }, (_, i) => ({ user_id: USER_ID, rule_id: `r${i % 5}`, date: dia(Math.floor(i / 5)) })),
    dungeons: Array.from({ length: 3 }, (_, i) => ({
      id: `d${i}`, user_id: USER_ID, title: `Campaña ${i}`, rank: 'B', status: 'active', deadline: futuro(60),
    })),
    dungeon_tasks: Array.from({ length: 60 }, (_, i) => ({
      id: `t${i}`, user_id: USER_ID, dungeon_id: `d${i % 3}`, title: `Tarea ${i} de la campaña con descripción`, is_boss: i % 11 === 0,
      due_date: futuro(i), done: i % 4 === 0, done_at: i % 4 === 0 ? `${dia(i % 20)}T10:00:00Z` : null, position: i,
    })),
    calendar_events: Array.from({ length: 25 }, (_, i) => ({
      id: `e${i}`, user_id: USER_ID, title: `Cita ${i}`, date: futuro(i * 2), time: '10:00',
      notes: 'Notas de la cita: quién, dónde y qué llevar preparado para que salga bien. '.repeat(2),
    })),
    coach_facts: Array.from({ length: 46 }, (_, i) => ({
      id: `f${i}`, user_id: USER_ID, date: dia(i * 2),
      category: i % 7 === 0 ? 'aprendizaje' : i % 11 === 0 ? 'regla' : i % 3 === 0 ? 'metrica' : 'log',
      content: i % 5 === 0 ? largo(`HECHO-${i}`, 25) : largo(`HECHO-${i}`, 4),
    })),
    journal_entries: Array.from({ length: 30 }, (_, i) => ({
      user_id: USER_ID, date: dia(i), mood: 3 + (i % 3), energy: 2 + (i % 4), sleep_hours: 6 + (i % 3), emotions: ['cansado', 'motivado'],
      wins: ['cerré una reunión', 'entrené'], text: largo(`DIARIO-${i}`, 8), lesson: 'Dormir antes de las 23 cambia el día siguiente.',
      gratitude: 'Mi familia.', plan: 'Llamadas a las 9:00.',
    })),
    body_profile: [{
      user_id: USER_ID, height_cm: 182, birth_year: 1992, sex: 'hombre', activity: 'ligero', experience: 'intermedio',
      goal: 'Bajar a 88 kg en marzo', injuries: 'Hombro derecho en press por encima de la cabeza', health_notes: null,
      food_notes: 'Sin lactosa', equipment: 'Gimnasio completo',
    }],
    events: [{ user_id: USER_ID, type: 'onboarding_goal', payload: { goal: 'Facturar 10 k al mes', target: '10000', deadline: '2027-06-01' }, created_at: '2026-07-01' }],
    training_prescriptions: Array.from({ length: 6 }, (_, i) => ({
      user_id: USER_ID, date: HOY, position: i, exercise_name: `Ejercicio ${i}`, sets: 4, reps: 6, weight: 60 + i * 5, rpe_target: 8, notes: null,
    })),
    gym_sessions: Array.from({ length: 30 }, (_, i) => ({ id: `s${i}`, user_id: USER_ID, date: dia(i * 3), notes: i < 10 ? 'Buena sesión, hombro bien.' : null, gym_day_id: null })),
    gym_lifts: Array.from({ length: 30 }, (_, i) => [
      { session_id: `s${i}`, user_id: USER_ID, exercise_name: 'Sentadilla', weight: 100 - i, reps: 5, rpe: 8, set_index: 0 },
      { session_id: `s${i}`, user_id: USER_ID, exercise_name: 'Press banca', weight: 80 - i * 0.5, reps: 5, rpe: 8, set_index: 0 },
      { session_id: `s${i}`, user_id: USER_ID, exercise_name: 'Peso muerto', weight: 140 - i, reps: 3, rpe: 8, set_index: 0 },
    ]).flat(),
    gym_days: [],
    gym_exercises: [],
    cardio_sessions: Array.from({ length: 16 }, (_, i) => ({
      user_id: USER_ID, date: dia(i * 3), kind: 'carrera', distance_km: 8, duration_min: 48, zone: 'Z2', rpe: 5, avg_hr: 140, notes: null,
    })),
    nutrition_logs: Array.from({ length: 28 }, (_, i) => ({ user_id: USER_ID, date: dia(i), hit_kcal: i % 3 !== 0, hit_protein: i % 2 === 0 })),
    nutrition_targets: [{ user_id: USER_ID, active: true, from_date: '2026-09-01', kcal: 2400, protein_g: 180, rationale: 'Déficit de 400.' }],
    transactions: Array.from({ length: 150 }, (_, i) => ({
      user_id: USER_ID, date: dia(i), amount: i % 10 === 0 ? 2500 : -(10 + (i % 7) * 12), currency: 'EUR',
      category: ['supermercado', 'ocio', 'transporte', 'restaurantes', 'suscripciones'][i % 5], description: `Comercio ${i % 12}`,
      counterparty: `Comercio ${i % 12}`, is_internal: false,
    })),
    money_accounts: [{ user_id: USER_ID, active: true, name: 'Cuenta', balance: 4200, currency: 'EUR' }],
    money_plan: [],
    budgets: [],
  };
}

/** El estado completo de la ruta completa, con los datos sintéticos. */
export async function estadoCompleto(datos = datosRealistas()): Promise<string> {
  const fake = instalar({ otras: postgrest(datos) });
  try {
    const ctx = await buildContext(sbUsuario(), USER_ID, HOY);
    return ctx.text;
  } finally {
    fake.restaurar();
  }
}

import { userClient } from './db.ts';
import { USER_TOKEN } from './sec_coach_fake_test.ts';
const sbUsuario = () => userClient(USER_TOKEN);

// ── Tests ────────────────────────────────────────────────────────────────

/**
 * Tamaño del estado con ESTOS MISMOS datos y el context.ts de la base
 * (winter2/integracion @ 8e35012, antes de L4), medido el 2026-10-02 con este
 * mismo arnés. No se puede recalcular aquí porque el código viejo ya no está:
 * si cambias datosRealistas(), vuelve a medirlo sobre la base.
 */
const ANTES_L4 = 28_120;

Deno.test('L4 medición: el estado de la ruta completa baja al menos un 40 % (informe antes/después)', async () => {
  const texto = await estadoCompleto();
  const secciones = texto.split(/\n(?=#{1,2} )/).map((s) => ({ t: s.split('\n')[0].slice(0, 60), n: s.length }));
  const baja = Math.round((1 - texto.length / ANTES_L4) * 1000) / 10;
  console.log(`\nL4 estado completo: antes ${ANTES_L4} → después ${texto.length} caracteres (−${baja} %)`);
  for (const s of secciones.sort((a, b) => b.n - a.n).slice(0, 12)) console.log(`  ${String(s.n).padStart(6)}  ${s.t}`);
  ok(texto.length <= ANTES_L4 * 0.6, `el estado debe bajar ≥40 %: ${texto.length} > ${ANTES_L4 * 0.6}`);
});

function seccion(texto: string, titulo: string): string {
  const i = texto.indexOf(`## ${titulo}`);
  if (i < 0) return '';
  const resto = texto.slice(i + 3);
  const fin = resto.search(/\n#{1,2} /);
  return fin < 0 ? resto : resto.slice(0, fin);
}

Deno.test('L4 recortes: diario 7 entradas (3 en detalle) con la tendencia de 14 días intacta', async () => {
  const texto = await estadoCompleto();
  const diario = seccion(texto, 'Diario del gladiador');
  const entradas = diario.split('\n').filter((l) => /^- \d{4}-\d{2}-\d{2}/.test(l));
  equal(entradas.length, 7);
  equal((diario.match(/Vivido: /g) ?? []).length, 3, 'solo 3 en detalle');
  ok(diario.includes('DIARIO-0') && diario.includes('DIARIO-2'), 'las 3 últimas con su texto');
  ok(!diario.includes('DIARIO-3'), 'la cuarta, solo con sus cifras');
  ok(/Últimos 7 días: .*\(antes /.test(diario), 'la tendencia compara con los 7 días anteriores');
  ok(diario.includes('Emociones más repetidas en 14 días'));
  ok(!texto.includes('DIARIO-8'), 'nada de la entrada 8 en adelante');
});

Deno.test('L4 recortes: hechos ≤12, perdurables antiguos incluidos y sin duplicar', async () => {
  const datos = datosRealistas();
  // Un aprendizaje de hace medio año y 30 registros recientes: el aprendizaje no se pierde.
  datos.coach_facts = [
    { id: 'viejo', user_id: USER_ID, date: '2026-04-01', category: 'aprendizaje', content: 'APRENDIZAJE-VIEJO: rinde mejor entrenando por la mañana.' },
    ...Array.from({ length: 30 }, (_, i) => ({ id: `n${i}`, user_id: USER_ID, date: dia(i), category: 'log', content: `LOG-${i} ` + 'x'.repeat(600) })),
  ];
  const texto = await estadoCompleto(datos);
  const lineas = [...seccion(texto, 'Lo que has aprendido sobre él').split('\n'), ...seccion(texto, 'Registro reciente').split('\n')]
    .filter((l) => l.startsWith('- ('));
  ok(lineas.length <= 12, `${lineas.length} hechos`);
  ok(texto.includes('APRENDIZAJE-VIEJO'), 'el perdurable antiguo sigue');
  ok(texto.includes('LOG-0 '), 'el más reciente está');
  ok(!texto.includes('LOG-11 '), 'el 12.º log ya no cabe (11 recientes + 1 perdurable)');
  ok(lineas.every((l) => l.length <= 300), 'recortados');
  equal(new Set(lineas).size, lineas.length, 'sin duplicados');
});

Deno.test('L4 recortes: agenda ≤8 con notas cortas; campañas 5 por campaña con el resto contado', async () => {
  const texto = await estadoCompleto();
  const agenda = seccion(texto, 'Agenda próxima').split('\n').filter((l) => l.startsWith('- ['));
  ok(agenda.length <= 8 && agenda.length > 0);
  ok(agenda.every((l) => l.length <= 260), 'notas recortadas');
  const camp = seccion(texto, 'Mazmorras activas');
  for (const d of ['d0', 'd1', 'd2']) {
    const bloque = camp.split(/\n- /).find((b) => b.includes(`[${d}]`)) ?? '';
    ok((bloque.match(/ {2}· \[t/g) ?? []).length <= 5, `${d}: como mucho 5 tareas`);
  }
  ok(/\+\d+ pendientes más/.test(camp), 'dice cuántas quedan fuera');
});

Deno.test('L4 recortes FIJOS: el estado no depende del mensaje (misma salida dos veces)', async () => {
  const a = await estadoCompleto();
  const b = await estadoCompleto();
  equal(a, b);
});

import { COACH_KNOWLEDGE } from './knowledge.ts';
import { SISTEMA_FIJO } from './prompt.ts';

Deno.test('L4 notas de lectura: viven en la parte fija, no en el estado de cada turno', async () => {
  const texto = await estadoCompleto();
  const fijo = SISTEMA_FIJO.join('\n');
  for (const frase of ['PERFECTO = todo hecho', 'Mañana, lo primero" de ayer', 'Un solo gesto.', 'el problema es el registro, no la conducta']) {
    ok(fijo.includes(frase), `«${frase}» en la parte fija`);
    ok(!texto.includes(frase), `«${frase}» ya no se repite en el estado`);
  }
  // La lectura que depende de SUS datos sigue en el estado (L1).
  ok(texto.includes('compruébalo con consultar_dia'));
});

Deno.test('L4 IRONMAN: el objetivo del dueño ya no está fijado en la doctrina', () => {
  ok(!/IRONMAN|2029/i.test(COACH_KNOWLEDGE), 'sin IRONMAN 2029 en knowledge.ts');
  ok(COACH_KNOWLEDGE.includes('objetivo de resistencia que tenga en su ficha'), 'generalizado');
});
