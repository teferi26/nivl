// NIVL · La aritmética del entreno medido.
//
// Distancias, ritmos, desnivel, parciales, zonas de pulso y récords. Regla de
// la casa: los números los calcula el código y la IA solo decide qué hacer con
// ellos.
//
// Puro y SIN IMPORTS a propósito: el mismo archivo se copia tal cual a
// `supabase/functions/_shared/entrenomath.ts` (Deno), y un test de paridad
// comprueba que no se han separado. Si tocas uno, toca el otro.

const RADIO_TIERRA_M = 6371000;

/** Un decimal: lo justo para no guardar el ruido del coma flotante. */
function redondear1(x: number): number {
  return Math.round(x * 10) / 10;
}

function positivo(x: number | null | undefined): x is number {
  return typeof x === 'number' && Number.isFinite(x) && x > 0;
}

/** Distancia entre dos puntos por haversine, en metros. */
export function distanciaM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "4:58". Sirve igual para min/km que para min/100 m. */
export function formatoRitmo(segPorKm: number | null): string | null {
  if (!positivo(segPorKm)) return null;
  // Se redondea antes de partir: 59,6 s son "1:00", nunca "0:60".
  const total = Math.round(segPorKm);
  const seg = total % 60;
  return `${Math.floor(total / 60)}:${seg < 10 ? '0' : ''}${seg}`;
}

export function ritmoSegKm(distancia_m: number | null, duracion_s: number): number | null {
  if (!positivo(distancia_m) || !positivo(duracion_s)) return null;
  return (duracion_s * 1000) / distancia_m;
}

/** El ritmo de la natación: segundos cada 100 m. */
export function ritmoSeg100m(distancia_m: number | null, duracion_s: number): number | null {
  if (!positivo(distancia_m) || !positivo(duracion_s)) return null;
  return (duracion_s * 100) / distancia_m;
}

export function velocidadKmh(distancia_m: number | null, duracion_s: number): number | null {
  if (!positivo(distancia_m) || !positivo(duracion_s)) return null;
  return (distancia_m * 3.6) / duracion_s;
}

export interface PuntoAlt {
  t: number;
  lat: number;
  lon: number;
  alt: number | null;
}

export function distanciaRuta(ruta: PuntoAlt[]): number {
  let total = 0;
  for (let i = 1; i < ruta.length; i++) total += distanciaM(ruta[i - 1]!, ruta[i]!);
  return total;
}

/**
 * El filtro de histéresis: el nivel de referencia solo se mueve cuando la
 * altitud se aleja de él `umbral_m` o más, y solo lo subido suma. Devuelve lo
 * ganado con esa muestra. El estado se comparte con `parcialesDeRuta`, para
 * que la suma de los parciales sea exactamente el desnivel total.
 */
function pasoHisteresis(estado: { ref: number | null }, alt: number | null, umbral_m: number): number {
  if (alt === null || !Number.isFinite(alt)) return 0;
  if (estado.ref === null) {
    estado.ref = alt;
    return 0;
  }
  const delta = alt - estado.ref;
  if (delta >= umbral_m) {
    estado.ref = alt;
    return delta;
  }
  if (delta <= -umbral_m) estado.ref = alt;
  return 0;
}

/** Metros subidos. El ruido del barómetro por debajo del umbral no suma. */
export function desnivelPositivo(ruta: PuntoAlt[], umbral_m: number = 3): number {
  const estado = { ref: null as number | null };
  let total = 0;
  for (const p of ruta) total += pasoHisteresis(estado, p.alt, umbral_m);
  return total;
}

export interface ParcialCalc {
  n: number;
  tipo: 'km' | 'largo' | 'vuelta' | 'transicion';
  distancia_m: number;
  duracion_s: number;
  fc_media: number | null;
  desnivel_m: number | null;
}

/** Por debajo de un metro, lo que sobra al final es residuo y no un parcial. */
const RESIDUO_M = 1;

/**
 * Trocea la ruta cada `cadaM` metros interpolando el instante exacto en que se
 * cruza cada marca. Un tramo sin señal que salte varias marcas se reparte a
 * velocidad constante. El último parcial es lo que sobre, si llega a un metro.
 */
export function parcialesDeRuta(
  ruta: PuntoAlt[],
  cadaM: number = 1000,
  fc?: { t: number; bpm: number }[] | null,
): ParcialCalc[] {
  if (ruta.length < 2 || !positivo(cadaM)) return [];
  const tipo: ParcialCalc['tipo'] = cadaM === 1000 ? 'km' : 'vuelta';
  const salida: ParcialCalc[] = [];
  const estado = { ref: null as number | null };
  pasoHisteresis(estado, ruta[0]!.alt, 3);

  let tInicio = ruta[0]!.t;
  let acumulado = 0;
  let ganado = 0;
  let hayAltitud = ruta[0]!.alt !== null;

  const mediaFc = (desde: number, hasta: number, incluyeFin: boolean): number | null => {
    if (!fc) return null;
    let suma = 0;
    let cuenta = 0;
    for (const m of fc) {
      if (m.t >= desde && (m.t < hasta || (incluyeFin && m.t === hasta))) {
        suma += m.bpm;
        cuenta++;
      }
    }
    return cuenta > 0 ? Math.round(suma / cuenta) : null;
  };

  const cerrar = (distancia: number, tFin: number, ultimo: boolean) => {
    salida.push({
      n: salida.length + 1,
      tipo,
      distancia_m: redondear1(distancia),
      duracion_s: redondear1(tFin - tInicio),
      fc_media: mediaFc(tInicio, tFin, ultimo),
      desnivel_m: hayAltitud ? ganado : null,
    });
    tInicio = tFin;
    acumulado = 0;
    ganado = 0;
    hayAltitud = false;
  };

  const EPSILON = 1e-6;
  for (let i = 1; i < ruta.length; i++) {
    const a = ruta[i - 1]!;
    const b = ruta[i]!;
    const tramo = distanciaM(a, b);
    let recorrido = 0;
    while (acumulado + (tramo - recorrido) > cadaM + EPSILON) {
      recorrido += cadaM - acumulado;
      cerrar(cadaM, a.t + (b.t - a.t) * (recorrido / tramo), false);
    }
    acumulado += tramo - recorrido;
    // El punto `b` cae dentro del parcial en curso: lo que confirme es suyo.
    ganado += pasoHisteresis(estado, b.alt, 3);
    if (b.alt !== null) hayAltitud = true;
    if (acumulado >= cadaM - EPSILON && i < ruta.length - 1) cerrar(cadaM, b.t, false);
  }

  const ultimoPunto = ruta[ruta.length - 1]!;
  if (acumulado >= cadaM - EPSILON) {
    cerrar(cadaM, ultimoPunto.t, true);
  } else if (acumulado >= RESIDUO_M) {
    cerrar(acumulado, ultimoPunto.t, true);
  } else if (ganado > 0 && salida.length > 0) {
    // Lo confirmado en el residuo va al último parcial: la suma sigue cuadrando.
    const previo = salida[salida.length - 1]!;
    previo.desnivel_m = (previo.desnivel_m ?? 0) + ganado;
  }
  return salida;
}

export type Zona = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5';

export interface PerfilFc {
  fc_max: number | null;
  fc_reposo: number | null;
  umbral: number | null;
}

const ZONAS: readonly Zona[] = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];

/** Inicio de Z2..Z5 en fracción del umbral (Friel simplificado). */
const FRACCIONES_UMBRAL = [0.85, 0.9, 0.95, 1] as const;
/** Inicio de Z1..Z5 y techo de Z5, en fracción de reserva o de FC máxima. */
const FRACCIONES_MAX = [0.5, 0.6, 0.7, 0.8, 0.9, 1] as const;

/**
 * Los límites en pulsaciones enteras. Cada zona acaba justo antes de empezar
 * la siguiente. Con umbral: % de LTHR. Sin umbral y con máxima y reposo:
 * Karvonen. Solo máxima: % de FC máxima. Sin nada: null.
 */
export function limitesZonas(p: PerfilFc): { zona: Zona; desde: number; hasta: number }[] | null {
  const montar = (inicios: number[], techo: number) =>
    ZONAS.map((zona, i) => ({
      zona,
      desde: inicios[i]!,
      hasta: i < ZONAS.length - 1 ? inicios[i + 1]! - 1 : techo,
    }));

  if (positivo(p.umbral)) {
    const umbral = p.umbral;
    const inicios = [0, ...FRACCIONES_UMBRAL.map((f) => Math.round(umbral * f))];
    const inicioZ5 = inicios[4]!;
    const techo = positivo(p.fc_max) && p.fc_max >= inicioZ5 ? Math.round(p.fc_max) : Math.round(umbral * 1.1);
    return montar(inicios, techo);
  }
  if (positivo(p.fc_max)) {
    const max = p.fc_max;
    // Un reposo igual o mayor que la máxima es un dato roto: se ignora.
    const reposo = positivo(p.fc_reposo) && p.fc_reposo < max ? p.fc_reposo : 0;
    const valores = FRACCIONES_MAX.map((f) => Math.round(reposo + (max - reposo) * f));
    return montar(valores.slice(0, 5), valores[5]!);
  }
  return null;
}

/** Por debajo de Z1 cuenta como Z1 y por encima de Z5 como Z5. */
export function zonaDe(bpm: number, limites: ReturnType<typeof limitesZonas>): Zona | null {
  if (!limites || limites.length === 0 || !positivo(bpm)) return null;
  for (let i = limites.length - 1; i >= 0; i--) {
    if (bpm >= limites[i]!.desde) return limites[i]!.zona;
  }
  return limites[0]!.zona;
}

/**
 * Segundos en cada zona con la mejor fuente que haya: serie de pulso, si no
 * parciales, si no la media (toda la sesión en su zona). Sin nada: null. La
 * suma es la duración de la sesión.
 */
export function tiempoEnZonas(
  entrada: {
    fc_serie?: { t: number; bpm: number }[] | null;
    parciales?: { duracion_s: number; fc_media: number | null }[];
    duracion_s: number;
    fc_media: number | null;
  },
  perfil: PerfilFc,
): Record<Zona, number> | null {
  const limites = limitesZonas(perfil);
  const duracion = entrada.duracion_s;
  if (!limites || !positivo(duracion)) return null;
  const tiempos: Record<Zona, number> = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 };
  const sumar = (bpm: number, segundos: number) => {
    const z = zonaDe(bpm, limites);
    if (z) tiempos[z] += segundos;
  };

  const serie = (entrada.fc_serie ?? []).filter((m) => positivo(m.bpm));
  if (serie.length > 0) {
    // Cada muestra vale hasta la siguiente; la primera cubre desde el inicio y
    // la última hasta el final, para que no se pierda ni sobre tiempo.
    serie.forEach((m, i) => {
      const desde = i === 0 ? 0 : Math.min(m.t, duracion);
      const hasta = i === serie.length - 1 ? duracion : Math.min(serie[i + 1]!.t, duracion);
      if (hasta > desde) sumar(m.bpm, hasta - desde);
    });
    return tiempos;
  }

  const conPulso = (entrada.parciales ?? []).filter((p) => positivo(p.fc_media) && positivo(p.duracion_s));
  const medido = conPulso.reduce((s, p) => s + p.duracion_s, 0);
  const media = positivo(entrada.fc_media) ? entrada.fc_media : null;
  if (medido > 0) {
    // Lo que los parciales no cubren va a la zona de la media. Sin media, o si
    // los parciales se pasan de la duración, se reescala para que sume igual.
    const escala = media === null || medido > duracion ? duracion / medido : 1;
    for (const p of conPulso) sumar(p.fc_media as number, p.duracion_s * escala);
    if (media !== null && medido < duracion) sumar(media, duracion - medido);
    return tiempos;
  }

  if (media !== null) {
    sumar(media, duracion);
    return tiempos;
  }
  return null;
}

export interface EntrenoRecord {
  id: string;
  deporte: string;
  fecha: string;
  distancia_m: number | null;
  duracion_s: number;
  desnivel_m: number | null;
  ruta?: { t: number; lat: number; lon: number; alt: number | null }[] | null;
  parciales?: { tipo: string; distancia_m: number; duracion_s: number }[];
}

export interface Record_ {
  clave: string;
  etiqueta: string;
  deporte: string;
  valor_s: number;
  entreno_id: string;
  fecha: string;
}

/**
 * Lo más rápido que se han cubierto `metros` seguidos. El óptimo de una
 * función a trozos cae con el inicio o el final de la ventana sobre un punto
 * de la ruta, así que basta probar esos dos casos, interpolando el otro
 * extremo. Dos pasadas con punteros que solo avanzan: O(n).
 */
export function mejorTramoSeg(ruta: { t: number; lat: number; lon: number }[], metros: number): number | null {
  const n = ruta.length;
  if (n < 2 || !positivo(metros)) return null;
  const acumulada: number[] = [0];
  for (let i = 1; i < n; i++) acumulada.push(acumulada[i - 1]! + distanciaM(ruta[i - 1]!, ruta[i]!));
  const total = acumulada[n - 1]!;
  if (total < metros) return null;

  const instante = (k: number, d: number): number => {
    const largo = acumulada[k + 1]! - acumulada[k]!;
    if (largo <= 0) return ruta[k + 1]!.t;
    return ruta[k]!.t + ((ruta[k + 1]!.t - ruta[k]!.t) * (d - acumulada[k]!)) / largo;
  };

  let mejor = Infinity;
  let p = 0;
  for (let fin = 1; fin < n; fin++) {
    const desde = acumulada[fin]! - metros;
    if (desde < 0) continue;
    while (p < n - 2 && acumulada[p + 1]! < desde) p++;
    mejor = Math.min(mejor, ruta[fin]!.t - instante(p, desde));
  }
  let q = 0;
  for (let inicio = 0; inicio < n; inicio++) {
    const hasta = acumulada[inicio]! + metros;
    if (hasta > total) break;
    while (q < n - 2 && acumulada[q + 1]! < hasta) q++;
    mejor = Math.min(mejor, instante(q, hasta) - ruta[inicio]!.t);
  }
  return Number.isFinite(mejor) && mejor > 0 ? mejor : null;
}

type Marca = readonly [metros: number, clave: string, etiqueta: string];

const MARCAS_RUTA: Record<string, readonly Marca[]> = {
  carrera: [
    [1000, '1k', '1 km'],
    [5000, '5k', '5 km'],
    [10000, '10k', '10 km'],
    [21100, '21k', 'Media maratón'],
    [42200, '42k', 'Maratón'],
  ],
  bici: [
    [20000, '20k', '20 km'],
    [40000, '40k', '40 km'],
    [90000, '90k', '90 km'],
    [180000, '180k', '180 km'],
  ],
};

const MARCAS_NATACION: readonly Marca[] = [
  [100, '100m', '100 m'],
  [400, '400m', '400 m'],
  [750, '750m', '750 m'],
  [1500, '1500m', '1500 m'],
  [1900, '1900m', '1900 m'],
  [3800, '3800m', '3800 m'],
];

const ORDEN_DEPORTES = ['carrera', 'bici', 'natacion'];

/**
 * Velocidad media (m/s) por encima de la cual aquello no es la persona: un
 * salto del GPS o un reloj olvidado en el coche. Holgada de sobra respecto a
 * los récords del mundo; un récord falso se queda para siempre en el palmarés.
 */
const VELOCIDAD_CREIBLE: Record<string, number> = { carrera: 10, bici: 30, natacion: 3 };

/** Piscina y aguas abiertas compiten en la misma tabla de natación. */
function deporteRecord(deporte: string): string {
  return deporte === 'piscina' || deporte === 'aguas_abiertas' ? 'natacion' : deporte;
}

function velocidadCreible(deporte: string, metros: number, segundos: number): boolean {
  if (!positivo(segundos)) return false;
  const tope = VELOCIDAD_CREIBLE[deporte];
  return tope === undefined || metros / segundos <= tope;
}

/** Con una piscina de 33,33 m, tres largos son 99,99 m y valen por 100. */
const TOLERANCIA_LARGOS = 0.995;
/** Una sesión completa vale si llega a la distancia y no se pasa del 2 %. */
const HOLGURA_SESION = 1.02;

/** El menor tiempo en largos seguidos que llega a `metros`. Ventana O(n). */
function mejorEnLargos(parciales: { tipo: string; distancia_m: number; duracion_s: number }[], metros: number): number | null {
  const objetivo = metros * TOLERANCIA_LARGOS;
  let mejor: number | null = null;
  let inicio = 0;
  let distancia = 0;
  let tiempo = 0;
  for (let i = 0; i < parciales.length; i++) {
    const p = parciales[i]!;
    if (p.tipo !== 'largo') {
      // Lo que no es un largo corta la serie: ya no son consecutivos.
      inicio = i + 1;
      distancia = 0;
      tiempo = 0;
      continue;
    }
    distancia += p.distancia_m;
    tiempo += p.duracion_s;
    while (inicio < i && distancia - parciales[inicio]!.distancia_m >= objetivo) {
      distancia -= parciales[inicio]!.distancia_m;
      tiempo -= parciales[inicio]!.duracion_s;
      inicio++;
    }
    if (distancia >= objetivo && (mejor === null || tiempo < mejor)) mejor = tiempo;
  }
  return mejor;
}

function esMejor(clave: string, nuevo: number, viejo: number): boolean {
  return clave === 'distancia_max' || clave === 'desnivel_max' ? nuevo > viejo : nuevo < viejo;
}

function idRecord(r: { deporte: string; clave: string }): string {
  return `${r.deporte}|${r.clave}`;
}

/**
 * El palmarés completo. La identidad de un récord es deporte + clave. En `valor_s`
 * van segundos, salvo en `distancia_max` (metros) y `desnivel_max` (metros). A
 * igualdad manda el primero que lo consiguió.
 */
export function recordsPersonales(entrenos: EntrenoRecord[]): Record_[] {
  const mejores = new Map<string, Record_>();
  const proponer = (r: Record_) => {
    const id = idRecord(r);
    const actual = mejores.get(id);
    if (!actual || esMejor(r.clave, r.valor_s, actual.valor_s)) mejores.set(id, r);
  };

  const cronologicos = entrenos.slice().sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  for (const e of cronologicos) {
    const deporte = deporteRecord(e.deporte);
    const base = { deporte, entreno_id: e.id, fecha: e.fecha };
    const ruta = e.ruta && e.ruta.length >= 2 ? e.ruta : null;
    const distancia = positivo(e.distancia_m) ? e.distancia_m : ruta ? distanciaRuta(ruta) : 0;
    if (distancia > 0 && !velocidadCreible(deporte, distancia, e.duracion_s)) continue;

    const marcaTiempo = ([metros, clave, etiqueta]: Marca, segundos: number | null) => {
      if (segundos !== null && velocidadCreible(deporte, metros, segundos)) {
        proponer({ ...base, clave, etiqueta, valor_s: redondear1(segundos) });
      }
    };

    if (ruta) for (const m of MARCAS_RUTA[deporte] ?? []) marcaTiempo(m, mejorTramoSeg(ruta, m[0]));
    if (deporte === 'natacion') {
      for (const m of MARCAS_NATACION) {
        marcaTiempo(m, mejorEnLargos(e.parciales ?? [], m[0]));
        if (distancia >= m[0] && distancia <= m[0] * HOLGURA_SESION) marcaTiempo(m, e.duracion_s);
      }
    }

    if (distancia > 0) {
      proponer({ ...base, clave: 'distancia_max', etiqueta: 'Distancia más larga', valor_s: redondear1(distancia) });
    }
    const subido = positivo(e.desnivel_m) ? e.desnivel_m : ruta ? desnivelPositivo(ruta) : 0;
    if (subido > 0) {
      proponer({ ...base, clave: 'desnivel_max', etiqueta: 'Mayor desnivel', valor_s: redondear1(subido) });
    }
  }

  const peso = (d: string) => {
    const i = ORDEN_DEPORTES.indexOf(d);
    return i < 0 ? ORDEN_DEPORTES.length : i;
  };
  // El orden de la tabla, y los deportes sin tabla, al final y por nombre.
  const posicion = (d: string, clave: string) => {
    const marcas = d === 'natacion' ? MARCAS_NATACION : MARCAS_RUTA[d] ?? [];
    const i = marcas.findIndex((m) => m[1] === clave);
    if (i >= 0) return i;
    return clave === 'distancia_max' ? marcas.length : marcas.length + 1;
  };
  return Array.from(mejores.values()).sort(
    (a, b) =>
      peso(a.deporte) - peso(b.deporte) ||
      a.deporte.localeCompare(b.deporte) ||
      posicion(a.deporte, a.clave) - posicion(b.deporte, b.clave),
  );
}

/**
 * Los récords que ha batido este entreno. Volver a importar el mismo entreno
 * no anuncia nada: si ya era suyo con ese valor, no es nuevo.
 */
export function nuevosRecords(antes: Record_[], despues: Record_[], entreno_id: string): Record_[] {
  const previos = new Map(antes.map((r) => [idRecord(r), r] as const));
  return despues.filter((r) => {
    if (r.entreno_id !== entreno_id) return false;
    const previo = previos.get(idRecord(r));
    return !previo || esMejor(r.clave, r.valor_s, previo.valor_s);
  });
}
