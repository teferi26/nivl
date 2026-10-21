// NIVL · General: el temario de FOCUS, PRESTADO a General (Prestado.tsx).
import { TemarioVista } from '@/components/focus/TemarioVista';
import { useTemario } from '@/components/focus/useTemario';
import { PantallaPrestada } from '@/components/modos/mundo/Prestado';

function Temario() {
  const { vista, extra } = useTemario();
  return (
    <>
      <TemarioVista {...vista} />
      {extra}
    </>
  );
}

export default function TemarioPrestado() {
  return (
    <PantallaPrestada>
      <Temario />
    </PantallaPrestada>
  );
}
