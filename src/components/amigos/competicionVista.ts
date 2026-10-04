// NIVL · Competición en Amigos: lo que la pantalla deriva de las RPC (puro,
// sin Supabase, con tests). El servidor decide el resultado; aquí solo se
// cuenta cuánto queda, quién va delante y en qué orden se pinta un tablero.

import type { Duelo, FilaTablero } from '@/lib/competicionData';

const DIA_MS = 86_400_000;

/**
 * Los ajustes de la fase 3 que el servidor añade a `my_duels` (opcionales:
 * hasta que llegue la migración son undefined). Tipo local para que compile
 * tanto antes como después de que `Duelo` los declare.
 */
export type DueloAmpliado = Duelo & {
  /** Llego al mínimo de XP programado; sin eso mi índice es solo el prior. */
  mi_suficiente?: boolean;
  su_suficiente?: boolean;
  /** La semana ya terminó en la hora local, aunque falte el resultado. */
  semana_cerrada?: boolean;
};

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

/**
 * true si el servidor dice que alguno de los dos no llega al mínimo de datos:
 * entonces el índice es solo el prior y no se puede decir quién va delante.
 * Sin los campos (servidor anterior) se mantiene el comportamiento de antes.
 */
export function faltanDatos(d: Duelo): boolean {
  const a = d as DueloAmpliado;
  return a.mi_suficiente === false || a.su_suficiente === false;
}

/** La línea de un duelo en curso: quién va delante, o que aún no se sabe. */
export function lineaDuelo(d: Duelo): string {
  if (faltanDatos(d)) return 'Aún sin datos suficientes';
  const delante = quienVaDelante(d);
  if (delante === 'yo') return 'Vas delante';
  if (delante === 'rival') return `${d.rival} va delante`;
  return 'Vais empatados';
}

/**
 * La semana del duelo ya terminó. Manda `semana_cerrada` si llega; mientras
 * no llegue, una semana sin días restantes está cerrada.
 */
export function semanaCerrada(d: Duelo, hoyKey: string): boolean {
  const a = d as DueloAmpliado;
  if (typeof a.semana_cerrada === 'boolean') return a.semana_cerrada;
  return diasRestantes(d.week_start, hoyKey) === 0;
}

export interface DuelosVista {
  /** Me han retado y falta mi respuesta. */
  porResponder: Duelo[];
  /** He retado yo y falta la suya. */
  enviados: Duelo[];
  /** Aceptados, con la semana en curso. */
  activos: Duelo[];
  /** Aceptados con la semana ya cerrada y el resultado aún sin llegar. Como mucho 3. */
  cerrados: Duelo[];
  /** Ya resueltos (semana pasada), los más recientes primero. Como mucho 3. */
  resueltos: Duelo[];
}

/**
 * Reparte `my_duels`. Fuera: rechazados, anulados (bloqueo: rival null) y
 * retos pendientes de una semana que ya pasó (ya no se pueden aceptar).
 */
export function repartirDuelos(lista: readonly Duelo[], hoyKey: string): DuelosVista {
  const out: DuelosVista = { porResponder: [], enviados: [], activos: [], cerrados: [], resueltos: [] };
  for (const d of lista) {
    if (d.rival === null || d.status === 'declined' || d.status === 'cancelled') continue;
    const quedan = diasRestantes(d.week_start, hoyKey);
    if (d.resultado) {
      out.resueltos.push(d);
    } else if (d.status === 'pending' && quedan > 0) {
      (d.soy_retador ? out.enviados : out.porResponder).push(d);
    } else if (d.status === 'accepted' || d.status === 'done') {
      // El lunes el duelo no desaparece: queda «resolviendo» hasta que el
      // servidor escriba el resultado.
      // Si el servidor dice que la semana sigue abierta, sigue en curso.
      if (semanaCerrada(d, hoyKey)) out.cerrados.push(d);
      else if (d.status === 'accepted') out.activos.push(d);
    }
  }
  const recientes = (a: Duelo, b: Duelo) => b.week_start.localeCompare(a.week_start);
  out.cerrados = out.cerrados.sort(recientes).slice(0, 3);
  out.resueltos = out.resueltos.sort(recientes).slice(0, 3);
  return out;
}

export const TEXTO_RESULTADO: Record<NonNullable<Duelo['resultado']>, string> = {
  gano: 'Ganaste',
  pierdo: 'Perdiste',
  empate: 'Empate',
  sin_datos: 'Sin datos suficientes',
};

/**
 * El detalle de un duelo resuelto. El resultado va una sola vez: a la derecha
 * si no hay revancha y aquí si la hay (el botón ocupa su sitio). Con
 * «sin datos» los índices no significan nada y van como «-».
 */
export function detalleResuelto(d: Duelo, conRevancha: boolean): string {
  const cifras = d.resultado === 'sin_datos' ? '- frente a -' : `${d.mi_indice} frente a ${d.su_indice}`;
  const res = conRevancha && d.resultado ? ` · ${TEXTO_RESULTADO[d.resultado]}` : '';
  return `Semana pasada · ${cifras}${res}`;
}

/** El ritmo con dos decimales y coma: 1,25 → «×1,25» (con uno, 1,15 y 1,10 salían iguales). */
export function textoRitmo(velocidad: number): string {
  const v = Number(velocidad);
  return `×${(Number.isFinite(v) ? v : 0).toFixed(2).replace('.', ',')}`;
}

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
