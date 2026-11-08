// NIVL · Un solo pago de cardio a la vez por persona (puro).
//
// El tope por sesión se calcula leyendo lo ya pagado hoy. Si la hoja manual y
// el buzón leen a la vez, los dos ven «nada» y cobran por encima del tope. Cubre
// desde la lectura hasta el último apunte. No es reentrante: quien lo tiene no
// puede volver a pedirlo.

const colas = new Map<string, Promise<unknown>>();

export function conCerrojoCardio<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const resultado = (colas.get(userId) ?? Promise.resolve()).then(fn);
  const cola = resultado.catch(() => {});
  colas.set(userId, cola);
  void cola.then(() => {
    if (colas.get(userId) === cola) colas.delete(userId);
  });
  return resultado;
}
