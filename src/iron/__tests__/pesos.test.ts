import type { FilaSerie } from '@/iron/historial';
import { resumenPesos } from '@/iron/pesos';

const idDe = (n: string) => (/sentadilla/i.test(n) ? 'sentadilla' : /banca/i.test(n) ? 'press-banca' : null);
const f = (fecha: string, nombre: string, kg: number, reps: number, orden = 0): FilaSerie => ({ fecha, nombre, kg, reps, orden });

describe('resumenPesos', () => {
  it('agrupa por ejercicio del catálogo y da lo último, la mejor marca y la subida', () => {
    const r = resumenPesos(
      [
        f('2026-10-18', 'Sentadilla', 100, 5),
        f('2026-10-18', 'Sentadilla', 95, 5, 1),
        f('2026-10-01', 'sentadilla trasera', 95, 5),
        f('2026-09-15', 'Sentadilla', 92.5, 5),
        f('2026-05-01', 'Sentadilla', 60, 5), // fuera de las 6 semanas
      ],
      idDe,
      '2026-10-20',
    );
    expect(r).toHaveLength(1);
    const s = r[0]!;
    expect(s.clave).toBe('sentadilla');
    expect(s.ultimoKg).toBe(100);
    expect(s.ultimaFecha).toBe('2026-10-18');
    expect(s.nombre).toBe('Sentadilla');
    expect(s.subida).toBe(7.5);
    expect(s.record).toBe(true);
    expect(s.sesiones).toBe(4);
    // La gráfica: la carga más alta de cada sesión, de la más antigua a la última.
    expect(s.serie).toEqual([60, 92.5, 95, 100]);
  });

  it('la serie de la gráfica se queda con las 8 últimas sesiones', () => {
    const filas = Array.from({ length: 10 }, (_, i) => f(`2026-10-${String(i + 1).padStart(2, '0')}`, 'Sentadilla', 80 + i * 2.5, 5));
    const [s] = resumenPesos(filas, idDe, '2026-10-20');
    expect(s!.serie).toEqual([85, 87.5, 90, 92.5, 95, 97.5, 100, 102.5]);
  });

  it('una sola sesión: sin subida y sin récord', () => {
    const [s] = resumenPesos([f('2026-10-18', 'Press banca', 60, 8)], idDe, '2026-10-20');
    expect(s!.subida).toBeNull();
    expect(s!.record).toBe(false);
  });

  it('lo que no casa cuenta aparte por su nombre; sin carga o sin reps no sale', () => {
    const r = resumenPesos(
      [
        f('2026-10-10', 'Remo Raro', 40, 10),
        f('2026-10-11', 'remo raro', 42.5, 10),
        f('2026-10-12', 'Dominadas', 0, 8),
        f('2026-10-12', 'Press banca', 50, 0),
      ],
      idDe,
      '2026-10-20',
    );
    expect(r.map((x) => x.clave)).toEqual(['libre:remo raro']);
    expect(r[0]!.nombre).toBe('remo raro');
    expect(r[0]!.subida).toBe(2.5);
  });

  it('ordena de lo más reciente a lo más antiguo', () => {
    const r = resumenPesos([f('2026-10-01', 'Press banca', 60, 8), f('2026-10-15', 'Sentadilla', 100, 5)], idDe, '2026-10-20');
    expect(r.map((x) => x.clave)).toEqual(['sentadilla', 'press-banca']);
  });
});
