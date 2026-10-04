// NIVL · Economía: lo que se calcula de los movimientos, el saldo y el plan.
// Copiado tal cual del useMemo de la ruta vieja; sin efectos (la galería lo
// usa con datos de mentira). Las sumas son de src/lib/moneymath.ts.

import type { MoneyAccount, MoneyPlan, Transaction } from '@/lib/money';
import {
  detectarSuscripciones,
  diasDelMes,
  mesDe,
  mesesDeAire,
  porCategoria,
  proyeccionMes,
  resumenPorMes,
  ritmoPresupuesto,
} from '@/lib/moneymath';
import type { EconomiaDatos } from './EconomiaVista';

/** Lo que se calcula de los movimientos, el saldo y el plan (sin efectos). */
export function calcularEconomia(
  movs: Transaction[],
  cuentas: MoneyAccount[],
  plan: MoneyPlan | null,
  hoy: string,
): EconomiaDatos {
  const mesActual = mesDe(hoy);
  const dia = Number(hoy.slice(8, 10));
  const totalDias = diasDelMes(mesActual);
  const resumen = resumenPorMes(movs);
  const esteMes = resumen.find((r) => r.mes === mesActual) ?? {
    mes: mesActual, ingresos: 0, gastos: 0, apartado: 0, neto: 0, movimientos: 0,
  };
  const cerrados = resumen.filter((r) => r.mes !== mesActual);
  const gastoMedio = cerrados.length
    ? cerrados.reduce((a, r) => a + r.gastos, 0) / cerrados.length
    : esteMes.gastos;
  const saldo = cuentas.reduce((a, c) => a + Number(c.balance ?? 0), 0);
  const delMes = movs.filter((m) => mesDe(m.date) === mesActual);

  return {
    mesActual, dia, totalDias, esteMes, cerrados, gastoMedio, saldo,
    categorias: porCategoria(delMes),
    suscripciones: detectarSuscripciones(movs),
    sinClasificar: movs.filter((m) => m.category === 'sin_clasificar' && m.amount < 0),
    aire: mesesDeAire(saldo, gastoMedio),
    proyeccion: proyeccionMes(esteMes.gastos, dia, totalDias),
    ritmo: plan?.spend_cap ? ritmoPresupuesto(esteMes.gastos, Number(plan.spend_cap), dia, totalDias) : null,
  };
}
