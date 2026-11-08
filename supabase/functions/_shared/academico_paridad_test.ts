// Paridad del modelo de estudio entre el coach y la app. La MISMA tabla vive en
// src/focus/__tests__/academico-paridad.test.ts, que además corre los dos lados con los mismos datos
// (perfiles enteros, varias horas del día). Si una cambia, cambia la otra.
import { deepEqual as assertEquals } from 'node:assert/strict';
import {
  diasEntre,
  diasSeguidos,
  media,
  notaNecesaria,
  planDelDia,
  primerRepaso,
  programar,
  progresoTemario,
  sumarDias,
  type EntradaDia,
  type Necesaria,
  type NotaParaMedia,
  type Resultado,
} from './academico.ts';

export const CASOS_REPASO: [etapa: number, resultado: Resultado, hoy: string, nueva: number, vence: string][] = [
  [0, 'bien', '2026-11-08', 1, '2026-11-11'], [1, 'bien', '2026-11-08', 2, '2026-11-15'], [3, 'bien', '2026-11-08', 4, '2026-12-08'],
  [4, 'bien', '2026-11-08', 4, '2026-12-08'], [2, 'dudosa', '2026-11-08', 2, '2026-11-15'], [4, 'mal', '2026-11-08', 0, '2026-11-09'],
  [99, 'dudosa', '2026-12-31', 4, '2027-01-30'], [-3, 'bien', '2026-02-28', 1, '2026-03-03'],
];

export const CASOS_NOTAS: [notas: NotaParaMedia[], objetivo: number, media: number | null, necesaria: Necesaria][] = [
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

export const ENTRADA_PLAN: EntradaDia = {
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

export const PLAN_ESPERADO: [tipo: string, tema: string | null, minutos: number, clave: string][] = [
  ['entrega', null, 50, 'entregaManana'],
  ['repasar', null, 10, 'repasoTarjetas'],
  ['repasar', 'r1', 10, 'repasoAtrasado'],
  ['simulacro', null, 60, 'simulacroVispera'],
  ['estudiar', 't1', 50, 'estudiarExamenManana'],
];

Deno.test('paridad: calendario de repasos', () => {
  for (const [etapa, res, hoy, nueva, vence] of CASOS_REPASO) assertEquals(programar(etapa, res, hoy), { etapa: nueva, vence });
  assertEquals(primerRepaso('2026-12-31'), { etapa: 0, vence: '2027-01-01' });
});

Deno.test('paridad: media y nota necesaria', () => {
  for (const [notas, objetivo, m, necesaria] of CASOS_NOTAS) {
    assertEquals(media(notas).media, m);
    assertEquals(notaNecesaria(notas, objetivo), necesaria);
  }
});

Deno.test('paridad: el plan del día, con motivos', () => {
  const p = planDelDia(ENTRADA_PLAN);
  assertEquals(p.bloques.map((b) => [b.tipo, b.temaId, b.minutos, b.motivo.clave]), PLAN_ESPERADO);
  assertEquals(p.avisoNoLlegas, false);
  assertEquals(p.sinPlan, null);
});

Deno.test('paridad: fechas, progreso y días seguidos', () => {
  assertEquals(sumarDias('2026-03-28', 2), '2026-03-30');
  assertEquals(diasEntre('2026-10-24', '2026-10-26'), 2);
  assertEquals(progresoTemario([{ estado: 'dominado' }, { estado: 'repasando' }, { estado: 'pendiente' }]), 50);
  const s = (fecha: string) => ({ asignaturaId: null, fecha, minutos: 25 });
  assertEquals(diasSeguidos([s('2026-11-07'), s('2026-11-06'), s('2026-11-04')], '2026-11-08'), 2);
});
