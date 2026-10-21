// NIVL · General: el foco (pomodoro, plan de estudio, exámenes) PRESTADO de
// FOCUS para quien lo hace todo desde General (docs/modos/GENERAL.md). Es la
// misma pantalla que el inicio de FOCUS; Prestado.tsx pone «volver» y lleva los
// saltos internos a las rutas prestadas.
import { FocusHoyVista } from '@/components/focus/FocusHoyVista';
import { useFocusHoy } from '@/components/focus/useFocusHoy';
import { PantallaPrestada } from '@/components/modos/mundo/Prestado';

function Foco() {
  const { vista, extra } = useFocusHoy();
  return (
    <>
      <FocusHoyVista {...vista} />
      {extra}
    </>
  );
}

export default function FocoPrestado() {
  return (
    <PantallaPrestada>
      <Foco />
    </PantallaPrestada>
  );
}
