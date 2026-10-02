import { clasificar, type Competidor } from '@/lib/socialmath';
import { cifraDe, lineaPuesto, ordenPodio, sufijoDe } from '../cifraRanking';

let n = 0;
const c = (p: Partial<Competidor>): Competidor => {
  n += 1;
  return {
    userId: `u${n}`,
    name: `Gladiador ${n}`,
    isMe: false,
    xpWindow: 0,
    compliancePct: null,
    completed: 0,
    streakDays: 0,
    xpTotal: 0,
    ...p,
  };
};

describe('cifraDe', () => {
  it('agrupa los miles con punto y separa la unidad', () => {
    expect(cifraDe(1840, 'xp')).toEqual({ cifra: '1.840', unidad: 'XP' });
    expect(cifraDe(86, 'cumplimiento')).toEqual({ cifra: '86', unidad: '%' });
    expect(cifraDe(12, 'racha')).toEqual({ cifra: '12', unidad: 'd' });
  });
  it('sin dato es un guion y sin unidad', () => {
    expect(cifraDe(null, 'cumplimiento')).toEqual({ cifra: '-', unidad: null });
  });
  it('el sufijo del podio lleva espacio', () => {
    expect(sufijoDe('xp')).toBe(' XP');
  });
});

describe('lineaPuesto', () => {
  it('dice el puesto y el total', () => {
    const filas = clasificar([c({ xpWindow: 30 }), c({ isMe: true, xpWindow: 20 }), c({ xpWindow: 10 })], 'xp');
    expect(lineaPuesto(filas)).toBe('Tu puesto: 2.º de 3');
  });
  it('sin mi fila o sin dato no inventa un puesto', () => {
    expect(lineaPuesto(clasificar([c({ xpWindow: 3 })], 'xp'))).toBe('Estás fuera del ranking');
    expect(lineaPuesto(clasificar([c({ isMe: true }), c({ compliancePct: 50 })], 'cumplimiento'))).toBe(
      'Tu puesto: sin medir',
    );
  });
});

describe('ordenPodio', () => {
  const cuatro = clasificar(
    [c({ name: 'A', xpWindow: 40 }), c({ name: 'B', xpWindow: 30 }), c({ name: 'C', xpWindow: 20 }), c({ isMe: true, xpWindow: 10 })],
    'xp',
  );
  it('pinta 2.º, 1.º y 3.º', () => {
    expect(ordenPodio(cuatro, 3)?.map((f) => f.competidor.name)).toEqual(['B', 'A', 'C']);
  });
  it('con menos de tres rivales no hay podio', () => {
    expect(ordenPodio(cuatro, 2)).toBeNull();
  });
  it('sin tres cifras medidas no hay podio', () => {
    const filas = clasificar([c({ compliancePct: 90 }), c({ compliancePct: 80 }), c({}), c({ isMe: true })], 'cumplimiento');
    expect(ordenPodio(filas, 3)).toBeNull();
  });
});
