import { editarRetiraMision, filasDeEntregas, misionDeEntrega, planCierreEntrega, prioridadesNuevas, type MisionConDia } from '../entregaMision';
import type { Entrega } from '../tipos';

const HOY = '2026-10-21'; // miércoles

const entrega = (id: string, fecha: string | null, o: Partial<Entrega> = {}): Entrega => ({ id, proyectoId: null, titulo: `Entrega ${id}`, fecha, hecha: false, hechaEl: null, posicion: 0, ...o });
const mision = (id: string, titulo: string, dia: string, activa = true): MisionConDia => ({ id, titulo, dia, activa });

describe('filasDeEntregas', () => {
  it('crea la misión con el día de la semana de la entrega y etiqueta work', () => {
    const [f] = filasDeEntregas([entrega('a', '2026-10-23')], [], HOY);
    expect(f).toMatchObject({ title: 'Entrega a', work_day: '2026-10-23', days_of_week: [5], modes: ['work'], link: 'ninguno', work_rank: 1 });
  });

  it('no crea nada a más de seis días: saldría también la semana anterior', () => {
    expect(filasDeEntregas([entrega('a', '2026-10-28')], [], HOY)).toEqual([]);
    expect(filasDeEntregas([entrega('a', '2026-10-27')], [], HOY)).toHaveLength(1);
  });

  it('ignora lo hecho, lo pasado y lo que no tiene fecha', () => {
    expect(filasDeEntregas([entrega('a', '2026-10-22', { hecha: true }), entrega('b', '2026-10-20'), entrega('c', null)], [], HOY)).toEqual([]);
  });

  it('es idempotente, también con una misión soltada', () => {
    expect(filasDeEntregas([entrega('a', '2026-10-23')], [mision('q', 'entrega  A', '2026-10-23', false)], HOY)).toEqual([]);
  });

  it('un día no pasa de tres y continúa el rango', () => {
    const entregas = ['a', 'b', 'c'].map((x) => entrega(x, HOY));
    const f = filasDeEntregas(entregas, [mision('q', 'Otra', HOY)], HOY);
    expect(f.map((x) => x.work_rank)).toEqual([2, 3]);
  });

  it('una entrega de título largo casa con su misión recortada', () => {
    const larga = 'x'.repeat(150);
    const [f] = filasDeEntregas([entrega('a', HOY, { titulo: larga })], [], HOY);
    expect(misionDeEntrega({ titulo: larga, fecha: HOY }, [mision('q', f!.title, HOY)])?.id).toBe('q');
  });
});

describe('una entrega no paga dos veces', () => {
  it('adelantada y reabierta no crea otra: la misión de hoy ya es suya', () => {
    expect(filasDeEntregas([entrega('a', '2026-10-23', { titulo: 'Propuesta' })], [mision('q', 'Propuesta', HOY)], HOY)).toEqual([]);
  });

  it('editar una entrega cerrada no retira su misión pagada', () => {
    expect(editarRetiraMision({ titulo: 'A', fecha: HOY, hecha: true }, { titulo: 'B', fecha: HOY })).toBe(false);
  });

  it('editar una pendiente solo retira si cambia título o fecha', () => {
    expect(editarRetiraMision({ titulo: 'A', fecha: HOY, hecha: false }, { titulo: ' A ', fecha: HOY })).toBe(false);
    expect(editarRetiraMision({ titulo: 'A', fecha: HOY, hecha: false }, { titulo: 'B', fecha: HOY })).toBe(true);
    expect(editarRetiraMision({ titulo: 'A', fecha: HOY, hecha: false }, { titulo: 'A', fecha: null })).toBe(true);
  });
});

describe('planCierreEntrega', () => {
  const e = { titulo: 'Propuesta', fecha: '2026-10-23' };

  it('sin misión no hay nada que pagar', () => {
    expect(planCierreEntrega(e, [], HOY)).toEqual({ accion: 'nada' });
    expect(planCierreEntrega({ titulo: 'Propuesta', fecha: null }, [], HOY)).toEqual({ accion: 'nada' });
  });

  it('el mismo día completa', () => {
    expect(planCierreEntrega({ titulo: 'Propuesta', fecha: HOY }, [mision('q', 'Propuesta', HOY)], HOY)).toMatchObject({ accion: 'completar', questId: 'q' });
  });

  it('antes de tiempo adelanta a hoy', () => {
    expect(planCierreEntrega(e, [mision('q', 'Propuesta', '2026-10-23')], HOY)).toEqual({ accion: 'adelantar', questId: 'q', rango: 1 });
  });

  it('con tres hoy retira y no paga una cuarta', () => {
    const llenas = ['1', '2', '3'].map((x) => mision(x, x, HOY));
    expect(planCierreEntrega(e, [...llenas, mision('q', 'Propuesta', '2026-10-23')], HOY)).toMatchObject({ accion: 'retirar', questId: 'q' });
  });

  it('una misión soltada o ya pasada se queda como está', () => {
    expect(planCierreEntrega(e, [mision('q', 'Propuesta', '2026-10-23', false)], HOY)).toEqual({ accion: 'nada' });
  });
});

describe('prioridadesNuevas', () => {
  it('repetir no duplica y continúa el rango', () => {
    const r = prioridadesNuevas(['Uno', 'Dos'], [mision('q', 'uno', HOY)], HOY);
    expect(r).toEqual({ titulos: ['Dos'], rangoDesde: 2 });
  });

  it('nunca pasa de tres en el día', () => {
    expect(prioridadesNuevas(['A', 'B', 'C'], [mision('1', 'X', HOY), mision('2', 'Y', HOY)], HOY).titulos).toEqual(['A']);
  });

  it('otro día no cuenta', () => {
    expect(prioridadesNuevas(['A'], [mision('1', 'A', '2026-10-22')], HOY)).toEqual({ titulos: ['A'], rangoDesde: 1 });
  });
});
