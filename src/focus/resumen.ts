// NIVL · FOCUS: de los datos de la cuenta a lo que pinta cada pantalla (puro, con tests).
//
// Todo determinista a partir de (datos, hoy): la galería de /kit/focus y los
// tests usan exactamente lo mismo que la app.

import { esSimulacro } from './agenda';
import { diaSemana, diasEntre } from './fechas';
import { finUltimaClase, hoyEstudiado, minutosSemana } from './horario';
import { media, notaNecesaria, type Media, type Necesaria } from './notas';
import {
  HORA_LIMITE,
  horasDeBloquesDia,
  inicioEstudio,
  minutosBloqueDe,
  planDelDia,
  planHaciaExamen,
  progresoTemario,
  type BloqueDia,
  type DiaPlan,
  type EntradaDia,
  type ExamenParaDia,
  type Motivo,
  type MotivoSinPlan,
  type PlanDelDia,
  type RepasoTemaParaDia,
  type TipoBloque,
} from './planEstudio';
import { CONFIG_POR_DEFECTO, type ConfigPomodoro } from './pomodoro';
import { pendientesDeHoy } from './repaso';
import type { Asignatura, DatosFocus, Examen, Tema } from './tipos';

const porPosicion = (a: Tema, b: Tema) => a.posicion - b.posicion || a.nombre.localeCompare(b.nombre);

const activas = (d: DatosFocus) => new Set(d.asignaturas.map((a) => a.id));

/** Solo los temas de asignaturas vivas (archivar deja los temas en la base). */
const temasVivos = (d: DatosFocus) => {
  const v = activas(d);
  return d.temas.filter((t) => v.has(t.asignaturaId));
};

/**
 * Los temas que entran en un examen: los suyos más el temario general de la
 * asignatura. Si no hay ni unos ni otros (controles con sus temas y una final
 * sin ninguno), todo el temario de la asignatura.
 */
export function temasDeExamen(d: DatosFocus, x: Examen): Tema[] {
  const de = d.temas.filter((t) => t.asignaturaId === x.asignaturaId);
  const propios = de.filter((t) => t.examenId === x.id || t.examenId === null);
  return (propios.length > 0 ? propios : de).sort(porPosicion);
}

export function temasDeAsignatura(d: DatosFocus, asignaturaId: string): Tema[] {
  return d.temas.filter((t) => t.asignaturaId === asignaturaId).sort(porPosicion);
}

export interface ExamenVista {
  examen: Examen & { fecha: string };
  asignatura: string;
  dias: number;
  progreso: number;
  temas: number;
}

const conFecha = (x: Examen): x is Examen & { fecha: string } => x.fecha !== null;

/** Exámenes y pruebas de hoy en adelante, el más cercano primero (hora y título desempatan). */
export function examenesProximos(d: DatosFocus, hoy: string): ExamenVista[] {
  const nombre = new Map(d.asignaturas.map((a) => [a.id, a.nombre]));
  return d.examenes
    .filter(conFecha)
    .filter((x) => x.tipo !== 'entrega' && !x.hechaEl)
    .map((x) => ({ x, dias: diasEntre(hoy, x.fecha) }))
    .filter((e) => e.dias >= 0 && nombre.has(e.x.asignaturaId))
    .sort((a, b) => a.dias - b.dias || (a.x.hora ?? 1440) - (b.x.hora ?? 1440) || a.x.titulo.localeCompare(b.x.titulo))
    .map(({ x, dias }) => {
      const temas = temasDeExamen(d, x);
      return { examen: x, asignatura: nombre.get(x.asignaturaId) ?? '', dias, progreso: progresoTemario(temas), temas: temas.length };
    });
}

export interface ExamenSinFechaVista {
  examen: Examen;
  asignatura: string;
  progreso: number;
  temas: number;
}

/** Los exámenes cuya fecha aún no se sabe. */
export function examenesSinFecha(d: DatosFocus): ExamenSinFechaVista[] {
  const nombre = new Map(d.asignaturas.map((a) => [a.id, a.nombre]));
  return d.examenes
    .filter((x) => x.fecha === null && x.tipo !== 'entrega' && !x.hechaEl && nombre.has(x.asignaturaId))
    .sort((a, b) => a.titulo.localeCompare(b.titulo))
    .map((x) => {
      const temas = temasDeExamen(d, x);
      return { examen: x, asignatura: nombre.get(x.asignaturaId) ?? '', progreso: progresoTemario(temas), temas: temas.length };
    });
}

export interface EntregaVista {
  examen: Examen;
  asignatura: string;
  /** Días que faltan (negativo: pasada); null sin fecha. */
  dias: number | null;
}

/** Entregas y deberes sin cerrar: lo pasado arriba, luego lo que antes vence. */
export function entregasPendientes(d: DatosFocus, hoy: string): EntregaVista[] {
  const nombre = new Map(d.asignaturas.map((a) => [a.id, a.nombre]));
  return d.examenes
    .filter((x) => x.tipo === 'entrega' && !x.hechaEl && nombre.has(x.asignaturaId))
    .map((x) => ({ examen: x, asignatura: nombre.get(x.asignaturaId) ?? '', dias: x.fecha === null ? null : diasEntre(hoy, x.fecha) }))
    .sort((a, b) => (a.dias ?? 1e6) - (b.dias ?? 1e6) || (a.examen.hora ?? 1440) - (b.examen.hora ?? 1440) || a.examen.titulo.localeCompare(b.examen.titulo));
}

/** Los ya pasados, el más reciente primero. */
export function examenesPasados(d: DatosFocus, hoy: string): (Examen & { fecha: string })[] {
  const vivas = activas(d);
  return d.examenes
    .filter(conFecha)
    .filter((x) => vivas.has(x.asignaturaId) && x.tipo !== 'entrega' && diasEntre(hoy, x.fecha) < 0)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** La asignatura en la que poner el foco: la del examen más cercano; si no hay, la primera. */
export function asignaturaFoco(d: DatosFocus, hoy: string): Asignatura | null {
  const x = examenesProximos(d, hoy)[0];
  if (x) return d.asignaturas.find((a) => a.id === x.examen.asignaturaId) ?? null;
  return d.asignaturas[0] ?? null;
}

export interface BloquePlan {
  /** Minutos desde medianoche, o null si no entra hoy o ya es tarde. */
  hora: number | null;
  tipo: TipoBloque;
  /** null: tanda de tarjetas de varios mazos. */
  asignaturaId: string | null;
  asignatura: string;
  temaId: string | null;
  tema: string | null;
  examenId: string | null;
  minutos: number;
  motivo: Motivo;
}

export interface PlanHoy {
  bloques: BloquePlan[];
  fuera: BloquePlan[];
  minutosPlan: number;
  minutosDisponibles: number;
  avisoNoLlegas: boolean;
  sinPlan: MotivoSinPlan | null;
}

/** ¿Cuenta el horario de clases ese día? En época sin clases, no. */
function hayClases(d: DatosFocus, fecha: string): boolean {
  const hasta = d.prefs.sinClasesHasta;
  return hasta === null || diasEntre(fecha, hasta) < 0;
}

/** Una clase de una asignatura archivada no retrasa el inicio. */
function finClases(d: DatosFocus, fecha: string): number | null {
  if (!hayClases(d, fecha)) return null;
  const vivas = activas(d);
  return finUltimaClase(
    d.clases.filter((c) => vivas.has(c.asignaturaId)),
    diaSemana(fecha),
  );
}

function frentesDe(d: DatosFocus, hoy: string): ExamenParaDia[] {
  const vivas = activas(d);
  const examenes = d.examenes.filter((x) => vivas.has(x.asignaturaId) && !x.hechaEl);
  const frentes: ExamenParaDia[] = examenes.map((x) => ({
    id: x.id,
    asignaturaId: x.asignaturaId,
    titulo: x.titulo,
    fecha: x.fecha,
    hora: x.hora,
    tipo: x.tipo,
    estimada: x.estimada,
    peso: x.peso,
    hechaEl: x.hechaEl,
    temas: x.tipo === 'entrega' ? [] : temasDeExamen(d, x),
  }));
  // Una asignatura sin examen a la vista también avanza, en orden de temario.
  const conExamen = new Set(
    examenes.filter((x) => x.tipo !== 'entrega' && (x.fecha === null || x.estimada || diasEntre(hoy, x.fecha) >= 0)).map((x) => x.asignaturaId),
  );
  for (const a of d.asignaturas) {
    if (conExamen.has(a.id)) continue;
    const temas = temasDeAsignatura(d, a.id);
    if (temas.length > 0) {
      frentes.push({ id: null, asignaturaId: a.id, titulo: a.nombre, fecha: null, hora: null, tipo: 'examen', estimada: false, peso: null, temas });
    }
  }
  return frentes;
}

function examenDeTema(d: DatosFocus, t: Tema, frentes: readonly ExamenParaDia[], hoy: string): string | null {
  if (t.examenId) return t.examenId;
  const candidato = frentes
    .filter((x) => x.id !== null && x.asignaturaId === t.asignaturaId && x.tipo !== 'entrega' && x.fecha !== null && diasEntre(hoy, x.fecha) >= 0)
    .sort((a, b) => (a.fecha as string).localeCompare(b.fecha as string))[0];
  return candidato?.id ?? null;
}

function repasosParaPlan(d: DatosFocus, frentes: readonly ExamenParaDia[], hoy: string): (RepasoTemaParaDia & { etapa: number })[] {
  return temasVivos(d)
    .filter((t) => t.repasoEl !== null)
    .map((t) => ({ id: t.id, asignaturaId: t.asignaturaId, vence: t.repasoEl, etapa: t.etapa, examenId: examenDeTema(d, t, frentes, hoy) }));
}

/** Las tarjetas de mazos sueltos o de asignaturas vivas. */
export function tarjetasVivas(d: DatosFocus) {
  const vivas = activas(d);
  const mazo = new Map(d.mazos.map((m) => [m.id, m.asignaturaId]));
  return d.tarjetas.filter((c) => {
    const a = mazo.get(c.mazoId);
    return a === undefined || a === null || vivas.has(a);
  });
}

/** Asignaturas con simulacro ya hecho hoy. */
function simulacrosDeHoy(d: DatosFocus, hoy: string): string[] {
  return d.sesiones.filter((s) => s.fecha === hoy && s.metodo === 'anteriores' && s.asignaturaId !== null).map((s) => s.asignaturaId as string);
}

/** Todo lo que necesita `planDelDia` para el día de hoy. */
export function entradaDelDia(d: DatosFocus, hoy: string, ahoraMin: number, c: ConfigPomodoro): EntradaDia {
  const frentes = frentesDe(d, hoy);
  const inicio = inicioEstudio(ahoraMin, finClases(d, hoy));
  return {
    hoy,
    desdeMin: inicio ?? HORA_LIMITE,
    minutosDia: d.prefs.minutosDia,
    minutosHechos: hoyEstudiado(d.sesiones, hoy).minutos,
    minutosBloque: minutosBloqueDe(c.foco),
    ritmo: { foco: c.foco, descanso: c.descanso },
    examenes: frentes,
    repasos: repasosParaPlan(d, frentes, hoy),
    tarjetasVencidas: pendientesDeHoy(tarjetasVivas(d), hoy).length,
    simulacrosHechos: simulacrosDeHoy(d, hoy),
  };
}

function aVista(d: DatosFocus, b: BloqueDia, hora: number | null): BloquePlan {
  return {
    hora,
    tipo: b.tipo,
    asignaturaId: b.asignaturaId,
    asignatura: d.asignaturas.find((a) => a.id === b.asignaturaId)?.nombre ?? '',
    temaId: b.temaId,
    tema: b.temaId ? (d.temas.find((t) => t.id === b.temaId)?.nombre ?? null) : null,
    examenId: b.examenId,
    minutos: b.minutos,
    motivo: b.motivo,
  };
}

function planConHoras(d: DatosFocus, plan: PlanDelDia, e: EntradaDia): PlanHoy {
  const horas = e.desdeMin === null || plan.sinPlan === 'tarde' ? [] : horasDeBloquesDia(plan.bloques, e.desdeMin, e.ritmo);
  return {
    bloques: plan.bloques.map((b, i) => aVista(d, b, horas[i] ?? null)),
    fuera: plan.fuera.map((b) => aVista(d, b, null)),
    minutosPlan: plan.minutosPlan,
    minutosDisponibles: plan.minutosDisponibles,
    avisoNoLlegas: plan.avisoNoLlegas,
    sinPlan: plan.sinPlan,
  };
}

/** El plan de hoy entero: lo que cabe con su hora, lo que no y por qué. */
export function planDeHoyCompleto(d: DatosFocus, hoy: string, ahoraMin: number, c: ConfigPomodoro): PlanHoy {
  const e = entradaDelDia(d, hoy, ahoraMin, c);
  return planConHoras(d, planDelDia(e), e);
}

/** Los bloques de hoy, con hora (empieza tras la última clase salvo época sin clases). */
export function planDeHoyConHoras(d: DatosFocus, hoy: string, ahoraMin: number, c: ConfigPomodoro): BloquePlan[] {
  return planDeHoyCompleto(d, hoy, ahoraMin, c).bloques;
}

/** Lo que toca ahora mismo: el primer bloque, con su motivo. */
export function queEstudiarHoy(d: DatosFocus, hoy: string, ahoraMin: number, c: ConfigPomodoro): BloquePlan | null {
  return planDeHoyCompleto(d, hoy, ahoraMin, c).bloques[0] ?? null;
}

/**
 * El plan completo hacia un examen (para su hoja), proyectando los días con el
 * mismo modelo que Hoy y contando con los demás exámenes.
 */
export function planDeExamen(d: DatosFocus, x: Examen, hoy: string, c: ConfigPomodoro = CONFIG_POR_DEFECTO, ahoraMin?: number): DiaPlan[] {
  if (x.tipo === 'entrega') return [];
  const frentes = frentesDe(d, hoy);
  const propio = frentes.find((f) => f.id === x.id);
  const temas = propio?.temas ?? temasDeExamen(d, x);
  return planHaciaExamen({
    examenId: x.id,
    fecha: x.estimada ? null : x.fecha,
    temas,
    hoy,
    asignaturaId: x.asignaturaId,
    titulo: x.titulo,
    hora: x.hora,
    tipo: x.tipo,
    estimada: x.estimada,
    peso: x.peso,
    minutosDia: d.prefs.minutosDia,
    minutosBloque: minutosBloqueDe(c.foco),
    ritmo: { foco: c.foco, descanso: c.descanso },
    otros: frentes.filter((f) => f.id !== x.id),
    repasos: repasosParaPlan(d, frentes, hoy),
    minutosHechosHoy: hoyEstudiado(d.sesiones, hoy).minutos,
    simulacrosHechosHoy: simulacrosDeHoy(d, hoy),
    tarjetasVencidasHoy: pendientesDeHoy(tarjetasVivas(d), hoy).length,
    desdeMinDe: (fecha, i) => {
      if (i === 0 && ahoraMin !== undefined) return inicioEstudio(ahoraMin, finClases(d, fecha)) ?? HORA_LIMITE;
      const fin = finClases(d, fecha);
      return fin === null ? null : inicioEstudio(0, fin);
    },
  }).filter((dia) => dia.items.length > 0);
}

export interface Repasos {
  temas: Tema[];
  tarjetas: number;
}

/** Lo que la repetición espaciada pide hoy (sin asignaturas archivadas). */
export function repasosDeHoy(d: DatosFocus, hoy: string): Repasos {
  const temas = pendientesDeHoy(
    temasVivos(d).map((t) => ({ ...t, vence: t.repasoEl })),
    hoy,
  );
  return { temas, tarjetas: pendientesDeHoy(tarjetasVivas(d), hoy).length };
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
  objetivo: number;
}

/**
 * Media de cada asignatura con notas y lo que hace falta para su objetivo (el 5
 * si no tiene). Un simulacro es un ensayo: se lista, pero no mueve la media.
 */
export function notasPorAsignatura(d: DatosFocus): NotasAsignatura[] {
  return d.asignaturas
    .map((a) => {
      const ns = d.notas.filter((n) => n.asignaturaId === a.id && !esSimulacro(n));
      const objetivo = a.notaObjetivo ?? 5;
      return { asignatura: a, media: media(ns), necesaria: notaNecesaria(ns, objetivo), notas: ns.length, objetivo };
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
