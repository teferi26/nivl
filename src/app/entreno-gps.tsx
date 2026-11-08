// NIVL · Entreno con GPS. La ruta solo junta las piezas: datos y efectos en
// useEntrenoGps, lo que se pinta en EntrenoGpsVista.

import { EntrenoGpsVista } from '@/components/medicion/EntrenoGpsVista';
import { useEntrenoGps } from '@/components/medicion/useEntrenoGps';

export default function EntrenoGps() {
  return <EntrenoGpsVista {...useEntrenoGps()} />;
}
