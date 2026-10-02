import { describe, expect, test } from '@jest/globals';
import { HOY_DEMO, misionDemo } from '@/components/arena/demoDatos';
import { addDays } from '@/lib/dates';
import { HABIT_TARGET_DAYS } from '@/lib/habits';
import type { Rule } from '@/lib/types';
import {
  clasificarHabitos,
  reglasPendientes,
  resumenHabito,
  resumenHabitos,
  textoRestantes,
} from '../derivarHabitos';

/** Los últimos `n` días hasta hoy incluido. */
const racha = (n: number): Set<string> => new Set(Array.from({ length: n }, (_, i) => addDays(HOY_DEMO, -i)));

const regla = (id: string): Rule => ({
  id,
  user_id: 'demo-usuario',
  position: 0,
  text: `Regla ${id}`,
  consequence: 'Sin pantallas mañana',
  active: true,
  created_at: '2026-09-01T09:00:00Z',
});

describe('clasificarHabitos', () => {
  const leer = misionDemo({ title: 'Leer' });
  const correr = misionDemo({ title: 'Correr' });
  const meditar = misionDemo({ title: 'Meditar' });
  const dormir = misionDemo({ title: 'Dormir a mi hora', acquired_at: '2026-09-01T00:00:00Z', acquired_streak: 21 });
  const fechas = new Map([
    [leer.id, racha(5)],
    [correr.id, racha(HABIT_TARGET_DAYS)],
    [meditar.id, racha(12)],
  ]);
  const c = clasificarHabitos([leer, correr, meditar, dormir], fechas, HOY_DEMO);

  test('separa los adquiridos de los que están en forja', () => {
    expect(c.adquiridos.map((q) => q.title)).toEqual(['Dormir a mi hora']);
    expect(c.enCurso).toHaveLength(3);
  });

  test('los consolidables van primero y luego por racha', () => {
    expect(c.enCurso.map((q) => q.title)).toEqual(['Correr', 'Meditar', 'Leer']);
    expect(c.progresos.get(correr.id)?.consolidable).toBe(true);
  });

  test('un hábito sin fechas cuenta cero', () => {
    const nuevo = misionDemo({ title: 'Nuevo' });
    const solo = clasificarHabitos([nuevo], new Map(), HOY_DEMO);
    expect(solo.progresos.get(nuevo.id)?.racha).toBe(0);
  });

  test('resumen: en forja, mejor racha, listos y adquiridos', () => {
    expect(resumenHabitos(c.enCurso, c.adquiridos, c.progresos)).toEqual({
      enForja: 3,
      mejorRacha: HABIT_TARGET_DAYS,
      listos: 1,
      adquiridos: 1,
    });
  });

  test('resumen vacío: la mejor racha es 0, no -Infinity', () => {
    expect(resumenHabitos([], [], new Map()).mejorRacha).toBe(0);
  });
});

describe('reglasPendientes', () => {
  test('cuenta las que no están marcadas', () => {
    expect(reglasPendientes([regla('a'), regla('b'), regla('c')], new Set(['b']))).toBe(2);
    expect(reglasPendientes([], new Set())).toBe(0);
  });
});

describe('textoRestantes', () => {
  test('singular, plural y listo', () => {
    expect(textoRestantes({ racha: 20, objetivo: 21, consolidable: false, restantes: 1 })).toBe('Falta 1 día');
    expect(textoRestantes({ racha: 5, objetivo: 21, consolidable: false, restantes: 16 })).toBe('Faltan 16 días');
    expect(textoRestantes({ racha: 21, objetivo: 21, consolidable: true, restantes: 0 })).toBe('Listo para consolidar');
  });

  test('el resumen para el lector no lleva la raya larga', () => {
    const t = resumenHabito('Leer', { racha: 1, objetivo: 21, consolidable: false, restantes: 20 });
    expect(t).toBe('Leer. Racha de 1 día de 21. Faltan 20 días.');
    expect(t).not.toContain('\u2014');
  });
});
