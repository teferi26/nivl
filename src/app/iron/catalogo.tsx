// NIVL · IRON · El catálogo con técnica animada (lámina 2 de la P01, a la
// derecha): búsqueda, grupos, la técnica en bucle con sus músculos y «Más
// de…». Con `?dia=<id>` (desde Entreno) añade el ejercicio a ese día de la
// rutina. Sin `modos_activos`, a Gimnasio.
//
// Con dos paneles (iPad, Mac, Vision Pro, iPhone Duo abierto) es un
// maestro-detalle: el catálogo a la izquierda y la técnica completa con tu
// historial a la derecha; elegir un ejercicio cambia el detalle sin navegar.
// En el iPhone (y el Duo plegado), como siempre: «Ver técnica» abre /iron/[id].
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useHistorialIron } from '@/components/iron/useHistorialIron';
import { CatalogoIronVista } from '@/components/ironmundo/CatalogoIronVista';
import { PielIron } from '@/components/ironmundo/piel';
import { TecnicaIronVista } from '@/components/ironmundo/TecnicaIronVista';
import { useCatalogoIron } from '@/components/ironmundo/useCatalogoIron';
import { MaestroDetalle, useMaestroDetalle } from '@/components/ui/MaestroDetalle';
import type { Ejercicio } from '@/iron/tipos';
import { useFlags } from '@/lib/flags';

export default function CatalogoRuta() {
  const { modos_activos: activo } = useFlags();
  if (!activo) return <Redirect href="/gym" />;
  return <Catalogo />;
}

function Catalogo() {
  const { dia } = useLocalSearchParams<{ dia?: string }>();
  const reparto = useMaestroDetalle();
  const props = useCatalogoIron(typeof dia === 'string' && dia ? dia : null, { enPanel: reparto != null });
  return (
    <PielIron>
      <MaestroDetalle reparto={reparto} lista={<CatalogoIronVista {...props} />} detalle={<TecnicaEnPanel ejercicio={props.elegido} />} />
    </PielIron>
  );
}

/** La técnica del elegido, con su historial, en el panel derecho. */
function TecnicaEnPanel({ ejercicio }: { ejercicio: Ejercicio }) {
  const historial = useHistorialIron(ejercicio);
  return <TecnicaIronVista ejercicio={ejercicio} historial={historial} />;
}
