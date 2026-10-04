// NIVL · Cuándo (y cómo) se ofrece Pro o Élite. Decisión D1 de la fase 2
// (docs/payment-audit/FASE2-PLAN.md): la oferta llega en un momento de valor,
// nunca encima de una celebración, con topes y con la salida siempre a mano.
//
// Módulo PURO: sin imports de Supabase ni de AsyncStorage. Los efectos (leer y
// guardar el historial, leer el estado de la IA) están en `pro.ts`
// (`leerHistorialOfertas`, `anotarOferta`, `ofrecerSi`).
//
// Lo que este módulo garantiza (y prueba `__tests__/paywallmoment.test.ts`):
// - Nada durante una celebración (subida de nivel, día cerrado, logro).
// - Una hoja como mucho por día natural y dos por 7 días; 72 h sin hoja tras
//   un «Ahora no». La firma del onboarding, la primera vez, no gasta el tope.
// - «primer_dia» es hoja una sola vez en la vida.
// - Los momentos de función (modo profundo, voz, fotos) son una LÍNEA no
//   modal: la hoja solo se abre si el usuario la toca.
// - A Élite/dueño, nada. A un Pro, solo Élite y solo en momentos de función o
//   con la energía agotada (línea). En prueba, línea. Con la tienda cerrada,
//   línea salvo que la cuenta pueda empezar la prueba (es del servidor).
// - `prueba` solo si la cuenta puede empezarla.
// - En prueba no se vende lo que ya se tiene: ni la firma, ni el primer día,
//   ni las fotos, ni la voz. El momento de la prueba es su final
//   («fin_prueba»: una hoja, una vez, cuando la cuenta vuelve a gratis).
// - Lo gratuito nunca se bloquea: la decisión no tiene campo de «bloquear»;
//   solo dice si se ENSEÑA algo y de qué forma.

export type Momento =
  | 'firma'
  | 'primer_dia'
  | 'coach_profundo'
  | 'voz_premium'
  | 'analisis_foto'
  | 'energia_agotada'
  | 'coach_cerrado'
  | 'fin_prueba';

export const MOMENTOS: readonly Momento[] = [
  'firma',
  'primer_dia',
  'coach_profundo',
  'voz_premium',
  'analisis_foto',
  'energia_agotada',
  'coach_cerrado',
  'fin_prueba',
];

export function esMomento(v: unknown): v is Momento {
  return typeof v === 'string' && (MOMENTOS as readonly string[]).includes(v);
}

/** Momentos ligados a una función concreta: siempre línea, nunca modal. */
const MOMENTOS_FUNCION: readonly Momento[] = ['coach_profundo', 'voz_premium', 'analisis_foto'];

export type RespuestaOferta = 'cerrada' | 'compra' | 'prueba' | 'vista';
export type FormaOferta = 'hoja' | 'linea';
export type TierOferta = 'pro' | 'elite';

export interface EntradaOferta {
  momento: Momento;
  /** Epoch en ms. */
  at: number;
  respuesta: RespuestaOferta;
  /** Sin campo = hoja (lo conservador: cuenta contra los topes). */
  forma?: FormaOferta;
}

export interface ContextoOferta {
  tier: 'free' | 'pro' | 'elite' | 'owner';
  entitled: boolean;
  trial: boolean;
  trialAvailable: boolean;
  /** `purchasesAvailable()`: hay tienda en esta build. */
  tiendaAbierta: boolean;
  /** Hay una celebración en pantalla (Ceremonia de nivel, día cerrado…). */
  celebrando: boolean;
  /** Ahora, en ms. */
  ahora: number;
  historial: readonly EntradaOferta[];
  /**
   * ¿Puede mejorar en la tienda una cuenta que ya paga? (`puedeMejorarEnTienda`:
   * no a quien paga por Stripe o con plan heredado). Por defecto, sí.
   */
  mejorable?: boolean;
  /**
   * La cuenta tuvo la prueba de 7 días (o una cortesía) y ya acabó. Si no se
   * pasa, se deduce del historial: una respuesta «prueba» en los últimos 30
   * días y la cuenta de nuevo en gratis.
   */
  pruebaTerminada?: boolean;
}

export type CopyKey = `${Momento}.${TierOferta}`;

export interface DecisionOferta {
  mostrar: boolean;
  forma: FormaOferta;
  tier: TierOferta;
  prueba: boolean;
  copyKey: CopyKey;
  /** Por qué (para pruebas y depuración; no se enseña). */
  razon: string;
}

export const HORA = 60 * 60 * 1000;
export const DIA = 24 * HORA;
/** Horas sin hoja tras un «Ahora no». */
export const ESPERA_TRAS_CERRAR = 72 * HORA;
export const MAX_HOJAS_DIA = 1;
export const MAX_HOJAS_SEMANA = 2;
/** El historial se guarda 30 días; más allá ninguna regla lo mira. */
export const RETENCION = 30 * DIA;
/** Tope de entradas guardadas, por si algo se desboca. */
export const MAX_ENTRADAS = 60;

/** Clave del día natural LOCAL ("2026-10-02"). */
export function diaNatural(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dd}`;
}

const esHoja = (e: EntradaOferta) => (e.forma ?? 'hoja') === 'hoja';

/** El nivel que paga hoy la cuenta, a efectos de la oferta. */
function nivelEfectivo(ctx: ContextoOferta): 'free' | 'trial' | 'pro' | 'top' {
  if (ctx.entitled && (ctx.tier === 'elite' || ctx.tier === 'owner')) return 'top';
  if (ctx.entitled && ctx.trial) return 'trial';
  if (ctx.entitled) return 'pro';
  return 'free';
}

/** Qué nivel se ofrece en cada momento a quien aún no paga. */
const TIER_SIN_PAGO: Record<Momento, TierOferta> = {
  firma: 'pro',
  primer_dia: 'pro',
  // El modo profundo es solo Élite.
  coach_profundo: 'elite',
  // La voz (en el dispositivo, coste 0) va con el coach: se ofrece Pro y a
  // quien ya tiene coach no se le vende nada por ella.
  voz_premium: 'pro',
  // Las fotos al coach solo las ve Élite (Pro y la prueba, sin visión).
  analisis_foto: 'elite',
  energia_agotada: 'pro',
  // La pantalla del coach sin acceso: lo que antes era «Ver NIVL Pro».
  coach_cerrado: 'pro',
  // Acabó la prueba (que es de Pro): se ofrece lo que se probó.
  fin_prueba: 'pro',
};

/** En prueba ya se tiene el coach: estos momentos no venden nada. */
const INCLUIDO_EN_PRUEBA: readonly Momento[] = ['firma', 'primer_dia', 'voz_premium'];

function decision(momento: Momento, tier: TierOferta, d: Partial<DecisionOferta> & { razon: string }): DecisionOferta {
  return {
    mostrar: false,
    forma: 'linea',
    prueba: false,
    ...d,
    tier,
    copyKey: `${momento}.${tier}`,
  };
}

/** ¿Cabe una hoja más ahora? Devuelve el motivo si no. */
export function bloqueoDeHoja(historial: readonly EntradaOferta[], ahora: number): string | null {
  const hojas = historial.filter((e) => esHoja(e) && e.at <= ahora);
  const hoy = diaNatural(ahora);
  // Una misma hoja deja una entrada (`anotarEn` funde «vista» con la respuesta).
  if (hojas.filter((e) => diaNatural(e.at) === hoy).length >= MAX_HOJAS_DIA) return 'tope_dia';
  if (hojas.filter((e) => ahora - e.at < 7 * DIA).length >= MAX_HOJAS_SEMANA) return 'tope_semana';
  const cerrada = historial.some((e) => e.respuesta === 'cerrada' && e.at <= ahora && ahora - e.at < ESPERA_TRAS_CERRAR);
  if (cerrada) return 'espera_72h';
  return null;
}

/**
 * La decisión. Pura: mismo contexto, misma respuesta. No bloquea nada: solo
 * dice si se enseña una oferta y de qué forma.
 */
export function decidirOferta(momento: Momento, ctx: ContextoOferta): DecisionOferta {
  const nivel = nivelEfectivo(ctx);
  const historial = recortarHistorial(ctx.historial, ctx.ahora);

  if (ctx.celebrando) return decision(momento, TIER_SIN_PAGO[momento], { razon: 'celebrando' });
  if (nivel === 'top') return decision(momento, 'elite', { razon: 'ya_elite' });

  // Coach cerrado: solo existe para quien no tiene coach. Es la propia pantalla
  // que el usuario ha abierto, así que no gasta topes ni respeta la espera de
  // 72 h: es una línea fija con la salida a mano, no una interrupción.
  if (momento === 'coach_cerrado') {
    if (nivel !== 'free') return decision(momento, 'pro', { razon: 'tiene_coach' });
    return decision(momento, 'pro', { mostrar: true, forma: 'linea', prueba: ctx.trialAvailable, razon: 'coach_cerrado' });
  }

  if (nivel === 'pro') {
    if (ctx.mejorable === false) return decision(momento, 'elite', { razon: 'no_mejorable' });
    // La voz va con el coach: a quien ya lo tiene no se le vende por ella.
    if (momento === 'voz_premium') return decision(momento, 'elite', { razon: 'voz_incluida' });
    const funcion = MOMENTOS_FUNCION.includes(momento) || momento === 'energia_agotada';
    if (!funcion) return decision(momento, 'elite', { razon: 'pro_sin_momento' });
    return decision(momento, 'elite', { mostrar: true, forma: 'linea', razon: 'pro_a_elite' });
  }

  const tier = TIER_SIN_PAGO[momento];
  if (nivel === 'trial' && (INCLUIDO_EN_PRUEBA.includes(momento) || momento === 'fin_prueba')) {
    return decision(momento, tier, { razon: 'en_prueba' });
  }

  // Fin de la prueba: una hoja una vez en la vida, cuando la cuenta vuelve a
  // gratis. Respeta los topes y la espera de 72 h; con la tienda cerrada, línea.
  if (momento === 'fin_prueba') {
    const terminada =
      nivel === 'free' && !ctx.trialAvailable && (ctx.pruebaTerminada ?? historial.some((e) => e.respuesta === 'prueba'));
    if (!terminada) return decision(momento, tier, { razon: 'sin_prueba' });
    if (!ctx.tiendaAbierta) return decision(momento, tier, { mostrar: true, forma: 'linea', razon: 'tienda_cerrada' });
    if (historial.some((e) => e.momento === 'fin_prueba' && esHoja(e))) return decision(momento, tier, { razon: 'fin_prueba_ya_visto' });
    const bloqueo = bloqueoDeHoja(historial, ctx.ahora);
    if (bloqueo) return decision(momento, tier, { mostrar: true, forma: 'linea', razon: bloqueo });
    return decision(momento, tier, { mostrar: true, forma: 'hoja', razon: 'fin_prueba' });
  }

  // Sin coach no hay energía que agotar.
  if (momento === 'energia_agotada' && nivel === 'free') return decision(momento, tier, { razon: 'sin_energia' });

  const prueba = tier === 'pro' && ctx.trialAvailable && nivel === 'free';

  if (MOMENTOS_FUNCION.includes(momento)) {
    return decision(momento, tier, { mostrar: true, forma: 'linea', prueba, razon: 'funcion' });
  }
  // Primer día (decisión del coordinador, fase 3): LÍNEA no modal tras la
  // celebración, nunca hoja (no se vende en plena euforia). Una vez en la vida:
  // `ofrecerSi` la anota como vista. Respeta la espera de 72 h tras un «no».
  if (momento === 'primer_dia') {
    if (historial.some((e) => e.momento === 'primer_dia')) return decision(momento, tier, { razon: 'primer_dia_ya_visto' });
    const cerradaHace = historial.some(
      (e) => e.respuesta === 'cerrada' && e.at <= ctx.ahora && ctx.ahora - e.at < ESPERA_TRAS_CERRAR,
    );
    if (cerradaHace) return decision(momento, tier, { razon: 'espera_72h' });
    return decision(momento, tier, { mostrar: true, forma: 'linea', prueba, razon: 'primer_dia' });
  }

  if (nivel === 'trial') return decision(momento, tier, { mostrar: true, forma: 'linea', razon: 'en_prueba' });
  // Con la tienda cerrada no hay nada que comprar, pero la prueba es del
  // servidor y sí se puede empezar: con prueba, la hoja sigue (con sus topes);
  // sin ella, línea.
  if (!ctx.tiendaAbierta && !prueba) return decision(momento, tier, { mostrar: true, forma: 'linea', razon: 'tienda_cerrada' });

  const primeraFirma = momento === 'firma' && !historial.some((e) => e.momento === 'firma');
  if (!primeraFirma) {
    const bloqueo = bloqueoDeHoja(historial, ctx.ahora);
    // Bloqueada la hoja: la firma baja a línea; el primer día se calla.
    if (bloqueo) {
      if (momento === 'firma') return decision(momento, tier, { mostrar: true, forma: 'linea', prueba, razon: bloqueo });
      return decision(momento, tier, { razon: bloqueo });
    }
  }
  return decision(momento, tier, { mostrar: true, forma: 'hoja', prueba, razon: primeraFirma ? 'primera_firma' : 'hoja' });
}

// ── El historial (puro) ────────────────────────────────────────────

const RESPUESTAS: readonly RespuestaOferta[] = ['cerrada', 'compra', 'prueba', 'vista'];

function entradaValida(v: unknown): EntradaOferta | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!esMomento(o.momento)) return null;
  if (typeof o.at !== 'number' || !Number.isFinite(o.at) || o.at <= 0) return null;
  if (typeof o.respuesta !== 'string' || !(RESPUESTAS as readonly string[]).includes(o.respuesta)) return null;
  const forma = o.forma === 'linea' || o.forma === 'hoja' ? o.forma : undefined;
  return { momento: o.momento, at: o.at, respuesta: o.respuesta as RespuestaOferta, ...(forma ? { forma } : {}) };
}

/**
 * Solo entradas válidas, de los últimos 30 días, en orden y con tope. Las del
 * futuro (reloj cambiado) se conservan: cuentan contra los topes, que es lo
 * prudente.
 */
export function recortarHistorial(historial: readonly unknown[] | null | undefined, ahora: number): EntradaOferta[] {
  if (!Array.isArray(historial)) return [];
  return historial
    .map(entradaValida)
    .filter((e): e is EntradaOferta => e !== null && ahora - e.at <= RETENCION)
    .sort((a, b) => a.at - b.at)
    .slice(-MAX_ENTRADAS);
}

/** Lee lo guardado. JSON roto o con otra forma = historial vacío, nunca un fallo. */
export function parsearHistorial(raw: string | null | undefined, ahora: number): EntradaOferta[] {
  if (!raw) return [];
  try {
    return recortarHistorial(JSON.parse(raw) as unknown[], ahora);
  } catch {
    return [];
  }
}

/** Ventana en la que una respuesta sustituye a la «vista» de la misma hoja. */
const FUSION = HORA;

/**
 * Añade una entrada. Si la última es la «vista» del mismo momento de hace
 * menos de una hora, la respuesta la SUSTITUYE conservando su instante y su
 * forma (sigue siendo una sola hoja a efectos de los topes, y la pantalla que
 * responde no necesita saber si se abrió como hoja o desde una línea). Sin
 * «vista» previa, la forma es la indicada (por defecto, hoja).
 */
export function anotarEn(
  historial: readonly EntradaOferta[],
  entrada: { momento: Momento; respuesta: RespuestaOferta; forma?: FormaOferta },
  ahora: number,
): EntradaOferta[] {
  const base = recortarHistorial(historial, ahora);
  const ultima = base[base.length - 1];
  if (
    ultima &&
    ultima.respuesta === 'vista' &&
    ultima.momento === entrada.momento &&
    ahora >= ultima.at &&
    ahora - ultima.at < FUSION
  ) {
    const fundida: EntradaOferta = { momento: ultima.momento, at: ultima.at, respuesta: entrada.respuesta, forma: ultima.forma ?? 'hoja' };
    return [...base.slice(0, -1), fundida];
  }
  const nueva: EntradaOferta = { momento: entrada.momento, at: ahora, respuesta: entrada.respuesta, forma: entrada.forma ?? 'hoja' };
  return recortarHistorial([...base, nueva], ahora);
}

/** El enlace a la oferta completa desde una línea: `/pro?motivo=…&tier=…`. */
export function rutaOferta(momento: Momento, tier: TierOferta): `/pro?motivo=${string}` {
  return `/pro?motivo=${momento}&tier=${tier}`;
}
