import { describe, expect, test } from '@jest/globals';
import { addDays } from '../dates';
import { HABIT_TARGET_DAYS, progresoHabito, rachaDeHabito } from '../habits';
import type { Quest } from '../types';

function habito(partial: Partial<Quest> = {}): Quest {
  return {
    id: 'h1',
    user_id: 'u1',
    title: 'Leer 20 minutos',
    stat: 'INT',
    difficulty: 'facil',
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

/**
 * Conjunto de fechas consecutivas terminando en `hasta`.
 *
 * Con `addDays` y no con toISOString: esa pasa por UTC y en Madrid devuelve el
 * día anterior, así que el conjunto salía desplazado un día entero.
 */
function ultimosDias(hasta: string, n: number): Set<string> {
  const s = new Set<string>();
  let d = hasta;
  for (let i = 0; i < n; i++) {
    s.add(d);
    d = addDays(d, -1);
  }
  return s;
}

// 2026-08-16 fue domingo.
const HOY = '2026-08-16';

describe('rachaDeHabito', () => {
  test('cuenta los días seguidos cumplidos', () => {
    expect(rachaDeHabito(habito(), ultimosDias(HOY, 5), HOY)).toBe(5);
  });

  test('el día de hoy sin hacer no rompe la racha', () => {
    // El día sigue abierto: contarlo como fallo sería castigar algo que aún
    // puede cumplirse esta tarde.
    const hasta = ultimosDias('2026-08-15', 4);
    expect(rachaDeHabito(habito(), hasta, HOY)).toBe(4);
  });

  test('un hueco la corta', () => {
    const fechas = new Set(['2026-08-16', '2026-08-15', '2026-08-13', '2026-08-12']);
    expect(rachaDeHabito(habito(), fechas, HOY)).toBe(2);
  });

  test('solo cuentan los días en los que tocaba', () => {
    // Lunes a viernes: el fin de semana no rompe nada. Si contáramos los días
    // naturales, ninguna misión de días alternos podría consolidarse jamás.
    const laborables = habito({ days_of_week: [1, 2, 3, 4, 5] });
    const fechas = new Set(['2026-08-14', '2026-08-13', '2026-08-12', '2026-08-11', '2026-08-10']);
    expect(rachaDeHabito(laborables, fechas, HOY)).toBe(5);
  });

  test('faltar un día que sí tocaba sí la corta', () => {
    const laborables = habito({ days_of_week: [1, 2, 3, 4, 5] });
    // Falta el jueves 13.
    const fechas = new Set(['2026-08-14', '2026-08-12', '2026-08-11']);
    expect(rachaDeHabito(laborables, fechas, HOY)).toBe(1);
  });

  test('sin días programados no hay hábito que medir', () => {
    expect(rachaDeHabito(habito({ days_of_week: [] }), ultimosDias(HOY, 10), HOY)).toBe(0);
  });

  test('sin completadas la racha es cero', () => {
    expect(rachaDeHabito(habito(), new Set(), HOY)).toBe(0);
  });

  test('no se cuelga con una racha larguísima', () => {
    // Tope de seguridad: sin él recorrería años en cada pintado.
    const r = rachaDeHabito(habito(), ultimosDias(HOY, 500), HOY);
    expect(r).toBeLessThanOrEqual(400);
    expect(r).toBeGreaterThan(300);
  });
});

describe('progresoHabito', () => {
  test('a los 21 días se puede consolidar', () => {
    const p = progresoHabito(habito(), ultimosDias(HOY, HABIT_TARGET_DAYS), HOY);
    expect(p.racha).toBe(21);
    expect(p.consolidable).toBe(true);
    expect(p.restantes).toBe(0);
  });

  test('antes del umbral dice cuánto falta', () => {
    const p = progresoHabito(habito(), ultimosDias(HOY, 8), HOY);
    expect(p.restantes).toBe(13);
    expect(p.consolidable).toBe(false);
  });

  test('un hábito ya adquirido no se vuelve a consolidar', () => {
    const p = progresoHabito(
      habito({ acquired_at: '2026-08-01T00:00:00Z' }),
      ultimosDias(HOY, 40),
      HOY,
    );
    expect(p.consolidable).toBe(false);
  });
});
