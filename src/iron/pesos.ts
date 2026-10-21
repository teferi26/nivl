// NIVL · IRON · «Tus pesos y récords» del mundo IRON (puro, sin Supabase ni
// i18n; test en __tests__/pesos.test.ts). Los datos son los mismos que lee la
// ficha de técnica (historialDatos.ts → `gym_lifts`), y el casado con el
// catálogo es el mismo `idDe` de «Ver técnica». Un nombre que no casa no se
// pierde: cuenta aparte por su nombre normalizado.
//
// Por ejercicio:
//   · lo último: la carga más alta de la sesión más reciente;
//   · la mejor marca: el mayor 1RM estimado (Epley, mejorMarca de historial.ts);
//   · récord: la mejor marca es de la última sesión y no era la primera;
//   · la subida: lo último menos la carga más alta de la sesión más antigua
//     dentro de las últimas `semanas` (null si solo hay una sesión en ella).
// Sin carga (peso corporal) no sale: aquí se habla de kilos.

import { mejorMarca, type FilaSerie, type MejorMarca, type SesionEjercicio } from './historial';
import { normalizarNombre } from './casar';

export interface PesoEjercicio {
  /** El id del catálogo o «libre:<nombre normalizado>». */
  readonly clave: string;
  /** El id del catálogo si casa (para el nombre traducido y la técnica). */
  readonly idCatalogo: string | null;
  /** El nombre tal cual se escribió en la sesión más reciente. */
  readonly nombre: string;
  readonly ultimoKg: number;
  readonly ultimaFecha: string;
  readonly mejor: MejorMarca | null;
  readonly record: boolean;
  /** Kilos ganados (o perdidos) en la ventana; null sin dos sesiones en ella. */
  readonly subida: number | null;
  readonly sesiones: number;
  /**
   * La carga más alta de cada una de las últimas sesiones, de la más antigua a
   * la más reciente (hasta `PUNTOS_SERIE`): la línea de la gráfica de pesos.
   */
  readonly serie: readonly number[];
}

/** Sesiones que entran en la gráfica de un ejercicio (la lámina pinta 8 puntos). */
export const PUNTOS_SERIE = 8;

/** Semanas de la ventana de la subida (la lámina 2 de la P01: «en 6 semanas»). */
export const SEMANAS_SUBIDA = 6;

function restarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

const redondear = (n: number) => Math.round(n * 100) / 100;

export function resumenPesos(
  filas: readonly FilaSerie[],
  idDe: (nombre: string) => string | null,
  hoy: string,
  semanas = SEMANAS_SUBIDA,
): PesoEjercicio[] {
  const cache = new Map<string, string | null>();
  const id = (n: string) => {
    if (!cache.has(n)) cache.set(n, idDe(n));
    return cache.get(n) ?? null;
  };

  // clave → fecha → series (y el último nombre escrito).
  const grupos = new Map<string, { idCatalogo: string | null; nombre: string; fechaNombre: string; porFecha: Map<string, FilaSerie[]> }>();
  for (const f of filas) {
    if (!(f.reps > 0) || !(f.kg >= 0)) continue;
    const idCatalogo = id(f.nombre);
    const norm = normalizarNombre(f.nombre);
    if (!idCatalogo && !norm) continue;
    const clave = idCatalogo ?? `libre:${norm}`;
    const g = grupos.get(clave) ?? { idCatalogo, nombre: f.nombre, fechaNombre: f.fecha, porFecha: new Map() };
    if (f.fecha > g.fechaNombre) {
      g.nombre = f.nombre;
      g.fechaNombre = f.fecha;
    }
    g.porFecha.set(f.fecha, [...(g.porFecha.get(f.fecha) ?? []), f]);
    grupos.set(clave, g);
  }

  const desde = restarDias(hoy, semanas * 7);
  const out: PesoEjercicio[] = [];
  for (const [clave, g] of grupos) {
    const sesiones: SesionEjercicio[] = [...g.porFecha.entries()]
      .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
      .map(([fecha, lista]) => ({
        fecha,
        series: [...lista].sort((a, b) => a.orden - b.orden).map((s) => ({ kg: s.kg, reps: s.reps })),
      }));
    const tope = (s: SesionEjercicio) => Math.max(...s.series.map((x) => x.kg));
    const ultima = sesiones[0];
    if (!ultima) continue;
    const ultimoKg = tope(ultima);
    if (!(ultimoKg > 0)) continue;
    const mejor = mejorMarca(sesiones);
    const enVentana = sesiones.filter((s) => s.fecha >= desde);
    const masAntigua = enVentana[enVentana.length - 1];
    const subida = enVentana.length >= 2 && masAntigua ? redondear(ultimoKg - tope(masAntigua)) : null;
    out.push({
      clave,
      idCatalogo: g.idCatalogo,
      nombre: g.nombre,
      ultimoKg,
      ultimaFecha: ultima.fecha,
      mejor,
      record: sesiones.length >= 2 && mejor !== null && mejor.fecha === ultima.fecha,
      subida,
      sesiones: sesiones.length,
      serie: sesiones.slice(0, PUNTOS_SERIE).map(tope).reverse(),
    });
  }
  // Lo más reciente primero; a igual fecha, lo que más se ha entrenado.
  return out.sort((a, b) =>
    a.ultimaFecha !== b.ultimaFecha ? (a.ultimaFecha < b.ultimaFecha ? 1 : -1) : b.sesiones - a.sesiones || (a.clave < b.clave ? -1 : 1),
  );
}
