// NIVL · El cuestionario de entrada, guardado en el teléfono hasta que la
// cuenta existe. Efectos aparte de la lógica pura (embudo.ts).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { validarRespuestas, type Respuestas } from './embudo';

const CLAVE = 'nivl.embudo.v1';

export async function guardarRespuestas(r: Respuestas): Promise<void> {
  try {
    await AsyncStorage.setItem(CLAVE, JSON.stringify(r));
  } catch {
    // Sin almacenamiento, el onboarding volverá a preguntar.
  }
}

export async function leerRespuestas(): Promise<Respuestas | null> {
  try {
    const v = await AsyncStorage.getItem(CLAVE);
    return v ? validarRespuestas(JSON.parse(v)) : null;
  } catch {
    return null;
  }
}

export async function olvidarRespuestas(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CLAVE);
  } catch {
    // Nada que hacer: la próxima cuenta en este teléfono sobreescribe.
  }
}
