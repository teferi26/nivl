// NIVL · Arena: cómo se escriben las cifras (puro, con test).
//
// `toLocaleString('es-ES')` no agrupa los números de cuatro cifras (1840 sale
// «1840») y en Hermes depende de Intl: aquí se agrupa a mano con punto, que es
// lo que se espera leer en un monumento («1.840 XP»). Desde 1.0.10 lo hace
// `miles` de @/i18n/formato (igual en es; Intl en el resto de idiomas).

import { t } from '@/i18n';
import { miles } from '@/i18n/formato';

/** Cifra vacía: un guion, nunca la raya larga (SISTEMA.md §0). */
export const CIFRA_VACIA = '-';

/** 1840 → «1.840»; -12500 → «-12.500». Redondea; un no finito → «-». */
export function formatoMiles(n: number): string {
  if (!Number.isFinite(n)) return CIFRA_VACIA;
  return miles(n);
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

/**
 * Rótulo a la derecha de la barra de XP: el nivel que viene, escrito para que
 * no parezca el actual («NIVEL 24» junto al «23» se leía como contradicción).
 */
export function rotuloSiguiente(nivel: number, tope: boolean): string {
  return tope ? t('arena:cifras.nivelMaximo') : t('arena:cifras.siguiente', { nivel: nivel + 1 });
}

/** Lo más que encoge la cifra para caber (32 → 19 en una franja). */
export const ESCALA_MINIMA = 0.6;

/**
 * Escala de la cifra para que cifra + unidad quepan en `hueco`: la unidad no
 * encoge (es legible a su tamaño); la cifra, hasta ESCALA_MINIMA. `partir`
 * dice si ni así caben y la unidad debe bajar de línea. Pura (con test).
 */
export function escalaCifra(hueco: number, anchoCifra: number, anchoSufijo: number): { escala: number; partir: boolean } {
  if (!(hueco > 0) || !(anchoCifra > 0) || anchoCifra + anchoSufijo <= hueco) return { escala: 1, partir: false };
  // Dos centésimas hacia abajo: el redondeo de las fuentes no debe dejar el último píxel fuera.
  const escala = Math.floor(((hueco - anchoSufijo) / anchoCifra) * 50) / 50;
  if (escala >= ESCALA_MINIMA) return { escala, partir: false };
  return { escala: ESCALA_MINIMA, partir: true };
}
