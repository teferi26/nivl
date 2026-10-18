// Modos F1 · Hoy por modo: sin modo (interruptor apagado) Hoy es el de
// siempre; con un modo, la lista enseña solo sus misiones y el Hero, la racha
// y el cierre siguen siendo del día entero.
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { HOY_DEMO, misionDemo, perfilDemo } from '@/components/arena/demoDatos';
import type { Completion, Quest } from '@/lib/types';
import { derivarHoy, type EntradaHoy } from '../derivarHoy';

const hecha = (q: Quest, xp = 50): Completion => ({
  id: `c-${q.id}`,
  user_id: 'demo-usuario',
  quest_id: q.id,
  date: HOY_DEMO,
  completed_at: `${HOY_DEMO}T09:00:00Z`,
  xp_awarded: xp,
  evidence_url: null,
});

const pierna = misionDemo({ title: 'Entreno de pierna', stat: 'FUE', modes: ['iron'] });
const tema4 = misionDemo({ title: 'Estudiar Tema 4', stat: 'INT', modes: ['focus'] });
// La misma fila en dos modos.
const pitch = misionDemo({ title: 'Llamar a tres clientes', stat: 'AGI', modes: ['work', 'founder'] });
const leer = misionDemo({ title: 'Leer 20 páginas', stat: 'INT' });
const QUESTS = [pierna, tema4, pitch, leer];

const entrada = (p: Partial<EntradaHoy> = {}): EntradaHoy => ({
  hoy: HOY_DEMO,
  hora: 16,
  profile: perfilDemo(),
  rango: 'A',
  tituloEquipado: null,
  quests: QUESTS,
  completions: { [pitch.id]: hecha(pitch) },
  dayResult: null,
  plan: null,
  esPro: false,
  board: null,
  rotosPrevios: 0,
  diaPerfecto: false,
  avisoRecuperacion: false,
  ...p,
});

// Las frases de `voice` se eligen al azar: fijo para comparar salidas enteras.
let azar: ReturnType<typeof jest.spyOn>;
beforeEach(() => {
  azar = jest.spyOn(Math, 'random').mockReturnValue(0);
});
afterEach(() => azar.mockRestore());

describe('interruptor apagado = Hoy de siempre', () => {
  test('sin modo, la salida es la misma que en General y no hay filtro', () => {
    const sin = derivarHoy(entrada());
    const general = derivarHoy(entrada({ modo: 'general' }));
    expect(general).toEqual(sin);
    expect(sin.modo).toBeNull();
    expect(sin.misiones.map((m) => m.quest.id)).toEqual(QUESTS.map((q) => q.id));
    expect(sin.hechas).toBe(1);
    expect(sin.total).toBe(4);
  });
});

describe('filtro por modo', () => {
  test('IRON enseña solo sus misiones, con sus cuentas', () => {
    const d = derivarHoy(entrada({ modo: 'iron' }));
    expect(d.misiones.map((m) => m.quest.id)).toEqual([pierna.id]);
    expect(d.modo).toEqual({ id: 'iron', hechas: 0, total: 1 });
    // La siguiente se elige entre las que se ven.
    expect(d.misiones[0]!.siguiente).toBe(true);
  });

  test('el Hero, la racha y las cuentas del día no cambian con el modo', () => {
    const sin = derivarHoy(entrada());
    const iron = derivarHoy(entrada({ modo: 'iron' }));
    expect(iron.hero).toEqual(sin.hero);
    expect(iron.racha).toEqual(sin.racha);
    expect([iron.hechas, iron.total, iron.pendientes]).toEqual([sin.hechas, sin.total, sin.pendientes]);
  });

  test('un modo sin misiones hoy: lista vacía, total 0', () => {
    const d = derivarHoy(entrada({ quests: [leer], completions: {}, modo: 'focus' }));
    expect(d.misiones).toEqual([]);
    expect(d.modo).toEqual({ id: 'focus', hechas: 0, total: 0 });
    expect(d.total).toBe(1);
  });

  test('la penalización del día se ve en todos los modos', () => {
    const pena = misionDemo({ title: '20 flexiones', is_penalty: true, penalty_xp: 50, penalty_date: HOY_DEMO, days_of_week: [] });
    const d = derivarHoy(entrada({ quests: [...QUESTS, pena], modo: 'focus' }));
    expect(d.misiones.map((m) => m.quest.id)).toEqual([pena.id, tema4.id]);
  });
});

describe('misión con dos modos', () => {
  test('marcada una vez, sale hecha en WORK, en FOUNDER y en General', () => {
    for (const modo of ['work', 'founder', 'general'] as const) {
      const d = derivarHoy(entrada({ modo }));
      const m = d.misiones.find((x) => x.quest.id === pitch.id);
      expect(m).toBeDefined();
      expect(m!.hecha).toBe(true);
      expect(m!.xpPagado).toBe(50);
      expect(m!.quest).toBe(pitch);
    }
    expect(derivarHoy(entrada({ modo: 'work' })).modo).toEqual({ id: 'work', hechas: 1, total: 1 });
    expect(derivarHoy(entrada({ modo: 'founder' })).modo).toEqual({ id: 'founder', hechas: 1, total: 1 });
  });
});
