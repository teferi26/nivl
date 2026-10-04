// NIVL · Arena: el contrato de la galería de pantallas (solo desarrollo).
//
// Cada encargo del rediseño rellena su `src/components/<carpeta>/demo.tsx` con
// un `DEMO: DemoPantalla` y la galería (/kit/pantallas) lo pinta a 375, 430,
// 744, 1024 y 1440 sin sesión ni Supabase. Mientras sea null, «Pendiente».

import type { ReactElement } from 'react';

export type IdPantalla =
  | 'hoy'
  | 'coach'
  | 'perfil'
  | 'amigos'
  | 'onboarding'
  | 'habitos'
  | 'campanas'
  | 'fotos'
  // Fase 3 (docs/design-v2/FASE3.md): cada lote rellena su demo.tsx.
  | 'acceso'
  | 'puertas'
  | 'agenda'
  | 'diario'
  | 'gym'
  | 'cardio'
  | 'nutricion'
  | 'dieta'
  | 'compra'
  | 'avances'
  | 'informe'
  | 'resumen'
  | 'oraculo'
  | 'contrato'
  | 'memoria'
  | 'economia'
  | 'creador';

export interface EstadoDemo {
  /** Va en la URL: /kit/pantallas?pantalla=hoy&estado=<id>. */
  id: string;
  titulo: string;
  /** Pinta la vista con datos de mentira. Puede devolver una Screen. */
  render: () => ReactElement;
}

export interface DemoPantalla {
  id: IdPantalla;
  titulo: string;
  estados: EstadoDemo[];
  /**
   * Dónde vive la pantalla en la app, para medir el hueco de contenido:
   * `pestanas` (por defecto) resta el raíl o la barra lateral (a 1024 quedan
   * 784); `pila` es una pantalla de la pila sin navegación al lado (login,
   * diario, gimnasio): el hueco es el ancho entero.
   */
  marco?: 'pestanas' | 'pila';
}

/** Orden de las pantallas en la galería. */
export const PANTALLAS_DEMO: { id: IdPantalla; titulo: string }[] = [
  { id: 'hoy', titulo: 'Hoy' },
  { id: 'coach', titulo: 'Coach' },
  { id: 'perfil', titulo: 'Perfil' },
  { id: 'amigos', titulo: 'Amigos' },
  { id: 'onboarding', titulo: 'Onboarding' },
  { id: 'habitos', titulo: 'Hábitos' },
  { id: 'campanas', titulo: 'Campañas' },
  { id: 'fotos', titulo: 'Fotos' },
  { id: 'acceso', titulo: 'Acceso' },
  { id: 'puertas', titulo: 'Puertas' },
  { id: 'agenda', titulo: 'Agenda' },
  { id: 'diario', titulo: 'Diario' },
  { id: 'gym', titulo: 'Gimnasio' },
  { id: 'cardio', titulo: 'Cardio' },
  { id: 'nutricion', titulo: 'Nutrición' },
  { id: 'dieta', titulo: 'Dieta' },
  { id: 'compra', titulo: 'Compra' },
  { id: 'avances', titulo: 'Avances' },
  { id: 'informe', titulo: 'Informe' },
  { id: 'resumen', titulo: 'Resumen' },
  { id: 'oraculo', titulo: 'Oráculo' },
  { id: 'contrato', titulo: 'Contrato' },
  { id: 'memoria', titulo: 'Memoria' },
  { id: 'economia', titulo: 'Economía' },
  { id: 'creador', titulo: 'Creador' },
];
