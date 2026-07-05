import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { supabase } from './supabase';

const TABLES = [
  'profiles',
  'quests',
  'completions',
  'events',
  'dungeons',
  'dungeon_tasks',
  'calendar_events',
  'gym_days',
  'gym_exercises',
  'gym_sessions',
  'gym_lifts',
  'meal_slots',
  'shopping_items',
  'journal_entries',
  'achievements',
] as const;

// Export completo de los datos del usuario a un JSON compartible.
// Las evidencias (Storage) no se incluyen: solo sus rutas.
export async function exportAllData(): Promise<void> {
  const dump: Record<string, unknown> = {
    app: 'NIVL',
    version: 1,
    exported_at: new Date().toISOString(),
  };
  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select('*');
    if (error) throw new Error(`Error exportando ${table}: ${error.message}`);
    dump[table] = data ?? [];
  }

  const file = new File(Paths.cache, `nivl-export-${Date.now()}.json`);
  file.write(JSON.stringify(dump, null, 2));

  try {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('Compartir no está disponible en este dispositivo.');
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Exportar datos de NIVL',
    });
  } finally {
    // No dejar el volcado con datos personales en la caché del dispositivo.
    try {
      file.delete();
    } catch {
      // ignora: si no se puede borrar, la caché del SO lo hará
    }
  }
}
