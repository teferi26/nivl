// NIVL · Fotos de progreso: la capa de datos (L5 · A).
//
// Consume el contrato de 0050 sin cambiarlo:
//   - metadatos por la RPC `my_progress_photos_meta` (sin path ni URL);
//   - la fila se inserta ANTES de subir (la política del bucket exige que
//     exista) y, si la subida falla, se borra y se relanza;
//   - `upsert: false`: un objeto de `progress` nunca se sobrescribe;
//   - firmas de 60 s, siempre tras `requireHealthConsent()`.
// Nada se guarda en local salvo la copia temporal para compartir, que se
// borra al salir de la pantalla.

import { decode } from 'base64-arraybuffer';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { requireHealthConsent } from '@/lib/health';
import type { FotoProgreso, Pose } from '@/lib/progressPhotos';
import { supabase } from '@/lib/supabase';
import { ErrorVisible } from '@/lib/validation';
import { cabe, MENSAJE_PESO, rutaFoto, uuidV4 } from './modelo';

const BUCKET = 'progress';
/** La firma dura lo justo para pintar la miniatura. */
const FIRMA_S = 60;

function aFoto(x: unknown): FotoProgreso | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as { id?: unknown; fecha?: unknown; pose?: unknown; peso_kg?: unknown };
  if (typeof o.id !== 'string' || typeof o.fecha !== 'string') return null;
  if (o.pose !== 'frente' && o.pose !== 'lado' && o.pose !== 'espalda') return null;
  const kg = typeof o.peso_kg === 'number' ? o.peso_kg : typeof o.peso_kg === 'string' ? Number(o.peso_kg) : null;
  return { id: o.id, fecha: o.fecha.slice(0, 10), pose: o.pose, pesoKg: kg !== null && Number.isFinite(kg) ? kg : null };
}

/** Metadatos de todas las fotos (la RPC devuelve como mucho 200, más recientes primero). */
export async function listarFotos(): Promise<FotoProgreso[]> {
  const { data, error } = await supabase.rpc('my_progress_photos_meta', { p_from: null });
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map(aFoto).filter((f): f is FotoProgreso => f !== null);
}

/** URL firmada (60 s) por id. Las que no se puedan firmar no salen. */
export async function firmar(uid: string, ids: readonly string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  await requireHealthConsent();
  const rutas = ids.map((id) => rutaFoto(uid, id));
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(rutas, FIRMA_S);
  if (error) throw error;
  const porRuta = new Map<string, string>();
  for (const d of data ?? []) {
    if (d && d.path && d.signedUrl && !d.error) porRuta.set(d.path, d.signedUrl);
  }
  const salida: Record<string, string> = {};
  ids.forEach((id, i) => {
    const url = porRuta.get(rutas[i]);
    if (url) salida[id] = url;
  });
  return salida;
}

/** Sube una foto: consentimiento → tamaño → id → fila → objeto. */
export async function subirFoto(
  uid: string,
  foto: { base64: string; fecha: string; pose: Pose },
): Promise<FotoProgreso> {
  await requireHealthConsent();
  if (!cabe(foto.base64)) throw new ErrorVisible(MENSAJE_PESO);
  const id = uuidV4();
  const path = rutaFoto(uid, id);
  const { error: errFila } = await supabase
    .from('progress_photos')
    .insert({ id, user_id: uid, taken_on: foto.fecha, pose: foto.pose, path });
  if (errFila) throw errFila;
  const { error: errSubida } = await supabase.storage
    .from(BUCKET)
    .upload(path, decode(foto.base64), { contentType: 'image/jpeg', upsert: false });
  if (errSubida) {
    // Sin objeto, la fila sobra: se quita para no dejar una foto fantasma.
    await supabase.from('progress_photos').delete().eq('id', id).then(() => {}, () => {});
    throw errSubida;
  }
  return { id, fecha: foto.fecha, pose: foto.pose, pesoKg: null };
}

/** Borra el objeto y luego la fila (al revés, un fallo dejaría un objeto huérfano). */
export async function borrarFoto(uid: string, id: string): Promise<void> {
  const { error: errObjeto } = await supabase.storage.from(BUCKET).remove([rutaFoto(uid, id)]);
  if (errObjeto) throw errObjeto;
  const { error } = await supabase.from('progress_photos').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Copia temporal para la tarjeta de compartir (la tarjeta lleva una URI
 * local, nunca una URL firmada). Siempre el mismo nombre, que se sobrescribe.
 * En la web no hay sistema de archivos: null.
 */
export async function descargarParaCompartir(url: string, nombre: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const archivo = await File.downloadFileAsync(url, new File(Paths.cache, nombre), { idempotent: true });
    return archivo.uri;
  } catch {
    return null;
  }
}

/** Borra las copias temporales (o cualquier archivo local de la hoja de nueva foto). */
export function borrarTemporales(nombres: readonly string[], uris: readonly string[] = []): void {
  if (Platform.OS === 'web') return;
  const archivos = [...nombres.map((n) => new File(Paths.cache, n)), ...uris.map((u) => new File(u))];
  for (const f of archivos) {
    try {
      if (f.exists) f.delete();
    } catch {
      /* ya no estaba */
    }
  }
}

/** Nombres fijos de las copias de compartir. */
export const TEMP_ANTES = 'nivl-progreso-antes.jpg';
export const TEMP_DESPUES = 'nivl-progreso-despues.jpg';
