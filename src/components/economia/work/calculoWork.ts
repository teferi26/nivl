// NIVL · WORK: de los datos a lo que se pinta. Puro (la galería lo usa con
// datos de demo); las sumas son de src/lib/moneywork.ts.

import { mesDe } from '@/lib/moneymath';
import {
  briefDelMes,
  fijosDelMes,
  gastoPorCategoria,
  mesDelBrief,
  totalesMes,
  vistaGeneral,
  type CategoriaPropia,
  type CuentaWork,
  type Fijo,
  type MovWork,
} from '@/lib/moneywork';
import type { DatosWorkVista, EstadoBrief } from './WorkEconomiaVista';

export interface EntradaWork {
  cuentas: CuentaWork[];
  movs: MovWork[];
  fijos: Fijo[];
  categorias: CategoriaPropia[];
}

export const MOVIMIENTOS_EN_INICIO = 6;

export function derivarWork(e: EntradaWork, hoy: string, brief: { texto: string | null; estado: EstadoBrief }): DatosWorkVista {
  const mes = mesDe(hoy);
  const vista = vistaGeneral(e.cuentas, e.movs);
  const mesBrief = mesDelBrief(hoy);
  const numeros = briefDelMes(
    e.movs,
    mesBrief,
    vista.cuentas.map((c) => ({ nombre: c.nombre, saldo: c.saldo })),
    e.fijos,
  );
  const sinDatos = numeros.este.ingresos === 0 && numeros.este.gastos === 0;
  return {
    vista,
    mes: totalesMes(e.movs, mes),
    fijos: fijosDelMes(e.fijos, e.movs, hoy),
    categorias: gastoPorCategoria(e.movs, mes),
    movimientos: e.movs
      .filter((m) => m.date <= hoy)
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      // Una transferencia se enseña una vez (la pata que sale).
      .filter((m) => !(m.transfer_id && m.amount > 0))
      .slice(0, MOVIMIENTOS_EN_INICIO),
    nombresCuenta: Object.fromEntries(e.cuentas.map((c) => [c.id, c.name])),
    propias: e.categorias,
    brief: { mes: mesBrief, numeros, texto: brief.texto, estado: sinDatos && !brief.texto ? 'sin_datos' : brief.estado },
  };
}
