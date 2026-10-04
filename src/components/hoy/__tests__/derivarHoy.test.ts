import { describe, expect, test } from '@jest/globals';
import { HOY_DEMO, misionDemo, perfilDemo } from '@/components/arena/demoDatos';
import type { DayCloseResult } from '@/lib/engine';
import type { BoardEntry } from '@/lib/social';
import type { Completion, Quest } from '@/lib/types';
import { derivarHoy, saludo, TITULO_RIVAL_CERCANO, type EntradaHoy } from '../derivarHoy';

const hecha = (q: Quest, xp = 30): Completion => ({
  id: `c-${q.id}`,
  user_id: 'demo-usuario',
  quest_id: q.id,
  date: HOY_DEMO,
  completed_at: `${HOY_DEMO}T09:00:00Z`,
  xp_awarded: xp,
  evidence_url: null,
});

const entrada = (p: Partial<EntradaHoy> = {}): EntradaHoy => ({
  hoy: HOY_DEMO,
  hora: 16,
  profile: perfilDemo(),
  rango: 'A',
  tituloEquipado: null,
  quests: [],
  completions: {},
  dayResult: null,
  plan: null,
  esPro: false,
  board: null,
  rotosPrevios: 0,
  diaPerfecto: false,
  avisoRecuperacion: false,
  ...p,
});

const cierre = (p: Partial<DayCloseResult> = {}): DayCloseResult => ({
  penaltyXp: 0,
  penaltyReglas: 0,
  missedTitles: [],
  streakLost: false,
  levelsLost: 0,
  stonesUsed: 0,
  stonesEarned: 0,
  diasSinCobrar: 0,
  diasCumplidos: 1,
  ...p,
});

const fila = (p: Partial<BoardEntry> & { userId: string; name: string }): BoardEntry => ({
  isMe: false,
  xpWindow: 0,
  compliancePct: null,
  completed: 0,
  streakDays: 0,
  xpTotal: 0,
  friendshipId: null,
  visible: true,
  avatarPath: null,
  equippedTitle: null,
  profileKind: null,
  daysActive: 0,
  scheduled: 0,
  windowDays: 7,
  ...p,
});

describe('saludo', () => {
  test('por franjas', () => {
    expect(saludo('Teferi', 3)).toBe('Buenas noches, Teferi.');
    expect(saludo('Teferi', 9)).toBe('Buenos días, Teferi.');
    expect(saludo('Teferi', 16)).toBe('Buenas tardes, Teferi.');
    expect(saludo('Teferi', 22)).toBe('Buenas noches, Teferi.');
  });
});

describe('derivarHoy', () => {
  const leer = misionDemo({ title: 'Leer 20 páginas' });
  const entrenar = misionDemo({ title: 'Entrenar · empuje', stat: 'FUE' });
  const extra = misionDemo({ title: 'Paseo largo', is_bonus: true });
  const pena = misionDemo({ title: '20 flexiones', is_penalty: true, penalty_xp: 204, penalty_date: HOY_DEMO });

  test('sin perfil: sin hero, saludo «Hoy» y sin subtítulo', () => {
    const d = derivarHoy(entrada({ profile: null }));
    expect(d.hero).toBeNull();
    expect(d.saludo).toBe('Hoy');
    expect(d.subtitulo).toBeUndefined();
    expect(d.enJuego).toBeNull();
  });

  test('penalización primero y la siguiente es la primera normal pendiente', () => {
    const d = derivarHoy(entrada({ quests: [extra, entrenar, pena, leer], completions: { [entrenar.id]: hecha(entrenar, 50) } }));
    expect(d.misiones.map((m) => m.quest.id)[0]).toBe(pena.id);
    const siguientes = d.misiones.filter((m) => m.siguiente);
    expect(siguientes).toHaveLength(1);
    expect(siguientes[0]!.quest.id).toBe(leer.id);
    expect(d.misiones.find((m) => m.quest.id === entrenar.id)?.xpPagado).toBe(50);
    expect(d.hechas).toBe(1);
    expect(d.total).toBe(4);
    expect(d.hero?.misiones).toBe('1/4');
    expect(d.hero?.linea).toBe('Buenas tardes, Teferi. 3 misiones por delante.');
  });

  test('ni la extra ni la penalización son la siguiente', () => {
    const d = derivarHoy(entrada({ quests: [extra, pena] }));
    expect(d.misiones.some((m) => m.siguiente)).toBe(false);
  });

  test('la recuperación se abre al completar una misión normal anterior', () => {
    const cerrada = derivarHoy(entrada({ quests: [pena, leer] }));
    expect(cerrada.recuperacionAbierta).toBe(false);
    expect(cerrada.misiones[0]!.bloqueada).toBe(true);
    const abierta = derivarHoy(
      entrada({ quests: [pena, leer], completions: { [leer.id]: hecha(leer) }, avisoRecuperacion: true }),
    );
    expect(abierta.recuperacionAbierta).toBe(true);
    expect(abierta.misiones[0]!.bloqueada).toBe(false);
    expect(abierta.avisoRecuperacion).toBe(true);
  });

  test('día hecho: todo hecho, sin nota y celebración solo si pasó delante', () => {
    const base = { quests: [leer, entrenar], completions: { [leer.id]: hecha(leer), [entrenar.id]: hecha(entrenar) } };
    const d = derivarHoy(entrada(base));
    expect(d.pendientes).toBe(0);
    expect(d.todoHecho).not.toBeNull();
    expect(d.notaPendiente).toBeNull();
    expect(d.celebrando).toBe(false);
    expect(d.hero?.linea).toBe('Buenas tardes, Teferi. Día cerrado. No queda nada.');
    expect(derivarHoy(entrada({ ...base, diaPerfecto: true })).celebrando).toBe(true);
  });

  test('pausa: texto de pausa, sin línea RET-05 ni nota', () => {
    const d = derivarHoy(
      entrada({ profile: perfilDemo({ freeze_until: '2026-10-05', freeze_reason: 'viaje' }), quests: [leer] }),
    );
    expect(d.pausa).toContain('viaje');
    expect(d.pausa).toContain('Hasta el');
    expect(d.enJuego).toBeNull();
    expect(d.notaPendiente).toBeNull();
    expect(d.subtitulo).toBe('Sistema en pausa. Hoy no se juzga.');
  });

  test('cierre con penalización: alerta, la salida al final y sin trama repetida en misiones', () => {
    const d = derivarHoy(
      entrada({
        profile: perfilDemo({ streak_days: 0 }),
        quests: [pena, leer, entrenar],
        dayResult: cierre({ penaltyXp: 204, streakLost: true, levelsLost: 1 }),
      }),
    );
    expect(d.cierre?.alerta).toBe(true);
    expect(d.cierre?.lineas[0]).toBe('El sistema ha aplicado −204 XP. Has perdido 1 nivel.');
    expect(d.cierre?.lineas.at(-1)).toContain('Hoy puedes recuperarlo');
    expect(d.tonoMisiones).toBeUndefined();
  });

  test('cierre limpio sin nada que contar: una línea con la racha', () => {
    const d = derivarHoy(entrada({ quests: [leer], dayResult: cierre() }));
    expect(d.cierre).toEqual({ alerta: false, lineas: ['Día cerrado. Racha 12.'] });
  });

  test('Orden del día: con plan o con coach; la línea Pro sin plan y sin coach', () => {
    expect(derivarHoy(entrada({ esPro: false })).orden).toBeNull();
    expect(derivarHoy(entrada({ esPro: false })).lineaPro).toBe(true);
    expect(derivarHoy(entrada({ esPro: true })).orden).toEqual({ plan: null, bloques: [], pro: true });
    expect(derivarHoy(entrada({ esPro: null })).lineaPro).toBe(false);
  });

  test('duelo: el rival es quien va justo delante y las barras van contra el mayor', () => {
    const board = [
      fila({ userId: 'yo', name: 'Teferi', isMe: true, xpWindow: 300, compliancePct: 80 }),
      fila({ userId: 'm', name: 'Marta López', xpWindow: 400, compliancePct: 90 }),
      fila({ userId: 'l', name: 'Luis', xpWindow: 900, compliancePct: 90 }),
      fila({ userId: 'x', name: 'Oculto', xpWindow: 9999, visible: false }),
    ];
    const d = derivarHoy(entrada({ board }));
    expect(d.duelo?.rival?.nombre).toBe('Marta');
    expect(d.duelo?.yo).toEqual({ nombre: 'Tú', xp: 300, ratio: 0.75 });
    expect(d.duelo?.rival?.ratio).toBe(1);
    expect(d.rivalidad).toContain('Marta te saca 100 XP');
  });

  test('la sección se llama «Rival cercano», no «duelo»: no es el duelo de Amigos', () => {
    expect(TITULO_RIVAL_CERCANO).toBe('Rival cercano');
    expect(TITULO_RIVAL_CERCANO.toLowerCase()).not.toContain('duelo');
  });

  test('sin amigos visibles no hay duelo', () => {
    const board = [fila({ userId: 'yo', name: 'Teferi', isMe: true }), fila({ userId: 'x', name: 'X', visible: false })];
    expect(derivarHoy(entrada({ board })).duelo).toBeNull();
  });

  test('a cero los dos, barras vacías', () => {
    const board = [fila({ userId: 'yo', name: 'Teferi', isMe: true, compliancePct: 0 }), fila({ userId: 'm', name: 'Marta', compliancePct: 0 })];
    const d = derivarHoy(entrada({ board }));
    expect(d.duelo?.yo.ratio).toBe(0);
    expect(d.duelo?.rival?.ratio ?? 0).toBe(0);
  });

  test('título: el equipado o el del rango', () => {
    expect(derivarHoy(entrada()).hero?.titulo).toBe('Héroe de la arena');
    expect(derivarHoy(entrada({ tituloEquipado: 'El Constante' })).hero?.titulo).toBe('El Constante');
  });
});
