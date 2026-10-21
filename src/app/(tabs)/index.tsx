// NIVL · Hoy. La ruta solo junta las piezas (L-RADICAL §C): los datos, los
// efectos y los cerrojos viven en useHoy; lo que se pinta, en HoyVista (pura,
// también en la galería /kit/pantallas); la hoja de completar va aparte.
// Modos: el emblema del modo (EmblemaNivl: rueda P01, sonido y vibración P10)
// solo con `modos_activos` encendido y algún modo activado además de General
// (tras guardar la «Novedad: elige tus modos» aparece en el acto). Cada modo
// es un mundo: elegir uno lleva a su inicio (rutasModo.ts → irAlMundo).

import { CompletarSheet } from '@/components/CompletarSheet';
import { useCelebracion } from '@/components/celebracion/contexto';
import { PreguntaMedicionUso } from '@/components/consentimiento/ConsentimientoAnalitica';
import { HoyVista } from '@/components/hoy/HoyVista';
import { useHoy } from '@/components/hoy/useHoy';
import { EmblemaNivl } from '@/components/modos/EmblemaMundo';
import { NovedadModos } from '@/components/modos/NovedadModos';
import { HojaOpinion } from '@/components/opinion/HojaOpinion';
import { marcoDe } from '@/design/responsive';
import { useAnchoUtil } from '@/design/useSizeClass';
import { useModo } from '@/modos';

export default function Hoy() {
  const { vista, hojas, perfil } = useHoy();
  const { celebrando } = useCelebracion();
  const modos = useModo();
  // En compact el emblema va en el centro de la barra inferior ((tabs)/_layout).
  const compacto = marcoDe(useAnchoUtil()).sizeClass === 'compact';
  const emblema = !compacto && modos.activo && modos.disponibles.length > 1 ? <EmblemaNivl /> : undefined;
  return (
    <>
      <HoyVista {...vista} selectorModo={emblema} />
      <CompletarSheet quest={hojas.quest} onElegir={hojas.onElegir} onClose={hojas.onClose} />
      <HojaOpinion {...hojas.opinion} />
      {/* Medición de uso: una vez, a quien ya tenía la app (dictamen LSSI 3.1). */}
      <PreguntaMedicionUso enPausa={celebrando || hojas.opinion.visible || !!hojas.quest} />
      {/* Modos: «Novedad: elige tus modos», una vez, a quien ya tenía la app y no tiene ninguno. */}
      <NovedadModos
        onboardingHecho={perfil.onboardingHecho}
        kind={perfil.kind}
        enPausa={celebrando || hojas.opinion.visible || !!hojas.quest}
      />
    </>
  );
}
