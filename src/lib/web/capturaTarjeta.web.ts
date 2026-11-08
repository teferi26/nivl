// NIVL · Web: la tarjeta de compartir como imagen.
//
// `captureRef` de view-shot no sirve en la web: llama a `findNodeHandle`, que
// react-native-web prohíbe. Se usa directamente html2canvas, la misma pieza que
// view-shot trae para la web, y se pinta a los píxeles exactos del formato.
//
// La hoja del navegador pide un gesto reciente y la captura tarda: si la hoja
// se niega, quien llama descarga la imagen.

import html2canvas from 'html2canvas';
import type { View } from 'react-native';

export async function capturarTarjetaWeb(
  vista: View,
  opciones: { ancho: number; formato: 'png' | 'jpg'; calidad: number },
): Promise<string | null> {
  const nodo = vista as unknown as HTMLElement;
  const anchoNodo = nodo.offsetWidth;
  if (!anchoNodo) return null;
  const lienzo = await html2canvas(nodo, {
    backgroundColor: '#000000',
    scale: opciones.ancho / anchoNodo,
    logging: false,
    useCORS: true,
  });
  return lienzo.toDataURL(opciones.formato === 'jpg' ? 'image/jpeg' : 'image/png', opciones.calidad);
}

function aBlob(dataUrl: string): Blob {
  const coma = dataUrl.indexOf(',');
  const tipo = dataUrl.slice(5, dataUrl.indexOf(';'));
  const binario = atob(dataUrl.slice(coma + 1));
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}

export function descargarImagenWeb(nombre: string, dataUrl: string): void {
  const url = URL.createObjectURL(aBlob(dataUrl));
  const enlace = document.createElement('a');
  try {
    enlace.href = url;
    enlace.download = nombre;
    enlace.rel = 'noopener';
    enlace.style.display = 'none';
    document.body.appendChild(enlace);
    enlace.click();
  } finally {
    enlace.remove();
    // Como en exporter.ts: revocar en el siguiente ciclo para no cortar la descarga.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** ¿Este navegador sabe pasar un archivo a su hoja de compartir? */
export function comparteArchivosWeb(): boolean {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
    return navigator.canShare({ files: [new File([new Blob()], 'nivl.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
}

export async function compartirImagenWeb(nombre: string, dataUrl: string): Promise<'compartida' | 'cancelada' | 'imposible'> {
  if (!comparteArchivosWeb()) return 'imposible';
  try {
    const blob = aBlob(dataUrl);
    await navigator.share({ files: [new File([blob], nombre, { type: blob.type })] });
    return 'compartida';
  } catch (e) {
    return (e as { name?: string } | null)?.name === 'AbortError' ? 'cancelada' : 'imposible';
  }
}
