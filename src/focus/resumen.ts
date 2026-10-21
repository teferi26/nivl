// NIVL · FOCUS: de los datos de la cuenta a lo que pinta cada pantalla (puro, con tests).
//
// Todo determinista a partir de (datos, hoy): la galería de /kit/focus y los
// tests usan exactamente lo mismo que la app.

import { diaSemana, diasEntre } from './fechas';
import { finUltimaClase, hoyEstudiado, minutosSemana } from './horario';
import { media, notaNecesaria, type Media, type Necesaria } from './notas';
import { horasDeBloques, inicioEstudio, planDeHoy, planHaciaExamen, progresoTemario, type DiaPlan, type TipoItem } from './planEstudio';
import type { ConfigPomodoro } from './pomodoro';
import { pendientesDeHoy } from './repaso';
import type { Asignatura, DatosFocus, Examen, Tema } from './tipos';

const porPosicion = (a: Tema, b: Tema) => a.posicion - b.posicion || a.nombre.localeCompare(b.nombre);

/** Los temas que entran en un examen: los suyos; si no tiene, los generales de su asignatura. */
export function temasDeExamen(d: DatosFocus, x: Examen): Tema[] {
  const propios = d.temas.filter((t) => t.examenId === x.id);
  if (propios.length > 0) return propios.sort(porPosicion);
  return d.temas.filter((t) => t.asignaturaId === x.asignaturaId && t.examenId === null).sort(porPosicion);
}

export function temasDeAsignatura(d: DatosFocus, asignaturaId: string): Tema[] {
  return d.temas.filter((t) => t.asignaturaId === asignaturaId).sort(porPosicion);
}

export interface ExamenVista {
  examen: Examen;
  asignatura: string;
  dias: number;
  progreso: number;
  temas: number;
}

/** Los exámenes de hoy en adelante, el más cercano primero. */
export function examenesProximos(d: DatosFocus, hoy: string): ExamenVista[] {
  const nombre = new Map(d.asignaturas.map((a) => [a.id, a.nombre]));
  return d.examenes
    .map((x) => ({ x, dias: diasEntre(hoy, x.fecha) }))
    .filter((e) => e.dias >= 0 && nombre.has(e.x.asignaturaId))
    .sort((a, b) => a.dias - b.dias || a.x.titulo.localeCompare(b.x.titulo))
    .map(({ x, dias }) => {
      const temas = temasDeExamen(d, x);
      return { examen: x, asignatura: nombre.get(x.asignaturaId) ?? '', dias, progreso: progresoTemario(temas), temas: temas.length };
    });
}

/** Los ya pasados, el más reciente primero. */
export function examenesPasados(d: DatosFocus, hoy: string): Examen[] {
  return d.examenes.filter((x) => diasEntre(hoy, x.fecha) < 0).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** La asignatura en la que poner el foco: la del examen más cercano; si no hay, la primera. */
export function asignaturaFoco(d: DatosFocus, hoy: string): Asignatura | null {
  const x = examenesProximos(d, hoy)[0];
  if (x) return d.asignaturas.find((a) => a.id === x.examen.asignaturaId) ?? null;
  return d.asignaturas[0] ?? null;
}

export interface BloquePlan {
  /** Minutos desde medianoche, o null si ya es tarde para proponer hora. */
  hora: number | null;
  tipo: TipoItem;
  asignaturaId: string;
  asignatura: string;
  temaId: string | null;
  tema: string | null;
  examenId: string;
}

/**
 * El plan de estudio de hoy, bloque a bloque y con hora: los temas que tocan
 * hoy hacia cada examen, encadenados como pomodoros desde la hora de empezar
 * (después de la última clase de hoy).
 */
export function planDeHoyConHoras(d: DatosFocus, hoy: string, ahoraMin: number, c: ConfigPomodoro): BloquePlan[] {
  const examenes = d.examenes.filter((x) => d.asignaturas.some((a) => a.id === x.asignaturaId));
  const items = planDeHoy(
    examenes.map((x) => ({ examenId: x.id, fecha: x.fecha, temas: temasDeExamen(d, x) })),
    hoy,
  );
  // Los repasos espaciados que tocan hoy van en un bloque propio al final.
  const repasos = repasosDeHoy(d, hoy).temas.filter((t) => !items.some((i) => i.temaId === t.id));
  const inicio = inicioEstudio(ahoraMin, finUltimaClase(d.clases, diaSemana(hoy)));
  const horas = inicio === null ? [] : horasDeBloques(items.length + (repasos.length > 0 ? 1 : 0), inicio, c);
  const examen = new Map(examenes.map((x) => [x.id, x]));
  const asig = new Map(d.asignaturas.map((a) => [a.id, a.nombre]));
  const tema = new Map(d.temas.map((t) => [t.id, t.nombre]));
  const bloques: BloquePlan[] = items.map((i, k) => {
    const x = examen.get(i.examenId)!;
    return {
      hora: horas[k] ?? null,
      tipo: i.tipo,
      asignaturaId: x.asignaturaId,
      asignatura: asig.get(x.asignaturaId) ?? '',
      temaId: i.temaId,
      tema: i.temaId ? (tema.get(i.temaId) ?? null) : null,
      examenId: i.examenId,
    };
  });
  const r = repasos[0];
  if (r) {
    bloques.push({
      hora: horas[items.length] ?? null,
      tipo: 'repasar',
      asignaturaId: r.asignaturaId,
      asignatura: asig.get(r.asignaturaId) ?? '',
      temaId: r.id,
      tema: r.nombre,
      examenId: '',
    });
  }
  return bloques;
}

/** El plan completo hacia un examen (para su hoja). */
export function planDeExamen(d: DatosFocus, x: Examen, hoy: string): DiaPlan[] {
  return planHaciaExamen({ examenId: x.id, fecha: x.fecha, temas: temasDeExamen(d, x), hoy }).filter((dia) => dia.items.length > 0);
}

export interface Repasos {
  temas: Tema[];
  tarjetas: number;
}

/** Lo que la repetición espaciada pide hoy. */
export function repasosDeHoy(d: DatosFocus, hoy: string): Repasos {
  const temas = pendientesDeHoy(
    d.temas.map((t) => ({ ...t, vence: t.repasoEl })),
    hoy,
  );
  return { temas, tarjetas: pendientesDeHoy(d.tarjetas, hoy).length };
}

export interface HorasAsignatura {
  asignaturaId: string | null;
  nombre: string | null;
  minutos: number;
}

/** Minutos de estudio de la semana por asignatura (de más a menos) y lo de hoy. */
export function horasDeLaSemana(d: DatosFocus, hoy: string): { porAsignatura: HorasAsignatura[]; total: number; hoy: { minutos: number; bloques: number } } {
  const m = minutosSemana(d.sesiones, hoy);
  const nombre = new Map(d.asignaturas.map((a) => [a.id, a.nombre]));
  const porAsignatura = [...m.entries()]
    .map(([id, minutos]) => ({ asignaturaId: id, nombre: id === null ? null : (nombre.get(id) ?? null), minutos }))
    .sort((a, b) => b.minutos - a.minutos);
  return { porAsignatura, total: porAsignatura.reduce((s, x) => s + x.minutos, 0), hoy: hoyEstudiado(d.sesiones, hoy) };
}

export interface NotasAsignatura {
  asignatura: Asignatura;
  media: Media;
  necesaria: Necesaria;
  notas: number;
}

/** Media de cada asignatura con notas y lo que hace falta para el 5. */
export function notasPorAsignatura(d: DatosFocus): NotasAsignatura[] {
  return d.asignaturas
    .map((a) => {
      const ns = d.notas.filter((n) => n.asignaturaId === a.id);
      return { asignatura: a, media: media(ns), necesaria: notaNecesaria(ns, 5), notas: ns.length };
    })
    .filter((x) => x.notas > 0);
}

/**
 * Unos pocos temas alrededor de por dónde se va: el último dominado y los
 * siguientes sin dominar, en el orden del temario (la tarjeta de Hoy).
 */
export function ventanaTemario<T extends { estado: Tema['estado'] }>(temas: readonly T[], n = 3): T[] {
  const i = temas.findIndex((x) => x.estado !== 'dominado');
  if (i === -1) return temas.slice(Math.max(0, temas.length - n));
  const desde = Math.max(0, Math.min(i - 1, temas.length - n));
  return temas.slice(desde, desde + n);
}
