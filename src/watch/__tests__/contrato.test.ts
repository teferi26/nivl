// NIVL · Apple Watch: el contrato iPhone → reloj (puro).
import { CONFIG_POR_DEFECTO, ESTADO_INICIAL, arrancar, pausar } from '@/focus/pomodoro';
import type { Quest } from '@/lib/types';
import {
  VERSION_CONTRATO,
  componerEstado,
  descansoSugerido,
  focusReloj,
  ironReloj,
  leerPeticion,
  misionReloj,
  motivoParaNoCompletar,
  parteHoy,
  type HeroParaReloj,
} from '../contrato';
import { ESTADO_DEMO } from '../demo';

const q = (over: Partial<Quest>): Quest => ({
  id: 'q',
  user_id: 'u',
  title: 'Misión',
  stat: 'FUE',
  difficulty: 'media',
  days_of_week: [1, 2, 3, 4, 5, 6, 7],
  requires_evidence: false,
  active: true,
  is_penalty: false,
  penalty_date: null,
  penalty_xp: null,
  is_bonus: false,
  acquired_at: null,
  acquired_streak: null,
  link: null,
  created_at: '2026-01-01T00:00:00Z',
  ...over,
});

const HERO: HeroParaReloj = {
  nivel: 7,
  xpEnNivel: 120,
  xpSiguiente: 1852,
  rango: 'D',
  titulo: 'Recluta',
  racha: 12,
  rachaCerrada: false,
  piedras: 2,
};

describe('misionReloj', () => {
  it('paga como la tabla de game.ts, sin evidencia y con el multiplicador de racha', () => {
    const m = misionReloj(q({ difficulty: 'media' }), { hecha: false, streakDays: 0, recuperacionAbierta: true });
    expect(m.premio).toBe(50);
    expect(m.unidad).toBe('XP');
  });

  it('una extra paga PB, no XP', () => {
    const m = misionReloj(q({ is_bonus: true, difficulty: 'dificil' }), { hecha: false, streakDays: 30, recuperacionAbierta: true });
    expect(m).toMatchObject({ premio: 10, unidad: 'PB', extra: true });
  });

  it('la penalización devuelve lo perdido y queda bloqueada sin recuperación', () => {
    const pen = q({ is_penalty: true, penalty_xp: 75, requires_evidence: true });
    expect(misionReloj(pen, { hecha: false, streakDays: 9, recuperacionAbierta: false })).toMatchObject({
      premio: 75,
      bloqueada: true,
      requiereFoto: false,
    });
    expect(misionReloj(pen, { hecha: false, streakDays: 9, recuperacionAbierta: true }).bloqueada).toBe(false);
  });

  it('el enlace «ninguno» no es enlace', () => {
    expect(misionReloj(q({ link: 'ninguno' }), { hecha: false, streakDays: 0, recuperacionAbierta: true }).enlace).toBeNull();
    expect(misionReloj(q({ link: 'gym' }), { hecha: false, streakDays: 0, recuperacionAbierta: true }).enlace).toBe('gym');
  });
});

describe('parteHoy', () => {
  it('ordena: penalización abierta, normales, extra, penalización cerrada y hechas al final', () => {
    const quests = [
      q({ id: 'hecha' }),
      q({ id: 'extra', is_bonus: true }),
      q({ id: 'normal' }),
      q({ id: 'pen', is_penalty: true, penalty_xp: 20 }),
    ];
    const abierta = parteHoy({ hoy: '2026-11-07', hero: HERO, quests, hechas: new Set(['hecha']), streakDays: 0, recuperacionAbierta: true });
    expect(abierta.misiones.map((m) => m.id)).toEqual(['pen', 'normal', 'extra', 'hecha']);
    const cerrada = parteHoy({ hoy: '2026-11-07', hero: HERO, quests, hechas: new Set(['hecha']), streakDays: 0, recuperacionAbierta: false });
    expect(cerrada.misiones.map((m) => m.id)).toEqual(['normal', 'extra', 'pen', 'hecha']);
  });

  it('recorta las piedras al máximo y lleva la fecha del teléfono', () => {
    const p = parteHoy({ hoy: '2026-11-07', hero: { ...HERO, piedras: 9, rango: null }, quests: [], hechas: new Set(), streakDays: 0, recuperacionAbierta: true });
    expect(p).toMatchObject({ fecha: '2026-11-07', piedras: 3, rango: 'E', racha: 12 });
  });
});

describe('focusReloj', () => {
  const C = CONFIG_POR_DEFECTO;
  it('parado: la fase entera', () => {
    expect(focusReloj(ESTADO_INICIAL, C, 0)).toMatchObject({ situacion: 'parado', finEn: null, restanteMs: 25 * 60_000, totalMs: 25 * 60_000 });
  });
  it('en marcha: el fin en hora de pared, que es lo que cuenta el reloj', () => {
    const e = arrancar(ESTADO_INICIAL, C, 1_000);
    const f = focusReloj(e, C, 61_000);
    expect(f.situacion).toBe('en_marcha');
    expect(f.finEn).toBe(1_000 + 25 * 60_000);
    expect(f.restanteMs).toBe(24 * 60_000);
  });
  it('en pausa: lo que quedaba', () => {
    const e = pausar(arrancar(ESTADO_INICIAL, C, 0), 5 * 60_000);
    expect(focusReloj(e, C, 99 * 60_000)).toMatchObject({ situacion: 'en_pausa', restanteMs: 20 * 60_000 });
  });
});

describe('IRON', () => {
  it('descanso por repeticiones (doctrina de knowledge.ts)', () => {
    expect(descansoSugerido('5')).toBe(180);
    expect(descansoSugerido('6-8')).toBe(180);
    expect(descansoSugerido('8-10')).toBe(120);
    expect(descansoSugerido(15)).toBe(90);
    expect(descansoSugerido('')).toBe(120);
    expect(descansoSugerido(null)).toBe(120);
  });

  it('la serie que toca es la primera sin repeticiones apuntadas', () => {
    const lifts = [
      { exercise: 'Press banca', series: [{ weight: '60', reps: '8' }, { weight: '60', reps: '8' }] },
      { exercise: 'Remo', series: [{ weight: '50', reps: '10' }, { weight: '', reps: '' }, { weight: '', reps: '' }] },
    ];
    const presc = [{ exercise_name: 'remo', sets: 4, reps: '10-12', weight: 55 }];
    expect(ironReloj(lifts, presc)).toEqual({
      ejercicio: 'Remo',
      serie: 2,
      series: 4,
      reps: '10-12',
      carga: 55,
      descansoS: 120,
      siguiente: 'Remo',
    });
  });

  it('sin prescripción toma la serie anterior; null si está todo apuntado', () => {
    const lifts = [{ exercise: 'Sentadilla', series: [{ weight: '100', reps: '5' }, { weight: '', reps: '' }] }];
    expect(ironReloj(lifts, [])).toMatchObject({ reps: '5', carga: 100, descansoS: 180, siguiente: '' });
    expect(ironReloj([{ exercise: 'X', series: [{ weight: '1', reps: '1' }] }], [])).toBeNull();
    expect(ironReloj([], [])).toBeNull();
  });
});

describe('componerEstado', () => {
  it('sin parte de Hoy no hay sesión que enseñar', () => {
    const e = componerEstado({ hoy: null, focus: null, iron: null }, 5);
    expect(e).toMatchObject({ v: VERSION_CONTRATO, generadoEn: 5, sesion: false, misiones: [] });
  });
  it('tras cerrar sesión borra también FOCUS e IRON', () => {
    const e = componerEstado({ hoy: null, focus: ESTADO_DEMO.focus, iron: ESTADO_DEMO.iron }, 0, false);
    expect(e.focus).toBeNull();
    expect(e.iron).toBeNull();
  });
  it('el demo tiene la forma del contrato', () => {
    const hoy = {
      fecha: ESTADO_DEMO.fecha,
      misiones: ESTADO_DEMO.misiones,
      racha: ESTADO_DEMO.racha,
      rachaCerrada: ESTADO_DEMO.rachaCerrada,
      nivel: ESTADO_DEMO.nivel,
      xpEnNivel: ESTADO_DEMO.xpEnNivel,
      xpSiguiente: ESTADO_DEMO.xpSiguiente,
      rango: ESTADO_DEMO.rango,
      titulo: ESTADO_DEMO.titulo,
      piedras: ESTADO_DEMO.piedras,
    };
    expect(componerEstado({ hoy, focus: ESTADO_DEMO.focus, iron: ESTADO_DEMO.iron }, 0)).toEqual(ESTADO_DEMO);
  });
});

describe('peticiones del reloj', () => {
  it('lee solo lo que casa', () => {
    expect(leerPeticion('{"tipo":"completar","id":"abc","fecha":"2026-11-07"}')).toEqual({ tipo: 'completar', id: 'abc', fecha: '2026-11-07' });
    expect(leerPeticion({ tipo: 'focus', accion: 'pausar' })).toEqual({ tipo: 'focus', accion: 'pausar' });
    expect(leerPeticion({ tipo: 'estado' })).toEqual({ tipo: 'estado' });
    expect(leerPeticion('no es json')).toBeNull();
    expect(leerPeticion({ tipo: 'completar', id: 'abc', fecha: 'ayer' })).toBeNull();
    expect(leerPeticion({ tipo: 'completar', id: '', fecha: '2026-11-07' })).toBeNull();
    expect(leerPeticion({ tipo: 'focus', accion: 'borrar' })).toBeNull();
    expect(leerPeticion({ tipo: 'award_xp' })).toBeNull();
    expect(leerPeticion(null)).toBeNull();
  });

  it('rechaza antes del motor lo que la muñeca no puede hacer', () => {
    const quests = [
      q({ id: 'n' }),
      q({ id: 'foto', requires_evidence: true }),
      q({ id: 'pen', is_penalty: true, penalty_xp: 30 }),
    ];
    const base = { hoy: '2026-11-07', quests, hechas: new Set<string>(), recuperacionAbierta: false, ocupada: false };
    expect(motivoParaNoCompletar({ id: 'n', fecha: '2026-11-07' }, base)).toBeNull();
    expect(motivoParaNoCompletar({ id: 'n', fecha: '2026-11-06' }, base)).toMatch(/día ha cambiado/);
    expect(motivoParaNoCompletar({ id: 'otra', fecha: '2026-11-07' }, base)).toMatch(/ya no está/);
    expect(motivoParaNoCompletar({ id: 'n', fecha: '2026-11-07' }, { ...base, hechas: new Set(['n']) })).toMatch(/Ya estaba hecha/);
    expect(motivoParaNoCompletar({ id: 'n', fecha: '2026-11-07' }, { ...base, ocupada: true })).toMatch(/guardando/);
    expect(motivoParaNoCompletar({ id: 'foto', fecha: '2026-11-07' }, base)).toMatch(/foto/);
    expect(motivoParaNoCompletar({ id: 'pen', fecha: '2026-11-07' }, base)).toMatch(/recuperación/);
    expect(motivoParaNoCompletar({ id: 'pen', fecha: '2026-11-07' }, { ...base, recuperacionAbierta: true })).toBeNull();
  });

  it('ningún texto lleva guion largo ni medio', () => {
    const quests = [q({ id: 'foto', requires_evidence: true }), q({ id: 'pen', is_penalty: true })];
    const base = { hoy: '2026-11-07', quests, hechas: new Set<string>(), recuperacionAbierta: false, ocupada: false };
    for (const id of ['foto', 'pen', 'x']) {
      expect(motivoParaNoCompletar({ id, fecha: '2026-11-07' }, base)).not.toMatch(/[\u2014\u2013]/);
    }
  });
});
