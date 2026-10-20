// NIVL · Mundo IRON: Pesos, tus pesos y récords por ejercicio
// (usePesosIron + PesosIronVista). Datos de salud: guarda `gym`.
import { HealthConsentGuard } from '@/components/ConsentimientoSalud';
import { EmblemaMundo } from '@/components/modos/EmblemaMundo';
import { CabeceraMundo } from '@/components/modos/mundo/CabeceraMundo';
import { PesosIronVista } from '@/components/modos/mundo/PesosIronVista';
import { useMundo } from '@/components/modos/mundo/useMundo';
import { usePesosIron } from '@/components/modos/mundo/usePesosIron';

export default function IronPesos() {
  return (
    <HealthConsentGuard routeName="gym">
      <Contenido />
    </HealthConsentGuard>
  );
}

function Contenido() {
  const mundo = useMundo('iron');
  const estado = usePesosIron();
  return <PesosIronVista cabecera={<CabeceraMundo modo="iron" nivel={mundo.nivel} emblema={<EmblemaMundo modo="iron" />} />} estado={estado} />;
}
