// NIVL · La insignia Élite: un laurel pequeño en oro junto al nombre.
//
// El oro es el laurel del sistema de diseño: rachas, hitos y, desde la fase 3,
// el estatus Élite (decisión del dueño, §11.5 del plan). Es estética y nada
// más: no da XP ni cambia el orden de ningún ranking.
//
// Dibujado a mano con react-native-svg (ya en el binario): ninguna familia de
// iconos gratuita trae una corona de laurel.

import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Ellipse, G, Path } from 'react-native-svg';
import { INSIGNIA_ELITE_LABEL } from '@/lib/elite';
import { colors } from '@/lib/theme';

// Hojas de la rama izquierda: [cx, cy, ángulo]. La derecha es su espejo.
const HOJAS: readonly [number, number, number][] = [
  [6.9, 18.6, 62],
  [4.6, 15.6, 38],
  [3.6, 12.0, 14],
  [4.0, 8.4, -10],
  [5.6, 5.2, -32],
];

interface Props {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function EliteBadge({ size = 14, style }: Props) {
  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={INSIGNIA_ELITE_LABEL}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <G stroke={colors.gold} strokeWidth={1.3} strokeLinecap="round" fill="none">
          <Path d="M11 21.5 C 5.5 19.5 2.8 14.5 4.6 4" />
          <Path d="M13 21.5 C 18.5 19.5 21.2 14.5 19.4 4" />
        </G>
        <G fill={colors.gold}>
          {HOJAS.map(([x, y, a]) => (
            <G key={`${x}-${y}`}>
              <Ellipse cx={x} cy={y} rx={1.25} ry={2.3} transform={`rotate(${a} ${x} ${y})`} />
              <Ellipse cx={24 - x} cy={y} rx={1.25} ry={2.3} transform={`rotate(${-a} ${24 - x} ${y})`} />
            </G>
          ))}
        </G>
      </Svg>
    </View>
  );
}
