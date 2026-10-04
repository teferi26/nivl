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
import type { CopyKey, Momento, TierOferta } from './paywallmoment';

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
  /**
   * El coach de este plan ve fotos (modelo Claude). Lo dice el servidor
   * (`ai_status.vision`); null si el servidor aún no lo manda (sin la
   * migración): quien pinta decide por el nivel. Pro (DeepSeek) y la prueba no.
   */
  vision: boolean | null;
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
  vision: null,
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

export const COACH_USAGE_NOTICE =
  'El coach tiene energía limitada que se recarga cada mes, también con el plan anual. ' +
  'Chats, briefs, planes y revisiones consumen energía según su extensión. ' +
  'Al agotarla, el coach se pausa hasta la recarga; el resto de NIVL sigue disponible.';

/**
 * La prueba de 7 días, tal cual es (`start_trial`, 0024): del servidor, sin
 * tarjeta, sin renovación, coach estándar con energía propia (0,50 $) y sin
 * modo profundo. Se dice siempre que se ofrece, con la tienda abierta o no.
 */
export function textoPrueba(tier: OfferTier): string {
  if (tier === 'elite') {
    return 'La prueba de 7 días es del coach estándar de Pro, con energía limitada y sin modo profundo. Sin tarjeta y sin cobro: no se renueva sola.';
  }
  return 'Siete días con el coach estándar y energía limitada, sin tarjeta y sin cobro. No se renueva sola. Al acabar, tus hábitos y tu progreso siguen disponibles gratis.';
}

/** El botón de la prueba. Mirando Élite dice de qué es la prueba: de Pro. */
export function tituloBotonPrueba(tier: OfferTier): string {
  return tier === 'elite' ? 'Probar Pro 7 días' : 'Probar el coach 7 días';
}

export const ELITE_USAGE_NOTICE =
  'El modo profundo tiene su propio límite mensual. El ludus se solicita desde Amigos y se asigna manualmente ' +
  'según las plazas disponibles; puede requerir espera.';

// Lo que el Élite añade. SOLO lo que ya existe (Apple 3.1.2). Desde la fase 3
// (0026): el ludus, la insignia y la revisión semanal con el modelo top a
// máximo esfuerzo (`revision_semanal` va a 'xhigh' en la función coach). Los
// retos trimestrales y el acceso anticipado, cuando tengan contenido.
export const ELITE_BENEFITS: readonly ProBenefit[] = [
  { icon: 'flash-outline', title: 'Máxima potencia', detail: 'Un modelo de primera línea en cada brief, plan, revisión y conversación.' },
  { icon: 'telescope-outline', title: 'Modo profundo', detail: 'Para lo que pide pensarlo a fondo: el coach se toma su tiempo y responde con más detalle.' },
  { icon: 'analytics-outline', title: 'Revisión semanal a fondo', detail: 'Tu semana medida por el modelo de primera línea, pensando a fondo.' },
  { icon: 'shield-outline', title: 'Solicita plaza en un ludus (5-8)', detail: 'Un grupo de 5 a 8 gladiadores Élite con tu objetivo y marcador propio. La asignación es manual, según disponibilidad.' },
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
    '09:00-10:30 · Prospección: 10 contactos antes de abrir el correo.',
    '11:00-13:00 · Trabajo profundo: la propuesta de 1.800 € sale hoy.',
    'Esta noche te pido dos cifras: contactos hechos y reuniones agendadas.',
  ],
  trabajador: [
    'Ayer cerraste 4 de 5 misiones. Falló el entreno: hoy va antes de la jornada.',
    '07:15-08:00 · Fuerza, 45 min. Sin móvil hasta terminar.',
    '09:30-11:30 · Bloque de foco: el informe trimestral, y solo eso.',
    'Cena antes de las 21:30 y pantalla fuera a las 23:00. Mañana lo compruebo.',
  ],
  deportista: [
    'Peso medio de la semana: 78,4 kg (−0,3). El ritmo es bueno: no se toca la dieta.',
    'Hoy, empuje: press banca 4×6 con 72,5 kg. El martes marcaste RPE 7: subes 2,5 kg.',
    'Objetivo del día: 2.450 kcal y 165 g de proteína. Llevas tres días por debajo.',
    'Esta noche reviso la sesión. Si las series salen a RPE 9, la semana que viene se descarga.',
  ],
  estudiante: [
    'El examen de Estadística es en 12 días y llevas 5 de 9 temas. Hoy caen dos.',
    '09:00-10:30 · Tema 6: contrastes de hipótesis. Sin apuntes delante al final.',
    '16:00-17:30 · 20 problemas del tema 5. Se corrigen hoy, no mañana.',
    'Ayer estudiaste 2 h 10 min de las 4 previstas. Esta noche te pido la cifra real.',
  ],
  general: [
    'Ayer: 5 de 6 misiones y la racha en 9. Hoy no se rompe.',
    '07:30 · Arriba. 20 min de movimiento antes del primer café.',
    '18:00-19:00 · Lo que llevas tres días aplazando. Hoy se cierra.',
    'A las 22:30 te pido cuentas. Lo pendiente a medianoche se penaliza.',
  ],
};

/** Brief de ejemplo para el perfil; un valor desconocido cae en general. */
export function proSampleBrief(kind: unknown): readonly string[] {
  return PRO_SAMPLE_BRIEF[kindMeta(kind).id];
}

export const LEGAL_URLS = {
  terminos: 'https://nivl.app/terminos',
  privacidad: 'https://nivl.app/privacidad',
  /** NIVL no tiene EULA propio en App Store Connect: aplica el estándar de Apple. Se enlaza en iOS. */
  eulaApple: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
} as const;

/**
 * El nombre visible de la suscripción, igual que en App Store Connect (es-ES):
 * "NIVL Pro mensual", "NIVL Élite fundador". Apple 3.1.2 pide título claro.
 */
export function tituloPlan(id: ProPlanId): string {
  const p = proPlan(id);
  return `${tierOffer(p.tier).name} ${p.label.toLowerCase()}`;
}

/** Duración explícita del periodo de la suscripción. El fundador es ANUAL, no vitalicio. */
export function duracionPlan(id: ProPlanId): string {
  return proPlan(id).period === 'mes' ? 'Mensual · 1 mes' : 'Anual · 1 año';
}

/**
 * Dónde se gestiona y cancela, SIN nombrar la tienda de la otra plataforma
 * (Apple 2.3.10: en iOS no se menciona Google Play; en Android, tampoco Apple).
 */
export function textoGestionTienda(plataforma: string): string {
  if (plataforma === 'ios') return 'La gestionas y la cancelas cuando quieras en Ajustes > tu nombre > Suscripciones.';
  if (plataforma === 'android') {
    return 'La gestionas y la cancelas cuando quieras en Google Play > Pagos y suscripciones > Suscripciones.';
  }
  return 'La gestionas y la cancelas cuando quieras desde la tienda donde la contrataste.';
}

/**
 * La letra pequeña que exigen las tiendas para una suscripción autorrenovable.
 * `precio` es el que da la tienda (`priceString`, ya en la moneda y el formato
 * del comprador). Sin precio confirmado no hay condiciones de compra que mostrar.
 * `intro` es la oferta introductoria que declara la tienda para ese producto
 * (`introDeTienda`); sin ella no se menciona ninguna prueba de tienda.
 */
export function legalText(
  id: ProPlanId,
  precio?: string | null,
  intro?: string | null,
  plataforma = 'web',
): string | null {
  const confirmado = precioVisible(precio);
  if (!confirmado) return null;
  const p = proPlan(id);
  const duracion = p.period === 'mes' ? 'mensual (1 mes)' : 'anual (1 año)';
  const cuando = p.period === 'mes' ? 'cada mes' : 'cada año';
  const congelado =
    p.id === 'nivl_elite_fundador'
      ? ` Oferta limitada a ${PLAZAS_FUNDADOR} plazas: no es un pago único ni vitalicio; el precio de fundador se mantiene mientras no la canceles.`
      : '';
  const introTexto = precioVisible(intro) ? ` ${intro!.trim()}` : '';
  return (
    `${tituloPlan(id)} es una suscripción ${duracion} de renovación automática: ${confirmado} ${cuando}.${congelado}${introTexto} ` +
    'El cobro se hace en tu cuenta de la tienda al confirmar la compra y se renueva sola salvo que la canceles ' +
    `al menos 24 horas antes de que acabe el periodo. ${textoGestionTienda(plataforma)} ` +
    'Sin ella, tus hábitos, tu organización y tu progreso siguen disponibles gratis.'
  );
}

/** Lo que la tienda declara como oferta introductoria (`product.introPrice`). */
export interface IntroTienda {
  price: number;
  priceString: string;
  cycles: number;
  periodUnit: string;
  periodNumberOfUnits: number;
}

const UNIDADES: Record<string, [string, string]> = {
  DAY: ['día', 'días'],
  WEEK: ['semana', 'semanas'],
  MONTH: ['mes', 'meses'],
  YEAR: ['año', 'años'],
};

/**
 * La frase de la oferta introductoria, solo si la tienda la declara. Con
 * `condicional` (iOS sin elegibilidad confirmada) se dice que depende de la
 * tienda. Sin oferta, null: el paywall NUNCA promete una prueba de tienda que
 * no existe (la prueba de 7 días de NIVL es del servidor, sin tarjeta).
 */
export function textoIntro(intro: IntroTienda | null | undefined, condicional = false): string | null {
  if (!intro || !UNIDADES[intro.periodUnit] || !(intro.periodNumberOfUnits > 0)) return null;
  const veces = Math.max(1, Math.round(intro.cycles || 1));
  const n = intro.periodNumberOfUnits * veces;
  const [uno, varios] = UNIDADES[intro.periodUnit]!;
  const periodo = `${n} ${n === 1 ? uno : varios}`;
  const que = intro.price <= 0 ? `${periodo} gratis` : `${periodo} a ${precioVisible(intro.priceString) ?? ''}`.trim();
  const base = `Oferta de la tienda: los primeros ${que}; después se cobra el precio indicado.`;
  return condicional ? `${base} Solo si tu cuenta de la tienda es elegible.` : base;
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
 * El precio de compra solo existe cuando lo confirma la tienda. La tabla de
 * precios en euros sirve únicamente para el catálogo informativo sin tienda.
 */
export function precioVisible(precioTienda?: string | null): string | null {
  return precioTienda?.trim() || null;
}

/**
 * La tienda puede aplicar precios distintos en cada país y periodo. No se
 * prometen ahorros ni equivalentes mensuales calculados desde la tabla local.
 */
export function pitchVisible(p: ProPlan): string {
  if (p.id === 'nivl_elite_fundador') return 'Plazas limitadas · precio congelado';
  return p.period === 'año' ? 'Se cobra una vez al año' : 'Sin permanencia';
}

export type PreciosTienda = Partial<Record<ProPlanId, string>>;

/** Un producto solo se ofrece cuando la tienda ha devuelto su precio. */
export function planesDeTienda(tier: OfferTier, plazas: number | null, precios: PreciosTienda): readonly ProPlan[] {
  return planesALaVenta(tier, plazas).filter((p) => precioVisible(precios[p.id]) !== null);
}

/** Conserva la elección si sigue a la venta; si falta, usa el primer producto real del nivel. */
export function seleccionDeTienda(planes: readonly ProPlan[], elegido: ProPlanId): ProPlan | null {
  return planes.find((p) => p.id === elegido) ?? planes[0] ?? null;
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

/** El servidor ya refleja EXACTAMENTE ese plan (cambio de plan dentro del grupo). */
export function planExacto(status: AiStatus | null | undefined, id: ProPlanId): boolean {
  return isPro(status) && !status?.trial && status?.plan === proPlan(id).plan;
}

/**
 * Qué supone comprar `nuevo` teniendo `actual` activo en la tienda:
 * - `nueva`: no hay suscripción de NIVL en la tienda.
 * - `mismo`: ya la tiene; no se vuelve a comprar.
 * - `subida`: Pro → Élite. Inmediata en las dos tiendas (Apple: upgrade).
 * - `cambio`: Élite → Pro o anual ↔ mensual del mismo nivel. Apple lo aplica
 *   al renovar (downgrade / crossgrade de otra duración); en Google Play se
 *   pide `DEFERRED` para no cobrar dos veces ni quitar lo ya pagado.
 */
export type TipoCambio = 'nueva' | 'mismo' | 'subida' | 'cambio';

const RANGO_OFERTA: Record<OfferTier, number> = { pro: 1, elite: 2 };

export function tipoCambio(actual: ProPlanId | null | undefined, nuevo: ProPlanId): TipoCambio {
  if (!actual) return 'nueva';
  if (actual === nuevo) return 'mismo';
  return RANGO_OFERTA[proPlan(nuevo).tier] > RANGO_OFERTA[proPlan(actual).tier] ? 'subida' : 'cambio';
}

/** El modo de sustitución de Google Play para cada cambio (valores de STORE_REPLACEMENT_MODE). */
export function modoReemplazoGoogle(tipo: TipoCambio): 'CHARGE_PRORATED_PRICE' | 'DEFERRED' {
  return tipo === 'subida' ? 'CHARGE_PRORATED_PRICE' : 'DEFERRED';
}

/**
 * ¿Se le puede ofrecer comprar en la tienda a una cuenta que YA tiene coach?
 * No al Élite ni al dueño (no hay nada por encima), ni a quien paga por
 * Stripe (web) o tiene un plan heredado de Stripe: comprar en la tienda sería
 * una segunda suscripción y un segundo cobro. La prueba y las cortesías sí.
 */
export function puedeMejorarEnTienda(status: AiStatus | null | undefined, provider: string | null | undefined): boolean {
  if (!isPro(status)) return false;
  if (status?.tier === 'elite' || status?.tier === 'owner') return false;
  if (provider === 'stripe' && !status?.trial) return false;
  if (status?.plan === 'mensual' || status?.plan === 'anual') return false;
  return true;
}

/** El producto de tienda que corresponde a un `subscriptions.plan`, o null (cortesía, owner, Stripe heredado). */
export function productoDePlan(plan: string | null | undefined): ProPlanId | null {
  return PRO_PLANS.find((p) => p.plan === plan)?.id ?? null;
}

// ── La oferta en contexto (fase 2, D1) ──────────────────────────────
// Lo que dice el sistema cuando la oferta llega por un momento concreto
// (`paywallmoment.ts`). Reglas: voz del sistema, sin urgencias falsas ni
// cuentas atrás, sin prometer nada que no exista. La voz va con el coach (Pro
// y Élite), no se vende aparte. El modo profundo es solo Élite, con su límite
// mensual, y las fotos al coach solo las ve Élite (Pro y la prueba van con un
// modelo sin visión; `ai_status.vision`). `eyebrow` y `titulo` son
// la cabecera de `/pro` con ese motivo (L-RADICAL §B.5 e).


export interface CopyUpsell {
  /** Rótulo corto de la cabecera de `/pro` cuando llega con este motivo. */
  eyebrow: string;
  /** Título de la cabecera de `/pro` con este motivo. */
  titulo: string;
  /** La línea no modal (`ProUpsellLine`). */
  linea: string;
  /** El texto del enlace de la línea. */
  enlace: string;
  /** La línea de contexto arriba de la oferta completa (`ProOffer motivo`). */
  contexto: string;
  /** Título del beneficio (de PRO_BENEFITS o ELITE_BENEFITS) que va primero, si hay uno que case. */
  beneficio: string | null;
}

export const COPY_UPSELL: Record<CopyKey, CopyUpsell> = {
  'firma.pro': {
    eyebrow: 'Juramento sellado',
    titulo: 'Ahora, quién lo dirige.',
    linea: 'Tu juramento está sellado. El coach puede dirigir tu día desde mañana.',
    enlace: 'Ver NIVL Pro',
    contexto: 'Tu juramento está sellado. NIVL sigue gratis entera; Pro añade el coach que lo dirige.',
    beneficio: 'Brief cada mañana',
  },
  'firma.elite': {
    eyebrow: 'Juramento sellado',
    titulo: 'El coach a máxima potencia.',
    linea: 'Tu juramento está sellado. Élite es el coach a máxima potencia.',
    enlace: 'Ver NIVL Élite',
    contexto: 'Tu juramento está sellado. NIVL sigue gratis entera; Élite añade el coach a máxima potencia.',
    beneficio: 'Máxima potencia',
  },
  'primer_dia.pro': {
    eyebrow: 'Primer día',
    titulo: 'Mañana, con el plan escrito.',
    linea: 'Primer día en la arena. El coach puede escribir el plan de mañana.',
    enlace: 'Ver NIVL Pro',
    contexto: 'Primer día en la arena. Lo que has hecho sigue siendo tuyo y gratis; Pro añade quien lo ordena cada mañana.',
    beneficio: 'Plan del día, bloque a bloque',
  },
  'primer_dia.elite': {
    eyebrow: 'Primer día',
    titulo: 'El coach a máxima potencia.',
    linea: 'Primer día en la arena. Élite es el coach a máxima potencia.',
    enlace: 'Ver NIVL Élite',
    contexto: 'Primer día en la arena. Lo que has hecho sigue siendo tuyo y gratis.',
    beneficio: 'Máxima potencia',
  },
  'coach_profundo.pro': {
    eyebrow: 'Modo profundo',
    titulo: 'Para lo que pide pensarlo a fondo.',
    linea: 'El modo profundo es de NIVL Élite.',
    enlace: 'Ver NIVL Élite',
    contexto: 'El modo profundo es de NIVL Élite: el coach se toma su tiempo con lo que pide pensarlo a fondo.',
    beneficio: 'Modo profundo',
  },
  'coach_profundo.elite': {
    eyebrow: 'Modo profundo',
    titulo: 'Para lo que pide pensarlo a fondo.',
    linea: 'El modo profundo es de NIVL Élite.',
    enlace: 'Ver NIVL Élite',
    contexto: 'El modo profundo es de NIVL Élite: el coach se toma su tiempo con lo que pide pensarlo a fondo.',
    beneficio: 'Modo profundo',
  },
  'voz_premium.pro': {
    eyebrow: 'La voz del coach',
    titulo: 'Te lee y te escucha.',
    linea: 'El coach te lee su respuesta y te escucha si le dictas. Va con NIVL Pro.',
    enlace: 'Ver NIVL Pro',
    contexto: 'La voz va con el coach: te lee sus respuestas y puedes dictarle. NIVL sigue gratis entera; Pro añade el coach.',
    beneficio: null,
  },
  'voz_premium.elite': {
    eyebrow: 'La voz del coach',
    titulo: 'Incluida con el coach.',
    linea: 'La voz va incluida con el coach.',
    enlace: 'Ver planes',
    contexto: 'La voz va incluida con el coach, en Pro y en Élite.',
    beneficio: null,
  },
  'coach_cerrado.pro': {
    eyebrow: 'El coach',
    titulo: 'Un coach que manda en tu día.',
    linea: 'El coach es parte de NIVL Pro. Todo lo demás sigue siendo tuyo y gratis.',
    enlace: 'Ver NIVL Pro',
    contexto: 'El coach es parte de NIVL Pro: brief cada mañana, plan del día y chat. Todo lo demás sigue gratis.',
    beneficio: 'Brief cada mañana',
  },
  'coach_cerrado.elite': {
    eyebrow: 'El coach',
    titulo: 'Un coach que manda en tu día.',
    linea: 'El coach es parte de NIVL Pro y de NIVL Élite.',
    enlace: 'Ver planes',
    contexto: 'El coach es parte de NIVL Pro y de NIVL Élite. Todo lo demás sigue gratis.',
    beneficio: null,
  },
  'analisis_foto.pro': {
    eyebrow: 'Fotos al coach',
    titulo: 'Mira lo que le mandas.',
    linea: 'Que el coach mire tus fotos es de NIVL Élite.',
    enlace: 'Ver NIVL Élite',
    contexto: 'Que el coach mire tus fotos (un plato, una máquina, un apunte) es de NIVL Élite. Con Pro, el coach trabaja con lo que le escribes.',
    beneficio: null,
  },
  'analisis_foto.elite': {
    eyebrow: 'Fotos al coach',
    titulo: 'Con el modelo de primera línea.',
    linea: 'Con NIVL Élite, el coach mira tus fotos y te responde sobre ellas.',
    enlace: 'Ver NIVL Élite',
    contexto: 'Con Élite, el coach mira las fotos que le mandas por el chat (un plato, una máquina, un apunte) y responde sobre ellas.',
    beneficio: 'Máxima potencia',
  },
  'energia_agotada.pro': {
    eyebrow: 'Energía agotada',
    titulo: 'El coach se ha pausado.',
    linea: 'La energía de tu prueba se ha agotado. Lo gratuito sigue funcionando.',
    enlace: 'Ver NIVL Pro',
    contexto: 'La energía del coach se ha agotado. Tus misiones, tu racha y todos los módulos siguen funcionando.',
    beneficio: 'Brief cada mañana',
  },
  'energia_agotada.elite': {
    eyebrow: 'Energía agotada',
    titulo: 'El coach se ha pausado.',
    linea: 'Energía agotada hasta la recarga. El resto de NIVL sigue funcionando.',
    enlace: 'Ver NIVL Élite',
    contexto: 'La energía del coach se recarga cada mes. Élite cambia la potencia: modelo de primera línea y modo profundo, cada uno con su límite mensual.',
    beneficio: 'Máxima potencia',
  },
  'fin_prueba.pro': {
    eyebrow: 'Fin de la prueba',
    titulo: 'Tu prueba ha terminado.',
    linea: 'Tu prueba ha terminado sin cobro. Todo lo tuyo sigue aquí.',
    enlace: 'Ver NIVL Pro',
    contexto: 'Tu prueba ha terminado y no se ha cobrado nada. Tus misiones, tu racha y tus datos siguen; Pro mantiene el coach que has probado.',
    beneficio: 'Brief cada mañana',
  },
  'fin_prueba.elite': {
    eyebrow: 'Fin de la prueba',
    titulo: 'Tu prueba ha terminado.',
    linea: 'Tu prueba ha terminado sin cobro. Élite es el coach a máxima potencia.',
    enlace: 'Ver NIVL Élite',
    contexto: 'Tu prueba ha terminado y no se ha cobrado nada. Élite añade el modelo de primera línea y el modo profundo, con su límite mensual.',
    beneficio: 'Máxima potencia',
  },
};

export function copyUpsell(momento: Momento, tier: TierOferta): CopyUpsell {
  return COPY_UPSELL[`${momento}.${tier}`];
}

/**
 * Los beneficios en el orden en que se enseñan: si el motivo casa con uno, va
 * primero; el resto, en su orden. Nunca quita ni añade ninguno.
 */
export function beneficiosPorMotivo(
  beneficios: readonly ProBenefit[],
  motivo: Momento | null | undefined,
  tier: TierOferta,
): readonly ProBenefit[] {
  if (!motivo) return beneficios;
  const titulo = copyUpsell(motivo, tier).beneficio;
  const i = titulo ? beneficios.findIndex((b) => b.title === titulo) : -1;
  if (i <= 0) return beneficios;
  return [beneficios[i]!, ...beneficios.slice(0, i), ...beneficios.slice(i + 1)];
}
