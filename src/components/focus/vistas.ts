// NIVL · FOCUS: de los datos a las props de Temario y de Exámenes. Puro: lo
// usan la app (useTemario, useExamenes) y la galería (demo.tsx).

import { clavePerfil, entregasHechas, resumenDia, simulacrosPorAsignatura } from '@/focus/agenda';
import { lunesDe, sumarDias } from '@/focus/fechas';
import { clasesDelDia } from '@/focus/horario';
import { mediaGlobal } from '@/focus/notas';
import { progresoTemario } from '@/focus/planEstudio';
import { CONFIG_POR_DEFECTO, type ConfigPomodoro } from '@/focus/pomodoro';
import { asignaturaFoco, entregasPendientes, examenesPasados, examenesProximos, examenesSinFecha, horasDeLaSemana, notasPorAsignatura, planDeExamen, repasosDeHoy, temasDeAsignatura } from '@/focus/resumen';
import { pendientesDeHoy } from '@/focus/repaso';
import { semanaDe } from '@/focus/semana';
import type { DatosFocus } from '@/focus/tipos';
import type { ExamenesVistaProps } from './ExamenesVista';
import type { TemarioVistaProps } from './TemarioVista';

/** Las props de Temario a partir de los datos (también las usa la galería). */
export function vistaTemario(d: DatosFocus, hoy: string, elegidaPedida: string | null, dia: number): Omit<TemarioVistaProps, 'estado' | 'error' | 'disponible' | 'acciones'> {
  const elegida = d.asignaturas.some((a) => a.id === elegidaPedida) ? elegidaPedida : (asignaturaFoco(d, hoy)?.id ?? null);
  const temas = elegida ? temasDeAsignatura(d, elegida) : [];
  const nombre = new Map(d.asignaturas.map((a) => [a.id, a.nombre]));
  return {
    asignaturas: d.asignaturas,
    elegida,
    temas,
    progreso: progresoTemario(temas),
    repasos: repasosDeHoy(d, hoy),
    mazos: d.mazos.map((m) => {
      const de = d.tarjetas.filter((x) => x.mazoId === m.id);
      return { mazo: m, total: de.length, hoy: pendientesDeHoy(de, hoy).length };
    }),
    horas: horasDeLaSemana(d, hoy),
    diaHorario: dia,
    clases: clasesDelDia(d.clases, dia).map((c) => ({ ...c, asignatura: nombre.get(c.asignaturaId) ?? '' })),
  };
}

export interface OpcionesExamenes {
  /** El lunes de la semana que se mira (por defecto, esta). */
  lunes?: string;
  /** Minuto actual: si ya es tarde, el plan de hoy no promete lo que no cabe. */
  ahoraMin?: number;
  config?: ConfigPomodoro;
}

/** Las props de Exámenes a partir de los datos (también las usa la galería). */
export function vistaExamenes(d: DatosFocus, hoy: string, o: OpcionesExamenes = {}): Omit<ExamenesVistaProps, 'estado' | 'error' | 'disponible' | 'acciones'> {
  const proximos = examenesProximos(d, hoy);
  const primero = proximos[0];
  const nombre = new Map(d.asignaturas.map((a) => [a.id, a.nombre]));
  // Un simulacro es un ensayo: se ve en su tarjeta y no mueve la media.
  const notas = notasPorAsignatura(d);
  const conNotas = new Set(notas.map((n) => n.asignatura.id));
  const diasPlan = primero ? planDeExamen(d, primero.examen, hoy, o.config ?? CONFIG_POR_DEFECTO, o.ahoraMin) : [];
  const esta = lunesDe(hoy);
  const lunes = o.lunes ?? esta;
  return {
    hoy,
    perfil: clavePerfil(d.prefs.perfil),
    lunes,
    domingo: sumarDias(lunes, 6),
    esEstaSemana: lunes === esta,
    semana: semanaDe(d, lunes).map((x) => resumenDia(x, hoy)),
    entregas: entregasPendientes(d, hoy),
    entregasHechas: entregasHechas(d),
    sinAsignaturas: d.asignaturas.length === 0,
    proximos,
    sinFecha: examenesSinFecha(d),
    plan: primero && diasPlan.length > 0 ? { examen: primero, dias: diasPlan } : null,
    nombreTema: (id) => (id ? (d.temas.find((x) => x.id === id)?.nombre ?? '') : ''),
    pasados: examenesPasados(d, hoy)
      .filter((x) => nombre.has(x.asignaturaId))
      .map((x) => ({ ...x, asignatura: nombre.get(x.asignaturaId) ?? '' })),
    notas,
    sinNotas: d.asignaturas.filter((a) => !conNotas.has(a.id)),
    mediaGlobal: mediaGlobal(notas.map((n) => n.media.media)),
    simulacros: simulacrosPorAsignatura(d),
  };
}
