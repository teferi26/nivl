// NIVL · IRON · El catálogo con técnica animada (mundo IRON → «Ver
// catálogo»). Es el mismo CatalogoIron de la hoja de Gimnasio: tocar un
// ejercicio abre su técnica (/iron/[id]). Sin `modos_activos`, a Gimnasio.
import { Redirect, router } from 'expo-router';
import { CatalogoIronPantalla } from '@/components/modos/mundo/CatalogoIronPantalla';
import { volver } from '@/components/ui/Screen';
import { ejercicioIronDe } from '@/iron/catalogo';
import { useFlags } from '@/lib/flags';

export default function CatalogoRuta() {
  const { modos_activos: activo } = useFlags();
  if (!activo) return <Redirect href="/gym" />;
  return (
    <CatalogoIronPantalla
      onVolver={() => volver(router)}
      onElegir={(nombre) => {
        const ej = ejercicioIronDe(nombre);
        if (ej) router.push({ pathname: '/iron/[id]', params: { id: ej.id } });
      }}
    />
  );
}
