// NIVL · Gafas Meta: de los datos del momento a una tarjeta. Puro.
//
// Cada envío a Display reemplaza la pantalla entera, así que aquí no hay
// actualizaciones parciales: una tarjeta completa o nada.
//
// LIMITES es una estimación propia y conservadora para 600x600: Meta no publica
// cuántos caracteres caben en cada estilo. Hay que ajustarla con la vista
// previa de Display del Mock Device Kit.

import { sinGuiones } from '../../../src/lib/singuiones';
import type {
  BotonTarjeta,
  DatosCardio,
  DatosEstudio,
  DatosSerie,
  EstiloTexto,
  LineaTarjeta,
  MisionPendiente,
  Tarjeta,
} from './tipos';

export const LIMITES: Record<EstiloTexto | 'hablado', number> = {
  heading: 36,
  body: 60,
  meta: 40,
  hablado: 140,
};
export const MAX_LINEAS = 4;
/** Por debajo de esta diferencia, en segundos por km, se va en ritmo. */
export const TOLERANCIA_RITMO_SEG = 3;

const SEPARADOR = ' \u00b7 ';
const ELIPSIS = '\u2026';
const BOTON_HECHO: BotonTarjeta = { id: 'hecho', texto: 'Hecho' };
/** Un corte no debe dejar la frase colgando de una de estas. */
const COLGANTES = new Set([
  'a', 'al', 'con', 'de', 'del', 'e', 'el', 'en', 'la', 'las', 'lo', 'los',
  'o', 'para', 'por', 'sin', 'u', 'un', 'una', 'y',
]);

function limpiar(texto: string | null | undefined): string {
  return sinGuiones(texto ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Acorta por palabras, sin partir emojis ni dejar un conector al final. Solo
 * corta una palabra si la alternativa es perder más de medio texto.
 */
export function recortar(texto: string | null | undefined, max: number, final = ELIPSIS): string {
  const limpio = limpiar(texto);
  const letras = Array.from(limpio);
  if (letras.length <= max) return limpio;
  const cupo = Math.max(1, max - Array.from(final).length);
  let corte = letras.slice(0, cupo).join('');
  if (letras[cupo] !== ' ') {
    const espacio = corte.lastIndexOf(' ');
    if (espacio >= corte.length / 2) corte = corte.slice(0, espacio);
  }
  const palabras = corte.trim().split(' ');
  while (palabras.length > 1 && COLGANTES.has(palabras[palabras.length - 1].toLowerCase())) {
    palabras.pop();
  }
  return palabras.join(' ').replace(/[\s,;:.\u00b7-]+$/, '') + final;
}

function valido(n: number | null | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function cifra(n: number, decimales = 2): string {
  const f = 10 ** decimales;
  return String(Math.round(n * f) / f).replace('.', ',');
}

function plural(n: number, singular: string, varias: string): string {
  return n === 1 ? singular : varias;
}

/** 342 a «5:42». Redondea antes de partir: 59,7 segundos no es «5:60». */
function minSeg(seg: number): string {
  const total = Math.round(seg);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function minSegHablado(seg: number): string {
  const total = Math.round(seg);
  const m = Math.floor(total / 60);
  const s = total % 60;
  const min = m > 0 ? `${m} ${plural(m, 'minuto', 'minutos')}` : '';
  const sec = s > 0 ? `${s} ${plural(s, 'segundo', 'segundos')}` : '';
  return [min, sec].filter(Boolean).join(' ');
}

function descansoCorto(seg: number): string {
  return Math.round(seg) < 60 ? `${Math.round(seg)} s` : minSeg(seg);
}

function repsTexto(r: string | number | null | undefined): string {
  return r === null || r === undefined ? '' : limpiar(String(r));
}

function repsHabladas(reps: string): string {
  if (/^\d+$/.test(reps)) return `${reps} ${plural(Number(reps), 'repetición', 'repeticiones')}`;
  if (/^\d+\s*-\s*\d+$/.test(reps)) return `${reps.replace(/\s*-\s*/, ' a ')} repeticiones`;
  return reps;
}

/** Une frases para el audio, con su punto, y sin elipsis: no se lee. */
function hablar(partes: (string | null | undefined | false)[]): string {
  const frase = partes
    .filter((p): p is string => !!p)
    .map((p) => (/[.?!]$/.test(p) ? p : `${p}.`))
    .join(' ');
  return recortar(frase, LIMITES.hablado, '');
}

function linea(estilo: EstiloTexto, texto: string): LineaTarjeta {
  return { estilo, texto };
}

/**
 * Hace cumplir los límites a cualquier tarjeta: líneas, longitud, un botón.
 * La fachada la vuelve a pasar antes de enviar nada al nativo.
 */
export function acotarTarjeta(tarjeta: Tarjeta): Tarjeta {
  const lineas = tarjeta.lineas
    .map((l) => linea(l.estilo, recortar(l.texto, LIMITES[l.estilo])))
    .filter((l) => l.texto.length > 0)
    .slice(0, MAX_LINEAS);
  return {
    ...tarjeta,
    lineas,
    boton: tarjeta.boton ? { ...BOTON_HECHO } : null,
    hablado: recortar(tarjeta.hablado, LIMITES.hablado, ''),
  };
}

export function tarjetaSerie(d: DatosSerie): Tarjeta {
  const nombre = limpiar(d.ejercicio) || 'Ejercicio';
  const reps = repsTexto(d.repeticiones);
  const kilos = valido(d.kilos) ? d.kilos : null;

  let carga = 'Sin carga fijada';
  let cargaHablada: string | null = null;
  if (kilos !== null && reps) {
    carga = `${cifra(kilos)} kg x ${reps}`;
    cargaHablada = `${cifra(kilos)} kilos por ${repsHabladas(reps)}`;
  } else if (kilos !== null) {
    carga = `${cifra(kilos)} kg`;
    cargaHablada = `${cifra(kilos)} kilos`;
  } else if (reps) {
    carga = /^\d/.test(reps) ? `${reps} reps` : reps;
    cargaHablada = repsHabladas(reps);
  }

  const posicion = valido(d.serie)
    ? valido(d.totalSeries)
      ? `Serie ${d.serie} de ${d.totalSeries}`
      : `Serie ${d.serie}`
    : null;
  const descanso = valido(d.descansoSeg) ? d.descansoSeg : null;
  const meta = [posicion, descanso !== null ? `Descanso ${descansoCorto(descanso)}` : null]
    .filter(Boolean)
    .join(SEPARADOR);

  return acotarTarjeta({
    id: `serie:${d.serie}`,
    tipo: 'serie',
    lineas: [linea('heading', nombre), linea('body', carga), linea('meta', meta)],
    boton: BOTON_HECHO,
    hablado: hablar([
      recortar(nombre, 50, ''),
      posicion,
      cargaHablada,
      descanso !== null ? `Descansa ${minSegHablado(descanso)}` : null,
    ]),
  });
}

export function tarjetaCardio(d: DatosCardio): Tarjeta {
  const actual = valido(d.ritmoActualSegKm) ? d.ritmoActualSegKm : null;
  const objetivo = valido(d.ritmoObjetivoSegKm) ? d.ritmoObjetivoSegKm : null;
  const km = valido(d.distanciaKm) ? d.distanciaKm : null;

  let comparacion: string | null = null;
  let comparacionHablada: string | null = null;
  if (actual !== null && objetivo !== null) {
    const dif = Math.round(actual) - Math.round(objetivo);
    if (Math.abs(dif) <= TOLERANCIA_RITMO_SEG) {
      comparacion = 'En ritmo';
      comparacionHablada = 'Vas en ritmo';
    } else {
      const seg = Math.abs(dif);
      const sentido = dif > 0 ? 'lento' : 'rápido';
      comparacion = `${seg} s ${sentido}`;
      comparacionHablada = `Vas ${seg} segundos ${dif > 0 ? 'más lento' : 'más rápido'}`;
    }
  }

  const cuerpo =
    objetivo !== null
      ? [`Objetivo ${minSeg(objetivo)}`, comparacion].filter(Boolean).join(SEPARADOR)
      : 'Sin objetivo';
  const kmHablado = km !== null ? `${cifra(km, 1)} ${plural(cifra(km, 1) === '1' ? 1 : 2, 'kilómetro', 'kilómetros')}` : null;

  return acotarTarjeta({
    id: 'cardio',
    tipo: 'cardio',
    lineas: [
      linea('heading', actual !== null ? `${minSeg(actual)} /km` : 'Sin ritmo aún'),
      linea('body', cuerpo),
      linea('meta', ['Cardio', km !== null ? `${cifra(km, 1)} km` : null].filter(Boolean).join(SEPARADOR)),
    ],
    boton: null,
    hablado: hablar([
      actual !== null ? `Ritmo ${minSegHablado(actual)} por kilómetro` : 'Sin ritmo aún',
      objetivo !== null ? `Objetivo ${minSegHablado(objetivo)}` : null,
      comparacionHablada,
      kmHablado,
    ]),
  });
}

/** La siguiente pendiente, en el orden en que llegan, y cuántas quedan. */
export function tarjetaMision(pendientes: readonly MisionPendiente[]): Tarjeta {
  const mision = pendientes[0];
  if (!mision) {
    return acotarTarjeta({
      id: 'mision:ninguna',
      tipo: 'vacia',
      lineas: [linea('heading', 'Nada pendiente'), linea('meta', 'Misiones de hoy')],
      boton: null,
      hablado: 'No quedan misiones hoy.',
    });
  }
  const titulo = limpiar(mision.titulo) || 'Misión';
  const quedan = pendientes.length;
  return acotarTarjeta({
    id: `mision:${mision.id}`,
    tipo: 'mision',
    misionId: mision.id,
    lineas: [
      linea('heading', titulo),
      linea('body', quedan === 1 ? 'Es la última de hoy.' : `Quedan ${quedan} hoy.`),
      linea('meta', 'Misión del día'),
    ],
    boton: BOTON_HECHO,
    hablado: hablar([
      `Siguiente misión: ${recortar(titulo, 90, '')}`,
      quedan === 1 ? 'Es la última' : `Quedan ${quedan}`,
    ]),
  });
}

/** Para el perfil estudiante: el bloque actual y sus minutos. */
export function tarjetaEstudio(d: DatosEstudio): Tarjeta {
  const titulo = limpiar(d.titulo) || 'Estudio';
  const total = Math.max(0, Math.round(d.finMin - d.inicioMin));
  const faltan = Math.round(d.inicioMin - d.ahoraMin);
  const quedan = Math.round(d.finMin - d.ahoraMin);

  let cuerpo: string;
  let audio: string;
  if (faltan > 0) {
    cuerpo = `Empieza en ${faltan} min`;
    audio = `Empieza en ${faltan} ${plural(faltan, 'minuto', 'minutos')}`;
  } else if (quedan <= 0) {
    cuerpo = 'Bloque terminado';
    audio = 'Bloque terminado';
  } else {
    cuerpo = `Quedan ${quedan} min de ${total}`;
    audio = `${plural(quedan, 'Queda', 'Quedan')} ${quedan} ${plural(quedan, 'minuto', 'minutos')} de ${total}`;
  }

  return acotarTarjeta({
    id: `estudio:${d.inicioMin}`,
    tipo: 'estudio',
    lineas: [linea('heading', titulo), linea('body', cuerpo), linea('meta', 'Bloque de estudio')],
    boton: faltan > 0 ? null : BOTON_HECHO,
    hablado: hablar([`Estudio: ${recortar(titulo, 90, '')}`, audio]),
  });
}
