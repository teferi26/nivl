// NIVL · Recuerdos. La ruta solo junta las piezas (L-RADICAL §C, FASE3 Lote
// F): los datos y la generación del pase viven en useResumen; la lista, en
// ResumenVista (pura, también en la galería /kit/pantallas); el pase abierto
// (sus efectos y su vista), en Pase. La hoja del consentimiento de IA va
// debajo de la lista.

import { Pase } from '@/components/resumen/Pase';
import { ResumenVista } from '@/components/resumen/ResumenVista';
import { useResumen } from '@/components/resumen/useResumen';

export default function Resumen() {
  const { abierto, cerrar, vista, hoja } = useResumen();
  if (abierto) return <Pase recap={abierto} onSalir={cerrar} />;
  return (
    <>
      <ResumenVista {...vista} />
      {hoja}
    </>
  );
}
