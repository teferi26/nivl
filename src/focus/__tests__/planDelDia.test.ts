// NIVL · FOCUS: el plan v2 con los escenarios reales de la auditoría.
import fs from 'fs';
import path from 'path';
import { diasEntre, sumarDias } from '@/focus/fechas';
import {
  HORA_LIMITE,
  MINUTOS_REPASO_TEMA,
  horasDeBloquesDia,
  minutosBloqueDe,
  planDelDia,
  planHaciaExamen,
  proyectarDias,
  type EntradaDia,
  type ExamenParaDia,
  type TemaParaPlan,
} from '@/focus/planEstudio';
import { CONFIG_POR_DEFECTO } from '@/focus/pomodoro';
import { planDeExamen, planDeHoyCompleto, planDeHoyConHoras, queEstudiarHoy, repasosDeHoy, temasDeExamen } from '@/focus/resumen';
import { DATOS_VACIOS, PREFS_POR_DEFECTO, type DatosFocus, type Examen, type Tema } from '@/focus/tipos';

const HOY = '2026-11-09';
const temas = (n: number, pre = 't', estado: TemaParaPlan['estado'] = 'pendiente'): TemaParaPlan[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${pre}${i + 1}`, estado }));
const examen = (id: string, fecha: string | null, ts: TemaParaPlan[], extra: Partial<ExamenParaDia> = {}): ExamenParaDia => ({
  id,
  asignaturaId: `as-${id}`,
  titulo: id,
  fecha,
  hora: null,
  tipo: 'examen',
  estimada: false,
  peso: null,
  temas: ts,
  ...extra,
});
const entrada = (x: Partial<EntradaDia> = {}): EntradaDia => ({
  hoy: HOY,
  desdeMin: null,
  minutosDia: 120,
  minutosBloque: 50,
  ritmo: { foco: 25, descanso: 5 },
  examenes: [],
  repasos: [],
  ...x,
});
const estudiar = (bs: { tipo: string; temaId: string | null }[]) => bs.filter((b) => b.tipo === 'estudiar').map((b) => b.temaId);

describe('capacidad y prioridad', () => {
  it('opositora: 70 temas a 220 días con 5 h da seis bloques, no uno', () => {
    const p = planDelDia(entrada({ minutosDia: 300, examenes: [examen('opo', sumarDias(HOY, 220), temas(70))] }));
    expect(estudiar(p.bloques)).toEqual(['t1', 't2', 't3', 't4', 't5', 't6']);
    expect(p).toMatchObject({ minutosPlan: 300, minutosDisponibles: 300, avisoNoLlegas: false, sinPlan: null });
  });

  it('opositora: el plan avanza día a día y no se atasca en el tema 1', () => {
    const dias = proyectarDias({
      hoy: HOY,
      minutosDia: 300,
      minutosBloque: 50,
      ritmo: { foco: 25, descanso: 5 },
      examenes: [examen('opo', sumarDias(HOY, 220), temas(70))],
      repasos: [],
      dias: 220,
    });
    const estudiados = dias.flatMap((d) => estudiar(d.plan.bloques));
    expect(new Set(estudiados).size).toBe(70);
    expect(estudiados).toHaveLength(70);
    // Con repasos dentro sigue avanzando varios temas al día al principio.
    expect(estudiar(dias[1]!.plan.bloques).length).toBeGreaterThan(1);
    expect(dias.findIndex((d) => estudiar(d.plan.bloques).includes('t70'))).toBeLessThan(40);
    // Repasos reales del calendario único, nunca a diario.
    const tema1 = dias.filter((d) => d.plan.bloques.some((b) => b.tipo === 'repasar' && b.temaId === 't1')).length;
    expect(tema1).toBeLessThan(15);
  });

  it('marcar repasando no lo repite como estudiar', () => {
    const ts: TemaParaPlan[] = [{ id: 'a', estado: 'repasando', repasoEl: sumarDias(HOY, 5), etapa: 1 }, { id: 'b', estado: 'dominado', repasoEl: sumarDias(HOY, 9), etapa: 2 }, ...temas(2)];
    const p = planDelDia(entrada({ examenes: [examen('x', sumarDias(HOY, 30), ts)], repasos: [{ id: 'a', asignaturaId: 'as-x', vence: sumarDias(HOY, 5) }] }));
    expect(estudiar(p.bloques)).toEqual(['t1', 't2']);
    expect(p.bloques.some((b) => b.temaId === 'a')).toBe(false);
  });

  it('lo vencido vuelve como repaso y no también como estudiar (otra vuelta)', () => {
    const ts: TemaParaPlan[] = [{ id: 'a', estado: 'pendiente', repasoEl: HOY, etapa: 2 }, ...temas(1)];
    const p = planDelDia(entrada({ examenes: [examen('x', sumarDias(HOY, 30), ts)], repasos: [{ id: 'a', asignaturaId: 'as-x', vence: HOY }] }));
    expect(p.bloques.filter((b) => b.temaId === 'a').map((b) => b.tipo)).toEqual(['repasar']);
  });

  it('el peso decide: invertirlo cambia el plan', () => {
    const fecha = sumarDias(HOY, 12);
    const con = (a: number, b: number) =>
      planDelDia(entrada({ examenes: [examen('BD', fecha, temas(10, 'bd'), { peso: a }), examen('Redes', fecha, temas(8, 'r'), { peso: b })] })).bloques[0]!.temaId;
    expect(con(60, 10)).toBe('bd1');
    expect(con(10, 60)).toBe('r1');
  });

  it('el examen más cercano va delante', () => {
    const p = planDelDia(entrada({ examenes: [examen('lejos', sumarDias(HOY, 40), temas(5, 'l')), examen('cerca', sumarDias(HOY, 3), temas(5, 'c'))] }));
    expect(p.bloques[0]!.examenId).toBe('cerca');
  });

  it('empates por hora y título, nunca por uuid', () => {
    const fecha = sumarDias(HOY, 10);
    const a = (id: string) => examen(id, fecha, temas(3, id), { titulo: 'Alfa', asignaturaId: 'a' });
    const b = (id: string) => examen(id, fecha, temas(3, id), { titulo: 'Beta', asignaturaId: 'b' });
    expect(planDelDia(entrada({ examenes: [a('zzz'), b('aaa')] })).bloques[0]!.examenId).toBe('zzz');
    expect(planDelDia(entrada({ examenes: [b('aaa'), a('zzz')] })).bloques[0]!.examenId).toBe('zzz');
    const tarde = examen('aaa', fecha, temas(3, 'aaa'), { titulo: 'Alfa', hora: 16 * 60 });
    const pronto = examen('zzz', fecha, temas(3, 'zzz'), { titulo: 'Zeta', hora: 9 * 60 });
    expect(planDelDia(entrada({ examenes: [tarde, pronto] })).bloques[0]!.examenId).toBe('zzz');
  });

  it('el motivo viaja con claves, sin prosa', () => {
    const p = planDelDia(entrada({ examenes: [examen('x', sumarDias(HOY, 5), temas(1), { titulo: 'Física' })] }));
    expect(p.bloques[0]!.motivo).toEqual({ clave: 'estudiarExamen', datos: { titulo: 'Física', count: 5 } });
  });
});

describe('entregas, repasos y simulacro', () => {
  it('las entregas de <=2 días van primero; las lejanas y las hechas, no', () => {
    const p = planDelDia(
      entrada({
        examenes: [
          examen('tema', sumarDias(HOY, 3), temas(3)),
          examen('ya', HOY, [], { tipo: 'entrega', titulo: 'Deberes' }),
          examen('hecha', HOY, [], { tipo: 'entrega', hechaEl: HOY }),
          examen('lejos', sumarDias(HOY, 3), [], { tipo: 'entrega' }),
        ],
      }),
    );
    expect(p.bloques[0]).toMatchObject({ tipo: 'entrega', examenId: 'ya', motivo: { clave: 'entregaHoy' } });
    expect(p.bloques.some((b) => b.examenId === 'hecha' || b.examenId === 'lejos')).toBe(false);
  });

  it('una entrega nunca genera temario ni simulacro', () => {
    const p = planDelDia(entrada({ examenes: [examen('p', sumarDias(HOY, 1), temas(3), { tipo: 'entrega' })] }));
    expect(p.bloques.map((b) => b.tipo)).toEqual(['entrega']);
    expect(planHaciaExamen({ examenId: 'p', fecha: sumarDias(HOY, 4), temas: [], hoy: HOY, tipo: 'entrega' }).flatMap((d) => d.items).some((i) => i.tipo === 'simulacro')).toBe(false);
  });

  it('el simulacro de la víspera llega a Hoy, detrás de repasos', () => {
    const p = planDelDia(
      entrada({
        minutosDia: 200,
        examenes: [examen('x', sumarDias(HOY, 1), temas(1))],
        repasos: [{ id: 'r', asignaturaId: 'as-x', vence: HOY }],
      }),
    );
    expect(p.bloques.map((b) => b.tipo)).toEqual(['repasar', 'simulacro', 'estudiar']);
    expect(p.bloques[1]!.motivo.clave).toBe('simulacroVispera');
  });

  it('simulacro ya hecho hoy: no se repite', () => {
    const p = planDelDia(entrada({ examenes: [examen('x', sumarDias(HOY, 1), [])], simulacrosHechos: ['as-x'] }));
    expect(p.bloques).toEqual([]);
  });

  it('repasos vencidos con tope del 40 % y sin comerse el día', () => {
    const repasos = Array.from({ length: 12 }, (_, i) => ({ id: `r${i}`, asignaturaId: 'a', vence: sumarDias(HOY, -i - 1) }));
    const p = planDelDia(entrada({ minutosDia: 120, repasos, examenes: [examen('x', sumarDias(HOY, 20), temas(5))] }));
    const dentro = p.bloques.filter((b) => b.tipo === 'repasar');
    expect(dentro.length * MINUTOS_REPASO_TEMA).toBeLessThanOrEqual(48);
    expect(dentro.map((b) => b.temaId)).toEqual(['r11', 'r10', 'r9', 'r8']);
    expect(dentro[0]!.motivo).toEqual({ clave: 'repasoAtrasado', datos: { count: 12 } });
    expect(p.fuera.filter((b) => b.tipo === 'repasar')).toHaveLength(8);
    expect(estudiar(p.bloques).length).toBeGreaterThan(0);
    expect(p.avisoNoLlegas).toBe(true);
  });

  it('las tarjetas son una tanda de 2 min cada una, con tope compartido', () => {
    const p = planDelDia(entrada({ minutosDia: 100, tarjetasVencidas: 50 }));
    expect(p.bloques).toEqual([expect.objectContaining({ tipo: 'repasar', temaId: null, minutos: 40, motivo: { clave: 'repasoTarjetas', datos: { count: 20 } } })]);
    expect(p.fuera[0]).toMatchObject({ motivo: { clave: 'repasoTarjetas', datos: { count: 30 } } });
  });
});

describe('no llegas y sin fecha', () => {
  const cuatro = (n: number) => [
    examen('EDA', sumarDias(HOY, 3), temas(n, 'e')),
    examen('BD', sumarDias(HOY, 8), temas(n, 'b')),
    examen('Redes', sumarDias(HOY, 8), temas(n, 'r')),
    examen('Calculo', sumarDias(HOY, 12), temas(n, 'c')),
  ];

  it('4 exámenes en 12 días: con 5 h caben', () => {
    const p = planDelDia(entrada({ minutosDia: 300, examenes: cuatro(10) }));
    expect(p.avisoNoLlegas).toBe(false);
    expect(p.fuera).toEqual([]);
    expect(p.minutosPlan).toBeLessThanOrEqual(300);
  });

  it('4 exámenes en 12 días: con 2 h avisa y lo que no cabe queda fuera', () => {
    const p = planDelDia(entrada({ minutosDia: 120, examenes: cuatro(10) }));
    expect(p.avisoNoLlegas).toBe(true);
    expect(p.fuera.length).toBeGreaterThan(10);
    expect(p.minutosPlan).toBeLessThanOrEqual(120);
  });

  it('nunca pasa de las 22:30 ni de medianoche', () => {
    for (const desdeMin of [8 * 60, 16 * 60, 21 * 60, 22 * 60]) {
      const e = entrada({ desdeMin, minutosDia: 900, examenes: [examen('x', sumarDias(HOY, 2), temas(40))], tarjetasVencidas: 20, repasos: [{ id: 'r', asignaturaId: 'as-x', vence: HOY }] });
      const p = planDelDia(e);
      const horas = horasDeBloquesDia(p.bloques, desdeMin, e.ritmo);
      p.bloques.forEach((b, i) => expect(horas[i]! + b.minutos).toBeLessThanOrEqual(HORA_LIMITE));
    }
  });

  it('a las 22:30 ya es tarde', () => {
    expect(planDelDia(entrada({ desdeMin: HORA_LIMITE, examenes: [examen('x', sumarDias(HOY, 9), temas(3))] })).sinPlan).toBe('tarde');
  });

  it('sin fecha o estimada: avanza en orden y sin simulacro', () => {
    for (const ex of [examen('s', null, temas(4)), examen('s', sumarDias(HOY, 1), temas(4), { estimada: true })]) {
      const p = planDelDia(entrada({ examenes: [ex] }));
      expect(p.bloques.map((b) => b.tipo)).toEqual(['estudiar', 'estudiar', 'estudiar']);
      expect(estudiar(p.bloques)).toEqual(['t1', 't2', 't3']);
      expect(p.bloques[0]!.motivo.clave).toBe(ex.fecha ? 'estudiarEstimada' : 'estudiarSinFecha');
    }
  });

  it('examen hoy por la tarde: se estudia hasta media hora antes; sin hora, nada', () => {
    const conHora = planDelDia(entrada({ desdeMin: 9 * 60, examenes: [examen('x', HOY, temas(6), { hora: 11 * 60 })] }));
    expect(conHora.bloques.length).toBeGreaterThan(0);
    const horas = horasDeBloquesDia(conHora.bloques, 9 * 60, { foco: 25, descanso: 5 });
    conHora.bloques.forEach((b, i) => expect(horas[i]! + b.minutos).toBeLessThanOrEqual(10 * 60 + 30));
    expect(planDelDia(entrada({ examenes: [examen('x', HOY, temas(6))] })).bloques).toEqual([]);
  });

  it('lo ya estudiado hoy resta capacidad y dice por qué no hay plan', () => {
    const p = planDelDia(entrada({ minutosDia: 120, minutosHechos: 120, examenes: [examen('x', sumarDias(HOY, 9), temas(3))] }));
    expect(p).toMatchObject({ bloques: [], sinPlan: 'cupo_cubierto', minutosDisponibles: 0 });
  });

  it('motivos de plan vacío', () => {
    expect(planDelDia(entrada()).sinPlan).toBe('nada_que_planificar');
    expect(planDelDia(entrada({ examenes: [examen('x', sumarDias(HOY, 9), [])] })).sinPlan).toBe('sin_temas');
    expect(planDelDia(entrada({ examenes: [examen('x', sumarDias(HOY, 9), temas(2, 't', 'dominado'))] })).sinPlan).toBe('al_dia');
  });

  it('el bloque son pomodoros enteros de unos 50 min', () => {
    expect([25, 50, 45, 30, 90, 10].map(minutosBloqueDe)).toEqual([50, 50, 45, 60, 90, 50]);
  });
});

describe('proyección hacia un examen', () => {
  it('solo promete lo que cabe y comparte capacidad con los demás', () => {
    const fecha = sumarDias(HOY, 3);
    const sola = planHaciaExamen({ examenId: 'x', fecha, temas: temas(20), hoy: HOY, minutosDia: 100, asignaturaId: 'a' });
    expect(sola.flatMap((d) => d.items).filter((i) => i.tipo === 'estudiar').length).toBeLessThan(20);
    expect(sola[2]!.items.some((i) => i.tipo === 'simulacro')).toBe(true);
    const conOtro = planHaciaExamen({ examenId: 'x', fecha: sumarDias(HOY, 8), temas: temas(4), hoy: HOY, minutosDia: 100, asignaturaId: 'a', otros: [examen('urg', sumarDias(HOY, 2), temas(6, 'u'))] });
    expect(conOtro.find((d) => d.items.length > 0)!.fecha).not.toBe(HOY);
    expect(diasEntre(HOY, conOtro.at(-1)!.fecha)).toBe(7);
  });

  it('sin fecha: horizonte acotado y sin simulacro', () => {
    const p = planHaciaExamen({ examenId: 'x', fecha: null, temas: temas(4), hoy: HOY, asignaturaId: 'a' });
    expect(p.length).toBeLessThanOrEqual(120);
    expect(p.flatMap((d) => d.items).some((i) => i.tipo === 'simulacro')).toBe(false);
  });
});

describe('resumen con el plan v2', () => {
  const tema = (id: string, asignaturaId: string, posicion: number, extra: Partial<Tema> = {}): Tema => ({
    id,
    asignaturaId,
    examenId: null,
    nombre: `Nombre ${id}`,
    estado: 'pendiente',
    posicion,
    etapa: 0,
    repasoEl: null,
    seccion: null,
    repasadoEl: null,
    ...extra,
  });
  const ex = (id: string, asignaturaId: string, fecha: string | null, extra: Partial<Examen> = {}): Examen => ({
    id,
    asignaturaId,
    titulo: id,
    fecha,
    peso: null,
    hora: null,
    tipo: 'examen',
    estimada: false,
    hechaEl: null,
    ...extra,
  });
  const asig = (id: string) => ({ id, nombre: `Asig ${id}`, posicion: 0, notaObjetivo: null, vuelta: 1 });
  const lunes = '2026-11-09';
  const base: DatosFocus = {
    ...DATOS_VACIOS,
    asignaturas: [asig('a')],
    examenes: [ex('x', 'a', sumarDias(lunes, 10))],
    temas: [tema('t1', 'a', 0), tema('t2', 'a', 1), tema('t3', 'a', 2)],
    clases: [{ id: 'c', asignaturaId: 'a', dia: 1, inicio: 9 * 60, fin: 14 * 60, aula: null }],
  };

  it('empieza tras la última clase, salvo en época sin clases', () => {
    expect(planDeHoyConHoras(base, lunes, 8 * 60, CONFIG_POR_DEFECTO)[0]!.hora).toBe(14 * 60 + 30);
    const sin = { ...base, prefs: { ...PREFS_POR_DEFECTO, sinClasesHasta: sumarDias(lunes, 3) } };
    expect(planDeHoyConHoras(sin, lunes, 8 * 60, CONFIG_POR_DEFECTO)[0]!.hora).toBe(8 * 60);
  });

  it('qué estudiar hoy: el primer bloque, con motivo', () => {
    expect(queEstudiarHoy(base, lunes, 15 * 60, CONFIG_POR_DEFECTO)).toMatchObject({ tema: 'Nombre t1', asignatura: 'Asig a', minutos: 50, motivo: { clave: 'estudiarExamen' } });
    expect(queEstudiarHoy(DATOS_VACIOS, lunes, 15 * 60, CONFIG_POR_DEFECTO)).toBeNull();
  });

  it('sin asignatura viva no hay temas ni repasos', () => {
    const d: DatosFocus = { ...base, temas: [...base.temas, tema('z', 'archivada', 0, { repasoEl: lunes })] };
    expect(repasosDeHoy(d, lunes).temas).toEqual([]);
    expect(planDeHoyCompleto(d, lunes, 15 * 60, CONFIG_POR_DEFECTO).bloques.some((b) => b.temaId === 'z')).toBe(false);
  });

  it('el temario general cuenta para cualquier examen, sin duplicar el mismo día', () => {
    const d: DatosFocus = { ...base, examenes: [ex('p', 'a', sumarDias(lunes, 5)), ex('f', 'a', sumarDias(lunes, 30))], prefs: { ...PREFS_POR_DEFECTO, minutosDia: 300 } };
    expect(temasDeExamen(d, d.examenes[1]!).map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    const ids = planDeHoyCompleto(d, lunes, 9 * 60, CONFIG_POR_DEFECTO).bloques.map((b) => b.temaId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['t1', 't2', 't3']);
  });

  it('una asignatura sin examen avanza en orden de temario', () => {
    const d: DatosFocus = { ...base, examenes: [], asignaturas: [asig('a')] };
    expect(planDeHoyCompleto(d, lunes, 15 * 60, CONFIG_POR_DEFECTO).bloques[0]).toMatchObject({ temaId: 't1', examenId: null, motivo: { clave: 'estudiarTemario' } });
  });

  it('un examen estimado se trata como sin fecha en su hoja', () => {
    const d: DatosFocus = { ...base, examenes: [ex('e', 'a', sumarDias(lunes, 2), { estimada: true })] };
    expect(planDeExamen(d, d.examenes[0]!, lunes).flatMap((x) => x.items).some((i) => i.tipo === 'simulacro')).toBe(false);
  });
});

describe('claves de motivo en es/focus.json', () => {
  it('toda clave del plan tiene texto (plural incluido)', () => {
    const fuente = fs.readFileSync(path.resolve(__dirname, '..', 'planEstudio.ts'), 'utf8');
    const j = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'i18n', 'es', 'focus.json'), 'utf8'));
    const claves = new Set([...fuente.matchAll(/'(entrega\w+|repaso[A-Z]\w+|simulacroVispera|estudiar[A-Z]\w*)'/g)].map((m) => m[1]!));
    expect(claves.size).toBeGreaterThanOrEqual(10);
    for (const c of claves) expect(typeof (j.motivo[c] ?? j.motivo[`${c}_other`])).toBe('string');
    for (const m of ['tarde', 'cupo_cubierto', 'sin_temas', 'al_dia', 'nada_que_planificar']) expect(typeof j.sinPlan[m]).toBe('string');
  });
});
