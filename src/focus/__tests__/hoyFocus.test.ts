// La pestaña Hoy de FOCUS: de los datos a lo que se pinta, y las cuentas del arranque.
import { claseDe, fraseCoach, temaConNumero, tocaDe, vistaHoy, type EntradaCoach } from '@/components/focus/vistaHoy';
import { asignaturaDelExamen, examenDeArranque, nombresDeAsignaturas } from '@/focus/arranqueFlujo';
import { CONFIG_POR_DEFECTO, ESTADO_INICIAL, OBJETIVO_LIBRE, arrancar } from '@/focus/pomodoro';
import type { PlanHoy, BloquePlan, ExamenVista } from '@/focus/resumen';
import { DATOS_VACIOS, type DatosFocus, type Examen, type Tema } from '@/focus/tipos';

const HOY = '2026-11-09'; // lunes
const C = CONFIG_POR_DEFECTO;

const tema = (id: string, asignaturaId: string, nombre: string, extra: Partial<Tema> = {}): Tema => ({
  id,
  asignaturaId,
  examenId: null,
  nombre,
  estado: 'pendiente',
  posicion: Number(id.replace(/\D/g, '')) || 0,
  etapa: 0,
  repasoEl: null,
  seccion: null,
  repasadoEl: null,
  ...extra,
});

const examen = (id: string, asignaturaId: string, fecha: string | null, extra: Partial<Examen> = {}): Examen => ({
  id,
  asignaturaId,
  titulo: `Examen ${id}`,
  fecha,
  peso: null,
  hora: null,
  tipo: 'examen',
  estimada: false,
  hechaEl: null,
  ...extra,
});

const datos = (extra: Partial<DatosFocus>): DatosFocus => ({
  ...DATOS_VACIOS,
  asignaturas: [
    { id: 'a1', nombre: 'Cálculo', posicion: 0, notaObjetivo: null, vuelta: 1 },
    { id: 'a2', nombre: 'Física', posicion: 1, notaObjetivo: null, vuelta: 1 },
  ],
  prefs: { ...DATOS_VACIOS.prefs, arranqueHecho: true },
  ...extra,
});

const vista = (d: DatosFocus, pomodoro = ESTADO_INICIAL, ahoraMin = 16 * 60) =>
  vistaHoy({ datos: d, hoy: HOY, ahoraMin, ahora: Date.parse('2026-11-09T16:00:00'), config: C, pomodoro, misiones: [] });

const planVacio: PlanHoy = { bloques: [], fuera: [], minutosPlan: 0, minutosDisponibles: 120, avisoNoLlegas: false, sinPlan: 'sin_temas' };

const bloque = (extra: Partial<BloquePlan>): BloquePlan => ({
  hora: 960,
  tipo: 'estudiar',
  asignaturaId: 'a1',
  asignatura: 'Cálculo',
  temaId: null,
  tema: null,
  examenId: null,
  minutos: 50,
  motivo: { clave: 'estudiarTemario', datos: {} },
  ...extra,
});

const proximo = (dias: number): ExamenVista => ({ examen: { ...examen('x', 'a1', '2026-11-20'), fecha: '2026-11-20' }, asignatura: 'Cálculo', dias, progreso: 0, temas: 0 });

const coach = (e: Partial<EntradaCoach>) => fraseCoach({ sinAsignaturas: false, examenes: [], plan: planVacio, repasos: 0, ...e });

describe('frase del coach', () => {
  it('con el examen hoy no dice que es mañana ni pide simulacro', () => {
    const f = coach({ examenes: [proximo(0)], plan: { ...planVacio, sinPlan: null, bloques: [bloque({ tipo: 'repasar' })] }, repasos: 3 });
    expect(f).toContain('es hoy');
    expect(f).not.toContain('mañana');
    expect(f).not.toContain('simulacro');
  });

  it('sin temas no anima: lo dice', () => {
    expect(coach({ examenes: [proximo(5)] })).toContain('Sin temas');
  });

  it('solo pide simulacro si el plan lo pide', () => {
    expect(coach({ examenes: [proximo(1)], plan: { ...planVacio, sinPlan: null, bloques: [bloque({ tipo: 'simulacro' })] } })).toContain('simulacro');
    expect(coach({ examenes: [proximo(2)], plan: { ...planVacio, sinPlan: null, bloques: [bloque({ tipo: 'estudiar', tema: 'Integrales' })] } })).not.toContain('simulacro');
  });

  it('sin asignaturas no promete repartir nada el coach', () => {
    expect(coach({ sinAsignaturas: true })).not.toContain('te reparto');
  });
});

describe('Hoy toca', () => {
  const con = datos({ temas: [tema('t1', 'a1', 'Integrales'), tema('t2', 'a1', 'Series')], examenes: [examen('x1', 'a1', '2026-11-20')] });

  it('sin nada elegido, lo primero del plan y su motivo', () => {
    const v = vista(con);
    expect(v.toca.temaId).toBe('t1');
    expect(v.toca.asignaturaId).toBe('a1');
    expect(v.toca.motivo).toContain('Examen x1');
    expect(v.toca.elegido).toBe(false);
  });

  it('el objetivo elegido manda; el de una asignatura archivada no', () => {
    const v = vista(con, { ...ESTADO_INICIAL, objetivo: { asignaturaId: 'a2', temaId: null, misionId: null } });
    expect(v.toca.titulo).toBe('Física');
    expect(v.toca.elegido).toBe(true);
    const archivada = vista(con, { ...ESTADO_INICIAL, objetivo: { asignaturaId: 'borrada', temaId: 'x', misionId: null } });
    expect(archivada.toca.temaId).toBe('t1');
    expect(archivada.toca.elegido).toBe(false);
  });

  it('con asignaturas y sin temas el bloque ya tiene nombre', () => {
    const v = vista(datos({}));
    expect(v.toca.titulo).toBe('Cálculo');
    expect(v.toca.asignaturaId).toBe('a1');
    expect(v.toca.tipo).toBe('estudiar');
    expect(v.plan.faltanTemasDe).toBe('a1');
    expect(v.plan.sinPlan).toBeTruthy();
  });

  it('sin asignaturas es bloque libre y arranque guiado', () => {
    const v = vista({ ...DATOS_VACIOS });
    expect(v.toca.tipo).toBe('libre');
    expect(v.arranque).toBe(true);
  });

  it('con el arranque hecho no vuelve a salir', () => {
    expect(vista({ ...DATOS_VACIOS, prefs: { ...DATOS_VACIOS.prefs, arranqueHecho: true } }).arranque).toBe(false);
  });
});

describe('sesión en marcha', () => {
  const con = datos({ temas: [tema('t1', 'a1', 'Integrales')], examenes: [examen('x1', 'a1', '2026-11-20')] });

  it('un bloque libre en marcha no enseña lo que proponga el plan', () => {
    const p = arrancar(ESTADO_INICIAL, C, Date.parse('2026-11-09T16:00:00'), OBJETIVO_LIBRE);
    const v = vista(con, p);
    expect(v.sesion.asignatura).toBeNull();
    expect(v.sesion.tema).toBeNull();
  });

  it('enseña las salidas contadas', () => {
    const p = { ...arrancar(ESTADO_INICIAL, C, Date.parse('2026-11-09T16:00:00'), OBJETIVO_LIBRE), salidas: 2 };
    expect(vista(con, p).sesion.salidas).toBe(2);
  });
});

describe('plan, entregas, clase y repasos', () => {
  it('lo que no cabe va a fuera con aviso', () => {
    const muchos = Array.from({ length: 12 }, (_, i) => tema(`t${i + 1}`, 'a1', `Lección ${i + 1}`));
    const v = vista(datos({ temas: muchos, examenes: [examen('x1', 'a1', '2026-11-11')], prefs: { ...DATOS_VACIOS.prefs, arranqueHecho: true, minutosDia: 60 } }));
    expect(v.plan.bloques.length).toBeGreaterThan(0);
    expect(v.plan.fuera.length).toBeGreaterThan(0);
    expect(v.plan.aviso).toBe(true);
    expect(v.plan.fuera.every((f) => f.hora === null)).toBe(true);
  });

  it('entregas sin cerrar, con su etiqueta', () => {
    const v = vista(
      datos({
        examenes: [
          examen('e1', 'a1', '2026-11-08', { tipo: 'entrega', titulo: 'Práctica' }),
          examen('e2', 'a2', '2026-11-09', { tipo: 'entrega', titulo: 'Deberes' }),
          examen('e3', 'a2', '2026-11-09', { tipo: 'entrega', titulo: 'Hecha', hechaEl: HOY }),
        ],
      }),
    );
    expect(v.entregas.map((e) => e.titulo)).toEqual(['Práctica', 'Deberes']);
    expect(v.entregas[0]?.etiqueta).toBe('Atrasada');
    expect(v.entregas[1]?.etiqueta).toBe('Hoy');
    expect(v.mostrarEntregas).toBe(true);
  });

  it('siguiente clase, y nada en época sin clases', () => {
    const clases = [{ id: 'c1', asignaturaId: 'a2', dia: 1, inicio: 17 * 60, fin: 18 * 60, aula: 'B2' }];
    const c = claseDe(datos({ clases }), HOY, 16 * 60);
    expect(c?.asignatura).toBe('Física');
    expect(c?.cuando).toContain('17:00');
    expect(c?.enCurso).toBe(false);
    expect(claseDe(datos({ clases }), HOY, 17 * 60 + 30)?.enCurso).toBe(true);
    expect(claseDe(datos({ clases, prefs: { ...DATOS_VACIOS.prefs, sinClasesHasta: '2026-11-20' } }), HOY, 16 * 60)).toBeNull();
  });

  it('volver tras un hueco', () => {
    const v = vista(
      datos({
        sesiones: [{ id: 's', asignaturaId: 'a1', temaId: null, fecha: '2026-11-05', minutos: 25, metodo: 'pomodoro', salidas: 0 }],
        temas: [tema('t1', 'a1', 'Integrales', { estado: 'repasando', etapa: 1, repasoEl: '2026-11-07' })],
      }),
    );
    expect(v.hueco?.dias).toBe(4);
    expect(v.hueco?.temaIds).toEqual(['t1']);
    expect(vista(datos({})).hueco).toBeNull();
  });

  it('el examen sin fecha también sale en la lista', () => {
    const v = vista(datos({ examenes: [examen('x1', 'a1', null)], temas: [tema('t1', 'a1', 'Uno')] }));
    expect(v.examenes[0]?.etiqueta).toBe('Sin fecha');
    expect(v.examenes[0]?.conFecha).toBe(false);
  });
});

describe('temaConNumero', () => {
  it('no duplica el número si el nombre ya lo trae', () => {
    const d = datos({ temas: [tema('t1', 'a1', 'Tema 12. La Constitución'), tema('t2', 'a1', 'Series')] });
    expect(temaConNumero(d, 't1')).toBe('Tema 12. La Constitución');
    expect(temaConNumero(d, 't2')).toBe('Tema 2 · Series');
  });
});

describe('tocaDe', () => {
  it('lo elegido que coincide con el plan conserva su motivo', () => {
    const b = bloque({ temaId: 't1', tema: 'Integrales', motivo: { clave: 'repasoHoy', datos: {} }, tipo: 'repasar' });
    const d = datos({ temas: [tema('t1', 'a1', 'Integrales')] });
    const r = tocaDe(d, { asignaturaId: 'a1', temaId: 't1', misionId: null }, { ...planVacio, sinPlan: null, bloques: [b] }, HOY, C);
    expect(r.tipo).toBe('repasar');
    expect(r.motivo).toBe('Hoy toca repasarlo');
    expect(r.elegido).toBe(true);
  });
});

describe('arranque guiado', () => {
  it('junta plantilla y pegado sin repetir', () => {
    expect(nombresDeAsignaturas(['Física'], '- física\nQuímica\n\n  Historia  ')).toEqual(['Física', 'Química', 'Historia']);
  });

  it('la asignatura del examen: la elegida, la única o ninguna', () => {
    expect(asignaturaDelExamen([{ id: 'a' }, { id: 'b' }], 'b')).toBe('b');
    expect(asignaturaDelExamen([{ id: 'a' }], null)).toBe('a');
    expect(asignaturaDelExamen([{ id: 'a' }, { id: 'b' }], null)).toBeNull();
  });

  it('aún sin fecha: sin asignatura no crea nada; con ella, examen sin fecha', () => {
    expect(examenDeArranque(null, '', '', HOY)).toBeNull();
    expect(examenDeArranque('a', '', 'Uno\nDos', HOY)).toEqual({
      asignaturaId: 'a',
      fecha: null,
      temas: [
        { nombre: 'Uno', seccion: null },
        { nombre: 'Dos', seccion: null },
      ],
    });
  });

  it('una fecha ilegible o pasada no pasa', () => {
    expect(examenDeArranque('a', 'mañana', '', HOY)).toBe('fecha_mala');
    expect(examenDeArranque('a', '2026-01-01', '', HOY)).toBe('fecha_mala');
    expect(examenDeArranque('a', '20/11', '', HOY)).toMatchObject({ fecha: '2026-11-20' });
  });
});
