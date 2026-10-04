import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// TODA tabla con datos del gladiador va aquí. La lista se quedó corta durante
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
  // La memoria visual (0014) y las marcas del contrato (0016). Las fotos son
  // lo más personal que guarda la app: si alguien se va, se va con ellas.
  'quest_photos',
  'recaps',
  'rule_checks',
  'body_profile',
  'health_consents',
  'health_state',
  'health_erasure_jobs',
  'ai_consents',
] as const;

// Export completo de los datos del usuario a un JSON compartible.
// Las evidencias (Storage) no se incluyen: solo sus rutas.
// `ancla`: rectángulo del botón en coordenadas de ventana; en iPad la hoja
// apunta a él (sin ancla, expo-sharing la abre abajo en el centro).
export async function exportAllData(ancla?: { x: number; y: number; width: number; height: number } | null): Promise<void> {
  // The owner-only rights RPC includes data isolated after withdrawal. Normal
  // SELECT would silently omit it under the health RLS policies.
  const { data: dump, error } = await supabase.rpc('export_my_data');
  if (error) throw error;
  for (const table of TABLES) {
    if (!Array.isArray(dump?.[table])) throw new Error('La exportación está incompleta.');
  }

  const nombre = `nivl-export-${Date.now()}.json`;
  if (Platform.OS === 'web') {
    descargarEnWeb(nombre, JSON.stringify(dump, null, 2));
    return;
  }

  const file = new File(Paths.cache, nombre);
  file.write(JSON.stringify(dump, null, 2));

  try {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('Compartir no está disponible en este dispositivo.');
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Exportar datos de NIVL',
      ...(ancla ? { anchor: ancla } : {}),
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

// En web, expo-file-system es un stub (no hay `File.write`): el volcado se
// descarga como Blob con un <a download> temporal. La URL se revoca siempre,
// para no dejar el JSON con datos personales colgado de la sesión del navegador.
function descargarEnWeb(nombre: string, contenido: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('La descarga no está disponible en este navegador.');
  }
  const url = URL.createObjectURL(new Blob([contenido], { type: 'application/json' }));
  const enlace = document.createElement('a');
  try {
    enlace.href = url;
    enlace.download = nombre;
    enlace.rel = 'noopener';
    enlace.style.display = 'none';
    document.body.appendChild(enlace);
    enlace.click();
  } finally {
    enlace.remove();
    // El clic ya ha copiado el Blob a la descarga; revocar en el siguiente
    // ciclo evita cortarla en navegadores que la inician de forma asíncrona.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
