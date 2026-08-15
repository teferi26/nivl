// NIVL · La matemática del dinero, sin efectos.
//
// Aparte de `money.ts` por la razón de siempre: ese importa Supabase, y con
// AsyncStorage dentro estos tests no arrancarían.
//
// Convención de signo en todo el archivo: **negativo es gasto, positivo es
// ingreso**, igual que en el extracto del banco. Invertirla obligaría a
// traducir en cada consulta y el error de signo llegaría tarde o temprano.

export interface Movimiento {
  date: string; // YYYY-MM-DD
  amount: number;
  category: string;
  counterparty: string | null;
  description: string;
  is_internal: boolean;
}

/** Categorías que sacan dinero de la cuenta pero no son consumo. */
export const CATEGORIAS_NO_GASTO = ['ahorro', 'inversion', 'transferencia'];

export const CATEGORIAS_INGRESO = ['ingreso_negocio', 'ingreso_nomina', 'ingreso_otro'];

export function mesDe(fecha: string): string {
  return fecha.slice(0, 7);
}

/** Días que tiene el mes 'YYYY-MM'. */
export function diasDelMes(mes: string): number {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a!, m!, 0)).getUTCDate();
}

export interface ResumenMes {
  mes: string;
  ingresos: number;
  /** Gasto de consumo, en positivo. No incluye ahorro, inversión ni traspasos. */
  gastos: number;
  /** Lo que se apartó a ahorro o inversión, en positivo. */
  apartado: number;
  neto: number;
  movimientos: number;
}

/**
 * Agrupa por mes natural. Los traspasos entre cuentas propias se descartan
 * enteros: si contaran, mover 500 € de Revolut al banco aparecería como un
 * gasto de 500 y un ingreso de 500 el mismo día.
 */
export function resumenPorMes(movs: Movimiento[]): ResumenMes[] {
  const porMes = new Map<string, ResumenMes>();
  for (const m of movs) {
    if (m.is_internal) continue;
    const mes = mesDe(m.date);
    const r = porMes.get(mes) ?? {
      mes,
      ingresos: 0,
      gastos: 0,
      apartado: 0,
      neto: 0,
      movimientos: 0,
    };
    r.movimientos += 1;
    if (m.amount >= 0) {
      r.ingresos += m.amount;
    } else if (CATEGORIAS_NO_GASTO.includes(m.category)) {
      r.apartado += -m.amount;
    } else {
      r.gastos += -m.amount;
    }
    r.neto = r.ingresos - r.gastos - r.apartado;
    porMes.set(mes, r);
  }
  return [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

/**
 * Porcentaje de lo que entra que no se gasta. Devuelve null sin ingresos: sin
 * denominador la tasa no significa nada, y un 0 % ahí se leería como "no
 * ahorras" en vez de "no has cobrado".
 */
export function tasaAhorro(ingresos: number, gastos: number): number | null {
  if (ingresos <= 0) return null;
  return ((ingresos - gastos) / ingresos) * 100;
}

/**
 * Meses de aire: cuánto aguantas con el saldo actual si no entrara nada más.
 * Es la cifra que convierte "voy justo" en una alarma con fecha.
 *
 * Null si no hay gasto medio (no hay nada que dividir) e Infinity nunca: sin
 * quemar dinero no hay cuenta atrás que dar.
 */
export function mesesDeAire(saldo: number, gastoMensualMedio: number): number | null {
  if (gastoMensualMedio <= 0) return null;
  return Math.max(0, saldo) / gastoMensualMedio;
}

/** Gasto agregado por categoría, en positivo y de mayor a menor. */
export function porCategoria(movs: Movimiento[]): { categoria: string; total: number }[] {
  const acc = new Map<string, number>();
  for (const m of movs) {
    if (m.is_internal || m.amount >= 0) continue;
    acc.set(m.category, (acc.get(m.category) ?? 0) + -m.amount);
  }
  return [...acc.entries()]
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Normaliza el nombre del cobrador para poder agrupar. Los bancos meten
 * referencias distintas en cada cargo del mismo comercio ("AMZN Mktp ES*2K4L9",
 * "AMZN Mktp ES*7H1P2"): sin limpiarlas, cada compra parece un comercio nuevo y
 * no se detecta ninguna suscripción.
 */
export function normalizarCobrador(m: Movimiento): string {
  const base = (m.counterparty ?? m.description) || '';
  return base
    .toUpperCase()
    .replace(/\*.*$/, '')
    .replace(/[0-9]{3,}/g, '')
    .replace(/[^A-ZÁÉÍÓÚÑ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface Suscripcion {
  cobrador: string;
  importeMedio: number;
  meses: number;
  ultimo: string;
  /** Coste anual si sigue igual. Es la cifra que duele y mueve a cancelar. */
  anual: number;
}

/**
 * Cargos que se repiten mes tras mes por un importe parecido. Es la respuesta
 * literal a "en qué se me va el dinero": lo que sangra no suele ser una compra
 * grande, son catorce cargos pequeños que nadie mira.
 *
 * Criterio: mismo cobrador, en 3 meses distintos o más, con los importes dentro
 * de un ±15 % de la mediana (las suscripciones suben de precio y las de uso
 * varían algo; exigir importe exacto se deja fuera la mitad).
 */
export function detectarSuscripciones(movs: Movimiento[], minMeses = 3): Suscripcion[] {
  const grupos = new Map<string, Movimiento[]>();
  for (const m of movs) {
    if (m.is_internal || m.amount >= 0) continue;
    const k = normalizarCobrador(m);
    if (k.length < 3) continue;
    grupos.set(k, [...(grupos.get(k) ?? []), m]);
  }

  const salida: Suscripcion[] = [];
  for (const [cobrador, lista] of grupos) {
    const meses = new Set(lista.map((m) => mesDe(m.date)));
    if (meses.size < minMeses) continue;

    // Un cargo por mes como mucho: dos cafés al mes en el mismo sitio no son
    // una suscripción, son un hábito. Se filtra por regularidad, no por gasto.
    const porMes = new Map<string, number>();
    for (const m of lista) {
      const mes = mesDe(m.date);
      porMes.set(mes, (porMes.get(mes) ?? 0) + 1);
    }
    if ([...porMes.values()].some((n) => n > 2)) continue;

    const importes = lista.map((m) => -m.amount).sort((a, b) => a - b);
    const mediana = importes[Math.floor(importes.length / 2)]!;
    if (mediana <= 0) continue;
    const regulares = importes.filter((v) => Math.abs(v - mediana) / mediana <= 0.15);
    if (regulares.length < minMeses) continue;

    const medio = regulares.reduce((a, b) => a + b, 0) / regulares.length;
    salida.push({
      cobrador,
      importeMedio: medio,
      meses: meses.size,
      ultimo: lista.map((m) => m.date).sort().at(-1)!,
      anual: medio * 12,
    });
  }
  return salida.sort((a, b) => b.anual - a.anual);
}

/**
 * Ritmo de consumo de un presupuesto. Devuelve cuánto llevas gastado frente a
 * lo que tocaría a estas alturas del mes: 1 es ir justo en el guion, 1,4 es ir
 * un 40 % por encima del ritmo y acabar el mes desbordado aunque hoy todavía
 * quede saldo. Es el aviso que llega a tiempo, no el día 30.
 */
export function ritmoPresupuesto(
  gastado: number,
  tope: number,
  diaDelMes: number,
  totalDias: number,
): number | null {
  if (tope <= 0 || totalDias <= 0) return null;
  const transcurrido = Math.min(Math.max(diaDelMes, 1), totalDias) / totalDias;
  return gastado / tope / transcurrido;
}

/** Proyección de cierre de mes al ritmo actual. */
export function proyeccionMes(gastado: number, diaDelMes: number, totalDias: number): number {
  const dia = Math.min(Math.max(diaDelMes, 1), totalDias);
  return (gastado / dia) * totalDias;
}

/**
 * Meses que faltan para llegar a un objetivo ahorrando lo que se ahorra hoy.
 * Null si el ritmo no lleva a ninguna parte: decir "faltan 4.000 meses" es una
 * forma cara de decir que el plan no funciona.
 */
export function mesesHastaObjetivo(
  actual: number,
  objetivo: number,
  ahorroMensual: number,
): number | null {
  if (actual >= objetivo) return 0;
  if (ahorroMensual <= 0) return null;
  const meses = (objetivo - actual) / ahorroMensual;
  return meses > 600 ? null : meses;
}
