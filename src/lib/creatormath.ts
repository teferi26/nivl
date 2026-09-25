// Lógica PURA del programa de creadores (sin red ni Supabase): testeable en
// aislamiento. creators.ts trae los datos; aquí se normaliza el código, se
// hace la cuenta de las comisiones y se le pone voz al panel.
//
// La cuenta de dinero es un ESPEJO de supabase/migrations/0025_creadores.sql
// (`net_cents_eur` y `record_sale`), que es quien manda de verdad: el cliente
// nunca decide cuánto cobra nadie. Está aquí para poder probar las reglas de
// docs/PRECIOS.md con casos y para explicarlas en el panel. Si cambias una,
// cambia la otra.

import { euros } from './proplans';

// ── El código ───────────────────────────────────────────────────────

export const CODIGO_RE = /^[A-Z0-9_]{3,20}$/;
export const CODIGO_MAX_LENGTH = 20;

/** Igual que `claim_referral`: mayúsculas y sin espacios. No valida. */
export function normalizarCodigo(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s/g, '').toUpperCase();
}

/** El código normalizado si tiene forma de código; si no, null. */
export function codigoValido(raw: string | null | undefined): string | null {
  const c = normalizarCodigo(raw);
  return CODIGO_RE.test(c) ? c : null;
}

/** El enlace que comparte el creador. Solo abre la app si ya está instalada. */
export function enlaceCreador(code: string): string {
  return `nivl://c/${normalizarCodigo(code)}`;
}

export function mensajeInvitacionCreador(code: string): string {
  const c = normalizarCodigo(code);
  return (
    `Entra en NIVL con mi código: ${c}. ` +
    `Escríbelo en «¿Quién te trajo?» al crear tu cuenta. ` +
    `Si ya tienes la app: ${enlaceCreador(c)}`
  );
}

// ── Los rechazos de "¿Quién te trajo?" ──────────────────────────────

export type ReferralReason = 'formato' | 'desconocido' | 'propio' | 'ya_asignado' | 'ya_pagas' | 'fuera_de_plazo';

const MOTIVO: Record<ReferralReason, string> = {
  formato: 'Un código son de 3 a 20 letras, números o guiones bajos.',
  desconocido: 'El sistema no reconoce ese código.',
  propio: 'Ese código es el tuyo. Nadie se trae a sí mismo.',
  ya_asignado: 'Tu cuenta ya tiene a alguien que te trajo.',
  ya_pagas: 'Tu cuenta ya tiene un plan de pago: el código no se puede añadir.',
  fuera_de_plazo: 'El código solo se añade en los primeros días de la cuenta, y ese plazo ya pasó.',
};

/** La línea que va bajo el campo. Un motivo desconocido cae en el genérico. */
export function motivoReferral(reason: string | null | undefined): string {
  return MOTIVO[reason as ReferralReason] ?? MOTIVO.desconocido;
}

// ── Rangos ──────────────────────────────────────────────────────────

export type CreatorRank = 'novato' | 'pro' | 'elite';

/** Decisión del dueño (§11.7): no chocar con los niveles de la app. */
export const RANGO_LABEL: Record<CreatorRank, string> = {
  novato: 'Creador novato',
  pro: 'Creador pro',
  elite: 'Creador élite',
};

export function rangoLabel(rank: string | null | undefined): string {
  return RANGO_LABEL[rank as CreatorRank] ?? RANGO_LABEL.novato;
}

// ── La cuenta ───────────────────────────────────────────────────────

/**
 * El `round()` de Postgres sobre numeric: exacto y con la mitad hacia fuera
 * del cero. JS trabaja en coma flotante (912,5 puede llegar como 912,4999…),
 * así que se corrige con un épsilon muy por debajo del céntimo.
 */
export function redondear(x: number): number {
  const s = x < 0 ? -1 : 1;
  return s * Math.floor(Math.abs(x) + 0.5 + 1e-9);
}

export interface Ajustes {
  /** Base de la comisión en céntimos (100 € = 10000). */
  baseCents: number;
  smallBusinessProgram: boolean;
  vatPct: number;
  /** % sobre la base en renovaciones anuales con el tope ya lleno (0 por defecto, máx. 10). */
  renewalPct: number;
}

export const AJUSTES_POR_DEFECTO: Ajustes = {
  baseCents: 10_000,
  smallBusinessProgram: false,
  vatPct: 21,
  renewalPct: 0,
};

/** Lo que entra limpio de un cobro, en céntimos: sin IVA y sin la tienda (15 % con SBP, 30 % sin él). */
export function netoCents(precioCents: number, ajustes: Pick<Ajustes, 'smallBusinessProgram' | 'vatPct'>): number {
  const tienda = ajustes.smallBusinessProgram ? 0.15 : 0.3;
  return redondear((precioCents / (1 + ajustes.vatPct / 100)) * (1 - tienda));
}

export type Periodo = 'mensual' | 'anual';

export interface Producto {
  period: Periodo;
  /** null = la base de los ajustes. */
  commissionBaseCents?: number | null;
  /** Tope del % fuera del Small Business Program (Pro anual: 35). null = sin tope. */
  maxPctWithoutSbp?: number | null;
}

/** El % que se aplica de verdad: el del rango, recortado fuera del SBP si el producto lo marca. */
export function pctEfectivo(rangoPct: number, producto: Producto, ajustes: Pick<Ajustes, 'smallBusinessProgram'>): number {
  if (!ajustes.smallBusinessProgram && producto.maxPctWithoutSbp != null) {
    return Math.min(rangoPct, producto.maxPctWithoutSbp);
  }
  return rangoPct;
}

/** Tope por cuenta: base × %. */
export function topeCents(baseCents: number, pct: number): number {
  return redondear((baseCents * pct) / 100);
}

export type ComisionKind = 'primer_pago' | 'mensual' | 'renovacion';

export interface Comision {
  kind: ComisionKind;
  pct: number;
  capCents: number;
  amountCents: number;
}

/**
 * La comisión de UN cobro, como la calcula `record_sale`.
 *
 * - `acumuladoCents`: lo que esta cuenta ya ha generado en `primer_pago` y
 *   `mensual`, sin las anuladas (un reembolso devuelve hueco al tope).
 * - Anual con hueco: paga lo que falte hasta el tope de golpe.
 * - Mensual con hueco: su % del neto del mes, sin pasarse del tope.
 * - Anual con el tope lleno: `renewalPct` sobre la base (0 = nada).
 * - Mensual con el tope lleno: nada.
 *
 * Devuelve null cuando no hay comisión (o sería de 0).
 */
export function comisionCents(args: {
  rangoPct: number;
  producto: Producto;
  netCents: number;
  acumuladoCents: number;
  ajustes: Ajustes;
}): Comision | null {
  const { rangoPct, producto, netCents, acumuladoCents, ajustes } = args;
  const pct = pctEfectivo(rangoPct, producto, ajustes);
  const base = producto.commissionBaseCents ?? ajustes.baseCents;
  const cap = topeCents(base, pct);

  let kind: ComisionKind;
  let amount: number;
  let pctFinal = pct;
  if (acumuladoCents < cap) {
    kind = producto.period === 'anual' ? 'primer_pago' : 'mensual';
    amount =
      producto.period === 'anual'
        ? cap - acumuladoCents
        : Math.min(redondear((netCents * pct) / 100), cap - acumuladoCents);
  } else if (producto.period === 'anual' && ajustes.renewalPct > 0) {
    kind = 'renovacion';
    pctFinal = ajustes.renewalPct;
    amount = redondear((base * ajustes.renewalPct) / 100);
  } else {
    return null;
  }
  if (amount <= 0) return null;
  return { kind, pct: pctFinal, capCents: cap, amountCents: amount };
}

/** Lo que se transfiere al liquidar: disponible menos clawbacks. null = no hay nada que pagar. */
export function liquidacionCents(disponibleCents: number, clawbackCents: number): number | null {
  const neto = disponibleCents - clawbackCents;
  return neto > 0 ? neto : null;
}

// ── El panel ────────────────────────────────────────────────────────

export type PayoutKind = 'comisiones' | 'fijo_mensual' | 'premio' | 'contenido_externo' | 'ajuste';

export const PAGO_LABEL: Record<PayoutKind, string> = {
  comisiones: 'Comisiones',
  fijo_mensual: 'Fijo mensual',
  premio: 'Premio',
  contenido_externo: 'Contenido',
  ajuste: 'Ajuste',
};

export function pagoLabel(kind: string): string {
  return PAGO_LABEL[kind as PayoutKind] ?? 'Pago';
}

/** "35 %", "12,5 %". */
export function pctLabel(pct: number): string {
  const r = Math.round(pct * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1).replace('.', ',')} %`;
}

/** "Creador pro · 35 % sobre 100,00 €". */
export function lineaRango(rank: string, pct: number, baseCents: number): string {
  return `${rangoLabel(rank)} · ${pctLabel(pct)} sobre ${euros(baseCents)}`;
}

/** Lo que cobra por venta anual en su rango: "35,00 €". */
export function porVentaAnual(pct: number, baseCents: number): string {
  return euros(topeCents(baseCents, pct));
}

/** La línea de la posición en el ranking del mes. */
export function lineaPosicion(pos: number | null, total: number | null, ventasMes: number): string {
  if (!ventasMes || !pos) return 'Aún sin ventas este mes. El ranking se cuenta por cuentas nuevas que pagan.';
  const de = total && total > 1 ? ` de ${total}` : '';
  return pos === 1 ? `Primero del mes${de}.` : `Puesto ${pos}${de} este mes.`;
}

export function ventasLabel(n: number): string {
  return `${n} ${n === 1 ? 'venta' : 'ventas'}`;
}

/** El número sin el símbolo, para una cifra grande con "€" aparte: "12,50". */
export function importe(cents: number): string {
  return euros(cents).replace(/\s€$/, '');
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** "19 sept 2026" a partir de un ISO; la hora local del teléfono. Vacío si no es fecha. */
export function fechaPago(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

export { euros };
