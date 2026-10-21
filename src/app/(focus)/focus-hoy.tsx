// NIVL · Mundo FOCUS: el inicio, «el bloque de foco» (P01, lámina 3): pomodoro,
// exámenes, temario, plan de estudio de hoy, misiones de FOCUS y coach.
import { FocusHoyVista } from '@/components/focus/FocusHoyVista';
import { useFocusHoy } from '@/components/focus/useFocusHoy';

export default function FocusHoy() {
  const { vista, extra } = useFocusHoy();
  return (
    <>
      <FocusHoyVista {...vista} />
      {extra}
    </>
  );
}
