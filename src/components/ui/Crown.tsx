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
 * La galea: el casco del mirmilón visto de perfil (mira a la derecha), de un
 * trazo. Cresta alta en abanico que se vence hacia delante, con tres varillas;
 * cúpula baja; ala ancha que cae hacia la nuca y se levanta en la frente; y la
 * visera abombada con una rejilla de tres barras horizontales finas. Sin ojos
 * redondos: de frente, dos ojos bajo un ala se leían como una cara con gafas
 * de sol y sombrero. Se usa por encima de 24 (CoachMark de 48 y 64, la galea
 * de 96 del Coach y la del jefe de campaña); por debajo, GALEA_PATH_PEQUENA.
 */
export const GALEA_PATH =
  'M7.4 8.4C6.6 4.6 9.6 1.4 14.2 1.2C16.8 2.8 17.8 6 16.8 9.6' + // cresta en abanico
  ' M10.2 7.6L10.8 3M12.6 7.4L13.8 2.2M14.8 8L16.2 4' + // varillas de la cresta
  ' M4.6 12.5C4.6 9.2 7.6 7.4 11 7.4C14.4 7.4 17.4 9 17.8 12.5' + // cúpula
  ' M1.4 16.4C2.6 14.2 3.8 12.5 6 12.5H17.8C19.4 12.5 20.8 12.2 22.2 11.4' + // ala
  ' M7.4 12.5C7.4 16.4 8.4 19.2 10.8 20H16.8C18.6 20 19.6 18.8 19.7 16.6C19.8 14.6 19 13.2 17.8 12.5' + // visera
  ' M11.6 12.5V20M11.6 14.6H19.5M11.6 16.6H19.7M11.6 18.6H19.4'; // rejilla

/**
 * La galea para 24 o menos (CoachMark pequeño, junto a cada mensaje del
 * coach): de frente, con cresta, cúpula, ala, placa y una sola ranura de
 * visera. El perfil de la grande se empasta a ese tamaño (la cresta y la
 * rejilla se funden en una «A»); esta silueta se sigue leyendo como casco.
 */
export const GALEA_PATH_PEQUENA =
  'M10.8 6C10.8 3.2 11.2 1.2 12 1.2S13.2 3.2 13.2 6' + // cresta
  ' M5.5 12.5V11.5C5.5 7.8 8.4 6 12 6S18.5 7.8 18.5 11.5V12.5' + // cúpula
  ' M1.5 14C3 12.9 4.5 12.5 6.5 12.5H17.5C19.5 12.5 21 12.9 22.5 14' + // ala
  ' M6.5 12.5L7.1 18Q7.4 20 9.4 20H14.6Q16.6 20 16.9 18L17.5 12.5' + // visera
  ' M9.2 15.6H14.8'; // ranura

/** Hasta este tamaño (incluido) la galea va de frente y sin rejilla. */
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
