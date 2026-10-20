// NIVL · Mundo IRON: Rutinas. Es Gimnasio (useGym + GymVista + sus hojas),
// sin flecha de volver porque aquí es una pestaña. Datos de salud: guarda `gym`.
import { HealthConsentGuard } from '@/components/ConsentimientoSalud';
import { GymVista } from '@/components/gym/GymVista';
import { HojaDia, HojaEjercicio } from '@/components/gym/HojasGym';
import { useGym } from '@/components/gym/useGym';

export default function IronRutinas() {
  return (
    <HealthConsentGuard routeName="gym">
      <Contenido />
    </HealthConsentGuard>
  );
}

function Contenido() {
  const { vista, hojaDia, hojaEjercicio } = useGym();
  return (
    <>
      <GymVista {...vista} acciones={{ ...vista.acciones, onVolver: undefined }} />
      <HojaDia {...hojaDia} />
      <HojaEjercicio {...hojaEjercicio} />
    </>
  );
}
