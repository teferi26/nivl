// NIVL · General · Arena: la competición con amigos rediseñada (ArenaGeneralVista):
// ranking por constancia con tu puesto fijo, podio, duelos con marcador y los
// pasados, solicitudes y añadir amigos. Sin ligas (LIGAS_VISIBLES apagado).
// Los datos son los de Amigos (PantallaAmigos conserva la hoja de seguridad);
// ludus, privacidad y bloqueados siguen en /amigos («Ajustes de la arena»).
import { PantallaAmigos } from '@/components/amigos/PantallaAmigos';
import { ArenaConectada } from '@/components/general/arena/ArenaConectada';
import { PielGeneral } from '@/components/general/piel';

export default function Arena() {
  return (
    <PielGeneral>
      <PantallaAmigos enPestana pintar={(d) => <ArenaConectada d={d} />} />
    </PielGeneral>
  );
}
