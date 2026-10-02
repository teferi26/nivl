// NIVL · Competición en Amigos: lo que la pantalla deriva de las RPC (puro,
// sin Supabase, con tests). El servidor decide el resultado; aquí solo se
// cuenta cuánto queda, quién va delante y en qué orden se pinta un tablero.

import type { Duelo, FilaTablero } from '@/lib/competicionData';

const DIA_MS = 86_400_000;

function diaUtc(key: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(key);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/**
 * Días que le quedan al duelo, HOY INCLUIDO: la semana va de lunes
 * (`week_start`) a domingo. 0 = la semana ya pasó.
 */
export function diasRestantes(weekStart: string, hoyKey: string): number {
  const a = diaUtc(weekStart);
  const h = diaUtc(hoyKey);
  if (a === null || h === null) return 0;
  const pasados = Math.round((h - a) / DIA_MS);
  if (pasados < 0) return 7;
  return Math.max(0, 7 - pasados);
}

export type Delante = 'yo' | 'rival' | 'empate';

/** Mismo criterio que el servidor: índice de disciplina y, a igualdad, días activos. */
export function quienVaDelante(d: Pick<Duelo, 'mi_indice' | 'su_indice' | 'mis_dias' | 'sus_dias'>): Delante {
  if (d.mi_indice !== d.su_indice) return d.mi_indice > d.su_indice ? 'yo' : 'rival';
  if (d.mis_dias !== d.sus_dias) return d.mis_dias > d.sus_dias ? 'yo' : 'rival';
  return 'empate';
}

export interface DuelosVista {
  /** Me han retado y falta mi respuesta. */
  porResponder: Duelo[];
  /** He retado yo y falta la suya. */
  enviados: Duelo[];
  /** Aceptados, con la semana en curso. */
  activos: Duelo[];
  /** Ya resueltos (semana pasada), los más recientes primero. Como mucho 3. */
  resueltos: Duelo[];
}

/**
 * Reparte `my_duels`. Fuera: rechazados, anulados (bloqueo: rival null) y
 * retos pendientes de una semana que ya pasó (ya no se pueden aceptar).
 */
export function repartirDuelos(lista: readonly Duelo[], hoyKey: string): DuelosVista {
  const out: DuelosVista = { porResponder: [], enviados: [], activos: [], resueltos: [] };
  for (const d of lista) {
    if (d.rival === null || d.status === 'declined' || d.status === 'cancelled') continue;
    const quedan = diasRestantes(d.week_start, hoyKey);
    if (d.resultado) {
      out.resueltos.push(d);
    } else if (d.status === 'pending' && quedan > 0) {
      (d.soy_retador ? out.enviados : out.porResponder).push(d);
    } else if (d.status === 'accepted' && quedan > 0) {
      out.activos.push(d);
    }
  }
  out.resueltos = out.resueltos.sort((a, b) => b.week_start.localeCompare(a.week_start)).slice(0, 3);
  return out;
}

export const TEXTO_RESULTADO: Record<NonNullable<Duelo['resultado']>, string> = {
  gano: 'Ganaste',
  pierdo: 'Perdiste',
  empate: 'Empate',
  sin_datos: 'Sin datos suficientes',
};

export type FilaOrdenada = FilaTablero & { puesto: number };

/**
 * El tablero de una liga en el orden de competition.tablaLiga: índice, luego
 * velocidad, luego días activos; los empates comparten puesto y quien no llega
 * al mínimo va al final sin puesto (0), sin humillarle con un «último».
 */
export function ordenarTablero(filas: readonly FilaTablero[]): FilaOrdenada[] {
  const con = filas
    .filter((f) => !f.sin_datos)
    .sort(
      (x, y) =>
        y.indice - x.indice || y.velocidad - x.velocidad || y.dias_activos - x.dias_activos || x.alias.localeCompare(y.alias),
    );
  const sin = filas.filter((f) => f.sin_datos).sort((x, y) => x.alias.localeCompare(y.alias));
  const out: FilaOrdenada[] = [];
  con.forEach((f, i) => {
    const prev = out[i - 1];
    const empata =
      prev && prev.indice === f.indice && prev.velocidad === f.velocidad && prev.dias_activos === f.dias_activos;
    out.push({ ...f, puesto: empata ? prev.puesto : i + 1 });
  });
  for (const f of sin) out.push({ ...f, puesto: 0 });
  return out;
}

/** «quedan 3 días» / «último día». */
export function textoQuedan(dias: number): string {
  if (dias <= 1) return 'último día';
  return `quedan ${dias} días`;
}
