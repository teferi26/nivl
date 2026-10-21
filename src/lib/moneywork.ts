// NIVL · WORK: la economía del día a día, sin efectos (cuentas, saldo
// inicial, ingreso mensual y gastos fijos, transferencias, categorías y el
// brief de fin de mes). Pura: sin Supabase, con tests en
// src/lib/__tests__/moneywork.test.ts. Los efectos están en moneydatos.ts.
//
// Convención de signo de todo lo económico: NEGATIVO es gasto, POSITIVO es
// ingreso. Los traspasos entre cuentas propias llevan is_internal y no
// cuentan ni como gasto ni como ingreso (sí mueven el saldo de cada cuenta).
//
// LOS FIJOS SE GENERAN AL ABRIR LA APP (decisión, 0075):
//   `pendientesFijos` dice qué ocurrencias faltan hasta hoy y cada una lleva
//   la huella `rec|<id del fijo>|<YYYY-MM>`. La base tiene un índice único
//   (user_id, dedup_hash): generar dos veces, o desde dos móviles a la vez,
//   no duplica ningún mes. Nadie ve el saldo sin abrir la app, así que no hace
//   falta un cron; si un día se quiere uno (ritual), usa esta misma huella.
//
// El brief de fin de mes (`briefDelMes`) tiene su espejo en
// supabase/functions/_shared/finance.ts (`briefEconomicoMes`): la IA solo
// redacta con estas cifras. Si tocas una, toca la otra.

import { CATEGORIAS_NO_GASTO, diasDelMes, mesDe, type Movimiento } from './moneymath';

// ── Redondeo: el dinero se suma en céntimos ─────────────────────────

/** Redondea a céntimos (0,1 + 0,2 = 0,30, no 0,30000000000000004). */
export function centimos(n: number): number {
  return Math.round(n * 100) / 100;
}

function suma(valores: number[]): number {
  return valores.reduce((a, v) => a + Math.round(v * 100), 0) / 100;
}

// ── Categorías: las ocho de WORK sobre las de la 0013 ───────────────

/** Las categorías predefinidas que ve la persona. */
export const GRUPOS = ['comida', 'transporte', 'ocio', 'casa', 'suscripciones', 'salud', 'educacion', 'otros'] as const;
export type GrupoId = (typeof GRUPOS)[number];

/**
 * Cada grupo guarda los movimientos nuevos en una categoría base del CHECK de
 * la 0013 (así el estudio económico, los presupuestos y el coach siguen
 * leyendo lo mismo) y agrupa las bases parecidas al pintar.
 */
export const BASE_DE_GRUPO: Readonly<Record<GrupoId, string>> = {
  comida: 'super',
  transporte: 'transporte',
  ocio: 'ocio',
  casa: 'vivienda',
  suscripciones: 'suscripciones',
  salud: 'salud',
  educacion: 'formacion',
  otros: 'otros',
};

const GRUPO_DE_BASE: Readonly<Record<string, GrupoId>> = {
  super: 'comida',
  restaurante: 'comida',
  transporte: 'transporte',
  ocio: 'ocio',
  ropa: 'ocio',
  vivienda: 'casa',
  suministros: 'casa',
  suscripciones: 'suscripciones',
  salud: 'salud',
  gimnasio: 'salud',
  formacion: 'educacion',
};

/** El grupo de WORK de una categoría base (lo que no encaja, «otros»). */
export function grupoDe(categoria: string): GrupoId {
  return GRUPO_DE_BASE[categoria] ?? 'otros';
}

/** Categorías base de ingreso. */
export const BASES_INGRESO = ['ingreso_nomina', 'ingreso_negocio', 'ingreso_otro'] as const;

/** Una categoría creada por la persona (money_categories). */
export interface CategoriaPropia {
  id: string;
  name: string;
  kind: 'gasto' | 'ingreso';
  base_category: string;
  active: boolean;
}

/**
 * La clave con la que se agrupa un movimiento al pintar «En qué se va»: la
 * categoría propia si la tiene (`u:<id>`), y si no su grupo de WORK.
 */
export function claveCategoria(m: { category: string; user_category_id?: string | null }): string {
  return m.user_category_id ? `u:${m.user_category_id}` : grupoDe(m.category);
}

// ── Cuentas y saldo ─────────────────────────────────────────────────

export type TipoCuenta = 'efectivo' | 'banco' | 'revolut' | 'inversion' | 'otro';

export interface CuentaWork {
  id: string;
  name: string;
  provider: TipoCuenta | string;
  currency: string;
  /** Saldo el día de alta (opening_date). */
  opening_balance: number;
  opening_date: string;
  sort_order: number;
  active: boolean;
}

/** Un movimiento tal y como lo lee WORK (transactions + columnas de la 0075). */
export interface MovWork extends Movimiento {
  id: string;
  account_id: string | null;
  transfer_id?: string | null;
  recurring_id?: string | null;
  user_category_id?: string | null;
  source?: string;
}

/**
 * Saldo de una cuenta: el inicial más todo lo que se ha movido en ella desde
 * su fecha de alta (los traspasos SÍ cuentan aquí: mueven el dinero de sitio).
 * Lo anterior a la fecha de alta ya está dentro del saldo inicial.
 */
export function saldoCuenta(cuenta: Pick<CuentaWork, 'id' | 'opening_balance' | 'opening_date'>, movs: readonly MovWork[]): number {
  return suma([
    Number(cuenta.opening_balance) || 0,
    ...movs.filter((m) => m.account_id === cuenta.id && m.date >= cuenta.opening_date).map((m) => Number(m.amount) || 0),
  ]);
}

export interface SaldoDeCuenta {
  id: string;
  nombre: string;
  tipo: string;
  saldo: number;
  /** Parte del total positivo (0 a 1) para la barra; 0 si la cuenta está en negativo. */
  cuota: number;
}

export interface VistaGeneral {
  total: number;
  cuentas: SaldoDeCuenta[];
}

/** Total y saldo por cuenta, en el orden de la persona (sort_order, luego nombre). */
export function vistaGeneral(cuentas: readonly CuentaWork[], movs: readonly MovWork[]): VistaGeneral {
  const activas = cuentas
    .filter((c) => c.active)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const saldos = activas.map((c) => ({ id: c.id, nombre: c.name, tipo: String(c.provider), saldo: saldoCuenta(c, movs) }));
  const total = suma(saldos.map((s) => s.saldo));
  const positivo = suma(saldos.map((s) => Math.max(0, s.saldo)));
  return {
    total,
    cuentas: saldos.map((s) => ({ ...s, cuota: positivo > 0 ? Math.max(0, s.saldo) / positivo : 0 })),
  };
}

// ── Fechas de mes ───────────────────────────────────────────────────

/** 'YYYY-MM' n meses antes (n negativo: después). */
export function mesMas(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(a!, m! - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function mesAnterior(mes: string): string {
  return mesMas(mes, -1);
}

/** El día de cobro de un mes: un 31 en febrero cae el último día. */
export function fechaCobro(mes: string, dia: number): string {
  const d = Math.min(Math.max(1, Math.trunc(dia)), diasDelMes(mes));
  return `${mes}-${String(d).padStart(2, '0')}`;
}

// ── Ingreso mensual y gastos fijos ──────────────────────────────────

export interface Fijo {
  id: string;
  account_id: string;
  kind: 'ingreso' | 'gasto';
  name: string;
  /** Siempre positivo; el signo lo pone `kind`. */
  amount: number;
  day_of_month: number;
  category: string;
  user_category_id: string | null;
  start_date: string;
  end_date: string | null;
  active: boolean;
  /**
   * Último mes ya generado ('YYYY-MM'). Lo anterior no se vuelve a generar
   * aunque se borre a mano un mes (borrar = «ese mes no se cobró»).
   */
  generated_through?: string | null;
}

/** Un movimiento listo para insertar (sin user_id: lo pone la capa de datos). */
export interface MovNuevo {
  account_id: string;
  date: string;
  amount: number;
  description: string;
  counterparty: string | null;
  category: string;
  user_category_id: string | null;
  source: 'manual' | 'recurrente' | 'extracto';
  is_internal: boolean;
  transfer_id: string | null;
  recurring_id: string | null;
  dedup_hash: string;
}

/** La huella de la ocurrencia de un fijo en un mes: la que impide duplicarla. */
export function huellaFijo(fijoId: string, mes: string): string {
  return `rec|${fijoId}|${mes}`;
}

/** Cuántos meses atrás se recuperan como mucho al volver tras una ausencia. */
export const MESES_ATRASADOS = 24;

/**
 * Las ocurrencias de los fijos que faltan hasta HOY (incluido). Idempotente:
 * lo que ya está en `existentes` (huellas de la base) no sale, y aunque
 * saliera, el índice único lo rechaza. Nada anterior a la fecha de alta ni
 * posterior a la de baja; nada futuro (el sueldo del día 28 no aparece el 20).
 */
export function pendientesFijos(
  fijos: readonly Fijo[],
  hoy: string,
  existentes: ReadonlySet<string>,
  maxMeses = MESES_ATRASADOS,
): MovNuevo[] {
  const mesHoy = mesDe(hoy);
  const primero = mesMas(mesHoy, -(maxMeses - 1));
  const salida: MovNuevo[] = [];
  for (const f of fijos) {
    if (!f.active || !(Number(f.amount) > 0)) continue;
    let mes = mesDe(f.start_date) > primero ? mesDe(f.start_date) : primero;
    if (f.generated_through && mesMas(f.generated_through, 1) > mes) mes = mesMas(f.generated_through, 1);
    while (mes <= mesHoy) {
      const fecha = fechaCobro(mes, f.day_of_month);
      const huella = huellaFijo(f.id, mes);
      if (fecha >= f.start_date && fecha <= hoy && (!f.end_date || fecha <= f.end_date) && !existentes.has(huella)) {
        const importe = centimos(Math.abs(Number(f.amount)));
        salida.push({
          account_id: f.account_id,
          date: fecha,
          amount: f.kind === 'gasto' ? -importe : importe,
          description: f.name,
          counterparty: f.name,
          category: f.category,
          user_category_id: f.user_category_id,
          source: 'recurrente',
          is_internal: false,
          transfer_id: null,
          recurring_id: f.id,
          dedup_hash: huella,
        });
      }
      mes = mesMas(mes, 1);
    }
  }
  return salida.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Hasta qué mes queda generado un fijo hoy: el mes en curso si su día ya ha
 * llegado, y si no el anterior. Se guarda en money_recurring.generated_through.
 */
export function generadoHasta(f: Pick<Fijo, 'day_of_month'>, hoy: string): string {
  const mes = mesDe(hoy);
  return fechaCobro(mes, f.day_of_month) <= hoy ? mes : mesAnterior(mes);
}

export interface FijoDelMes {
  fijo: Fijo;
  fecha: string;
  /** Ya está en los movimientos del mes. */
  hecho: boolean;
}

/** Los fijos del mes en curso, por día de cobro, con si ya se han apuntado. */
export function fijosDelMes(fijos: readonly Fijo[], movs: readonly MovWork[], hoy: string): FijoDelMes[] {
  const mes = mesDe(hoy);
  const hechos = new Set(movs.filter((m) => m.recurring_id && mesDe(m.date) === mes).map((m) => m.recurring_id));
  return fijos
    .filter((f) => f.active && (!f.end_date || f.end_date >= `${mes}-01`))
    .map((f) => ({ fijo: f, fecha: fechaCobro(mes, f.day_of_month), hecho: hechos.has(f.id) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.fijo.name.localeCompare(b.fijo.name));
}

/** Ingreso y gasto fijo al mes (en positivo). */
export function totalesFijos(fijos: readonly Fijo[]): { ingresos: number; gastos: number } {
  const activos = fijos.filter((f) => f.active);
  return {
    ingresos: suma(activos.filter((f) => f.kind === 'ingreso').map((f) => Number(f.amount))),
    gastos: suma(activos.filter((f) => f.kind === 'gasto').map((f) => Number(f.amount))),
  };
}

// ── Movimientos puntuales y transferencias ──────────────────────────

/**
 * Lee un importe escrito a mano: «12,50», «1.234,56», «12.5», «-3». Devuelve
 * el valor absoluto (el signo lo decide si es gasto o ingreso) o null si no es
 * un número mayor que cero.
 */
export function leerImporte(texto: string): number | null {
  let s = texto.replace(/[\s€]/g, '').replace(/^[+\-−]/, '');
  if (!s) return null;
  const coma = s.lastIndexOf(',');
  const punto = s.lastIndexOf('.');
  if (coma > -1 && punto > -1) {
    // El último separador es el decimal; el otro, de miles.
    s = coma > punto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (coma > -1) {
    s = s.replace(',', '.');
  } else if (punto > -1 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = centimos(Number(s));
  return Number.isFinite(n) && n > 0 && n < 1e9 ? n : null;
}

export interface EntradaMovimiento {
  cuentaId: string;
  tipo: 'gasto' | 'ingreso';
  importe: number;
  fecha: string;
  concepto: string;
  categoria: string;
  categoriaPropia: string | null;
  /** Un id único (uuid) para la huella: dos cafés iguales el mismo día son dos cafés. */
  id: string;
}

/** Un gasto o ingreso puntual (dos toques: importe y categoría). */
export function nuevoMovimiento(e: EntradaMovimiento): MovNuevo {
  const importe = centimos(Math.abs(e.importe));
  return {
    account_id: e.cuentaId,
    date: e.fecha,
    amount: e.tipo === 'gasto' ? -importe : importe,
    description: e.concepto.trim().slice(0, 120),
    counterparty: null,
    category: e.categoria,
    user_category_id: e.categoriaPropia,
    source: 'manual',
    is_internal: false,
    transfer_id: null,
    recurring_id: null,
    dedup_hash: `app|${e.id}`,
  };
}

export interface EntradaTransferencia {
  id: string;
  origen: string;
  destino: string;
  importe: number;
  fecha: string;
  concepto: string;
}

/**
 * Una transferencia entre cuentas propias = dos movimientos enlazados por
 * `transfer_id`, los dos internos (no son gasto ni ingreso): sale de una y
 * entra en la otra el mismo importe.
 */
export function patasTransferencia(e: EntradaTransferencia): [MovNuevo, MovNuevo] {
  if (e.origen === e.destino) throw new Error('misma_cuenta');
  const importe = centimos(Math.abs(e.importe));
  if (!(importe > 0)) throw new Error('importe');
  const comun = {
    date: e.fecha,
    description: e.concepto.trim().slice(0, 120),
    counterparty: null,
    category: 'transferencia',
    user_category_id: null,
    source: 'manual' as const,
    is_internal: true,
    transfer_id: e.id,
    recurring_id: null,
  };
  return [
    { ...comun, account_id: e.origen, amount: -importe, dedup_hash: `trf|${e.id}|sale` },
    { ...comun, account_id: e.destino, amount: importe, dedup_hash: `trf|${e.id}|entra` },
  ];
}

// ── El mes: en qué se va el dinero ──────────────────────────────────

export interface LineaCategoria {
  clave: string;
  total: number;
  /** Parte del gasto del mes (0 a 1). */
  cuota: number;
}

/** Gasto de consumo del mes por categoría de WORK (sin traspasos, ahorro ni inversión). */
export function gastoPorCategoria(movs: readonly MovWork[], mes: string): LineaCategoria[] {
  const acc = new Map<string, number>();
  for (const m of movs) {
    if (m.is_internal || m.amount >= 0 || mesDe(m.date) !== mes || CATEGORIAS_NO_GASTO.includes(m.category)) continue;
    const k = claveCategoria(m);
    acc.set(k, (acc.get(k) ?? 0) + Math.round(-m.amount * 100));
  }
  const total = [...acc.values()].reduce((a, v) => a + v, 0);
  return [...acc.entries()]
    .map(([clave, c]) => ({ clave, total: c / 100, cuota: total > 0 ? c / total : 0 }))
    .sort((a, b) => b.total - a.total || a.clave.localeCompare(b.clave));
}

export interface TotalesMes {
  ingresos: number;
  gastos: number;
  neto: number;
}

/** Lo que entró y salió en un mes (sin traspasos; ahorro e inversión no son gasto). */
export function totalesMes(movs: readonly MovWork[], mes: string): TotalesMes {
  let ingresos = 0;
  let gastos = 0;
  for (const m of movs) {
    if (m.is_internal || mesDe(m.date) !== mes) continue;
    const c = Math.round(Number(m.amount) * 100);
    if (c >= 0) ingresos += c;
    else if (!CATEGORIAS_NO_GASTO.includes(m.category)) gastos += -c;
  }
  return { ingresos: ingresos / 100, gastos: gastos / 100, neto: (ingresos - gastos) / 100 };
}

// ── El brief de fin de mes (cifras; la IA solo redacta) ─────────────

export type AlertaBrief =
  | { tipo: 'gasta_mas_de_lo_que_entra'; diferencia: number }
  | { tipo: 'categoria_sube'; clave: string; pct: number; total: number }
  | { tipo: 'fijos_pesan'; pct: number }
  | { tipo: 'cuenta_en_negativo'; cuenta: string; saldo: number }
  | { tipo: 'sin_clasificar'; movimientos: number; total: number };

export interface BriefNumeros {
  mes: string;
  anterior: string;
  este: TotalesMes;
  previo: TotalesMes;
  /** Diferencia de gasto con el mes anterior, en % (null sin gasto previo). */
  gastoDeltaPct: number | null;
  categorias: (LineaCategoria & { anterior: number; deltaPct: number | null })[];
  fijosGasto: number;
  alertas: AlertaBrief[];
}

/** Variación porcentual redondeada; null si no hay base. */
export function deltaPct(actual: number, anterior: number): number | null {
  if (!(anterior > 0)) return null;
  return Math.round(((actual - anterior) / anterior) * 100);
}

/** Umbrales de las alertas del brief. Mismos valores en finance.ts. */
export const UMBRAL_SUBIDA_PCT = 30;
export const UMBRAL_SUBIDA_MIN = 50;
export const UMBRAL_FIJOS_PCT = 50;

/**
 * Las cifras del brief de un mes cerrado: totales contra el mes anterior, en
 * qué se va (con su variación) y las alertas. Deterministas: la IA las recibe
 * hechas y solo escribe el texto.
 */
export function briefDelMes(
  movs: readonly MovWork[],
  mes: string,
  saldos: readonly { nombre: string; saldo: number }[],
  fijos: readonly Fijo[],
): BriefNumeros {
  const anterior = mesAnterior(mes);
  const este = totalesMes(movs, mes);
  const previo = totalesMes(movs, anterior);
  const prev = new Map(gastoPorCategoria(movs, anterior).map((l) => [l.clave, l.total]));
  const categorias = gastoPorCategoria(movs, mes).map((l) => {
    const a = prev.get(l.clave) ?? 0;
    return { ...l, anterior: a, deltaPct: deltaPct(l.total, a) };
  });
  const fijosGasto = totalesFijos(fijos).gastos;

  const alertas: AlertaBrief[] = [];
  if (este.gastos > este.ingresos && este.ingresos + este.gastos > 0) {
    alertas.push({ tipo: 'gasta_mas_de_lo_que_entra', diferencia: centimos(este.gastos - este.ingresos) });
  }
  for (const c of categorias) {
    if (c.deltaPct !== null && c.deltaPct >= UMBRAL_SUBIDA_PCT && c.total - c.anterior >= UMBRAL_SUBIDA_MIN) {
      alertas.push({ tipo: 'categoria_sube', clave: c.clave, pct: c.deltaPct, total: c.total });
    }
  }
  if (este.ingresos > 0 && fijosGasto > 0) {
    const pct = Math.round((fijosGasto / este.ingresos) * 100);
    if (pct >= UMBRAL_FIJOS_PCT) alertas.push({ tipo: 'fijos_pesan', pct });
  }
  for (const s of saldos) if (s.saldo < 0) alertas.push({ tipo: 'cuenta_en_negativo', cuenta: s.nombre, saldo: s.saldo });
  const sin = movs.filter((m) => mesDe(m.date) === mes && m.category === 'sin_clasificar' && m.amount < 0 && !m.is_internal);
  if (sin.length) alertas.push({ tipo: 'sin_clasificar', movimientos: sin.length, total: suma(sin.map((m) => -m.amount)) });

  return {
    mes,
    anterior,
    este,
    previo,
    gastoDeltaPct: deltaPct(este.gastos, previo.gastos),
    categorias,
    fijosGasto,
    alertas,
  };
}

/**
 * El mes del que toca el brief: el anterior, salvo en los últimos días del mes
 * en curso (desde el 25), en los que ya se puede pedir el del mes que acaba.
 */
export function mesDelBrief(hoy: string): string {
  const mes = mesDe(hoy);
  return Number(hoy.slice(8, 10)) >= 25 ? mes : mesAnterior(mes);
}
