// NIVL · Hoy. La ruta solo junta las piezas (L-RADICAL §C): los datos, los
// efectos y los cerrojos viven en useHoy; lo que se pinta, en HoyVista (pura,
// también en la galería /kit/pantallas); la hoja de completar va aparte.
// Modos F1: el selector de modo solo con `modos_activos` encendido y algún
// modo activado además de General.

import { CompletarSheet } from '@/components/CompletarSheet';
import { useCelebracion } from '@/components/celebracion/contexto';
import { PreguntaMedicionUso } from '@/components/consentimiento/ConsentimientoAnalitica';
import { HoyVista } from '@/components/hoy/HoyVista';
import { useHoy } from '@/components/hoy/useHoy';
import { SelectorModo } from '@/components/modos/SelectorModo';
import { HojaOpinion } from '@/components/opinion/HojaOpinion';
import { useModo } from '@/modos';

export default function Hoy() {
  const { vista, hojas } = useHoy();
  const { celebrando } = useCelebracion();
  const modos = useModo();
  const selector =
    modos.activo && modos.disponibles.length > 1 ? (
      <SelectorModo modo={modos.modo} disponibles={modos.disponibles} alCambiar={modos.cambiar} />
    ) : undefined;
  return (
    <>
      <HoyVista {...vista} selectorModo={selector} />
      <CompletarSheet quest={hojas.quest} onElegir={hojas.onElegir} onClose={hojas.onClose} />
      <HojaOpinion {...hojas.opinion} />
      {/* Medición de uso: una vez, a quien ya tenía la app (dictamen LSSI 3.1). */}
      <PreguntaMedicionUso enPausa={celebrando || hojas.opinion.visible || !!hojas.quest} />
    </>
  );
}
