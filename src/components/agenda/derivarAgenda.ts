// NIVL · Agenda: lo que se deriva de los datos (puro, con tests). Sin red y
// sin Supabase: lo usan AgendaVista, el Calendario, las hojas y la galería.
//
// `dates.ts` solo se consume: los nombres de los días y los meses van aquí en
// tablas propias para no depender de `toLocaleDateString` en los títulos.

import { questsScheduledOn } from '@/lib/closing';
import type { PlanConBloques } from '@/lib/dayplan';
import { addDays, dateKey, nombreDia, relativoDe, weekdayOfKey } from '@/lib/dates';
import { horaAMinutos, KIND_ICON } from '@/lib/plan';
import type { CalendarEvent, DungeonTask, Quest } from '@/lib/types';
import type { ItemAgenda } from '@/components/LineaDeTiempo';

export type ModoAgenda = 'dia' | 'semana' | 'mes';

export const LETRAS_DIA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Duración que se le supone a un evento con hora (no guarda el final). */
export const DURACION_EVENTO = 45;

const mesDe = (key: string) => Number(key.slice(5, 7));
const diaDe = (key: string) => Number(key.slice(8));
const anioDe = (key: string) => Number(key.slice(0, 4));
const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
  return `${mayus(DIAS[weekdayOfKey(key) - 1] ?? '')} ${diaDe(key)}`;
}

/** Eyebrow del encabezado: «Octubre 2026». */
export function mesYAnio(key: string): string {
  return `${mayus(MESES[mesDe(key) - 1] ?? '')} ${anioDe(key)}`;
}

/** Título grabado: «Miércoles 7», «Semana 41» u «Octubre» (EncabezadoArena lo pasa a mayúsculas). */
export function tituloAgenda(modo: ModoAgenda, key: string): string {
  if (modo === 'semana') return `Semana ${semanaIso(inicioSemana(key))}`;
  if (modo === 'mes') return mayus(MESES[mesDe(key) - 1] ?? '');
  return diaCorto(key);
}

/**
 * El rango entre las flechas, en inscripción: «7 OCT 2026», «6 A 12 OCT» (o
 * «29 SEP A 5 OCT» si cruza de mes) y «OCTUBRE 2026». Sin guiones.
 */
export function rangoAgenda(modo: ModoAgenda, key: string): string {
  if (modo === 'mes') return `${MESES[mesDe(key) - 1]} ${anioDe(key)}`.toUpperCase();
  if (modo === 'dia') return `${diaDe(key)} ${MESES_CORTOS[mesDe(key) - 1]} ${anioDe(key)}`.toUpperCase();
  const ini = inicioSemana(key);
  const fin = addDays(ini, 6);
  const m1 = MESES_CORTOS[mesDe(ini) - 1];
  const m2 = MESES_CORTOS[mesDe(fin) - 1];
  const texto = m1 === m2 ? `${diaDe(ini)} a ${diaDe(fin)} ${m2}` : `${diaDe(ini)} ${m1} a ${diaDe(fin)} ${m2}`;
  return texto.toUpperCase();
}

/** Lo que oye el lector en cada flecha y en el rango. */
export function rangoLeido(modo: ModoAgenda, key: string): string {
  if (modo === 'mes') return `${MESES[mesDe(key) - 1]} de ${anioDe(key)}`;
  if (modo === 'dia') return nombreDia(key);
  const ini = inicioSemana(key);
  const fin = addDays(ini, 6);
  return `Semana ${semanaIso(ini)}, del ${diaDe(ini)} de ${MESES[mesDe(ini) - 1]} al ${diaDe(fin)} de ${MESES[mesDe(fin) - 1]}`;
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
    plazos: datos.dueTasks.filter((t) => t.due_date === dia),
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

export function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** «Hoy · 2 bloques del plan · 1 evento», o el vacío. */
export function subtituloDia(c: ContenidoDia, bloques: number, dia: string, hoy: string): string {
  const partes: string[] = [];
  if (bloques) partes.push(plural(bloques, 'bloque del plan', 'bloques del plan'));
  if (c.eventos.length) partes.push(plural(c.eventos.length, 'evento', 'eventos'));
  if (c.plazos.length) partes.push(plural(c.plazos.length, 'plazo', 'plazos'));
  if (c.misiones.length) partes.push(plural(c.misiones.length, 'misión', 'misiones'));
  const cuando = relativoDe(dia, hoy);
  if (partes.length === 0) {
    return dia >= hoy ? `${cuando}. Nada programado todavía.` : `${cuando}. Ese día no quedó nada registrado.`;
  }
  return `${cuando} · ${partes.join(' · ')}`;
}

/** Lo que dice en voz alta un día del calendario: el día y sus recuentos. */
export function etiquetaDia(dia: string, hoy: string, c: ContenidoDia): string {
  const partes = [nombreDia(dia)];
  if (dia === hoy) partes.push('hoy');
  if (c.eventos.length) partes.push(plural(c.eventos.length, 'evento', 'eventos'));
  if (c.plazos.length) partes.push(plural(c.plazos.length, 'plazo de campaña', 'plazos de campaña'));
  if (c.misiones.length) partes.push(plural(c.misiones.length, 'misión', 'misiones'));
  return partes.join(', ');
}

/** «Miércoles, 7 de octubre» en mayúsculas cortas para la hoja: «MIÉRCOLES 7 OCT 2026». */
export function fechaInscrita(key: string): string {
  return `${DIAS[weekdayOfKey(key) - 1]} ${diaDe(key)} ${MESES_CORTOS[mesDe(key) - 1]} ${anioDe(key)}`.toUpperCase();
}
