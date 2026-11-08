// NIVL · Compartir un texto en todas las plataformas.
//
// `Share.share` de react-native-web solo envuelve `navigator.share`: en Firefox
// y en buena parte de los escritorios no existe y rechaza la promesa, así que
// «Invitar» acababa en «el sistema no responde». Cerrar la hoja del navegador
// también rechaza (AbortError), y eso no es un error. Aquí la web usa la hoja
// si la hay y, si no, copia el texto y lo dice.

import { Clipboard, Platform, Share } from 'react-native';

export type ResultadoTexto = 'compartido' | 'copiado' | 'cancelado' | 'imposible';

function esCancelacion(e: unknown): boolean {
  return (e as { name?: string } | null)?.name === 'AbortError';
}

async function copiarEnWeb(texto: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // Sin permiso o sin foco: se intenta por la vía antigua.
  }
  try {
    // `setString` en la web devuelve si ha podido; en el tipo de RN es void.
    return (Clipboard.setString(texto) as unknown) === true;
  } catch {
    return false;
  }
}

/** `anchor`: nodo del botón, solo iOS, para que la hoja apunte a él en iPad. */
export async function compartirTexto(texto: string, anchor?: number): Promise<ResultadoTexto> {
  if (Platform.OS !== 'web') {
    const r = await Share.share({ message: texto }, anchor != null ? { anchor } : undefined);
    return r.action === Share.dismissedAction ? 'cancelado' : 'compartido';
  }
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text: texto });
      return 'compartido';
    } catch (e) {
      if (esCancelacion(e)) return 'cancelado';
      // Sin gesto reciente o bloqueado por el navegador: queda copiarlo.
    }
  }
  return (await copiarEnWeb(texto)) ? 'copiado' : 'imposible';
}
