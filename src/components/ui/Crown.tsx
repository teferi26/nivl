// NIVL · Coronas por rango (SISTEMA.md §7): SVG de un solo trazo, sin relleno.
//   · casco        → rango B (la galea: también el glifo del coach).
//   · laurel       → rango A.
//   · corona_arena → rango S.
// Retícula de 24 × 24 con la línea base en y = 20 (ahí se apoya sobre el aro
// del avatar). Solo trazo, extremos redondos. El grosor se ajusta al tamaño
// para que se lea igual a 16 que a 96 (`grosorCorona`).

import Svg, { Path } from 'react-native-svg';
import { ink } from '@/design/tokens';

export type CrownKind = 'casco' | 'laurel' | 'corona_arena';

/** Línea base de las coronas en la retícula de 24. */
export const BASE_CORONA = 20;

/**
 * La galea: el casco del mirmilón visto de frente, de un trazo. Cresta fina
 * de aleta, cúpula, ala ancha que cae hacia los lados y visera de placa que
 * se estrecha hacia la barbilla, con los dos ojos redondos enrejados (una
 * barra vertical y otra horizontal en cada uno, como los de Pompeya). A 16 px
 * la silueta (cresta, ala, placa) ya dice casco y los ojos se cierran en dos
 * puntos; a 48 y 96 se ve la rejilla. La reutiliza el CoachMark (negro sobre
 * círculo blanco).
 */
export const GALEA_PATH =
  'M10.8 6C10.8 3.2 11.2 1.2 12 1.2S13.2 3.2 13.2 6' + // cresta
  ' M5.5 12.5V11.5C5.5 7.8 8.4 6 12 6S18.5 7.8 18.5 11.5V12.5' + // cúpula
  ' M1.5 14C3 12.9 4.5 12.5 6.5 12.5H17.5C19.5 12.5 21 12.9 22.5 14' + // ala
  ' M6.5 12.5L7.1 18Q7.4 20 9.4 20H14.6Q16.6 20 16.9 18L17.5 12.5' + // visera
  ' M7.8 15.5A1.7 1.7 0 1 0 11.2 15.5A1.7 1.7 0 1 0 7.8 15.5' + // ojo izquierdo
  ' M12.8 15.5A1.7 1.7 0 1 0 16.2 15.5A1.7 1.7 0 1 0 12.8 15.5' + // ojo derecho
  ' M9.5 13.8V17.2M7.8 15.5H11.2M14.5 13.8V17.2M12.8 15.5H16.2'; // rejilla

/**
 * La galea para 24 o menos (CoachMark pequeño, junto a cada mensaje del
 * coach): a ese tamaño los dos ojos redondos se leían como una cara con gafas
 * de sol. Misma silueta (cresta, cúpula, ala y placa) con una sola ranura
 * horizontal de visera.
 */
export const GALEA_PATH_PEQUENA =
  'M10.8 6C10.8 3.2 11.2 1.2 12 1.2S13.2 3.2 13.2 6' + // cresta
  ' M5.5 12.5V11.5C5.5 7.8 8.4 6 12 6S18.5 7.8 18.5 11.5V12.5' + // cúpula
  ' M1.5 14C3 12.9 4.5 12.5 6.5 12.5H17.5C19.5 12.5 21 12.9 22.5 14' + // ala
  ' M6.5 12.5L7.1 18Q7.4 20 9.4 20H14.6Q16.6 20 16.9 18L17.5 12.5' + // visera
  ' M9.2 15.6H14.8'; // ranura

/** Por debajo de este tamaño (incluido) la galea va sin ojos. */
export const GALEA_TAM_PEQUENA = 24;

const LAUREL_PATH =
  'M3 17.5Q12 13.5 21 17.5' + // cinta
  ' M10.8 15.6C9.6 14.3 9.4 11.6 10 10C11.2 11.4 11.4 14 10.8 15.6Z' +
  ' M8 16.2C6.6 15.1 6 12.8 6.4 11.2C7.8 12.3 8.4 14.6 8 16.2Z' +
  ' M5.2 16.9C3.8 16.1 2.9 14.2 3 12.6C4.4 13.4 5.3 15.3 5.2 16.9Z' +
  ' M13.2 15.6C14.4 14.3 14.6 11.6 14 10C12.8 11.4 12.6 14 13.2 15.6Z' +
  ' M16 16.2C17.4 15.1 18 12.8 17.6 11.2C16.2 12.3 15.6 14.6 16 16.2Z' +
  ' M18.8 16.9C20.2 16.1 21.1 14.2 21 12.6C19.6 13.4 18.7 15.3 18.8 16.9Z' +
  ' M12 12.4V12.5' + // punto central
  ' M3 17.5L2 20M21 17.5L22 20'; // cintas hasta la base

const CORONA_ARENA_PATH =
  'M3.5 17.5L2.5 8.5L7.5 12L12 5.5L16.5 12L21.5 8.5L20.5 17.5Z' + // corona
  ' M3.5 20H20.5' + // banda
  ' M12 3.4V3.5M2.4 6.6V6.7M21.6 6.6V6.7'; // puntas

const PATHS: Record<CrownKind, string> = {
  casco: GALEA_PATH,
  laurel: LAUREL_PATH,
  corona_arena: CORONA_ARENA_PATH,
};

/** Grosor en unidades de la retícula: más grueso cuanto más pequeña. */
export function grosorCorona(size: number): number {
  if (size <= 16) return 2;
  if (size <= 24) return 1.5;
  if (size <= 48) return 1.25;
  return 1;
}

interface Props {
  kind: CrownKind;
  size: number;
  color?: string;
  /** Grosor en unidades de la retícula de 24. Por defecto, `grosorCorona(size)`. */
  strokeWidth?: number;
}

export function Crown({ kind, size, color = ink.ink10, strokeWidth }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" pointerEvents="none">
      <Path
        d={kind === 'casco' && size <= GALEA_TAM_PEQUENA ? GALEA_PATH_PEQUENA : PATHS[kind]}
        stroke={color}
        strokeWidth={strokeWidth ?? grosorCorona(size)}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
