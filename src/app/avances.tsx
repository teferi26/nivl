// NIVL · Avances. La ruta solo junta las piezas (L-RADICAL §C, FASE3 Lote F):
// los datos, los efectos y el pago (bloque B, src/lib/pagoActo.ts) viven en
// useAvances; lo que se pinta, en AvancesVista (pura, también en la galería
// /kit/pantallas). El aviso de salud y la fila de fotos llevan su propia
// lógica y entran como huecos; las dos hojas van debajo.

import { HojaMeta, HojaValor } from '@/components/avances/HojasAvances';
import { AvancesVista } from '@/components/avances/AvancesVista';
import { useAvances } from '@/components/avances/useAvances';
import { HealthConsentNotice } from '@/components/ConsentimientoSalud';
import { FilaFotosAvances } from '@/components/fotos/FilaFotosAvances';

export default function Avances() {
  const { vista, hojaMeta, hojaValor } = useAvances();
  return (
    <>
      <AvancesVista {...vista} avisoSalud={<HealthConsentNotice />} fotos={<FilaFotosAvances />} />
      <HojaMeta {...hojaMeta} />
      <HojaValor {...hojaValor} />
    </>
  );
}
