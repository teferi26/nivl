import { __fijarIdiomaParaTest } from '@/i18n';
import { ejercicioIronDe } from '../catalogo';
import { ejercicioPorId } from '../ejercicios';
import {
  bloques,
  elegirRango,
  mejorMarca,
  RANGO_POR_DEFECTO,
  rangoDeTexto,
  resumenHistorial,
  sesionesDe,
  sugerirCarga,
  trenDe,
  type FilaSerie,
  type SesionEjercicio,
} from '../historial';

const idDe = (n: string) => ejercicioIronDe(n)?.id ?? null;

beforeAll(() => __fijarIdiomaParaTest('es'));

const FILAS: FilaSerie[] = [
  { fecha: '2026-10-10', nombre: 'Press banca', kg: 60, reps: 8, orden: 0 },
  { fecha: '2026-10-10', nombre: 'Press banca', kg: 60, reps: 8, orden: 1 },
  { fecha: '2026-10-10', nombre: 'Press banca', kg: 60, reps: 7, orden: 2 },
  // Mismo movimiento con otro nombre: casa por alias.
  { fecha: '2026-10-14', nombre: 'Bench press', kg: 62.5, reps: 6, orden: 1 },
  { fecha: '2026-10-14', nombre: 'press de banca', kg: 40, reps: 10, orden: 0 },
  // Otro ejercicio y un nombre libre que no casa: fuera.
  { fecha: '2026-10-14', nombre: 'Sentadilla', kg: 100, reps: 5, orden: 2 },
  { fecha: '2026-10-12', nombre: 'Mi circuito', kg: 20, reps: 10, orden: 0 },
  // Sin repeticiones no es una serie.
  { fecha: '2026-10-08', nombre: 'Press banca', kg: 60, reps: 0, orden: 0 },
];

describe('sesionesDe', () => {
  it('casa con el mismo casado de «Ver técnica» y ordena de la más reciente a la más antigua', () => {
    const s = sesionesDe('press-banca', FILAS, idDe);
    expect(s.map((x) => x.fecha)).toEqual(['2026-10-14', '2026-10-10']);
    // Dentro del día, por set_index.
    expect(s[0].series).toEqual([
      { kg: 40, reps: 10 },
      { kg: 62.5, reps: 6 },
    ]);
    expect(s[1].series).toHaveLength(3);
  });

  it('un ejercicio sin series casadas no tiene sesiones', () => {
    expect(sesionesDe('dominada', FILAS, idDe)).toEqual([]);
  });
});

describe('bloques', () => {
  it('junta las series consecutivas iguales', () => {
    expect(
      bloques([
        { kg: 60, reps: 8 },
        { kg: 60, reps: 8 },
        { kg: 60, reps: 7 },
        { kg: 60, reps: 8 },
      ]),
    ).toEqual([
      { series: 2, reps: 8, kg: 60 },
      { series: 1, reps: 7, kg: 60 },
      { series: 1, reps: 8, kg: 60 },
    ]);
    expect(bloques([])).toEqual([]);
  });
});

describe('mejorMarca', () => {
  it('la serie con el mayor 1RM estimado por Epley, redondeado a 0,5', () => {
    const m = mejorMarca(sesionesDe('press-banca', FILAS, idDe));
    // 60 × (1 + 8/30) = 76; 62,5 × (1 + 6/30) = 75.
    expect(m).toEqual({ e1rm: 76, kg: 60, reps: 8, fecha: '2026-10-10' });
  });

  it('más de 12 repeticiones o sin carga no cuentan', () => {
    expect(mejorMarca([{ fecha: '2026-10-01', series: [{ kg: 20, reps: 15 }] }])).toBeNull();
    expect(mejorMarca([{ fecha: '2026-10-01', series: [{ kg: 0, reps: 10 }] }])).toBeNull();
    expect(mejorMarca([])).toBeNull();
  });
});

describe('rangoDeTexto y elegirRango', () => {
  it('entiende las formas habituales', () => {
    expect(rangoDeTexto(8)).toEqual({ min: 8, max: 8 });
    expect(rangoDeTexto('8-10')).toEqual({ min: 8, max: 10 });
    expect(rangoDeTexto('8 a 10')).toEqual({ min: 8, max: 10 });
    expect(rangoDeTexto('10/8')).toEqual({ min: 8, max: 10 });
    expect(rangoDeTexto('al fallo')).toBeNull();
    expect(rangoDeTexto('3x8-10')).toBeNull();
    expect(rangoDeTexto(0)).toBeNull();
    expect(rangoDeTexto(null)).toBeNull();
  });

  it('manda la rutina, luego la prescripción, luego 8 a 12', () => {
    expect(elegirRango(6, '8-10')).toEqual({ min: 6, max: 6 });
    expect(elegirRango(null, '8-10')).toEqual({ min: 8, max: 10 });
    expect(elegirRango(null, null)).toEqual(RANGO_POR_DEFECTO);
  });
});

describe('trenDe', () => {
  it('pierna y lo que mueve cadera es inferior; el resto, superior', () => {
    expect(trenDe(ejercicioPorId('sentadilla-barra')!)).toBe('inferior');
    expect(trenDe(ejercicioPorId('hip-thrust')!)).toBe('inferior');
    expect(trenDe(ejercicioPorId('peso-muerto')!)).toBe('inferior');
    expect(trenDe(ejercicioPorId('press-banca')!)).toBe('superior');
    expect(trenDe(ejercicioPorId('dominada')!)).toBe('superior');
    expect(trenDe(ejercicioPorId('press-militar-barra')!)).toBe('superior');
  });
});

describe('resumenHistorial', () => {
  it('junta sesiones, mejor marca y sugerencia con el rango de la rutina casada por alias', () => {
    const r = resumenHistorial(
      ejercicioPorId('press-banca')!,
      {
        filas: FILAS,
        rutina: [
          { nombre: 'Sentadilla', reps: 5 },
          { nombre: 'Press de banca', reps: 6 },
        ],
        prescripciones: [{ nombre: 'Press banca', reps: '8-10' }],
      },
      idDe,
      '2026-10-20',
      1,
    );
    expect(r.total).toBe(2);
    expect(r.sesiones.map((s) => s.fecha)).toEqual(['2026-10-14']);
    expect(r.mejor?.e1rm).toBe(76);
    // Última sesión: 62,5 × 6 con la rutina a 6 → sube 2,5.
    expect(r.sugerencia).toEqual({ series: 1, reps: 6, kg: 65, motivo: 'subir', tope: 6 });
  });

  it('sin rutina manda la prescripción; sin nada, vacío', () => {
    const r = resumenHistorial(ejercicioPorId('press-banca')!, { filas: FILAS, rutina: [], prescripciones: [{ nombre: 'Bench press', reps: '8-10' }] }, idDe, '2026-10-20');
    expect(r.sugerencia).toEqual({ series: 1, reps: 8, kg: 62.5, motivo: 'mantener', tope: 10 });
    const vacio = resumenHistorial(ejercicioPorId('dominada')!, { filas: FILAS, rutina: [], prescripciones: [] }, idDe, '2026-10-20');
    expect(vacio).toEqual({ sesiones: [], total: 0, mejor: null, sugerencia: null });
  });
});

describe('sugerirCarga (doble progresión)', () => {
  const HOY = '2026-10-20';
  const sesion = (fecha: string, ...series: [number, number][]): SesionEjercicio => ({
    fecha,
    series: series.map(([kg, reps]) => ({ kg, reps })),
  });

  it('todas las series de trabajo en el tope del rango: +2,5 kg arriba y vuelta al suelo', () => {
    const s = sugerirCarga({
      ultima: sesion('2026-10-18', [40, 10], [60, 10], [60, 10], [60, 11]),
      rango: { min: 8, max: 10 },
      tren: 'superior',
      hoy: HOY,
    });
    // El calentamiento a 40 kg no cuenta como serie de trabajo.
    expect(s).toEqual({ series: 3, reps: 8, kg: 62.5, motivo: 'subir', tope: 10 });
  });

  it('tren inferior sube 5 kg', () => {
    const s = sugerirCarga({ ultima: sesion('2026-10-18', [100, 5], [100, 5]), rango: { min: 5, max: 5 }, tren: 'inferior', hoy: HOY });
    expect(s).toEqual({ series: 2, reps: 5, kg: 105, motivo: 'subir', tope: 5 });
  });

  it('si una serie no llega, la misma carga y una repetición más que la más floja', () => {
    const s = sugerirCarga({ ultima: sesion('2026-10-18', [60, 10], [60, 9], [60, 8]), rango: { min: 8, max: 10 }, tren: 'superior', hoy: HOY });
    expect(s).toEqual({ series: 3, reps: 9, kg: 60, motivo: 'mantener', tope: 10 });
  });

  it('la repetición objetivo nunca baja del suelo ni pasa del tope', () => {
    const baja = sugerirCarga({ ultima: sesion('2026-10-18', [60, 4], [60, 5]), rango: { min: 8, max: 12 }, tren: 'superior', hoy: HOY });
    expect(baja?.reps).toBe(8);
    const fija = sugerirCarga({ ultima: sesion('2026-10-18', [60, 7]), rango: { min: 8, max: 8 }, tren: 'superior', hoy: HOY });
    expect(fija).toEqual({ series: 1, reps: 8, kg: 60, motivo: 'mantener', tope: 8 });
  });

  it('después de un parón de más de 28 días no se sube', () => {
    const s = sugerirCarga({ ultima: sesion('2026-09-01', [60, 12], [60, 12]), rango: { min: 8, max: 12 }, tren: 'superior', hoy: HOY });
    expect(s).toEqual({ series: 2, reps: 8, kg: 60, motivo: 'retomar', tope: 12 });
  });

  it('sin carga (peso corporal) o sin sesión no sugiere nada', () => {
    expect(sugerirCarga({ ultima: sesion('2026-10-18', [0, 10], [0, 10]), rango: RANGO_POR_DEFECTO, tren: 'superior', hoy: HOY })).toBeNull();
    expect(sugerirCarga({ ultima: undefined, rango: RANGO_POR_DEFECTO, tren: 'superior', hoy: HOY })).toBeNull();
  });

  it('es determinista: misma entrada, misma salida', () => {
    const p = { ultima: sesion('2026-10-18', [62.5, 8], [62.5, 8]), rango: { min: 6, max: 8 }, tren: 'superior' as const, hoy: HOY };
    expect(sugerirCarga(p)).toEqual(sugerirCarga(p));
    expect(sugerirCarga(p)?.kg).toBe(65);
  });
});
