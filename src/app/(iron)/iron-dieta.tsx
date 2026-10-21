// NIVL · Mundo IRON: la pestaña Dieta. El parte del día, el agua, la comida
// libre, las comidas del plan de hoy y el peso corporal (useDietaIron +
// DietaIronVista), con la hoja de la comida de Dieta y el aviso de lo pagado.
// Datos de salud: guarda `nutricion` (sin consentimiento, la puerta que lo pide).
import { HojaComida } from '@/components/dieta/HojaComida';
import { GuardaSaludIron } from '@/components/ironmundo/SaludIron';
import { DietaIronVista } from '@/components/ironmundo/DietaIronVista';
import { useDietaIron } from '@/components/ironmundo/useDietaIron';
import { EmblemaMundo } from '@/components/modos/EmblemaMundo';
import { CabeceraMundo } from '@/components/modos/mundo/CabeceraMundo';
import { Toast } from '@/components/ui';

export default function IronDieta() {
  return (
    <GuardaSaludIron routeName="nutricion">
      <Contenido />
    </GuardaSaludIron>
  );
}

function Contenido() {
  const { mundo, hojaComida, avances, vista } = useDietaIron();
  const toast = avances.vista.toast;
  return (
    <>
      <DietaIronVista
        cabecera={<CabeceraMundo modo="iron" nivel={mundo.nivel} emblema={<EmblemaMundo modo="iron" />} />}
        overlay={<Toast message={toast?.texto ?? null} anuncio={toast?.anuncio} onDone={avances.vista.acciones.onToastHecho} />}
        {...vista}
      />
      <HojaComida {...hojaComida} />
    </>
  );
}
