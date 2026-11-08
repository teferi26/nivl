// NIVL · WORK: el núcleo puro. docs/modos/WORK.md
import { aEvento } from '@/work/adaptar';
import { AVISO_REUNION_MIN, elegirAhora, minutosLibres, queSoltar, type EntradaAhora } from '@/work/ahora';
import {
  avanzar,
  cierreDe,
  cuentaComoBloque,
  finPrevisto,
  marcaMision,
  minutosReales,
  normalizarBloque,
  nuevoBloque,
  pausar,
  reanudar,
  restanteMs,
  terminar,
  transcurridoMs,
  type EstadoBloque,
} from '@/work/bloque';
import { calcularCarga, finEvento, minutosOcupados } from '@/work/carga';
import { diaSemana, diasEntre, esFecha, fechaCorta, fechaLocal, horaAMin, lunesDe, minAHora, minutosLocal, sumarDias } from '@/work/fechas';
import { horasPorProyecto, idsPorFacturar, leerMinutos, minutosPorDia, totalHoras, facturablePorDefecto } from '@/work/horas';
import { filasDePrioridad, huecosDePrioridad, limpiarEntradas, ordenarPrioridades, prioridadesDelDia, sePuedeSoltar } from '@/work/prioridades';
import { entregasConRiesgo, entregasProximas, resumenProyecto, resumenProyectos, riesgoEntrega } from '@/work/proyectos';
import { resumenSemana, semanaARevisar, type EntradaSemana } from '@/work/semana';
import { CODIGOS_MOTIVO, type Entrega, type EventoTrabajo, type MisionTrabajo, type Proyecto, type SesionTrabajo } from '@/work/tipos';
import trabajo from '@/i18n/es/trabajo.json';

const HOY = '2026-11-09'; // lunes
const MIN = 60_000;

const mision = (id: string, o: Partial<MisionTrabajo> = {}): MisionTrabajo => ({
  id, titulo: `M ${id}`, hecha: false, penalizacion: false, xp: 50, diaPrioridad: HOY, rango: null, creadaEn: null, ...o,
});
const evento = (id: string, inicio: number | null, fin: number | null, fecha = HOY): EventoTrabajo => ({ id, titulo: `E ${id}`, fecha, inicio, fin, origen: 'manual' });
const entrega = (id: string, fecha: string | null, o: Partial<Entrega> = {}): Entrega => ({ id, proyectoId: null, titulo: `D ${id}`, fecha, hecha: false, hechaEl: null, posicion: 0, ...o });
const proyecto = (id: string, o: Partial<Proyecto> = {}): Proyecto => ({ id, nombre: `P ${id}`, cliente: null, tarifaHora: null, estado: 'activo', posicion: 0, ...o });
const sesion = (id: string, fecha: string, minutos: number, o: Partial<SesionTrabajo> = {}): SesionTrabajo => ({
  id, clientId: id, proyectoId: null, entregaId: null, questId: null, tipo: 'bloque', fecha, inicioMin: 600, minutos, facturable: false, facturadaEl: null, nota: null, ...o,
});
const entrada = (o: Partial<EntradaAhora> = {}): EntradaAhora => ({ fecha: HOY, ahoraMin: 600, misiones: [], plan: [], eventos: [], entregas: [], ...o });

describe('fechas', () => {
  it('cruza meses y años', () => {
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(diasEntre('2026-03-01', '2026-02-27')).toBe(-2);
  });
  it('el cambio de hora no mueve el calendario', () => {
    expect(sumarDias('2026-10-24', 2)).toBe('2026-10-26');
    expect(diasEntre('2026-03-28', '2026-03-30')).toBe(2);
  });
  it('la semana va de lunes a domingo', () => {
    expect(diaSemana('2026-11-09')).toBe(1);
    expect(diaSemana('2026-11-15')).toBe(7);
    expect(lunesDe('2026-11-15')).toBe('2026-11-09');
  });
  it('el día y el minuto son los locales del Date', () => {
    const d = new Date(2026, 10, 9, 0, 5);
    expect(fechaLocal(d)).toBe('2026-11-09');
    expect(minutosLocal(d)).toBe(5);
  });
  it('rechaza fechas y horas imposibles', () => {
    expect(esFecha('2026-02-30')).toBe(false);
    expect(horaAMin('25:00')).toBeNull();
    expect(horaAMin('09:30:00')).toBe(570);
    expect(minAHora(2000)).toBe('23:59');
    expect(fechaCorta('2026-03-07')).toBe('7/3');
  });
});

describe('prioridades', () => {
  it('lo pendiente antes, y lo escrito hoy antes y en su orden', () => {
    const r = ordenarPrioridades(
      [mision('a', { hecha: true, rango: 1 }), mision('b', { diaPrioridad: null, xp: 250 }), mision('c', { rango: 3 }), mision('d', { rango: 2 })],
      HOY,
    );
    expect(r.map((m) => m.id)).toEqual(['d', 'c', 'b', 'a']);
  });
  it('corta a tres y aparta las penalizaciones', () => {
    const r = prioridadesDelDia([mision('a'), mision('b'), mision('c'), mision('d'), mision('p', { penalizacion: true })], HOY);
    expect(r.visibles).toHaveLength(3);
    expect(r.resto.map((m) => m.id)).toEqual(['d']);
    expect(r.penalizaciones.map((m) => m.id)).toEqual(['p']);
    expect(r.total).toBe(4);
  });
  it('sin misiones no falla', () => {
    expect(prioridadesDelDia([], HOY)).toEqual({ visibles: [], resto: [], penalizaciones: [], hechas: 0, total: 0 });
  });
  it('limpia lo escrito: vacíos, repetidos, rayas, tope', () => {
    expect(limpiarEntradas(['  ', 'Propuesta  ACME', 'propuesta acme', 'Informé', 'Informe', 'a — b', 'sobra'])).toEqual(['Propuesta ACME', 'Informé', 'a - b']);
    expect(limpiarEntradas(['x'.repeat(500)])[0]).toHaveLength(120);
  });
  it('las filas son de WORK, de un día, con enlace ninguno (un bloque no cierra las tres)', () => {
    const f = filasDePrioridad(['Uno', 'Dos'], HOY);
    expect(f[0]).toMatchObject({ title: 'Uno', modes: ['work'], link: 'ninguno', days_of_week: [1], work_day: HOY, work_rank: 1, difficulty: 'media' });
    expect(f[1]!.work_rank).toBe(2);
  });
  it('no pasa de tres aunque ya haya escritas', () => {
    expect(filasDePrioridad(['a', 'b', 'c'], HOY, 3).map((x) => x.work_rank)).toEqual([3]);
    expect(filasDePrioridad(['a'], HOY, 4)).toEqual([]);
    expect(huecosDePrioridad([mision('a'), mision('b', { diaPrioridad: '2026-11-08' })], HOY)).toBe(2);
  });
  it('soltar sin coste solo el día en que se escribió', () => {
    expect(sePuedeSoltar(mision('a'), HOY)).toBe(true);
    expect(sePuedeSoltar(mision('a', { diaPrioridad: '2026-11-08' }), HOY)).toBe(false);
    expect(sePuedeSoltar(mision('a', { hecha: true }), HOY)).toBe(false);
  });
});

describe('bloque por hora de pared', () => {
  const T = 1_800_000_000_000;
  const b = (o: Partial<Parameters<typeof nuevoBloque>[0]> = {}): EstadoBloque =>
    nuevoBloque({ clientId: 'c1', ahora: T, fecha: HOY, inicioMin: 600, objetivoMin: 50, questId: 'q', ...o });

  it('el tiempo corre aunque nadie mire', () => {
    expect(minutosReales(b(), T + 30 * MIN)).toBe(30);
    expect(restanteMs(b(), T + 30 * MIN)).toBe(20 * MIN);
    expect(finPrevisto(b(), T + 30 * MIN)).toBe(T + 50 * MIN);
  });
  it('al volver horas después acaba en su objetivo, no en las horas', () => {
    const e = avanzar(b(), T + 8 * 60 * MIN);
    expect(e.fase).toBe('terminado');
    expect(e.cierre).toBe('objetivo');
    expect(cierreDe(e)).toMatchObject({ minutos: 50, cuenta: true, guardar: true });
  });
  it('avanzar es idempotente', () => {
    const e = avanzar(b(), T + 60 * MIN);
    expect(avanzar(e, T + 90 * MIN)).toEqual(e);
  });
  it('la pausa no cuenta', () => {
    let e = pausar(b(), T + 10 * MIN);
    expect(finPrevisto(e, T + 20 * MIN)).toBeNull();
    expect(minutosReales(e, T + 500 * MIN)).toBe(10);
    e = reanudar(e, T + 100 * MIN);
    expect(minutosReales(e, T + 110 * MIN)).toBe(20);
  });
  it('reloj hacia atrás: no se pierde lo trabajado ni sale negativo', () => {
    let e = avanzar(b(), T + 20 * MIN);
    e = avanzar(e, T - 60 * MIN);
    expect(minutosReales(e, T - 60 * MIN)).toBe(20);
    e = avanzar(e, T - 50 * MIN);
    expect(minutosReales(e, T - 50 * MIN)).toBe(30);
    expect(transcurridoMs(e, T - 50 * MIN)).toBeGreaterThan(0);
  });
  it('reloj hacia atrás en pausa: no regala tiempo al reanudar', () => {
    let e = pausar(b(), T + 10 * MIN);
    e = reanudar(e, T - 60 * MIN);
    expect(minutosReales(e, T - 60 * MIN)).toBe(10);
    expect(minutosReales(e, T - 55 * MIN)).toBe(15);
  });
  it('reloj adelantado: lo contado nunca pasa del objetivo', () => {
    expect(minutosReales(b(), T + 10_000 * MIN)).toBe(50);
  });
  it('cerrar pronto: guarda horas, pero no cuenta', () => {
    const c = cierreDe(terminar(b(), T + 20 * MIN))!;
    expect(c).toMatchObject({ minutos: 20, guardar: true, cuenta: false });
    expect(marcaMision(c, HOY)).toBe(false);
  });
  it('un falso comienzo no se guarda', () => {
    expect(cierreDe(terminar(b(), T + 2 * MIN))).toMatchObject({ guardar: false, cuenta: false });
  });
  it('cuenta con el 80 % del objetivo y un mínimo de 25', () => {
    expect(cuentaComoBloque(40, 50)).toBe(true);
    expect(cuentaComoBloque(39, 50)).toBe(false);
    expect(cuentaComoBloque(10, 10)).toBe(false);
    expect(cuentaComoBloque(25, 25)).toBe(true);
  });
  it('cambio de día: guarda horas en su fecha y no paga la misión de hoy', () => {
    const c = cierreDe(avanzar(b({ fecha: '2026-11-08', inicioMin: 1410 }), T + 60 * MIN))!;
    expect(c.fecha).toBe('2026-11-08');
    expect(c.cuenta).toBe(true);
    expect(marcaMision(c, HOY)).toBe(false);
    expect(marcaMision(c, '2026-11-08')).toBe(true);
  });
  it('sin misión enlazada no marca nada', () => {
    expect(marcaMision(cierreDe(avanzar(b({ questId: null }), T + 60 * MIN))!, HOY)).toBe(false);
  });
  it('cierreDe solo cuando ha terminado', () => {
    expect(cierreDe(b())).toBeNull();
  });
  it('acota el objetivo', () => {
    expect(b({ objetivoMin: 1 }).objetivoMin).toBe(10);
    expect(b({ objetivoMin: 999 }).objetivoMin).toBe(180);
    expect(nuevoBloque({ clientId: 'x', ahora: T, fecha: HOY, inicioMin: 0 }).objetivoMin).toBe(50);
  });
  it('normalizar no se fía de lo guardado', () => {
    const e = b();
    expect(normalizarBloque(JSON.parse(JSON.stringify(e)))).toEqual(e);
    for (const malo of [null, 3, {}, { ...e, fase: 'x' }, { ...e, fecha: 'ayer' }, { ...e, tramoDesde: null }, { ...e, clientId: '' }]) expect(normalizarBloque(malo)).toBeNull();
  });
});

describe('qué atacar ahora', () => {
  it('sin nada: pide el plan del día', () => {
    expect(elegirAhora(entrada())).toMatchObject({ tipo: 'planificar', accion: 'planificar', motivo: { codigo: 'planificar' }, soltar: [] });
  });
  it('un bloque en marcha manda sobre todo', () => {
    const a = elegirAhora(entrada({ bloque: { titulo: 'X', questId: 'q', fase: 'corriendo', restanteMin: 12 }, eventos: [evento('e', 590, 650)] }));
    expect(a).toMatchObject({ tipo: 'bloque', accion: 'seguir_bloque', questId: 'q', motivo: { codigo: 'bloque_en_curso', vars: { minutos: 12 } } });
  });
  it('en una reunión no se empieza nada', () => {
    const a = elegirAhora(entrada({ misiones: [mision('a')], eventos: [evento('e', 570, 660)] }));
    expect(a).toMatchObject({ tipo: 'reunion', accion: 'ninguna', hastaMin: 660, motivo: { codigo: 'reunion_en_curso', vars: { minutos: 60 } } });
  });
  it('un evento sin hora de fin dura 45 minutos', () => {
    expect(elegirAhora(entrada({ eventos: [evento('e', 570, null)] })).tipo).toBe('reunion');
    expect(elegirAhora(entrada({ eventos: [evento('e', 500, null)] })).tipo).toBe('planificar');
  });
  it('reunión a punto', () => {
    const a = elegirAhora(entrada({ misiones: [mision('a')], eventos: [evento('e', 600 + AVISO_REUNION_MIN, 660)] }));
    expect(a.motivo).toEqual({ codigo: 'reunion_cerca', vars: { minutos: AVISO_REUNION_MIN } });
  });
  it('eventos de otro día o de todo el día no estorban', () => {
    const a = elegirAhora(entrada({ misiones: [mision('a')], eventos: [evento('e', 600, 660, '2026-11-10'), evento('t', null, null)] }));
    expect(a.tipo).toBe('mision');
  });
  it('el bloque del plan que toca ahora, con su misión', () => {
    const a = elegirAhora(entrada({ misiones: [mision('a'), mision('b')], plan: [{ id: 'p', inicio: 570, fin: 690, titulo: 'Entrega', tipo: 'deep_work', hecho: false, questId: 'b' }] }));
    expect(a).toMatchObject({ tipo: 'plan', questId: 'b', accion: 'empezar_bloque', minutosSugeridos: 90, motivo: { vars: { hasta: '11:30' } } });
  });
  it('un bloque del plan hecho o que no es trabajo no se propone', () => {
    const p = { id: 'p', inicio: 570, fin: 690, titulo: 'X', questId: null };
    expect(elegirAhora(entrada({ misiones: [mision('a')], plan: [{ ...p, tipo: 'deep_work', hecho: true }] })).tipo).toBe('mision');
    expect(elegirAhora(entrada({ misiones: [mision('a')], plan: [{ ...p, tipo: 'gym', hecho: false }] })).tipo).toBe('mision');
  });
  it('un plan que acaba en nada no pide bloque', () => {
    const a = elegirAhora(entrada({ misiones: [mision('a')], plan: [{ id: 'p', inicio: 500, fin: 610, titulo: 'X', tipo: 'deep_work', hecho: false, questId: null }] }));
    expect(a.tipo).toBe('mision');
  });
  it('hueco corto antes de una reunión: sin botón', () => {
    const a = elegirAhora(entrada({ misiones: [mision('a')], eventos: [evento('e', 620, 660)] }));
    expect(a).toMatchObject({ tipo: 'hueco', accion: 'ninguna', motivo: { codigo: 'hueco_corto', vars: { minutos: 20 } } });
  });
  it('el bloque sugerido cabe antes de la reunión', () => {
    const a = elegirAhora(entrada({ misiones: [mision('a')], eventos: [evento('e', 640, 660)] }));
    expect(a).toMatchObject({ tipo: 'mision', minutosSugeridos: 40, hastaMin: 640 });
  });
  it('primera, siguiente, fija y fuera de jornada', () => {
    expect(elegirAhora(entrada({ misiones: [mision('a')] })).motivo.codigo).toBe('prioridad_primera');
    expect(elegirAhora(entrada({ misiones: [mision('a'), mision('b', { hecha: true })] })).motivo.codigo).toBe('prioridad_siguiente');
    expect(elegirAhora(entrada({ misiones: [mision('a', { diaPrioridad: null })] })).motivo.codigo).toBe('mision_fija');
    expect(elegirAhora(entrada({ ahoraMin: 1300, misiones: [mision('a')] })).motivo.codigo).toBe('fuera_de_jornada');
  });
  it('las penalizaciones no se atacan desde aquí', () => {
    expect(elegirAhora(entrada({ misiones: [mision('p', { penalizacion: true })] })).tipo).toBe('planificar');
  });
  it('sin misiones, una entrega que aprieta', () => {
    expect(elegirAhora(entrada({ entregas: [entrega('a', '2026-11-08'), entrega('b', HOY)] }))).toMatchObject({ tipo: 'entrega', entregaId: 'a', motivo: { codigo: 'entrega_atrasada' } });
    expect(elegirAhora(entrada({ entregas: [entrega('b', HOY)] })).motivo.codigo).toBe('entrega_hoy');
    expect(elegirAhora(entrada({ entregas: [entrega('b', '2026-11-11')] })).motivo.codigo).toBe('entrega_cerca');
    expect(elegirAhora(entrada({ entregas: [entrega('b', '2026-11-20')] })).tipo).toBe('planificar');
  });
  it('todo hecho: día cerrado', () => {
    expect(elegirAhora(entrada({ misiones: [mision('a', { hecha: true })] }))).toMatchObject({ tipo: 'cerrado', accion: 'ninguna' });
  });
  it('es determinista', () => {
    const e = entrada({ misiones: [mision('b'), mision('a')], eventos: [evento('x', 700, 760)] });
    expect(elegirAhora(e)).toEqual(elegirAhora({ ...e, misiones: [...e.misiones].reverse() }));
  });

  it('un bloque del plan sin misión dice cuál ataca, y lleva su id para marcar ese', () => {
    const a = elegirAhora(entrada({ misiones: [mision('a')], plan: [{ id: 'p1', inicio: 540, fin: 690, titulo: 'Trabajo profundo', tipo: 'ventas', hecho: false, questId: null }] }));
    expect(a).toMatchObject({ tipo: 'plan', titulo: 'M a', questId: 'a', bloquePlanId: 'p1' });
  });

  it('con todo hecho y una penalización pendiente orienta a recuperar', () => {
    const a = elegirAhora(entrada({ misiones: [mision('a', { hecha: true }), mision('p', { penalizacion: true, diaPrioridad: null })] }));
    expect(a).toMatchObject({ tipo: 'recuperar', titulo: 'M p', questId: 'p', accion: 'ninguna', motivo: { codigo: 'recuperar' } });
  });

  describe('qué soltar', () => {
    it('lo libre descuenta reuniones sin contar solapes', () => {
      expect(minutosLibres([{ inicio: 620, fin: 680 }, { inicio: 650, fin: 700 }], 600, 720)).toBe(40);
      expect(minutosLibres([], 700, 600)).toBe(0);
      expect(minutosLibres([{ inicio: 500, fin: 2000 }], 600, 720)).toBe(0);
    });
    it('suelta desde el final lo que no cabe; nunca la primera', () => {
      const e = entrada({ ahoraMin: 1000, finJornadaMin: 1090, misiones: [mision('a', { rango: 1 }), mision('b', { rango: 2 }), mision('c', { rango: 3 })] });
      const s = queSoltar(e, []);
      expect(s.map((x) => x.id)).toEqual(['c', 'b']);
      expect(s[0]).toMatchObject({ motivo: { codigo: 'soltar_no_cabe' }, sinCoste: true });
    });
    it('una fija se sugiere, pero no sale gratis', () => {
      const e = entrada({ ahoraMin: 1100, misiones: [mision('a', { rango: 1 }), mision('b', { diaPrioridad: null })] });
      expect(queSoltar(e, [])).toEqual([expect.objectContaining({ id: 'b', sinCoste: false })]);
    });
    it('con carga alta y todo cabiendo, propone soltar la última', () => {
      const e = entrada({ nivelCarga: 'alta', misiones: [mision('a', { rango: 1 }), mision('b', { rango: 2 })] });
      expect(queSoltar(e, [])).toEqual([expect.objectContaining({ id: 'b', motivo: { codigo: 'soltar_carga' } })]);
    });
    it('con una sola pendiente no hay nada que soltar', () => {
      expect(queSoltar(entrada({ ahoraMin: 1300, nivelCarga: 'alta', misiones: [mision('a')] }), [])).toEqual([]);
    });
  });

  it('todos los motivos tienen texto', () => {
    for (const c of CODIGOS_MOTIVO) expect(typeof (trabajo.motivo as Record<string, string>)[c]).toBe('string');
  });
});

describe('proyectos y entregas', () => {
  it('riesgo por fecha', () => {
    expect(riesgoEntrega({ fecha: null, hecha: false }, HOY)).toBe('sin_fecha');
    expect(riesgoEntrega({ fecha: '2026-11-01', hecha: true }, HOY)).toBe('hecha');
    expect(riesgoEntrega({ fecha: '2026-11-08', hecha: false }, HOY)).toBe('atrasada');
    expect(riesgoEntrega({ fecha: HOY, hecha: false }, HOY)).toBe('hoy');
    expect(riesgoEntrega({ fecha: '2026-11-11', hecha: false }, HOY, 300)).toBe('en_riesgo');
  });
  it('a una semana: en riesgo si nadie la ha tocado, a tiempo si sí', () => {
    expect(riesgoEntrega({ fecha: '2026-11-16', hecha: false }, HOY)).toBe('en_riesgo');
    expect(riesgoEntrega({ fecha: '2026-11-16', hecha: false }, HOY, 25)).toBe('a_tiempo');
    expect(riesgoEntrega({ fecha: '2026-11-17', hecha: false }, HOY)).toBe('a_tiempo');
  });
  it('ordena por urgencia y mira las horas de la última semana', () => {
    const r = entregasConRiesgo(
      [entrega('sin', null), entrega('lejos', '2026-12-20'), entrega('tocada', '2026-11-15'), entrega('vieja', '2026-11-05'), entrega('hecha', '2026-11-05', { hecha: true })],
      [sesion('s', '2026-11-08', 30, { entregaId: 'tocada' }), sesion('s2', '2026-10-01', 30, { entregaId: 'lejos' })],
      HOY,
    );
    expect(r.map((e) => [e.id, e.riesgo])).toEqual([['vieja', 'atrasada'], ['tocada', 'a_tiempo'], ['lejos', 'a_tiempo'], ['sin', 'sin_fecha'], ['hecha', 'hecha']]);
    expect(r[0]!.dias).toBe(-4);
  });
  it('próximas: incluye lo atrasado, excluye lo hecho, lo lejano y lo sin fecha', () => {
    const r = entregasProximas([entrega('a', '2026-11-01'), entrega('b', '2026-11-16'), entrega('c', '2026-11-17'), entrega('d', null), entrega('e', HOY, { hecha: true })], [], HOY);
    expect(r.map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('resumen de proyecto', () => {
    const r = resumenProyecto(proyecto('p'), [entrega('a', HOY, { proyectoId: 'p' }), entrega('b', null, { proyectoId: 'p', hecha: true }), entrega('z', HOY)], [sesion('s', HOY, 60, { proyectoId: 'p' })], HOY);
    expect(r).toMatchObject({ pendientes: 1, hechas: 1, avance: 50, riesgo: 'hoy', minutosSemana: 60 });
    expect(r.proxima?.id).toBe('a');
  });
  it('proyecto vacío y solo los activos', () => {
    expect(resumenProyecto(proyecto('p'), [], [], HOY)).toMatchObject({ avance: null, proxima: null, riesgo: null });
    expect(resumenProyectos([proyecto('p', { estado: 'cerrado' }), proyecto('q')], [], [], HOY).map((r) => r.proyecto.id)).toEqual(['q']);
  });
});

describe('horas', () => {
  it('un registro por día, también los vacíos', () => {
    const r = minutosPorDia([sesion('a', HOY, 30), sesion('b', HOY, 20, { tipo: 'manual' }), sesion('c', '2026-11-20', 99)], '2026-11-08', HOY);
    expect(r).toEqual([{ fecha: '2026-11-08', minutos: 0, profundos: 0 }, { fecha: HOY, minutos: 50, profundos: 30 }]);
    expect(minutosPorDia([], HOY, '2026-11-01')).toEqual([]);
  });
  it('por proyecto, tarifa y por facturar', () => {
    const p = [proyecto('p', { nombre: 'Web', tarifaHora: 60 }), proyecto('q')];
    const s = [
      sesion('a', HOY, 90, { proyectoId: 'p', facturable: true }),
      sesion('b', HOY, 30, { proyectoId: 'p', facturable: true, facturadaEl: HOY }),
      sesion('c', HOY, 15, { proyectoId: 'p' }),
      sesion('d', HOY, 30, { proyectoId: 'q', facturable: true }),
      sesion('e', HOY, 200),
    ];
    const r = horasPorProyecto(s, p, HOY, HOY);
    expect(r[0]).toMatchObject({ proyectoId: null, minutos: 200, porFacturarImporte: null });
    expect(r[1]).toMatchObject({ proyectoId: 'p', nombre: 'Web', minutos: 135, facturables: 120, porFacturarMin: 90, porFacturarImporte: 90 });
    expect(totalHoras(s, p, HOY, HOY)).toEqual({ minutos: 365, profundos: 365, facturables: 150, noFacturables: 215, porFacturarMin: 120, porFacturarImporte: 90, porFacturarSinTarifaMin: 30 });
    expect(idsPorFacturar(s, 'p', HOY, HOY)).toEqual(['a']);
  });
  it('un proyecto borrado cae a sin proyecto', () => {
    expect(horasPorProyecto([sesion('a', HOY, 10, { proyectoId: 'fantasma' })], [], HOY, HOY)[0]).toMatchObject({ proyectoId: null, nombre: null });
  });
  it('vacío', () => {
    expect(totalHoras([], [], HOY, HOY).minutos).toBe(0);
    expect(horasPorProyecto([], [], HOY, HOY)).toEqual([]);
  });
  it('facturable por defecto solo con tarifa', () => {
    expect(facturablePorDefecto(proyecto('p', { tarifaHora: 10 }))).toBe(true);
    expect(facturablePorDefecto(proyecto('p'))).toBe(false);
    expect(facturablePorDefecto(null)).toBe(false);
  });
  it.each([['1:30', 90], ['1,5', 90], ['1.5h', 90], ['90m', 90], ['90 min', 90], ['2', 120], ['45', 45]])('lee %s', (e, m) => expect(leerMinutos(e)).toBe(m));
  it.each(['', 'abc', '1:99', '0', '900'])('rechaza %s', (e) => expect(leerMinutos(e)).toBeNull());
});

describe('carga', () => {
  const tranquila = { fecha: HOY, eventos: [], sesiones: [] };
  it('sin datos, ligera y sin nada que soltar', () => {
    expect(calcularCarga(tranquila)).toMatchObject({ nivel: 'ligera', puntos: 0, senales: [], soltar: null });
  });
  it('los solapes no cuentan dos veces', () => {
    expect(minutosOcupados([evento('a', 600, 660), evento('b', 630, 690), evento('c', 800, 830)])).toBe(120);
    expect(minutosOcupados([evento('a', null, null)])).toBe(0);
  });
  it('fin de evento raro: hasta medianoche', () => {
    expect(finEvento({ inicio: 1400, fin: 30 })).toBe(1440);
    expect(finEvento({ inicio: 1420, fin: null })).toBe(1440);
    expect(finEvento({ inicio: null, fin: 30 })).toBeNull();
  });
  it('muchas reuniones hoy: normal, y con 5 h ya pesa doble', () => {
    expect(calcularCarga({ ...tranquila, eventos: [evento('a', 540, 720)] })).toMatchObject({ nivel: 'normal', reunionesHoyMin: 180, senales: [{ codigo: 'reuniones_hoy', valor: 180 }] });
    expect(calcularCarga({ ...tranquila, eventos: [evento('a', 540, 840)] }).puntos).toBe(2);
  });
  it('el calendario del sábado no es trabajo', () => {
    const c = calcularCarga({ fecha: '2026-11-14', eventos: [evento('cumple', 600, 1000, '2026-11-14')], sesiones: [] });
    expect(c).toMatchObject({ reunionesHoyMin: 0, reunionesSemanaMin: 0, diasFinDeSemana: 0, nivel: 'ligera' });
  });
  it('tardes, fin de semana y días seguidos salen de las sesiones', () => {
    const s = ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', HOY].map((f, i) => sesion(`s${i}`, f, 60, { inicioMin: 1170 }));
    const c = calcularCarga({ fecha: HOY, eventos: [], sesiones: s });
    expect(c).toMatchObject({ diasTarde: 7, diasFinDeSemana: 2, diasSeguidos: 7, nivel: 'alta' });
    expect(c.soltar).toBe(c.senales[0]!.codigo);
  });
  it('una sesión que acaba justo a las ocho no es tarde', () => {
    expect(calcularCarga({ ...tranquila, sesiones: [sesion('a', HOY, 60, { inicioMin: 1140 })] }).diasTarde).toBe(0);
  });
  it('hoy sin trabajar todavía no rompe la serie', () => {
    const s = ['2026-11-07', '2026-11-08'].map((f, i) => sesion(`s${i}`, f, 60));
    expect(calcularCarga({ fecha: HOY, eventos: [], sesiones: s }).diasSeguidos).toBe(2);
    expect(calcularCarga({ fecha: '2026-11-10', eventos: [], sesiones: s }).diasSeguidos).toBe(0);
  });
  it('solo mira los últimos 7 días', () => {
    expect(calcularCarga({ ...tranquila, sesiones: [sesion('a', '2026-11-02', 500), sesion('b', '2026-11-03', 100)] }).trabajoSemanaMin).toBe(100);
  });
  it('profundo frente a manual', () => {
    const c = calcularCarga({ ...tranquila, sesiones: [sesion('a', HOY, 50), sesion('b', HOY, 30, { tipo: 'manual' })] });
    expect(c).toMatchObject({ profundoHoyMin: 50, profundoSemanaMin: 50, trabajoSemanaMin: 80 });
  });
});

describe('revisión semanal', () => {
  const LUNES = '2026-11-02';
  const base: EntradaSemana = { lunes: LUNES, misiones: [], entregas: [], sesiones: [], eventos: [], proyectos: [] };
  it('qué semana toca revisar', () => {
    expect(semanaARevisar('2026-11-06')).toBe(LUNES); // viernes
    expect(semanaARevisar('2026-11-08')).toBe(LUNES); // domingo
    expect(semanaARevisar(HOY)).toBe(LUNES); // lunes: la pasada
    expect(semanaARevisar('2026-11-12')).toBe(LUNES); // jueves
    expect(semanaARevisar('2026-11-13')).toBe(HOY); // viernes siguiente
  });
  it('semana vacía', () => {
    expect(resumenSemana(base)).toEqual({ lunes: LUNES, domingo: '2026-11-08', cerrado: [], seQuedo: [], minutosProfundos: 0, minutosTotales: 0, minutosReunion: 0, diasConBloque: 0, propuestas: [] });
  });
  it('lo cerrado y lo que se quedó, sin repetir', () => {
    const r = resumenSemana({
      ...base,
      entregas: [entrega('e1', '2026-11-04', { hecha: true, hechaEl: '2026-11-04' }), entrega('e2', '2026-11-05'), entrega('fuera', '2026-11-20')],
      misiones: [
        { id: 'a', titulo: 'Propuesta', fecha: '2026-11-03', hecha: true, prioridad: true },
        { id: 'b', titulo: 'propuesta', fecha: '2026-11-04', hecha: true, prioridad: false },
        { id: 'c', titulo: 'Informe', fecha: '2026-11-05', hecha: false, prioridad: true },
        { id: 'd', titulo: 'Fija sin hacer', fecha: '2026-11-05', hecha: false, prioridad: false },
        { id: 'e', titulo: 'Otra semana', fecha: '2026-11-10', hecha: true, prioridad: true },
      ],
    });
    expect(r.cerrado.map((i) => i.titulo)).toEqual(['D e1', 'Propuesta']);
    expect(r.seQuedo.map((i) => i.titulo)).toEqual(['D e2', 'Informe']);
  });
  it('una prioridad repetida y hecha otro día ya no se quedó', () => {
    const r = resumenSemana({ ...base, misiones: [{ id: 'a', titulo: 'X', fecha: '2026-11-03', hecha: false, prioridad: true }, { id: 'b', titulo: 'x', fecha: '2026-11-04', hecha: true, prioridad: true }] });
    expect(r.seQuedo).toEqual([]);
  });
  it('horas de la semana', () => {
    const r = resumenSemana({
      ...base,
      sesiones: [sesion('a', '2026-11-03', 50), sesion('b', '2026-11-03', 50), sesion('c', '2026-11-04', 30, { tipo: 'manual' }), sesion('d', '2026-11-09', 500)],
      eventos: [evento('r', 600, 660, '2026-11-03'), evento('r2', 630, 690, '2026-11-03'), evento('sab', 600, 660, '2026-11-07')],
    });
    expect(r).toMatchObject({ minutosProfundos: 100, minutosTotales: 130, minutosReunion: 90, diasConBloque: 1 });
  });
  it('propone tres: fechas, lo que se quedó y proyectos parados', () => {
    const r = resumenSemana({
      ...base,
      entregas: [entrega('e', '2026-11-12')],
      misiones: [{ id: 'a', titulo: 'Informe', fecha: '2026-11-05', hecha: false, prioridad: true }],
      proyectos: [proyecto('parado'), proyecto('activo'), proyecto('otro', { posicion: 5 })],
      sesiones: [sesion('s', '2026-11-03', 30, { proyectoId: 'activo' })],
    });
    expect(r.propuestas.map((p) => [p.origen, p.titulo])).toEqual([['entrega', 'D e'], ['pendiente', 'Informe'], ['proyecto', 'P parado']]);
    expect(r.propuestas[0]!.motivo).toEqual({ codigo: 'semana_entrega', vars: { fecha: '12/11' } });
    expect(r.propuestas[0]!.entregaId).toBe('e');
  });
  it('nunca más de tres, y sin repetir título', () => {
    const r = resumenSemana({ ...base, entregas: [entrega('a', '2026-11-03', { titulo: 'X' }), entrega('b', '2026-11-04', { titulo: 'x' }), entrega('c', '2026-11-05'), entrega('d', '2026-11-06'), entrega('e', '2026-11-07')] });
    expect(r.propuestas.map((p) => p.entregaId)).toEqual(['a', 'c', 'd']);
  });
});

describe('adaptar', () => {
  it('un evento antiguo sin columnas nuevas es manual y sin fin', () => {
    expect(aEvento({ id: 'e', title: 'T', date: '2026-11-09', time: '09:30' })).toEqual({ id: 'e', titulo: 'T', fecha: '2026-11-09', inicio: 570, fin: null, origen: 'manual' });
  });
  it('un importado trae su fin', () => {
    expect(aEvento({ id: 'e', title: 'T', date: '2026-11-09', time: '09:30:00', end_time: '10:15', source: 'dispositivo' })).toMatchObject({ fin: 615, origen: 'dispositivo' });
  });
});
