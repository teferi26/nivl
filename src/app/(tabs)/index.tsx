// NIVL · Hoy. La ruta solo junta las piezas (L-RADICAL §C): los datos, los
// efectos y los cerrojos viven en useHoy; lo que se pinta, en HoyVista (pura,
// también en la galería /kit/pantallas); la hoja de completar va aparte.

import { CompletarSheet } from '@/components/CompletarSheet';
import { useCelebracion } from '@/components/celebracion/contexto';
import { PreguntaMedicionUso } from '@/components/consentimiento/ConsentimientoAnalitica';
import { HoyVista } from '@/components/hoy/HoyVista';
import { useHoy } from '@/components/hoy/useHoy';
import { HojaOpinion } from '@/components/opinion/HojaOpinion';

export default function Hoy() {
  const { vista, hojas } = useHoy();
  const { celebrando } = useCelebracion();
  return (
    <>
      <HoyVista {...vista} />
      <CompletarSheet quest={hojas.quest} onElegir={hojas.onElegir} onClose={hojas.onClose} />
      <HojaOpinion {...hojas.opinion} />
      {/* Medición de uso: una vez, a quien ya tenía la app (dictamen LSSI 3.1). */}
      <PreguntaMedicionUso enPausa={celebrando || hojas.opinion.visible || !!hojas.quest} />
    </>
  );
}
