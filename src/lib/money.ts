// NIVL · Los datos del dinero.
//
// La mitad de app del bucle económico: aquí se leen los movimientos que entran
// por el importador y se corrigen las categorías. Cada corrección tuya vale
// doble, porque el coach la convierte en una regla y a partir de ahí se aplica
// sola.
//
// La matemática vive en `moneymath.ts`, sin Supabase, para que tenga tests.

import { supabase } from './supabase';
import type { Movimiento } from './moneymath';

export const CATEGORIAS_GASTO = [
  'vivienda', 'suministros', 'super', 'restaurante', 'transporte', 'salud',
  'gimnasio', 'suscripciones', 'ocio', 'ropa', 'formacion', 'negocio',
  'impuestos', 'comisiones', 'otros',
] as const;

export const CATEGORIAS_INGRESO = ['ingreso_negocio', 'ingreso_nomina', 'ingreso_otro'] as const;

export const CATEGORIAS = [
  ...CATEGORIAS_INGRESO,
  ...CATEGORIAS_GASTO,
  'ahorro', 'inversion', 'transferencia', 'sin_clasificar',
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

/** Nombres para pintar. Las claves son las del CHECK de la 0013. */
export const NOMBRE_CATEGORIA: Record<string, string> = {
  ingreso_negocio: 'Ingreso · negocio',
  ingreso_nomina: 'Ingreso · nómina',
  ingreso_otro: 'Ingreso · otro',
  vivienda: 'Vivienda',
  suministros: 'Suministros',
  super: 'Supermercado',
  restaurante: 'Restaurantes',
  transporte: 'Transporte',
  salud: 'Salud',
  gimnasio: 'Gimnasio',
  suscripciones: 'Suscripciones',
  ocio: 'Ocio',
  ropa: 'Ropa',
  formacion: 'Formación',
  negocio: 'Negocio',
  impuestos: 'Impuestos',
  comisiones: 'Comisiones',
  ahorro: 'Ahorro',
  inversion: 'Inversión',
  transferencia: 'Traspaso',
  otros: 'Otros',
  sin_clasificar: 'Sin clasificar',
};

export interface Transaction extends Movimiento {
  id: string;
  currency: string;
  source: string;
  notes: string | null;
}

export interface MoneyAccount {
  id: string;
  name: string;
  provider: string;
  currency: string;
  balance: number | null;
  balance_at: string | null;
  active: boolean;
}

export interface MoneyPlan {
  id: string;
  from_date: string;
  income_target: number | null;
  spend_cap: number | null;
  savings_target: number | null;
  runway_target_months: number | null;
  currency: string;
  rationale: string | null;
}

export interface Budget {
  id: string;
  category: string;
  monthly_limit: number;
  rationale: string | null;
}

export async function fetchTransactions(desde: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, date, amount, currency, description, counterparty, category, source, is_internal, notes')
    .gte('date', desde)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Transaction[];
}

export async function fetchAccounts(): Promise<MoneyAccount[]> {
  const { data, error } = await supabase
    .from('money_accounts')
    .select('*')
    .eq('active', true)
    .order('name');
  if (error) throw error;
  return (data ?? []) as MoneyAccount[];
}

export async function fetchMoneyPlan(): Promise<MoneyPlan | null> {
  const { data, error } = await supabase
    .from('money_plan')
    .select('*')
    .eq('active', true)
    .order('from_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as MoneyPlan) ?? null;
}

export async function fetchBudgets(): Promise<Budget[]> {
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('active', true);
  if (error) throw error;
  return (data ?? []) as Budget[];
}

/**
 * Corrige la categoría de un movimiento. `aprender` guarda además una regla
 * con el cobrador, que es lo que hace que no tengas que volver a corregirlo
 * nunca: sin eso, cada extracto nuevo te obliga a repetir el mismo trabajo.
 */
export async function recategorizar(
  userId: string,
  tx: Transaction,
  categoria: Categoria,
  aprender: boolean,
): Promise<number> {
  const { error } = await supabase
    .from('transactions')
    .update({ category: categoria })
    .eq('id', tx.id);
  if (error) throw error;
  if (!aprender) return 1;

  const patron = (tx.counterparty ?? tx.description).trim().slice(0, 40);
  if (patron.length < 2) return 1;

  // La regla no pisa lo que ya está clasificado: si algún día le pusiste otra
  // categoría a mano a un movimiento parecido, esa decisión manda.
  await supabase
    .from('category_rules')
    .upsert(
      { user_id: userId, pattern: patron, category: categoria, priority: 100 },
      { onConflict: 'user_id,pattern' },
    );

  const { data } = await supabase
    .from('transactions')
    .update({ category: categoria })
    .eq('category', 'sin_clasificar')
    .ilike('description', `%${patron}%`)
    .select('id');

  return 1 + (data?.length ?? 0);
}

export async function registrarEfectivo(
  userId: string,
  input: { date: string; amount: number; description: string; category: Categoria },
): Promise<void> {
  // Misma huella que el importador y que la herramienta del coach: si el mismo
  // movimiento acaba llegando también por el extracto, no se cuenta dos veces.
  const huella = `manual|${input.date}|${input.amount.toFixed(2)}|${input.description.toLowerCase().slice(0, 60)}`;
  const { error } = await supabase.from('transactions').insert({
    user_id: userId,
    date: input.date,
    amount: input.amount,
    description: input.description,
    category: input.category,
    source: 'manual',
    dedup_hash: huella,
  });
  if (error && error.code !== '23505') throw error;
}
