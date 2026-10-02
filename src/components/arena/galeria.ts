// NIVL · Arena: el contrato de la galería de pantallas (solo desarrollo).
//
// Cada encargo del rediseño rellena su `src/components/<carpeta>/demo.tsx` con
// un `DEMO: DemoPantalla` y la galería (/kit/pantallas) lo pinta a 375, 430,
// 744, 1024 y 1440 sin sesión ni Supabase. Mientras sea null, «Pendiente».

import type { ReactElement } from 'react';

export type IdPantalla = 'hoy' | 'coach' | 'perfil' | 'amigos' | 'onboarding' | 'habitos' | 'campanas';

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
];
