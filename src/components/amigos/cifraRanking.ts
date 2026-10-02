// NIVL · Amigos: cómo se escribe una cifra del marcador en Cinzel (puro).
//
// formatoValor (socialmath) da la frase entera para el lector («1.840 XP»,
// «3 días»); aquí se parte en cifra grande y unidad pequeña, con el punto de
// miles a mano (formatoMiles) y la cifra vacía «-».

import { CIFRA_VACIA, formatoMiles, ordinal } from '@/components/arena/cifras';
import type { Clasificado, Metrica } from '@/lib/socialmath';

const UNIDAD: Record<Metrica, string> = { xp: 'XP', cumplimiento: '%', racha: 'd' };

export function cifraDe(valor: number | null, metrica: Metrica): { cifra: string; unidad: string | null } {
  if (valor === null || !Number.isFinite(valor)) return { cifra: CIFRA_VACIA, unidad: null };
  return { cifra: formatoMiles(valor), unidad: UNIDAD[metrica] };
}

/** Sufijo pegado a la cifra del podio: « XP», « %», « d». */
export function sufijoDe(metrica: Metrica): string {
  return ` ${UNIDAD[metrica]}`;
}

/**
 * «Tu puesto: 3.º de 8» (va en mayúsculas grabadas). Sin mi fila en el
 * marcador (me he ocultado) o sin dato que medir, lo dice en vez de inventar
 * un puesto.
 */
export function lineaPuesto(filas: readonly Clasificado[]): string {
  const yo = filas.find((c) => c.competidor.isMe);
  if (!yo) return 'Estás fuera del ranking';
  if (yo.valor === null) return 'Tu puesto: sin medir';
  return `Tu puesto: ${ordinal(yo.posicion)} de ${filas.length}`;
}

/**
 * Los tres del podio en el orden en que se pintan (2.º · 1.º · 3.º), solo con
 * tres rivales o más y tres cifras medidas. Si no, null: solo la línea.
 */
export function ordenPodio<T extends Clasificado>(filas: readonly T[], rivales: number): [T, T, T] | null {
  if (rivales < 3) return null;
  const medidos = filas.filter((c) => c.valor !== null);
  if (medidos.length < 3) return null;
  return [medidos[1], medidos[0], medidos[2]];
}
