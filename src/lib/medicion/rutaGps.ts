// NIVL · Cuentas de una ruta GPS (puro, con tests).
//
// Trabaja sobre los `PuntoRuta` del contrato: `t` son segundos desde `inicio`.
// Adelgazar una ruta no se hace aquí: es `reducirSerie` de entrenoMedido.ts.
// Un valor que no se pudo medir sale null, nunca 0: un 0 se leería como medido.

import type { MuestraFc, Parcial, PuntoRuta } from '../entrenoMedido';

const RADIO_TIERRA_M = 6371008.8;
/** Metros de subida o bajada que hay que superar para creérselos. */
export const HISTERESIS_DESNIVEL_M = 3;
/** Más rápido que esto entre dos puntos es un salto del GPS, no una persona. */
const VELOCIDAD_MAX_MS = 45;
// Un hueco largo casi sin avanzar es una pausa: su tiempo no cuenta para el ritmo.
const PAUSA_MIN_S = 10;
const VELOCIDAD_PAUSA_MS = 0.3;
/** Un resto final más corto que esto es ruido de la parada. */
const RESTO_MIN_M = 10;
const METROS_KM = 1000;
// Fuera de este rango no hay ritmo creíble: ni parado ni más rápido que un descenso en bici.
const RITMO_MIN_S_KM = 30;
const RITMO_MAX_S_KM = 3600;
const ALT_MIN_M = -500;
const ALT_MAX_M = 9000;
const SIN_CIFRA = '-';

type Coordenada = Pick<PuntoRuta, 'lat' | 'lon'>;

const radianes = (grados: number) => (grados * Math.PI) / 180;

/** Distancia en metros entre dos coordenadas (haversine). */
export function distanciaEntreM(a: Coordenada, b: Coordenada): number {
  const dLat = radianes(b.lat - a.lat);
  const dLon = radianes(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radianes(a.lat)) * Math.cos(radianes(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Lo que aporta un tramo entre dos puntos: metros y segundos en movimiento. */
function medirTramo(a: PuntoRuta, b: PuntoRuta): { m: number; s: number } {
  const dt = b.t - a.t;
  if (!(dt > 0)) return { m: 0, s: 0 };
  const m = distanciaEntreM(a, b);
  if (!Number.isFinite(m)) return { m: 0, s: 0 };
  const velocidad = m / dt;
  // Se pierde el tramo del salto, pero un punto malo no añade kilómetros.
  if (velocidad > VELOCIDAD_MAX_MS) return { m: 0, s: dt };
  if (dt >= PAUSA_MIN_S && velocidad < VELOCIDAD_PAUSA_MS) return { m, s: 0 };
  return { m, s: dt };
}

/** Metros de la ruta, o null si no hay al menos dos puntos. */
export function distanciaRutaM(ruta: readonly PuntoRuta[] | null): number | null {
  if (!ruta || ruta.length < 2) return null;
  let total = 0;
  for (let i = 1; i < ruta.length; i++) total += medirTramo(ruta[i - 1]!, ruta[i]!).m;
  return total;
}

function altitudValida(alt: number | null | undefined): alt is number {
  return typeof alt === 'number' && Number.isFinite(alt) && alt >= ALT_MIN_M && alt <= ALT_MAX_M;
}

/** Va recibiendo altitudes y devuelve lo que cada una suma a lo subido. */
function acumuladorDesnivel(histeresis: number): (alt: number | null) => number {
  let referencia: number | null = null;
  return (alt) => {
    if (!altitudValida(alt)) return 0;
    if (referencia === null) {
      referencia = alt;
      return 0;
    }
    const cambio = alt - referencia;
    if (cambio > histeresis) {
      referencia = alt;
      return cambio;
    }
    if (cambio < -histeresis) referencia = alt;
    return 0;
  };
}

/**
 * Metros subidos con histéresis: la altitud del GPS baila varios metros y
 * sumar cada baile inflaría el desnivel. Null si no hay dos altitudes válidas.
 */
export function desnivelSubidoM(
  ruta: readonly PuntoRuta[] | null,
  histeresis: number = HISTERESIS_DESNIVEL_M,
): number | null {
  if (!ruta || ruta.filter((p) => altitudValida(p.alt)).length < 2) return null;
  const sumar = acumuladorDesnivel(histeresis);
  return ruta.reduce((total, p) => total + sumar(p.alt), 0);
}

function fcMediaEntre(serie: readonly MuestraFc[] | null, desde: number, hasta: number): number | null {
  if (!serie) return null;
  const dentro = serie.filter((m) => m.t >= desde && m.t < hasta);
  if (dentro.length === 0) return null;
  return Math.round(dentro.reduce((suma, m) => suma + m.bpm, 0) / dentro.length);
}

const unDecimal = (x: number) => Math.round(x * 10) / 10;

/**
 * Un parcial por kilómetro, cortando el tramo por el punto exacto en que se
 * cumple. El último es el resto real, más corto. Sin ruta, ninguno.
 */
export function parcialesPorKm(
  ruta: readonly PuntoRuta[] | null,
  fcSerie: readonly MuestraFc[] | null = null,
): Parcial[] {
  if (!ruta || ruta.length < 2) return [];
  const hayAltitud = desnivelSubidoM(ruta) !== null;
  const sumarDesnivel = acumuladorDesnivel(HISTERESIS_DESNIVEL_M);
  sumarDesnivel(ruta[0]!.alt);

  const parciales: Parcial[] = [];
  let metros = 0;
  let segundos = 0;
  let subido = 0;
  let inicioTramo = ruta[0]!.t;

  const cerrar = (distancia: number, hasta: number) => {
    parciales.push({
      n: parciales.length + 1,
      tipo: 'km',
      distancia_m: unDecimal(distancia),
      duracion_s: unDecimal(segundos),
      fc_media: fcMediaEntre(fcSerie ?? null, inicioTramo, hasta),
      desnivel_m: hayAltitud ? unDecimal(subido) : null,
    });
    metros = 0;
    segundos = 0;
    subido = 0;
    inicioTramo = hasta;
  };

  for (let i = 1; i < ruta.length; i++) {
    const a = ruta[i - 1]!;
    const b = ruta[i]!;
    let { m, s } = medirTramo(a, b);
    let t = a.t;
    // Un `while`: en una ruta adelgazada, un solo tramo puede cruzar varios kilómetros.
    while (metros + m >= METROS_KM) {
      const fraccion = (METROS_KM - metros) / m;
      segundos += s * fraccion;
      const corte = t + (b.t - t) * fraccion;
      cerrar(METROS_KM, corte);
      m -= m * fraccion;
      s -= s * fraccion;
      t = corte;
    }
    metros += m;
    segundos += s;
    subido += sumarDesnivel(b.alt);
  }
  // normalizarEntreno descarta los parciales de menos de un segundo.
  if (metros >= RESTO_MIN_M && segundos >= 1) cerrar(metros, Infinity);
  return parciales;
}

/** Segundos por kilómetro, o null si no hay datos o el ritmo no es creíble. */
export function ritmoSKm(distancia_m: number | null, duracion_s: number | null): number | null {
  if (distancia_m === null || duracion_s === null) return null;
  if (!(distancia_m > 0) || !(duracion_s > 0)) return null;
  const ritmo = duracion_s / (distancia_m / METROS_KM);
  return ritmo >= RITMO_MIN_S_KM && ritmo <= RITMO_MAX_S_KM ? ritmo : null;
}

const dosCifras = (n: number) => String(n).padStart(2, '0');

/** «5:07». Sin unidad: la pone quien lo pinta, en su idioma. */
export function formatoRitmo(ritmo_s_km: number | null): string {
  if (ritmo_s_km === null || !Number.isFinite(ritmo_s_km) || ritmo_s_km <= 0) return SIN_CIFRA;
  // Se redondea el total: 59,6 s son «1:00», nunca «0:60».
  const total = Math.round(ritmo_s_km);
  return `${Math.floor(total / 60)}:${dosCifras(total % 60)}`;
}

/** «12:05» o, pasando de la hora, «1:02:03». */
export function formatoDuracion(segundos: number | null): string {
  if (segundos === null || !Number.isFinite(segundos) || segundos < 0) return SIN_CIFRA;
  const total = Math.round(segundos);
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const resto = dosCifras(total % 60);
  return horas > 0 ? `${horas}:${dosCifras(minutos)}:${resto}` : `${minutos}:${resto}`;
}
