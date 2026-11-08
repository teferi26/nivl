// NIVL · La carga de entrenamiento: cuánto pesa cada sesión y cómo está la forma.
//
// Puro y SIN IMPORTS a propósito: el mismo archivo se copia tal cual a
// `supabase/functions/_shared/cargamath.ts` (Deno), y un test de paridad
// comprueba que no se han separado. Si tocas uno, toca el otro.
//
// Toda la aritmética de fechas va con números de día en UTC: un cambio de hora
// no puede comerse ni repetir un día.

export interface SesionCarga {
  fecha: string; // YYYY-MM-DD
  deporte: string;
  duracion_s: number;
  fc_media: number | null;
  rpe: number | null;
}

export interface PerfilCarga {
  fc_max: number | null;
  fc_reposo: number | null;
  umbral: number | null;
}

export interface DiaCarga {
  fecha: string;
  carga: number;
  ctl: number;
  atl: number;
  tsb: number;
}

export type EstadoForma = 'sin_datos' | 'fresco' | 'optimo' | 'productivo' | 'cargado' | 'riesgo';

const MS_DIA = 86400000;
/** Días de la constante de la forma (CTL) y de la fatiga (ATL). */
const DIAS_CTL = 42;
const DIAS_ATL = 7;

function aDia(fecha: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) return null;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const ms = Date.UTC(anio, mes - 1, dia);
  const f = new Date(ms);
  if (f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== dia) return null;
  return Math.round(ms / MS_DIA);
}

function aFecha(dia: number): string {
  return new Date(dia * MS_DIA).toISOString().slice(0, 10);
}

/** El lunes de la semana de ese número de día (el día 0 fue jueves). */
function lunesDe(dia: number): number {
  return dia - (((dia + 3) % 7) + 7) % 7;
}

function positivo(x: number | null | undefined): x is number {
  return typeof x === 'number' && Number.isFinite(x) && x > 0;
}

function unDecimal(x: number): number {
  const r = Math.round(x * 10) / 10;
  return r === 0 ? 0 : r;
}

/** El peso de Banister: crece exponencial con la reserva de pulso usada. */
function pesoTrimp(reserva: number): number {
  return reserva * Math.exp(1.92 * reserva);
}

/** hrTSS aproximado, o null si el pulso o el perfil no permiten calcularlo. */
function cargaPorPulso(horas: number, fc: number | null, p: PerfilCarga): number | null {
  if (!positivo(fc)) return null;
  const hayReserva = positivo(p.fc_max) && positivo(p.fc_reposo) && p.fc_max > p.fc_reposo;
  let umbral: number | null = positivo(p.umbral) ? p.umbral : null;
  if (umbral === null && hayReserva) {
    umbral = p.fc_reposo! + 0.85 * (p.fc_max! - p.fc_reposo!);
  } else if (umbral === null && positivo(p.fc_max)) {
    umbral = 0.89 * p.fc_max;
  }
  if (umbral === null) return null;

  if (hayReserva && umbral > p.fc_reposo!) {
    // Con reserva de pulso: una hora justo en el umbral vale 100.
    const rango = p.fc_max! - p.fc_reposo!;
    const reserva = Math.min(1, (fc - p.fc_reposo!) / rango);
    if (reserva <= 0) return null; // Por debajo del reposo: sensor equivocado.
    return (horas * pesoTrimp(reserva) * 100) / pesoTrimp((umbral - p.fc_reposo!) / rango);
  }
  const intensidad = fc / umbral;
  return horas * intensidad * intensidad * 100;
}

/**
 * La carga de una sesión. Con pulso y perfil, hrTSS aproximado; si no, el RPE
 * (una hora a RPE 7 son 70); si tampoco, 50 por hora.
 */
export function cargaSesion(s: SesionCarga, p: PerfilCarga): number {
  if (!positivo(s.duracion_s)) return 0;
  const horas = s.duracion_s / 3600;
  const porPulso = cargaPorPulso(horas, s.fc_media, p);
  if (porPulso !== null) return Math.max(0, Math.round(porPulso));
  if (positivo(s.rpe)) return Math.round(horas * Math.min(10, s.rpe) * 10);
  return Math.round(horas * 50);
}

/**
 * La curva día a día hasta `hasta`, los últimos `dias`. Lo anterior a la
 * ventana también cuenta: calienta la media para que el primer día visible no
 * arranque de cero. Varias sesiones del mismo día se suman.
 */
export function serieCarga(cargas: { fecha: string; carga: number }[], hasta: string, dias: number = 120): DiaCarga[] {
  const fin = aDia(hasta);
  const ventana = Math.floor(dias);
  if (fin === null || !(ventana > 0)) return [];

  const visibleDesde = fin - ventana + 1;
  let primero = visibleDesde;
  const porDia = new Map<number, number>();
  for (const c of cargas) {
    const d = aDia(c.fecha);
    if (d === null || d > fin || !positivo(c.carga)) continue;
    porDia.set(d, (porDia.get(d) ?? 0) + c.carga);
    if (d < primero) primero = d;
  }

  const serie: DiaCarga[] = [];
  let ctl = 0;
  let atl = 0;
  for (let d = primero; d <= fin; d++) {
    const carga = porDia.get(d) ?? 0;
    const tsb = ctl - atl; // La forma de hoy es la de ayer: aún sin el entreno de hoy.
    ctl += (carga - ctl) / DIAS_CTL;
    atl += (carga - atl) / DIAS_ATL;
    if (d >= visibleDesde) {
      serie.push({ fecha: aFecha(d), carga: unDecimal(carga), ctl: unDecimal(ctl), atl: unDecimal(atl), tsb: unDecimal(tsb) });
    }
  }
  return serie;
}

/** ACWR: fatiga entre forma de hoy. Con forma inferior a 5 no significa nada. */
export function ratioAgudoCronico(serie: DiaCarga[]): number | null {
  const hoy = serie[serie.length - 1];
  if (!hoy || hoy.ctl < 5) return null;
  return Math.round((hoy.atl / hoy.ctl) * 100) / 100;
}

/** Cuánto ha subido la forma en siete días. */
export function rampaSemanal(serie: DiaCarga[]): number | null {
  if (serie.length < 8) return null;
  return unDecimal(serie[serie.length - 1]!.ctl - serie[serie.length - 8]!.ctl);
}

/**
 * Los umbrales son orientativos: sirven para ordenar la decisión del día, no
 * son un diagnóstico. Riesgo si ACWR > 1,5, TSB < -30 o rampa > 8; cargado si
 * TSB < -10; productivo de -10 a 5 con la forma subiendo; óptimo de 5 a 25;
 * fresco por encima de 25. De -10 a 5 sin forma subiendo no se está
 * construyendo pero tampoco hay deuda: cuenta como óptimo.
 */
export function estadoForma(serie: DiaCarga[]): {
  estado: EstadoForma;
  ctl: number;
  atl: number;
  tsb: number;
  acwr: number | null;
  rampa: number | null;
} {
  const hoy = serie[serie.length - 1];
  if (!hoy || !serie.some((d) => d.carga > 0)) {
    return { estado: 'sin_datos', ctl: 0, atl: 0, tsb: 0, acwr: null, rampa: null };
  }
  const acwr = ratioAgudoCronico(serie);
  const rampa = rampaSemanal(serie);
  const { ctl, atl, tsb } = hoy;

  let estado: EstadoForma;
  if ((acwr !== null && acwr > 1.5) || tsb < -30 || (rampa !== null && rampa > 8)) estado = 'riesgo';
  else if (tsb < -10) estado = 'cargado';
  else if (tsb > 25) estado = 'fresco';
  else if (tsb >= 5) estado = 'optimo';
  else if (rampa !== null && rampa > 0) estado = 'productivo';
  else estado = 'optimo';
  return { estado, ctl, atl, tsb, acwr, rampa };
}

/**
 * El volumen por semanas de lunes a domingo, de la más antigua a la actual.
 * Las semanas sin sesiones también salen: un hueco en la gráfica es información.
 */
export function volumenSemanal(
  sesiones: { fecha: string; deporte: string; duracion_s: number; distancia_m: number | null }[],
  hasta: string,
  semanas: number = 8,
): { semana: string; porDeporte: Record<string, { duracion_s: number; distancia_m: number }>; total_s: number }[] {
  const fin = aDia(hasta);
  const cuantas = Math.floor(semanas);
  if (fin === null || !(cuantas > 0)) return [];

  const lunesFinal = lunesDe(fin);
  const salida: {
    semana: string;
    porDeporte: Record<string, { duracion_s: number; distancia_m: number }>;
    total_s: number;
  }[] = [];
  for (let i = cuantas - 1; i >= 0; i--) {
    salida.push({ semana: aFecha(lunesFinal - i * 7), porDeporte: {}, total_s: 0 });
  }

  for (const s of sesiones) {
    const d = aDia(s.fecha);
    if (d === null || d > fin || !positivo(s.duracion_s)) continue;
    const indice = cuantas - 1 - (lunesFinal - lunesDe(d)) / 7;
    const semana = salida[indice];
    if (!semana) continue;
    const previo = semana.porDeporte[s.deporte] ?? { duracion_s: 0, distancia_m: 0 };
    semana.porDeporte[s.deporte] = {
      duracion_s: previo.duracion_s + s.duracion_s,
      distancia_m: previo.distancia_m + (positivo(s.distancia_m) ? s.distancia_m : 0),
    };
    semana.total_s += s.duracion_s;
  }
  return salida;
}
