import { DATOS_VACIOS, type DatosWork, type Entrega, type Proyecto, type Revision, type SesionTrabajo } from '@/work/tipos';
import type { MisionSemana } from '@/work/semana';
import {
  construirRevision,
  detalleProyecto,
  diaDeLasTres,
  duracion,
  leerFecha,
  leerTarifa,
  opcionesFecha,
  pasoAnterior,
  pasoSiguiente,
  razonesDe,
  tresIniciales,
  vistaCarga,
  vistaHoras,
  vistaProyectos,
  vistaRevision,
} from '../vistas';

const HOY = '2026-10-21'; // miércoles

const proyecto = (id: string, o: Partial<Proyecto> = {}): Proyecto => ({ id, nombre: `P ${id}`, cliente: null, tarifaHora: null, estado: 'activo', posicion: 0, ...o });
const entrega = (id: string, o: Partial<Entrega> = {}): Entrega => ({ id, proyectoId: null, titulo: `E ${id}`, fecha: null, hecha: false, hechaEl: null, posicion: 0, ...o });
const sesion = (id: string, o: Partial<SesionTrabajo> = {}): SesionTrabajo => ({
  id,
  clientId: id,
  proyectoId: null,
  entregaId: null,
  questId: null,
  tipo: 'bloque',
  fecha: HOY,
  inicioMin: 600,
  minutos: 50,
  facturable: false,
  facturadaEl: null,
  nota: null,
  ...o,
});
const datos = (o: Partial<DatosWork>): DatosWork => ({ ...DATOS_VACIOS, ...o });

describe('lectura de lo escrito', () => {
  it('duracion', () => {
    expect(duracion(45)).toBe('45 min');
    expect(duracion(120)).toBe('2 h');
    expect(duracion(125)).toBe('2 h 05');
  });

  it('leerTarifa', () => {
    expect(leerTarifa('')).toEqual({ ok: true, valor: null });
    expect(leerTarifa('0')).toEqual({ ok: true, valor: null });
    expect(leerTarifa('45,5 €')).toEqual({ ok: true, valor: 45.5 });
    expect(leerTarifa('abc')).toEqual({ ok: false });
    expect(leerTarifa('-3')).toEqual({ ok: false });
    expect(leerTarifa('100001')).toEqual({ ok: false });
  });

  it('leerFecha: la próxima vez que caiga', () => {
    expect(leerFecha('28/11', HOY)).toBe('2026-11-28');
    expect(leerFecha('3/1', HOY)).toBe('2027-01-03');
    expect(leerFecha('21/10', HOY)).toBe(HOY);
    expect(leerFecha('28/11/27', HOY)).toBe('2027-11-28');
    expect(leerFecha('2026-11-28', HOY)).toBe('2026-11-28');
  });

  it('leerFecha: lo que no existe', () => {
    expect(leerFecha('31/2', HOY)).toBeNull();
    expect(leerFecha('mañana', HOY)).toBeNull();
    expect(leerFecha('', HOY)).toBeNull();
  });

  it('opcionesFecha: viernes próximo y sin duplicados', () => {
    expect(opcionesFecha(HOY).find((o) => o.codigo === 'viernes')?.fecha).toBe('2026-10-23');
    // Jueves: mañana ya es viernes.
    expect(opcionesFecha('2026-10-22').map((o) => o.codigo)).toEqual(['hoy', 'manana', 'semana']);
    // Viernes: el de la semana que viene coincide con «en 7 días».
    expect(opcionesFecha('2026-10-23').map((o) => o.codigo)).toEqual(['hoy', 'manana', 'viernes']);
  });
});

describe('vistaProyectos', () => {
  it('vacío solo sin proyectos ni entregas sueltas', () => {
    expect(vistaProyectos(DATOS_VACIOS, HOY).vacio).toBe(true);
    expect(vistaProyectos(datos({ entregas: [entrega('a')] }), HOY).vacio).toBe(false);
  });

  it('separa activos, otros y sueltas', () => {
    const v = vistaProyectos(
      datos({
        proyectos: [proyecto('a'), proyecto('b', { estado: 'pausado' }), proyecto('c', { estado: 'cerrado' })],
        entregas: [entrega('1', { proyectoId: 'a', fecha: HOY }), entrega('2'), entrega('3', { hecha: true, hechaEl: HOY })],
      }),
      HOY,
    );
    expect(v.activos.map((r) => r.proyecto.id)).toEqual(['a']);
    expect(v.activos[0]?.proxima?.riesgo).toBe('hoy');
    expect(v.otros.map((p) => p.id)).toEqual(['b', 'c']);
    expect(v.sueltas.map((e) => e.id)).toEqual(['2']);
  });

  it('detalle: pendientes por urgencia, hechas recientes y proyecto inexistente', () => {
    const d = datos({
      proyectos: [proyecto('a')],
      entregas: [
        entrega('tarde', { proyectoId: 'a', fecha: '2026-12-01' }),
        entrega('ya', { proyectoId: 'a', fecha: '2026-10-20' }),
        entrega('h1', { proyectoId: 'a', hecha: true, hechaEl: '2026-10-01' }),
        entrega('h2', { proyectoId: 'a', hecha: true, hechaEl: '2026-10-15' }),
      ],
    });
    const v = detalleProyecto('a', d, HOY);
    expect(v?.pendientes.map((e) => e.id)).toEqual(['ya', 'tarde']);
    expect(v?.hechas.map((e) => e.id)).toEqual(['h2', 'h1']);
    expect(detalleProyecto('nada', d, HOY)).toBeNull();
  });
});

describe('vistaHoras', () => {
  const proyectos = [proyecto('a', { tarifaHora: 60 }), proyecto('b')];

  it('hoy y semana van por separado', () => {
    const v = vistaHoras(datos({ proyectos, sesiones: [sesion('1', { proyectoId: 'a' }), sesion('2', { proyectoId: 'a', fecha: '2026-10-19', tipo: 'manual', minutos: 30 })] }), HOY);
    expect(v.hoyMin).toBe(50);
    expect(v.hoyProfundos).toBe(50);
    expect(v.semana.minutos).toBe(80);
    expect(v.filasHoy[0]?.minutos).toBe(50);
    expect(v.filasSemana[0]?.minutos).toBe(80);
  });

  it('la semana pasada no suma a esta', () => {
    expect(vistaHoras(datos({ sesiones: [sesion('1', { fecha: '2026-10-18' })] }), HOY).semana.minutos).toBe(0);
  });

  it('por facturar: importe con tarifa, sin tarifa aparte, y lo facturado fuera', () => {
    const v = vistaHoras(
      datos({
        proyectos,
        sesiones: [
          sesion('1', { proyectoId: 'a', facturable: true, minutos: 90, fecha: '2026-10-05' }),
          sesion('2', { proyectoId: 'b', facturable: true, minutos: 30 }),
          sesion('3', { proyectoId: 'a', facturable: true, facturadaEl: HOY }),
          sesion('4', { proyectoId: 'a', facturable: false }),
        ],
      }),
      HOY,
    );
    expect(v.porFacturar.filas.find((f) => f.proyectoId === 'a')).toMatchObject({ porFacturarMin: 90, porFacturarImporte: 90, ids: ['1'] });
    expect(v.porFacturar.filas.find((f) => f.proyectoId === 'b')).toMatchObject({ porFacturarImporte: null, ids: ['2'] });
    expect(v.porFacturar.total.porFacturarImporte).toBe(90);
    expect(v.porFacturar.total.porFacturarSinTarifaMin).toBe(30);
  });

  it('las horas de un proyecto borrado se facturan como sin proyecto', () => {
    const v = vistaHoras(datos({ sesiones: [sesion('1', { proyectoId: 'fantasma', facturable: true })] }), HOY);
    expect(v.porFacturar.filas[0]).toMatchObject({ proyectoId: null, ids: ['1'] });
  });

  it('solo lo apuntado a mano se puede borrar', () => {
    const v = vistaHoras(datos({ proyectos, sesiones: [sesion('1'), sesion('2', { tipo: 'manual', inicioMin: null, proyectoId: 'a' })] }), HOY);
    expect(v.apuntes.map((a) => [a.sesion.id, a.borrable, a.proyecto])).toEqual([
      ['1', false, null],
      ['2', true, 'P a'],
    ]);
  });
});

describe('vistaCarga', () => {
  it('sin nada que medir lo dice', () => {
    expect(vistaCarga(DATOS_VACIOS, HOY).sinDatos).toBe(true);
  });

  it('con trabajo calcula y solo propone soltar en carga alta', () => {
    const tardes = ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', HOY].map((fecha, i) => sesion(String(i), { fecha, inicioMin: 1200, minutos: 90 }));
    const v = vistaCarga({ eventos: [], sesiones: tardes }, HOY);
    expect(v.sinDatos).toBe(false);
    expect(v.nivel).toBe('alta');
    expect(v.soltar).not.toBeNull();
    expect(vistaCarga({ eventos: [], sesiones: [sesion('1')] }, HOY).soltar).toBeNull();
  });
});

describe('vistaRevision', () => {
  const misiones: MisionSemana[] = [
    { id: 'm1', titulo: 'Hecha', fecha: '2026-10-14', hecha: true, prioridad: true },
    { id: 'm2', titulo: 'Quedada', fecha: '2026-10-15', hecha: false, prioridad: true },
  ];

  it('de lunes a jueves revisa la semana pasada y las tres son para hoy', () => {
    const v = vistaRevision(DATOS_VACIOS, misiones, HOY);
    expect(v.lunes).toBe('2026-10-12');
    expect(v.dia).toBe(HOY);
    expect(v.vacia).toBe(false);
    expect(v.resumen.cerrado.map((i) => i.titulo)).toEqual(['Hecha']);
    expect(v.resumen.seQuedo.map((i) => i.titulo)).toEqual(['Quedada']);
  });

  it('el fin de semana las tres son para el lunes', () => {
    expect(diaDeLasTres('2026-10-24', '2026-10-19')).toBe('2026-10-26');
  });

  it('semana sin nada', () => {
    expect(vistaRevision(DATOS_VACIOS, [], HOY).vacia).toBe(true);
  });

  it('sin nada que se quedara se salta el porqué', () => {
    expect(pasoSiguiente(1, false)).toBe(3);
    expect(pasoSiguiente(1, true)).toBe(2);
    expect(pasoAnterior(3, false)).toBe(1);
    expect(pasoAnterior(3, true)).toBe(2);
  });

  it('«ya no importa» sale de lo propuesto y siempre hay tres huecos', () => {
    const v = vistaRevision(DATOS_VACIOS, misiones, HOY);
    expect(tresIniciales(v, {})).toEqual(['Quedada', '', '']);
    expect(tresIniciales(v, { quedada: 'no_importa' })).toEqual(['', '', '']);
  });

  it('lo ya guardado manda y las razones se recuperan', () => {
    const previa: Revision = {
      id: 'r',
      semana: '2026-10-12',
      cerrado: [],
      seQuedo: [{ titulo: 'Quedada', origen: 'mision', razon: 'esperando' }],
      prioridades: ['Una'],
      minutosProfundos: 0,
      minutosTotales: 0,
      minutosReunion: 0,
      nota: null,
    };
    const v = vistaRevision(datos({ revisiones: [previa] }), misiones, HOY);
    expect(v.previa?.id).toBe('r');
    expect(tresIniciales(v, {})).toEqual(['Una', '', '']);
    expect(razonesDe(previa)).toEqual({ quedada: 'esperando' });
  });

  it('construirRevision guarda las razones y quita huecos vacíos', () => {
    const v = vistaRevision(DATOS_VACIOS, misiones, HOY);
    const r = construirRevision(v.resumen, { quedada: 'tiempo' }, [' Una ', '', 'Dos'], null);
    expect(r.semana).toBe('2026-10-12');
    expect(r.seQuedo).toEqual([{ titulo: 'Quedada', origen: 'mision', razon: 'tiempo' }]);
    expect(r.prioridades).toEqual(['Una', 'Dos']);
  });
});
