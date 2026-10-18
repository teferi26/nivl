// NIVL · IRON · Colores del maniquí: la base monocroma del brand book y UN
// acento, el de IRON. Los músculos son lo único con color.
//
// El acento vive aquí hasta que el equipo Cliente publique `modoAcento` en
// src/design/tokens.ts (contrato F1); al integrar, ACENTO_IRON pasa a ser
// `modoAcento.iron` sin tocar nada más.

import { ink } from '@/design/tokens';
import type { EstiloCapa } from '@/iron/dibujo';

export const ACENTO_IRON = '#3D7BFF';

export interface PropsCapa {
  fill: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  fillRule?: 'evenodd' | 'nonzero';
}

export const ESTILO_CAPA: Readonly<Record<EstiloCapa, PropsCapa>> = {
  cuerpo: { fill: ink.ink8, stroke: ink.ink0, strokeWidth: 0.6 },
  cuerpoLejos: { fill: ink.ink4, stroke: ink.ink0, strokeWidth: 0.6 },
  principal: { fill: ACENTO_IRON },
  secundario: { fill: ACENTO_IRON, fillOpacity: 0.45 },
  principalLejos: { fill: ACENTO_IRON, fillOpacity: 0.5 },
  secundarioLejos: { fill: ACENTO_IRON, fillOpacity: 0.22 },
  carga: { fill: ink.ink9, stroke: ink.ink0, strokeWidth: 0.5, fillRule: 'evenodd' },
  cargaLejos: { fill: ink.ink6, fillRule: 'evenodd' },
  escenario: { fill: ink.ink2, stroke: ink.ink4, strokeWidth: 0.8 },
};

export const COLOR_SUELO = ink.ink3;
