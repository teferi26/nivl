// NIVL · Los televisores de la cuenta: las RPC de la 0125 desde el iPhone.
// La lógica de los "no" vive en el servidor; aquí solo se tipan sus respuestas.

import { supabase } from './supabase';

export type MotivoTv = 'codigo_invalido' | 'demasiados_intentos' | 'tope_tv' | 'borrado_pendiente';
export interface RespuestaTv {
  ok: boolean;
  reason?: MotivoTv;
  nombre?: string;
}
export interface Televisor {
  id: string;
  nombre: string;
  ultimo_uso: string;
}

export async function fetchTelevisores(): Promise<Televisor[]> {
  const { data, error } = await supabase.rpc('tv_mis_dispositivos');
  if (error) throw error;
  return (data ?? []) as Televisor[];
}

export async function responderCodigoTv(accion: 'aprobar' | 'rechazar', codigo: string): Promise<RespuestaTv> {
  const { data, error } = await supabase.rpc(accion === 'aprobar' ? 'tv_aprobar' : 'tv_rechazar', { p_codigo: codigo });
  if (error) throw error;
  return (data as RespuestaTv | null) ?? { ok: false, reason: 'codigo_invalido' };
}

export async function revocarTelevisor(id: string): Promise<void> {
  const { error } = await supabase.rpc('tv_revocar', { p_id: id });
  if (error) throw error;
}
