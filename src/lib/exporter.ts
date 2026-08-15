import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { supabase } from './supabase';

// TODA tabla con datos del cazador va aquí. La lista se quedó corta durante
// mucho tiempo: faltaban las siete de El Contrato y Mis Avances, así que la
// "copia de seguridad completa" perdía en silencio las reglas, las roturas,
// los canjes, la carta al futuro, las fotos del diario, el peso y las metas.
// Al añadir una tabla nueva al esquema, añádela también aquí.
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
  // El Contrato (0005)
  'rules',
  'rule_breaks',
  'bonus_redemptions',
  'journal_photos',
  'letters',
  // Mis avances (0007)
  'body_metrics',
  'goals',
  // El coach (0008): su memoria es tan tuya como el resto
  'coach_dossier',
  'coach_facts',
  'coach_threads',
  'coach_messages',
  'day_plans',
  'day_blocks',
  // El cuerpo (0012)
  'cardio_sessions',
  'nutrition_targets',
  'nutrition_logs',
  'training_prescriptions',
  // El dinero (0013): lo más sensible que guarda la app, y por eso mismo lo
  // que más tiene que poder llevarse entero quien quiera irse.
  'money_accounts',
  'transactions',
  'category_rules',
  'budgets',
  'money_plan',
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
