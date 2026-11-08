// NIVL · Web: las cuentas para rehacer una foto elegida en el navegador.
//
// En el móvil el selector recorta, comprime y entrega un JPG. El selector del
// navegador entrega el archivo tal cual: sin recorte, sin comprimir y con su
// formato. Aquí está el cálculo de cómo redibujarla; el dibujo va en fotoWeb.ts.
//
// Puro: sin DOM, sin React y sin Supabase.

/** Lado mayor de la foto que se sube. Más no se ve y cuesta almacén y fichas. */
export const LADO_MAX_FOTO_WEB = 2048;

export interface MedidasFotoWeb {
  /** El trozo de la imagen original que se usa. */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** El tamaño final del lienzo. */
  ancho: number;
  alto: number;
}

/**
 * Recorte centrado a la proporción pedida (`aspecto`: ancho y alto, como en
 * `ImagePickerOptions.aspect`) y reducción sin ampliar nunca. Devuelve null si
 * la imagen no tiene medidas: no se ha podido leer.
 */
export function medidasFotoWeb(
  anchoOriginal: number,
  altoOriginal: number,
  aspecto?: readonly [number, number] | null,
  ladoMax: number = LADO_MAX_FOTO_WEB,
): MedidasFotoWeb | null {
  if (!(anchoOriginal > 0) || !(altoOriginal > 0) || !(ladoMax > 0)) return null;
  let sw = anchoOriginal;
  let sh = altoOriginal;
  if (aspecto && aspecto[0] > 0 && aspecto[1] > 0) {
    const proporcion = aspecto[0] / aspecto[1];
    if (anchoOriginal / altoOriginal > proporcion) sw = altoOriginal * proporcion;
    else sh = anchoOriginal / proporcion;
  }
  const escala = Math.min(1, ladoMax / Math.max(sw, sh));
  return {
    sx: (anchoOriginal - sw) / 2,
    sy: (altoOriginal - sh) / 2,
    sw,
    sh,
    ancho: Math.max(1, Math.round(sw * escala)),
    alto: Math.max(1, Math.round(sh * escala)),
  };
}
