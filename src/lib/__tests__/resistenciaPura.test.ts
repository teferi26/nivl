import type { EntrenoMedido } from '../entrenoMedido';
import type { PlanCarrera } from '../planCarrera';
import {
  camposReimportacion,
  disciplinaDeDeporte,
  elegirSesionPlan,
  decidirPago,
  filasDelPlan,
  notaValida,
  redondearCoordenada,
  rpeValido,
} from '../resistenciaPura';

const ENTRENO: EntrenoMedido = {
  origen: 'salud',
  externo_id: 'x',
  deporte: 'carrera',
  inicio: '2026-11-08T08:00:00Z',
  fin: '2026-11-08T09:00:00Z',
  duracion_s: 3600,
  distancia_m: null,
  kcal: null,
  fc_media: null,
  fc_max: null,
  desnivel_m: null,
  ruta: null,
  parciales: [],
  largo_piscina_m: null,
  fc_serie: null,
};

describe('decidirPago', () => {
  const HOY = '2026-11-08';
  const base = { origen: 'watch', deporte: 'carrera', duracion_s: 1800, fecha: HOY } as const;
  test('reloj, GPS y mano pagan si es de hoy', () => {
    expect(decidirPago(base, HOY)).toBe('pagar');
    expect(decidirPago({ ...base, origen: 'iphone_gps' }, HOY)).toBe('pagar');
    expect(decidirPago({ ...base, origen: 'manual' }, HOY)).toBe('pagar');
  });
  test('ayer se guarda y no paga', () => {
    expect(decidirPago({ ...base, fecha: '2026-11-07' }, HOY)).toBe('solo_guardar');
  });
  test('menos de cinco minutos no paga', () => {
    expect(decidirPago({ ...base, duracion_s: 299 }, HOY)).toBe('solo_guardar');
    expect(decidirPago({ ...base, duracion_s: 300 }, HOY)).toBe('pagar');
  });
  test('fuerza nunca; otro solo si se apunta a mano', () => {
    expect(decidirPago({ ...base, deporte: 'fuerza' }, HOY)).toBe('solo_guardar');
    expect(decidirPago({ ...base, deporte: 'otro' }, HOY)).toBe('solo_guardar');
    expect(decidirPago({ ...base, deporte: 'otro', origen: 'manual' }, HOY)).toBe('pagar');
  });
  test('Salud se propone, no se cobra', () => {
    expect(decidirPago({ ...base, origen: 'salud' }, HOY)).toBe('proponer');
    expect(decidirPago({ ...base, origen: 'salud', fecha: '2026-11-07' }, HOY)).toBe('solo_guardar');
  });
});

describe('disciplinaDeDeporte', () => {
  test('piscina y aguas abiertas son natación; otro no salda nada', () => {
    expect(disciplinaDeDeporte('piscina')).toBe('natacion');
    expect(disciplinaDeDeporte('aguas_abiertas')).toBe('natacion');
    expect(disciplinaDeDeporte('otro')).toBeNull();
  });
});

describe('elegirSesionPlan', () => {
  const s = (id: string, disciplina: string, clave = false, hecha: string | null = null) => ({
    id,
    disciplina,
    clave,
    hecha_entreno_id: hecha,
  });

  test('elige la de su disciplina y prefiere la clave', () => {
    expect(elegirSesionPlan([s('a', 'bici'), s('b', 'bici', true)], 'bici')?.id).toBe('b');
  });

  test('no pisa una sesión ya hecha', () => {
    expect(elegirSesionPlan([s('a', 'bici', false, 'e1')], 'bici')).toBeNull();
  });

  test('sin sesión directa, bici y carrera saldan un brick pendiente', () => {
    expect(elegirSesionPlan([s('a', 'brick')], 'carrera')?.id).toBe('a');
    expect(elegirSesionPlan([s('a', 'bici'), s('b', 'brick')], 'bici')?.id).toBe('a');
  });

  test('natación no salda un brick y `otro` nada', () => {
    expect(elegirSesionPlan([s('a', 'brick')], 'piscina')).toBeNull();
    expect(elegirSesionPlan([s('a', 'brick')], 'otro')).toBeNull();
  });
});

describe('camposReimportacion', () => {
  test('lo que no trae no borra lo guardado', () => {
    const c = camposReimportacion(ENTRENO, '2026-11-08');
    for (const k of ['ruta', 'fc_serie', 'fc_media', 'distancia_m', 'parciales', 'rpe', 'notas']) {
      expect(c).not.toHaveProperty(k);
    }
    expect(c).toMatchObject({ duracion_s: 3600, fecha: '2026-11-08', origen: 'salud' });
  });

  test('lo que trae actualiza, pero nunca el XP', () => {
    const c = camposReimportacion({ ...ENTRENO, distancia_m: 0, parciales: [{ n: 1, tipo: 'km', distancia_m: 1000, duracion_s: 300, fc_media: null, desnivel_m: null }] }, '2026-11-08', { rpe: 7, notas: ' bien ' });
    expect(c).toMatchObject({ distancia_m: 0, rpe: 7, notas: 'bien' });
    expect(c.parciales).toHaveLength(1);
    expect(c).not.toHaveProperty('xp_awarded');
  });
});

describe('límites', () => {
  test('RPE fuera de 1..10 es nada', () => {
    expect(rpeValido(0)).toBeNull();
    expect(rpeValido(11)).toBeNull();
    expect(rpeValido(Number.NaN)).toBeNull();
    expect(rpeValido(undefined)).toBeNull();
    expect(rpeValido(6.5)).toBe(6.5);
  });

  test('nota vacía es que no hay nota, y se recorta', () => {
    expect(notaValida('   ')).toBeNull();
    expect(notaValida('x'.repeat(3000))).toHaveLength(2000);
  });

  test('las coordenadas salen con 2 decimales exactos', () => {
    expect(redondearCoordenada(40.41678)).toBe(40.42);
    expect(redondearCoordenada(-3.70379)).toBe(-3.7);
  });
});

test('filasDelPlan: una fila por sesión, con la fase de su semana', () => {
  const plan = {
    tipo: 'olimpico',
    fecha: '2027-01-31',
    aviso: null,
    semanas: [
      {
        n: 1,
        lunes: '2026-11-09',
        fase: 'base',
        descarga: false,
        horas: 6,
        sesiones: [
          { semana: 1, dia: 1, fecha: '2026-11-09', disciplina: 'bici', titulo: 'Rodaje', detalle: 'Suave', duracion_min: 60, zona: 'Z2', clave: false },
          { semana: 1, dia: 3, fecha: '2026-11-11', disciplina: 'carrera', titulo: 'Tirada', detalle: '', duracion_min: 45, zona: null, clave: true },
        ],
      },
    ],
  } as PlanCarrera;
  const filas = filasDelPlan(plan, 'u', 'o');
  expect(filas).toHaveLength(2);
  expect(filas[1]).toMatchObject({ user_id: 'u', objetivo_id: 'o', semana: 1, fase: 'base', clave: true, zona: null });
});
