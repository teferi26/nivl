// NIVL · IRON · La técnica de un ejercicio del catálogo. Se abre desde
// Gimnasio («Ver técnica», solo con `modos_activos`); es de release, no de la
// galería. Un id que no existe vuelve a Gimnasio. Lleva tu historial de ese
// ejercicio y la carga de la próxima (useHistorialIron).

import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { TecnicaIron } from '@/components/iron/TecnicaIron';
import { useHistorialIron } from '@/components/iron/useHistorialIron';
import { volver } from '@/components/ui/Screen';
import { ejercicioPorId } from '@/iron/ejercicios';

export default function TecnicaRuta() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const ejercicio = id ? ejercicioPorId(id) : undefined;
  const historial = useHistorialIron(ejercicio);
  if (!ejercicio) return <Redirect href="/gym" />;
  return <TecnicaIron ejercicio={ejercicio} onVolver={() => volver(router)} historial={historial} />;
}
