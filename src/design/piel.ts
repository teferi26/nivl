// NIVL · La piel de un mundo (Modos). Por defecto (null) la app es el mármol
// de NIVL: blanco y negro, radio 0. Dentro de un mundo que la provee (hoy,
// IRON: `PielIron` en src/components/ironmundo/piel.tsx) las piezas base
// (Button, Chip, Campo, Sheet y Screen) toman su acento, sus radios y sus
// superficies, así las hojas y los formularios que ya existen (Gimnasio,
// Cardio, Dieta) se ven en la piel del mundo sin copiarlos.
//
// Es aditivo: sin proveedor, ninguna pieza cambia ni un píxel.

import { createContext, useContext, type ReactNode } from 'react';

export interface Piel {
  /** El color de lo activo: botón principal, chip elegido, foco. */
  acento: string;
  /** El acento con transparencia para bordes (botón secundario, hoja). */
  acentoBorde: string;
  /** Fondo de lo elegido (chip): el acento mezclado con la tarjeta. */
  acentoFondo: string;
  /** Superficie de tarjetas y hojas. */
  tarjeta: string;
  /** Fondo de los campos de texto. */
  campo: string;
  /** Borde de campos y chips sin elegir. */
  borde: string;
  /** Texto sobre el acento. */
  sobreAcento: string;
  radio: number;
  radioBoton: number;
  radioChip: number;
  radioHoja: number;
  /** Familia de los rótulos de botón. */
  fuenteBoton: string;
  /**
   * Screen sin fondo propio (el mundo pinta el suyo detrás) y, si `cubreArriba`,
   * sin margen seguro de arriba (lo pone una cabecera del mundo por encima).
   */
  pantallaTransparente: boolean;
  cubreArriba?: boolean;
  /**
   * El coach vestido del mundo (opcional). Con ella, el chat (src/components/coach)
   * cambia su cabecera por la del mundo, firma con su avatar, redondea burbujas
   * y compositor y deja hueco abajo para el disco central de la barra. Sin
   * ella, el chat de NIVL queda idéntico. Solo presentación: ninguna lógica.
   */
  coach?: PielCoach;
}

export interface PielCoach {
  /** La cabecera del mundo en lugar de la del coach (con sus dos accesos). */
  cabecera: (p: { linea: string; sinPro: boolean; profundo: boolean; cargando: boolean; onPro: () => void; onMemoria: () => void }) => ReactNode;
  /** El avatar que firma los mensajes del coach (en lugar de la galea). */
  avatar: ReactNode;
  /** Lado del avatar: los mensajes seguidos dejan ese hueco a la izquierda. */
  ladoAvatar: number;
  /** Fondo de la burbuja del coach y de la del usuario. */
  burbuja: string;
  burbujaUsuario: string;
  radioBurbuja: number;
  /** Separadores de día y rótulos menores: familia y color. */
  fuenteRotulo: string;
  textoTenue: string;
  /** Hueco extra bajo el compositor (el medio disco de la barra). */
  margenInferior: number;
}

export const PielContext = createContext<Piel | null>(null);

export function usePiel(): Piel | null {
  return useContext(PielContext);
}
