// NIVL · IRON · La técnica de un ejercicio del catálogo, en la piel del mundo
// IRON (lámina 2 de la P01). Se abre desde el catálogo, desde «Tus pesos y
// récords» y desde Gimnasio («Ver técnica», solo con `modos_activos`). Lleva tu
// historial de ese ejercicio y la carga de la próxima (useHistorialIron). Un id
// que no existe vuelve a Gimnasio.

import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useHistorialIron } from '@/components/iron/useHistorialIron';
import { PielIron } from '@/components/ironmundo/piel';
import { TecnicaIronVista } from '@/components/ironmundo/TecnicaIronVista';
import { volver } from '@/components/ui/Screen';
import { ejercicioPorId } from '@/iron/ejercicios';

export default function TecnicaRuta() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const ejercicio = id ? ejercicioPorId(id) : undefined;
  const historial = useHistorialIron(ejercicio);
  if (!ejercicio) return <Redirect href="/gym" />;
  return (
    <PielIron>
      <TecnicaIronVista ejercicio={ejercicio} onVolver={() => volver(router)} historial={historial} />
    </PielIron>
  );
}
