// NIVL · Agenda. La ruta solo junta las piezas (L-RADICAL §C, FASE3 Lote C):
// los datos, los efectos y los cerrojos viven en useAgenda; lo que se pinta,
// en AgendaVista (pura, también en la galería /kit/pantallas); las hojas de
// nuevo evento y de detalle van debajo.

import { AgendaVista } from '@/components/agenda/AgendaVista';
import { HojaDetalle, HojaEvento } from '@/components/agenda/HojasAgenda';
import { useAgenda } from '@/components/agenda/useAgenda';

export default function Agenda() {
  const { vista, hojaEvento, hojaDetalle } = useAgenda();
  return (
    <>
      <AgendaVista {...vista} />
      <HojaEvento {...hojaEvento} />
      <HojaDetalle {...hojaDetalle} />
    </>
  );
}
