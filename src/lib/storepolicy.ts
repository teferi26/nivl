// NIVL · Qué caminos de pago y de IA existen en cada build (puro).
//
// Guideline 3.1.1 de Apple (y la política de pagos de Google Play): en la app
// de tienda, el contenido digital solo se vende con compra integrada. Así que
// en iOS y Android:
//   · Stripe NO existe, aunque la build lleve EXPO_PUBLIC_PAYWALL=on por
//     error: un interruptor de entorno olvidado no puede tumbar una revisión.
//   · "Trae tu propia clave de API" NO existe fuera de desarrollo: desbloquear
//     la IA pegando una clave es desbloquear una función de pago por fuera.
// Todo lo de pago lleva a /pro (RevenueCat). Stripe y la clave propia quedan
// para la web y para el desarrollo local.

export type Plataforma = 'ios' | 'android' | 'web' | 'windows' | 'macos';

export function esTienda(plataforma: string): boolean {
  return plataforma === 'ios' || plataforma === 'android';
}

/** El muro de Stripe: solo fuera de la tienda y con el interruptor puesto. */
export function stripePermitido(plataforma: string, interruptor: string | undefined): boolean {
  return !esTienda(plataforma) && interruptor === 'on';
}

/** La clave de API propia en el Oráculo: fuera de la tienda, o en desarrollo. */
export function clavePropiaPermitida(plataforma: string, dev: boolean): boolean {
  return dev || !esTienda(plataforma);
}
