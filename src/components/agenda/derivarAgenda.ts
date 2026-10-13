// NIVL · Agenda: lo que se deriva de los datos (puro, con tests). Sin red y
// sin Supabase: lo usan AgendaVista, el Calendario, las hojas y la galería.
//
// `dates.ts` solo se consume. Los días y los meses salen de `@/i18n/formato`
// (nombreDia, fechaCorta, nombreMes), para no depender de `toLocaleDateString`.

import { questsScheduledOn } from '@/lib/closing';
import type { PlanConBloques } from '@/lib/dayplan';
import { addDays, dateKey, nombreDia, relativoDe, weekdayOfKey } from '@/lib/dates';
import { horaAMinutos, KIND_ICON } from '@/lib/plan';
import type { CalendarEvent, DungeonTask, Quest } from '@/lib/types';
import type { ItemAgenda } from '@/components/LineaDeTiempo';
import { t } from '@/i18n';
import { capital, fechaCorta, mayus, nombreDia as nombreDiaSemana, nombreMes } from '@/i18n/formato';

export type ModoAgenda = 'dia' | 'semana' | 'mes';

/** Las letras de lunes a domingo («L», «M», «X»…), al pintar. */
export function letrasDia(): string[] {
  return Array.from({ length: 7 }, (_, i) => nombreDiaSemana(i, 'letra'));
}

/** Duración que se le supone a un evento con hora (no guarda el final). */
export const DURACION_EVENTO = 45;

const mesDe = (key: string) => Number(key.slice(5, 7));
const diaDe = (key: string) => Number(key.slice(8));
const anioDe = (key: string) => Number(key.slice(0, 4));
/** «octubre»: el mes largo de `key`, en minúscula. */
const mesLargo = (key: string) => {
  const mes = mesDe(key);
  return mes >= 1 && mes <= 12 ? nombreMes(mes - 1) : '';
};
/** «miércoles»: el día de la semana de `key`. */
const diaSemana = (key: string) => nombreDiaSemana(weekdayOfKey(key) - 1);

/** El lunes de la semana de `key`. */
export function inicioSemana(key: string): string {
  return addDays(key, -(weekdayOfKey(key) - 1));
}

/** El día 1 del mes que queda `n` meses antes o después. */
export function sumarMeses(key: string, n: number): string {
  return dateKey(new Date(anioDe(key), mesDe(key) - 1 + n, 1));
}

/** Número de semana ISO 8601 (la semana del jueves manda). */
export function semanaIso(key: string): number {
  const fecha = Date.UTC(anioDe(key), mesDe(key) - 1, diaDe(key));
  const jueves = fecha + (4 - weekdayOfKey(key)) * 86400000;
  const inicioAnio = Date.UTC(new Date(jueves).getUTCFullYear(), 0, 1);
  return Math.floor((jueves - inicioAnio) / 86400000 / 7) + 1;
}

/** «Miércoles 7». */
export function diaCorto(key: string): string {
  return `${capital(diaSemana(key))} ${diaDe(key)}`;
}

/** Eyebrow del encabezado: «Octubre 2026». */
export function mesYAnio(key: string): string {
  return `${capital(mesLargo(key))} ${anioDe(key)}`;
}

/** Título grabado: «Miércoles 7», «Semana 41» u «Octubre» (EncabezadoArena lo pasa a mayúsculas). */
export function tituloAgenda(modo: ModoAgenda, key: string): string {
  if (modo === 'semana') return t('agenda:derivar.semanaN', { n: semanaIso(inicioSemana(key)) });
  if (modo === 'mes') return capital(mesLargo(key));
  return diaCorto(key);
}

/**
 * El rango entre las flechas, en inscripción: «7 OCT 2026», «6 A 12 OCT» (o
 * «29 SEP A 5 OCT» si cruza de mes) y «OCTUBRE 2026». Sin guiones.
 */
export function rangoAgenda(modo: ModoAgenda, key: string): string {
  if (modo === 'mes') return mayus(`${mesLargo(key)} ${anioDe(key)}`);
  if (modo === 'dia') return mayus(`${fechaCorta(key)} ${anioDe(key)}`);
  const ini = inicioSemana(key);
  const fin = addDays(ini, 6);
  const mismoMes = mesDe(ini) === mesDe(fin);
  return mayus(t('agenda:derivar.rangoSemana', { ini: mismoMes ? diaDe(ini) : fechaCorta(ini), fin: fechaCorta(fin) }));
}

/** Lo que oye el lector en cada flecha y en el rango. */
export function rangoLeido(modo: ModoAgenda, key: string): string {
  if (modo === 'mes') return t('agenda:derivar.mesDeAnio', { mes: mesLargo(key), anio: anioDe(key) });
  if (modo === 'dia') return nombreDia(key);
  const ini = inicioSemana(key);
  const fin = addDays(ini, 6);
  return t('agenda:derivar.semanaLeida', {
    n: semanaIso(ini),
    dia1: diaDe(ini),
    mes1: mesLargo(ini),
    dia2: diaDe(fin),
    mes2: mesLargo(fin),
  });
}

/** Siete días de la semana de `key`, de lunes a domingo. */
export function diasDeSemana(key: string): string[] {
  const ini = inicioSemana(key);
  return Array.from({ length: 7 }, (_, i) => addDays(ini, i));
}

/** La rejilla del mes: 6 filas × 7 columnas; null fuera del mes. */
export function rejillaMes(key: string): (string | null)[] {
  const y = anioDe(key);
  const m = mesDe(key);
  const mm = String(m).padStart(2, '0');
  const diasMes = new Date(y, m, 0).getDate();
  const antes = weekdayOfKey(`${y}-${mm}-01`) - 1;
  const celdas: (string | null)[] = [];
  for (let i = 0; i < antes; i++) celdas.push(null);
  for (let d = 1; d <= diasMes; d++) celdas.push(`${y}-${mm}-${String(d).padStart(2, '0')}`);
  while (celdas.length < 42) celdas.push(null);
  return celdas;
}

/** Día anterior o siguiente según la vista (día, semana o mes). */
export function moverAgenda(modo: ModoAgenda, key: string, paso: 1 | -1): string {
  if (modo === 'mes') return sumarMeses(key, paso);
  return addDays(key, modo === 'semana' ? 7 * paso : paso);
}

export interface DatosAgenda {
  quests: Quest[];
  events: CalendarEvent[];
  dueTasks: DungeonTask[];
}

export interface ContenidoDia {
  misiones: Quest[];
  eventos: CalendarEvent[];
  plazos: DungeonTask[];
}

/** Lo que cae en un día: misiones programadas, eventos y plazos de campaña. */
export function contenidoDe(datos: DatosAgenda, dia: string, hoy: string): ContenidoDia {
  return {
    // Las penalizaciones solo se enseñan el día de hoy.
    misiones: questsScheduledOn(datos.quests, dia).filter((q) => !q.is_penalty || dia === hoy),
    eventos: datos.events.filter((e) => e.date === dia),
    plazos: datos.dueTasks.filter((x) => x.due_date === dia),
  };
}

/** Los eventos con hora primero y en orden; los de todo el día, al final. */
export function eventosOrdenados(eventos: CalendarEvent[]): CalendarEvent[] {
  return [...eventos].sort(
    (a, b) =>
      (horaAMinutos(a.time) ?? Number.MAX_SAFE_INTEGER) - (horaAMinutos(b.time) ?? Number.MAX_SAFE_INTEGER),
  );
}

/**
 * Lo que va sobre el eje de horas: los bloques del plan y los eventos con
 * hora. Lo que no tiene hora (misiones del día, plazos de campaña) va a su
 * propia lista, como el «todo el día» de cualquier calendario.
 */
export function itemsConHora(plan: PlanConBloques | null, eventos: CalendarEvent[]): ItemAgenda[] {
  const items: ItemAgenda[] = [];
  for (const b of plan?.bloques ?? []) {
    items.push({
      id: `b-${b.id}`,
      inicio: b.start_min,
      fin: b.end_min,
      titulo: b.title,
      detalle: b.detail,
      tipo: 'bloque',
      hecho: b.done,
      icono: KIND_ICON[b.kind],
    });
  }
  for (const e of eventos) {
    const min = horaAMinutos(e.time);
    if (min === null) continue;
    items.push({
      id: `e-${e.id}`,
      inicio: min,
      fin: min + DURACION_EVENTO,
      titulo: e.title,
      detalle: e.notes,
      tipo: 'evento',
    });
  }
  return items;
}

/** Los tramos con hora de un día, para la pista de carga de la tira. */
export function tramosDe(eventos: CalendarEvent[]): { id: string; inicio: number; fin: number }[] {
  return eventos
    .map((e) => horaAMinutos(e.time))
    .filter((m): m is number => m !== null)
    .map((m, i) => ({ id: `t${i}`, inicio: m, fin: m + DURACION_EVENTO }));
}

/** «Hoy · 2 bloques del plan · 1 evento», o el vacío. */
export function subtituloDia(c: ContenidoDia, bloques: number, dia: string, hoy: string): string {
  const partes: string[] = [];
  if (bloques) partes.push(t('agenda:derivar.bloques', { count: bloques }));
  if (c.eventos.length) partes.push(t('agenda:derivar.eventos', { count: c.eventos.length }));
  if (c.plazos.length) partes.push(t('agenda:derivar.plazos', { count: c.plazos.length }));
  if (c.misiones.length) partes.push(t('comun:mision', { count: c.misiones.length }));
  const cuando = relativoDe(dia, hoy);
  if (partes.length === 0) {
    return dia >= hoy ? t('agenda:derivar.vacioFuturo', { cuando }) : t('agenda:derivar.vacioPasado', { cuando });
  }
  return `${cuando} · ${partes.join(' · ')}`;
}

/** Lo que dice en voz alta un día del calendario: el día y sus recuentos. */
export function etiquetaDia(dia: string, hoy: string, c: ContenidoDia): string {
  const partes = [nombreDia(dia)];
  if (dia === hoy) partes.push(t('agenda:derivar.hoy'));
  if (c.eventos.length) partes.push(t('agenda:derivar.eventos', { count: c.eventos.length }));
  if (c.plazos.length) partes.push(t('agenda:derivar.plazosCampana', { count: c.plazos.length }));
  if (c.misiones.length) partes.push(t('comun:mision', { count: c.misiones.length }));
  return partes.join(', ');
}

/** «Miércoles, 7 de octubre» en mayúsculas cortas para la hoja: «MIÉRCOLES 7 OCT 2026». */
export function fechaInscrita(key: string): string {
  return mayus(`${diaSemana(key)} ${fechaCorta(key)} ${anioDe(key)}`);
}
