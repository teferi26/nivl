import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { Platform } from 'react-native';
import {
  armarEstadoPlanAvisos,
  celebracionPendienteDe,
  clavesDuelo,
  dentroDeRet06,
  diasDespertador,
  duelosPendientesDe,
  fechasSinCierre,
  historialAGuardar,
  historialDisparado,
  parsearHistorialAvisos,
  rachaProtegidaDe,
  type AvisoGuardado,
  type EntradaEstadoAvisos,
  type PerfilAvisos,
} from '../avisosPlan';
import type { Duelo } from '../competicionData';
import { ultimoDiaConAvisos, type EstadoPlanAvisos } from '../notifyPlan';
import type { Quest } from '../types';
import { textoAviso } from '../voice';

// ─── Dobles: expo-notifications en memoria, almacenamiento en memoria ───────

type Programada = { identifier: string; content: Record<string, unknown>; trigger: Record<string, unknown> };
const mockProgramadas = new Map<string, Programada>();
const mockPermiso = { granted: true };
const mockAlmacen = new Map<string, string>();

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily' },
  getPermissionsAsync: jest.fn(async () => ({ granted: mockPermiso.granted, canAskAgain: true })),
  getAllScheduledNotificationsAsync: jest.fn(async () => [...mockProgramadas.values()]),
  scheduleNotificationAsync: jest.fn(async (r: Programada) => {
    mockProgramadas.set(r.identifier, r);
    return r.identifier;
  }),
  cancelScheduledNotificationAsync: jest.fn(async (id: string) => {
    mockProgramadas.delete(id);
  }),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {
    mockProgramadas.clear();
  }),
  getPresentedNotificationsAsync: jest.fn(async () => []),
  dismissNotificationAsync: jest.fn(async () => {}),
}));
jest.mock('../health', () => ({ requireHealthConsent: jest.fn(async () => {}) }));
jest.mock('@react-native-async-storage/async-storage', () => {
  const api = {
    getItem: async (k: string) => mockAlmacen.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      mockAlmacen.set(k, v);
    },
    removeItem: async (k: string) => {
      mockAlmacen.delete(k);
    },
  };
  return { __esModule: true, default: api, ...api };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const N = require('../notifications') as typeof import('../notifications');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Notif = require('expo-notifications') as { cancelScheduledNotificationAsync: jest.Mock };

// ─── Datos ───────────────────────────────────────────────────────────────────

function q(id: string, partial: Partial<Quest> = {}): Quest {
  return {
    id,
    user_id: 'u1',
    title: id,
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
    created_at: '',
    ...partial,
  };
}

const LUNES = '2026-10-05';
const DOMINGO = '2026-10-04';

const perfil = (over: Partial<PerfilAvisos> = {}): PerfilAvisos => ({
  wake_time: '07:00:00',
  sleep_time: '23:00:00',
  streak_days: 0,
  protection_stones: 0,
  freeze_until: null,
  xp_total: 0,
  ...over,
});

const entrada = (over: Partial<EntradaEstadoAvisos> = {}): EntradaEstadoAvisos => ({
  hoy: LUNES,
  perfil: perfil(),
  questsHoy: [],
  completadasHoy: new Set(),
  rotosPrevios: 0,
  fotos: null,
  mayor18: null,
  consentimientoSalud: null,
  duelos: null,
  duelosVistos: null,
  logros: null,
  celebradas: null,
  ...over,
});

const duelo = (over: Partial<Duelo> = {}): Duelo => ({
  id: 'd1',
  soy_retador: true,
  rival: 'Rival',
  week_start: LUNES,
  status: 'accepted',
  mi_indice: 0,
  su_indice: 0,
  mis_dias: 0,
  sus_dias: 0,
  resultado: null,
  ...over,
});

/** Racha de 5 en juego: tres misiones sin hacer. */
const enJuego = { perfil: perfil({ streak_days: 5 }), questsHoy: [q('a'), q('b'), q('c')] };

/** Fecha local de pared (la del dispositivo). */
const local = (fecha: string, hh: number, mm = 0) => {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
};

// ─── Armado del estado ───────────────────────────────────────────────────────

describe('armarEstadoPlanAvisos', () => {
  test('ultimaApertura es hoy y lo que no se pudo leer va neutro', () => {
    const e = armarEstadoPlanAvisos(entrada());
    expect(e.ultimaApertura).toBe(LUNES);
    expect(e.wakeTime).toBe('07:00:00');
    expect(e.sleepTime).toBe('23:00:00');
    expect(e.fotosPendientes).toBe(0);
    expect(e.duelosPendientes).toBe(0);
    expect(e.celebracionPendiente).toBeNull();
    expect(e.rachaProtegida).toBe(false);
    expect(e.pushesServidor).toEqual([]);
    expect(e.historial).toBeUndefined();
  });

  test('racha protegida: congelación vigente o una piedra que salvaría hoy', () => {
    const base = { hoy: LUNES, questsHoy: enJuego.questsHoy, completadasHoy: new Set<string>(), rotosPrevios: 0 };
    expect(rachaProtegidaDe({ ...base, perfil: perfil({ streak_days: 5 }) })).toBe(false);
    expect(rachaProtegidaDe({ ...base, perfil: perfil({ streak_days: 5, freeze_until: LUNES }) })).toBe(true);
    expect(rachaProtegidaDe({ ...base, perfil: perfil({ streak_days: 5, freeze_until: '2026-10-04' }) })).toBe(false);
    expect(rachaProtegidaDe({ ...base, perfil: perfil({ streak_days: 5, protection_stones: 1 }) })).toBe(true);
  });

  test('fotos: solo con 18+ confirmado y salud; nada si 18+ es desconocido', () => {
    const fotos = [{ id: 'f1', fecha: '2026-09-21', pose: 'frente' as const }];
    const con = (mayor18: boolean | null, salud: boolean | null) =>
      armarEstadoPlanAvisos(entrada({ hoy: DOMINGO, fotos, mayor18, consentimientoSalud: salud })).fotosPendientes;
    expect(con(true, true)).toBe(3);
    expect(con(null, true)).toBe(0);
    expect(con(false, true)).toBe(0);
    expect(con(true, null)).toBe(0);
  });
});

describe('duelos pendientes', () => {
  test('tu reto aceptado y un resultado reciente son novedad; aceptar tú no', () => {
    expect(clavesDuelo(duelo())).toEqual(['d1:aceptado']);
    expect(clavesDuelo(duelo({ soy_retador: false }))).toEqual([]);
    expect(clavesDuelo(duelo({ status: 'done', resultado: 'gano' }))).toEqual(['d1:resultado']);
    expect(clavesDuelo(duelo({ status: 'declined' }))).toEqual([]);
    expect(clavesDuelo(duelo({ rival: null }))).toEqual([]);
    expect(duelosPendientesDe([duelo()], new Set(), LUNES)).toBe(1);
    expect(duelosPendientesDe([duelo()], null, LUNES)).toBe(1);
    expect(duelosPendientesDe([duelo()], new Set(['d1:aceptado']), LUNES)).toBe(0);
    expect(duelosPendientesDe(null, null, LUNES)).toBe(0);
  });

  test('un aceptado de una semana ya pasada o un resultado antiguo no avisan', () => {
    expect(duelosPendientesDe([duelo({ week_start: '2026-09-28' })], new Set(), LUNES)).toBe(0);
    expect(duelosPendientesDe([duelo({ week_start: '2026-09-28', status: 'done', resultado: 'pierdo' })], new Set(), LUNES)).toBe(1);
    expect(duelosPendientesDe([duelo({ week_start: '2026-09-14', status: 'done', resultado: 'pierdo' })], new Set(), LUNES)).toBe(0);
  });
});

describe('celebración pendiente', () => {
  test('AV-05: el estado del plan nunca lleva aviso de rango mientras Hoy no saque la ceremonia', () => {
    expect(armarEstadoPlanAvisos(entrada({ logros: new Set(['rango_D']), celebradas: new Set() })).celebracionPendiente).toBeNull();
  });

  test('el rango registrado sin celebrar, con su clave', () => {
    const p = perfil();
    expect(celebracionPendienteDe(p, new Set(['rango_D']), new Set(), LUNES)).toEqual({ clave: 'rango:D' });
    expect(celebracionPendienteDe(p, new Set(['rango_D']), new Set(['rango:D']), LUNES)).toBeNull();
    expect(celebracionPendienteDe(p, new Set(['primera_mision']), new Set(), LUNES)).toBeNull();
    // Sin claves guardadas nunca (instalación nueva) o sin logros: nada.
    expect(celebracionPendienteDe(p, new Set(['rango_D']), null, LUNES)).toBeNull();
    expect(celebracionPendienteDe(p, null, new Set(), LUNES)).toBeNull();
    expect(textoAviso({ tipo: 'rango', clave: 'rango:D' }).cuerpo).toMatch(/^Ya eres /);
  });
});

// ─── Historial ───────────────────────────────────────────────────────────────

describe('historial de avisos', () => {
  const h = (id: string, tipo: AvisoGuardado['tipo'], cuando: string): AvisoGuardado => ({ id, tipo, cuando });

  test('JSON roto o con forma rara: vacío', () => {
    expect(parsearHistorialAvisos(null)).toEqual([]);
    expect(parsearHistorialAvisos('{')).toEqual([]);
    expect(parsearHistorialAvisos('{"a":1}')).toEqual([]);
    expect(parsearHistorialAvisos(JSON.stringify([{ id: 'x', tipo: 'duelo', cuando: 'mal' }, h('y', 'foto', `${LUNES}T11:00`)])))
      .toEqual([h('y', 'foto', `${LUNES}T11:00`)]);
  });

  test('cuenta como disparado lo ya pasado, de ayer y hoy', () => {
    const g = [
      h('a', 'foto', '2026-10-03T11:00'),
      h('b', 'racha', '2026-10-04T21:30'),
      h('c', 'duelo', `${LUNES}T10:00`),
      h('d', 'rango', `${LUNES}T13:00`),
    ];
    expect(historialDisparado(g, `${LUNES}T12:00`).map((x) => x.id)).toEqual(['b', 'c']);
  });

  test('al guardar: lo sonado se queda y lo futuro es lo que se acaba de programar', () => {
    const g = [h('c', 'duelo', `${LUNES}T10:00`), h('viejo', 'rango', `${LUNES}T13:00`)];
    const nuevos = [
      { id: 'nivl.aviso.foto.x', tipo: 'foto' as const, cuando: `${LUNES}T15:00` },
      { id: 'pasado', tipo: 'rango' as const, cuando: `${LUNES}T11:00` },
    ];
    expect(historialAGuardar(g, nuevos, `${LUNES}T12:00`).map((x) => x.id)).toEqual(['c', 'nivl.aviso.foto.x']);
  });
});

// ─── Anti-spam de los fijos ──────────────────────────────────────────────────

describe('anti-spam de los fijos', () => {
  test('sin cierre los días con aviso de racha, programado o ya sonado', () => {
    const sin = fechasSinCierre(
      [{ tipo: 'racha', cuando: `${LUNES}T21:30` }, { tipo: 'duelo', cuando: '2026-10-06T19:00' }],
      [{ tipo: 'racha', cuando: '2026-10-04T21:30' }],
    );
    expect([...sin].sort()).toEqual(['2026-10-04', LUNES]);
    expect(fechasSinCierre([{ tipo: 'duelo', cuando: `${LUNES}T19:00` }]).size).toBe(0);
  });

  test('RET-06: hasta ultimoDiaConAvisos(hoy), ni antes de hoy ni después', () => {
    expect(dentroDeRet06(LUNES, LUNES)).toBe(true);
    expect(dentroDeRet06(ultimoDiaConAvisos(LUNES), LUNES)).toBe(true);
    expect(dentroDeRet06('2026-10-12', LUNES)).toBe(false);
    expect(dentroDeRet06('2026-10-04', LUNES)).toBe(false);
    expect(dentroDeRet06('basura', LUNES)).toBe(false);
  });

  test('despertador: de hoy (si no ha pasado) a hoy + 6', () => {
    const tarde = diasDespertador(LUNES, 9 * 60, 7 * 60);
    expect(tarde[0]).toBe('2026-10-06');
    expect(tarde[tarde.length - 1]).toBe('2026-10-11');
    expect(tarde).toHaveLength(6);
    const pronto = diasDespertador(LUNES, 6 * 60, 7 * 60);
    expect(pronto).toHaveLength(7);
    expect(pronto[0]).toBe(LUNES);
    expect(pronto[6]).toBe(ultimoDiaConAvisos(LUNES));
  });
});

// ─── Programación (notifications.ts con expo-notifications de mentira) ───────

describe('programarAvisosDelPlan', () => {
  const ids = () => [...mockProgramadas.keys()].sort();
  const estado = (over: Partial<EntradaEstadoAvisos> = {}): EstadoPlanAvisos => armarEstadoPlanAvisos(entrada(over));

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(local(LUNES, 9));
    mockPermiso.granted = true;
    await N.cancelarTodo();
    mockProgramadas.clear();
    mockAlmacen.clear();
    Notif.cancelScheduledNotificationAsync.mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
    Platform.OS = 'ios';
  });

  test('cancela SOLO los nivl.aviso.* y pone los del plan con su copy y su ruta', async () => {
    for (const id of ['nivl.despertar.2026-10-06', `nivl.bloque.${LUNES}.b1`, 'nivl.aviso.duelo.2026-10-04']) {
      mockProgramadas.set(id, { identifier: id, content: {}, trigger: {} });
    }
    const n = await N.programarAvisosDelPlan(estado({ duelos: [duelo()], duelosVistos: new Set() }));
    expect(n).toBeGreaterThan(0);
    expect(Notif.cancelScheduledNotificationAsync.mock.calls.map((c) => c[0])).toEqual(['nivl.aviso.duelo.2026-10-04']);
    expect(ids()).toEqual(expect.arrayContaining(['nivl.despertar.2026-10-06', `nivl.bloque.${LUNES}.b1`]));
    const d = mockProgramadas.get(`nivl.aviso.duelo.${LUNES}`)!;
    expect(d.content).toMatchObject({ title: 'Tu duelo', body: 'Hay novedades en 1 duelo.', data: { ruta: '/amigos' } });
    expect(d.trigger).toMatchObject({ type: 'date', channelId: 'sistema', date: local(LUNES, 19) });
  });

  test('la foto: sin nada corporal y a /fotos (FOT-08, domingo 11:00)', async () => {
    jest.setSystemTime(local(DOMINGO, 9));
    const fotos = [{ id: 'f1', fecha: '2026-09-21', pose: 'frente' as const }, { id: 'f2', fecha: DOMINGO, pose: 'lado' as const }];
    await N.programarAvisosDelPlan(estado({ hoy: DOMINGO, fotos, mayor18: true, consentimientoSalud: true }));
    const f = mockProgramadas.get(`nivl.aviso.foto.${DOMINGO}`)!;
    expect(f.content).toMatchObject({ title: 'Fotos de la semana', body: 'Faltan 2 de 3 para cerrar la semana.', data: { ruta: '/fotos' } });
    expect(f.trigger).toMatchObject({ date: local(DOMINGO, 11) });
    expect(JSON.stringify(f.content)).not.toMatch(/cuerpo|peso|físico|fisico/i);
  });

  test('en web o sin permiso no programa nada', async () => {
    Platform.OS = 'web';
    expect(await N.programarAvisosDelPlan(estado({ duelos: [duelo()] }))).toBe(0);
    Platform.OS = 'ios';
    mockPermiso.granted = false;
    expect(await N.programarAvisosDelPlan(estado({ duelos: [duelo()] }))).toBe(0);
    expect(ids()).toEqual([]);
  });

  test('tope de 2 al día también entre recargas (historial guardado)', async () => {
    jest.setSystemTime(local(DOMINGO, 8));
    const fotos = [{ id: 'f1', fecha: '2026-09-21', pose: 'frente' as const }];
    const e = () =>
      estado({
        hoy: DOMINGO, fotos, mayor18: true, consentimientoSalud: true,
        duelos: [duelo({ week_start: '2026-09-28', status: 'done', resultado: 'gano' })], duelosVistos: new Set(),
        logros: new Set(['rango_D']), celebradas: new Set(),
      });
    await N.programarAvisosDelPlan(e());
    const deHoy = () => ids().filter((id) => id.endsWith(DOMINGO));
    expect(deHoy()).toEqual([`nivl.aviso.duelo.${DOMINGO}`, `nivl.aviso.foto.${DOMINGO}`]);
    // Suena la foto (11:00) y se recarga a las 12:00: solo cabe uno más hoy.
    jest.setSystemTime(local(DOMINGO, 12));
    await N.programarAvisosDelPlan(e());
    expect(deHoy()).toHaveLength(1);
  });

  test('racha frente a cierre: con aviso de racha no hay cierre; si la racha se salva, vuelve', async () => {
    await N.reconciliarAvisosDelDia(LUNES, [], 22 * 60 + 40);
    expect(ids()).toContain(`nivl.cierre.${LUNES}`);
    await N.programarAvisosDelPlan(estado(enJuego));
    expect(ids()).toContain(`nivl.aviso.racha.${LUNES}`);
    expect(ids()).not.toContain(`nivl.cierre.${LUNES}`);
    // Una reconciliación posterior (cambia el perfil o el plan) no lo devuelve.
    await N.reconciliarAvisosDelDia(LUNES, [], 22 * 60 + 40);
    expect(ids()).not.toContain(`nivl.cierre.${LUNES}`);
    // Completa las tres: ya no hay aviso de racha y el cierre vuelve.
    await N.programarAvisosDelPlan(estado({ ...enJuego, completadasHoy: new Set(['a', 'b', 'c']) }));
    expect(ids()).not.toContain(`nivl.aviso.racha.${LUNES}`);
    expect(ids()).toContain(`nivl.cierre.${LUNES}`);
  });

  test('RET-06: el despertador ya no es DAILY sin fin; acaba en hoy + 6', async () => {
    mockProgramadas.set('nivl.despertar', { identifier: 'nivl.despertar', content: {}, trigger: { type: 'daily' } });
    await N.programarDespertador(7 * 60);
    const desp = ids().filter((id) => id.startsWith('nivl.despertar'));
    expect(desp).not.toContain('nivl.despertar');
    expect(desp).toHaveLength(6);
    expect(desp[desp.length - 1]).toBe(`nivl.despertar.${ultimoDiaConAvisos(LUNES)}`);
    for (const id of desp) expect(mockProgramadas.get(id)!.trigger.type).toBe('date');
  });

  test('RET-06: bloques de un día más allá de hoy + 6 no se programan', async () => {
    const b = { id: 'b1', start_min: 10 * 60, title: 'Gym', detail: null, notify: true, done: false } as never;
    await N.reconciliarAvisosDelDia('2026-10-12', [b], null);
    expect(ids()).toEqual([]);
    await N.reconciliarAvisosDelDia(LUNES, [b], null);
    expect(ids()).toEqual([`nivl.bloque.${LUNES}.b1`]);
  });

  test('sin nada en juego solo quedan las vueltas +7 y +30 (desde hoy)', async () => {
    await N.programarAvisosDelPlan(estado());
    expect(ids()).toEqual(['nivl.aviso.vuelta30.2026-11-04', 'nivl.aviso.vuelta7.2026-10-12']);
    expect(mockProgramadas.get('nivl.aviso.vuelta7.2026-10-12')!.content).toMatchObject({ title: 'La arena sigue aquí' });
  });

  test('debounce: varias peticiones seguidas programan una vez, a los 2 s', async () => {
    const fuente = jest.fn(async () => estado({ duelos: [duelo()] }));
    const quitar = N.registrarFuenteAvisos(fuente);
    N.reprogramarAvisosDelPlan();
    N.reprogramarAvisosDelPlan();
    N.reprogramarAvisosDelPlan();
    await jest.advanceTimersByTimeAsync(N.ESPERA_AVISOS_MS - 1);
    expect(fuente).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(fuente).toHaveBeenCalledTimes(1);
    expect(ids()).toContain(`nivl.aviso.duelo.${LUNES}`);
    quitar();
  });

  test('sin permiso la fuente ni se llama (no se pide nada a la red)', async () => {
    mockPermiso.granted = false;
    const fuente = jest.fn(async () => estado());
    const quitar = N.registrarFuenteAvisos(fuente);
    N.reprogramarAvisosDelPlan();
    await jest.advanceTimersByTimeAsync(N.ESPERA_AVISOS_MS);
    expect(fuente).not.toHaveBeenCalled();
    quitar();
  });

  test('una fuente que falla no lanza', async () => {
    const quitar = N.registrarFuenteAvisos(async () => {
      throw new Error('red');
    });
    N.reprogramarAvisosDelPlan();
    await expect(jest.advanceTimersByTimeAsync(N.ESPERA_AVISOS_MS)).resolves.toBeUndefined();
    quitar();
  });
});
