// NIVL · Métricas del panel admin: efectos. Cada RPC comprueba `es_admin()`
// (0072): esconder la pantalla no es la seguridad.

import { leerResumen, type CohorteRetencion, type DiaAltas, type Opinion, type PasoEmbudo, type Resumen } from './metricasAdmin';
import { supabase } from './supabase';

export interface Metricas {
  resumen: Resumen;
  altas: DiaAltas[];
  embudo: PasoEmbudo[];
  retencion: CohorteRetencion[];
}

export async function cuentaEsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('es_admin');
  if (error) throw error;
  return data === true;
}

export async function fetchMetricas(): Promise<Metricas> {
  const [resumen, altas, embudo, retencion] = await Promise.all([
    supabase.rpc('admin_resumen'),
    supabase.rpc('admin_altas_por_dia'),
    supabase.rpc('admin_embudo'),
    supabase.rpc('admin_retencion'),
  ]);
  if (resumen.error) throw resumen.error;
  return {
    resumen: leerResumen(resumen.data),
    // El detalle es accesorio: sin él, el resumen sale igual.
    altas: (altas.data ?? []) as DiaAltas[],
    embudo: (embudo.data ?? []) as PasoEmbudo[],
    retencion: (retencion.data ?? []) as CohorteRetencion[],
  };
}

export async function fetchOpiniones(): Promise<Opinion[]> {
  const { data, error } = await supabase.rpc('admin_opiniones', { p_limite: 50 });
  if (error) throw error;
  return (data ?? []) as Opinion[];
}
