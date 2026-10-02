// QA Chat 5 · Las tres hipótesis de economía del Winter Arc, contra un
// servidor falso con la semántica de las RPC desplegadas (ver qa/servidor.ts).
// Fecha fija: sábado 10/10/2026, 09:00 local.

import { completeQuest, processPendingDays } from '../engine';
import { GYM_SESSION_XP } from '../game';
import { propagarActo, restoDelModulo } from '../links';
import { crearServidor, mision, type Servidor } from './qa/servidor';

// jest.mock se eleva sobre los imports; los Proxy resuelven contra el servidor
// del test en cada llamada.

let mockSrv: Servidor;
jest.mock('../data', () => new Proxy({}, { get: (_t, k: string) => (...a: unknown[]) => mockSrv.data[k]!(...a) }));
jest.mock('../contract', () => new Proxy({}, { get: (_t, k: string) => (...a: unknown[]) => mockSrv.contract[k]!(...a) }));
jest.mock('../dayplan', () => new Proxy({}, { get: (_t, k: string) => (...a: unknown[]) => mockSrv.dayplan[k]!(...a) }));
jest.mock('../supabase', () => ({ supabase: { from: (t: string) => mockSrv.supabase.from(t) } }));


const HOY = '2026-10-10';

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 9, 10, 9, 0, 0), doNotFake: ['setImmediate', 'nextTick'] });
  mockSrv = crearServidor();
});
afterEach(() => jest.useRealTimers());

/** Dos días sin tocar 4 misiones medias: 4×25 = 100 por día, 200 en total. */
function ausenciaDeDosDias() {
  mockSrv.profile = { ...mockSrv.profile, last_day_processed: '2026-10-07', xp_total: 1000 };
  mockSrv.quests = [1, 2, 3, 4].map((i) => mision({ id: `q${i}`, title: `Misión ${i}` }));
}
const penalizaciones = () => mockSrv.quests.filter((q) => q.is_penalty && q.penalty_date === HOY);

describe('H3 · dos cierres concurrentes del mismo día', () => {
  test('mismo dispositivo (dos cargas de Hoy en vuelo): una sola penalización y una sola recuperación', async () => {
    ausenciaDeDosDias();
    const visto = { ...mockSrv.profile };
    await Promise.all([
      processPendingDays(visto, mockSrv.quests),
      processPendingDays(visto, mockSrv.quests),
    ]);
    expect(mockSrv.profile.xp_total).toBe(800);
    expect(penalizaciones()).toHaveLength(1);
    expect(penalizaciones()[0]!.penalty_xp).toBe(200);
  });

  test('la recuperación devuelve exactamente lo perdido (invariante 2)', async () => {
    ausenciaDeDosDias();
    const { profile } = await processPendingDays({ ...mockSrv.profile }, mockSrv.quests);
    const [pen] = penalizaciones();
    const r = await completeQuest(profile, pen!, null);
    expect(r.xp).toBe(200);
    expect(mockSrv.profile.xp_total).toBe(1000);
    expect(mockSrv.profile.xp_agi).toBe(0); // restaura, no premia (invariante 4)
  });

  // Dos dispositivos son dos procesos: el cerrojo del cliente no los ve. Sin
  // comparar last_day_processed en el servidor, ambos descuentan. Queda como
  // test.failing hasta que el coordinador integre la RPC con CAS (PROPUESTA
  // 0035 en docs/qa-audit/PROPUESTA-0035-cierre-atomico.md).
  test.failing('dos dispositivos con el mismo estado: el servidor aplica un solo cierre', async () => {
    ausenciaDeDosDias();
    const visto = { ...mockSrv.profile };
    let otro!: typeof processPendingDays;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      otro = require('../engine').processPendingDays;
    });
    await Promise.all([processPendingDays(visto, mockSrv.quests), otro(visto, mockSrv.quests)]);
    expect(mockSrv.profile.xp_total).toBe(800);
  });
});

describe('H1 · fallo entre el cierre y la creación de la recuperación', () => {
  test('un fallo transitorio al crear la misión de penalización no deja XP irrecuperable', async () => {
    ausenciaDeDosDias();
    mockSrv.fallos.insertQuest = 1;
    await processPendingDays({ ...mockSrv.profile }, mockSrv.quests);
    expect(mockSrv.profile.xp_total).toBe(800);
    expect(penalizaciones()).toHaveLength(1);
    expect(penalizaciones()[0]!.penalty_xp).toBe(200);
  });

  test('si la recuperación no se puede crear, el fallo se ve y queda auditado, no se traga', async () => {
    ausenciaDeDosDias();
    mockSrv.fallos.insertQuest = 99;
    await expect(processPendingDays({ ...mockSrv.profile }, mockSrv.quests)).rejects.toThrow();
    expect(mockSrv.events.some((e) => e.type === 'penalty' && e.payload.recuperacion === 'fallida')).toBe(true);
    // Vuelve la red y se reabre Hoy el mismo día: la recuperación aparece, una sola vez.
    mockSrv.fallos.insertQuest = 0;
    await processPendingDays({ ...mockSrv.profile }, mockSrv.quests);
    await processPendingDays({ ...mockSrv.profile }, mockSrv.quests);
    expect(penalizaciones()).toHaveLength(1);
    expect(penalizaciones()[0]!.penalty_xp).toBe(200);
    expect(mockSrv.profile.xp_total).toBe(800);
  });
});

describe('H2 · el mismo acto no paga dos veces cuando falla la red', () => {
  const gym = () => mision({ id: 'qg', title: 'Ir al gimnasio', link: 'gym', difficulty: 'media' });

  test('camino feliz: paga la misión y el módulo solo la diferencia', async () => {
    mockSrv.quests = [gym()];
    const eco = await propagarActo({ ...mockSrv.profile }, 'gym', HOY);
    expect(eco.xpMisiones).toBe(50);
    expect(restoDelModulo(GYM_SESSION_XP, eco)).toBe(0);
  });

  test('respuesta perdida tras confirmar la misión: el módulo no vuelve a cobrar', async () => {
    mockSrv.quests = [gym()];
    mockSrv.fallos.respuestaPerdida = 1;
    const eco = await propagarActo({ ...mockSrv.profile }, 'gym', HOY);
    const pagadoMision = mockSrv.completions.reduce((a, c) => a + c.xp_awarded, 0);
    expect(pagadoMision).toBe(50);
    expect(pagadoMision + restoDelModulo(GYM_SESSION_XP, eco)).toBe(50);
  });

  test('un fallo transitorio al leer las misiones no hace pagar al módulo y a la misión', async () => {
    mockSrv.quests = [gym()];
    mockSrv.fallos.fetchQuests = 1;
    const eco = await propagarActo({ ...mockSrv.profile }, 'gym', HOY);
    const modulo = restoDelModulo(GYM_SESSION_XP, eco);
    // El usuario marca después la misión a mano desde Hoy.
    const manual = await completeQuest({ ...mockSrv.profile }, mockSrv.quests[0]!, null);
    expect(modulo + eco.xp + manual.xp).toBe(50);
  });

  test('la misión ya completada en otro dispositivo entre lectura y marca cuenta como pagada', async () => {
    mockSrv.quests = [gym()];
    const original = mockSrv.data.fetchCompletionsForDate!;
    mockSrv.data.fetchCompletionsForDate = async (d: string) => {
      const vista = await original(d);
      // Otro dispositivo la completa justo después de nuestra lectura.
      mockSrv.completions.push({ id: 'cx', user_id: 'u1', quest_id: 'qg', date: HOY, completed_at: '', xp_awarded: 50, evidence_url: null });
      return vista;
    };
    const eco = await propagarActo({ ...mockSrv.profile }, 'gym', HOY);
    expect(restoDelModulo(GYM_SESSION_XP, eco)).toBe(0);
  });
});

describe('medianoche · Hoy cargada ayer y tocada hoy', () => {
  test('la penalización de ayer ya no se cobra después de medianoche', async () => {
    const pen = mision({ id: 'pen', is_penalty: true, penalty_date: '2026-10-09', penalty_xp: 120, days_of_week: [] });
    mockSrv.quests = [pen];
    await expect(completeQuest({ ...mockSrv.profile }, pen, null)).rejects.toThrow(/caducó/);
    expect(mockSrv.completions).toHaveLength(0);
    expect(mockSrv.profile.xp_total).toBe(1000);
  });

  test('una misión que hoy no toca no se completa con la fecha de hoy', async () => {
    // 10/10/2026 es sábado (6): una misión de lunes a viernes no se apunta hoy.
    const lv = mision({ id: 'lv', days_of_week: [1, 2, 3, 4, 5] });
    mockSrv.quests = [lv];
    await expect(completeQuest({ ...mockSrv.profile }, lv, null)).rejects.toThrow(/día ha cambiado/);
    expect(mockSrv.completions).toHaveLength(0);
  });

  test('doble toque: la segunda llamada no paga (awarded=false)', async () => {
    const q = mision({ id: 'q' });
    mockSrv.quests = [q];
    const [a, b] = await Promise.all([
      completeQuest({ ...mockSrv.profile }, q, null),
      completeQuest({ ...mockSrv.profile }, q, null),
    ]);
    expect([a.awarded, b.awarded].sort()).toEqual([false, true]);
    expect(a.xp + b.xp).toBe(50);
    expect(mockSrv.profile.xp_total).toBe(1050);
  });
});

describe('RET-01 · la recuperación devuelve lo descontado de verdad, no lo calculado', () => {
  test('con 120 XP y 200 de penalización, el servidor topa en 0 y la recuperación devuelve 120', async () => {
    ausenciaDeDosDias();
    mockSrv.profile = { ...mockSrv.profile, xp_total: 120 };
    const { profile } = await processPendingDays({ ...mockSrv.profile }, mockSrv.quests);
    expect(mockSrv.profile.xp_total).toBe(0);
    const [pen] = penalizaciones();
    expect(pen!.penalty_xp).toBe(120);
    await completeQuest(profile, pen!, null);
    expect(mockSrv.profile.xp_total).toBe(120); // ni un punto más del que tenía
  });
});
