// NIVL · Modos: lecturas y escrituras (efectos, con Supabase).
//
// Tablas de la migración 0068 (equipo servidor): `user_modes` (qué modos tiene
// activados cada gladiador, RLS de dueño) y `mode_xp` (XP por modo, la suma el
// servidor al completar). El modo activo de la pantalla es cosa del teléfono:
// va en AsyncStorage, por cuenta.
//
// Nada de esto se llama con el interruptor `modos_activos` apagado.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import {
  activadosDeFilas,
  esModo,
  filasUserModes,
  xpPorModo,
  type ModoEtiqueta,
  type ModoId,
} from './tipos';

const claveActivo = (userId: string) => `nivl.modo.activo.${userId}`;
const claveNovedad = (userId: string) => `nivl.modos.novedad.${userId}`;

/** Los modos activados de la cuenta (sin General, que siempre está). */
export async function leerActivados(userId: string): Promise<ModoEtiqueta[]> {
  const { data, error } = await supabase.from('user_modes').select('mode, enabled').eq('user_id', userId);
  if (error) throw error;
  return activadosDeFilas(data as { mode?: unknown; enabled?: unknown }[] | null);
}

/** Deja en `user_modes` la elección: los cuatro modos, con `enabled` según lo elegido. */
export async function guardarActivados(userId: string, elegidos: readonly ModoEtiqueta[]): Promise<void> {
  const { error } = await supabase
    .from('user_modes')
    .upsert(filasUserModes(userId, elegidos), { onConflict: 'user_id,mode' });
  if (error) throw error;
}

/** XP de cada modo (0 si aún no hay fila). */
export async function leerXpModos(userId: string): Promise<Record<ModoEtiqueta, number>> {
  const { data, error } = await supabase.from('mode_xp').select('mode, xp').eq('user_id', userId);
  if (error) throw error;
  return xpPorModo(data as { mode?: unknown; xp?: unknown }[] | null);
}

/** El modo que se dejó a la vista en este teléfono (null si nunca se eligió). */
export async function leerModoActivo(userId: string): Promise<ModoId | null> {
  try {
    const v = await AsyncStorage.getItem(claveActivo(userId));
    return esModo(v) ? v : null;
  } catch {
    return null;
  }
}

export async function guardarModoActivo(userId: string, modo: ModoId): Promise<void> {
  try {
    await AsyncStorage.setItem(claveActivo(userId), modo);
  } catch {
    // Sin almacenamiento, el modo vive hasta cerrar la app.
  }
}

/** «Novedad: elige tus modos»: ¿ya se cerró en este teléfono? Sin almacenamiento, sí (no insistir). */
export async function leerNovedadVista(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(claveNovedad(userId))) !== null;
  } catch {
    return true;
  }
}

export async function marcarNovedadVista(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(claveNovedad(userId), '1');
  } catch {
    // Sin almacenamiento: no vuelve en esta sesión (lo guarda el estado).
  }
}
