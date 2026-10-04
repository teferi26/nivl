// NIVL · Tope de espera para las lecturas de red que deciden una pantalla.
//
// Sin tope, una petición colgada (red que entra y no sale, ascensor, tienda
// que no contesta) deja la pantalla en «cargando» para siempre. Con él, a los
// `LIMITE_RED_MS` la llamada falla con `ErrorTiempoAgotado`, que
// `mensajeSistema` traduce a «sin conexión», y quien llamó enseña su error con
// Reintentar. Un fallo propio de la promesa se propaga tal cual.
//
// Primo de `conTiempoLimite` (components/onboarding/pasoOferta.ts), que al
// vencer RESUELVE un valor de reserva y se traga el fallo: aquí hace falta
// lanzar y conservar el error original, así que no se puede reutilizar tal cual.

/** Lo más que se espera a una lectura de red antes de darla por perdida. */
export const LIMITE_RED_MS = 12_000;

/** El nombre y el mensaje llevan «timeout»: `esErrorDeRed` lo reconoce. */
export class ErrorTiempoAgotado extends Error {
  constructor() {
    super('timeout');
    this.name = 'TimeoutError';
  }
}

/** La promesa, o `ErrorTiempoAgotado` si tarda más de `ms`. */
export function conLimiteDeRed<T>(p: PromiseLike<T>, ms = LIMITE_RED_MS): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new ErrorTiempoAgotado()), ms);
    // En Node (tests) un tope pendiente no retiene el proceso; en Hermes no existe.
    (t as { unref?: () => void }).unref?.();
  });
  return Promise.race([Promise.resolve(p), limite]).finally(() => clearTimeout(t));
}
