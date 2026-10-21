// NIVL · Mundo FOCUS: Temario (asignaturas, temas, repasos, flashcards, horas,
// horario de clases y métodos de estudio).
import { TemarioVista } from '@/components/focus/TemarioVista';
import { useTemario } from '@/components/focus/useTemario';

export default function FocusTemario() {
  const { vista, extra } = useTemario();
  return (
    <>
      <TemarioVista {...vista} />
      {extra}
    </>
  );
}
