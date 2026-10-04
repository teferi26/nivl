// NIVL · Cardio. La ruta solo junta las piezas (L-RADICAL §C, FASE3 Lote E1):
// los datos, los efectos y el pago (bloque B, src/lib/pagoActo.ts) viven en
// useCardio; lo que se pinta, en CardioVista (pura, también en la galería
// /kit/pantallas); la hoja «Nueva sesión» va debajo.

import { CardioVista } from '@/components/cardio/CardioVista';
import { HojaCardio } from '@/components/cardio/HojaCardio';
import { useCardio } from '@/components/cardio/useCardio';

export default function Cardio() {
  const { vista, hoja } = useCardio();
  return (
    <>
      <CardioVista {...vista} />
      <HojaCardio {...hoja} />
    </>
  );
}
