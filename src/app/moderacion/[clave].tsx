// NIVL · Moderación: una denuncia o un perfil, con su contenido real y sus acciones.
import { useLocalSearchParams } from 'expo-router';
import { DetalleVista } from '@/components/moderacion/DetalleVista';
import { useDetalle } from '@/components/moderacion/useModeracion';

export default function DetalleModeracion() {
  const { clave } = useLocalSearchParams<{ clave: string }>();
  const props = useDetalle(String(clave ?? ''));
  return <DetalleVista {...props} />;
}
