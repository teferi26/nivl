// NIVL · Moderación: llamadas al servidor (0088). La seguridad está en cada
// RPC (exigir_admin); esconder la pantalla es solo comodidad.
import { supabase } from './supabase';
import { leerBandeja, respuestaAccion, type Bandeja, type RespuestaAccion, type TipoDenuncia } from './moderacionmath';

export async function fetchEsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('es_admin');
  if (error) throw error;
  return data === true;
}

export async function fetchBandeja(): Promise<Bandeja> {
  const { data, error } = await supabase.rpc('admin_moderacion_bandeja');
  if (error) throw error;
  return leerBandeja(data);
}

async function accion(nombre: string, args: Record<string, unknown>): Promise<RespuestaAccion> {
  const { data, error } = await supabase.rpc(nombre, args);
  if (error) throw error;
  return respuestaAccion(data);
}

export const descartarDenuncia = (tipo: TipoDenuncia, id: string, nota: string) =>
  accion('admin_moderacion_descartar', { p_tipo: tipo, p_id: id, p_nota: nota });

export const resolverDenuncia = (tipo: TipoDenuncia, id: string, nota: string) =>
  accion('admin_moderacion_resolver', { p_tipo: tipo, p_id: id, p_nota: nota });

export const suspenderPerfil = (userId: string, nota: string, denuncia: string | null) =>
  accion('admin_moderacion_suspender', { p_user: userId, p_nota: nota, p_denuncia: denuncia });

export const levantarSuspension = (userId: string, version: string, nota: string) =>
  accion('admin_moderacion_levantar', { p_user: userId, p_version: version, p_nota: nota });

export const marcarRevisado = (userId: string, version: string, nota: string) =>
  accion('admin_moderacion_marcar_revisado', { p_user: userId, p_version: version, p_nota: nota });
