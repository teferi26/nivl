import {
  estadoReto, indiceDisciplina, nombreDeLiga, resolverDuelo, tablaLiga, velocidad, type FilaLiga,
} from '../competition';

describe('índice de disciplina', () => {
  test('3 triviales al día al 100 % (210 XP) no ganan al 90 % de un día exigente (63 medias)', () => {
    expect(indiceDisciplina(210, 210)).toBeLessThan(indiceDisciplina(0.9 * 63 * 50, 63 * 50));
  });
  test('es justo entre perfiles: misma adherencia con volumen distinto ≈ mismo índice', () => {
    expect(Math.abs(indiceDisciplina(900, 1050) - indiceDisciplina(2700, 3150))).toBeLessThanOrEqual(4);
  });
  test('sin nada programado vale el prior (70) y está acotado a 0–100', () => {
    expect(indiceDisciplina(0, 0)).toBe(70);
    expect(indiceDisciplina(5000, 5000)).toBeLessThanOrEqual(100);
    expect(indiceDisciplina(0, 5000)).toBeGreaterThanOrEqual(0);
    expect(indiceDisciplina(900, 300)).toBe(indiceDisciplina(300, 300)); // no se cuenta de más
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
    const r = resolverDuelo({ programadasXp: 1500, cumplidasXp: 1500, diasActivos: 6 }, { programadasXp: 6000, cumplidasXp: 4200, diasActivos: 7 });
    expect(r).toMatchObject({ estado: 'ganador', ganador: 'a', motivo: 'disciplina' });
  });
  test('a igual índice, desempatan los días activos', () => {
    const r = resolverDuelo({ programadasXp: 500, cumplidasXp: 400, diasActivos: 5 }, { programadasXp: 500, cumplidasXp: 400, diasActivos: 6 });
    expect(r).toMatchObject({ estado: 'ganador', ganador: 'b', motivo: 'dias_activos' });
  });
  test('empate y semana sin datos', () => {
    expect(resolverDuelo({ programadasXp: 500, cumplidasXp: 400, diasActivos: 5 }, { programadasXp: 500, cumplidasXp: 400, diasActivos: 5 }).estado).toBe('empate');
    expect(resolverDuelo({ programadasXp: 100, cumplidasXp: 100, diasActivos: 2 }, { programadasXp: 500, cumplidasXp: 400, diasActivos: 5 }))
      .toEqual({ estado: 'sin_datos', falta: ['a'] });
  });
});

describe('ligas privadas', () => {
  const fila = (id: string, cumplidas: number, programadas: number, extra: Partial<FilaLiga> = {}): FilaLiga =>
    ({ id, alias: id, cumplidasXp: cumplidas * 50, programadasXp: programadas * 50, diasActivos: 5, xpSemana: 1400, xpBase28: 5600, ...extra });

  test('ordena por disciplina, comparte puesto en empate y deja sin puesto a quien no llega al mínimo', () => {
    const t = tablaLiga([fila('ana', 18, 20), fila('bea', 18, 20), fila('carl', 10, 20), fila('dani', 1, 2)]);
    expect(t.map((p) => [p.alias, p.puesto])).toEqual([['ana', 1], ['bea', 1], ['carl', 3], ['dani', 0]]);
    expect(t[3]!.sinDatos).toBe(true);
  });

  test('a igual disciplina, gana la velocidad', () => {
    const t = tablaLiga([fila('ana', 18, 20), fila('bea', 18, 20, { xpSemana: 2100 })]);
    expect(t[0]!.alias).toBe('bea');
  });

  test('la velocidad usa los días ya transcurridos, como league_board', () => {
    // Miércoles (3 días): 600 XP frente a una base de 5600/28 = 200/día → ×1.
    expect(tablaLiga([fila('ana', 18, 20, { xpSemana: 600 })], 3)[0]!.velocidad).toBe(1);
    expect(tablaLiga([fila('ana', 18, 20, { xpSemana: 600 })])[0]!.velocidad).toBe(0.43);
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
