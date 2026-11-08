// NIVL · Ayuda contextual: el hook para leer y cambiar las pistas desde cualquier pantalla.

import { useSyncExternalStore } from 'react';
import {
  apagarPistasGuardado,
  descartarPistaGuardada,
  instantaneaAyuda,
  reactivarPistasGuardado,
  suscribirAyuda,
  type InstantaneaAyuda,
} from './ayudaEstado';
import { estaDescartada } from './ayudaMath';

export function useInstantaneaAyuda(): InstantaneaAyuda {
  return useSyncExternalStore(suscribirAyuda, instantaneaAyuda, instantaneaAyuda);
}

export interface Ayuda {
  /** false hasta leer el almacén. */
  cargado: boolean;
  descartada: (id: string) => boolean;
  descartar: (id: string) => void;
  pistasApagadas: boolean;
  apagarPistas: () => void;
  /** Enciende las pistas y vuelve a enseñar las que se habían cerrado. */
  reactivarPistas: () => void;
}

export function useAyuda(): Ayuda {
  const { cargado, estado } = useInstantaneaAyuda();
  return {
    cargado,
    descartada: (id) => estaDescartada(estado, id),
    descartar: descartarPistaGuardada,
    pistasApagadas: estado.apagadas,
    apagarPistas: apagarPistasGuardado,
    reactivarPistas: reactivarPistasGuardado,
  };
}
