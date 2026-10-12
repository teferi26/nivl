// NIVL · Programa de creadores gamificado (PURO: sin red ni Supabase).
//
// Tres piezas:
//   1. El parseo defensivo de las RPC de la 0046 (creator_progress,
//      creator_sales_history, creator_board_period) y el contrato
//      `PortalCreador` que el portal web (Chat 4) monta con supabase-js y la
//      sesión del creador. Los efectos están en creators.ts.
//   2. `vistaPanelCreador`: en la app de tienda (iOS/Android) el panel NO
//      enseña importes en euros (dictamen de tiendas del Chat 1): solo rango,
//      ventas atribuidas, retos y tabla, más una línea informativa de que las
//      ganancias se gestionan en nivl.app, sin botón de cobro. Los importes
//      (pendiente, disponible, pagado, anulado) son del portal web.
//   3. El kit de clips: ganchos, guiones de 15/30/60 s, reglas de marca en
//      blanco y negro, el aviso de publicidad obligatorio y lo prohibido
//      (Apple 3.2.2 / Google Play), con `revisarTexto` para comprobar un guion.
//
// Repo público: aquí no hay ningún creador, código, regla de rango, reto ni
// premio reales. Todo eso vive en la base y lo escribe scripts/creadores.mjs.

import {
  enlaceCreador,
  progresoRango,
  rangoLabel,
  rangoValido,
  rolValido,
  ROL_LABEL,
  type CreatorRank,
  type CreatorRole,
  type ProgresoRango,
  type ReglaRango,
} from './creatormath';
import type { CreatorPanel } from './creators';
import { PRO_PLANS } from './proplans';
import { esTienda } from './storepolicy';

// ── Parseo defensivo de las RPC (0046) ──────────────────────────────

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;
const numOrNull = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export interface CreatorChallenge {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  goalSales: number;
  prize: string | null;
  /** null = para todos los roles. */
  role: CreatorRole | null;
  /** Ventas propias dentro de la ventana del reto. */
  sales: number;
}

export interface CreatorProgress {
  alias: string;
  code: string;
  role: CreatorRole;
  rank: CreatorRank;
  /** % de comisión del rango. Es dinero: la app de tienda no lo enseña. */
  pct: number;
  baseCents: number;
  sales90d: number;
  /** Meses seguidos (hora de Madrid) con al menos una venta. */
  monthsActive: number;
  nextRank: CreatorRank | null;
  /** null si el dueño no ha fijado regla para el siguiente rango. */
  nextMinSales90d: number | null;
  nextMinMonthsActive: number | null;
  challenges: CreatorChallenge[];
}

export interface CreatorHistoryMonth {
  /** 'AAAA-MM' en hora de Madrid. */
  month: string;
  sales: number;
  pendingCents: number;
  availableCents: number;
  paidCents: number;
  voidedCents: number;
  /** De lo anulado, lo que ya estaba pagado (se descuenta en la próxima liquidación). */
  clawbackCents: number;
}

export interface CreatorBoardRow {
  alias: string;
  sales: number;
  pos: number;
  isMe: boolean;
}

function parseChallenge(v: unknown): CreatorChallenge | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  const id = str(r.id);
  if (!id) return null;
  return {
    id,
    title: str(r.title),
    description: strOrNull(r.description),
    startsAt: str(r.starts_at),
    endsAt: str(r.ends_at),
    goalSales: Math.max(1, num(r.goal_sales)),
    prize: strOrNull(r.prize),
    role: r.role == null ? null : rolValido(r.role),
    sales: num(r.sales),
  };
}

/** `creator_progress()` → CreatorProgress, o null (no es creador activo o respuesta rara). */
export function parseCreatorProgress(data: unknown): CreatorProgress | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const r = data as Record<string, unknown>;
  if (!str(r.code)) return null;
  return {
    alias: str(r.alias),
    code: str(r.code),
    role: rolValido(r.role),
    rank: rangoValido(r.rank),
    pct: num(r.pct),
    baseCents: num(r.base_cents),
    sales90d: num(r.sales_90d),
    monthsActive: num(r.months_active),
    nextRank: r.next_rank == null ? null : rangoValido(r.next_rank),
    nextMinSales90d: numOrNull(r.next_min_sales_90d),
    nextMinMonthsActive: numOrNull(r.next_min_months_active),
    challenges: Array.isArray(r.challenges)
      ? r.challenges.map(parseChallenge).filter((c): c is CreatorChallenge => c !== null)
      : [],
  };
}

/** `creator_sales_history(p_months)` → filas con mes válido. */
export function parseCreatorHistory(data: unknown): CreatorHistoryMonth[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && /^\d{4}-\d{2}$/.test(str((r as Record<string, unknown>).month)))
    .map((r) => ({
      month: str(r.month),
      sales: num(r.sales),
      pendingCents: num(r.pending_cents),
      availableCents: num(r.available_cents),
      paidCents: num(r.paid_cents),
      voidedCents: num(r.voided_cents),
      clawbackCents: num(r.clawback_cents),
    }));
}

/** `creator_board()` / `creator_board_period()` → filas con alias. */
export function parseCreatorBoard(data: unknown): CreatorBoardRow[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && typeof (r as Record<string, unknown>).alias === 'string')
    .map((r) => ({ alias: str(r.alias), sales: num(r.sales), pos: num(r.pos), isMe: r.is_me === true }));
}

/** Meses del histórico: 1..24, 12 si no es un número. */
export function mesesHistorico(months: unknown): number {
  const n = Math.floor(Number(months));
  return Number.isFinite(n) ? Math.min(24, Math.max(1, n)) : 12;
}

export type BoardPeriod = 'mes' | `reto:${string}`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 'mes' o 'reto:<uuid>'; null si no tiene forma de periodo. */
export function periodoTabla(period: unknown): BoardPeriod | null {
  if (period === 'mes') return 'mes';
  const m = /^reto:(.+)$/.exec(str(period));
  return m && UUID_RE.test(m[1]) ? (`reto:${m[1].toLowerCase()}` as BoardPeriod) : null;
}

/** Las reglas de rango que se pueden deducir de `creator_progress` (solo la del siguiente). */
export function reglasDesdeProgreso(p: CreatorProgress): ReglaRango[] {
  if (!p.nextRank || p.nextMinSales90d == null) return [];
  return [{ rank: p.nextRank, minSales90d: p.nextMinSales90d, minMonthsActive: p.nextMinMonthsActive ?? 0 }];
}

// ── El contrato del portal web (Chat 4) ─────────────────────────────

/**
 * Lo que el portal web lee, con supabase-js y la sesión del creador (nunca
 * service_role). Todas son RPC de 0025/0046, `security definer`, que
 * revalidan `creators.user_id = auth.uid() and active`: sin sesión de creador
 * activo devuelven null o 0 filas. Las tablas siguen cerradas.
 */
export const RPC_PORTAL = {
  /** 0025 · jsonb | null — panel con su dinero (pendiente, disponible, clawback, pagos). */
  panel: 'creator_panel',
  /** 0046 · jsonb | null — rango, ventas 90 d, siguiente umbral, retos activos, racha. */
  progreso: 'creator_progress',
  /** 0046 · filas por mes (Madrid); arg `p_months` 1..24 (null = 12). */
  historico: 'creator_sales_history',
  /** 0046 · alias + ventas; arg `p_period` 'mes' | 'reto:<uuid>'. */
  tabla: 'creator_board_period',
} as const;

export interface PortalCreador {
  /** De `creator_panel()`; null si no es creador activo (el portal enseña «sin acceso»). */
  panel: CreatorPanel | null;
  progreso: CreatorProgress | null;
  historico: CreatorHistoryMonth[];
  /** Tabla del mes y de cada reto activo, por clave de periodo ('mes', 'reto:<uuid>'). */
  tablas: Partial<Record<BoardPeriod, CreatorBoardRow[]>>;
  /** https://nivl.app/c/CODIGO */
  enlace: string;
  kit: KitClips;
}

// ── Lo que enseña cada sitio: tienda sin importes, web con todo ─────

// Sin portal web de creadores todavía: no se remite a ninguna web (el
// desglose llega con cada liquidación, condiciones del programa §4). En la app
// de tienda solo se dice que es fuera de la app (dictamen del Chat 1).
export const AVISO_GANANCIAS = 'Tus ganancias se gestionan fuera de la app.';
/** Enlace informativo (no un botón de cobro). */
/** Sin portal de creadores: no hay enlace. Si llega un portal, se pone aquí. */
export const ENLACE_GANANCIAS: string | null = null;

/** Un texto con pinta de importe (€, $, £, «euros»). */
// Importes, porcentajes y vocabulario de cobro (auditoría UX de Chat 4): en
// tienda tampoco puede colarse «+10 % de comisión» ni «cobras al mes».
// (Sin \b alrededor de acentos: el \b de JS no reconoce letras no ASCII.)
const PARECE_DINERO =
  /[€$£%]|\beur(?:o|os)?\b|\busd\b|comisi[oó]n|\bcobr[a-zá-ú]*|\bpag(?:o|os|a|as|an|ar|amos|ado|ada)\b|\bdinero\b|\bganancias?\b|\bliquidaci|\bbizum\b|\btransferencia/i;

export interface RetoVista {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  goalSales: number;
  sales: number;
  /** En tienda solo si no habla de dinero. */
  prize: string | null;
}

/** Lo que la app de tienda puede pintar: ni un céntimo ni un %. */
export interface PanelCreadorTienda {
  conImportes: false;
  alias: string;
  code: string;
  enlace: string;
  role: CreatorRole;
  rolLabel: string;
  rank: CreatorRank;
  rangoLabel: string;
  installs: number;
  installsMonth: number;
  sales: number;
  salesMonth: number;
  sales90d: number;
  monthsActive: number;
  progreso: ProgresoRango;
  position: number | null;
  creators: number | null;
  retos: RetoVista[];
  tabla: CreatorBoardRow[];
  historico: { month: string; sales: number }[];
  aviso: string;
  enlaceAviso: string | null;
}

/** La web: todo lo anterior y además el dinero propio. */
export interface PanelCreadorWeb extends Omit<PanelCreadorTienda, 'conImportes' | 'retos' | 'historico'> {
  conImportes: true;
  pct: number;
  baseCents: number;
  pendingCents: number;
  availableCents: number;
  clawbackCents: number;
  paidCents: number;
  monthlyFixedCents: number;
  prize: string | null;
  payouts: CreatorPanel['payouts'];
  retos: RetoVista[];
  historico: CreatorHistoryMonth[];
}

export type PanelCreadorVista = PanelCreadorTienda | PanelCreadorWeb;

export interface DatosPanelCreador {
  panel: CreatorPanel | null;
  progreso: CreatorProgress | null;
  historico?: CreatorHistoryMonth[];
  tabla?: CreatorBoardRow[];
}

/**
 * El selector del panel. En tienda (iOS/Android, `esTienda`) se construye con
 * una LISTA BLANCA de campos sin dinero: ni céntimos, ni %, ni pagos, ni un
 * premio que mencione dinero. Fuera de tienda (web) pasa todo. null si no hay
 * ni panel ni progreso (no es creador).
 */
export function vistaPanelCreador(plataforma: string, datos: DatosPanelCreador): PanelCreadorVista | null {
  const { panel, progreso } = datos;
  if (!panel && !progreso) return null;
  const code = panel?.code || progreso?.code || '';
  const rank = rangoValido(progreso?.rank ?? panel?.rank);
  const role = rolValido(progreso?.role);
  const sales90d = progreso?.sales90d ?? 0;
  const monthsActive = progreso?.monthsActive ?? 0;
  const tienda = esTienda(plataforma);
  const retosBase = (progreso?.challenges ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    goalSales: c.goalSales,
    sales: c.sales,
    prize: c.prize,
  }));
  const comun = {
    alias: panel?.alias || progreso?.alias || '',
    code,
    enlace: code ? enlaceCreador(code) : '',
    role,
    rolLabel: ROL_LABEL[role],
    rank,
    rangoLabel: rangoLabel(rank),
    installs: panel?.installs ?? 0,
    installsMonth: panel?.installsMonth ?? 0,
    sales: panel?.sales ?? 0,
    salesMonth: panel?.salesMonth ?? 0,
    sales90d,
    monthsActive,
    progreso: progresoRango(sales90d, progreso ? reglasDesdeProgreso(progreso) : [], monthsActive),
    position: panel?.position ?? null,
    creators: panel?.creators ?? null,
    tabla: (datos.tabla ?? []).map((r) => ({ alias: r.alias, sales: r.sales, pos: r.pos, isMe: r.isMe })),
    aviso: AVISO_GANANCIAS,
    enlaceAviso: ENLACE_GANANCIAS,
  };

  if (tienda) {
    return {
      conImportes: false,
      ...comun,
      // El alias es del creador: si alguien se puso «Gana 500€», en tienda no sale.
      alias: PARECE_DINERO.test(comun.alias) ? code : comun.alias,
      tabla: comun.tabla.map((r) => ({ ...r, alias: PARECE_DINERO.test(r.alias) ? 'Creador' : r.alias })),
      retos: retosBase.map((r) => ({
        ...r,
        title: PARECE_DINERO.test(r.title) ? 'Reto' : r.title,
        description: r.description && PARECE_DINERO.test(r.description) ? null : r.description,
        // Ningún premio en la app de tienda, tampoco en especie: un reto con
        // premio es un concurso y Apple 5.3.2 pide sus bases oficiales DENTRO
        // de la app y decir que Apple no lo patrocina. Los premios, en la web.
        prize: null,
      })),
      historico: (datos.historico ?? []).map((h) => ({ month: h.month, sales: h.sales })),
    };
  }
  return {
    conImportes: true,
    ...comun,
    pct: progreso?.pct ?? panel?.pct ?? 0,
    baseCents: progreso?.baseCents ?? panel?.baseCents ?? 0,
    pendingCents: panel?.pendingCents ?? 0,
    availableCents: panel?.availableCents ?? 0,
    clawbackCents: panel?.clawbackCents ?? 0,
    paidCents: panel?.paidCents ?? 0,
    monthlyFixedCents: panel?.monthlyFixedCents ?? 0,
    prize: panel?.prize ?? null,
    payouts: panel?.payouts ?? [],
    retos: retosBase,
    historico: datos.historico ?? [],
  };
}

// ── El kit de clips ─────────────────────────────────────────────────

/** Obligatorio en todo clip, post o historia: es publicidad (LSSI art. 20, Ley 13/2022, normas de cada red). */
export const AVISO_PUBLI = '#publi';

export interface Guion {
  segundos: 15 | 30 | 60;
  titulo: string;
  /** Tramos en orden: [desde-hasta en s, qué se dice o se ve]. */
  tramos: readonly (readonly [string, string])[];
}

export interface Prohibicion {
  id: 'precio_inventado' | 'gratis_para_siempre' | 'promesa_resultados' | 'incentivo_valoracion' | 'sin_publi';
  regla: string;
  porque: string;
}

export interface KitClips {
  ganchos: readonly string[];
  guiones: readonly Guion[];
  marca: readonly string[];
  aviso: string;
  prohibido: readonly Prohibicion[];
}

export const GANCHOS: readonly string[] = [
  'Llevo X días sin fallar un hábito. Esto es lo que me obliga.',
  'Mi día lo decide un coach. Y no negocia.',
  'Si fallo, pierdo racha delante de todos.',
  'Esto es lo que pasa cuando conviertes tu día en una arena.',
  'Firmé un contrato conmigo mismo. Esta app me lo cobra.',
  'Nivel 1 hace un mes. Mira dónde estoy.',
];

export const GUIONES: readonly Guion[] = [
  {
    segundos: 15,
    titulo: 'El gancho y la pantalla',
    tramos: [
      ['0-3', 'Gancho a cámara, una frase.'],
      ['3-11', 'Grabación de pantalla real: Hoy, una misión completada, la racha.'],
      ['11-15', `Código en pantalla y «${AVISO_PUBLI}». Enlace en la bio.`],
    ],
  },
  {
    segundos: 30,
    titulo: 'Un día en la arena',
    tramos: [
      ['0-3', 'Gancho.'],
      ['3-10', 'El plan del día que propone el coach.'],
      ['10-22', 'Tres cortes: completar una misión, el gym o el diario, el cierre del día.'],
      ['22-30', `Qué te ha cambiado, sin prometer resultados. Código y «${AVISO_PUBLI}».`],
    ],
  },
  {
    segundos: 60,
    titulo: 'La historia',
    tramos: [
      ['0-5', 'Gancho y por qué empezaste.'],
      ['5-25', 'El contrato y las reglas que firmaste.'],
      ['25-45', 'La racha, el ranking con amigos, un día que casi la pierdes.'],
      ['45-55', 'Lo que tiene gratis y lo que da el coach (precio solo el oficial, o ninguno).'],
      ['55-60', `Código, enlace y «${AVISO_PUBLI}».`],
    ],
  },
];

export const REGLAS_MARCA: readonly string[] = [
  'Solo blanco y negro: fondo negro, texto blanco hueso. Sin otros colores, sin filtros de color.',
  'Una sola tipografía de rótulo (Cinzel) para el título; el resto, limpia.',
  'La voz es la del sistema: frases cortas, en segunda persona, sin emojis ni signos de exclamación en cadena.',
  'Graba la app real. Nada de pantallas montadas ni funciones que no existan.',
  'Gladiador, arena, ludus, campañas. Nunca «cazador» ni «mazmorras».',
  `El aviso «${AVISO_PUBLI}» se ve en el vídeo y va en el texto, al principio.`,
];

export const PROHIBIDO: readonly Prohibicion[] = [
  {
    id: 'precio_inventado',
    regla: 'Ni un precio que no sea el oficial de la tienda (o mejor, ninguno).',
    porque: 'Publicidad engañosa; y la tienda puede cambiar el precio por país.',
  },
  {
    id: 'gratis_para_siempre',
    regla: 'Nunca «gratis para siempre» ni «todo gratis».',
    porque: 'El coach es de pago: sería falso.',
  },
  {
    id: 'promesa_resultados',
    regla: 'Sin promesas de resultados: kilos, dinero, «garantizado», «en X días».',
    porque: 'Publicidad engañosa y, en salud, prohibida.',
  },
  {
    id: 'incentivo_valoracion',
    regla: 'Nunca pedir valoraciones, reseñas o descargas a cambio de algo (sorteos, premios, códigos).',
    porque: 'Apple 3.2.2 y 5.6.3, y la política de Google Play: retiran la app.',
  },
  {
    id: 'sin_publi',
    regla: `Todo contenido lleva «${AVISO_PUBLI}».`,
    porque: 'Es publicidad pagada por comisión: hay que identificarla.',
  },
];

export const KIT_CLIPS: KitClips = {
  ganchos: GANCHOS,
  guiones: GUIONES,
  marca: REGLAS_MARCA,
  aviso: AVISO_PUBLI,
  prohibido: PROHIBIDO,
};

// ── Revisar un guion ────────────────────────────────────────────────

/** Los precios oficiales (y su equivalente mensual) en céntimos. */
export function preciosOficialesCents(): Set<number> {
  const out = new Set<number>();
  for (const p of PRO_PLANS) {
    out.add(p.priceCents);
    const m = /(\d+),(\d{2})/.exec(p.perMonth);
    if (m) out.add(Number(m[1]) * 100 + Number(m[2]));
  }
  return out;
}

const RE_PRECIO = /(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|eur(?:o|os)?\b)|€\s*(\d{1,4}(?:[.,]\d{1,2})?)/gi;
const RE_GRATIS = /gratis\s+(?:para\s+)?siempre|siempre\s+gratis|todo\s+gratis|100\s*%\s*gratis/i;
const RE_PROMESA =
  /garantiz|resultados?\s+asegurad|te\s+(?:aseguro|prometo)|(?:pierde|pierdes|perder[áa]s?|bajar[áa]s?|bajas)\s+\d+\s*(?:kg|kilos)|(?:gana|ganar[áa]s?|ganas)\s+\d+\s*(?:€|euros|kg|kilos)|en\s+\d+\s+d[ií]as\s+(?:vas\s+a|ser[áa]s|tendr[áa]s|conseguir[áa]s)/i;
const RE_INCENTIVO =
  /(?:valora|valoraci[oó]n|rese[ñn]a|5\s*estrellas|cinco\s+estrellas|desc[aá]rga(?:la|te)?|instala(?:la)?)[^.!?\n]{0,60}(?:a\s+cambio|sorteo|premio|regalo|te\s+(?:doy|regalo)|gana|participa)|(?:sorteo|premio|regalo|a\s+cambio)[^.!?\n]{0,60}(?:valora|valoraci[oó]n|rese[ñn]a|estrellas|desc[aá]rga|instala)/i;

export interface Falta {
  id: Prohibicion['id'];
  detalle: string;
}

/**
 * Revisa el texto de un clip contra lo prohibido. Es una red, no un abogado:
 * atrapa lo evidente; la revisión final la hace una persona.
 */
export function revisarTexto(texto: string): { ok: boolean; faltas: Falta[] } {
  const t = texto ?? '';
  const faltas: Falta[] = [];
  if (!t.toLowerCase().includes(AVISO_PUBLI)) faltas.push({ id: 'sin_publi', detalle: `Falta «${AVISO_PUBLI}».` });
  const oficiales = preciosOficialesCents();
  for (const m of t.matchAll(RE_PRECIO)) {
    const raw = (m[1] ?? m[2] ?? '').replace(',', '.');
    const cents = Math.round(Number(raw) * 100);
    if (!oficiales.has(cents)) faltas.push({ id: 'precio_inventado', detalle: `Precio no oficial: «${m[0].trim()}».` });
  }
  if (RE_GRATIS.test(t)) faltas.push({ id: 'gratis_para_siempre', detalle: 'Promete gratis para siempre.' });
  if (RE_PROMESA.test(t)) faltas.push({ id: 'promesa_resultados', detalle: 'Promete resultados.' });
  if (RE_INCENTIVO.test(t)) faltas.push({ id: 'incentivo_valoracion', detalle: 'Pide valoraciones o descargas a cambio de algo.' });
  return { ok: faltas.length === 0, faltas };
}
