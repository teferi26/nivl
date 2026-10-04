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

/** Lo más que se espera al estado de la IA antes de entrar sin oferta. */
export const LECTURA_MAX_MS = 4000;
/** Tras esto en 'esperar', el pie enseña una salida: nunca un paso sin puerta. */
export const SALIDA_ESPERA_MS = 2500;

/** Decisión cuando la lectura del estado vence: no se ofrece nada y se entra. */
export const DECISION_SALTAR: DecisionOferta = {
  mostrar: false,
  forma: 'linea',
  tier: 'pro',
  prueba: false,
  copyKey: 'firma.pro',
  razon: 'tiempo',
};

/**
 * La promesa o, si tarda más de `ms`, `vencida`. Un fallo de la promesa
 * también resuelve `vencida`: quien espera nunca se queda colgado.
 */
export function conTiempoLimite<T, V>(p: Promise<T>, ms: number, vencida: V): Promise<T | V> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<V>((resolve) => {
    t = setTimeout(() => resolve(vencida), ms);
  });
  return Promise.race([p.catch(() => vencida), limite]).finally(() => clearTimeout(t));
}
