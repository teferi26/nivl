// NIVL · Diario. La ruta solo junta las piezas (L-RADICAL §C, FASE3 Lote D):
// los datos, los efectos y los cerrojos viven en useDiario; lo que se pinta,
// en DiarioVista (pura, también en la galería /kit/pantallas).

import { DiarioVista } from '@/components/diario/DiarioVista';
import { useDiario } from '@/components/diario/useDiario';

export default function Diario() {
  return <DiarioVista {...useDiario()} />;
}
