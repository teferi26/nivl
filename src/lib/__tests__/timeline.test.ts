import { describe, expect, test } from '@jest/globals';
import { ALTO_HORA, cargaDelDia, disponer, rangoHoras, yDeMinuto } from '../timeline';

const it = (id: string, inicio: number, fin: number) => ({ id, inicio, fin });

describe('rangoHoras', () => {
  test('sin nada, un rango razonable de día', () => {
    expect(rangoHoras([])).toEqual({ desde: 7, hasta: 23 });
  });

  test('se ajusta a lo que hay, con una hora de margen', () => {
    // 5:00 a 22:00 → de 4 a 23. Pintar las 24 dejaría seis horas de vacío
    // arriba, que en un móvil es justo lo que obliga a buscar con scroll.
    expect(rangoHoras([it('a', 5 * 60, 6 * 60), it('b', 21 * 60, 22 * 60)])).toEqual({
      desde: 4,
      hasta: 23,
    });
  });

  test('no se sale del día', () => {
    expect(rangoHoras([it('a', 10, 30), it('b', 23 * 60 + 30, 24 * 60)])).toEqual({
      desde: 0,
      hasta: 24,
    });
  });
});

describe('disponer', () => {
  test('coloca según la hora y la duración', () => {
    const [c] = disponer([it('a', 9 * 60, 10 * 60)], 8);
    expect(c!.top).toBe(ALTO_HORA);
    expect(c!.alto).toBe(ALTO_HORA);
    expect(c!.columnas).toBe(1);
  });

  test('lo que no se solapa va a ancho completo', () => {
    const r = disponer([it('a', 9 * 60, 10 * 60), it('b', 11 * 60, 12 * 60)], 8);
    expect(r.every((c) => c.columnas === 1 && c.columna === 0)).toBe(true);
  });

  test('dos a la vez se reparten el ancho', () => {
    const r = disponer([it('a', 9 * 60, 11 * 60), it('b', 10 * 60, 12 * 60)], 8);
    expect(r.every((c) => c.columnas === 2)).toBe(true);
    expect(new Set(r.map((c) => c.columna))).toEqual(new Set([0, 1]));
  });

  test('el reparto es por tramo, no por día entero', () => {
    // Dos citas solapadas a las 9:00 no deben dejar la tarde a media pantalla.
    const r = disponer(
      [it('a', 9 * 60, 10 * 60), it('b', 9 * 60 + 30, 10 * 60 + 30), it('tarde', 17 * 60, 18 * 60)],
      8,
    );
    expect(r.find((c) => c.item.id === 'tarde')!.columnas).toBe(1);
    expect(r.find((c) => c.item.id === 'a')!.columnas).toBe(2);
  });

  test('una columna se reutiliza cuando queda libre', () => {
    // A (9-10) y B (9:30-10:30) usan dos columnas; C (11-12) vuelve a una.
    const r = disponer(
      [it('a', 9 * 60, 10 * 60), it('b', 9 * 60 + 30, 10 * 60 + 30), it('c', 11 * 60, 12 * 60)],
      8,
    );
    expect(r.find((c) => c.item.id === 'c')!.columnas).toBe(1);
  });

  test('un evento sin duración sigue siendo visible y tocable', () => {
    const [c] = disponer([it('puntual', 9 * 60, 9 * 60)], 8);
    expect(c!.alto).toBeGreaterThanOrEqual(26);
  });

  test('nada fuera del eje: el origen manda', () => {
    const [c] = disponer([it('a', 8 * 60, 9 * 60)], 8);
    expect(c!.top).toBe(0);
  });

  test('no se pierde ningún item', () => {
    const entrada = [
      it('a', 60, 120),
      it('b', 90, 200),
      it('c', 300, 360),
      it('d', 310, 330),
      it('e', 1000, 1100),
    ];
    expect(disponer(entrada, 0)).toHaveLength(entrada.length);
  });
});

describe('yDeMinuto', () => {
  test('la línea de ahora cae donde toca', () => {
    expect(yDeMinuto(9 * 60 + 30, 8)).toBe(ALTO_HORA * 1.5);
  });
});

describe('cargaDelDia', () => {
  test('un día vacío es 0 y uno lleno satura a 1', () => {
    expect(cargaDelDia([])).toBe(0);
    expect(cargaDelDia([it('a', 0, 10 * 60)])).toBe(1);
  });

  test('media jornada es media barra', () => {
    expect(cargaDelDia([it('a', 9 * 60, 13 * 60)])).toBeCloseTo(0.5, 5);
  });
});
