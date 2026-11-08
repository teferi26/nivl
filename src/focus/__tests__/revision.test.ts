// NIVL · FOCUS: regresiones de la revisión adversarial (minutos, plan, cola, archivadas).
import { fraseCoach, type EntradaCoach } from '@/components/focus/vistaHoy';
import { esSimulacro } from '@/focus/agenda';
import { COLA_VACIA, TOPE_COLA, anadirACola, esRechazoDefinitivo, esReferenciaPerdida, normalizarCola, vaciarCola } from '@/focus/colaSesiones';
import type { NuevaSesion } from '@/focus/datos';
import { sumarDias } from '@/focus/fechas';
import { huecoDe } from '@/focus/hueco';
import { enlazables, esSesionDictada, minutosObjetivo, misionPropuesta, misionesCumplidas, reglaCubierta } from '@/focus/mision';
import { planDelDia, type EntradaDia, type ExamenParaDia, type TemaParaPlan } from '@/focus/planEstudio';
import { CONFIG_POR_DEFECTO, ESTADO_INICIAL, cerrarFase, normalizarEstado, type ConfigPomodoro, type EstadoPomodoro } from '@/focus/pomodoro';
import { examenesPasados, notasPorAsignatura, planDeExamen, planDeHoyCompleto, type ExamenVista, type PlanHoy } from '@/focus/resumen';
import { DATOS_VACIOS, PREFS_POR_DEFECTO, type DatosFocus, type Examen, type Tema } from '@/focus/tipos';

const HOY = '2026-11-09'; // lunes
const asig = (id: string, nombre: string) => ({ id, nombre, posicion: 0, notaObjetivo: null, vuelta: 1 });

describe('minutos que pide un título', () => {
  it.each([
    ['Estudiar dos horas', 120],
    ['Estudiar una hora', 60],
    ['Study 2 hours', 120],
    ['2 Stunden lernen', 120],
    ['Étudier deux heures', 120],
    ['Studiare due ore', 120],
    ['Estudar duas horas', 120],
    ['Estudiar 1 hora y media', 90],
    ['Estudiar dos horas y media', 150],
    ['Estudiar hora y media', 90],
    ['An hour and a half of study', 90],
    ['Estudiar media hora', 30],
    ['Half an hour of reading', 30],
    ['Estudiar 1 hora y 20 minutos', 80],
    ['Estudiar cuarenta y cinco minutos', 45],
    ['tres pomodoros', 75],
    ['Estudiar 1h30', 90],
    ['Estudiar 1 h 30', 90],
    ['Estudiar 2 h 3 temas', 120],
    ['Lernen 50 Min', 50],
    ['Estudiar', 25],
  ])('%s → %i', (titulo, min) => expect(minutosObjetivo(titulo)).toBe(min));

  it('«0 min» no se paga sin estudiar', () => {
    expect(minutosObjetivo('Estudiar 0 min')).toBe(25);
    expect(misionesCumplidas([{ id: 'a', titulo: 'Estudiar 0 min', hecha: false }], [], [])).toEqual([]);
  });
});

describe('misiones y reglas', () => {
  const mates = asig('m', 'Mates');
  it('«la parte 2» no nombra Arte', () => {
    const ms = [{ id: 'p', titulo: 'Estudiar la parte 2', hecha: false }];
    expect(misionesCumplidas(ms, [{ asignaturaId: 'x', minutos: 25 }], [asig('art', 'Arte'), asig('x', 'Historia')])).toEqual(['p']);
    expect(misionPropuesta([{ id: 'p', titulo: 'Ordenar la parte 2', hecha: false }], 'Arte')).toBeNull();
  });

  it('el orden de las sesiones no cambia lo pagado', () => {
    const ms = [
      { id: 'hecha', titulo: 'Estudiar 25 min', hecha: true },
      { id: 'mates', titulo: 'Mates 25 min', hecha: false },
    ];
    const a = { asignaturaId: 'm', minutos: 25 };
    const b = { asignaturaId: 'z', minutos: 25 };
    const as = [mates, asig('z', 'Latín')];
    expect(misionesCumplidas(ms, [a, b], as)).toEqual(['mates']);
    expect(misionesCumplidas(ms, [b, a], as)).toEqual(['mates']);
  });

  it('una regla pide sus minutos', () => {
    expect(reglaCubierta('Estudiar 2 horas cada dia', [{ asignaturaId: null, minutos: 1 }], [])).toBe(false);
    expect(reglaCubierta('Estudiar 2 horas cada dia', [{ asignaturaId: null, minutos: 70 }, { asignaturaId: 'm', minutos: 50 }], [mates])).toBe(true);
    expect(reglaCubierta('Estudiar Mates 1 hora', [{ asignaturaId: null, minutos: 90 }], [mates])).toBe(false);
  });

  it('lo dictado al coach no paga', () => {
    expect(esSesionDictada('coach-2026-11-09-libre-120-1')).toBe(true);
    expect(esSesionDictada('foco-1-99')).toBe(false);
    expect(esSesionDictada(null)).toBe(false);
  });

  it('una misión de otro acto no se ofrece, y «Leer» no se adjunta sola', () => {
    const ms = [
      { id: 'gym', titulo: 'Ir al gimnasio', hecha: false, link: 'gym' },
      { id: 'leer', titulo: 'Leer 20 páginas', hecha: false, link: 'ninguno' },
      { id: 'en', titulo: 'Study 50 min', hecha: false, link: 'estudio' },
    ];
    expect(enlazables(ms).map((m) => m.id)).toEqual(['leer', 'en']);
    expect(misionPropuesta(ms, null)?.id).toBe('en');
    expect(misionPropuesta([ms[0]!, ms[1]!], null)).toBeNull();
  });

  it('en General no se ofrece lo etiquetado para otro modo', () => {
    const ms = [
      { id: 'work', titulo: 'Enviar propuesta', hecha: false, modos: ['work'] },
      { id: 'foco', titulo: 'Estudiar', hecha: false, modos: ['focus'] },
      { id: 'libre', titulo: 'Leer', hecha: false, modos: [] },
    ];
    expect(enlazables(ms).map((m) => m.id)).toEqual(['foco', 'libre']);
  });
});

describe('pomodoro encadenado', () => {
  const C: ConfigPomodoro = { ...CONFIG_POR_DEFECTO, encadenar: true };
  const fin = 1_000_000_000_000;
  const foco: EstadoPomodoro = {
    ...ESTADO_INICIAL,
    finEn: fin,
    idFase: 'foco-1-1',
    minutosFase: 25,
    fechaInicio: HOY,
    objetivo: { asignaturaId: 'h', temaId: 't1', misionId: 'q', simulacro: true },
  };

  it('el segundo bloque sigue con el objetivo, sin heredar el simulacro', () => {
    const descanso = cerrarFase(foco, C, fin);
    expect(descanso.focoCompleto?.objetivo.asignaturaId).toBe('h');
    expect(descanso.estado.objetivo).toEqual({ asignaturaId: 'h', temaId: 't1', misionId: 'q' });
    const segundo = cerrarFase(descanso.estado, C, descanso.estado.finEn as number);
    expect(segundo.estado.fase).toBe('foco');
    expect(segundo.estado.objetivo).toEqual({ asignaturaId: 'h', temaId: 't1', misionId: 'q' });
  });

  it('si la cadena no sigue (volvió tarde), objetivo limpio', () => {
    const r = cerrarFase(foco, C, fin + 60 * 60_000);
    expect(r.estado.finEn).toBeNull();
    expect(r.estado.objetivo).toEqual({ asignaturaId: null, temaId: null, misionId: null });
  });

  it('el simulacro sobrevive a un cierre de la app', () => {
    expect(normalizarEstado(foco, C).objetivo.simulacro).toBe(true);
    expect('simulacro' in normalizarEstado({ ...foco, objetivo: { asignaturaId: 'h' } }, C).objetivo).toBe(false);
  });
});

const temas = (n: number, estado: TemaParaPlan['estado'] = 'pendiente'): TemaParaPlan[] => Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, estado }));
const frente = (fecha: string | null, ts: TemaParaPlan[], extra: Partial<ExamenParaDia> = {}): ExamenParaDia => ({
  id: 'x',
  asignaturaId: 'a',
  titulo: 'X',
  fecha,
  hora: null,
  tipo: 'examen',
  estimada: false,
  peso: null,
  temas: ts,
  ...extra,
});
const dia = (x: Partial<EntradaDia>): EntradaDia => ({ hoy: HOY, desdeMin: 600, minutosDia: 120, minutosBloque: 50, ritmo: { foco: 25, descanso: 5 }, examenes: [], repasos: [], ...x });

describe('sin plan: nunca «al día» si no es verdad', () => {
  it('examen hoy sin hora', () => {
    expect(planDelDia(dia({ examenes: [frente(HOY, temas(3))] })).sinPlan).toBe('examen_hoy');
  });
  it('nada de «al día» con el aviso de no llegas', () => {
    const p = planDelDia(dia({ examenes: [frente(HOY, temas(2), { hora: 640 })] }));
    expect(p.bloques).toHaveLength(0);
    expect(p.avisoNoLlegas).toBe(true);
    expect(p.sinPlan).toBe('no_cabe');
  });
  it('menos de 20 min libres con temas pendientes', () => {
    expect(planDelDia(dia({ minutosDia: 15, examenes: [frente(sumarDias(HOY, 30), temas(3))] })).sinPlan).toBe('poco_tiempo');
  });
  it('una entrega pasada no pide temario', () => {
    expect(planDelDia(dia({ examenes: [frente(sumarDias(HOY, -2), [], { tipo: 'entrega' })] })).sinPlan).toBe('atraso_entrega');
    expect(planDelDia(dia({ examenes: [frente(sumarDias(HOY, 9), [], { tipo: 'entrega' })] })).sinPlan).toBe('nada_que_planificar');
  });
  it('al día de verdad sigue siendo al día', () => {
    expect(planDelDia(dia({ examenes: [frente(sumarDias(HOY, 9), temas(2, 'dominado'))] })).sinPlan).toBe('al_dia');
  });
});

describe('tras una vuelta', () => {
  it('un tema no sale a la vez en estudiar y en fuera', () => {
    const ts = temas(12).map((t) => ({ ...t, repasoEl: sumarDias(HOY, -1), etapa: 2 }));
    const p = planDelDia(dia({ minutosDia: 300, desdeMin: null, examenes: [frente(null, ts)], repasos: ts.map((t) => ({ id: t.id, asignaturaId: 'a', vence: t.repasoEl })) }));
    const dentro = new Set(p.bloques.map((b) => b.temaId));
    expect(p.fuera.filter((b) => dentro.has(b.temaId))).toEqual([]);
    expect(new Set(p.fuera.map((b) => b.temaId)).size).toBe(p.fuera.length);
  });
});

const tema = (id: string, asignaturaId: string, c: Partial<Tema> = {}): Tema => ({ id, asignaturaId, examenId: null, nombre: id, estado: 'pendiente', posicion: 0, etapa: 0, repasoEl: null, seccion: null, repasadoEl: null, ...c });
const examen = (id: string, asignaturaId: string, fecha: string | null, c: Partial<Examen> = {}): Examen => ({ id, asignaturaId, titulo: id, fecha, peso: null, hora: null, tipo: 'examen', estimada: false, hechaEl: null, ...c });
const base = (c: Partial<DatosFocus>): DatosFocus => ({ ...DATOS_VACIOS, prefs: { ...PREFS_POR_DEFECTO, minutosDia: 100 }, asignaturas: [asig('a', 'Mates')], ...c });
const sesion = (minutos: number, metodo: string | null, asignaturaId = 'a') => ({ id: `s${minutos}`, asignaturaId, temaId: null, fecha: HOY, minutos, metodo, salidas: 0 });

describe('la hoja del examen casa con Hoy', () => {
  const C = CONFIG_POR_DEFECTO;
  const hoyDe = (d: DatosFocus, x: Examen) => planDeHoyCompleto(d, HOY, 600, C).bloques.filter((b) => b.examenId === x.id).map((b) => [b.tipo, b.temaId]);
  const hojaDe = (d: DatosFocus, x: Examen) => (planDeExamen(d, x, HOY, C, 600).find((f) => f.fecha === HOY)?.items ?? []).map((i) => [i.tipo, i.temaId]);

  it('con el cupo cubierto no promete nada hoy', () => {
    const x = examen('x', 'a', sumarDias(HOY, 5));
    const d = base({ examenes: [x], temas: [tema('t1', 'a'), tema('t2', 'a')], sesiones: [sesion(100, 'pomodoro')] });
    expect(hoyDe(d, x)).toEqual([]);
    expect(hojaDe(d, x)).toEqual([]);
  });

  it('víspera con el simulacro hecho: no lo vuelve a prometer', () => {
    const x = examen('x', 'a', sumarDias(HOY, 1));
    const d = base({ examenes: [x], temas: [tema('t1', 'a')], sesiones: [sesion(20, 'anteriores')] });
    expect(hoyDe(d, x).map(([t]) => t)).toEqual(['estudiar']);
    expect(hojaDe(d, x)).toEqual(hoyDe(d, x));
  });

  it('las tarjetas de hoy también restan en la hoja', () => {
    const x = examen('x', 'a', sumarDias(HOY, 5));
    const d = base({
      examenes: [x],
      temas: Array.from({ length: 4 }, (_, i) => tema(`t${i}`, 'a')),
      tarjetas: Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, mazoId: 'z', anverso: 'a', reverso: 'b', etapa: 0, vence: HOY })),
    });
    expect(hojaDe(d, x)).toEqual(hoyDe(d, x));
  });
});

describe('asignaturas archivadas', () => {
  const clase = (asignaturaId: string, fin: number) => ({ id: `c${asignaturaId}`, asignaturaId, dia: 1, inicio: fin - 60, fin, aula: null });

  it('una clase archivada no retrasa el inicio', () => {
    const d = base({ temas: [tema('t1', 'a')], clases: [clase('archivada', 20 * 60)] });
    expect(planDeHoyCompleto(d, HOY, 600, CONFIG_POR_DEFECTO).bloques[0]?.hora).toBe(600);
  });
  it('un examen pasado de una archivada no aparece', () => {
    const d = base({ examenes: [examen('v', 'a', sumarDias(HOY, -3)), examen('z', 'archivada', sumarDias(HOY, -2))] });
    expect(examenesPasados(d, HOY).map((x) => x.id)).toEqual(['v']);
  });
  it('el hueco no cuenta tarjetas archivadas', () => {
    const d = base({
      sesiones: [{ ...sesion(25, 'pomodoro'), fecha: sumarDias(HOY, -5) }],
      mazos: [{ id: 'z', asignaturaId: 'archivada', nombre: 'Z' }, { id: 'y', asignaturaId: 'a', nombre: 'Y' }],
      tarjetas: [
        { id: 'c1', mazoId: 'z', anverso: 'a', reverso: 'b', etapa: 0, vence: HOY },
        { id: 'c2', mazoId: 'y', anverso: 'a', reverso: 'b', etapa: 0, vence: HOY },
      ],
    });
    expect(huecoDe(d, HOY)?.tarjetasVencidas).toBe(1);
  });
});

describe('notas', () => {
  it('un simulacro no mueve la media', () => {
    const nota = (id: string, titulo: string, n: number, peso: number | null) => ({ id, asignaturaId: 'a', titulo, nota: n, sobre: 10, peso, fecha: HOY });
    const notas = [nota('1', 'Parcial', 5, null), nota('2', 'Test · Ensayo', 10, null)];
    expect(esSimulacro(notas[1]!)).toBe(true);
    const r = notasPorAsignatura(base({ notas }))[0];
    expect(r?.notas).toBe(1);
  });
});

describe('frase del coach con el examen de hoy', () => {
  const planVacio: PlanHoy = { bloques: [], fuera: [], minutosPlan: 0, minutosDisponibles: 120, avisoNoLlegas: false, sinPlan: 'examen_hoy' };
  const proximo = (hora: number | null): ExamenVista => ({ examen: { ...examen('x', 'a', HOY, { hora }), fecha: HOY }, asignatura: 'Mates', dias: 0, progreso: 0, temas: 0 });
  const coach = (e: Partial<EntradaCoach>) => fraseCoach({ sinAsignaturas: false, examenes: [], plan: planVacio, repasos: 0, ...e });

  it('no manda descansar antes de entrar si ya ha pasado', () => {
    expect(coach({ examenes: [proximo(600)], ahoraMin: 700 })).not.toMatch(/antes de entrar/);
    expect(coach({ examenes: [proximo(600)], ahoraMin: 500 })).toMatch(/antes de entrar/);
  });
  it('sin hora no da por hecho que aún no ha sido', () => {
    expect(coach({ examenes: [proximo(null)], ahoraMin: 700 })).not.toMatch(/antes de entrar/);
  });
});

describe('cola de sesiones', () => {
  const s = (id: string, c: Partial<NuevaSesion> = {}): NuevaSesion => ({ clientId: id, asignaturaId: 'a', temaId: 't', misionId: 'q', fecha: HOY, minutos: 25, metodo: 'pomodoro', ...c });
  const pg = (code: string, message = 'x') => Object.assign(new Error(message), { code });

  it('no duplica y respeta el tope', () => {
    expect(anadirACola([s('a')], [s('a'), s('b')]).map((x) => x.clientId)).toEqual(['a', 'b']);
    const muchas = Array.from({ length: TOPE_COLA + 5 }, (_, i) => s(`n${i}`));
    const r = anadirACola([], muchas);
    expect(r).toHaveLength(TOPE_COLA);
    expect(r[r.length - 1]?.clientId).toBe(`n${TOPE_COLA + 4}`);
  });

  it('lee lo guardado sin fiarse', () => {
    expect(normalizarCola('x')).toEqual(COLA_VACIA);
    expect(normalizarCola({ sesiones: [{ clientId: 1 }, s('ok')], pago: { fecha: HOY, misiones: ['q', 3] } })).toEqual({ sesiones: [{ ...s('ok'), salidas: 0 }], pago: { fecha: HOY, misiones: ['q'] } });
  });

  it('sin red para y deja el resto', async () => {
    const enviadas: string[] = [];
    const r = await vaciarCola([s('a'), s('b'), s('c')], async (x) => {
      if (x.clientId === 'b') throw new TypeError('Network request failed');
      enviadas.push(x.clientId);
    });
    expect(enviadas).toEqual(['a']);
    expect(r.quedan.map((x) => x.clientId)).toEqual(['b', 'c']);
  });

  it('reintentar es enviar otra vez lo mismo', async () => {
    let red = false;
    const enviar = async () => {
      if (!red) throw new TypeError('Network request failed');
    };
    const uno = await vaciarCola([s('a')], enviar);
    expect(uno.quedan).toHaveLength(1);
    red = true;
    const dos = await vaciarCola(uno.quedan, enviar);
    expect(dos).toMatchObject({ quedan: [], enviadas: [{ clientId: 'a' }] });
  });

  it('un tema o una misión borrados no pierden las horas', async () => {
    const llamadas: (string | null)[][] = [];
    const r = await vaciarCola([s('a')], async (x) => {
      llamadas.push([x.temaId, x.misionId, x.asignaturaId]);
      if (x.temaId) throw pg('42501', 'Tema ajeno');
    });
    expect(llamadas).toEqual([['t', 'q', 'a'], [null, null, 'a']]);
    expect(r.enviadas[0]).toMatchObject({ temaId: null, misionId: null, asignaturaId: 'a', minutos: 25 });
  });

  it('una asignatura borrada tampoco', async () => {
    const r = await vaciarCola([s('a')], async (x) => {
      if (x.asignaturaId) throw pg('42501', 'Asignatura ajena');
    });
    expect(r.enviadas[0]).toMatchObject({ asignaturaId: null });
  });

  it('un rechazo definitivo no tapona lo demás', async () => {
    const r = await vaciarCola([s('a'), s('b')], async (x) => {
      if (x.clientId === 'a') throw pg('23514');
    });
    expect(r.enviadas.map((x) => x.clientId)).toEqual(['b']);
    expect(r.quedan).toEqual([]);
  });

  it('clasifica los errores', () => {
    expect(esReferenciaPerdida(pg('23503'))).toBe(true);
    expect(esReferenciaPerdida(pg('42501', 'Misión ajena'))).toBe(true);
    expect(esReferenciaPerdida(pg('42501', 'No autenticado'))).toBe(false);
    expect(esRechazoDefinitivo(pg('23514'))).toBe(true);
    expect(esRechazoDefinitivo(pg('PGRST301'))).toBe(false);
    expect(esRechazoDefinitivo(pg('57014'))).toBe(false);
    expect(esRechazoDefinitivo(new TypeError('Network request failed'))).toBe(false);
  });
});
