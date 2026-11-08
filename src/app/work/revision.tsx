// NIVL · WORK: revisión semanal. Con `?ver=carga`, solo el detalle de la carga
// (es adonde lleva su línea en Hoy).
import { Redirect, useLocalSearchParams } from 'expo-router';
import { CargaVista, RevisionVista } from '@/components/work/gestion/RevisionVista';
import { useRevision } from '@/components/work/gestion/useRevision';
import { useFlags } from '@/lib/flags';

export default function RevisionRuta() {
  const { modos_activos: activo } = useFlags();
  if (!activo) return <Redirect href="/" />;
  return <Revision />;
}

function Revision() {
  const { ver } = useLocalSearchParams<{ ver?: string }>();
  const { revision, carga } = useRevision();
  return ver === 'carga' ? <CargaVista {...carga} /> : <RevisionVista {...revision} />;
}
