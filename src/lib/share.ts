// NIVL · Compartir una tarjeta: capturar la vista y sacarla por la hoja del sistema.
//
// Un solo camino para todas las tarjetas (logro, nivel, rango, racha y
// antes/después). Hasta ahora había tres capturas distintas, cada una con su
// tamaño, su formato y su temporal sin borrar.
//
// - El archivo sale SIEMPRE a los píxeles del formato (1080×1920 o 1080×1350),
//   con independencia de la densidad de la pantalla.
// - PNG sin foto y JPG 0,9 con foto (`formatoArchivo`).
// - El temporal se borra al terminar, también si la hoja falla o se cancela.
// - En iPad la hoja se ancla al botón que la abrió (`anchor`); sin ancla,
//   UIActivityViewController en popover puede abrirse en un sitio raro o fallar.
// - Si no hay hoja de compartir (Expo Go raro), se comparte el texto y el
//   enlace con `Share` de React Native.
// - En la web la tarjeta se pinta con html2canvas: va a la hoja del navegador
//   si la tiene y, si no, se descarga. Si no se puede pintar, queda el texto.
// - Un cerrojo evita dos hojas a la vez por un doble toque.
//
// Nunca llega un `e.message` al usuario: quien llama usa `mensajeSistema`.

import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Platform, Share, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import {
  bloqueo,
  DIMENSIONES,
  formatoArchivo,
  mensaje,
  type ContextoTarjeta,
  type FormatoTarjeta,
  type OpcionesTarjeta,
  type Tarjeta,
} from './sharecard';
import { ErrorVisible } from './validation';
import { compartirTexto } from './compartirTexto';
import { capturarTarjetaWeb, compartirImagenWeb, descargarImagenWeb } from './web/capturaTarjeta';

export interface Ancla {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PeticionCompartir {
  tarjeta: Tarjeta;
  formato: FormatoTarjeta;
  opciones: OpcionesTarjeta;
  /** Edad verificada de quien comparte: sin ella, nada de fotos corporales. */
  contexto?: ContextoTarjeta;
  /** Vista ya montada (fuera de pantalla) con la tarjeta pintada. */
  vista: RefObject<View | null>;
  codigoAmigo?: string | null;
  /** Rectángulo del botón, en coordenadas de ventana: necesario en iPad. */
  ancla?: Ancla | null;
}

export type ResultadoCompartir = 'compartida' | 'solo-texto' | 'ocupado' | 'descargada' | 'copiada' | 'cancelada';

let ocupado = false;

/** Para los tests: suelta el cerrojo entre casos. */
export function __soltarCerrojo(): void {
  ocupado = false;
}

function borrar(uri: string | null): void {
  if (!uri || Platform.OS === 'web') return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Un temporal que no se puede borrar no es motivo para fallar: lo limpia el sistema.
  }
}

async function compartirEnWeb(p: PeticionCompartir, texto: string, contexto: ContextoTarjeta): Promise<ResultadoCompartir> {
  const { formato, calidad } = formatoArchivo(p.tarjeta, p.opciones, contexto);
  let imagen: string | null = null;
  try {
    imagen = p.vista.current ? await capturarTarjetaWeb(p.vista.current, { ancho: DIMENSIONES[p.formato].ancho, formato, calidad }) : null;
  } catch {
    // Una foto sin permiso de origen «mancha» el lienzo: queda compartir el texto.
    imagen = null;
  }
  if (imagen) {
    const nombre = `nivl-${p.tarjeta.tipo}.${formato}`;
    const hoja = await compartirImagenWeb(nombre, imagen);
    if (hoja === 'compartida') return 'compartida';
    if (hoja === 'cancelada') return 'cancelada';
    descargarImagenWeb(nombre, imagen);
    return 'descargada';
  }
  const r = await compartirTexto(texto);
  if (r === 'imposible') throw new Error('Compartir no está disponible en este navegador.');
  return r === 'copiado' ? 'copiada' : r === 'cancelado' ? 'cancelada' : 'solo-texto';
}

/**
 * Captura la tarjeta y abre la hoja de compartir. Lanza `ErrorVisible` si la
 * tarjeta no se puede generar con esas opciones (p. ej. antes/después sin
 * permiso de fotos); cualquier otro fallo sube tal cual para `mensajeSistema`.
 */
export async function compartirTarjeta(p: PeticionCompartir): Promise<ResultadoCompartir> {
  const contexto = p.contexto ?? { puedeCompartirFotos: false };
  const motivo = bloqueo(p.tarjeta, p.opciones, contexto);
  if (motivo) throw new ErrorVisible(motivo);
  if (ocupado) return 'ocupado';
  ocupado = true;
  let uri: string | null = null;
  try {
    const texto = mensaje(p.tarjeta, p.opciones, p.codigoAmigo);
    if (Platform.OS === 'web') return await compartirEnWeb(p, texto, contexto);
    const hayHoja = await Sharing.isAvailableAsync();
    if (!hayHoja) {
      await Share.share({ message: texto });
      return 'solo-texto';
    }
    const { formato, calidad } = formatoArchivo(p.tarjeta, p.opciones, contexto);
    const { ancho, alto } = DIMENSIONES[p.formato];
    uri = await captureRef(p.vista, { format: formato, quality: calidad, width: ancho, height: alto, result: 'tmpfile' });
    await Sharing.shareAsync(uri, {
      mimeType: formato === 'jpg' ? 'image/jpeg' : 'image/png',
      UTI: formato === 'jpg' ? 'public.jpeg' : 'public.png',
      dialogTitle: 'Compartir desde NIVL',
      ...(p.ancla ? { anchor: p.ancla } : {}),
    });
    return 'compartida';
  } finally {
    borrar(uri);
    ocupado = false;
  }
}
