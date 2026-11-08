// NIVL · FOCUS: meter un horario de 30 clases sin 180 toques (puro, con tests).

import { clasesDelDia, solapes, type ClaseHorario } from './horario';

const MIN_DIA = 24 * 60;

/** Lee una hora a mano: «8», «08», «8:30», «8.30», «8h», «830», «1430». null si no lo es. */
export function leerHora(s: string): number | null {
  const t = s.trim().toLowerCase();
  let h: number;
  let m = 0;
  const conMinutos = /^(\d{1,2})[:.,h](\d{2})$/.exec(t);
  const seguida = /^(\d{1,2})(\d{2})$/.exec(t);
  const solaHora = /^(\d{1,2})h?$/.exec(t);
  if (conMinutos) {
    h = Number(conMinutos[1]);
    m = Number(conMinutos[2]);
  } else if (solaHora) {
    h = Number(solaHora[1]);
  } else if (seguida) {
    h = Number(seguida[1]);
    m = Number(seguida[2]);
  } else {
    return null;
  }
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** Tras guardar una clase, la siguiente empieza donde acabó y dura lo mismo. */
export function siguienteHueco(inicio: number, fin: number): { inicio: number; fin: number } | null {
  if (fin >= MIN_DIA - 1) return null;
  return { inicio: fin, fin: Math.min(MIN_DIA - 1, fin + Math.max(1, fin - inicio)) };
}

/** Por dónde sigue un día que ya tiene clases (null si está vacío). */
export function huecoDelDia(horario: readonly ClaseHorario[], dia: number): { inicio: number; fin: number } | null {
  const del = clasesDelDia(horario, dia);
  const u = del[del.length - 1];
  return u ? siguienteHueco(u.inicio, u.fin) : null;
}

export interface CopiaDia<T> {
  nuevas: Omit<T, 'id'>[];
  /** Las que no se copian porque se pisan con lo que ya hay en el destino. */
  saltadas: number;
}

/** Las clases de `origen` en cada día de `destinos`, sin pisar lo que ya hay. */
export function copiarDia<T extends ClaseHorario>(horario: readonly T[], origen: number, destinos: readonly number[]): CopiaDia<T> {
  const fuente = clasesDelDia(horario, origen);
  const nuevas: Omit<T, 'id'>[] = [];
  const puestas: ClaseHorario[] = [];
  let saltadas = 0;
  for (const dia of [...new Set(destinos)].filter((d) => d !== origen)) {
    for (const c of fuente) {
      const pieza = { dia, inicio: c.inicio, fin: c.fin };
      if (solapes(horario, pieza).length > 0 || solapes(puestas, pieza).length > 0) {
        saltadas++;
        continue;
      }
      const { id: _id, ...resto } = c;
      nuevas.push({ ...resto, dia } as Omit<T, 'id'>);
      puestas.push({ id: '', asignaturaId: c.asignaturaId, ...pieza });
    }
  }
  return { nuevas, saltadas };
}
