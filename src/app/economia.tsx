// NIVL · Economía. La ruta solo junta las piezas (L-RADICAL §C, FASE3 G2):
// los datos, los efectos y los cerrojos viven en useEconomia; lo que se pinta,
// en EconomiaVista (pura, también en la galería /kit/pantallas); las hojas de
// clasificar y de efectivo y la del consentimiento de IA van debajo.

import { EconomiaVista } from '@/components/economia/EconomiaVista';
import { HojaClasificar, HojaEfectivo } from '@/components/economia/HojasEconomia';
import { useEconomia } from '@/components/economia/useEconomia';

export default function Economia() {
  const { vista, hojaClasificar, hojaEfectivo, hojaConsentimiento } = useEconomia();
  return (
    <>
      <EconomiaVista {...vista} />
      <HojaClasificar {...hojaClasificar} />
      <HojaEfectivo {...hojaEfectivo} />
      {hojaConsentimiento}
    </>
  );
}
