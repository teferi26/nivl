// NIVL · Mundo WORK: la pestaña Economía. Solo junta piezas: la cabecera del
// mundo (la misma de los demás), la vista, la revisión de un extracto (cuando
// la hay, ocupa la pestaña) y las hojas.

import { CabeceraMundo } from '@/components/modos/mundo/CabeceraMundo';
import { useMundo } from '@/components/modos/mundo/useMundo';
import { EmblemaMundo } from '@/components/modos/EmblemaMundo';
import {
  HojaCategorias,
  HojaCuenta,
  HojaElegirCategoria,
  HojaFijo,
  HojaImportar,
  HojaMovimiento,
  HojaTransferencia,
} from './HojasWork';
import { RevisionExtractoVista } from './RevisionExtractoVista';
import { useWorkEconomia } from './useWorkEconomia';
import { WorkEconomiaVista } from './WorkEconomiaVista';

export function PantallaWorkEconomia() {
  const mundo = useMundo('work');
  const { vista, revision, hojas, hojaConsentimiento } = useWorkEconomia();
  return (
    <>
      {revision ? (
        <RevisionExtractoVista {...revision} />
      ) : (
        <WorkEconomiaVista {...vista} cabecera={<CabeceraMundo modo="work" nivel={mundo.nivel} emblema={<EmblemaMundo modo="work" />} />} />
      )}
      <HojaMovimiento {...hojas.movimiento} />
      <HojaTransferencia {...hojas.transferencia} />
      <HojaCuenta {...hojas.cuenta} />
      <HojaFijo {...hojas.fijo} />
      <HojaCategorias {...hojas.categorias} />
      <HojaImportar {...hojas.importar} />
      <HojaElegirCategoria {...hojas.elegirCategoria} />
      {hojaConsentimiento}
    </>
  );
}
