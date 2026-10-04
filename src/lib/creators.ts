// El programa de creadores (efectos): "¿Quién te trajo?", el código pendiente
// que deja el enlace https://nivl.app/c/CODIGO (o nivl://c/CODIGO) y el panel
// del creador, más el progreso, el histórico y las tablas por periodo (0046). La lógica pura
// —normalizar, la cuenta de comisiones, el texto del panel— vive en
// creatormath.ts.
//
// Todo pasa por las RPC de la 0025. Ninguna tabla del programa se lee desde
// aquí: no tienen políticas para el cliente, y así debe seguir. A un creador
// solo le llega SU dinero; de los demás, alias y ventas del mes.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { codigoValido, motivoReferral, type CreatorRank, type ReferralReason } from './creatormath';
import {
  mesesHistorico,
  parseCreatorBoard,
  parseCreatorHistory,
  parseCreatorProgress,
  periodoTabla,
  type CreatorBoardRow,
  type CreatorHistoryMonth,
  type CreatorProgress,
} from './creatorprogram';
import { marcarCreadorEnTienda } from './pro';
import { claimInvite, mensajeInvite, normalizarCodigo as normalizarCodigoAmigo, type InviteReason } from './invites';
import { supabase } from './supabase';

export type { CreatorBoardRow, CreatorChallenge, CreatorHistoryMonth, CreatorProgress } from './creatorprogram';

// ── El código pendiente ─────────────────────────────────────────────
// El enlace puede llegar antes de iniciar sesión, o el onboarding puede
// quedarse sin red: el código espera aquí hasta que el servidor lo acepte o lo
// rechace. Nunca bloquea nada.

const CLAVE = 'nivl.codigoCreador';

export type ReferralSource = 'onboarding' | 'enlace' | 'perfil';

export interface CodigoPendiente {
  code: string;
  source: ReferralSource;
}

export async function guardarCodigoPendiente(code: string, source: ReferralSource): Promise<void> {
  const c = codigoValido(code);
  if (!c) return;
  try {
    await AsyncStorage.setItem(CLAVE, JSON.stringify({ code: c, source }));
  } catch {
    /* sin almacenamiento: se pierde el código, no la entrada */
  }
}

/** Lee sin borrar (para precargar el campo del onboarding). */
export async function leerCodigoPendiente(): Promise<CodigoPendiente | null> {
  try {
    const raw = await AsyncStorage.getItem(CLAVE);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<CodigoPendiente>;
    const code = codigoValido(v.code);
    if (!code) return null;
    const source: ReferralSource = v.source === 'enlace' || v.source === 'perfil' ? v.source : 'onboarding';
    return { code, source };
  } catch {
    return null;
  }
}

export async function olvidarCodigoPendiente(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CLAVE);
  } catch {
    /* nada */
  }
}

/** Lee y borra. */
export async function tomarCodigoPendiente(): Promise<CodigoPendiente | null> {
  const p = await leerCodigoPendiente();
  await olvidarCodigoPendiente();
  return p;
}

// ── "¿Quién te trajo?" ──────────────────────────────────────────────

export type ClaimResult = { ok: true; alias: string } | { ok: false; reason: ReferralReason };

/**
 * Asigna la cuenta a un creador. Un rechazo de negocio (código desconocido,
 * propio, fuera de plazo…) vuelve como resultado, NO como excepción: la
 * pantalla lo enseña en una línea y deja seguir. Solo un fallo de red o del
 * servidor lanza (y va por `mensajeSistema`).
 */
export async function claimReferral(code: string, source: ReferralSource): Promise<ClaimResult> {
  const c = codigoValido(code);
  if (!c) return { ok: false, reason: 'formato' };
  const { data, error } = await supabase.rpc('claim_referral', { p_code: c, p_source: source });
  if (error) throw error;
  const r = data as { ok?: boolean; alias?: string; reason?: ReferralReason } | null;
  if (r?.ok) {
    // Solo para los gráficos de RevenueCat; la verdad está en `referrals`.
    void marcarCreadorEnTienda(c);
    return { ok: true, alias: r.alias?.trim() || c };
  }
  return { ok: false, reason: r?.reason ?? 'desconocido' };
}

export interface MyReferral {
  /** Alias del creador que me trajo, o null si nadie. */
  alias: string | null;
  since: string | null;
  /** Sin atribución, en plazo y sin haber pagado: aún puedo meter un código. */
  claimable: boolean;
}

export async function fetchMyReferral(): Promise<MyReferral> {
  const { data, error } = await supabase.rpc('my_referral');
  if (error) throw error;
  const r = data as { alias?: string | null; since?: string | null; claimable?: boolean | null } | null;
  return { alias: r?.alias ?? null, since: r?.since ?? null, claimable: !!r?.claimable };
}

/**
 * El reintento al entrar (`src/app/index.tsx`): si quedó un código pendiente
 * —del enlace o de un onboarding sin red—, se manda. Con respuesta del
 * servidor, acepte o rechace, se olvida; sin red, se queda para la próxima.
 */
export async function reintentarCodigoPendiente(): Promise<void> {
  const p = await leerCodigoPendiente();
  if (!p) return;
  try {
    await reclamarQuienTeTrajo(p.code, p.source);
    await olvidarCodigoPendiente();
  } catch {
    /* sin red: sigue pendiente */
  }
}

// ── El panel del creador ────────────────────────────────────────────

export interface CreatorPayout {
  kind: string;
  cents: number;
  at: string;
}

export interface CreatorPanel {
  alias: string;
  code: string;
  rank: CreatorRank;
  pct: number;
  baseCents: number;
  holdDays: number;
  /** Cuentas que metieron el código (no instalaciones: sin SDK de atribución no se pueden contar). */
  installs: number;
  installsMonth: number;
  sales: number;
  salesMonth: number;
  /** En retención (aún dentro de los días de reembolso). */
  pendingCents: number;
  /** Fuera de retención, a la espera de la próxima liquidación. */
  availableCents: number;
  /** Reembolsos de comisiones ya pagadas: se restan en la próxima liquidación. */
  clawbackCents: number;
  paidCents: number;
  monthlyFixedCents: number;
  position: number | null;
  creators: number | null;
  prize: string | null;
  payouts: CreatorPayout[];
}

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;

/** El panel de quien llama, o null si no es creador (la fila de Perfil no sale). */
export async function fetchCreatorPanel(): Promise<CreatorPanel | null> {
  const { data, error } = await supabase.rpc('creator_panel');
  if (error) throw error;
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    alias: String(r.alias ?? ''),
    code: String(r.code ?? ''),
    rank: (r.rank as CreatorRank) ?? 'novato',
    pct: num(r.pct),
    baseCents: num(r.base_cents),
    holdDays: num(r.hold_days),
    installs: num(r.installs),
    installsMonth: num(r.installs_month),
    sales: num(r.sales),
    salesMonth: num(r.sales_month),
    pendingCents: num(r.pending_cents),
    availableCents: num(r.available_cents),
    clawbackCents: num(r.clawback_cents),
    paidCents: num(r.paid_cents),
    monthlyFixedCents: num(r.monthly_fixed_cents),
    position: r.position == null ? null : num(r.position),
    creators: r.creators == null ? null : num(r.creators),
    prize: typeof r.prize === 'string' && r.prize.trim() ? r.prize.trim() : null,
    payouts: Array.isArray(r.payouts)
      ? (r.payouts as { kind: string; cents: number; at: string }[]).map((p) => ({
          kind: p.kind,
          cents: num(p.cents),
          at: p.at,
        }))
      : [],
  };
}

/** El ranking del mes: alias y ventas. Nunca dinero ajeno. Vacío si no eres creador. */
export async function fetchCreatorBoard(): Promise<CreatorBoardRow[]> {
  const { data, error } = await supabase.rpc('creator_board');
  if (error) throw error;
  type Row = { alias: string; sales: number; pos: number; is_me: boolean };
  return ((data ?? []) as Row[]).map((r) => ({
    alias: r.alias,
    sales: num(r.sales),
    pos: num(r.pos),
    isMe: !!r.is_me,
  }));
}

// ── Programa gamificado (0046) ──────────────────────────────────────
// Solo lectura y solo lo propio. Las RPC devuelven céntimos (la web los
// enseña); en la app de tienda el panel los quita con `vistaPanelCreador`
// (creatorprogram.ts) antes de pintar. El parseo defensivo es puro y vive en
// creatorprogram.ts para que el portal web (Chat 4) use el mismo.

/** Lo del creador que llama, o null si no es creador activo. */
export async function fetchCreatorProgress(): Promise<CreatorProgress | null> {
  const { data, error } = await supabase.rpc('creator_progress');
  if (error) throw error;
  return parseCreatorProgress(data);
}

/** El histórico mensual propio, del mes en curso hacia atrás (1-24 meses; el servidor también lo recorta). */
export async function fetchCreatorHistory(months = 12): Promise<CreatorHistoryMonth[]> {
  const { data, error } = await supabase.rpc('creator_sales_history', { p_months: mesesHistorico(months) });
  if (error) throw error;
  return parseCreatorHistory(data);
}

/** La tabla del mes o de un reto: alias y ventas, nunca dinero ajeno. Vacía si no eres creador o el periodo no vale. */
export async function fetchCreatorBoardPeriod(period: string): Promise<CreatorBoardRow[]> {
  const p = periodoTabla(period);
  if (!p) return [];
  const { data, error } = await supabase.rpc('creator_board_period', { p_period: p });
  if (error) throw error;
  return parseCreatorBoard(data);
}

// ── «¿Quién te trajo?»: un solo campo para creador o amigo ─────────────

export type ResultadoQuienTeTrajo =
  | { ok: true; tipo: 'creador'; alias: string }
  | { ok: true; tipo: 'amigo' }
  | { ok: false; tipo: 'creador' | 'amigo'; reason: ReferralReason | InviteReason; mensaje: string };

/**
 * El mismo campo del onboarding (y de Perfil) acepta el código de un creador
 * (0025) o el código de amigo de quien te invitó (0045). Primero se prueba como
 * creador si tiene forma de código de creador; si el servidor no lo conoce y
 * tiene forma de código de amigo (8 caracteres), se prueba como invitación.
 * Lanza solo si falla la red (el llamante lo guarda como pendiente).
 */
export async function reclamarQuienTeTrajo(code: string, source: ReferralSource): Promise<ResultadoQuienTeTrajo> {
  const amigo = normalizarCodigoAmigo(code);
  if (codigoValido(code)) {
    const r = await claimReferral(code, source);
    if (r.ok) return { ok: true, tipo: 'creador', alias: r.alias };
    if (!(r.reason === 'desconocido' && amigo)) {
      return { ok: false, tipo: 'creador', reason: r.reason, mensaje: motivoReferral(r.reason) };
    }
  }
  if (!amigo) return { ok: false, tipo: 'creador', reason: 'formato', mensaje: motivoReferral('formato') };
  const i = await claimInvite(amigo);
  if (i.ok) return { ok: true, tipo: 'amigo' };
  return { ok: false, tipo: 'amigo', reason: i.reason, mensaje: mensajeInvite(i.reason) };
}
