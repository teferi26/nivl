// NIVL · General · Hoy: el cuartel general (lámina 4 de la P01,
// docs/modos/GENERAL.md). La ruta solo junta las piezas: los datos, los
// efectos y los cerrojos siguen en useHoy (la misma economía de siempre); lo
// que se pinta, en HoyGeneralVista (pura, también en /kit/general); la hoja de
// completar va aparte. La campaña activa sale de useCampanas.
//
// Modos: la placa de NIVL en la cabecera y el disco en la barra abren la rueda
// (con `modos_activos` y algún modo activado); «Tu arsenal» cambia de modo con
// UN toque, sin rueda.

import { router } from 'expo-router';
import { useMemo } from 'react';
import { CompletarSheet } from '@/components/CompletarSheet';
import { diasHasta } from '@/components/campanas/plazo';
import { useCampanas } from '@/components/campanas/useCampanas';
import { useCelebracion } from '@/components/celebracion/contexto';
import { PreguntaMedicionUso } from '@/components/consentimiento/ConsentimientoAnalitica';
import { ArsenalConectado, type AccesoGeneral } from '@/components/general/Arsenal';
import { HoyGeneralVista, type CampanaActivaHoy } from '@/components/general/HoyGeneralVista';
import { useHoy } from '@/components/hoy/useHoy';
import { EmblemaGeneral, useHayEmblema } from '@/components/modos/EmblemaMundo';
import { NovedadModos } from '@/components/modos/NovedadModos';
import { HojaOpinion } from '@/components/opinion/HojaOpinion';

/** A dónde lleva cada acceso de «Todo desde aquí» (pantallas que ya existen). */
function irAcceso(a: AccesoGeneral): void {
  switch (a) {
    case 'gym':
      return router.push('/gym');
    case 'dieta':
      return router.push('/dieta');
    case 'cardio':
      return router.push('/cardio');
    case 'foco':
      return router.push('/foco');
    case 'examenes':
      return router.push('/examenes');
    case 'economia':
      return router.push('/finanzas');
    case 'agenda':
      return router.push('/(tabs)/agenda');
    case 'diario':
      return router.push('/diario');
    case 'habitos':
      return router.push('/(tabs)/habitos');
  }
}

export default function Hoy() {
  const { vista, hojas, perfil } = useHoy();
  const campanas = useCampanas().vista;
  const { celebrando } = useCelebracion();
  const hayEmblema = useHayEmblema();

  const campana = useMemo((): CampanaActivaHoy | null | undefined => {
    if (!campanas.cargado) return undefined;
    const activa = campanas.campanas
      .filter((c) => c.status === 'active')
      .sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'))[0];
    if (!activa) return campanas.error ? undefined : null;
    return {
      id: activa.id,
      titulo: activa.title,
      hechas: activa.doneCount,
      total: activa.total,
      plazo: diasHasta(activa.deadline)?.texto ?? null,
      rango: activa.rank,
    };
  }, [campanas.cargado, campanas.campanas, campanas.error]);

  return (
    <>
      <HoyGeneralVista
        hoy={vista}
        emblema={hayEmblema ? <EmblemaGeneral /> : undefined}
        arsenal={<ArsenalConectado />}
        campana={campana}
        ir={{
          perfil: () => router.navigate('/(tabs)/perfil'),
          progresion: () => router.navigate({ pathname: '/(tabs)/avance', params: { ver: 'progresion' } }),
          coach: () => router.navigate('/(tabs)/coach'),
          habitos: () => router.navigate('/(tabs)/habitos'),
          campana: (id) => router.push({ pathname: '/dungeon/[id]', params: { id } }),
          campanas: () => router.navigate('/(tabs)/mazmorras'),
          acceso: irAcceso,
        }}
      />
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
