// NIVL · FOCUS: de los datos a las props de Temario y de Exámenes. Puro: lo
// usan la app (useTemario, useExamenes) y la galería (demo.tsx).

import { clasesDelDia } from '@/focus/horario';
import { mediaGlobal } from '@/focus/notas';
import { progresoTemario } from '@/focus/planEstudio';
import { asignaturaFoco, examenesPasados, examenesProximos, horasDeLaSemana, notasPorAsignatura, planDeExamen, repasosDeHoy, temasDeAsignatura } from '@/focus/resumen';
import { pendientesDeHoy } from '@/focus/repaso';
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

/** Las props de Exámenes a partir de los datos (también las usa la galería). */
export function vistaExamenes(d: DatosFocus, hoy: string): Omit<ExamenesVistaProps, 'estado' | 'error' | 'disponible' | 'acciones'> {
  const proximos = examenesProximos(d, hoy);
  const primero = proximos[0];
  const nombre = new Map(d.asignaturas.map((a) => [a.id, a.nombre]));
  const notas = notasPorAsignatura(d);
  return {
    sinAsignaturas: d.asignaturas.length === 0,
    proximos,
    plan: primero ? { examen: primero, dias: planDeExamen(d, primero.examen, hoy) } : null,
    nombreTema: (id) => (id ? (d.temas.find((x) => x.id === id)?.nombre ?? '') : ''),
    pasados: examenesPasados(d, hoy)
      .filter((x) => nombre.has(x.asignaturaId))
      .map((x) => ({ ...x, asignatura: nombre.get(x.asignaturaId) ?? '' })),
    notas,
    mediaGlobal: mediaGlobal(notas.map((n) => n.media.media)),
  };
}
