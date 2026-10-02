// QA Chat 5 · Medianoche, cambio de hora europeo (25/10/2026, en pleno Winter
// Arc; y 28/03/2027) y cambio de zona. Invariante 5: el día es la fecha local
// del dispositivo. Node en Windows no relee TZ en caliente: las pruebas de
// cambio de hora ejercitan el DST real solo si la máquina está en hora
// peninsular (ver «horas del 25/10»); en UTC pasan sin DST, y lo dicen.

import { computeDayClose } from '../closing';
import { addDays, dateKey, relativoDe, weekdayOfKey } from '../dates';
import { mision } from './qa/servidor';

describe('cambio de hora europeo', () => {
  test('horas del 25/10 en esta máquina (25 si se ejercita el DST real)', () => {
    const horas = (new Date(2026, 9, 26).getTime() - new Date(2026, 9, 25).getTime()) / 36e5;
    expect([24, 25]).toContain(horas);
  });

  test('el domingo de 25 horas es un solo día: ni se salta ni se repite', () => {
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2026-10-26', -1)).toBe('2026-10-25');
    expect(weekdayOfKey('2026-10-25')).toBe(7);
    // 02:30 existe dos veces esa noche; las dos son el día 25.
    expect(dateKey(new Date(2026, 9, 25, 2, 30))).toBe('2026-10-25');
    expect(dateKey(new Date(2026, 9, 25, 23, 59, 59))).toBe('2026-10-25');
    expect(dateKey(new Date(2026, 9, 26, 0, 0, 0))).toBe('2026-10-26');
  });

  test('el domingo de 23 horas de marzo tampoco descuadra', () => {
    expect(addDays('2027-03-27', 1)).toBe('2027-03-28');
    expect(addDays('2027-03-28', 1)).toBe('2027-03-29');
    expect(weekdayOfKey('2027-03-28')).toBe(7);
  });

  test('30 días seguidos sobre el cambio de hora suman 30 claves distintas', () => {
    const claves = new Set<string>();
    let d = '2026-10-10';
    for (let i = 0; i < 30; i++) { claves.add(d); d = addDays(d, 1); }
    expect(claves.size).toBe(30);
    expect(d).toBe('2026-11-09');
  });

  test('un cierre que cruza el 25/10 juzga cada día una sola vez', () => {
    const q = mision({ id: 'q', difficulty: 'media' });
    const r = computeDayClose({ fromDate: '2026-10-23', today: '2026-10-28', quests: [q],
      completedKeys: new Set(), streak: 10, stones: 0, freezeUntil: null });
    // 5 días (23–27): cada uno juzgado una vez. RET-02 cobra los 3 primeros
    // rotos seguidos (3 × 25) y deja exentos los otros 2.
    expect(r.penaltyXp).toBe(75);
    expect(r.missedTitles).toHaveLength(3);
    expect(r.diasExentos).toEqual(['2026-10-26', '2026-10-27']);
  });

  test('"Ayer" sigue siendo ayer el lunes después del cambio', () => {
    expect(relativoDe('2026-10-25', '2026-10-26')).toBe('Ayer');
    expect(relativoDe('2026-10-19', '2026-10-26')).toBe('Hace 7 días');
  });
});

describe('cambio de zona (en el espacio de claves que usa engine.ts)', () => {
  // processPendingDays cierra si last_day_processed < ayer(local). El reloj del
  // dispositivo decide «hoy»; aquí se comprueba la regla, no el huso del runner.
  const cierra = (lastDay: string, hoyLocal: string) => lastDay < addDays(hoyLocal, -1);

  test('volar hacia el oeste retrasa la fecha: no hay nada que cerrar ni se cierra dos veces', () => {
    // Cerrado en Madrid el 10 (last=09); en Nueva York aún es el 09.
    expect(cierra('2026-10-09', '2026-10-09')).toBe(false);
    expect(cierra('2026-10-09', '2026-10-10')).toBe(false);
  });

  test('volar hacia el este adelanta el cierre (comportamiento documentado del invariante 5)', () => {
    // 22:00 del 10 en Madrid son las 05:00 del 11 en Tokio: el 10 se juzga
    // aunque en casa aún queden dos horas. Riesgo aceptado, va a la matriz.
    expect(cierra('2026-10-09', '2026-10-11')).toBe(true);
  });
});
