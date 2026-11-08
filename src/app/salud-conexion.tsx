// NIVL · Conexión con Salud. La ruta solo junta las piezas: datos y efectos en
// useSaludConexion, lo que se pinta en SaludConexionVista.

import { SaludConexionVista } from '@/components/medicion/SaludConexionVista';
import { useSaludConexion } from '@/components/medicion/useSaludConexion';

export default function SaludConexion() {
  return <SaludConexionVista {...useSaludConexion()} />;
}
