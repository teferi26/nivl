// NIVL · WORK: el calendario del teléfono (efectos, protegido).
//
// expo-calendar es nativo y llega con un binario nuevo. La OTA puede ir por
// delante, así que el paquete se carga solo si el módulo `ExpoCalendar` existe:
// en un binario sin él (y en web) `calendarioDisponible()` es false, la opción
// no se pinta y nada falla. Solo se leen eventos: este archivo no llama a
// ninguna función de escritura del calendario.
//
// La marca «conectado» es por cuenta y dispositivo y vive en AsyncStorage; si
// se pierde, lo copiado en la cuenta sigue contando como conectado (calendario.ts).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import {
  calendariosLegibles,
  debeSincronizar,
  filasImportadas,
  rangoCalendario,
  type EventoDispositivo,
  type PermisoCalendario,
} from './calendario';
import { borrarImportados, volcarImportados } from './datosCalendario';
import { sumarDias } from './fechas';

type ExpoCalendar = typeof import('expo-calendar');

let cache: ExpoCalendar | null | undefined;

function modulo(): ExpoCalendar | null {
  if (cache !== undefined) return cache;
  try {
    if (Platform.OS === 'web' || !requireOptionalNativeModule('ExpoCalendar')) {
      cache = null;
      return cache;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cache = require('expo-calendar') as ExpoCalendar;
  } catch {
    cache = null;
  }
  return cache;
}

/** ¿Tiene esta build el módulo nativo del calendario? */
export function calendarioDisponible(): boolean {
  return modulo() !== null;
}

export async function leerPermiso(): Promise<PermisoCalendario> {
  const m = modulo();
  if (!m) return 'undetermined';
  try {
    const r = await m.getCalendarPermissionsAsync();
    return r.status === 'granted' ? 'granted' : r.status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'undetermined';
  }
}

// ── La marca local ──────────────────────────────────────────────────

export interface MarcaCalendario {
  conectado: boolean;
  ultimaMs: number | null;
}

const clave = (uid: string) => `nivl:work:calendario:v1:${uid}`;

export async function leerMarca(uid: string): Promise<MarcaCalendario> {
  try {
    const crudo = await AsyncStorage.getItem(clave(uid));
    const v = crudo ? (JSON.parse(crudo) as Partial<MarcaCalendario>) : null;
    return { conectado: v?.conectado === true, ultimaMs: typeof v?.ultimaMs === 'number' ? v.ultimaMs : null };
  } catch {
    return { conectado: false, ultimaMs: null };
  }
}

async function guardarMarca(uid: string, marca: MarcaCalendario | null): Promise<void> {
  try {
    if (marca) await AsyncStorage.setItem(clave(uid), JSON.stringify(marca));
    else await AsyncStorage.removeItem(clave(uid));
  } catch {
    // Solo se pierde el recuerdo de cuándo se leyó por última vez.
  }
}

// ── Leer y copiar ───────────────────────────────────────────────────

async function leerEventos(m: ExpoCalendar, hoy: string): Promise<EventoDispositivo[]> {
  const ids = calendariosLegibles(await m.getCalendarsAsync(m.EntityTypes.EVENT));
  if (!ids.length) return [];
  const { desde, hasta } = rangoCalendario(hoy);
  const [a, b, c] = desde.split('-').map(Number) as [number, number, number];
  const [d, e, f] = sumarDias(hasta, 1).split('-').map(Number) as [number, number, number];
  const eventos = await m.getEventsAsync(ids, new Date(a, b - 1, c), new Date(d, e - 1, f));
  return eventos.map((ev) => ({
    id: String(ev.id ?? ''),
    titulo: ev.title ?? null,
    inicio: new Date(ev.startDate),
    fin: ev.endDate ? new Date(ev.endDate) : null,
    todoElDia: ev.allDay === true,
    cancelado: ev.status === m.EventStatus.CANCELED,
  }));
}

/** Lee el teléfono y copia. Devuelve false si no había nada que hacer (sin módulo o sin permiso). */
export async function copiarAhora(uid: string, hoy: string, tituloVacio: string): Promise<boolean> {
  const m = modulo();
  if (!m || (await leerPermiso()) !== 'granted') return false;
  const filas = filasImportadas(await leerEventos(m, hoy), hoy, { tituloVacio, todoElDiaEnUtc: Platform.OS === 'android' });
  await volcarImportados(uid, filas, hoy);
  await guardarMarca(uid, { conectado: true, ultimaMs: Date.now() });
  return true;
}

/** Pide el permiso del sistema y hace la primera copia. */
export async function conectarCalendario(uid: string, hoy: string, tituloVacio: string): Promise<'conectado' | 'denegado' | 'no_disponible'> {
  const m = modulo();
  if (!m) return 'no_disponible';
  const r = await m.requestCalendarPermissionsAsync();
  if (r.status !== 'granted') return 'denegado';
  await copiarAhora(uid, hoy, tituloVacio);
  return 'conectado';
}

/** Al volver a la agenda: copia si toca. Nunca lanza; una copia fallida se reintenta sola. */
export async function copiarSiToca(uid: string, hoy: string, tituloVacio: string, ultimaMs: number | null): Promise<boolean> {
  if (!debeSincronizar(ultimaMs, Date.now())) return false;
  try {
    return await copiarAhora(uid, hoy, tituloVacio);
  } catch {
    return false;
  }
}

/** Primero borra: si falla, la marca sigue y se puede reintentar. */
export async function desconectarCalendario(uid: string): Promise<void> {
  await borrarImportados();
  await guardarMarca(uid, null);
}
