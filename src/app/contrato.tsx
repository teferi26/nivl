// NIVL · Contrato. La ruta solo junta las piezas (L-RADICAL §C, FASE3 G1):
// los datos, los efectos y los cerrojos viven en useContrato; lo que se
// pinta, en ContratoVista (pura, también en la galería /kit/pantallas); las
// hojas de norma nueva y de carta van debajo.

import { ContratoVista } from '@/components/contrato/ContratoVista';
import { HojaCarta, HojaNorma } from '@/components/contrato/HojasContrato';
import { useContrato } from '@/components/contrato/useContrato';

export default function Contrato() {
  const { vista, hojaNorma, hojaCarta } = useContrato();
  return (
    <>
      <ContratoVista {...vista} />
      <HojaNorma {...hojaNorma} />
      <HojaCarta {...hojaCarta} />
    </>
  );
}
