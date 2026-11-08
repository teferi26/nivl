// El camino de pago de un entreno medido, con los efectos simulados.
import { cardioDayState, saveCardio } from '../bodywork';
import { ensureProfile, fetchCompletionsForDate, fetchQuests } from '../data';
import { addDays, dateKey } from '../dates';
import { awardXp } from '../engine';
import { propagarActo } from '../links';
import { guardarEntrenoMedido } from '../resistencia';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn(), functions: { invoke: jest.fn() } } }));
jest.mock('../bodywork', () => ({ cardioDayState: jest.fn(), fetchCardio: jest.fn(), saveCardio: jest.fn() }));
jest.mock('../data', () => ({ ensureProfile: jest.fn(), fetchQuests: jest.fn(), fetchCompletionsForDate: jest.fn() }));
jest.mock('../engine', () => ({ awardXp: jest.fn() }));
jest.mock('../links', () => ({ propagarActo: jest.fn() }));
jest.mock('../closing', () => ({ questsScheduledOn: (q: unknown[]) => q }));
// `pagoActo` arrastra React Native por `SIN_DATO`.
jest.mock('@/components/ui/sinDato', () => ({ SIN_DATO: '-' }));

const USER = 'u1';
const hoy = dateKey();
const inicioDe = (fecha: string) => `${fecha}T12:00:00`;
const entrada = (fecha: string, deporte = 'carrera') => ({
  origen: 'watch',
  externo_id: 'w1',
  deporte,
  inicio: inicioDe(fecha),
  fin: `${fecha}T13:00:00`,
  duracion_s: 3600,
  distancia_m: 10000,
  fc_media: null,
});

/** Una consulta encadenable y a la vez «thenable», como las de supabase-js. */
function consulta(resultado: { data: unknown; error: unknown }) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'upsert', 'update', 'delete', 'insert', 'eq', 'gte', 'lte', 'order', 'limit', 'in', 'range', 'contains']) q[m] = jest.fn(() => q);
  q.maybeSingle = jest.fn(() => Promise.resolve({ data: null, error: null }));
  q.single = jest.fn(() => Promise.resolve(resultado));
  q.then = (res: (v: unknown) => unknown) => Promise.resolve(resultado).then(res);
  return q;
}

function mockTablas(insertada: unknown) {
  const tablas: Record<string, ReturnType<typeof consulta>> = {};
  jest.mocked(supabase.from).mockImplementation(((t: string) => {
    if (t === 'entrenos_medidos') {
      tablas[t] = consulta({ data: insertada ? [insertada] : [], error: null });
      return tablas[t];
    }
    return consulta({ data: [], error: null });
  }) as never);
  return tablas;
}

const FILA = { id: 'e1', user_id: USER, deporte: 'carrera', fecha: hoy, xp_awarded: 0 };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(ensureProfile).mockResolvedValue({ id: USER, xp_total: 100 } as never);
  jest.mocked(cardioDayState).mockResolvedValue({ pagadoHoy: 0, pagadoEsteTipo: null, tiposHoy: [] });
  jest.mocked(saveCardio).mockResolvedValue({} as never);
  jest.mocked(awardXp).mockResolvedValue({ profile: { xp_total: 140 } } as never);
  jest.mocked(propagarActo).mockResolvedValue({ xp: 0, xpMisiones: 0, marcadas: [] } as never);
  jest.mocked(fetchQuests).mockResolvedValue([]);
  jest.mocked(fetchCompletionsForDate).mockResolvedValue([]);
});

test('un entreno inválido no toca la base', async () => {
  const r = await guardarEntrenoMedido(USER, { origen: 'watch' });
  expect(r).toEqual({ ok: false, motivo: 'deporte' });
  expect(supabase.from).not.toHaveBeenCalled();
});

test('nuevo y de hoy: espejo, propaga con su fecha y paga lo que entró', async () => {
  mockTablas(FILA);
  const r = await guardarEntrenoMedido(USER, entrada(hoy));
  expect(r).toMatchObject({ ok: true, nuevo: true });
  expect(propagarActo).toHaveBeenCalledWith(expect.anything(), 'cardio', hoy, null, 'carrera');
  expect(awardXp).toHaveBeenCalledTimes(1);
  const [, cantidad, stat, evento, payload] = jest.mocked(awardXp).mock.calls[0]!;
  expect(stat).toBe('FUE');
  expect(evento).toBe('cardio_session');
  expect(cantidad).toBeGreaterThan(0);
  expect(payload).toMatchObject({ kind: 'correr', km: 10, min: 60, date: hoy, entreno_id: 'e1' });
  expect(jest.mocked(saveCardio).mock.calls[0]![1]).toMatchObject({ date: hoy, kind: 'correr', distance_km: 10, duration_min: 60, zone: 'libre', xp: 0 });
  expect(jest.mocked(saveCardio).mock.calls[1]![1]).toMatchObject({ xp: cantidad });
  expect(r.ok && r.pagado).toBe(Math.min(cantidad, 40));
});

test('reimportar no paga ni propaga', async () => {
  mockTablas(null);
  const r = await guardarEntrenoMedido(USER, entrada(hoy));
  expect(r).toMatchObject({ ok: true, nuevo: false, pagado: 0, anuncio: null });
  expect(awardXp).not.toHaveBeenCalled();
  expect(propagarActo).not.toHaveBeenCalled();
  expect(saveCardio).not.toHaveBeenCalled();
});

test('un histórico se guarda y no paga', async () => {
  mockTablas(FILA);
  const r = await guardarEntrenoMedido(USER, entrada(addDays(hoy, -2)));
  expect(r).toMatchObject({ ok: true, nuevo: true, pagado: 0 });
  expect(saveCardio).not.toHaveBeenCalled();
  expect(awardXp).not.toHaveBeenCalled();
});

test('fuerza se guarda, no paga y no propaga', async () => {
  mockTablas(FILA);
  const r = await guardarEntrenoMedido(USER, entrada(hoy, 'fuerza'));
  expect(r).toMatchObject({ ok: true, nuevo: true, pagado: 0 });
  expect(propagarActo).not.toHaveBeenCalled();
  expect(saveCardio).not.toHaveBeenCalled();
});

test('ya había sesión de ese tipo: ni reescribe, ni propaga, ni cobra', async () => {
  mockTablas(FILA);
  jest.mocked(cardioDayState).mockResolvedValue({ pagadoHoy: 40, pagadoEsteTipo: 40, tiposHoy: ['correr'] });
  const r = await guardarEntrenoMedido(USER, entrada(hoy));
  expect(saveCardio).not.toHaveBeenCalled();
  expect(awardXp).not.toHaveBeenCalled();
  expect(propagarActo).not.toHaveBeenCalled();
  expect(r).toMatchObject({ ok: true, nuevo: true, pagado: 0 });
});

test('una fila con 0 XP (descontada por la misión) también cuenta como hecha', async () => {
  mockTablas(FILA);
  jest.mocked(cardioDayState).mockResolvedValue({ pagadoHoy: 0, pagadoEsteTipo: 0, tiposHoy: ['correr'] });
  await guardarEntrenoMedido(USER, entrada(hoy));
  expect(awardXp).not.toHaveBeenCalled();
  expect(propagarActo).not.toHaveBeenCalled();
});

test('Salud se guarda con 0 XP, no propaga y pide confirmación', async () => {
  mockTablas(FILA);
  const r = await guardarEntrenoMedido(USER, { ...entrada(hoy), origen: 'salud' });
  expect(r).toMatchObject({ ok: true, nuevo: true, pagado: 0, proponer: true });
  expect(saveCardio).not.toHaveBeenCalled();
  expect(propagarActo).not.toHaveBeenCalled();
  expect(awardXp).not.toHaveBeenCalled();
});

test('si no se pueden leer las misiones no se guarda nada', async () => {
  mockTablas(FILA);
  jest.mocked(fetchQuests).mockRejectedValue(new Error('red'));
  const r = await guardarEntrenoMedido(USER, entrada(hoy));
  expect(r.ok).toBe(false);
  expect(saveCardio).not.toHaveBeenCalled();
  expect(awardXp).not.toHaveBeenCalled();
});

test('el evento lleva origen y llave para auditar', async () => {
  mockTablas(FILA);
  await guardarEntrenoMedido(USER, entrada(hoy));
  expect(jest.mocked(awardXp).mock.calls[0]![4]).toMatchObject({ origen: 'watch', externo_id: 'w1' });
});

test('la misión enlazada descuenta al módulo y se apunta lo pagado', async () => {
  mockTablas(FILA);
  jest.mocked(propagarActo).mockResolvedValue({ xp: 500, xpMisiones: 500, marcadas: ['Correr'] } as never);
  const r = await guardarEntrenoMedido(USER, entrada(hoy));
  expect(awardXp).not.toHaveBeenCalled();
  expect(jest.mocked(saveCardio).mock.calls[0]![1]).toMatchObject({ xp: 0 });
  expect(saveCardio).toHaveBeenCalledTimes(1);
  expect(r).toMatchObject({ ok: true, pagado: 500 });
});

test('ayer se guarda con 0 XP y sin marcar nada', async () => {
  const ayer = addDays(hoy, -1);
  mockTablas({ ...FILA, fecha: ayer });
  const r = await guardarEntrenoMedido(USER, entrada(ayer));
  expect(r).toMatchObject({ ok: true, nuevo: true, pagado: 0 });
  expect(propagarActo).not.toHaveBeenCalled();
  expect(saveCardio).not.toHaveBeenCalled();
  expect(awardXp).not.toHaveBeenCalled();
});

test('si el espejo falla no se paga y la fila se deshace para poder reintentar', async () => {
  const tablas = mockTablas(FILA);
  jest.mocked(saveCardio).mockRejectedValue(new Error('detalle interno'));
  const r = await guardarEntrenoMedido(USER, entrada(hoy));
  expect(r.ok).toBe(false);
  expect(!r.ok && r.motivo).not.toContain('detalle interno');
  expect(tablas.entrenos_medidos!.delete).toHaveBeenCalled();
  expect(awardXp).not.toHaveBeenCalled();
});

/** La tabla entrenos_medidos con la lectura de gemelos y la del plan separadas. */
function mockConPlan(insertada: unknown, sesiones: unknown[]) {
  const updates: unknown[] = [];
  jest.mocked(supabase.from).mockImplementation(((t: string) => {
    if (t === 'objetivos_carrera') {
      const q = consulta({ data: [], error: null });
      q.maybeSingle = jest.fn(() => Promise.resolve({ data: { id: 'o1' }, error: null }));
      return q;
    }
    if (t === 'plan_sesiones') {
      const q = consulta({ data: sesiones, error: null });
      q.update = jest.fn((v: unknown) => {
        updates.push(v);
        return q;
      });
      return q;
    }
    return consulta({ data: t === 'entrenos_medidos' ? [insertada] : [], error: null });
  }) as never);
  return updates;
}

const SESION = (disciplina: string) => ({ id: 's1', disciplina, clave: false, hecha_entreno_id: null });

test('fuerza no paga pero enlaza su sesión del plan', async () => {
  const updates = mockConPlan({ ...FILA, deporte: 'fuerza' }, [SESION('fuerza')]);
  await guardarEntrenoMedido(USER, entrada(hoy, 'fuerza'));
  expect(updates).toEqual([{ hecha_entreno_id: 'e1' }]);
});

test('un entreno antiguo no paga pero enlaza su sesión del plan', async () => {
  const fecha = addDays(hoy, -14);
  const updates = mockConPlan({ ...FILA, fecha }, [SESION('carrera')]);
  const r = await guardarEntrenoMedido(USER, entrada(fecha));
  expect(r).toMatchObject({ ok: true, pagado: 0 });
  expect(updates).toEqual([{ hecha_entreno_id: 'e1' }]);
});

test('caminar paga lo suyo, sin propagar', async () => {
  mockTablas({ ...FILA, deporte: 'caminar' });
  await guardarEntrenoMedido(USER, entrada(hoy, 'caminar'));
  expect(propagarActo).not.toHaveBeenCalled();
  expect(jest.mocked(awardXp).mock.calls[0]![1]).toBe(15);
});

test('mismo acto con otra llave: ni fila nueva, ni espejo, ni pago', async () => {
  const gemelo = { ...FILA, origen: 'watch', externo_id: 'otro', inicio: inicioDe(hoy), fin: `${hoy}T13:00:00` };
  mockTablas(gemelo);
  const r = await guardarEntrenoMedido(USER, { ...entrada(hoy), origen: 'manual', externo_id: 'manual:1' });
  expect(r).toMatchObject({ ok: true, nuevo: false, pagado: 0 });
  expect(saveCardio).not.toHaveBeenCalled();
  expect(awardXp).not.toHaveBeenCalled();
});

test('si award_xp falla, el espejo no declara lo que no entró', async () => {
  mockTablas(FILA);
  jest.mocked(awardXp).mockRejectedValue(new Error('red'));
  const r = await guardarEntrenoMedido(USER, entrada(hoy));
  expect(r).toMatchObject({ ok: true, pagado: 0 });
  expect(saveCardio).toHaveBeenCalledTimes(1);
  expect(jest.mocked(saveCardio).mock.calls[0]![1]).toMatchObject({ xp: 0 });
});
