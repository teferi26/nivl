// NIVL · Nutrición. La ruta solo junta las piezas (L-RADICAL §C, FASE3
// Oleada 2, lote E2): los datos, los efectos, el cobro del día y los cerrojos
// viven en useNutricion; lo que se pinta, en NutricionVista (pura, también en
// la galería /kit/pantallas).

import { NutricionVista } from '@/components/nutricion/NutricionVista';
import { useNutricion } from '@/components/nutricion/useNutricion';

export default function Nutricion() {
  return <NutricionVista {...useNutricion()} />;
}
