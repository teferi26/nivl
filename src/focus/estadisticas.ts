// NIVL · FOCUS: las horas de estudio (puro, con tests). Por asignatura en la
// semana y en el mes frente a lo que pesa (el desfase), por tema, días seguidos
// y salidas de la app, que son solo informativas: nada de aquí toca el pago.

import { diasEntre, lunesDe } from './fechas';
import { diasSeguidos } from './horario';
import type { DatosFocus } from './tipos';

const PESO_POR_DEFECTO = 30;

export interface EstadisticaAsignatura {
  asignaturaId: string;
  nombre: string;
  semana: number;
  mes: number;
  /** % de lo estudiado en el mes. */
  pctHoras: number;
  /** % de lo que pesa (exámenes a la vista); null si ninguna asignatura tiene examen. */
  pctPeso: number | null;
  /** pctHoras menos pctPeso: negativo = va por detrás de lo que pesa. */
  desfase: number | null;
}

export interface EstadisticaTema {
  temaId: string;
  nombre: string;
  asignaturaId: string;
  minutos: number;
}

export interface Estadisticas {
  porAsignatura: EstadisticaAsignatura[];
  /** Bloques sin asignatura. */
  libres: { semana: number; mes: number };
  porTema: EstadisticaTema[];
  total: { semana: number; mes: number };
  diasSeguidos: number;
  salidas: { semana: number; mes: number };
}

export function estadisticasDe(d: DatosFocus, hoy: string): Estadisticas {
  const lunes = lunesDe(hoy);
  const mesDe = hoy.slice(0, 7);
  const acumulado = new Map<string, { semana: number; mes: number }>();
  const libres = { semana: 0, mes: 0 };
  const tema = new Map<string, number>();
  const salidas = { semana: 0, mes: 0 };
  const total = { semana: 0, mes: 0 };

  for (const s of d.sesiones) {
    if (!Number.isFinite(s.minutos) || s.minutos <= 0) continue;
    const enSemana = diasEntre(lunes, s.fecha) >= 0 && diasEntre(hoy, s.fecha) <= 0 && diasEntre(lunes, s.fecha) <= 6;
    const enMes = s.fecha.slice(0, 7) === mesDe && diasEntre(hoy, s.fecha) <= 0;
    if (enSemana) {
      total.semana += s.minutos;
      salidas.semana += s.salidas;
    }
    if (enMes) {
      total.mes += s.minutos;
      salidas.mes += s.salidas;
    }
    const bolsa = s.asignaturaId === null ? libres : (acumulado.get(s.asignaturaId) ?? { semana: 0, mes: 0 });
    if (enSemana) bolsa.semana += s.minutos;
    if (enMes) bolsa.mes += s.minutos;
    if (s.asignaturaId !== null) acumulado.set(s.asignaturaId, bolsa);
    if (s.temaId !== null) tema.set(s.temaId, (tema.get(s.temaId) ?? 0) + s.minutos);
  }

  // El peso de una asignatura: el mayor de sus exámenes a la vista.
  const pesos = new Map<string, number>();
  for (const x of d.examenes) {
    if (x.tipo === 'entrega' || x.hechaEl) continue;
    if (x.fecha !== null && diasEntre(hoy, x.fecha) < 0) continue;
    pesos.set(x.asignaturaId, Math.max(pesos.get(x.asignaturaId) ?? 0, x.peso ?? PESO_POR_DEFECTO));
  }
  const vivas = d.asignaturas.filter((a) => pesos.has(a.id));
  const sumaPesos = vivas.reduce((s, a) => s + (pesos.get(a.id) as number), 0);
  const sumaMes = d.asignaturas.reduce((s, a) => s + (acumulado.get(a.id)?.mes ?? 0), 0);

  const redondo = (x: number) => Math.round(x);
  const porAsignatura = d.asignaturas
    .map((a) => {
      const m = acumulado.get(a.id) ?? { semana: 0, mes: 0 };
      const pctHoras = sumaMes > 0 ? redondo((m.mes / sumaMes) * 100) : 0;
      const pctPeso = sumaPesos > 0 ? redondo(((pesos.get(a.id) ?? 0) / sumaPesos) * 100) : null;
      return { asignaturaId: a.id, nombre: a.nombre, semana: m.semana, mes: m.mes, pctHoras, pctPeso, desfase: pctPeso === null ? null : pctHoras - pctPeso };
    })
    .sort((a, b) => b.mes - a.mes || a.nombre.localeCompare(b.nombre));

  const nombreTema = new Map(d.temas.map((t) => [t.id, t]));
  const porTema = [...tema.entries()]
    .flatMap(([temaId, minutos]) => {
      const t = nombreTema.get(temaId);
      return t ? [{ temaId, nombre: t.nombre, asignaturaId: t.asignaturaId, minutos }] : [];
    })
    .sort((a, b) => b.minutos - a.minutos || a.nombre.localeCompare(b.nombre));

  return { porAsignatura, libres, porTema, total, diasSeguidos: diasSeguidos(d.sesiones, hoy), salidas };
}
