// NIVL · Coronas por rango (SISTEMA.md §7): SVG de un solo trazo, sin relleno.
//   · casco        → rango B (la galea: también el glifo del coach).
//   · laurel       → rango A.
//   · corona_arena → rango S.
// Todo en una retícula de 24 × 24; el tamaño solo escala.

import Svg, { Path } from 'react-native-svg';
import { ink } from '@/design/tokens';

export type CrownKind = 'casco' | 'laurel' | 'corona_arena';

/**
 * La galea: casco de gladiador (murmillo) de un trazo. Cresta, cúpula, ala
 * ancha y visera con rejilla en cruz. Pensada para leerse a 16, 24 y 96 px;
 * la reutiliza el CoachMark (negro sobre círculo blanco).
 */
export const GALEA_PATH =
  'M7.5 6.6C8.6 3.2 15.4 3.2 16.5 6.6' + // cresta
  'M4 15C4 8.6 7.6 5 12 5S20 8.6 20 15' + // cúpula
  'M2.5 15H21.5' + // ala
  'M8 15V20.5H16V15' + // visera
  'M8 17.75H16M12 15V20.5'; // rejilla

const LAUREL_PATH =
  // Rama izquierda y sus hojas
  'M10.5 20C5.5 18.5 3.5 13.5 5 7' +
  'M5.6 17.2L3 17.6M4.4 14.2L2 13.8M4.2 11.1L2.2 10.1M4.6 8.2L3.4 6.4' +
  // Rama derecha y sus hojas
  'M13.5 20C18.5 18.5 20.5 13.5 19 7' +
  'M18.4 17.2L21 17.6M19.6 14.2L22 13.8M19.8 11.1L21.8 10.1M19.4 8.2L20.6 6.4' +
  // Lazo
  'M10.5 20L12 21.5L13.5 20';

const CORONA_ARENA_PATH =
  // Corona de tres puntas con banda doble
  'M4.5 17L3 7.5L8 11.5L12 4.5L16 11.5L21 7.5L19.5 17Z' +
  'M4.5 20H19.5' +
  // Remaches de la banda
  'M8 14.2V14.3M12 14.2V14.3M16 14.2V14.3';

const PATHS: Record<CrownKind, string> = {
  casco: GALEA_PATH,
  laurel: LAUREL_PATH,
  corona_arena: CORONA_ARENA_PATH,
};

interface Props {
  kind: CrownKind;
  size: number;
  color?: string;
  /** Grosor en unidades de la retícula de 24 (1,5 por defecto). */
  strokeWidth?: number;
}

export function Crown({ kind, size, color = ink.ink10, strokeWidth = 1.5 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" pointerEvents="none">
      <Path
        d={PATHS[kind]}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
