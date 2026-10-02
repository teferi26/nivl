import { EDAD_MINIMA } from './consentmath';
import { supabase } from './supabase';
import { ErrorVisible } from './validation';

/** Solo una respuesta positiva del servidor abre las pantallas de la cuenta. */
export async function fetchEdadConfirmada(): Promise<boolean> {
  const { data, error } = await supabase.rpc('my_age_confirmation');
  if (error) throw error;
  if (typeof data !== 'boolean') throw new Error('Respuesta de edad inválida');
  return data;
}

export async function confirmarEdad(): Promise<void> {
  const { data, error } = await supabase.rpc('confirm_minimum_age', { p_min_age: EDAD_MINIMA });
  if (error) throw error;
  if (data !== true) throw new ErrorVisible('No se ha guardado la confirmación. Vuelve a intentarlo.');
}

// ── Mayoría de edad (18+) para fotos corporales, su análisis por IA y compartirlas.
// La comprueba el servidor (migración 0050: confirm_adult / my_adult_confirmation
// y las políticas del bucket `progress`); esto solo decide qué enseña la UI.

/** ¿Hay confirmación de 18+? Sin la RPC (servidor anterior a 0050) cuenta como no. */
export async function fetchMayorDeEdadConfirmada(): Promise<boolean> {
  const { data, error } = await supabase.rpc('my_adult_confirmation');
  if (error) {
    if (faltaLaRpc(error)) return false;
    throw error;
  }
  return data === true;
}

/** Confirma 18+ (declaración del usuario, idempotente). */
export async function confirmarMayorDeEdad(): Promise<void> {
  const { error } = await supabase.rpc('confirm_adult');
  if (error) {
    if (faltaLaRpc(error)) throw new ErrorVisible('Actualiza NIVL para usar las fotos de progreso.');
    throw error;
  }
}

function faltaLaRpc(error: { code?: string; message?: string }): boolean {
  return error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message ?? '');
}
