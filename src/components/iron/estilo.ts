// NIVL · IRON · Colores del maniquí, estilo lámina de anatomía: la base
// monocroma del brand book con TODOS los músculos dibujados (gris oscuro con
// contorno fino) y UN acento, el de IRON, para los que trabaja el ejercicio:
// principal relleno y con brillo en la fase de esfuerzo, secundarios tenues.
//
// El acento vive aquí hasta que el equipo Cliente publique `modoAcento` en
// src/design/tokens.ts (contrato F1); al integrar, ACENTO_IRON pasa a ser
// `modoAcento.iron` sin tocar nada más.

import { ink } from '@/design/tokens';
import type { EstiloCapa } from '@/iron/dibujo';

export const ACENTO_IRON = '#3D7BFF';
/** El mismo azul aclarado: el brillo del músculo principal al hacer fuerza. */
export const BRILLO_IRON = '#A9C4FF';

export interface PropsCapa {
  fill: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  fillRule?: 'evenodd' | 'nonzero';
}

export const ESTILO_CAPA: Readonly<Record<EstiloCapa, PropsCapa>> = {
  cuerpo: { fill: ink.ink3, stroke: ink.ink6, strokeWidth: 0.6 },
  cuerpoLejos: { fill: ink.ink1, stroke: ink.ink4, strokeWidth: 0.5 },
  musculo: { fill: ink.ink4, stroke: ink.ink6, strokeWidth: 0.35 },
  musculoLejos: { fill: ink.ink2, stroke: ink.ink3, strokeWidth: 0.3 },
  secundario: { fill: ACENTO_IRON, fillOpacity: 0.42, stroke: ACENTO_IRON, strokeWidth: 0.4 },
  secundarioLejos: { fill: ACENTO_IRON, fillOpacity: 0.2, stroke: ACENTO_IRON, strokeWidth: 0.3, strokeOpacity: 0.5 },
  principal: { fill: ACENTO_IRON, stroke: BRILLO_IRON, strokeWidth: 0.45 },
  principalLejos: { fill: ACENTO_IRON, fillOpacity: 0.55, stroke: ACENTO_IRON, strokeWidth: 0.35 },
  carga: { fill: ink.ink9, stroke: ink.ink0, strokeWidth: 0.5, fillRule: 'evenodd' },
  cargaLejos: { fill: ink.ink6, stroke: ink.ink0, strokeWidth: 0.4, fillRule: 'evenodd' },
  escenario: { fill: ink.ink1, stroke: ink.ink4, strokeWidth: 0.8 },
};

/** El brillo del principal: trazo más grueso y claro según el esfuerzo (0 a 1). */
export function brilloPrincipal(esfuerzo: number): { strokeWidth: number; strokeOpacity: number } {
  'worklet';
  return { strokeWidth: 0.45 + 1.05 * esfuerzo, strokeOpacity: 0.55 + 0.45 * esfuerzo };
}

export const COLOR_SUELO = ink.ink3;
