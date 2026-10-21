// NIVL · Mundo IRON: el inicio (lámina 2 de la P01): entreno de hoy, pesos y
// récords, rutinas, catálogo, dieta y coach. Los efectos en useInicioIron; lo
// que se pinta, en InicioIronVista. Con la sesión en marcha se pinta Gimnasio
// entero (el mismo useGym: la tabla de series, terminar y pagar). Datos de
// salud: guarda `gym`.
import { GuardaSaludIron } from '@/components/ironmundo/SaludIron';
import { GymVista } from '@/components/gym/GymVista';
import { InicioIronVista } from '@/components/ironmundo/InicioIronVista';
import { useInicioIron } from '@/components/ironmundo/useInicioIron';
import { EmblemaMundo } from '@/components/modos/EmblemaMundo';
import { CabeceraMundo } from '@/components/modos/mundo/CabeceraMundo';

export default function IronHoy() {
  return (
    <GuardaSaludIron routeName="gym">
      <Contenido />
    </GuardaSaludIron>
  );
}

function Contenido() {
  const { gym, mundo, vista } = useInicioIron();
  const v = gym.vista;
  if (v.entrenando) return <GymVista {...v} acciones={{ ...v.acciones, onVolver: undefined }} />;
  return <InicioIronVista cabecera={<CabeceraMundo modo="iron" nivel={mundo.nivel} emblema={<EmblemaMundo modo="iron" />} />} {...vista} />;
}
