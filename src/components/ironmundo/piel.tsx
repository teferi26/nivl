// NIVL · Mundo IRON: la piel de IRON para las piezas base (src/design/piel.ts).
// Con <PielIron> alrededor, las hojas y formularios que ya existen (día y
// ejercicio de Gimnasio, cardio, comida) y el coach se pintan con el acento,
// los radios y las superficies de la lámina 2, sin copiarlos.

import type { ReactNode } from 'react';
import { PielContext, type Piel } from '@/design/piel';
import { A, acentoA, C, F, M, mezcla, px } from './tema';

export const PIEL_IRON: Piel = {
  acento: A,
  acentoBorde: acentoA(0.3),
  acentoFondo: mezcla(0.16, C.tarjeta),
  tarjeta: C.tarjeta,
  campo: C.fondo,
  borde: C.borde,
  sobreAcento: C.fondo,
  radio: px(10),
  radioBoton: M.radioBoton,
  radioChip: M.radioChip,
  radioHoja: px(22),
  fuenteBoton: F.xb,
  pantallaTransparente: true,
};

export function PielIron({ children, cubreArriba }: { children: ReactNode; cubreArriba?: boolean }) {
  return <PielContext.Provider value={cubreArriba ? { ...PIEL_IRON, cubreArriba } : PIEL_IRON}>{children}</PielContext.Provider>;
}
