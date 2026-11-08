// NIVL · FOCUS: el acto de estudiar de punta a punta, con el servidor falso.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { reenviarEstudio, trasEstudiar } from '@/focus/actoEstudio';
import type { NuevaSesion } from '@/focus/datos';
import { dateKey } from '@/lib/dates';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const mockEstado = {
  red: true,
  guardadas: [] as NuevaSesion[],
  dictado: 0,
  completadas: [] as string[],
  reglas: [] as string[],
  bloques: [] as [string, boolean][],
  quests: [] as Record<string, unknown>[],
  rules: [] as Record<string, unknown>[],
  plan: [] as Record<string, unknown>[],
};

jest.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ select: () => Promise.resolve({ count: 1 }) }) },
}));
jest.mock('@/focus/datos', () => ({
  registrarSesion: jest.fn(async (s: { clientId: string }) => {
    if (!mockEstado.red) throw new TypeError('Network request failed');
    if (!mockEstado.guardadas.some((x) => x.clientId === s.clientId)) mockEstado.guardadas.push(s as never);
  }),
  leerMinutosDelDia: jest.fn(async () => {
    if (!mockEstado.red) return null;
    return mockEstado.guardadas.map((s) => ({ asignaturaId: s.asignaturaId, minutos: s.minutos }));
  }),
}));
jest.mock('@/lib/data', () => ({
  ensureProfile: jest.fn(async () => ({ id: 'u' })),
  fetchQuests: jest.fn(async () => mockEstado.quests),
  fetchCompletionsForDate: jest.fn(async () => mockEstado.completadas.map((q) => ({ quest_id: q, xp_awarded: 25 }))),
}));
jest.mock('@/lib/engine', () => ({
  completeQuest: jest.fn(async (p: unknown, q: { id: string }) => {
    mockEstado.completadas.push(q.id);
    return { profile: p, awarded: true, xp: 25, leveledUp: false, newLevel: 0 };
  }),
}));
jest.mock('@/lib/contract', () => ({
  fetchRules: jest.fn(async () => mockEstado.rules),
  marcarReglaCumplida: jest.fn(async (_u: string, r: string) => void mockEstado.reglas.push(r)),
}));
jest.mock('@/lib/dayplan', () => ({
  fetchPlan: jest.fn(async () => ({ bloques: mockEstado.plan })),
  setBlockDone: jest.fn(async (id: string, done: boolean) => void mockEstado.bloques.push([id, done])),
}));

const hoy = dateKey();
const quest = (id: string, title: string, link: string | null = 'estudio') => ({ id, title, link, active: true, is_penalty: false, acquired_at: null, days_of_week: [1, 2, 3, 4, 5, 6, 7] });
const sesion = (id: string, minutos: number, c: Partial<NuevaSesion> = {}): NuevaSesion => ({ clientId: id, asignaturaId: 'm', temaId: null, misionId: null, fecha: hoy, minutos, metodo: 'pomodoro', ...c });
const estudiar = (...sesiones: NuevaSesion[]) => trasEstudiar({ uid: 'u', sesiones, asignaturas: [{ id: 'm', nombre: 'Mates' }] });

beforeEach(async () => {
  Object.assign(mockEstado, { red: true, guardadas: [], completadas: [], reglas: [], bloques: [], quests: [], rules: [], plan: [] });
  await AsyncStorage.clear();
});

describe('trasEstudiar', () => {
  it('un minuto no cumple «Estudiar 2 horas» ni marca el bloque del plan', async () => {
    mockEstado.rules = [{ id: 'r', active: true, link: 'estudio', text: 'Estudiar 2 horas cada dia' }];
    mockEstado.plan = [{ id: 'b', done: false, kind: 'estudio', start_min: 600, end_min: 660 }];
    await estudiar(sesion('a', 1));
    expect(mockEstado.reglas).toEqual([]);
    expect(mockEstado.bloques).toEqual([]);
  });

  it('con los minutos reales, sí', async () => {
    mockEstado.rules = [{ id: 'r', active: true, link: 'estudio', text: 'Estudiar 2 horas cada dia' }];
    mockEstado.plan = [{ id: 'b', done: false, kind: 'estudio', start_min: 600, end_min: 660 }];
    await estudiar(sesion('a', 120));
    expect(mockEstado.reglas).toEqual(['r']);
    expect(mockEstado.bloques).toEqual([['b', true]]);
  });

  it('una misión de otro acto elegida a mano no se paga estudiando', async () => {
    mockEstado.quests = [quest('gym', 'Ir al gimnasio', 'gym')];
    await estudiar(sesion('a', 50, { misionId: 'gym' }));
    expect(mockEstado.completadas).toEqual([]);
  });

  it('una sin enlazar elegida a mano, sí', async () => {
    mockEstado.quests = [quest('leer', 'Leer 20 min', 'ninguno')];
    await estudiar(sesion('a', 50, { misionId: 'leer' }));
    expect(mockEstado.completadas).toEqual(['leer']);
  });

  it('sin red no se pierde: se guarda y paga al volver', async () => {
    mockEstado.quests = [quest('q', 'Estudiar 25 min')];
    mockEstado.red = false;
    expect(await estudiar(sesion('a', 25))).toBeNull();
    expect(mockEstado.guardadas).toEqual([]);
    expect(mockEstado.completadas).toEqual([]);

    expect(await reenviarEstudio('u', [])).toEqual({ enviadas: 0, acto: null });

    mockEstado.red = true;
    const r = await reenviarEstudio('u', [{ id: 'm', nombre: 'Mates' }]);
    expect(r.enviadas).toBe(1);
    expect(r.acto?.propagado.xp).toBe(25);
    expect(mockEstado.guardadas.map((s) => s.clientId)).toEqual(['a']);
    expect(mockEstado.completadas).toEqual(['q']);

    expect(await reenviarEstudio('u', [])).toEqual({ enviadas: 0, acto: null });
  });

  it('un bloque de otro día guarda su sesión pero no marca nada de hoy', async () => {
    mockEstado.quests = [quest('q', 'Estudiar 25 min')];
    await estudiar(sesion('a', 25, { fecha: '2020-01-01' }));
    expect(mockEstado.guardadas).toHaveLength(1);
    expect(mockEstado.completadas).toEqual([]);
  });
});
