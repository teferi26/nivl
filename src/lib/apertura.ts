// NIVL · Última apertura (0048_competicion.sql, docs/game-v2/PLAN-AVISOS.md).
//
// El servidor necesita saber el último día en que se abrió la app para no
// escribir a quien lleva una semana fuera y para el tope de 1 push al día.
// `tocarApertura()` llama a touch_open() UNA vez por día local y no lanza
// nunca: es accesorio y no puede tumbar Hoy.

import { dateKey } from './dates';
import { supabase } from './supabase';

/** Día (dateKey) ya tocado, o en vuelo. null = aún no. */
let ultimoDia: string | null = null;

/** Servidor sin la 0048: la función no existe. No se reintenta en todo el día. */
function faltaLaRpc(code: string | undefined): boolean {
  return code === 'PGRST202' || code === '42883';
}

export async function tocarApertura(): Promise<void> {
  const hoy = dateKey();
  if (ultimoDia === hoy) return;
  // Se marca antes de la llamada: dos cargas seguidas de Hoy no la repiten.
  ultimoDia = hoy;
  try {
    const { error } = await supabase.rpc('touch_open');
    if (error && !faltaLaRpc(error.code)) {
      // Error transitorio (red, sesión): se olvida el día para reintentar.
      if (ultimoDia === hoy) ultimoDia = null;
    }
  } catch {
    if (ultimoDia === hoy) ultimoDia = null;
  }
}
