// NIVL · FOCUS: volver tras un hueco (puro, con tests). Tras 2 días o más sin
// estudiar, qué se ha movido y por dónde retomar: pocos repasos y los que más
// importan, sin reproches.

import { diasEntre } from './fechas';
import { tarjetasVivas } from './resumen';
import type { DatosFocus, Examen, Tema } from './tipos';

export const DIAS_HUECO = 2;
export const TOPE_REPASOS_HUECO = 10;

export interface Hueco {
  dias: number;
  ultimaSesion: string;
  /** Exámenes y entregas que han pasado durante el hueco, sin cerrar. */
  pasaron: Examen[];
  repasosVencidos: number;
  tarjetasVencidas: number;
  /** Primero los del examen más cercano y los más frágiles; con tope. */
  repasos: Tema[];
}

/** null si no hay hueco (o nunca se ha estudiado: eso es empezar, no volver). */
export function huecoDe(d: DatosFocus, hoy: string): Hueco | null {
  const fechas = d.sesiones.filter((s) => s.minutos > 0).map((s) => s.fecha);
  if (fechas.length === 0) return null;
  const ultimaSesion = fechas.reduce((a, b) => (a > b ? a : b));
  const dias = diasEntre(ultimaSesion, hoy);
  if (dias < DIAS_HUECO) return null;

  const vivas = new Set(d.asignaturas.map((a) => a.id));
  const pasaron = d.examenes
    .filter((x) => vivas.has(x.asignaturaId) && !x.hechaEl && x.fecha !== null && x.fecha > ultimaSesion && x.fecha < hoy)
    .sort((a, b) => (a.fecha as string).localeCompare(b.fecha as string) || a.titulo.localeCompare(b.titulo));

  const cercania = new Map<string, number>();
  for (const x of d.examenes) {
    if (x.tipo === 'entrega' || x.hechaEl || x.fecha === null || x.estimada || !vivas.has(x.asignaturaId)) continue;
    const n = diasEntre(hoy, x.fecha);
    if (n >= 0) cercania.set(x.asignaturaId, Math.min(cercania.get(x.asignaturaId) ?? Infinity, n));
  }
  const vencidos = d.temas.filter((t) => vivas.has(t.asignaturaId) && t.repasoEl !== null && t.repasoEl <= hoy);
  const repasos = [...vencidos]
    .sort(
      (a, b) =>
        (cercania.get(a.asignaturaId) ?? Infinity) - (cercania.get(b.asignaturaId) ?? Infinity) ||
        a.etapa - b.etapa ||
        (a.repasoEl as string).localeCompare(b.repasoEl as string) ||
        a.nombre.localeCompare(b.nombre),
    )
    .slice(0, TOPE_REPASOS_HUECO);

  return { dias, ultimaSesion, pasaron, repasosVencidos: vencidos.length, tarjetasVencidas: tarjetasVivas(d).filter((c) => c.vence <= hoy).length, repasos };
}
