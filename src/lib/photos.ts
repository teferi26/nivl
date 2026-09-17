// NIVL · Las fotos del gladiador y el resumen que las cuenta.
//
// Una foto por misión cumplida es opcional a propósito. Obligarla convierte
// cada misión en un trámite y se acaba dejando de completar; ofrecerla hace que
// las que subas sean las que de verdad querías recordar.

import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

export interface QuestPhoto {
  id: string;
  completion_id: string | null;
  quest_id: string | null;
  date: string;
  path: string;
  caption: string | null;
  created_at: string;
}

export interface Slide {
  tipo: 'portada' | 'dato' | 'foto' | 'duro' | 'cierre';
  titulo: string;
  texto: string;
  dato?: string;
  foto?: string;
}

export interface Recap {
  id: string;
  kind: 'semanal' | 'mensual';
  period_start: string;
  period_end: string;
  slides: Slide[];
  photo_count: number;
  seen_at: string | null;
  created_at: string;
}

const BUCKET = 'evidence';

/**
 * Sube la foto de una misión. La ruta es determinista —carpeta del usuario,
 * fecha, misión— para que reimportar o repetir no deje huérfanos acumulando
 * gigas en Storage, que es el fallo que ya nos mordió con las evidencias.
 */
export async function subirFotoMision(
  userId: string,
  input: { base64: string; questId: string | null; completionId: string | null; date: string; caption?: string },
): Promise<QuestPhoto> {
  const ruta = `${userId}/${input.date}_${input.questId ?? 'libre'}_${Date.now()}.jpg`;
  const { error: subida } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, decode(input.base64), { contentType: 'image/jpeg', upsert: true });
  if (subida) throw subida;

  const { data, error } = await supabase
    .from('quest_photos')
    .insert({
      user_id: userId,
      quest_id: input.questId,
      completion_id: input.completionId,
      date: input.date,
      path: ruta,
      caption: input.caption?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as QuestPhoto;
}

export async function fetchFotos(desde: string, hasta: string): Promise<QuestPhoto[]> {
  const { data, error } = await supabase
    .from('quest_photos')
    .select('*')
    .gte('date', desde)
    .lte('date', hasta)
    .order('date');
  if (error) throw error;
  return (data ?? []) as QuestPhoto[];
}

export async function contarFotos(desde: string, hasta: string): Promise<number> {
  const { count } = await supabase
    .from('quest_photos')
    .select('*', { count: 'exact', head: true })
    .gte('date', desde)
    .lte('date', hasta);
  return count ?? 0;
}

/**
 * URL temporal para pintar la foto. Firmada y no pública: el bucket es privado
 * y estas imágenes son lo más personal que guarda la app.
 */
export async function urlFirmada(path: string, segundos = 3600): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, segundos);
  return data?.signedUrl ?? null;
}

export async function fetchRecaps(): Promise<Recap[]> {
  const { data, error } = await supabase
    .from('recaps')
    .select('*')
    .order('period_start', { ascending: false })
    .limit(24);
  if (error) throw error;
  return (data ?? []) as Recap[];
}

export async function marcarVisto(id: string): Promise<void> {
  await supabase.from('recaps').update({ seen_at: new Date().toISOString() }).eq('id', id);
}
