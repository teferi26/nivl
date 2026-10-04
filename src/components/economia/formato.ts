// NIVL · Economía: cómo se escriben los importes (copiado de la ruta vieja).

export const num = (n: number, dec = 0) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const eur = (n: number, dec = 0) => `${num(n, dec)} €`;
/** Con signo: negativo es gasto, positivo ingreso. El signo es la información. */
export const eurSigno = (n: number) => `${n < 0 ? '−' : '+'}${eur(Math.abs(n), 2)}`;
