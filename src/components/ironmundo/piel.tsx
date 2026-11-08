// NIVL · Mundo IRON: la piel de IRON para las piezas base (src/design/piel.ts).
// Con <PielIron> alrededor, las hojas y formularios que ya existen (día y
// ejercicio de Gimnasio, cardio, comida) y el coach se pintan en Ónix sin
// copiarlos: botón principal en hueso, oro solo en marcos y en lo elegido.

import type { ReactNode } from 'react';
import { ink, oro, radio, vidrio } from '@/design/tokens';
import { PielContext, type Piel } from '@/design/piel';
import { F, H } from './tema';

export const PIEL_IRON: Piel = {
  acento: H,
  acentoBorde: oro.borde,
  acentoFondo: oro.tenue,
  // Las hojas tapan lo de detrás: superficie opaca (SISTEMA.md, ink1).
  tarjeta: ink.ink1,
  campo: vidrio.campo,
  borde: vidrio.borde,
  sobreAcento: ink.ink0,
  radio: radio.chip,
  radioBoton: radio.control,
  radioChip: radio.chip,
  radioHoja: radio.hoja,
  fuenteBoton: F.b,
  pantallaTransparente: true,
};

export function PielIron({ children, cubreArriba }: { children: ReactNode; cubreArriba?: boolean }) {
  return <PielContext.Provider value={cubreArriba ? { ...PIEL_IRON, cubreArriba } : PIEL_IRON}>{children}</PielContext.Provider>;
}
