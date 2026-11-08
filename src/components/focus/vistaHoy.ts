// NIVL · FOCUS: de los datos a las props de FocusHoyVista. Lo usan la app
// (useFocusHoy) y la galería (demo.tsx): misma entrada, misma pantalla.

import { hayQueArrancar, PLANTILLAS } from '@/focus/arranque';
import { diasEntre, diaSemana, hhmm } from '@/focus/fechas';
import { siguienteClase } from '@/focus/horario';
import { huecoDe } from '@/focus/hueco';
import type { Motivo } from '@/focus/planEstudio';
import { minutosDe, progreso, restanteMs, formatoReloj, situacion, type ConfigPomodoro, type EstadoPomodoro, type Objetivo } from '@/focus/pomodoro';
import {
  asignaturaFoco,
  entregasPendientes,
  examenesProximos,
  examenesSinFecha,
  planDeHoyCompleto,
  repasosDeHoy,
  temasDeAsignatura,
  ventanaTemario,
  type BloquePlan,
  type ExamenVista,
  type PlanHoy,
} from '@/focus/resumen';
import { enlazables } from '@/focus/mision';
import type { DatosFocus } from '@/focus/tipos';
import { t } from '@/i18n';
import type { ClaseVista, EntregaFila, ExamenFila, FilaPlan, FocusHoyVistaProps, HuecoVista, MisionFila, PlanVista, SesionVista, TocaVista } from './FocusHoyVista';
import { tf } from './textos';

export interface MisionEnlazable {
  id: string;
  titulo: string;
  hecha: boolean;
  xp: number;
  penalizacion: boolean;
  link?: string | null;
  modos?: readonly string[];
}

export interface EntradaVistaHoy {
  datos: DatosFocus;
  hoy: string;
  /** Minutos desde medianoche (para las horas del plan). */
  ahoraMin: number;
  /** ms de época (para el reloj). */
  ahora: number;
  config: ConfigPomodoro;
  pomodoro: EstadoPomodoro;
  misiones: MisionEnlazable[] | null;
}

export function etiquetaDias(dias: number): string {
  if (dias <= 0) return t('focus:comun.hoy');
  if (dias === 1) return t('focus:comun.manana');
  return t('focus:comun.enDias', { count: dias });
}

/** La frase de un motivo del plan. Cero prosa en lo puro: aquí se traduce. */
export function textoMotivo(m: Motivo): string {
  return tf(`focus:motivo.${m.clave}`, m.datos);
}

/** «Tema 4 · Árboles binarios». Si el nombre ya trae su número, tal cual. */
export function temaConNumero(d: DatosFocus, temaId: string | null): string | null {
  if (!temaId) return null;
  const tema = d.temas.find((x) => x.id === temaId);
  if (!tema) return null;
  if (/^\s*(tema\s*)?\d/i.test(tema.nombre)) return tema.nombre;
  const n = temasDeAsignatura(d, tema.asignaturaId).findIndex((x) => x.id === temaId) + 1;
  return t('focus:hoy.temaN', { n, nombre: tema.nombre });
}

/** El nombre de un bloque del plan, tal como se lee en una fila. */
export function tituloBloque(b: BloquePlan): string {
  if (b.tipo === 'simulacro') return t('focus:hoyToca.simulacroDe', { asignatura: b.asignatura });
  if (b.tipo === 'entrega') return t('focus:hoyToca.entregaDe', { asignatura: b.asignatura });
  if (b.tipo === 'repasar') return b.tema ?? t('focus:hoyToca.tarjetas');
  return b.tema ?? b.asignatura;
}

const textoSinPlan = (plan: PlanHoy): string | null => (plan.sinPlan ? t(`focus:sinPlan.${plan.sinPlan}`) : null);

export interface EntradaCoach {
  sinAsignaturas: boolean;
  examenes: readonly ExamenVista[];
  plan: PlanHoy;
  repasos: number;
  /** Minutos desde medianoche: un examen de hoy ya pasado no se anuncia. */
  ahoraMin?: number;
}

/**
 * La línea del coach en la tarjeta de Hoy. Solo dice lo que el plan de abajo
 * pide y lo que el sistema puede cumplir: si el plan manda un simulacro, ella
 * también; si no hay temas, lo dice en vez de animar.
 */
export function fraseCoach({ sinAsignaturas, examenes, plan, repasos, ahoraMin }: EntradaCoach): string {
  if (sinAsignaturas) return t('focus:coach.empezar');
  const x = examenes.find((e) => !(e.dias === 0 && e.examen.hora !== null && ahoraMin !== undefined && ahoraMin >= e.examen.hora));
  if (x && x.dias === 0) return t(x.examen.hora === null ? 'focus:coach.examenHoySinHora' : 'focus:coach.examenHoy', { asignatura: x.asignatura });
  const primero = plan.bloques[0];
  if (primero?.tipo === 'simulacro') return t('focus:coach.simulacro', { asignatura: primero.asignatura });
  if (primero?.tipo === 'entrega') return t('focus:coach.entrega', { asignatura: primero.asignatura });
  if (primero?.tipo === 'repasar' && repasos > 0) return t('focus:coach.repasos', { count: repasos });
  if (plan.sinPlan === 'sin_temas' || plan.sinPlan === 'nada_que_planificar') return t('focus:coach.sinTemas');
  if (plan.avisoNoLlegas) return t('focus:coach.noLlegas');
  const nuevo = plan.bloques.find((b) => b.tipo === 'estudiar' && b.tema);
  if (nuevo) return t('focus:coach.tema', { tema: nuevo.tema });
  if (plan.sinPlan === 'cupo_cubierto') return t('focus:coach.cupo');
  if (plan.sinPlan === 'tarde') return t('focus:coach.tarde');
  if (plan.sinPlan === 'poco_tiempo' || plan.sinPlan === 'examen_hoy' || plan.sinPlan === 'atraso_entrega') return t(`focus:sinPlan.${plan.sinPlan}`);
  if (plan.sinPlan === 'al_dia') return t('focus:coach.alDia');
  if (x) return t('focus:coach.examen', { asignatura: x.asignatura, count: x.dias });
  return t('focus:coach.libre');
}

function tocaDeBloque(d: DatosFocus, b: BloquePlan, elegido: boolean, c: ConfigPomodoro): TocaVista {
  const conTema = b.tipo === 'estudiar' || b.tipo === 'repasar' ? temaConNumero(d, b.temaId) : null;
  return {
    tipo: b.tipo,
    titulo: conTema ?? tituloBloque(b),
    detalle: conTema && b.asignatura ? b.asignatura : null,
    motivo: textoMotivo(b.motivo),
    minutos: b.tipo === 'simulacro' ? b.minutos : c.foco,
    asignaturaId: b.asignaturaId,
    temaId: b.temaId,
    elegido,
  };
}

/** Lo que el bloque va a estudiar: lo elegido; si no, lo primero del plan; si no, la asignatura en foco. */
export function tocaDe(d: DatosFocus, objetivo: Objetivo, plan: PlanHoy, hoy: string, c: ConfigPomodoro): TocaVista {
  const elegida = d.asignaturas.find((a) => a.id === objetivo.asignaturaId);
  if (elegida) {
    const delPlan = plan.bloques.find((b) => b.asignaturaId === elegida.id && b.temaId === objetivo.temaId);
    if (delPlan) return tocaDeBloque(d, delPlan, true, c);
    const tema = temaConNumero(d, objetivo.temaId);
    return {
      tipo: 'estudiar',
      titulo: tema ?? elegida.nombre,
      detalle: tema ? elegida.nombre : null,
      motivo: t('focus:hoyToca.elegido'),
      minutos: c.foco,
      asignaturaId: elegida.id,
      temaId: tema ? objetivo.temaId : null,
      elegido: true,
    };
  }
  const primero = plan.bloques[0];
  if (primero) return tocaDeBloque(d, primero, false, c);
  const foco = asignaturaFoco(d, hoy);
  if (foco) return { tipo: 'estudiar', titulo: foco.nombre, detalle: null, motivo: textoSinPlan(plan), minutos: c.foco, asignaturaId: foco.id, temaId: null, elegido: false };
  return { tipo: 'libre', titulo: t('focus:hoy.bloqueLibre'), detalle: null, motivo: null, minutos: c.foco, asignaturaId: null, temaId: null, elegido: false };
}

function filaPlan(b: BloquePlan, conHora: boolean): FilaPlan {
  return {
    bloque: b,
    hora: conHora ? (b.hora === null ? t('focus:comun.hoy') : hhmm(b.hora)) : null,
    titulo: tituloBloque(b),
    motivo: textoMotivo(b.motivo),
    minutos: b.minutos,
  };
}

function planVista(d: DatosFocus, plan: PlanHoy, hoy: string): PlanVista {
  return {
    bloques: plan.bloques.map((b) => filaPlan(b, true)),
    fuera: plan.fuera.map((b) => filaPlan(b, false)),
    aviso: plan.avisoNoLlegas,
    sinPlan: plan.bloques.length === 0 ? textoSinPlan(plan) : null,
    faltanTemasDe: plan.sinPlan === 'sin_temas' || plan.sinPlan === 'nada_que_planificar' ? (asignaturaFoco(d, hoy)?.id ?? null) : null,
  };
}

function entregaFila(e: ReturnType<typeof entregasPendientes>[number]): EntregaFila {
  return {
    id: e.examen.id,
    titulo: e.examen.titulo,
    asignatura: e.asignatura,
    etiqueta: e.dias === null ? t('focus:hoyEntregas.sinFecha') : e.dias < 0 ? t('focus:hoyEntregas.atrasada') : etiquetaDias(e.dias),
    urgente: e.dias !== null && e.dias <= 1,
  };
}

function examenesFila(d: DatosFocus, hoy: string, proximos: readonly ExamenVista[]): ExamenFila[] {
  const conFecha: ExamenFila[] = proximos.map((e) => ({ id: e.examen.id, asignatura: e.asignatura, titulo: e.examen.titulo, etiqueta: etiquetaDias(e.dias), progreso: e.progreso, conFecha: true }));
  const sinFecha: ExamenFila[] = examenesSinFecha(d).map((e) => ({
    id: e.examen.id,
    asignatura: e.asignatura,
    titulo: e.examen.titulo,
    etiqueta: t('focus:hoyToca.sinFecha'),
    progreso: e.progreso,
    conFecha: false,
  }));
  return [...conFecha, ...sinFecha];
}

/** La próxima clase. En época sin clases, nada. */
export function claseDe(d: DatosFocus, hoy: string, ahoraMin: number): ClaseVista | null {
  const hasta = d.prefs.sinClasesHasta;
  if (hasta !== null && diasEntre(hoy, hasta) >= 0) return null;
  const nombre = new Map(d.asignaturas.map((a) => [a.id, a.nombre]));
  const s = siguienteClase(
    d.clases.filter((c) => nombre.has(c.asignaturaId)),
    { dia: diaSemana(hoy), min: ahoraMin },
  );
  if (!s) return null;
  const cuando = s.enDias === 0 ? t('focus:comun.hoy') : s.enDias === 1 ? t('focus:comun.manana') : tf(`focus:dia.largo.${s.clase.dia}`);
  return {
    enCurso: s.enCurso,
    asignatura: nombre.get(s.clase.asignaturaId) ?? '',
    cuando: s.enCurso ? t('focus:hoyClase.hasta', { hora: hhmm(s.clase.fin) }) : t('focus:hoyClase.cuando', { dia: cuando, hora: hhmm(s.clase.inicio) }),
    aula: s.clase.aula,
  };
}

function huecoVista(d: DatosFocus, hoy: string): HuecoVista | null {
  const h = huecoDe(d, hoy);
  if (!h) return null;
  const nombre = new Map(d.asignaturas.map((a) => [a.id, a.nombre]));
  return {
    dias: h.dias,
    pasaron: h.pasaron.map((x) => t('focus:hoyHueco.pasoFila', { titulo: x.titulo, asignatura: nombre.get(x.asignaturaId) ?? '' })),
    repasos: h.repasosVencidos,
    tarjetas: h.tarjetasVencidas,
    temaIds: h.repasos.map((x) => x.id),
  };
}

export function vistaHoy(e: EntradaVistaHoy): Omit<FocusHoyVistaProps, 'cabecera' | 'estado' | 'error' | 'disponible' | 'acciones' | 'refrescando' | 'hoy'> {
  const d = e.datos;
  const p = e.pomodoro;
  const c = e.config;
  const proximos = examenesProximos(d, e.hoy);
  const plan = planDeHoyCompleto(d, e.hoy, e.ahoraMin, c);
  const foco = asignaturaFoco(d, e.hoy);
  const temasFoco = foco ? temasDeAsignatura(d, foco.id) : [];
  const repasos = repasosDeHoy(d, e.hoy);
  const sit = situacion(p);
  const toca = tocaDe(d, p.objetivo, plan, e.hoy, c);

  // Con el bloque en marcha manda lo que se está estudiando, no lo que proponga el plan.
  const enMarcha = d.asignaturas.find((a) => a.id === p.objetivo.asignaturaId) ?? null;
  const mision = p.objetivo.misionId ? (e.misiones ?? []).find((m) => m.id === p.objetivo.misionId && !m.hecha) : undefined;
  const sesion: SesionVista = {
    fase: p.fase,
    bloque: p.bloque,
    cadaLargo: c.cadaLargo,
    situacion: sit,
    reloj: formatoReloj(restanteMs(p, c, e.ahora)),
    ratio: sit === 'parado' ? 0 : progreso(p, c, e.ahora),
    asignatura: enMarcha?.nombre ?? null,
    tema: enMarcha ? temaConNumero(d, p.objetivo.temaId) : null,
    mision: mision ? { titulo: mision.titulo, xp: mision.xp } : null,
    hayMisiones: enlazables(e.misiones ?? []).length > 0,
    foco: minutosDe('foco', c),
    descanso: minutosDe('descanso', c),
    salidas: p.salidas,
  };

  const misiones: MisionFila[] | null = e.misiones
    ? e.misiones.filter((m) => !m.penalizacion).map((m) => ({ id: m.id, titulo: m.titulo, hecha: m.hecha, xp: m.xp, ocupada: false }))
    : null;

  const perfil = d.prefs.perfil;
  const totalRepasos = repasos.temas.length + repasos.tarjetas;
  return {
    arranque: hayQueArrancar(d),
    sesion,
    toca,
    asignaturas: d.asignaturas.map((a) => ({ id: a.id, nombre: a.nombre })),
    entregas: entregasPendientes(d, e.hoy).map(entregaFila),
    mostrarEntregas: entregasPendientes(d, e.hoy).length > 0 || perfil === 'instituto' || perfil === 'universidad',
    plan: planVista(d, plan, e.hoy),
    clase: claseDe(d, e.hoy, e.ahoraMin),
    faltaHorario: perfil !== null && PLANTILLAS[perfil].conHorario && d.clases.length === 0,
    repasos: { temas: repasos.temas.length, tarjetas: repasos.tarjetas, total: totalRepasos },
    hueco: huecoVista(d, e.hoy),
    examenes: examenesFila(d, e.hoy, proximos),
    temario: foco
      ? { asignatura: foco.nombre, temas: ventanaTemario(temasFoco).map((x) => ({ id: x.id, nombre: x.nombre, estado: x.estado })), total: temasFoco.length }
      : null,
    misiones,
    coach: fraseCoach({ sinAsignaturas: d.asignaturas.length === 0, examenes: proximos, plan, repasos: totalRepasos, ahoraMin: e.ahoraMin }),
    sinAsignaturas: d.asignaturas.length === 0,
  };
}
