// Modos · maestría MK I a V: una lectura de la XP por modo, con la curva de game.ts.
import { levelFromXp, xpCostForLevel } from '@/lib/game';
import {
  cabeceraMarca,
  diasHasta,
  esMarca,
  MARCAS,
  marcaDeXp,
  NIVEL_MARCA,
  progresoMarca,
  RITMO_REFERENCIA_XP_DIA,
  RITMO_TECHO_XP_DIA,
  romanoMarca,
  subidaDeMarca,
  UMBRAL_MARCA,
  xpParaNivel,
} from '../maestria';

describe('umbrales', () => {
  test('xpParaNivel es la XP acumulada de la curva de game.ts', () => {
    expect(xpParaNivel(1)).toBe(0);
    expect(xpParaNivel(2)).toBe(xpCostForLevel(1));
    expect(xpParaNivel(4)).toBe(xpCostForLevel(1) + xpCostForLevel(2) + xpCostForLevel(3));
    for (const nivel of [2, 4, 7, 9, 12, 30]) {
      expect(levelFromXp(xpParaNivel(nivel)).level).toBe(nivel);
      expect(levelFromXp(xpParaNivel(nivel) - 1).level).toBe(nivel - 1);
    }
  });

  test('cada marca entra justo en su nivel de modo', () => {
    for (const m of MARCAS) expect(levelFromXp(UMBRAL_MARCA[m]).level).toBe(NIVEL_MARCA[m]);
  });

  test('los valores documentados', () => {
    expect(UMBRAL_MARCA).toEqual({ 1: 0, 2: 903, 3: 4291, 4: 8406, 5: 17916 });
  });

  test('cada marca cuesta más que la anterior', () => {
    const tramos = [2, 3, 4, 5].map((m) => UMBRAL_MARCA[m as 2] - UMBRAL_MARCA[(m - 1) as 1]);
    for (let i = 1; i < tramos.length; i++) expect(tramos[i]!).toBeGreaterThan(tramos[i - 1]!);
  });

  test('MK II llega en las dos primeras semanas a ritmo de referencia', () => {
    expect(diasHasta(UMBRAL_MARCA[2], RITMO_REFERENCIA_XP_DIA)).toBeLessThanOrEqual(14);
  });

  test('MK V es un logro de meses, no de días', () => {
    // Unos 6 meses trabajando el modo a diario…
    expect(diasHasta(UMBRAL_MARCA[5], RITMO_REFERENCIA_XP_DIA)).toBeGreaterThanOrEqual(150);
    // …y ni con el día entero dedicado al modo baja de dos meses.
    expect(diasHasta(UMBRAL_MARCA[5], RITMO_TECHO_XP_DIA)).toBeGreaterThanOrEqual(55);
  });
});

describe('marcaDeXp', () => {
  test('bordes', () => {
    expect(marcaDeXp(0)).toBe(1);
    expect(marcaDeXp(902)).toBe(1);
    expect(marcaDeXp(903)).toBe(2);
    expect(marcaDeXp(4290)).toBe(2);
    expect(marcaDeXp(4291)).toBe(3);
    expect(marcaDeXp(8405)).toBe(3);
    expect(marcaDeXp(8406)).toBe(4);
    expect(marcaDeXp(17915)).toBe(4);
    expect(marcaDeXp(17916)).toBe(5);
    expect(marcaDeXp(10_000_000)).toBe(5);
  });

  test('basura cuenta como cero', () => {
    for (const v of [null, undefined, NaN, -50, 'abc', {}]) expect(marcaDeXp(v)).toBe(1);
    expect(marcaDeXp('5000')).toBe(3); // bigint de PostgREST como texto
  });

  test('nunca baja al subir la XP', () => {
    let previa = 1;
    for (let xp = 0; xp < 20_000; xp += 37) {
      const m = marcaDeXp(xp);
      expect(m).toBeGreaterThanOrEqual(previa);
      previa = m;
    }
  });
});

describe('progresoMarca', () => {
  test('a mitad de MK I', () => {
    const p = progresoMarca(450);
    expect(p).toMatchObject({ marca: 1, siguiente: 2, desde: 0, hasta: 903, xpEnMarca: 450, faltan: 453 });
    expect(p.ratio).toBeCloseTo(450 / 903);
  });

  test('justo al entrar en una marca, ratio 0', () => {
    expect(progresoMarca(4291)).toMatchObject({ marca: 3, siguiente: 4, xpEnMarca: 0, ratio: 0, faltan: 8406 - 4291 });
  });

  test('MK V: barra llena, sin siguiente', () => {
    expect(progresoMarca(25_000)).toMatchObject({ marca: 5, siguiente: null, hasta: null, faltan: 0, ratio: 1 });
  });

  test('el ratio siempre entre 0 y 1', () => {
    for (let xp = 0; xp < 20_000; xp += 113) {
      const { ratio } = progresoMarca(xp);
      expect(ratio).toBeGreaterThanOrEqual(0);
      expect(ratio).toBeLessThanOrEqual(1);
    }
  });
});

describe('subidaDeMarca', () => {
  test('sin lectura anterior no hay subida: es la base', () => {
    expect(subidaDeMarca(null, 3)).toBeNull();
    expect(subidaDeMarca(undefined, 5)).toBeNull();
    expect(subidaDeMarca('3', 4)).toBeNull();
    expect(subidaDeMarca(0, 2)).toBeNull();
  });

  test('igual o menor, nada', () => {
    expect(subidaDeMarca(2, 2)).toBeNull();
    expect(subidaDeMarca(4, 3)).toBeNull();
  });

  test('sube una o varias: se celebra la última', () => {
    expect(subidaDeMarca(1, 2)).toBe(2);
    expect(subidaDeMarca(2, 5)).toBe(5);
  });
});

test('romanos y tipo', () => {
  expect(MARCAS.map(romanoMarca)).toEqual(['I', 'II', 'III', 'IV', 'V']);
  expect(esMarca(3)).toBe(true);
  expect(esMarca(6)).toBe(false);
  expect(esMarca('2')).toBe(false);
});

test('cabecera x-nivl-mk (preparada, apagada en coach.ts)', () => {
  expect(cabeceraMarca(3)).toEqual({ 'x-nivl-mk': '3' });
  expect(cabeceraMarca(null)).toEqual({});
  expect(cabeceraMarca(9)).toEqual({});
});
