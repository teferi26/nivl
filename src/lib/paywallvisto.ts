// NIVL · Qué se apunta cuando alguien VE la oferta por modos (`paywall_visto`).
//
// Módulo PURO, con tests. El efecto (registrar una vez por montaje) está en
// `useOfertaModos`.
//
// La oferta por modos (1.1) sustituyó a `ProOffer`, que era quien apuntaba
// `paywall_visto`: desde entonces el panel no sabía cuánta gente llegaba al
// muro. Aquí se decide el `motivo` del evento, que dice dos cosas a la vez:
// DÓNDE se vio (cuestionario de entrada, /pro, puerta de un mundo) y QUÉ se
// vio (con prueba gratis, sin ella, sin precios o sin tienda). Va todo en
// `motivo` porque es la única prop de texto que el servidor admite en este
// evento (0070): así no hace falta migración y el panel lo desglosa ya en
// `paywall_por_motivo` (0072).

export type OrigenOferta = 'onboarding' | 'pro' | 'mundo';
export const ORIGENES_OFERTA: readonly OrigenOferta[] = ['onboarding', 'pro', 'mundo'];

export type LoVisto = 'prueba' | 'sin_prueba' | 'sin_precio' | 'sin_tienda';
export const LO_VISTO: readonly LoVisto[] = ['prueba', 'sin_prueba', 'sin_precio', 'sin_tienda'];

export interface EstadoVisto {
  /** `purchasesAvailable()`: hay tienda en esta build. */
  disponible: boolean;
  catalogo: 'cargando' | 'listo' | 'error';
  /** La tienda declara días gratis para esta cuenta en algún producto. */
  conPrueba: boolean;
}

/**
 * Lo que la persona tiene delante. `null` mientras la tienda carga: todavía
 * no se sabe si verá la prueba, y se espera a saberlo para apuntarlo una vez.
 */
export function loVisto(e: EstadoVisto): LoVisto | null {
  if (!e.disponible) return 'sin_tienda';
  if (e.catalogo === 'cargando') return null;
  if (e.catalogo === 'error') return 'sin_precio';
  return e.conPrueba ? 'prueba' : 'sin_prueba';
}

export function motivoVisto(origen: OrigenOferta, visto: LoVisto): string {
  return `${origen}_${visto}`;
}

export interface PropsPaywallVisto {
  motivo: string;
  /** Dentro del cuestionario de entrada (con el pie fijo), no la pantalla entera. */
  compacto: boolean;
}

/** Las props de `paywall_visto`, o `null` si aún no toca apuntarlo. */
export function propsPaywallVisto(origen: OrigenOferta, e: EstadoVisto): PropsPaywallVisto | null {
  const visto = loVisto(e);
  if (!visto) return null;
  return { motivo: motivoVisto(origen, visto), compacto: origen === 'onboarding' };
}
