import {
  bloqueActual,
  bloqueSiguiente,
  hhmm,
  horaAMinutos,
  progresoDelPlan,
  type DayBlock,
} from '../plan';

function bloque(p: Partial<DayBlock> & { start_min: number; end_min: number }): DayBlock {
  return {
    id: `b${p.start_min}`,
    plan_id: 'plan',
    title: 'Bloque',
    kind: 'libre',
    detail: null,
    quest_id: null,
    notify: true,
    done: false,
    position: 0,
    ...p,
  };
}

describe('hhmm', () => {
  it('formatea con cero a la izquierda', () => {
    expect(hhmm(0)).toBe('00:00');
    expect(hhmm(5 * 60)).toBe('05:00');
    expect(hhmm(9 * 60 + 5)).toBe('09:05');
    expect(hhmm(23 * 60 + 59)).toBe('23:59');
  });
});

describe('horaAMinutos', () => {
  it('acepta HH:MM y el HH:MM:SS que devuelve Postgres', () => {
    expect(horaAMinutos('05:00')).toBe(300);
    expect(horaAMinutos('05:00:00')).toBe(300);
    expect(horaAMinutos('22:30')).toBe(1350);
  });

  it('devuelve null ante lo que no es una hora', () => {
    expect(horaAMinutos(null)).toBeNull();
    expect(horaAMinutos(undefined)).toBeNull();
    expect(horaAMinutos('')).toBeNull();
    expect(horaAMinutos('mañana')).toBeNull();
  });

  it('rechaza horas imposibles en vez de aceptarlas a medias', () => {
    // Un "25:99" colándose programaría un aviso a una hora inexistente.
    expect(horaAMinutos('25:00')).toBeNull();
    expect(horaAMinutos('12:75')).toBeNull();
  });
});

describe('bloqueActual', () => {
  const bloques = [
    bloque({ start_min: 300, end_min: 420 }),
    bloque({ start_min: 420, end_min: 600 }),
    bloque({ start_min: 600, end_min: 720 }),
  ];

  it('encuentra el bloque que contiene el momento', () => {
    expect(bloqueActual(bloques, 500)?.start_min).toBe(420);
  });

  it('el inicio pertenece al bloque y el fin ya no', () => {
    // Sin esto, en el minuto exacto de transición se solaparían dos bloques.
    expect(bloqueActual(bloques, 420)?.start_min).toBe(420);
    expect(bloqueActual(bloques, 600)?.start_min).toBe(600);
  });

  it('devuelve null fuera del plan', () => {
    expect(bloqueActual(bloques, 100)).toBeNull();
    expect(bloqueActual(bloques, 800)).toBeNull();
  });
});

describe('bloqueSiguiente', () => {
  const bloques = [
    bloque({ start_min: 300, end_min: 420 }),
    bloque({ start_min: 420, end_min: 600 }),
  ];

  it('devuelve el próximo que empieza', () => {
    expect(bloqueSiguiente(bloques, 350)?.start_min).toBe(420);
  });

  it('devuelve null cuando ya no queda nada', () => {
    expect(bloqueSiguiente(bloques, 700)).toBeNull();
  });
});

describe('progresoDelPlan', () => {
  it('no cuenta dormir ni descanso: no son órdenes que se cumplan', () => {
    const bloques = [
      bloque({ start_min: 300, end_min: 420, kind: 'ventas', done: true }),
      bloque({ start_min: 420, end_min: 600, kind: 'gym', done: false }),
      bloque({ start_min: 1320, end_min: 1380, kind: 'dormir', done: false }),
      bloque({ start_min: 900, end_min: 960, kind: 'descanso', done: false }),
    ];
    expect(progresoDelPlan(bloques)).toEqual({ hechos: 1, total: 2 });
  });

  it('un plan vacío no divide por cero', () => {
    expect(progresoDelPlan([])).toEqual({ hechos: 0, total: 0 });
  });
});
