// Las herramientas de resistencia del coach: el pago, la privacidad y las salidas.
import { assert, assertEquals, assertRejects, assertStringIncludes } from 'jsr:@std/assert@1';
import type { Db } from './db.ts';
import type { Ventana } from './mejorHora.ts';
import {
  ajustarSesionPlan,
  CARDIO_DAILY_CAP,
  CARDIO_SESSION_XP,
  cardioXp,
  cuandoSalir,
  descuentoEco,
  elegirSesionPlan,
  fijarCarrera,
  franjasOcupadas,
  horaEnPuntoSiguiente,
  horaLocal,
  instanteLocal,
  registrarEntreno,
  textoVeredicto,
  tramoDelDia,
  xpPagado,
  type EcoActo,
  type PuertasXp,
} from './resistenciaCoach.ts';
import { TOOL_DEFS, restoDelModulo } from './tools.ts';
import { PACK_REGISTRO } from './packs.ts';
import { sumarDias } from './estudioResistencia.ts';
import { vaciarCachePrevision } from './tiempo.ts';

const USER = '00000000-0000-4000-8000-0000000000c1';
const HOY = new Date().toISOString().slice(0, 10);
const AYER = sumarDias(HOY, -1);

type Fila = Record<string, unknown>;

/** PostgREST en memoria: lo justo para ver qué se escribe y con qué filtros. */
function fake(inicial: Record<string, Fila[]> = {}, xpTope = Infinity) {
  const t: Record<string, Fila[]> = { profiles: [{ id: USER, xp_total: 100, timezone: 'Europe/Madrid', wake_time: '07:00:00', sleep_time: '22:00:00' }], ...inicial };
  const rpc: { fn: string; args: Record<string, any> }[] = [];
  const escritoSinDueno: string[] = [];
  let nid = 0;
  const sb = {
    rpc: (fn: string, args: Record<string, any>) => {
      rpc.push({ fn, args });
      const p = t.profiles![0]!;
      p.xp_total = Number(p.xp_total) + Math.min(args.p_amount, xpTope);
      return Promise.resolve({ data: { ...p }, error: null });
    },
    from: (tabla: string) => {
      const filtros: [string, string, unknown][] = [];
      let accion: 'leer' | 'update' | 'delete' = 'leer';
      let patch: Fila = {};
      let creadas: Fila[] | null = null;
      const lista = () => (t[tabla] ??= []);
      const pasa = (f: Fila) =>
        filtros.every(([op, c, v]) =>
          op === 'eq' ? f[c] === v : op === 'gte' ? String(f[c]) >= String(v) : op === 'lte' ? String(f[c]) <= String(v) : op === 'in' ? (v as unknown[]).includes(f[c]) : op === 'is' ? (f[c] ?? null) === v : true);
      const resolver = () => {
        if (creadas) return { data: creadas, error: null };
        if (accion === 'update') {
          if (!filtros.some(([, c]) => c === 'user_id' || c === 'id')) escritoSinDueno.push(tabla);
          lista().filter(pasa).forEach((f) => Object.assign(f, patch));
          return { data: lista().filter(pasa), error: null };
        }
        if (accion === 'delete') {
          t[tabla] = lista().filter((f) => !pasa(f));
          return { data: [], error: null };
        }
        return { data: lista().filter(pasa), error: null };
      };
      const q: Record<string, unknown> = {
        select: () => q,
        eq: (c: string, v: unknown) => { filtros.push(['eq', c, v]); return q; },
        gte: (c: string, v: unknown) => { filtros.push(['gte', c, v]); return q; },
        lte: (c: string, v: unknown) => { filtros.push(['lte', c, v]); return q; },
        in: (c: string, v: unknown) => { filtros.push(['in', c, v]); return q; },
        is: (c: string, v: unknown) => { filtros.push(['is', c, v]); return q; },
        order: () => q,
        limit: () => q,
        insert: (f: Fila | Fila[]) => {
          creadas = (Array.isArray(f) ? f : [f]).map((x) => ({ id: `id${++nid}`, ...x }));
          lista().push(...creadas);
          return q;
        },
        upsert: (f: Fila, o: { onConflict: string; ignoreDuplicates?: boolean }) => {
          const claves = o.onConflict.split(',');
          const previa = lista().find((x) => claves.every((c) => x[c] === f[c]));
          if (previa && o.ignoreDuplicates) creadas = [];
          else if (previa) { Object.assign(previa, f); creadas = [previa]; }
          else { const nueva = { id: `id${++nid}`, ...f }; lista().push(nueva); creadas = [nueva]; }
          return q;
        },
        update: (p: Fila) => { accion = 'update'; patch = p; return q; },
        delete: () => { accion = 'delete'; return q; },
        maybeSingle: () => {
          const r = resolver();
          const fila = (r.data as Fila[])[0];
          return Promise.resolve({ data: fila ? { ...fila } : null, error: null });
        },
        single: () => {
          const r = resolver();
          return Promise.resolve({ data: (r.data as Fila[])[0], error: null });
        },
        then: (a: never, b: never) => Promise.resolve(resolver()).then(a, b),
      };
      return q;
    },
  } as unknown as Db;
  return { sb, t, rpc, escritoSinDueno, ctx: { sb, userId: USER, today: HOY } };
}

function puertas(eco: Partial<EcoActo> = {}, llamadas: string[] = []): PuertasXp {
  return {
    propagarActo: (_c, link) => {
      llamadas.push(link);
      return Promise.resolve({ texto: '', enlazadas: 0, pagadoMisiones: 0, xpAhora: 0, ...eco });
    },
    restoDelModulo,
  };
}

const CORRER = { deporte: 'carrera', fecha: '', hora: '', duracion_min: 50, distancia_km: 10, fc_media: 0, desnivel_m: 0, rpe: 0, largo_piscina_m: 0, notas: '', es_otra_sesion: false };

Deno.test('definiciones: las cuatro nuevas, sin strict ni uniones', () => {
  const nombres = TOOL_DEFS.map((t) => t.name);
  assertEquals(nombres.length, 32);
  for (const n of ['cuando_salir', 'fijar_carrera', 'ajustar_sesion_plan', 'registrar_entreno']) assert(nombres.includes(n), n);
  const texto = JSON.stringify(TOOL_DEFS);
  assert(!texto.includes('"strict"'));
  assert(!/"type":\[/.test(texto), 'sin tipos unión');
  const consulta = TOOL_DEFS.find((t) => t.name === 'consultar_historial')!;
  const que = (consulta.input_schema.properties as Record<string, { enum: string[] }>).que!.enum;
  for (const n of ['entrenos', 'bienestar', 'plan']) assert(que.includes(n), n);
  assert(!PACK_REGISTRO.includes('registrar_entreno'), 'la ruta estrecha tiene su techo de coste');
});

Deno.test('definiciones: sin guion largo en las nuevas', () => {
  const nuevas = TOOL_DEFS.filter((t) => ['cuando_salir', 'fijar_carrera', 'ajustar_sesion_plan', 'registrar_entreno'].includes(t.name));
  assert(!/[—–]/.test(JSON.stringify(nuevas)));
});

Deno.test('paridad: las constantes de XP son las de game.ts', async () => {
  const game = await Deno.readTextFile(new URL('../../../src/lib/game.ts', import.meta.url));
  assertEquals(Number(/CARDIO_SESSION_XP = (\d+)/.exec(game)![1]), CARDIO_SESSION_XP);
  assertEquals(Number(/CARDIO_DAILY_CAP = (\d+)/.exec(game)![1]), CARDIO_DAILY_CAP);
});

Deno.test('paridad: entrenoEspejo.ts es byte a byte el de la app', async () => {
  const copia = await Deno.readFile(new URL('./entrenoEspejo.ts', import.meta.url));
  const original = await Deno.readFile(new URL('../../../src/lib/entrenoEspejo.ts', import.meta.url));
  assertEquals(copia, original);
});

Deno.test('cardioXp: base, margen y tope', () => {
  assertEquals(cardioXp('correr', 0), 40);
  assertEquals(cardioXp('correr', 40), 20);
  assertEquals(cardioXp('correr', 60), 0);
  assertEquals(cardioXp('correr', 90), 0);
  assertEquals(cardioXp('caminar', 0), 15);
});

Deno.test('descuento: como pagoActo.descuentoDeMision', () => {
  assertEquals(descuentoEco(null, true), 0);
  assertEquals(descuentoEco({ pagadoMisiones: 25, xpAhora: 0 }, true), 25);
  assertEquals(descuentoEco({ pagadoMisiones: 25, xpAhora: 0 }, false), 0);
  assertEquals(descuentoEco({ pagadoMisiones: 25, xpAhora: 10 }, false), 10);
  assertEquals(descuentoEco({ pagadoMisiones: null, xpAhora: null }, true), null);
  assertEquals(restoDelModulo(40, null), 40);
});

Deno.test('xpPagado: nunca más de lo pedido ni de lo que subió', () => {
  assertEquals(xpPagado(40, 100, 140), 40);
  assertEquals(xpPagado(40, 100, 120), 20);
  assertEquals(xpPagado(40, 100, 100), 0);
});

Deno.test('registrar: primera sesión sin misión, 40 XP por la RPC y espejo', async () => {
  const f = fake();
  const llamadas: string[] = [];
  const r = await registrarEntreno(f.ctx, CORRER, puertas({}, llamadas));
  assertStringIncludes(r, '+40 XP');
  assertEquals(f.rpc.length, 1);
  assertEquals(f.rpc[0]!.fn, 'award_xp');
  assertEquals(f.rpc[0]!.args.p_amount, 40);
  assertEquals(f.rpc[0]!.args.p_event, 'cardio_session');
  assertEquals(f.rpc[0]!.args.p_stat, 'FUE');
  assertEquals(llamadas, ['cardio']);
  const espejo = f.t.cardio_sessions![0]!;
  assertEquals([espejo.kind, espejo.distance_km, espejo.duration_min, espejo.xp_awarded, espejo.zone], ['correr', 10, 50, 40, 'libre']);
  const fila = f.t.entrenos_medidos![0]!;
  assertEquals([fila.origen, fila.deporte, fila.fecha, fila.xp_awarded, fila.user_id], ['manual', 'carrera', HOY, 40, USER]);
});

Deno.test('registrar: la misión enlazada descuenta y el módulo paga el resto', async () => {
  const f = fake();
  const r = await registrarEntreno(f.ctx, CORRER, puertas({ pagadoMisiones: 25, xpAhora: 25, texto: ' Marcado solo: Correr.' }));
  assertEquals(f.rpc[0]!.args.p_amount, 15);
  assertStringIncludes(r, 'Marcado solo: Correr.');
  assertEquals(f.t.cardio_sessions![0]!.xp_awarded, 15);
});

Deno.test('registrar: si la misión paga todo, el módulo no toca el XP', async () => {
  const f = fake();
  const r = await registrarEntreno(f.ctx, CORRER, puertas({ pagadoMisiones: 50, xpAhora: 50 }));
  assertEquals(f.rpc.length, 0);
  assertStringIncludes(r, 'ya lo pagó la misión');
  assertEquals(f.t.cardio_sessions![0]!.xp_awarded, 0);
});

Deno.test('registrar: segunda disciplina del día, sin descontar la misión ya cobrada y con el tope', async () => {
  const f = fake({ cardio_sessions: [{ user_id: USER, date: HOY, kind: 'correr', xp_awarded: 40, distance_km: 5, duration_min: 30, avg_hr: null, rpe: null, zone: 'libre', notes: null }] });
  await registrarEntreno(f.ctx, { ...CORRER, deporte: 'bici', distancia_km: 30 }, puertas({ pagadoMisiones: 25, xpAhora: 0 }));
  assertEquals(f.rpc[0]!.args.p_amount, 20, 'solo el margen hasta 60 y sin descuento');
});

Deno.test('registrar: día agotado, sesión guardada y nada de XP', async () => {
  const f = fake({ cardio_sessions: [{ user_id: USER, date: HOY, kind: 'correr', xp_awarded: 60, distance_km: 5, duration_min: 30, avg_hr: null, rpe: null, zone: 'libre', notes: null }] });
  const r = await registrarEntreno(f.ctx, { ...CORRER, deporte: 'bici' }, puertas());
  assertEquals(f.rpc.length, 0);
  assertStringIncludes(r, 'tope');
  assertEquals(f.t.entrenos_medidos!.length, 1);
});

Deno.test('registrar: el servidor recorta y se apunta lo pagado de verdad', async () => {
  const f = fake({}, 10);
  const r = await registrarEntreno(f.ctx, CORRER, puertas());
  assertStringIncludes(r, '+10 XP');
  assertEquals(f.t.cardio_sessions![0]!.xp_awarded, 10);
});

Deno.test('registrar: lo que ya consta no se apunta otra vez', async () => {
  const f = fake({ cardio_sessions: [{ user_id: USER, date: HOY, kind: 'correr', xp_awarded: 40, distance_km: 5, duration_min: 30 }] });
  const r = await registrarEntreno(f.ctx, CORRER, puertas());
  assertStringIncludes(r, 'Ya consta');
  assertEquals(f.rpc.length, 0);
  assertEquals(f.t.entrenos_medidos, undefined);
});

Deno.test('registrar: otra sesión confirmada se guarda, no toca el espejo y no vuelve a pagar', async () => {
  const f = fake({ cardio_sessions: [{ user_id: USER, date: HOY, kind: 'correr', xp_awarded: 40, distance_km: 5, duration_min: 30, avg_hr: null, rpe: null, zone: 'libre', notes: null }] });
  const llamadas: string[] = [];
  const r = await registrarEntreno(f.ctx, { ...CORRER, es_otra_sesion: true }, puertas({}, llamadas));
  assertEquals(f.rpc.length, 0);
  assertEquals(llamadas, []);
  const espejo = f.t.cardio_sessions![0]!;
  assertEquals([espejo.distance_km, espejo.duration_min, espejo.xp_awarded], [5, 30, 40]);
  assertStringIncludes(r, 'vuelve a pagar');
});

Deno.test('registrar: el mismo parte repetido no duplica ni paga', async () => {
  const f = fake();
  const input = { ...CORRER, es_otra_sesion: true };
  await registrarEntreno(f.ctx, input, puertas());
  const r = await registrarEntreno(f.ctx, input, puertas());
  assertStringIncludes(r, 'ya estaba registrado');
  assertEquals(f.t.entrenos_medidos!.length, 1);
  assertEquals(f.rpc.length, 1);
});

Deno.test('registrar: ayer se guarda, sin espejo, sin XP y sin marcar nada', async () => {
  const f = fake();
  const llamadas: string[] = [];
  const r = await registrarEntreno(f.ctx, { ...CORRER, fecha: AYER, hora: '09:00' }, puertas({}, llamadas));
  assertStringIncludes(r, 'no paga XP');
  assertEquals(llamadas, []);
  assertEquals(f.rpc.length, 0);
  assertEquals(f.t.cardio_sessions ?? [], []);
});

Deno.test('registrar: menos de cinco minutos no paga', async () => {
  const f = fake();
  const r = await registrarEntreno(f.ctx, { ...CORRER, duracion_min: 4 }, puertas());
  assertStringIncludes(r, 'no paga XP');
  assertEquals(f.rpc.length, 0);
});

Deno.test('registrar: más antiguo que ayer se guarda, sin espejo ni XP', async () => {
  const f = fake();
  const fecha = sumarDias(HOY, -3);
  const r = await registrarEntreno(f.ctx, { ...CORRER, fecha, hora: '09:00' }, puertas());
  assertStringIncludes(r, 'no paga XP');
  assertEquals(f.rpc.length, 0);
  assertEquals(f.t.cardio_sessions ?? [], []);
  assertEquals(f.t.entrenos_medidos![0]!.fecha, fecha);
});

Deno.test('registrar: fuerza cuenta para la carga, ni paga ni propaga', async () => {
  const f = fake();
  const llamadas: string[] = [];
  await registrarEntreno(f.ctx, { ...CORRER, deporte: 'fuerza', distancia_km: 0 }, puertas({}, llamadas));
  assertEquals([f.rpc.length, llamadas.length], [0, 0]);
  assertEquals(f.t.cardio_sessions ?? [], []);
  assertEquals(f.t.entrenos_medidos!.length, 1);
});

Deno.test('registrar: enlaza la sesión del plan de ese día', async () => {
  const f = fake({
    objetivos_carrera: [{ id: 'o1', user_id: USER, activo: true }],
    plan_sesiones: [{ id: 's1', user_id: USER, objetivo_id: 'o1', fecha: HOY, disciplina: 'carrera', clave: true, hecha_entreno_id: null }],
  });
  await registrarEntreno(f.ctx, CORRER, puertas());
  assertEquals(f.t.plan_sesiones![0]!.hecha_entreno_id, f.t.entrenos_medidos![0]!.id);
});

Deno.test('registrar: rechaza lo imposible', async () => {
  const f = fake();
  await assertRejects(() => registrarEntreno(f.ctx, { ...CORRER, duracion_min: 0 }, puertas()));
  await assertRejects(() => registrarEntreno(f.ctx, { ...CORRER, fecha: sumarDias(HOY, 1) }, puertas()));
  await assertRejects(() => registrarEntreno(f.ctx, { ...CORRER, deporte: 'ajedrez' }, puertas()));
  await assertRejects(() => registrarEntreno(f.ctx, { ...CORRER, hora: '99:00' }, puertas()));
  assertEquals(f.t.entrenos_medidos, undefined);
});

Deno.test('elegirSesionPlan: clave primero, brick de reserva, natación no salda brick', () => {
  const s = (id: string, disciplina: string, clave = false, hecha: string | null = null) => ({ id, disciplina, clave, hecha_entreno_id: hecha });
  assertEquals(elegirSesionPlan([s('a', 'carrera'), s('b', 'carrera', true)], 'carrera')?.id, 'b');
  assertEquals(elegirSesionPlan([s('a', 'brick')], 'bici')?.id, 'a');
  assertEquals(elegirSesionPlan([s('a', 'brick')], 'piscina'), null);
  assertEquals(elegirSesionPlan([s('a', 'carrera', false, 'e1')], 'carrera'), null);
  assertEquals(elegirSesionPlan([s('a', 'carrera')], 'otro'), null);
});

Deno.test('fijar_carrera: crea el plan y desactiva la anterior', async () => {
  const f = fake({ objetivos_carrera: [{ id: 'viejo', user_id: USER, activo: true }] });
  const r = await fijarCarrera(f.ctx, { tipo: 'olimpico', nombre: '', fecha: sumarDias(HOY, 70), horas_semana: 8, nivel: 'intermedio', natacion_m: 0, bici_m: 0, carrera_m: 0 });
  assertStringIncludes(r, 'Carrera fijada');
  assertEquals(f.t.objetivos_carrera![0]!.activo, false);
  const nuevo = f.t.objetivos_carrera![1]!;
  assertEquals([nuevo.activo, nuevo.natacion_m, nuevo.bici_m, nuevo.carrera_m], [true, 1500, 40000, 10000]);
  assert(f.t.plan_sesiones!.length > 10);
  assert(f.t.plan_sesiones!.every((s) => s.user_id === USER && s.objetivo_id === nuevo.id));
});

Deno.test('fijar_carrera: valida la entrada', async () => {
  const f = fake();
  const base = { tipo: 'sprint', nombre: '', fecha: sumarDias(HOY, 30), horas_semana: 6, nivel: 'intermedio', natacion_m: 0, bici_m: 0, carrera_m: 0 };
  await assertRejects(() => fijarCarrera(f.ctx, { ...base, fecha: HOY }));
  await assertRejects(() => fijarCarrera(f.ctx, { ...base, horas_semana: 90 }));
  await assertRejects(() => fijarCarrera(f.ctx, { ...base, tipo: 'otra' }));
  await assertRejects(() => fijarCarrera(f.ctx, { ...base, tipo: 'caminata' }));
});

const AJUSTE = { titulo: '', detalle: '', fecha: '', disciplina: '', duracion_min: 0, zona: '', motivo: 'Fatiga alta' };

Deno.test('ajustar_sesion: marca la edición y solo la suya', async () => {
  const f = fake({ plan_sesiones: [
    { id: 's1', user_id: USER, objetivo_id: 'o1', semana: 2, fecha: HOY, hecha_entreno_id: null, duracion_min: 60 },
    { id: 's2', user_id: 'otro', objetivo_id: 'o2', semana: 2, fecha: HOY, hecha_entreno_id: null, duracion_min: 60 },
  ] });
  await ajustarSesionPlan(f.ctx, { ...AJUSTE, sesion_id: 's1', duracion_min: 40, zona: 'Z2' });
  const a = f.t.plan_sesiones![0]!;
  assertEquals([a.duracion_min, a.zona, a.editada_por_coach, a.nota_coach], [40, 'Z2', true, 'Fatiga alta']);
  await assertRejects(() => ajustarSesionPlan(f.ctx, { ...AJUSTE, sesion_id: 's2', duracion_min: 40 }));
  assertEquals(f.t.plan_sesiones![1]!.duracion_min, 60);
});

Deno.test('ajustar_sesion: lo hecho y el pasado no se tocan; descanso a cero; semana recalculada', async () => {
  const lejos = sumarDias(HOY, 14);
  const f = fake({
    objetivos_carrera: [{ id: 'o1', user_id: USER, fecha: sumarDias(HOY, 30) }],
    plan_sesiones: [
      { id: 'h', user_id: USER, objetivo_id: 'o1', semana: 1, fecha: HOY, hecha_entreno_id: 'e1' },
      { id: 'p', user_id: USER, objetivo_id: 'o1', semana: 3, fecha: HOY, hecha_entreno_id: null, zona: 'Z3', duracion_min: 50 },
    ],
  });
  await assertRejects(() => ajustarSesionPlan(f.ctx, { ...AJUSTE, sesion_id: 'h', duracion_min: 10 }));
  await assertRejects(() => ajustarSesionPlan(f.ctx, { ...AJUSTE, sesion_id: 'p', fecha: AYER }));
  await assertRejects(() => ajustarSesionPlan(f.ctx, { ...AJUSTE, sesion_id: 'p', fecha: sumarDias(HOY, 31) }));
  await ajustarSesionPlan(f.ctx, { ...AJUSTE, sesion_id: 'p', disciplina: 'descanso' });
  const p = f.t.plan_sesiones![1]!;
  assertEquals([p.duracion_min, p.zona], [0, null]);
  await ajustarSesionPlan(f.ctx, { ...AJUSTE, sesion_id: 'p', fecha: lejos });
  assertEquals([p.fecha, p.semana], [lejos, 5]);
});

Deno.test('hora local: invierno, verano y cambio de hora', () => {
  assertEquals(new Date(instanteLocal('2026-01-15', '10:00', 'Europe/Madrid')).toISOString(), '2026-01-15T09:00:00.000Z');
  assertEquals(new Date(instanteLocal('2026-07-15', '10:00', 'Europe/Madrid')).toISOString(), '2026-07-15T08:00:00.000Z');
  assertEquals(horaLocal(Date.parse('2026-07-15T08:30:00Z'), 'Europe/Madrid'), '10:30');
  assertEquals(horaLocal(Date.parse('2026-01-15T08:30:00Z'), 'America/New_York'), '03:30');
});

Deno.test('tramo del día: hoy nunca en el pasado, y medianoche', () => {
  assertEquals(horaEnPuntoSiguiente('19:05'), '20:00');
  assertEquals(horaEnPuntoSiguiente('19:00'), '19:00');
  assertEquals(horaEnPuntoSiguiente('23:30'), '24:00');
  assertEquals(tramoDelDia({ esHoy: true, ahora: '19:05', despertar: '07:00:00', dormir: '23:00:00' }), { desde: '20:00', hasta: '23:00' });
  assertEquals(tramoDelDia({ esHoy: true, ahora: '05:10', despertar: '07:00', dormir: '23:00' }), { desde: '07:00', hasta: '23:00' });
  assertEquals(tramoDelDia({ esHoy: false, ahora: '19:05', despertar: '07:00', dormir: '00:30' }), { desde: '07:00', hasta: '24:00' });
  assertEquals(tramoDelDia({ esHoy: false, ahora: '19:05', despertar: null, dormir: null }), { desde: '07:00', hasta: '22:00' });
});

Deno.test('franjas: el bloque aeróbico no ocupa, las citas cuentan una hora', () => {
  assertEquals(
    franjasOcupadas(
      [{ start_min: 540, end_min: 660, kind: 'deep_work' }, { start_min: 1080, end_min: 1140, kind: 'aerobico' }],
      [{ time: '13:00:00' }, { time: null }, { time: '23:30:00' }],
    ),
    [{ desde: '09:00', hasta: '11:00' }, { desde: '13:00', hasta: '14:00' }, { desde: '23:30', hasta: '24:00' }],
  );
});

const VENTANA: Ventana = { inicio: '2026-11-08T18:00', fin: '2026-11-08T19:00', puntuacion: 82, motivos: ['buen_tiempo'], clima: { temp: 14, lluvia_prob: 10, viento_kmh: 8 } };

Deno.test('veredicto: textos con la hora calculada y derivación con dolor', () => {
  assertStringIncludes(textoVeredicto({ tipo: 'salir', ventana: VENTANA, alternativas: [] }, null), '18:00 a 19:00');
  const dolor = textoVeredicto({ tipo: 'descanso', motivo: 'dolor' }, 'rodilla');
  assertStringIncludes(dolor, 'profesional sanitario');
  assertStringIncludes(dolor, 'urgencias');
  assertStringIncludes(textoVeredicto({ tipo: 'sin_ventana', motivo: 'clima' }, null), 'No propongas una hora');
  for (const v of [{ tipo: 'descanso', motivo: 'sueno' }, { tipo: 'descanso', motivo: 'riesgo' }, { tipo: 'sin_ventana', motivo: 'horario' }, { tipo: 'suave', motivo: 'fatiga', ventana: VENTANA, alternativas: [VENTANA] }] as const) {
    assert(!/[—–]/.test(textoVeredicto(v as never, null)));
  }
});

function conFetchVigilado() {
  const original = globalThis.fetch;
  const urls: string[] = [];
  const horas = Array.from({ length: 48 }, (_, i) => new Date(Date.parse(`${HOY}T00:00:00Z`) + i * 3600000).toISOString().slice(0, 13) + ':00');
  globalThis.fetch = ((u: string) => {
    urls.push(String(u));
    return Promise.resolve(new Response(JSON.stringify({ hourly: { time: horas, temperature_2m: horas.map(() => 15), is_day: horas.map(() => 1), weather_code: horas.map(() => 1) } })));
  }) as typeof fetch;
  return { urls, restaurar: () => { globalThis.fetch = original; } };
}

const SALIDA = { dia: 'manana', disciplina: 'carrera', duracion_min: 60 };
const UBICADO = { user_id: USER, fc_max: 190, fc_reposo: 50, fc_umbral: null, ubicacion_lat: 40.42, ubicacion_lon: -3.7, ubicacion_nombre: 'Madrid', ubicacion_consentida_en: '2026-11-01T00:00:00Z' };

Deno.test('cuando_salir: con dolor no pregunta la previsión y deriva', async () => {
  vaciarCachePrevision();
  const w = conFetchVigilado();
  try {
    const f = fake({ entreno_perfil: [UBICADO], entreno_bienestar: [{ user_id: USER, fecha: HOY, dolor: true, dolor_zona: 'rodilla', sueno_h: 8, fatiga: 1 }] });
    const r = await cuandoSalir(f.ctx, SALIDA);
    assertStringIncludes(r, 'profesional sanitario');
    assertEquals(w.urls.length, 0);
  } finally {
    w.restaurar();
  }
});

Deno.test('cuando_salir: sin ubicación consentida no hay previsión', async () => {
  vaciarCachePrevision();
  const w = conFetchVigilado();
  try {
    const f = fake({ entreno_perfil: [{ ...UBICADO, ubicacion_consentida_en: null }] });
    assertStringIncludes(await cuandoSalir(f.ctx, SALIDA), 'Sin ubicación');
    assertEquals(w.urls.length, 0);
  } finally {
    w.restaurar();
  }
});

Deno.test('cuando_salir: da una ventana y solo salen coordenadas redondeadas', async () => {
  vaciarCachePrevision();
  const w = conFetchVigilado();
  try {
    const f = fake({ entreno_perfil: [UBICADO] });
    const r = await cuandoSalir(f.ctx, SALIDA);
    assertStringIncludes(r, 'Veredicto: salir');
    assertEquals(w.urls.length, 1);
    const u = new URL(w.urls[0]!);
    assertEquals(u.searchParams.get('latitude'), '40.42');
    assert(!w.urls[0]!.includes(USER));
  } finally {
    w.restaurar();
  }
});

Deno.test('cuando_salir: si la previsión falla, no inventa', async () => {
  vaciarCachePrevision();
  const original = globalThis.fetch;
  globalThis.fetch = (() => Promise.reject(new TypeError('sin red'))) as typeof fetch;
  try {
    const f = fake({ entreno_perfil: [UBICADO] });
    assertStringIncludes(await cuandoSalir(f.ctx, SALIDA), 'No inventes');
  } finally {
    globalThis.fetch = original;
  }
});
