// NIVL · WORK: la carga de trabajo (puro, con tests).
// ESPEJO en supabase/functions/_shared/trabajo.ts: si tocas uno, toca el otro.
//
// Números y umbrales fijos: ni diagnostica, ni penaliza, ni juzga. Solo mide lo
// que hay en la agenda y en los bloques y dice qué soltar. La carga no mueve
// XP en ninguna dirección.
//
// Los eventos de calendario pueden ser personales, y no llevan tipo: por eso
// las reuniones solo se cuentan de lunes a viernes, y «tarde», «fin de
// semana» y «días seguidos» salen solo de sesiones de trabajo registradas.

import { esFinDeSemana, sumarDias } from './fechas';
import { DURACION_EVENTO_DEFECTO, HORA_TARDE_MIN, type EventoTrabajo, type SesionTrabajo } from './tipos';

export type NivelCarga = 'ligera' | 'normal' | 'alta';

export type CodigoSenal = 'reuniones_hoy' | 'reuniones_semana' | 'horas_semana' | 'tardes' | 'fin_de_semana' | 'dias_seguidos';

export interface SenalCarga {
  codigo: CodigoSenal;
  valor: number;
}

export const UMBRAL = {
  reunionesHoyMin: [180, 300],
  reunionesSemanaMin: [720, 1080],
  horasSemanaMin: [2700, 3300],
  diasTarde: [3, 5],
  diasSeguidos: [7, 10],
} as const;

/** Con estos puntos o más, la carga es alta. */
export const PUNTOS_ALTA = 3;

export interface EntradaCarga {
  fecha: string;
  eventos: readonly EventoTrabajo[];
  sesiones: readonly SesionTrabajo[];
  horaTardeMin?: number;
}

export interface Carga {
  nivel: NivelCarga;
  puntos: number;
  reunionesHoyMin: number;
  reunionesSemanaMin: number;
  profundoHoyMin: number;
  profundoSemanaMin: number;
  trabajoSemanaMin: number;
  diasTarde: number;
  diasFinDeSemana: number;
  diasSeguidos: number;
  /** De la que más pesa a la que menos. */
  senales: SenalCarga[];
  /** Qué soltar primero; null si no hace falta soltar nada. */
  soltar: CodigoSenal | null;
}

/** El final de un evento con hora: sin fin, la duración por defecto; si no cuadra (cruza medianoche), hasta las 24:00. */
export function finEvento(e: Pick<EventoTrabajo, 'inicio' | 'fin'>): number | null {
  if (e.inicio === null) return null;
  if (e.fin === null) return Math.min(1440, e.inicio + DURACION_EVENTO_DEFECTO);
  return e.fin > e.inicio ? e.fin : 1440;
}

/** Minutos ocupados por los eventos con hora, sin contar dos veces los solapes. */
export function minutosOcupados(eventos: readonly Pick<EventoTrabajo, 'inicio' | 'fin'>[]): number {
  const tramos = eventos
    .map((e) => [e.inicio, finEvento(e)] as const)
    .filter((t): t is readonly [number, number] => t[0] !== null && t[1] !== null)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let hasta = -1;
  for (const [a, b] of tramos) {
    if (a >= hasta) {
      total += b - a;
      hasta = b;
    } else if (b > hasta) {
      total += b - hasta;
      hasta = b;
    }
  }
  return total;
}

const nivelDe = (v: number, [uno, dos]: readonly [number, number]) => (v >= dos ? 2 : v >= uno ? 1 : 0);

export function calcularCarga(e: EntradaCarga): Carga {
  const desde = sumarDias(e.fecha, -6);
  const tarde = e.horaTardeMin ?? HORA_TARDE_MIN;
  const sesiones = e.sesiones.filter((s) => s.fecha >= desde && s.fecha <= e.fecha && s.minutos > 0);

  const laborables = e.eventos.filter((x) => x.fecha >= desde && x.fecha <= e.fecha && !esFinDeSemana(x.fecha));
  const fechas = [...new Set(laborables.map((x) => x.fecha))];
  const reunionesSemanaMin = fechas.reduce((a, f) => a + minutosOcupados(laborables.filter((x) => x.fecha === f)), 0);
  const reunionesHoyMin = esFinDeSemana(e.fecha) ? 0 : minutosOcupados(laborables.filter((x) => x.fecha === e.fecha));

  const trabajoSemanaMin = sesiones.reduce((a, s) => a + s.minutos, 0);
  const profundo = sesiones.filter((s) => s.tipo === 'bloque');
  const profundoSemanaMin = profundo.reduce((a, s) => a + s.minutos, 0);
  const profundoHoyMin = profundo.filter((s) => s.fecha === e.fecha).reduce((a, s) => a + s.minutos, 0);

  const diasTarde = new Set(sesiones.filter((s) => s.inicioMin !== null && s.inicioMin + s.minutos > tarde).map((s) => s.fecha)).size;
  const conTrabajo = new Set(sesiones.map((s) => s.fecha));
  const diasFinDeSemana = [...conTrabajo].filter(esFinDeSemana).length;

  // Hacia atrás desde hoy (o desde ayer si hoy aún no hay nada): hoy sin
  // trabajar todavía no rompe la serie, no es descanso.
  const todas = new Set(e.sesiones.filter((s) => s.minutos > 0).map((s) => s.fecha));
  let f = todas.has(e.fecha) ? e.fecha : sumarDias(e.fecha, -1);
  let diasSeguidos = 0;
  while (todas.has(f) && diasSeguidos < 60) {
    diasSeguidos++;
    f = sumarDias(f, -1);
  }

  const lecturas: { codigo: CodigoSenal; valor: number; puntos: number }[] = [
    { codigo: 'reuniones_hoy', valor: reunionesHoyMin, puntos: nivelDe(reunionesHoyMin, UMBRAL.reunionesHoyMin) },
    { codigo: 'dias_seguidos', valor: diasSeguidos, puntos: nivelDe(diasSeguidos, UMBRAL.diasSeguidos) },
    { codigo: 'tardes', valor: diasTarde, puntos: nivelDe(diasTarde, UMBRAL.diasTarde) },
    { codigo: 'horas_semana', valor: trabajoSemanaMin, puntos: nivelDe(trabajoSemanaMin, UMBRAL.horasSemanaMin) },
    { codigo: 'reuniones_semana', valor: reunionesSemanaMin, puntos: nivelDe(reunionesSemanaMin, UMBRAL.reunionesSemanaMin) },
    { codigo: 'fin_de_semana', valor: diasFinDeSemana, puntos: diasFinDeSemana > 0 ? 1 : 0 },
  ];
  const activas = lecturas.filter((l) => l.puntos > 0).sort((a, b) => b.puntos - a.puntos);
  const puntos = activas.reduce((a, l) => a + l.puntos, 0);
  const nivel: NivelCarga = puntos >= PUNTOS_ALTA ? 'alta' : puntos > 0 ? 'normal' : 'ligera';

  return {
    nivel,
    puntos,
    reunionesHoyMin,
    reunionesSemanaMin,
    profundoHoyMin,
    profundoSemanaMin,
    trabajoSemanaMin,
    diasTarde,
    diasFinDeSemana,
    diasSeguidos,
    senales: activas.map(({ codigo, valor }) => ({ codigo, valor })),
    soltar: nivel === 'alta' ? (activas[0]?.codigo ?? null) : null,
  };
}
