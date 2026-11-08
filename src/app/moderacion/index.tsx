// NIVL · Moderación: la bandeja. Solo la ve quien está en `admins`: fila en
// Perfil y push de moderación. El servidor lo comprueba en cada RPC (0088).
import { BandejaVista } from '@/components/moderacion/BandejaVista';
import { useBandeja } from '@/components/moderacion/useModeracion';

export default function Moderacion() {
  const props = useBandeja();
  return <BandejaVista {...props} />;
}
