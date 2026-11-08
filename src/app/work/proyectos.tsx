// NIVL · WORK: proyectos y entregas. Fuera de la barra: se llega desde Hoy.
import { Redirect } from 'expo-router';
import { HojasProyectos } from '@/components/work/gestion/HojasProyectos';
import { ProyectosVista } from '@/components/work/gestion/ProyectosVista';
import { useProyectos } from '@/components/work/gestion/useProyectos';
import { useFlags } from '@/lib/flags';

export default function ProyectosRuta() {
  const { modos_activos: activo } = useFlags();
  if (!activo) return <Redirect href="/" />;
  return <Proyectos />;
}

function Proyectos() {
  const { vista, hojas } = useProyectos();
  return (
    <>
      <ProyectosVista {...vista} />
      <HojasProyectos {...hojas} />
    </>
  );
}
