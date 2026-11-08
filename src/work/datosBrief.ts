// NIVL · WORK: el brief guardado con su fecha (efecto). Las filas de
// money_briefs las escribe siempre la función `economia` con IA (0075).

import { supabase } from '@/lib/supabase';

export interface BriefGuardado {
  texto: string;
  generado: string | null;
}

/** Null si no lo hay o falta la 0075: el brief nunca tumba la pantalla. */
export async function briefConFecha(mes: string): Promise<BriefGuardado | null> {
  const { data, error } = await supabase.from('money_briefs').select('text, created_at').eq('month', mes).maybeSingle();
  if (error || !data) return null;
  const f = data as { text: string; created_at: string | null };
  return { texto: String(f.text), generado: f.created_at ?? null };
}
