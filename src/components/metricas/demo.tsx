// Demo de la galería /kit/pantallas (solo desarrollo). MetricasVista con datos
// de mentira: sin sesión ni Supabase.
import type { DemoPantalla } from '@/components/arena/galeria';
import type { Metricas } from '@/lib/metricas';
import type { Opinion } from '@/lib/metricasAdmin';
import { MetricasVista } from './MetricasVista';
import type { MetricasVistaProps, Pestana } from './useMetricas';

const nada = () => {};
const antes = (min: number) => new Date(Date.now() - min * 60000).toISOString();

const METRICAS: Metricas = {
  resumen: { usuarios: 1248, altasHoy: 14, altas7: 96, altas30: 412, activosHoy: 318, activos7: 702, activos30: 1010, onboarding: 1120, instalaciones: 1866, suscripciones: 87, opiniones: 34 },
  altas: Array.from({ length: 31 }, (_, i) => ({ dia: `2026-10-${String(i + 1).padStart(2, '0')}`, altas: Math.round(8 + 7 * Math.sin(i / 3) + i / 3), instalaciones: 20 })),
  embudo: [
    { paso: 'primer_arranque', instalaciones: 412, porcentaje: 100 },
    { paso: 'registro', instalaciones: 301, porcentaje: 73 },
    { paso: 'onboarding_fin', instalaciones: 244, porcentaje: 59 },
    { paso: 'primera_mision_completada', instalaciones: 180, porcentaje: 44 },
    { paso: 'd7', instalaciones: 74, porcentaje: 18 },
    { paso: 'compra_ok', instalaciones: 16, porcentaje: 4 },
  ],
  retencion: [{ instalaciones: 412, d1: 210, d3: 132, d7: 74 }],
};

const OPINIONES: Opinion[] = [
  { id: 'o1', created_at: antes(90), version: '1.0.11', gusta: 'Que el coach me dice qué toca y no tengo que pensar.', cambiaria: 'Poder mover un bloque del plan arrastrando.' },
  { id: 'o2', created_at: antes(1600), version: '1.0.9', gusta: null, cambiaria: 'Más ejercicios en casa.' },
];

function base(extra: Partial<MetricasVistaProps> = {}, pestana: Pestana = 'metricas'): MetricasVistaProps {
  return { loaded: true, admin: true, error: null, refreshing: false, pestana, metricas: METRICAS, opiniones: OPINIONES, onRefresh: nada, onPestana: nada, ...extra };
}

export const DEMO: DemoPantalla | null = {
  id: 'metricas',
  titulo: 'Métricas',
  marco: 'pila',
  estados: [
    { id: 'metricas', titulo: 'Métricas', render: () => <MetricasVista {...base()} /> },
    { id: 'opiniones', titulo: 'Opiniones', render: () => <MetricasVista {...base({}, 'opiniones')} /> },
    { id: 'cargando', titulo: 'Cargando', render: () => <MetricasVista {...base({ loaded: false, metricas: null })} /> },
    { id: 'sin-acceso', titulo: 'Sin acceso', render: () => <MetricasVista {...base({ admin: false })} /> },
  ],
};
