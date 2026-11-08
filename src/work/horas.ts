// NIVL · WORK: las horas (puro, con tests). Informativo y sin impuestos.

import { sumarDias } from './fechas';
import type { Proyecto, SesionTrabajo } from './tipos';

const dentro = (s: SesionTrabajo, desde: string, hasta: string) => s.fecha >= desde && s.fecha <= hasta && s.minutos > 0;

export interface DiaHoras {
  fecha: string;
  minutos: number;
  profundos: number;
}

/** Un registro por día del rango, también los vacíos. Rango invertido: nada. */
export function minutosPorDia(sesiones: readonly SesionTrabajo[], desde: string, hasta: string): DiaHoras[] {
  if (desde > hasta) return [];
  const out: DiaHoras[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) out.push({ fecha: f, minutos: 0, profundos: 0 });
  const porFecha = new Map(out.map((d) => [d.fecha, d]));
  for (const s of sesiones) {
    if (!dentro(s, desde, hasta)) continue;
    const d = porFecha.get(s.fecha);
    if (!d) continue;
    d.minutos += s.minutos;
    if (s.tipo === 'bloque') d.profundos += s.minutos;
  }
  return out;
}

export interface FilaHorasProyecto {
  /** null = sin proyecto. */
  proyectoId: string | null;
  nombre: string | null;
  cliente: string | null;
  minutos: number;
  facturables: number;
  /** Facturables aún sin marcar como facturadas. */
  porFacturarMin: number;
  /** null si el proyecto no tiene tarifa. Sin impuestos. */
  porFacturarImporte: number | null;
}

const redondea = (n: number) => Math.round(n * 100) / 100;

/** Por proyecto, de más a menos horas. Una sesión de un proyecto borrado va a «sin proyecto». */
export function horasPorProyecto(sesiones: readonly SesionTrabajo[], proyectos: readonly Proyecto[], desde: string, hasta: string): FilaHorasProyecto[] {
  const porId = new Map(proyectos.map((p) => [p.id, p]));
  const filas = new Map<string | null, FilaHorasProyecto>();
  for (const s of sesiones) {
    if (!dentro(s, desde, hasta)) continue;
    const p = s.proyectoId ? (porId.get(s.proyectoId) ?? null) : null;
    const clave = p?.id ?? null;
    const f =
      filas.get(clave) ??
      ({ proyectoId: clave, nombre: p?.nombre ?? null, cliente: p?.cliente ?? null, minutos: 0, facturables: 0, porFacturarMin: 0, porFacturarImporte: null } as FilaHorasProyecto);
    f.minutos += s.minutos;
    if (s.facturable) {
      f.facturables += s.minutos;
      if (!s.facturadaEl) f.porFacturarMin += s.minutos;
    }
    filas.set(clave, f);
  }
  for (const f of filas.values()) {
    const tarifa = f.proyectoId ? porId.get(f.proyectoId)?.tarifaHora : null;
    f.porFacturarImporte = tarifa != null && tarifa > 0 ? redondea((f.porFacturarMin / 60) * tarifa) : null;
  }
  return [...filas.values()].sort((a, b) => b.minutos - a.minutos || (a.proyectoId ?? '').localeCompare(b.proyectoId ?? ''));
}

export interface TotalHoras {
  minutos: number;
  profundos: number;
  facturables: number;
  noFacturables: number;
  porFacturarMin: number;
  /** Suma de lo que tiene tarifa. Informativo, sin impuestos. */
  porFacturarImporte: number;
  /** Facturables sin facturar de proyectos sin tarifa: no suman importe. */
  porFacturarSinTarifaMin: number;
}

export function totalHoras(sesiones: readonly SesionTrabajo[], proyectos: readonly Proyecto[], desde: string, hasta: string): TotalHoras {
  const filas = horasPorProyecto(sesiones, proyectos, desde, hasta);
  const minutos = filas.reduce((a, f) => a + f.minutos, 0);
  const facturables = filas.reduce((a, f) => a + f.facturables, 0);
  return {
    minutos,
    profundos: sesiones.filter((s) => dentro(s, desde, hasta) && s.tipo === 'bloque').reduce((a, s) => a + s.minutos, 0),
    facturables,
    noFacturables: minutos - facturables,
    porFacturarMin: filas.reduce((a, f) => a + f.porFacturarMin, 0),
    porFacturarImporte: redondea(filas.reduce((a, f) => a + (f.porFacturarImporte ?? 0), 0)),
    porFacturarSinTarifaMin: filas.reduce((a, f) => a + (f.porFacturarImporte === null ? f.porFacturarMin : 0), 0),
  };
}

/** Ids de las sesiones facturables del rango aún sin facturar (para marcarlas). */
export function idsPorFacturar(sesiones: readonly SesionTrabajo[], proyectoId: string | null, desde: string, hasta: string): string[] {
  return sesiones.filter((s) => dentro(s, desde, hasta) && s.facturable && !s.facturadaEl && s.proyectoId === proyectoId).map((s) => s.id);
}

/** Con tarifa, facturable por defecto. */
export function facturablePorDefecto(p: Pick<Proyecto, 'tarifaHora'> | null | undefined): boolean {
  return (p?.tarifaHora ?? 0) > 0;
}

/** «1:30», «1,5», «1.5h», «90m», «90 min»; un número suelto hasta 12 son horas y más, minutos. */
export function leerMinutos(s: string): number | null {
  const t = s.trim().toLowerCase().replace(/\s+/g, '');
  if (!t) return null;
  const hm = /^(\d{1,2}):(\d{2})$/.exec(t);
  let min: number | null = null;
  if (hm) {
    if (Number(hm[2]) > 59) return null;
    min = Number(hm[1]) * 60 + Number(hm[2]);
  } else {
    const m = /^(\d+(?:[.,]\d+)?)(h|m|min)?$/.exec(t);
    if (!m) return null;
    const n = Number(m[1]!.replace(',', '.'));
    min = m[2] === 'h' ? n * 60 : m[2] ? n : n <= 12 ? n * 60 : n;
  }
  const r = Math.round(min);
  return r >= 1 && r <= 720 ? r : null;
}
