// NIVL · WORK · Gestión: de los datos a lo que enseña cada pantalla (puro, con tests).
//
// Sin React Native, sin Supabase y sin textos: si la vista se rehace en el
// rediseño, esto se queda.

import { calcularCarga, type Carga } from '@/work/carga';
import { diaSemana, esFecha, lunesDe, sumarDias } from '@/work/fechas';
import { horasPorProyecto, totalHoras, minutosPorDia, type DiaHoras, type FilaHorasProyecto, type TotalHoras } from '@/work/horas';
import { entregasConRiesgo, resumenProyecto, resumenProyectos, type EntregaConRiesgo, type ResumenProyecto } from '@/work/proyectos';
import { resumenSemana, semanaARevisar, type MisionSemana, type ResumenSemana } from '@/work/semana';
import { MAX_PRIORIDADES, normal, type DatosWork, type ItemRevision, type Proyecto, type RazonQuedo, type Revision, type SesionTrabajo } from '@/work/tipos';

// ── Lectura de lo que se escribe ────────────────────────────────────────

/** «2 h 30», «2 h», «45 min». Vale igual en los seis idiomas. */
export function duracion(minutos: number): string {
  const m = Math.max(0, Math.round(minutos));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const resto = m % 60;
  return resto ? `${h} h ${String(resto).padStart(2, '0')}` : `${h} h`;
}

export const TARIFA_MAXIMA = 100000;

/** Vacío o cero es «sin tarifa»; `ok: false`, que no se entiende. */
export function leerTarifa(s: string): { ok: true; valor: number | null } | { ok: false } {
  const t = s.trim().replace(/\s|€/g, '').replace(',', '.');
  if (!t) return { ok: true, valor: null };
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return { ok: false };
  const n = Number(t);
  if (n > TARIFA_MAXIMA) return { ok: false };
  return { ok: true, valor: n === 0 ? null : n };
}

/** «28/11» (la próxima vez que caiga), «28/11/2026», «28/11/26» o «2026-11-28». */
export function leerFecha(s: string, hoy: string): string | null {
  const t = s.trim();
  if (esFecha(t)) return t;
  const m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/.exec(t);
  if (!m) return null;
  const dd = m[1]!.padStart(2, '0');
  const mm = m[2]!.padStart(2, '0');
  if (m[3]) {
    const f = `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${mm}-${dd}`;
    return esFecha(f) ? f : null;
  }
  const anio = Number(hoy.slice(0, 4));
  const este = `${anio}-${mm}-${dd}`;
  if (esFecha(este) && este >= hoy) return este;
  const otro = `${anio + 1}-${mm}-${dd}`;
  return esFecha(otro) ? otro : null;
}

export type CodigoOpcionFecha = 'hoy' | 'manana' | 'viernes' | 'semana';

/** Los atajos de fecha, sin dos que caigan el mismo día. */
export function opcionesFecha(hoy: string): { codigo: CodigoOpcionFecha; fecha: string }[] {
  const dia = diaSemana(hoy);
  const candidatas: { codigo: CodigoOpcionFecha; fecha: string }[] = [
    { codigo: 'hoy', fecha: hoy },
    { codigo: 'manana', fecha: sumarDias(hoy, 1) },
    { codigo: 'viernes', fecha: sumarDias(hoy, dia < 5 ? 5 - dia : 12 - dia) },
    { codigo: 'semana', fecha: sumarDias(hoy, 7) },
  ];
  const vistas = new Set<string>();
  return candidatas.filter((o) => (vistas.has(o.fecha) ? false : (vistas.add(o.fecha), true)));
}

// ── Proyectos ───────────────────────────────────────────────────────────

export interface VistaProyectos {
  activos: ResumenProyecto[];
  otros: Proyecto[];
  /** Pendientes sin proyecto. */
  sueltas: EntregaConRiesgo[];
  vacio: boolean;
}

export function vistaProyectos(d: DatosWork, hoy: string): VistaProyectos {
  const sueltas = entregasConRiesgo(
    d.entregas.filter((e) => e.proyectoId === null),
    d.sesiones,
    hoy,
  ).filter((e) => !e.hecha);
  return {
    activos: resumenProyectos(d.proyectos, d.entregas, d.sesiones, hoy),
    otros: d.proyectos.filter((p) => p.estado !== 'activo'),
    sueltas,
    vacio: d.proyectos.length === 0 && sueltas.length === 0,
  };
}

export const HECHAS_EN_DETALLE = 5;

export interface DetalleProyecto {
  resumen: ResumenProyecto;
  pendientes: EntregaConRiesgo[];
  /** Las últimas cerradas. */
  hechas: EntregaConRiesgo[];
}

export function detalleProyecto(id: string, d: DatosWork, hoy: string): DetalleProyecto | null {
  const p = d.proyectos.find((x) => x.id === id);
  if (!p) return null;
  const lista = entregasConRiesgo(
    d.entregas.filter((e) => e.proyectoId === id),
    d.sesiones,
    hoy,
  );
  return {
    resumen: resumenProyecto(p, d.entregas, d.sesiones, hoy),
    pendientes: lista.filter((e) => !e.hecha),
    hechas: lista
      .filter((e) => e.hecha)
      .sort((a, b) => (b.hechaEl ?? '').localeCompare(a.hechaEl ?? ''))
      .slice(0, HECHAS_EN_DETALLE),
  };
}

// ── Horas ───────────────────────────────────────────────────────────────

/** Lo que se ha leído: las sesiones llegan de los últimos 60 días. */
export const DIAS_POR_FACTURAR = 60;
export const MAX_APUNTES = 12;

export interface Apunte {
  sesion: SesionTrabajo;
  proyecto: string | null;
  /** Un bloque ya está ligado a su misión: solo se borra lo apuntado a mano. */
  borrable: boolean;
}

export interface FilaPorFacturar extends FilaHorasProyecto {
  ids: string[];
}

export interface VistaHoras {
  hoyMin: number;
  hoyProfundos: number;
  semana: TotalHoras;
  filasHoy: FilaHorasProyecto[];
  filasSemana: FilaHorasProyecto[];
  dias: DiaHoras[];
  porFacturar: { filas: FilaPorFacturar[]; total: TotalHoras };
  apuntes: Apunte[];
  vacio: boolean;
}

export function vistaHoras(d: DatosWork, hoy: string): VistaHoras {
  const lunes = lunesDe(hoy);
  const domingo = sumarDias(lunes, 6);
  const desde = sumarDias(hoy, -DIAS_POR_FACTURAR);
  const dias = minutosPorDia(d.sesiones, lunes, domingo);
  const deHoy = dias.find((x) => x.fecha === hoy);
  const nombres = new Map(d.proyectos.map((p) => [p.id, p.nombre]));
  const porFacturar = horasPorProyecto(d.sesiones, d.proyectos, desde, hoy)
    .filter((f) => f.porFacturarMin > 0)
    .map(
      (f): FilaPorFacturar => ({
        ...f,
        ids: d.sesiones
          .filter((s) => s.fecha >= desde && s.fecha <= hoy && s.minutos > 0 && s.facturable && !s.facturadaEl && (s.proyectoId && nombres.has(s.proyectoId) ? s.proyectoId : null) === f.proyectoId)
          .map((s) => s.id),
      }),
    );
  const apuntes = d.sesiones
    .filter((s) => s.fecha >= lunes && s.fecha <= domingo)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.inicioMin ?? -1) - (a.inicioMin ?? -1) || a.id.localeCompare(b.id))
    .slice(0, MAX_APUNTES)
    .map((s): Apunte => ({ sesion: s, proyecto: s.proyectoId ? (nombres.get(s.proyectoId) ?? null) : null, borrable: s.tipo === 'manual' }));
  return {
    hoyMin: deHoy?.minutos ?? 0,
    hoyProfundos: deHoy?.profundos ?? 0,
    semana: totalHoras(d.sesiones, d.proyectos, lunes, domingo),
    filasHoy: horasPorProyecto(d.sesiones, d.proyectos, hoy, hoy),
    filasSemana: horasPorProyecto(d.sesiones, d.proyectos, lunes, domingo),
    dias,
    porFacturar: { filas: porFacturar, total: totalHoras(d.sesiones, d.proyectos, desde, hoy) },
    apuntes,
    vacio: d.sesiones.length === 0,
  };
}

/** Un id que no se repite: si se reintenta la misma hoja, es el mismo apunte. */
export const idApunte = (ms: number, azar: number): string => `manual-${ms.toString(36)}-${Math.floor(azar * 1e9).toString(36)}`;

// ── Carga ───────────────────────────────────────────────────────────────

export interface VistaCarga extends Carga {
  /** Sin reuniones ni sesiones en la ventana: no hay nada que medir todavía. */
  sinDatos: boolean;
}

export function vistaCarga(d: Pick<DatosWork, 'eventos' | 'sesiones'>, hoy: string): VistaCarga {
  const carga = calcularCarga({ fecha: hoy, eventos: d.eventos, sesiones: d.sesiones });
  return { ...carga, sinDatos: carga.trabajoSemanaMin === 0 && carga.reunionesSemanaMin === 0 };
}

// ── Revisión semanal ────────────────────────────────────────────────────

export type PasoRevision = 1 | 2 | 3;
export type Razones = Readonly<Record<string, RazonQuedo>>;

/** El primer día de la semana siguiente; si esa semana ya ha empezado, hoy. */
export function diaDeLasTres(hoy: string, lunesRevisado: string): string {
  const siguiente = sumarDias(lunesRevisado, 7);
  return siguiente > hoy ? siguiente : hoy;
}

export interface VistaRevision {
  lunes: string;
  resumen: ResumenSemana;
  previa: Revision | null;
  /** El día en que las tres pasan a ser misiones. */
  dia: string;
  /** Una semana sin nada: se va directo a las tres de la siguiente. */
  vacia: boolean;
}

export function vistaRevision(d: DatosWork, misiones: readonly MisionSemana[], hoy: string): VistaRevision {
  const lunes = semanaARevisar(hoy);
  const resumen = resumenSemana({ lunes, misiones, entregas: d.entregas, sesiones: d.sesiones, eventos: d.eventos, proyectos: d.proyectos });
  return {
    lunes,
    resumen,
    previa: d.revisiones.find((r) => r.semana === lunes) ?? null,
    dia: diaDeLasTres(hoy, lunes),
    vacia: resumen.cerrado.length === 0 && resumen.seQuedo.length === 0 && resumen.minutosTotales === 0 && resumen.minutosReunion === 0,
  };
}

/** Sin nada que se quedara, el paso del porqué sobra. */
export function pasoSiguiente(paso: PasoRevision, haySeQuedo: boolean): PasoRevision {
  if (paso === 1) return haySeQuedo ? 2 : 3;
  return 3;
}

export function pasoAnterior(paso: PasoRevision, haySeQuedo: boolean): PasoRevision {
  if (paso === 3) return haySeQuedo ? 2 : 1;
  return 1;
}

export function razonesDe(previa: Revision | null): Record<string, RazonQuedo> {
  const out: Record<string, RazonQuedo> = {};
  for (const i of previa?.seQuedo ?? []) if (i.razon) out[normal(i.titulo)] = i.razon;
  return out;
}

export const claveRazon = (i: Pick<ItemRevision, 'titulo'>): string => normal(i.titulo);

/**
 * Siempre tres huecos. Lo ya guardado manda; si no, lo propuesto, quitando lo
 * que se marcó como «ya no importa».
 */
export function tresIniciales(v: Pick<VistaRevision, 'resumen' | 'previa'>, razones: Razones): string[] {
  const base = v.previa?.prioridades.length ? v.previa.prioridades : v.resumen.propuestas.filter((p) => razones[normal(p.titulo)] !== 'no_importa').map((p) => p.titulo);
  return Array.from({ length: MAX_PRIORIDADES }, (_, i) => base[i] ?? '');
}

export function construirRevision(resumen: ResumenSemana, razones: Razones, prioridades: readonly string[], nota: string | null): Omit<Revision, 'id'> {
  return {
    semana: resumen.lunes,
    cerrado: resumen.cerrado,
    seQuedo: resumen.seQuedo.map((i) => {
      const razon = razones[normal(i.titulo)];
      return razon ? { ...i, razon } : i;
    }),
    prioridades: prioridades.map((p) => p.trim()).filter(Boolean).slice(0, MAX_PRIORIDADES),
    minutosProfundos: resumen.minutosProfundos,
    minutosTotales: resumen.minutosTotales,
    minutosReunion: resumen.minutosReunion,
    nota,
  };
}
