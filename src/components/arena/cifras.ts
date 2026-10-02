// NIVL · Arena: cómo se escriben las cifras (puro, con test).
//
// `toLocaleString('es-ES')` no agrupa los números de cuatro cifras (1840 sale
// «1840») y en Hermes depende de Intl: aquí se agrupa a mano con punto, que es
// lo que se espera leer en un monumento («1.840 XP»).

/** Cifra vacía: un guion, nunca la raya larga (SISTEMA.md §0). */
export const CIFRA_VACIA = '-';

/** 1840 → «1.840»; -12500 → «-12.500». Redondea; un no finito → «-». */
export function formatoMiles(n: number): string {
  if (!Number.isFinite(n)) return CIFRA_VACIA;
  const r = Math.round(n);
  const signo = r < 0 ? '-' : '';
  const digitos = String(Math.abs(r));
  let out = '';
  for (let i = 0; i < digitos.length; i++) {
    const quedan = digitos.length - i;
    out += digitos[i];
    if (quedan > 1 && (quedan - 1) % 3 === 0) out += '.';
  }
  return signo + out;
}

const ROMANOS: [number, string][] = [
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

/** 1..39 en números romanos (pasos de un proceso, grados). Fuera, `String(n)`. */
export function romano(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 39) return String(n);
  let resto = n;
  let out = '';
  for (const [valor, letras] of ROMANOS) {
    while (resto >= valor) {
      out += letras;
      resto -= valor;
    }
  }
  return out;
}

/** 3 → «3.º» (puesto en un ranking). */
export function ordinal(n: number): string {
  if (!Number.isFinite(n)) return CIFRA_VACIA;
  return `${Math.round(n)}.º`;
}

/**
 * a / b acotado a 0..1. Con b ≤ 0 (nivel máximo, objetivo sin definir) la barra
 * está llena: 1. Un NaN cuenta como 0.
 */
export function ratioSeguro(a: number, b: number): number {
  if (!(b > 0)) return 1;
  const r = a / b;
  if (!Number.isFinite(r)) return 0;
  return Math.min(1, Math.max(0, r));
}
