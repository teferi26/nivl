// NIVL · Oráculo. La ruta solo junta las piezas (L-RADICAL §C, FASE3 G1):
// los datos, los efectos y el camino a NIVL Pro viven en useOraculo; lo que
// se pinta, en OraculoVista (pura, también en la galería /kit/pantallas);
// debajo, la hoja de la clave propia, el consentimiento de IA y la denuncia.

import { DenunciarIA } from '@/components/DenunciarIA';
import { HojaClave } from '@/components/oraculo/HojaClave';
import { OraculoVista } from '@/components/oraculo/OraculoVista';
import { useOraculo } from '@/components/oraculo/useOraculo';

export default function Oraculo() {
  const { vista, hojaClave, hojaConsentimiento, denuncia } = useOraculo();
  return (
    <>
      <OraculoVista {...vista} />
      {hojaConsentimiento}
      <HojaClave {...hojaClave} />
      <DenunciarIA respuesta={denuncia.respuesta} onClose={denuncia.onClose} />
    </>
  );
}
