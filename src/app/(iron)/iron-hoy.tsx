// NIVL · Mundo IRON: el inicio (lámina 2 de la P01): entreno de hoy, pesos y
// récords, rutinas, catálogo, dieta y coach. Los efectos en useInicioIron; lo
// que se pinta, en InicioIronVista. Con la sesión en marcha, el entreno en
// curso en la piel de IRON (EntrenandoIronVista, el mismo useGym: la tabla de
// series, terminar y pagar). Datos de salud: guarda `gym`.
import { EntrenandoIronVista } from '@/components/ironmundo/EntrenandoIronVista';
import { InicioIronVista } from '@/components/ironmundo/InicioIronVista';
import { PielIron } from '@/components/ironmundo/piel';
import { GuardaSaludIron } from '@/components/ironmundo/SaludIron';
import { useEntrenando } from '@/components/ironmundo/useEntrenando';
import { useInicioIron } from '@/components/ironmundo/useInicioIron';
import { EmblemaMundo } from '@/components/modos/EmblemaMundo';
import { CabeceraMundo } from '@/components/modos/mundo/CabeceraMundo';

export default function IronHoy() {
  return (
    <PielIron>
      <GuardaSaludIron routeName="gym">
        <Contenido />
      </GuardaSaludIron>
    </PielIron>
  );
}

function Contenido() {
  const { gym, mundo, vista } = useInicioIron();
  const entrenando = useEntrenando(gym.vista);
  const cabecera = <CabeceraMundo modo="iron" nivel={mundo.nivel} emblema={<EmblemaMundo modo="iron" />} />;
  if (gym.vista.entrenando) return <EntrenandoIronVista cabecera={cabecera} {...entrenando} />;
  return <InicioIronVista cabecera={cabecera} {...vista} />;
}
