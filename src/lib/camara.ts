// NIVL · Hacer una foto con alternativa. En el Mac («Designed for iPad»), en
// el Vision Pro como app de iPad y en el simulador no hay cámara trasera que
// abrir: `launchCameraAsync` lanza en vez de devolver `canceled`. Antes esa
// excepción se perdía en un manejador async y el botón no hacía nada. Ahora
// cae al selector de archivos y fotos (en el Mac abre el de Finder), con las
// mismas opciones: la evidencia, el diario o la foto de la sesión se pueden
// adjuntar igual.
//
// En la web, además, lo elegido se rehace (fotoWeb.ts): el selector del
// navegador no aplica ni la calidad, ni el recorte, ni quita los metadatos.

import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { avisar } from '@/components/ui/confirmar';
import { t } from '@/i18n';
import { hayCamaraWeb, rehacerFotosWeb } from './web/fotoWeb';

async function ajustarEnWeb(r: ImagePicker.ImagePickerResult, opciones: ImagePicker.ImagePickerOptions): Promise<ImagePicker.ImagePickerResult> {
  if (Platform.OS !== 'web') return r;
  const { resultado, ilegibles } = await rehacerFotosWeb(r, opciones);
  if (ilegibles > 0) avisar(t('comun:fotoIlegible.titulo'), t('comun:fotoIlegible.cuerpo'));
  return resultado;
}

export async function hacerFoto(opciones: ImagePicker.ImagePickerOptions): Promise<ImagePicker.ImagePickerResult> {
  let r: ImagePicker.ImagePickerResult;
  try {
    r = await ImagePicker.launchCameraAsync(opciones);
  } catch {
    r = await ImagePicker.launchImageLibraryAsync(opciones);
  }
  return ajustarEnWeb(r, opciones);
}

/** El selector de fotos (Finder o archivos en el ordenador). */
export async function elegirFoto(opciones: ImagePicker.ImagePickerOptions): Promise<ImagePicker.ImagePickerResult> {
  return ajustarEnWeb(await ImagePicker.launchImageLibraryAsync(opciones), opciones);
}

/** ¿Tiene sentido ofrecer «Hacer foto» aparte de «Galería»? */
export function ofreceCamara(): boolean {
  return Platform.OS !== 'web' || hayCamaraWeb();
}
