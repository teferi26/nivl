// NIVL · FOCUS: la agenda académica de la pestaña Exámenes (puro, con tests).
//
// De lo que se escribe en las hojas a lo que se guarda (fechas rápidas, hora,
// «aún sin fecha», «fecha aproximada», peso, objetivo, simulacro) y de los
// datos a lo que pinta la semana.
//
// Un simulacro tipo test se guarda como nota (focus_grades) y se reconoce por
// el prefijo del título y por no llevar peso: no hay columna para marcarlo y el
// CHECK de la 0076 no admite peso 0. Es un ensayo, no una calificación, así
// que la media de la asignatura no lo cuenta (`sinSimulacros`).

import { diasEntre, fechaCorta, leerFechaEs, sumarDias } from './fechas';
import { leerHora } from './horarioRapido';
import { leerNumero } from './notas';
import type { DiaSemana, ItemSemana } from './semana';
import { evolucionSimulacros, resultadoSimulacroTest, type EvolucionSimulacros, type ResultadoSimulacroTest } from './simulacroTest';
import type { DatosFocus, Examen, Nota, PerfilFocus } from './tipos';

// ── Fechas y horas de los formularios ───────────────────────────────────

export type ClaveFechaRapida = 'hoy' | 'manana' | 'unaSemana' | 'dosSemanas' | 'unMes';

export interface FechaRapida {
  clave: ClaveFechaRapida;
  fecha: string;
}

const SALTOS: Record<ClaveFechaRapida, number> = { hoy: 0, manana: 1, unaSemana: 7, dosSemanas: 14, unMes: 30 };

const rapidas = (hoy: string, claves: readonly ClaveFechaRapida[]): FechaRapida[] => claves.map((clave) => ({ clave, fecha: sumarDias(hoy, SALTOS[clave]) }));

/** Los chips de fecha: una entrega es de hoy para mañana; un examen se apunta con tiempo. */
export function fechasRapidas(hoy: string, uso: 'examen' | 'entrega'): FechaRapida[] {
  return uso === 'entrega' ? rapidas(hoy, ['hoy', 'manana', 'unaSemana']) : rapidas(hoy, ['manana', 'unaSemana', 'dosSemanas', 'unMes']);
}

export type ModoFecha = 'fija' | 'aproximada' | 'sin';

export function modoFechaDe(x: Pick<Examen, 'fecha' | 'estimada'>): ModoFecha {
  if (x.fecha === null) return 'sin';
  return x.estimada ? 'aproximada' : 'fija';
}

export interface FormExamen {
  modo: ModoFecha;
  fecha: string;
  hora: string;
  peso: string;
}

export interface LecturaFormExamen {
  fecha: string | null;
  estimada: boolean;
  hora: number | null;
  peso: number | null;
  errores: { fecha: boolean; hora: boolean; peso: boolean };
  ok: boolean;
}

/** Lo que se guarda de un examen. Sin fecha o con fecha aproximada no se guarda hora. */
export function leerFormExamen(f: FormExamen, hoy: string): LecturaFormExamen {
  const conFecha = f.modo !== 'sin';
  const fecha = conFecha ? leerFechaEs(f.fecha, hoy) : null;
  const horaEscrita = f.modo === 'fija' && f.hora.trim() !== '';
  const hora = horaEscrita ? leerHora(f.hora) : null;
  const pesoEscrito = f.peso.trim() !== '';
  const peso = pesoEscrito ? leerNumero(f.peso) : null;
  const errores = {
    fecha: conFecha && fecha === null,
    hora: horaEscrita && hora === null,
    peso: pesoEscrito && (peso === null || peso <= 0 || peso > 100),
  };
  return { fecha, estimada: f.modo === 'aproximada', hora, peso, errores, ok: !errores.fecha && !errores.hora && !errores.peso };
}

export interface LecturaFormEntrega {
  fecha: string | null;
  hora: number | null;
  errores: { fecha: boolean; hora: boolean };
  ok: boolean;
}

/** La fecha de una entrega es obligatoria salvo si ya venía sin ella. */
export function leerFormEntrega(f: { fecha: string; hora: string; fechaOpcional?: boolean }, hoy: string): LecturaFormEntrega {
  const vacia = f.fecha.trim() === '';
  const fecha = vacia ? null : leerFechaEs(f.fecha, hoy);
  const horaEscrita = f.hora.trim() !== '';
  const hora = horaEscrita ? leerHora(f.hora) : null;
  const errores = { fecha: vacia ? !f.fechaOpcional : fecha === null, hora: horaEscrita && hora === null };
  return { fecha, hora, errores, ok: !errores.fecha && !errores.hora };
}

/** El objetivo de una asignatura: vacío vuelve al 5. Todo se mide sobre 10. */
export function leerObjetivo(s: string): { valor: number | null; ok: boolean } {
  if (s.trim() === '') return { valor: null, ok: true };
  const n = leerNumero(s);
  return n !== null && n > 0 && n <= 10 ? { valor: n, ok: true } : { valor: null, ok: false };
}

// ── Etiquetas según el perfil ───────────────────────────────────────────

export type ClavePerfil = PerfilFocus | 'general';

export const clavePerfil = (p: PerfilFocus | null): ClavePerfil => p ?? 'general';

// ── La semana ───────────────────────────────────────────────────────────

export interface DiaVista {
  fecha: string;
  dia: number;
  esHoy: boolean;
  clases: ItemSemana[];
  /** Minuto en que empieza la primera clase y acaba la última; null sin clases. */
  clasesDesde: number | null;
  clasesHasta: number | null;
  /** Exámenes, pruebas y entregas del día, por hora. */
  fechados: ItemSemana[];
}

export function resumenDia(d: DiaSemana, hoy: string): DiaVista {
  const clases = d.items.filter((x) => x.tipo === 'clase');
  return {
    fecha: d.fecha,
    dia: d.dia,
    esHoy: d.fecha === hoy,
    clases,
    clasesDesde: clases.length > 0 ? Math.min(...clases.map((c) => c.hora ?? 1440)) : null,
    clasesHasta: clases.length > 0 ? Math.max(...clases.map((c) => c.fin ?? 0)) : null,
    fechados: d.items.filter((x) => x.tipo !== 'clase'),
  };
}

/** «2/11»: para el rótulo de la semana, sin año. */
export const diaMes = (f: string) => `${Number(f.slice(8, 10))}/${Number(f.slice(5, 7))}`;

// ── Entregas ────────────────────────────────────────────────────────────

export type Plazo = { clave: 'hoy' | 'manana' | 'sinFecha' } | { clave: 'dias' | 'vencida'; count: number };

export function plazoDe(dias: number | null): Plazo {
  if (dias === null) return { clave: 'sinFecha' };
  if (dias < 0) return { clave: 'vencida', count: -dias };
  if (dias === 0) return { clave: 'hoy' };
  if (dias === 1) return { clave: 'manana' };
  return { clave: 'dias', count: dias };
}

export interface EntregaHecha {
  examen: Examen;
  asignatura: string;
}

/** Las últimas entregas cerradas: por si se marcó una sin querer. */
export function entregasHechas(d: DatosFocus, n = 3): EntregaHecha[] {
  const nombre = new Map(d.asignaturas.map((a) => [a.id, a.nombre]));
  return d.examenes
    .filter((x) => x.tipo === 'entrega' && x.hechaEl !== null && nombre.has(x.asignaturaId))
    .sort((a, b) => diasEntre(a.hechaEl as string, b.hechaEl as string) || a.titulo.localeCompare(b.titulo))
    .slice(0, n)
    .map((x) => ({ examen: x, asignatura: nombre.get(x.asignaturaId) ?? '' }));
}

// ── Simulacros tipo test ────────────────────────────────────────────────

/** Marca del dato, no texto de interfaz: igual en todos los idiomas. */
const PREFIJO_SIMULACRO = 'Test · '; // i18n-ok

/** El título de una nota cabe en 120 (0076). */
const MAX_NOMBRE_SIMULACRO = 100;

export const esSimulacro = (n: Pick<Nota, 'titulo' | 'peso'>) => n.peso === null && n.titulo.startsWith(PREFIJO_SIMULACRO);

/** El título sin la marca, para enseñarlo. */
export const nombreNota = (n: Pick<Nota, 'titulo' | 'peso'>) => (esSimulacro(n) ? n.titulo.slice(PREFIJO_SIMULACRO.length) : n.titulo);

export function notaDeSimulacro(asignaturaId: string, nombre: string, hoy: string, r: ResultadoSimulacroTest): Omit<Nota, 'id'> {
  const propio = nombre.trim().slice(0, MAX_NOMBRE_SIMULACRO).trim();
  return {
    asignaturaId,
    titulo: `${PREFIJO_SIMULACRO}${propio || fechaCorta(hoy)}`,
    // Una nota no puede ser negativa (0076): el neto negativo se guarda como 0.
    nota: Math.max(0, r.nota),
    sobre: 10,
    peso: null,
    fecha: hoy,
  };
}

/** Los datos sin los simulacros: lo que cuenta para la media de cada asignatura. */
export function sinSimulacros(d: DatosFocus): DatosFocus {
  return { ...d, notas: d.notas.filter((n) => !esSimulacro(n)) };
}

export interface SimulacrosAsignatura {
  asignaturaId: string;
  asignatura: string;
  evolucion: EvolucionSimulacros;
}

export function evolucionDe(d: DatosFocus, asignaturaId: string): EvolucionSimulacros {
  return evolucionSimulacros(d.notas.filter((n) => n.asignaturaId === asignaturaId && esSimulacro(n)));
}

/** La evolución de cada asignatura que tenga algún simulacro. */
export function simulacrosPorAsignatura(d: DatosFocus): SimulacrosAsignatura[] {
  return d.asignaturas
    .map((a) => ({ asignaturaId: a.id, asignatura: a.nombre, evolucion: evolucionDe(d, a.id) }))
    .filter((x) => x.evolucion.puntos.length > 0);
}

/** Un número de preguntas: vacío vale 0. null si no es un entero. */
export function leerEntero(s: string): number | null {
  const t = s.trim();
  if (t === '') return 0;
  return /^\d{1,4}$/.test(t) ? Number(t) : null;
}

export function leerFormSimulacro(f: {
  aciertos: string;
  fallos: string;
  blancos: string;
  penalizacion: number | null;
  netoNegativo: boolean;
}): ResultadoSimulacroTest | null {
  const aciertos = leerEntero(f.aciertos);
  const fallos = leerEntero(f.fallos);
  const blancos = leerEntero(f.blancos);
  if (aciertos === null || fallos === null || blancos === null || f.penalizacion === null) return null;
  return resultadoSimulacroTest({ aciertos, fallos, blancos, penalizacion: f.penalizacion, netoNegativo: f.netoNegativo });
}
