// La previsión: parseo con una respuesta real pegada y garantías de privacidad.
import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import {
  buscarCiudades,
  fetchPrevision,
  parsearCiudades,
  parsearPrevision,
  redondearCoordenada,
  urlPrevision,
  vaciarCachePrevision,
  zonaSegura,
} from './tiempo.ts';

// Respuesta real de api.open-meteo.com del 2026-11-08, sin tocar.
const REAL = JSON.parse(`{"latitude":40.39599,"longitude":-3.6793447,"generationtime_ms":0.11777877807617188,"utc_offset_seconds":3600,"timezone":"Europe/Madrid","timezone_abbreviation":"GMT+1","elevation":689.0,"hourly_units":{"time":"iso8601","temperature_2m":"°C","apparent_temperature":"°C","precipitation_probability":"%","precipitation":"mm","wind_speed_10m":"km/h","wind_gusts_10m":"km/h","uv_index":"","weather_code":"wmo code","is_day":""},"hourly":{"time":["2026-11-08T19:00","2026-11-08T20:00","2026-11-08T21:00"],"temperature_2m":[14.3,13.8,13.6],"apparent_temperature":[13.5,12.9,12.7],"precipitation_probability":[18,3,10],"precipitation":[0.00,0.00,0.00],"wind_speed_10m":[4.9,5.4,5.9],"wind_gusts_10m":[10.8,12.2,14.4],"uv_index":[0.00,0.00,0.00],"weather_code":[3,3,3],"is_day":[0,0,0]}}`);

function conFetch(f: (url: string) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = ((u: string | URL | Request) => {
    urls.push(String(u));
    return Promise.resolve(f(String(u)));
  }) as typeof fetch;
  return { urls, restaurar: () => { globalThis.fetch = original; } };
}

Deno.test('parseo: una respuesta real pasa a HoraClima', () => {
  const horas = parsearPrevision(REAL)!;
  assertEquals(horas.length, 3);
  assertEquals(horas[0], {
    hora: '2026-11-08T19:00', temp: 14.3, sensacion: 13.5, lluvia_prob: 18, lluvia_mm: 0,
    viento_kmh: 4.9, racha_kmh: 10.8, uv: 0, codigo: 3, es_de_dia: false,
  });
});

Deno.test('parseo: un dato que falta es null, nunca 0', () => {
  const horas = parsearPrevision({ hourly: { time: ['2026-11-08T19:00'], temperature_2m: [null], is_day: [1] } })!;
  assertEquals(horas[0]!.temp, null);
  assertEquals(horas[0]!.lluvia_mm, null);
  assertEquals(horas[0]!.es_de_dia, true);
});

Deno.test('parseo: lo que no es una previsión da null', () => {
  for (const x of [null, [], {}, { hourly: {} }, { hourly: { time: [] } }, { hourly: { time: ['ayer'] } }]) {
    assertEquals(parsearPrevision(x), null);
  }
});

Deno.test('URL: coordenadas a dos decimales y ningún identificador', () => {
  const u = new URL(urlPrevision(40.41678, -3.70379, 'Europe/Madrid'));
  assertEquals(u.host, 'api.open-meteo.com');
  assertEquals(u.searchParams.get('latitude'), '40.42');
  assertEquals(u.searchParams.get('longitude'), '-3.7');
  assertEquals(u.searchParams.get('forecast_hours'), '48');
  assertEquals([...u.searchParams.keys()].some((k) => /user|uid|email/i.test(k)), false);
});

Deno.test('URL: con clave va por el host de cliente', () => {
  const u = new URL(urlPrevision(40, -3, 'auto', 'clave-de-prueba'));
  assertEquals(u.host, 'customer-api.open-meteo.com');
  assertEquals(u.searchParams.get('apikey'), 'clave-de-prueba');
});

Deno.test('zona: el texto libre del perfil no llega tal cual', () => {
  assertEquals(zonaSegura('America/Argentina/Buenos_Aires'), 'America/Argentina/Buenos_Aires');
  assertEquals(zonaSegura('Etc/GMT+1'), 'Etc/GMT+1');
  for (const x of ['x&apikey=1', '', null, 'a b', 7]) assertEquals(zonaSegura(x), 'auto');
});

Deno.test('redondeo a la ciudad', () => {
  assertEquals(redondearCoordenada(40.41678), 40.42);
  assertEquals(redondearCoordenada(-3.70379), -3.7);
});

Deno.test('fetchPrevision: guarda en memoria y no repite la llamada', async () => {
  vaciarCachePrevision();
  const f = conFetch(() => new Response(JSON.stringify(REAL)));
  try {
    assertEquals((await fetchPrevision(40.4111, -3.68, 'Europe/Madrid'))?.length, 3);
    assertEquals((await fetchPrevision(40.4122, -3.6811, 'Europe/Madrid'))?.length, 3);
    assertEquals(f.urls.length, 1);
  } finally {
    f.restaurar();
  }
});

Deno.test('fetchPrevision: el fallo devuelve null y no se guarda', async () => {
  vaciarCachePrevision();
  let f = conFetch(() => new Response('no', { status: 500 }));
  assertEquals(await fetchPrevision(1, 2, 'auto'), null);
  f.restaurar();
  f = conFetch(() => { throw new TypeError('sin red'); });
  assertEquals(await fetchPrevision(1, 2, 'auto'), null);
  f.restaurar();
  f = conFetch(() => new Response(JSON.stringify(REAL)));
  assertEquals((await fetchPrevision(1, 2, 'auto'))?.length, 3);
  f.restaurar();
  assertEquals(await fetchPrevision(999, 2, 'auto'), null);
});

Deno.test('geocoding: coordenadas redondeadas y datos justos', () => {
  const c = parsearCiudades({
    results: [
      { name: 'Madrid', latitude: 40.4165, longitude: -3.70256, admin1: 'Comunidad Autónoma de Madrid', country: 'España', timezone: 'Europe/Madrid', population: 3255944, postcodes: ['28001'] },
      { name: 'Sin coordenadas' },
    ],
  });
  assertEquals(c, [{ nombre: 'Madrid', region: 'Comunidad Autónoma de Madrid', pais: 'España', lat: 40.42, lon: -3.7, zona: 'Europe/Madrid' }]);
  assertEquals(parsearCiudades({}), []);
});

Deno.test('geocoding: el fallo es null; sin resultados, lista vacía', async () => {
  let f = conFetch(() => new Response('', { status: 503 }));
  assertEquals(await buscarCiudades('Madrid'), null);
  f.restaurar();
  f = conFetch(() => new Response('{"generationtime_ms":0.1}'));
  assertEquals(await buscarCiudades('Xyzzy'), []);
  assertStringIncludes(f.urls[0]!, 'name=Xyzzy');
  f.restaurar();
});
