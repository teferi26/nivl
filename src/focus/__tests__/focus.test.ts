// NIVL · FOCUS: la lógica pura del mundo del estudiante.
import { deHhmm, diaSemana, diasEntre, esFecha, hhmm, lunesDe, sumarDias } from '@/focus/fechas';
import { clasesDelDia, diasSeguidos, errorDeClase, finUltimaClase, minutosSemana, siguienteClase, solapes } from '@/focus/horario';
import { METODOS, metodoPorId } from '@/focus/metodos';
import { cumpleMision, enlazables, misionPropuesta } from '@/focus/mision';
import { formatoNota, leerNumero, media, mediaGlobal, notaNecesaria } from '@/focus/notas';
import { horasDeBloques, inicioEstudio, planDeHoy, planHaciaExamen, progresoTemario } from '@/focus/planEstudio';
import {
  CONFIG_POR_DEFECTO,
  ESTADO_INICIAL,
  acabada,
  arrancar,
  cerrarFase,
  detener,
  formatoReloj,
  normalizarConfig,
  normalizarEstado,
  pausar,
  progreso,
  restanteMs,
  siguiente,
  situacion,
} from '@/focus/pomodoro';
import { INTERVALOS, calendarioRepasos, pendientesDeHoy, primerRepaso, programar, vencido } from '@/focus/repaso';
import { siguienteEstado } from '@/focus/tipos';

const C = CONFIG_POR_DEFECTO;
const MIN = 60_000;

describe('fechas', () => {
  it('suma, resta y cruza meses y años', () => {
    expect(sumarDias('2026-10-30', 3)).toBe('2026-11-02');
    expect(sumarDias('2026-01-01', -1)).toBe('2025-12-31');
    expect(diasEntre('2026-10-21', '2026-11-02')).toBe(12);
    expect(diasEntre('2026-10-21', '2026-10-20')).toBe(-1);
  });
  it('no se mueve con el cambio de hora (25 de octubre)', () => {
    expect(diasEntre('2026-10-24', '2026-10-26')).toBe(2);
  });
  it('día de la semana y lunes', () => {
    expect(diaSemana('2026-10-21')).toBe(3);
    expect(diaSemana('2026-10-25')).toBe(7);
    expect(lunesDe('2026-10-25')).toBe('2026-10-19');
  });
  it('valida y formatea', () => {
    expect(esFecha('2026-02-30')).toBe(false);
    expect(esFecha('2026-02-28')).toBe(true);
    expect(hhmm(16 * 60 + 5)).toBe('16:05');
    expect(deHhmm('9:30')).toBe(570);
    expect(deHhmm('25:00')).toBeNull();
  });
});

describe('pomodoro', () => {
  it('normaliza la configuración con topes', () => {
    expect(normalizarConfig(null)).toEqual(C);
    expect(normalizarConfig({ foco: 500, descanso: 0, cadaLargo: 3 })).toMatchObject({ foco: 90, descanso: 1, cadaLargo: 3 });
  });

  it('25/5 con descanso largo cada 4', () => {
    let e = { fase: 'foco' as const, bloque: 1 };
    const fases: string[] = [];
    for (let i = 0; i < 9; i++) {
      fases.push(`${e.fase}${e.bloque}`);
      e = siguiente(e, C) as typeof e;
    }
    expect(fases).toEqual(['foco1', 'descanso1', 'foco2', 'descanso2', 'foco3', 'descanso3', 'foco4', 'largo4', 'foco1']);
  });

  it('arranca, cuenta con reloj de pared, pausa y reanuda', () => {
    const t0 = 1_000_000;
    let e = arrancar(ESTADO_INICIAL, C, t0, { asignaturaId: 'a', temaId: null, misionId: 'm' });
    expect(situacion(e)).toBe('en_marcha');
    expect(restanteMs(e, C, t0 + 5 * MIN)).toBe(20 * MIN);
    expect(formatoReloj(restanteMs(e, C, t0 + 5 * MIN))).toBe('20:00');
    expect(progreso(e, C, t0 + 5 * MIN)).toBeCloseTo(0.2);
    e = pausar(e, t0 + 10 * MIN);
    expect(situacion(e)).toBe('en_pausa');
    expect(restanteMs(e, C, t0 + 60 * MIN)).toBe(15 * MIN);
    const id = e.idFase;
    e = arrancar(e, C, t0 + 60 * MIN);
    expect(e.finEn).toBe(t0 + 75 * MIN);
    expect(e.idFase).toBe(id);
    expect(e.objetivo.misionId).toBe('m');
  });

  it('un foco terminado (aunque fuera en segundo plano) cuenta entero; saltado, no', () => {
    const t0 = 0;
    const e = arrancar(ESTADO_INICIAL, C, t0);
    expect(acabada(e, t0 + 24 * MIN)).toBe(false);
    expect(acabada(e, t0 + 3 * 60 * MIN)).toBe(true);
    const fin = cerrarFase(e, C, t0 + 3 * 60 * MIN);
    expect(fin.focoCompleto?.minutos).toBe(25);
    expect(fin.estado).toMatchObject({ fase: 'descanso', bloque: 1, finEn: null });
    const saltado = cerrarFase(e, C, t0 + 10 * MIN, true);
    expect(saltado.focoCompleto).toBeNull();
    expect(saltado.estado.fase).toBe('descanso');
  });

  it('el descanso no paga y encadena si se pide', () => {
    const c = { ...C, encadenar: true };
    const e = arrancar({ ...ESTADO_INICIAL, fase: 'descanso' }, c, 0);
    const r = cerrarFase(e, c, 6 * MIN);
    expect(r.focoCompleto).toBeNull();
    expect(r.estado).toMatchObject({ fase: 'foco', bloque: 2, finEn: 5 * MIN + 25 * MIN });
  });

  it('detener vuelve al foco sin pagar', () => {
    const e = detener({ ...arrancar(ESTADO_INICIAL, C, 0), fase: 'descanso' });
    expect(e).toMatchObject({ fase: 'foco', finEn: null, pausaRestante: null, idFase: null });
  });

  it('formato del reloj', () => {
    expect(formatoReloj(25 * MIN)).toBe('25:00');
    expect(formatoReloj(500)).toBe('0:01');
    expect(formatoReloj(65 * MIN)).toBe('1:05:00');
  });

  it('lee un estado guardado sin fiarse', () => {
    expect(normalizarEstado('basura', C)).toEqual(ESTADO_INICIAL);
    expect(normalizarEstado({ fase: 'largo', bloque: 99, finEn: 5, objetivo: { misionId: 'x' } }, C)).toMatchObject({
      fase: 'largo',
      bloque: 4,
      finEn: 5,
      objetivo: { misionId: 'x', asignaturaId: null },
    });
  });
});

describe('repetición espaciada', () => {
  it('calendario 1, 3, 7, 14 y 30 días', () => {
    expect(INTERVALOS).toEqual([1, 3, 7, 14, 30]);
    expect(calendarioRepasos('2026-10-21')).toEqual(['2026-10-22', '2026-10-24', '2026-10-28', '2026-11-04', '2026-11-20']);
  });
  it('bien sube, dudosa repite, mal vuelve a mañana; el tope es 30 días', () => {
    expect(primerRepaso('2026-10-21')).toEqual({ etapa: 0, vence: '2026-10-22' });
    expect(programar(0, 'bien', '2026-10-22')).toEqual({ etapa: 1, vence: '2026-10-25' });
    expect(programar(2, 'dudosa', '2026-10-22')).toEqual({ etapa: 2, vence: '2026-10-29' });
    expect(programar(3, 'mal', '2026-10-22')).toEqual({ etapa: 0, vence: '2026-10-23' });
    expect(programar(4, 'bien', '2026-10-22')).toEqual({ etapa: 4, vence: '2026-11-21' });
  });
  it('pendientes de hoy, del más atrasado', () => {
    const items = [
      { id: 'a', vence: '2026-10-22' },
      { id: 'b', vence: '2026-10-19' },
      { id: 'c', vence: null },
      { id: 'd', vence: '2026-10-21' },
    ];
    expect(pendientesDeHoy(items, '2026-10-21').map((i) => i.id)).toEqual(['b', 'd']);
    expect(vencido(null, '2026-10-21')).toBe(false);
  });
});

describe('plan de estudio automático', () => {
  const temas = (n: number, estado: 'pendiente' | 'repasando' | 'dominado' = 'pendiente') =>
    Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, estado }));

  it('reparte los temas en orden y deja el último día para el simulacro', () => {
    const plan = planHaciaExamen({ examenId: 'e', fecha: '2026-10-28', temas: temas(6), hoy: '2026-10-21' });
    expect(plan).toHaveLength(7);
    expect(plan[0]!.fecha).toBe('2026-10-21');
    expect(plan[6]!.items).toEqual([{ examenId: 'e', temaId: null, tipo: 'simulacro' }]);
    const estudiar = plan.map((d) => d.items.filter((i) => i.tipo === 'estudiar').map((i) => i.temaId));
    expect(estudiar.flat()).toEqual(['t1', 't2', 't3', 't4', 't5', 't6']);
    expect(estudiar.slice(0, 6).every((d) => d.length === 1)).toBe(true);
  });

  it('cada tema vuelve como repaso al día siguiente y a los tres días', () => {
    const plan = planHaciaExamen({ examenId: 'e', fecha: '2026-10-31', temas: temas(2), hoy: '2026-10-21' });
    const dia = (t: string, tipo: string) => plan.findIndex((d) => d.items.some((i) => i.temaId === t && i.tipo === tipo));
    const d1 = dia('t1', 'estudiar');
    expect(plan[d1 + 1]!.items.some((i) => i.temaId === 't1' && i.tipo === 'repasar')).toBe(true);
    expect(plan[d1 + 3]!.items.some((i) => i.temaId === 't1' && i.tipo === 'repasar')).toBe(true);
    // Con más días que temas, quedan separados.
    expect(dia('t2', 'estudiar') - d1).toBeGreaterThan(1);
  });

  it('más temas que días: varios por día, equilibrado por peso', () => {
    const plan = planHaciaExamen({ examenId: 'e', fecha: '2026-10-25', temas: temas(9), hoy: '2026-10-21' });
    const nuevos = plan.map((d) => d.items.filter((i) => i.tipo === 'estudiar').length);
    expect(nuevos).toEqual([3, 3, 3, 0]);
  });

  it('lo dominado no se estudia (solo un repaso) y lo que se repasa pesa la mitad', () => {
    const t = [
      { id: 'a', estado: 'dominado' as const },
      { id: 'b', estado: 'repasando' as const },
      { id: 'c', estado: 'pendiente' as const },
    ];
    const plan = planHaciaExamen({ examenId: 'e', fecha: '2026-10-25', temas: t, hoy: '2026-10-21' });
    const todos = plan.flatMap((d) => d.items);
    expect(todos.filter((i) => i.temaId === 'a').map((i) => i.tipo)).toEqual(['repasar']);
    expect(todos.filter((i) => i.tipo === 'estudiar').map((i) => i.temaId)).toEqual(['b', 'c']);
  });

  it('examen mañana: todo hoy y sin simulacro; examen hoy o pasado: nada', () => {
    const p = planHaciaExamen({ examenId: 'e', fecha: '2026-10-22', temas: temas(3), hoy: '2026-10-21' });
    expect(p).toHaveLength(1);
    expect(p[0]!.items.map((i) => i.tipo)).toEqual(['estudiar', 'estudiar', 'estudiar']);
    expect(planHaciaExamen({ examenId: 'e', fecha: '2026-10-21', temas: temas(3), hoy: '2026-10-21' })).toEqual([]);
    expect(planHaciaExamen({ examenId: 'e', fecha: '2026-10-01', temas: temas(3), hoy: '2026-10-21' })).toEqual([]);
  });

  it('sin temas: solo el simulacro', () => {
    const p = planHaciaExamen({ examenId: 'e', fecha: '2026-10-24', temas: [], hoy: '2026-10-21' });
    expect(p.flatMap((d) => d.items)).toEqual([{ examenId: 'e', temaId: null, tipo: 'simulacro' }]);
  });

  it('el plan de hoy junta los exámenes, el más cercano primero', () => {
    const hoy = planDeHoy(
      [
        { examenId: 'lejos', fecha: '2026-11-16', temas: temas(4) },
        { examenId: 'cerca', fecha: '2026-11-02', temas: temas(6) },
        { examenId: 'pasado', fecha: '2026-10-01', temas: temas(2) },
      ],
      '2026-10-21',
    );
    expect(hoy[0]!.examenId).toBe('cerca');
    expect(hoy.some((i) => i.examenId === 'pasado')).toBe(false);
  });

  it('progreso del temario', () => {
    expect(progresoTemario([])).toBe(0);
    expect(progresoTemario([{ estado: 'dominado' }, { estado: 'repasando' }, { estado: 'pendiente' }, { estado: 'pendiente' }])).toBe(38);
  });

  it('horas de los bloques y hora de empezar', () => {
    expect(horasDeBloques(5, 16 * 60, C)).toEqual([960, 990, 1020, 1050, 1090]);
    expect(inicioEstudio(15 * 60 + 10, null)).toBe(15 * 60 + 30);
    expect(inicioEstudio(10 * 60, 14 * 60)).toBe(14 * 60 + 30);
    expect(inicioEstudio(23 * 60, null)).toBeNull();
  });

  it('el estado de un tema rota con un toque', () => {
    expect(siguienteEstado('pendiente')).toBe('repasando');
    expect(siguienteEstado('repasando')).toBe('dominado');
    expect(siguienteEstado('dominado')).toBe('pendiente');
  });
});

describe('notas y media', () => {
  it('media simple sobre 10', () => {
    expect(media([{ nota: 8, sobre: 10, peso: null }, { nota: 6, sobre: 10, peso: null }, { nota: 15, sobre: 20, peso: null }])).toEqual({
      media: 7.17,
      ponderada: false,
      pesoEvaluado: 0,
      sinPeso: 0,
    });
  });
  it('ponderada con pesos; las sin peso se reparten lo que falta', () => {
    expect(media([{ nota: 9, sobre: 10, peso: 30 }, { nota: 5, sobre: 10, peso: 20 }]).media).toBe(7.4);
    const m = media([{ nota: 9, sobre: 10, peso: 30 }, { nota: 5, sobre: 10, peso: null }]);
    expect(m).toMatchObject({ ponderada: true, pesoEvaluado: 100, media: 6.2 });
    const lleno = media([{ nota: 9, sobre: 10, peso: 100 }, { nota: 1, sobre: 10, peso: null }]);
    expect(lleno).toMatchObject({ media: 9, sinPeso: 1 });
  });
  it('ignora notas imposibles', () => {
    expect(media([{ nota: 12, sobre: 10, peso: null }]).media).toBeNull();
    expect(media([]).media).toBeNull();
  });
  it('qué nota hace falta en lo que queda', () => {
    expect(notaNecesaria([{ nota: 4, sobre: 10, peso: 40 }], 5)).toEqual({ tipo: 'necesaria', necesaria: 5.67 });
    expect(notaNecesaria([{ nota: 10, sobre: 10, peso: 60 }], 5)).toEqual({ tipo: 'asegurado' });
    expect(notaNecesaria([{ nota: 0, sobre: 10, peso: 70 }], 5).tipo).toBe('imposible');
    expect(notaNecesaria([{ nota: 7, sobre: 10, peso: null }], 5)).toEqual({ tipo: 'sin_datos' });
  });
  it('media global, formato y lectura', () => {
    expect(mediaGlobal([7, null, 8.5])).toBe(7.75);
    expect(mediaGlobal([null])).toBeNull();
    expect(formatoNota(7.25)).toBe('7,25');
    expect(formatoNota(7.5)).toBe('7,5');
    expect(formatoNota(8)).toBe('8');
    expect(formatoNota(null)).toBe('-');
    expect(leerNumero('7,5')).toBe(7.5);
    expect(leerNumero('abc')).toBeNull();
  });
});

describe('horario de clases y horas de estudio', () => {
  const h = [
    { id: '1', asignaturaId: 'a', dia: 1, inicio: 9 * 60, fin: 11 * 60 },
    { id: '2', asignaturaId: 'b', dia: 1, inicio: 12 * 60, fin: 14 * 60 },
    { id: '3', asignaturaId: 'a', dia: 3, inicio: 10 * 60, fin: 12 * 60 },
  ];
  it('clases del día, solapes y validación', () => {
    expect(clasesDelDia(h, 1).map((c) => c.id)).toEqual(['1', '2']);
    expect(solapes(h, { dia: 1, inicio: 10 * 60, fin: 12 * 60 + 30 }).map((c) => c.id)).toEqual(['1', '2']);
    expect(solapes(h, { dia: 1, inicio: 11 * 60, fin: 12 * 60 })).toEqual([]);
    expect(errorDeClase({ dia: 8, inicio: 0, fin: 10 })).toBe('dia');
    expect(errorDeClase({ dia: 1, inicio: 600, fin: 600 })).toBe('horas');
    expect(finUltimaClase(h, 1)).toBe(14 * 60);
    expect(finUltimaClase(h, 2)).toBeNull();
  });
  it('siguiente clase: en curso, más tarde o dando la vuelta a la semana', () => {
    expect(siguienteClase(h, { dia: 1, min: 10 * 60 })).toMatchObject({ clase: { id: '1' }, enCurso: true, enDias: 0 });
    expect(siguienteClase(h, { dia: 1, min: 11 * 60 + 30 })).toMatchObject({ clase: { id: '2' }, enCurso: false });
    expect(siguienteClase(h, { dia: 4, min: 0 })).toMatchObject({ clase: { id: '1' }, enDias: 4 });
    expect(siguienteClase([], { dia: 1, min: 0 })).toBeNull();
  });
  it('minutos por asignatura en la semana y días seguidos', () => {
    const s = [
      { asignaturaId: 'a', fecha: '2026-10-19', minutos: 25 },
      { asignaturaId: 'a', fecha: '2026-10-21', minutos: 25 },
      { asignaturaId: null, fecha: '2026-10-20', minutos: 25 },
      { asignaturaId: 'b', fecha: '2026-10-18', minutos: 50 },
    ];
    const m = minutosSemana(s, '2026-10-21');
    expect(m.get('a')).toBe(50);
    expect(m.get(null)).toBe(25);
    expect(m.has('b')).toBe(false);
    expect(diasSeguidos(s, '2026-10-21')).toBe(4);
    expect(diasSeguidos(s, '2026-10-23')).toBe(0);
  });
});

describe('misión que paga el bloque (un solo gesto)', () => {
  const ms = [
    { id: '1', titulo: 'Leer 20 páginas', hecha: false },
    { id: '2', titulo: 'Repasar Cálculo II', hecha: false },
    { id: '3', titulo: 'Estructuras: árboles', hecha: true },
    { id: '4', titulo: 'Penalización', hecha: false, penalizacion: true },
  ];
  it('propone la que nombra la asignatura, sin tildes', () => {
    expect(misionPropuesta(ms, 'calculo ii')?.id).toBe('2');
    expect(misionPropuesta(ms, 'Historia')?.id).toBe('1');
    expect(misionPropuesta([ms[2]!, ms[3]!], 'Estructuras')).toBeNull();
    expect(enlazables(ms).map((m) => m.id)).toEqual(['1', '2']);
  });
  it('solo un bloque completo con misión paga', () => {
    expect(cumpleMision({ minutos: 25 }, 'm')).toBe(true);
    expect(cumpleMision(null, 'm')).toBe(false);
    expect(cumpleMision({ minutos: 25 }, null)).toBe(false);
  });
});

describe('métodos de estudio', () => {
  it('siete métodos con pasos y acción', () => {
    expect(METODOS.map((m) => m.id)).toEqual(['recuerdo', 'espaciada', 'feynman', 'flashcards', 'mapas', 'anteriores', 'pomodoro']);
    expect(metodoPorId('feynman')?.accion).toBe('bloque');
    expect(metodoPorId('x')).toBeNull();
  });
});
