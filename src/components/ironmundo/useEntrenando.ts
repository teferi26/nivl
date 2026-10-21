// NIVL · Mundo IRON: el entreno en marcha a partir de lo que ya da useGym
// (series, notas, foto, terminar). Solo añade el reloj: cuándo empezó.

import { useEffect, useState } from 'react';
import type { GymVistaProps } from '@/components/gym/GymVista';
import { GYM_SESSION_XP } from '@/lib/game';
import type { EntrenandoIronVistaProps } from './EntrenandoIronVista';

/** El instante en que `entrenando` pasó a verdadero (o ahora, si aún no). */
function useDesde(entrenando: boolean): number {
  const [desde, setDesde] = useState(() => Date.now());
  useEffect(() => {
    if (entrenando) setDesde(Date.now());
  }, [entrenando]);
  return desde;
}

export function useEntrenando(v: GymVistaProps): Omit<EntrenandoIronVistaProps, 'cabecera'> {
  const desde = useDesde(v.entrenando);
  const dia = v.dias.find((d) => d.day_of_week === v.hoyDia)?.name ?? null;
  return {
    dia,
    desde,
    xpSesion: GYM_SESSION_XP,
    series: v.series,
    notas: v.notas,
    fotoLista: v.fotoLista,
    ocupado: v.ocupado,
    tecnicaDe: v.tecnicaDe,
    acciones: {
      onCambiarSerie: v.acciones.onCambiarSerie,
      onAnadirSerie: v.acciones.onAnadirSerie,
      onQuitarSerie: v.acciones.onQuitarSerie,
      onNotas: v.acciones.onNotas,
      onFoto: v.acciones.onFoto,
      onTerminar: v.acciones.onTerminar,
    },
  };
}
