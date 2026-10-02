import { describe, expect, test } from '@jest/globals';
import {
  ENFRIAMIENTO_MIN,
  MAX_LOCALES_DIA,
  SEPARACION_MIN,
  diaSemana,
  diasEntre,
  enSilencio,
  faseCaducidad,
  fechaDeAviso,
  horaRacha,
  minutosDe,
  momentoDe,
  momentoDeCuando,
  planDeAvisos,
  pushDelServidorPermitido,
  sumarDias,
  ultimoDiaConAvisos,
  ventanaActiva,
  type Aviso,
  type EstadoPlanAvisos,
  type Momento,
} from '../notifyPlan';
import type { Quest } from '../types';

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
const DST = '2026-10-25'; // domingo, cambio de hora en Europa (03:00 → 02:00)

function estado(over: Partial<EstadoPlanAvisos> = {}): EstadoPlanAvisos {
  return {
    ultimaApertura: LUNES,
    streakDays: 0,
    questsHoy: [],
    completadasHoy: new Set(),
    fotosPendientes: 0,
    duelosPendientes: 0,
    celebracionPendiente: null,
    ...over,
  };
}

const at = (fecha: string, hhmm: string): Momento => momentoDeCuando(`${fecha}T${hhmm}`) as Momento;
const deDia = (avisos: Aviso[], fecha: string) => avisos.filter((a) => a.cuando.startsWith(fecha));
const tipos = (avisos: Aviso[]) => avisos.map((a) => a.tipo);
const min = (a: Aviso) => (momentoDeCuando(a.cuando) as Momento).min;

/** Racha de 5 en juego: tres misiones sin hacer. */
const enJuego = { streakDays: 5, questsHoy: [q('a'), q('b'), q('c')] };
/** Penalización de hoy sin completar, con una misión normal sin hacer (candado). */
const conPenalizacion = (fecha: string) => [q('pen', { is_penalty: true, penalty_date: fecha, penalty_xp: 40 }), q('a'), q('b'), q('c')];

describe('fechas sin zona horaria', () => {
  test('sumarDias cruza meses, años y el cambio de hora', () => {
    expect(sumarDias('2026-10-24', 1)).toBe('2026-10-25');
    expect(sumarDias('2026-10-25', 1)).toBe('2026-10-26');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
    expect(sumarDias('2027-03-27', 2)).toBe('2027-03-29');
  });

  test('diasEntre y diaSemana', () => {
    expect(diasEntre('2026-10-24', '2026-10-31')).toBe(7);
    expect(diasEntre('2026-10-05', '2026-11-04')).toBe(30);
    expect(diaSemana(DST)).toBe(7);
    expect(diaSemana(LUNES)).toBe(1);
    expect(diaSemana('2026-10-02')).toBe(5);
  });

  test('claves inválidas se rechazan', () => {
    expect(() => sumarDias('2026-02-30', 1)).toThrow();
    expect(momentoDeCuando('2026-10-05T24:00')).toBeNull();
    expect(momentoDeCuando('basura')).toBeNull();
  });

  test('minutosDe acepta HH:MM y HH:MM:SS de Postgres', () => {
    expect(minutosDe('23:00:00')).toBe(1380);
    expect(minutosDe('07:30')).toBe(450);
    expect(minutosDe('25:00')).toBeNull();
    expect(minutosDe(null)).toBeNull();
  });

  test('adaptadores: momentoDe y fechaDeAviso son hora de pared local', () => {
    const d = fechaDeAviso('2026-10-25T21:30') as Date;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(25);
    expect(d.getHours()).toBe(21);
    expect(d.getMinutes()).toBe(30);
    expect(momentoDe(d)).toEqual({ fecha: DST, min: 21 * 60 + 30 });
    expect(fechaDeAviso('mal')).toBeNull();
  });
});

describe('ventana activa y silencio', () => {
  test('por defecto 08:00–22:00', () => {
    expect(ventanaActiva()).toEqual({ inicio: 480, fin: 1320 });
    expect(enSilencio(7 * 60 + 59)).toBe(true);
    expect(enSilencio(8 * 60)).toBe(false);
    expect(enSilencio(21 * 60 + 59)).toBe(false);
    expect(enSilencio(22 * 60)).toBe(true);
  });

  test('se ajusta a wake_time/sleep_time', () => {
    expect(ventanaActiva('07:00:00', '23:00:00')).toEqual({ inicio: 420, fin: 1380 });
    // Dormir pasada la medianoche: el día se corta a las 24:00.
    expect(ventanaActiva('10:00', '01:30')).toEqual({ inicio: 600, fin: 1440 });
    // Solo uno de los dos: el otro por defecto.
    expect(ventanaActiva('09:00', null)).toEqual({ inicio: 540, fin: 1320 });
  });

  test('una ventana absurda (menos de 6 h) cae a la de defecto', () => {
    expect(ventanaActiva('08:00', '09:00')).toEqual({ inicio: 480, fin: 1320 });
  });

  test('hora de la racha: 90 min antes de dormir o 21:30', () => {
    expect(horaRacha(null)).toBe(21 * 60 + 30);
    expect(horaRacha('23:00:00')).toBe(21 * 60 + 30);
    expect(horaRacha('23:30')).toBe(22 * 60);
    expect(horaRacha('21:00')).toBe(19 * 60 + 30);
    expect(horaRacha('00:30')).toBe(23 * 60);
  });

  test('ningún aviso cae en silencio, ni con horarios raros', () => {
    const horarios: [string | null, string | null][] = [
      [null, null], ['06:00', '21:00'], ['09:30', '23:30'], ['12:00', '02:00'], ['07:00', '22:15'],
    ];
    for (const [w, s] of horarios) {
      const avisos = planDeAvisos(
        estado({ ...enJuego, wakeTime: w, sleepTime: s, questsHoy: conPenalizacion(DOMINGO), ultimaApertura: DOMINGO, fotosPendientes: 2, duelosPendientes: 1, celebracionPendiente: true }),
        at(DOMINGO, '00:00'),
      );
      expect(avisos.length).toBeGreaterThan(0);
      for (const a of avisos) expect(enSilencio(min(a), w, s)).toBe(false);
    }
  });

  test('de noche no se programa nada para hoy', () => {
    const avisos = planDeAvisos(estado({ ...enJuego, duelosPendientes: 1 }), at(LUNES, '22:30'));
    expect(deDia(avisos, LUNES)).toEqual([]);
  });

  test('con un wake tardío la foto se mueve al despertar', () => {
    const avisos = planDeAvisos(estado({ ultimaApertura: DOMINGO, fotosPendientes: 1, wakeTime: '12:00', sleepTime: '02:00' }), at(DOMINGO, '09:00'));
    expect(deDia(avisos, DOMINGO).map((a) => a.cuando)).toEqual([`${DOMINGO}T12:00`]);
  });
});

describe('eventos', () => {
  test('sin nada pendiente: solo las dos vueltas futuras', () => {
    const avisos = planDeAvisos(estado(), at(LUNES, '09:00'));
    expect(avisos.map((a) => [a.tipo, a.cuando, a.datos])).toEqual([
      ['vuelta', '2026-10-12T12:00', { tipo: 'vuelta', dias: 7 }],
      ['vuelta', '2026-11-04T12:00', { tipo: 'vuelta', dias: 30 }],
    ]);
  });

  test('racha en juego: a las 21:30 con lo que falta', () => {
    const [a] = deDia(planDeAvisos(estado(enJuego), at(LUNES, '09:00')), LUNES);
    expect(a).toMatchObject({
      id: `nivl.aviso.racha.${LUNES}`,
      tipo: 'racha',
      cuando: `${LUNES}T21:30`,
      datos: { tipo: 'racha', racha: 5, faltan: 3 },
      prioridad: 1,
    });
    expect(a.titulo).toBeUndefined();
  });

  test('racha: 90 min antes de dormir', () => {
    const avisos = deDia(planDeAvisos(estado({ ...enJuego, sleepTime: '23:30:00' }), at(LUNES, '09:00')), LUNES);
    expect(avisos[0].cuando).toBe(`${LUNES}T22:00`);
  });

  test('racha: no se avisa si el día ya la salva, si no hay racha o si una piedra la protege', () => {
    // 4 misiones, 1 fallo tolerado (30 %): con 3 hechas, el día está cerrado.
    const quests = [q('a'), q('b'), q('c'), q('d')];
    const salvado = planDeAvisos(estado({ streakDays: 5, questsHoy: quests, completadasHoy: new Set(['a', 'b', 'c']) }), at(LUNES, '09:00'));
    expect(tipos(deDia(salvado, LUNES))).toEqual([]);
    const sinRacha = planDeAvisos(estado({ ...enJuego, streakDays: 0 }), at(LUNES, '09:00'));
    expect(tipos(deDia(sinRacha, LUNES))).toEqual([]);
    const protegida = planDeAvisos(estado({ ...enJuego, rachaProtegida: true }), at(LUNES, '09:00'));
    expect(tipos(deDia(protegida, LUNES))).toEqual([]);
  });

  test('día sin misiones: ni racha ni nada que perder', () => {
    const avisos = planDeAvisos(estado({ streakDays: 12, questsHoy: [] }), at(LUNES, '09:00'));
    expect(deDia(avisos, LUNES)).toEqual([]);
  });

  test('día sin misiones con penalización: recuperación desbloqueada', () => {
    const quests = [q('pen', { is_penalty: true, penalty_date: LUNES, penalty_xp: 60 })];
    const [a] = deDia(planDeAvisos(estado({ streakDays: 3, questsHoy: quests }), at(LUNES, '09:00')), LUNES);
    expect(a).toMatchObject({
      tipo: 'recuperacion',
      cuando: `${LUNES}T17:00`,
      datos: { tipo: 'recuperacion', desbloqueada: true, pista: null, xp: 60 },
    });
  });

  test('recuperación bloqueada lleva la pista', () => {
    const avisos = deDia(planDeAvisos(estado({ questsHoy: conPenalizacion(LUNES) }), at(LUNES, '09:00')), LUNES);
    expect(avisos.map((a) => a.datos)).toEqual([
      { tipo: 'recuperacion', desbloqueada: false, pista: 'completa_una_mision', xp: 40 },
    ]);
  });

  test('penalización ya completada: no hay aviso', () => {
    const avisos = planDeAvisos(estado({ questsHoy: conPenalizacion(LUNES), completadasHoy: new Set(['pen', 'a']) }), at(LUNES, '09:00'));
    expect(deDia(avisos, LUNES)).toEqual([]);
  });

  test('foto semanal solo en domingo', () => {
    const domingo = deDia(planDeAvisos(estado({ ultimaApertura: DOMINGO, fotosPendientes: 3 }), at(DOMINGO, '09:00')), DOMINGO);
    expect(domingo.map((a) => [a.tipo, a.cuando, a.datos])).toEqual([['foto', `${DOMINGO}T11:00`, { tipo: 'foto', pendientes: 3 }]]);
    expect(deDia(planDeAvisos(estado({ fotosPendientes: 3 }), at(LUNES, '09:00')), LUNES)).toEqual([]);
    expect(deDia(planDeAvisos(estado({ ultimaApertura: DOMINGO, fotosPendientes: 0 }), at(DOMINGO, '09:00')), DOMINGO)).toEqual([]);
  });

  test('duelo y rango', () => {
    const d = deDia(planDeAvisos(estado({ duelosPendientes: 2 }), at(LUNES, '09:00')), LUNES);
    expect(d.map((a) => [a.tipo, a.cuando, a.datos])).toEqual([['duelo', `${LUNES}T19:00`, { tipo: 'duelo', pendientes: 2 }]]);
    const r = deDia(planDeAvisos(estado({ celebracionPendiente: { clave: 'rango_C' } }), at(LUNES, '09:00')), LUNES);
    expect(r.map((a) => [a.tipo, a.cuando, a.datos])).toEqual([['rango', `${LUNES}T13:00`, { tipo: 'rango', clave: 'rango_C' }]]);
  });

  test('lo que ya pasó hoy no se programa; lo movible se corre a después de ahora', () => {
    const avisos = deDia(planDeAvisos(estado({ duelosPendientes: 1, questsHoy: conPenalizacion(LUNES) }), at(LUNES, '20:00')), LUNES);
    // Recuperación (15–19 h) ya pasó; el duelo se corre de 19:00 a 20:15.
    expect(avisos.map((a) => [a.tipo, a.cuando])).toEqual([['duelo', `${LUNES}T20:15`]]);
  });

  test('cero promocionales: solo existen los tipos del juego', () => {
    const todos = planDeAvisos(
      estado({ ...enJuego, ultimaApertura: DOMINGO, questsHoy: conPenalizacion(DOMINGO), fotosPendientes: 1, duelosPendientes: 1, celebracionPendiente: true }),
      at(DOMINGO, '08:00'),
    );
    for (const a of todos) expect(['racha', 'recuperacion', 'duelo', 'foto', 'rango', 'vuelta']).toContain(a.tipo);
  });

  test('ahora inválido: nada', () => {
    expect(planDeAvisos(estado(enJuego), { fecha: 'x', min: 0 })).toEqual([]);
    expect(planDeAvisos(estado(enJuego), { fecha: LUNES, min: 1440 })).toEqual([]);
    expect(planDeAvisos(estado(enJuego), 'basura')).toEqual([]);
  });

  test('acepta ahora como cadena ISO local', () => {
    expect(planDeAvisos(estado(enJuego), `${LUNES}T09:00`)).toEqual(planDeAvisos(estado(enJuego), at(LUNES, '09:00')));
  });
});

describe('topes y prioridad', () => {
  const todo = (fecha: string) =>
    estado({
      ...enJuego,
      ultimaApertura: fecha,
      questsHoy: conPenalizacion(fecha),
      fotosPendientes: 2,
      duelosPendientes: 1,
      celebracionPendiente: true,
    });

  test('como mucho 2 al día: ganan racha y recuperación', () => {
    const avisos = deDia(planDeAvisos(todo(DOMINGO), at(DOMINGO, '08:00')), DOMINGO);
    expect(avisos).toHaveLength(MAX_LOCALES_DIA);
    expect(avisos.map((a) => [a.tipo, a.cuando])).toEqual([
      ['recuperacion', `${DOMINGO}T17:00`],
      ['racha', `${DOMINGO}T21:30`],
    ]);
  });

  test('sin racha ni recuperación: duelo > foto > rango', () => {
    const avisos = deDia(
      planDeAvisos(estado({ ultimaApertura: DOMINGO, fotosPendientes: 1, duelosPendientes: 1, celebracionPendiente: true }), at(DOMINGO, '08:00')),
      DOMINGO,
    );
    expect(avisos.map((a) => a.tipo).sort()).toEqual(['duelo', 'foto']);
  });

  test('solo foto y rango: caben los dos, separados 3 h', () => {
    const avisos = deDia(planDeAvisos(estado({ ultimaApertura: DOMINGO, fotosPendientes: 1, celebracionPendiente: true }), at(DOMINGO, '08:00')), DOMINGO);
    expect(avisos.map((a) => [a.tipo, a.cuando])).toEqual([
      ['foto', `${DOMINGO}T11:00`],
      ['rango', `${DOMINGO}T14:00`],
    ]);
  });

  test('lo ya disparado hoy cuenta para el tope', () => {
    const e = { ...todo(DOMINGO), historial: [{ tipo: 'rango' as const, cuando: `${DOMINGO}T09:00` }] };
    const avisos = deDia(planDeAvisos(e, at(DOMINGO, '10:00')), DOMINGO);
    expect(tipos(avisos)).toEqual(['racha']);
  });

  test('con el tope lleno, nada más hoy (pero las vueltas siguen)', () => {
    const e = {
      ...todo(DOMINGO),
      historial: [
        { tipo: 'foto' as const, cuando: `${DOMINGO}T09:00` },
        { tipo: 'rango' as const, cuando: `${DOMINGO}T12:00` },
      ],
    };
    const avisos = planDeAvisos(e, at(DOMINGO, '13:00'));
    expect(deDia(avisos, DOMINGO)).toEqual([]);
    expect(tipos(avisos)).toEqual(['vuelta', 'vuelta']);
  });

  test('el historial de ayer no cuenta para el tope de hoy', () => {
    const e = {
      ...todo(DOMINGO),
      historial: [
        { tipo: 'foto' as const, cuando: '2026-10-03T10:00' },
        { tipo: 'duelo' as const, cuando: '2026-10-03T14:00' },
      ],
    };
    expect(deDia(planDeAvisos(e, at(DOMINGO, '08:00')), DOMINGO)).toHaveLength(2);
  });

  test('nunca dos avisos a menos de 3 h (con historial y push del servidor)', () => {
    // Ya disparado hoy a las 20:00: la racha (19:30–21:30) no cabe a 3 h.
    const e = { ...todo(DOMINGO), historial: [{ tipo: 'foto' as const, cuando: `${DOMINGO}T20:00` }] };
    expect(deDia(planDeAvisos(e, at(DOMINGO, '20:30')), DOMINGO)).toEqual([]);
    // Push del ritual previsto a las 20:00: la recuperación a las 17:00 queda
    // justo a 3 h; la racha no cabe; el push no gasta cupo local, así que
    // entra el duelo (siguiente en prioridad), corrido a las 14:00.
    const p = { ...todo(DOMINGO), pushesServidor: [`${DOMINGO}T20:00`] };
    const antes = deDia(planDeAvisos(p, at(DOMINGO, '08:00')), DOMINGO);
    expect(antes.map((a) => [a.tipo, a.cuando])).toEqual([
      ['duelo', `${DOMINGO}T14:00`],
      ['recuperacion', `${DOMINGO}T17:00`],
    ]);
  });

  test('el push del ritual empuja a los locales', () => {
    const avisos = deDia(
      planDeAvisos(estado({ duelosPendientes: 1, pushesServidor: [`${LUNES}T19:00`] }), at(LUNES, '09:00')),
      LUNES,
    );
    expect(avisos.map((a) => a.cuando)).toEqual([`${LUNES}T16:00`]);
  });

  test('la racha solo se adelanta, nunca se retrasa', () => {
    // Dormir 23:59 → racha preferida 22:29, margen 20:29–22:29.
    const tarde = { ...enJuego, sleepTime: '23:59' };
    const antes = deDia(planDeAvisos(estado({ ...tarde, pushesServidor: [`${LUNES}T23:30`] }), at(LUNES, '09:00')), LUNES);
    expect(antes.map((a) => a.cuando)).toEqual([`${LUNES}T20:29`]);
    // Con un push a las 20:00 cabría a las 23:00, pero sería retrasarla: no se pone.
    const nada = deDia(planDeAvisos(estado({ ...tarde, pushesServidor: [`${LUNES}T20:00`] }), at(LUNES, '09:00')), LUNES);
    expect(nada).toEqual([]);
  });

  test('invariantes sobre muchos estados: tope, separación y futuro', () => {
    const fechas = [LUNES, DOMINGO, DST];
    const horas = ['00:00', '08:00', '11:30', '16:45', '19:10', '21:45'];
    const sleeps = [null, '21:00', '23:00:00', '00:30'];
    for (const f of fechas) for (const h of horas) for (const s of sleeps) for (const n of [0, 1]) {
      const e = { ...todo(f), sleepTime: s, historial: n ? [{ tipo: 'duelo' as const, cuando: `${f}T08:30` }] : [] };
      const ahora = at(f, h);
      const avisos = planDeAvisos(e, ahora);
      const porDia = new Map<string, number>();
      for (const a of avisos) {
        const m = momentoDeCuando(a.cuando) as Momento;
        porDia.set(m.fecha, (porDia.get(m.fecha) ?? 0) + 1);
        expect(diasEntre(f, m.fecha) * 1440 + m.min).toBeGreaterThan(ahora.min);
      }
      const hist = n && h >= '08:30' ? 1 : 0;
      expect((porDia.get(f) ?? 0) + hist).toBeLessThanOrEqual(MAX_LOCALES_DIA);
      const abs = avisos.map((a) => {
        const m = momentoDeCuando(a.cuando) as Momento;
        return diasEntre(f, m.fecha) * 1440 + m.min;
      }).concat(hist ? [8 * 60 + 30] : []).sort((a, b) => a - b);
      for (let i = 1; i < abs.length; i++) expect(abs[i] - abs[i - 1]).toBeGreaterThanOrEqual(SEPARACION_MIN);
    }
  });
});

describe('enfriamiento de 24 h por tipo', () => {
  test('la racha de ayer a la misma hora no bloquea (justo 24 h)', () => {
    const avisos = deDia(
      planDeAvisos(estado({ ...enJuego, historial: [{ tipo: 'racha', cuando: '2026-10-04T21:30' }] }), at(LUNES, '09:00')),
      LUNES,
    );
    expect(avisos.map((a) => a.cuando)).toEqual([`${LUNES}T21:30`]);
  });

  test('la racha de ayer más tarde bloquea la de hoy', () => {
    const avisos = deDia(
      planDeAvisos(estado({ ...enJuego, historial: [{ tipo: 'racha', cuando: '2026-10-04T21:45' }] }), at(LUNES, '09:00')),
      LUNES,
    );
    expect(avisos).toEqual([]);
  });

  test('el duelo de ayer a las 20:00 corre el de hoy a las 20:00', () => {
    const avisos = deDia(
      planDeAvisos(estado({ duelosPendientes: 1, historial: [{ tipo: 'duelo', cuando: '2026-10-04T20:00' }] }), at(LUNES, '09:00')),
      LUNES,
    );
    expect(avisos.map((a) => a.cuando)).toEqual([`${LUNES}T20:00`]);
    expect(ENFRIAMIENTO_MIN).toBe(1440);
  });

  test('el enfriamiento es por tipo: otro tipo ayer no bloquea', () => {
    const avisos = deDia(
      planDeAvisos(estado({ ...enJuego, historial: [{ tipo: 'duelo', cuando: '2026-10-04T21:30' }] }), at(LUNES, '09:00')),
      LUNES,
    );
    expect(tipos(avisos)).toEqual(['racha']);
  });
});

describe('caducidad: 7, 30 y 31 días', () => {
  const apertura = '2026-09-01';
  const lleno = (hoy: string) =>
    estado({ ...enJuego, ultimaApertura: apertura, questsHoy: conPenalizacion(hoy), duelosPendientes: 1, celebracionPendiente: true });

  test('fases', () => {
    expect(faseCaducidad(apertura, '2026-09-07')).toEqual({ dias: 6, fase: 'activa' });
    expect(faseCaducidad(apertura, '2026-09-08')).toEqual({ dias: 7, fase: 'vuelta7' });
    expect(faseCaducidad(apertura, '2026-09-20')).toEqual({ dias: 19, fase: 'silencio' });
    expect(faseCaducidad(apertura, '2026-10-01')).toEqual({ dias: 30, fase: 'vuelta30' });
    expect(faseCaducidad(apertura, '2026-10-02')).toEqual({ dias: 31, fase: 'apagada' });
    expect(faseCaducidad(null, LUNES)).toEqual({ dias: 0, fase: 'activa' });
    // Reloj desfasado hacia atrás: se trata como recién abierta.
    expect(faseCaducidad('2026-10-10', LUNES)).toEqual({ dias: 0, fase: 'activa' });
    expect(ultimoDiaConAvisos(apertura)).toBe('2026-09-07');
  });

  test('día 6: todavía avisos normales', () => {
    const hoy = '2026-09-07';
    expect(tipos(deDia(planDeAvisos(lleno(hoy), at(hoy, '09:00')), hoy))).toEqual(['recuperacion', 'racha']);
  });

  test('día 7: solo la vuelta (y la de 30 queda programada)', () => {
    const hoy = '2026-09-08';
    const avisos = planDeAvisos(lleno(hoy), at(hoy, '09:00'));
    expect(avisos.map((a) => [a.id, a.cuando, a.datos])).toEqual([
      [`nivl.aviso.vuelta7.${hoy}`, `${hoy}T12:00`, { tipo: 'vuelta', dias: 7 }],
      ['nivl.aviso.vuelta30.2026-10-01', '2026-10-01T12:00', { tipo: 'vuelta', dias: 30 }],
    ]);
  });

  test('día 7 pasada la hora de la vuelta: solo queda la de 30', () => {
    const hoy = '2026-09-08';
    expect(planDeAvisos(lleno(hoy), at(hoy, '20:30')).map((a) => a.id)).toEqual(['nivl.aviso.vuelta30.2026-10-01']);
  });

  test('días 8–29: silencio salvo la vuelta de 30 ya programada', () => {
    for (let d = 8; d <= 29; d++) {
      const hoy = sumarDias(apertura, d);
      const avisos = planDeAvisos(lleno(hoy), at(hoy, '09:00'));
      expect(avisos.map((a) => a.id)).toEqual(['nivl.aviso.vuelta30.2026-10-01']);
    }
  });

  test('día 30: solo la última vuelta', () => {
    const hoy = '2026-10-01';
    const avisos = planDeAvisos(lleno(hoy), at(hoy, '09:00'));
    expect(avisos.map((a) => [a.tipo, a.cuando, a.datos])).toEqual([['vuelta', `${hoy}T12:00`, { tipo: 'vuelta', dias: 30 }]]);
  });

  test('día 31 y después: silencio total', () => {
    for (const d of [31, 45, 365]) {
      const hoy = sumarDias(apertura, d);
      expect(planDeAvisos(lleno(hoy), at(hoy, '09:00'))).toEqual([]);
    }
  });

  test('abrir la app reinicia el reloj: las vueltas se corren', () => {
    const avisos = planDeAvisos(estado({ ultimaApertura: LUNES }), at(LUNES, '09:00'));
    expect(avisos.map((a) => a.id)).toEqual(['nivl.aviso.vuelta7.2026-10-12', 'nivl.aviso.vuelta30.2026-11-04']);
  });

  test('la vuelta respeta el silencio del perfil', () => {
    const hoy = '2026-09-08';
    const [a] = planDeAvisos({ ...lleno(hoy), wakeTime: '13:00', sleepTime: '03:00' }, at(hoy, '09:00'));
    expect(a.cuando).toBe(`${hoy}T13:00`);
  });
});

describe('cambio de hora del 25/10/2026', () => {
  const e = () =>
    estado({ ...enJuego, ultimaApertura: '2026-10-24', fotosPendientes: 2, celebracionPendiente: true });

  test('las horas son de pared: 21:30 sigue siendo 21:30', () => {
    const avisos = planDeAvisos(e(), at(DST, '01:30'));
    expect(avisos.map((a) => [a.tipo, a.cuando])).toEqual([
      ['foto', `${DST}T11:00`],
      ['racha', `${DST}T21:30`],
      ['vuelta', '2026-10-31T12:00'],
      ['vuelta', '2026-11-23T12:00'],
    ]);
  });

  test('las 02:30 (que se repiten) no colocan nada en la noche', () => {
    for (const a of deDia(planDeAvisos(e(), at(DST, '02:30')), DST)) expect(min(a)).toBeGreaterThanOrEqual(8 * 60);
  });

  test('el enfriamiento cruza el cambio: racha del 24 a las 21:30 no bloquea la del 25', () => {
    const avisos = deDia(planDeAvisos({ ...e(), historial: [{ tipo: 'racha', cuando: '2026-10-24T21:30' }] }, at(DST, '09:00')), DST);
    expect(tipos(avisos)).toEqual(['foto', 'racha']);
  });

  test('la caducidad cuenta días de calendario, no bloques de 24 h', () => {
    expect(faseCaducidad('2026-10-24', '2026-10-31').fase).toBe('vuelta7');
    expect(faseCaducidad('2027-03-27', '2027-04-03').fase).toBe('vuelta7');
  });

  test('el resultado no depende de la zona horaria de la máquina', () => {
    const original = process.env.TZ;
    const resultados: string[] = [];
    try {
      for (const tz of ['Europe/Madrid', 'America/New_York', 'Pacific/Kiritimati', 'UTC']) {
        process.env.TZ = tz;
        resultados.push(JSON.stringify(planDeAvisos(e(), at(DST, '01:30'))));
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
    expect(new Set(resultados).size).toBe(1);
  });
});

describe('push del ritual (regla del servidor)', () => {
  const base = { ultimaApertura: LUNES, wakeTime: '07:00:00', sleepTime: '23:00:00', pushesHoy: 0 };

  test('uno al día, en la ventana', () => {
    expect(pushDelServidorPermitido(base, at(LUNES, '07:00'))).toEqual({ ok: true, motivo: 'ok' });
    expect(pushDelServidorPermitido({ ...base, pushesHoy: 1 }, at(LUNES, '20:00'))).toEqual({ ok: false, motivo: 'tope' });
  });

  test('silencio', () => {
    expect(pushDelServidorPermitido(base, at(LUNES, '06:59')).motivo).toBe('silencio');
    expect(pushDelServidorPermitido(base, at(LUNES, '23:00')).motivo).toBe('silencio');
    expect(pushDelServidorPermitido({ ...base, wakeTime: null, sleepTime: null }, at(LUNES, '22:00')).motivo).toBe('silencio');
  });

  test('caducidad: a los 7 días el servidor calla', () => {
    expect(pushDelServidorPermitido(base, at('2026-10-11', '11:00')).ok).toBe(true);
    expect(pushDelServidorPermitido(base, at('2026-10-12', '11:00'))).toEqual({ ok: false, motivo: 'caducada' });
    expect(pushDelServidorPermitido(base, at('2026-11-04', '11:00')).motivo).toBe('caducada');
  });

  test('fecha inválida', () => {
    expect(pushDelServidorPermitido(base, 'nada').motivo).toBe('fecha');
  });
});
