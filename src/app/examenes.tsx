// NIVL · General: los exámenes de FOCUS, PRESTADOS a General (Prestado.tsx).
import { ExamenesVista } from '@/components/focus/ExamenesVista';
import { useExamenes } from '@/components/focus/useTemario';
import { PantallaPrestada } from '@/components/modos/mundo/Prestado';

function Examenes() {
  const { vista, extra } = useExamenes();
  return (
    <>
      <ExamenesVista {...vista} />
      {extra}
    </>
  );
}

export default function ExamenesPrestados() {
  return (
    <PantallaPrestada>
      <Examenes />
    </PantallaPrestada>
  );
}
