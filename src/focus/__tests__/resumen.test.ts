// NIVL · FOCUS: de los datos a lo que pinta cada pantalla, y las claves dinámicas de i18n.
import fs from 'fs';
import path from 'path';
import { fechaCorta, leerFechaEs } from '@/focus/fechas';
import { METODOS } from '@/focus/metodos';
import { CONFIG_POR_DEFECTO } from '@/focus/pomodoro';
import {
  asignaturaFoco,
  examenesPasados,
  examenesProximos,
  horasDeLaSemana,
  notasPorAsignatura,
  planDeHoyConHoras,
  repasosDeHoy,
  temasDeExamen,
  ventanaTemario,
} from '@/focus/resumen';
import { DATOS_VACIOS, type DatosFocus, type Examen, type Tema } from '@/focus/tipos';

const HOY = '2026-10-21';
const tema = (id: string, asignaturaId: string, estado: Tema['estado'], posicion: number, extra: Partial<Tema> = {}): Tema => ({
  id,
  asignaturaId,
  examenId: null,
  nombre: id,
  estado,
  posicion,
  etapa: 0,
  repasoEl: null,
  seccion: null,
  repasadoEl: null,
  ...extra,
});
const examen = (id: string, asignaturaId: string, titulo: string, fecha: string | null, extra: Partial<Examen> = {}): Examen => ({
  id,
  asignaturaId,
  titulo,
  fecha,
  peso: null,
  hora: null,
  tipo: 'examen',
  estimada: false,
  hechaEl: null,
  ...extra,
});
const sesion = (id: string, asignaturaId: string, fecha: string, minutos: number) => ({ id, asignaturaId, temaId: null, fecha, minutos, metodo: null, salidas: 0 });

const D: DatosFocus = {
  ...DATOS_VACIOS,
  asignaturas: [
    { id: 'a', nombre: 'Cálculo', posicion: 0, notaObjetivo: null, vuelta: 1 },
    { id: 'b', nombre: 'Datos', posicion: 1, notaObjetivo: null, vuelta: 1 },
  ],
  examenes: [
    examen('xa', 'a', 'P2', '2026-11-02'),
    examen('xb', 'b', 'F', '2026-11-16'),
    examen('xv', 'a', 'P1', '2026-10-01'),
    examen('xh', 'borrada', 'X', '2026-10-30'),
  ],
  temas: [
    tema('a1', 'a', 'dominado', 0),
    tema('a2', 'a', 'repasando', 1, { repasoEl: '2026-10-20' }),
    tema('a3', 'a', 'pendiente', 2),
    tema('b1', 'b', 'pendiente', 0, { examenId: 'xb' }),
    tema('b2', 'b', 'pendiente', 1),
  ],
  clases: [{ id: 'k', asignaturaId: 'a', dia: 3, inicio: 9 * 60, fin: 14 * 60, aula: null }],
  sesiones: [
    sesion('s1', 'a', '2026-10-20', 25),
    sesion('s2', 'a', HOY, 50),
    sesion('s3', 'b', '2026-10-12', 99),
  ],
  notas: [
    { id: 'n', asignaturaId: 'a', titulo: 'P1', nota: 4, sobre: 10, peso: 40, fecha: HOY },
  ],
  tarjetas: [{ id: 'c', mazoId: 'm', anverso: 'q', reverso: 'r', etapa: 0, vence: HOY }],
};

describe('resumen de FOCUS', () => {
  it('exámenes próximos (sin los de asignaturas borradas) y pasados', () => {
    const p = examenesProximos(D, HOY);
    expect(p.map((x) => [x.examen.id, x.dias, x.progreso])).toEqual([
      ['xa', 12, 50],
      ['xb', 26, 0],
    ]);
    expect(examenesPasados(D, HOY).map((x) => x.id)).toEqual(['xv']);
  });

  it('un examen suma sus temas y el temario general; sin ninguno, todo el de la asignatura', () => {
    expect(temasDeExamen(D, D.examenes[1]!).map((x) => x.id)).toEqual(['b1', 'b2']);
    expect(temasDeExamen(D, D.examenes[0]!).map((x) => x.id)).toEqual(['a1', 'a2', 'a3']);
  });

  it('la asignatura en foco es la del examen más cercano', () => {
    expect(asignaturaFoco(D, HOY)?.id).toBe('a');
    expect(asignaturaFoco(DATOS_VACIOS, HOY)).toBeNull();
  });

  it('el plan de hoy con horas tras la última clase: primero repasos y luego temas', () => {
    const plan = planDeHoyConHoras(D, HOY, 10 * 60, CONFIG_POR_DEFECTO);
    expect(plan[0]).toMatchObject({ hora: 14 * 60 + 30, tipo: 'repasar', minutos: 2 });
    expect(plan[1]).toMatchObject({ tipo: 'repasar', temaId: 'a2', minutos: 10 });
    expect(plan[2]).toMatchObject({ tipo: 'estudiar', asignaturaId: 'a', temaId: 'a3' });
    expect(plan.every((b, i) => i === 0 || (b.hora ?? 0) > (plan[i - 1]!.hora ?? 0))).toBe(true);
  });

  it('repasos de hoy, horas de la semana y notas', () => {
    expect(repasosDeHoy(D, HOY)).toMatchObject({ temas: [{ id: 'a2' }], tarjetas: 1 });
    const h = horasDeLaSemana(D, HOY);
    expect(h.total).toBe(75);
    expect(h.hoy).toEqual({ minutos: 50, bloques: 1 });
    const n = notasPorAsignatura(D);
    expect(n).toHaveLength(1);
    expect(n[0]!.necesaria).toEqual({ tipo: 'necesaria', necesaria: 5.67 });
  });

  it('la ventana del temario: último dominado y lo siguiente', () => {
    const t = [{ estado: 'dominado' }, { estado: 'dominado' }, { estado: 'repasando' }, { estado: 'pendiente' }, { estado: 'pendiente' }] as const;
    expect(ventanaTemario(t).map((_, i) => i)).toHaveLength(3);
    expect(ventanaTemario(t)[0]).toBe(t[1]);
    expect(ventanaTemario([{ estado: 'dominado' }, { estado: 'dominado' }] as const)).toHaveLength(2);
  });

  it('lee fechas escritas a mano', () => {
    expect(leerFechaEs('2/11/2026', HOY)).toBe('2026-11-02');
    expect(leerFechaEs('2-11-26', HOY)).toBe('2026-11-02');
    expect(leerFechaEs('2/11', HOY)).toBe('2026-11-02');
    expect(leerFechaEs('1/9', HOY)).toBe('2027-09-01');
    expect(leerFechaEs('31/2/2026', HOY)).toBeNull();
    expect(leerFechaEs('mañana', HOY)).toBeNull();
    expect(fechaCorta('2026-11-02')).toBe('2/11/2026');
  });
});

describe('claves dinámicas de i18n de FOCUS', () => {
  const dir = path.resolve(__dirname, '..', '..', 'i18n');
  const idiomas = fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'focus.json')));

  it.each(idiomas)('%s tiene métodos, pasos, días e instrucciones de No molestar', (lng) => {
    const j = JSON.parse(fs.readFileSync(path.join(dir, lng, 'focus.json'), 'utf8'));
    for (const m of METODOS) {
      for (const k of ['nombre', 'linea', 'que', 'porQue']) expect(typeof j.metodos[m.id][k]).toBe('string');
      for (let i = 0; i < m.pasos; i++) expect(typeof j.metodos[m.id].pasos[String(i)]).toBe('string');
      expect(typeof j.metodos.accion[m.accion]).toBe('string');
    }
    for (let d = 1; d <= 7; d++) {
      expect(typeof j.dia.corto[String(d)]).toBe('string');
      expect(typeof j.dia.largo[String(d)]).toBe('string');
    }
    for (const so of ['ios', 'android']) for (let i = 0; i < 3; i++) expect(typeof j.noMolestar[so][String(i)]).toBe('string');
  });
});
