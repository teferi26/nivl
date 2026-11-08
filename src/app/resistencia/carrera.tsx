// NIVL · Resistencia: la carrera objetivo y su plan. Los efectos en useCarrera;
// lo que se pinta, en CarreraVista y HojaObjetivo. Datos de salud: guarda `cardio`.
import { CarreraVista } from '@/components/resistencia/CarreraVista';
import { HojaObjetivo } from '@/components/resistencia/HojaObjetivo';
import { useCarrera } from '@/components/resistencia/useCarrera';
import { PielIron } from '@/components/ironmundo/piel';
import { GuardaSaludIron } from '@/components/ironmundo/SaludIron';

export default function ResistenciaCarrera() {
  return (
    <PielIron>
      <GuardaSaludIron routeName="cardio">
        <Contenido />
      </GuardaSaludIron>
    </PielIron>
  );
}

function Contenido() {
  const { vista, hoja } = useCarrera();
  return (
    <>
      <CarreraVista {...vista} />
      <HojaObjetivo {...hoja} />
    </>
  );
}
