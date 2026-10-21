// NIVL · IRON · El catálogo con técnica animada (lámina 2 de la P01, a la
// derecha): búsqueda, grupos, la técnica en bucle con sus músculos y «Más
// de…». Con `?dia=<id>` (desde Entreno) añade el ejercicio a ese día de la
// rutina. Sin `modos_activos`, a Gimnasio.
import { Redirect, useLocalSearchParams } from 'expo-router';
import { CatalogoIronVista } from '@/components/ironmundo/CatalogoIronVista';
import { PielIron } from '@/components/ironmundo/piel';
import { useCatalogoIron } from '@/components/ironmundo/useCatalogoIron';
import { useFlags } from '@/lib/flags';

export default function CatalogoRuta() {
  const { modos_activos: activo } = useFlags();
  if (!activo) return <Redirect href="/gym" />;
  return <Catalogo />;
}

function Catalogo() {
  const { dia } = useLocalSearchParams<{ dia?: string }>();
  const props = useCatalogoIron(typeof dia === 'string' && dia ? dia : null);
  return (
    <PielIron>
      <CatalogoIronVista {...props} />
    </PielIron>
  );
}
