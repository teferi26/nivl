// NIVL · WORK: horas por proyecto. Fuera de la barra: se llega desde Hoy.
import { Redirect } from 'expo-router';
import { HojaApuntar, HorasVista } from '@/components/work/gestion/HorasVista';
import { useHoras } from '@/components/work/gestion/useHoras';
import { useFlags } from '@/lib/flags';

export default function HorasRuta() {
  const { modos_activos: activo } = useFlags();
  if (!activo) return <Redirect href="/" />;
  return <Horas />;
}

function Horas() {
  const { vista, hoja } = useHoras();
  return (
    <>
      <HorasVista {...vista} />
      <HojaApuntar {...hoja} />
    </>
  );
}
