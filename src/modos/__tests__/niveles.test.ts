// Modos F1 · nivel por modo: la misma curva que el global.
import { levelFromXp } from '@/lib/game';
import { nivelesDeModos } from '../niveles';

const CERO = { iron: 0, focus: 0, work: 0, founder: 0 };

test('sin modos activados ni XP, nada que enseñar', () => {
  expect(nivelesDeModos([], CERO)).toEqual([]);
});

test('los activados salen aunque estén a cero, en el orden de siempre', () => {
  expect(nivelesDeModos(['founder', 'iron'], CERO).map((n) => [n.modo, n.nivel])).toEqual([
    ['iron', 1],
    ['founder', 1],
  ]);
});

test('lo ganado no se esconde al desactivar un modo', () => {
  expect(nivelesDeModos([], { ...CERO, focus: 300 }).map((n) => n.modo)).toEqual(['focus']);
});

test('la curva es la del nivel global', () => {
  for (const xp of [0, 99, 100, 1234, 25_000]) {
    const [n] = nivelesDeModos(['work'], { ...CERO, work: xp });
    const g = levelFromXp(xp);
    expect([n!.nivel, n!.xpEnNivel, n!.xpSiguiente]).toEqual([g.level, g.into, g.next]);
  }
});
