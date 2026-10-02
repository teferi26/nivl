// NIVL · Trama y grano: el significado sin color (SISTEMA.md §0).
//
//   · <Trama/> → rayado a 45° (ink4, 1 pt cada 6 pt): alerta, penalización,
//     bloqueado, pendiente. Sustituye al rojo.
//   · <Grano/> → puntos finos (ink6, r 0,7 cada 4 pt): logro, racha, Élite.
//     Sustituye al oro. Con ink4 no se distinguía del fondo.
// Sobre una superficie de lectura, la textura va como MARCO (el contenido en
// una placa lisa por dentro, ver Card alerta/logro): el texto nunca se pinta
// encima del rayado ni del grano.
//
// Las dos llenan a su padre (posición absoluta) y no capturan toques. El padre
// decide el tamaño y, si hace falta, `overflow: 'hidden'`.

import { useId } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Line, Pattern, Rect } from 'react-native-svg';
import { ink } from '@/design/tokens';

interface Props {
  /** Color del trazo o del punto. Trama: ink4 por defecto; Grano: ink6. */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * React 19 genera ids como «r0» (con comillas angulares) y en web rompen
 * `url(#…)`. Se dejan solo caracteres seguros.
 */
export function useIdSeguro(prefijo: string): string {
  return `${prefijo}${useId().replace(/[^A-Za-z0-9_-]/g, '')}`;
}

export function Trama({ color = ink.ink4, style }: Props) {
  const id = useIdSeguro('trama');
  return (
    <Svg width="100%" height="100%" style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Defs>
        <Pattern id={id} patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(45)">
          <Line x1={0} y1={0} x2={0} y2={6} stroke={color} strokeWidth={1} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

export function Grano({ color = ink.ink6, style }: Props) {
  const id = useIdSeguro('grano');
  return (
    <Svg width="100%" height="100%" style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Defs>
        <Pattern id={id} patternUnits="userSpaceOnUse" width={4} height={4}>
          <Circle cx={2} cy={2} r={0.7} fill={color} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
