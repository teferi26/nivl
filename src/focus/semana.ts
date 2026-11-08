// NIVL · FOCUS: la semana de un vistazo (puro, con tests): clases, exámenes y
// entregas de lunes a domingo, por hora. Lo que no tiene hora va al final.

import { diaSemana, diasEntre, sumarDias } from './fechas';
import { clasesDelDia } from './horario';
import type { DatosFocus, TipoExamen } from './tipos';

export interface ItemSemana {
  tipo: 'clase' | TipoExamen;
  id: string;
  titulo: string;
  asignaturaId: string;
  asignatura: string;
  hora: number | null;
  /** Solo en las clases. */
  fin: number | null;
  aula: string | null;
  /** Fecha aproximada (exámenes). */
  estimada: boolean;
  /** Entrega ya cerrada. */
  hecha: boolean;
}

export interface DiaSemana {
  fecha: string;
  /** 1 = lunes … 7 = domingo */
  dia: number;
  items: ItemSemana[];
}

export function semanaDe(d: DatosFocus, lunes: string): DiaSemana[] {
  const nombre = new Map(d.asignaturas.map((a) => [a.id, a.nombre]));
  const sinClases = d.prefs.sinClasesHasta;
  return Array.from({ length: 7 }, (_, i) => {
    const fecha = sumarDias(lunes, i);
    const dia = diaSemana(fecha);
    const clases: ItemSemana[] =
      sinClases !== null && diasEntre(fecha, sinClases) >= 0
        ? []
        : clasesDelDia(d.clases, dia)
            .filter((c) => nombre.has(c.asignaturaId))
            .map((c) => ({
              tipo: 'clase',
              id: c.id,
              titulo: nombre.get(c.asignaturaId) ?? '',
              asignaturaId: c.asignaturaId,
              asignatura: nombre.get(c.asignaturaId) ?? '',
              hora: c.inicio,
              fin: c.fin,
              aula: c.aula,
              estimada: false,
              hecha: false,
            }));
    const fechados: ItemSemana[] = d.examenes
      .filter((x) => x.fecha === fecha && nombre.has(x.asignaturaId))
      .map((x) => ({
        tipo: x.tipo,
        id: x.id,
        titulo: x.titulo,
        asignaturaId: x.asignaturaId,
        asignatura: nombre.get(x.asignaturaId) ?? '',
        hora: x.hora,
        fin: null,
        aula: null,
        estimada: x.estimada,
        hecha: x.hechaEl !== null,
      }));
    const items = [...clases, ...fechados].sort((a, b) => (a.hora ?? 1440) - (b.hora ?? 1440) || a.titulo.localeCompare(b.titulo));
    return { fecha, dia, items };
  });
}
