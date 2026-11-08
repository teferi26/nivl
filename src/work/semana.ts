// NIVL · WORK: la revisión semanal (puro, con tests). Sin IA: qué se cerró, qué
// se quedó, cuánto foco hubo y qué tres cosas tocan la semana siguiente.

import { minutosOcupados } from './carga';
import { diaSemana, esFinDeSemana, fechaCorta, lunesDe, sumarDias } from './fechas';
import { MAX_PRIORIDADES, normal, type Entrega, type EventoTrabajo, type ItemRevision, type Motivo, type Proyecto, type SesionTrabajo } from './tipos';

/** Una misión de WORK de la semana (src/work/datos.ts → leerMisionesSemana). */
export interface MisionSemana {
  id: string;
  titulo: string;
  fecha: string;
  hecha: boolean;
  /** true si era una prioridad de un día: si no se hizo, «se quedó». */
  prioridad: boolean;
}

export interface EntradaSemana {
  lunes: string;
  misiones: readonly MisionSemana[];
  entregas: readonly Entrega[];
  sesiones: readonly SesionTrabajo[];
  eventos: readonly EventoTrabajo[];
  proyectos: readonly Proyecto[];
}

export interface Propuesta {
  titulo: string;
  origen: 'entrega' | 'pendiente' | 'proyecto';
  motivo: Motivo;
  entregaId: string | null;
}

export interface ResumenSemana {
  lunes: string;
  domingo: string;
  cerrado: ItemRevision[];
  seQuedo: ItemRevision[];
  minutosProfundos: number;
  minutosTotales: number;
  minutosReunion: number;
  /** Días con al menos un bloque. */
  diasConBloque: number;
  /** Como mucho tres. */
  propuestas: Propuesta[];
}

/** De viernes a domingo se revisa la semana en curso; de lunes a jueves, la pasada. */
export function semanaARevisar(hoy: string): string {
  const esta = lunesDe(hoy);
  return diaSemana(hoy) >= 5 ? esta : sumarDias(esta, -7);
}

function sinRepetir(items: ItemRevision[]): ItemRevision[] {
  const vistos = new Set<string>();
  return items.filter((i) => {
    const n = normal(i.titulo);
    if (vistos.has(n)) return false;
    vistos.add(n);
    return true;
  });
}

export function resumenSemana(e: EntradaSemana): ResumenSemana {
  const domingo = sumarDias(e.lunes, 6);
  const enSemana = (f: string | null): f is string => f !== null && f >= e.lunes && f <= domingo;

  const entregasCerradas = e.entregas.filter((x) => x.hecha && enSemana(x.hechaEl));
  const misionesSemana = e.misiones.filter((m) => enSemana(m.fecha));
  const cerrado = sinRepetir([
    ...entregasCerradas.map((x): ItemRevision => ({ titulo: x.titulo, origen: 'entrega' })),
    ...misionesSemana.filter((m) => m.hecha).map((m): ItemRevision => ({ titulo: m.titulo, origen: 'mision' })),
  ]);

  const entregasQuedadas = e.entregas.filter((x) => !x.hecha && enSemana(x.fecha));
  const prioridadesQuedadas = misionesSemana.filter((m) => m.prioridad && !m.hecha);
  const hechos = new Set(cerrado.map((i) => normal(i.titulo)));
  const seQuedo = sinRepetir([
    ...entregasQuedadas.map((x): ItemRevision => ({ titulo: x.titulo, origen: 'entrega' })),
    ...prioridadesQuedadas.map((m): ItemRevision => ({ titulo: m.titulo, origen: 'mision' })),
  ]).filter((i) => !hechos.has(normal(i.titulo)));

  const sesiones = e.sesiones.filter((s) => enSemana(s.fecha) && s.minutos > 0);
  const bloques = sesiones.filter((s) => s.tipo === 'bloque');
  const laborables = e.eventos.filter((x) => enSemana(x.fecha) && !esFinDeSemana(x.fecha));
  const minutosReunion = [...new Set(laborables.map((x) => x.fecha))].reduce((a, f) => a + minutosOcupados(laborables.filter((x) => x.fecha === f)), 0);

  // Las tres de la semana siguiente: primero lo que tiene fecha, después lo que
  // se quedó a medias y al final los proyectos que llevan la semana parados.
  const finSiguiente = sumarDias(domingo, 7);
  const propuestas: Propuesta[] = [];
  const usados = new Set<string>();
  const anadir = (p: Propuesta) => {
    const n = normal(p.titulo);
    if (propuestas.length >= MAX_PRIORIDADES || usados.has(n)) return;
    usados.add(n);
    propuestas.push(p);
  };
  e.entregas
    .filter((x) => !x.hecha && x.fecha !== null && x.fecha <= finSiguiente)
    .sort((a, b) => a.fecha!.localeCompare(b.fecha!) || a.posicion - b.posicion || a.id.localeCompare(b.id))
    .forEach((x) => anadir({ titulo: x.titulo, origen: 'entrega', motivo: { codigo: 'semana_entrega', vars: { fecha: fechaCorta(x.fecha!) } }, entregaId: x.id }));
  prioridadesQuedadas.forEach((m) => anadir({ titulo: m.titulo, origen: 'pendiente', motivo: { codigo: 'semana_pendiente' }, entregaId: null }));
  const conHoras = new Set(sesiones.map((s) => s.proyectoId));
  e.proyectos
    .filter((p) => p.estado === 'activo' && !conHoras.has(p.id))
    .sort((a, b) => a.posicion - b.posicion || a.id.localeCompare(b.id))
    .forEach((p) => anadir({ titulo: p.nombre, origen: 'proyecto', motivo: { codigo: 'semana_proyecto' }, entregaId: null }));

  return {
    lunes: e.lunes,
    domingo,
    cerrado,
    seQuedo,
    minutosProfundos: bloques.reduce((a, s) => a + s.minutos, 0),
    minutosTotales: sesiones.reduce((a, s) => a + s.minutos, 0),
    minutosReunion,
    diasConBloque: new Set(bloques.map((s) => s.fecha)).size,
    propuestas,
  };
}
