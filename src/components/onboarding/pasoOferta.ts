// NIVL · Qué pinta el último paso del onboarding (la oferta tras la firma).
// Puro: la decisión la toma `ofrecerSi('firma', …)` (Chat 2); aquí solo se
// traduce a pantalla. Sin decisión todavía, se espera; si la decisión es no
// ofrecer, el onboarding termina sin enseñar nada.

import type { DecisionOferta } from '@/lib/paywallmoment';

export type PasoOferta = 'esperar' | 'saltar' | 'hoja' | 'linea';

/**
 * - `esperar`: aún no hay decisión (se está leyendo el estado), o es una hoja
 *   y hay una celebración en pantalla: la oferta nunca se abre encima.
 * - `saltar`: no se ofrece nada (sin estado, ya paga, topes…): se entra.
 * - `hoja`: la oferta entera, con su salida gratuita a la misma altura.
 * - `linea`: una fila discreta que lleva a /pro si se toca; se entra igual.
 *   No tapa nada, así que una celebración no la retiene.
 */
export function pasoOferta(d: DecisionOferta | null, celebrando: boolean): PasoOferta {
  if (!d) return 'esperar';
  if (!d.mostrar) return 'saltar';
  if (d.forma === 'hoja') return celebrando ? 'esperar' : 'hoja';
  return 'linea';
}
