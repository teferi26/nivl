// NIVL · La prueba automática de Élite: lecturas y marcas (efectos).
//
// La fila de `subscriptions` la puede leer su dueño (como fetchSubscription
// del Oráculo). `ai_status()` no basta: con la prueba vencida devuelve
// `plan: null` y no se sabría que hubo una. Las marcas de lo ya enseñado van
// en el teléfono, por cuenta. Las reglas, en pruebaAutomath.ts.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { marcasDe, type MarcasPrueba, type SuscripcionPrueba } from './pruebaAutomath';
import { supabase } from './supabase';

const clave = (userId: string) => `nivl.pruebaAuto.${userId}`;

/** La suscripción de la cuenta (null si no hay fila). Lanza si falla la red. */
export async function leerSuscripcionPrueba(userId: string): Promise<SuscripcionPrueba | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan, status, current_period_end')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as SuscripcionPrueba | null) ?? null;
}

export async function leerMarcasPrueba(userId: string): Promise<MarcasPrueba> {
  try {
    const raw = await AsyncStorage.getItem(clave(userId));
    return marcasDe(raw ? JSON.parse(raw) : null);
  } catch {
    return marcasDe(null);
  }
}

export async function guardarMarcasPrueba(userId: string, marcas: MarcasPrueba): Promise<void> {
  try {
    await AsyncStorage.setItem(clave(userId), JSON.stringify(marcas));
  } catch {
    // Sin almacenamiento, como mucho se repite una pantalla.
  }
}
