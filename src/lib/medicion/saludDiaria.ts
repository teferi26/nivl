// NIVL · Subida del resumen diario de Salud y la preferencia del coach.
//
// Solo sube con el permiso de salud vigente, y solo lee HealthKit si la persona
// ya pasó por su diálogo en alguna categoría (aquí no se pregunta nada).

import { dateKey } from '@/lib/dates';
import { fetchHealthConsent } from '@/lib/health';
import { supabase } from '@/lib/supabase';
import { disponible, hayQuePreguntar, resumenDia, type CategoriaSalud, type ResumenDia } from './saludNativa';

const CATEGORIAS_RESUMEN: CategoriaSalud[] = ['peso', 'pasos', 'energia', 'fc', 'sueno'];

/** Hoy y los dos anteriores: Salud termina de sincronizar con retraso. */
const DIAS_A_SUBIR = 3;

async function algunaPreguntada(): Promise<boolean> {
  const pendientes = await Promise.all(CATEGORIAS_RESUMEN.map((c) => hayQuePreguntar([c])));
  return pendientes.some((p) => !p);
}

function diasHaciaAtras(n: number): string[] {
  const dias: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    // Por calendario, no restando 24 h: un cambio de hora repetiría un día.
    d.setDate(d.getDate() - i);
    dias.push(dateKey(d));
  }
  return dias;
}

const tieneDatos = (r: ResumenDia) =>
  r.pasos !== null || r.kcal_activas !== null || r.fc_media !== null || r.fc_max !== null
  || r.fc_reposo !== null || r.sueno_min !== null || r.peso_kg !== null;

/** Devuelve true si no ha fallado nada, aunque no hubiera datos que subir. */
export async function subirResumenesSalud(userId: string, dias: number = DIAS_A_SUBIR): Promise<boolean> {
  try {
    if (!disponible() || !(await algunaPreguntada())) return true;
    if (!(await fetchHealthConsent()).accepted) return false;
    const resumenes = await Promise.all(diasHaciaAtras(dias).map(resumenDia));
    const filas = resumenes
      .filter((r): r is ResumenDia => r !== null && tieneDatos(r))
      .map((r) => ({ ...r, user_id: userId }));
    if (!filas.length) return true;
    const { error } = await supabase.from('salud_diaria').upsert(filas, { onConflict: 'user_id,fecha' });
    return !error;
  } catch {
    return false;
  }
}

export async function leerEnviarACoach(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('salud_preferencias')
    .select('enviar_a_coach')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.enviar_a_coach === true;
}

export async function fijarEnviarACoach(userId: string, valor: boolean): Promise<void> {
  const { error } = await supabase
    .from('salud_preferencias')
    .upsert({ user_id: userId, enviar_a_coach: valor, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}
