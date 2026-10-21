// NIVL · WORK: los datos de la economía (efectos). La lógica pura está en
// moneywork.ts (saldo, fijos, transferencias, brief) y moneyextracto.ts (leer
// el CSV del banco); aquí solo se lee y se escribe en Supabase y se llama a la
// función `economia`.
//
// Sin la 0075 aplicada, `cargarWork` devuelve { disponible: false } y la
// pantalla pinta un estado vacío tranquilo: nunca un error rojo.
//
// Nada de lo que pasa por aquí se escribe en la consola: son datos
// financieros.

import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { nuevoInstallId } from './analiticamath';
import { CoachAccessError, type CoachDenyReason } from './coach';
import { addDays } from './dates';
import type { CategoriaPropia, CuentaWork, Fijo, MovNuevo, MovWork, TipoCuenta } from './moneywork';
import type { FilaPropuesta, MovExistente, ReglaCategoria } from './moneyextracto';
import { supabase } from './supabase';
import { ErrorVisible } from './validation';

/** Un uuid v4 (las huellas de los movimientos de la app y las transferencias). */
export const nuevoId = () => nuevoInstallId();

export interface DatosWork {
  disponible: true;
  cuentas: CuentaWork[];
  movs: MovWork[];
  fijos: Fijo[];
  categorias: CategoriaPropia[];
}

export type CargaWork = DatosWork | { disponible: false };

/** ¿El fallo es que la 0075 aún no está (tabla o columna que no existe)? */
export function faltaMigracion(e: unknown): boolean {
  const c = (e as { code?: string } | null)?.code ?? '';
  const m = String((e as { message?: string } | null)?.message ?? '');
  return c === '42P01' || c === '42703' || c === 'PGRST204' || c === 'PGRST205' || /does not exist|schema cache/i.test(m);
}

const COLS_MOV = 'id, date, amount, description, counterparty, category, is_internal, account_id, transfer_id, recurring_id, user_category_id, source';

/** Todo lo de WORK: cuentas, movimientos desde `desde`, fijos y categorías propias. */
export async function cargarWork(hoy: string, meses = 14): Promise<CargaWork> {
  const desde = addDays(hoy, -31 * meses);
  const [c, f, k] = await Promise.all([
    supabase.from('money_accounts').select('id, name, provider, currency, opening_balance, opening_date, sort_order, active').eq('active', true),
    supabase.from('money_recurring').select('id, account_id, kind, name, amount, day_of_month, category, user_category_id, start_date, end_date, generated_through, active').eq('active', true),
    supabase.from('money_categories').select('id, name, kind, base_category, active').eq('active', true).order('name'),
  ]);
  for (const r of [c, f, k]) {
    if (r.error) {
      if (faltaMigracion(r.error)) return { disponible: false };
      throw r.error;
    }
  }
  const cuentas = (c.data ?? []) as CuentaWork[];
  // El saldo de cada cuenta necesita todo lo movido desde su alta, aunque sea
  // anterior a la ventana de lectura.
  const altaMasVieja = cuentas.reduce((a, x) => (x.opening_date < a ? x.opening_date : a), desde);
  const t = await supabase.from('transactions').select(COLS_MOV).gte('date', altaMasVieja).order('date', { ascending: false }).limit(5000);
  if (t.error) {
    if (faltaMigracion(t.error)) return { disponible: false };
    throw t.error;
  }
  const num = <T extends { amount: unknown }>(x: T) => ({ ...x, amount: Number(x.amount) });
  return {
    disponible: true,
    cuentas: cuentas.map((x) => ({ ...x, opening_balance: Number(x.opening_balance) || 0, sort_order: Number(x.sort_order) || 0 })),
    movs: ((t.data ?? []) as MovWork[]).map(num),
    fijos: ((f.data ?? []) as Fijo[]).map(num).map((x) => ({ ...x, day_of_month: Number(x.day_of_month) })),
    categorias: (k.data ?? []) as CategoriaPropia[],
  };
}

async function usuario(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new ErrorVisible('Sesión caducada. Vuelve a entrar.');
  return id;
}

/** Inserta movimientos sin duplicar: lo que ya tenga la misma huella se ignora. */
export async function insertarMovimientos(movs: readonly MovNuevo[]): Promise<number> {
  if (!movs.length) return 0;
  const userId = await usuario();
  let total = 0;
  for (let i = 0; i < movs.length; i += 500) {
    const lote = movs.slice(i, i + 500).map((m) => ({ ...m, user_id: userId }));
    const { data, error } = await supabase
      .from('transactions')
      .upsert(lote, { onConflict: 'user_id,dedup_hash', ignoreDuplicates: true })
      .select('id');
    if (error) throw error;
    total += data?.length ?? 0;
  }
  return total;
}

export interface EntradaCuenta {
  nombre: string;
  tipo: TipoCuenta;
  saldoInicial: number;
  fecha: string;
  orden: number;
}

export async function crearCuenta(e: EntradaCuenta): Promise<void> {
  const userId = await usuario();
  const { error } = await supabase.from('money_accounts').insert({
    user_id: userId,
    name: e.nombre.trim().slice(0, 40),
    provider: e.tipo,
    currency: 'EUR',
    opening_balance: e.saldoInicial,
    opening_date: e.fecha,
    sort_order: e.orden,
  });
  if (error?.code === '23505') throw new ErrorVisible('Ya tienes una cuenta con ese nombre.');
  if (error) throw error;
}

/** Corrige el saldo inicial o el nombre (los movimientos no se tocan). */
export async function editarCuenta(id: string, cambios: { name?: string; opening_balance?: number }): Promise<void> {
  const { error } = await supabase.from('money_accounts').update(cambios).eq('id', id);
  if (error?.code === '23505') throw new ErrorVisible('Ya tienes una cuenta con ese nombre.');
  if (error) throw error;
}

/** Archivar: deja de verse y de sumar, pero sus movimientos se quedan. */
export async function archivarCuenta(id: string): Promise<void> {
  const { error } = await supabase.from('money_accounts').update({ active: false }).eq('id', id);
  if (error) throw error;
}

export interface EntradaFijo {
  cuentaId: string;
  tipo: 'ingreso' | 'gasto';
  nombre: string;
  importe: number;
  dia: number;
  categoria: string;
  categoriaPropia: string | null;
  inicio: string;
}

export async function crearFijo(e: EntradaFijo): Promise<void> {
  const userId = await usuario();
  const { error } = await supabase.from('money_recurring').insert({
    user_id: userId,
    account_id: e.cuentaId,
    kind: e.tipo,
    name: e.nombre.trim().slice(0, 60),
    amount: e.importe,
    day_of_month: e.dia,
    category: e.categoria,
    user_category_id: e.categoriaPropia,
    start_date: e.inicio,
  });
  if (error?.code === '54000') throw new ErrorVisible('Has llegado al máximo de fijos.');
  if (error) throw error;
}

/**
 * Genera lo que falte de los fijos (al abrir WORK) y apunta hasta qué mes
 * quedan generados. Idempotente: la huella `rec|id|mes` es única en la base.
 */
export async function generarFijos(nuevos: readonly MovNuevo[], hasta: readonly { id: string; mes: string }[]): Promise<number> {
  const n = await insertarMovimientos(nuevos);
  for (const h of hasta) {
    // Solo hacia delante: si otro móvil ya fue más lejos, no se retrocede.
    await supabase.from('money_recurring').update({ generated_through: h.mes }).eq('id', h.id).or(`generated_through.is.null,generated_through.lt.${h.mes}`);
  }
  return n;
}

/** Dar de baja un fijo: deja de generarse; lo ya apuntado se queda. */
export async function bajaFijo(id: string, hoy: string): Promise<void> {
  const { error } = await supabase.from('money_recurring').update({ active: false, end_date: hoy }).eq('id', id);
  if (error) throw error;
}

export async function crearCategoria(nombre: string, tipo: 'gasto' | 'ingreso', base: string): Promise<string> {
  const userId = await usuario();
  const { data, error } = await supabase
    .from('money_categories')
    .insert({ user_id: userId, name: nombre.trim().slice(0, 32), kind: tipo, base_category: base })
    .select('id')
    .single();
  if (error?.code === '23505') throw new ErrorVisible('Ya tienes una categoría con ese nombre.');
  if (error?.code === '54000') throw new ErrorVisible('Has llegado al máximo de categorías.');
  if (error) throw error;
  return String((data as { id: string }).id);
}

/** Borra un movimiento; si es una transferencia, sus dos patas. */
export async function borrarMovimiento(m: Pick<MovWork, 'id' | 'transfer_id'>): Promise<void> {
  const q = supabase.from('transactions').delete();
  const { error } = m.transfer_id ? await q.eq('transfer_id', m.transfer_id) : await q.eq('id', m.id);
  if (error) throw error;
}

/** Las reglas de categoría de la persona (para leer el CSV en el móvil). */
export async function reglasCategoria(): Promise<ReglaCategoria[]> {
  const { data, error } = await supabase.from('category_rules').select('pattern, category, priority').eq('active', true);
  if (error) return [];
  return (data ?? []).map((r) => ({ pattern: String(r.pattern), category: String(r.category), priority: Number(r.priority) || 0 }));
}

/** Lo ya guardado en una cuenta desde una fecha (repetidos y parecidos). */
export async function existentesDesde(cuentaId: string, desde: string): Promise<MovExistente[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('date, amount, dedup_hash, source')
    .eq('account_id', cuentaId)
    .gte('date', addDays(desde, -3))
    .limit(10000);
  if (error) throw error;
  return (data ?? []).map((m) => ({ date: String(m.date), amount: Number(m.amount), dedup_hash: String(m.dedup_hash), source: m.source ?? undefined }));
}

// ── El archivo del extracto ─────────────────────────────────────────

export interface ArchivoExtracto {
  nombre: string;
  tipo: 'csv' | 'pdf';
  /** Texto (CSV) o base64 (PDF). Vive solo en memoria. */
  contenido: string;
}

/** ¿Este binario puede abrir el selector de archivos? (expo-document-picker es nativo). */
export function puedeElegirArchivo(): boolean {
  return Platform.OS === 'web' || requireOptionalNativeModule('ExpoDocumentPicker') !== null;
}

/**
 * Abre el selector de archivos del sistema (Archivos en iOS) para elegir el
 * extracto que la persona ya se ha descargado. Null si cancela. NUNCA pide
 * credenciales del banco: solo un archivo.
 */
export async function elegirExtracto(): Promise<ArchivoExtracto | null> {
  const picker = await import('expo-document-picker');
  const r = await picker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/pdf', 'application/vnd.ms-excel'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  const esPdf = /\.pdf$/i.test(a.name) || a.mimeType === 'application/pdf';
  const { File } = await import('expo-file-system');
  if (Platform.OS === 'web') {
    const res = await fetch(a.uri);
    if (esPdf) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
      return { nombre: a.name, tipo: 'pdf', contenido: btoa(bin) };
    }
    return { nombre: a.name, tipo: 'csv', contenido: await res.text() };
  }
  const f = new File(a.uri);
  try {
    const contenido = esPdf ? await f.base64() : await f.text();
    return { nombre: a.name, tipo: esPdf ? 'pdf' : 'csv', contenido };
  } finally {
    // La copia que hizo el selector en la caché se borra al momento.
    try {
      f.delete();
    } catch {
      /* ya no estaba */
    }
  }
}

// ── La función `economia` ───────────────────────────────────────────

function urlEconomia(): string {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error('Falta EXPO_PUBLIC_SUPABASE_URL');
  return `${base}/functions/v1/economia`;
}

const RAZONES: readonly CoachDenyReason[] = ['sin_suscripcion', 'presupuesto_agotado', 'turno_en_curso', 'sin_consentimiento'];

async function llamar<T>(cuerpo: Record<string, unknown>): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ErrorVisible('Sesión caducada. Vuelve a entrar.');
  const res = await fetch(urlEconomia(), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      apikey: process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '',
      'content-type': 'application/json',
    },
    body: JSON.stringify(cuerpo),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string; reason?: string };
  if (res.ok) return body as T;
  const razon = RAZONES.find((r) => r === body.reason);
  if (razon && [402, 403, 429].includes(res.status)) throw new CoachAccessError(razon, res.status, body.error ?? '');
  if (res.status === 402) throw new CoachAccessError('sin_suscripcion', 402, body.error ?? '');
  // 400/413/422: un motivo ya escrito para la persona (archivo grande, sin columnas…).
  if ([400, 413, 422, 502].includes(res.status) && typeof body.error === 'string') throw new ErrorVisible(body.error);
  // 404: la función aún no está desplegada. Mismo trato que sin migración.
  if (res.status === 404) throw new ErrorVisible('Esta parte de WORK todavía se está preparando.');
  throw new Error(`economia ${res.status}`);
}

export interface PropuestaServidor {
  filas: FilaPropuesta[];
  descartadas: number;
}

/** Solo el PDF va al servidor (la IA lo lee); el CSV se lee siempre en el móvil. */
export function pedirPropuesta(a: ArchivoExtracto, cuenta: { id: string; name: string }): Promise<PropuestaServidor> {
  return llamar<PropuestaServidor>({ accion: 'extracto', tipo: a.tipo, contenido: a.contenido, cuenta: cuenta.name, cuenta_id: cuenta.id });
}

export interface BriefServidor {
  mes: string;
  texto: string | null;
  motivo?: string;
}

export function pedirBrief(mes: string): Promise<BriefServidor> {
  return llamar<BriefServidor>({ accion: 'brief', mes });
}

/** El brief ya escrito de un mes (sin llamar a la IA); null si no lo hay o falta la 0075. */
export async function briefGuardado(mes: string): Promise<string | null> {
  const { data, error } = await supabase.from('money_briefs').select('text').eq('month', mes).maybeSingle();
  if (error || !data) return null;
  return String((data as { text: string }).text);
}
