// NIVL · WORK: la pestaña Agenda. Solo junta la vista y sus hojas.

import { HojaDetalle, HojaEvento } from '@/components/agenda/HojasAgenda';
import { HojaCalendario, HojaRapida } from './HojasWorkAgenda';
import { useWorkAgenda } from './useWorkAgenda';
import { WorkAgendaVista } from './WorkAgendaVista';

export function PantallaWorkAgenda() {
  const { vista, hojaEvento, hojaDetalle, hojaRapida, hojaCalendario } = useWorkAgenda();
  return (
    <>
      <WorkAgendaVista {...vista} />
      <HojaEvento {...hojaEvento} />
      <HojaDetalle {...hojaDetalle} />
      <HojaRapida {...hojaRapida} />
      <HojaCalendario {...hojaCalendario} />
    </>
  );
}
