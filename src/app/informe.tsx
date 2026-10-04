// NIVL · Informe. La ruta solo junta las piezas (L-RADICAL §C, FASE3 Lote F):
// los datos, los efectos y la consulta al Oráculo viven en useInforme; las
// cuentas de la semana, en derivarInforme (puro); lo que se pinta, en
// InformeVista (pura, también en la galería /kit/pantallas). La hoja del
// consentimiento de IA va debajo.

import { InformeVista } from '@/components/informe/InformeVista';
import { useInforme } from '@/components/informe/useInforme';

export default function Informe() {
  const { vista, hoja } = useInforme();
  return (
    <>
      <InformeVista {...vista} />
      {hoja}
    </>
  );
}
