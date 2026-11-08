// NIVL · WORK: del calendario del teléfono a las filas de calendar_events (puro).
//
// Solo lectura y con permiso explícito: se copian título y horas de hoy a 14
// días. Sin Supabase ni expo-calendar: los efectos están en
// calendarioDispositivo.ts y datosCalendario.ts.
//
// La identidad de una fila es `<id del evento>@<día>`: una serie repetida tiene
// el mismo id en todas sus ocurrencias, así que sin el día las semanas se
// pisarían entre sí. Reimportar no duplica (índice único de la 0116) y lo que
// ya no está en el teléfono se retira con `idsObsoletos`.

import { esFecha, fechaLocal, minAHora, minutosLocal, sumarDias } from './fechas';

export const DIAS_CALENDARIO = 14;
export const MAX_EVENTOS_IMPORTADOS = 300;
export const MAX_TITULO_IMPORTADO = 200;
/** Tope del CHECK de external_id en la 0116. */
const MAX_EXTERNAL_ID = 300;
/** Volver a leer el teléfono como mucho cada media hora. */
export const INTERVALO_SYNC_MS = 30 * 60_000;

/** Un evento leído del teléfono, ya sin la forma de expo-calendar. */
export interface EventoDispositivo {
  id: string;
  titulo: string | null;
  inicio: Date;
  fin: Date | null;
  todoElDia: boolean;
  cancelado: boolean;
}

export interface FilaImportada {
  title: string;
  date: string;
  time: string | null;
  end_time: string | null;
  source: 'dispositivo';
  external_id: string;
}

export interface OpcionesImportar {
  /** El título de un evento que no lo tiene (ya traducido). */
  tituloVacio: string;
  /** Android guarda el «todo el día» como medianoche UTC; iOS, en hora local. */
  todoElDiaEnUtc: boolean;
}

/** Los días que se copian: de hoy a hoy + 14, los dos incluidos. */
export function rangoCalendario(hoy: string): { desde: string; hasta: string } {
  return { desde: hoy, hasta: sumarDias(hoy, DIAS_CALENDARIO) };
}

function limpiarTitulo(titulo: string | null, vacio: string): string {
  const t = (titulo ?? '').replace(/\s+/g, ' ').trim();
  return (t || vacio).slice(0, MAX_TITULO_IMPORTADO);
}

const fechaUtc = (d: Date) => d.toISOString().slice(0, 10);
const esValida = (d: Date | null): d is Date => d instanceof Date && !Number.isNaN(d.getTime());

/** Los días que ocupa un evento de todo el día (el último incluido). */
function diasDeTodoElDia(e: EventoDispositivo, enUtc: boolean): string[] {
  const dia = enUtc ? fechaUtc : fechaLocal;
  const primero = dia(e.inicio);
  let ultimo = esValida(e.fin) ? dia(e.fin) : primero;
  // Con el fin en medianoche exacta, ese día ya no está ocupado (Android).
  if (esValida(e.fin) && e.fin.getTime() > e.inicio.getTime()) {
    const medianoche = enUtc ? e.fin.getUTCHours() + e.fin.getUTCMinutes() === 0 : e.fin.getHours() + e.fin.getMinutes() === 0;
    if (medianoche) ultimo = sumarDias(ultimo, -1);
  }
  if (ultimo < primero) ultimo = primero;
  const dias: string[] = [];
  for (let f = primero; f <= ultimo && dias.length <= DIAS_CALENDARIO * 4; f = sumarDias(f, 1)) dias.push(f);
  return dias;
}

/**
 * Las filas que se copian: solo lo de dentro del rango, sin cancelados y sin
 * repetir identidad (Postgres rechaza un upsert que toca dos veces la misma fila).
 */
export function filasImportadas(eventos: readonly EventoDispositivo[], hoy: string, op: OpcionesImportar): FilaImportada[] {
  const { desde, hasta } = rangoCalendario(hoy);
  const porId = new Map<string, FilaImportada>();
  const poner = (e: EventoDispositivo, fila: Omit<FilaImportada, 'title' | 'source' | 'external_id'>) => {
    const external_id = `${e.id}@${fila.date}`;
    if (external_id.length > MAX_EXTERNAL_ID || porId.has(external_id)) return;
    porId.set(external_id, { ...fila, title: limpiarTitulo(e.titulo, op.tituloVacio), source: 'dispositivo', external_id });
  };

  for (const e of eventos) {
    if (e.cancelado || !e.id || !esValida(e.inicio)) continue;
    if (e.todoElDia) {
      for (const dia of diasDeTodoElDia(e, op.todoElDiaEnUtc)) {
        if (dia >= desde && dia <= hasta) poner(e, { date: dia, time: null, end_time: null });
      }
      continue;
    }
    const date = fechaLocal(e.inicio);
    if (date < desde || date > hasta) continue;
    // Si acaba otro día, la hora de fin no cabe en esta fila: se asume la duración por defecto.
    const acabaHoy = esValida(e.fin) && e.fin.getTime() > e.inicio.getTime() && fechaLocal(e.fin) === date;
    poner(e, {
      date,
      time: minAHora(minutosLocal(e.inicio)),
      end_time: acabaHoy ? minAHora(minutosLocal(e.fin as Date)) : null,
    });
  }

  return [...porId.values()]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '') || a.external_id.localeCompare(b.external_id))
    .slice(0, MAX_EVENTOS_IMPORTADOS);
}

/**
 * Lo importado antes que ya no está en el teléfono. Solo dentro del rango: lo
 * pasado se queda (la revisión de la semana cuenta sus reuniones) hasta desconectar.
 */
export function idsObsoletos(
  existentes: readonly { id: string; date: string; external_id: string | null }[],
  filas: readonly FilaImportada[],
  hoy: string,
): string[] {
  const { desde, hasta } = rangoCalendario(hoy);
  const vivos = new Set(filas.map((f) => f.external_id));
  return existentes
    .filter((e) => esFecha(e.date.slice(0, 10)) && e.date.slice(0, 10) >= desde && e.date.slice(0, 10) <= hasta)
    .filter((e) => !e.external_id || !vivos.has(e.external_id))
    .map((e) => e.id);
}

/** De qué calendarios se copia: los cumpleaños son datos de terceros, no agenda. */
export function calendariosLegibles<T extends { id?: string; type?: string }>(calendarios: readonly T[]): string[] {
  return calendarios.filter((c) => c.id && String(c.type ?? '').toLowerCase() !== 'birthdays').map((c) => c.id as string);
}

export type EstadoCalendario = 'oculto' | 'ofrecer' | 'denegado' | 'conectado';
export type PermisoCalendario = 'granted' | 'denied' | 'undetermined';

/** Qué enseña la fila de la agenda. Sin el módulo nativo, nada. */
export function estadoCalendario(e: { modulo: boolean; marcado: boolean; hayImportados: boolean; permiso: PermisoCalendario }): EstadoCalendario {
  if (!e.modulo) return 'oculto';
  if (e.permiso === 'denied') return 'denegado';
  if (e.marcado && e.permiso === 'granted') return 'conectado';
  // Tras reinstalar, la marca local se pierde pero lo copiado sigue en la cuenta.
  if (e.hayImportados && e.permiso === 'granted') return 'conectado';
  return 'ofrecer';
}

/** Con lo copiado en la cuenta siempre se puede desconectar, aunque se retire el permiso. */
export function puedeDesconectar(estado: EstadoCalendario, hayImportados: boolean): boolean {
  return estado === 'conectado' || (estado === 'denegado' && hayImportados);
}

export function debeSincronizar(ultimaMs: number | null, ahoraMs: number, intervaloMs = INTERVALO_SYNC_MS): boolean {
  return ultimaMs === null || ahoraMs - ultimaMs >= intervaloMs || ahoraMs < ultimaMs;
}
