// NIVL · General · Arena: la competición con amigos (ranking por constancia,
// podio, duelos de la semana, solicitudes, código y ludus; sin ligas, que
// siguen apagadas con LIGAS_VISIBLES). Es la pantalla de Amigos de siempre
// como pestaña, con el fondo y la piel de NIVL (oro) y sin flecha de volver.
import { PantallaAmigos } from '@/components/amigos/PantallaAmigos';
import { FondoGeneral } from '@/components/general/piezas';
import { PielGeneral } from '@/components/general/piel';

export default function Arena() {
  return (
    <FondoGeneral>
      <PielGeneral>
        <PantallaAmigos enPestana />
      </PielGeneral>
    </FondoGeneral>
  );
}
