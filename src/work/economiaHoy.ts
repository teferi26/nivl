// NIVL · WORK: la línea de economía de Hoy (puro). Devuelve qué decir, no la
// frase. Informativa: sin impuestos, sin consejo y sin mover nada.
//
// Por orden: lo que el trabajo te debe, un cargo fijo a punto de salir, y si no
// el mes en una línea. Sin movimientos ni fijos, nada.

import { mesDe } from '@/lib/moneymath';
import { fijosDelMes, totalesMes, type Fijo, type MovWork } from '@/lib/moneywork';
import { diasEntre } from './fechas';

export const DIAS_AVISO_FIJO = 2;

export type LineaEconomia =
  | { tipo: 'por_facturar'; importe: number }
  | { tipo: 'fijo'; nombre: string; importe: number; dias: number }
  | { tipo: 'mes'; entra: number; sale: number };

export function lineaEconomiaHoy(e: { hoy: string; porFacturar: number; movs: readonly MovWork[]; fijos: readonly Fijo[] }): LineaEconomia | null {
  if (e.porFacturar > 0) return { tipo: 'por_facturar', importe: e.porFacturar };
  const proximo = fijosDelMes(e.fijos, e.movs, e.hoy)
    .filter((f) => f.fijo.kind === 'gasto' && !f.hecho && f.fecha >= e.hoy)
    .find((f) => diasEntre(e.hoy, f.fecha) <= DIAS_AVISO_FIJO);
  if (proximo) return { tipo: 'fijo', nombre: proximo.fijo.name, importe: proximo.fijo.amount, dias: diasEntre(e.hoy, proximo.fecha) };
  const mes = totalesMes(e.movs, mesDe(e.hoy));
  return mes.ingresos + mes.gastos > 0 ? { tipo: 'mes', entra: mes.ingresos, sale: mes.gastos } : null;
}
