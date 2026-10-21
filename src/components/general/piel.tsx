// NIVL · Modo GENERAL: la piel de NIVL para las piezas base (src/design/piel.ts).
// Con <PielGeneral> alrededor, lo que ya existe y se reutiliza en General
// (Arena, el detalle de una campaña, sus hojas) toma el oro, los radios y las
// superficies de la lámina 4 sin copiarlo. Va siempre con FondoGeneral detrás:
// la piel deja la pantalla sin fondo propio.

import type { ReactNode } from 'react';
import { PielContext, type Piel } from '@/design/piel';
import { C, F, M, G, oroA, oroMezcla, px } from './tema';

export const PIEL_GENERAL: Piel = {
  acento: G,
  acentoBorde: oroA(0.3),
  acentoFondo: oroMezcla(0.16, C.tarjeta),
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

export function PielGeneral({ children }: { children: ReactNode }) {
  return <PielContext.Provider value={PIEL_GENERAL}>{children}</PielContext.Provider>;
}
