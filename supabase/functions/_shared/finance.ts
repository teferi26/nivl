// NIVL · El estudio económico del gladiador.
//
// Mismo principio que `analytics.ts` para el cuerpo: el coach no ve 900
// movimientos sueltos, ve conclusiones. Un modelo al que le sueltas el extracto
// entero gasta contexto, se equivoca sumando y no es reproducible. Uno al que
// le das "suscripciones detectadas: 214 €/año en cosas que no usas · ritmo de
// gasto un 38 % por encima · 2,4 meses de aire" habla como un asesor.
//
// Las cifras se calculan aquí y son deterministas. La IA decide qué hacer con
// ellas; no las inventa ni las estima.
//
// Estas funciones están duplicadas a propósito en `src/lib/moneymath.ts`: esto
// corre en Deno y aquello en Hermes, y el empaquetado de la Edge Function no
// sube nada de fuera de `supabase/`. Los tests viven en
// `src/lib/__tests__/moneymath.test.ts`; si tocas una fórmula aquí, tócala allí.

import type { Db } from './db.ts';

const NO_GASTO = ['ahorro', 'inversion', 'transferencia'];

interface Mov {
  date: string;
  amount: number;
  category: string;
  counterparty: string | null;
  description: string;
  is_internal: boolean;
  currency: string;
}

function mesDe(f: string) {
  return f.slice(0, 7);
}

function eur(n: number) {
  return `${n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;
}

function eur2(n: number) {
  return `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function mesesAtras(hoy: string, n: number): string {
  const [a, m] = hoy.slice(0, 7).split('-').map(Number);
  const d = new Date(Date.UTC(a!, m! - 1 - n, 1));
  return d.toISOString().slice(0, 7);
}

function diasDelMes(mes: string): number {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a!, m!, 0)).getUTCDate();
}

function normalizarCobrador(m: Mov): string {
  return ((m.counterparty ?? m.description) || '')
    .toUpperCase()
    .replace(/\*.*$/, '')
    .replace(/[0-9]{3,}/g, '')
    .replace(/[^A-ZÁÉÍÓÚÑ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface ResumenMes {
  mes: string;
  ingresos: number;
  gastos: number;
  apartado: number;
}

function resumenPorMes(movs: Mov[]): ResumenMes[] {
  const acc = new Map<string, ResumenMes>();
  for (const m of movs) {
    if (m.is_internal) continue;
    const mes = mesDe(m.date);
    const r = acc.get(mes) ?? { mes, ingresos: 0, gastos: 0, apartado: 0 };
    if (m.amount >= 0) r.ingresos += m.amount;
    else if (NO_GASTO.includes(m.category)) r.apartado += -m.amount;
    else r.gastos += -m.amount;
    acc.set(mes, r);
  }
  return [...acc.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

function porCategoria(movs: Mov[]): { categoria: string; total: number }[] {
  const acc = new Map<string, number>();
  for (const m of movs) {
    if (m.is_internal || m.amount >= 0) continue;
    acc.set(m.category, (acc.get(m.category) ?? 0) + -m.amount);
  }
  return [...acc.entries()]
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);
}

interface Suscripcion {
  cobrador: string;
  importeMedio: number;
  meses: number;
  ultimo: string;
  anual: number;
}

function detectarSuscripciones(movs: Mov[], minMeses = 3): Suscripcion[] {
  const grupos = new Map<string, Mov[]>();
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

    const porMes = new Map<string, number>();
    for (const m of lista) porMes.set(mesDe(m.date), (porMes.get(mesDe(m.date)) ?? 0) + 1);
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

// ── El informe ──────────────────────────────────────────────────────

export async function construirEstudioEconomico(
  sb: Db,
  userId: string,
  hoy: string,
): Promise<string> {
  const desde = `${mesesAtras(hoy, 5)}-01`;

  const [movRes, cuentasRes, planRes, presuRes] = await Promise.all([
    sb.from('transactions').select('*').eq('user_id', userId).gte('date', desde).order('date'),
    sb.from('money_accounts').select('*').eq('user_id', userId).eq('active', true),
    sb
      .from('money_plan')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .order('from_date', { ascending: false })
      .limit(1),
    sb.from('budgets').select('*').eq('user_id', userId).eq('active', true),
  ]);

  const movs = ((movRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
    date: String(r.date),
    amount: Number(r.amount),
    category: String(r.category),
    counterparty: r.counterparty === null ? null : String(r.counterparty),
    description: String(r.description),
    is_internal: Boolean(r.is_internal),
    currency: String(r.currency),
  })) as Mov[];

  const L: string[] = ['# ESTUDIO ECONÓMICO'];
  const push = (s = '') => L.push(s);

  if (!movs.length) {
    push();
    push(
      '- SIN MOVIMIENTOS IMPORTADOS. No puedes decirle en qué se le va el dinero porque no lo sabes. ' +
        'Dile que exporte el extracto de Revolut y lo importe (README, sección Economía), o que conecte el banco. ' +
        'Hasta entonces, no inventes cifras ni estimes gastos: pregunta.',
    );
    return L.join('\n');
  }

  const mesActual = mesDe(hoy);
  const diaHoy = Number(hoy.slice(8, 10));
  const totalDias = diasDelMes(mesActual);
  const resumen = resumenPorMes(movs);
  const esteMes = resumen.find((r) => r.mes === mesActual) ?? {
    mes: mesActual,
    ingresos: 0,
    gastos: 0,
    apartado: 0,
  };
  const cerrados = resumen.filter((r) => r.mes !== mesActual);
  const gastoMedio = cerrados.length
    ? cerrados.reduce((a, r) => a + r.gastos, 0) / cerrados.length
    : esteMes.gastos;
  const ingresoMedio = cerrados.length
    ? cerrados.reduce((a, r) => a + r.ingresos, 0) / cerrados.length
    : esteMes.ingresos;

  // ── El plan vigente ─────────────────────────────────────────────
  const plan = ((planRes.data ?? []) as Record<string, unknown>[])[0];
  push();
  push('## Plan vigente');
  if (plan) {
    const partes: string[] = [];
    if (plan.income_target) partes.push(`ingreso objetivo ${eur(Number(plan.income_target))}/mes`);
    if (plan.spend_cap) partes.push(`tope de gasto ${eur(Number(plan.spend_cap))}/mes`);
    if (plan.savings_target) partes.push(`ahorro ${eur(Number(plan.savings_target))}/mes`);
    if (plan.runway_target_months) partes.push(`${plan.runway_target_months} meses de aire`);
    push(`- ${partes.join(' · ')}`);
    if (plan.rationale) push(`  Motivo: ${plan.rationale}`);
  } else {
    push('- SIN plan económico fijado. Fíjalo tú con fijar_plan_economico antes de exigir disciplina de gasto.');
  }

  // ── Saldo y meses de aire ───────────────────────────────────────
  const cuentas = (cuentasRes.data ?? []) as Record<string, unknown>[];
  const conSaldo = cuentas.filter((c) => c.balance !== null);
  const saldo = conSaldo.reduce((a, c) => a + Number(c.balance), 0);
  push();
  push('## Saldo y meses de aire');
  if (conSaldo.length) {
    const sello = conSaldo
      .map((c) => (c.balance_at ? String(c.balance_at).slice(0, 10) : null))
      .filter(Boolean)
      .sort()[0];
    push(
      `- Saldo total: ${eur(saldo)} en ${conSaldo.length} cuenta(s)` +
        (sello ? ` · dato más antiguo del ${sello}` : ' · SIN FECHA de saldo, trátalo con reservas'),
    );
    if (gastoMedio > 0) {
      const meses = saldo / gastoMedio;
      push(
        `- Meses de aire: ${meses.toFixed(1)} (saldo entre el gasto medio de ${eur(gastoMedio)}/mes)`,
      );
      const objetivo = plan?.runway_target_months ? Number(plan.runway_target_months) : null;
      if (objetivo !== null) {
        push(
          meses >= objetivo
            ? `  Por encima del colchón pactado de ${objetivo} meses.`
            : `  POR DEBAJO del colchón pactado de ${objetivo} meses. Faltan ${eur((objetivo - meses) * gastoMedio)}.`,
        );
      }
    }
  } else {
    push('- Sin saldos registrados: no se puede calcular cuánto aire le queda.');
  }

  // ── Mes en curso ────────────────────────────────────────────────
  push();
  push(`## Mes en curso (${mesActual}, día ${diaHoy} de ${totalDias})`);
  const proyeccion = (esteMes.gastos / Math.max(diaHoy, 1)) * totalDias;
  push(
    `- Entrado ${eur(esteMes.ingresos)} · gastado ${eur(esteMes.gastos)} · apartado ${eur(esteMes.apartado)}`,
  );
  push(`- Proyección de cierre al ritmo actual: ${eur(proyeccion)} de gasto`);
  const tope = plan?.spend_cap ? Number(plan.spend_cap) : null;
  if (tope) {
    const ritmo = esteMes.gastos / tope / (Math.min(diaHoy, totalDias) / totalDias);
    push(
      `- Ritmo contra el tope de ${eur(tope)}: ×${ritmo.toFixed(2)} ` +
        (ritmo > 1.1
          ? `— VA DESBORDADO, cerraría en ${eur(proyeccion)}`
          : ritmo < 0.9
            ? '— por debajo del ritmo, va sobrado'
            : '— en el guion'),
    );
  }
  const objIngreso = plan?.income_target ? Number(plan.income_target) : null;
  if (objIngreso) {
    const falta = objIngreso - esteMes.ingresos;
    push(
      falta > 0
        ? `- Para el objetivo de ${eur(objIngreso)} faltan ${eur(falta)} en ${totalDias - diaHoy} días.`
        : `- Objetivo de ingreso del mes CUMPLIDO (${eur(esteMes.ingresos)} sobre ${eur(objIngreso)}).`,
    );
  }

  // ── Meses cerrados ──────────────────────────────────────────────
  if (cerrados.length) {
    push();
    push('## Meses cerrados');
    for (const r of cerrados.slice(-4)) {
      const tasa = r.ingresos > 0 ? ((r.ingresos - r.gastos) / r.ingresos) * 100 : null;
      push(
        `- ${r.mes}: entró ${eur(r.ingresos)} · gastó ${eur(r.gastos)} · apartó ${eur(r.apartado)} · ` +
          (tasa === null ? 'sin ingresos, tasa no calculable' : `tasa de ahorro ${tasa.toFixed(0)} %`),
      );
    }
    push(`- Media: ${eur(ingresoMedio)} de ingreso y ${eur(gastoMedio)} de gasto al mes.`);
  }

  // ── En qué se va ────────────────────────────────────────────────
  const movsMes = movs.filter((m) => mesDe(m.date) === mesActual);
  const catMes = porCategoria(movsMes);
  if (catMes.length) {
    const previos = movs.filter((m) => mesDe(m.date) !== mesActual);
    const nMesesPrevios = new Set(previos.map((m) => mesDe(m.date))).size || 1;
    const catPrev = new Map(porCategoria(previos).map((c) => [c.categoria, c.total / nMesesPrevios]));
    push();
    push('## En qué se va este mes');
    for (const c of catMes.slice(0, 10)) {
      const media = catPrev.get(c.categoria);
      const delta =
        media && media > 0 ? ` (media anterior ${eur(media)}, ${c.total > media ? '+' : ''}${(((c.total - media) / media) * 100).toFixed(0)} %)` : '';
      push(`- ${c.categoria}: ${eur(c.total)}${delta}`);
    }
  }

  // ── Presupuestos ────────────────────────────────────────────────
  const presupuestos = (presuRes.data ?? []) as Record<string, unknown>[];
  if (presupuestos.length) {
    push();
    push('## Presupuestos');
    const gastadoPorCat = new Map(catMes.map((c) => [c.categoria, c.total]));
    for (const b of presupuestos) {
      const cat = String(b.category);
      const limite = Number(b.monthly_limit);
      const gastado = gastadoPorCat.get(cat) ?? 0;
      const ritmo = limite > 0 ? gastado / limite / (Math.min(diaHoy, totalDias) / totalDias) : null;
      push(
        `- ${cat}: ${eur(gastado)} de ${eur(limite)}` +
          (ritmo === null ? '' : ` · ritmo ×${ritmo.toFixed(2)}${ritmo > 1.15 ? ' ⚠ se pasa' : ''}`),
      );
    }
  }

  // ── Suscripciones ───────────────────────────────────────────────
  const subs = detectarSuscripciones(movs);
  push();
  push('## Cargos recurrentes detectados');
  if (subs.length) {
    let anualTotal = 0;
    for (const s of subs.slice(0, 12)) {
      anualTotal += s.anual;
      push(
        `- ${s.cobrador}: ${eur2(s.importeMedio)}/mes · ${eur(s.anual)}/año · ${s.meses} meses · último ${s.ultimo}`,
      );
    }
    push(`- Total detectado: ${eur(anualTotal)} al año en cargos que se repiten solos.`);
    push(
      'Lectura: esto no son compras, son decisiones que ya no se revisan. Pregúntale por las que no reconozca ' +
        'o no use, una por una, y cancela. Es el ahorro más barato que existe: no exige disciplina, solo una tarde.',
    );
  } else {
    push('- Ninguno con datos suficientes (hacen falta 3 meses de histórico).');
  }

  // ── Top cobradores del mes ──────────────────────────────────────
  const porCobrador = new Map<string, number>();
  for (const m of movsMes) {
    if (m.is_internal || m.amount >= 0) continue;
    const k = normalizarCobrador(m);
    porCobrador.set(k, (porCobrador.get(k) ?? 0) + -m.amount);
  }
  const top = [...porCobrador.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (top.length) {
    push();
    push('## A quién le paga este mes');
    for (const [nombre, total] of top) push(`- ${nombre}: ${eur(total)}`);
  }

  // ── Higiene del dato ────────────────────────────────────────────
  const sinClasificar = movs.filter((m) => m.category === 'sin_clasificar' && m.amount < 0);
  if (sinClasificar.length) {
    const importe = sinClasificar.reduce((a, m) => a + -m.amount, 0);
    push();
    push('## Sin clasificar');
    push(
      `- ${sinClasificar.length} movimientos por ${eur(importe)} sin categoría. Ese dinero no aparece en ningún ` +
        'presupuesto. Pregúntale qué son los mayores y escribe reglas con regla_categoria para que se ' +
        'clasifiquen solos a partir de ahora.',
    );
    for (const m of sinClasificar.sort((a, b) => a.amount - b.amount).slice(0, 5)) {
      // El concepto lo escribe un tercero (quien te hace la transferencia, el
      // comercio): sin saltos de línea ni marcas, y corto, para que no pueda
      // fingir una sección del estado ni colar órdenes largas al coach.
      push(`  · ${m.date} ${eur2(-m.amount)} — ${String(m.description).replace(/[\r\n\t<>#`]+/g, ' ').slice(0, 80)}`);
    }
  }

  const divisas = new Set(movs.map((m) => m.currency));
  if (divisas.size > 1) {
    push();
    push(
      `## Aviso: hay movimientos en ${divisas.size} divisas (${[...divisas].join(', ')}). ` +
        'Los totales de arriba están sumados en bruto, sin convertir. Trátalos como orientativos y dilo si citas cifras.',
    );
  }

  return L.join('\n');
}

// ── WORK: el brief de fin de mes (0075) ─────────────────────────────
//
// ESPEJO de `briefDelMes` en src/lib/moneywork.ts (allí los tests). Las cifras
// son deterministas; la IA de la función `economia` solo las redacta. Si tocas
// una fórmula o un umbral aquí, tócalo allí.

const GRUPO_DE_BASE: Record<string, string> = {
  super: 'comida', restaurante: 'comida', transporte: 'transporte', ocio: 'ocio', ropa: 'ocio',
  vivienda: 'casa', suministros: 'casa', suscripciones: 'suscripciones', salud: 'salud',
  gimnasio: 'salud', formacion: 'educacion',
};
const UMBRAL_SUBIDA_PCT = 30;
const UMBRAL_SUBIDA_MIN = 50;
const UMBRAL_FIJOS_PCT = 50;

export interface MovBrief {
  date: string;
  amount: number;
  category: string;
  is_internal: boolean;
  user_category_id: string | null;
}

interface TotalesMes {
  ingresos: number;
  gastos: number;
  neto: number;
}

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
  gastoDeltaPct: number | null;
  categorias: { clave: string; total: number; cuota: number; anterior: number; deltaPct: number | null }[];
  fijosGasto: number;
  alertas: AlertaBrief[];
}

function claveCategoria(m: MovBrief): string {
  return m.user_category_id ? `u:${m.user_category_id}` : GRUPO_DE_BASE[m.category] ?? 'otros';
}

function totalesDelMes(movs: MovBrief[], mes: string): TotalesMes {
  let ingresos = 0;
  let gastos = 0;
  for (const m of movs) {
    if (m.is_internal || mesDe(m.date) !== mes) continue;
    const c = Math.round(Number(m.amount) * 100);
    if (c >= 0) ingresos += c;
    else if (!NO_GASTO.includes(m.category)) gastos += -c;
  }
  return { ingresos: ingresos / 100, gastos: gastos / 100, neto: (ingresos - gastos) / 100 };
}

function gastoPorClave(movs: MovBrief[], mes: string): { clave: string; total: number; cuota: number }[] {
  const acc = new Map<string, number>();
  for (const m of movs) {
    if (m.is_internal || m.amount >= 0 || mesDe(m.date) !== mes || NO_GASTO.includes(m.category)) continue;
    const k = claveCategoria(m);
    acc.set(k, (acc.get(k) ?? 0) + Math.round(-m.amount * 100));
  }
  const total = [...acc.values()].reduce((a, v) => a + v, 0);
  return [...acc.entries()]
    .map(([clave, c]) => ({ clave, total: c / 100, cuota: total > 0 ? c / total : 0 }))
    .sort((a, b) => b.total - a.total || a.clave.localeCompare(b.clave));
}

function deltaPct(actual: number, anterior: number): number | null {
  if (!(anterior > 0)) return null;
  return Math.round(((actual - anterior) / anterior) * 100);
}

/** Las cifras del brief (pura). Mismo resultado que `briefDelMes` del cliente. */
export function briefEconomicoMes(
  movs: MovBrief[],
  mes: string,
  saldos: { nombre: string; saldo: number }[],
  fijosGasto: number,
): BriefNumeros {
  const anterior = mesesAtras(`${mes}-01`, 1);
  const este = totalesDelMes(movs, mes);
  const previo = totalesDelMes(movs, anterior);
  const prev = new Map(gastoPorClave(movs, anterior).map((l) => [l.clave, l.total]));
  const categorias = gastoPorClave(movs, mes).map((l) => {
    const a = prev.get(l.clave) ?? 0;
    return { ...l, anterior: a, deltaPct: deltaPct(l.total, a) };
  });
  const alertas: AlertaBrief[] = [];
  if (este.gastos > este.ingresos && este.ingresos + este.gastos > 0) {
    alertas.push({ tipo: 'gasta_mas_de_lo_que_entra', diferencia: Math.round((este.gastos - este.ingresos) * 100) / 100 });
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
  if (sin.length) {
    alertas.push({ tipo: 'sin_clasificar', movimientos: sin.length, total: Math.round(sin.reduce((a, m) => a + -m.amount * 100, 0)) / 100 });
  }
  return { mes, anterior, este, previo, gastoDeltaPct: deltaPct(este.gastos, previo.gastos), categorias, fijosGasto, alertas };
}

/**
 * Lee lo justo para el brief de un mes (ese mes y el anterior, cuentas con su
 * saldo inicial, fijos de gasto y los nombres de las categorías propias) con
 * el cliente del usuario: RLS manda. Nada de esto se escribe en los logs.
 */
export async function cargarBriefEconomico(
  sb: Db,
  userId: string,
  mes: string,
): Promise<{ numeros: BriefNumeros; nombres: Record<string, string> }> {
  const desde = `${mesesAtras(`${mes}-01`, 1)}-01`;
  const hasta = `${mes}-${String(diasDelMes(mes)).padStart(2, '0')}`;
  const [movRes, cuentasRes, fijosRes, catsRes] = await Promise.all([
    sb.from('transactions').select('date, amount, category, is_internal, user_category_id')
      .eq('user_id', userId).gte('date', desde).lte('date', hasta),
    sb.from('money_accounts').select('id, name, opening_balance, opening_date').eq('user_id', userId).eq('active', true),
    sb.from('money_recurring').select('kind, amount').eq('user_id', userId).eq('active', true),
    sb.from('money_categories').select('id, name').eq('user_id', userId),
  ]);
  if (movRes.error) throw movRes.error;
  const filas = (movRes.data ?? []) as Record<string, unknown>[];
  const movs: MovBrief[] = filas.map((r) => ({
    date: String(r.date),
    amount: Number(r.amount),
    category: String(r.category),
    is_internal: Boolean(r.is_internal),
    user_category_id: r.user_category_id ? String(r.user_category_id) : null,
  }));
  // Saldo a fin de mes de cada cuenta: inicial + lo movido desde el alta.
  const cuentas = cuentasRes.error ? [] : ((cuentasRes.data ?? []) as Record<string, unknown>[]);
  const saldos: { nombre: string; saldo: number }[] = [];
  for (const c of cuentas) {
    const { data } = await sb.from('transactions').select('amount').eq('user_id', userId)
      .eq('account_id', String(c.id)).gte('date', String(c.opening_date)).lte('date', hasta);
    const centimos = ((data ?? []) as { amount: number }[]).reduce((a, m) => a + Math.round(Number(m.amount) * 100), 0);
    saldos.push({ nombre: String(c.name), saldo: (Math.round(Number(c.opening_balance ?? 0) * 100) + centimos) / 100 });
  }
  const fijos = fijosRes.error ? [] : ((fijosRes.data ?? []) as { kind: string; amount: number }[]);
  const fijosGasto = Math.round(fijos.filter((f) => f.kind === 'gasto').reduce((a, f) => a + Number(f.amount) * 100, 0)) / 100;
  const nombres: Record<string, string> = {};
  if (!catsRes.error) for (const c of (catsRes.data ?? []) as { id: string; name: string }[]) nombres[`u:${c.id}`] = c.name;
  return { numeros: briefEconomicoMes(movs, mes, saldos, fijosGasto), nombres };
}
