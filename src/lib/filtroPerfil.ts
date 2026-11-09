// NIVL · El filtro de alias, títulos y fotos (0143, función `perfil-filtro`).
// Nunca lanza: si no responde, lo cambiado sigue oculto para los demás y se reintenta al volver a Perfil.

import { supabase } from './supabase';

export type EstadoFiltro = 'pendiente' | 'ok' | 'rechazado' | 'revision' | null;

export interface ResultadoFiltro {
  nombre: EstadoFiltro;
  titulo: EstadoFiltro;
  foto: EstadoFiltro;
}

export async function pasarFiltroPerfil(): Promise<ResultadoFiltro | null> {
  try {
    const { data, error } = await supabase.functions.invoke('perfil-filtro', { body: {} });
    return error ? null : (data as ResultadoFiltro);
  } catch {
    return null;
  }
}

/** Autoriza enviar ESTA foto al filtro. */
export async function permitirFiltroFoto(ruta: string): Promise<void> {
  const { error } = await supabase.rpc('social_filtro_permitir_foto', { p_path: ruta });
  if (error) throw error;
}
