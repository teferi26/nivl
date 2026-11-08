// NIVL · FOCUS: pomodoro v2, misiones por minutos, cierre de bloque y módulos nuevos.
import { hayQueArrancar, pasosQueFaltan, PLANTILLAS } from '@/focus/arranque';
import { cierreBloque } from '@/focus/cierreBloque';
import { estadisticasDe } from '@/focus/estadisticas';
import { sumarDias } from '@/focus/fechas';
import { huecoDe, TOPE_REPASOS_HUECO } from '@/focus/hueco';
import { tarjetasDesdeTexto, temasDesdeTexto } from '@/focus/importar';
import { minutosObjetivo, misionesCumplidas } from '@/focus/mision';
import { CONFIG_POR_DEFECTO, ESTADO_INICIAL, OBJETIVO_LIBRE, arrancar, cerrarFase, fechaLocal, marcarSalida, marcarVuelta, normalizarEstado, progreso } from '@/focus/pomodoro';
import { minutosDeTanda, sesionesDeTanda } from '@/focus/repaso';
import { notasPorAsignatura } from '@/focus/resumen';
import { semanaDe } from '@/focus/semana';
import { evolucionSimulacros, leerPenalizacion, resultadoSimulacroTest } from '@/focus/simulacroTest';
import { DATOS_VACIOS, PREFS_POR_DEFECTO, normalizarPrefs, type DatosFocus, type Examen, type Sesion, type Tema } from '@/focus/tipos';

const C = CONFIG_POR_DEFECTO;
const MIN = 60_000;
const LUNES = '2026-11-09';
const asig = (id: string, nombre = id, extra = {}) => ({ id, nombre, posicion: 0, notaObjetivo: null, vuelta: 1, ...extra });
const ex = (id: string, asignaturaId: string, fecha: string | null, extra: Partial<Examen> = {}): Examen => ({
  id, asignaturaId, titulo: id, fecha, peso: null, hora: null, tipo: 'examen', estimada: false, hechaEl: null, ...extra,
});
const ses = (fecha: string, minutos: number, asignaturaId: string | null = null, extra: Partial<Sesion> = {}): Sesion => ({
  id: `${fecha}-${minutos}-${asignaturaId}`, asignaturaId, temaId: null, fecha, minutos, metodo: 'pomodoro', salidas: 0, ...extra,
});
const tema = (id: string, asignaturaId: string, extra: Partial<Tema> = {}): Tema => ({
  id, asignaturaId, examenId: null, nombre: id, estado: 'pendiente', posicion: 0, etapa: 0, repasoEl: null, seccion: null, repasadoEl: null, ...extra,
});

describe('pomodoro v2', () => {
  it('minutos y fecha quedan fijados al arrancar', () => {
    const t0 = new Date(2026, 10, 9, 23, 50).getTime();
    const e = arrancar(ESTADO_INICIAL, C, t0);
    expect(e).toMatchObject({ minutosFase: 25, fechaInicio: '2026-11-09' });
    // Cambia los ajustes a 50 y lo cierra mañana: cuenta 25 min y el día en que arrancó.
    const c2 = { ...C, foco: 50 };
    const fin = cerrarFase(e, c2, t0 + 24 * 60 * MIN);
    expect(fin.focoCompleto).toMatchObject({ minutos: 25, fecha: '2026-11-09' });
    expect(progreso(e, c2, t0 + 12.5 * MIN)).toBeCloseTo(0.5);
  });

  it('el objetivo se limpia al cerrar un foco, también saltado', () => {
    const e = arrancar(ESTADO_INICIAL, C, 0, { asignaturaId: 'a', temaId: 't', misionId: 'm' });
    expect(cerrarFase(e, C, 26 * MIN).estado.objetivo).toEqual(OBJETIVO_LIBRE);
    expect(cerrarFase(e, C, 5 * MIN, true).estado.objetivo).toEqual(OBJETIVO_LIBRE);
    expect(cerrarFase(e, C, 26 * MIN).focoCompleto?.objetivo.temaId).toBe('t');
  });

  it('elegir tema en el descanso no se pierde al cerrarlo', () => {
    const e = { ...arrancar({ ...ESTADO_INICIAL, fase: 'descanso' }, C, 0), objetivo: { asignaturaId: 'a', temaId: 't', misionId: null } };
    expect(cerrarFase(e, C, 6 * MIN).estado.objetivo.temaId).toBe('t');
  });

  it('encadenar fuera de la app no infla: se cierra una fase como mucho', () => {
    const c = { ...C, encadenar: true };
    const e = arrancar(ESTADO_INICIAL, c, 0);
    const cinco = 5 * 60 * MIN;
    const r = cerrarFase(e, c, cinco);
    expect(r.focoCompleto?.minutos).toBe(25);
    expect(r.estado.finEn).toBeNull();
    expect(r.estado.fase).toBe('descanso');
    // Con la app delante sí encadena.
    const vivo = cerrarFase(e, c, 25 * MIN + 1000);
    expect(vivo.estado.finEn).toBe(30 * MIN);
    expect(vivo.estado.minutosFase).toBe(5);
  });

  it('salidas: solo cuentan las de 3 s o más y nunca más allá del fin', () => {
    let e = arrancar(ESTADO_INICIAL, C, 0);
    e = marcarVuelta(marcarSalida(e, MIN), MIN + 2000);
    expect(e.salidas).toBe(0);
    e = marcarVuelta(marcarSalida(e, 2 * MIN), 3 * MIN);
    expect(e).toMatchObject({ salidas: 1, fueraMs: MIN, salioEn: null });
    const fuera = marcarSalida(e, 20 * MIN);
    expect(cerrarFase(fuera, C, 90 * MIN).focoCompleto).toMatchObject({ salidas: 2, fueraMs: 6 * MIN });
    expect(marcarSalida(ESTADO_INICIAL, 0)).toBe(ESTADO_INICIAL);
  });

  it('un estado guardado antiguo sigue valiendo', () => {
    expect(normalizarEstado({ fase: 'foco', finEn: 5 }, C)).toMatchObject({ minutosFase: null, fechaInicio: null, salidas: 0, fueraMs: 0, salioEn: null });
  });

  it('fecha local', () => {
    expect(fechaLocal(new Date(2026, 0, 2, 1, 0).getTime())).toBe('2026-01-02');
  });
});

describe('misiones por minutos reales', () => {
  it('lee los minutos del título', () => {
    expect([
      'Estudiar 2 h', 'Estudiar 1h30', 'Estudiar 1 h 30 min', 'Estudiar 1,5 h', 'Repasar apuntes 20 min', '90 minutos de historia', '3 pomodoros', 'Estudiar', 'Estudiar 2 horas',
    ].map(minutosObjetivo)).toEqual([120, 90, 90, 90, 20, 90, 75, 25, 120]);
  });

  const ms = [
    { id: 'dos', titulo: 'Estudiar 2 h', hecha: false },
    { id: 'rep', titulo: 'Repasar apuntes 20 min', hecha: false },
    { id: 'fis', titulo: 'Física 50 min', hecha: false },
  ];
  const as = [asig('f', 'Física')];

  it('un bloque de 5 min no paga nada, ni «Estudiar 2 h»', () => {
    expect(misionesCumplidas(ms, [{ asignaturaId: null, minutos: 5 }], as)).toEqual([]);
  });
  it('un bloque de 25 cubre solo la de 20', () => {
    expect(misionesCumplidas(ms, [{ asignaturaId: null, minutos: 25 }], as)).toEqual(['rep']);
  });
  it('dos bloques de Física pagan la de Física y no más', () => {
    expect(misionesCumplidas(ms, [{ asignaturaId: 'f', minutos: 25 }, { asignaturaId: 'f', minutos: 25 }], as)).toEqual(['fis']);
  });
  it('ocho bloques las pagan todas', () => {
    expect(misionesCumplidas(ms, Array.from({ length: 8 }, () => ({ asignaturaId: 'f', minutos: 25 })), as).sort()).toEqual(['dos', 'fis', 'rep']);
  });
  it('los minutos de una misión ya hecha no se reutilizan', () => {
    const conHecha = [{ id: 'h', titulo: 'Estudiar 50 min', hecha: true }, { id: 'n', titulo: 'Repasar 30 min', hecha: false }];
    expect(misionesCumplidas(conHecha, [{ asignaturaId: null, minutos: 60 }], as)).toEqual([]);
  });
  it('las penalizaciones no se pagan estudiando', () => {
    expect(misionesCumplidas([{ id: 'p', titulo: 'Estudiar', hecha: false, penalizacion: true }], [{ asignaturaId: null, minutos: 90 }], as)).toEqual([]);
  });
});

describe('tanda de repaso', () => {
  it('minutos reales con tope por ítem', () => {
    expect(minutosDeTanda(45 * MIN, 3, 1)).toBe(16);
    expect(minutosDeTanda(5 * MIN, 3, 1)).toBe(5);
    expect(minutosDeTanda(1000, 1, 0)).toBe(1);
    expect(minutosDeTanda(MIN, 0, 0)).toBe(0);
  });
  it('una sesión por método, con asignatura solo si es una', () => {
    expect(sesionesDeTanda({ msReales: 12 * MIN, tarjetas: ['a', 'a'], temas: ['b'] })).toEqual([
      { sufijo: 'flashcards', metodo: 'flashcards', asignaturaId: 'a', minutos: 3 },
      { sufijo: 'espaciada', metodo: 'espaciada', asignaturaId: 'b', minutos: 9 },
    ]);
    expect(sesionesDeTanda({ msReales: MIN, tarjetas: [], temas: ['a', 'b'] })).toEqual([{ sufijo: 'espaciada', metodo: 'espaciada', asignaturaId: null, minutos: 1 }]);
    expect(sesionesDeTanda({ msReales: MIN, tarjetas: [], temas: [] })).toEqual([]);
  });
});

describe('cierre de bloque', () => {
  const nuevo = { estado: 'pendiente' as const, etapa: 0, repasoEl: null };
  it('sin acabar: nada cambia', () => {
    expect(cierreBloque(nuevo, 'sin_acabar', LUNES)).toBeNull();
  });
  it('primera vez: lo repaso arranca mañana; lo domino, a tres días', () => {
    expect(cierreBloque(nuevo, 'lo_repaso', LUNES)).toEqual({ estado: 'repasando', etapa: 0, repasoEl: sumarDias(LUNES, 1) });
    expect(cierreBloque(nuevo, 'lo_domino', LUNES)).toEqual({ estado: 'dominado', etapa: 1, repasoEl: sumarDias(LUNES, 3) });
  });
  it('otra vuelta conserva el calendario', () => {
    const v2 = { estado: 'pendiente' as const, etapa: 2, repasoEl: '2026-12-01' };
    expect(cierreBloque(v2, 'lo_repaso', LUNES)).toEqual({ estado: 'repasando', etapa: 2, repasoEl: sumarDias(LUNES, 7) });
    expect(cierreBloque(v2, 'lo_domino', LUNES)).toEqual({ estado: 'dominado', etapa: 3, repasoEl: sumarDias(LUNES, 14) });
  });
});

describe('semana', () => {
  const d: DatosFocus = {
    ...DATOS_VACIOS,
    asignaturas: [asig('a', 'Mates')],
    clases: [{ id: 'c1', asignaturaId: 'a', dia: 1, inicio: 9 * 60, fin: 11 * 60, aula: 'A1' }, { id: 'c2', asignaturaId: 'b', dia: 1, inicio: 8 * 60, fin: 9 * 60, aula: null }],
    examenes: [
      ex('x1', 'a', LUNES, { hora: 8 * 60, titulo: 'Parcial' }),
      ex('e1', 'a', LUNES, { tipo: 'entrega', titulo: 'Práctica' }),
      ex('x2', 'a', sumarDias(LUNES, 6), { hora: 12 * 60 }),
      ex('fuera', 'a', sumarDias(LUNES, 7)),
      ex('sinFecha', 'a', null),
    ],
  };
  it('7 días con clases, exámenes y entregas por hora', () => {
    const s = semanaDe(d, LUNES);
    expect(s).toHaveLength(7);
    expect(s[0]!.items.map((i) => [i.tipo, i.titulo])).toEqual([['examen', 'Parcial'], ['clase', 'Mates'], ['entrega', 'Práctica']]);
    expect(s[6]!.items.map((i) => i.id)).toEqual(['x2']);
    expect(s[1]!.items).toEqual([]);
  });
  it('en época sin clases no pinta clases', () => {
    const s = semanaDe({ ...d, prefs: { ...PREFS_POR_DEFECTO, sinClasesHasta: LUNES } }, LUNES);
    expect(s[0]!.items.some((i) => i.tipo === 'clase')).toBe(false);
  });
});

describe('estadísticas', () => {
  const hoy = '2026-11-11';
  const d: DatosFocus = {
    ...DATOS_VACIOS,
    asignaturas: [asig('bd', 'BD'), asig('re', 'Redes')],
    examenes: [ex('x1', 'bd', '2026-12-01', { peso: 60 }), ex('x2', 're', '2026-12-01', { peso: 10 })],
    temas: [tema('t1', 're')],
    sesiones: [ses(hoy, 300, 're', { temaId: 't1', salidas: 2 }), ses('2026-11-10', 50, 'bd'), ses('2026-11-02', 25, 'bd'), ses('2026-10-20', 90, 'bd'), ses('2026-11-10', 25, null)],
  };
  it('semana, mes, desfase frente al peso y por tema', () => {
    const e = estadisticasDe(d, hoy);
    expect(e.porAsignatura.map((a) => [a.nombre, a.semana, a.mes])).toEqual([['Redes', 300, 300], ['BD', 50, 75]]);
    const redes = e.porAsignatura[0]!;
    expect(redes.pctPeso).toBe(14);
    expect(redes.desfase).toBeGreaterThan(50);
    expect(e.porAsignatura[1]!.desfase).toBeLessThan(-50);
    expect(e.porTema).toEqual([{ temaId: 't1', nombre: 't1', asignaturaId: 're', minutos: 300 }]);
    expect(e.libres).toEqual({ semana: 25, mes: 25 });
    expect(e.total.semana).toBe(375);
    expect(e.diasSeguidos).toBe(2);
    expect(e.salidas.semana).toBe(2);
  });
});

describe('simulacro tipo test', () => {
  it('aciertos, fallos, blancos y penalización', () => {
    expect(resultadoSimulacroTest({ aciertos: 70, fallos: 20, blancos: 10, penalizacion: 1 / 3 })).toEqual({ total: 100, neto: 63.33, nota: 6.33, porcentaje: 63.33 });
    expect(resultadoSimulacroTest({ aciertos: 5, fallos: 0, blancos: 5, penalizacion: 0 })).toMatchObject({ nota: 5 });
  });
  it('neto negativo solo si se permite', () => {
    expect(resultadoSimulacroTest({ aciertos: 1, fallos: 9, blancos: 0, penalizacion: 0.5 })).toMatchObject({ neto: 0, nota: 0 });
    expect(resultadoSimulacroTest({ aciertos: 1, fallos: 9, blancos: 0, penalizacion: 0.5, netoNegativo: true })).toMatchObject({ neto: -3.5, nota: -3.5 });
  });
  it('datos imposibles', () => {
    expect(resultadoSimulacroTest({ aciertos: 0, fallos: 0, blancos: 0, penalizacion: 0 })).toBeNull();
    expect(resultadoSimulacroTest({ aciertos: -1, fallos: 0, blancos: 3, penalizacion: 0 })).toBeNull();
    expect(resultadoSimulacroTest({ aciertos: 1, fallos: 0, blancos: 3, penalizacion: 2 })).toBeNull();
  });
  it('lee la penalización', () => {
    expect(leerPenalizacion('1/3')).toBeCloseTo(0.3333);
    expect(leerPenalizacion('0,25')).toBe(0.25);
    expect(leerPenalizacion('1/0')).toBeNull();
    expect(leerPenalizacion('5/3')).toBeNull();
    expect(leerPenalizacion('hola')).toBeNull();
  });
  it('evolución en orden', () => {
    const e = evolucionSimulacros([{ fecha: '2026-11-02', nota: 7, sobre: 10 }, { fecha: '2026-10-02', nota: 50, sobre: 100 }, { fecha: '2026-11-09', nota: 13, sobre: 20 }]);
    expect(e.puntos.map((p) => p.nota)).toEqual([5, 7, 6.5]);
    expect(e).toMatchObject({ ultima: 6.5, mejor: 7, cambio: -0.5, media: 6.17 });
    expect(evolucionSimulacros([])).toMatchObject({ ultima: null, cambio: null });
  });
});

describe('importar', () => {
  it('temas por línea con sección y recorte a 160', () => {
    const r = temasDesdeTexto(`# Bloque I\nTema 1. La Constitución\n\n- Tema 2\n## Bloque II\n${'x'.repeat(200)}`);
    expect(r.temas.map((t) => [t.nombre.slice(0, 10), t.seccion])).toEqual([['Tema 1. La', 'Bloque I'], ['Tema 2', 'Bloque I'], ['xxxxxxxxxx', 'Bloque II']]);
    expect(r.temas[2]!.nombre).toHaveLength(160);
    expect(r.recortados).toBe(1);
  });
  it('70 temas pegados entran todos', () => {
    expect(temasDesdeTexto(Array.from({ length: 70 }, (_, i) => `Tema ${i + 1}`).join('\r\n')).temas).toHaveLength(70);
  });
  it('tarjetas con barra, tabulador o punto y coma', () => {
    const r = tarjetasDesdeTexto('Art. 1 | Soberanía\nArt. 2\tAutonomía\nArt. 3 ; Lengua\nsin separador\n | sin pregunta');
    expect(r.tarjetas).toEqual([{ anverso: 'Art. 1', reverso: 'Soberanía' }, { anverso: 'Art. 2', reverso: 'Autonomía' }, { anverso: 'Art. 3', reverso: 'Lengua' }]);
    expect(r.descartadas).toBe(2);
  });
});

describe('volver tras un hueco', () => {
  const base: DatosFocus = {
    ...DATOS_VACIOS,
    asignaturas: [asig('a'), asig('b')],
    examenes: [ex('cerca', 'b', sumarDias(LUNES, 5)), ex('paso', 'a', sumarDias(LUNES, -1), { tipo: 'entrega' })],
    temas: [tema('fragil', 'a', { repasoEl: sumarDias(LUNES, -3), etapa: 0 }), tema('solido', 'a', { repasoEl: sumarDias(LUNES, -3), etapa: 3 }), tema('urge', 'b', { repasoEl: sumarDias(LUNES, -1), etapa: 3 })],
    tarjetas: [{ id: 'c', mazoId: 'm', anverso: 'q', reverso: 'r', etapa: 0, vence: LUNES }],
    sesiones: [ses(sumarDias(LUNES, -3), 25)],
  };
  it('sin sesiones o con una reciente no hay hueco', () => {
    expect(huecoDe(DATOS_VACIOS, LUNES)).toBeNull();
    expect(huecoDe({ ...base, sesiones: [ses(sumarDias(LUNES, -1), 25)] }, LUNES)).toBeNull();
  });
  it('dice qué pasó y prioriza los repasos', () => {
    const h = huecoDe(base, LUNES)!;
    expect(h).toMatchObject({ dias: 3, repasosVencidos: 3, tarjetasVencidas: 1 });
    expect(h.pasaron.map((x) => x.id)).toEqual(['paso']);
    expect(h.repasos.map((t) => t.id)).toEqual(['urge', 'fragil', 'solido']);
  });
  it('con tope', () => {
    const muchos = Array.from({ length: 30 }, (_, i) => tema(`t${i}`, 'a', { repasoEl: sumarDias(LUNES, -2) }));
    expect(huecoDe({ ...base, temas: muchos }, LUNES)!.repasos).toHaveLength(TOPE_REPASOS_HUECO);
  });
});

describe('arranque', () => {
  it('pasos que faltan, en orden', () => {
    expect(pasosQueFaltan(DATOS_VACIOS)).toEqual(['perfil', 'asignaturas', 'temario', 'examen']);
    const d = { ...DATOS_VACIOS, prefs: { ...PREFS_POR_DEFECTO, perfil: 'instituto' as const }, asignaturas: [asig('a')] };
    expect(pasosQueFaltan(d)).toEqual(['temario', 'examen', 'horario']);
    const opo = { ...d, prefs: { ...d.prefs, perfil: 'oposicion' as const }, temas: [tema('t', 'a')], examenes: [ex('x', 'a', null)] };
    expect(pasosQueFaltan(opo)).toEqual([]);
  });
  it('una entrega no cuenta como examen', () => {
    const d = { ...DATOS_VACIOS, examenes: [ex('e', 'a', LUNES, { tipo: 'entrega' })] };
    expect(pasosQueFaltan(d)).toContain('examen');
  });
  it('plantillas y cuándo enseñar el arranque', () => {
    expect(PLANTILLAS.instituto.asignaturas).toHaveLength(8);
    expect(PLANTILLAS.oposicion.minutosDia).toBe(300);
    expect(hayQueArrancar(DATOS_VACIOS)).toBe(true);
    expect(hayQueArrancar({ ...DATOS_VACIOS, prefs: { ...PREFS_POR_DEFECTO, arranqueHecho: true } })).toBe(false);
    expect(hayQueArrancar({ ...DATOS_VACIOS, asignaturas: [asig('a')] })).toBe(false);
  });
});

describe('preferencias y objetivo', () => {
  it('normaliza lo que venga', () => {
    expect(normalizarPrefs(null)).toEqual(PREFS_POR_DEFECTO);
    expect(normalizarPrefs({ perfil: 'marciano', minutosDia: 99999, sinClasesHasta: 'ayer', arranqueHecho: 'si' })).toEqual({ ...PREFS_POR_DEFECTO, minutosDia: 900 });
    expect(normalizarPrefs({ perfil: 'oposicion', minutosDia: 300, sinClasesHasta: '2027-02-01', arranqueHecho: true })).toEqual({ perfil: 'oposicion', minutosDia: 300, sinClasesHasta: '2027-02-01', arranqueHecho: true });
  });
  it('la nota necesaria usa el objetivo de la asignatura', () => {
    const d: DatosFocus = {
      ...DATOS_VACIOS,
      asignaturas: [asig('a', 'Bio', { notaObjetivo: 9 })],
      notas: [{ id: 'n', asignaturaId: 'a', titulo: 'C', nota: 9, sobre: 10, peso: 40, fecha: LUNES }],
    };
    expect(notasPorAsignatura(d)[0]).toMatchObject({ objetivo: 9, necesaria: { tipo: 'necesaria', necesaria: 9 } });
  });
});
