import {
  estadoReto, indiceDisciplina, nombreDeLiga, resolverDuelo, tablaLiga, velocidad, type FilaLiga,
} from '../competition';

describe('índice de disciplina', () => {
  test('3/3 no gana a 38/40: el prior pesa con pocas misiones', () => {
    expect(indiceDisciplina(3, 3)).toBeLessThan(indiceDisciplina(38, 40));
  });
  test('es justo entre perfiles: misma adherencia con volumen distinto ≈ mismo índice', () => {
    expect(Math.abs(indiceDisciplina(18, 21) - indiceDisciplina(54, 63))).toBeLessThanOrEqual(3);
  });
  test('sin misiones vale el prior (70) y está acotado a 0–100', () => {
    expect(indiceDisciplina(0, 0)).toBe(70);
    expect(indiceDisciplina(100, 100)).toBeLessThanOrEqual(100);
    expect(indiceDisciplina(0, 100)).toBeGreaterThanOrEqual(0);
    expect(indiceDisciplina(9, 3)).toBe(indiceDisciplina(3, 3)); // no se cuentan de más
  });
});

describe('velocidad', () => {
  test('contra el propio histórico, con tope ×2', () => {
    expect(velocidad(1400, 7, 5600)).toBe(1); // 200/día igual que su media
    expect(velocidad(2800, 7, 5600)).toBe(2);
    expect(velocidad(10000, 7, 5600)).toBe(2); // tope
    expect(velocidad(700, 7, 5600)).toBe(0.5);
  });
  test('cuenta nueva sin histórico: neutral', () => {
    expect(velocidad(500, 7, 0)).toBe(1);
  });
});

describe('duelos', () => {
  test('gana la adherencia, no el volumen', () => {
    const r = resolverDuelo({ programadas: 6, cumplidas: 6, diasActivos: 6 }, { programadas: 40, cumplidas: 28, diasActivos: 7 });
    expect(r).toMatchObject({ estado: 'ganador', ganador: 'a', motivo: 'disciplina' });
  });
  test('a igual índice, desempatan los días activos', () => {
    const r = resolverDuelo({ programadas: 10, cumplidas: 8, diasActivos: 5 }, { programadas: 10, cumplidas: 8, diasActivos: 6 });
    expect(r).toMatchObject({ estado: 'ganador', ganador: 'b', motivo: 'dias_activos' });
  });
  test('empate y semana sin datos', () => {
    expect(resolverDuelo({ programadas: 10, cumplidas: 8, diasActivos: 5 }, { programadas: 10, cumplidas: 8, diasActivos: 5 }).estado).toBe('empate');
    expect(resolverDuelo({ programadas: 2, cumplidas: 2, diasActivos: 2 }, { programadas: 10, cumplidas: 8, diasActivos: 5 }))
      .toEqual({ estado: 'sin_datos', falta: ['a'] });
  });
});

describe('ligas privadas', () => {
  const fila = (id: string, cumplidas: number, programadas: number, extra: Partial<FilaLiga> = {}): FilaLiga =>
    ({ id, alias: id, cumplidas, programadas, diasActivos: 5, xpSemana: 1400, xpBase28: 5600, ...extra });

  test('ordena por disciplina, comparte puesto en empate y deja sin puesto a quien no llega al mínimo', () => {
    const t = tablaLiga([fila('ana', 18, 20), fila('bea', 18, 20), fila('carl', 10, 20), fila('dani', 1, 2)]);
    expect(t.map((p) => [p.alias, p.puesto])).toEqual([['ana', 1], ['bea', 1], ['carl', 3], ['dani', 0]]);
    expect(t[3]!.sinDatos).toBe(true);
  });

  test('a igual disciplina, gana la velocidad', () => {
    const t = tablaLiga([fila('ana', 18, 20), fila('bea', 18, 20, { xpSemana: 2100 })]);
    expect(t[0]!.alias).toBe('bea');
  });

  test('el nombre de liga se acota a una línea de 40 caracteres', () => {
    expect(nombreDeLiga('  Los\n del   gym\t')).toBe('Los del gym');
    expect(nombreDeLiga('x'.repeat(60))).toHaveLength(40);
    expect(nombreDeLiga(' a ')).toBeNull();
  });
});

describe('reto conjunto tras invitar', () => {
  const si = (n: number) => Array.from({ length: 7 }, (_, i) => i < n);
  test('cumplido si los dos llegan a 5 de 7', () => {
    expect(estadoReto(si(5), si(6), 7)).toMatchObject({ paso: 'reto_cumplido', cumplidosA: 5, cumplidosB: 6 });
  });
  test('en curso mientras sea alcanzable; fallido en cuanto deja de serlo', () => {
    expect(estadoReto(si(2), si(2), 3).paso).toBe('reto_en_curso');
    expect(estadoReto([false, false, false, true], si(4), 4).paso).toBe('reto_fallido'); // 1 + 3 restantes < 5
  });
});
