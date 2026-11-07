// NIVL · Hacer una foto con alternativa. En el Mac («Designed for iPad»), en
// el Vision Pro como app de iPad y en el simulador no hay cámara trasera que
// abrir: `launchCameraAsync` lanza en vez de devolver `canceled`. Antes esa
// excepción se perdía en un manejador async y el botón no hacía nada. Ahora
// cae al selector de archivos y fotos (en el Mac abre el de Finder), con las
// mismas opciones: la evidencia, el diario o la foto de la sesión se pueden
// adjuntar igual.

import * as ImagePicker from 'expo-image-picker';

export async function hacerFoto(opciones: ImagePicker.ImagePickerOptions): Promise<ImagePicker.ImagePickerResult> {
  try {
    return await ImagePicker.launchCameraAsync(opciones);
  } catch {
    return ImagePicker.launchImageLibraryAsync(opciones);
  }
}
