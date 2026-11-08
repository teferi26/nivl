import { encajarEnPlan, huecoLibre, leerHoraEscrita, ocupadosDelDia, propuestaInicial, tramo } from '../agendaRapida';
import {
  calendariosLegibles,
  debeSincronizar,
  estadoCalendario,
  filasImportadas,
  idsObsoletos,
  INTERVALO_SYNC_MS,
  MAX_EVENTOS_IMPORTADOS,
  puedeDesconectar,
  rangoCalendario,
  type EventoDispositivo,
} from '../calendario';
import { lineaEconomiaHoy } from '../economiaHoy';
import type { Fijo, MovWork } from '@/lib/moneywork';

const HOY = '2026-10-21';
const OP = { tituloVacio: 'Sin título', todoElDiaEnUtc: false };
const ev = (c: Partial<EventoDispositivo>): EventoDispositivo => ({
  id: 'a',
  titulo: 'Reunión',
  inicio: new Date(2026, 9, 21, 10, 0),
  fin: new Date(2026, 9, 21, 10, 45),
  todoElDia: false,
  cancelado: false,
  ...c,
});

describe('filasImportadas', () => {
  it('copia solo título y horas, con la identidad por día', () => {
    expect(filasImportadas([ev({})], HOY, OP)).toEqual([
      { title: 'Reunión', date: HOY, time: '10:00', end_time: '10:45', source: 'dispositivo', external_id: `a@${HOY}` },
    ]);
  });

  it('una serie repetida da una fila por ocurrencia y reimportar la misma no duplica', () => {
    const lunes = ev({ inicio: new Date(2026, 9, 21, 9), fin: new Date(2026, 9, 21, 10) });
    const otro = ev({ inicio: new Date(2026, 9, 28, 9), fin: new Date(2026, 9, 28, 10) });
    const filas = filasImportadas([lunes, otro, lunes], HOY, OP);
    expect(filas.map((f) => f.external_id)).toEqual([`a@${HOY}`, 'a@2026-10-28']);
  });

  it('deja fuera lo cancelado, lo pasado y lo que está más allá de 14 días', () => {
    const filas = filasImportadas(
      [
        ev({ cancelado: true }),
        ev({ id: 'b', inicio: new Date(2026, 9, 20, 9), fin: null }),
        ev({ id: 'c', inicio: new Date(2026, 10, 5, 9), fin: null }),
        ev({ id: 'd', inicio: new Date(2026, 10, 4, 9), fin: null }),
      ],
      HOY,
      OP,
    );
    expect(filas.map((f) => f.external_id)).toEqual(['d@2026-11-04']);
    expect(rangoCalendario(HOY)).toEqual({ desde: HOY, hasta: '2026-11-04' });
  });

  it('un evento que acaba otro día no inventa hora de fin', () => {
    const [f] = filasImportadas([ev({ inicio: new Date(2026, 9, 21, 23), fin: new Date(2026, 9, 22, 1) })], HOY, OP);
    expect(f?.end_time).toBeNull();
  });

  it('título vacío y título con saltos', () => {
    expect(filasImportadas([ev({ titulo: '   ' })], HOY, OP)[0]?.title).toBe('Sin título');
    expect(filasImportadas([ev({ titulo: ' Uno\n dos ' })], HOY, OP)[0]?.title).toBe('Uno dos');
  });

  it('todo el día en hora local (iOS) ocupa cada día, sin hora', () => {
    const filas = filasImportadas([ev({ todoElDia: true, inicio: new Date(2026, 9, 21), fin: new Date(2026, 9, 22, 23, 59, 59) })], HOY, OP);
    expect(filas.map((f) => [f.date, f.time, f.end_time])).toEqual([
      [HOY, null, null],
      ['2026-10-22', null, null],
    ]);
  });

  it('todo el día en UTC (Android): el fin en medianoche no ocupa ese día', () => {
    const filas = filasImportadas(
      [ev({ todoElDia: true, inicio: new Date(Date.UTC(2026, 9, 21)), fin: new Date(Date.UTC(2026, 9, 22)) })],
      HOY,
      { ...OP, todoElDiaEnUtc: true },
    );
    expect(filas.map((f) => f.date)).toEqual([HOY]);
  });

  it('respeta el tope de filas', () => {
    const muchos = Array.from({ length: MAX_EVENTOS_IMPORTADOS + 20 }, (_, i) => ev({ id: `x${i}` }));
    expect(filasImportadas(muchos, HOY, OP)).toHaveLength(MAX_EVENTOS_IMPORTADOS);
  });
});

describe('idsObsoletos', () => {
  const filas = filasImportadas([ev({})], HOY, OP);
  it('retira solo lo que estaba en el rango y ya no está en el teléfono', () => {
    const r = idsObsoletos(
      [
        { id: '1', date: HOY, external_id: `a@${HOY}` },
        { id: '2', date: HOY, external_id: `borrado@${HOY}` },
        { id: '3', date: '2026-10-10', external_id: 'viejo@2026-10-10' },
      ],
      filas,
      HOY,
    );
    expect(r).toEqual(['2']);
  });
});

describe('estado de la conexión', () => {
  const base = { modulo: true, marcado: false, hayImportados: false, permiso: 'undetermined' as const };
  it('sin el módulo nativo no se pinta nada, pase lo que pase', () => {
    expect(estadoCalendario({ ...base, modulo: false, marcado: true, permiso: 'granted' })).toBe('oculto');
  });
  it('ofrece, conecta y explica el permiso denegado', () => {
    expect(estadoCalendario(base)).toBe('ofrecer');
    expect(estadoCalendario({ ...base, marcado: true, permiso: 'granted' })).toBe('conectado');
    expect(estadoCalendario({ ...base, permiso: 'denied' })).toBe('denegado');
  });
  it('tras reinstalar, lo copiado cuenta como conectado', () => {
    expect(estadoCalendario({ ...base, hayImportados: true, permiso: 'granted' })).toBe('conectado');
  });
  it('sin permiso pero con copia, se puede borrar', () => {
    expect(puedeDesconectar('denegado', true)).toBe(true);
    expect(puedeDesconectar('denegado', false)).toBe(false);
    expect(puedeDesconectar('ofrecer', true)).toBe(false);
  });
  it('la frecuencia de lectura', () => {
    expect(debeSincronizar(null, 1000)).toBe(true);
    expect(debeSincronizar(1000, 1000 + INTERVALO_SYNC_MS - 1)).toBe(false);
    expect(debeSincronizar(1000, 1000 + INTERVALO_SYNC_MS)).toBe(true);
    expect(debeSincronizar(5000, 1000)).toBe(true);
  });
  it('los cumpleaños no se copian', () => {
    expect(calendariosLegibles([{ id: 'a', type: 'local' }, { id: 'b', type: 'birthdays' }, { type: 'local' }])).toEqual(['a']);
  });
});

describe('agenda rápida', () => {
  it('huecoLibre salta lo ocupado y redondea al cuarto de hora', () => {
    expect(huecoLibre(620, [], 30)).toBe(630);
    expect(huecoLibre(600, [{ inicio: 600, fin: 660 }], 30)).toBe(660);
    expect(huecoLibre(600, [{ inicio: 640, fin: 700 }], 30)).toBe(600);
    expect(huecoLibre(600, [{ inicio: 620, fin: 700 }], 30)).toBe(705);
    expect(huecoLibre(1430, [], 30)).toBeNull();
  });
  it('propone hoy o, si no cabe, mañana a primera hora; nunca un día pasado', () => {
    expect(propuestaInicial({ dia: HOY, hoy: HOY, ahoraMin: 610, ocupados: [], duracion: 30 })).toEqual({ dia: HOY, inicioMin: 615 });
    expect(propuestaInicial({ dia: HOY, hoy: HOY, ahoraMin: 1430, ocupados: [], duracion: 50 })).toEqual({ dia: '2026-10-22', inicioMin: 540 });
    expect(propuestaInicial({ dia: '2026-10-01', hoy: HOY, ahoraMin: 610, ocupados: [], duracion: 30 }).dia).toBe(HOY);
    expect(propuestaInicial({ dia: '2026-10-25', hoy: HOY, ahoraMin: 610, ocupados: [], duracion: 30 })).toEqual({ dia: '2026-10-25', inicioMin: 540 });
  });
  it('lee horas escritas de varias formas', () => {
    expect(leerHoraEscrita('9')).toBe(540);
    expect(leerHoraEscrita('09:30')).toBe(570);
    expect(leerHoraEscrita('9.30')).toBe(570);
    expect(leerHoraEscrita('0930')).toBe(570);
    expect(leerHoraEscrita('25:00')).toBeNull();
    expect(leerHoraEscrita('hola')).toBeNull();
  });
  it('un tramo no cruza la medianoche', () => {
    expect(tramo(540, 30)).toEqual({ inicio: 540, fin: 570 });
    expect(tramo(1430, 30)).toBeNull();
    expect(tramo(null, 30)).toBeNull();
  });
  it('un bloque nuevo entra en orden de hora y corre a los siguientes', () => {
    const bloques = [
      { id: 'a', start_min: 480, position: 0 },
      { id: 'b', start_min: 720, position: 1 },
    ];
    expect(encajarEnPlan(bloques, 600)).toEqual({ posicion: 1, mover: [{ id: 'b', position: 2 }] });
    expect(encajarEnPlan(bloques, 800)).toEqual({ posicion: 2, mover: [] });
    expect(encajarEnPlan([], 800)).toEqual({ posicion: 0, mover: [] });
  });
  it('ocupados: eventos con hora del día y bloques', () => {
    const evs = [
      { id: '1', titulo: 'a', fecha: HOY, inicio: 600, fin: null, origen: 'manual' as const },
      { id: '2', titulo: 'b', fecha: HOY, inicio: null, fin: null, origen: 'manual' as const },
      { id: '3', titulo: 'c', fecha: '2026-10-22', inicio: 600, fin: 660, origen: 'manual' as const },
    ];
    expect(ocupadosDelDia(evs, [{ start_min: 700, end_min: 750 }], HOY)).toEqual([
      { inicio: 600, fin: 645 },
      { inicio: 700, fin: 750 },
    ]);
  });
});

describe('lineaEconomiaHoy', () => {
  const fijo = (c: Partial<Fijo>): Fijo => ({
    id: 'f',
    account_id: 'c',
    kind: 'gasto',
    name: 'Alquiler',
    amount: 750,
    day_of_month: 22,
    category: 'vivienda',
    user_category_id: null,
    start_date: '2026-01-01',
    end_date: null,
    active: true,
    ...c,
  });
  const mov = (c: Partial<MovWork>): MovWork => ({ id: 'm', date: '2026-10-05', amount: -40, description: 'x', counterparty: null, category: 'super', is_internal: false, account_id: 'c', ...c }) as MovWork;

  it('primero lo que se debe por trabajo', () => {
    expect(lineaEconomiaHoy({ hoy: HOY, porFacturar: 320.5, movs: [], fijos: [fijo({})] })).toEqual({ tipo: 'por_facturar', importe: 320.5 });
  });
  it('luego un fijo a punto de salir, sin repetir el ya apuntado', () => {
    expect(lineaEconomiaHoy({ hoy: HOY, porFacturar: 0, movs: [], fijos: [fijo({})] })).toEqual({ tipo: 'fijo', nombre: 'Alquiler', importe: 750, dias: 1 });
    const hecho = mov({ recurring_id: 'f', date: '2026-10-22' });
    expect(lineaEconomiaHoy({ hoy: HOY, porFacturar: 0, movs: [hecho], fijos: [fijo({})] })?.tipo).toBe('mes');
  });
  it('un fijo lejano no avisa y sin datos no hay línea', () => {
    expect(lineaEconomiaHoy({ hoy: HOY, porFacturar: 0, movs: [], fijos: [fijo({ day_of_month: 28 })] })).toBeNull();
    expect(lineaEconomiaHoy({ hoy: HOY, porFacturar: 0, movs: [mov({})], fijos: [] })).toEqual({ tipo: 'mes', entra: 0, sale: 40 });
  });
});
