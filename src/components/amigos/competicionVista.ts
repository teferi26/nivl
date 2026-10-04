// NIVL · Competición en Amigos: lo que la pantalla deriva de las RPC (puro,
// sin Supabase, con tests). El servidor decide el resultado; aquí solo se
// cuenta cuánto queda, quién va delante y en qué orden se pinta un tablero.

import type { Duelo, FilaTablero } from '@/lib/competicionData';

const DIA_MS = 86_400_000;

/**
 * Los ajustes de la fase 3 que el servidor añade a `my_duels` (opcionales:
 * hasta que llegue la migración son undefined). Tipo local para que compile
 * tanto antes como después de que `Duelo` los declare.
 *
 * Con la 0055, lo del rival (`rival`, `su_indice`, `sus_dias`,
 * `su_suficiente`) llega null si el duelo no está aceptado o terminado, si hay
 * bloqueo o suspensión, o si el rival está oculto. Aquí ya se admite null
 * aunque `Duelo` aún diga number: todo se comprueba con `== null`.
 */
export type DueloAmpliado = Omit<Duelo, 'rival' | 'su_indice' | 'sus_dias'> & {
  rival: string | null;
  su_indice: number | null;
  sus_dias: number | null;
  /** Llego al mínimo de XP programado; sin eso mi índice es solo el prior. */
  mi_suficiente?: boolean;
  su_suficiente?: boolean | null;
  /** La semana ya terminó en la hora local, aunque falte el resultado. */
  semana_cerrada?: boolean;
};

/** El nombre que se enseña cuando el servidor no da el del rival. */
export const RIVAL_OCULTO = 'Rival oculto';

/** El nombre visible del rival: «Rival oculto» si no llega. */
export function nombreRival(d: Pick<DueloAmpliado, 'rival'>): string {
  const n = d.rival == null ? '' : String(d.rival).trim();
  return n === '' ? RIVAL_OCULTO : n;
}

/**
 * Lo que se puede pintar del rival, o null si está oculto: sin nombre, sin
 * índice o sin días no hay barra, ni cifra, ni «va delante».
 */
export function datosRival(
  d: Pick<DueloAmpliado, 'rival' | 'su_indice' | 'sus_dias'>,
): { nombre: string; indice: number; dias: number } | null {
  if (d.rival == null || d.su_indice == null || d.sus_dias == null) return null;
  return { nombre: nombreRival(d), indice: d.su_indice, dias: d.sus_dias };
}

/** true si del rival no llega nada que pintar. */
export function rivalOculto(d: Pick<DueloAmpliado, 'rival' | 'su_indice' | 'sus_dias'>): boolean {
  return datosRival(d) === null;
}

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

/** 'sin_datos': del rival no llega índice o días (oculto o duelo sin aceptar). */
export type Delante = 'yo' | 'rival' | 'empate' | 'sin_datos';

/** Mismo criterio que el servidor: índice de disciplina y, a igualdad, días activos. */
export function quienVaDelante(
  d: Pick<DueloAmpliado, 'mi_indice' | 'su_indice' | 'mis_dias' | 'sus_dias'>,
): Delante {
  if (d.mi_indice == null || d.su_indice == null || d.mis_dias == null || d.sus_dias == null) return 'sin_datos';
  if (d.mi_indice !== d.su_indice) return d.mi_indice > d.su_indice ? 'yo' : 'rival';
  if (d.mis_dias !== d.sus_dias) return d.mis_dias > d.sus_dias ? 'yo' : 'rival';
  return 'empate';
}

/**
 * true si el servidor dice que alguno de los dos no llega al mínimo de datos
 * (entonces el índice es solo el prior) o si del rival no llega nada: en los
 * dos casos no se puede decir quién va delante. Sin los campos de mínimo
 * (servidor anterior) se mantiene el comportamiento de antes.
 */
export function faltanDatos(d: DueloAmpliado): boolean {
  if (rivalOculto(d)) return true;
  return d.mi_suficiente === false || d.su_suficiente === false;
}

/** La línea de un duelo en curso: quién va delante, o que aún no se sabe. */
export function lineaDuelo(d: DueloAmpliado): string {
  if (faltanDatos(d)) return 'Aún sin datos suficientes';
  const delante = quienVaDelante(d);
  if (delante === 'yo') return 'Vas delante';
  if (delante === 'rival') return `${nombreRival(d)} va delante`;
  if (delante === 'empate') return 'Vais empatados';
  return 'Aún sin datos suficientes';
}

/**
 * La semana del duelo ya terminó. Manda `semana_cerrada` si llega; mientras
 * no llegue, una semana sin días restantes está cerrada.
 */
export function semanaCerrada(d: DueloAmpliado, hoyKey: string): boolean {
  if (typeof d.semana_cerrada === 'boolean') return d.semana_cerrada;
  return diasRestantes(d.week_start, hoyKey) === 0;
}

export interface DuelosVista<T extends DueloAmpliado = Duelo> {
  /** Me han retado y falta mi respuesta. */
  porResponder: T[];
  /** He retado yo y falta la suya. */
  enviados: T[];
  /** Aceptados, con la semana en curso. */
  activos: T[];
  /** Aceptados con la semana ya cerrada y el resultado aún sin llegar. Como mucho 3. */
  cerrados: T[];
  /** Ya resueltos (semana pasada), los más recientes primero. Como mucho 3. */
  resueltos: T[];
}

/**
 * Reparte `my_duels`. Fuera: rechazados, anulados y retos pendientes de una
 * semana que ya pasó (ya no se pueden aceptar). Con la 0055 un rival null ya
 * no es un duelo anulado (eso llega como `cancelled`), sino un rival oculto:
 * el duelo se queda y sale como «Rival oculto». Solo se descarta el reto que
 * me llega de alguien que no se identifica: no se acepta a ciegas.
 */
export function repartirDuelos<T extends DueloAmpliado>(lista: readonly T[], hoyKey: string): DuelosVista<T> {
  const out: DuelosVista<T> = { porResponder: [], enviados: [], activos: [], cerrados: [], resueltos: [] };
  for (const d of lista) {
    if (d.status === 'declined' || d.status === 'cancelled') continue;
    const quedan = diasRestantes(d.week_start, hoyKey);
    if (d.resultado) {
      out.resueltos.push(d);
    } else if (d.status === 'pending' && quedan > 0) {
      if (d.soy_retador) out.enviados.push(d);
      else if (d.rival != null) out.porResponder.push(d);
    } else if (d.status === 'accepted' || d.status === 'done') {
      // El lunes el duelo no desaparece: queda «resolviendo» hasta que el
      // servidor escriba el resultado.
      // Si el servidor dice que la semana sigue abierta, sigue en curso.
      if (semanaCerrada(d, hoyKey)) out.cerrados.push(d);
      else if (d.status === 'accepted') out.activos.push(d);
    }
  }
  const recientes = (a: T, b: T) => b.week_start.localeCompare(a.week_start);
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
export function detalleResuelto(d: DueloAmpliado, conRevancha: boolean): string {
  const rival = datosRival(d);
  const cifras =
    d.resultado === 'sin_datos' || rival === null || d.mi_indice == null
      ? '- frente a -'
      : `${d.mi_indice} frente a ${rival.indice}`;
  const res = conRevancha && d.resultado ? ` · ${TEXTO_RESULTADO[d.resultado]}` : '';
  return `Semana pasada · ${cifras}${res}`;
}

/**
 * La etiqueta accesible de un duelo en curso. Con el rival oculto no se
 * anuncia su disciplina ni quién va delante: solo la mía.
 */
export function etiquetaDuelo(d: DueloAmpliado, quedan: number): string {
  const rival = datosRival(d);
  const mia = d.mi_indice == null ? '' : ` Tu disciplina ${d.mi_indice}.`;
  if (rival === null) return `Duelo con ${nombreRival(d)}, ${textoQuedan(quedan)}.${mia} Sin datos del rival.`;
  return `Duelo con ${rival.nombre}, ${textoQuedan(quedan)}. Tu disciplina ${d.mi_indice}, la suya ${rival.indice}. ${lineaDuelo(d)}.`;
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

/** Clave de comparación de un alias: sin espacios de los bordes y cortado a 40, como el tablero. */
function claveAlias(nombre: string): string {
  return nombre.trim().slice(0, 40);
}

/**
 * Los duelos cuyo rival sigue en el marcador de amigos (friends_board). El
 * duelo no trae el id del rival, solo su alias, así que se cruza por nombre.
 * Con el rival null (bloqueo o suspensión) o fuera del marcador, el duelo no
 * se enseña: no hay a quién denunciar ni con quién medirse.
 */
export function duelosConRivalEnTablero<D extends Pick<DueloAmpliado, 'rival'>>(
  duelos: readonly D[],
  tablero: readonly { name: string }[],
): D[] {
  // Solo los duelos cuyo alias señala a UNA persona del marcador: con dos
  // homónimos no se sabe a quién denunciar o bloquear, y un duelo visible
  // sin «…» no se permite (lo mismo que decide amigoDelDuelo).
  const cuenta = new Map<string, number>();
  for (const t of tablero) cuenta.set(claveAlias(t.name), (cuenta.get(claveAlias(t.name)) ?? 0) + 1);
  return duelos.filter((d) => d.rival != null && cuenta.get(claveAlias(String(d.rival))) === 1);
}

/**
 * El amigo del duelo, para abrir su hoja de seguridad: solo si su alias señala
 * a una única persona del marcador. Con dos homónimos, null (no se adivina).
 */
export function amigoDelDuelo<A extends { userId: string; name: string }>(
  d: Pick<DueloAmpliado, 'rival'>,
  tablero: readonly A[],
): A | null {
  if (d.rival == null) return null;
  const clave = claveAlias(String(d.rival));
  const mismos = tablero.filter((t) => claveAlias(t.name) === clave);
  return mismos.length === 1 ? mismos[0]! : null;
}
