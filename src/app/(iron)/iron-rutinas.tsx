// NIVL · Mundo IRON: la pestaña Entreno (la ruta conserva su nombre de
// siempre, `iron-rutinas`). Rutinas, Pesos y Cardio en una pantalla
// (useEntrenoIron + EntrenoIronVista), con las hojas de Gimnasio y de Cardio.
// Con la sesión en marcha, Gimnasio entero (la tabla de series, terminar y
// pagar). Datos de salud: guarda `gym`.
import { HojaCardio } from '@/components/cardio/HojaCardio';
import { GuardaSaludIron } from '@/components/ironmundo/SaludIron';
import { GymVista } from '@/components/gym/GymVista';
import { HojaDia, HojaEjercicio } from '@/components/gym/HojasGym';
import { EntrenoIronVista } from '@/components/ironmundo/EntrenoIronVista';
import { useEntrenoIron } from '@/components/ironmundo/useEntrenoIron';
import { EmblemaMundo } from '@/components/modos/EmblemaMundo';
import { CabeceraMundo } from '@/components/modos/mundo/CabeceraMundo';

export default function IronEntreno() {
  return (
    <GuardaSaludIron routeName="gym">
      <Contenido />
    </GuardaSaludIron>
  );
}

function Contenido() {
  const { gym, cardio, mundo, vista } = useEntrenoIron();
  const v = gym.vista;
  return (
    <>
      {v.entrenando ? (
        <GymVista {...v} acciones={{ ...v.acciones, onVolver: undefined }} />
      ) : (
        <EntrenoIronVista cabecera={<CabeceraMundo modo="iron" nivel={mundo.nivel} emblema={<EmblemaMundo modo="iron" />} />} {...vista} />
      )}
      <HojaDia {...gym.hojaDia} />
      <HojaEjercicio {...gym.hojaEjercicio} />
      <HojaCardio {...cardio.hoja} />
    </>
  );
}
