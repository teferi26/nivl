// NIVL · La previsión meteorológica (Open-Meteo).
//
// Solo salen de aquí unas coordenadas a dos decimales (la ciudad, no la casa) y
// una zona horaria: ningún identificador de persona. Un fallo nunca rompe nada:
// quien llama recibe null y sigue sin previsión.
//
// La clave OPEN_METEO_API_KEY va en la URL porque así lo pide el proveedor: por
// eso aquí no se registra jamás una URL ni el error de un fetch.

import type { HoraClima } from './mejorHora.ts';

const API_LIBRE = 'https://api.open-meteo.com/v1/forecast';
const API_CLIENTE = 'https://customer-api.open-meteo.com/v1/forecast';
const GEO_LIBRE = 'https://geocoding-api.open-meteo.com/v1/search';
const GEO_CLIENTE = 'https://customer-geocoding-api.open-meteo.com/v1/search';

export const HORAS_PREVISION = 48;
const TIMEOUT_MS = 6000;
const TTL_MS = 15 * 60 * 1000;
const MAX_CACHE = 256;

const CAMPOS = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation_probability',
  'precipitation',
  'wind_speed_10m',
  'wind_gusts_10m',
  'uv_index',
  'weather_code',
  'is_day',
].join(',');

const HORA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:00$/;

/** La ciudad, no la casa. */
export function redondearCoordenada(x: number): number {
  return Math.round(x * 100) / 100;
}

function coordenadasValidas(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

/** `profiles.timezone` es texto libre: lo que no parezca una zona se deja a `auto`. */
export function zonaSegura(tz: unknown): string {
  return typeof tz === 'string' && tz.length <= 64 && /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)*$/.test(tz) ? tz : 'auto';
}

export function urlPrevision(lat: number, lon: number, tz: string, apiKey?: string): string {
  const q = new URLSearchParams({
    latitude: String(redondearCoordenada(lat)),
    longitude: String(redondearCoordenada(lon)),
    hourly: CAMPOS,
    forecast_hours: String(HORAS_PREVISION),
    timezone: zonaSegura(tz),
    wind_speed_unit: 'kmh',
  });
  if (apiKey) q.set('apikey', apiKey);
  return `${apiKey ? API_CLIENTE : API_LIBRE}?${q}`;
}

function esObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** La respuesta de Open-Meteo en `HoraClima[]`, o null si no es una previsión. */
export function parsearPrevision(json: unknown): HoraClima[] | null {
  if (!esObjeto(json) || !esObjeto(json.hourly) || !Array.isArray(json.hourly.time)) return null;
  const h = json.hourly;
  const numero = (campo: string, i: number): number | null => {
    const lista = h[campo];
    const v = Array.isArray(lista) ? lista[i] : null;
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };

  const horas: HoraClima[] = [];
  (h.time as unknown[]).forEach((t, i) => {
    if (typeof t !== 'string' || !HORA_ISO.test(t)) return;
    const dia = numero('is_day', i);
    horas.push({
      hora: t,
      temp: numero('temperature_2m', i),
      sensacion: numero('apparent_temperature', i),
      lluvia_prob: numero('precipitation_probability', i),
      lluvia_mm: numero('precipitation', i),
      viento_kmh: numero('wind_speed_10m', i),
      racha_kmh: numero('wind_gusts_10m', i),
      uv: numero('uv_index', i),
      codigo: numero('weather_code', i),
      es_de_dia: dia === null ? null : dia === 1,
    });
  });
  return horas.length ? horas.slice(0, HORAS_PREVISION) : null;
}

const cache = new Map<string, { caduca: number; horas: HoraClima[] }>();

/** Solo para las pruebas. */
export function vaciarCachePrevision(): void {
  cache.clear();
}

/** Las próximas 48 horas de esa ciudad. Null ante cualquier fallo. */
export async function fetchPrevision(lat: number, lon: number, tz: string): Promise<HoraClima[] | null> {
  if (!coordenadasValidas(lat, lon)) return null;
  const clave = `${redondearCoordenada(lat)}|${redondearCoordenada(lon)}|${zonaSegura(tz)}`;
  const ahora = Date.now();
  const guardada = cache.get(clave);
  if (guardada && guardada.caduca > ahora) return guardada.horas;

  try {
    const res = await fetch(urlPrevision(lat, lon, tz, Deno.env.get('OPEN_METEO_API_KEY') || undefined), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return null;
    }
    const horas = parsearPrevision(await res.json());
    if (!horas) return null;
    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
    cache.set(clave, { caduca: ahora + TTL_MS, horas });
    return horas;
  } catch {
    return null;
  }
}

export interface Ciudad {
  nombre: string;
  region: string | null;
  pais: string | null;
  lat: number;
  lon: number;
  zona: string | null;
}

/** Los resultados de geocoding, ya con las coordenadas a dos decimales. */
export function parsearCiudades(json: unknown): Ciudad[] {
  if (!esObjeto(json) || !Array.isArray(json.results)) return [];
  const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : null);
  const ciudades: Ciudad[] = [];
  for (const r of json.results) {
    if (!esObjeto(r) || typeof r.latitude !== 'number' || typeof r.longitude !== 'number') continue;
    const nombre = texto(r.name);
    if (!nombre || !coordenadasValidas(r.latitude, r.longitude)) continue;
    ciudades.push({
      nombre,
      region: texto(r.admin1),
      pais: texto(r.country),
      lat: redondearCoordenada(r.latitude),
      lon: redondearCoordenada(r.longitude),
      zona: texto(r.timezone),
    });
  }
  return ciudades;
}

/** Busca una ciudad por su nombre. Lista vacía si no hay; null ante un fallo. */
export async function buscarCiudades(texto: string, idioma = 'es'): Promise<Ciudad[] | null> {
  const apiKey = Deno.env.get('OPEN_METEO_API_KEY') || undefined;
  const q = new URLSearchParams({ name: texto, count: '6', language: idioma, format: 'json' });
  if (apiKey) q.set('apikey', apiKey);
  try {
    const res = await fetch(`${apiKey ? GEO_CLIENTE : GEO_LIBRE}?${q}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return null;
    }
    return parsearCiudades(await res.json());
  } catch {
    return null;
  }
}
