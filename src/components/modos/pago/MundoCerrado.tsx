// NIVL · La puerta de un mundo sin pagar, con sus efectos. La pone LayoutMundo.

import { useAuth } from '@/lib/auth';
import type { ModoDePago } from '@/lib/planesmodo';
import { useModo } from '@/modos/ModoProvider';
import { irAlMundo } from '@/modos/rutasModo';
import { recargarDerechos } from '@/modos/useDerechos';
import { MundoCerradoVista } from './MundoCerradoVista';
import { OfertaModosVista } from './OfertaModosVista';
import { useOfertaModos } from './useOfertaModos';

export function MundoCerrado({ modo }: { modo: ModoDePago }) {
  const { session } = useAuth();
  const modos = useModo();
  const oferta = useOfertaModos({
    modoInicial: modo,
    onComprado: () => void recargarDerechos(session?.user.id ?? null),
  });
  return (
    <MundoCerradoVista
      modo={modo}
      oferta={<OfertaModosVista oferta={oferta} etiquetaSalida="Volver a NIVL" onSalir={() => irAlMundo('general', modos.cambiar)} />} // i18n-ok: pantalla de compra, en español como ProOffer
    />
  );
}
