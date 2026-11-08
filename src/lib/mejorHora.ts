// NIVL · Cuándo salir: la previsión por horas, el cuerpo y la agenda.
//
// Puro y SIN IMPORTS a propósito: el mismo archivo se copia tal cual a
// `supabase/functions/_shared/mejorHora.ts` (Deno), y un test de paridad
// comprueba que no se han separado. Si tocas uno, toca el otro.
//
// La salud manda sobre el tiempo: con dolor no se mira el cielo. Y esto nunca
// es un diagnóstico; decide si conviene salir hoy, nada más.

export interface HoraClima {
  hora: string; // ISO local YYYY-MM-DDTHH:00
  temp: number | null;
  sensacion: number | null;
  lluvia_prob: number | null;
  lluvia_mm: number | null;
  viento_kmh: number | null;
  racha_kmh: number | null;
  uv: number | null;
  codigo: number | null;
  es_de_dia: boolean | null;
}

export interface ContextoSalida {
  disciplina: 'carrera' | 'bici' | 'aguas_abiertas' | 'otro';
  duracion_min: number;
  estado_forma: string;
  sueno_h: number | null;
  fatiga: number | null; // 1..5
  dolor: boolean;
  franjas_ocupadas: { desde: string; hasta: string }[]; // HH:MM
  desde: string; // HH:MM
  hasta: string;
}

export interface Ventana {
  inicio: string;
  fin: string;
  puntuacion: number;
  motivos: string[]; // claves cortas
  clima: { temp: number | null; lluvia_prob: number | null; viento_kmh: number | null };
}

export type VeredictoSalida =
  | { tipo: 'salir'; ventana: Ventana; alternativas: Ventana[] }
  | { tipo: 'suave'; ventana: Ventana; motivo: string; alternativas: Ventana[] }
  | { tipo: 'descanso'; motivo: 'dolor' | 'riesgo' | 'sueno' }
  | { tipo: 'sin_ventana'; motivo: 'clima' | 'horario' };

/** Por debajo de esta nota, mejor no salir aunque no haya peligro. */
const NOTA_MINIMA = 40;
const SUENO_POCO = 5;
const SUENO_MUY_POCO = 4;
const MAX_ALTERNATIVAS = 2;

function numero(x: number | null | undefined): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

/**
 * La nota de una hora, de 0 a 100. Una hora peligrosa vale 0 y no se recomienda
 * nunca, por buena que sea la media de las demás.
 */
export function puntuarHora(
  h: HoraClima,
  disciplina: ContextoSalida['disciplina'],
): { puntos: number; motivos: string[]; peligro: boolean } {
  const motivos: string[] = [];
  let puntos = 100;
  let peligro = false;
  const bici = disciplina === 'bici';
  const agua = disciplina === 'aguas_abiertas';

  const restar = (cuanto: number, motivo: string) => {
    puntos -= cuanto;
    motivos.push(motivo);
  };
  const avisarPeligro = (motivo: string) => {
    peligro = true;
    motivos.push(motivo);
  };

  const c = h.codigo;
  if (numero(c)) {
    if (c >= 95 && c <= 99) avisarPeligro('tormenta');
    else if (c === 56 || c === 57 || c === 66 || c === 67) {
      if (bici) avisarPeligro('hielo');
      else restar(40, 'hielo');
    } else if (c >= 71 && c <= 77) restar(bici ? 40 : 25, 'nieve');
    else if (c === 85 || c === 86) restar(bici ? 40 : 25, 'nieve');
    else if ((c === 45 || c === 48) && bici) restar(15, 'niebla');
  }

  const t = numero(h.sensacion) ? h.sensacion : h.temp;
  if (numero(t)) {
    if (t > 32) avisarPeligro('calor_extremo');
    else if (t < -5) avisarPeligro('frio_extremo');
    else if (t > 26) restar(Math.round((t - 26) * 4), 'calor');
    else {
      const frio = bici ? 5 : 2;
      if (t < frio) restar(Math.round((frio - t) * 3), 'frio');
    }
  }

  const medio = agua ? 0.5 : 1;
  if (numero(h.lluvia_prob)) {
    if (h.lluvia_prob >= 70) restar(25 * medio, 'lluvia');
    else if (h.lluvia_prob >= 40) restar(10 * medio, 'lluvia_posible');
  }
  if (numero(h.lluvia_mm) && h.lluvia_mm >= 2) restar((bici ? 30 : 20) * medio, 'lluvia_fuerte');

  const v = numero(h.viento_kmh) ? h.viento_kmh : 0;
  const r = numero(h.racha_kmh) ? h.racha_kmh : 0;
  if (bici) {
    if (v >= 50 || r >= 70) avisarPeligro('viento_peligro');
    else if (v >= 30) restar(25, 'viento');
    else if (v >= 20) restar(10, 'viento');
  } else if (agua) {
    if (v >= 30 || r >= 45) avisarPeligro('viento_peligro');
    else if (v >= 25) restar(35, 'viento');
    else if (v >= 15) restar(15, 'viento');
  } else if (v >= 60) restar(30, 'viento');
  else if (v >= 40) restar(15, 'viento');

  if (h.es_de_dia === false) restar(agua ? 70 : bici ? 35 : 20, 'noche');

  if (numero(h.uv) && h.es_de_dia !== false) {
    if (h.uv >= 8) restar(10, 'uv');
    else if (h.uv >= 6) restar(5, 'uv');
  }

  if (peligro) return { puntos: 0, motivos, peligro };
  if (motivos.length === 0) motivos.push('buen_tiempo');
  return { puntos: Math.max(0, Math.min(100, Math.round(puntos))), motivos, peligro };
}

/** Minutos desde medianoche de un "HH:MM". Se admite 24:00 como fin del día. */
function aMinutos(x: string): number | null {
  const m = /^(\d{2}):(\d{2})/.exec(x);
  if (!m) return null;
  const min = Number(m[1]) * 60 + Number(m[2]);
  return Number(m[2]) < 60 && min <= 1440 ? min : null;
}

interface HoraLeida {
  h: HoraClima;
  dia: string;
  ms: number; // las cuentas de hora van en UTC: la hora local solo se etiqueta
  minuto: number;
}

function leerHora(h: HoraClima): HoraLeida | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(h.hora);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  if (!Number.isFinite(ms)) return null;
  return { h, dia: h.hora.slice(0, 10), ms, minuto: Number(m[4]) * 60 + Number(m[5]) };
}

function aHoraLocal(ms: number): string {
  return new Date(ms).toISOString().slice(0, 16);
}

/** Los tramos ocupados en minutos. Uno que cruza medianoche se parte en dos. */
function tramosOcupados(franjas: { desde: string; hasta: string }[]): [number, number][] {
  const tramos: [number, number][] = [];
  for (const f of franjas) {
    const desde = aMinutos(f.desde);
    const hasta = aMinutos(f.hasta);
    if (desde === null || hasta === null) continue;
    if (desde < hasta) tramos.push([desde, hasta]);
    else if (desde > hasta) tramos.push([desde, 1440], [0, hasta]);
  }
  return tramos;
}

function maximo(valores: (number | null)[]): number | null {
  const v = valores.filter(numero);
  return v.length > 0 ? Math.max(...v) : null;
}

function media(valores: (number | null)[]): number | null {
  const v = valores.filter(numero);
  return v.length > 0 ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
}

function candidatas(horas: HoraClima[], c: ContextoSalida): { ventanas: Ventana[]; encajan: number } {
  const leidas = horas
    .map(leerHora)
    .filter((x): x is HoraLeida => x !== null)
    .sort((a, b) => a.ms - b.ms);
  const desde = aMinutos(c.desde);
  const hasta = aMinutos(c.hasta);
  const primera = leidas[0];
  if (!primera || desde === null || hasta === null) return { ventanas: [], encajan: 0 };

  // Las franjas son horas sueltas sin fecha: valen para el primer día recibido.
  const delDia = leidas.filter((x) => x.dia === primera.dia);
  const duracion = Number.isFinite(c.duracion_min) && c.duracion_min > 0 ? c.duracion_min : 60;
  const huecos = Math.ceil(duracion / 60);
  const ocupados = tramosOcupados(c.franjas_ocupadas);

  const ventanas: Ventana[] = [];
  let encajan = 0;
  for (let i = 0; i + huecos <= delDia.length; i++) {
    const inicio = delDia[i]!;
    const fin = inicio.minuto + duracion;
    if (inicio.minuto < desde || fin > hasta) continue;
    if (ocupados.some(([a, b]) => inicio.minuto < b && a < fin)) continue;
    const tramo = delDia.slice(i, i + huecos);
    // Un hueco en la previsión no se rellena con suposiciones.
    if (tramo.some((x, j) => x.ms !== inicio.ms + j * 3600000)) continue;
    encajan++;

    const notas = tramo.map((x) => puntuarHora(x.h, c.disciplina));
    if (notas.some((n) => n.peligro)) continue;
    const promedio = notas.reduce((a, n) => a + n.puntos, 0) / notas.length;
    const peor = Math.min(...notas.map((n) => n.puntos));
    const puntuacion = Math.round((promedio + peor) / 2); // La peor hora pesa: se corre entera.
    if (puntuacion < NOTA_MINIMA) continue;

    const motivos: string[] = [];
    for (const n of notas) {
      for (const m of n.motivos) if (!motivos.includes(m)) motivos.push(m);
    }
    ventanas.push({
      inicio: inicio.h.hora,
      fin: aHoraLocal(inicio.ms + duracion * 60000),
      puntuacion,
      motivos: motivos.length > 1 ? motivos.filter((m) => m !== 'buen_tiempo') : motivos,
      clima: {
        temp: media(tramo.map((x) => x.h.temp)),
        lluvia_prob: maximo(tramo.map((x) => x.h.lluvia_prob)),
        viento_kmh: maximo(tramo.map((x) => x.h.viento_kmh)),
      },
    });
  }
  return { ventanas, encajan };
}

function solapan(a: Ventana, b: Ventana): boolean {
  return a.inicio < b.fin && b.inicio < a.fin;
}

/**
 * El veredicto del día. Mira solo el primer día de `horas`: si quien llama
 * quiere otro día, le pasa ese. Para no recomendar el pasado, `desde` tiene que
 * ser como pronto la hora actual.
 */
export function mejorVentana(horas: HoraClima[], c: ContextoSalida): VeredictoSalida {
  if (c.dolor) return { tipo: 'descanso', motivo: 'dolor' };

  // Sin dato de sueño no se penaliza: no medirlo no es dormir mal.
  const riesgo = c.estado_forma === 'riesgo';
  const pocoSueno = numero(c.sueno_h) && c.sueno_h < SUENO_POCO;
  const muyPocoSueno = numero(c.sueno_h) && c.sueno_h < SUENO_MUY_POCO;
  const fatigaAlta = numero(c.fatiga) && c.fatiga >= 4;
  const agotado = numero(c.fatiga) && c.fatiga >= 5;

  if (riesgo && (pocoSueno || agotado)) return { tipo: 'descanso', motivo: 'riesgo' };
  if (muyPocoSueno) return { tipo: 'descanso', motivo: 'sueno' };

  const { ventanas, encajan } = candidatas(horas, c);
  if (encajan === 0) return { tipo: 'sin_ventana', motivo: 'horario' };
  if (ventanas.length === 0) return { tipo: 'sin_ventana', motivo: 'clima' };

  const orden = ventanas.slice().sort((a, b) => b.puntuacion - a.puntuacion || (a.inicio < b.inicio ? -1 : 1));
  const ventana = orden[0]!;
  const alternativas: Ventana[] = [];
  for (const v of orden.slice(1)) {
    if (alternativas.length >= MAX_ALTERNATIVAS) break;
    if (!solapan(v, ventana) && !alternativas.some((a) => solapan(a, v))) alternativas.push(v);
  }

  const motivoSuave = riesgo ? 'forma_riesgo' : pocoSueno ? 'poco_sueno' : fatigaAlta ? 'fatiga' : null;
  return motivoSuave !== null
    ? { tipo: 'suave', ventana, motivo: motivoSuave, alternativas }
    : { tipo: 'salir', ventana, alternativas };
}

// ── Lo que comparten el hub y el coach al decidir cuándo salir ───────

const VENTANA_DOLOR = 3;

function restarDias(fecha: string, dias: number): string {
  return new Date(Date.parse(`${fecha}T00:00:00Z`) - dias * 86400000).toISOString().slice(0, 10);
}

/**
 * Los partes de los tres últimos días, del más reciente al más antiguo.
 */
export function partesRecientes<T extends { fecha: string }>(partes: readonly T[], hoy: string): T[] {
  const desde = restarDias(hoy, VENTANA_DOLOR - 1);
  return partes.filter((b) => b.fecha >= desde && b.fecha <= hoy).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** ¿Sigue vigente el dolor? Manda el parte más reciente: «hoy sin dolor» levanta el de ayer. */
export function dolorVigente<T extends { fecha: string; dolor: boolean }>(partes: readonly T[], hoy: string): T | null {
  const ultimo = partesRecientes(partes, hoy)[0];
  return ultimo?.dolor ? ultimo : null;
}

const HHMM_VALIDA = /^([01]\d|2[0-3]):([0-5]\d)$/;

function hhmmDe(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

/** La siguiente hora en punto. Las ventanas de `mejorVentana` son horas enteras. */
export function horaEnPuntoSiguiente(hhmm: string): string {
  const h = Number(hhmm.slice(0, 2));
  if (hhmm.slice(3, 5) === '00') return `${String(h).padStart(2, '0')}:00`;
  return h >= 23 ? '24:00' : `${String(h + 1).padStart(2, '0')}:00`;
}

/** Desde cuándo y hasta cuándo se puede salir: despierto, y hoy nunca en el pasado. */
export function tramoDelDia(a: { esHoy: boolean; ahora: string; despertar: unknown; dormir: unknown }): { desde: string; hasta: string } {
  const corta = (v: unknown, def: string) => {
    const s = String(v ?? '').slice(0, 5);
    return HHMM_VALIDA.test(s) ? s : def;
  };
  const despertar = corta(a.despertar, '07:00');
  const dormir = corta(a.dormir, '22:00');
  const siguiente = horaEnPuntoSiguiente(a.ahora);
  return {
    desde: a.esHoy && siguiente > despertar ? siguiente : despertar,
    // Quien se acuesta pasada la medianoche puede salir hasta el final del día.
    hasta: dormir <= despertar ? '24:00' : dormir,
  };
}

// Tipos de bloque que dejan libre el hueco. `aerobico` es justo el entreno.
const BLOQUES_LIBRES = new Set(['libre', 'aerobico', 'descanso']);

/** Lo ocupado del día: los bloques del plan y las citas del calendario. */
export function franjasOcupadas(
  bloques: readonly { start_min: number; end_min: number; kind: string }[],
  eventos: readonly { time: string | null }[],
): { desde: string; hasta: string }[] {
  const franjas = bloques
    .filter((b) => !BLOQUES_LIBRES.has(b.kind))
    .map((b) => ({ desde: hhmmDe(b.start_min), hasta: hhmmDe(b.end_min) }));
  for (const e of eventos) {
    const s = String(e.time ?? '').slice(0, 5);
    if (!HHMM_VALIDA.test(s)) continue;
    // Una cita sin duración cuenta una hora.
    const fin = Math.min(1440, Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5)) + 60);
    franjas.push({ desde: s, hasta: hhmmDe(fin) });
  }
  return franjas;
}
