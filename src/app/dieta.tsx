// NIVL · Dieta. La ruta solo junta las piezas (L-RADICAL §C, FASE3 Oleada 2,
// lote E2): los datos, los efectos y los cerrojos viven en useDieta; lo que se
// pinta, en DietaVista (pura, también en la galería /kit/pantallas); la hoja
// de la comida va debajo.

import { DietaVista } from '@/components/dieta/DietaVista';
import { HojaComida } from '@/components/dieta/HojaComida';
import { useDieta } from '@/components/dieta/useDieta';

export default function Dieta() {
  const { vista, hoja } = useDieta();
  return (
    <>
      <DietaVista {...vista} />
      <HojaComida {...hoja} />
    </>
  );
}
