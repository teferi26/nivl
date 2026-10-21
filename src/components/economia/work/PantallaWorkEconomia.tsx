// NIVL · La pestaña Economía de WORK y de FOUNDER (una sola economía en la
// app). Solo junta piezas: la cabecera del mundo (la misma de los demás), la
// vista, la revisión de un extracto (cuando la hay, ocupa la pestaña) y las
// hojas. El acento sale del modo con `AcentoEconomia`.

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
import { AcentoEconomia, type ModoEconomia } from './PiezasWork';
import { RevisionExtractoVista } from './RevisionExtractoVista';
import { useWorkEconomia } from './useWorkEconomia';
import { WorkEconomiaVista } from './WorkEconomiaVista';

export function PantallaWorkEconomia({ modo = 'work' }: { modo?: ModoEconomia }) {
  const mundo = useMundo(modo);
  const { vista, revision, hojas, hojaConsentimiento } = useWorkEconomia(modo);
  return (
    <AcentoEconomia modo={modo}>
      {revision ? (
        <RevisionExtractoVista {...revision} />
      ) : (
        <WorkEconomiaVista {...vista} cabecera={<CabeceraMundo modo={modo} nivel={mundo.nivel} emblema={<EmblemaMundo modo={modo} />} />} />
      )}
      <HojaMovimiento {...hojas.movimiento} />
      <HojaTransferencia {...hojas.transferencia} />
      <HojaCuenta {...hojas.cuenta} />
      <HojaFijo {...hojas.fijo} />
      <HojaCategorias {...hojas.categorias} />
      <HojaImportar {...hojas.importar} />
      <HojaElegirCategoria {...hojas.elegirCategoria} />
      {hojaConsentimiento}
    </AcentoEconomia>
  );
}

/** FOUNDER usa exactamente la misma economía que WORK, con su acento. */
export function PantallaFounderEconomia() {
  return <PantallaWorkEconomia modo="founder" />;
}
