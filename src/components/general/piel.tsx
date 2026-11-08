// NIVL · Modo GENERAL: la piel Ónix para las piezas base (src/design/piel.ts).
// Con <PielGeneral> alrededor, lo que ya existe y se reutiliza en General
// (Arena, el detalle de una campaña, sus hojas) toma el hueso, los radios y las
// superficies de vidrio sin copiarlo. Va siempre con FondoGeneral detrás: la
// piel deja la pantalla sin fondo propio. El oro no rellena botones: lo activo
// es hueso.

import type { ReactNode } from 'react';
import { PielContext, type Piel } from '@/design/piel';
import { ink, radio, type as tipo, vidrio } from '@/design/tokens';

export const PIEL_GENERAL: Piel = {
  acento: ink.ink10,
  acentoBorde: vidrio.borde,
  acentoFondo: vidrio.campo,
  // Opaca: también es la superficie de las hojas, que flotan sobre el contenido.
  tarjeta: ink.ink1,
  campo: vidrio.campo,
  borde: vidrio.borde,
  sobreAcento: ink.ink0,
  radio: radio.control,
  radioBoton: radio.control,
  radioChip: radio.chip,
  radioHoja: radio.hoja,
  fuenteBoton: tipo.label.family,
  pantallaTransparente: true,
};

export function PielGeneral({ children }: { children: ReactNode }) {
  return <PielContext.Provider value={PIEL_GENERAL}>{children}</PielContext.Provider>;
}
