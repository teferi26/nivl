// NIVL · NIVL Pro: la oferta, en datos.
//
// Gratis es la app entera sin IA; Pro es el coach (docs/PRECIOS.md). Aquí vive
// lo que la pantalla de Pro y el paso del onboarding necesitan pintar: planes,
// precios, lo que hace el coach y la línea de énfasis por perfil. Si cambias un
// precio, rehaz antes la cuenta de docs/PRECIOS.md.
//
// Módulo PURO: sin imports de Supabase, para que los tests arranquen. Los
// efectos (leer el estado de la IA, comprar, restaurar) están en `pro.ts`.

import { kindMeta, type ProfileKind } from './kinds';

/** Lo que devuelve la RPC `ai_status()` (migración 0020). Importes en micro-USD. */
export interface AiStatus {
  entitled: boolean;
  plan: 'mensual' | 'anual' | 'cortesia' | 'owner' | null;
  budget: number;
  spent: number;
  remaining: number;
  /** Día en que se recarga el presupuesto del mes (YYYY-MM-DD). Solo con derecho a IA. */
  renews?: string;
}

/** Tiene coach: suscripción viva, cortesía o dueño. Lo decide el servidor. */
export function isPro(status: AiStatus | null | undefined): boolean {
  return !!status?.entitled;
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
  return isPro(status) && (status?.remaining ?? 0) < 20000;
}

const PLAN_LABEL: Record<NonNullable<AiStatus['plan']>, string> = {
  mensual: 'Mensual',
  anual: 'Anual',
  cortesia: 'Cortesía',
  owner: 'Fundador',
};

export function planLabel(plan: AiStatus['plan']): string {
  return plan ? PLAN_LABEL[plan] : 'Gratis';
}

// Los identificadores son los de los productos de tienda (App Store Connect y
// Play Console) y los de RevenueCat. Aún no existen: hay que crearlos con
// exactamente estos ids.
export type ProPlanId = 'nivl_pro_mensual' | 'nivl_pro_anual';

export interface ProPlan {
  id: ProPlanId;
  /** El valor que acabará en `subscriptions.plan`. */
  plan: 'mensual' | 'anual';
  label: string;
  priceCents: number;
  /** Precio tal y como se enseña: "79,99 €". */
  price: string;
  period: 'mes' | 'año';
  months: number;
  /** Equivalente mensual ya formateado: "6,67 €". */
  perMonth: string;
  /** Ahorro frente a pagar mes a mes ("−33 %"), o null si no lo hay. */
  savings: string | null;
  /** Rótulo bajo el precio. */
  pitch: string;
}

const MENSUAL_CENTS = 999;
const ANUAL_CENTS = 7999;

/** "6,67 €": coma decimal y el símbolo detrás, como se escribe en España. */
export function euros(cents: number): string {
  return `${(Math.round(cents) / 100).toFixed(2).replace('.', ',')} €`;
}

const ahorroAnual = Math.round((1 - ANUAL_CENTS / (MENSUAL_CENTS * 12)) * 100);
const mesesGratis = Math.round(12 - ANUAL_CENTS / MENSUAL_CENTS);

export const PRO_PLANS: readonly ProPlan[] = [
  {
    id: 'nivl_pro_anual',
    plan: 'anual',
    label: 'Anual',
    priceCents: ANUAL_CENTS,
    price: euros(ANUAL_CENTS),
    period: 'año',
    months: 12,
    perMonth: euros(ANUAL_CENTS / 12),
    savings: `−${ahorroAnual} %`,
    pitch: `${mesesGratis} meses gratis · ${euros(ANUAL_CENTS / 12)}/mes`,
  },
  {
    id: 'nivl_pro_mensual',
    plan: 'mensual',
    label: 'Mensual',
    priceCents: MENSUAL_CENTS,
    price: euros(MENSUAL_CENTS),
    period: 'mes',
    months: 1,
    perMonth: euros(MENSUAL_CENTS),
    savings: null,
    pitch: 'Sin permanencia',
  },
];

/** El anual va preseleccionado: es el que más le conviene a quien va en serio. */
export const DEFAULT_PLAN: ProPlanId = 'nivl_pro_anual';

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
  terminos: 'https://nivl.app/terminos',
  privacidad: 'https://nivl.app/privacidad',
} as const;

/** La letra pequeña que exigen las tiendas para una suscripción autorrenovable. */
export function legalText(id: ProPlanId): string {
  const p = proPlan(id);
  return (
    `NIVL Pro ${p.label.toLowerCase()} es una suscripción de renovación automática: ${p.price} cada ${p.period}. ` +
    'El cobro se hace en tu cuenta de la tienda al confirmar la compra y se renueva sola salvo que la canceles ' +
    'al menos 24 horas antes de que acabe el periodo. La gestionas y la cancelas cuando quieras en los ajustes ' +
    'de suscripciones de la App Store o de Google Play. Sin ella, NIVL sigue entera y gratis, sin el coach.'
  );
}
