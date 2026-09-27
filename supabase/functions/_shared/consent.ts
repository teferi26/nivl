// NIVL · El consentimiento para la IA, del lado del servidor (migración 0028).
//
// Las funciones que hablan con un modelo (`coach`, `ritual`, `oracle`) lo
// comprueban ANTES de cualquier llamada: sin consentimiento vigente no sale ni
// un byte del gladiador hacia Anthropic o DeepSeek. La app enseña la hoja y
// guarda la respuesta, pero quien manda es esto.
//
// Cerrado por defecto: si la comprobación falla (red, migración sin aplicar),
// se trata como "no se puede llamar al modelo", nunca como "adelante".

import type { Db } from './db.ts';

/** Motivo que viaja en el 403 para que la app abra la hoja en vez de un error. */
export const SIN_CONSENTIMIENTO = 'sin_consentimiento';

export const MENSAJE_SIN_CONSENTIMIENTO =
  'Antes de usar la IA tienes que aceptar el envío de tus datos al proveedor de IA.';

/**
 * true = hay consentimiento vigente; false = no lo hay; null = no se ha podido
 * comprobar (quien llama decide cómo decirlo, pero no llama al modelo).
 */
export async function consentimientoIa(admin: Db, userId: string): Promise<boolean | null> {
  const { data, error } = await admin.rpc('ai_consent_ok', { p_user: userId });
  if (error) {
    console.error('ai_consent_ok falló:', error.message);
    return null;
  }
  return data === true;
}
