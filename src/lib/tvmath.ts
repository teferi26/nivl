// NIVL · El código de enlace de un Apple TV: lógica pura, con tests.
// Mismo alfabeto que el servidor (`_tv_codigo`, 0125): sin I, O, 0 ni 1.

const CODIGO = /^[A-HJ-NP-Z2-9]{8}$/;

/** Lo que llega del QR o del teclado, sin guiones ni espacios y en mayúsculas. */
export function normalizarCodigoTv(crudo: string | string[] | undefined | null): string {
  const valor = Array.isArray(crudo) ? crudo[0] : crudo;
  return (valor ?? '').replace(/[\s-]/g, '').toUpperCase();
}

export function codigoTvValido(codigo: string): boolean {
  return CODIGO.test(codigo);
}

/** XXXX-XXXX, como lo enseña la TV. Mientras se escribe, lo que haya. */
export function codigoTvVisible(codigo: string): string {
  const limpio = normalizarCodigoTv(codigo).slice(0, 8);
  return limpio.length > 4 ? `${limpio.slice(0, 4)}-${limpio.slice(4)}` : limpio;
}
