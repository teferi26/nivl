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
jest.mock('../supabase', () => ({ supabase: {
  from: (t: string) => mockSrv.supabase.from(t),
  rpc: (fn: string, args: Record<string, unknown>) => mockSrv.supabase.rpc(fn, args),
} }));


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
  // Venía cumpliendo: la semana anterior, todo hecho (RET-02 mira atrás).
  for (let d = 1; d <= 7; d++) {
    for (const q of mockSrv.quests) {
      mockSrv.completions.push({ id: `h${d}${q.id}`, user_id: 'u1', quest_id: q.id, date: `2026-10-0${d}`,
        completed_at: '', xp_awarded: 50, evidence_url: null });
    }
  }
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
    // RET-03: primero un acto real de hoy.
    await completeQuest(profile, mockSrv.quests[0]!, null);
    const r = await completeQuest({ ...mockSrv.profile }, pen!, null);
    expect(r.xp).toBe(200);
    expect(mockSrv.profile.xp_total).toBe(800 + 50 + 200);
    expect(mockSrv.profile.xp_agi).toBe(0); // restaura, no premia (invariante 4)
  });

  // Dos dispositivos son dos procesos: el cerrojo del cliente no los ve.
  // Sin la 0035, el servidor no compara last_day_processed y ambos descuentan.
  test.failing('dos dispositivos SIN 0035 en el servidor: riesgo abierto mientras no se aplique', async () => {
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

describe('H3 con la 0035 (close_day_v2) desplegada', () => {
  const motores = () => {
    const m: (typeof processPendingDays)[] = [];
    for (let i = 0; i < 2; i++) {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        m.push(require('../engine').processPendingDays);
      });
    }
    return m;
  };

  test('dos dispositivos con el mismo estado: un solo descuento y una sola recuperación', async () => {
    ausenciaDeDosDias();
    mockSrv.conV2 = true;
    const visto = { ...mockSrv.profile };
    const [a, b] = motores();
    const r = await Promise.all([a!(visto, mockSrv.quests), b!(visto, mockSrv.quests)]);
    expect(mockSrv.profile.xp_total).toBe(800);
    expect(penalizaciones()).toHaveLength(1);
    expect(penalizaciones()[0]!.penalty_xp).toBe(200);
    // El que llega tarde no crea eventos ni enseña aviso de cierre.
    expect(r.filter((x) => x.result === null)).toHaveLength(1);
    expect(mockSrv.events.filter((e) => e.type === 'penalty')).toHaveLength(1);
  });

  test('la recuperación viaja en la misma transacción y se acota a lo descontado', async () => {
    ausenciaDeDosDias();
    mockSrv.conV2 = true;
    mockSrv.profile = { ...mockSrv.profile, xp_total: 120 };
    mockSrv.fallos.insertQuest = 99; // el insert del cliente ni se intenta
    const [a] = motores();
    await a!({ ...mockSrv.profile }, mockSrv.quests);
    expect(mockSrv.profile.xp_total).toBe(0);
    expect(penalizaciones()).toHaveLength(1);
    expect(penalizaciones()[0]!.penalty_xp).toBe(120);
    expect(mockSrv.llamadas.insert_quest ?? 0).toBe(0);
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

  test('un insert guardado con la respuesta perdida no crea una segunda recuperación al reintentar', async () => {
    ausenciaDeDosDias();
    mockSrv.fallos.insertQuestPerdido = 1;
    await processPendingDays({ ...mockSrv.profile }, mockSrv.quests);
    expect(penalizaciones()).toHaveLength(1);
    expect(mockSrv.events.find((e) => e.type === 'penalty')!.payload.xp).toBe(200);
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
    await completeQuest(profile, mockSrv.quests[0]!, null); // RET-03
    await completeQuest({ ...mockSrv.profile }, pen!, null);
    expect(mockSrv.profile.xp_total).toBe(50 + 120); // ni un punto más del que tenía
  });
});

describe('RET-02 · una racha de días rotos solo cobra los tres primeros', () => {
  test('30 días fuera cobran 3 días; los otros 27 quedan exentos y lo dice el resultado', async () => {
    mockSrv.quests = [1, 2, 3, 4].map((i) => mision({ id: `q${i}`, title: `Misión ${i}` }));
    mockSrv.profile = { ...mockSrv.profile, last_day_processed: '2026-09-09', xp_total: 5000 };
    for (const q of mockSrv.quests) {
      mockSrv.completions.push({ id: `h${q.id}`, user_id: 'u1', quest_id: q.id, date: '2026-09-09', completed_at: '', xp_awarded: 50, evidence_url: null });
    }
    const { result } = await processPendingDays({ ...mockSrv.profile }, mockSrv.quests);
    expect(mockSrv.profile.xp_total).toBe(5000 - 3 * 100);
    expect(result!.penaltyXp).toBe(300);
    expect(result!.diasSinCobrar).toBe(27);
    expect(penalizaciones()[0]!.penalty_xp).toBe(300);
  });

  test('quien abre cada día sin hacer nada deja de pagar al cuarto día', async () => {
    mockSrv.quests = [mision({ id: 'q1' })];
    // Ya traía tres días rotos (06, 07 y 08) y abre el 10: el 09 es el cuarto.
    mockSrv.completions.push({ id: 'h', user_id: 'u1', quest_id: 'q1', date: '2026-10-05', completed_at: '', xp_awarded: 50, evidence_url: null });
    mockSrv.profile = { ...mockSrv.profile, last_day_processed: '2026-10-08', streak_days: 0, xp_total: 900 };
    const { result } = await processPendingDays({ ...mockSrv.profile }, mockSrv.quests);
    expect(mockSrv.profile.xp_total).toBe(900);
    expect(result!.diasSinCobrar).toBe(1);
    expect(penalizaciones()).toHaveLength(0);
  });
});

describe('RET-03 · Regreso a la arena', () => {
  test('la recuperación está cerrada hasta completar una misión normal de hoy, y no paga extra', async () => {
    ausenciaDeDosDias();
    const { profile } = await processPendingDays({ ...mockSrv.profile }, mockSrv.quests);
    const [pen] = penalizaciones();
    await expect(completeQuest(profile, pen!, null)).rejects.toThrow(/vuelve a la arena/);
    expect(mockSrv.profile.xp_total).toBe(800);
    await completeQuest({ ...mockSrv.profile }, mockSrv.quests[1]!, null);
    const r = await completeQuest({ ...mockSrv.profile }, pen!, null);
    expect(r.xp).toBe(200);
  });

  test('una misión creada hoy no abre el candado', async () => {
    ausenciaDeDosDias();
    const { profile } = await processPendingDays({ ...mockSrv.profile }, mockSrv.quests);
    const nueva = mision({ id: 'nueva', title: 'Trivial de hoy', difficulty: 'trivial', created_at: '2026-10-10T08:00:00' });
    mockSrv.quests.push(nueva);
    await completeQuest(profile, nueva, null);
    await expect(completeQuest({ ...mockSrv.profile }, penalizaciones()[0]!, null)).rejects.toThrow(/vuelve a la arena/);
  });
});

describe('RET-08 · tope único de 150 por día para misiones y reglas', () => {
  test('un día con 100 de misiones y 3 reglas rotas (75) cobra 150, no 175', async () => {
    mockSrv.quests = [1, 2, 3, 4].map((i) => mision({ id: `q${i}`, title: `Misión ${i}` }));
    for (const q of mockSrv.quests) {
      mockSrv.completions.push({ id: `h${q.id}`, user_id: 'u1', quest_id: q.id, date: '2026-10-08', completed_at: '', xp_awarded: 50, evidence_url: null });
    }
    mockSrv.profile = { ...mockSrv.profile, last_day_processed: '2026-10-08', xp_total: 1000 };
    const reglas = [1, 2, 3].map((i) => ({ id: `r${i}`, text: `Regla ${i}`, consequence: `C${i}`, active: true }));
    mockSrv.contract.fetchRules = async () => reglas;
    mockSrv.contract.fetchRuleChecksRange = async () => new Map([['2026-10-08', new Set(['r1', 'r2', 'r3'])], ['2026-10-09', new Set<string>()]]);
    await processPendingDays({ ...mockSrv.profile }, mockSrv.quests);
    expect(mockSrv.profile.xp_total).toBe(1000 - 150);
    const pens = penalizaciones().map((q) => q.penalty_xp).sort((a, b) => a! - b!);
    expect(pens).toEqual([50, 100]); // reglas 50 (lo que cabe), misiones 100
  });
});

describe('congelación vencida que se cierra al volver', () => {
  test('los días congelados no se cobran aunque la congelación ya haya vencido', async () => {
    mockSrv.quests = [mision({ id: 'q1' })];
    for (let d = 1; d <= 3; d++) {
      mockSrv.completions.push({ id: `h${d}`, user_id: 'u1', quest_id: 'q1', date: `2026-10-0${d}`, completed_at: '', xp_awarded: 50, evidence_url: null });
    }
    // Congeló del 4 al 8, no abrió la app, vuelve el 10: solo el 9 se juzga.
    mockSrv.profile = { ...mockSrv.profile, last_day_processed: '2026-10-03', freeze_until: '2026-10-08', freeze_reason: 'vacaciones', streak_days: 5, xp_total: 1000 };
    const { result } = await processPendingDays({ ...mockSrv.profile }, mockSrv.quests);
    expect(mockSrv.profile.xp_total).toBe(1000 - 25);
    expect(result!.penaltyXp).toBe(25);
    expect(mockSrv.profile.freeze_until).toBeNull();
  });
});
