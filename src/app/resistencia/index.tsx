// NIVL · IRON · Resistencia: el hub. Los efectos en useHub; lo que se pinta, en
// HubVista; las hojas, debajo. Datos de salud: guarda `cardio`.
import { PielIron } from '@/components/ironmundo/piel';
import { GuardaSaludIron } from '@/components/ironmundo/SaludIron';
import { HojaBienestar } from '@/components/resistencia/HojaBienestar';
import { HojaEntreno } from '@/components/resistencia/HojaEntreno';
import { HojaUbicacion } from '@/components/resistencia/HojaUbicacion';
import { HubVista } from '@/components/resistencia/HubVista';
import { useHub } from '@/components/resistencia/useHub';

export default function Resistencia() {
  return (
    <PielIron>
      <GuardaSaludIron routeName="cardio">
        <Contenido />
      </GuardaSaludIron>
    </PielIron>
  );
}

function Contenido() {
  const { vista, hojaEntreno, hojaUbicacion, hojaBienestar } = useHub();
  return (
    <>
      <HubVista {...vista} />
      <HojaEntreno {...hojaEntreno} />
      <HojaUbicacion {...hojaUbicacion} />
      <HojaBienestar {...hojaBienestar} />
    </>
  );
}
