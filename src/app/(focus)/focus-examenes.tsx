// NIVL · Mundo FOCUS: Exámenes (próximos, plan automático, notas y media,
// exámenes anteriores).
import { ExamenesVista } from '@/components/focus/ExamenesVista';
import { useExamenes } from '@/components/focus/useTemario';

export default function FocusExamenes() {
  const { vista, extra } = useExamenes();
  return (
    <>
      <ExamenesVista {...vista} />
      {extra}
    </>
  );
}
