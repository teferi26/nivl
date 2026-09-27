// NIVL · NIVL Pro y Élite: la oferta, en datos.
//
// Tres niveles (docs/PRECIOS.md): gratis es la app entera sin IA; Pro es el
// coach en potencia estándar; Élite, el coach a máxima potencia con modo
// profundo. Aquí vive lo que la pantalla de Pro y el paso del onboarding
// necesitan pintar: planes, precios, lo que hace el coach y la línea de
// énfasis por perfil. Si cambias un precio, rehaz antes la cuenta de
// docs/PRECIOS.md.
//
// Módulo PURO: sin imports de Supabase, para que los tests arranquen. Los
// efectos (leer el estado de la IA, la prueba, comprar, restaurar) están en
// `pro.ts`.

import { kindMeta, type ProfileKind } from './kinds';

/**
 * Los valores de `subscriptions.plan` (0024). 'mensual' y 'anual' son los
 * heredados de Stripe y cuentan como Pro; 'cortesia' es la prueba de 7 días
 * y las cortesías de la 0020.
 */
export type PlanKey =
  | 'mensual'
  | 'anual'
  | 'pro_mensual'
  | 'pro_anual'
  | 'elite_mensual'
  | 'elite_anual'
  | 'elite_fundador'
  | 'cortesia'
  | 'owner';

/** El nivel de la cuenta según el servidor (`ai_plans.tier`, 0024). */
export type Tier = 'free' | 'pro' | 'elite' | 'owner';

/** Lo que devuelve la RPC `ai_status()` (0020 + 0024). Importes en micro-USD. */
export interface AiStatus {
  entitled: boolean;
  /** Un plan que esta versión de la app no conoce llega tal cual: `planLabel` lo cubre. */
  plan: PlanKey | null;
  tier: Tier;
  /** Presupuesto, gasto y resto del bolsillo ESTÁNDAR del mes. */
  budget: number;
  spent: number;
  remaining: number;
  /** Día en que se recarga el presupuesto (YYYY-MM-DD). Solo con derecho a IA. */
  renews?: string;
  /** La cuenta está en la prueba de 7 días. */
  trial: boolean;
  /** El plan incluye modo profundo (Élite y owner). */
  deepAllowed: boolean;
  /** Lo que queda en el bolsillo profundo, en micro-USD. */
  deepRemaining: number;
  /** Turnos profundos que quedan este mes, estimados con la media real de la cuenta. */
  deepTurns: number;
  /** Nunca tuvo suscripción ni prueba: puede empezar la de 7 días. */
  trialAvailable: boolean;
}

/** Una cuenta sin nada: lo que se pinta cuando el servidor dice que no hay IA. */
export const SIN_IA: AiStatus = {
  entitled: false,
  plan: null,
  tier: 'free',
  budget: 0,
  spent: 0,
  remaining: 0,
  trial: false,
  deepAllowed: false,
  deepRemaining: 0,
  deepTurns: 0,
  trialAvailable: false,
};

/** Tiene coach: suscripción viva, prueba, cortesía o dueño. Lo decide el servidor. */
export function isPro(status: AiStatus | null | undefined): boolean {
  return !!status?.entitled;
}

/** Tiene el coach a máxima potencia (Élite). El owner no cuenta como Élite en pantalla. */
export function isElite(status: AiStatus | null | undefined): boolean {
  return isPro(status) && status?.tier === 'elite';
}

/** Por debajo de 2 céntimos el candado no deja entrar (ai_begin_turn). */
const UMBRAL_TURNO = 20000;

/** ¿Puede pedir AHORA un turno profundo? Lo decide el bolsillo, no los turnos redondeados. */
export function puedeProfundo(status: AiStatus | null | undefined): boolean {
  return isPro(status) && !!status?.deepAllowed && (status?.deepRemaining ?? 0) >= UMBRAL_TURNO;
}

/** Turnos profundos que quedan este mes (0 si el plan no los incluye). */
export function turnosProfundos(status: AiStatus | null | undefined): number {
  if (!isPro(status) || !status?.deepAllowed) return 0;
  return Math.max(0, Math.floor(status.deepTurns || 0));
}

/** La línea bajo el selector de potencia, en la voz del sistema. */
export function lineaProfundos(status: AiStatus | null | undefined): string {
  if (!puedeProfundo(status)) return 'Has usado tus turnos profundos de este mes. El estándar sigue disponible.';
  const n = turnosProfundos(status);
  if (n === 0) return 'Te queda menos de un turno profundo este mes.';
  if (n === 1) return 'Te queda 1 turno profundo este mes.';
  return `Te quedan ${n} turnos profundos este mes.`;
}

/**
 * Energía del coach que queda este mes, de 0 a 1. Se enseña SIEMPRE como
 * porcentaje: el usuario no tiene por qué saber que por debajo hay dólares.
 */
export function energiaRestante(status: AiStatus | null | undefined): number {
  if (!status?.entitled || status.budget <= 0) return 0;
  return Math.min(1, Math.max(0, status.remaining / status.budget));
}

/** El candado corta por debajo de 2 céntimos (ai_begin_turn): a efectos de pantalla, agotada. */
export function energiaAgotada(status: AiStatus | null | undefined): boolean {
  return isPro(status) && (status?.remaining ?? 0) < UMBRAL_TURNO;
}

const PLAN_LABEL: Record<PlanKey, string> = {
  mensual: 'Pro mensual',
  anual: 'Pro anual',
  pro_mensual: 'Pro mensual',
  pro_anual: 'Pro anual',
  elite_mensual: 'Élite mensual',
  elite_anual: 'Élite anual',
  elite_fundador: 'Élite fundador',
  cortesia: 'Cortesía',
  // No "Fundador": chocaría con el Élite fundador.
  owner: 'Dueño',
};

/**
 * Nombre del plan. Con valor por defecto: una app vieja que recibe un plan que
 * aún no conoce (servidor más nuevo) enseña "NIVL Pro", nunca `undefined`.
 */
export function planLabel(plan: string | null | undefined): string {
  if (!plan) return 'Gratis';
  return (PLAN_LABEL as Record<string, string>)[plan] ?? 'NIVL Pro';
}

/** Un plan que se cobra (y se gestiona en la tienda): ni cortesía ni dueño. */
export function planDePago(plan: string | null | undefined): boolean {
  return !!plan && plan !== 'cortesia' && plan !== 'owner' && plan in PLAN_LABEL;
}

// Los identificadores son los de los productos de tienda (App Store Connect y
// Play Console) y los de RevenueCat. Aún no existen: hay que crearlos con
// exactamente estos ids, en un solo grupo de suscripción (Élite por encima).
export type ProPlanId =
  | 'nivl_pro_mensual'
  | 'nivl_pro_anual'
  | 'nivl_elite_mensual'
  | 'nivl_elite_anual'
  | 'nivl_elite_fundador';

/** Los dos niveles que se venden. */
export type OfferTier = 'pro' | 'elite';

export interface ProPlan {
  id: ProPlanId;
  tier: OfferTier;
  /** El valor que acabará en `subscriptions.plan`. */
  plan: PlanKey;
  label: string;
  priceCents: number;
  /** Precio tal y como se enseña: "99,99 €". */
  price: string;
  period: 'mes' | 'año';
  months: number;
  /** Equivalente mensual ya formateado: "8,33 €". */
  perMonth: string;
  /** Ahorro frente a pagar mes a mes de ese nivel ("−36 %"), o null si no lo hay. */
  savings: string | null;
  /** Rótulo bajo el precio. */
  pitch: string;
}

const PRO_MENSUAL_CENTS = 1299;
const PRO_ANUAL_CENTS = 9999;
const ELITE_MENSUAL_CENTS = 2999;
const ELITE_ANUAL_CENTS = 29900;
const ELITE_FUNDADOR_CENTS = 24900;
/** Plazas del Élite fundador (precio congelado). El cupo lo cierra el dueño en la tienda. */
export const PLAZAS_FUNDADOR = 100;

/** "8,33 €": coma decimal y el símbolo detrás, como se escribe en España. */
export function euros(cents: number): string {
  return `${(Math.round(cents) / 100).toFixed(2).replace('.', ',')} €`;
}

function ahorro(anualCents: number, mensualCents: number): number {
  return Math.round((1 - anualCents / (mensualCents * 12)) * 100);
}

function mesesGratis(anualCents: number, mensualCents: number): number {
  return Math.round(12 - anualCents / mensualCents);
}

function anual(id: ProPlanId, tier: OfferTier, plan: PlanKey, label: string, cents: number, mensualCents: number, pitch?: string): ProPlan {
  return {
    id,
    tier,
    plan,
    label,
    priceCents: cents,
    price: euros(cents),
    period: 'año',
    months: 12,
    perMonth: euros(cents / 12),
    savings: `−${ahorro(cents, mensualCents)} %`,
    pitch: pitch ?? `${mesesGratis(cents, mensualCents)} meses gratis · ${euros(cents / 12)}/mes`,
  };
}

function mensual(id: ProPlanId, tier: OfferTier, plan: PlanKey, cents: number): ProPlan {
  return {
    id,
    tier,
    plan,
    label: 'Mensual',
    priceCents: cents,
    price: euros(cents),
    period: 'mes',
    months: 1,
    perMonth: euros(cents),
    savings: null,
    pitch: 'Sin permanencia',
  };
}

export interface TierOffer {
  id: OfferTier;
  /** "NIVL Pro" / "NIVL Élite". */
  name: string;
  /** Lo corto del selector: "Pro" / "Élite". */
  label: string;
  /** La potencia del coach en una línea. */
  power: string;
  /** Planes en el orden en que se enseñan (el preseleccionado primero). */
  plans: readonly ProPlan[];
  defaultPlan: ProPlanId;
}

export const TIERS: readonly TierOffer[] = [
  {
    id: 'pro',
    name: 'NIVL Pro',
    label: 'Pro',
    power: 'El coach en potencia estándar.',
    plans: [
      anual('nivl_pro_anual', 'pro', 'pro_anual', 'Anual', PRO_ANUAL_CENTS, PRO_MENSUAL_CENTS),
      mensual('nivl_pro_mensual', 'pro', 'pro_mensual', PRO_MENSUAL_CENTS),
    ],
    defaultPlan: 'nivl_pro_anual',
  },
  {
    id: 'elite',
    name: 'NIVL Élite',
    label: 'Élite',
    power: 'El coach a máxima potencia, con modo profundo.',
    plans: [
      anual(
        'nivl_elite_fundador',
        'elite',
        'elite_fundador',
        'Fundador',
        ELITE_FUNDADOR_CENTS,
        ELITE_MENSUAL_CENTS,
        `${PLAZAS_FUNDADOR} plazas · precio congelado · ${euros(ELITE_FUNDADOR_CENTS / 12)}/mes`,
      ),
      anual('nivl_elite_anual', 'elite', 'elite_anual', 'Anual', ELITE_ANUAL_CENTS, ELITE_MENSUAL_CENTS),
      mensual('nivl_elite_mensual', 'elite', 'elite_mensual', ELITE_MENSUAL_CENTS),
    ],
    defaultPlan: 'nivl_elite_fundador',
  },
];

/** Todos los planes a la venta, de todos los niveles. */
export const PRO_PLANS: readonly ProPlan[] = TIERS.flatMap((t) => t.plans);

/** El nivel que se enseña primero en la oferta. */
export const DEFAULT_TIER: OfferTier = 'pro';
/** El anual de Pro va preseleccionado: es el que más le conviene a quien va en serio. */
export const DEFAULT_PLAN: ProPlanId = 'nivl_pro_anual';

export function tierOffer(id: OfferTier): TierOffer {
  return TIERS.find((t) => t.id === id) ?? TIERS[0]!;
}

export function proPlan(id: ProPlanId): ProPlan {
  return PRO_PLANS.find((p) => p.id === id) ?? PRO_PLANS[0]!;
}

export interface ProBenefit {
  /** Nombre de Ionicons. */
  icon: string;
  title: string;
  detail: string;
}

// Lo que el coach hace, tal cual. Nada de cifras inventadas ni de promesas de
// resultado: cada línea es una función que existe en `supabase/functions/coach`.
export const PRO_BENEFITS: readonly ProBenefit[] = [
  { icon: 'sunny-outline', title: 'Brief cada mañana', detail: 'Órdenes y números antes de que empiece el día.' },
  { icon: 'list-outline', title: 'Plan del día, bloque a bloque', detail: 'Tu jornada ordenada por horas, con lo que toca en cada una.' },
  { icon: 'barbell-outline', title: 'Entreno prescrito', detail: 'Ejercicios, series y cargas según el RPE que registras.' },
  { icon: 'restaurant-outline', title: 'Dieta en gramos', detail: 'Ajustada a tu peso real y a su tendencia, no a una tabla.' },
  { icon: 'analytics-outline', title: 'Revisión semanal', detail: 'Mide la semana con tus datos y reajusta tu sistema.' },
  { icon: 'library-outline', title: 'Memoria', detail: 'Recuerda lo que aprende de ti. Te conoce más cada semana.' },
  { icon: 'chatbubble-ellipses-outline', title: 'Control total por chat', detail: 'Díselo y lo hace: misiones, agenda, normas, metas.' },
];

// Lo que el Élite añade. SOLO lo que ya existe (Apple 3.1.2). Desde la fase 3
// (0026): el ludus, la insignia y la revisión semanal con el modelo top a
// máximo esfuerzo (`revision_semanal` va a 'xhigh' en la función coach). Los
// retos trimestrales y el acceso anticipado, cuando tengan contenido.
export const ELITE_BENEFITS: readonly ProBenefit[] = [
  { icon: 'flash-outline', title: 'Máxima potencia', detail: 'Un modelo de primera línea en cada brief, plan, revisión y conversación.' },
  { icon: 'telescope-outline', title: 'Modo profundo', detail: 'Para lo que pide pensarlo a fondo: el coach se toma su tiempo y responde con más detalle.' },
  { icon: 'analytics-outline', title: 'Revisión semanal a fondo', detail: 'Tu semana medida por el modelo de primera línea, pensando al máximo.' },
  { icon: 'shield-outline', title: 'Tu ludus', detail: 'De 5 a 8 gladiadores Élite con tu mismo objetivo y un marcador propio.' },
  { icon: 'ribbon-outline', title: 'Insignia de laurel', detail: 'El laurel dorado junto a tu nombre. Estatus, no puntos: no cambia ningún ranking.' },
];

const PRO_EMPHASIS: Record<ProfileKind, string> = {
  emprendedor: 'Para un emprendedor: el brief abre con tus cifras de embudo y la acción que mueve la caja hoy.',
  trabajador: 'Para un profesional: la jornada protegida en bloques de foco, y el cuerpo y los hábitos en orden alrededor de ella.',
  deportista: 'Para un deportista: cargas prescritas con tu RPE y dieta corregida con tu tendencia de peso, semana a semana.',
  estudiante: 'Para un estudiante: el estudio repartido en bloques con materia concreta y cada examen tratado como jefe final.',
  general: 'Para ti: dile qué quieres conquistar y lo convierte en misiones, plan del día y seguimiento.',
};

/** Una línea de énfasis según el perfil; un valor desconocido cae en general. */
export function proEmphasis(kind: unknown): string {
  return PRO_EMPHASIS[kindMeta(kind).id];
}

// Lo que el coach estaría haciendo HOY por alguien que aún no lo tiene. Es la
// pestaña Coach de una cuenta gratuita: enseña el hueco, no un error.
const PRO_TODAY: Record<ProfileKind, readonly string[]> = {
  emprendedor: [
    'Abrir tu mañana con las cifras del negocio y una orden concreta.',
    'Repartir el día en bloques: prospección, trabajo profundo, cierre.',
    'Pedirte cuentas esta noche de contactos, reuniones e ingresos.',
  ],
  trabajador: [
    'Abrir tu mañana con lo único que tiene que salir hoy en el trabajo.',
    'Encajar entreno, comida y descanso alrededor de tu jornada.',
    'Pedirte cuentas esta noche y ajustar el plan de mañana.',
  ],
  deportista: [
    'Prescribir la sesión de hoy con cargas calculadas sobre tu último RPE.',
    'Fijar tus calorías y tu proteína según tu tendencia de peso.',
    'Revisar esta noche lo registrado y corregir la semana.',
  ],
  estudiante: [
    'Repartir el estudio de hoy en bloques con materia concreta.',
    'Contar los días que quedan para cada examen y priorizar.',
    'Pedirte cuentas esta noche de las horas reales de estudio.',
  ],
  general: [
    'Abrir tu mañana con órdenes claras y números.',
    'Escribir el plan del día, bloque a bloque.',
    'Pedirte cuentas esta noche y recordar lo que aprende de ti.',
  ],
};

export function proToday(kind: unknown): readonly string[] {
  return PRO_TODAY[kindMeta(kind).id];
}

// Un brief de MUESTRA por perfil: cuatro líneas con la forma y el tono de los
// que escribe el coach, con cifras concretas para que se entienda qué se
// compra. Es un ejemplo inventado y la pantalla lo rotula como tal ("Ejemplo"):
// no son datos del usuario ni una promesa de resultado.
const PRO_SAMPLE_BRIEF: Record<ProfileKind, readonly string[]> = {
  emprendedor: [
    'Ayer: 6 contactos de 10 y ninguna reunión cerrada. La caja no se mueve sola.',
    '09:00–10:30 · Prospección: 10 contactos antes de abrir el correo.',
    '11:00–13:00 · Trabajo profundo: la propuesta de 1.800 € sale hoy.',
    'Esta noche te pido dos cifras: contactos hechos y reuniones agendadas.',
  ],
  trabajador: [
    'Ayer cerraste 4 de 5 misiones. Falló el entreno: hoy va antes de la jornada.',
    '07:15–08:00 · Fuerza, 45 min. Sin móvil hasta terminar.',
    '09:30–11:30 · Bloque de foco: el informe trimestral, y solo eso.',
    'Cena antes de las 21:30 y pantalla fuera a las 23:00. Mañana lo compruebo.',
  ],
  deportista: [
    'Peso medio de la semana: 78,4 kg (−0,3). El ritmo es bueno: no se toca la dieta.',
    'Hoy, empuje: press banca 4×6 con 72,5 kg. El martes marcaste RPE 7: subes 2,5 kg.',
    'Objetivo del día: 2.450 kcal y 165 g de proteína. Llevas tres días por debajo.',
    'Esta noche reviso la sesión. Si las series salen a RPE 9, la semana que viene se descarga.',
  ],
  estudiante: [
    'Quedan 12 días para Estadística y llevas 5 de 9 temas. Hoy caen dos.',
    '09:00–10:30 · Tema 6: contrastes de hipótesis. Sin apuntes delante al final.',
    '16:00–17:30 · 20 problemas del tema 5. Se corrigen hoy, no mañana.',
    'Ayer estudiaste 2 h 10 min de las 4 previstas. Esta noche te pido la cifra real.',
  ],
  general: [
    'Ayer: 5 de 6 misiones y la racha en 9. Hoy no se rompe.',
    '07:30 · Arriba. 20 min de movimiento antes del primer café.',
    '18:00–19:00 · Lo que llevas tres días aplazando. Hoy se cierra.',
    'A las 22:30 te pido cuentas. Lo pendiente a medianoche se penaliza.',
  ],
};

/** Brief de ejemplo para el perfil; un valor desconocido cae en general. */
export function proSampleBrief(kind: unknown): readonly string[] {
  return PRO_SAMPLE_BRIEF[kindMeta(kind).id];
}

export const LEGAL_URLS = {
  terminos: 'https://nivl-web.vercel.app/terminos',
  privacidad: 'https://nivl-web.vercel.app/privacidad',
} as const;

/**
 * La letra pequeña que exigen las tiendas para una suscripción autorrenovable.
 * `precio` es el que da la tienda (`priceString`, ya en la moneda y el formato
 * del comprador); sin él, el de la tabla.
 */
export function legalText(id: ProPlanId, precio?: string | null): string {
  const p = proPlan(id);
  const nivel = tierOffer(p.tier).name;
  const cuando = p.period === 'mes' ? 'cada mes' : 'cada año';
  const congelado = p.id === 'nivl_elite_fundador' ? ' El precio de fundador se mantiene mientras no la canceles.' : '';
  return (
    `${nivel} ${p.label.toLowerCase()} es una suscripción de renovación automática: ${precio?.trim() || p.price} ${cuando}.${congelado} ` +
    'El cobro se hace en tu cuenta de la tienda al confirmar la compra y se renueva sola salvo que la canceles ' +
    'al menos 24 horas antes de que acabe el periodo. La gestionas y la cancelas cuando quieras en los ajustes ' +
    'de suscripciones de la App Store o de Google Play. Sin ella, NIVL sigue entera y gratis, sin el coach.'
  );
}

// ── La tienda abierta (fase 4) ──────────────────────────────────────

/**
 * El id de producto sin la parte de Google Play: allí una suscripción llega
 * como "nivl_pro_anual:base-plan". En App Store ya viene limpio.
 */
export function productoBase(identifier: string | null | undefined): string {
  return (identifier ?? '').split(':')[0]!.trim();
}

/** ¿Es uno de los cinco productos que vendemos? */
export function esProductoNivl(identifier: string | null | undefined): identifier is ProPlanId {
  const id = productoBase(identifier);
  return PRO_PLANS.some((p) => p.id === id);
}

/**
 * Los planes de un nivel que se pueden elegir. El Élite fundador sale solo
 * mientras quedan plazas (`founder_seats_left()`, 0027); con `null` (no se
 * sabe: sin red o servidor viejo) se enseña y decide la tienda.
 */
export function planesALaVenta(tier: OfferTier, plazasFundador: number | null): readonly ProPlan[] {
  const planes = tierOffer(tier).plans;
  if (plazasFundador === null || plazasFundador > 0) return planes;
  return planes.filter((p) => p.id !== 'nivl_elite_fundador');
}

/** El plan preseleccionado de un nivel: su favorito si está a la venta, si no el primero que quede. */
export function planPorDefecto(tier: OfferTier, plazasFundador: number | null): ProPlanId {
  const planes = planesALaVenta(tier, plazasFundador);
  const fav = tierOffer(tier).defaultPlan;
  return planes.some((p) => p.id === fav) ? fav : (planes[0]?.id ?? fav);
}

/**
 * El precio que se enseña: el de la tienda si lo hay (es el que se cobra), si
 * no el de la tabla.
 */
export function precioVisible(p: ProPlan, precioTienda?: string | null): string {
  return precioTienda?.trim() || p.price;
}

/**
 * El rótulo bajo el precio. Lleva cifras en euros ("8,33 €/mes"): si la
 * tienda cobra en otra moneda o a otro precio, esas cifras mentirían, así que
 * se cambian por una línea sin importes.
 */
export function pitchVisible(p: ProPlan, precioTienda?: string | null): string {
  if (precioVisible(p, precioTienda) === p.price) return p.pitch;
  if (p.id === 'nivl_elite_fundador') return `${PLAZAS_FUNDADOR} plazas · precio congelado`;
  return p.period === 'año' ? 'Un solo pago al año' : 'Sin permanencia';
}

/**
 * ¿El estado del servidor ya refleja la compra de `id`? El webhook de
 * RevenueCat tarda unos segundos: hasta entonces la app espera. Una compra de
 * Élite no está reflejada con un Pro; una de Pro, con cualquier derecho de
 * pago (un Élite que compra Pro sigue siendo Élite hasta que cambie).
 */
export function compraReflejada(status: AiStatus | null | undefined, id: ProPlanId): boolean {
  if (!isPro(status) || status?.trial) return false;
  const quiere = proPlan(id).tier;
  if (quiere === 'elite') return status?.tier === 'elite' || status?.tier === 'owner';
  return planDePago(status?.plan) || status?.tier === 'owner';
}
