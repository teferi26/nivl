// NIVL · El consentimiento para la IA: lectura y escritura (migración 0028).
//
// La parte pura (texto, versión, cómo se lee el estado) está en
// `consentmath.ts`. Aquí solo se habla con el servidor, que es quien exige el
// consentimiento: `coach`, `ritual` y `oracle` no llaman al modelo sin él.

import { AI_CONSENT_VERSION, leerConsentimiento, type EstadoConsentimiento } from './consentmath';
import { supabase } from './supabase';
import { ErrorVisible } from './validation';

export * from './consentmath';

// Recuerdo del último estado leído, por usuario: la hoja no debe preguntar al
// servidor en cada mensaje del chat. Se invalida al aceptar o retirar.
let recuerdo: { userId: string; estado: EstadoConsentimiento } | null = null;

async function usuarioActual(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function fetchConsentimiento(opts: { fresco?: boolean } = {}): Promise<EstadoConsentimiento> {
  const uid = await usuarioActual();
  if (!opts.fresco && uid && recuerdo?.userId === uid) return recuerdo.estado;
  const { data, error } = await supabase.rpc('my_ai_consent');
  if (error) throw error;
  const estado = leerConsentimiento(data);
  if (uid) recuerdo = { userId: uid, estado };
  return estado;
}

export function olvidarConsentimiento(): void {
  recuerdo = null;
}

export async function aceptarConsentimiento(): Promise<void> {
  const { data, error } = await supabase.rpc('accept_ai_consent', { p_version: AI_CONSENT_VERSION });
  if (error) throw error;
  const r = (data ?? {}) as { ok?: boolean; reason?: string };
  recuerdo = null;
  if (!r.ok) {
    throw new ErrorVisible(
      r.reason === 'version_obsoleta'
        ? 'El texto ha cambiado desde esta versión de NIVL. Actualiza la app para revisarlo.'
        : 'El sistema no ha podido guardar tu consentimiento.',
    );
  }
}

export async function retirarConsentimiento(): Promise<void> {
  const { error } = await supabase.rpc('withdraw_ai_consent');
  recuerdo = null;
  if (error) throw error;
}
