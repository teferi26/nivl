// NIVL · General: la economía (la de WORK y FOUNDER, una sola en la app),
// PRESTADA a General (Prestado.tsx): cuentas, fijos, movimientos, brief e
// importar extracto sin cambiar de modo. La ruta antigua /economia sigue para
// los módulos que la enlazan.
import { PantallaWorkEconomia } from '@/components/economia/work/PantallaWorkEconomia';
import { PantallaPrestada } from '@/components/modos/mundo/Prestado';

export default function FinanzasPrestadas() {
  return (
    <PantallaPrestada>
      <PantallaWorkEconomia modo="work" />
    </PantallaPrestada>
  );
}
