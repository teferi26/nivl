import {
  clavePerfil,
  diaMes,
  entregasHechas,
  esSimulacro,
  evolucionDe,
  fechasRapidas,
  leerEntero,
  leerFormEntrega,
  leerFormExamen,
  leerFormSimulacro,
  leerObjetivo,
  modoFechaDe,
  nombreNota,
  notaDeSimulacro,
  plazoDe,
  resumenDia,
  simulacrosPorAsignatura,
  sinSimulacros,
} from '@/focus/agenda';
import { vistaExamenes } from '@/components/focus/vistas';
import { media } from '@/focus/notas';
import { notasPorAsignatura } from '@/focus/resumen';
import { resultadoSimulacroTest } from '@/focus/simulacroTest';
import { semanaDe } from '@/focus/semana';
import { DATOS_VACIOS, type Asignatura, type DatosFocus, type Examen } from '@/focus/tipos';
import es from '@/i18n/es/focus.json';

const HOY = '2026-11-08';

const asignatura = (id: string, nombre: string): Asignatura => ({ id, nombre, posicion: 0, notaObjetivo: null, vuelta: 1 });
const examen = (id: string, c: Partial<Examen> = {}): Examen => ({
  id,
  asignaturaId: 'a',
  titulo: id,
  fecha: HOY,
  peso: null,
  hora: null,
  tipo: 'examen',
  estimada: false,
  hechaEl: null,
  ...c,
});
const datos = (c: Partial<DatosFocus>): DatosFocus => ({ ...DATOS_VACIOS, asignaturas: [asignatura('a', 'Redes')], ...c });

describe('fechas rápidas', () => {
  it('una entrega ofrece hoy, mañana y una semana', () => {
    expect(fechasRapidas(HOY, 'entrega')).toEqual([
      { clave: 'hoy', fecha: '2026-11-08' },
      { clave: 'manana', fecha: '2026-11-09' },
      { clave: 'unaSemana', fecha: '2026-11-15' },
    ]);
  });

  it('un examen empieza en mañana y llega a un mes', () => {
    const f = fechasRapidas(HOY, 'examen');
    expect(f[0]).toEqual({ clave: 'manana', fecha: '2026-11-09' });
    expect(f[f.length - 1]).toEqual({ clave: 'unMes', fecha: '2026-12-08' });
  });
});

describe('formulario de examen', () => {
  const base = { modo: 'fija' as const, fecha: '2/2/2027', hora: '', peso: '' };

  it('con fecha y hora', () => {
    const r = leerFormExamen({ ...base, hora: '16:00', peso: '40' }, HOY);
    expect(r).toMatchObject({ fecha: '2027-02-02', estimada: false, hora: 960, peso: 40, ok: true });
  });

  it('aún sin fecha no pide fecha y no guarda hora', () => {
    const r = leerFormExamen({ modo: 'sin', fecha: 'lo que sea', hora: '16:00', peso: '' }, HOY);
    expect(r).toMatchObject({ fecha: null, estimada: false, hora: null, ok: true });
  });

  it('fecha aproximada: se marca y la hora no cuenta', () => {
    const r = leerFormExamen({ ...base, modo: 'aproximada', hora: 'basura' }, HOY);
    expect(r).toMatchObject({ fecha: '2027-02-02', estimada: true, hora: null, ok: true });
  });

  it('con fecha, la fecha es obligatoria', () => {
    const r = leerFormExamen({ ...base, fecha: 'junio' }, HOY);
    expect(r.errores.fecha).toBe(true);
    expect(r.ok).toBe(false);
  });

  it('avisa de hora y peso imposibles', () => {
    expect(leerFormExamen({ ...base, hora: '30:00' }, HOY).errores.hora).toBe(true);
    expect(leerFormExamen({ ...base, peso: '0' }, HOY).errores.peso).toBe(true);
    expect(leerFormExamen({ ...base, peso: '101' }, HOY).errores.peso).toBe(true);
  });

  it('modoFechaDe devuelve lo guardado a la hoja', () => {
    expect(modoFechaDe({ fecha: null, estimada: false })).toBe('sin');
    expect(modoFechaDe({ fecha: HOY, estimada: true })).toBe('aproximada');
    expect(modoFechaDe({ fecha: HOY, estimada: false })).toBe('fija');
  });
});

describe('formulario de entrega', () => {
  it('pide fecha', () => {
    expect(leerFormEntrega({ fecha: '', hora: '' }, HOY).ok).toBe(false);
  });

  it('deja seguir sin fecha si ya venía sin ella', () => {
    expect(leerFormEntrega({ fecha: '', hora: '', fechaOpcional: true }, HOY)).toMatchObject({ fecha: null, ok: true });
  });

  it('una fecha mal escrita no pasa aunque sea opcional', () => {
    expect(leerFormEntrega({ fecha: 'mañana', hora: '', fechaOpcional: true }, HOY).ok).toBe(false);
  });

  it('hora opcional', () => {
    expect(leerFormEntrega({ fecha: '9/11', hora: '' }, HOY)).toMatchObject({ fecha: '2026-11-09', hora: null, ok: true });
    expect(leerFormEntrega({ fecha: '9/11', hora: '14:00' }, HOY).hora).toBe(840);
  });
});

describe('objetivo', () => {
  it('vacío vuelve al 5', () => expect(leerObjetivo(' ')).toEqual({ valor: null, ok: true }));
  it('lee coma', () => expect(leerObjetivo('7,5')).toEqual({ valor: 7.5, ok: true }));
  it.each(['0', '10,5', 'siete'])('rechaza %s', (s) => expect(leerObjetivo(s).ok).toBe(false));
});

describe('perfil', () => {
  it('sin perfil, general', () => {
    expect(clavePerfil(null)).toBe('general');
    expect(clavePerfil('oposicion')).toBe('oposicion');
  });
});

describe('semana', () => {
  const d = datos({
    clases: [
      { id: 'c1', asignaturaId: 'a', dia: 1, inicio: 480, fin: 600, aula: null },
      { id: 'c2', asignaturaId: 'a', dia: 1, inicio: 660, fin: 870, aula: 'B2' },
    ],
    examenes: [examen('tarde', { fecha: '2026-11-09', hora: 960 }), examen('sin-hora', { fecha: '2026-11-09' }), examen('p', { fecha: '2026-11-09', hora: 540, tipo: 'entrega' })],
  });

  it('separa las clases de lo que tiene fecha y da su franja', () => {
    const lunes = resumenDia(semanaDe(d, '2026-11-09')[0]!, HOY);
    expect(lunes.clases.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(lunes.clasesDesde).toBe(480);
    expect(lunes.clasesHasta).toBe(870);
    expect(lunes.esHoy).toBe(false);
  });

  it('lo fechado va por hora y lo que no tiene hora, al final', () => {
    const lunes = resumenDia(semanaDe(d, '2026-11-09')[0]!, HOY);
    expect(lunes.fechados.map((x) => x.id)).toEqual(['p', 'tarde', 'sin-hora']);
  });

  it('un día sin clases no inventa franja', () => {
    const martes = resumenDia(semanaDe(d, '2026-11-09')[1]!, '2026-11-10');
    expect(martes.clasesDesde).toBeNull();
    expect(martes.clasesHasta).toBeNull();
    expect(martes.esHoy).toBe(true);
  });

  it('diaMes', () => expect(diaMes('2026-02-09')).toBe('9/2'));
});

describe('plazos', () => {
  it('cada caso', () => {
    expect(plazoDe(null)).toEqual({ clave: 'sinFecha' });
    expect(plazoDe(-2)).toEqual({ clave: 'vencida', count: 2 });
    expect(plazoDe(0)).toEqual({ clave: 'hoy' });
    expect(plazoDe(1)).toEqual({ clave: 'manana' });
    expect(plazoDe(5)).toEqual({ clave: 'dias', count: 5 });
  });
});

describe('entregas hechas', () => {
  it('las últimas primero, sin pendientes ni exámenes ni archivadas', () => {
    const d = datos({
      examenes: [
        examen('vieja', { tipo: 'entrega', hechaEl: '2026-10-01' }),
        examen('nueva', { tipo: 'entrega', hechaEl: '2026-11-05' }),
        examen('pendiente', { tipo: 'entrega' }),
        examen('examen', { hechaEl: '2026-11-07' }),
        examen('archivada', { tipo: 'entrega', hechaEl: '2026-11-07', asignaturaId: 'x' }),
      ],
    });
    expect(entregasHechas(d).map((x) => x.examen.id)).toEqual(['nueva', 'vieja']);
    expect(entregasHechas(d, 1).map((x) => x.examen.id)).toEqual(['nueva']);
  });
});

describe('simulacros como nota', () => {
  const r = resultadoSimulacroTest({ aciertos: 70, fallos: 20, blancos: 10, penalizacion: 1 / 3 })!;

  it('se guarda sobre 10, sin peso y con la marca', () => {
    const n = notaDeSimulacro('a', 'Bloque II', HOY, r);
    expect(n).toMatchObject({ asignaturaId: 'a', nota: 6.33, sobre: 10, peso: null, fecha: HOY });
    expect(esSimulacro(n)).toBe(true);
    expect(nombreNota(n)).toBe('Bloque II');
  });

  it('sin nombre usa la fecha', () => {
    expect(nombreNota(notaDeSimulacro('a', '  ', HOY, r))).toBe('8/11/2026');
  });

  it('el título cabe en la columna', () => {
    expect(notaDeSimulacro('a', 'x'.repeat(300), HOY, r).titulo.length).toBeLessThanOrEqual(120);
  });

  it('neto negativo se guarda como 0: la tabla no admite negativos', () => {
    const malo = resultadoSimulacroTest({ aciertos: 1, fallos: 9, blancos: 0, penalizacion: 1, netoNegativo: true })!;
    expect(malo.nota).toBeLessThan(0);
    expect(notaDeSimulacro('a', '', HOY, malo).nota).toBe(0);
  });

  it('una nota normal no es simulacro aunque se parezca', () => {
    expect(esSimulacro({ titulo: 'Test tema 1', peso: null })).toBe(false);
    expect(esSimulacro({ titulo: 'Test · 1', peso: 40 })).toBe(false);
    expect(nombreNota({ titulo: 'Parcial', peso: null })).toBe('Parcial');
  });

  const conNotas = datos({
    notas: [
      { id: '1', asignaturaId: 'a', titulo: 'Control', nota: 8, sobre: 10, peso: null, fecha: '2026-10-01' },
      { id: '2', ...notaDeSimulacro('a', 'A', '2026-10-05', r), nota: 2 },
      { id: '3', ...notaDeSimulacro('a', 'B', '2026-10-09', r), nota: 4 },
    ],
  });

  it('no cuentan en la media de la asignatura', () => {
    const n = notasPorAsignatura(sinSimulacros(conNotas));
    expect(n).toHaveLength(1);
    expect(n[0]!.media.media).toBe(8);
    expect(media(conNotas.notas).media).not.toBe(8);
  });

  it('la evolución solo mira los simulacros, de antiguo a reciente', () => {
    const e = evolucionDe(conNotas, 'a');
    expect(e.puntos.map((p) => p.nota)).toEqual([2, 4]);
    expect(e.ultima).toBe(4);
    expect(e.cambio).toBe(2);
  });

  it('solo salen las asignaturas con algún simulacro', () => {
    const d = { ...conNotas, asignaturas: [asignatura('a', 'Redes'), asignatura('b', 'Física')] };
    expect(simulacrosPorAsignatura(d).map((x) => x.asignaturaId)).toEqual(['a']);
  });
});

describe('formulario de simulacro', () => {
  const f = { aciertos: '70', fallos: '20', blancos: '10', penalizacion: 1 / 3, netoNegativo: false };

  it('calcula neto y nota', () => {
    expect(leerFormSimulacro(f)).toMatchObject({ total: 100, neto: 63.33, nota: 6.33 });
  });

  it('un campo vacío vale 0', () => {
    expect(leerFormSimulacro({ ...f, blancos: '' })?.total).toBe(90);
    expect(leerEntero('')).toBe(0);
  });

  it('nada escrito no da resultado', () => {
    expect(leerFormSimulacro({ ...f, aciertos: '', fallos: '', blancos: '' })).toBeNull();
  });

  it('un valor imposible no da resultado', () => {
    expect(leerFormSimulacro({ ...f, aciertos: '7,5' })).toBeNull();
    expect(leerFormSimulacro({ ...f, penalizacion: null })).toBeNull();
    expect(leerEntero('-1')).toBeNull();
  });
});

describe('vista de Exámenes', () => {
  const r = resultadoSimulacroTest({ aciertos: 8, fallos: 2, blancos: 0, penalizacion: 0 })!;
  const d: DatosFocus = {
    ...DATOS_VACIOS,
    asignaturas: [asignatura('a', 'Redes'), asignatura('b', 'Física')],
    temas: [],
    examenes: [
      examen('sin', { fecha: null }),
      examen('junio', { fecha: '2027-06-16', estimada: true, asignaturaId: 'b' }),
      examen('deberes', { fecha: '2026-11-09', tipo: 'entrega' }),
    ],
    notas: [{ id: '1', ...notaDeSimulacro('b', '', HOY, r) }],
  };

  it('por defecto mira esta semana y navega a la que se pida', () => {
    const esta = vistaExamenes(d, HOY);
    expect(esta.lunes).toBe('2026-11-02');
    expect(esta.domingo).toBe('2026-11-08');
    expect(esta.esEstaSemana).toBe(true);
    expect(esta.semana.find((x) => x.esHoy)?.fecha).toBe(HOY);
    const otra = vistaExamenes(d, HOY, { lunes: '2026-11-09' });
    expect(otra.esEstaSemana).toBe(false);
    expect(otra.semana[0]!.fechados.map((x) => x.id)).toEqual(['deberes']);
  });

  it('separa entregas, con fecha y sin fecha', () => {
    const v = vistaExamenes(d, HOY);
    expect(v.entregas.map((x) => x.examen.id)).toEqual(['deberes']);
    expect(v.proximos.map((x) => x.examen.id)).toEqual(['junio']);
    expect(v.sinFecha.map((x) => x.examen.id)).toEqual(['sin']);
  });

  it('sin temas no enseña un plan vacío', () => {
    expect(vistaExamenes(d, HOY).plan).toBeNull();
  });

  it('el simulacro va a su tarjeta y no a las notas: la asignatura sigue admitiendo objetivo', () => {
    const v = vistaExamenes(d, HOY);
    expect(v.notas).toEqual([]);
    expect(v.mediaGlobal).toBeNull();
    expect(v.sinNotas.map((a) => a.id)).toEqual(['a', 'b']);
    expect(v.simulacros.map((s) => s.asignaturaId)).toEqual(['b']);
  });

  it('las etiquetas salen del perfil guardado', () => {
    expect(vistaExamenes(d, HOY).perfil).toBe('general');
    expect(vistaExamenes({ ...d, prefs: { ...d.prefs, perfil: 'instituto' } }, HOY).perfil).toBe('instituto');
  });
});

describe('textos de la agenda', () => {
  const agenda = es.agenda as { perfil: Record<string, Record<string, string>> };

  it('los cuatro perfiles tienen las mismas etiquetas', () => {
    const claves = Object.keys(agenda.perfil.general!).sort();
    for (const p of ['oposicion', 'universidad', 'instituto']) expect(Object.keys(agenda.perfil[p]!).sort()).toEqual(claves);
  });

  it('cada tipo de la semana tiene etiqueta', () => {
    for (const tipo of ['examen', 'entrega', 'prueba']) expect(agenda.perfil.general![tipo]).toBeTruthy();
  });

  it('«Parcial» solo sale en universidad', () => {
    for (const p of ['general', 'oposicion', 'instituto']) expect(JSON.stringify(agenda.perfil[p])).not.toMatch(/Parcial/);
  });

  it('sin guion largo ni medio', () => {
    expect(JSON.stringify(es.agenda)).not.toMatch(/[—–]/);
  });
});
