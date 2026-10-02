import type { Duelo, FilaTablero } from '@/lib/competicionData';
import { diasRestantes, ordenarTablero, quienVaDelante, repartirDuelos, textoQuedan } from '../competicionVista';

const duelo = (p: Partial<Duelo>): Duelo => ({
  id: 'd',
  soy_retador: true,
  rival: 'Gladiador 1',
  week_start: '2026-09-28',
  status: 'accepted',
  mi_indice: 70,
  su_indice: 70,
  mis_dias: 0,
  sus_dias: 0,
  resultado: null,
  ...p,
});

describe('diasRestantes', () => {
  it('cuenta hoy incluido, de lunes a domingo', () => {
    expect(diasRestantes('2026-09-28', '2026-09-28')).toBe(7);
    expect(diasRestantes('2026-09-28', '2026-10-02')).toBe(3);
    expect(diasRestantes('2026-09-28', '2026-10-04')).toBe(1);
    expect(diasRestantes('2026-09-28', '2026-10-05')).toBe(0);
  });
  it('con fechas raras no inventa días', () => {
    expect(diasRestantes('x', '2026-10-02')).toBe(0);
  });
});

describe('quienVaDelante', () => {
  it('manda el índice y desempatan los días', () => {
    expect(quienVaDelante({ mi_indice: 80, su_indice: 75, mis_dias: 1, sus_dias: 5 })).toBe('yo');
    expect(quienVaDelante({ mi_indice: 70, su_indice: 70, mis_dias: 2, sus_dias: 3 })).toBe('rival');
    expect(quienVaDelante({ mi_indice: 70, su_indice: 70, mis_dias: 3, sus_dias: 3 })).toBe('empate');
  });
});

describe('repartirDuelos', () => {
  const hoy = '2026-10-02';
  it('separa por estado y descarta anulados, rechazados y retos caducados', () => {
    const v = repartirDuelos(
      [
        duelo({ id: 'a' }),
        duelo({ id: 'b', status: 'pending', soy_retador: false }),
        duelo({ id: 'c', status: 'pending' }),
        duelo({ id: 'd', status: 'declined' }),
        duelo({ id: 'e', rival: null }),
        duelo({ id: 'f', status: 'pending', week_start: '2026-09-21' }),
        duelo({ id: 'g', status: 'done', week_start: '2026-09-21', resultado: 'gano' }),
      ],
      hoy,
    );
    expect(v.activos.map((d) => d.id)).toEqual(['a']);
    expect(v.porResponder.map((d) => d.id)).toEqual(['b']);
    expect(v.enviados.map((d) => d.id)).toEqual(['c']);
    expect(v.resueltos.map((d) => d.id)).toEqual(['g']);
  });
});

describe('ordenarTablero', () => {
  const fila = (p: Partial<FilaTablero>): FilaTablero => ({
    es_yo: false,
    alias: 'x',
    retrato: null,
    indice: 70,
    velocidad: 1,
    dias_activos: 3,
    sin_datos: false,
    ...p,
  });
  it('ordena, comparte puesto en empate y deja sin datos al final con puesto 0', () => {
    const t = ordenarTablero([
      fila({ alias: 'c', sin_datos: true, indice: 99 }),
      fila({ alias: 'a', indice: 80 }),
      fila({ alias: 'b', indice: 90 }),
      fila({ alias: 'd', indice: 80 }),
    ]);
    expect(t.map((f) => [f.alias, f.puesto])).toEqual([
      ['b', 1],
      ['a', 2],
      ['d', 2],
      ['c', 0],
    ]);
  });
});

describe('textoQuedan', () => {
  it('habla claro del último día', () => {
    expect(textoQuedan(1)).toBe('último día');
    expect(textoQuedan(4)).toBe('quedan 4 días');
  });
});
