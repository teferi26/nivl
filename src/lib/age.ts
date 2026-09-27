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
