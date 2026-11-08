// NIVL · Resistencia: forma, volumen, peso y récords. Los efectos en
// useProgreso; lo que se pinta, en ProgresoVista. Datos de salud: guarda `cardio`.
import { PielIron } from '@/components/ironmundo/piel';
import { GuardaSaludIron } from '@/components/ironmundo/SaludIron';
import { ProgresoVista } from '@/components/resistencia/ProgresoVista';
import { useProgreso } from '@/components/resistencia/useProgreso';

export default function ResistenciaProgreso() {
  return (
    <PielIron>
      <GuardaSaludIron routeName="cardio">
        <Contenido />
      </GuardaSaludIron>
    </PielIron>
  );
}

function Contenido() {
  return <ProgresoVista {...useProgreso()} />;
}
