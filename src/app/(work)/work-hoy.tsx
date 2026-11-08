// NIVL · Mundo WORK: Hoy, el centro de mando del trabajo.
import { useWorkHoy } from '@/components/work/useWorkHoy';
import { WorkHoyVista } from '@/components/work/WorkHoyVista';

export default function WorkHoy() {
  const { vista, extra } = useWorkHoy();
  return (
    <>
      <WorkHoyVista {...vista} />
      {extra}
    </>
  );
}
