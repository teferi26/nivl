// Paridad entre src/focus y su duplicado del coach (supabase/functions/_shared/academico.ts): el empaquetado
// de la Edge Function no sube nada de fuera de supabase/, así que el modelo existe dos veces a propósito.
// Aquí se corren los dos lados con los mismos datos: tres perfiles reales y varias horas del día. Las tablas
// del final son las mismas de academico_paridad_test.ts, el lado Deno. Si una cambia, cambia la otra.

import { readFileSync } from 'fs';
import { join } from 'path';
import * as coach from '../../../supabase/functions/_shared/academico';
import { diasSeguidos, hoyEstudiado, minutosSemana } from '../horario';
import { media, notaNecesaria, type Necesaria, type NotaParaMedia } from '../notas';
import { planDelDia, progresoTemario, type EntradaDia } from '../planEstudio';
import { CONFIG_POR_DEFECTO } from '../pomodoro';
import { primerRepaso, programar, type Resultado } from '../repaso';
import { entregasPendientes, examenesProximos, examenesSinFecha, notasPorAsignatura, planDeHoyCompleto, repasosDeHoy } from '../resumen';
import { sumarDias } from '../fechas';
import { PREFS_POR_DEFECTO, type DatosFocus, type EstadoTema, type Examen, type Tema } from '../tipos';

const HOY = '2026-11-08';

const asig = (id: string, nombre: string, posicion = 0, notaObjetivo: number | null = null) => ({ id, nombre, posicion, notaObjetivo, vuelta: 1 });

const tema = (id: string, asignaturaId: string, posicion: number, c: Partial<Tema> = {}): Tema => ({
  id,
  asignaturaId,
  examenId: null,
  nombre: `Tema ${posicion + 1}`,
  estado: 'pendiente',
  posicion,
  etapa: 0,
  repasoEl: null,
  seccion: null,
  repasadoEl: null,
  ...c,
});

const examen = (id: string, asignaturaId: string, titulo: string, fecha: string | null, c: Partial<Examen> = {}): Examen => ({
  id,
  asignaturaId,
  titulo,
  fecha,
  peso: null,
  hora: null,
  tipo: 'examen',
  estimada: false,
  hechaEl: null,
  ...c,
});

const sesion = (i: number, asignaturaId: string | null, fecha: string, minutos: number, metodo: string | null = 'pomodoro') => ({ id: `s${i}`, asignaturaId, temaId: null, fecha, minutos, metodo, salidas: 0 });

const base: DatosFocus = { asignaturas: [], temas: [], examenes: [], sesiones: [], clases: [], notas: [], mazos: [], tarjetas: [], prefs: PREFS_POR_DEFECTO };

const estados: EstadoTema[] = ['pendiente', 'repasando', 'dominado'];

const opositora: DatosFocus = {
  ...base,
  asignaturas: [asig('d', 'Temario general')],
  examenes: [examen('o', 'd', 'Oposición', null)],
  temas: Array.from({ length: 70 }, (_, i) =>
    tema(`t${String(i).padStart(2, '0')}`, 'd', i, i < 20 ? { estado: estados[(i % 2) + 1] as EstadoTema, etapa: i % 5, repasoEl: sumarDias(HOY, (i % 7) - 4) } : {}),
  ),
  sesiones: [sesion(1, 'd', HOY, 50), sesion(2, 'd', sumarDias(HOY, -1), 300), sesion(3, 'd', sumarDias(HOY, -2), 240)],
  prefs: { ...PREFS_POR_DEFECTO, perfil: 'oposicion', minutosDia: 300 },
};

const universitario: DatosFocus = {
  ...base,
  asignaturas: [asig('m', 'Mates', 0, 7), asig('f', 'Física', 1), asig('q', 'Química', 2), asig('h', 'Historia', 3)],
  examenes: [
    examen('xm', 'm', 'Final Mates', sumarDias(HOY, 3), { peso: 60, hora: 540 }),
    examen('xf', 'f', 'Final Física', sumarDias(HOY, 6), { peso: 50 }),
    examen('xq', 'q', 'Final Química', sumarDias(HOY, 9), { hora: 720 }),
    examen('xh', 'h', 'Final Historia', sumarDias(HOY, 12), { estimada: true }),
    examen('p1', 'f', 'Práctica 1', sumarDias(HOY, 1), { tipo: 'entrega' }),
    examen('p2', 'q', 'Informe', HOY, { tipo: 'entrega', hora: 23 * 60 }),
    examen('p3', 'q', 'Vieja', sumarDias(HOY, -2), { tipo: 'entrega' }),
    examen('p4', 'q', 'Cerrada', sumarDias(HOY, 1), { tipo: 'entrega', hechaEl: HOY }),
  ],
  temas: [
    ...Array.from({ length: 12 }, (_, i) => tema(`tm${i}`, 'm', i, { examenId: 'xm', estado: i < 3 ? 'repasando' : 'pendiente', repasoEl: i < 3 ? sumarDias(HOY, i - 1) : null })),
    ...Array.from({ length: 10 }, (_, i) => tema(`tf${i}`, 'f', i, { examenId: i < 6 ? 'xf' : null })),
    ...Array.from({ length: 8 }, (_, i) => tema(`tq${i}`, 'q', i)),
    ...Array.from({ length: 6 }, (_, i) => tema(`th${i}`, 'h', i, { estado: i === 0 ? 'dominado' : 'pendiente', etapa: 4, repasoEl: i === 0 ? sumarDias(HOY, 20) : null })),
  ],
  notas: [
    { id: 'n1', asignaturaId: 'm', titulo: 'Parcial', nota: 6.5, sobre: 10, peso: 40, fecha: '2026-10-10' },
    { id: 'n2', asignaturaId: 'f', titulo: 'Control', nota: 15, sobre: 20, peso: null, fecha: '2026-10-11' },
    { id: 'n3', asignaturaId: 'q', titulo: 'Lab', nota: 9, sobre: 10, peso: 70, fecha: '2026-10-12' },
  ],
  mazos: [{ id: 'mz', asignaturaId: 'm', nombre: 'Fórmulas' }, { id: 'mz2', asignaturaId: 'archivada', nombre: 'Vieja' }, { id: 'mz3', asignaturaId: null, nombre: 'Suelta' }],
  tarjetas: [
    { id: 'c1', mazoId: 'mz', anverso: 'a', reverso: 'b', etapa: 0, vence: HOY },
    { id: 'c2', mazoId: 'mz2', anverso: 'a', reverso: 'b', etapa: 0, vence: HOY },
    { id: 'c3', mazoId: 'mz3', anverso: 'a', reverso: 'b', etapa: 0, vence: sumarDias(HOY, -1) },
    { id: 'c4', mazoId: 'mz', anverso: 'a', reverso: 'b', etapa: 0, vence: sumarDias(HOY, 4) },
  ],
  sesiones: [sesion(1, 'm', HOY, 25), sesion(2, 'f', HOY, 25, 'anteriores'), sesion(3, null, sumarDias(HOY, -1), 25), sesion(4, 'm', sumarDias(HOY, -3), 25)],
  prefs: { ...PREFS_POR_DEFECTO, perfil: 'universidad', minutosDia: 240 },
};

const bachillerato: DatosFocus = {
  ...base,
  asignaturas: ['Lengua', 'Historia', 'Inglés', 'Mates', 'Física', 'Química', 'Biología', 'Filosofía'].map((n, i) => asig(`b${i}`, n, i)),
  examenes: [
    examen('e0', 'b3', 'Control Mates', sumarDias(HOY, 1), { hora: 510 }),
    examen('e1', 'b4', 'Examen Física', HOY, { hora: 19 * 60 }),
    examen('e2', 'b0', 'Comentario', sumarDias(HOY, 2), { tipo: 'entrega' }),
    examen('e3', 'b2', 'Pasado', sumarDias(HOY, -5)),
  ],
  temas: [
    ...Array.from({ length: 5 }, (_, i) => tema(`m${i}`, 'b3', i, { examenId: 'e0' })),
    ...Array.from({ length: 4 }, (_, i) => tema(`f${i}`, 'b4', i)),
    tema('l0', 'b0', 0),
    tema('zz', 'archivada', 0, { repasoEl: sumarDias(HOY, -9) }),
  ],
  clases: [1, 2, 3, 4, 5].flatMap((dia) => [{ id: `k${dia}`, asignaturaId: 'b0', dia, inicio: 480, fin: 870, aula: null }]),
  notas: [{ id: 'n', asignaturaId: 'b2', titulo: 'Ev1', nota: 3, sobre: 10, peso: 60, fecha: '2026-10-01' }],
  sesiones: Array.from({ length: 16 }, (_, i) => sesion(i, 'b3', sumarDias(HOY, -i), 30)),
  prefs: { ...PREFS_POR_DEFECTO, perfil: 'instituto', sinClasesHasta: sumarDias(HOY, 2) },
};

const conClases: DatosFocus = { ...bachillerato, prefs: { ...bachillerato.prefs, sinClasesHasta: null } };

const PERFILES: [string, DatosFocus][] = [
  ['vacío', base],
  ['opositora', opositora],
  ['universitario', universitario],
  ['bachillerato', bachillerato],
  ['bachillerato con clases', conClases],
  ['al día', { ...universitario, temas: universitario.temas.map((t) => ({ ...t, estado: 'dominado' as const, repasoEl: sumarDias(HOY, 30) })), tarjetas: [] }],
  ['sin temas', { ...universitario, temas: [] }],
  [
    'clase archivada y simulacro',
    {
      ...conClases,
      clases: [...conClases.clases, { id: 'kz', asignaturaId: 'archivada', dia: 1, inicio: 1200, fin: 1290, aula: null }],
      notas: [...conClases.notas, { id: 'ns', asignaturaId: 'b2', titulo: 'Test · Ensayo', nota: 10, sobre: 10, peso: null, fecha: '2026-10-02' }],
    },
  ],
];

// Un lunes, un domingo, a primera hora, por la tarde y casi de noche.
const MOMENTOS: [string, number][] = [[HOY, 7 * 60], [HOY, 16 * 60 + 12], [HOY, 22 * 60 + 40], [sumarDias(HOY, 1), 9 * 60]];

describe.each(PERFILES)('paridad con el coach · %s', (_n, d) => {
  test.each(MOMENTOS)('el plan completo el %s a los %i min', (hoy, min) => {
    expect(coach.planDeHoyCompleto(d, hoy, min, CONFIG_POR_DEFECTO)).toEqual(planDeHoyCompleto(d, hoy, min, CONFIG_POR_DEFECTO));
  });

  test('con otro ritmo de bloque', () => {
    const c = { ...CONFIG_POR_DEFECTO, foco: 45, descanso: 10 };
    expect(coach.planDeHoyCompleto(d, HOY, 600, c)).toEqual(planDeHoyCompleto(d, HOY, 600, c));
  });

  test('exámenes, entregas, notas y repasos', () => {
    expect(coach.examenesProximos(d, HOY)).toEqual(examenesProximos(d, HOY));
    expect(coach.examenesSinFecha(d)).toEqual(examenesSinFecha(d));
    expect(coach.entregasPendientes(d, HOY)).toEqual(entregasPendientes(d, HOY));
    expect(coach.notasPorAsignatura(d)).toEqual(notasPorAsignatura(d));
    expect(coach.repasosDeHoy(d, HOY)).toEqual(repasosDeHoy(d, HOY));
  });

  test('horas y días seguidos', () => {
    expect(coach.diasSeguidos(d.sesiones, HOY)).toBe(diasSeguidos(d.sesiones, HOY));
    expect(coach.hoyEstudiado(d.sesiones, HOY)).toEqual(hoyEstudiado(d.sesiones, HOY));
    expect([...coach.minutosSemana(d.sesiones, HOY)]).toEqual([...minutosSemana(d.sesiones, HOY)]);
  });
});

test('el módulo del coach no importa nada: si importa algo, esta paridad ya no se puede correr', () => {
  const src = readFileSync(join(__dirname, '../../../supabase/functions/_shared/academico.ts'), 'utf8');
  expect(src).not.toMatch(/^import /m);
});

test('cada motivo de la app tiene su frase en el estado del coach', () => {
  const es = JSON.parse(readFileSync(join(__dirname, '../../i18n/es/focus.json'), 'utf8')) as { motivo: Record<string, string> };
  const claves = [...new Set(Object.keys(es.motivo).map((k) => k.replace(/_(one|other)$/, '')))];
  expect(claves.length).toBeGreaterThan(10);
  for (const clave of claves) expect(coach.textoMotivo({ clave, datos: { titulo: 'X', count: 2 } })).not.toBe(clave);
});

// ── La misma tabla que academico_paridad_test.ts ────────────────────────

const CASOS_REPASO: [etapa: number, resultado: Resultado, hoy: string, nueva: number, vence: string][] = [
  [0, 'bien', '2026-11-08', 1, '2026-11-11'], [1, 'bien', '2026-11-08', 2, '2026-11-15'], [3, 'bien', '2026-11-08', 4, '2026-12-08'],
  [4, 'bien', '2026-11-08', 4, '2026-12-08'], [2, 'dudosa', '2026-11-08', 2, '2026-11-15'], [4, 'mal', '2026-11-08', 0, '2026-11-09'],
  [99, 'dudosa', '2026-12-31', 4, '2027-01-30'], [-3, 'bien', '2026-02-28', 1, '2026-03-03'],
];

const CASOS_NOTAS: [notas: NotaParaMedia[], objetivo: number, media: number | null, necesaria: Necesaria][] = [
  [[], 5, null, { tipo: 'sin_datos' }],
  [[{ nota: 8, sobre: 10, peso: null }, { nota: 6, sobre: 10, peso: null }], 5, 7, { tipo: 'sin_datos' }],
  [[{ nota: 6, sobre: 10, peso: 40 }], 5, 6, { tipo: 'necesaria', necesaria: 4.33 }],
  [[{ nota: 6, sobre: 10, peso: 40 }], 7, 6, { tipo: 'necesaria', necesaria: 7.67 }],
  [[{ nota: 2, sobre: 10, peso: 80 }], 5, 2, { tipo: 'imposible', necesaria: 17 }],
  [[{ nota: 9, sobre: 10, peso: 60 }], 5, 9, { tipo: 'encaminada' }],
  [[{ nota: 7, sobre: 10, peso: 60 }, { nota: 16, sobre: 20, peso: 40 }], 5, 7.4, { tipo: 'asegurado' }],
  [[{ nota: 3, sobre: 10, peso: 60 }, { nota: 3, sobre: 10, peso: 40 }], 5, 3, { tipo: 'sin_datos' }],
  [[{ nota: 8, sobre: 10, peso: 50 }, { nota: 2, sobre: 10, peso: null }], 5, 8, { tipo: 'necesaria', necesaria: 2 }],
];

const ENTRADA_PLAN: EntradaDia = {
  hoy: '2026-11-08',
  desdeMin: 16 * 60,
  minutosDia: 180,
  minutosHechos: 0,
  minutosBloque: 50,
  ritmo: { foco: 25, descanso: 5 },
  tarjetasVencidas: 5,
  repasos: [{ id: 'r1', asignaturaId: 'a', vence: '2026-11-07', examenId: 'x1' }, { id: 'r2', asignaturaId: 'a', vence: '2026-11-20' }],
  examenes: [
    { id: 'x1', asignaturaId: 'a', titulo: 'Física', fecha: '2026-11-09', hora: 600, tipo: 'examen', estimada: false, peso: 40, temas: [{ id: 't1', estado: 'pendiente' }, { id: 't2', estado: 'repasando' }] },
    { id: 'x2', asignaturaId: 'b', titulo: 'Química', fecha: '2026-11-18', hora: null, tipo: 'examen', estimada: false, peso: 30, temas: [{ id: 't3', estado: 'pendiente' }, { id: 't4', estado: 'pendiente' }] },
    { id: 'x3', asignaturaId: 'b', titulo: 'Práctica', fecha: '2026-11-09', hora: null, tipo: 'entrega', estimada: false, peso: null, temas: [] },
    { id: 'x4', asignaturaId: 'c', titulo: 'Oposición', fecha: null, hora: null, tipo: 'examen', estimada: false, peso: null, temas: [{ id: 't5', estado: 'pendiente' }] },
  ],
};

const PLAN_ESPERADO: [tipo: string, tema: string | null, minutos: number, clave: string][] = [
  ['entrega', null, 50, 'entregaManana'],
  ['repasar', null, 10, 'repasoTarjetas'],
  ['repasar', 'r1', 10, 'repasoAtrasado'],
  ['simulacro', null, 60, 'simulacroVispera'],
  ['estudiar', 't1', 50, 'estudiarExamenManana'],
];

test('tabla: calendario de repasos', () => {
  for (const [etapa, res, hoy, nueva, vence] of CASOS_REPASO) expect(programar(etapa, res, hoy)).toEqual({ etapa: nueva, vence });
  expect(primerRepaso('2026-12-31')).toEqual({ etapa: 0, vence: '2027-01-01' });
});

test('tabla: media y nota necesaria', () => {
  for (const [notas, objetivo, m, necesaria] of CASOS_NOTAS) {
    expect(media(notas).media).toBe(m);
    expect(notaNecesaria(notas, objetivo)).toEqual(necesaria);
  }
});

test('tabla: el plan del día, con motivos', () => {
  const p = planDelDia(ENTRADA_PLAN);
  expect(p.bloques.map((b) => [b.tipo, b.temaId, b.minutos, b.motivo.clave])).toEqual(PLAN_ESPERADO);
  expect(p.avisoNoLlegas).toBe(false);
  expect(progresoTemario([{ estado: 'dominado' }, { estado: 'repasando' }, { estado: 'pendiente' }])).toBe(50);
});
