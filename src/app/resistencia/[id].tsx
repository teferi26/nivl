// NIVL · IRON · Resistencia: el detalle de un entreno. Datos de salud: guarda `cardio`.
import { useLocalSearchParams } from 'expo-router';
import { PielIron } from '@/components/ironmundo/piel';
import { GuardaSaludIron } from '@/components/ironmundo/SaludIron';
import { DetalleVista } from '@/components/resistencia/DetalleVista';
import { HojaPulso } from '@/components/resistencia/HojaPulso';
import { useDetalle } from '@/components/resistencia/useDetalle';

export default function DetalleEntreno() {
  return (
    <PielIron>
      <GuardaSaludIron routeName="cardio">
        <Contenido />
      </GuardaSaludIron>
    </PielIron>
  );
}

function Contenido() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { hojaPulso, ...vista } = useDetalle(id);
  return (
    <>
      <DetalleVista {...vista} />
      <HojaPulso {...hojaPulso} />
    </>
  );
}
