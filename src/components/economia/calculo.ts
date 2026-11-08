// NIVL · Economía: lo que se calcula de los movimientos, el saldo y el plan.
// Copiado tal cual del useMemo de la ruta vieja; sin efectos (la galería lo
// usa con datos de mentira). Las sumas son de src/lib/moneymath.ts.

import type { MoneyAccount, MoneyPlan, Transaction } from '@/lib/money';
import {
  detectarSuscripciones,
  diasDelMes,
  fijosDelMes,
  mesDe,
  mesesDeAire,
  porCategoria,
  proyeccionMes,
  resumenPorMes,
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
  const suscripciones = detectarSuscripciones(movs);
  const proyeccion = proyeccionMes(esteMes.gastos, dia, totalDias, fijosDelMes(delMes, suscripciones, hoy));
  const tope = Number(plan?.spend_cap ?? 0);

  return {
    mesActual, dia, totalDias, esteMes, cerrados, gastoMedio, saldo,
    categorias: porCategoria(delMes),
    suscripciones,
    sinClasificar: movs.filter((m) => m.category === 'sin_clasificar' && m.amount < 0),
    aire: mesesDeAire(saldo, gastoMedio),
    proyeccion,
    // Contra el cierre previsto: lo fijo ya pagado no adelanta el ritmo.
    ritmo: tope > 0 ? proyeccion / tope : null,
  };
}
