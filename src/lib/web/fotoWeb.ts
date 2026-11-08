// NIVL · Web: una foto elegida en el navegador, igual que la del móvil.
//
// El selector del navegador no recorta, no comprime y deja los metadatos:
// `quality`, `aspect` y `exif: false` no hacen nada en la web. Sin esto se subía
// el archivo original (varios megas de base64 por turno al coach), un PNG se
// guardaba como si fuera JPG y la ubicación GPS de la foto viajaba con ella.
// Redibujarla en un lienzo resuelve las tres cosas de una vez.

import type { ImagePickerAsset, ImagePickerOptions, ImagePickerResult } from 'expo-image-picker';
import { medidasFotoWeb } from './medidasFoto';

function cargarImagen(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('imagen ilegible'));
    img.src = uri;
  });
}

async function rehacer(a: ImagePickerAsset, opciones: ImagePickerOptions): Promise<ImagePickerAsset> {
  const img = await cargarImagen(a.uri);
  const m = medidasFotoWeb(img.naturalWidth, img.naturalHeight, opciones.allowsEditing ? opciones.aspect : null);
  if (!m) throw new Error('imagen sin medidas');
  const lienzo = document.createElement('canvas');
  lienzo.width = m.ancho;
  lienzo.height = m.alto;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('sin lienzo');
  // Un PNG con transparencia no puede quedar sobre negro por accidente del JPG.
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, m.ancho, m.alto);
  ctx.drawImage(img, m.sx, m.sy, m.sw, m.sh, 0, 0, m.ancho, m.alto);
  const dataUrl = lienzo.toDataURL('image/jpeg', opciones.quality ?? 0.5);
  const coma = dataUrl.indexOf(',');
  return {
    ...a,
    uri: dataUrl,
    width: m.ancho,
    height: m.alto,
    mimeType: 'image/jpeg',
    base64: opciones.base64 ? dataUrl.slice(coma + 1) : null,
    file: undefined,
    fileSize: undefined,
  };
}

function liberar(a: ImagePickerAsset): void {
  // La URL `blob:` retiene el archivo original mientras dure la página.
  if (a.uri.startsWith('blob:')) URL.revokeObjectURL(a.uri);
}

export interface FotosWeb {
  resultado: ImagePickerResult;
  /** Cuántas fotos no se han podido leer (p. ej. HEIC en Chrome). */
  ilegibles: number;
}

/** Rehace cada foto elegida. Lo que el navegador no sabe abrir se descarta. */
export async function rehacerFotosWeb(r: ImagePickerResult, opciones: ImagePickerOptions): Promise<FotosWeb> {
  if (r.canceled) return { resultado: r, ilegibles: 0 };
  const hechas = await Promise.all(
    r.assets.map(async (a) => {
      try {
        return await rehacer(a, opciones);
      } catch {
        return null;
      } finally {
        liberar(a);
      }
    }),
  );
  const assets = hechas.filter((a): a is ImagePickerAsset => a !== null);
  const ilegibles = hechas.length - assets.length;
  return { resultado: assets.length ? { canceled: false, assets } : { canceled: true, assets: null }, ilegibles };
}

/**
 * Una foto del almacén como `data:`, para pintarla en la tarjeta de compartir:
 * con la URL firmada html2canvas no podría exportar el lienzo. Solo en memoria.
 */
export async function fotoComoDataWeb(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise<string | null>((resolve) => {
      const lector = new FileReader();
      lector.onload = () => resolve(typeof lector.result === 'string' ? lector.result : null);
      lector.onerror = () => resolve(null);
      lector.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * ¿Pedir «cámara» abre una cámara de verdad? En el móvil, sí: el navegador
 * respeta `capture`. En el ordenador ese input abre el mismo selector de
 * archivos que la galería, y dos botones que hacen lo mismo son uno de más.
 */
export function hayCamaraWeb(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}
