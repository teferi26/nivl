// NIVL · Mundo IRON: la pestaña Entreno (la ruta conserva su nombre de
// siempre, `iron-rutinas`). Rutinas, Pesos y Cardio en una pantalla
// (useEntrenoIron + EntrenoIronVista), con las hojas de Gimnasio y de Cardio
// en la piel de IRON (PielIron). Con la sesión en marcha, el entreno en curso
// (EntrenandoIronVista). Datos de salud: guarda `gym`.
import { HojaCardio } from '@/components/cardio/HojaCardio';
import { HojaDia, HojaEjercicio } from '@/components/gym/HojasGym';
import { EntrenandoIronVista } from '@/components/ironmundo/EntrenandoIronVista';
import { EntrenoIronVista } from '@/components/ironmundo/EntrenoIronVista';
import { PielIron } from '@/components/ironmundo/piel';
import { GuardaSaludIron } from '@/components/ironmundo/SaludIron';
import { useEntrenando } from '@/components/ironmundo/useEntrenando';
import { useEntrenoIron } from '@/components/ironmundo/useEntrenoIron';
import { EmblemaMundo } from '@/components/modos/EmblemaMundo';
import { CabeceraMundo } from '@/components/modos/mundo/CabeceraMundo';

export default function IronEntreno() {
  return (
    <PielIron>
      <GuardaSaludIron routeName="gym">
        <Contenido />
      </GuardaSaludIron>
    </PielIron>
  );
}

function Contenido() {
  const { gym, cardio, mundo, vista } = useEntrenoIron();
  const entrenando = useEntrenando(gym.vista);
  const cabecera = <CabeceraMundo modo="iron" nivel={mundo.nivel} emblema={<EmblemaMundo modo="iron" />} />;
  return (
    <>
      {gym.vista.entrenando ? <EntrenandoIronVista cabecera={cabecera} {...entrenando} /> : <EntrenoIronVista cabecera={cabecera} {...vista} />}
      <HojaDia {...gym.hojaDia} />
      <HojaEjercicio {...gym.hojaEjercicio} />
      <HojaCardio {...cardio.hoja} />
    </>
  );
}
